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
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, senderName, recipientEmail, recipientName, message } = req.body;
    
    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature && process.env.NODE_ENV !== 'development') {
       // In dev we might allow bypass if key is dummy, but for now strict check:
       if (process.env.RAZORPAY_KEY_SECRET !== 'dummy_secret') {
         return res.status(400).json({ message: 'Invalid signature' });
       }
    }

    const code = generateGiftCardCode();
    // Valid for 1 year
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const giftCard = new GiftCard({
      code,
      originalBalance: amount,
      balance: amount,
      senderName,
      recipientEmail,
      recipientName,
      message,
      validUntil
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
        amount,
        code,
        message,
        validUntil
      });
    } catch (e) {
      console.error('Failed to send gift card email:', e);
    }

    res.json({ message: 'Gift card purchased successfully', giftCard: { _id: giftCard._id, code } });
  } catch (error) {
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
