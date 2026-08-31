// server/scripts/clean_orders.js
require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await Order.updateMany(
    {
      $or: [
        { orderStatus: 'CANCELLED' },
        { paymentStatus: 'CANCELLED' }
      ]
    },
    {
      $set: {
        isDelivered: false,
        deliveredAt: null,
        orderStatus: 'CANCELLED',
        paymentStatus: 'CANCELLED'
      }
    }
  );
  console.log('Cleaned cancelled orders:', res);
  await mongoose.disconnect();
}

clean().catch(console.error);
