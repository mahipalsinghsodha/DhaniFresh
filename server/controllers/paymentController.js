const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Order = require('../models/Order');
const { getNextInvoiceNumber } = require('../utils/helpers');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');

/**
 * CREATE RAZORPAY ORDER
 * ✅ Amount calculated from backend order (secure)
 * ✅ Auth required
 */
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user) {
      if (order.user && order.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized access to this order' });
      }
    } else {
      if (order.user) {
        return res.status(403).json({ message: 'Unauthorized access to this order' });
      }
    }

    // Security: Only create Razorpay order for PENDING payments
    if (order.paymentStatus !== 'PENDING') {
      return res.status(400).json({ message: 'Order already processed' });
    }

    // Create Razorpay order with BACKEND-calculated amount (net of wallet/gift card)
    const { getNetPayableAmount } = require('../utils/orderResourceHelper');
    const netPayable = (order.payableAmount !== undefined && order.payableAmount !== null) ? order.payableAmount : getNetPayableAmount(order);
    const amountInPaise = Math.round(netPayable * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise, // Convert to paise
      currency: 'INR',
      receipt: `receipt_${order._id}`,
      notes: {
        orderId: order._id.toString(),
        ...(req.user && { userId: req.user._id.toString() })
      }
    });

    // Save Razorpay order ID to our order
    order.paymentInfo = {
      razorpay_order_id: razorpayOrder.id
    };
    await order.save();

    res.status(200).json(razorpayOrder);

  } catch (error) {
    console.error('RAZORPAY ORDER ERROR:', error);
    res.status(500).json({ message: 'Razorpay order creation failed' });
  }
};

/**
 * VERIFY PAYMENT
 * ✅ Signature verification
 * ✅ Amount verification (prevent frontend manipulation)
 * ✅ Clear cart only after successful payment
 * ✅ Increment coupon usage
 */
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const order = await Order.findOne({
      'paymentInfo.razorpay_order_id': razorpay_order_id,
      paymentStatus: 'PENDING'
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found or already processed' });
    }

    if (req.user) {
      if (order.user && order.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized access to this order' });
      }
    } else {
      if (order.user) {
        return res.status(403).json({ message: 'Unauthorized access to this order' });
      }
    }

    // 1️⃣ VERIFY SIGNATURE
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // 2️⃣ FETCH PAYMENT DETAILS FROM RAZORPAY (VERIFY AMOUNT)
    let payment;
    try {
      payment = await razorpay.payments.fetch(razorpay_payment_id);
      
      // Security: Verify amount matches net payable amount
      const { getNetPayableAmount } = require('../utils/orderResourceHelper');
      const netPayable = (order.payableAmount !== undefined && order.payableAmount !== null) ? order.payableAmount : getNetPayableAmount(order);
      const expectedAmount = Math.round(netPayable * 100);
      if (payment.amount !== expectedAmount) {
        console.error('AMOUNT MISMATCH:', {
          expected: expectedAmount,
          received: payment.amount
        });
        return res.status(400).json({ message: 'Payment amount mismatch' });
      }

      // Verify payment is captured/successful
      if (payment.status !== 'captured' && payment.status !== 'authorized') {
        return res.status(400).json({ message: 'Payment not successful' });
      }

    } catch (fetchError) {
      console.error('PAYMENT FETCH ERROR:', fetchError);
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // 3️⃣ MARK ORDER AS PAID
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentStatus = 'PAID';
    order.statusHistory.push({ status: 'PAID', note: 'Payment verified successfully (Online)', updatedBy: req.user?._id || null, updatedAt: new Date() });
    try { if (order.user) { const notif = new Notification({ user: order.user._id || order.user, type: 'ORDER_CONFIRMED', title: 'Payment Confirmed', message: 'Your online payment has been confirmed.', link: `/orders/${order._id}` }); await notif.save(); getIO().to(`user:${notif.user}`).emit('notification', notif); } } catch(e) {}
    try { getIO().to(`order:${order._id}`).emit('orderStatusUpdated', order); } catch(e) {}
    
    // Generate invoice number
    if (!order.invoiceNumber) {
      order.invoiceNumber = await getNextInvoiceNumber();
    }

    let method = payment?.method;
    let vpa = payment?.vpa || (payment?.upi ? payment.upi.vpa : null);
    let cardNetwork = payment?.card ? payment.card.network : null;
    let bank = payment?.bank;

    order.paymentInfo = {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      method,
      vpa,
      cardNetwork,
      bank
    };

    await order.save();

    // 4️⃣ CLEAR USER'S CART (Only after successful payment)
    if (req.user) {
      await Cart.findOneAndUpdate(
        { user: req.user._id },
        { items: [] }
      );
    }

    // 5️⃣ INCREMENT COUPON USAGE (if coupon was used)
    if (order.coupon && order.coupon.code) {
      order.couponUsageIncremented = true;
      await order.save();
      await Coupon.findOneAndUpdate(
        { code: order.coupon.code },
        { $inc: { usedCount: 1 } }
      );
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      orderId: order._id
    });

    // ── 6️⃣ SEND SUCCESS EMAIL (Background) ───────────────────────────────
    try {
      const { sendOrderSuccessEmail } = require('../services/emailService');
      let toEmail, toName;
      if (order.user) {
        const populatedOrder = await order.populate('user', 'name email');
        toEmail = populatedOrder.user.email;
        toName = populatedOrder.user.name;
      } else {
        toEmail = order.guestEmail;
        toName = order.shippingAddress?.name || 'Valued Customer';
      }
      
      await sendOrderSuccessEmail(order, toEmail);
    } catch (emailErr) {
      console.error('ONLINE SUCCESS EMAIL ERROR:', emailErr);
    }

  } catch (error) {
    console.error('VERIFY PAYMENT ERROR:', error);
    res.status(500).json({ message: 'Payment verification failed' });
  }
};

/**
 * RAZORPAY WEBHOOK
 * ✅ Receives raw Buffer body (registered with express.raw() in server.js)
 * ✅ Validates HMAC-SHA256 signature using RAZORPAY_WEBHOOK_SECRET
 * ✅ Idempotent — skips orders already marked PAID
 * ✅ Clears cart + sends email after confirming payment
 */
exports.razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    // ✅ req.body is a raw Buffer from express.raw() — use it directly for HMAC
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const digest = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (digest !== req.headers['x-razorpay-signature']) {
      console.error('WEBHOOK: Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    // Parse body (Buffer -> JSON)
    const payload = JSON.parse(rawBody.toString());
    const event = payload.event;

    console.log(`WEBHOOK: received event '${event}'`);

    if (event === 'payment.captured' || event === 'payment.authorized') {
      const paymentInfo = payload.payload.payment.entity;
      const orderId     = paymentInfo.notes?.orderId;

      if (!orderId) {
        console.warn('WEBHOOK: No orderId in payment notes, might be a subscription payment');
        // Let it fall through, it might be handled by subscription.charged
      } else {
        const order = await Order.findById(orderId);

        if (!order) {
          console.warn(`WEBHOOK: Order ${orderId} not found`);
        } else {
          // ✅ Idempotent — if already paid (by frontend verify), skip cleanly
          if (order.paymentStatus !== 'PENDING') {
            console.log(`WEBHOOK: Order ${orderId} already processed (${order.paymentStatus}), skipping`);
          } else {
            // Mark as paid
            order.isPaid         = true;
            order.paidAt         = new Date();
            order.paymentStatus  = 'PAID';
            order.statusHistory.push({ status: 'PAID', note: 'Payment captured via Webhook', updatedBy: order.user, updatedAt: new Date() });
            try { const notif = new Notification({ user: order.user, type: 'ORDER_CONFIRMED', title: 'Payment Confirmed', message: 'Your online payment has been verified via webhook.', link: `/orders/${order._id}` }); await notif.save(); getIO().to(`user:${notif.user}`).emit('notification', notif); } catch(e) {}
            try { getIO().to(`order:${order._id}`).emit('orderStatusUpdated', order); } catch(e) {}

            if (!order.invoiceNumber) {
              order.invoiceNumber = await getNextInvoiceNumber();
            }

            order.paymentInfo = {
              razorpay_order_id:   paymentInfo.order_id,
              razorpay_payment_id: paymentInfo.id,
              razorpay_signature:  'WEBHOOK_VERIFIED',
            };

            await order.save();

            // Clear cart
            await Cart.findOneAndUpdate({ user: order.user }, { items: [] });

            // Increment coupon usage
            if (order.coupon?.code) {
              await Coupon.findOneAndUpdate({ code: order.coupon.code }, { $inc: { usedCount: 1 } });
            }

            console.log(`WEBHOOK: Order ${orderId} marked PAID via webhook`);

            // Send success email (non-fatal)
            try {
              const { sendOrderSuccessEmail } = require('../services/emailService');
              const populatedOrder = await order.populate('user', 'name email');
              await sendOrderSuccessEmail(populatedOrder, populatedOrder.user.email);
            } catch (emailErr) {
              console.error('WEBHOOK EMAIL ERROR (non-fatal):', emailErr);
            }
          }
        }
      }
    }
    
    // ── SUBSCRIPTION WEBHOOKS ─────────────────────────────────────────
    if (event === 'subscription.charged') {
      const subEntity = payload.payload.subscription.entity;
      const paymentEntity = payload.payload.payment.entity;
      
      const userId = subEntity.notes?.userId;
      const planDbId = subEntity.notes?.planDbId;
      
      if (userId && planDbId) {
        const UserSubscription = require('../models/UserSubscription');
        const SubscriptionPlan = require('../models/SubscriptionPlan');
        
        const userSub = await UserSubscription.findOne({ razorpaySubscriptionId: subEntity.id });
        const plan = await SubscriptionPlan.findById(planDbId).populate('product');
        
        if (userSub && plan && plan.product) {
          // Update subscription status
          userSub.paidCount = subEntity.paid_count;
          userSub.status = subEntity.status;
          // Calculate next billing date
          if (subEntity.charge_at) {
            userSub.nextBillingDate = new Date(subEntity.charge_at * 1000);
          }
          await userSub.save();
          
          // GENERATE A NEW ORDER!
          // We must check if an order for this payment already exists to be idempotent
          const existingOrder = await Order.findOne({ 'paymentInfo.razorpay_payment_id': paymentEntity.id });
          
          if (!existingOrder) {
            const newOrder = new Order({
              user: userId,
              orderItems: [{
                product: plan.product._id,
                name: plan.product.name + ' (Subscription)',
                image: plan.product.images?.[0] || plan.product.image,
                price: plan.price,
                quantity: 1
              }],
              shippingAddress: userSub.shippingAddress,
              paymentMethod: 'Online',
              paymentStatus: 'PAID',
              isPaid: true,
              paidAt: new Date(),
              itemsPrice: plan.price,
              taxPrice: 0, // Simplified
              shippingPrice: 0, // Assuming free shipping for subs
              totalPrice: plan.price,
              paymentInfo: {
                razorpay_order_id: subEntity.id, // we map sub_id to order_id for record
                razorpay_payment_id: paymentEntity.id,
                razorpay_signature: 'SUBSCRIPTION_AUTO_DEDUCT'
              }
            });
            
            newOrder.invoiceNumber = await getNextInvoiceNumber();
            await newOrder.save();
            console.log(`WEBHOOK: Auto-generated subscription order ${newOrder._id} for user ${userId}`);
          }
        }
      }
    }
    
    if (event === 'subscription.cancelled' || event === 'subscription.halted') {
      const subEntity = payload.payload.subscription.entity;
      const UserSubscription = require('../models/UserSubscription');
      
      const userSub = await UserSubscription.findOne({ razorpaySubscriptionId: subEntity.id });
      if (userSub) {
        userSub.status = subEntity.status;
        await userSub.save();
        console.log(`WEBHOOK: Subscription ${subEntity.id} status updated to ${subEntity.status}`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('WEBHOOK ERROR:', error);
    res.status(500).send('Server Error');
  }
};
