const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    type: mongoose.Schema.Types.ObjectId, // ID of the variant from Product.variants
    default: null
  },
  name: String,
  weight: String, // Storing the weight at time of order
  image: String,
  price: Number,
  quantity: Number
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },

  orderIdString: {
    type: String,
    unique: true,
    sparse: true
  },

  guestEmail: {
    type: String,
    trim: true
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
    enum: ['COD', 'Online', 'Wallet']
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
    razorpay_signature: String,
    method: String,
    vpa: String,
    cardNetwork: String,
    bank: String
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

  // ✅ NEW: Applied gift card details
  giftCard: {
    code: String,
    amountUsed: Number
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

  walletUsed: {
    type: Number,
    default: 0
  },

  rewardPointsAwarded: {
    type: Boolean,
    default: false
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
  
  // ✅ NEW: Shiprocket Integration Fields
  shiprocketOrderId: String,
  shiprocketShipmentId: String,
  awbCode: String,
  returnRequest: {
    reason: String,
    requestedAt: Date,
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] }
  }
}, {
  timestamps: true
});

orderSchema.pre('save', function (next) {
  if (this.isNew && !this.orderIdString) {
    const d = new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    const ms = d.getMilliseconds().toString().padStart(3, '0').slice(0, 2); // 2 digit ms for uniqueness
    this.orderIdString = `ORD${dd}${mm}${yy}${hh}${min}${ss}${ms}`;
  }
  next();
});

// Index for faster queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ 'paymentInfo.razorpay_order_id': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'coupon.code': 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;