const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  originalBalance: {
    type: Number,
    required: true,
    min: 0
  },
  balance: {
    type: Number,
    required: true,
    min: 0
  },
  purchaser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Who bought it (optional, could be guest)
  },
  senderName: {
    type: String,
    required: true
  },
  recipientEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  recipientName: {
    type: String,
    required: true
  },
  message: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  validUntil: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

const GiftCard = mongoose.model('GiftCard', giftCardSchema);
module.exports = GiftCard;
