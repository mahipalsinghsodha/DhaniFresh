// socket/index.js
// Socket.io server initialization with JWT auth middleware

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

/**
 * Initialize the Socket.io server.
 * Called once from server.js after http.createServer(app).
 */
function initSocketServer(httpServer) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:5173'];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    // Reconnection handled on client side
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Auth middleware for sockets ────────────────────────────────────────────
  // Guests can connect without a token (for chat widget)
  // Authenticated users/agents pass JWT in handshake.auth.token
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      // Allow guest connection (chat widget for non-logged-in users)
      socket.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('name email role avatar isBlocked tokenVersion');

      if (!user || user.isBlocked || decoded.version !== user.tokenVersion) {
        return next(new Error('Authentication failed'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Register event namespaces ──────────────────────────────────────────────
  const { registerChatHandlers } = require('./chatHandlers');
  const { registerAgentPresence, unregisterAgentPresence, isSupportStaff } = require('./supportQueueManager');

  io.on('connection', (socket) => {
    const userId = socket.user?._id?.toString() || 'guest';
    const role = socket.user?.role || 'guest';
    console.log(`[Socket] ${role} connected: ${userId} (${socket.id})`);

    // Track activity for idle disconnect
    socket.lastActivity = Date.now();
    socket.onAny((event, ...args) => {
      socket.lastActivity = Date.now();
    });

    // Join personal room for targeted events
    if (socket.user) {
      socket.join(`user:${userId}`);

      // Support staff joins admin room and registers presence
      if (isSupportStaff(socket.user)) {
        socket.join('admin_room');
        registerAgentPresence(socket.user, socket.id, io);
        console.log(`[Socket] Support Staff ${socket.user.name} (${role}) joined admin_room & registered live presence`);
      }
    }

    registerChatHandlers(io, socket);

    socket.on('joinOrderRoom', (orderId) => {
      if (socket.user) {
        socket.join(`order:${orderId}`);
        console.log(`[Socket] User ${userId} joined room order:${orderId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      if (socket.user) {
        unregisterAgentPresence(socket.user._id, socket.id);
      }
      console.log(`[Socket] ${role} disconnected: ${userId} — reason: ${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`[Socket] Error from ${userId}:`, err.message);
    });
  });

  // ── Idle Connection Cleanup (1 Hour) ───────────────────────────────────────
  const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
  setInterval(() => {
    const now = Date.now();
    io.sockets.sockets.forEach((socket) => {
      if (socket.lastActivity && now - socket.lastActivity > IDLE_TIMEOUT_MS) {
        console.log(`[Socket] Disconnecting idle socket: ${socket.id}`);
        socket.emit('chat:error', { message: 'Connection closed due to inactivity.' });
        socket.disconnect(true);
      }
    });
  }, 5 * 60 * 1000); // Check every 5 minutes

  console.log('[Socket.io] Server initialized');
  return io;
}

/**
 * Get the Socket.io instance (for use in other modules like controllers)
 */
function getIO() {
  if (!io) throw new Error('Socket.io not initialized. Call initSocketServer first.');
  return io;
}

module.exports = { initSocketServer, getIO };
