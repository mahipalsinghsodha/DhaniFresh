const express = require('express');
const { sendContactEmail, createB2BInquiry, getB2BInquiries, updateB2BStatus } = require('../controllers/contactController');
const auth = require('../middleware/auth');

const rateLimit = require('express-rate-limit');

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 contact form submissions per IP per hour
  message: 'Too many messages sent. Please try again after an hour.'
});

// POST /api/contact
router.post('/', contactLimiter, sendContactEmail);

// POST /api/contact/b2b
router.post('/b2b', contactLimiter, createB2BInquiry);

// GET /api/contact/b2b (Admin only)
router.get('/b2b', auth, auth.admin, getB2BInquiries);

// PUT /api/contact/b2b/:id/status (Admin only)
router.put('/b2b/:id/status', auth, auth.admin, updateB2BStatus);

module.exports = router;
