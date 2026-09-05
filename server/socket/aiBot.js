// server/socket/aiBot.js
// ── Clean, 100% Self-Service Interactive Customer Support Engine ──────────────
const ChatMessage = require('../models/ChatMessage');
const ChatSession = require('../models/ChatSession');
const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');

const BOT_NAME = 'Ghee Assistant';
const BOT_SENDER = 'BOT';

// ── Helper: Format Order Status (Bilingual) ──────────────────────────────────
function getStatusDetails(order) {
  if (order.orderStatus === 'DELIVERED' || order.isDelivered) {
    return { label: 'Delivered', labelHi: 'डिलीवर हो चुका है', key: 'DELIVERED', color: '#10b981', emoji: '✅' };
  }
  if (order.orderStatus === 'CANCELLED' || order.paymentStatus === 'CANCELLED') {
    return { label: 'Cancelled', labelHi: 'रद्द (Cancelled)', key: 'CANCELLED', color: '#ef4444', emoji: '❌' };
  }
  if (order.orderStatus === 'OUT_FOR_DELIVERY') {
    return { label: 'Out for Delivery', labelHi: 'आज डिलीवरी के लिए निकला है', key: 'OUT_FOR_DELIVERY', color: '#3b82f6', emoji: '🚚' };
  }
  if (order.orderStatus === 'PICKED_UP' || order.orderStatus === 'ASSIGNED_TO_COURIER' || order.orderStatus === 'SHIPPED') {
    return { label: 'Shipped (In Transit)', labelHi: 'भेज दिया गया है (रास्ते में है)', key: 'SHIPPED', color: '#6366f1', emoji: '📦' };
  }
  if (order.orderStatus === 'ACCEPTED' || order.isPaid) {
    return { label: 'Processing', labelHi: 'तैयार किया जा रहा है (Processing)', key: 'PROCESSING', color: '#f59e0b', emoji: '⏳' };
  }
  if (order.paymentStatus === 'COD_CONFIRMED' || order.orderStatus === 'PENDING_ACCEPTANCE' || order.orderStatus === 'CONFIRMED') {
    return { label: 'Order Confirmed', labelHi: 'ऑर्डर कन्फर्म हो चुका है', key: 'CONFIRMED', color: '#f59e0b', emoji: '📝' };
  }
  return {
    label: order.orderStatus ? order.orderStatus.replace(/_/g, ' ') : 'Pending',
    labelHi: order.orderStatus ? order.orderStatus.replace(/_/g, ' ') : 'लंबित (Pending)',
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

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
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

// ── Deterministic Bilingual Order Intelligence Engine ────────────────────────
async function generateOrderResponse(order, queryText, subIssue = null, language = 'en') {
  const isHindi = language === 'hi';

  if (!order) {
    return {
      message: isHindi
        ? "मुझे इस ऑर्डर का विवरण नहीं मिल सका। कृपया सुनिश्चित करें कि ऑर्डर ID सही है, या हमारी सहायता टीम से संपर्क करें।"
        : "I could not find the details for this order. Please make sure the order ID is correct, or speak with our support team.",
      messageType: 'QUICK_REPLY',
      metadata: {
        options: isHindi
          ? ['💬 एजेंट से बात करें', 'सामान्य प्रश्न देखें']
          : ['💬 Talk to a human agent', 'Browse FAQs'],
      },
    };
  }

  const orderShortId = order._id.toString().slice(-6).toUpperCase();
  const statusInfo = getStatusDetails(order);
  const currentStatusLabel = isHindi ? statusInfo.labelHi : statusInfo.label;
  const items = order.orderItems || [];
  const totalPrice = Number(order.totalPrice ?? 0).toLocaleString('en-IN');
  const orderDate = new Date(order.createdAt).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const courierName = order.shippingProvider || 'Daatasa Express Courier';
  const trackingNo = order.trackingNumber || `DT-${order._id.toString().slice(-8).toUpperCase()}`;

  const itemSummary = items.map(i => {
    const name = i.name || i.product?.name || (isHindi ? 'वैदिक बिलोना गाय का घी' : 'Vedic Bilona Cow Ghee');
    return isHindi
      ? `• ${name} (मात्रा: ${i.quantity || 1}, ₹${Number(i.price || 0).toLocaleString('en-IN')})`
      : `• ${name} (Qty: ${i.quantity || 1}, ₹${Number(i.price || 0).toLocaleString('en-IN')})`;
  }).join('\n');

  const orderCardMetadata = {
    orderId: order._id.toString(),
    status: statusInfo.key,
    statusLabel: currentStatusLabel,
    items: items.map(i => ({
      name: i.name || i.product?.name || (isHindi ? 'वैदिक गाय का घी' : 'Vedic Cow Ghee'),
      quantity: i.quantity || 1,
      price: i.price,
      image: i.image || i.product?.image || null,
    })),
    totalPrice,
    courierName,
    trackingNo,
  };

  const textLower = (queryText || '').toLowerCase();
  const issueKey = (subIssue || '').toUpperCase();
  
  const statusKey = statusInfo.key;
  const isDelivered = statusKey === 'DELIVERED';
  const isShipped = statusKey === 'SHIPPED' || statusKey === 'OUT_FOR_DELIVERY';
  const isCancelled = statusKey === 'CANCELLED';
  const isOut = statusKey === 'OUT_FOR_DELIVERY';

  // ── INTENT 1: LIVE TRACKING ───────────────────────────────────────────────
  if (issueKey === 'TRACK' || textLower.includes('track') || textLower.includes('ट्रैक') || textLower.includes('kahan') || textLower.includes('कहाँ')) {
    let trackingMsg = '';
    let trackingOptions = [];

    if (isDelivered) {
      trackingMsg = isHindi
        ? `📍 **ऑर्डर #${orderShortId} डिलीवर हो चुका है!**\n\n` +
          `• **डिलीवरी पार्टनर**: ${courierName}\n` +
          `• **ट्रैकिंग नंबर**: \`${trackingNo}\`\n` +
          `• **डिलीवरी स्थिति**: ✅ सुरक्षित रूप से आपके पते पर पहुंचा दिया गया है।\n\n` +
          `यदि आपको पैकेज में कोई समस्या आई है, तो आप 7 दिनों के भीतर रिटर्न/रिप्लेसमेंट ले सकते हैं:`
        : `📍 **Order #${orderShortId} has been Delivered!**\n\n` +
          `• **Courier Partner**: ${courierName}\n` +
          `• **Tracking / AWB**: \`${trackingNo}\`\n` +
          `• **Delivery Status**: ✅ Delivered safely to your shipping address.\n\n` +
          `If you experienced any issue with your package, you can request a return within 7 days:`;
      trackingOptions = isHindi
        ? ['↩️ 7-दिन रिटर्न / रिफंड', '⚠️ उत्पाद समस्या', '💬 एजेंट से बात करें']
        : ['↩️ 7-Day Return / Refund', '⚠️ Product Issue', '💬 Talk to a human agent'];
    } else if (isShipped) {
      trackingMsg = isHindi
        ? `🚚 **ऑर्डर #${orderShortId} लाइव ट्रैकिंग**\n\n` +
          `• **कूरियर**: ${courierName}\n` +
          `• **AWB नंबर**: \`${trackingNo}\`\n` +
          `• **स्थिति**: ${isOut ? '🛵 आज आपके पते पर डिलीवरी के लिए निकल चुका है!' : '📦 कूरियर हब से आपके शहर के लिए रवाना हो चुका है।'}\n` +
          `• **अनुमानित डिलीवरी**: अगले 24–48 घंटों में।`
        : `🚚 **Order #${orderShortId} Live Tracking**\n\n` +
          `• **Courier**: ${courierName}\n` +
          `• **AWB Number**: \`${trackingNo}\`\n` +
          `• **Status**: ${isOut ? '🛵 Out for delivery today to your address!' : '📦 In transit to your nearest delivery hub.'}\n` +
          `• **Estimated Delivery**: Within next 24–48 hours.`;
      trackingOptions = isHindi
        ? ['🚚 डिलीवरी सहायता', '❌ ऑर्डर कैंसिल (डोरस्टेप RTO)', '💬 एजेंट से बात करें']
        : ['🚚 Delivery Help', '❌ Cancel Order (Doorstep RTO)', '💬 Talk to a human agent'];
    } else {
      // Confirmed, Processing, Pending
      trackingMsg = isHindi
        ? `⏳ **ऑर्डर #${orderShortId} ट्रैकिंग**\n\n` +
          `• **स्थिति**: 📝 ${currentStatusLabel}\n` +
          `• **तैयारी**: हमारा शुद्ध वैदिक बिलोना घी ताजगी के साथ पैक किया जा रहा है।\n` +
          `• **डिस्पैच**: 24 घंटे के भीतर कूरियर को सौंपा जाएगा। डिस्पैच होते ही SMS/Email पर लाइव AWB ट्रैकिंग लिंक मिलेगा!`
        : `⏳ **Order #${orderShortId} Tracking**\n\n` +
          `• **Status**: 📝 ${statusInfo.label}\n` +
          `• **Preparation**: Your fresh Vedic Bilona Ghee is being packaged.\n` +
          `• **Dispatch**: Will be handed over to the courier within 24 hours. Tracking link will be sent via SMS/Email upon dispatch!`;
      trackingOptions = isHindi
        ? ['❌ ऑर्डर कैंसिल करें', '📋 ऑर्डर स्थिति', '💬 एजेंट से बात करें']
        : ['❌ Cancel Order', '📋 Order Status', '💬 Talk to a human agent'];
    }

    return {
      message: trackingMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: trackingOptions,
      },
    };
  }

  // ── INTENT 2: ORDER STATUS & INVOICE SUMMARY ───────────────────────────────
  if (issueKey === 'STATUS' || textLower.includes('status') || textLower.includes('स्थिति') || textLower.includes('bill') || textLower.includes('बिल') || textLower.includes('invoice')) {
    const address = order.shippingAddress;
    const addrStr = address ? `${address.street || ''}, ${address.city || ''}, ${address.state || ''} - ${address.zipCode || ''}` : '';

    const statusMsg = isHindi
      ? `📋 **ऑर्डर #${orderShortId} सारांश**\n\n` +
        `• **स्थिति**: ${statusInfo.emoji} ${currentStatusLabel}\n` +
        `• **तारीख**: ${orderDate}\n` +
        `• **कुल राशि**: ₹${totalPrice} (${order.isPaid ? '✅ ऑनलाइन भुगतान प्राप्त' : '💵 कैश ऑन डिलीवरी (COD)'})\n` +
        (addrStr ? `• **डिलीवरी पता**: ${addrStr}\n\n` : '\n') +
        `**ऑर्डर किए गए उत्पाद**:\n${itemSummary}`
      : `📋 **Order #${orderShortId} Details**\n\n` +
        `• **Status**: ${statusInfo.emoji} ${statusInfo.label}\n` +
        `• **Date**: ${orderDate}\n` +
        `• **Total Amount**: ₹${totalPrice} (${order.isPaid ? '✅ Paid Online' : '💵 Cash on Delivery'})\n` +
        (addrStr ? `• **Delivery Address**: ${addrStr}\n\n` : '\n') +
        `**Order Items**:\n${itemSummary}`;

    let statusOptions = [];
    if (isDelivered) {
      statusOptions = isHindi
        ? ['↩️ 7-दिन रिटर्न / रिफंड', '⚠️ उत्पाद समस्या', '💬 एजेंट से बात करें']
        : ['↩️ 7-Day Return / Refund', '⚠️ Product Issue', '💬 Talk to a human agent'];
    } else if (isCancelled) {
      statusOptions = isHindi
        ? ['💳 रिफंड स्थिति चेक करें', '🫙 नए उत्पाद देखें', '💬 एजेंट से बात करें']
        : ['💳 Check Refund Status', '🫙 Browse Products', '💬 Talk to a human agent'];
    } else {
      statusOptions = isHindi
        ? ['❌ ऑर्डर कैंसिल करें', '📍 ऑर्डर ट्रैक करें', '💬 एजेंट से बात करें']
        : ['❌ Cancel Order', '📍 Track Order', '💬 Talk to a human agent'];
    }

    return {
      message: statusMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: statusOptions,
      },
    };
  }

  // ── INTENT 3: CANCEL ORDER (Direct Self-Service DB Execution) ───────────────
  const isCancelQuery =
    issueKey === 'CANCEL' ||
    textLower.includes('cancel') ||
    textLower.includes('cancle') ||
    textLower.includes('canr') ||
    textLower.includes('cant') ||
    textLower.includes('कैंसिल') ||
    textLower.includes('रद्द') ||
    textLower.includes('रोकें') ||
    textLower.includes('बंद करें');

  if (isCancelQuery) {
    let cancelMsg = '';
    let cancelOptions = [];

    if (isCancelled) {
      cancelMsg = isHindi
        ? `❌ **ऑर्डर #${orderShortId} पहले से ही रद्द (Cancelled) है**\n\n` +
          `• **रिफंड राशि**: ₹${totalPrice}\n` +
          `• **रिफंड स्थिति**: यदि यह प्रीपेड ऑर्डर था, तो रिफंड 5–7 कार्य दिवसों में आपके मूल बैंक / UPI खाते में जमा हो जाएगा।\n\n` +
          `अधिक सहायता के लिए नीचे सहायता टीम से संपर्क करें।`
        : `❌ **Order #${orderShortId} is already Cancelled**\n\n` +
          `• **Refund Amount**: ₹${totalPrice}\n` +
          `• **Refund Status**: If this was a prepaid order, the refund is processed within 5–7 business days back to your original payment method.\n\n` +
          `Feel free to connect with our support team for any questions.`;
      cancelOptions = isHindi ? ['रिफंड स्थिति चेक करें', '💬 एजेंट से बात करें'] : ['Check Refund Status', '💬 Talk to a human agent'];
    } else if (isDelivered) {
      cancelMsg = isHindi
        ? `📦 **ऑर्डर #${orderShortId} पहले ही डिलीवर हो चुका है**\n\n` +
          `यह ऑर्डर डिलीवर हो चुका है, इसलिए इसे सीधे कैंसिल नहीं किया जा सकता।\n\n` +
          `✨ **लेकिन आप 7 दिन के अंदर रिटर्न / रिफंड का अनुरोध कर सकते हैं!**\n` +
          `• 100% रिफंड या फ्री रिप्लेसमेंट।\n` +
          `• कूरियर द्वारा फ्री डोरस्टेप पिकअप।`
        : `📦 **Order #${orderShortId} has already been Delivered**\n\n` +
          `Since the package is already delivered, it cannot be cancelled directly.\n\n` +
          `✨ **However, you can request a 7-Day Return / Refund!**\n` +
          `• 100% refund of ₹${totalPrice} or free replacement.\n` +
          `• Free doorstep reverse pickup by our courier.`;
      cancelOptions = isHindi ? ['↩️ 7-दिन रिटर्न / रिफंड', '💬 एजेंट से बात करें'] : ['↩️ 7-Day Return / Refund', '💬 Talk to a human agent'];
    } else if (isShipped) {
      cancelMsg = isHindi
        ? `🚚 **ऑर्डर #${orderShortId} रास्ते में है (डिस्पैच हो चुका है)**\n\n` +
          `• **कूरियर**: ${courierName}\n` +
          `• **AWB नंबर**: ${trackingNo}\n\n` +
          `चूंकि पैकेज कूरियर पार्टनर को सौंपा जा चुका है, इसलिए सिस्टम से डायरेक्ट कैंसिलेशन संभव नहीं है।\n\n` +
          `💡 **आसान समाधान**:\n` +
          `जब डिलीवरी बॉय पैकेज लेकर आए, तो आप डिलीवरी लेने से मना (Refuse Delivery) कर सकते हैं। पैकेज वापस आते ही आपका ₹${totalPrice} का 100% रिफंड जारी कर दिया जाएगा!`
        : `🚚 **Order #${orderShortId} is in Transit (Already Shipped)**\n\n` +
          `• **Courier**: ${courierName}\n` +
          `• **AWB Number**: ${trackingNo}\n\n` +
          `Since the package is with the courier partner, online cancellation is no longer possible.\n\n` +
          `💡 **Easy Solution**:\n` +
          `You can simply refuse delivery at your doorstep when the courier arrives (Doorstep RTO). Once the package returns, your 100% refund of ₹${totalPrice} will be processed immediately!`;
      cancelOptions = isHindi ? ['📍 ऑर्डर ट्रैक करें', '💬 एजेंट से बात करें'] : ['📍 Track Order', '💬 Talk to a human agent'];
    } else {
      // Pending, Confirmed, Processing
      if (textLower.includes('पुष्टि') || textLower.includes('confirm order cancellation') || textLower.includes('confirm cancel')) {
        try {
          // 1. Restore all resources (variant stock, wallet, gift card, coupon count, net Razorpay refund)
          const { restoreOrderResources } = require('../utils/orderResourceHelper');
          const restoreResult = await restoreOrderResources(order, 'Cancelled via Self-Service Support Assistant');
          const refundInfo = restoreResult.razorpayRefund || (restoreResult.walletRefunded > 0 ? {
            status: 'PROCESSED',
            amount: restoreResult.walletRefunded,
            initiatedAt: new Date(),
            note: 'Refunded to Daatasa Wallet'
          } : null);

          // 2. Update database record with correct schema fields
          const updatePayload = {
            orderStatus: 'CANCELLED',
            paymentStatus: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: 'user',
            cancelReason: 'Cancelled via Self-Service Support Assistant',
            $push: {
              statusHistory: {
                status: 'CANCELLED',
                note: `Order cancelled via Self-Service Support Assistant.${restoreResult.walletRefunded > 0 ? ` Wallet refunded: ₹${restoreResult.walletRefunded}.` : ''}`,
                updatedAt: new Date(),
              },
            },
          };
          if (refundInfo) updatePayload.refundInfo = refundInfo;

          const updatedDoc = await Order.findByIdAndUpdate(
            order._id,
            updatePayload,
            { new: true }
          ).populate('orderItems.product', 'name image price weight').lean();

          if (updatedDoc) {
            order = updatedDoc;
          }

          // 4. Update card metadata status to CANCELLED
          orderCardMetadata.status = 'CANCELLED';
          orderCardMetadata.statusLabel = isHindi ? 'रद्द (Cancelled)' : 'Cancelled';

          // 5. Send cancellation email (non-fatal)
          try {
            const { sendCancelEmail } = require('../services/emailService');
            const destEmail = order.user?.email || order.guestEmail;
            const destName = order.user?.name || order.shippingAddress?.name || 'Customer';
            if (destEmail) {
              await sendCancelEmail({
                to: destEmail,
                userName: destName,
                orderId: order._id.toString(),
                totalPrice: order.totalPrice,
                reason: 'Cancelled via Self-Service Support Assistant',
                isRefund: !!refundInfo,
                refundId: refundInfo?.refund_id,
              });
            }
          } catch (emailErr) {
            console.error('[Bot] Cancel email error:', emailErr.message);
          }

          // 6. Real-time socket broadcast to order room & user room
          try {
            const { getIO } = require('./index');
            const ioInstance = getIO();
            ioInstance.to(`order:${order._id}`).emit('orderStatusUpdated', updatedDoc || order);
            if (order.user) {
              const uId = (order.user._id || order.user).toString();
              ioInstance.to(`user:${uId}`).emit('orderStatusUpdated', updatedDoc || order);
            }
          } catch (socketErr) {
            console.error('[Bot] Socket broadcast error:', socketErr.message);
          }

          const refundDetailsMsg = (restoreResult.walletRefunded > 0 && restoreResult.razorpayRefund)
            ? (isHindi
                ? `• **वॉलेट रिफंड**: ₹${restoreResult.walletRefunded} (तुरंत आपके दातसा वॉलेट में)\n• **ऑनलाइन रिफंड**: ₹${restoreResult.razorpayRefund.amount} (मूल बैंक खाते में 5–7 दिन)`
                : `• **Wallet Refund**: ₹${restoreResult.walletRefunded} (Credited instantly to your Daatasa Wallet)\n• **Online Refund**: ₹${restoreResult.razorpayRefund.amount} (Credited to original source in 5–7 days)`)
            : (restoreResult.walletRefunded > 0
                ? (isHindi ? `• **वॉलेट रिफंड**: ₹${restoreResult.walletRefunded} (तुरंत दातसा वॉलेट में क्रेडिट)` : `• **Wallet Refund**: ₹${restoreResult.walletRefunded} (Credited instantly to your Daatasa Wallet)`)
                : (isHindi ? `• **रिफंड राशि**: ₹${restoreResult.razorpayRefund?.amount || totalPrice}` : `• **Refund Amount**: ₹${restoreResult.razorpayRefund?.amount || totalPrice}`));

          cancelMsg = isHindi
            ? `✅ **ऑर्डर #${orderShortId} सफलतापूर्वक रद्द (Cancelled) कर दिया गया है!**\n\n` +
              `${refundDetailsMsg}\n` +
              `• **रिफंड समयावधि**: 5–7 कार्य दिवस (ऑनलाइन भुगतान हेतु)\n\n` +
              `पुष्टिकरण सूचना भेज दी गई है। यदि आपको कोई अन्य सहायता चाहिए, तो नीचे चुनें:`
            : `✅ **Order #${orderShortId} has been Successfully Cancelled!**\n\n` +
              `${refundDetailsMsg}\n` +
              `• **Refund Timeline**: 5–7 business days (for online gateway refunds)\n\n` +
              `A confirmation notification has been sent. Feel free to explore our products or talk to an agent:`;
          cancelOptions = isHindi
            ? ['🫙 शुद्ध घी उत्पाद देखें', '💬 एजेंट से बात करें']
            : ['🫙 View Ghee Products', '💬 Talk to a human agent'];
        } catch (cErr) {
          console.error('[Bot] Order cancel error:', cErr.message);
        }
      } else {
        cancelMsg = isHindi
          ? `❌ **ऑर्डर #${orderShortId} कैंसिलेशन अनुरोध**\n\n` +
            `• **ऑर्डर स्थिति**: ${statusInfo.emoji} ${currentStatusLabel}\n` +
            `• **ऑर्डर मूल्य**: ₹${totalPrice} (${items.length} आइटम)\n\n` +
            `✅ आपका ऑर्डर अभी डिस्पैच नहीं हुआ है, इसलिए इसे कैंसिल किया जा सकता है!\n\n` +
            `• **रिफंड**: यदि प्रीपेड भुगतान किया था, तो पूरा ₹${totalPrice} आपके बैंक खाते / UPI में 5–7 दिनों में वापस आ जाएगा।\n\n` +
            `कैंसिल करने के लिए नीचे **"❌ ऑर्डर कैंसिल की पुष्टि करें"** पर टैप करें:`
          : `❌ **Cancellation Request — Order #${orderShortId}**\n\n` +
            `• **Order Status**: ${statusInfo.emoji} ${statusInfo.label}\n` +
            `• **Order Value**: ₹${totalPrice} (${items.length} item${items.length !== 1 ? 's' : ''})\n\n` +
            `✅ Your order has not been dispatched yet and is eligible for cancellation!\n\n` +
            `• **Refund**: If prepaid, the entire amount of ₹${totalPrice} will be credited back to your original payment method in 5–7 business days.\n\n` +
            `To proceed, tap **"❌ Confirm Order Cancellation"** below:`;
        cancelOptions = isHindi
          ? ['❌ ऑर्डर कैंसिल की पुष्टि करें', '📍 ऑर्डर ट्रैक करें', '💬 एजेंट से बात करें']
          : ['❌ Confirm Order Cancellation', '📍 Track Order', '💬 Talk to a human agent'];
      }
    }

    return {
      message: cancelMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: cancelOptions,
      },
    };
  }

  // ── INTENT 4: RETURN / REFUND ─────────────────────────────────────────────
  if (issueKey === 'RETURN' || textLower.includes('return') || textLower.includes('refund') || textLower.includes('रिटर्न') || textLower.includes('रिफंड') || textLower.includes('वापस')) {
    let returnMsg = '';
    let returnOptions = [];

    if (!isDelivered) {
      returnMsg = isHindi
        ? `↩️ **रिटर्न / रिफंड — ऑर्डर #${orderShortId}**\n\n` +
          `आपका ऑर्डर अभी **${currentStatusLabel}** है और अभी तक डिलीवर नहीं हुआ है।\n\n` +
          `• रिटर्न का अनुरोध ऑर्डर डिलीवर होने के बाद 7 दिनों के भीतर शुरू किया जा सकता है।\n` +
          `• यदि आप डिस्पैच से पहले इस ऑर्डर को रद्द (Cancel) करना चाहते हैं, तो नीचे कैंसिलेशन चुनें:`
        : `↩️ **Return / Refund — Order #${orderShortId}**\n\n` +
          `Your order is currently **${statusInfo.label}** and has not been delivered yet.\n\n` +
          `• Return requests can be initiated within 7 days once the package is delivered.\n` +
          `• If you wish to cancel this order before dispatch, you can cancel below:`;
      returnOptions = isHindi
        ? ['❌ ऑर्डर कैंसिल करें', '📍 ऑर्डर ट्रैक करें', '💬 एजेंट से बात करें']
        : ['❌ Cancel Order', '📍 Track Order', '💬 Talk to a human agent'];
    } else {
      const deliveryDate = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.updatedAt || order.createdAt);
      const daysPassed = Math.floor((Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, 7 - daysPassed);

      if (daysLeft > 0) {
        returnMsg = isHindi
          ? `↩️ **7-दिन रिटर्न व रिफंड गारंटी — ऑर्डर #${orderShortId}**\n\n` +
            `✅ **यह ऑर्डर रिटर्न के लिए पात्र है** (7-दिन की विंडो में से ${daysLeft} दिन शेष हैं)।\n\n` +
            `दातासा की **7-दिन बिलोना घी गारंटी** के तहत:\n` +
            `• ₹${totalPrice} का 100% रिफंड या फ्री रिप्लेसमेंट।\n` +
            `• हमारे कूरियर द्वारा फ्री डोरस्टेप रिवर्स पिकअप।\n` +
            `• रिफंड 5–7 कार्य दिवसों में सीधे आपके मूल भुगतान स्रोत में ट्रांसफर हो जाता है।`
          : `↩️ **7-Day Return & Refund Guarantee — Order #${orderShortId}**\n\n` +
            `✅ **Eligible for Return** (${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining in your 7-day window).\n\n` +
            `Under Daatasa's **7-Day Bilona Ghee Guarantee**:\n` +
            `• 100% refund of ₹${totalPrice} or free replacement.\n` +
            `• Free doorstep reverse pickup by our courier.\n` +
            `• Refunds are credited back to your original payment method within 5–7 business days.`;
        returnOptions = isHindi
          ? ['💬 एजेंट से रिटर्न शुरू करें', '⚠️ उत्पाद समस्या (फ्री रिप्लेसमेंट)', '💬 एजेंट से बात करें']
          : ['💬 Start Return with Agent', '⚠️ Product Issue (Replacement)', '💬 Talk to a human agent'];
      } else {
        returnMsg = isHindi
          ? `↩️ **रिटर्न पॉलिसी — ऑर्डर #${orderShortId}**\n\n` +
            `यह ऑर्डर डिलीवरी के 7 दिन से अधिक पुराना हो चुका है।\n\n` +
            `यदि आपको कोई विशेष गुणवत्ता संबंधी समस्या आई है, तो मैन्युअल समीक्षा के लिए नीचे सहायता टीम से संपर्क करें।`
          : `↩️ **Return Policy — Order #${orderShortId}**\n\n` +
            `This order was delivered more than 7 days ago.\n\n` +
            `If you experienced an exceptional quality issue, please connect with our support team below for assistance.`;
        returnOptions = isHindi ? ['💬 एजेंट से बात करें', 'सामान्य प्रश्न देखें'] : ['💬 Talk to a human agent', 'Browse FAQs'];
      }
    }

    return {
      message: returnMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: returnOptions,
      },
    };
  }

  // ── INTENT 5: PRODUCT QUALITY ISSUE ───────────────────────────────────────
  if (issueKey === 'PRODUCT' || textLower.includes('product') || textLower.includes('उत्पाद') || textLower.includes('damaged') || textLower.includes('leak') || textLower.includes('खराब')) {
    const productMsg = isHindi
      ? `⚠️ **उत्पाद गुणवत्ता गारंटी — ऑर्डर #${orderShortId}**\n\n` +
        `आपने ऑर्डर किया था:\n${itemSummary}\n\n` +
        `दातासा में A2 वैदिक गाय का घी बिना किसी केमिकल के पारंपरिक बिलोना विधि से तैयार किया जाता है।\n\n` +
        `✨ **हमारी गारंटी**:\n` +
        `यदि आपको टूटा हुआ सील, लीकेज, टूटा हुआ जार मिला है या शुद्धता से जुड़ी कोई चिंता है, तो हम **तुरंत फ्री रिप्लेसमेंट** या **100% रिफंड** प्रदान करते हैं!\n\n` +
        `📷 आप नीचे एजेंट से चैट करके फोटो साझा कर सकते हैं, हमारी टीम तुरंत प्रक्रिया शुरू करेगी।`
      : `⚠️ **Product Quality Guarantee — Order #${orderShortId}**\n\n` +
        `You ordered:\n${itemSummary}\n\n` +
        `At Daatasa, every batch of A2 Vedic Cow Ghee is traditionally prepared using the bilona method with zero chemicals.\n\n` +
        `✨ **Our Guarantee**:\n` +
        `If you received a broken seal, leakage, broken jar, or have any purity/quality concern, we offer an **Instant Free Replacement** or **100% Refund**!\n\n` +
        `📷 You can chat with an agent below and share a photo for instant processing.`;

    return {
      message: productMsg,
      messageType: 'ORDER_CARD',
      metadata: {
        ...orderCardMetadata,
        options: isHindi
          ? ['💬 एजेंट से रिप्लेसमेंट मांगें', '📍 ऑर्डर ट्रैक करें', '💬 एजेंट से बात करें']
          : ['💬 Request Replacement with Agent', '📍 Track Order', '💬 Talk to a human agent'],
      },
    };
  }

  // ── INTENT 6: DEFAULT ORDER WELCOME (Status-Aware Contextual Menu) ────────
  let contextOptions = [];
  if (isDelivered) {
    contextOptions = isHindi
      ? ['↩️ 7-दिन रिटर्न / रिफंड', '⚠️ उत्पाद समस्या (रिप्लेसमेंट)', '📋 इनवॉइस व सारांश', '💬 एजेंट से बात करें']
      : ['↩️ 7-Day Return / Refund', '⚠️ Product Issue (Replacement)', '📋 Invoice & Summary', '💬 Talk to a human agent'];
  } else if (isCancelled) {
    contextOptions = isHindi
      ? ['💳 रिफंड स्थिति चेक करें', '🫙 शुद्ध घी उत्पाद देखें', '💬 एजेंट से बात करें']
      : ['💳 Check Refund Status', '🫙 View Ghee Products', '💬 Talk to a human agent'];
  } else if (isShipped) {
    contextOptions = isHindi
      ? ['📍 लाइव कूरियर ट्रैकिंग', '🚚 डिलीवरी सहायता', '❌ ऑर्डर कैंसिल (डोरस्टेप RTO)', '💬 एजेंट से बात करें']
      : ['📍 Live Courier Tracking', '🚚 Delivery Assistance', '❌ Cancel Order (Doorstep RTO)', '💬 Talk to a human agent'];
  } else {
    // Pending, Confirmed, Processing (Prominent CANCEL button!)
    contextOptions = isHindi
      ? ['❌ ऑर्डर कैंसिल करें', '📍 ऑर्डर ट्रैक करें', '📋 ऑर्डर स्थिति', '💬 एजेंट से बात करें']
      : ['❌ Cancel Order', '📍 Track Order', '📋 Order Status', '💬 Talk to a human agent'];
  }

  const welcomeMsg = isHindi
    ? `मैं इस ऑर्डर के बारे में आपकी क्या सहायता कर सकता हूँ? नीचे विकल्प चुनें:`
    : `How can I assist you with this order? Select an option below:`;

  return {
    message: welcomeMsg,
    messageType: 'ORDER_CARD',
    metadata: {
      ...orderCardMetadata,
      options: contextOptions,
    },
  };
}

// ── Helper: Smart Order Finder for Logged-in & Guest Users ──────────────────
async function resolveUserOrder(session, userMessage) {
  const text = (userMessage || '').trim();
  const textLower = text.toLowerCase();

  // 1. If session already has orderId, fetch that order
  if (session.orderId) {
    const ord = await fetchOrderDetails(session.orderId, session.userId);
    if (ord) return { order: ord, multipleOrders: null };
  }

  // 2. Check if user typed or clicked a specific order ID in message
  const hexMatch = text.match(/\b([0-9a-fA-F]{24})\b/);
  const shortIdMatch = text.match(/#([0-9a-zA-Z]{5,8})\b/) || text.match(/\b([0-9a-zA-Z]{6,8})\b/);

  if (hexMatch) {
    const found = await fetchOrderDetails(hexMatch[1]);
    if (found) {
      await ChatSession.findOneAndUpdate({ sessionId: session.sessionId }, { orderId: found._id });
      return { order: found, multipleOrders: null };
    }
  }

  if (shortIdMatch && (textLower.includes('order') || text.includes('#') || text.length <= 14)) {
    const shortCode = (shortIdMatch[1] || shortIdMatch[0]).replace('#', '').toLowerCase();
    const query = session.userId ? { user: session.userId } : {};
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('orderItems.product', 'name image price weight')
      .lean();

    const matched = orders.find(o =>
      o._id.toString().toLowerCase().endsWith(shortCode) ||
      (o.orderIdString && o.orderIdString.toLowerCase().includes(shortCode))
    );

    if (matched) {
      await ChatSession.findOneAndUpdate({ sessionId: session.sessionId }, { orderId: matched._id });
      return { order: matched, multipleOrders: null };
    }
  }

  // 3. If user is logged in (session.userId) and asks about orders/tracking/cancel/refund
  const isOrderQuery =
    textLower.includes('track') ||
    textLower.includes('order') ||
    textLower.includes('status') ||
    textLower.includes('delivery') ||
    textLower.includes('cancel') ||
    textLower.includes('cancle') ||
    textLower.includes('canr') ||
    textLower.includes('cant') ||
    textLower.includes('refund') ||
    textLower.includes('return') ||
    textLower.includes('kahan') ||
    textLower.includes('kab aayega') ||
    textLower.includes('mera order') ||
    textLower.includes('ऑर्डर') ||
    textLower.includes('ट्रैक') ||
    textLower.includes('कैंसिल') ||
    textLower.includes('रद्द') ||
    textLower.includes('वापस') ||
    textLower.includes('रिफंड') ||
    textLower.includes('रिटर्न');

  if (session.userId && isOrderQuery) {
    const userOrders = await Order.find({ user: session.userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('orderItems.product', 'name image price weight')
      .lean();

    if (userOrders.length === 1) {
      await ChatSession.findOneAndUpdate({ sessionId: session.sessionId }, { orderId: userOrders[0]._id });
      return { order: userOrders[0], multipleOrders: null };
    } else if (userOrders.length > 1) {
      return { order: null, multipleOrders: userOrders };
    } else {
      return { order: null, multipleOrders: [], noOrders: true };
    }
  }

  // 4. Guest user asks to track order without an ID
  if (!session.userId && (textLower.includes('track order') || textLower.includes('where is my order') || textLower === '📍 track order')) {
    return { order: null, multipleOrders: null, promptGuestOrderId: true };
  }

  return { order: null, multipleOrders: null };
}

// ── Main Self-Service Support Bot Entry Point ─────────────────────────────────
async function handleBotMessage(session, userMessage, io, socket, mode = 'normal') {
  try {
    const sessionId = session.sessionId;

    // Detect user/website language (Hindi vs English)
    const userText = (userMessage || '').trim();
    let sessionLang = session.language;
    if (!sessionLang) {
      const dbSession = await ChatSession.findOne({ sessionId }).select('language').lean();
      sessionLang = dbSession?.language;
    }
    const hasDevanagari = /[\u0900-\u097F]/.test(userText);
    const isUserHindi = hasDevanagari || (sessionLang && sessionLang.toLowerCase().startsWith('hi'));
    const activeLang = isUserHindi ? 'hi' : 'en';

    // Check if user requested human escalation
    const lower = userText.toLowerCase();
    if (lower.includes('human') || lower.includes('agent') || lower.includes('person') || lower.includes('speak to someone') || lower.includes('talk to a human') || lower.includes('एजेंट')) {
      const { escalateToHuman } = require('./chatHandlers');
      await escalateToHuman(io, socket, session, 'User requested human agent');
      return;
    }

    // Emit typing indicator
    io.to(`session:${sessionId}`).emit('chat:agent_typing', { isTyping: true });

    // ── Check Order Context & Auto-Discovery ──────────────────────────────────
    const { order, multipleOrders, noOrders, promptGuestOrderId } = await resolveUserOrder(session, userMessage);

    // If multiple recent orders found for logged in user
    if (multipleOrders && multipleOrders.length > 0) {
      const isHindi = activeLang === 'hi';
      const options = multipleOrders.map(o => {
        const shortId = o._id.toString().slice(-6).toUpperCase();
        const status = getStatusDetails(o).label;
        const price = Number(o.totalPrice || 0).toLocaleString('en-IN');
        return isHindi
          ? `📦 ऑर्डर #${shortId} (₹${price} • ${status})`
          : `📦 Order #${shortId} (₹${price} • ${status})`;
      });
      options.push(isHindi ? '💬 एजेंट से बात करें' : '💬 Talk to a human agent');

      await new Promise(r => setTimeout(r, 400));
      io.to(`session:${sessionId}`).emit('chat:agent_typing', { isTyping: false });

      const contentMsg = isHindi
        ? `📋 **आपके हालिया ऑर्डर्स**\n\nआपके खाते में ${multipleOrders.length} ऑर्डर्स मिले हैं। आप किस ऑर्डर की जानकारी देखना चाहते हैं? नीचे चुनें:`
        : `📋 **Your Recent Orders**\n\nFound ${multipleOrders.length} orders on your account. Which order would you like help with? Select below:`;

      const botMsg = await ChatMessage.create({
        sessionId,
        senderId: BOT_SENDER,
        senderType: 'BOT',
        senderName: BOT_NAME,
        content: contentMsg,
        messageType: 'QUICK_REPLY',
        metadata: { options },
      });

      await ChatSession.findOneAndUpdate(
        { sessionId },
        { $inc: { botMessageCount: 1 }, lastMessageAt: new Date() }
      );

      io.to(`session:${sessionId}`).emit('chat:message', botMsg);
      return;
    }

    // If logged in user asked for order but has zero orders
    if (noOrders) {
      const isHindi = activeLang === 'hi';
      await new Promise(r => setTimeout(r, 400));
      io.to(`session:${sessionId}`).emit('chat:agent_typing', { isTyping: false });

      const contentMsg = isHindi
        ? `🔍 **कोई एक्टिव ऑर्डर नहीं मिला**\n\nआपके अकाउंट पर अभी कोई ऑर्डर नहीं मिला।\n\nक्या आप शुद्ध वैदिक A2 बिलोना घी के बारे में जानना चाहते हैं? नीचे विकल्प चुनें:`
        : `🔍 **No Active Orders Found**\n\nNo orders were found on your account.\n\nWould you like to explore our pure Vedic A2 Bilona Ghee? Select an option below:`;

      const defaultOptions = isHindi
        ? ['🫙 बिलोना घी कैसे बनता है?', '🥛 A2 गाय vs भैंस का घी', '↩️ रिटर्न पॉलिसी', '💬 एजेंट से बात करें']
        : ['🫙 How is Bilona Ghee made?', '🥛 A2 Cow vs Buffalo Ghee', '↩️ Return Policy', '💬 Talk to a human agent'];

      const botMsg = await ChatMessage.create({
        sessionId,
        senderId: BOT_SENDER,
        senderType: 'BOT',
        senderName: BOT_NAME,
        content: contentMsg,
        messageType: 'QUICK_REPLY',
        metadata: {
          options: defaultOptions,
        },
      });

      await ChatSession.findOneAndUpdate(
        { sessionId },
        { $inc: { botMessageCount: 1 }, lastMessageAt: new Date() }
      );

      io.to(`session:${sessionId}`).emit('chat:message', botMsg);
      return;
    }

    // If guest user asks to track order without an ID
    if (promptGuestOrderId) {
      const isHindi = activeLang === 'hi';
      await new Promise(r => setTimeout(r, 400));
      io.to(`session:${sessionId}`).emit('chat:agent_typing', { isTyping: false });

      const contentMsg = isHindi
        ? `📦 **लाइव ऑर्डर ट्रैकिंग**\n\nअपना ऑर्डर ट्रैक करने के लिए कृपया अपना **6-अंकों का ऑर्डर ID** (जैसे \`#1A2B3C\`) यहाँ संदेश में लिखें। मैं तुरंत लाइव स्थिति चेक कर दूँगा!`
        : `📦 **Live Order Tracking**\n\nTo track your package, please type your **6-Digit Order ID** (e.g. \`#1A2B3C\`) below. I will fetch the live courier status immediately!`;

      const botMsg = await ChatMessage.create({
        sessionId,
        senderId: BOT_SENDER,
        senderType: 'BOT',
        senderName: BOT_NAME,
        content: contentMsg,
        messageType: 'QUICK_REPLY',
        metadata: {
          options: isHindi
            ? ['💬 एजेंट से बात करें', '↩️ रिटर्न पॉलिसी']
            : ['💬 Talk to a human agent', '↩️ Return Policy'],
        },
      });

      await ChatSession.findOneAndUpdate(
        { sessionId },
        { $inc: { botMessageCount: 1 }, lastMessageAt: new Date() }
      );

      io.to(`session:${sessionId}`).emit('chat:message', botMsg);
      return;
    }

    // ── Route 1: Order-specific query / welcome ──────────────────────────────
    if (order || mode === 'order_welcome' || mode === 'auto_fetch_order') {
      const response = await generateOrderResponse(order, userMessage, mode === 'order_welcome' ? null : null, activeLang);

      await new Promise(r => setTimeout(r, 400));
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

    // ── Route 2: General Deterministic Self-Service Help ─────────────────────
    await handleGeneralSelfService(session, userMessage, io, socket, activeLang);

  } catch (error) {
    console.error('[Bot] handleBotMessage error:', error.message);
    io.to(`session:${session.sessionId}`).emit('chat:agent_typing', { isTyping: false });

    const isHindi = (session.language === 'hi');
    const botMsg = await ChatMessage.create({
      sessionId: session.sessionId,
      senderId: BOT_SENDER,
      senderType: 'BOT',
      senderName: BOT_NAME,
      content: isHindi
        ? "मैं आपकी सहायता के लिए यहाँ हूँ! कृपया नीचे एक विकल्प चुनें या हमारे लाइव एजेंट से संपर्क करें।"
        : "I'm here to help! Please select an option below or speak with our live support team.",
      messageType: 'QUICK_REPLY',
      metadata: {
        options: isHindi
          ? ['📍 ऑर्डर ट्रैक करें', '📋 ऑर्डर स्थिति', '↩️ रिटर्न / रिफंड', '💬 एजेंट से बात करें']
          : ['📍 Track Order', '📋 Order Status', '↩️ Return / Refund', '💬 Talk to a human agent'],
      },
    });

    io.to(`session:${session.sessionId}`).emit('chat:message', botMsg);
  }
}

// ── General Self-Service Knowledge Base (100% Deterministic & Instant) ───────
async function handleGeneralSelfService(session, userMessage, io, socket, activeLang = 'en') {
  const lower = (userMessage || '').toLowerCase();
  const isHindi = activeLang === 'hi';

  let reply = isHindi
    ? "नमस्ते! 👋 मैं आपका दातासा सहायता असिस्टेंट हूँ। कृपया नीचे दिए गए विकल्पों में से चुनें:"
    : "Hello! 👋 I'm your Daatasa Support Assistant. Please select an option below:";

  let options = isHindi
    ? ['📍 ऑर्डर ट्रैक करें', '↩️ 7-दिन रिटर्न पॉलिसी', '🫙 बिलोना घी कैसे बनता है?', '🚚 डिलीवरी का समय', '💬 एजेंट से बात करें']
    : ['📍 Track Order', '↩️ 7-Day Return Policy', '🫙 How Bilona Ghee is made?', '🚚 Delivery Timeline', '💬 Talk to a human agent'];

  if (lower.includes('bilona') || lower.includes('method') || lower.includes('cow') || lower.includes('gir') || lower.includes('pure') || lower.includes('बिलोना') || lower.includes('घी') || lower.includes('गाय')) {
    reply = isHindi
      ? "🧈 **दातासा 5-चरणीय पारंपरिक वैदिक बिलोना विधि**:\n\n" +
        "1. ताजे A2 देशी गाय के दूध को धीमी आंच पर उबाला जाता है।\n" +
        "2. रात भर मिट्टी के बर्तनों में दही जमाया जाता है।\n" +
        "3. लकड़ी के पारंपरिक बिलोने (रावणो) से हाथ से मथकर ताजा मक्खन निकाला जाता है।\n" +
        "4. पीतल के बर्तनों में उपलों की धीमी आंच पर पकाकर 100% शुद्ध, दानेदार और सुगंधित घी बनता है!\n\n" +
        "✨ 100% प्राकृतिक, रसायन-मुक्त, बिना किसी प्रिजर्वेटिव के।"
      : "🧈 **Daatasa 5-Step Traditional Vedic Bilona Process**:\n\n" +
        "1. Fresh A2 Desi Cow milk is slow-boiled in traditional vessels.\n" +
        "2. Cultured into rich curd (Dahi) overnight in clay pots.\n" +
        "3. Bi-directionally hand-churned using wooden bilona to extract fresh butter.\n" +
        "4. Slow-simmered on low firewood heat to produce 100% pure, aromatic granular ghee!\n\n" +
        "✨ 100% Pure, Natural, Zero Chemicals, Zero Preservatives.";
    options = isHindi
      ? ['🥛 A2 गाय vs भैंस का घी', '↩️ 7-दिन रिटर्न पॉलिसी', '💬 एजेंट से बात करें']
      : ['🥛 A2 Cow vs Buffalo Ghee', '↩️ 7-Day Return Policy', '💬 Talk to a human agent'];
  } else if (lower.includes('buffalo') || lower.includes('भैंस') || lower.includes('cow vs') || lower.includes('a2')) {
    reply = isHindi
      ? "🥛 **A2 गाय का घी vs भैंस का बिलोना घी**:\n\n" +
        "• **A2 गिर/थारपारकर गाय घी (₹1,450 / 1L)**: गहरा सुनहरा रंग, हल्का और पचने में आसान, बच्चों, बुजुर्गों, याददाश्त और दिल की सेहत के लिए सर्वोत्तम।\n" +
        "• **भैंस का बिलोना घी (₹950 / 1L)**: गाढ़ा सफेद दानेदार, प्राकृतिक ऊर्जा और हेल्दी फैट्स से भरपूर, वजन बढ़ाने और मिठाइयों के लिए उत्तम।"
      : "🥛 **A2 Cow Ghee vs Buffalo Bilona Ghee**:\n\n" +
        "• **A2 Gir/Tharparkar Cow Ghee (₹1,450 / 1L)**: Deep golden color, light and easy to digest. Best for memory, digestion, heart health, and immunity.\n" +
        "• **Pure Buffalo Bilona Ghee (₹950 / 1L)**: Rich white granular texture, high natural energy. Ideal for fitness, healthy weight gain, and traditional sweets.";
    options = isHindi
      ? ['🫙 बिलोना घी कैसे बनता है?', '🚚 डिलीवरी का समय', '💬 एजेंट से बात करें']
      : ['🫙 How Bilona Ghee is made?', '🚚 Delivery Timeline', '💬 Talk to a human agent'];
  } else if (lower.includes('return') || lower.includes('refund') || lower.includes('policy') || lower.includes('रिटर्न') || lower.includes('रिफंड') || lower.includes('वापस')) {
    reply = isHindi
      ? "↩️ **दातासा 7-दिन शुद्धता और गुणवत्ता गारंटी**:\n\n" +
        "• हम डिलीवरी की तारीख से **7 दिनों की 100% गारंटी** प्रदान करते हैं।\n" +
        "• यदि जार टूटा हुआ है, लीकेज है या कोई गुणवत्ता समस्या है, तो हम **फ्री डोरस्टेप रिवर्स पिकअप** और 100% रिफंड (5–7 कार्य दिवस) या **फ्री रिप्लेसमेंट** देते हैं।"
      : "↩️ **Daatasa 7-Day Quality Guarantee**:\n\n" +
        "• We offer a **100% 7-Day Quality Guarantee** from the date of delivery.\n" +
        "• If you receive a damaged jar, leakage, or quality issue, we provide **Free Doorstep Reverse Pickup** and 100% refund (5–7 business days) or **Free Replacement**.";
    options = isHindi
      ? ['📍 ऑर्डर ट्रैक करें', '💬 एजेंट से बात करें']
      : ['📍 Track Order', '💬 Talk to a human agent'];
  } else if (lower.includes('shipping') || lower.includes('delivery') || lower.includes('time') || lower.includes('डिलीवरी') || lower.includes('पहुंचेगा') || lower.includes('दिन')) {
    reply = isHindi
      ? "🚚 **शिपिंग व डिलीवरी समयावधि**:\n\n" +
        "• ₹500 से अधिक के सभी ऑर्डर्स पर **फ्री डिलीवरी**।\n" +
        "• **मेट्रो शहर**: 2–3 कार्य दिवस।\n" +
        "• **अन्य शहर व कस्बे**: 3–5 कार्य दिवस।\n" +
        "• ऑर्डर डिस्पैच होते ही SMS और ईमेल पर लाइव कूरियर ट्रैकिंग AWB लिंक भेजा जाता है।"
      : "🚚 **Shipping & Delivery Timelines**:\n\n" +
        "• **Free Shipping** across India on all orders above ₹500.\n" +
        "• **Metro Cities**: 2–3 business days.\n" +
        "• **Rest of India**: 3–5 business days.\n" +
        "• Live courier tracking AWB link is shared via SMS/Email upon dispatch.";
    options = isHindi
      ? ['📍 ऑर्डर ट्रैक करें', '↩️ 7-दिन रिटर्न पॉलिसी', '💬 एजेंट से बात करें']
      : ['📍 Track Order', '↩️ 7-Day Return Policy', '💬 Talk to a human agent'];
  } else if (lower.includes('payment') || lower.includes('पेमेंट') || lower.includes('भुगतान') || lower.includes('upi') || lower.includes('cod')) {
    reply = isHindi
      ? "💳 **भुगतान और सुरक्षा**:\n\n" +
        "• हम UPI (GPay, PhonePe, Paytm), क्रेडिट/डेबिट कार्ड, नेट बैंकिंग और COD स्वीकार करते हैं।\n" +
        "• यदि पैसे कट गए लेकिन ऑर्डर नहीं बना, तो बैंक 48 घंटों में स्वतः रिफंड कर देता है।\n" +
        "• सभी ऑनलाइन ट्रांजेक्शन Razorpay 256-bit SSL द्वारा सुरक्षित हैं।"
      : "💳 **Payments & Security**:\n\n" +
        "• We accept UPI (GPay, PhonePe, Paytm), Cards, Net Banking, and Cash on Delivery (COD).\n" +
        "• If money was deducted for a failed payment, banks auto-refund within 48 hours.\n" +
        "• All transactions are 100% secure via Razorpay 256-bit SSL encryption.";
    options = isHindi
      ? ['📍 ऑर्डर ट्रैक करें', '💬 एजेंट से बात करें']
      : ['📍 Track Order', '💬 Talk to a human agent'];
  }

  await new Promise(r => setTimeout(r, 400));
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
};
