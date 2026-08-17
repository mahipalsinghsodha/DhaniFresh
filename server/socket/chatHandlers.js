// socket/chatHandlers.js
// All real-time chat socket events

const { v4: uuidv4 } = require('crypto');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const Notification = require('../models/Notification');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const { handleBotMessage } = require('./aiBot');
const { sendSupportReplyEmail } = require('../services/emailService');

// Helper: check if a user is support staff
const isSupportStaff = (user) => {
  if (!user) return false;
  if (['admin', 'superadmin', 'support'].includes(user.role)) return true;
  if (Array.isArray(user.permissions) && (user.permissions.includes('support') || user.permissions.includes('all'))) return true;
  return false;
};

// Helper: generate short unique session ID
const generateSessionId = () => require('crypto').randomBytes(12).toString('hex');

// Phrases that trigger human escalation (including "talk to a person" and "talk to a human agent")
const ESCALATION_TRIGGERS = [
  'human', 'agent', 'person', 'real person', 'speak to someone',
  'talk to someone', 'talk to a person', 'talk to person', 'talk to a human',
  'talk to human', 'talk to a human agent', 'talk to human agent', 'talk to agent',
  'talk to support', 'live agent', 'live support', 'customer care', 'representative',
  'support executive', 'support agent', 'connect to agent', 'connect with agent',
  'connect to human', 'connect with support', 'not helpful', "can't help",
  'useless', 'frustrated', 'not satisfied', 'call me', 'callback', 'executive',
];

function needsEscalation(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return ESCALATION_TRIGGERS.some(trigger => lower.includes(trigger));
}

function registerChatHandlers(io, socket) {
  /* ── USER: Start a new chat session ─────────────────────────────────────── */
  socket.on('chat:start', async (data) => {
    try {
      const { guestName, guestEmail, category = 'OTHER', orderId, subIssue, initialMessage } = data;

      let validOrderId = null;
      if (orderId && require('mongoose').Types.ObjectId.isValid(orderId)) {
        validOrderId = orderId;
      }

      const sessionId = generateSessionId();
      const session = await ChatSession.create({
        sessionId,
        userId:     socket.user?._id || null,
        guestName:  socket.user?.name || guestName,
        guestEmail: socket.user?.email || guestEmail,
        status:     'BOT_HANDLING',
        category,
        orderId:    validOrderId,
      });

      // Join the session room
      socket.join(`session:${sessionId}`);
      socket.sessionId = sessionId;

      socket.emit('chat:session_created', { sessionId, status: 'BOT_HANDLING' });

      const userMsgContent = initialMessage || subIssue;

      if (userMsgContent) {
        // If an initial message or quick reply option was selected
        const userMsg = await ChatMessage.create({
          sessionId,
          senderId:   socket.user?._id || 'guest',
          senderType: 'USER',
          senderName: socket.user?.name || session.guestName || 'Guest',
          content:    userMsgContent,
          messageType: 'TEXT',
        });

        socket.emit('chat:message', userMsg);

        // Check if user requested human escalation directly (e.g. "Talk to a person" / "Talk to a human agent")
        if (needsEscalation(userMsgContent)) {
          setTimeout(() => {
            escalateToHuman(io, socket, session, 'User requested human agent').catch(console.error);
          }, 350);
          return;
        }

        setTimeout(() => {
          handleBotMessage(session, userMsgContent, io, socket, 'normal').catch(console.error);
        }, 350);
        return;
      }

      // If an order ID is provided without a sub-issue (greet with order card)
      if (validOrderId) {
        setTimeout(() => {
          handleBotMessage(session, '', io, socket, 'order_welcome').catch(console.error);
        }, 350);
      } else {
        // Standard welcome message for non-order general support
        const welcomeMessage = await ChatMessage.create({
          sessionId,
          senderId:   'BOT',
          senderType: 'BOT',
          senderName: 'Ghee Assistant',
          content:    `Hi ${socket.user?.name || guestName || 'there'}! 👋 I'm Ghee Assistant. How can I help you today?`,
          messageType: 'QUICK_REPLY',
          metadata: {
            options: getCategoryQuickReplies(category),
          },
        });

        socket.emit('chat:message', welcomeMessage);
      }
    } catch (error) {
      console.error('[Chat] chat:start error:', error);
      socket.emit('chat:error', { message: 'Failed to start chat. Please try again.' });
    }
  });

  /* ── USER: Send a message ───────────────────────────────────────────────── */
  socket.on('chat:message', async (data) => {
    try {
      const { sessionId, content, messageType = 'TEXT' } = data;
      if (!sessionId || !content?.trim()) return;
      if (content.trim().length > 5000) {
        return socket.emit('chat:error', { message: 'Message cannot exceed 5000 characters' });
      }

      const session = await ChatSession.findOne({ sessionId });
      if (!session) return socket.emit('chat:error', { message: 'Session not found' });

      // Save user message first so all agents can see what the user asked
      const msg = await ChatMessage.create({
        sessionId,
        senderId:   socket.user?._id || 'guest',
        senderType: 'USER',
        senderName: socket.user?.name || session.guestName || 'Guest',
        content:    content.trim(),
        messageType,
      });

      // Broadcast to the session room (so user and agent both see it)
      io.to(`session:${sessionId}`).emit('chat:message', msg);
      await ChatSession.findOneAndUpdate({ sessionId }, { lastMessageAt: new Date() });

      // Check for escalation keywords (e.g. "Talk to a person" / "Talk to a human agent")
      if (needsEscalation(content) && session.status === 'BOT_HANDLING') {
        await escalateToHuman(io, socket, session);
        return;
      }

      // Notify admins of new message in their queue
      io.to('admin_room').emit('admin:session_update', {
        sessionId,
        status:        session.status,
        lastMessage:   msg,
        lastMessageAt: new Date(),
      });

      // If bot is handling, route to AI
      if (session.status === 'BOT_HANDLING') {
        // Detect frustration: 3+ messages → escalate
        const userMsgCount = await ChatMessage.countDocuments({ sessionId, senderType: 'USER' });
        if (userMsgCount >= 3 && session.botMessageCount >= 3) {
          await escalateToHuman(io, socket, session, 'Multiple unanswered questions detected.');
          return;
        }

        // Route to AI bot (async, don't await — bot responds via socket.io)
        handleBotMessage(session, content.trim(), io, socket).catch(console.error);
      }
    } catch (error) {
      console.error('[Chat] chat:message error:', error);
      socket.emit('chat:error', { message: 'Message failed to send.' });
    }
  });

  /* ── USER: Typing indicator ─────────────────────────────────────────────── */
  socket.on('chat:typing', async ({ sessionId, isTyping }) => {
    socket.to(`session:${sessionId}`).emit('chat:user_typing', { isTyping });
  });

  /* ── USER: Close chat ───────────────────────────────────────────────────── */
  socket.on('chat:close', async ({ sessionId }) => {
    try {
      const session = await ChatSession.findOneAndUpdate(
        { sessionId },
        { status: 'CLOSED', closedAt: new Date(), closedBy: 'user' },
        { new: true }
      );
      if (!session) return;

      const sysMsg = await ChatMessage.create({
        sessionId,
        senderId:   'SYSTEM',
        senderType: 'SYSTEM',
        senderName: 'System',
        content:    'Chat closed by user.',
        messageType: 'TEXT',
      });

      io.to(`session:${sessionId}`).emit('chat:session_closed', {
        reason:        'user_closed',
        rating_prompt: true,
      });
      io.to(`session:${sessionId}`).emit('chat:message', sysMsg);
      io.to('admin_room').emit('admin:session_update', { sessionId, status: 'CLOSED' });
    } catch (error) {
      console.error('[Chat] chat:close error:', error);
    }
  });

  /* ── USER: Rejoin existing session (page refresh) ───────────────────────── */
  socket.on('chat:rejoin', async ({ sessionId }) => {
    try {
      const session = await ChatSession.findOne({ sessionId });
      if (!session || session.status === 'CLOSED') return;

      socket.join(`session:${sessionId}`);
      socket.sessionId = sessionId;

      // Send last 50 messages
      const messages = await ChatMessage.find({ sessionId })
        .sort({ createdAt: 1 })
        .limit(50)
        .lean();

      socket.emit('chat:history', { sessionId, messages, status: session.status });
    } catch (error) {
      console.error('[Chat] chat:rejoin error:', error);
    }
  });

  /* ── AGENT: Join a session ──────────────────────────────────────────────── */
  socket.on('agent:join_session', async ({ sessionId }) => {
    try {
      if (!isSupportStaff(socket.user)) return;

      socket.join(`session:${sessionId}`);

      const session = await ChatSession.findOneAndUpdate(
        { sessionId, status: { $ne: 'CLOSED' } },
        {
          agentId: socket.user._id,
          status:  'ACTIVE',
          $push: {
            agentActions: {
              adminId:   socket.user._id,
              adminName: socket.user.name,
              action:    'ACCEPTED',
            }
          }
        },
        { new: true }
      );
      if (!session) return;

      const sysMsg = await ChatMessage.create({
        sessionId,
        senderId:   'SYSTEM',
        senderType: 'SYSTEM',
        senderName: 'System',
        content:    `${socket.user.name} has joined the chat.`,
        messageType: 'TEXT',
      });

      io.to(`session:${sessionId}`).emit('chat:agent_joined', {
        agentName:   socket.user.name,
        agentAvatar: socket.user.avatar,
      });
      io.to(`session:${sessionId}`).emit('chat:message', sysMsg);
      io.to('admin_room').emit('admin:session_update', { sessionId, status: 'ACTIVE', agentId: socket.user._id, agentName: socket.user.name });

      // Notify the user if they are logged in
      if (session.userId) {
        try {
          const notification = await Notification.create({
            user: session.userId,
            type: 'CHAT_REPLY',
            title: 'Agent Joined Chat',
            message: `${socket.user.name} has joined your support chat.`,
            link: '/support',
            metadata: { sessionId },
          });
          io.to(`user:${session.userId}`).emit('notification', notification);
        } catch (err) {
          console.error('[Chat] Failed to create join notification:', err);
        }
      }

      // Load message history for the agent
      const messages = await ChatMessage.find({ sessionId })
        .sort({ createdAt: 1 })
        .lean();

      socket.emit('chat:history', { sessionId, messages, status: 'ACTIVE' });
    } catch (error) {
      console.error('[Chat] agent:join_session error:', error);
    }
  });

  /* ── AGENT: Reject a session ────────────────────────────────────────────── */
  socket.on('agent:reject_session', async ({ sessionId }) => {
    try {
      if (!isSupportStaff(socket.user)) return;

      const session = await ChatSession.findOneAndUpdate(
        { sessionId, status: 'WAITING' }, // only if it's still waiting
        {
          $push: {
            agentActions: {
              adminId:   socket.user._id,
              adminName: socket.user.name,
              action:    'REJECTED',
            }
          }
        },
        { new: true }
      );
      if (!session) return;

      // Broadcast to admins that this specific admin rejected it
      io.to('admin_room').emit('admin:session_rejected', {
        sessionId,
        adminId: socket.user._id
      });

    } catch (error) {
      console.error('[Chat] agent:reject_session error:', error);
    }
  });

  /* ── AGENT: Send message ────────────────────────────────────────────────── */
  socket.on('agent:message', async ({ sessionId, content, messageType = 'TEXT', metadata = {} }) => {
    try {
      if (!isSupportStaff(socket.user)) return;
      if (!content?.trim()) return;

      const msg = await ChatMessage.create({
        sessionId,
        senderId:   socket.user._id,
        senderType: 'AGENT',
        senderName: socket.user.name,
        content:    content.trim(),
        messageType,
        metadata,
      });

      await ChatSession.findOneAndUpdate({ sessionId }, { lastMessageAt: new Date() });
      io.to(`session:${sessionId}`).emit('chat:message', msg);

      // Check if user is offline
      const sessionData = await ChatSession.findOne({ sessionId });
      if (sessionData) {
        let isUserOnline = false;
        try {
          if (sessionData.userId) {
            const userSockets = await io.in(`user:${sessionData.userId}`).fetchSockets();
            if (userSockets.length > 0) isUserOnline = true;
          } else {
            // For guests, check if there are sockets in the session room that belong to guests
            const sessionSockets = await io.in(`session:${sessionId}`).fetchSockets();
            isUserOnline = sessionSockets.some(s => !isSupportStaff(s.user));
          }
        } catch (e) {
          console.error('[Chat] Error checking socket presence:', e);
        }

        if (!isUserOnline) {
          // Send offline email if email exists
          const email = sessionData.guestEmail || (sessionData.userId && (await User.findById(sessionData.userId)).email);
          const name = sessionData.guestName || (sessionData.userId && (await User.findById(sessionData.userId)).name) || 'Guest';

          if (email) {
            sendSupportReplyEmail({
              to: email,
              userName: name,
              agentName: socket.user.name,
              messageContent: messageType === 'TEXT' ? content.trim() : 'Sent an attachment.',
              sessionId,
            }).catch(err => console.error('[Chat] Failed to send offline email:', err));
          }

          // Create persistent notification for registered users
          if (sessionData.userId) {
            try {
              const notification = await Notification.create({
                user: sessionData.userId,
                type: 'CHAT_REPLY',
                title: 'New message from Support',
                message: `${socket.user.name}: ${messageType === 'TEXT' ? content.trim() : 'Sent an attachment.'}`,
                link: `/support?session=${sessionId}`,
                metadata: { sessionId },
              });
              io.to(`user:${sessionData.userId}`).emit('notification', notification);
            } catch (err) {
              console.error('[Chat] Failed to create chat reply notification:', err);
            }
          }
        }
      }

    } catch (error) {
      console.error('[Chat] agent:message error:', error);
    }
  });

  /* ── AGENT: Typing indicator ─────────────────────────────────────────────── */
  socket.on('agent:typing', ({ sessionId, isTyping }) => {
    socket.to(`session:${sessionId}`).emit('chat:agent_typing', { isTyping });
  });

  /* ── AGENT: Close chat ──────────────────────────────────────────────────── */
  socket.on('agent:close_session', async ({ sessionId, resolution }) => {
    try {
      if (!isSupportStaff(socket.user)) return;

      await ChatSession.findOneAndUpdate(
        { sessionId },
        { status: 'CLOSED', closedAt: new Date(), closedBy: 'agent', resolutionNote: resolution },
      );

      const sysMsg = await ChatMessage.create({
        sessionId,
        senderId:   'SYSTEM',
        senderType: 'SYSTEM',
        senderName: 'System',
        content:    `Chat resolved by ${socket.user.name}. ${resolution ? `Resolution: ${resolution}` : ''}`,
        messageType: 'TEXT',
      });

      io.to(`session:${sessionId}`).emit('chat:session_closed', {
        reason:        'agent_resolved',
        rating_prompt: true,
      });
      io.to(`session:${sessionId}`).emit('chat:message', sysMsg);
      io.to('admin_room').emit('admin:session_update', { sessionId, status: 'CLOSED' });

      // Notify user if logged in
      const sessionData = await ChatSession.findOne({ sessionId });
      if (sessionData && sessionData.userId) {
        try {
          const notification = await Notification.create({
            user: sessionData.userId,
            type: 'CHAT_REPLY',
            title: 'Support Chat Resolved',
            message: `Your chat was resolved by ${socket.user.name}. ${resolution ? `Note: ${resolution}` : ''}`,
            link: '/support',
            metadata: { sessionId },
          });
          io.to(`user:${sessionData.userId}`).emit('notification', notification);
        } catch (err) {
          console.error('[Chat] Failed to create resolve notification:', err);
        }
      }
    } catch (error) {
      console.error('[Chat] agent:close_session error:', error);
    }
  });
}

/* ── Escalate to human (Broadcast to ALL support agents & admins) ───────── */
async function escalateToHuman(io, socket, session, reason = 'User requested human agent') {
  try {
    // 1. Update session status to WAITING in queue (available to all agents)
    const updatedSession = await ChatSession.findOneAndUpdate(
      { sessionId: session.sessionId },
      { status: 'WAITING', agentId: null },
      { new: true }
    );

    const waitingCount = await ChatSession.countDocuments({ status: 'WAITING' });
    const position = waitingCount;
    const estimatedWait = Math.max(1, position * 2);

    // 2. Inform the customer
    const sysMsg = await ChatMessage.create({
      sessionId:   session.sessionId,
      senderId:    'SYSTEM',
      senderType:  'SYSTEM',
      senderName:  'System',
      content:     `Connecting you with our Support Team. A live agent will be with you shortly.${position > 1 ? ` (Queue position: #${position})` : ''}`,
      messageType: 'TEXT',
    });

    io.to(`session:${session.sessionId}`).emit('chat:message', sysMsg);
    io.to(`session:${session.sessionId}`).emit('chat:status_changed', { status: 'WAITING', position });

    // 3. Fetch full session data
    const sessionData = await ChatSession.findOne({ sessionId: session.sessionId })
      .populate('userId', 'name email avatar')
      .populate('orderId')
      .lean();

    // 4. Broadcast to ALL connected agents & admins in admin_room
    io.to('admin_room').emit('admin:new_session', sessionData);
    io.to('admin_room').emit('admin:queue_count', { count: waitingCount });

    // 5. Notify ALL support agents and admins
    try {
      const supportUsers = await User.find({
        $or: [
          { role: { $in: ['admin', 'superadmin', 'support'] } },
          { permissions: 'support' },
          { permissions: 'all' },
        ],
        isBlocked: false,
      }).select('_id name email role');

      const customerName = sessionData.userId?.name || sessionData.guestName || 'Customer';
      const orderTag = sessionData.orderId ? ` for Order #${sessionData.orderId._id ? sessionData.orderId._id.toString().slice(-6).toUpperCase() : sessionData.orderId.toString().slice(-6).toUpperCase()}` : '';

      await Promise.all(supportUsers.map(async (agent) => {
        try {
          const notif = await Notification.create({
            user: agent._id,
            type: 'CHAT_REPLY',
            title: 'New Support Chat Request',
            message: `${customerName} requested live support${orderTag}.`,
            link: `/admin/support?session=${session.sessionId}`,
            metadata: { sessionId: session.sessionId },
          });

          io.to(`user:${agent._id.toString()}`).emit('notification', notif);
          io.to(`user:${agent._id.toString()}`).emit('admin:new_session', sessionData);
        } catch (e) {
          // ignore individual notification failure
        }
      }));
    } catch (notifErr) {
      console.error('[Chat] Failed to notify support agents:', notifErr.message);
    }

    // 6. Create or sync SupportTicket for ticket-based support dashboards
    try {
      if (sessionData.userId?._id || sessionData.userId) {
        const uId = sessionData.userId._id || sessionData.userId;
        const subject = sessionData.orderId 
          ? `Order #${(sessionData.orderId._id || sessionData.orderId).toString().slice(-6).toUpperCase()} Support Escalation` 
          : `${sessionData.category || 'General'} Live Chat Request`;
        
        await SupportTicket.create({
          user: uId,
          subject,
          category: sessionData.orderId ? 'ORDER_ISSUE' : 'OTHER',
          order: sessionData.orderId?._id || sessionData.orderId || null,
          priority: 'HIGH',
          status: 'OPEN',
          messages: [
            {
              sender: 'user',
              message: `Live support requested by ${sessionData.userId?.name || 'Customer'}. (Chat Session: ${session.sessionId})`,
            },
          ],
        });
      }
    } catch (ticketErr) {
      console.error('[Chat] Failed to sync SupportTicket:', ticketErr.message);
    }
  } catch (error) {
    console.error('[Chat] escalateToHuman error:', error);
  }
}

/* ── Quick reply options by category ────────────────────────────────────── */
function getCategoryQuickReplies(category) {
  const map = {
    ORDER:   ['Where is my order?', 'Track with order ID', 'Cancel order'],
    PAYMENT: ['Payment failed', 'Refund status', 'Wrong amount charged'],
    RETURN:  ['Start a return', 'Refund status', 'Return policy'],
    PRODUCT: ['Product ingredients', 'Storage tips', 'Place a new order'],
    OTHER:   ['Track my order', 'Return policy', 'Talk to a person'],
  };
  return map[category] || map.OTHER;
}

module.exports = { registerChatHandlers, escalateToHuman };
