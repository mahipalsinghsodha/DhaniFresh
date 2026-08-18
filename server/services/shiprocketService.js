const axios = require('axios');

const SHIPROCKET_API_URL = 'https://apiv2.shiprocket.in/v1/payload';

let _token = null;
let _tokenExpiresAt = null;

const isConfigured = () => {
  return !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
};

const getToken = async () => {
  if (!isConfigured()) return null;

  // Reuse token if valid for at least 1 more hour
  if (_token && _tokenExpiresAt && new Date() < new Date(_tokenExpiresAt.getTime() - 60 * 60 * 1000)) {
    return _token;
  }

  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/user/login/`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    });

    _token = response.data.token;
    // Token usually valid for 10 days, we'll set it to expire in 9 days for safety
    _tokenExpiresAt = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000);
    return _token;
  } catch (error) {
    console.error('Shiprocket Login Failed:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Shiprocket');
  }
};

/**
 * Creates an order in Shiprocket
 */
const createOrder = async (orderData) => {
  const token = await getToken();
  if (!token) {
    console.log(`\n========================================`);
    console.log(`🚀 MOCK SHIPROCKET CREATE ORDER`);
    console.log(`Order ID: ${orderData.order_id}`);
    console.log(`========================================\n`);
    // Return mock response
    return {
      order_id: Math.floor(Math.random() * 100000000),
      shipment_id: Math.floor(Math.random() * 100000000),
      status: 'NEW'
    };
  }

  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/orders/create/adhoc`, orderData, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Shiprocket Create Order Failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to create Shiprocket order');
  }
};

/**
 * Generates AWB for a specific shipment ID
 */
const generateAWB = async (shipmentId) => {
  const token = await getToken();
  if (!token) {
    console.log(`\n========================================`);
    console.log(`🚀 MOCK SHIPROCKET AWB`);
    console.log(`Shipment ID: ${shipmentId}`);
    console.log(`========================================\n`);
    return {
      awb_code: `MOCK_AWB_${Math.floor(Math.random() * 1000000)}`,
      courier_company_id: 1,
      courier_name: 'Mock Courier'
    };
  }

  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/courier/assign/awb`, {
      shipment_id: shipmentId
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Shiprocket AWB Failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to generate AWB');
  }
};

module.exports = {
  isConfigured,
  createOrder,
  generateAWB
};
