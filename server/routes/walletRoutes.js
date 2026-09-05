const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @route   GET /api/wallet
// @desc    Get wallet balance, reward points, and transaction history
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('walletBalance rewardPoints');
    const transactions = await WalletTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.json({
      walletBalance: user.walletBalance,
      rewardPoints: user.rewardPoints,
      transactions
    });
  } catch (err) {
    console.error('Error fetching wallet:', err);
    res.status(500).json({ message: 'Server error fetching wallet data' });
  }
});

// @route   POST /api/wallet/topup
// @desc    Create Razorpay order to top up wallet
// @access  Private
router.post('/topup', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const options = {
      amount: amount * 100, // paise
      currency: 'INR',
      receipt: `wallet_topup_${req.user._id}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error('Error creating topup order:', err);
    res.status(500).json({ message: 'Failed to initiate topup' });
  }
});

// @route   POST /api/wallet/topup/verify
// @desc    Verify Razorpay topup and add to wallet
// @access  Private
router.post('/topup/verify', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment details' });
    }

    // 1️⃣ Verify HMAC SHA-256 signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // 2️⃣ Replay Attack Protection: Ensure payment ID hasn't been credited already
    const existingTx = await WalletTransaction.findOne({ paymentId: razorpay_payment_id });
    if (existingTx) {
      return res.status(400).json({ message: 'This payment has already been credited to wallet' });
    }

    // 3️⃣ Verify payment status and actual captured amount directly from Razorpay
    let payment;
    try {
      payment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchErr) {
      console.error('Razorpay payment fetch error:', fetchErr);
      return res.status(400).json({ message: 'Failed to verify payment with gateway' });
    }

    if (!payment || (payment.status !== 'captured' && payment.status !== 'authorized')) {
      return res.status(400).json({ message: 'Payment is not captured or authorized' });
    }

    // Verified amount in Rupees from Razorpay (paise / 100)
    const verifiedAmount = Math.round(payment.amount) / 100;
    if (verifiedAmount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.walletBalance = Math.round(((user.walletBalance || 0) + verifiedAmount) * 100) / 100;
    await user.save();

    const transaction = await WalletTransaction.create({
      user: req.user._id,
      type: 'CREDIT',
      amount: verifiedAmount,
      balanceAfter: user.walletBalance,
      description: `Wallet Top-up via Razorpay (${razorpay_payment_id})`,
      transactionType: 'TOPUP',
      paymentId: razorpay_payment_id
    });

    res.json({ message: 'Top-up successful', walletBalance: user.walletBalance, transaction });
  } catch (err) {
    console.error('Error verifying topup:', err);
    res.status(500).json({ message: 'Failed to verify topup' });
  }
});

// @route   POST /api/wallet/rewards/convert
// @desc    Convert reward points to wallet balance
// @access  Private
router.post('/rewards/convert', auth, async (req, res) => {
  try {
    const { points } = req.body;
    if (!points || points <= 0) {
      return res.status(400).json({ message: 'Valid points are required' });
    }

    const user = await User.findById(req.user._id);
    if (user.rewardPoints < points) {
      return res.status(400).json({ message: 'Insufficient reward points' });
    }

    // Conversion rate: 10 points = 1 Rupee (for example)
    const CONVERSION_RATE = 0.1;
    const amountToAdd = points * CONVERSION_RATE;

    user.rewardPoints -= points;
    user.walletBalance += amountToAdd;
    await user.save();

    const transaction = await WalletTransaction.create({
      user: req.user._id,
      type: 'CREDIT',
      amount: amountToAdd,
      balanceAfter: user.walletBalance,
      description: `Converted ${points} reward points`,
      transactionType: 'REWARD_CONVERSION'
    });

    res.json({
      message: 'Points converted successfully',
      walletBalance: user.walletBalance,
      rewardPoints: user.rewardPoints,
      transaction
    });
  } catch (err) {
    console.error('Error converting points:', err);
    res.status(500).json({ message: 'Failed to convert points' });
  }
});

module.exports = router;
