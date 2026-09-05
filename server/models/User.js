// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  label:    { type: String, default: 'Home' },
  name:     { type: String, required: true },
  phone:    { type: String, required: true },
  street:   { type: String, required: true },
  city:     { type: String, required: true },
  district: { type: String, required: true },
  state:    { type: String, required: true },
  zipCode:  { type: String, required: true },
  country:  { type: String, default: 'India' },
  isDefault:{ type: Boolean, default: false },
}, { _id: true, timestamps: true });

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, unique: true, sparse: true, lowercase: true, trim: true, default: null },
  password: { type: String, minlength: 6, select: false },
  role:     { type: String, enum: ['user', 'admin', 'superadmin', 'support', 'courier', 'b2b_customer'], default: 'user' },
  permissions: [{ type: String }], // e.g., ['products', 'orders', 'users']
  phone: { type: String, unique: true, sparse: true, trim: true },
  
  // B2B Details
  companyName: String,
  gstin: String,
  b2bDiscountPercentage: { type: Number, default: 0 },

  avatar:   String, // Cloudinary URL for profile photo
  addresses:[addressSchema],
  language: { type: String, default: 'en', enum: ['en', 'hi'] },

  isBlocked: { type: Boolean, default: false },

  // ── Support Agent Stats & Live State ─────────────────────────────────────
  supportStats: {
    dispatchedCount:  { type: Number, default: 0 },
    acceptedCount:    { type: Number, default: 0 },
    rejectedCount:    { type: Number, default: 0 },
    missedCount:      { type: Number, default: 0 },
    resolvedCount:    { type: Number, default: 0 },
    totalWorkSeconds: { type: Number, default: 0 },
    avgRating:        { type: Number, default: 5 },
    ratingCount:      { type: Number, default: 0 },
    dailyStats: {
      date:        { type: String, default: () => new Date().toISOString().slice(0, 10) },
      accepted:    { type: Number, default: 0 },
      rejected:    { type: Number, default: 0 },
      missed:      { type: Number, default: 0 },
      workSeconds: { type: Number, default: 0 },
    },
    isLive:          { type: Boolean, default: true },
    lastActiveAt:    { type: Date, default: Date.now },
  },

  lastLogin: { type: Date, default: Date.now },

  // ── Loyalty & Wallet System ───────────────────────────────────────────────
  walletBalance: { type: Number, default: 0 },
  rewardPoints: { type: Number, default: 0 },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralRewardClaimed: { type: Boolean, default: false },

  // Legacy single address for backward compat
  address: {
    street: String, city: String, state: String, zipCode: String, country: String,
  },

  // ── Secure Password Reset Fields ──────────────────────────────────────────
  resetPasswordToken:       { type: String, select: false }, // SHA-256 hash of raw token
  resetPasswordExpire:      { type: Date,   select: false }, // 2-minute window
  resetPasswordFingerprint: { type: String, select: false }, // SHA-256 hash of IP + User-Agent

  // Pending email updates
  pendingEmail: { type: String, trim: true, lowercase: true },
  emailUpdateOTP: String,
  emailUpdateOTPExpire: Date,

  tokenVersion: { type: Number, default: 0 },

  // ── Refresh Token Rotation ─────────────────────────────────────────────────
  // Store hashed refresh tokens for multi-device support + rotation
  refreshTokens: [{
    tokenHash: { type: String, select: false },
    expiresAt: Date,
    deviceInfo: String, // User-Agent snippet for display
  }],

  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]

}, { timestamps: true });

/* ── Ensure only one default address ────────────────────────────── */
userSchema.pre('save', function (next) {
  const defaults = this.addresses.filter(a => a.isDefault);
  if (defaults.length === 0 && this.addresses.length > 0) {
    this.addresses[this.addresses.length - 1].isDefault = true;
  } else if (defaults.length > 1) {
    let found = false;
    for (let i = this.addresses.length - 1; i >= 0; i--) {
      if (this.addresses[i].isDefault) {
        if (found) this.addresses[i].isDefault = false;
        else found = true;
      }
    }
  }
  next();
});

/* ── Hash password before save ───────────────────────────────────── */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    // saltRounds = 12 (production standard)
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) { next(error); }
});

/* ── Instance methods ────────────────────────────────────────────── */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/* ── Clean expired refresh tokens ───────────────────────────────── */
userSchema.methods.cleanExpiredRefreshTokens = function () {
  const now = new Date();
  this.refreshTokens = (this.refreshTokens || []).filter(t => t.expiresAt > now);
};

/* ── Virtual: default address ───────────────────────────────────── */
userSchema.virtual('defaultAddress').get(function () {
  return this.addresses.find(a => a.isDefault) || this.addresses[this.addresses.length - 1] || null;
});

const User = mongoose.model('User', userSchema);
module.exports = User;
