const mongoose = require('mongoose');

/**
 * Platform-wide settings stored in a single document.
 * Key fields the admin can configure:
 *   - gstRate      : GST percentage applied to all orders (e.g. 5 for 5%)
 *   - freeShippingThreshold : Cart subtotal above which shipping is free
 *   - shippingCharge        : Fixed shipping fee when below threshold
 */
const settingsSchema = new mongoose.Schema(
  {
    // Use a fixed identifier so there is always exactly ONE settings doc
    _id: { type: String, default: 'global' },

    // ── GST ──────────────────────────────────────────────────────────────
    gstRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 5,          // 5% — typical for packaged food in India
    },
    gstEnabled: {
      type: Boolean,
      default: true,
    },

    // ── Shipping ─────────────────────────────────────────────────────────
    freeShippingThreshold: {
      type: Number,
      default: 500,        // free shipping on orders > ₹500
    },
    shippingCharge: {
      type: Number,
      default: 50,
    },
    serviceablePincodes: {
      type: [String],
      default: [], // empty means all pincodes are serviceable
    },

    // ── Site Status ──────────────────────────────────────────────────────
    isMaintenanceMode: {
      type: Boolean,
      default: false,
    },
    isComingSoon: {
      type: Boolean,
      default: false,
    },
    comingSoonLaunchDate: {
      type: Date,
      default: null,
    },

    // ── Support Schedule & Auto-Dispatch Settings ────────────────────────
    supportSchedule: {
      enabled: {
        type: Boolean,
        default: true,
      },
      workDays: {
        type: [Number],
        default: [1, 2, 3, 4, 5, 6], // 1=Mon ... 6=Sat, 0=Sun (Sunday OFF by default)
      },
      startHour: {
        type: String,
        default: '09:00',
      },
      endHour: {
        type: String,
        default: '20:00',
      },
      timezone: {
        type: String,
        default: 'Asia/Kolkata',
      },
      maxConcurrentChats: {
        type: Number,
        default: 3,
      },
      ringTimeoutSeconds: {
        type: Number,
        default: 30,
      },
      offlineMessage: {
        type: String,
        default: 'Our live support team is currently offline or closed for Sunday. Please submit a support ticket and our team will get back to you.',
      },
    },

    // ── Meta ─────────────────────────────────────────────────────────────
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── Security & 2FA ───────────────────────────────────────────────────
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      otpEmail: { type: String, default: '' },
    },
    // Temporary fields for active OTP flow
    adminOtpHash: { type: String, select: false },
    adminOtpExpires: { type: Date, select: false },

    // 🏢 Company Details for Invoice 🏢
    companyDetails: {
      name: { type: String, default: 'Daatasa Retail Private Limited' },
      email: { type: String, default: 'support@daatasa.com' },
      address: { type: String, default: 'B-302, Phase 1, Industrial Area, Maharashtra - 410209' },
      gstin: { type: String, default: '29AAAAA0000A1Z5' },
    },
  },
  {
    timestamps: true,
    // We use a custom string _id so disable the default ObjectId cast
    _id: false,
    id: false,
  }
);

const Settings = mongoose.model('Settings', settingsSchema);

// ── Helper: get-or-create the single settings document ──────────────────
Settings.getGlobal = async () => {
  let settings = await Settings.findById('global');
  if (!settings) {
    settings = await Settings.create({ _id: 'global' });
  }
  return settings;
};

module.exports = Settings;
