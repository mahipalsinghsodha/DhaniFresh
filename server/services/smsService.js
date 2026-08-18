const twilio = require('twilio');

let client = null;
let isTwilioConfigured = false;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID.trim();
    const token = process.env.TWILIO_AUTH_TOKEN.trim();
    client = twilio(sid, token);
    isTwilioConfigured = true;
  } catch (error) {
    console.error('Twilio initialization failed:', error.message);
  }
}

/**
 * Sends an SMS message using Twilio.
 * If Twilio is not configured, it simulates the SMS in the console.
 * 
 * @param {string} to - The recipient's phone number (e.g., '+919876543210')
 * @param {string} body - The message content
 * @returns {Promise<boolean>} - True if successful
 */
const sendSMS = async (to, body) => {
  if (!isTwilioConfigured) {
    console.log(`\n========================================`);
    console.log(`📱 MOCK SMS (Twilio not configured)`);
    console.log(`To: ${to}`);
    console.log(`Message: ${body}`);
    console.log(`========================================\n`);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  }

  try {
    const message = await client.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER || '+1234567890', // Your Twilio phone number
      to: to
    });
    console.log(`SMS sent successfully. SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error.message);
    throw new Error('Failed to send SMS');
  }
};

module.exports = {
  sendSMS,
  isTwilioConfigured
};
