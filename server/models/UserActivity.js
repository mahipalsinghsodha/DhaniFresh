const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Could be anonymous/guest if we want to track them, but mostly user
  },
  action: {
    type: String,
    required: true,
    enum: ['PAGE_VISIT', 'LOGIN', 'LOGOUT', 'OTHER', 'ORDER_PLACED'],
    default: 'PAGE_VISIT',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
  },
  location: {
    type: String,
    default: 'Unknown',
  },
}, { timestamps: true });

module.exports = mongoose.model('UserActivity', userActivitySchema);
