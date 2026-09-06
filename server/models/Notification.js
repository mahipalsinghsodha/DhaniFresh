// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED',
      'ORDER_CANCELLED', 'RETURN_APPROVED', 'RETURN_REJECTED',
      'REFUND_INITIATED', 'OFFER', 'CHAT_REPLY', 'SYSTEM',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 100,
  },
  message: {
    type: String,
    required: true,
    maxlength: 500,
  },
  link: String, // Optional deep link e.g. /orders/abc123
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // orderId, etc.
    default: {},
  },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
// Automatically delete notifications older than 3 days (3 * 24 * 60 * 60 = 259,200 seconds)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
