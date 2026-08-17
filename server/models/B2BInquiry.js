const mongoose = require('mongoose');

const b2bInquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  quantity: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'],
    default: 'NEW'
  }
}, {
  timestamps: true
});

const B2BInquiry = mongoose.model('B2BInquiry', b2bInquirySchema);
module.exports = B2BInquiry;
