const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { getIO } = require('../socket');
const { getNextInvoiceNumber } = require('../utils/helpers');
const { sendInvoiceEmail } = require('../services/emailService');

// Middleware to ensure user is courier
const isCourier = (req, res, next) => {
  if (req.user && req.user.role === 'courier') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Courier only.' });
};

// ========================================================================
// COURIER: GET ASSIGNED ORDERS
// ========================================================================
router.get('/orders', auth, isCourier, async (req, res) => {
  try {
    const orders = await Order.find({ courierId: req.user._id })
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name image price')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ========================================================================
// COURIER: GET SINGLE ORDER (For Scanning)
// ========================================================================
router.get('/orders/:id', auth, isCourier, async (req, res) => {
  try {
    let order;
    if (req.params.id.length === 24) {
      order = await Order.findById(req.params.id)
        .populate('user', 'name email phone')
        .populate('orderItems.product', 'name image price');
    } else {
      const regex = new RegExp(`${req.params.id}$`, 'i');
      order = await Order.findOne({
        $expr: {
          $regexMatch: {
            input: { $toString: '$_id' },
            regex: regex
          }
        }
      })
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name image price');
    }
      
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    // A courier can view the order if it's assigned to them OR if it's ACCEPTED and unassigned
    if (order.courierId && order.courierId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Order is assigned to another courier' });
    }
    
    if (!order.courierId && order.orderStatus !== 'ACCEPTED') {
      return res.status(403).json({ message: `Order is ${order.orderStatus} and cannot be picked up yet` });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========================================================================
// COURIER: UPDATE ORDER STATUS
// ========================================================================
router.put('/orders/:id/status', auth, isCourier, async (req, res) => {
  try {
    const { status, note } = req.body;
    const allowedStatuses = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'ATTEMPTED_FAILED', 'RETURNED'];
    
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    let order;
    if (req.params.id.length === 24) {
      order = await Order.findById(req.params.id);
    } else {
      const regex = new RegExp(`${req.params.id}$`, 'i');
      order = await Order.findOne({
        $expr: {
          $regexMatch: {
            input: { $toString: '$_id' },
            regex: regex
          }
        }
      });
    }
    
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Allow courier to claim an unassigned ACCEPTED order
    if (!order.courierId) {
      if (order.orderStatus !== 'ACCEPTED') {
        return res.status(400).json({ message: 'Only ACCEPTED orders can be picked up' });
      }
      order.courierId = req.user._id;
    } else if (order.courierId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Order is assigned to another courier' });
    }

    order.orderStatus = status;
    if (status === 'DELIVERED') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
      order.isPaid = true;
      order.paymentStatus = 'PAID';

      if (!order.invoiceNumber) {
        order.invoiceNumber = await getNextInvoiceNumber();
      }
    }

    if (status === 'RETURNED') {
      const mongoose = require('mongoose');
      const Product = mongoose.model('Product');
      for (const item of order.orderItems) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }
      }
    }

    order.statusHistory.push({
      status,
      note: note || `Marked as ${status} by Courier`,
      updatedBy: req.user._id,
      updatedAt: new Date()
    });

    await order.save();

    if (status === 'DELIVERED') {
      await order.populate('user', 'name email phone');
      await order.populate('orderItems.product', 'name price');
      const userEmail = order.user ? order.user.email : order.guestEmail;
      if (userEmail) {
        await sendInvoiceEmail(order, userEmail)
          .catch(err => console.error('Error sending invoice email from courier:', err));
      }
      
      // Award Reward Points
      if (order.user && !order.rewardPointsAwarded) {
        try {
          const User = require('../models/User');
          const Notification = require('../models/Notification');
          const userObj = await User.findById(order.user._id);
          if (userObj) {
            const points = Math.floor(order.totalPrice / 10);
            userObj.rewardPoints += points;
            await userObj.save();
            order.rewardPointsAwarded = true;
            await order.save();
            
            const notif = new Notification({
              user: userObj._id,
              type: 'REWARD_EARNED',
              title: 'Reward Points Earned!',
              message: `You earned ${points} reward points for your recent order.`,
              link: '/profile'
            });
            await notif.save();
          }
        } catch (err) {
          console.error('Error awarding reward points from courier route:', err);
        }
      }
    }

    // Emit event to order room
    try {
      const io = getIO();
      io.to(`order:${order._id}`).emit('orderStatusUpdated', order);
    } catch (err) {}

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
