const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

async function createSupportUser() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const email = 'support@daatasa.com';
    const password = 'Support@12345';

    let user = await User.findOne({ email });

    if (user) {
      user.name = 'Daatasa Support Specialist';
      user.password = password; // pre('save') hook will hash with salt 12
      user.role = 'support';
      user.permissions = ['support', 'orders'];
      user.supportStats = {
        dispatchedCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        missedCount: 0,
        resolvedCount: 0,
        totalWorkSeconds: 0,
        avgRating: 5,
        ratingCount: 1,
        isLive: true,
        dailyStats: {
          date: new Date().toISOString().slice(0, 10),
          accepted: 0,
          rejected: 0,
          missed: 0,
          workSeconds: 0
        }
      };
      await user.save();
      console.log('✅ Existing user updated to Support role!');
    } else {
      user = await User.create({
        name: 'Daatasa Support Specialist',
        email,
        password: hashedPassword,
        role: 'support',
        permissions: ['support', 'orders'],
        supportStats: {
          dispatchedCount: 0,
          acceptedCount: 0,
          rejectedCount: 0,
          missedCount: 0,
          resolvedCount: 0,
          totalWorkSeconds: 0,
          avgRating: 5,
          ratingCount: 1,
          isLive: true,
          dailyStats: {
            date: new Date().toISOString().slice(0, 10),
            accepted: 0,
            rejected: 0,
            missed: 0,
            workSeconds: 0
          }
        }
      });
      console.log('✅ New Support Specialist user created!');
    }

    console.log('\n========================================');
    console.log('🎉 SUPPORT AGENT CREDENTIALS');
    console.log('========================================');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role:     ${user.role}`);
    console.log(`Panel URL: http://localhost:5173/login -> will auto-redirect to /support-panel`);
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error creating support user:', error);
    process.exit(1);
  }
}

createSupportUser();
