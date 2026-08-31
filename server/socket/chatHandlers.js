// socket/chatHandlers.js
// All real-time chat socket events

const { v4: uuidv4 } = require('crypto');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const Notification = require('../models/Notification');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const { handleBotMessage, fetchOrderDetails } = require('./aiBot');
const { sendSupportReplyEmail } = require('../services/emailService');
const {
  isSupportStaff,
  setAgentLiveStatus,
  getOnlineAgents,
  dispatchNextAgent,
  handleAgentAccept,
  handleAgentReject,
  handleChatClosed,
  checkAndDispatchWaitingQueue,
} = require('./supportQueueManager');

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
      const { guestName, guestEmail, category = 'OTHER', orderId, subIssue, initialMessage, language = 'en' } = data;

      let resolvedUserId = socket.user?._id || null;
      if (!resolvedUserId && guestEmail) {
        const foundUser = await User.findOne({ email: guestEmail.toLowerCase().trim() }).select('_id name').lean();
        if (foundUser) resolvedUserId = foundUser._id;
      }

      let validOrderId = null;
      if (orderId) {
        const ord = await fetchOrderDetails(orderId, resolvedUserId);
        if (ord) validOrderId = ord._id;
      }

      const activeLang = (language || '').startsWith('hi') ? 'hi' : 'en';

      const sessionId = generateSessionId();
      const session = await ChatSession.create({
        sessionId,
        userId:     resolvedUserId,
        guestName:  socket.user?.name || guestName,
        guestEmail: socket.user?.email || guestEmail,
        status:     'BOT_HANDLING',
        category,
        orderId:    validOrderId,
        language:   activeLang,
      });

      // Join the session room
      socket.join(`session:${sessionId}`);
      socket.sessionId = sessionId;

      socket.emit('chat:session_created', { sessionId, status: 'BOT_HANDLING', language: activeLang });

      const userMsgContent = initialMessage || subIssue;

      if (userMsgContent) {
        const userMsg = await ChatMessage.create({
          sessionId,
          senderId:   resolvedUserId || 'guest',
          senderType: 'USER',
          senderName: socket.user?.name || session.guestName || 'Guest',
          content:    userMsgContent,
          messageType: 'TEXT',
        });

        socket.emit('chat:message', userMsg);

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

      // If an order ID is provided (greet with order card & status-aware buttons)
      if (validOrderId) {
        setTimeout(() => {
          handleBotMessage(session, '', io, socket, 'order_welcome').catch(console.error);
        }, 350);
      } else {
        // Standard welcome message with clean options
        const isHindi = activeLang === 'hi';
        const welcomeContent = isHindi
          ? `नमस्ते ${socket.user?.name || guestName || ''}! 👋 मैं आपका दातासा सहायता असिस्टेंट हूँ। मैं आपकी क्या सहायता कर सकता हूँ?`
          : `Hi ${socket.user?.name || guestName || 'there'}! 👋 I'm Daatasa Support Assistant. How can I help you today?`;

        const quickReplies = isHindi
          ? ['📦 मेरे ऑर्डर्स', '📍 ऑर्डर ट्रैक करें', '↩️ 7-दिन रिटर्न पॉलिसी', '🫙 शुद्ध बिलोना घी', '💬 एजेंट से बात करें']
          : ['📦 My Orders', '📍 Track Order', '↩️ 7-Day Return Policy', '🫙 Pure Bilona Ghee', '💬 Talk to a human agent'];

        const welcomeMessage = await ChatMessage.create({
          sessionId,
          senderId:   'BOT',
          senderType: 'BOT',
          senderName: 'Daatasa Assistant',
          content:    welcomeContent,
          messageType: 'QUICK_REPLY',
          metadata: {
            options: quickReplies,
          },
        });

        socket.emit('chat:message', welcomeMessage);
      }
    } catch (error) {
      console.error('[Chat] chat:start error:', error);
      socket.emit('chat:error', { message: 'Failed to start chat. Please try again.' });
    }
  });

  /* ── USER: Switch Language on the fly ───────────────────────────────────── */
  socket.on('chat:set_language', async ({ sessionId, language }) => {
    try {
      if (!sessionId || !language) return;
      const activeLang = language.startsWith('hi') ? 'hi' : 'en';
      await ChatSession.findOneAndUpdate({ sessionId }, { language: activeLang });
    } catch (err) {
      console.error('[Chat] set_language error:', err);
    }
  });

  /* ── USER: Send a message ───────────────────────────────────────────────── */
  socket.on('chat:message', async (data) => {
    try {
      const { sessionId, content, messageType = 'TEXT', language } = data;
      if (!sessionId || !content?.trim()) return;
      if (content.trim().length > 5000) {
        return socket.emit('chat:error', { message: 'Message cannot exceed 5000 characters' });
      }

      const updateFields = { lastMessageAt: new Date() };
      if (language) {
        updateFields.language = language.startsWith('hi') ? 'hi' : 'en';
      }

      const session = await ChatSession.findOneAndUpdate(
        { sessionId },
        updateFields,
        { new: true }
      );
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

      // If in WAITING and no agent is assigned yet, user can continue chatting with AI Bot
      if (session.status === 'WAITING' && !session.agentId && !needsEscalation(content)) {
        session.status = 'BOT_HANDLING';
        await ChatSession.findOneAndUpdate({ sessionId }, { status: 'BOT_HANDLING' });
        io.to(`session:${sessionId}`).emit('chat:status_changed', {
          status: 'BOT_HANDLING',
          message: 'Connected to AI Assistant',
        });
      }

      // If bot is handling, route to AI
      if (session.status === 'BOT_HANDLING') {
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
      await handleChatClosed(sessionId, 'user', io);
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

  /* ── AGENT: Join / Accept a session ─────────────────────────────────────── */
  socket.on('agent:join_session', async ({ sessionId }) => {
    try {
      if (!isSupportStaff(socket.user)) return;
      socket.join(`session:${sessionId}`);
      const session = await handleAgentAccept(sessionId, socket.user, io);
      if (session) {
        const messages = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 }).lean();
        socket.emit('chat:history', { sessionId, messages, status: 'ACTIVE' });
      }
    } catch (error) {
      console.error('[Chat] agent:join_session error:', error);
    }
  });

  /* ── AGENT: Accept Incoming Ring ────────────────────────────────────────── */
  socket.on('agent:accept_incoming', async ({ sessionId }) => {
    try {
      if (!isSupportStaff(socket.user)) return;
      socket.join(`session:${sessionId}`);
      const session = await handleAgentAccept(sessionId, socket.user, io);
      if (session) {
        const messages = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 }).lean();
        socket.emit('chat:history', { sessionId, messages, status: 'ACTIVE' });
      }
    } catch (error) {
      console.error('[Chat] agent:accept_incoming error:', error);
    }
  });

  /* ── AGENT: Reject a session / Incoming Ring ────────────────────────────── */
  socket.on('agent:reject_session', async ({ sessionId }) => {
    try {
      if (!isSupportStaff(socket.user)) return;
      await handleAgentReject(sessionId, socket.user, io);
    } catch (error) {
      console.error('[Chat] agent:reject_session error:', error);
    }
  });

  socket.on('agent:reject_incoming', async ({ sessionId }) => {
    try {
      if (!isSupportStaff(socket.user)) return;
      await handleAgentReject(sessionId, socket.user, io);
    } catch (error) {
      console.error('[Chat] agent:reject_incoming error:', error);
    }
  });

  /* ── AGENT: Toggle Live Status (Online / Away) ──────────────────────────── */
  socket.on('agent:toggle_live_status', async ({ isLive }) => {
    try {
      if (!isSupportStaff(socket.user)) return;
      await setAgentLiveStatus(socket.user._id, !!isLive, io);
      socket.emit('agent:live_status_updated', { isLive: !!isLive });
    } catch (error) {
      console.error('[Chat] agent:toggle_live_status error:', error);
    }
  });

  /* ── AGENT: Get Online Agents List ──────────────────────────────────────── */
  socket.on('agent:get_online_agents', () => {
    try {
      if (!isSupportStaff(socket.user)) return;
      socket.emit('agent:online_agents_list', getOnlineAgents());
    } catch (error) {
      console.error('[Chat] agent:get_online_agents error:', error);
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
            const sessionSockets = await io.in(`session:${sessionId}`).fetchSockets();
            isUserOnline = sessionSockets.some(s => !isSupportStaff(s.user));
          }
        } catch (e) {
          console.error('[Chat] Error checking socket presence:', e);
        }

        if (!isUserOnline) {
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
      await handleChatClosed(sessionId, 'agent_resolved', io, socket.user);
    } catch (error) {
      console.error('[Chat] agent:close_session error:', error);
    }
  });
}

/* ── Escalate to human (Auto-Dispatch Engine with 30s Ring & Fallback) ─────── */
async function escalateToHuman(io, socket, session, reason = 'User requested human agent') {
  try {
    // 1. Sync or create SupportTicket as fallback record
    try {
      if (session.userId) {
        const uId = session.userId._id || session.userId;
        const subject = session.orderId 
          ? `Order #${(session.orderId._id || session.orderId).toString().slice(-6).toUpperCase()} Support Escalation` 
          : `${session.category || 'General'} Live Chat Request`;
        
        await SupportTicket.create({
          user: uId,
          subject,
          category: session.orderId ? 'ORDER_ISSUE' : 'OTHER',
          order: session.orderId?._id || session.orderId || null,
          priority: 'HIGH',
          status: 'OPEN',
          messages: [
            {
              sender: 'user',
              message: `Live support requested by ${session.guestName || 'Customer'}. (Chat Session: ${session.sessionId})`,
            },
          ],
        });
      }
    } catch (ticketErr) {
      console.error('[Chat] Failed to sync SupportTicket:', ticketErr.message);
    }

    // 2. Trigger Intelligent Auto-Dispatch Engine
    await dispatchNextAgent(session.sessionId, io, 'HUMAN_ESCALATION');

  } catch (error) {
    console.error('[Chat] escalateToHuman error:', error);
  }
}

/* ── Quick reply options by category (Multilingual) ────────────────────── */
function getCategoryQuickReplies(category, isHindi = false) {
  if (isHindi) {
    const mapHi = {
      ORDER:   ['📍 ऑर्डर ट्रैक करें', '📋 ऑर्डर स्थिति', '❌ ऑर्डर कैंसिल करें', '💬 एजेंट से बात करें'],
      PAYMENT: ['पेमेंट कट गया लेकिन ऑर्डर नहीं बना', 'रिफंड स्थिति', '💬 एजेंट से बात करें'],
      RETURN:  ['↩️ रिटर्न प्रोसेस शुरू करें', 'रिफंड स्थिति', '7-दिन रिटर्न पॉलिसी', '💬 एजेंट से बात करें'],
      PRODUCT: ['🫙 बिलोना घी कैसे बनता है?', '🥛 A2 गाय vs भैंस का घी', 'स्वास्थ्य लाभ', '💬 एजेंट से बात करें'],
      OTHER:   ['📍 ऑर्डर ट्रैक करें', '↩️ रिटर्न पॉलिसी', '🫙 बिलोना घी कैसे बनता है?', '💬 एजेंट से बात करें'],
    };
    return mapHi[category] || mapHi.OTHER;
  }
  const map = {
    ORDER:   ['📍 Track Order', '📋 Order Status', '❌ Cancel Order', '💬 Talk to a human agent'],
    PAYMENT: ['Payment failed but deducted', 'Refund status', '💬 Talk to a human agent'],
    RETURN:  ['↩️ Start Return Process', 'Refund status', 'Return policy', '💬 Talk to a human agent'],
    PRODUCT: ['🫙 How is Bilona Ghee made?', '🥛 A2 Cow vs Buffalo Ghee', 'Health Benefits', '💬 Talk to a human agent'],
    OTHER:   ['📍 Track Order', '↩️ Return policy', '🫙 How is Bilona Ghee made?', '💬 Talk to a human agent'],
  };
  return map[category] || map.OTHER;
}

module.exports = { registerChatHandlers, escalateToHuman };
