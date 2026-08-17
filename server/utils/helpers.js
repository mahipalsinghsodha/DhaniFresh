const Counter = require('../models/Counter');

const getNextInvoiceNumber = async () => {
  const counter = await Counter.findByIdAndUpdate(
    'invoiceNumber',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  
  // Format as INV0000000001 (INV + 10 digits padded with 0)
  return `INV${String(counter.seq).padStart(10, '0')}`;
};

module.exports = {
  getNextInvoiceNumber
};
