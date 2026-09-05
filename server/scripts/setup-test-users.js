const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const usersToEnsure = [
  {
    email: 'test2510@gmail.com',
    name: 'Test Customer',
    role: 'user',
    password: '123456789',
    phone: '+919876543210'
  },
  {
    email: 'support1@daatasa.com',
    name: 'Support Agent 1',
    role: 'support',
    password: '123456789',
    phone: '+919876543211'
  },
  {
    email: 'mahipal.gtropy@gmail.com',
    name: 'Mahipal SuperAdmin',
    role: 'superadmin',
    password: '123456789',
    phone: '+919876543212'
  }
];

async function setupUsers() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected!');

  const User = require('../models/User');

  for (const target of usersToEnsure) {
    let user = await User.findOne({ email: target.email.toLowerCase() }).select('+password');
    if (user) {
      user.name = target.name || user.name;
      user.role = target.role;
      user.isBlocked = false;
      user.isEmailVerified = true;
      user.password = target.password; // Mongoose pre-save hook will hash it
      await user.save();
      console.log(`✅ Updated existing user: ${user.email} (Role: ${user.role}) with password '123456789'`);
    } else {
      const crypto = require('crypto');
      const newReferralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      user = new User({
        name: target.name,
        email: target.email.toLowerCase(),
        password: target.password,
        role: target.role,
        phone: target.phone,
        referralCode: newReferralCode,
        isBlocked: false,
        isEmailVerified: true
      });
      await user.save();
      console.log(`✅ Created new user: ${user.email} (Role: ${user.role}) with password '123456789'`);
    }
  }

  await mongoose.disconnect();
  console.log('\nAll 3 users are ready and verified!');
}

setupUsers().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
