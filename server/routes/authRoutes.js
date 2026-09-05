
// routes/authRoutes.js
// JWT Security:
//   ✅ Access token: 15min expiry, stored in memory (never localStorage)
//   ✅ Refresh token: 7d expiry, stored in httpOnly cookie (path: /api/auth/refresh)
//   ✅ Refresh token rotation: new refresh token issued on every use
//   ✅ Device fingerprint on password reset
//   ✅ Rate limiting on all auth endpoints

const express     = require('express');
const router      = express.Router();
const jwt         = require('jsonwebtoken');
const crypto      = require('crypto');
const { sendPasswordResetEmail, sendWelcomeEmail, sendEmailVerificationOtp } = require('../services/emailService');
const User        = require('../models/User');
const auth        = require('../middleware/auth');
const dbCheck     = require('../middleware/dbCheck');
const { logAction } = require('../utils/logger');
const rateLimit   = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// ─── Constants ────────────────────────────────────────────────────────────────
const JWT_SECRET         = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
const CLIENT_URL         = process.env.CLIENT_URL || 'http://localhost:3000';

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skip: (req) => {
    const ip = req.ip || req.connection?.remoteAddress;
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  },
  handler: (req, res) => {
    res.status(429).json({ message: 'Too many attempts from this IP, please try again after 15 minutes' });
  }
});

// ─── Token Helpers ────────────────────────────────────────────────────────────

/** Short-lived access token — stored in memory (React state), never localStorage */
const makeAccessToken = (user) => jwt.sign(
  { id: user._id, version: user.tokenVersion, role: user.role },
  JWT_SECRET,
  { expiresIn: '15m' }
);

/** Long-lived refresh token — stored in httpOnly cookie only */
const makeRefreshToken = (user) => jwt.sign(
  { id: user._id, version: user.tokenVersion, type: 'refresh' },
  JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);

/** Removed cookie helpers as we are using session/local storage now */

/** Public user object — never expose password/reset tokens/refresh hashes */
const safeUser = (u) => ({
  id:          u._id,
  _id:         u._id,
  name:        u.name,
  email:       u.email || null,
  role:        u.role,
  permissions: u.permissions || [],
  phone:       u.phone || '',
  avatar:      u.avatar || null,
  addresses:   u.addresses || [],
  wishlist:    u.wishlist   || [],
  language:    u.language   || 'en',
  isBlocked:   u.isBlocked  || false,
  referralCode:u.referralCode|| null,
});

/* ── Device fingerprint helper ──────────────────────────────────────────────── */
const makeFingerprint = (req) => {
  const ip  = req.ip || req.connection?.remoteAddress || 'unknown';
  const ua  = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256').update(`${ip}::${ua}`).digest('hex');
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  REGISTER                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/register', authLimiter, dbCheck, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, email, password, referralCode } = req.body;
    if (await User.findOne({ email }))
      return res.status(400).json({ message: 'User already exists' });

    // Generate a unique referral code for the new user
    const crypto = require('crypto');
    let newReferralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    while (await User.findOne({ referralCode: newReferralCode })) {
      newReferralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    }

    const user = new User({ name, email, password, referralCode: newReferralCode });
    
    // Handle Referral Code (Link to referrer, no instant bonus)
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) {
        user.referredBy = referrer._id;
      }
    }

    await user.save();

    // Welcome email (non-fatal)
    sendWelcomeEmail({ to: user.email, userName: user.name }).catch(err => {
      console.error('Welcome email error (non-fatal):', err.message);
    });

    // Link previous guest orders to this new account
    try {
      const Order = require('../models/Order');
      await Order.updateMany(
        { guestEmail: user.email, user: null },
        { $set: { user: user._id, guestEmail: null } }
      );
    } catch (err) {
      console.error('Error linking guest orders:', err);
    }

    const accessToken  = makeAccessToken(user);
    const refreshToken = makeRefreshToken(user);

    // Store hashed refresh token in DB for rotation tracking
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    let activeTokens = (user.refreshTokens || []).filter(t => t.expiresAt > Date.now());
    activeTokens.push({
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: (req.headers['user-agent'] || '').substring(0, 100),
    });
    user.refreshTokens = activeTokens;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({ token: accessToken, refreshToken, user: safeUser(user) });
  } catch (error) {
    if (error.name === 'ValidationError')
      return res.status(400).json({ message: Object.values(error.errors).map(e => e.message).join(', ') });
    if (error.code === 11000)
      return res.status(400).json({ message: 'Email already registered' });
    res.status(500).json({ message: error.message || 'Registration failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  LOGIN                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/login', authLimiter, dbCheck, [
  body('emailOrPhone').notEmpty().withMessage('Email or Mobile Number is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { emailOrPhone, password } = req.body;
    const trimmedInput = (emailOrPhone || '').trim();
    
    // Check if input is email, phone, or username/staff handle
    const isEmail = trimmedInput.includes('@');
    const isDigitsOnly = /^\d+$/.test(trimmedInput);

    let query;
    if (isEmail) {
      query = { email: trimmedInput.toLowerCase() };
    } else if (isDigitsOnly && trimmedInput.length >= 10) {
      query = { phone: trimmedInput };
    } else {
      // Allow username, support handle or name (e.g. support1 -> matches support1@daatasa.com, support1@gmail.com, or name "support1")
      query = {
        $or: [
          { email: trimmedInput.toLowerCase() },
          { email: `${trimmedInput.toLowerCase()}@daatasa.com` },
          { email: `${trimmedInput.toLowerCase()}@gmail.com` },
          { name: new RegExp(`^${trimmedInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { phone: trimmedInput }
        ]
      };
    }

    const user = await User.findOne(query).select('+password +refreshTokens');
    if (!user) {
      // Generic message prevents user enumeration
      return res.status(401).json({ message: 'Invalid email/mobile or password' });
    }
    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google Sign-In. Please login with Google.' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email/mobile or password' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    }

    // For support staff: Enforce single active session by revoking previous tokens
    if (user.role === 'support') {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.refreshTokens = [];
    }

    const accessToken  = makeAccessToken(user);
    const refreshToken = makeRefreshToken(user);

    // Store hashed refresh token in DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    let activeTokens = (user.refreshTokens || []).filter(t => t.expiresAt > Date.now());
    // Limit to 5 active sessions for regular users, 1 for support
    if (user.role === 'support') {
      activeTokens = [];
    } else if (activeTokens.length >= 5) {
      activeTokens.shift();
    }
    activeTokens.push({
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: (req.headers['user-agent'] || '').substring(0, 100),
    });
    user.refreshTokens = activeTokens;
    await user.save({ validateBeforeSave: false });

    // Log LOGIN activity
    try {
      const geoip = require('geoip-lite');
      const UserActivity = require('../models/UserActivity');
      let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      if (ipAddress) ipAddress = ipAddress.split(',')[0].trim();
      if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1' || !ipAddress) ipAddress = '127.0.0.1';
      let location = 'Local/Unknown';
      if (ipAddress !== '127.0.0.1') {
        const geo = geoip.lookup(ipAddress);
        if (geo) location = `${geo.city || 'Unknown City'}, ${geo.country || 'Unknown Country'}`;
      }
      await UserActivity.create({
        user: user._id,
        action: 'LOGIN',
        ipAddress,
        location
      });
    } catch (err) { console.error('Error logging login activity:', err); }

    // Ensure user has a referral code (for older accounts)
    if (!user.referralCode) {
      const crypto = require('crypto');
      let newReferralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      while (await User.findOne({ referralCode: newReferralCode })) {
        newReferralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      }
      user.referralCode = newReferralCode;
      await user.save({ validateBeforeSave: false });
    }

    res.json({ token: accessToken, refreshToken, user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Login failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  LOGIN WITH OTP                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/login-otp', authLimiter, dbCheck, [
  body('phone').notEmpty().withMessage('Mobile Number is required'),
  body('otpCode').notEmpty().withMessage('OTP Code is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    let { phone, otpCode } = req.body;
    if (!phone.startsWith('+')) {
      phone = '+91' + phone;
    }

    const OTP = require('../models/OTP');
    const otpRecord = await OTP.findOne({ phone });
    
    if (!otpRecord) return res.status(400).json({ message: 'OTP expired or not found' });
    if (otpRecord.otpCode !== otpCode) return res.status(400).json({ message: 'Invalid OTP' });
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ phone });
      return res.status(400).json({ message: 'OTP has expired' });
    }
    
    // Valid OTP - clean it up
    await OTP.deleteOne({ phone });

    // Check if user exists by phone
    let user = await User.findOne({ phone }).select('+refreshTokens');
    
    if (!user) {
      // Create new user (Clean registration with email: null)
      const crypto = require('crypto');
      let newReferralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      
      user = new User({
        name: 'Customer',
        email: null,
        phone,
        referralCode: newReferralCode,
        password: crypto.randomBytes(8).toString('hex') // random unused password
      });
      await user.save();
    } else if (user.email && user.email.endsWith('@daatasa-guest.com')) {
      user.email = null;
      await user.save({ validateBeforeSave: false });
    }
    
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been suspended.' });
    }

    const accessToken  = makeAccessToken(user);
    const refreshToken = makeRefreshToken(user);

    // Store hashed refresh token in DB
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    let activeTokens = (user.refreshTokens || []).filter(t => t.expiresAt > Date.now());
    if (activeTokens.length >= 5) activeTokens.shift();
    activeTokens.push({
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: (req.headers['user-agent'] || '').substring(0, 100),
    });
    user.refreshTokens = activeTokens;
    await user.save({ validateBeforeSave: false });

    // Log LOGIN activity
    try {
      const geoip = require('geoip-lite');
      const UserActivity = require('../models/UserActivity');
      let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      if (ipAddress) ipAddress = ipAddress.split(',')[0].trim();
      if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1' || !ipAddress) ipAddress = '127.0.0.1';
      let location = 'Local/Unknown';
      if (ipAddress !== '127.0.0.1') {
        const geo = geoip.lookup(ipAddress);
        if (geo) location = `${geo.city || 'Unknown City'}, ${geo.country || 'Unknown Country'}`;
      }
      await UserActivity.create({ user: user._id, action: 'LOGIN_OTP', ipAddress, location });
    } catch (err) {}

    res.json({ token: accessToken, refreshToken, user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'OTP Login failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  REFRESH TOKEN  →  POST /api/auth/refresh                                  */
/*  Reads httpOnly cookie → verifies → issues new access + rotated refresh    */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/refresh', async (req, res) => {
  const incomingRefresh = req.body.refreshToken;
  if (!incomingRefresh) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(incomingRefresh, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid token type' });
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.isBlocked) return res.status(403).json({ message: 'Account suspended' });
    if (decoded.version !== user.tokenVersion) {
      return res.status(401).json({ message: 'Token revoked' });
    }

    // Verify token hash is in DB (rotation check)
    const incomingHash = crypto.createHash('sha256').update(incomingRefresh).digest('hex');
    user.refreshTokens = user.refreshTokens || [];
    const tokenIndex = user.refreshTokens.findIndex(t => t.tokenHash === incomingHash);
    if (tokenIndex === -1) {
      // Token not in DB — possible theft/reuse attack; invalidate ALL sessions
      user.refreshTokens = [];
      await user.save({ validateBeforeSave: false });
      return res.status(401).json({ message: 'Refresh token reuse detected. Please login again.' });
    }

    // Rotate: remove old, issue new
    const newRefreshToken = makeRefreshToken(user);
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    
    let activeTokens = (user.refreshTokens || []).filter(t => t.expiresAt > Date.now() && t.tokenHash !== incomingHash);
    activeTokens.push({
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: (req.headers['user-agent'] || '').substring(0, 100),
    });
    user.refreshTokens = activeTokens;
    await user.save({ validateBeforeSave: false });

    const accessToken = makeAccessToken(user);
    res.json({ token: accessToken, refreshToken: newRefreshToken, user: safeUser(user) });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired refresh token. Please login again.' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  LOGOUT                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/logout', async (req, res) => {
  try {
    const incomingRefresh = req.body.refreshToken;

    // If we have an auth header, use it to get user and increment tokenVersion
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('+refreshTokens');
        if (user) {
          // Remove this specific refresh token
          if (incomingRefresh) {
            const hash = crypto.createHash('sha256').update(incomingRefresh).digest('hex');
            user.refreshTokens = (user.refreshTokens || []).filter(t => t.tokenHash !== hash);
          }
          await user.save({ validateBeforeSave: false });

          // Log LOGOUT activity
          try {
            const geoip = require('geoip-lite');
            const UserActivity = require('../models/UserActivity');
            let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
            if (ipAddress) ipAddress = ipAddress.split(',')[0].trim();
            if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1' || !ipAddress) ipAddress = '127.0.0.1';
            let location = 'Local/Unknown';
            if (ipAddress !== '127.0.0.1') {
              const geo = geoip.lookup(ipAddress);
              if (geo) location = `${geo.city || 'Unknown City'}, ${geo.country || 'Unknown Country'}`;
            }
            await UserActivity.create({
              user: user._id,
              action: 'LOGOUT',
              ipAddress,
              location
            });
          } catch (err) {}
        }
      } catch { /* ignore invalid token on logout */ }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Logout failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  LOGOUT ALL DEVICES                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/logout-all', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { tokenVersion: 1 },
      $set: { refreshTokens: [] }
    });
    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    res.status(500).json({ message: 'Logout failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  GET CURRENT USER                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */
router.get('/me', auth, async (req, res) => {
  try {
    let user = req.user;
    let changed = false;
    if (!user.referralCode) {
      const crypto = require('crypto');
      let newReferralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      while (await User.findOne({ referralCode: newReferralCode })) {
        newReferralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      }
      user.referralCode = newReferralCode;
      changed = true;
    }
    if (user.email && user.email.endsWith('@daatasa-guest.com')) {
      user.email = null;
      changed = true;
    }
    if (changed) {
      await user.save({ validateBeforeSave: false });
    }
    res.json(safeUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  GET REFERRALS HISTORY                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */
router.get('/referrals', auth, async (req, res) => {
  try {
    const referrals = await User.find({ referredBy: req.user._id })
      .select('name createdAt referralRewardClaimed')
      .sort({ createdAt: -1 });

    const formattedReferrals = referrals.map(ref => ({
      _id: ref._id,
      name: ref.name,
      joinedAt: ref.createdAt,
      status: ref.referralRewardClaimed ? 'Completed' : 'Pending First Order'
    }));

    res.json(formattedReferrals);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch referrals' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  UPDATE PROFILE                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, avatar, language } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(avatar !== undefined && { avatar }),
        ...(language !== undefined && { language }),
      },
      { new: true, runValidators: true }
    );
    res.json(safeUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Update failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SEND EMAIL VERIFICATION OTP                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/profile/send-email-otp', auth, async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const existing = await User.findOne({ email: newEmail });
    if (existing) {
      return res.status(400).json({ message: 'Email is already registered to another account' });
    }

    const user = await User.findById(req.user._id);
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.pendingEmail = newEmail;
    user.emailUpdateOTP = otp;
    user.emailUpdateOTPExpire = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    await sendEmailVerificationOtp({ to: newEmail, userName: user.name, otp });

    res.json({ message: 'OTP sent to new email' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to send OTP' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  VERIFY EMAIL VERIFICATION OTP                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/profile/verify-email-otp', auth, async (req, res) => {
  try {
    const { otpCode } = req.body;
    if (!otpCode) return res.status(400).json({ message: 'OTP is required' });

    const user = await User.findById(req.user._id);

    if (!user.emailUpdateOTP || user.emailUpdateOTP !== otpCode) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (Date.now() > user.emailUpdateOTPExpire) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Verify successful
    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.emailUpdateOTP = undefined;
    user.emailUpdateOTPExpire = undefined;
    await user.save();

    res.json(safeUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to verify OTP' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  CHANGE PASSWORD                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/change-password', auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide both old and new passwords' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.password) return res.status(400).json({ message: 'Google Sign-In accounts cannot change password here' });

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect current password' });

    user.password = newPassword;
    // Invalidate sessions (optional for change password, but good practice)
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshTokens = [];
    
    await user.save();
    res.json({ message: 'Password updated successfully. Please log in again.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to update password' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  FORGOT PASSWORD  →  POST /api/auth/forgot-password                        */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/forgot-password', authLimiter, dbCheck, async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone)
      return res.status(400).json({ message: 'Please provide your email or mobile number' });

    const isEmail = emailOrPhone.includes('@');
    let query = isEmail ? { email: emailOrPhone } : { phone: emailOrPhone };
    if (!isEmail && !emailOrPhone.startsWith('+')) {
      query = { phone: '+91' + emailOrPhone };
    }

    const user = await User.findOne(query).select('+resetPasswordToken +resetPasswordExpire +resetPasswordFingerprint');

    if (!user)
      return res.status(404).json({ message: 'No account found with that email/mobile.' });

    const isResend = Boolean(req.body.isResend);
    if (!isResend && user.resetPasswordToken && user.resetPasswordExpire && user.resetPasswordExpire > Date.now()) {
      const remainingMs      = user.resetPasswordExpire - Date.now();
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      return res.status(409).json({
        message: 'A reset request was already sent and is still active.',
        remainingSeconds,
      });
    }

    // For email, use a long secure hex token. For SMS, use a 6-digit OTP.
    const resetToken        = isEmail ? crypto.randomBytes(32).toString('hex') : Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHashed       = crypto.createHash('sha256').update(resetToken).digest('hex');
    const deviceFingerprint = makeFingerprint(req);

    user.resetPasswordToken       = tokenHashed;
    user.resetPasswordExpire = Date.now() + 2 * 60 * 1000; // 2 minutes validity
    user.resetPasswordFingerprint = deviceFingerprint;
    await user.save({ validateBeforeSave: false });

    if (isEmail) {
      const resetUrl = `${CLIENT_URL}/reset-password/${resetToken}`;
      await sendPasswordResetEmail({
        to: user.email,
        userName: user.name,
        resetUrl,
      });
      res.json({ message: 'Reset link sent to your email.' });
    } else {
      const { sendSMS } = require('../services/smsService');
      const msg = `Your Daatasa password reset code is: ${resetToken}. It is valid for 2 minutes.`;
      await sendSMS(user.phone, msg);
      res.json({ message: 'Reset code sent to your mobile via SMS.', isOtp: true });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to process request. Please try again.' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  RESET PASSWORD  →  POST /api/auth/reset-password/:token                   */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/reset-password/:token', dbCheck, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const tokenHashed = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken:  tokenHashed,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpire +resetPasswordFingerprint +password');

    if (!user)
      return res.status(400).json({
        message: 'This reset link has expired or already been used. Please request a new one.',
      });

    const incomingFingerprint = makeFingerprint(req);
    if (user.resetPasswordFingerprint && user.resetPasswordFingerprint !== incomingFingerprint) {
      user.resetPasswordToken       = undefined;
      user.resetPasswordExpire      = undefined;
      user.resetPasswordFingerprint = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(403).json({
        message: 'This link can only be used on the device and browser where the reset was requested.',
      });
    }

    const bcrypt = require('bcryptjs');
    const isSamePassword = await bcrypt.compare(password, user.password);
    if (isSamePassword)
      return res.status(400).json({
        message: 'Your new password cannot be the same as your current password.',
      });

    user.password                 = password;
    user.resetPasswordToken       = undefined;
    user.resetPasswordExpire      = undefined;
    user.resetPasswordFingerprint = undefined;
    // Invalidate all sessions on password change
    user.tokenVersion             = (user.tokenVersion || 0) + 1;
    user.refreshTokens            = [];
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: error.message || 'Password reset failed' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ADDRESS ROUTES                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/addresses', auth, async (req, res) => {
  try {
    const { label, name, phone, street, city, district, state, zipCode, country, isDefault } = req.body;
    if (!name || !phone || !street || !city || !state || !zipCode)
      return res.status(400).json({ message: 'Please fill all required address fields' });

    const user = await User.findById(req.user._id);
    if (isDefault) user.addresses.forEach(a => { a.isDefault = false; });
    user.addresses.push({
      label: label || 'Home', name, phone, street, city,
      district: district || city, state, zipCode,
      country: country || 'India',
      isDefault: isDefault || user.addresses.length === 0,
    });
    await user.save();
    res.status(201).json({ addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to add address' });
  }
});

router.put('/addresses/:addrId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addrId);
    if (!addr) return res.status(404).json({ message: 'Address not found' });

    const fields = ['label','name','phone','street','city','district','state','zipCode','country','isDefault'];
    fields.forEach(f => { if (req.body[f] !== undefined) addr[f] = req.body[f]; });
    if (req.body.isDefault)
      user.addresses.forEach(a => { if (String(a._id) !== req.params.addrId) a.isDefault = false; });

    await user.save();
    res.json({ addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to update address' });
  }
});

router.delete('/addresses/:addrId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addrId);
    if (!addr) return res.status(404).json({ message: 'Address not found' });

    const wasDefault = addr.isDefault;
    addr.deleteOne();
    if (wasDefault && user.addresses.length > 0)
      user.addresses[user.addresses.length - 1].isDefault = true;

    await user.save();
    res.json({ addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to delete address' });
  }
});

router.patch('/addresses/:addrId/default', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses.forEach(a => { a.isDefault = String(a._id) === req.params.addrId; });
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to set default' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ADMIN: Users list                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */
router.get('/users', auth, auth.admin, auth.hasPermission('users'), async (req, res) => {
  try {
    const Order = require('../models/Order');
    const page  = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const skip  = (page - 1) * limit;

    const totalCount = await User.countDocuments();
    const users = await User.find()
      .select('-password -resetPasswordToken -resetPasswordExpire -resetPasswordFingerprint')
      .skip(skip).limit(limit).lean();

    const orders = await Order.aggregate([
      { $group: { _id: '$user', totalOrders: { $sum: 1 }, totalSpent: { $sum: '$totalPrice' } } }
    ]);

    const orderStatsMap = {};
    orders.forEach(stat => {
      if (stat._id) orderStatsMap[stat._id.toString()] = { totalOrders: stat.totalOrders, totalSpent: stat.totalSpent };
    });

    const enrichedUsers = users.map(u => ({
      ...u,
      totalOrders: orderStatsMap[u._id.toString()]?.totalOrders || 0,
      totalSpent:  orderStatsMap[u._id.toString()]?.totalSpent  || 0,
    }));

    if (req.query.page) {
      return res.json({ users: enrichedUsers, total: totalCount, page, pages: Math.ceil(totalCount / limit) });
    }
    res.json(enrichedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ADMIN: Block/unblock user                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
router.put('/users/:id/block', auth, auth.admin, auth.hasPermission('users'), async (req, res) => {
  try {
    const { reason } = req.body;
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    target.isBlocked = !target.isBlocked;
    // If blocking, also invalidate all their sessions
    if (target.isBlocked) {
      target.tokenVersion = (target.tokenVersion || 0) + 1;
      target.refreshTokens = [];
    }
    await target.save({ validateBeforeSave: false });

    await logAction(req, target.isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER', 'USER', target._id, {
      reason, userName: target.name, userEmail: target.email
    });

    try {
      const { sendBlockEmail } = require('../services/emailService');
      await sendBlockEmail({ to: target.email, userName: target.name, isBlocked: target.isBlocked, reason });
    } catch (e) { console.error('Block email error (non-fatal):', e); }

    res.json({
      message:   `User ${target.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      isBlocked: target.isBlocked,
      userId:    target._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ADMIN: Change user role                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
router.put('/users/:id/role', auth, auth.admin, auth.hasPermission('users'), async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['user', 'admin', 'superadmin', 'support', 'courier', 'b2b_customer'];
    
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    
    // Prevent non-superadmins from granting or removing superadmin role
    if (req.user.role !== 'superadmin' && (role === 'superadmin' || target.role === 'superadmin')) {
      return res.status(403).json({ message: 'Only superadmins can manage superadmin roles' });
    }

    target.role = role;
    await target.save({ validateBeforeSave: false });

    await logAction(req, 'UPDATE_USER_ROLE', 'USER', target._id, {
      newRole: role, userName: target.name, userEmail: target.email
    });

    res.json({
      message: 'User role updated successfully',
      role: target.role,
      userId: target._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ADMIN: Update B2B Details                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
router.put('/users/:id/b2b', auth, auth.admin, auth.hasPermission('users'), async (req, res) => {
  try {
    const { b2bDiscountPercentage, companyName, gstin } = req.body;
    const target = await User.findById(req.params.id);
    
    if (!target) return res.status(404).json({ message: 'User not found' });
    
    if (b2bDiscountPercentage !== undefined) target.b2bDiscountPercentage = b2bDiscountPercentage;
    if (companyName !== undefined) target.companyName = companyName;
    if (gstin !== undefined) target.gstin = gstin;

    await target.save({ validateBeforeSave: false });

    res.json({
      message: 'B2B details updated successfully',
      user: {
        _id: target._id,
        b2bDiscountPercentage: target.b2bDiscountPercentage,
        companyName: target.companyName,
        gstin: target.gstin
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  WISHLIST                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */
router.get('/wishlist', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'wishlist',
      select: 'name price mrp image images category stock weight rating numReviews variants isActive launchDate'
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const products = (user.wishlist || []).filter(p => p && p._id && p.isActive !== false);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/wishlist', auth, async (req, res) => {
  try {
    const { productId } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.wishlist) user.wishlist = [];
    const index = user.wishlist.findIndex(id => id.toString() === productId);
    let added = false;

    if (index > -1) {
      user.wishlist.splice(index, 1);
    } else {
      user.wishlist.push(productId);
      added = true;
    }

    await user.save();
    res.json({ wishlist: user.wishlist, added });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
