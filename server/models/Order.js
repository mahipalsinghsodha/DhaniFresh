const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: String,
  image: String,
  price: Number,
  quantity: Number
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  orderItems: [orderItemSchema],

  shippingAddress: {
    name:     String,
    phone:    String,
    street:   String,
    city:     String,
    district: String,
    state:    String,
    zipCode:  String,
    country:  String
  },
cancelReason:  { type: String, default: '' },
cancelledAt:   Date,
cancelledBy:   { type: String, enum: ['user', 'admin'] },
refundInfo: {
  refund_id:   String,
  status:      String,
  amount:      Number,
  initiatedAt: Date,
},
  paymentMethod: {
    type: String,
    required: true,
    enum: ['COD', 'Online']
  },

  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'COD_CONFIRMED', 'EXPIRED'],
    default: 'PENDING'
  },

  orderStatus: {
    type: String,
    enum: ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ASSIGNED_TO_COURIER', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'ATTEMPTED_FAILED', 'RETURNED', 'CANCELLED'],
    default: 'PENDING_ACCEPTANCE'
  },

  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acceptedAt: Date,
  
  courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  statusHistory: [{
    status: String,
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: Date
  }],

  // Razorpay payment info
  paymentInfo: {
    razorpay_order_id: String,
    razorpay_payment_id: String,
    razorpay_signature: String
  },

  // Price breakdown
  itemsPrice: {
    type: Number,
    required: true,
    default: 0
  },

  // ✅ NEW: Discount from coupon
  discount: {
    type: Number,
    default: 0
  },

  // ✅ NEW: Applied coupon details
  coupon: {
    code: String,
    discountType: String,
    discountValue: Number,
    discountAmount: Number
  },

  taxPrice: {
    type: Number,
    required: true,
    default: 0
  },

  shippingPrice: {
    type: Number,
    required: true,
    default: 0
  },

  totalPrice: {
    type: Number,
    required: true,
    default: 0
  },

  // GST rate (%) that was applied at the time of order — stored for audit trail
  gstRate: {
    type: Number,
    default: 0
  },

  isPaid: {
    type: Boolean,
    default: false
  },

  paidAt: Date,

  isDelivered: {
    type: Boolean,
    default: false
  },

  deliveredAt: Date,

  invoiceNumber: { type: String, unique: true, sparse: true },
  trackingNumber: String,
  shippingProvider: String,
  returnRequest: {
    reason: String,
    requestedAt: Date,
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] }
  }
}, {
  timestamps: true
});

// Index for faster queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ 'paymentInfo.razorpay_order_id': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'coupon.code': 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;