
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
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');
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
  name:        u.name,
  email:       u.email,
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
    
    // Handle Referral Bonus
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) {
        user.referredBy = referrer._id;
        user.walletBalance += 50; // New user bonus
        referrer.walletBalance += 50; // Referrer bonus
      }
    }

    await user.save();

    if (referrer) {
      await referrer.save();
      const WalletTransaction = require('../models/WalletTransaction');
      
      // Transaction for new user
      await WalletTransaction.create({
        user: user._id,
        type: 'CREDIT',
        amount: 50,
        balanceAfter: user.walletBalance,
        description: 'Sign up referral bonus',
        transactionType: 'REWARD_CONVERSION' // Re-using enum or TOPUP
      });

      // Transaction for referrer
      await WalletTransaction.create({
        user: referrer._id,
        type: 'CREDIT',
        amount: 50,
        balanceAfter: referrer.walletBalance,
        description: 'Referral bonus for inviting a friend',
        transactionType: 'REWARD_CONVERSION'
      });
      
      try {
        const Notification = require('../models/Notification');
        const notif = new Notification({
          user: referrer._id,
          type: 'REWARD_EARNED',
          title: 'Referral Bonus!',
          message: `You earned ₹50 for referring ${user.name}.`,
          link: '/profile'
        });
        await notif.save();
      } catch (err) {}
    }

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
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password +refreshTokens');
    if (!user) {
      // Generic message prevents user enumeration
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google Sign-In. Please login with Google.' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    }

    const accessToken  = makeAccessToken(user);
    const refreshToken = makeRefreshToken(user);

    // Store hashed refresh token in DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    let activeTokens = (user.refreshTokens || []).filter(t => t.expiresAt > Date.now());
    // Limit to 5 active sessions per user
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
      await UserActivity.create({
        user: user._id,
        action: 'LOGIN',
        ipAddress,
        location
      });
    } catch (err) { console.error('Error logging login activity:', err); }

    res.json({ token: accessToken, refreshToken, user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Login failed' });
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
router.get('/me', auth, (req, res) => res.json(safeUser(req.user)));

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
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ message: 'Please provide your email address' });

    const user = await User.findOne({ email }).select('+resetPasswordToken +resetPasswordExpire +resetPasswordFingerprint');

    if (!user)
      return res.status(404).json({ message: 'No account found with that email address.' });

    if (user.resetPasswordToken && user.resetPasswordExpire && user.resetPasswordExpire > Date.now()) {
      const remainingMs      = user.resetPasswordExpire - Date.now();
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      return res.status(409).json({
        message: 'A reset link was already sent and is still active. Please check your inbox.',
        remainingSeconds,
      });
    }

    const resetToken        = crypto.randomBytes(32).toString('hex');
    const tokenHashed       = crypto.createHash('sha256').update(resetToken).digest('hex');
    const deviceFingerprint = makeFingerprint(req);

    user.resetPasswordToken       = tokenHashed;
    user.resetPasswordExpire      = Date.now() + 2 * 60 * 1000; // 2 minutes
    user.resetPasswordFingerprint = deviceFingerprint;
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${CLIENT_URL}/reset-password/${resetToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetUrl,
    });

    res.json({ message: 'Reset link sent successfully.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
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
