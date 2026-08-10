const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Order = require('./models/Order');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/ghee-ecommerce');
  
  try {
    const q = '2020DC64';
    const type = 'orderId'; // testing the exact scenario

    const qTrimmed = q.trim();
    const isObjectId = qTrimmed.match(/^[0-9a-fA-F]{24}$/);
    
    let userQuery = [];
    let orderQuery = [];

    // Filter logic based on type
    if (type === 'email') {
      userQuery.push({ email: { $regex: qTrimmed, $options: 'i' } });
    } else if (type === 'phone') {
      userQuery.push({ phone: { $regex: qTrimmed, $options: 'i' } });
    } else if (type === 'orderId') {
      if (isObjectId) {
        orderQuery.push({ _id: qTrimmed });
      } else {
        orderQuery.push({
          $expr: {
            $regexMatch: {
              input: { $toString: '$_id' },
              regex: qTrimmed,
              options: 'i'
            }
          }
        });
      }
    } else if (type === 'paymentId') {
      orderQuery.push({ 'paymentInfo.razorpay_payment_id': { $regex: qTrimmed, $options: 'i' } });
    } else if (type === 'invoice') {
      orderQuery.push({ invoiceNumber: { $regex: qTrimmed, $options: 'i' } });
    } else {
      userQuery.push(
        { name: { $regex: qTrimmed, $options: 'i' } },
        { email: { $regex: qTrimmed, $options: 'i' } },
        { phone: { $regex: qTrimmed, $options: 'i' } }
      );
      if (isObjectId) {
        orderQuery.push({ _id: qTrimmed });
      } else {
        orderQuery.push({ 'paymentInfo.razorpay_payment_id': { $regex: qTrimmed, $options: 'i' } });
        orderQuery.push({ trackingNumber: { $regex: qTrimmed, $options: 'i' } });
        orderQuery.push({ invoiceNumber: { $regex: qTrimmed, $options: 'i' } });
      }
    }

    let users = [];
    if (userQuery.length > 0) {
      console.log('User query:', JSON.stringify({ $or: userQuery }));
      users = await User.find({ $or: userQuery }).select('name email phone role isBlocked createdAt');
    }

    if (users.length > 0 && (!type || type === 'all' || type === 'email' || type === 'phone')) {
      orderQuery.push({ user: { $in: users.map(u => u._id) } });
    }

    let orders = [];
    if (orderQuery.length > 0) {
      console.log('Order query:', JSON.stringify({ $or: orderQuery }));
      orders = await Order.find({ $or: orderQuery })
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(20);
    }

    console.log('Success! Users:', users.length, 'Orders:', orders.length);
  } catch (error) {
    console.error('ERROR OCCURRED:', error);
  } finally {
    process.exit(0);
  }
}

test();
