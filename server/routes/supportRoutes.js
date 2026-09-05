const express = require("express");
const router = express.Router();
const SupportTicket = require("../models/SupportTicket");
const User = require("../models/User");
const Order = require("../models/Order");
const auth = require('../middleware/auth');
const { logAction } = require('../utils/logger');
// Create Ticket
router.post("/", auth,  async (req, res) => {
  const { subject, category, order, message } = req.body;

  const ticket = await SupportTicket.create({
    user: req.user._id,
    subject,
    category,
    order,
    messages: [
      {
        sender: "user",
        message
      }
    ]
  });

  res.status(201).json(ticket);
});

// Get My Tickets
router.get("/my", auth, async (req, res) => {
  const tickets = await SupportTicket.find({ user: req.user._id })
    .populate("order")
    .sort({ createdAt: -1 });

  res.json(tickets);
});

// Admin/Support: Get All Tickets
router.get("/admin", auth, auth.support, async (req, res) => {
  const tickets = await SupportTicket.find()
    .populate("user")
    .populate("order")
    .sort({ createdAt: -1 });

  res.json(tickets);
});

// Reply to Ticket
router.post("/:id/reply", auth, async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  const isSupport = req.user.role === 'superadmin' || req.user.role === 'support' || (req.user.role === 'admin' && req.user.permissions?.includes('support'));
  
  // If support/admin is replying, check permissions
  if (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'support') {
      if (!isSupport) {
          return res.status(403).json({ message: 'Access denied' });
      }
      ticket.messages.push({
        sender: "admin",
        message: req.body.message
      });
      ticket.status = "IN_PROGRESS";
      await logAction(req, 'REPLY_TICKET', 'SUPPORT', ticket._id, { status: ticket.status });
  } else {
      // Regular user check
      if (ticket.user.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Unauthorized' });
      }
      ticket.messages.push({
        sender: "user",
        message: req.body.message
      });
  }

  await ticket.save();
  res.json(ticket);
});

// Update Status (Admin/Support)
router.put("/:id/status", auth, auth.support, async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  ticket.status = req.body.status;

  if (req.body.status === "RESOLVED") {
    ticket.resolvedAt = Date.now();
  }

  await ticket.save();
  await logAction(req, 'UPDATE_TICKET_STATUS', 'SUPPORT', ticket._id, { status: ticket.status });
  res.json(ticket);
});

const mongoose = require('mongoose');

const escapeRegex = (string) => {
  if (!string) return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Search Users/Orders for Support Panel
router.get("/search", auth, auth.support, async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;
    if (!q || !q.trim()) return res.json({ users: [], orders: [] });

    const qTrimmed = q.trim();
    const cleanId = qTrimmed.replace(/^#/, '').trim();
    const escapedQ = escapeRegex(qTrimmed);
    const escapedCleanId = escapeRegex(cleanId);
    const isObjectId = mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24;
    
    let userQuery = [];
    let orderQuery = [];

    // Filter logic based on type (with smart multi-field fallback)
    if (type === 'email') {
      userQuery.push({ email: { $regex: escapedQ, $options: 'i' } });
      orderQuery.push(
        { guestEmail: { $regex: escapedQ, $options: 'i' } },
        { 'shippingAddress.email': { $regex: escapedQ, $options: 'i' } }
      );
      // Fallback: in case an Order ID or Invoice was typed while email filter was selected
      orderQuery.push(
        { orderIdString: { $regex: escapedCleanId, $options: 'i' } },
        { invoiceNumber: { $regex: escapedCleanId, $options: 'i' } }
      );
    } else if (type === 'phone') {
      userQuery.push({ phone: { $regex: escapedQ, $options: 'i' } });
      orderQuery.push({ 'shippingAddress.phone': { $regex: escapedQ, $options: 'i' } });
    } else if (type === 'name') {
      userQuery.push({ name: { $regex: escapedQ, $options: 'i' } });
      orderQuery.push({ 'shippingAddress.name': { $regex: escapedQ, $options: 'i' } });
    } else if (type === 'orderId') {
      // Primary: Order identifiers
      orderQuery.push(
        { orderIdString: { $regex: escapedCleanId, $options: 'i' } },
        { invoiceNumber: { $regex: escapedCleanId, $options: 'i' } },
        { trackingNumber: { $regex: escapedCleanId, $options: 'i' } },
        { shiprocketOrderId: { $regex: escapedCleanId, $options: 'i' } },
        { guestEmail: { $regex: escapedQ, $options: 'i' } }
      );
      if (isObjectId) {
        orderQuery.push({ _id: cleanId });
      }
      if (cleanId.length >= 2) {
        orderQuery.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: escapedCleanId, options: 'i' } } });
      }

      // Smart Fallback: Also search User Email and Name so email queries typed with OrderId filter find the user & their orders
      userQuery.push(
        { email: { $regex: escapedQ, $options: 'i' } },
        { name: { $regex: escapedQ, $options: 'i' } }
      );
    } else if (type === 'paymentId') {
      orderQuery.push(
        { 'paymentInfo.razorpay_payment_id': { $regex: escapedQ, $options: 'i' } },
        { 'paymentInfo.razorpay_order_id': { $regex: escapedQ, $options: 'i' } }
      );
    } else if (type === 'invoice') {
      orderQuery.push(
        { invoiceNumber: { $regex: escapedCleanId, $options: 'i' } },
        { orderIdString: { $regex: escapedCleanId, $options: 'i' } },
        { guestEmail: { $regex: escapedQ, $options: 'i' } }
      );
      userQuery.push({ email: { $regex: escapedQ, $options: 'i' } });
    } else {
      // Default 'all' behavior
      userQuery.push(
        { name: { $regex: escapedQ, $options: 'i' } },
        { email: { $regex: escapedQ, $options: 'i' } },
        { phone: { $regex: escapedQ, $options: 'i' } }
      );

      orderQuery.push(
        { orderIdString: { $regex: escapedCleanId, $options: 'i' } },
        { invoiceNumber: { $regex: escapedCleanId, $options: 'i' } },
        { trackingNumber: { $regex: escapedCleanId, $options: 'i' } },
        { shiprocketOrderId: { $regex: escapedCleanId, $options: 'i' } },
        { guestEmail: { $regex: escapedQ, $options: 'i' } },
        { 'shippingAddress.name': { $regex: escapedQ, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: escapedQ, $options: 'i' } },
        { 'shippingAddress.email': { $regex: escapedQ, $options: 'i' } },
        { 'shippingAddress.street': { $regex: escapedQ, $options: 'i' } },
        { 'shippingAddress.city': { $regex: escapedQ, $options: 'i' } },
        { 'paymentInfo.razorpay_payment_id': { $regex: escapedQ, $options: 'i' } },
        { 'paymentInfo.razorpay_order_id': { $regex: escapedQ, $options: 'i' } }
      );

      if (isObjectId) {
        orderQuery.push({ _id: cleanId });
      }
      if (cleanId.length >= 2) {
        orderQuery.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: escapedCleanId, options: 'i' } } });
      }
    }

    // 1. Fetch Users
    let users = [];
    if (userQuery.length > 0) {
      users = await User.find({ $or: userQuery })
        .select('name email phone role isBlocked createdAt')
        .limit(20)
        .lean();
    }

    // 2. Add Users to Order Query (always link matched users' orders)
    if (users.length > 0) {
      orderQuery.push({ user: { $in: users.map(u => u._id) } });
    }

    // 3. Fetch Orders
    let orders = [];
    if (orderQuery.length > 0) {
      orders = await Order.find({ $or: orderQuery })
        .populate('user', 'name email phone')
        .populate('orderItems.product', 'name image price')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
    }

    res.json({ users, orders });
  } catch (error) {
    console.error('Support search error:', error);
    res.status(500).json({ message: error.message || 'Search failed' });
  }
});

// Get Single Order Details (Support Panel)
router.get("/orders/:id", auth, auth.support, async (req, res) => {
  try {
    const { id } = req.params;
    let order = null;

    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findById(id)
        .populate('user', 'name email phone')
        .populate('orderItems.product', 'name image price');
    }

    if (!order) {
      order = await Order.findOne({
        $or: [
          { orderIdString: id },
          { invoiceNumber: id },
          { trackingNumber: id },
          { shiprocketOrderId: id }
        ]
      })
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name image price');
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Order Status (Support Panel)
router.patch("/orders/:id/status", auth, auth.support, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (status === 'CANCELLED') {
      if (order.isDelivered) return res.status(400).json({ message: 'Cannot cancel a delivered order' });
      if (['CANCELLED', 'FAILED'].includes(order.paymentStatus)) {
        return res.status(400).json({ message: 'Order is already cancelled' });
      }

      const { restoreOrderResources } = require('../utils/orderResourceHelper');
      const restoreResult = await restoreOrderResources(order, 'Cancelled by Support');

      order.paymentStatus = 'CANCELLED';
      order.orderStatus = 'CANCELLED';
      order.isPaid = false;
      order.cancelReason = 'Cancelled via Support Panel';
      order.cancelledAt = new Date();
      order.cancelledBy = 'admin';

      if (restoreResult.razorpayRefund || restoreResult.walletRefunded > 0) {
        order.refundInfo = restoreResult.razorpayRefund || {
          status: 'PROCESSED',
          amount: restoreResult.walletRefunded,
          initiatedAt: new Date(),
          note: 'Refunded to Daatasa Wallet'
        };
      }
    } else {
      order.paymentStatus = status;
      if (status === 'PAID') {
        order.isPaid = true;
        order.paidAt = new Date();
      } else if (status === 'FAILED') {
        order.isPaid = false;
      }
    }
    
    await order.save();
    await logAction(req, 'UPDATE_ORDER_STATUS', 'SUPPORT', order._id, { status });
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
