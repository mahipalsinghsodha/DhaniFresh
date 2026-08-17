const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');
const { logAction } = require('../utils/logger');

// Generate invoice for order
router.get('/:orderId', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate({
        path: 'orderItems.product',
        populate: { path: 'category' }
      });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns order or is admin with order permission/superadmin
    const isOwner = order.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'superadmin' || (req.user.role === 'admin' && req.user.permissions?.includes('orders'));

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!order.isPaid && order.paymentStatus !== 'COD_CONFIRMED') {
      return res.status(400).json({ message: 'Cannot generate invoice for unpaid or unconfirmed orders' });
    }

    const d = order.createdAt || new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    const invoiceNumber = order.invoiceNumber || `INV${dd}${mm}${yy}${hh}${min}${ss}`;

    const settings = await Settings.getGlobal();

    // Invoice data
    const invoice = {
      invoiceNumber: invoiceNumber,
      orderIdString: order.orderIdString || invoiceNumber.replace('INV', 'ORD'),
      orderId: order._id,
      date: order.createdAt,
      companyDetails: settings.companyDetails,
      customer: {
        name: order.user.name,
        email: order.user.email,
        address: order.shippingAddress
      },
      items: order.orderItems.map(item => ({
        name: item.name,
        category: item.product?.category?.name || 'Daatasa Premium Ghee',
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      subtotal: order.itemsPrice,
      tax: order.taxPrice,
      shipping: order.shippingPrice,
      total: order.totalPrice,
      paymentMethod: order.paymentMethod,
      transactionId: order.paymentInfo?.razorpay_payment_id,
      paidAt: order.paidAt,
      deliveredAt: order.deliveredAt
    };

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate and download invoice PDF
router.get('/:orderId/download', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate({
        path: 'orderItems.product',
        populate: { path: 'category' }
      });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isOwner = order.user && order.user._id && order.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'superadmin' || (req.user.role === 'admin' && req.user.permissions?.includes('orders'));

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!order.isPaid && order.paymentStatus !== 'COD_CONFIRMED') {
      return res.status(400).json({ message: 'Cannot generate invoice for unpaid or unconfirmed orders' });
    }

    const d = order.createdAt || new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    const invoiceNumber = order.invoiceNumber || `INV${dd}${mm}${yy}${hh}${min}${ss}`;

    const settings = await Settings.getGlobal();

    const invoice = {
      invoiceNumber: invoiceNumber,
      orderIdString: order.orderIdString || invoiceNumber.replace('INV', 'ORD'),
      orderId: order._id,
      date: order.createdAt,
      companyDetails: settings.companyDetails,
      customer: {
        name: order.user ? order.user.name : order.shippingAddress.name,
        email: order.user ? order.user.email : order.guestEmail,
        address: order.shippingAddress
      },
      items: order.orderItems.map(item => ({
        name: item.name,
        category: item.product?.category?.name || 'Daatasa Premium Ghee',
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      subtotal: order.itemsPrice,
      tax: order.taxPrice,
      shipping: order.shippingPrice,
      total: order.totalPrice,
      paymentMethod: order.paymentMethod,
      transactionId: order.paymentInfo?.razorpay_payment_id,
      paymentInfo: order.paymentInfo,
    };

    // Retroactively fetch missing payment details from Razorpay for existing orders
    if (invoice.transactionId && (!invoice.paymentInfo.method || !invoice.paymentInfo.vpa)) {
      try {
        const razorpay = require('../config/razorpay');
        const payment = await razorpay.payments.fetch(invoice.transactionId);
        invoice.paymentInfo = invoice.paymentInfo || {};
        invoice.paymentInfo.method = payment.method;
        if (payment.method === 'upi') {
          invoice.paymentInfo.vpa = payment.vpa;
        } else if (payment.method === 'card') {
          invoice.paymentInfo.cardNetwork = payment.card?.network;
        } else if (payment.method === 'netbanking') {
          invoice.paymentInfo.bank = payment.bank;
        }
      } catch (e) {
        console.error('Failed to fetch Razorpay payment details for invoice:', e.message);
      }
    }

    const { generateInvoicePDF } = require('../services/invoiceService');
    generateInvoicePDF(invoice, res);
  } catch (error) {
    console.error('PDF GENERATION ERROR:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
});

// Generate multiple invoices
router.post('/bulk', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const { orderIds } = req.body;
    const invoices = [];

    for (const orderId of orderIds) {
      const order = await Order.findById(orderId)
        .populate('user', 'name email')
        .populate('orderItems.product');

      if (order && (order.isPaid || order.paymentStatus === 'COD_CONFIRMED')) {
        const d = order.createdAt || new Date();
        const yy = d.getFullYear().toString().slice(-2);
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        const hh = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        const ss = d.getSeconds().toString().padStart(2, '0');
        const invoiceNumber = order.invoiceNumber || `INV${dd}${mm}${yy}${hh}${min}${ss}`;

        invoices.push({
          invoiceNumber: invoiceNumber,
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

    await logAction(req, 'GENERATE_BULK_INVOICES', 'ORDER', null, { count: orderIds.length });
    res.json({ invoices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
