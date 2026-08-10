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

// Search Users/Orders for Support Panel
router.get("/search", auth, auth.support, async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q) return res.json({ users: [], orders: [] });

    const qTrimmed = q.trim();
    const isObjectId = qTrimmed.match(/^[0-9a-fA-F]{24}$/);
    
    let userQuery = [];
    let orderQuery = [];

    // Filter logic based on type
    if (type === 'email') {
      userQuery.push({ email: { $regex: qTrimmed, $options: 'i' } });
    } else if (type === 'phone') {
      userQuery.push({ phone: { $regex: qTrimmed, $options: 'i' } });
    } else if (type === 'orderId') {
      if (isObjectId) {
        orderQuery.push({ _id: qTrimmed });
      } else {
        orderQuery.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: qTrimmed, options: 'i' } } });
      }
    } else if (type === 'paymentId') {
      orderQuery.push({ 'paymentInfo.razorpay_payment_id': { $regex: qTrimmed, $options: 'i' } });
    } else if (type === 'invoice') {
      orderQuery.push({ invoiceNumber: { $regex: qTrimmed, $options: 'i' } });
    } else {
      // Default 'all' behavior
      userQuery.push(
        { name: { $regex: qTrimmed, $options: 'i' } },
        { email: { $regex: qTrimmed, $options: 'i' } },
        { phone: { $regex: qTrimmed, $options: 'i' } }
      );
      if (isObjectId) {
        orderQuery.push({ _id: qTrimmed });
      } else {
        orderQuery.push({ 'paymentInfo.razorpay_payment_id': { $regex: qTrimmed, $options: 'i' } });
        orderQuery.push({ trackingNumber: { $regex: qTrimmed, $options: 'i' } });
        orderQuery.push({ invoiceNumber: { $regex: qTrimmed, $options: 'i' } });
        orderQuery.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: qTrimmed, options: 'i' } } });
      }
    }

    // 1. Fetch Users
    let users = [];
    if (userQuery.length > 0) {
      users = await User.find({ $or: userQuery }).select('name email phone role isBlocked createdAt');
    }

    // 2. Add Users to Order Query
    if (users.length > 0 && (!type || type === 'all' || type === 'email' || type === 'phone')) {
      orderQuery.push({ user: { $in: users.map(u => u._id) } });
    }

    // 3. Fetch Orders
    let orders = [];
    if (orderQuery.length > 0) {
      orders = await Order.find({ $or: orderQuery })
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(20);
    }


    res.json({ users, orders });
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

    order.paymentStatus = status;
    if (status === 'PAID') {
      order.isPaid = true;
      order.paidAt = new Date();
    } else if (status === 'CANCELLED' || status === 'FAILED') {
      order.isPaid = false;
    }
    
    await order.save();
    await logAction(req, 'UPDATE_ORDER_STATUS', 'SUPPORT', order._id, { status });
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
