const { sendContactAdminEmail, sendContactAutoReply } = require('../services/emailService');
const B2BInquiry = require('../models/B2BInquiry');

const sendContactEmail = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'Name, email, subject, and message are required.' });
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (message.trim().length > 2000) {
      return res.status(400).json({ message: 'Message cannot exceed 2000 characters.' });
    }

    // Send both emails in parallel
    await Promise.all([
      sendContactAdminEmail({ name, email, phone, subject, message }),
      sendContactAutoReply({ name, email, phone, subject, message }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully! We will get back to you shortly.',
    });
  } catch (error) {
    console.error('Contact email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again or contact us directly.',
    });
  }
};

const createB2BInquiry = async (req, res) => {
  try {
    const { name, email, phone, company, quantity, message } = req.body;

    if (!name || !phone || !quantity || !message) {
      return res.status(400).json({ message: 'Name, phone, quantity, and message are required.' });
    }

    const inquiry = await B2BInquiry.create({
      name,
      email,
      phone,
      company,
      quantity,
      message
    });

    res.status(201).json({
      success: true,
      message: 'Your bulk order inquiry has been submitted successfully! We will contact you soon.',
      inquiry
    });
  } catch (error) {
    console.error('B2B Inquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit inquiry. Please try again.',
    });
  }
};

const getB2BInquiries = async (req, res) => {
  try {
    const inquiries = await B2BInquiry.find({}).sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (error) {
    console.error('Fetch B2B Inquiries error:', error);
    res.status(500).json({ message: 'Failed to fetch B2B inquiries' });
  }
};

const updateB2BStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const inquiry = await B2BInquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' });
    res.json(inquiry);
  } catch (error) {
    console.error('Update B2B status error:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
};

module.exports = { sendContactEmail, createB2BInquiry, getB2BInquiries, updateB2BStatus };
