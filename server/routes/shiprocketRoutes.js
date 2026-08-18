const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const shiprocketService = require('../services/shiprocketService');

/**
 * POST /api/shiprocket/push/:orderId
 * Push an order to Shiprocket
 */
router.post('/push/:orderId', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.shiprocketOrderId) {
      return res.status(400).json({ message: 'Order already pushed to Shiprocket' });
    }

    // Format data for Shiprocket Custom Order API
    const orderData = {
      order_id: order.orderIdString || order._id.toString(),
      order_date: order.createdAt.toISOString().split('T')[0],
      pickup_location: "Primary", // Must match the pickup location name in Shiprocket dashboard
      billing_customer_name: order.shippingAddress.name,
      billing_last_name: "",
      billing_address: order.shippingAddress.street,
      billing_address_2: "",
      billing_city: order.shippingAddress.city,
      billing_pincode: order.shippingAddress.zipCode,
      billing_state: order.shippingAddress.state,
      billing_country: "India",
      billing_email: order.guestEmail || "customer@example.com",
      billing_phone: order.shippingAddress.phone,
      shipping_is_billing: true,
      order_items: order.orderItems.map(item => ({
        name: item.name,
        sku: item.product.toString().slice(-8), // Generate pseudo SKU
        units: item.quantity,
        selling_price: item.price,
        discount: 0,
        tax: 0,
        hsn: 441122
      })),
      payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
      shipping_charges: order.shippingPrice,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: order.discount,
      sub_total: order.itemsPrice,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 1 // Default 1kg, should ideally be calculated
    };

    const response = await shiprocketService.createOrder(orderData);
    
    order.shiprocketOrderId = response.order_id;
    order.shiprocketShipmentId = response.shipment_id;
    order.statusHistory.push({
      status: 'ASSIGNED_TO_COURIER',
      note: 'Order pushed to Shiprocket',
      updatedBy: req.user._id,
      updatedAt: new Date()
    });
    order.orderStatus = 'ASSIGNED_TO_COURIER';
    
    await order.save();
    res.json({ success: true, message: 'Order pushed to Shiprocket successfully', shiprocketOrderId: response.order_id });
  } catch (error) {
    console.error('Push to Shiprocket Error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/shiprocket/awb/:orderId
 * Generate AWB for a pushed order
 */
router.post('/awb/:orderId', auth, auth.admin, auth.hasPermission('orders'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!order.shiprocketShipmentId) {
      return res.status(400).json({ message: 'Order must be pushed to Shiprocket first' });
    }

    if (order.awbCode) {
      return res.status(400).json({ message: 'AWB already generated for this order' });
    }

    const response = await shiprocketService.generateAWB(order.shiprocketShipmentId);
    
    order.awbCode = response.response?.data?.awb_code || response.awb_code;
    order.shippingProvider = response.response?.data?.courier_name || response.courier_name;
    order.trackingNumber = order.awbCode;
    
    order.statusHistory.push({
      status: 'ASSIGNED_TO_COURIER',
      note: `AWB Generated: ${order.awbCode} via ${order.shippingProvider}`,
      updatedBy: req.user._id,
      updatedAt: new Date()
    });

    await order.save();
    res.json({ success: true, message: 'AWB generated successfully', awbCode: order.awbCode, courier: order.shippingProvider });
  } catch (error) {
    console.error('Generate AWB Error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/shiprocket/webhook
 * Receive tracking updates from Shiprocket
 */
router.post('/webhook', async (req, res) => {
  try {
    const { awb, current_status } = req.body;
    
    if (!awb || !current_status) {
      return res.status(400).send('Invalid payload');
    }

    const order = await Order.findOne({ awbCode: awb });
    if (!order) return res.status(404).send('Order not found');

    let newStatus = null;
    if (current_status === 'PICKED UP') newStatus = 'PICKED_UP';
    if (current_status === 'OUT FOR DELIVERY') newStatus = 'OUT_FOR_DELIVERY';
    if (current_status === 'DELIVERED') newStatus = 'DELIVERED';
    if (current_status === 'RTO INITIATED') newStatus = 'RETURNED';

    if (newStatus && order.orderStatus !== newStatus) {
      order.orderStatus = newStatus;
      order.statusHistory.push({
        status: newStatus,
        note: `Shiprocket Webhook: ${current_status}`,
        updatedAt: new Date()
      });

      if (newStatus === 'DELIVERED') {
        order.isDelivered = true;
        order.deliveredAt = new Date();
      }

      await order.save();

      if (newStatus === 'PICKED_UP' || newStatus === 'OUT_FOR_DELIVERY') {
        try {
          const { sendShippingUpdateWhatsApp } = require('../services/whatsappService');
          await order.populate('user', 'name email');
          sendShippingUpdateWhatsApp(order);
        } catch(err) { 
          console.error('Webhook WhatsApp error', err); 
        }
      }
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Shiprocket Webhook Error:', error);
    res.status(500).send('Internal Error');
  }
});

module.exports = router;
