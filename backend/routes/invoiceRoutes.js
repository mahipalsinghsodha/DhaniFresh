const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const auth = require('../middleware/auth');

// Generate invoice for order
router.get('/:orderId', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns order or is admin
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Invoice data
    const invoice = {
      invoiceNumber: `INV-${order._id.toString().slice(-8).toUpperCase()}`,
      orderId: order._id,
      date: order.createdAt,
      customer: {
        name: order.user.name,
        email: order.user.email,
        address: order.shippingAddress
      },
      items: order.orderItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      subtotal: order.itemsPrice,
      tax: order.taxPrice,
      shipping: order.shippingPrice,
      total: order.totalPrice,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.isPaid ? 'Paid' : 'Pending',
      deliveryStatus: order.isDelivered ? 'Delivered' : 'Pending',
      paidAt: order.paidAt,
      deliveredAt: order.deliveredAt
    };

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate multiple invoices
router.post('/bulk', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { orderIds } = req.body;
    const invoices = [];

    for (const orderId of orderIds) {
      const order = await Order.findById(orderId)
        .populate('user', 'name email')
        .populate('orderItems.product');

      if (order) {
        invoices.push({
          invoiceNumber: `INV-${order._id.toString().slice(-8).toUpperCase()}`,
          orderId: order._id,
          date: order.createdAt,
          customer: {
            name: order.user.name,
            email: order.user.email,
            address: order.shippingAddress
          },
          items: order.orderItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
          })),
          subtotal: order.itemsPrice,
          tax: order.taxPrice,
          shipping: order.shippingPrice,
          total: order.totalPrice,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.isPaid ? 'Paid' : 'Pending',
          deliveryStatus: order.isDelivered ? 'Delivered' : 'Pending'
        });
      }
    }

    res.json({ invoices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
