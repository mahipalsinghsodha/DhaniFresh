// models/ChatSession.js
const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null for guests
  },
  guestName: {
    type: String,
    trim: true,
  },
  guestEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: ['BOT_HANDLING', 'ROUTING', 'WAITING', 'ACTIVE', 'CLOSED'],
    default: 'BOT_HANDLING',
    index: true,
  },
  currentDispatchedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  dispatchExpiresAt: {
    type: Date,
    default: null,
  },
  routingAttempts: [
    {
      agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      agentName: String,
      dispatchedAt: { type: Date, default: Date.now },
      action: { type: String, enum: ['ACCEPTED', 'REJECTED', 'MISSED_TIMEOUT'] },
      respondedAt: Date,
    }
  ],
  category: {
    type: String,
    enum: ['ORDER', 'PAYMENT', 'RETURN', 'PRODUCT', 'OTHER'],
    default: 'OTHER',
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  // Rating submitted by user after chat closes
  rating: {
    score: { type: Number, min: 1, max: 5 },
    comment: String,
    submittedAt: Date,
  },
  closedAt: Date,
  closedBy: { type: String, enum: ['user', 'agent', 'system', 'bot'] },
  resolutionNote: String,
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
  agentActions: [
    {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      adminName: String,
      action: { type: String, enum: ['ACCEPTED', 'REJECTED', 'MISSED_TIMEOUT'] },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  // Count how many bot messages — used for frustration detection
  botMessageCount: { type: Number, default: 0 },
  // Count same-topic complaints for frustration detection
  repeatCount: { type: Number, default: 0 },
}, { timestamps: true });

chatSessionSchema.index({ status: 1, createdAt: -1 });
chatSessionSchema.index({ userId: 1 });
chatSessionSchema.index({ agentId: 1, status: 1 });

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
module.exports = ChatSession;
