const rateLimit = require("express-rate-limit");
// const csrf = require("csurf"); // Removed CSRF

// In-memory storage for tracking
const orderTracking = {
  ipOrders: new Map(),
  userOrders: new Map(),
  lastOrderTime: new Map(),
};

// Rate limiter middleware
const orderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 orders per windowMs
  message: "Too many orders from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Global API rate limiter - Production friendly
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 1000 : 100, // Higher limit for production
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.NODE_ENV === "production", // Don't count successful requests in production
  skipFailedRequests: false, // Count failed requests
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user ? req.user._id : req.ip;
  },
});

// Removed CSRF protection middleware, error handler, and addCSRFToken

// Fraud detection middleware
const fraudDetection = async (req, res, next) => {
  try {
    const ip = req.ip;
    const userId = req.user._id;
    const now = Date.now();

    // Check IP-based order frequency
    const ipOrders = orderTracking.ipOrders.get(ip) || [];
    const recentIpOrders = ipOrders.filter(
      (time) => now - time < 24 * 60 * 60 * 1000
    );
    if (recentIpOrders.length >= 10) {
      return res.status(429).json({
        message: "Too many orders from this IP address",
      });
    }

    // Check user-based order velocity
    const userOrders = orderTracking.userOrders.get(userId) || [];
    const recentUserOrders = userOrders.filter(
      (time) => now - time < 60 * 60 * 1000
    );
    if (recentUserOrders.length >= 5) {
      return res.status(429).json({
        message: "Too many orders in a short time period",
      });
    }

    // Update tracking
    orderTracking.ipOrders.set(ip, [...recentIpOrders, now]);
    orderTracking.userOrders.set(userId, [...recentUserOrders, now]);
    orderTracking.lastOrderTime.set(userId, now);

    next();
  } catch (error) {
    console.error("Fraud detection error:", error);
    next();
  }
};

module.exports = {
  orderRateLimiter,
  globalRateLimiter,
  fraudDetection,
};
