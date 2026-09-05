const express = require('express');
const router = express.Router();
const GiftCard = require('../models/GiftCard');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { sendGiftCardEmail } = require('../services/emailService');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

// Generate a random 12 character alphanumeric code
const generateGiftCardCode = () => {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
};

// Purchase Gift Card - Create Razorpay Order
router.post('/purchase', async (req, res) => {
  try {
    const { amount, senderName, recipientEmail, recipientName, message } = req.body;
    
    if (amount < 100) return res.status(400).json({ message: 'Minimum amount is ₹100' });

    // In a real app, integrate Razorpay order creation here
    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `gc_receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify Payment and Create Gift Card
router.post('/verify', auth.optional, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, senderName, recipientEmail, recipientName, message } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment details' });
    }

    if (!senderName || !recipientEmail || !recipientName) {
      return res.status(400).json({ message: 'Sender and recipient details are required' });
    }

    // 1️⃣ Verify HMAC SHA-256 signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // 2️⃣ Replay Attack Protection: Check if gift card was already created for this payment ID
    const existingGC = await GiftCard.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (existingGC) {
      return res.status(400).json({ message: 'Gift card already generated for this payment' });
    }

    // 3️⃣ Verify payment status and actual captured amount from Razorpay directly
    let payment;
    try {
      payment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchErr) {
      console.error('Failed to fetch Razorpay payment for gift card:', fetchErr);
      return res.status(400).json({ message: 'Failed to verify payment with gateway' });
    }

    if (!payment || (payment.status !== 'captured' && payment.status !== 'authorized')) {
      return res.status(400).json({ message: 'Payment is not captured or authorized' });
    }

    const verifiedAmount = Math.round(payment.amount) / 100;
    if (verifiedAmount < 100) {
      return res.status(400).json({ message: 'Gift card amount must be at least ₹100' });
    }

    const code = generateGiftCardCode();
    // Valid for 1 year
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const giftCard = new GiftCard({
      code,
      originalBalance: verifiedAmount,
      balance: verifiedAmount,
      senderName,
      recipientEmail,
      recipientName,
      message,
      validUntil,
      razorpayPaymentId: razorpay_payment_id
    });

    // If user is logged in, attach purchaser
    if (req.user) {
      giftCard.purchaser = req.user._id;
    }

    await giftCard.save();

    // Send Email to Recipient
    try {
      await sendGiftCardEmail({
        to: recipientEmail,
        recipientName,
        senderName,
        amount: verifiedAmount,
        code,
        message,
        validUntil
      });
    } catch (e) {
      console.error('Failed to send gift card email:', e);
    }

    res.json({ message: 'Gift card purchased successfully', giftCard: { _id: giftCard._id, code, balance: verifiedAmount } });
  } catch (error) {
    console.error('Gift card verification error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Check Gift Card Balance
router.get('/check/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const giftCard = await GiftCard.findOne({ code });

    if (!giftCard) return res.status(404).json({ message: 'Invalid gift card code' });
    if (!giftCard.isActive) return res.status(400).json({ message: 'This gift card is inactive' });
    if (new Date(giftCard.validUntil) < new Date()) return res.status(400).json({ message: 'This gift card has expired' });

    res.json({ balance: giftCard.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
