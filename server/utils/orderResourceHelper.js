const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const GiftCard = require('../models/GiftCard');
const Coupon = require('../models/Coupon');

/**
 * Calculates the net amount that must be paid via Razorpay or collected at COD
 * (Total order price minus wallet balance used and gift card amount used).
 *
 * @param {Object} order - The order document or order data
 * @returns {Number} Net payable amount in rupees
 */
function getNetPayableAmount(order) {
  if (!order) return 0;
  const totalPrice = Number(order.totalPrice || 0);
  const walletUsed = Number(order.walletUsed || 0);
  const giftCardUsed = Number(order.giftCard?.amountUsed || 0);
  const net = totalPrice - walletUsed - giftCardUsed;
  return Math.max(0, Math.round(net * 100) / 100);
}

/**
 * Atomically restores all resources locked by an order:
 * 1. Product Stock (Variant-aware: increments variants.$.stock if item.variant exists, else base stock)
 * 2. User Wallet Balance (Credits walletBalance + creates a CREDIT WalletTransaction with type REFUND)
 * 3. Gift Card Balance (Credits giftCard.balance)
 * 4. Coupon Usage Count (Decrements Coupon.usedCount with a lower bound of 0)
 * 5. Razorpay Online Refund (If order was paid online, initiates Razorpay refund for the net online portion)
 *
 * Safe for repeated calls (idempotent guards prevent double-crediting).
 *
 * @param {Object} order - Order mongoose document
 * @param {String} reason - Reason for restoration/cancellation
 * @param {Object} options - { skipStock, skipWallet, skipGiftCard, skipRazorpay, session }
 * @returns {Object} { restoredStock, walletRefunded, giftCardRefunded, couponRestored, razorpayRefund }
 */
async function restoreOrderResources(order, reason = 'Order cancelled or payment failed', options = {}) {
  const result = {
    restoredStock: false,
    walletRefunded: 0,
    giftCardRefunded: 0,
    couponRestored: false,
    razorpayRefund: null
  };

  if (!order) return result;

  const session = options.session || null;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. RESTORE PRODUCT STOCK (VARIANT-AWARE)
  // ──────────────────────────────────────────────────────────────────────────
  if (!options.skipStock && !order.stockRestored && order.orderItems && order.orderItems.length > 0) {
    try {
      for (const item of order.orderItems) {
        const pId = item.product?._id || item.product;
        const vId = item.variant?._id || item.variant || item.variantId?._id || item.variantId;
        const qty = Number(item.quantity || 1);

        if (!pId || qty <= 0) continue;

        if (vId) {
          // Attempt to restore variant stock
          const varUpdate = await Product.findOneAndUpdate(
            { _id: pId, 'variants._id': vId },
            { $inc: { 'variants.$.stock': qty } },
            { new: true, ...(session && { session }) }
          );

          // If variant wasn't found (e.g. variant removed), fallback to base stock
          if (!varUpdate) {
            await Product.findByIdAndUpdate(
              pId,
              { $inc: { stock: qty } },
              { ...(session && { session }) }
            );
          }
        } else {
          // Base product stock restore
          await Product.findByIdAndUpdate(
            pId,
            { $inc: { stock: qty } },
            { ...(session && { session }) }
          );
        }
      }
      result.restoredStock = true;
      order.stockRestored = true;
    } catch (stockErr) {
      console.error('[restoreOrderResources] Error restoring stock:', stockErr.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. RESTORE USER WALLET BALANCE (SAFE & IDEMPOTENT)
  // ──────────────────────────────────────────────────────────────────────────
  if (!options.skipWallet && order.user) {
    try {
      const userId = order.user?._id || order.user;
      const walletUsed = Number(order.walletUsed || 0);

      // Determine amount to refund to wallet
      let amountToRefund = walletUsed;
      if (amountToRefund <= 0 && order.paymentMethod === 'Wallet' && order.isPaid) {
        amountToRefund = Number(order.totalPrice || 0);
      }

      if (amountToRefund > 0 && !order.walletRefunded) {
        // Idempotency check: Ensure no REFUND transaction already exists for this order
        const existingTx = await WalletTransaction.findOne({
          user: userId,
          relatedOrder: order._id,
          transactionType: 'REFUND'
        });

        if (!existingTx) {
          const userDoc = await User.findById(userId).session(session);
          if (userDoc) {
            userDoc.walletBalance = Math.max(0, (userDoc.walletBalance || 0) + amountToRefund);
            await userDoc.save({ ...(session && { session }) });

            await WalletTransaction.create([{
              user: userId,
              type: 'CREDIT',
              amount: amountToRefund,
              balanceAfter: userDoc.walletBalance,
              description: `Refund for order ${order.orderIdString || order._id} (${reason})`,
              relatedOrder: order._id,
              transactionType: 'REFUND'
            }], { ...(session && { session }) });

            result.walletRefunded = amountToRefund;
            order.walletRefunded = true;
          }
        }
      }
    } catch (walletErr) {
      console.error('[restoreOrderResources] Error refunding wallet balance:', walletErr.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. RESTORE GIFT CARD BALANCE
  // ──────────────────────────────────────────────────────────────────────────
  if (!options.skipGiftCard && order.giftCard && order.giftCard.code && !order.giftCardRefunded) {
    try {
      const gcAmount = Number(order.giftCard.amountUsed || 0);
      if (gcAmount > 0) {
        await GiftCard.findOneAndUpdate(
          { code: order.giftCard.code.toUpperCase() },
          { $inc: { balance: gcAmount } },
          { ...(session && { session }) }
        );
        result.giftCardRefunded = gcAmount;
        order.giftCardRefunded = true;
      }
    } catch (gcErr) {
      console.error('[restoreOrderResources] Error restoring gift card:', gcErr.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. RESTORE COUPON USAGE COUNT
  // ──────────────────────────────────────────────────────────────────────────
  if (order.coupon && order.coupon.code && !order.couponRestored) {
    try {
      // Only decrement if the order was previously marked PAID or COD_CONFIRMED (where count was incremented)
      const wasCounted = order.isPaid || order.paymentStatus === 'COD_CONFIRMED' || order.couponUsageIncremented;
      if (wasCounted) {
        await Coupon.findOneAndUpdate(
          { code: order.coupon.code.toUpperCase(), usedCount: { $gt: 0 } },
          { $inc: { usedCount: -1 } },
          { ...(session && { session }) }
        );
        result.couponRestored = true;
        order.couponRestored = true;
      }
    } catch (couponErr) {
      console.error('[restoreOrderResources] Error restoring coupon count:', couponErr.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. INITIATE RAZORPAY REFUND (FOR NET ONLINE PORTION)
  // ──────────────────────────────────────────────────────────────────────────
  if (!options.skipRazorpay) {
    const isOnlinePaid =
      order.isPaid &&
      order.paymentMethod === 'Online' &&
      order.paymentInfo?.razorpay_payment_id;

    if (isOnlinePaid && !order.refundInfo?.refund_id) {
      try {
        const netOnlinePaid = getNetPayableAmount(order);
        if (netOnlinePaid > 0) {
          const razorpay = require('../config/razorpay');
          const refund = await razorpay.payments.refund(
            order.paymentInfo.razorpay_payment_id,
            { amount: Math.round(netOnlinePaid * 100) }
          );

          result.razorpayRefund = {
            refund_id: refund.id,
            status: refund.status,
            amount: netOnlinePaid,
            initiatedAt: new Date()
          };
          order.refundInfo = result.razorpayRefund;
        }
      } catch (rzpErr) {
        console.error('[restoreOrderResources] Razorpay refund error:', rzpErr.message);
      }
    }
  }

  return result;
}

module.exports = {
  getNetPayableAmount,
  restoreOrderResources
};
