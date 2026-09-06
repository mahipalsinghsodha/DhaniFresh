// routes/notificationRoutes.js
const express      = require('express');
const router       = express.Router();
const Notification = require('../models/Notification');
const auth         = require('../middleware/auth');

/* GET /api/notifications — Get user notifications (paginated, unread only, max 3 days old) */
router.get('/', auth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    // Purge any read notifications in the background
    Notification.deleteMany({ user: req.user._id, isRead: true }).catch(() => {});

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const query = { user: req.user._id, isRead: false, createdAt: { $gte: threeDaysAgo } };

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
    ]);

    res.json({ notifications, total, unreadCount: total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* PATCH /api/notifications/:id/read — Mark single as read and remove immediately */
router.patch('/:id/read', auth, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Notification read and removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* PATCH /api/notifications/read-all — Mark all as read and remove all notifications */
router.patch('/read-all', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* DELETE /api/notifications/:id — Delete single notification */
router.delete('/:id', auth, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
