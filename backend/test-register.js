/**
 * Simple test script to check backend health & user registration
 * Works for both LOCAL and PRODUCTION (Render)
 */

const axios = require('axios');
require('dotenv').config();

// Base URL from environment (fallback to localhost)
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

console.log('🔗 Using API Base URL:', BASE_URL);

// Health check
const checkHealth = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/api/health`);
    console.log('🟢 Health check OK:', res.data);
    return true;
  } catch (err) {
    console.error('❌ Health check failed:', err.message);
    return false;
  }
};

// Registration test
const testRegister = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'test123'
    });

    console.log('✅ Registration successful');
    console.log(response.data);
  } catch (error) {
    console.error('❌ Registration failed');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data || error.message);
  }
};

// Run tests
(async () => {
  console.log('\n🚀 Starting API Test...\n');

  const isHealthy = await checkHealth();
  if (!isHealthy) {
    console.log('\n⚠️ Fix issues before testing registration.');
    return;
  }

  await testRegister();
})();
