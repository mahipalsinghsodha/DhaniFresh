const User    = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const Coupon  = require('../models/Coupon');
const { logAction } = require('../utils/logger');
const { getCache, setCache, invalidateAnalytics } = require('../utils/cache');
const bcrypt  = require('bcryptjs');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');

exports.getActivityLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('adminId', 'name email')
      .sort({ createdAt: -1 })
      .limit(500);
    res.json(logs);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ['admin','superadmin'] } }).select('-password');
    res.json(admins);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

const ChatSession = require('../models/ChatSession');
const { getOnlineAgents } = require('../socket/supportQueueManager');

exports.getSupportAgents = async (req, res) => {
  try {
    const agents = await User.find({
      $or: [
        { role: 'support' },
        { permissions: 'support' }
      ]
    }).select('-password').lean();

    const onlineList = getOnlineAgents();
    const onlineMap = new Map(onlineList.map(a => [a._id.toString(), a]));
    const todayStr = new Date().toISOString().slice(0, 10);

    const enrichedAgents = await Promise.all(
      agents.map(async (agent) => {
        const [activeChats, ratedSessions] = await Promise.all([
          ChatSession.countDocuments({
            agentId: agent._id,
            status: 'ACTIVE',
          }),
          ChatSession.find({
            agentId: agent._id,
            'rating.score': { $exists: true, $ne: null },
          }).select('rating sessionId guestName createdAt').populate('userId', 'name').lean(),
        ]);

        const onlineInfo = onlineMap.get(agent._id.toString());
        const isOnline = !!onlineInfo;
        const currentSessionSec = onlineInfo?.currentSessionSec || 0;

        const stats = agent.supportStats || {
          dispatchedCount: 0,
          acceptedCount: 0,
          rejectedCount: 0,
          missedCount: 0,
          resolvedCount: 0,
          totalWorkSeconds: 0,
          isLive: true,
          dailyStats: { date: todayStr, accepted: 0, rejected: 0, missed: 0, workSeconds: 0 },
        };

        const totalAttempts = (stats.acceptedCount || 0) + (stats.rejectedCount || 0) + (stats.missedCount || 0);
        const acceptanceRate = stats.dispatchedCount > 0
          ? Math.round(((stats.acceptedCount || 0) / stats.dispatchedCount) * 100)
          : (totalAttempts > 0 ? Math.round(((stats.acceptedCount || 0) / totalAttempts) * 100) : 100);

        // Calculate Online Work Time
        let todayWorkSeconds = (stats.dailyStats?.date === todayStr ? (stats.dailyStats.workSeconds || 0) : 0);
        if (isOnline && onlineInfo?.isLive) {
          todayWorkSeconds += currentSessionSec;
        }

        let totalWorkSeconds = (stats.totalWorkSeconds || 0);
        if (isOnline && onlineInfo?.isLive) {
          totalWorkSeconds += currentSessionSec;
        }

        // Calculate Rating & Reviews
        let avgRating = 5;
        let ratingCount = ratedSessions.length;
        if (ratingCount > 0) {
          const sum = ratedSessions.reduce((acc, s) => acc + (s.rating?.score || 5), 0);
          avgRating = parseFloat((sum / ratingCount).toFixed(1));
        }

        const recentReviews = ratedSessions.slice(0, 10).map(s => ({
          sessionId: s.sessionId,
          customerName: s.userId?.name || s.guestName || 'Customer',
          score: s.rating?.score || 5,
          comment: s.rating?.comment || '',
          submittedAt: s.rating?.submittedAt || s.createdAt,
        }));

        return {
          ...agent,
          activeChats,
          isOnline,
          isLive: onlineInfo ? (onlineInfo.isLive !== false) : (stats.isLive !== false),
          acceptanceRate,
          todayWorkSeconds,
          totalWorkSeconds,
          loginTime: onlineInfo?.loginTime || onlineInfo?.readyStartedAt || onlineInfo?.connectedAt || agent.lastLogin || agent.supportStats?.lastActiveAt || agent.updatedAt,
          lastLogin: agent.lastLogin || agent.supportStats?.lastActiveAt || null,
          avgRating,
          ratingCount,
          recentReviews,
        };
      })
    );

    res.json(enrichedAgents);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getAgentRejectionHistory = async (req, res) => {
  try {
    const { agentId } = req.params;
    const sessions = await ChatSession.find({
      $or: [
        { 'routingAttempts.agentId': agentId },
        { agentId: agentId },
      ]
    })
      .select('sessionId guestName guestEmail category routingAttempts rating status createdAt updatedAt')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const history = [];
    sessions.forEach(s => {
      const attempts = (s.routingAttempts || []).filter(a => a.agentId?.toString() === agentId.toString());
      if (attempts.length > 0) {
        attempts.forEach(att => {
          history.push({
            sessionId: s.sessionId,
            customerName: s.userId?.name || s.guestName || 'Customer',
            customerEmail: s.userId?.email || s.guestEmail || '',
            category: s.category,
            sessionStatus: s.status,
            action: att.action,
            dispatchedAt: att.dispatchedAt,
            respondedAt: att.respondedAt,
            rating: s.rating,
          });
        });
      } else if (s.agentId?.toString() === agentId.toString()) {
        history.push({
          sessionId: s.sessionId,
          customerName: s.userId?.name || s.guestName || 'Customer',
          customerEmail: s.userId?.email || s.guestEmail || '',
          category: s.category,
          sessionStatus: s.status,
          action: 'ACCEPTED',
          dispatchedAt: s.createdAt,
          respondedAt: s.createdAt,
          rating: s.rating,
        });
      }
    });

    history.sort((a, b) => new Date(b.dispatchedAt) - new Date(a.dispatchedAt));
    res.json(history);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.resetSupportAgentStats = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.supportStats = {
      dispatchedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      missedCount: 0,
      resolvedCount: 0,
      isLive: true,
      lastActiveAt: new Date(),
    };

    await user.save();
    await logAction(req, 'RESET_SUPPORT_STATS', 'USER', user._id, { name: user.name });
    res.json({ message: 'Support stats reset successfully', supportStats: user.supportStats });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, permissions, role } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'User already exists' });
    
    // Assign role based on request, default to 'admin'
    const validRoles = ['admin', 'support', 'superadmin'];
    const assignedRole = validRoles.includes(role) ? role : 'admin';
    
    const newAdmin = new User({ name, email, password, role: assignedRole, permissions: permissions || [] });
    await newAdmin.save();
    await logAction(req, 'CREATE_ADMIN', 'USER', newAdmin._id, { name: newAdmin.name, role: assignedRole });
    const obj = newAdmin.toObject(); delete obj.password; res.status(201).json(obj);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.createSupportAgent = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'User already exists' });
    
    const newAgent = new User({ name, email, password, phone, role: 'support' });
    await newAgent.save();
    await logAction(req, 'CREATE_SUPPORT_AGENT', 'USER', newAgent._id, { name: newAgent.name });
    const obj = newAgent.toObject(); delete obj.password; res.status(201).json(obj);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.updateAdminPermissions = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Admin not found' });
    const { permissions, role } = req.body;
    if (permissions !== undefined) target.permissions = permissions;
    if (role !== undefined) target.role = role;
    await target.save();
    await logAction(req, 'UPDATE_ADMIN_ACCESS', 'USER', target._id, { role: target.role });
    res.json({ message: 'Updated', user: { id: target._id, name: target.name, role: target.role, permissions: target.permissions } });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Admin not found' });
    if (target.role === 'superadmin') return res.status(403).json({ message: 'Cannot delete a Super Admin' });
    await target.deleteOne();
    await logAction(req, 'DELETE_ADMIN', 'USER', req.params.id, { name: target.name });
    res.json({ message: 'Admin removed' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getReturnRequests = async (req, res) => {
  try {
    const orders = await Order.find({ 'returnRequest.status': { $exists: true } })
      .populate('user', 'name email')
      .populate('orderItems.product')
      .sort({ 'returnRequest.requestedAt': -1 });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.approveReturnRequest = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.returnRequest || order.returnRequest.status !== 'PENDING') {
      return res.status(400).json({ message: 'No pending return request for this order' });
    }

    const { status } = req.body; // 'APPROVED' or 'REJECTED'
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    order.returnRequest.status = status;

    if (status === 'APPROVED') {
      // Atomically restore all resources (variant stock, wallet refund, gift card, coupon count, net Razorpay refund)
      const { restoreOrderResources } = require('../utils/orderResourceHelper');
      const restoreResult = await restoreOrderResources(order, 'Return approved by admin');

      order.paymentStatus = 'REFUNDED';
      order.orderStatus = 'RETURNED';
      order.returnRequest.resolvedAt = new Date();
      order.returnRequest.adminNote = req.body.adminNote || 'Return approved by admin';
      if (restoreResult.razorpayRefund) {
        order.refundInfo = restoreResult.razorpayRefund;
      } else if (restoreResult.walletRefunded > 0) {
        order.refundInfo = {
          status: 'PROCESSED',
          amount: restoreResult.walletRefunded,
          initiatedAt: new Date(),
          note: 'Refunded to Daatasa Wallet'
        };
      }

      order.statusHistory.push({
        status: 'RETURN_APPROVED',
        note: 'Return approved by admin',
        updatedBy: req.user._id,
        updatedAt: new Date()
      });

      // Notify User
      if (order.user) {
        const notif = new Notification({
          user: order.user,
          type: 'RETURN_APPROVED',
          title: 'Return Approved',
          message: `Your return request for order #${order._id.toString().slice(-8).toUpperCase()} has been approved.`,
          link: `/orders/${order._id}`
        });
        await notif.save();
        try {
          const io = getIO();
          io.to(`user:${order.user}`).emit('notification', notif);
          io.to(`order:${order._id}`).emit('orderStatusUpdated', order);
        } catch (err) {}
      }
    } else {
      // REJECTED
      order.statusHistory.push({
        status: 'RETURN_REJECTED',
        note: 'Return rejected by admin',
        updatedBy: req.user._id,
        updatedAt: new Date()
      });
      if (order.user) {
        const notif = new Notification({
          user: order.user,
          type: 'SYSTEM',
          title: 'Return Rejected',
          message: `Your return request for order #${order._id.toString().slice(-8).toUpperCase()} has been rejected.`,
          link: `/orders/${order._id}`
        });
        await notif.save();
        try {
          const io = getIO();
          io.to(`user:${order.user}`).emit('notification', notif);
          io.to(`order:${order._id}`).emit('orderStatusUpdated', order);
        } catch (err) {}
      }
    }

    await order.save();
    await logAction(req, `RETURN_${status}`, 'ORDER', order._id, { status });

    await order.populate('user', 'name email');
    await order.populate('orderItems.product');

    res.json({ message: `Return request ${status.toLowerCase()}`, order });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/**
 * ════════════════════════════════════════════════════════════
 *  GET ANALYTICS — Redis-cached, MongoDB aggregation pipelines
 *  Cache TTL: 5 min. Auto-invalidated on order changes.
 * ════════════════════════════════════════════════════════════
 */
exports.getAnalytics = async (req, res) => {
  try {
    const { days, page = 1, limit = 10, statusFilter = 'all', force } = req.query;
    let daysNum = parseInt(days);
    if (isNaN(daysNum)) daysNum = 30;

    const cacheKey = `analytics:v3:d${daysNum}:p${page}:l${limit}:s${statusFilter}`;
    if (force !== '1') {
      const cached = await getCache(cacheKey);
      if (cached) return res.json({ ...cached, fromCache: true });
    }

    const now    = new Date();
    const todayS = new Date(now); todayS.setHours(0,0,0,0);
    const todayE = new Date(now); todayE.setHours(23,59,59,999);

    // Current period start
    let startDate = new Date(0); // epoch = all time
    if (daysNum !== -1) {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - (daysNum === 0 ? 0 : daysNum - 1));
      startDate.setHours(0,0,0,0);
    }

    // Previous period (same length, before current start)
    let prevStart = new Date(0);
    let prevEnd   = new Date(startDate);
    if (daysNum > 0) {
      prevStart = new Date(startDate);
      prevStart.setDate(prevStart.getDate() - daysNum);
    }

    // ── Cancelled/Failed statuses
    const VOID_STATUSES = ['CANCELLED', 'FAILED'];

    // ── Active-order match (non-void)
    const activeMatch = { paymentStatus: { $nin: VOID_STATUSES } };

    // Period date filters
    const df    = { createdAt: { $gte: startDate, $lte: now    } };
    const prevDf= { createdAt: { $gte: prevStart,  $lt: startDate } };
    const tdf   = { createdAt: { $gte: todayS,    $lte: todayE  } };

    // ── Safe $cond helper: isActive = paymentStatus NOT in VOID_STATUSES
    // Using $or with $ne for each void status — avoids $in inside $cond
    const isActiveCond = {
      $and: [
        { $ne: ['$paymentStatus', 'CANCELLED'] },
        { $ne: ['$paymentStatus', 'FAILED']    },
      ]
    };

    // ── Run all aggregations in parallel ──────────────────────────────────
    const [
      kpiAgg, prevKpiAgg, todayAgg,
      totalProducts, totalUsers, activeCoupons,
      trendAgg, hourlyAgg, dowAgg,
      topProductsAgg, categoryAgg, couponAgg,
      weeklyAgg, customerGrowthAgg,
      lowStock,
    ] = await Promise.all([

      /* 1. KPI — current period */
      Order.aggregate([
        { $match: df },
        { $group: {
          _id: null,
          totalOrders:     { $sum: 1 },
          activeOrders:    { $sum: { $cond: [isActiveCond, 1, 0] } },
          totalRevenue:    { $sum: { $cond: [isActiveCond, '$totalPrice', 0] } },
          deliveredOrders: { $sum: { $cond: ['$isDelivered', 1, 0] } },
          paidOrders:      { $sum: { $cond: [{ $and: ['$isPaid', { $eq: ['$isDelivered', false] }] }, 1, 0] } },
          codConfirmed:    { $sum: { $cond: [{ $eq: ['$paymentStatus', 'COD_CONFIRMED'] }, 1, 0] } },
          pendingOrders: {
            $sum: {
              $cond: [
                { $and: [isActiveCond, { $eq: ['$isDelivered', false] }] },
                1, 0
              ]
            }
          },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'CANCELLED'] }, 1, 0] } },
          codCount:        { $sum: { $cond: [{ $eq: ['$paymentMethod', 'COD'] }, 1, 0] } },
          onlineCount:     { $sum: { $cond: [{ $eq: ['$paymentMethod', 'Online'] }, 1, 0] } },
          totalDiscount:   { $sum: { $cond: [isActiveCond, { $ifNull: ['$discount', 0] }, 0] } },
        }}
      ]),

      /* 2. KPI — previous period */
      Order.aggregate([
        { $match: prevDf },
        { $group: {
          _id: null,
          totalRevenue: { $sum: { $cond: [isActiveCond, '$totalPrice', 0] } },
          totalOrders:  { $sum: 1 },
        }}
      ]),

      /* 3. Today snapshot */
      Order.aggregate([
        { $match: { ...tdf, ...activeMatch } },
        { $group: { _id: null, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } }
      ]),

      /* 4 & 5. Counts */
      Product.countDocuments(),
      User.countDocuments({ role: 'user' }),

      /* 6. Active coupons */
      Coupon.countDocuments({ isActive: true, validUntil: { $gte: now } }).catch(() => 0),

      /* 7. Revenue trend (daily) */
      Order.aggregate([
        { $match: { ...df, ...activeMatch } },
        { $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, d: { $dayOfMonth: '$createdAt' } },
          revenue:  { $sum: '$totalPrice' },
          orders:   { $sum: 1 },
          avgOrder: { $avg: '$totalPrice' },
        }},
        { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } }
      ]),

      /* 8. Hourly distribution */
      Order.aggregate([
        { $match: df },
        { $group: {
          _id: { $mod: [{ $add: [{ $hour: '$createdAt' }, 5] }, 24] }, // rough IST
          orders:  { $sum: 1 },
          revenue: { $sum: { $cond: [isActiveCond, '$totalPrice', 0] } },
        }},
        { $sort: { _id: 1 } }
      ]),

      /* 9. Day-of-week revenue */
      Order.aggregate([
        { $match: { ...df, ...activeMatch } },
        { $group: {
          _id:     { $dayOfWeek: '$createdAt' },
          revenue: { $sum: '$totalPrice' },
          orders:  { $sum: 1 },
        }},
        { $sort: { _id: 1 } }
      ]),

      /* 10. Top products by revenue */
      Order.aggregate([
        { $match: { ...df, ...activeMatch } },
        { $unwind: '$orderItems' },
        { $group: {
          _id:     '$orderItems.name',
          qty:     { $sum: '$orderItems.quantity' },
          revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
          orders:  { $addToSet: '$_id' },
        }},
        { $project: { _id: 0, name: '$_id', qty: 1, revenue: { $round: ['$revenue', 0] }, orders: { $size: '$orders' } } },
        { $sort: { revenue: -1 } },
        { $limit: 8 }
      ]),

      /* 11. Revenue by category — lookup product category */
      Order.aggregate([
        { $match: { ...df, ...activeMatch } },
        { $unwind: '$orderItems' },
        { $lookup: {
          from: 'products',
          localField: 'orderItems.product',
          foreignField: '_id',
          as: 'prod'
        }},
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id:     { $ifNull: ['$prod.category', 'Uncategorized'] },
          revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
          qty:     { $sum: '$orderItems.quantity' },
        }},
        { $project: { _id: 0, name: '$_id', revenue: { $round: ['$revenue', 0] }, qty: 1 } },
        { $sort: { revenue: -1 } },
        { $limit: 6 }
      ]),

      /* 12. Coupon usage stats */
      Order.aggregate([
        { $match: { ...df, coupon: { $exists: true, $ne: null } } },
        { $group: {
          _id:      '$coupon.code',
          used:     { $sum: 1 },
          discount: { $sum: { $ifNull: ['$discount', 0] } },
          revenue:  { $sum: { $cond: [isActiveCond, '$totalPrice', 0] } },
        }},
        { $match: { _id: { $ne: null } } },
        { $project: { _id: 0, code: '$_id', used: 1, discount: { $round: ['$discount', 0] }, revenue: { $round: ['$revenue', 0] } } },
        { $sort: { used: -1 } },
        { $limit: 6 }
      ]),

      /* 13. Weekly orders (always last 7 days) */
      (() => {
        const w7 = new Date(now); w7.setDate(now.getDate() - 6); w7.setHours(0,0,0,0);
        return Order.aggregate([
          { $match: { createdAt: { $gte: w7, $lte: now } } },
          { $group: {
            _id:     { $dayOfWeek: '$createdAt' },
            orders:  { $sum: 1 },
            revenue: { $sum: { $cond: [isActiveCond, '$totalPrice', 0] } },
          }}
        ]);
      })(),

      /* 14. Customer growth */
      User.aggregate([
        { $match: { role: 'user', createdAt: { $gte: startDate, $lte: now } } },
        { $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, d: { $dayOfMonth: '$createdAt' } },
          newUsers: { $sum: 1 }
        }},
        { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } }
      ]),

      /* 15. Low stock */
      Product.find({ stock: { $lte: 10 }, isActive: { $ne: false } })
        .select('name stock price image category')
        .sort({ stock: 1 })
        .limit(8)
        .lean(),
    ]);

    // ── Process KPI ───────────────────────────────────────────────────────
    const k      = kpiAgg[0]     || {};
    const kPrev  = prevKpiAgg[0] || {};
    const todayD = todayAgg[0]   || { revenue: 0, count: 0 };
    const avgOV  = k.activeOrders ? (k.totalRevenue / k.activeOrders) : 0;

    const delta = (curr, prev) => (prev && prev > 0) ? Math.round(((curr - prev) / prev) * 100) : null;

    const kpi = {
      totalRevenue:    Math.round(k.totalRevenue    || 0),
      totalOrders:     k.totalOrders    || 0,
      activeOrders:    k.activeOrders   || 0,
      pendingOrders:   k.pendingOrders  || 0,
      deliveredOrders: k.deliveredOrders|| 0,
      cancelledOrders: k.cancelledOrders|| 0,
      avgOrderValue:   Math.round(avgOV),
      totalDiscount:   Math.round(k.totalDiscount || 0),
      todayRevenue:    Math.round(todayD.revenue || 0),
      todayOrders:     todayD.count || 0,
      totalProducts,
      totalUsers,
      activeCoupons:   activeCoupons || 0,
      revenueDelta:    delta(k.totalRevenue || 0, kPrev.totalRevenue || 0),
      ordersDelta:     delta(k.totalOrders  || 0, kPrev.totalOrders  || 0),
    };

    // ── Revenue Trend ─────────────────────────────────────────────────────
    const trendDays = daysNum === -1 ? 30 : (daysNum === 0 ? 1 : Math.min(daysNum, 90));
    const trendMap  = {};
    trendAgg.forEach(t => {
      const key = `${t._id.y}-${String(t._id.m).padStart(2,'0')}-${String(t._id.d).padStart(2,'0')}`;
      trendMap[key] = { revenue: Math.round(t.revenue), orders: t.orders, avgOrder: Math.round(t.avgOrder || 0) };
    });
    const revenueTrend = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      revenueTrend.push({
        date:     d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        revenue:  trendMap[key]?.revenue  || 0,
        orders:   trendMap[key]?.orders   || 0,
        avgOrder: trendMap[key]?.avgOrder || 0,
      });
    }

    // ── Hourly Distribution ───────────────────────────────────────────────
    const hourMap = {};
    hourlyAgg.forEach(h => { hourMap[h._id] = { orders: h.orders, revenue: Math.round(h.revenue) }; });
    const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
      hour:    `${String(h).padStart(2,'0')}:00`,
      orders:  hourMap[h]?.orders  || 0,
      revenue: hourMap[h]?.revenue || 0,
    }));

    // ── Day of Week ───────────────────────────────────────────────────────
    const DOW = ['','Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dowMap = {};
    dowAgg.forEach(d => { dowMap[d._id] = { revenue: Math.round(d.revenue), orders: d.orders }; });
    const dayOfWeekData = [1,2,3,4,5,6,7].map(i => ({
      day:     DOW[i],
      revenue: dowMap[i]?.revenue || 0,
      orders:  dowMap[i]?.orders  || 0,
    }));

    // ── Status Breakdown ──────────────────────────────────────────────────
    const pendingOnly = Math.max(0, (k.pendingOrders||0) - (k.codConfirmed||0) - (k.paidOrders||0));
    const statusBreakdown = [
      { name: 'Delivered',     value: k.deliveredOrders || 0, color: '#10b981' },
      { name: 'Processing',    value: k.paidOrders      || 0, color: '#3b82f6' },
      { name: 'COD Confirmed', value: k.codConfirmed    || 0, color: '#f59e0b' },
      { name: 'Pending',       value: pendingOnly,             color: '#a78bfa' },
      { name: 'Cancelled',     value: k.cancelledOrders || 0, color: '#ef4444' },
    ].filter(s => s.value > 0);

    const paymentSplit = [
      { name: 'Cash on Delivery', value: k.codCount    || 0, color: '#f97316' },
      { name: 'Online / UPI',     value: k.onlineCount || 0, color: '#6366f1' },
    ].filter(p => p.value > 0);

    // ── Weekly Orders ─────────────────────────────────────────────────────
    const weeklyMap = {};
    weeklyAgg.forEach(w => { weeklyMap[w._id] = { orders: w.orders, revenue: Math.round(w.revenue) }; });
    const weeklyOrders = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const dow = d.getDay() + 1;
      weeklyOrders.push({ day: DOW[dow], orders: weeklyMap[dow]?.orders||0, revenue: weeklyMap[dow]?.revenue||0 });
    }

    // ── Customer Growth ───────────────────────────────────────────────────
    const cgMap = {};
    customerGrowthAgg.forEach(u => {
      const key = `${u._id.y}-${String(u._id.m).padStart(2,'0')}-${String(u._id.d).padStart(2,'0')}`;
      cgMap[key] = u.newUsers;
    });
    const customerGrowth = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      customerGrowth.push({
        date:     d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        newUsers: cgMap[key] || 0,
      });
    }

    // ── Paginated Orders ──────────────────────────────────────────────────
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, parseInt(limit) || 10);
    const skip     = (pageNum - 1) * limitNum;

    let orderQuery = {};
    if      (statusFilter === 'pending')   orderQuery = { isPaid: false, isDelivered: false, paymentStatus: { $nin: [...VOID_STATUSES, 'COD_CONFIRMED'] } };
    else if (statusFilter === 'cod')       orderQuery = { paymentStatus: 'COD_CONFIRMED', isDelivered: false };
    else if (statusFilter === 'paid')      orderQuery = { isPaid: true, isDelivered: false };
    else if (statusFilter === 'delivered') orderQuery = { isDelivered: true };
    else if (statusFilter === 'cancelled') orderQuery = { paymentStatus: { $in: VOID_STATUSES } };

    const [recentOrders, totalOrderCount] = await Promise.all([
      Order.find(orderQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user', 'name email')
        .select('_id totalPrice paymentStatus isPaid isDelivered paymentMethod createdAt user orderItems shippingAddress discount')
        .lean(),
      Order.countDocuments(orderQuery),
    ]);

    // ── Build response ────────────────────────────────────────────────────
    const result = {
      kpi,
      revenueTrend,
      hourlyDistribution,
      dayOfWeekData,
      statusBreakdown,
      paymentSplit,
      topProducts:     topProductsAgg,
      categoryRevenue: categoryAgg,
      couponStats:     couponAgg,
      weeklyOrders,
      customerGrowth,
      recentOrders,
      totalOrderCount,
      totalOrderPages: Math.ceil(totalOrderCount / limitNum),
      currentPage:     pageNum,
      lowStock,
      generatedAt:     new Date().toISOString(),
    };

    const ttl = daysNum === 0 ? 60 : 300;
    await setCache(cacheKey, result, ttl);
    res.json({ ...result, fromCache: false });

  } catch (error) {
    console.error('ANALYTICS ERROR:', error.message, error.stack);
    res.status(500).json({ message: error.message });
  }
};
