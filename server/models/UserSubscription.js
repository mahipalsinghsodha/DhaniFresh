const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  razorpaySubscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'],
    default: 'created'
  },
  totalCount: {
    type: Number,
    required: true
  },
  paidCount: {
    type: Number,
    default: 0
  },
  nextBillingDate: {
    type: Date
  },
  shippingAddress: {
    name:     String,
    phone:    String,
    street:   String,
    city:     String,
    district: String,
    state:    String,
    zipCode:  String,
    country:  String
  }
}, {
  timestamps: true
});

// Index for looking up subscriptions by user easily
userSubscriptionSchema.index({ user: 1 });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);

