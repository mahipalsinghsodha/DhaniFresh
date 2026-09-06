const axios = require('axios');

const SHIPROCKET_API_URL = 'https://apiv2.shiprocket.in/v1/external';

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
    const response = await axios.post(`${SHIPROCKET_API_URL}/auth/login`, {
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
    console.log(`🚀 [MOCK MODE] SHIPROCKET CREATE ORDER`);
    console.log(`Order ID: ${orderData.order_id}`);
    console.log(`========================================\n`);
    // Return mock response for seamless local testing
    return {
      order_id: Math.floor(10000000 + Math.random() * 90000000),
      shipment_id: Math.floor(10000000 + Math.random() * 90000000),
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
    console.log(`🚀 [MOCK MODE] SHIPROCKET AWB GENERATION`);
    console.log(`Shipment ID: ${shipmentId}`);
    console.log(`========================================\n`);
    const mockCouriers = ['Delhivery Surface', 'BlueDart Express', 'Shadowfax', 'Xpressbees'];
    const randomCourier = mockCouriers[Math.floor(Math.random() * mockCouriers.length)];
    return {
      response: {
        data: {
          awb_code: `SR${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          courier_company_id: 1,
          courier_name: randomCourier
        }
      }
    };
  }

  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/courier/assign/awb`, {
      shipment_id: shipmentId
    }, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Shiprocket AWB Failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to generate AWB');
  }
};

/**
 * Generates Shipping Label PDF URL
 */
const generateLabel = async (shipmentId) => {
  const token = await getToken();
  if (!token) {
    return { label_url: `https://www.shiprocket.in/sample-label.pdf` };
  }

  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/courier/generate/label`, {
      shipment_id: [shipmentId]
    }, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Shiprocket Label Failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to generate Shipping Label');
  }
};

/**
 * Requests Courier Pickup
 */
const requestPickup = async (shipmentId) => {
  const token = await getToken();
  if (!token) {
    return { response: { pickup_status: 1, message: 'Pickup scheduled successfully' } };
  }

  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/courier/generate/pickup`, {
      shipment_id: [shipmentId]
    }, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Shiprocket Pickup Request Failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to schedule pickup');
  }
};

/**
 * Track shipment by AWB
 */
const trackShipment = async (awbCode) => {
  const token = await getToken();
  if (!token) {
    return {
      tracking_data: {
        track_status: 1,
        shipment_status: 'IN TRANSIT',
        shipment_track: [
          { current_status: 'In Transit', location: 'Delhi Hub', date: new Date().toISOString() }
        ]
      }
    };
  }

  try {
    const response = await axios.get(`${SHIPROCKET_API_URL}/courier/track/awb/${awbCode}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Shiprocket Track Failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch tracking data');
  }
};

/**
 * Cancels an order in Shiprocket
 */
const cancelOrder = async (orderIds) => {
  const token = await getToken();
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  if (!token) {
    console.log(`🚀 [MOCK MODE] SHIPROCKET CANCEL ORDER: ${ids.join(', ')}`);
    return { status: 200, message: 'Order cancelled in Shiprocket (Mock)' };
  }

  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/orders/cancel`, {
      ids
    }, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Shiprocket Cancel Failed:', error.response?.data || error.message);
    return null;
  }
};

/**
 * Creates a Return / Reverse Pickup order in Shiprocket
 */
const createReturnOrder = async (order, pickupAddress) => {
  const token = await getToken();
  const addr = pickupAddress || order.shippingAddress || {};
  
  if (!token) {
    console.log(`\n========================================`);
    console.log(`🚀 [MOCK MODE] SHIPROCKET CREATE RETURN ORDER`);
    console.log(`Order ID: ${order._id}`);
    console.log(`Pickup Address: ${addr.street}, ${addr.city}, ${addr.state} - ${addr.zipCode}`);
    console.log(`========================================\n`);
    const mockAwb = `RET${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    return {
      success: true,
      return_order_id: Math.floor(10000000 + Math.random() * 90000000),
      shipment_id: Math.floor(10000000 + Math.random() * 90000000),
      awb_code: mockAwb,
      courier_name: 'Delhivery Reverse Pickup',
      status: 'PICKUP_SCHEDULED'
    };
  }

  try {
    const returnData = {
      order_id: `RET_${order.orderIdString || order._id}`,
      order_date: new Date().toISOString().split('T')[0],
      channel_id: '',
      pickup_customer_name: addr.name || 'Customer',
      pickup_last_name: '',
      pickup_address: addr.street || '',
      pickup_city: addr.city || '',
      pickup_state: addr.state || '',
      pickup_country: 'India',
      pickup_pincode: addr.zipCode || '',
      pickup_phone: addr.phone || '',
      shipping_customer_name: 'Daatasa Warehouse',
      shipping_address: process.env.WAREHOUSE_ADDRESS || 'Vedic Dairy Farm, Rajasthan',
      shipping_city: process.env.WAREHOUSE_CITY || 'Jodhpur',
      shipping_state: process.env.WAREHOUSE_STATE || 'Rajasthan',
      shipping_country: 'India',
      shipping_pincode: process.env.WAREHOUSE_PINCODE || '342001',
      shipping_phone: process.env.WAREHOUSE_PHONE || '9882844137',
      order_items: (order.orderItems || []).map(item => ({
        name: item.name || 'Ghee Item',
        sku: item.sku || `SKU_${item.product}`,
        units: item.quantity || 1,
        selling_price: item.price || 0
      })),
      sub_total: order.totalPrice || 0,
      length: 12,
      breadth: 12,
      height: 12,
      weight: 1.0
    };

    const response = await axios.post(`${SHIPROCKET_API_URL}/orders/create/return`, returnData, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    return {
      success: true,
      return_order_id: response.data.order_id,
      shipment_id: response.data.shipment_id,
      awb_code: response.data.awb_code || null,
      courier_name: response.data.courier_name || 'Assigned Courier',
      status: 'PICKUP_SCHEDULED'
    };
  } catch (error) {
    console.error('Shiprocket Return Order Creation Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

module.exports = {
  isConfigured,
  createOrder,
  generateAWB,
  generateLabel,
  requestPickup,
  trackShipment,
  cancelOrder,
  createReturnOrder
};
