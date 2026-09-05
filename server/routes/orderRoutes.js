const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { getNextInvoiceNumber } = require('../utils/helpers');
const Cart = require('../models/Cart');
const GiftCard = require('../models/GiftCard');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Settings = require('../models/Settings');
const UserActivity = require('../models/UserActivity');
const geoip = require('geoip-lite');
const auth = require('../middleware/auth');
const { logAction } = require('../utils/logger');
const { sendShippingUpdateEmail } = require('../services/emailService');
const User = require('../models/User');
const { invalidateAnalytics } = require('../utils/cache');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');

function getProductItemPriceAndStock(product, variantId) {
  if (!product) return { price: 0, stock: 0, weight: '', image: '', variant: null };

  let variant = null;
  if (variantId && product.variants && product.variants.length > 0) {
    const vIdStr = (variantId._id || variantId).toString();
    variant = product.variants.find(v => v._id.toString() === vIdStr);
  }

  // If no variant matched or specified, but product has variants and no top-level price
  if (!variant && product.variants && product.variants.length > 0 && (product.price === null || product.price === undefined || product.price === 0)) {
    variant = product.variants[0];
  }

  const price = variant ? variant.price : (product.price ?? 0);
  const stock = variant ? variant.stock : (product.stock ?? 0);
  const weight = variant ? variant.weight : (product.weight || '');
  const image = product.image || (product.images && product.images[0]) || '';

  return { price: Number(price) || 0, stock: Number(stock) || 0, weight, image, variant };
}

async function pushStatusAndNotify(order, status, note, updatedBy, notificationData) {
  order.statusHistory.push({ status, note, updatedBy, updatedAt: new Date() });
  
  if (status === 'DELIVERED' && order.user && !order.rewardPointsAwarded) {
    try {
      const User = require('../models/User');
      const WalletTransaction = require('../models/WalletTransaction');
      const user = await User.findById(order.user._id || order.user);
      
      if (user) {
        // e.g. 1 point for every 10 Rs spent
        const points = Math.floor(order.totalPrice / 10);
        user.rewardPoints += points;
        
        // ── Referral Reward Logic ──
        if (user.referredBy && !user.referralRewardClaimed) {
          const referrer = await User.findById(user.referredBy);
          if (referrer) {
            user.walletBalance += 50;
            referrer.walletBalance += 50;
            user.referralRewardClaimed = true;
            
            await referrer.save();

            // Transaction for new user (referee)
            await WalletTransaction.create({
              user: user._id,
              type: 'CREDIT',
              amount: 50,
              balanceAfter: user.walletBalance,
              description: 'Referral bonus (first order delivered)',
              transactionType: 'REWARD_CONVERSION'
            });

            // Transaction for referrer
            await WalletTransaction.create({
              user: referrer._id,
              type: 'CREDIT',
              amount: 50,
              balanceAfter: referrer.walletBalance,
              description: `Referral bonus for inviting ${user.name} (first order delivered)`,
              transactionType: 'REWARD_CONVERSION'
            });

            // Notification for referrer
            try {
              const notif = new Notification({
                user: referrer._id,
                type: 'SYSTEM', // REWARD_EARNED was not in enum
                title: 'Referral Bonus!',
                message: `You earned ₹50 for referring ${user.name}!`,
                link: '/profile'
              });
              await notif.save();
            } catch (err) { console.error('Referral notif err:', err); }
          }
        }
        
        await user.save();
        order.rewardPointsAwarded = true;
        
        const notif = new Notification({
          user: user._id,
          type: 'SYSTEM', // REWARD_EARNED is not in enum, using SYSTEM
          title: 'Reward Points Earned!',
          message: `You earned ${points} reward points for your recent order.`,
          link: '/profile'
        });
        await notif.save();
      }
    } catch (err) {
      console.error('Error awarding reward points:', err);
    }
  }

  if (notificationData && (order.user._id || order.user)) {
    const notif = new Notification({
      user: order.user._id || order.user,
      ...notificationData
    });
    await notif.save();
    try {
      const io = getIO();
      io.to(`user:${notif.user}`).emit('notification', notif);
    } catch (err) {}
  }
  try {
    const io = getIO();
    io.to(`order:${order._id}`).emit('orderStatusUpdated', order);
  } catch (err) {}
}

// ========================================================================
// CREATE ORDER - IMPROVED FLOW
// ========================================================================
router.post('/', auth.optional, async (req, res) => {
  try {
    const { paymentMethod, couponCode, guestEmail, guestCartItems } = req.body;

    if (!req.user && paymentMethod === 'COD') {
      return res.status(400).json({ message: 'Cash on Delivery is not available for Guest Checkout' });
    }

    let cartItems = [];
    if (req.user) {
      // 1️⃣ GET CART WITH PRODUCT DETAILS FOR LOGGED IN USERS
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }
      cartItems = cart.items;
    } else {
      // 1️⃣ PARSE GUEST CART ITEMS
      if (!guestCartItems || guestCartItems.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }
      const productIds = guestCartItems.map(i => i.product?._id || i.product || i.productId);
      const products = await Product.find({ _id: { $in: productIds } });
      cartItems = guestCartItems.map(item => {
        const pId = (item.product?._id || item.product || item.productId || '').toString();
        const dbProduct = products.find(p => p._id.toString() === pId);
        return {
          product: dbProduct,
          variant: item.variant || null,
          quantity: item.quantity
        };
      });
    }

    // 2️⃣ VALIDATE STOCK
    const stockIssues = [];

    for (const item of cartItems) {
      if (!item.product) continue;
      
      const { price: targetPrice, stock: targetStock, image: targetImage } = getProductItemPriceAndStock(item.product, item.variant);

      if (targetStock < item.quantity) {
        stockIssues.push({
          itemId: item._id,
          productId: item.product._id,
          variantId: item.variant,
          name: item.product.name,
          image: targetImage,
          price: targetPrice,
          requested: item.quantity,
          available: targetStock,
        });
      }
    }

    // If there are stock issues, return them WITHOUT modifying the cart
    if (stockIssues.length > 0) {
      // Return all cart items with stock info so frontend can display the full cart
      const allItems = cartItems
        .filter(i => i.product)
        .map(i => {
          const { price: vPrice, stock: vStock, image: vImage } = getProductItemPriceAndStock(i.product, i.variant);
          return {
            itemId: i._id,
            productId: i.product._id,
            name: i.product.name,
            image: vImage,
            price: vPrice,
            quantity: i.quantity,
            stock: vStock,
            hasIssue: vStock < i.quantity,
          }
        });

      return res.status(409).json({
        message: 'Some items have stock issues',
        stockIssues,
        allItems,
      });
    }

    // 3️⃣ PREPARE ORDER ITEMS (all items passed stock check if we reach here)
    const orderItems = cartItems.filter(i => i.product).map(item => {
      const { price: finalPrice, weight: finalWeight, image: finalImage, variant } = getProductItemPriceAndStock(item.product, item.variant);
      return {
        product: item.product._id,
        variant: variant?._id || item.variant || null,
        name: item.product.name,
        weight: finalWeight,
        image: finalImage,
        price: finalPrice,
        quantity: item.quantity
      };
    });

    // 4️⃣ CALCULATE PRICES (BACKEND - SECURE! Uses DB-configured GST)
    // Fetch live settings — admin can change GST rate without any code deploy
    const settings = await Settings.getGlobal();
    const gstRatePct = settings.gstEnabled ? settings.gstRate : 0;   // e.g. 5
    const gstMultiplier = gstRatePct / 100;                           // e.g. 0.05
    const FREE_SHIPPING_THRESHOLD = settings.freeShippingThreshold;   // e.g. 500
    const SHIPPING_CHARGE = settings.shippingCharge;                  // e.g. 50

    let itemsPrice = orderItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    // Apply B2B Discount directly to itemsPrice before coupons and shipping
    if (req.user && req.user.role === 'b2b_customer' && req.user.b2bDiscountPercentage > 0) {
      const b2bDiscount = (itemsPrice * req.user.b2bDiscountPercentage) / 100;
      itemsPrice -= b2bDiscount;
    }

    let discount = 0;
    let appliedCoupon = null;

    // Apply coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      });

      if (coupon && itemsPrice >= coupon.minOrderValue) {
        // Check usage limit
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          return res.status(400).json({ message: 'Coupon usage limit exceeded' });
        }

        // Check user-specific usage (ignore failed/cancelled/expired orders)
        if (coupon.usagePerUser && req.user) {
          const userUsage = await Order.countDocuments({
            user: req.user._id,
            'coupon.code': couponCode.toUpperCase(),
            paymentStatus: { $nin: ['FAILED', 'CANCELLED', 'EXPIRED'] }
          });
          if (userUsage >= coupon.usagePerUser) {
            return res.status(400).json({ message: 'You have already used this coupon' });
          }
        }

        // Calculate discount
        if (coupon.discountType === 'percentage') {
          discount = (itemsPrice * coupon.discountValue) / 100;
          if (coupon.maxDiscount) {
            discount = Math.min(discount, coupon.maxDiscount);
          }
        } else {
          discount = coupon.discountValue;
        }

        appliedCoupon = {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discountAmount: discount
        };
      } else if (coupon && itemsPrice < coupon.minOrderValue) {
        return res.status(400).json({
          message: `Minimum order value of ₹${coupon.minOrderValue} required for this coupon`
        });
      } else {
        return res.status(400).json({ message: 'Invalid or expired coupon code' });
      }
    }

    // Tax is inclusive in the MRP
    const taxPrice = (itemsPrice - discount) - ((itemsPrice - discount) / (1 + gstMultiplier));
    const shippingPrice = (itemsPrice - discount) > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CHARGE;
    const totalPrice = itemsPrice - discount + shippingPrice;

    let finalTotalPrice = totalPrice;
    let walletUsed = 0;
    
    // Evaluate wallet if requested
    if (req.body.useWallet && req.user) {
      const user = await User.findById(req.user._id);
      if (user && user.walletBalance > 0) {
        walletUsed = Math.min(finalTotalPrice, user.walletBalance);
        finalTotalPrice -= walletUsed;
      }
    }
    
    // Evaluate Gift Card if requested
    let appliedGiftCard = null;
    let giftCardUsedAmount = 0;
    if (req.body.giftCardCode && finalTotalPrice > 0) {
      const giftCard = await GiftCard.findOne({ code: req.body.giftCardCode.toUpperCase() });
      if (!giftCard) return res.status(404).json({ message: 'Invalid gift card code' });
      if (!giftCard.isActive) return res.status(400).json({ message: 'This gift card is inactive' });
      if (new Date(giftCard.validUntil) < new Date()) return res.status(400).json({ message: 'This gift card has expired' });
      if (giftCard.balance <= 0) return res.status(400).json({ message: 'This gift card has no remaining balance' });

      giftCardUsedAmount = Math.min(finalTotalPrice, giftCard.balance);
      finalTotalPrice -= giftCardUsedAmount;
      appliedGiftCard = {
        code: giftCard.code,
        amountUsed: giftCardUsedAmount
      };
    }

    if (finalTotalPrice === 0 && (walletUsed > 0 || giftCardUsedAmount > 0)) {
      paymentMethod = 'Wallet'; // Fully paid by wallet or gift card (no Razorpay needed)
    }


    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    session.startTransaction();

    let order;
    try {
      // ✅ FIX B2: Validate shipping address before creating order
    const addr = req.body.shippingAddress;
    if (!addr || !addr.name || !addr.phone || !addr.street || !addr.city || !addr.state || !addr.zipCode) {
      return res.status(400).json({
        message: 'A complete shipping address (name, phone, street, city, state, pincode) is required to place an order.'
      });
    }

    if (settings.serviceablePincodes && settings.serviceablePincodes.length > 0) {
      if (!settings.serviceablePincodes.includes(addr.zipCode.trim())) {
        return res.status(400).json({
          message: `Delivery is currently not available for pincode ${addr.zipCode}.`
        });
      }
    }

    // 5️⃣ CREATE ORDER DATA
    const payableAmount = Math.max(0, Math.round(finalTotalPrice * 100) / 100);

    const orderData = {
      user: req.user ? req.user._id : null,
      guestEmail: guestEmail || null,
      orderItems,
      shippingAddress: addr,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice, // original total
      walletUsed, // amount deducted from wallet
      payableAmount, // net amount to pay via online gateway or COD
      discount,
      coupon: appliedCoupon,
      giftCard: appliedGiftCard,
      gstRate: gstRatePct,
      isPaid: false,
      paymentStatus: 'PENDING',
      statusHistory: [{
        status: 'PENDING',
        note: 'Order placed',
        updatedBy: req.user ? req.user._id : null,
        updatedAt: new Date()
      }]
    };


      // 6️⃣ CREATE ORDER
      order = new Order(orderData);
      await order.save({ session });
      
      // Handle Wallet Deduction
      if (walletUsed > 0 && req.user) {
        const userForWallet = await User.findById(req.user._id).session(session);
        if (userForWallet.walletBalance < walletUsed) {
          throw new Error('Insufficient wallet balance.');
        }
        userForWallet.walletBalance -= walletUsed;
        await userForWallet.save({ session });
        
        const WalletTransaction = require('../models/WalletTransaction');
        await WalletTransaction.create([{
          user: req.user._id,
          type: 'DEBIT',
          amount: walletUsed,
          balanceAfter: userForWallet.walletBalance,
          description: `Used for order ${order.orderIdString || order._id}`,
          relatedOrder: order._id,
          transactionType: 'PURCHASE'
        }], { session });
      }

      // Handle Gift Card Deduction
      if (giftCardUsedAmount > 0 && appliedGiftCard) {
        const giftCardRecord = await GiftCard.findOne({ code: appliedGiftCard.code }).session(session);
        if (!giftCardRecord || giftCardRecord.balance < giftCardUsedAmount) {
          throw new Error('Gift card balance insufficient during transaction.');
        }
        giftCardRecord.balance -= giftCardUsedAmount;
        await giftCardRecord.save({ session });
      }

      // 7️⃣ REDUCE STOCK (ATOMIC)
      for (const item of cartItems) {
        if (!item.product) continue; // Skip items where product was deleted
        
        let updateQuery = {};
        let updateOp = {};
        
        if (item.variant) {
           updateQuery = { _id: item.product._id, "variants._id": item.variant, "variants.stock": { $gte: item.quantity } };
           updateOp = { $inc: { "variants.$.stock": -item.quantity } };
        } else {
           updateQuery = { _id: item.product._id, stock: { $gte: item.quantity } };
           updateOp = { $inc: { stock: -item.quantity } };
        }
        
        const updated = await Product.findOneAndUpdate(
          updateQuery,
          updateOp,
          { new: true, session }
        );
        
        if (!updated) {
          throw new Error(`Insufficient stock for ${item.product.name}.`);
        }
      }

      // 8️⃣ FOR COD OR WALLET - CONFIRM IMMEDIATELY
      if (paymentMethod === 'COD' || paymentMethod === 'Wallet') {
        order.paymentStatus = paymentMethod === 'Wallet' ? 'PAID' : 'COD_CONFIRMED';
        order.isPaid = paymentMethod === 'Wallet';
        if (paymentMethod === 'Wallet') order.paidAt = new Date();
        
        order.statusHistory.push({
          status: order.paymentStatus,
          note: `Order confirmed (${paymentMethod === 'Wallet' ? 'Paid via Wallet' : 'Cash on Delivery'})`,
          updatedBy: req.user ? req.user._id : null,
          updatedAt: new Date()
        });
        
        // Generate unique incremental invoice number (INV0000000001)
        
        
        await order.save({ session });

        // Clear cart
        if (req.user) {
          const cart = await Cart.findOne({ user: req.user._id });
          if (cart) {
            cart.items = [];
            await cart.save({ session });
          }
        }

        // Increment coupon usage
        if (appliedCoupon) {
          order.couponUsageIncremented = true;
          await Coupon.findOneAndUpdate(
            { code: appliedCoupon.code },
            { $inc: { usedCount: 1 } },
            { session }
          );
        }
      }

      await session.commitTransaction();
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
    // FOR ONLINE - Keep cart until payment succeeds

    await order.populate('user', 'name email');
    await order.populate('orderItems.product');

    // ── 8.5 Send Email & WhatsApp (COD only) ──────────────────────────────
    if (paymentMethod === 'COD') {
      try {
        const { sendOrderSuccessEmail } = require('../services/emailService');
        const { sendOrderSuccessWhatsApp } = require('../services/whatsappService');
        
        await sendOrderSuccessEmail(order, req.user ? order.user.email : guestEmail);
        await sendOrderSuccessWhatsApp(order, req.user ? order.user.email : guestEmail);
      } catch (err) {
        console.error('COD SUCCESS NOTIFICATION ERROR:', err);
      }
    }

    // Invalidate analytics cache so next fetch gets fresh data
    invalidateAnalytics().catch(() => {});

    // ── 8.6 Log User Activity ─────────────────────────────────────────
    try {
      let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      if (ipAddress) ipAddress = ipAddress.split(',')[0].trim();
      if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1' || !ipAddress) ipAddress = '127.0.0.1';
      
      let location = 'Local/Unknown';
      if (ipAddress !== '127.0.0.1') {
        const geo = geoip.lookup(ipAddress);
        if (geo) {
          location = `${geo.city || 'Unknown City'}, ${geo.country || 'Unknown Country'}`;
        }
      }

      await UserActivity.create({
        user: req.user ? req.user._id : null,
        action: 'ORDER_PLACED',
        details: {
          orderId: order._id.toString(),
          invoiceNumber: order.invoiceNumber,
          totalPrice: order.totalPrice,
          paymentMethod: order.paymentMethod,
          itemsCount: order.orderItems.length,
          guest: !req.user
        },
        ipAddress,
        location
      });
    } catch (activityErr) {
      console.error('Failed to log order activity:', activityErr);
    }

    if (paymentMethod === 'Online') {
      const razorpay = require('../config/razorpay');
      const amountToChargePaise = Math.round((order.payableAmount ?? order.totalPrice) * 100);

      const razorpayOrder = await razorpay.orders.create({
        amount: amountToChargePaise,
        currency: 'INR',
        receipt: `receipt_${order._id}`,
        notes: {
          orderId: order._id.toString(),
          userId: req.user ? req.user._id.toString() : 'guest'
        }
      });
      
      order.paymentInfo = {
        razorpay_order_id: razorpayOrder.id
      };
      await order.save();
      
      return res.status(201).json({ order, razorpayOrder });
    }

    res.status(201).json(order);

  } catch (error) {
    console.error('ORDER CREATION ERROR:', error);
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// PRICE PREVIEW — returns full cart breakdown using live DB settings
// Called by Cart and Checkout pages to display accurate totals
// ========================================================================
router.post('/price-preview', auth.optional, async (req, res) => {
  try {
    let cartItems = [];
    if (req.user) {
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      if (cart) cartItems = cart.items;
    } else {
      const { guestCartItems } = req.body;
      if (guestCartItems && guestCartItems.length > 0) {
        const productIds = guestCartItems.map(i => i.product?._id || i.product || i.productId);
        const products = await Product.find({ _id: { $in: productIds } });
        cartItems = guestCartItems.map(item => {
          const pId = (item.product?._id || item.product || item.productId || '').toString();
          const dbProduct = products.find(p => p._id.toString() === pId);
          return { product: dbProduct, variant: item.variant || null, quantity: item.quantity };
        });
      }
    }

    if (!cartItems || cartItems.length === 0) {
      return res.json({ itemsPrice: 0, taxPrice: 0, shippingPrice: 0, totalPrice: 0, gstRate: 0, freeShippingThreshold: 500 });
    }

    const settings = await Settings.getGlobal();
    const gstRatePct = settings.gstEnabled ? settings.gstRate : 0;
    const gstMultiplier = gstRatePct / 100;

    let itemsPrice = cartItems.reduce(
      (total, item) => {
        if (!item.product) return total;
        const { price } = getProductItemPriceAndStock(item.product, item.variant);
        return total + price * (item.quantity || 1);
      },
      0
    );
    
    // Apply B2B Discount directly to itemsPrice before shipping
    if (req.user && req.user.role === 'b2b_customer' && req.user.b2bDiscountPercentage > 0) {
      const b2bDiscount = (itemsPrice * req.user.b2bDiscountPercentage) / 100;
      itemsPrice -= b2bDiscount;
    }

    // Tax is inclusive
    const taxPrice      = itemsPrice - (itemsPrice / (1 + gstMultiplier));
    const shippingPrice = itemsPrice > settings.freeShippingThreshold ? 0 : settings.shippingCharge;
    const totalPrice    = itemsPrice + shippingPrice;

    res.json({
      itemsPrice,
      gstRate: gstRatePct,
      taxPrice,
      shippingPrice,
      freeShippingThreshold: settings.freeShippingThreshold,
      totalPrice,
    });
  } catch (error) {
    console.error('PRICE PREVIEW ERROR:', error);
    res.status(500).json({ message: 'Failed to calculate price preview' });
  }
});

// ========================================================================
// PAYMENT FAILED / CANCELLED (RETORES WALLET, GIFTCARD, & VARIANT STOCK)
// ========================================================================
router.post('/fail', auth.optional, async (req, res) => {
  try {
    const { razorpay_order_id } = req.body;

    if (!razorpay_order_id) {
      return res.status(400).json({ message: 'razorpay_order_id required' });
    }

    const query = {
      paymentStatus: 'PENDING',
      'paymentInfo.razorpay_order_id': razorpay_order_id
    };
    if (req.user) {
      query.user = req.user._id;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        message: 'Pending order not found or already processed'
      });
    }

    // ── 1. Send Failure Email (non-fatal) ──────────────────────────────────
    try {
      const { sendOrderFailureEmail } = require('../services/emailService');
      const populatedOrder = await order.populate('user', 'name email');
      const toEmail = populatedOrder.user?.email || order.guestEmail;
      const userName = populatedOrder.user?.name || order.shippingAddress?.name || 'Customer';
      if (toEmail) {
        await sendOrderFailureEmail({
          to: toEmail,
          userName,
          orderId: order._id.toString(),
          totalPrice: order.totalPrice,
          reason: 'Payment was cancelled or failed.'
        });
      }
    } catch (emailErr) {
      console.error('FAILURE EMAIL ERROR:', emailErr);
    }

    // 🔁 RESTORE ALL RESOURCES (VARIANT-AWARE STOCK, WALLET BALANCE, GIFT CARD)
    const { restoreOrderResources } = require('../utils/orderResourceHelper');
    const restoreResult = await restoreOrderResources(order, 'Payment cancelled or failed');

    // Update order status so user and audit trail are preserved
    order.paymentStatus = 'FAILED';
    order.orderStatus = 'CANCELLED';
    order.cancelReason = 'Payment cancelled or failed';
    order.cancelledAt = new Date();
    order.statusHistory.push({
      status: 'FAILED',
      note: `Payment cancelled/failed. Restored: ${restoreResult.walletRefunded > 0 ? `Wallet ₹${restoreResult.walletRefunded}, ` : ''}Stock restored.`,
      updatedAt: new Date()
    });
    await order.save();

    res.json({
      success: true,
      message: 'Payment cancelled. Any deducted wallet balance and product stock have been restored.',
      walletRefunded: restoreResult.walletRefunded,
      giftCardRefunded: restoreResult.giftCardRefunded
    });

  } catch (error) {
    console.error('ORDER FAIL ERROR:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ========================================================================
// VERIFY COUPON (BEFORE CHECKOUT) — returns full price breakdown
// ========================================================================
router.post('/verify-coupon', auth.optional, async (req, res) => {
  try {
    const { couponCode, guestCartItems } = req.body;

    let cartItems = [];
    if (req.user) {
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      if (cart) cartItems = cart.items;
    } else {
      if (guestCartItems && guestCartItems.length > 0) {
        const productIds = guestCartItems.map(i => i.product._id || i.product);
        const products = await Product.find({ _id: { $in: productIds } });
        cartItems = guestCartItems.map(item => {
          const dbProduct = products.find(p => p._id.toString() === (item.product._id || item.product).toString());
          return { product: dbProduct, variant: item.variant || null, quantity: item.quantity };
        });
      }
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    let itemsPrice = cartItems.reduce(
      (total, item) => {
        if (!item.product) return total;
        const { price } = getProductItemPriceAndStock(item.product, item.variant);
        return total + price * (item.quantity || 1);
      },
      0
    );

    // Fetch live settings
    const settings = await Settings.getGlobal();
    const gstRatePct = settings.gstEnabled ? settings.gstRate : 0;
    const gstMultiplier = gstRatePct / 100;
    const FREE_SHIPPING_THRESHOLD = settings.freeShippingThreshold;
    const SHIPPING_CHARGE = settings.shippingCharge;

    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    if (!coupon) {
      return res.status(400).json({ message: 'Invalid or expired coupon' });
    }

    if (itemsPrice < coupon.minOrderValue) {
      return res.status(400).json({
        message: `Minimum order value of ₹${coupon.minOrderValue} required`,
        minOrderValue: coupon.minOrderValue,
        currentValue: itemsPrice
      });
    }

    // Check usage limits
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ message: 'Coupon usage limit exceeded' });
    }

    if (coupon.usagePerUser && req.user) {
      const userUsage = await Order.countDocuments({
        user: req.user._id,
        'coupon.code': couponCode.toUpperCase(),
        paymentStatus: { $nin: ['FAILED', 'CANCELLED', 'EXPIRED'] }
      });
      if (userUsage >= coupon.usagePerUser) {
        return res.status(400).json({ message: 'You have already used this coupon' });
      }
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (itemsPrice * coupon.discountValue) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = coupon.discountValue;
    }

    const afterDiscount = Math.max(0, itemsPrice - discount);
    // Tax is inclusive
    const taxPrice = afterDiscount - (afterDiscount / (1 + gstMultiplier));
    const shippingPrice = afterDiscount > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CHARGE;
    const totalPrice = afterDiscount + shippingPrice;

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount
      },
      // Full breakdown — frontend just DISPLAYS these, no math needed
      breakdown: {
        itemsPrice,
        discount,
        gstRate: gstRatePct,
        taxPrice,
        shippingPrice,
        totalPrice,
      }
    });

  } catch (error) {
    console.error('COUPON VERIFY ERROR:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ========================================================================
// GUEST TRACK ORDER
// ========================================================================
router.get('/track', async (req, res) => {
  try {
    const { orderId, phone } = req.query;

    if (!orderId || !phone) {
      return res.status(400).json({ message: 'Order ID and Phone number are required' });
    }

    const query = { 'shippingAddress.phone': phone };

    const mongoose = require('mongoose');
    let orderIdClean = orderId.trim();
    if (orderIdClean.startsWith('#')) {
      orderIdClean = orderIdClean.substring(1);
    }

    query.$or = [];
    
    // Exact ObjectId match
    if (mongoose.Types.ObjectId.isValid(orderIdClean)) {
      query.$or.push({ _id: orderIdClean });
    }

    // Invoice number regex match
    query.$or.push({ invoiceNumber: { $regex: new RegExp(orderIdClean, 'i') } });

    // Match _id suffix (since frontend displays last 8 chars like #4E83768D)
    query.$or.push({
      $expr: {
        $regexMatch: {
          input: { $toString: '$_id' },
          regex: orderIdClean + '$',
          options: 'i'
        }
      }
    });

    const order = await Order.findOne(query).select(
      'invoiceNumber paymentStatus isDelivered trackingNumber shippingProvider cancelReason returnRequest statusHistory createdAt orderItems'
    ).populate('orderItems.product', 'name image');

    if (!order) {
      return res.status(404).json({ message: 'Order not found with provided details' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// GET USER ORDERS
// ========================================================================
router.get('/myorders', auth, async (req, res) => {
  try {
    let query = Order.find({ user: req.user._id })
      .populate('orderItems.product')
      .sort({ createdAt: -1 });

    if (req.query.limit) {
      const limit = parseInt(req.query.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        query = query.limit(limit);
      }
    }

    const orders = await query;
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: GET RETURNS
// ========================================================================
router.get('/admin/returns', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const orders = await Order.find({ 'returnRequest.status': { $exists: true } })
      .populate('user', 'name email')
      .populate('orderItems.product')
      .sort({ 'returnRequest.requestedAt': -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// GET SINGLE ORDER
// ========================================================================
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isAdmin = req.user.role === 'superadmin' || req.user.role === 'admin';
    if (order.user.toString() !== req.user._id.toString() && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: EXPORT ORDERS CSV
// ========================================================================
router.get('/export/csv', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    if (!orders.length) {
      return res.status(404).json({ message: 'No orders found to export' });
    }

    // Prepare CSV header
    const headers = [
      'Order ID', 'Date', 'Customer Name', 'Customer Email', 'Customer Phone',
      'Address', 'City', 'State', 'Zip Code',
      'Items Count', 'Items Price', 'Tax Price', 'Shipping Price', 'Discount', 'Total Price',
      'Payment Method', 'Payment Status', 'Delivery Status', 'Tracking Number'
    ];

    // Escape CSV fields helper
    const escapeCsv = (str) => {
      if (str == null) return '';
      const stringified = String(str);
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    // Prepare CSV rows
    const rows = orders.map(order => {
      return [
        order.invoiceNumber || order._id.toString(),
        new Date(order.createdAt).toISOString(),
        order.shippingAddress?.name || order.user?.name || '',
        order.user?.email || '',
        order.shippingAddress?.phone || '',
        order.shippingAddress?.street || '',
        order.shippingAddress?.city || '',
        order.shippingAddress?.state || '',
        order.shippingAddress?.zipCode || '',
        order.orderItems?.length || 0,
        order.itemsPrice || 0,
        order.taxPrice || 0,
        order.shippingPrice || 0,
        order.discount || 0,
        order.totalPrice || 0,
        order.paymentMethod,
        order.paymentStatus,
        order.isDelivered ? 'Delivered' : 'Pending',
        order.trackingNumber || ''
      ].map(escapeCsv).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders_export.csv');
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('CSV Export Error:', error);
    res.status(500).json({ message: 'Failed to export orders' });
  }
});

// ========================================================================
// ADMIN: GET ALL ORDERS
// ========================================================================
router.get('/', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000; // High limit default for backward compatibility
    const skip = (page - 1) * limit;

    const filter = req.query.filter || 'all';
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    
    const query = {};

    if (startDate && endDate) {
      // Validate date range max 365 days just to be safe on backend too
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999); // Include end of day
      const diffDays = Math.ceil(Math.abs(eDate - sDate) / (1000 * 60 * 60 * 24));
      if (diffDays <= 366) { // 365 full days + end of day
        query.createdAt = { $gte: sDate, $lte: eDate };
      }
    }
    
    if (filter === 'pending') {
      query.isDelivered = false;
      query.paymentStatus = { $nin: ['CANCELLED', 'FAILED'] };
      query.orderStatus = { $in: ['PENDING_ACCEPTANCE', 'PENDING'] };
    } else if (filter === 'accepted') {
      query.orderStatus = 'ACCEPTED';
      query.isDelivered = false;
    } else if (filter === 'cod') {
      query.paymentMethod = 'COD';
      query.isDelivered = false;
    } else if (filter === 'paid') {
      query.isPaid = true;
      query.isDelivered = false;
    } else if (filter === 'delivered') {
      query.isDelivered = true;
    } else if (filter === 'cancelled') {
      query.paymentStatus = { $in: ['CANCELLED', 'FAILED'] };
    }

    if (search) {
      const User = require('../models/User');
const { getNextInvoiceNumber } = require('../utils/helpers');
      const users = await User.find({ name: { $regex: search, $options: 'i' } }).select('_id');
      const userIds = users.map(u => u._id);
      
      query.$or = [
        { user: { $in: userIds } },
        { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: search, options: 'i' } } },
        { orderIdString: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'paymentInfo.razorpay_payment_id': { $regex: search, $options: 'i' } },
        { 'paymentInfo.razorpay_order_id': { $regex: search, $options: 'i' } }
      ];
    }

    const totalCount = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const validPage = Math.max(1, Math.min(page, totalPages));
    const validSkip = (validPage - 1) * limit;

    const orders = await Order.find(query)
      .populate('user', 'name email')
      .populate('orderItems.product')
      .sort({ createdAt: -1 })
      .skip(validSkip)
      .limit(limit);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const newOrdersCount = await Order.countDocuments({
      createdAt: { $gt: fiveMinutesAgo },
      isPaid: false
    });

    if (req.query.page) {
      return res.json({ 
        orders, 
        newOrdersCount, 
        total: totalCount, 
        page: validPage, 
        pages: totalPages 
      });
    }

    res.json({ orders, newOrdersCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: UPDATE ORDER STATUS
// ========================================================================
router.put('/:id/status', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {

    const { isPaid, isDelivered } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (isPaid !== undefined) {
      order.isPaid = isPaid;
      if (isPaid) {
        order.paidAt = new Date();
        order.paymentStatus = 'PAID';
        await pushStatusAndNotify(order, 'PAID', 'Marked as paid by admin', req.user._id, {
          type: 'ORDER_CONFIRMED',
          title: 'Payment Confirmed',
          message: `Payment for order ${order.invoiceNumber || 'verified'} has been confirmed.`,
          link: `/orders/${order._id}`
        });
      }
    }

    if (isDelivered !== undefined) {
      order.isDelivered = isDelivered;
      if (isDelivered) {
        order.deliveredAt = new Date();
        await pushStatusAndNotify(order, 'DELIVERED', 'Marked as delivered by admin', req.user._id, {
          type: 'ORDER_DELIVERED',
          title: 'Order Delivered',
          message: `Your order has been delivered successfully.`,
          link: `/orders/${order._id}`
        });
      }
    }

    await order.save();

    await logAction(req, 'UPDATE_ORDER_STATUS', 'ORDER', order._id, {
      isPaid, isDelivered,
      paymentStatus: order.paymentStatus
    });

    await order.populate('user', 'name email');
    await order.populate('orderItems.product');

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: MARK AS PAID
// ========================================================================
router.put('/:id/pay', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.isPaid = true;
    order.paidAt = new Date();
    order.paymentStatus = 'PAID';
    await pushStatusAndNotify(order, 'PAID', 'Marked as paid by admin', req.user._id, {
      type: 'ORDER_CONFIRMED',
      title: 'Payment Confirmed',
      message: `Payment for order ${order.invoiceNumber || 'verified'} has been confirmed.`,
      link: `/orders/${order._id}`
    });
    await order.save();

    await logAction(req, 'MARK_ORDER_PAID', 'ORDER', order._id);

    await order.populate('user', 'name email');
    await order.populate('orderItems.product');
    invalidateAnalytics().catch(() => {});
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: MARK AS DELIVERED
// ========================================================================
router.put('/:id/deliver', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.invoiceNumber) {
      order.invoiceNumber = await getNextInvoiceNumber();
    }
    
    order.orderStatus = 'DELIVERED';
    order.isPaid = true;
    order.paymentStatus = 'PAID';
    order.isDelivered = true;
    order.deliveredAt = new Date();
    await pushStatusAndNotify(order, 'DELIVERED', 'Marked as delivered by admin', req.user._id, {
      type: 'ORDER_DELIVERED',
      title: 'Order Delivered',
      message: `Your order has been delivered successfully.`,
      link: `/orders/${order._id}`
    });
    await order.save();

    const { sendInvoiceEmail } = require('../services/emailService');
    const userEmail = order.user ? order.user.email : order.guestEmail;
    if (userEmail) {
      await sendInvoiceEmail(order, userEmail)
        .catch(err => console.error('Error sending invoice email:', err));
    }

    await logAction(req, 'MARK_ORDER_DELIVERED', 'ORDER', order._id);

    await order.populate('user', 'name email');
    await order.populate('orderItems.product');
    invalidateAnalytics().catch(() => {});
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: SHIP ORDER (ADD TRACKING AND DISPATCH EMAIL)
// ========================================================================
router.put('/:id/ship', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const { trackingNumber, shippingProvider } = req.body;
    if (!trackingNumber || !shippingProvider) {
      return res.status(400).json({ message: 'Tracking number and shipping provider are required' });
    }



    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.orderStatus = 'SHIPPED';
    order.trackingNumber = trackingNumber;
    order.shippingProvider = shippingProvider;
    await pushStatusAndNotify(order, 'SHIPPED', `Shipped via ${shippingProvider} (Tracking: ${trackingNumber})`, req.user._id, {
      type: 'ORDER_SHIPPED',
      title: 'Order Shipped',
      message: `Your order has been shipped via ${shippingProvider}. Tracking No: ${trackingNumber}`,
      link: `/orders/${order._id}`
    });
    await order.save();

    await logAction(req, 'SHIP_ORDER', 'ORDER', order._id, { trackingNumber, shippingProvider });

    // Send shipping update email & WhatsApp in background
    sendShippingUpdateEmail({
      to: order.user.email,
      userName: order.user.name,
      orderId: order._id.toString(),
      trackingNumber,
      shippingProvider
    }).catch(err => {
      console.error('Shipping update email error (non-fatal):', err.message);
    });

    try {
      const { sendShippingUpdateWhatsApp } = require('../services/whatsappService');
      sendShippingUpdateWhatsApp(order);
    } catch (err) {
      console.error('Shipping update WhatsApp error:', err.message);
    }

    res.json({
      message: 'Order shipped successfully and tracking info updated',
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: BULK UPDATE
// ========================================================================
router.put('/bulk/update', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {

    const { orderIds, action } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'Invalid order IDs' });
    }

    const updatePromises = orderIds.map(async (orderId) => {
      const order = await Order.findById(orderId);
      if (order) {
        if (action === 'pay') {
          order.isPaid = true;
          order.paidAt = new Date();
          order.paymentStatus = 'PAID';
          await pushStatusAndNotify(order, 'PAID', 'Marked as paid by admin (Bulk)', req.user._id, {
            type: 'ORDER_CONFIRMED',
            title: 'Payment Confirmed',
            message: `Payment for order ${order.invoiceNumber || 'verified'} has been confirmed.`,
            link: `/orders/${order._id}`
          });
        } else if (action === 'deliver') {
          order.isDelivered = true;
          order.deliveredAt = new Date();
          await pushStatusAndNotify(order, 'DELIVERED', 'Marked as delivered by admin (Bulk)', req.user._id, {
            type: 'ORDER_DELIVERED',
            title: 'Order Delivered',
            message: `Your order has been delivered successfully.`,
            link: `/orders/${order._id}`
          });
        } else if (action === 'accept') {
          order.orderStatus = 'ACCEPTED';
          order.acceptedBy = req.user._id;
          order.acceptedAt = new Date();
          await pushStatusAndNotify(order, 'ACCEPTED', 'Order accepted by admin (Bulk)', req.user._id, {
            type: 'ORDER_CONFIRMED',
            title: 'Order Accepted',
            message: `Your order has been accepted by the seller.`,
            link: `/orders/${order._id}`
          });
        }
        return order.save();
      }
    });

    await Promise.all(updatePromises);

    await logAction(req, 'BULK_ORDER_UPDATE', 'ORDER', null, {
      orderIds, action
    });

    const updatedOrders = await Order.find({ _id: { $in: orderIds } })
      .populate('user', 'name email')
      .populate('orderItems.product');

    res.json({
      message: `${orderIds.length} orders updated successfully`,
      orders: updatedOrders
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ========================================================================
// CANCEL ORDER — user cancels own order, admin cancels any order
// ========================================================================
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    // ✅ FIX S9/B7: Permission check BEFORE DB query (not after)
    if (isAdmin && !req.user.permissions?.includes('orders') && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. You need order permissions.' });
    }

    const query = isAdmin
      ? { _id: req.params.id }
      : { _id: req.params.id, user: req.user._id };

    const order = await Order.findOne(query).populate('user', 'name email');

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.isDelivered) return res.status(400).json({ message: 'Cannot cancel a delivered order' });
    if (['CANCELLED', 'FAILED'].includes(order.paymentStatus)) {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    // ── 1. Restore all order resources (variant stock, wallet balance, gift card, coupon count, Razorpay refund) ──
    const { restoreOrderResources } = require('../utils/orderResourceHelper');
    const restoreResult = await restoreOrderResources(order, reason || 'Order cancelled');

    const refundInfo = restoreResult.razorpayRefund || (restoreResult.walletRefunded > 0 ? {
      status: 'PROCESSED',
      amount: restoreResult.walletRefunded,
      initiatedAt: new Date(),
      note: 'Refunded to Daatasa Wallet'
    } : null);

    // ── 2. Update order ───────────────────────────────────────────────────
    order.paymentStatus = 'CANCELLED';
    order.orderStatus = 'CANCELLED';
    order.cancelReason = reason || '';
    order.cancelledAt = new Date();
    order.cancelledBy = (req.user.role === 'admin' || req.user.role === 'superadmin') ? 'admin' : 'user';
    if (refundInfo) order.refundInfo = refundInfo;

    await pushStatusAndNotify(order, 'CANCELLED', `Cancelled. Reason: ${reason || 'None'}`, req.user._id, {
      type: 'ORDER_CANCELLED',
      title: 'Order Cancelled',
      message: `Your order has been cancelled. Reason: ${reason || 'Not specified'}`,
      link: `/orders/${order._id}`
    });
    await order.save();

    if (isAdmin) {
      await logAction(req, 'CANCEL_ORDER', 'ORDER', order._id, { reason });
    }

    // ── 3. Emails (non-fatal) ─────────────────────────────────────────────
    try {
      const { sendCancelEmail } = require('../services/emailService');
      await sendCancelEmail({
        to: order.user?.email || order.guestEmail,
        userName: order.user?.name || order.shippingAddress?.name || 'Customer',
        orderId: order._id.toString(),
        totalPrice: order.totalPrice,
        reason,
        isRefund: Boolean(restoreResult.razorpayRefund || restoreResult.walletRefunded > 0),
        refundId: refundInfo?.refund_id || (restoreResult.walletRefunded > 0 ? 'WALLET_REFUND' : null),
      });
    } catch (emailErr) {
      console.error('EMAIL ERROR (non-fatal):', emailErr);
    }

    res.json({
      success: true,
      message: (restoreResult.razorpayRefund || restoreResult.walletRefunded > 0)
        ? `Order cancelled. Refund processed (Wallet: ₹${restoreResult.walletRefunded}, Online: ₹${restoreResult.razorpayRefund?.amount || 0}).`
        : 'Order cancelled successfully.',
      refund: refundInfo,
      walletRefunded: restoreResult.walletRefunded,
      onlineRefunded: restoreResult.razorpayRefund?.amount || 0
    });

  } catch (error) {
    console.error('CANCEL ORDER ERROR:', error);
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// RETURN REQUEST
// ========================================================================
router.post('/:id/return-request', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    if (!order.isDelivered) {
      return res.status(400).json({ message: 'Can only request return for delivered orders' });
    }
    
    const daysSinceDelivery = (Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 7) {
      return res.status(400).json({ message: 'Return window (7 days) has expired' });
    }

    order.returnRequest = {
      reason,
      requestedAt: new Date(),
      status: 'PENDING'
    };
    await pushStatusAndNotify(order, 'RETURN_REQUESTED', `Return requested. Reason: ${reason || 'None'}`, req.user._id, {
      type: 'SYSTEM',
      title: 'Return Requested',
      message: `Your return request has been submitted and is pending approval.`,
      link: `/orders/${order._id}`
    });
    await order.save();
    res.json({ message: 'Return request submitted successfully', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: UPDATE RETURN STATUS
// ========================================================================
router.put('/:id/return-status', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid return status' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.returnRequest || !order.returnRequest.status) {
      return res.status(400).json({ message: 'No return request found for this order' });
    }
    
    if (order.returnRequest.status !== 'PENDING') {
      return res.status(400).json({ message: `Return request is already ${order.returnRequest.status}` });
    }

    order.returnRequest.status = status;
    order.returnRequest.adminNote = adminNote || '';
    order.returnRequest.resolvedAt = new Date();
    
    if (status === 'APPROVED') {
      order.paymentStatus = 'REFUNDED';
      
      // Restore all order resources (variant stock, wallet refund, gift card, coupon count, Razorpay refund)
      const { restoreOrderResources } = require('../utils/orderResourceHelper');
      await restoreOrderResources(order, adminNote || 'Return approved by admin');

      await pushStatusAndNotify(order, 'RETURN_APPROVED', `Return Approved. Note: ${adminNote || 'None'}`, req.user._id, {
        type: 'SYSTEM',
        title: 'Return Approved',
        message: `Your return request has been approved and refund processed.`,
        link: `/orders/${order._id}`
      });
    } else {
      await pushStatusAndNotify(order, 'RETURN_REJECTED', `Return Rejected. Note: ${adminNote || 'None'}`, req.user._id, {
        type: 'SYSTEM',
        title: 'Return Rejected',
        message: `Your return request was rejected.`,
        link: `/orders/${order._id}`
      });
    }

    await order.save();
    await logAction(req, 'UPDATE_RETURN_STATUS', 'ORDER', order._id, { status, adminNote });

    await order.populate('user', 'name email');
    await order.populate('orderItems.product');
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: ACCEPT ORDER
// ========================================================================
router.put('/:id/accept', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.orderStatus = 'ACCEPTED';
    order.acceptedBy = req.user._id;
    order.acceptedAt = new Date();
    if (order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING') {
      order.paymentStatus = 'COD_CONFIRMED';
    }

    await pushStatusAndNotify(order, 'ACCEPTED', 'Order accepted by admin', req.user._id, {
      type: 'ORDER_CONFIRMED',
      title: 'Order Accepted',
      message: `Your order has been accepted by the seller.`,
      link: `/orders/${order._id}`
    });

    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

