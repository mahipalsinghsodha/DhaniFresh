const express = require('express');
const router = express.Router();
const OTP = require('../models/OTP');
const { sendSMS } = require('../services/smsService');

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * POST /api/otp/send
 * Sends an OTP to the provided phone number.
 */
router.post('/send', async (req, res) => {
  try {
    let { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Basic phone number formatting (ensure it has country code for Twilio)
    if (!phone.startsWith('+')) {
      phone = '+91' + phone; // Default to India if no country code provided
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Upsert OTP record
    await OTP.findOneAndUpdate(
      { phone },
      { otpCode, expiresAt },
      { upsert: true, new: true }
    );

    const messageBody = `Your Daatasa verification code is: ${otpCode}. It is valid for 5 minutes. Please do not share this code with anyone.`;
    
    await sendSMS(phone, messageBody);

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

/**
 * POST /api/otp/verify
 * Verifies the OTP for the provided phone number.
 */
router.post('/verify', async (req, res) => {
  try {
    let { phone, otpCode } = req.body;
    if (!phone || !otpCode) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    if (!phone.startsWith('+')) {
      phone = '+91' + phone;
    }

    const otpRecord = await OTP.findOne({ phone });

    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP expired or not found' });
    }

    if (otpRecord.otpCode !== otpCode) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ phone });
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // OTP is valid
    await OTP.deleteOne({ phone }); // Delete after successful verification to prevent reuse

    res.json({ success: true, message: 'Phone number verified successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

module.exports = router;
