// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const auth = require('../middleware/auth');

/* ─────────────────────────────────────────────────────────────────────────── */
/*  GET /api/chat/sessions — Support/Admin: get all sessions (paginated)       */
/* ─────────────────────────────────────────────────────────────────────────── */
router.get('/sessions', auth, auth.support, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (status) query.status = status;

    const [sessions, total] = await Promise.all([
      ChatSession.find(query)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'name email avatar')
        .populate('agentId', 'name email avatar')
        .populate({
          path: 'orderId',
          select: 'orderIdString totalPrice orderStatus paymentStatus shippingAddress invoiceNumber trackingNumber orderItems itemsPrice taxPrice shippingPrice paymentMethod',
          populate: {
            path: 'orderItems.product',
            select: 'name image price'
          }
        })
        .lean(),
      ChatSession.countDocuments(query),
    ]);

    // Attach last message to each session
    const sessionIds = sessions.map(s => s.sessionId);
    const lastMessages = await ChatMessage.find({ sessionId: { $in: sessionIds } })
      .sort({ createdAt: -1 })
      .lean();

    const lastMsgMap = {};
    lastMessages.forEach(msg => {
      if (!lastMsgMap[msg.sessionId]) lastMsgMap[msg.sessionId] = msg;
    });

    const enriched = sessions.map(s => ({
      ...s,
      lastMessage: lastMsgMap[s.sessionId] || null,
    }));

    res.json({ sessions: enriched, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  GET /api/chat/sessions/:sessionId/messages — Full message history         */
/* ─────────────────────────────────────────────────────────────────────────── */
router.get('/sessions/:sessionId/messages', auth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ message: 'Chat session not found' });

    // Allow: admin, superadmin, support OR the session owner
    const isStaff = ['admin', 'superadmin', 'support'].includes(req.user.role) || 
                    (Array.isArray(req.user.permissions) && (req.user.permissions.includes('support') || req.user.permissions.includes('all')));
    const isOwner = session.userId && String(session.userId) === String(req.user._id);
    
    if (!isStaff && !isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await ChatMessage.find({ sessionId: req.params.sessionId })
      .sort({ createdAt: 1 })
      .lean();

    // Mark user messages as read if staff is viewing
    if (isStaff) {
      await ChatMessage.updateMany(
        { sessionId: req.params.sessionId, senderType: 'USER', isRead: false },
        { isRead: true }
      );
    }

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  POST /api/chat/sessions/:sessionId/rate — User submits rating             */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/sessions/:sessionId/rate', async (req, res) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ message: 'Rating score must be 1-5' });
    }

    const session = await ChatSession.findOneAndUpdate(
      { sessionId: req.params.sessionId, status: 'CLOSED' },
      {
        'rating.score': parseInt(score),
        'rating.comment': comment?.trim(),
        'rating.submittedAt': new Date(),
      },
      { new: true }
    );

    if (!session) return res.status(404).json({ message: 'Session not found or not closed yet' });
    res.json({ message: 'Thank you for your feedback!', rating: session.rating });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  GET /api/chat/queue-count — Support/Admin: waiting sessions count         */
/* ─────────────────────────────────────────────────────────────────────────── */
router.get('/queue-count', auth, auth.support, async (req, res) => {
  try {
    const count = await ChatSession.countDocuments({ status: 'WAITING' });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
