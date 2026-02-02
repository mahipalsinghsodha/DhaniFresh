// Simple test script to check registration endpoint
const axios = require('axios');

const testRegister = async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'test123'
    });
    console.log('✅ Registration successful:', response.data);
  } catch (error) {
    console.error('❌ Registration failed:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data);
    console.error('Full error:', error.message);
  }
};

// First check health
axios.get('http://localhost:5000/api/health')
  .then(res => {
    console.log('Health check:', res.data);
    return testRegister();
  })
  .catch(err => {
    console.error('❌ Server not running or health check failed:', err.message);
    console.log('\nMake sure:');
    console.log('1. Backend server is running (npm run dev)');
    console.log('2. MongoDB is running');
    console.log('3. Server is on port 5000');
  });
