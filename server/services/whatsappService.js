const twilio = require('twilio');

let client = null;
let isConfigured = false;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID.trim();
    const token = process.env.TWILIO_AUTH_TOKEN.trim();
    client = twilio(sid, token);
    isConfigured = true;
  } catch (error) {
    console.error('WhatsApp Twilio initialization failed:', error.message);
  }
}

/**
 * Sends a WhatsApp message using Twilio.
 */
const sendWhatsApp = async (to, body) => {
  if (!isConfigured) {
    console.log(`\n========================================`);
    console.log(`💬 MOCK WHATSAPP MESSAGE`);
    console.log(`To: ${to}`);
    console.log(`Message: ${body}`);
    console.log(`========================================\n`);
    return true;
  }

  try {
    // Format number to ensure it starts with + and has country code
    let formattedTo = to;
    if (!formattedTo.startsWith('+')) {
      formattedTo = '+91' + formattedTo;
    }

    const message = await client.messages.create({
      body: body,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${formattedTo}`
    });
    console.log(`WhatsApp sent successfully. SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error.message);
    // Don't throw, just log to prevent breaking the flow
    return false;
  }
};

const sendOrderSuccessWhatsApp = async (order, userEmail) => {
  const phone = order.shippingAddress?.phone;
  if (!phone) return;

  const orderId = order.orderIdString || order._id.toString();
  const body = `*Order Confirmed!*\n\nHi ${order.shippingAddress.name},\nThank you for shopping with Daatasa! Your order #${orderId} has been confirmed.\n\nTotal: ₹${order.totalPrice}\nPayment: ${order.paymentMethod}\n\nWe will notify you once it ships.`;
  
  await sendWhatsApp(phone, body);
};

const sendShippingUpdateWhatsApp = async (order) => {
  const phone = order.shippingAddress?.phone;
  if (!phone) return;

  const orderId = order.orderIdString || order._id.toString();
  const body = `*Order Shipped!*\n\nGreat news! Your Daatasa order #${orderId} has been shipped via ${order.shippingProvider}.\n\nTracking Number: ${order.trackingNumber}\nTrack it here: ${process.env.CLIENT_URL || 'https://daatasa.com'}/orders`;
  
  await sendWhatsApp(phone, body);
};

const sendAbandonedCartWhatsApp = async (user, cartItems) => {
  const phone = user.phone; // Assuming user model has phone
  if (!phone) return;

  const itemsNames = cartItems.slice(0, 2).map(i => i.product?.name).join(', ');
  const more = cartItems.length > 2 ? ' and more' : '';
  
  const body = `Hi ${user.name},\n\nYou left some items in your cart! Complete your purchase for ${itemsNames}${more} before they run out of stock.\n\nClick here to checkout: ${process.env.CLIENT_URL || 'https://daatasa.com'}/cart`;
  
  await sendWhatsApp(phone, body);
};

module.exports = {
  sendWhatsApp,
  sendOrderSuccessWhatsApp,
  sendShippingUpdateWhatsApp,
  sendAbandonedCartWhatsApp
};
