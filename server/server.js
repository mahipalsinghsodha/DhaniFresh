const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const passport = require("passport");
const session = require("express-session");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const http = require("http");
const path = require("path");
const startOrderCleanup = require('./services/orderCleanup');
const MongoStore = require('connect-mongo');
const dbCheck = require('./middleware/dbCheck');


dotenv.config();

// Enforce required env variables
const requiredEnvVars = [
  'MONGODB_URI', 'JWT_SECRET', 'SESSION_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
  'CLIENT_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL ERROR: Missing required environment variable ${envVar}`);
    process.exit(1);
  }
}

const app = express();

/*
=====================
MIDDLEWARE
=====================
*/

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "http:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));

// Trust proxy for rate limiter to get accurate IP behind load balancers/proxies
app.set('trust proxy', 1);

// Limit requests from same API
const limiter = rateLimit({
  max: process.env.NODE_ENV === 'production' ? 100 : 5000,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many requests from this IP, please try again in 15 minutes!'
});
app.use('/api', limiter);

// ✅ FIX C5: Razorpay webhook MUST receive raw body for HMAC signature validation
// Registered BEFORE express.json() so it gets raw Buffer (not parsed object)
// paymentController.razorpayWebhook handles Buffer vs string via req.body
app.post(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/paymentController').razorpayWebhook
);

app.use(express.json({ limit: '10kb' })); // Body parser for all other routes
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser — required for httpOnly refresh token cookie
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.SESSION_SECRET));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

/*
=====================
PASSPORT
=====================
*/
require("./config/passport")();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

/*
=====================
HEALTH CHECK
=====================
*/

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    mongodb:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

/*
=====================
ROUTES
=====================
*/

app.use('/api', dbCheck); // DB check for all API routes

app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/auth", require("./routes/oauth"));
app.use("/api/otp", require("./routes/otpRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use('/api/contact', require('./routes/contactRoute'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/pincode', require('./routes/pincodeRoute'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/subscribers', require('./routes/subscriberRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/courier', require('./routes/courierRoutes'));
app.use('/api/blogs', require('./routes/blogRoutes'));
app.use('/api/giftcards', require('./routes/giftCardRoutes'));
app.use('/api/shiprocket', require('./routes/shiprocketRoutes'));

// Dynamic sitemap — accessible at GET /sitemap.xml (no /api prefix, for search engines)
app.use('/sitemap.xml', require('./routes/sitemapRoute'));

/*
=====================
SERVE FRONTEND (PRODUCTION)
=====================
*/
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API is running in development mode...');
  });
}

/*
=====================
ERROR HANDLER
=====================
*/

app.use((err, req, res, next) => {
  console.error("Global error:", err);

  // Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(400).json({ message: 'Duplicate field value entered' });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    return res.status(400).json({ message });
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

/*
=====================
404 API ROUTE
=====================
*/

// If the request starts with /api and reaches here, it's a 404
app.use('/api', (req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

/*
=====================
DATABASE
=====================
*/

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected. Attempting reconnect...');
  setTimeout(connectDB, 5000);
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

/*
=====================
START SERVER
=====================
*/

const startServer = async () => {
  await connectDB();

  // Start background jobs
  startOrderCleanup();
  require('./cron')();

  const PORT = process.env.PORT || 5000;

  // ── Socket.io Server ──────────────────────────────────────────────────────
  const server = http.createServer(app);
  const { initSocketServer } = require('./socket');
  initSocketServer(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.io listening on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await mongoose.connection.close();
      console.log('Server and DB connections closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

startServer();
