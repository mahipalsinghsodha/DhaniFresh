// Script to make a user an admin
const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const makeAdmin = async () => {
  try {
    const email = process.argv[2];

    if (!email) {
      console.log(`
Usage: node make-admin.js <email>

Example:
node make-admin.js user@example.com

This will make the user with the given email an admin.
      `);
      process.exit(1);
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ghee-ecommerce');
    console.log('Connected to MongoDB');

    // Find and update user
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { role: 'admin' },
      { new: true }
    );

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    console.log('\n✅ User updated to admin successfully!');
    console.log('User Details:');
    console.log({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    process.exit(0);
  } catch (error) {
    console.error('Error updating user:', error.message);
    process.exit(1);
  }
};

makeAdmin();
