const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  otpCode: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '5m' } // Document will automatically be deleted 5 minutes after expiresAt
  }
}, { timestamps: true });

const OTP = mongoose.model('OTP', otpSchema);
module.exports = OTP;
