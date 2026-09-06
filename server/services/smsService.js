const twilio = require('twilio');

let client = null;
let isTwilioConfigured = false;

const hasSid = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.trim());
const hasToken = Boolean(process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN.trim());
const hasPhone = Boolean(process.env.TWILIO_PHONE_NUMBER && process.env.TWILIO_PHONE_NUMBER.trim() && !process.env.TWILIO_PHONE_NUMBER.includes('1234567890'));

if (hasSid && hasToken && hasPhone) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID.trim();
    const token = process.env.TWILIO_AUTH_TOKEN.trim();
    client = twilio(sid, token);
    isTwilioConfigured = true;
  } catch (error) {
    console.error('Twilio SMS initialization failed:', error.message);
  }
}

/**
 * Sends an SMS message using Twilio, with automatic WhatsApp fallback.
 * If neither is available, simulates the OTP in server console logs.
 * 
 * @param {string} to - The recipient's phone number (e.g., '+919876543210')
 * @param {string} body - The message content
 * @returns {Promise<boolean>} - True if processed
 */
const sendSMS = async (to, body) => {
  // Format number
  let formattedTo = to;
  if (!formattedTo.startsWith('+')) {
    formattedTo = '+91' + formattedTo;
  }

  // 1. If Twilio SMS is configured with a valid phone number, attempt SMS
  if (isTwilioConfigured && client) {
    try {
      const message = await client.messages.create({
        body: body,
        from: process.env.TWILIO_PHONE_NUMBER.trim(),
        to: formattedTo
      });
      console.log(`SMS sent successfully. SID: ${message.sid}`);
      return true;
    } catch (smsError) {
      console.error('Twilio SMS delivery failed:', smsError.message);
    }
  }

  // 2. Fallback: Try WhatsApp (Twilio WhatsApp is frequently configured)
  try {
    const { sendWhatsApp } = require('./whatsappService');
    const waResult = await sendWhatsApp(formattedTo, body);
    if (waResult) {
      console.log(`[SMS Service] Successfully dispatched OTP via WhatsApp to ${formattedTo}`);
      return true;
    }
  } catch (waErr) {
    console.warn('[SMS Service] WhatsApp fallback attempt failed:', waErr.message);
  }

  // 3. Fallback: Log OTP to console so users/developers are never locked out
  console.log(`\n========================================`);
  console.log(`📱 MOCK SMS / OTP DISPATCH`);
  console.log(`To: ${formattedTo}`);
  console.log(`Message: ${body}`);
  console.log(`========================================\n`);

  await new Promise(resolve => setTimeout(resolve, 200));
  return true;
};

module.exports = {
  sendSMS,
  isTwilioConfigured
};
