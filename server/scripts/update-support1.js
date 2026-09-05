require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    let target = await User.findOne({
      $or: [
        { email: 'support1@daatasa.com' },
        { email: 'support1@gmail.com' },
        { name: 'support1' }
      ]
    }).select('+password');

    if (target) {
      console.log(`Target user found: ${target.email} (${target.name})`);
      target.password = '123456789';
      await target.save();
      console.log(`✅ Successfully updated password for ${target.email} to '123456789'`);
    } else {
      console.log('No user with support1 found. Creating support1@daatasa.com with password 123456789...');
      const newUser = new User({
        name: 'Support Agent 1',
        email: 'support1@daatasa.com',
        password: '123456789',
        role: 'support',
        permissions: ['support'],
        supportStats: {
          isLive: true,
          dailyStats: {
            date: new Date().toISOString().slice(0, 10),
            accepted: 0,
            rejected: 0,
            missed: 0,
            workSeconds: 0,
          }
        }
      });
      await newUser.save();
      console.log(`✅ Created user: ${newUser.email} with role: ${newUser.role} and password: '123456789'`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
