module.exports = {
  // Server Configuration
  PORT: process.env.PORT || 5000,
  NODE_ENV: "production",

  // MongoDB Configuration
  MONGODB_URI: process.env.MONGODB_URI,

  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: "7d",

  // Razorpay Configuration
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,

  // Shiprocket Configuration
  SHIPROCKET_EMAIL: process.env.SHIPROCKET_EMAIL,
  SHIPROCKET_PASSWORD: process.env.SHIPROCKET_PASSWORD,
  SHIPROCKET_WEBHOOK_SECRET: process.env.SHIPROCKET_WEBHOOK_SECRET,

  // CORS Configuration
  CLIENT_URL: process.env.CLIENT_URL,
  PRO_URL: process.env.PRO_URL,
  DEV_URL: process.env.DEV_URL,

  // Rate Limiting - Production Settings
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 1000, // Increased for production
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: true, // Don't count successful requests
  RATE_LIMIT_SKIP_FAILED_REQUESTS: false, // Count failed requests

  // CSRF Configuration - Production Settings
  CSRF_COOKIE_SECURE: true, // HTTPS only in production
  CSRF_COOKIE_SAME_SITE: "strict",
  CSRF_COOKIE_HTTP_ONLY: true,

  // Security
  TRUST_PROXY: 1,

  // Logging
  LOG_LEVEL: "info",

  // Error Handling
  ERROR_LOG_FILE: "logs/error.log",
  COMBINED_LOG_FILE: "logs/combined.log",

  // Production-specific settings
  ENABLE_CSRF_PROTECTION: true,
  ENABLE_RATE_LIMITING: true,
  ENABLE_SECURITY_HEADERS: true,
};
