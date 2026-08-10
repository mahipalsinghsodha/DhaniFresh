require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('./models/User');

const ask = (q) => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, ans => { rl.close(); res(ans.trim()); });
});

// Hide password input
const askPassword = (q) => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write(q);
  rl.input.on('data', char => {
    char = char + '';
    switch (char) {
      case '\n':
      case '\r':
      case '\u0004':
        rl.close();
        break;
      default:
        // do not echo
        break;
    }
  });
  rl.on('close', () => {
    process.stdout.write('\n');
    res(rl.line);
  });
  rl.question('', (ans) => {
      rl.close();
      res(ans.trim());
  });
  // The above hides input but can be tricky in some terminals, let's keep it simple for now without hiding or just simple readline.
});

// Simple readline for all fields
const askSimple = (q) => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, ans => { rl.close(); res(ans.trim()); });
});

const createSuperadmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅  Connected to MongoDB.');

    const name = await askSimple('Enter Superadmin Name: ');
    if (!name) throw new Error('Name is required');

    const email = await askSimple('Enter Superadmin Email: ');
    if (!email) throw new Error('Email is required');

    const password = await askSimple('Enter Superadmin Password: ');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

    let user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (user) {
      console.log(`⚠️  User with email ${email} already exists. Updating to superadmin and setting new password...`);
      user.role = 'superadmin';
      user.password = password;
      user.permissions = ['products', 'categories', 'orders', 'users', 'coupons', 'support', 'dashboard'];
      await user.save();
      console.log('✅  User updated to superadmin successfully.');
    } else {
      user = new User({
        name,
        email: email.toLowerCase().trim(),
        password,
        role: 'superadmin',
        permissions: ['products', 'categories', 'orders', 'users', 'coupons', 'support', 'dashboard']
      });
      await user.save();
      console.log('✅  Superadmin user created successfully.');
    }

  } catch (error) {
    console.error('❌  Error:', error.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
};

createSuperadmin();
