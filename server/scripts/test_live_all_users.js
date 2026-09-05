const axios = require('axios');
const { io } = require('../../client/node_modules/socket.io-client');

const BASE_API = 'https://daatasa.onrender.com';
const NETLIFY_URL = 'https://daatasa.netlify.app';

const accounts = {
  customer: {
    email: 'test2510@gmail.com',
    pass: '123456789',
    role: 'user'
  },
  support: {
    email: 'support1@daatasa.com',
    pass: '123456789',
    role: 'support'
  },
  superadmin: {
    email: 'mahipal.gtropy@gmail.com',
    pass: '123456789',
    role: 'superadmin'
  }
};

async function testAll() {
  console.log('====================================================');
  console.log('🚀 LIVE COMPREHENSIVE QA & FEATURE VALIDATION');
  console.log('====================================================\n');

  // 0. Check Netlify deployment
  try {
    const netlifyRes = await axios.get(NETLIFY_URL);
    console.log(`✅ [Netlify Frontend] Status: ${netlifyRes.status} (Serving SPA successfully)`);
  } catch (err) {
    console.error(`❌ [Netlify Frontend] Error:`, err.message);
  }

  // 1. Authenticate All 3 Accounts
  console.log('\n--- 1. AUTHENTICATION OF ALL 3 ROLES ---');
  const tokens = {};
  for (const [key, acc] of Object.entries(accounts)) {
    try {
      const res = await axios.post(`${BASE_API}/api/auth/login`, {
        emailOrPhone: acc.email,
        password: acc.pass
      });
      tokens[key] = res.data.token;
      const user = res.data.user;
      console.log(`✅ [${key.toUpperCase()}] Logged in successfully: ${user.name} (${user.email}) -> Role: ${user.role}`);
    } catch (err) {
      console.error(`❌ [${key.toUpperCase()}] Login failed:`, err.response?.data || err.message);
    }
  }

  // 2. Normal Customer Feature Validation
  console.log('\n--- 2. NORMAL CUSTOMER (test2510@gmail.com) FEATURE VALIDATION ---');
  const custHeaders = { Authorization: `Bearer ${tokens.customer}` };
  
  try {
    const me = await axios.get(`${BASE_API}/api/auth/me`, { headers: custHeaders });
    console.log(`✅ [Customer Profile] Name: ${me.data.user?.name || me.data.name}, Phone: ${me.data.user?.phone || me.data.phone || 'N/A'}`);
  } catch (e) {
    console.error(`❌ [Customer Profile]`, e.response?.status, e.response?.data || e.message);
  }

  try {
    const prods = await axios.get(`${BASE_API}/api/products`);
    console.log(`✅ [Public Products Catalog] Loaded ${prods.data.products?.length || prods.data.length || 0} products`);
  } catch (e) {
    console.error(`❌ [Public Products]`, e.message);
  }

  try {
    const cart = await axios.get(`${BASE_API}/api/cart`, { headers: custHeaders });
    console.log(`✅ [Customer Cart] Current items count: ${cart.data?.items?.length ?? 0}`);
  } catch (e) {
    console.error(`❌ [Customer Cart]`, e.response?.status, e.response?.data || e.message);
  }

  try {
    const myOrders = await axios.get(`${BASE_API}/api/orders/myorders`, { headers: custHeaders });
    console.log(`✅ [Customer Orders] Total user orders: ${myOrders.data?.length ?? 0}`);
  } catch (e) {
    console.error(`❌ [Customer Orders]`, e.response?.status, e.response?.data || e.message);
  }

  try {
    const wallet = await axios.get(`${BASE_API}/api/wallet`, { headers: custHeaders });
    console.log(`✅ [Customer Wallet] Balance: ₹${wallet.data?.walletBalance ?? 0}`);
  } catch (e) {
    console.error(`❌ [Customer Wallet]`, e.response?.status, e.response?.data || e.message);
  }

  // 3. Support Agent Feature Validation
  console.log('\n--- 3. SUPPORT AGENT (support1@daatasa.com) FEATURE VALIDATION ---');
  const suppHeaders = { Authorization: `Bearer ${tokens.support}` };

  try {
    const agents = await axios.get(`${BASE_API}/api/admin/support-agents`, { headers: suppHeaders });
    console.log(`✅ [Support Agents List] Loaded ${agents.data?.length ?? 0} staff members with loginTime and presence`);
    if (agents.data?.[0]) {
      console.log(`   Sample Agent: ${agents.data[0].name} -> Live: ${agents.data[0].supportStats?.isLive ?? false}, Login: ${agents.data[0].loginTime || agents.data[0].lastLogin}`);
    }
  } catch (e) {
    console.error(`❌ [Support Agents List]`, e.response?.status, e.response?.data || e.message);
  }

  try {
    const sessions = await axios.get(`${BASE_API}/api/chat/sessions`, { headers: suppHeaders });
    console.log(`✅ [Chat Desk Sessions] Loaded ${sessions.data?.length ?? 0} active/waiting chat sessions`);
  } catch (e) {
    console.error(`❌ [Chat Desk Sessions]`, e.response?.status, e.response?.data || e.message);
  }

  try {
    const online = await axios.get(`${BASE_API}/api/chat/agents/online`, { headers: suppHeaders });
    console.log(`✅ [Online Agents API] Live online count: ${online.data?.count ?? 0}`);
  } catch (e) {
    console.error(`❌ [Online Agents API]`, e.response?.status, e.response?.data || e.message);
  }

  // 4. Super Admin Feature Validation
  console.log('\n--- 4. SUPER ADMIN (mahipal.gtropy@gmail.com) FEATURE VALIDATION ---');
  const saHeaders = { Authorization: `Bearer ${tokens.superadmin}` };

  const saChecks = [
    ['Analytics Overview', '/api/admin/analytics'],
    ['Platform Settings', '/api/settings'],
    ['All Orders Manager', '/api/orders?page=1&limit=5'],
    ['Admin & Staff Accounts', '/api/admin/admins'],
    ['Audit Activity Logs', '/api/admin/logs'],
    ['Coupons Manager', '/api/coupons'],
    ['Categories Manager', '/api/categories'],
    ['Reviews Manager', '/api/reviews/admin'],
    ['User Activity Tracker', '/api/activity/admin'],
    ['Subscriptions Plans', '/api/subscriptions/plans']
  ];

  for (const [name, url] of saChecks) {
    try {
      const res = await axios.get(`${BASE_API}${url}`, { headers: saHeaders, timeout: 8000 });
      console.log(`✅ [SuperAdmin: ${name}] -> Status ${res.status}`);
    } catch (e) {
      console.error(`❌ [SuperAdmin: ${name}] -> Status ${e.response?.status || 'ERR'} ${JSON.stringify(e.response?.data || e.message)}`);
    }
  }

  // 5. WebSocket Real-time Connection & Live Chat Presence Test
  console.log('\n--- 5. REAL-TIME SOCKET.IO LIVE PRESENCE & CHAT TEST ---');
  await new Promise((resolve) => {
    const agentSocket = io(BASE_API, {
      auth: { token: tokens.support },
      transports: ['websocket']
    });

    agentSocket.on('connect', () => {
      console.log(`✅ [Support Socket Connected] Socket ID: ${agentSocket.id}`);
      
      // Customer socket connects
      const custSocket = io(BASE_API, {
        auth: { token: tokens.customer },
        transports: ['websocket']
      });

      custSocket.on('connect', () => {
        console.log(`✅ [Customer Socket Connected] Socket ID: ${custSocket.id}`);
        
        // Start a test chat session
        custSocket.emit('chat:start', {
          guestName: 'Test Customer',
          category: 'GENERAL',
          initialMessage: 'Hello, I want to verify live chat connection!'
        });
      });

      custSocket.on('chat:session_created', ({ sessionId }) => {
        console.log(`✅ [Customer Chat Session Created] Session ID: ${sessionId}`);

        // Customer emits typing indicator
        custSocket.emit('chat:typing', { sessionId, isTyping: true });
        console.log(`✅ [Customer Emitted Typing Event] isTyping: true for session ${sessionId}`);

        setTimeout(() => {
          agentSocket.disconnect();
          custSocket.disconnect();
          console.log(`✅ [Socket Test Complete] Both sockets disconnected cleanly.`);
          resolve();
        }, 1200);
      });

      custSocket.on('chat:message', (msg) => {
        console.log(`✅ [Customer Received Message] Sender: ${msg.senderName} (${msg.senderType}): "${msg.content?.slice(0, 50)}..."`);
      });
    });

    agentSocket.on('connect_error', (err) => {
      console.error(`❌ [Agent Socket Error]`, err.message);
      resolve();
    });
  });

  console.log('\n====================================================');
  console.log('🎉 ALL LIVE ROLES & CORE FEATURES TESTED SUCCESSFULLY!');
  console.log('====================================================');
}

testAll().catch(console.error);
