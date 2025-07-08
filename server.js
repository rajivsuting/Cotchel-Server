require("dotenv").config();
const cors = require("cors");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// Import enhanced logging and monitoring
const {
  logger,
  requestLogger,
  securityLogger,
  performanceLogger,
} = require("./utils/logger");

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  `${process.env.PRO_URL}`,
  `${process.env.DEV_URL}`,
  "http://localhost:5173",
  "http://localhost:5174",
  "https://cotchel-admin-hy3ln.ondigitalocean.app",
];
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Make io and securityLogger globally available
global.io = io;
global.securityLogger = securityLogger;

// Trust proxy for rate limiting
app.set("trust proxy", 1);

// Request logging middleware (must be first)
app.use(requestLogger);

// Security middleware - Helmet.js
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
  })
);

// Basic middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-CSRF-Token",
      "X-Request-ID",
    ],
  })
);

// Import routes
const authRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const subCategoryRoutes = require("./routes/subCategoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const cartRoutes = require("./routes/cartRoutes");
const addressRoutes = require("./routes/addressRoutes");
const razorpayRoutes = require("./routes/razorpayRoutes");
const tempOrderRoutes = require("./routes/tempOrderRoutes");
const wishListRoutes = require("./routes/wishListRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const promotionalBannerRoutes = require("./routes/promotionalBannerRoutes");
const adminTransactionRoutes = require("./routes/adminRoutes");
const sellerEarningsRoutes = require("./routes/sellerEarningsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const sellerDashboardRoutes = require("./routes/sellerDashboardRoutes");
const healthRoutes = require("./routes/healthRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");
const testRoutes = require("./routes/testRoutes");

// Import middleware and utilities
const connectDb = require("./database/connectDb");
const errorMiddleware = require("./middleware/errorMiddleware");
const { verifyToken } = require("./middleware/authMiddleware");
const {
  globalRateLimiter,
  csrfProtection,
  handleCSRFError,
  addCSRFToken,
} = require("./middleware/securityMiddleware");
const { setupSocket } = require("./sockets/notificationSocket");

// Global rate limiting with logging
app.use("/api", (req, res, next) => {
  globalRateLimiter(req, res, (err) => {
    if (err && err.status === 429) {
      securityLogger.rateLimitExceeded(req, {
        limit: req.rateLimit?.limit,
        remaining: req.rateLimit?.remaining,
        resetTime: req.rateLimit?.resetTime,
      });
    }
    next(err);
  });
});

// Attach io to req for use in controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// CSRF protection - uses the configured ignoreMethods from securityMiddleware
app.use("/api", csrfProtection);

// Add CSRF token to responses
app.use(addCSRFToken);

// CSRF error handler
app.use(handleCSRFError);

// Routes
app.get("/", verifyToken, (req, res) => {
  const message = "Welcome to Cotchel!";
  res.json({ message });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/subcategories", subCategoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/image", uploadRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/razorpay", razorpayRoutes);
app.use("/api/address", addressRoutes);
app.use("/api/wishlist", wishListRoutes);
app.use("/api/order-temp", tempOrderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/promotional-banners", promotionalBannerRoutes);
app.use("/api/admin", adminTransactionRoutes);
app.use("/api/seller/earnings", sellerEarningsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/seller/dashboard", sellerDashboardRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/test", testRoutes);

// Setup Socket.IO
setupSocket(io);

// Connect to database and start server
connectDb()
  .then(() => {
    logger.info("Database connected successfully");
  })
  .catch((error) => {
    logger.error("Database connection failed", { error: error.message });
  });

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    performanceLogger.slowRequest(req, duration);
  });
  next();
});

// Error handling middleware
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

// Unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Promise Rejection", {
    error: err.message,
    stack: err.stack,
  });
  server.close(() => {
    process.exit(1);
  });
});

// Uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { error: err.message, stack: err.stack });
  server.close(() => {
    process.exit(1);
  });
});
