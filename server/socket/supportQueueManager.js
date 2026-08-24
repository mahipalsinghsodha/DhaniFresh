// socket/supportQueueManager.js
// Enterprise-Grade Support Queue & Auto-Dispatch Manager with 30s Ringing, Fallbacks & Queue Processor

const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const Notification = require('../models/Notification');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const Settings = require('../models/Settings');

// In-Memory Presence & Active Timers
const agentPresenceMap = new Map(); // userId (string) -> { socketIds: Set, isLive: boolean, user: Object }
const activeRoutingTimers = new Map(); // sessionId (string) -> NodeJS.Timeout

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  1. PRESENCE TRACKING                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

const isSupportStaff = (user) => {
  if (!user) return false;
  if (['admin', 'superadmin', 'support'].includes(user.role)) return true;
  if (Array.isArray(user.permissions) && (user.permissions.includes('support') || user.permissions.includes('all'))) return true;
  return false;
};

function registerAgentPresence(user, socketId, io) {
  if (!isSupportStaff(user)) return;
  const uId = user._id.toString();

  // For support staff: Single active device enforcement (kick out old socket)
  if (user.role === 'support' && agentPresenceMap.has(uId) && io) {
    const existingSockets = agentPresenceMap.get(uId)?.socketIds;
    if (existingSockets && existingSockets.size > 0) {
      for (const oldSocketId of existingSockets) {
        if (oldSocketId !== socketId) {
          const oldSock = io.sockets.sockets.get(oldSocketId);
          if (oldSock) {
            oldSock.emit('auth:force_logout', {
              reason: 'You have been logged out because this support account was opened on another device / browser.'
            });
            oldSock.disconnect(true);
          }
        }
      }
      existingSockets.clear();
    }
  }

  const isLive = user.supportStats?.isLive !== false;
  const now = new Date();

  if (!agentPresenceMap.has(uId)) {
    agentPresenceMap.set(uId, {
      socketIds: new Set([socketId]),
      isLive,
      readyStartedAt: isLive ? now : null,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } else {
    const data = agentPresenceMap.get(uId);
    if (user.role === 'support') {
      data.socketIds = new Set([socketId]);
    } else {
      data.socketIds.add(socketId);
    }
    if (isLive && !data.readyStartedAt) {
      data.readyStartedAt = now;
    }
    data.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    };
  }
}

async function unregisterAgentPresence(userId, socketId) {
  if (!userId) return;
  const uId = userId.toString();
  if (agentPresenceMap.has(uId)) {
    const data = agentPresenceMap.get(uId);
    data.socketIds.delete(socketId);
    if (data.socketIds.size === 0) {
      if (data.isLive && data.readyStartedAt) {
        const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(data.readyStartedAt).getTime()) / 1000));
        if (elapsedSec > 0) {
          const todayStr = new Date().toISOString().slice(0, 10);
          try {
            const dbUser = await User.findById(uId);
            if (dbUser) {
              dbUser.supportStats = dbUser.supportStats || {};
              dbUser.supportStats.totalWorkSeconds = (dbUser.supportStats.totalWorkSeconds || 0) + elapsedSec;
              if (dbUser.supportStats.dailyStats?.date === todayStr) {
                dbUser.supportStats.dailyStats.workSeconds = (dbUser.supportStats.dailyStats.workSeconds || 0) + elapsedSec;
              }
              await dbUser.save({ validateBeforeSave: false });
            }
          } catch (err) {}
        }
      }
      agentPresenceMap.delete(uId);
    }
  }
}

async function setAgentLiveStatus(userId, isLive, io) {
  const uId = userId.toString();
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  let elapsedSec = 0;

  if (agentPresenceMap.has(uId)) {
    const data = agentPresenceMap.get(uId);
    if (data.isLive && !isLive && data.readyStartedAt) {
      elapsedSec = Math.max(0, Math.floor((now.getTime() - new Date(data.readyStartedAt).getTime()) / 1000));
      data.readyStartedAt = null;
    } else if (!data.isLive && isLive) {
      data.readyStartedAt = now;
    }
    data.isLive = isLive;
  }

  const dbUser = await User.findById(userId);
  if (dbUser) {
    dbUser.supportStats = dbUser.supportStats || {};
    dbUser.supportStats.isLive = isLive;
    dbUser.supportStats.lastActiveAt = now;
    if (elapsedSec > 0) {
      dbUser.supportStats.totalWorkSeconds = (dbUser.supportStats.totalWorkSeconds || 0) + elapsedSec;
      if (dbUser.supportStats.dailyStats?.date !== todayStr) {
        dbUser.supportStats.dailyStats = {
          date: todayStr,
          accepted: 0,
          rejected: 0,
          missed: 0,
          workSeconds: elapsedSec,
        };
      } else {
        dbUser.supportStats.dailyStats.workSeconds = (dbUser.supportStats.dailyStats.workSeconds || 0) + elapsedSec;
      }
    }
    await dbUser.save({ validateBeforeSave: false });

    if (io) {
      io.to(`user:${uId}`).emit('agent:stats_updated', {
        supportStats: dbUser.supportStats,
      });
    }
  }

  if (io) {
    io.to('admin_room').emit('admin:agent_presence_change', {
      agentId: uId,
      isLive,
      isOnline: agentPresenceMap.has(uId),
    });
    // If agent switched to Live, check if there's any waiting customer in queue!
    if (isLive) {
      setTimeout(() => {
        checkAndDispatchWaitingQueue(io);
      }, 1000);
    }
  }
}

function getOnlineAgents() {
  const list = [];
  agentPresenceMap.forEach((val, key) => {
    if (val.socketIds.size > 0) {
      let currentSessionSec = 0;
      if (val.isLive && val.readyStartedAt) {
        currentSessionSec = Math.max(0, Math.floor((Date.now() - new Date(val.readyStartedAt).getTime()) / 1000));
      }

      list.push({
        _id: key,
        ...val.user,
        isLive: val.isLive,
        readyStartedAt: val.readyStartedAt,
        currentSessionSec,
        socketCount: val.socketIds.size,
      });
    }
  });
  return list;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  2. SCHEDULE & OPERATING HOURS CHECKER (IST)                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function checkSupportSchedule() {
  try {
    const settings = await Settings.getGlobal();
    const sched = settings.supportSchedule || {};

    if (sched.enabled === false) {
      return { isOpen: true, settings: sched }; // Schedule restriction disabled -> always open
    }

    // Convert current UTC time to IST (UTC + 5 hours 30 mins)
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);

    const istDay = istDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const workDays = sched.workDays || [1, 2, 3, 4, 5, 6];

    if (!workDays.includes(istDay)) {
      return {
        isOpen: false,
        reason: istDay === 0 ? 'SUNDAY_OFF' : 'NON_WORKING_DAY',
        message: sched.offlineMessage || 'Our live support team is closed on Sundays. Please submit a support ticket.',
        schedule: sched,
      };
    }

    // Check Start & End Hours (Format: "HH:MM")
    const curHour = istDate.getUTCHours();
    const curMin = istDate.getUTCMinutes();
    const curTotalMin = curHour * 60 + curMin;

    const [sH = 9, sM = 0] = (sched.startHour || '09:00').split(':').map(Number);
    const [eH = 20, eM = 0] = (sched.endHour || '20:00').split(':').map(Number);

    const startTotalMin = sH * 60 + sM;
    const endTotalMin = eH * 60 + eM;

    if (curTotalMin < startTotalMin || curTotalMin >= endTotalMin) {
      return {
        isOpen: false,
        reason: 'OUTSIDE_HOURS',
        message: sched.offlineMessage || `Our live support hours are ${sched.startHour || '09:00'} to ${sched.endHour || '20:00'} IST. Please submit a support ticket.`,
        schedule: sched,
      };
    }

    return { isOpen: true, schedule: sched };
  } catch (err) {
    console.error('[SupportQueue] Error checking schedule:', err);
    return { isOpen: true, schedule: {} };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  3. CANDIDATE AGENT SELECTION (Least-Busy / Free Online)                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function findNextEligibleAgent(session, maxConcurrentChats = 3) {
  const onlineAgents = getOnlineAgents().filter(a => a.isLive !== false);
  if (onlineAgents.length === 0) return null;

  // Filter out agents who have already rejected or missed this session
  const alreadyAttemptedIds = new Set(
    (session.routingAttempts || []).map(a => a.agentId?.toString()).filter(Boolean)
  );

  const candidates = [];

  for (const agent of onlineAgents) {
    if (alreadyAttemptedIds.has(agent._id.toString())) continue;

    // Count how many ACTIVE chats this agent currently has
    const activeChatsCount = await ChatSession.countDocuments({
      agentId: agent._id,
      status: 'ACTIVE',
    });

    if (activeChatsCount < maxConcurrentChats) {
      candidates.push({
        ...agent,
        activeChatsCount,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by activeChatsCount ascending (least busy first)
  candidates.sort((a, b) => a.activeChatsCount - b.activeChatsCount);

  // If top candidates have the same active chat count, pick randomly among them
  const lowestLoad = candidates[0].activeChatsCount;
  const bestCandidates = candidates.filter(c => c.activeChatsCount === lowestLoad);

  return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  4. DISPATCH & 30-SECOND RING ENGINE                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function dispatchNextAgent(sessionId, io, triggerReason = 'INITIAL') {
  try {
    const session = await ChatSession.findOne({ sessionId })
      .populate('userId', 'name email avatar phone')
      .populate('orderId');

    if (!session || ['ACTIVE', 'CLOSED'].includes(session.status)) {
      return;
    }

    const settingsDoc = await Settings.getGlobal();
    const sched = settingsDoc.supportSchedule || {};
    const ringTimeoutSeconds = sched.ringTimeoutSeconds || 30;
    const maxConcurrentChats = sched.maxConcurrentChats || 3;

    // 1. Check Schedule
    const scheduleCheck = await checkSupportSchedule();
    if (!scheduleCheck.isOpen) {
      session.status = 'WAITING';
      session.currentDispatchedTo = null;
      session.dispatchExpiresAt = null;
      await session.save();

      io.to(`session:${sessionId}`).emit('chat:status_changed', {
        status: 'OFFLINE_HOURS',
        reason: scheduleCheck.reason,
        message: scheduleCheck.message,
        canCreateTicket: true,
      });
      return;
    }

    // 2. Find eligible agent
    const candidate = await findNextEligibleAgent(session, maxConcurrentChats);

    if (candidate) {
      // Clear any prior timer for this session
      if (activeRoutingTimers.has(sessionId)) {
        clearTimeout(activeRoutingTimers.get(sessionId));
        activeRoutingTimers.delete(sessionId);
      }

      const expiresAt = new Date(Date.now() + ringTimeoutSeconds * 1000);

      session.status = 'ROUTING';
      session.currentDispatchedTo = candidate._id;
      session.dispatchExpiresAt = expiresAt;
      await session.save();

      // Increment dispatched count in User stats
      await User.findByIdAndUpdate(candidate._id, {
        $inc: { 'supportStats.dispatchedCount': 1 },
      });

      // Prepare order info if present
      let orderInfo = null;
      if (session.orderId) {
        const o = session.orderId;
        orderInfo = {
          _id: o._id,
          orderIdString: o.orderIdString || (o._id ? o._id.toString().slice(-6).toUpperCase() : ''),
          totalPrice: o.totalPrice,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
        };
      }

      // Ring payload for target agent
      const ringPayload = {
        sessionId,
        customerName: session.userId?.name || session.guestName || 'Customer',
        customerEmail: session.userId?.email || session.guestEmail || '',
        category: session.category || 'OTHER',
        order: orderInfo,
        timeoutSeconds: ringTimeoutSeconds,
        expiresAt,
        triggerReason,
      };

      // Emit ring modal to the specific agent
      io.to(`user:${candidate._id.toString()}`).emit('agent:incoming_chat_ring', ringPayload);

      // Inform customer
      io.to(`session:${sessionId}`).emit('chat:status_changed', {
        status: 'ROUTING',
        message: 'Matching you with a live support specialist...',
      });

      // Broadcast queue update to admin room
      io.to('admin_room').emit('admin:session_update', {
        sessionId,
        status: 'ROUTING',
        currentDispatchedTo: candidate._id,
        agentName: candidate.name,
      });

      // Set 30s Timeout Timer
      const timer = setTimeout(async () => {
        activeRoutingTimers.delete(sessionId);
        await handleAgentTimeout(sessionId, candidate._id, io);
      }, ringTimeoutSeconds * 1000);

      activeRoutingTimers.set(sessionId, timer);

    } else {
      // No candidate available right now (all busy, or all rejected/missed, or no agents online)
      if (activeRoutingTimers.has(sessionId)) {
        clearTimeout(activeRoutingTimers.get(sessionId));
        activeRoutingTimers.delete(sessionId);
      }

      session.status = 'WAITING';
      session.currentDispatchedTo = null;
      session.dispatchExpiresAt = null;
      await session.save();

      const waitingCount = await ChatSession.countDocuments({ status: 'WAITING' });
      const onlineCount = getOnlineAgents().filter(a => a.isLive !== false).length;

      io.to(`session:${sessionId}`).emit('chat:status_changed', {
        status: 'WAITING',
        position: waitingCount,
        onlineAgentsCount: onlineCount,
        message: onlineCount === 0
          ? 'All support agents are currently offline. Please leave a message or create a ticket.'
          : `All specialists are currently assisting other customers. You are #${waitingCount} in queue.`,
        canCreateTicket: true,
      });

      io.to('admin_room').emit('admin:session_update', {
        sessionId,
        status: 'WAITING',
        currentDispatchedTo: null,
      });
      io.to('admin_room').emit('admin:queue_count', { count: waitingCount });
    }
  } catch (err) {
    console.error('[SupportQueue] dispatchNextAgent error:', err);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  5. AGENT RESPONSE HANDLERS (Accept / Reject / Timeout)                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function recordAgentAccept(agentId, io) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const user = await User.findById(agentId);
    if (!user) return;

    user.supportStats = user.supportStats || {};
    if (user.supportStats.dailyStats?.date !== todayStr) {
      user.supportStats.dailyStats = {
        date: todayStr,
        accepted: 0,
        rejected: 0,
        missed: 0,
      };
    }

    user.supportStats.acceptedCount = (user.supportStats.acceptedCount || 0) + 1;
    user.supportStats.dailyStats.accepted = (user.supportStats.dailyStats.accepted || 0) + 1;
    user.supportStats.lastActiveAt = new Date();

    await user.save({ validateBeforeSave: false });

    if (io) {
      io.to(`user:${agentId.toString()}`).emit('agent:stats_updated', {
        supportStats: user.supportStats,
      });
    }
  } catch (e) {
    console.error('[SupportQueue] recordAgentAccept error:', e);
  }
}

async function recordAgentRejectionOrTimeout(agentId, isTimeout = false, io) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const user = await User.findById(agentId);
    if (!user) return;

    user.supportStats = user.supportStats || {};
    if (user.supportStats.dailyStats?.date !== todayStr) {
      user.supportStats.dailyStats = {
        date: todayStr,
        accepted: 0,
        rejected: 0,
        missed: 0,
      };
    }

    if (isTimeout) {
      user.supportStats.missedCount = (user.supportStats.missedCount || 0) + 1;
      user.supportStats.dailyStats.missed = (user.supportStats.dailyStats.missed || 0) + 1;
    } else {
      user.supportStats.rejectedCount = (user.supportStats.rejectedCount || 0) + 1;
      user.supportStats.dailyStats.rejected = (user.supportStats.dailyStats.rejected || 0) + 1;
    }

    const totalDailyRejections = (user.supportStats.dailyStats.rejected || 0) + (user.supportStats.dailyStats.missed || 0);

    // Max 1 rejection allowed per day for support agent -> auto-set to Away to protect queue
    if (user.role === 'support' && totalDailyRejections >= 1) {
      user.supportStats.isLive = false;
      if (agentPresenceMap.has(agentId.toString())) {
        agentPresenceMap.get(agentId.toString()).isLive = false;
      }
      if (io) {
        io.to(`user:${agentId.toString()}`).emit('agent:rejection_limit_reached', {
          dailyRejections: totalDailyRejections,
          maxAllowed: 1,
          message: '⚠️ Daily Rejection Limit Reached (1/1 today). Your status has been auto-set to Offline.',
        });
        io.to('admin_room').emit('admin:agent_presence_change', {
          agentId: agentId.toString(),
          isLive: false,
          isOnline: agentPresenceMap.has(agentId.toString()),
        });
      }
    }

    await user.save({ validateBeforeSave: false });

    if (io) {
      io.to(`user:${agentId.toString()}`).emit('agent:stats_updated', {
        supportStats: user.supportStats,
      });
    }
  } catch (e) {
    console.error('[SupportQueue] recordAgentRejectionOrTimeout error:', e);
  }
}

async function handleAgentAccept(sessionId, agentUser, io) {
  try {
    // Clear timer
    if (activeRoutingTimers.has(sessionId)) {
      clearTimeout(activeRoutingTimers.get(sessionId));
      activeRoutingTimers.delete(sessionId);
    }

    const session = await ChatSession.findOne({ sessionId });
    if (!session || session.status === 'CLOSED') return null;

    session.agentId = agentUser._id;
    session.status = 'ACTIVE';
    session.currentDispatchedTo = null;
    session.dispatchExpiresAt = null;

    session.routingAttempts.push({
      agentId: agentUser._id,
      agentName: agentUser.name,
      action: 'ACCEPTED',
      respondedAt: new Date(),
    });

    session.agentActions.push({
      adminId: agentUser._id,
      adminName: agentUser.name,
      action: 'ACCEPTED',
      timestamp: new Date(),
    });

    await session.save();

    // Record Agent Acceptance & Daily Stats
    await recordAgentAccept(agentUser._id, io);

    // Dismiss ring modal for this agent
    io.to(`user:${agentUser._id.toString()}`).emit('agent:dismiss_ring', { sessionId, accepted: true });

    // Inform the session room (customer + agent)
    const sysMsg = await ChatMessage.create({
      sessionId,
      senderId: 'SYSTEM',
      senderType: 'SYSTEM',
      senderName: 'System',
      content: `${agentUser.name} has joined the chat.`,
      messageType: 'TEXT',
    });

    io.to(`session:${sessionId}`).emit('chat:agent_joined', {
      agentName: agentUser.name,
      agentAvatar: agentUser.avatar,
    });
    io.to(`session:${sessionId}`).emit('chat:message', sysMsg);

    // Notify registered user if any
    if (session.userId) {
      try {
        const notif = await Notification.create({
          user: session.userId,
          type: 'CHAT_REPLY',
          title: 'Agent Joined Chat',
          message: `${agentUser.name} has joined your support chat.`,
          link: '/support',
          metadata: { sessionId },
        });
        io.to(`user:${session.userId}`).emit('notification', notif);
      } catch (e) {}
    }

    // Broadcast update to admin room
    io.to('admin_room').emit('admin:session_update', {
      sessionId,
      status: 'ACTIVE',
      agentId: agentUser._id,
      agentName: agentUser.name,
    });

    return session;
  } catch (err) {
    console.error('[SupportQueue] handleAgentAccept error:', err);
    return null;
  }
}

async function handleAgentReject(sessionId, agentUser, io) {
  try {
    // Clear timer
    if (activeRoutingTimers.has(sessionId)) {
      clearTimeout(activeRoutingTimers.get(sessionId));
      activeRoutingTimers.delete(sessionId);
    }

    const session = await ChatSession.findOne({ sessionId });
    if (!session || session.status === 'CLOSED' || session.status === 'ACTIVE') return;

    session.routingAttempts.push({
      agentId: agentUser._id,
      agentName: agentUser.name,
      action: 'REJECTED',
      respondedAt: new Date(),
    });

    session.agentActions.push({
      adminId: agentUser._id,
      adminName: agentUser.name,
      action: 'REJECTED',
      timestamp: new Date(),
    });

    session.currentDispatchedTo = null;
    session.dispatchExpiresAt = null;
    await session.save();

    // Record Agent Rejection & Daily Limit Check
    await recordAgentRejectionOrTimeout(agentUser._id, false, io);

    // Dismiss ring modal for this agent
    io.to(`user:${agentUser._id.toString()}`).emit('agent:dismiss_ring', { sessionId, rejected: true });

    // Auto-dispatch to the next eligible agent immediately!
    await dispatchNextAgent(sessionId, io, 'REJECT_FALLBACK');
  } catch (err) {
    console.error('[SupportQueue] handleAgentReject error:', err);
  }
}

async function handleAgentTimeout(sessionId, agentId, io) {
  try {
    const session = await ChatSession.findOne({ sessionId });
    if (!session || session.status !== 'ROUTING' || session.currentDispatchedTo?.toString() !== agentId.toString()) {
      return;
    }

    const agentUser = await User.findById(agentId);

    session.routingAttempts.push({
      agentId,
      agentName: agentUser?.name || 'Agent',
      action: 'MISSED_TIMEOUT',
      respondedAt: new Date(),
    });

    session.agentActions.push({
      adminId: agentId,
      adminName: agentUser?.name || 'Agent',
      action: 'MISSED_TIMEOUT',
      timestamp: new Date(),
    });

    session.currentDispatchedTo = null;
    session.dispatchExpiresAt = null;
    await session.save();

    // Record Agent Timeout & Daily Limit Check
    await recordAgentRejectionOrTimeout(agentId, true, io);

    // Dismiss ringing modal on the agent's screen
    io.to(`user:${agentId.toString()}`).emit('agent:dismiss_ring', { sessionId, reason: 'TIMEOUT' });

    // Auto-dispatch to the next eligible agent immediately!
    await dispatchNextAgent(sessionId, io, 'TIMEOUT_FALLBACK');
  } catch (err) {
    console.error('[SupportQueue] handleAgentTimeout error:', err);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  6. CHAT CLOSE & WAITING QUEUE AUTO-DISPATCH                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

async function handleChatClosed(sessionId, closedBy, io, agentUser = null) {
  try {
    if (activeRoutingTimers.has(sessionId)) {
      clearTimeout(activeRoutingTimers.get(sessionId));
      activeRoutingTimers.delete(sessionId);
    }

    const session = await ChatSession.findOne({ sessionId });
    if (!session) return;

    session.status = 'CLOSED';
    session.closedAt = new Date();
    session.closedBy = closedBy || 'system';
    session.currentDispatchedTo = null;
    session.dispatchExpiresAt = null;
    await session.save();

    if (session.agentId) {
      await User.findByIdAndUpdate(session.agentId, {
        $inc: { 'supportStats.resolvedCount': 1 },
      });
    }

    io.to(`session:${sessionId}`).emit('chat:session_closed', {
      reason: closedBy,
      rating_prompt: true,
    });

    io.to('admin_room').emit('admin:session_update', {
      sessionId,
      status: 'CLOSED',
    });

    // Auto-check waiting queue: 2 seconds after chat closes, dispatch next waiting customer!
    setTimeout(() => {
      checkAndDispatchWaitingQueue(io);
    }, 2000);
  } catch (err) {
    console.error('[SupportQueue] handleChatClosed error:', err);
  }
}

async function checkAndDispatchWaitingQueue(io) {
  try {
    const nextWaiting = await ChatSession.findOne({ status: 'WAITING' })
      .sort({ createdAt: 1 }); // FIFO (oldest first)

    if (nextWaiting) {
      await dispatchNextAgent(nextWaiting.sessionId, io, 'QUEUE_DISPATCH');
    }
  } catch (err) {
    console.error('[SupportQueue] checkAndDispatchWaitingQueue error:', err);
  }
}

module.exports = {
  isSupportStaff,
  registerAgentPresence,
  unregisterAgentPresence,
  setAgentLiveStatus,
  getOnlineAgents,
  checkSupportSchedule,
  dispatchNextAgent,
  handleAgentAccept,
  handleAgentReject,
  handleAgentTimeout,
  handleChatClosed,
  checkAndDispatchWaitingQueue,
};
