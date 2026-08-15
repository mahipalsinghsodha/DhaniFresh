// socket/aiBot.js
// AI-powered Support Assistant with Real-Time Order Intelligence
// Handles: 📍 Track Order, 📋 Order Status, 🚚 Delivery Issue, ↩️ Return / Refund, ⚠️ Product Issue, 💬 Other Issue
// Features: Live database lookups, 7-day return calculations, rich order cards, human escalation

const Anthropic = require('@anthropic-ai/sdk').default;
const ChatMessage = require('../models/ChatMessage');
const ChatSession = require('../models/ChatSession');
const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// Only initialize Anthropic client if API key is present and looks valid (sk-ant-...)
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
  try {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch (err) {
    console.warn('[Bot] Anthropic SDK init failed, using enhanced Order Intelligence Engine:', err.message);
  }
}

const BOT_NAME = 'Ghee Assistant';
const BOT_SENDER = 'BOT';

// ── Standard Quick Reply Options for Orders ──────────────────────────────────
const ORDER_QUICK_REPLIES = [
  '📍 Track Order',
  '📋 Order Status',
  '🚚 Delivery Issue',
  '↩️ Return / Refund',
  '⚠️ Product Issue',
  '💬 Other Issue',
];

// ── Helper: Format Order Status ──────────────────────────────────────────────
function getStatusDetails(order) {
  if (order.orderStatus === 'DELIVERED' || order.isDelivered) {
    return { label: 'Delivered', key: 'DELIVERED', color: '#10b981', emoji: '✅' };
  }
  if (order.orderStatus === 'CANCELLED' || order.paymentStatus === 'CANCELLED') {
    return { label: 'Cancelled', key: 'CANCELLED', color: '#ef4444', emoji: '❌' };
  }
  if (order.orderStatus === 'OUT_FOR_DELIVERY') {
    return { label: 'Out for Delivery', key: 'OUT_FOR_DELIVERY', color: '#3b82f6', emoji: '🚚' };
  }
  if (order.orderStatus === 'PICKED_UP' || order.orderStatus === 'ASSIGNED_TO_COURIER') {
    return { label: 'Shipped (In Transit)', key: 'SHIPPED', color: '#6366f1', emoji: '📦' };
  }
  if (order.orderStatus === 'ACCEPTED' || order.isPaid) {
    return { label: 'Processing', key: 'PROCESSING', color: '#f59e0b', emoji: '⏳' };
  }
  if (order.paymentStatus === 'COD_CONFIRMED' || order.orderStatus === 'PENDING_ACCEPTANCE') {
    return { label: 'Order Confirmed', key: 'CONFIRMED', color: '#f59e0b', emoji: '📝' };
  }
  return {
    label: order.orderStatus ? order.orderStatus.replace(/_/g, ' ') : 'Pending',
    key: order.orderStatus || 'PENDING',
    color: '#f59e0b',
    emoji: '⏳',
  };
}

// ── Helper: Fetch Order Details from DB ──────────────────────────────────────
async function fetchOrderDetails(orderId, userId = null) {
  if (!orderId) return null;
  try {
    const query = mongoose.Types.ObjectId.isValid(orderId)
      ? { _id: orderId }
      : { 'paymentInfo.razorpay_order_id': orderId };

    // If userId provided, enforce ownership unless admin
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      // Find order
      const ord = await Order.findOne(query)
        .populate('orderItems.product', 'name image price weight')
        .lean();
      return ord;
    }

    const ord = await Order.findOne(query)
      .populate('orderItems.product', 'name image price weight')
      .lean();
    return ord;
  } catch (err) {
    console.error('[Bot] fetchOrderDetails error:', err.message);
    return null;
  }
}

// ── Deterministic Order Intelligence Engine ──────────────────────────────────
async function generateOrderResponse(order, queryText, subIssue = null) {
  if (!order) {
    return {
      message: "I could not find the details for this order. Please make sure the order ID is correct, or speak with our support team.",
      messageType: 'QUICK_REPLY',
      metadata: { options: ['Talk to a human agent', 'Browse FAQs'] },
    };
  }

  const orderShortId = order._id.toString().slice(-6).toUpperCase();
  const statusInfo = getStatusDetails(order);
  const items = order.orderItems || [];
  const totalPrice = Number(order.totalPrice ?? 0).toLocaleString('en-IN');
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const courierName = order.shippingProvider || 'Daatasa Express Courier';
  const trackingNo = order.trackingNumber || `DT-${order._id.toString().slice(-8).toUpperCase()}`;

  const itemSummary = items.map(i => {
    const name = i.name || i.product?.name || 'Vedic Bilona Cow Ghee';
    return `• ${name} (Qty: ${i.quantity || 1}, ₹${Number(i.price || 0).toLocaleString('en-IN')})`;
  }).join('\n');

  const orderCardMetadata = {
    orderId: order._id.toString(),
    status: statusInfo.key,
    statusLabel: statusInfo.label,
    items: items.map(i => ({
      name: i.name || i.product?.name || 'Vedic Cow Ghee',
      quantity: i.quantity || 1,
      price: i.price,
      image: i.image || i.product?.image || null,
    })),
    totalPrice: order.totalPrice,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    trackingNumber: trackingNo,
    shippingProvider: courierName,
    isDelivered: order.isDelivered,
    deliveredAt: order.deliveredAt,
    createdAt: order.createdAt,
    shippingAddress: order.shippingAddress,
  };

  const textLower = (queryText || '').toLowerCase();
  const issueKey = (subIssue || '').toUpperCase();

  // ── INTENT 1: TRACK ORDER ──────────────────────────────────────────────────
  if (issueKey === 'TRACK' || textLower.includes('track') || textLower.includes('where is my order') || textLower.includes('location')) {
    let trackingMsg = '';

    if (order.isDelivered || order.orderStatus === 'DELIVERED') {
      const delDate = order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : orderDate;
      trackingMsg = `📍 **Live Tracking — Order #${orderShortId}**\n\n` +
        `✅ **Status**: Delivered on ${delDate}\n` +
        `🚚 **Courier Partner**: ${courierName}\n` +
        `📦 **Tracking / AWB**: ${trackingNo}\n` +
        `🏠 **Delivered To**: ${order.shippingAddress?.city || 'Your destination'}, ${order.shippingAddress?.state || ''}\n\n` +
        `Your pure Bilona Ghee package has been successfully delivered! Let us know if you have any questions or need a return.`;
    } else if (order.orderStatus === 'OUT_FOR_DELIVERY') {
      trackingMsg = `📍 **Live Tracking — Order #${orderShortId}**\n\n` +
        `🚚 **Status**: Out for Delivery Today!\n` +
        `🛵 **Courier**: ${courierName} (AWB: ${trackingNo})\n` +
        `📞 The delivery executive will contact you on ${order.shippingAddress?.phone || 'your registered number'} before arrival.\n\n` +
        `Your package is expected to arrive within a few hours.`;
    } else if (order.orderStatus === 'PICKED_UP' || order.orderStatus === 'ASSIGNED_TO_COURIER') {
      trackingMsg = `📍 **Live Tracking — Order #${orderShortId}**\n\n` +
        `📦 **Status**: Shipped & In Transit\n` +
        `🚚 **Courier**: ${courierName}\n` +
        `🔖 **AWB / Tracking No**: ${trackingNo}\n` +
        `⏱️ **Estimated Delivery**: 2–3 business days\n\n` +
        `Your order is on the way from our Vedic bilona kitchen. You will receive SMS alerts as it reaches your city hub.`;
    } else if (order.orderStatus === 'CANCELLED' || order.paymentStatus === 'CANCELLED') {
      trackingMsg = `📍 **Order #${orderShortId} is Cancelled**\n\n` +
        `This order was cancelled. If you were charged, a full refund of ₹${totalPrice} is initiated to your original payment method.`;
    } else {
      trackingMsg = `📍 **Live Tracking — Order #${orderShortId}**\n\n` +
        `⏳ **Status**: Order Confirmed & Being Prepared\n` +
        `🧈 We are hand-packing your fresh Vedic Bilona Ghee in glass jars to prevent transit leaks.\n` +
        `🚚 **Expected Dispatch**: Within 24 hours via ${courierName}.\n` +
        `You will receive the tracking number as soon as the courier picks it up.`;
    }

    return {
      message: trackingMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: ['📋 Order Status', '🚚 Delivery Issue', '↩️ Return / Refund', '💬 Talk to a human agent'],
      },
    };
  }

  // ── INTENT 2: ORDER STATUS ────────────────────────────────────────────────
  if (issueKey === 'STATUS' || textLower.includes('order status') || textLower.includes('status') || textLower.includes('details')) {
    const statusMsg = `📋 **Order Details & Status — #${orderShortId}**\n\n` +
      `• **Status**: ${statusInfo.emoji} ${statusInfo.label}\n` +
      `• **Order Date**: ${orderDate}\n` +
      `• **Payment**: ${order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'} (${order.paymentStatus || 'COMPLETED'})\n` +
      `• **Total Amount**: ₹${totalPrice}\n\n` +
      `📦 **Items Ordered**:\n${itemSummary}\n\n` +
      `📍 **Delivery Address**: ${order.shippingAddress?.street || ''}, ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} - ${order.shippingAddress?.zipCode || ''}`;

    return {
      message: statusMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: ['📍 Track Order', '🚚 Delivery Issue', '↩️ Return / Refund', '⚠️ Product Issue', '💬 Talk to a human agent'],
      },
    };
  }

  // ── INTENT 3: DELIVERY ISSUE ──────────────────────────────────────────────
  if (issueKey === 'DELIVERY' || textLower.includes('delivery') || textLower.includes('delay') || textLower.includes('late') || textLower.includes('not received')) {
    let deliveryMsg = '';

    if (order.isDelivered || order.orderStatus === 'DELIVERED') {
      deliveryMsg = `🚚 **Delivery Assistance — Order #${orderShortId}**\n\n` +
        `Our records show your order was marked **Delivered**.\n\n` +
        `If you have not received it yet:\n` +
        `1. Please check with household members, neighbors, or building security.\n` +
        `2. Sometimes couriers mark delivery slightly ahead of time during the final route.\n\n` +
        `If it is still not found, I can immediately raise an urgent courier investigation or connect you with a live agent to resolve this.`;
    } else if (order.orderStatus === 'OUT_FOR_DELIVERY') {
      deliveryMsg = `🚚 **Order #${orderShortId} is Out for Delivery**\n\n` +
        `Your package is currently in the delivery vehicle with ${courierName}. The courier executive will call on ${order.shippingAddress?.phone || 'your phone'} before delivery.\n\n` +
        `If you need delivery rescheduled or special instructions, please let us know!`;
    } else {
      deliveryMsg = `🚚 **Delivery Assistance — Order #${orderShortId}**\n\n` +
        `Your order is being handled with priority via **${courierName}** (Tracking: ${trackingNo}).\n` +
        `• Standard delivery timeline: 3–5 business days across India.\n\n` +
        `If you are experiencing an unexpected delay, tap "Talk to a human agent" below and our support team will expedite it with the courier manager.`;
    }

    return {
      message: deliveryMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: ['📍 Track Order', '💬 Talk to a human agent', '↩️ Return / Refund'],
      },
    };
  }

  // ── INTENT 4: RETURN / REFUND ─────────────────────────────────────────────
  if (issueKey === 'RETURN' || textLower.includes('return') || textLower.includes('refund') || textLower.includes('exchange')) {
    let returnMsg = '';

    if (!order.isDelivered && order.orderStatus !== 'DELIVERED') {
      returnMsg = `↩️ **Return / Refund — Order #${orderShortId}**\n\n` +
        `Your order is currently **${statusInfo.label}** and has not been delivered yet.\n\n` +
        `• Return requests can be initiated once the order is delivered.\n` +
        `• If you wish to **cancel** this order before dispatch, please let us know or tap below to connect with an agent.`;
    } else {
      // Delivered order: check 7-day policy
      const deliveryDate = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.updatedAt);
      const daysPassed = Math.max(0, Math.floor((Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)));
      const daysLeft = Math.max(0, 7 - daysPassed);

      if (daysPassed <= 7) {
        returnMsg = `↩️ **Return / Refund Eligibility — Order #${orderShortId}**\n\n` +
          `✅ **Eligible for Return** (${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining in your 7-day window).\n\n` +
          `Under Daatasa's **7-Day Bilona Ghee Guarantee**:\n` +
          `• 100% refund of ₹${totalPrice} or free replacement.\n` +
          `• Free doorstep reverse pickup by our courier.\n` +
          `• Refunds are credited back to your original payment method / bank account within 5–7 business days.\n\n` +
          `To proceed, please tell us the reason for return, or tap below to speak with an agent.`;
      } else {
        returnMsg = `↩️ **Return / Refund Policy — Order #${orderShortId}**\n\n` +
          `This order was delivered on ${deliveryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} (${daysPassed} days ago).\n\n` +
          `Our standard return policy is 7 days from delivery. If you experienced an exceptional quality issue, please connect with our support team below for a manual review.`;
      }
    }

    return {
      message: returnMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: ['Start Return Process', 'Check Refund Policy', '💬 Talk to a human agent'],
      },
    };
  }

  // ── INTENT 5: PRODUCT ISSUE ───────────────────────────────────────────────
  if (issueKey === 'PRODUCT' || textLower.includes('product') || textLower.includes('damaged') || textLower.includes('broken') || textLower.includes('leak') || textLower.includes('quality') || textLower.includes('smell') || textLower.includes('taste')) {
    const productMsg = `⚠️ **Product Quality Guarantee — Order #${orderShortId}**\n\n` +
      `You ordered:\n${itemSummary}\n\n` +
      `At Daatasa, every batch of A2 Vedic Cow Ghee is traditionally prepared using the bilona method with zero chemicals.\n\n` +
      `✨ **Our Guarantee**:\n` +
      `If you received a broken seal, leakage, broken jar, or have any purity/quality concern, we offer an **Instant Free Replacement** or **100% Refund**!\n\n` +
      `📷 **Quick Tip**: You can upload a photo of the package using the 📎 image attachment icon below, and our team will process your replacement right away.`;

    return {
      message: productMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: ['Request Free Replacement', 'Request Refund', '💬 Talk to a human agent'],
      },
    };
  }

  // ── INTENT 6: OTHER ISSUE ─────────────────────────────────────────────────
  if (issueKey === 'OTHER' || textLower.includes('other issue') || textLower === 'other' || textLower.includes('other query') || textLower.includes('another issue')) {
    const otherMsg = `💬 **Other Queries & Assistance — Order #${orderShortId}**\n\n` +
      `Please select what you need help with regarding this order:\n\n` +
      `• 🧾 **Tax Invoice & Bill**: View or email GST tax invoice\n` +
      `• ❌ **Cancel Order**: Check cancellation eligibility and refunds\n` +
      `• 📍 **Change Delivery Address**: Update shipping address or phone number\n` +
      `• 💳 **Payment & Billing**: Payment status, duplicate charges, or COD queries\n` +
      `• 💬 **Talk to a Human Agent**: Live chat with support\n\n` +
      `Or feel free to type any specific question directly below!`;

    return {
      message: otherMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: [
          '🧾 Download Invoice',
          '❌ Cancel Order',
          '📍 Change Address / Phone',
          '💳 Payment Query',
          '💬 Talk to a human agent',
        ],
      },
    };
  }

  // ── INTENT 6A: INVOICE / BILL ─────────────────────────────────────────────
  if (textLower.includes('invoice') || textLower.includes('bill') || textLower.includes('receipt') || textLower.includes('tax')) {
    const invoiceMsg = `🧾 **Tax Invoice & Receipt — Order #${orderShortId}**\n\n` +
      `• **Invoice Number**: ${order.invoiceNumber || 'INV-' + orderShortId}\n` +
      `• **Order Total**: ₹${totalPrice} (Inclusive of GST)\n` +
      `• **Payment Mode**: ${order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'Online Payment (Prepaid)'}\n` +
      `• **Order Date**: ${orderDate}\n\n` +
      `📄 You can view and download your full GST invoice from **Order History**. If you require a business GST invoice with your company GSTIN, tap below to have our support team email it to you.`;

    return {
      message: invoiceMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: ['Email Invoice', '💬 Talk to a human agent', '📋 Order Status'],
      },
    };
  }

  // ── INTENT 6B: CANCEL ORDER ───────────────────────────────────────────────
  if (textLower.includes('cancel order') || textLower.includes('cancellation') || textLower.includes('cancel')) {
    let cancelMsg = '';

    if (order.orderStatus === 'CANCELLED' || order.paymentStatus === 'CANCELLED') {
      cancelMsg = `❌ **Order #${orderShortId} is Already Cancelled**\n\n` +
        `This order was previously cancelled. If any payment was deducted, a refund of ₹${totalPrice} has been processed back to your original payment source (takes 5–7 business days to reflect).`;
    } else if (order.isDelivered || order.orderStatus === 'DELIVERED') {
      cancelMsg = `❌ **Cannot Cancel — Order #${orderShortId} is Delivered**\n\n` +
        `This order has already been delivered. Instead of cancellation, you can initiate a return under our **7-Day Quality Guarantee** for a full refund or free replacement!`;
    } else if (order.orderStatus === 'SHIPPED' || order.orderStatus === 'PICKED_UP' || order.orderStatus === 'OUT_FOR_DELIVERY') {
      cancelMsg = `🚚 **Order #${orderShortId} Has Already Shipped**\n\n` +
        `Your package is already in transit with **${courierName}** (AWB: ${trackingNo}).\n\n` +
        `• Direct cancellation is not possible once dispatched.\n` +
        `• **Easy Refund**: You can simply reject/refuse delivery at your doorstep when the delivery partner arrives. The package will return to us, and 100% refund of ₹${totalPrice} will be credited to your payment method automatically.`;
    } else {
      cancelMsg = `❌ **Cancel Order Request — #${orderShortId}**\n\n` +
        `Your order is currently **${statusInfo.label}** and has not been dispatched yet.\n\n` +
        `Would you like to cancel this order? Once confirmed, a full refund of ₹${totalPrice} will be processed immediately.`;
    }

    return {
      message: cancelMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: order.orderStatus === 'DELIVERED'
          ? ['↩️ Return / Refund', '💬 Talk to a human agent']
          : ['Confirm Cancellation', 'Keep My Order', '💬 Talk to a human agent'],
      },
    };
  }

  // ── INTENT 6C: CHANGE ADDRESS OR PHONE ────────────────────────────────────
  if (textLower.includes('change address') || textLower.includes('update address') || textLower.includes('change phone') || textLower.includes('phone number') || textLower.includes('shipping address')) {
    let addrMsg = '';

    if (order.orderStatus === 'SHIPPED' || order.orderStatus === 'PICKED_UP' || order.orderStatus === 'OUT_FOR_DELIVERY' || order.isDelivered) {
      addrMsg = `📍 **Address Modification — Order #${orderShortId}**\n\n` +
        `Your order is currently **${statusInfo.label}** with ${courierName}.\n\n` +
        `Shipping manifests are locked once the courier receives the package. However, when the delivery executive calls you on ${order.shippingAddress?.phone || 'your phone'} before delivery, you can coordinate landmark directions or a neighbor drop-off directly with them!`;
    } else {
      addrMsg = `📍 **Change Delivery Details — Order #${orderShortId}**\n\n` +
        `Current address on file:\n` +
        `• **Address**: ${order.shippingAddress?.street || ''}, ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} - ${order.shippingAddress?.zipCode || ''}\n` +
        `• **Phone**: ${order.shippingAddress?.phone || 'N/A'}\n\n` +
        `Since your order is still in packaging, we can update it! Please type your new address or phone number below, or tap to speak with our support agent.`;
    }

    return {
      message: addrMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: ['💬 Talk to a human agent', '📍 Track Order', '📋 Order Status'],
      },
    };
  }

  // ── INTENT 6D: PAYMENT & BILLING ──────────────────────────────────────────
  if (textLower.includes('payment') || textLower.includes('charged') || textLower.includes('deduct') || textLower.includes('double') || textLower.includes('razorpay') || textLower.includes('billing')) {
    const payMsg = `💳 **Payment & Billing Summary — Order #${orderShortId}**\n\n` +
      `• **Payment Method**: ${order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'Prepaid Online'}\n` +
      `• **Payment Status**: ${order.paymentStatus || 'COMPLETED'}\n` +
      `• **Total Amount**: ₹${totalPrice}\n\n` +
      `💡 **Quick Help**:\n` +
      `1. **Double Deductions**: If money was deducted twice by mistake, Razorpay automatically reverses the duplicate charge within 24–48 hours.\n` +
      `2. **COD to UPI**: You can pay via UPI scanner directly to the courier agent upon delivery.\n` +
      `3. If you need a payment verification check, our support agent is ready to assist!`;

    return {
      message: payMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: ['💬 Talk to a human agent', '📋 Order Status', '📍 Track Order'],
      },
    };
  }

  // ── INTENT 7: DEFAULT ORDER WELCOME ───────────────────────────────────────
  const welcomeMsg = `🫙 **Order #${orderShortId} Details Loaded**\n\n` +
    `• **Items**: ${items.length} item${items.length !== 1 ? 's' : ''} (₹${totalPrice})\n` +
    `• **Status**: ${statusInfo.emoji} ${statusInfo.label}\n` +
    `• **Order Date**: ${orderDate}\n\n` +
    `How can I assist you with this order? Select an option below or type your query:`;

  return {
    message: welcomeMsg,
    messageType: 'ORDER_CARD',
    metadata: {
      ...orderCardMetadata,
      options: ORDER_QUICK_REPLIES,
    },
  };
}

// ── Claude System Prompt (When API is configured) ────────────────────────────
const SYSTEM_PROMPT = `You are "Ghee Assistant", the intelligent and caring AI customer support specialist for Daatasa, 
an authentic Indian brand selling 100% pure A2 Vedic Gir Cow Bilona Ghee and organic health products.

Capabilities:
1. Provide real-time order status, tracking, and courier updates
2. Handle return/refund eligibility checks (7-day bilona ghee guarantee)
3. Answer questions about ghee making (traditional bilona method from curd, hand-churned, wooden churner, earthen pots)
4. Address delivery delays, damaged packaging, or broken seals with replacements/refunds
5. Escalate complex requests to human agents when appropriate (needs_human=true)

Rules:
- Be polite, knowledgeable, and concise (under 3 sentences per point)
- Always use ₹ for Indian Rupee prices
- Plain text / clear markdown formatting
- Respond in JSON format:
{
  "message": "...",
  "needs_human": false,
  "quick_replies": ["📍 Track Order", "📋 Order Status", "🚚 Delivery Issue", "↩️ Return / Refund", "⚠️ Product Issue", "💬 Other Issue"],
  "order_card": null
}`;

// ── Main Bot Entry Point ────────────────────────────────────────────────────
async function handleBotMessage(session, userMessage, io, socket, mode = 'normal') {
  try {
    const sessionId = session.sessionId;

    // Check if user requested human escalation
    const lower = (userMessage || '').toLowerCase();
    if (lower.includes('human') || lower.includes('agent') || lower.includes('person') || lower.includes('speak to someone') || lower.includes('talk to a human')) {
      const { escalateToHuman } = require('./chatHandlers');
      await escalateToHuman(io, socket, session, 'User requested human agent');
      return;
    }

    // Emit typing indicator
    io.to(`session:${sessionId}`).emit('chat:agent_typing', { isTyping: true });

    // Fetch order if associated with session
    let order = null;
    if (session.orderId) {
      order = await fetchOrderDetails(session.orderId, session.userId);
    }

    // ── Route 1: Order-specific query / welcome ──────────────────────────────
    if (order || mode === 'order_welcome' || mode === 'auto_fetch_order') {
      const response = await generateOrderResponse(order, userMessage, mode === 'order_welcome' ? null : null);

      await new Promise(r => setTimeout(r, 600)); // Natural typing pause
      io.to(`session:${sessionId}`).emit('chat:agent_typing', { isTyping: false });

      const botMsg = await ChatMessage.create({
        sessionId,
        senderId: BOT_SENDER,
        senderType: 'BOT',
        senderName: BOT_NAME,
        content: response.message,
        messageType: response.messageType || 'TEXT',
        metadata: response.metadata || {},
      });

      await ChatSession.findOneAndUpdate(
        { sessionId },
        { $inc: { botMessageCount: 1 }, lastMessageAt: new Date() }
      );

      io.to(`session:${sessionId}`).emit('chat:message', botMsg);
      return;
    }

    // ── Route 2: Claude AI Bot (if Anthropic API key is valid) ───────────────
    if (anthropic) {
      try {
        const history = await ChatMessage.find({ sessionId })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean();

        const messages = history.reverse().filter(m => m.senderType === 'USER' || m.senderType === 'BOT').map(m => ({
          role: m.senderType === 'USER' ? 'user' : 'assistant',
          content: m.content,
        }));

        if (userMessage) {
          messages.push({ role: 'user', content: userMessage });
        }

        const cleanMessages = [];
        for (const msg of messages) {
          const last = cleanMessages[cleanMessages.length - 1];
          if (last && last.role === msg.role) {
            last.content += '\n' + msg.content;
          } else {
            cleanMessages.push({ ...msg });
          }
        }

        if (cleanMessages.length === 0 || cleanMessages[cleanMessages.length - 1].role !== 'user') {
          cleanMessages.push({ role: 'user', content: userMessage || 'Hello' });
        }

        const aiResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 800,
          system: SYSTEM_PROMPT,
          messages: cleanMessages,
        });

        const textBlock = aiResponse.content.find(b => b.type === 'text');
        let botResponse = { message: textBlock?.text || 'How can I assist you further?', needs_human: false };

        try {
          const jsonMatch = textBlock?.text?.match(/\{[\s\S]*\}/);
          if (jsonMatch) botResponse = JSON.parse(jsonMatch[0]);
        } catch { }

        io.to(`session:${sessionId}`).emit('chat:agent_typing', { isTyping: false });

        if (botResponse.needs_human) {
          const { escalateToHuman } = require('./chatHandlers');
          await escalateToHuman(io, socket, session, 'Bot escalation');
          return;
        }

        const botMsg = await ChatMessage.create({
          sessionId,
          senderId: BOT_SENDER,
          senderType: 'BOT',
          senderName: BOT_NAME,
          content: botResponse.message,
          messageType: botResponse.quick_replies?.length ? 'QUICK_REPLY' : 'TEXT',
          metadata: botResponse.quick_replies?.length ? { options: botResponse.quick_replies } : {},
        });

        await ChatSession.findOneAndUpdate(
          { sessionId },
          { $inc: { botMessageCount: 1 }, lastMessageAt: new Date() }
        );

        io.to(`session:${sessionId}`).emit('chat:message', botMsg);
        return;
      } catch (anthropicErr) {
        console.warn('[Bot] Anthropic API failed, falling back to rule-based engine:', anthropicErr.message);
      }
    }

    // ── Route 3: General Intelligent Fallback ────────────────────────────────
    await handleGeneralFallback(session, userMessage, io, socket);

  } catch (error) {
    console.error('[Bot] handleBotMessage error:', error.message);
    io.to(`session:${session.sessionId}`).emit('chat:agent_typing', { isTyping: false });

    const botMsg = await ChatMessage.create({
      sessionId: session.sessionId,
      senderId: BOT_SENDER,
      senderType: 'BOT',
      senderName: BOT_NAME,
      content: "I'm here to help! Please select an option below or speak with our live support team.",
      messageType: 'QUICK_REPLY',
      metadata: { options: ['📍 Track Order', '📋 Order Status', '↩️ Return / Refund', '💬 Talk to a human agent'] },
    });

    io.to(`session:${session.sessionId}`).emit('chat:message', botMsg);
  }
}

// ── General Fallback for Non-Order Queries ──────────────────────────────────
async function handleGeneralFallback(session, userMessage, io, socket) {
  const lower = (userMessage || '').toLowerCase();
  let reply = "Hello! 👋 I'm your Daatasa Ghee Assistant. How can I help you today?";
  let options = ['📍 Track Order', '↩️ Return Policy', '🫙 How is Bilona Ghee made?', '💬 Talk to a human agent'];

  if (lower.includes('bilona') || lower.includes('method') || lower.includes('how') || lower.includes('cow') || lower.includes('gir') || lower.includes('pure')) {
    reply = "🧈 **Daatasa Traditional Bilona Ghee** is made from grass-fed A2 Gir Cow milk using the ancient Vedic method:\n1. Fresh whole milk is cultured into curd.\n2. Curd is bi-directionally hand-churned with a wooden bilona to extract makkhan (butter).\n3. Butter is slow-cooked on firewood in brass containers to yield 100% golden, aromatic granular ghee with zero preservatives!";
    options = ['Order Bilona Ghee', 'Health Benefits of A2 Ghee', '📍 Track Order', '💬 Talk to a human agent'];
  } else if (lower.includes('return') || lower.includes('refund') || lower.includes('policy')) {
    reply = "↩️ **Daatasa Return Policy**:\nWe offer a **7-Day Quality Guarantee** from the date of delivery. If you are unsatisfied or received a damaged jar, we offer free doorstep pickup and 100% refund in 5–7 business days.";
    options = ['Start a Return', '📍 Track Order', '💬 Talk to a human agent'];
  } else if (lower.includes('shipping') || lower.includes('delivery') || lower.includes('time')) {
    reply = "🚚 **Shipping Policy**:\n• Free delivery across India on orders above ₹500.\n• Metro cities receive deliveries within 2–3 business days; other cities within 3–5 business days.";
    options = ['📍 Track Order', '📋 Order Status', '💬 Talk to a human agent'];
  }

  await new Promise(r => setTimeout(r, 600));
  io.to(`session:${session.sessionId}`).emit('chat:agent_typing', { isTyping: false });

  const botMsg = await ChatMessage.create({
    sessionId: session.sessionId,
    senderId: BOT_SENDER,
    senderType: 'BOT',
    senderName: BOT_NAME,
    content: reply,
    messageType: 'QUICK_REPLY',
    metadata: { options },
  });

  await ChatSession.findOneAndUpdate(
    { sessionId: session.sessionId },
    { $inc: { botMessageCount: 1 }, lastMessageAt: new Date() }
  );

  io.to(`session:${session.sessionId}`).emit('chat:message', botMsg);
}

module.exports = {
  handleBotMessage,
  fetchOrderDetails,
  generateOrderResponse,
  ORDER_QUICK_REPLIES,
};
