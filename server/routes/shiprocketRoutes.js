const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const shiprocketService = require('../services/shiprocketService');
const { getIO } = require('../socket');
const { logAction } = require('../utils/logger');
const { sendShippingUpdateEmail } = require('../services/emailService');
const { sendShippingUpdateWhatsApp } = require('../services/whatsappService');

/**
 * Helper to build Shiprocket order payload
 */
function buildShiprocketPayload(order) {
  const addr = order.shippingAddress || {};
  return {
    order_id: order.orderIdString || order._id.toString(),
    order_date: new Date(order.createdAt).toISOString().split('T')[0],
    pickup_location: "Primary", // Must match pickup location name in Shiprocket dashboard
    billing_customer_name: addr.name || (order.user?.name) || "Customer",
    billing_last_name: "",
    billing_address: addr.street || "Main Street",
    billing_address_2: addr.district || "",
    billing_city: addr.city || "City",
    billing_pincode: addr.zipCode || "110001",
    billing_state: addr.state || "Delhi",
    billing_country: addr.country || "India",
    billing_email: order.guestEmail || (order.user?.email) || "customer@daatasa.com",
    billing_phone: addr.phone || "9999999999",
    shipping_is_billing: true,
    order_items: (order.orderItems || []).map(item => ({
      name: item.name,
      sku: (item.product?._id || item.product || 'PROD').toString().slice(-8),
      units: item.quantity || 1,
      selling_price: item.price || 0,
      discount: 0,
      tax: 0,
      hsn: 441122
    })),
    payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
    shipping_charges: order.shippingPrice || 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: Math.round(((order.discount || 0) + (order.walletUsed || 0) + (order.giftCard?.amountUsed || 0)) * 100) / 100,
    sub_total: order.itemsPrice || 0,
    length: 12,
    breadth: 12,
    height: 15,
    weight: 0.9 // Default 0.9kg for pure ghee bottle
  };
}

/**
 * POST /api/shiprocket/ship/:orderId
 * 🚀 1-CLICK ALL-IN-ONE DISPATCH WITH SHIPROCKET
 * Creates Order in Shiprocket + Generates AWB (Delhivery/BlueDart/etc) + Marks Shipped
 */
router.post('/ship/:orderId', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.isDelivered) return res.status(400).json({ message: 'Cannot ship a delivered order' });
    if (['CANCELLED', 'FAILED'].includes(order.paymentStatus)) {
      return res.status(400).json({ message: 'Cannot ship a cancelled order' });
    }

    // 1️⃣ Push to Shiprocket if not already pushed
    if (!order.shiprocketOrderId || !order.shiprocketShipmentId) {
      const orderPayload = buildShiprocketPayload(order);
      const pushRes = await shiprocketService.createOrder(orderPayload);
      order.shiprocketOrderId = pushRes.order_id;
      order.shiprocketShipmentId = pushRes.shipment_id;
    }

    // 2️⃣ Generate AWB / Assign Courier (e.g. Delhivery, BlueDart)
    if (!order.awbCode) {
      const awbRes = await shiprocketService.generateAWB(order.shiprocketShipmentId);
      const awbData = awbRes.response?.data || awbRes;
      order.awbCode = awbData.awb_code || `SR${Date.now()}`;
      order.shippingProvider = awbData.courier_name || 'Shiprocket Express';
      order.trackingNumber = order.awbCode;
    }

    // 3️⃣ Update Order status to SHIPPED
    order.orderStatus = 'SHIPPED';
    order.statusHistory.push({
      status: 'SHIPPED',
      note: `Shipped via ${order.shippingProvider} (AWB: ${order.awbCode})`,
      updatedBy: req.user._id,
      updatedAt: new Date()
    });

    await order.save();

    // 4️⃣ Log Action
    await logAction(req, 'SHIPROCKET_SHIP', 'ORDER', order._id, {
      awbCode: order.awbCode,
      courier: order.shippingProvider,
      shiprocketOrderId: order.shiprocketOrderId
    });

    // 5️⃣ Real-time socket notification & Customer alerts
    try {
      const io = getIO();
      io.to(`order:${order._id}`).emit('orderStatusUpdated', order);

      if (order.user) {
        const Notification = require('../models/Notification');
        const notif = new Notification({
          user: order.user._id || order.user,
          type: 'ORDER_SHIPPED',
          title: 'Order Dispatched 🚚',
          message: `Your order has been shipped via ${order.shippingProvider}. Tracking AWB: ${order.awbCode}`,
          link: `/orders/${order._id}`
        });
        await notif.save();
        io.to(`user:${notif.user}`).emit('notification', notif);
      }
    } catch (err) {}

    // Send WhatsApp & Email
    try {
      if (order.user?.email || order.guestEmail) {
        sendShippingUpdateEmail({
          to: order.user?.email || order.guestEmail,
          userName: order.user?.name || order.shippingAddress?.name || 'Customer',
          orderId: order._id.toString(),
          trackingNumber: order.awbCode,
          shippingProvider: order.shippingProvider
        }).catch(() => {});
      }
      sendShippingUpdateWhatsApp(order).catch(() => {});
    } catch (notifyErr) {}

    res.json({
      success: true,
      message: `Order successfully shipped via ${order.shippingProvider}!`,
      awbCode: order.awbCode,
      courier: order.shippingProvider,
      order
    });

  } catch (error) {
    console.error('Shiprocket 1-Click Ship Error:', error);
    res.status(500).json({ message: error.message || 'Failed to dispatch via Shiprocket' });
  }
});

/**
 * GET /api/shiprocket/label/:orderId
 * Fetch Shiprocket Label PDF URL
 */
router.get('/label/:orderId', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.shiprocketShipmentId) {
      return res.status(400).json({ message: 'Shipment has not been generated for this order yet' });
    }

    const labelRes = await shiprocketService.generateLabel(order.shiprocketShipmentId);
    res.json(labelRes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/shiprocket/track/:orderId
 * Real-time Shiprocket Tracking data
 */
router.get('/track/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.awbCode) {
      return res.status(400).json({ message: 'No AWB assigned to this order yet' });
    }

    const trackRes = await shiprocketService.trackShipment(order.awbCode);
    res.json(trackRes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/shiprocket/webhook
 * Receive live automated tracking events from Shiprocket
 */
router.post('/webhook', async (req, res) => {
  try {
    const { awb, current_status } = req.body;
    
    if (!awb || !current_status) {
      return res.status(400).send('Invalid payload');
    }

    const order = await Order.findOne({ $or: [{ awbCode: awb }, { trackingNumber: awb }] });
    if (!order) return res.status(404).send('Order not found');

    const statusUpper = (current_status || '').toUpperCase();
    let newStatus = null;

    if (statusUpper.includes('PICKED UP') || statusUpper.includes('IN TRANSIT') || statusUpper.includes('SHIPPED')) {
      newStatus = 'SHIPPED';
    } else if (statusUpper.includes('OUT FOR DELIVERY')) {
      newStatus = 'OUT_FOR_DELIVERY';
    } else if (statusUpper.includes('DELIVERED')) {
      newStatus = 'DELIVERED';
    } else if (statusUpper.includes('RTO') || statusUpper.includes('RETURN')) {
      newStatus = 'RETURNED';
    } else if (statusUpper.includes('CANCEL')) {
      newStatus = 'CANCELLED';
    }

    if (newStatus && order.orderStatus !== newStatus) {
      order.orderStatus = newStatus;
      order.statusHistory.push({
        status: newStatus,
        note: `Shiprocket Tracking Update: ${current_status}`,
        updatedAt: new Date()
      });

      if (newStatus === 'DELIVERED') {
        order.isDelivered = true;
        order.deliveredAt = new Date();
        order.isPaid = true;
        order.paymentStatus = 'PAID';

        // Award Reward Points upon successful delivery
        if (order.user && !order.rewardPointsAwarded) {
          try {
            const User = require('../models/User');
            const WalletTransaction = require('../models/WalletTransaction');
            const Notification = require('../models/Notification');
            const user = await User.findById(order.user._id || order.user);
            if (user) {
              const points = Math.floor((order.totalPrice || 0) / 10);
              user.rewardPoints = (user.rewardPoints || 0) + points;

              // Referral Bonus check
              if (user.referredBy && !user.referralRewardClaimed) {
                const referrer = await User.findById(user.referredBy);
                if (referrer) {
                  user.walletBalance = (user.walletBalance || 0) + 50;
                  referrer.walletBalance = (referrer.walletBalance || 0) + 50;
                  user.referralRewardClaimed = true;
                  await referrer.save();

                  await WalletTransaction.create([
                    {
                      user: user._id,
                      type: 'CREDIT',
                      amount: 50,
                      balanceAfter: user.walletBalance,
                      description: 'Referral bonus (first order delivered)',
                      transactionType: 'REWARD_CONVERSION'
                    },
                    {
                      user: referrer._id,
                      type: 'CREDIT',
                      amount: 50,
                      balanceAfter: referrer.walletBalance,
                      description: `Referral bonus for inviting ${user.name} (first order delivered)`,
                      transactionType: 'REWARD_CONVERSION'
                    }
                  ]);

                  try {
                    const notifReferrer = new Notification({
                      user: referrer._id,
                      type: 'SYSTEM',
                      title: 'Referral Bonus Earned! 🎉',
                      message: `You earned ₹50 in your wallet because ${user.name} completed their first order!`,
                      link: '/profile'
                    });
                    await notifReferrer.save();
                  } catch (e) {}
                }
              }

              await user.save();
              order.rewardPointsAwarded = true;

              if (points > 0) {
                const notif = new Notification({
                  user: user._id,
                  type: 'SYSTEM',
                  title: 'Reward Points Earned! 🎁',
                  message: `You earned ${points} reward points for your delivered order #${order.orderIdString || order._id.toString().slice(-8)}. Convert them into wallet cash anytime!`,
                  link: '/profile'
                });
                await notif.save();
              }
            }
          } catch (rewardErr) {
            console.error('Shiprocket reward points error:', rewardErr);
          }
        }

        // Auto send invoice email
        try {
          const { sendInvoiceEmail } = require('../services/emailService');
          const populated = await order.populate('user', 'name email');
          const userEmail = populated.user ? populated.user.email : populated.guestEmail;
          if (userEmail) {
            await sendInvoiceEmail(populated, userEmail);
          }
        } catch (mailErr) {}
      }

      await order.save();

      // Real-time socket & notifications
      try {
        const io = getIO();
        io.to(`order:${order._id}`).emit('orderStatusUpdated', order);

        if (order.user) {
          const Notification = require('../models/Notification');
          const notifTitle = newStatus === 'OUT_FOR_DELIVERY'
            ? 'Out for Delivery 🛵'
            : newStatus === 'DELIVERED'
              ? 'Order Delivered 🎉'
              : 'Shipment Update 📦';
          const notifMsg = newStatus === 'OUT_FOR_DELIVERY'
            ? `Your package is out for delivery with ${order.shippingProvider || 'courier'}.`
            : newStatus === 'DELIVERED'
              ? 'Your order has been delivered successfully. Thank you for shopping with Daatasa!'
              : `Your shipment status is now: ${current_status}`;

          const notif = new Notification({
            user: order.user._id || order.user,
            type: newStatus === 'DELIVERED' ? 'ORDER_DELIVERED' : 'ORDER_SHIPPED',
            title: notifTitle,
            message: notifMsg,
            link: `/orders/${order._id}`
          });
          await notif.save();
          io.to(`user:${notif.user}`).emit('notification', notif);
        }
      } catch (sockErr) {}

      // Send WhatsApp alert
      try {
        if (newStatus === 'SHIPPED' || newStatus === 'OUT_FOR_DELIVERY') {
          await order.populate('user', 'name email');
          sendShippingUpdateWhatsApp(order).catch(() => {});
        }
      } catch (waErr) {}
    }

    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Shiprocket Webhook Error:', error);
    res.status(500).send('Internal Error');
  }
});

module.exports = router;
