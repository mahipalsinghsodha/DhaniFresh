require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { invalidateAnalytics } = require('../utils/cache');

// ── Realistic Sample Data ──
const SAMPLE_CUSTOMERS = [
  { name: 'Rahul Sharma', email: 'rahul.sharma@example.com', phone: '9876543210', city: 'Mumbai', state: 'Maharashtra', zipCode: '400001', street: 'Flat 402, Sea Breeze Apts, Bandra West' },
  { name: 'Priya Patel', email: 'priya.patel@example.com', phone: '9823456781', city: 'Ahmedabad', state: 'Gujarat', zipCode: '380015', street: '12 Shivalik Residency, Satellite' },
  { name: 'Amit Verma', email: 'amit.verma@example.com', phone: '9711223344', city: 'New Delhi', state: 'Delhi', zipCode: '110001', street: 'B-14, Connaught Place' },
  { name: 'Sneha Gupta', email: 'sneha.gupta@example.com', phone: '9655443322', city: 'Bengaluru', state: 'Karnataka', zipCode: '560034', street: '78, 4th Cross, Koramangala 3rd Block' },
  { name: 'Vikram Singh', email: 'vikram.singh@example.com', phone: '9899887766', city: 'Jaipur', state: 'Rajasthan', zipCode: '302001', street: 'Plot 45, Civil Lines' },
  { name: 'Ananya Deshmukh', email: 'ananya.d@example.com', phone: '9422001122', city: 'Pune', state: 'Maharashtra', zipCode: '411004', street: '104 Deccan Heights, FC Road' },
  { name: 'Rohan Mehra', email: 'rohan.m@example.com', phone: '9811223344', city: 'Chandigarh', state: 'Punjab', zipCode: '160017', street: 'House 521, Sector 17-C' },
  { name: 'Kavita Iyer', email: 'kavita.iyer@example.com', phone: '9845012345', city: 'Chennai', state: 'Tamil Nadu', zipCode: '600028', street: '22 Karpagam Avenue, R.A. Puram' }
];

const SAMPLE_PRODUCTS = [
  { name: 'Vedic A2 Gir Cow Bilona Ghee', price: 1450, weight: '1000 ml', image: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=500&auto=format&fit=crop&q=80', description: 'Traditional bilona churned pure Vedic Gir cow ghee.' },
  { name: 'Organic Grass-Fed Cow Ghee', price: 799, weight: '500 ml', image: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=500&auto=format&fit=crop&q=80', description: 'Fresh golden grass-fed organic cow ghee with rich aroma.' },
  { name: 'Pure Desi Buffalo Ghee', price: 650, weight: '500 ml', image: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=500&auto=format&fit=crop&q=80', description: 'Creamy and granular white buffalo ghee prepared using curd-churning.' },
  { name: 'Cultured Bilona A2 Ghee (Family Pack)', price: 3499, weight: '2500 ml', image: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=500&auto=format&fit=crop&q=80', description: 'Large family glass jar of authentic cultured Vedic bilona ghee.' }
];

// Helper: Random item from array
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Parse command line arguments (--count=10, --days=7, --clean)
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { count: 10, days: 7, clean: false };

  for (const arg of args) {
    if (arg === '--clean') options.clean = true;
    else if (arg.startsWith('--count=')) options.count = parseInt(arg.split('=')[1], 10) || 10;
    else if (arg.startsWith('--days=')) options.days = parseInt(arg.split('=')[1], 10) || 7;
  }
  return options;
}

async function run() {
  const { count, days, clean } = parseArgs();

  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    if (clean) {
      console.log('🧹 Cleaning test generated orders (orders with notes containing [TEST_SEED])...');
      const delRes = await Order.deleteMany({ 'statusHistory.note': /\[TEST_SEED\]/ });
      console.log(`✅ Deleted ${delRes.deletedCount} test orders.`);
      await invalidateAnalytics();
      process.exit(0);
    }

    // 1. Ensure Products exist in DB
    let dbProducts = await Product.find().limit(20);
    if (dbProducts.length === 0) {
      console.log('📦 No products found in DB. Creating sample ghee products...');
      dbProducts = await Product.insertMany(SAMPLE_PRODUCTS.map(p => ({
        ...p,
        category: 'ghee',
        stock: 100,
        mrp: p.price + 200,
        isFeatured: true
      })));
      console.log(`✅ Created ${dbProducts.length} sample products.`);
    }

    // 2. Ensure Users exist in DB
    let dbUsers = await User.find({ role: 'user' }).limit(20);
    if (dbUsers.length === 0) {
      console.log('👤 Creating sample users...');
      dbUsers = await User.insertMany(SAMPLE_CUSTOMERS.slice(0, 5).map(c => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        password: 'Password@123',
        role: 'user',
        addresses: [{
          name: c.name,
          phone: c.phone,
          street: c.street,
          city: c.city,
          state: c.state,
          zipCode: c.zipCode,
          isDefault: true
        }]
      })));
      console.log(`✅ Created ${dbUsers.length} sample users.`);
    }

    // 3. Fetch Settings for GST and Shipping
    const settings = await Settings.getGlobal();
    const gstRatePct = settings.gstEnabled ? settings.gstRate : 5;
    const gstMultiplier = gstRatePct / 100;
    const freeShippingThreshold = settings.freeShippingThreshold || 500;
    const shippingCharge = settings.shippingCharge || 50;

    console.log(`\n🎲 Generating ${count} realistic orders spread across the last ${days} days...`);

    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    const ordersToInsert = [];

    const statuses = [
      { orderStatus: 'DELIVERED', paymentStatus: 'PAID', isPaid: true, isDelivered: true, weight: 55 },
      { orderStatus: 'OUT_FOR_DELIVERY', paymentStatus: 'PAID', isPaid: true, isDelivered: false, weight: 15 },
      { orderStatus: 'PICKED_UP', paymentStatus: 'PAID', isPaid: true, isDelivered: false, weight: 10 },
      { orderStatus: 'ACCEPTED', paymentStatus: 'PAID', isPaid: true, isDelivered: false, weight: 10 },
      { orderStatus: 'PENDING_ACCEPTANCE', paymentStatus: 'COD_CONFIRMED', isPaid: false, isDelivered: false, weight: 5 },
      { orderStatus: 'CANCELLED', paymentStatus: 'CANCELLED', isPaid: false, isDelivered: false, weight: 5 }
    ];

    // Status weighted picker
    function pickStatus() {
      const r = randomInt(1, 100);
      let cumulative = 0;
      for (const s of statuses) {
        cumulative += s.weight;
        if (r <= cumulative) return s;
      }
      return statuses[0];
    }

    for (let i = 0; i < count; i++) {
      const customer = pick(SAMPLE_CUSTOMERS);
      const matchedUser = dbUsers.find(u => u.email === customer.email) || pick(dbUsers);

      // Random date in the past X days
      const daysAgo = Math.random() * days;
      const orderCreatedAt = new Date(now - daysAgo * msInDay);
      
      // Select 1 to 3 items
      const numItems = randomInt(1, 3);
      const selectedProducts = [];
      const usedProductIds = new Set();

      for (let j = 0; j < numItems; j++) {
        const prod = pick(dbProducts);
        if (!usedProductIds.has(prod._id.toString())) {
          usedProductIds.add(prod._id.toString());
          selectedProducts.push(prod);
        }
      }

      const orderItems = selectedProducts.map(p => {
        const qty = randomInt(1, 2);
        return {
          product: p._id,
          variant: p.variants?.[0]?._id || null,
          name: p.name,
          weight: p.weight || '500 ml',
          image: p.image || (p.images && p.images[0]) || '',
          price: p.price,
          quantity: qty
        };
      });

      const itemsPrice = orderItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
      const discount = (itemsPrice > 1500 && Math.random() > 0.6) ? 100 : 0;
      const taxableAmount = itemsPrice - discount;
      const taxPrice = Number((taxableAmount - (taxableAmount / (1 + gstMultiplier))).toFixed(2));
      const shippingPrice = taxableAmount > freeShippingThreshold ? 0 : shippingCharge;
      const totalPrice = Number((taxableAmount + shippingPrice).toFixed(2));

      const statusConfig = pickStatus();
      const paymentMethod = pick(['Online', 'Online', 'COD', 'Wallet']);
      
      // Build guaranteed unique orderIdString & invoiceNumber
      const uniqueSuffix = `${Date.now().toString().slice(-4)}${String(i).padStart(5, '0')}`;
      const orderIdString = `ORD${uniqueSuffix}`;
      const invoiceNumber = `INV-${orderCreatedAt.getFullYear()}-${uniqueSuffix}`;

      // Status history
      const statusHistory = [
        { status: 'PENDING_ACCEPTANCE', note: 'Order placed by customer [TEST_SEED]', updatedAt: orderCreatedAt }
      ];

      if (statusConfig.orderStatus !== 'PENDING_ACCEPTANCE') {
        const acceptedTime = new Date(orderCreatedAt.getTime() + 10 * 60 * 1000);
        statusHistory.push({ status: 'ACCEPTED', note: 'Order confirmed by store [TEST_SEED]', updatedAt: acceptedTime });

        if (statusConfig.orderStatus === 'PICKED_UP' || statusConfig.orderStatus === 'OUT_FOR_DELIVERY' || statusConfig.orderStatus === 'DELIVERED') {
          const pickedTime = new Date(orderCreatedAt.getTime() + 2 * 3600 * 1000);
          statusHistory.push({ status: 'PICKED_UP', note: 'Courier picked up shipment [TEST_SEED]', updatedAt: pickedTime });
        }

        if (statusConfig.orderStatus === 'OUT_FOR_DELIVERY' || statusConfig.orderStatus === 'DELIVERED') {
          const outTime = new Date(orderCreatedAt.getTime() + 5 * 3600 * 1000);
          statusHistory.push({ status: 'OUT_FOR_DELIVERY', note: 'Out for delivery [TEST_SEED]', updatedAt: outTime });
        }

        if (statusConfig.orderStatus === 'DELIVERED') {
          const delTime = new Date(orderCreatedAt.getTime() + 8 * 3600 * 1000);
          statusHistory.push({ status: 'DELIVERED', note: 'Package delivered to recipient [TEST_SEED]', updatedAt: delTime });
        }
      }

      if (statusConfig.orderStatus === 'CANCELLED') {
        statusHistory.push({ status: 'CANCELLED', note: 'Order cancelled by user [TEST_SEED]', updatedAt: new Date(orderCreatedAt.getTime() + 30 * 60 * 1000) });
      }

      ordersToInsert.push({
        user: matchedUser._id,
        orderIdString,
        orderItems,
        shippingAddress: {
          name: customer.name,
          phone: customer.phone,
          street: customer.street,
          city: customer.city,
          state: customer.state,
          district: customer.city,
          zipCode: customer.zipCode,
          country: 'India'
        },
        paymentMethod,
        paymentStatus: statusConfig.paymentStatus,
        orderStatus: statusConfig.orderStatus,
        statusHistory,
        itemsPrice,
        discount,
        taxPrice,
        shippingPrice,
        totalPrice,
        gstRate: gstRatePct,
        isPaid: statusConfig.isPaid,
        paidAt: statusConfig.isPaid ? orderCreatedAt : null,
        isDelivered: statusConfig.isDelivered,
        deliveredAt: statusConfig.isDelivered ? new Date(orderCreatedAt.getTime() + 8 * 3600 * 1000) : null,
        invoiceNumber,
        createdAt: orderCreatedAt,
        updatedAt: orderCreatedAt
      });
    }

    // Chunked batch insertion for high performance with 10k+ records
    const BATCH_SIZE = 1000;
    let totalInserted = 0;

    for (let i = 0; i < ordersToInsert.length; i += BATCH_SIZE) {
      const chunk = ordersToInsert.slice(i, i + BATCH_SIZE);
      const res = await Order.insertMany(chunk, { ordered: false });
      totalInserted += res.length;
      console.log(`⏳ Inserted batch: ${totalInserted.toLocaleString()} / ${count.toLocaleString()} orders...`);
    }

    console.log(`\n🎉 Successfully created and seeded ${totalInserted.toLocaleString()} realistic orders!`);
    console.log(`📊 Date Range: Spread across last ${days} days`);
    console.log(`✨ Status breakdown generated: Delivered, Out for Delivery, Picked Up, Accepted, Pending.`);

    // Invalidate Redis analytics cache so Admin Dashboard & charts refresh instantly
    await invalidateAnalytics();
    console.log('🔄 Analytics cache invalidated.');

  } catch (error) {
    console.error('❌ Error generating orders:', error);
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
}

run();
