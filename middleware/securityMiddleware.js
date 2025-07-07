const rateLimit = require("express-rate-limit");
const csrf = require("csurf");

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

// CSRF protection middleware - Production friendly
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict",
  },
  ignoreMethods: ["GET", "HEAD", "OPTIONS"],
  ignorePaths: [
    "/api/razorpay/webhook",
    "/api/shiprocket/webhook",
    "/api/health",
    "/api/image/upload",
    "/api/image/upload-file",
    "/api/auth/login", // Allow login without CSRF
    "/api/auth/register", // Allow registration without CSRF
    "/api/auth/verify-email", // Allow email verification without CSRF
    "/api/auth/resend-otp", // Allow OTP resend without CSRF
    "/api/auth/request-reset", // Allow password reset request without CSRF
    "/api/auth/reset-password", // Allow password reset without CSRF
  ],
});

// CSRF error handler
const handleCSRFError = (err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({
      message: "CSRF token validation failed",
      error: "Invalid or missing CSRF token",
    });
  }
  next(err);
};

// Add CSRF token to responses
const addCSRFToken = (req, res, next) => {
  if (req.csrfToken) {
    res.cookie("XSRF-TOKEN", req.csrfToken(), {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      httpOnly: false, // Allow JavaScript access for CSRF token
    });
  }
  next();
};

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
  csrfProtection,
  handleCSRFError,
  addCSRFToken,
  fraudDetection,
};
