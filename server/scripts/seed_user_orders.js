// server/scripts/seed_user_orders.js
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

async function seedOrders() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected.');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  const Order = require('../models/Order');

  // Find user with exact email mssodha2510@gmail.com
  const user = await User.findOne({
    email: 'mssodha2510@gmail.com'
  });

  if (!user) {
    console.error('User with email/name mssodha2510 not found. Listing all users:');
    const allUsers = await User.find({}).select('_id name email role').limit(20);
    console.log(allUsers);
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.email}) - ID: ${user._id}`);

  // Fetch available products
  const products = await Product.find({}).limit(30).lean();
  if (products.length === 0) {
    console.error('No products found in database to create orders.');
    process.exit(1);
  }
  console.log(`Found ${products.length} products to choose from.`);

  const shippingAddresses = [
    {
      name: user.name || 'Mahipal Singh Sodha',
      phone: '9876543210',
      street: 'Fort Road, Near Royal Palace',
      city: 'Jaisalmer',
      district: 'Jaisalmer',
      state: 'Rajasthan',
      zipCode: '345001',
      country: 'India'
    },
    {
      name: user.name || 'Mahipal Singh Sodha',
      phone: '9876543210',
      street: 'B-42, Malviya Nagar',
      city: 'Jaipur',
      district: 'Jaipur',
      state: 'Rajasthan',
      zipCode: '302017',
      country: 'India'
    },
    {
      name: user.name || 'Mahipal Singh Sodha',
      phone: '9876543210',
      street: 'Plot 12, Golf Course Road, Sector 54',
      city: 'Gurugram',
      district: 'Gurugram',
      state: 'Haryana',
      zipCode: '122002',
      country: 'India'
    }
  ];

  const providers = ['BlueDart Express', 'Delhivery Surface', 'Daatasa Prime Courier', 'DTDC Express', 'Shadowfax'];

  const statuses = [
    'DELIVERED',
    'DELIVERED',
    'DELIVERED',
    'DELIVERED',
    'DELIVERED',
    'DELIVERED',
    'DELIVERED',
    'DELIVERED',
    'DELIVERED',
    'DELIVERED',
    'OUT_FOR_DELIVERY',
    'OUT_FOR_DELIVERY',
    'PICKED_UP',
    'PICKED_UP',
    'ASSIGNED_TO_COURIER',
    'ASSIGNED_TO_COURIER',
    'ACCEPTED',
    'ACCEPTED',
    'PENDING_ACCEPTANCE',
    'PENDING_ACCEPTANCE',
    'PENDING_ACCEPTANCE',
    'CANCELLED',
    'CANCELLED',
    'CANCELLED',
    'RETURNED'
  ];

  const now = Date.now();
  const createdOrders = [];

  for (let i = 0; i < 25; i++) {
    const status = statuses[i] || 'DELIVERED';
    // Spread across 0 to 29 days
    const daysAgo = Math.floor((24 - i) * (29 / 24)) + (i % 2 === 0 ? 0.2 : 0.6);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    // Pick 1 to 3 random products
    const numItems = (i % 3) + 1;
    const shuffledProducts = [...products].sort(() => 0.5 - Math.random());
    const selectedProducts = shuffledProducts.slice(0, numItems);

    let itemsPrice = 0;
    const orderItems = selectedProducts.map(p => {
      const quantity = (i % 2) + 1;
      const price = p.price || 850;
      itemsPrice += price * quantity;
      return {
        product: p._id,
        variant: p.variants?.[0]?._id || null,
        name: p.name || 'Pure Vedic Bilona Ghee',
        weight: p.weight || (p.variants?.[0]?.weight) || '1 Litre',
        image: p.image || p.images?.[0] || 'https://res.cloudinary.com/dpduev75g/image/upload/v1/ghee/sample.jpg',
        price: price,
        quantity: quantity
      };
    });

    const discount = i % 4 === 0 ? Math.round(itemsPrice * 0.1) : (i % 5 === 0 ? 100 : 0);
    const shippingPrice = itemsPrice > 1000 ? 0 : 50;
    const taxPrice = Math.round((itemsPrice - discount) * 0.05);
    const totalPrice = itemsPrice - discount + shippingPrice + taxPrice;

    const isOnline = i % 2 === 0;
    const paymentMethod = isOnline ? 'Online' : 'COD';
    
    let paymentStatus = 'PENDING';
    let isPaid = false;
    let paidAt = null;
    let isDelivered = false;
    let deliveredAt = null;
    let cancelReason = '';
    let cancelledAt = null;
    let cancelledBy = null;

    if (status === 'DELIVERED') {
      isDelivered = true;
      deliveredAt = new Date(createdAt.getTime() + (2 + (i % 3)) * 24 * 60 * 60 * 1000);
      isPaid = true;
      paidAt = isOnline ? createdAt : deliveredAt;
      paymentStatus = isOnline ? 'PAID' : 'COD_CONFIRMED';
    } else if (status === 'OUT_FOR_DELIVERY' || status === 'ASSIGNED_TO_COURIER' || status === 'PICKED_UP') {
      isDelivered = false;
      if (isOnline) {
        isPaid = true;
        paidAt = createdAt;
        paymentStatus = 'PAID';
      } else {
        paymentStatus = 'PENDING';
      }
    } else if (status === 'ACCEPTED' || status === 'PENDING_ACCEPTANCE') {
      if (isOnline) {
        isPaid = true;
        paidAt = createdAt;
        paymentStatus = 'PAID';
      } else {
        paymentStatus = 'PENDING';
      }
    } else if (status === 'CANCELLED') {
      paymentStatus = 'CANCELLED';
      cancelledAt = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000);
      cancelledBy = 'user';
      cancelReason = i % 2 === 0 ? 'Ordered by mistake' : 'Delivery date change needed';
    } else if (status === 'RETURNED') {
      isDelivered = true;
      deliveredAt = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
      paymentStatus = 'CANCELLED';
    }

    const shippingProvider = providers[i % providers.length];
    const trackingNumber = `DT${Math.floor(10000000 + Math.random() * 90000000)}IN`;
    const shippingAddress = shippingAddresses[i % shippingAddresses.length];

    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const dateStr = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
    const orderIdString = `ORD${dateStr}${randomSuffix}`;
    const invoiceNumber = `INV-${dateStr}-${Math.floor(100000 + Math.random() * 900000)}`;

    const statusHistory = [
      {
        status: 'PENDING_ACCEPTANCE',
        note: 'Order placed by customer',
        updatedAt: createdAt
      }
    ];

    if (['ACCEPTED', 'PICKED_UP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'].includes(status)) {
      statusHistory.push({
        status: 'ACCEPTED',
        note: 'Order confirmed & sent for packaging',
        updatedAt: new Date(createdAt.getTime() + 30 * 60 * 1000)
      });
    }

    if (['PICKED_UP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'].includes(status)) {
      statusHistory.push({
        status: 'SHIPPED',
        note: `Handed over to ${shippingProvider}. Tracking ID: ${trackingNumber}`,
        updatedAt: new Date(createdAt.getTime() + 18 * 60 * 60 * 1000)
      });
    }

    if (['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'].includes(status)) {
      statusHistory.push({
        status: 'OUT_FOR_DELIVERY',
        note: 'Package is out for delivery with our delivery partner',
        updatedAt: new Date(createdAt.getTime() + 48 * 60 * 60 * 1000)
      });
    }

    if (status === 'DELIVERED') {
      statusHistory.push({
        status: 'DELIVERED',
        note: 'Delivered safely to shipping address',
        updatedAt: deliveredAt
      });
    } else if (status === 'CANCELLED') {
      statusHistory.push({
        status: 'CANCELLED',
        note: `Cancelled. Reason: ${cancelReason}`,
        updatedAt: cancelledAt
      });
    }

    const orderDoc = {
      user: user._id,
      orderIdString,
      guestEmail: user.email,
      orderItems,
      shippingAddress,
      paymentMethod,
      paymentStatus,
      orderStatus: status,
      itemsPrice,
      discount,
      shippingPrice,
      taxPrice,
      totalPrice,
      gstRate: 5,
      isPaid,
      paidAt,
      isDelivered,
      deliveredAt,
      invoiceNumber,
      trackingNumber,
      shippingProvider,
      cancelReason,
      cancelledAt,
      cancelledBy,
      statusHistory,
      createdAt,
      updatedAt: deliveredAt || cancelledAt || createdAt
    };

    if (isOnline && isPaid) {
      orderDoc.paymentInfo = {
        razorpay_order_id: `order_seed_${orderIdString}`,
        razorpay_payment_id: `pay_seed_${orderIdString}`,
        method: i % 3 === 0 ? 'UPI' : 'Card',
        bank: 'HDFC Bank',
        vpa: `${user.email.split('@')[0]}@okhdfcbank`
      };
    }

    createdOrders.push(orderDoc);
  }

  console.log(`Inserting ${createdOrders.length} orders for ${user.email}...`);
  const inserted = await Order.insertMany(createdOrders);
  console.log(`Successfully created ${inserted.length} orders!`);

  console.log('\n--- Sample of created orders ---');
  inserted.slice(0, 10).forEach((ord, idx) => {
    console.log(`${idx + 1}. #${ord.orderIdString || ord._id.toString().slice(-6).toUpperCase()} | ${ord.orderStatus} | ₹${ord.totalPrice} | ${ord.paymentMethod} (${ord.paymentStatus}) | ${new Date(ord.createdAt).toDateString()}`);
  });

  await mongoose.disconnect();
  console.log('Done.');
}

seedOrders().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
