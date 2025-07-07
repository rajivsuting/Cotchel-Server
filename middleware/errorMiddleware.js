const { AppError } = require("../utils/errors");
const logger = require("../utils/logger");

// Error tracking service (Sentry-like functionality)
const trackError = (error, req) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
    userId: req.user?.id || "anonymous",
    requestId: req.id || "unknown",
  };

  // Log to structured logger with fallback
  try {
    if (logger && typeof logger.error === "function") {
      logger.error("Application Error", errorInfo);
    } else {
      console.error("Application Error:", errorInfo);
    }
  } catch (loggerError) {
    console.error("Logger error:", loggerError);
    console.error("Original error:", errorInfo);
  }

  // In production, you would send this to Sentry or similar service
  if (process.env.NODE_ENV === "production") {
    // Example: Sentry.captureException(error, { extra: errorInfo });
    console.error("Error tracked for production monitoring:", errorInfo);
  }
};

// Handle different types of errors
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((val) => val.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateKeyError = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleJWTError = () => {
  return new AppError("Invalid token. Please log in again!", 401);
};

const handleJWTExpiredError = () => {
  return new AppError("Your token has expired! Please log in again.", 401);
};

const handleMongoError = (err) => {
  if (err.name === "MongoError" && err.code === 11000) {
    return handleDuplicateKeyError(err);
  }
  return new AppError("Database error occurred", 500);
};

module.exports = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Track error for monitoring
  trackError(err, req);

  // Handle specific error types
  if (err.name === "CastError") error = handleCastError(error);
  if (err.code === 11000) error = handleDuplicateKeyError(error);
  if (err.name === "ValidationError") error = handleValidationError(error);
  if (err.name === "JsonWebTokenError") error = handleJWTError();
  if (err.name === "TokenExpiredError") error = handleJWTExpiredError();
  if (err.name === "MongoError") error = handleMongoError(error);

  // Log error details
  try {
    if (logger && typeof logger.error === "function") {
      logger.error("Error details", {
        error: error.message,
        stack: error.stack,
        statusCode: error.statusCode || 500,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id || "anonymous",
      });
    } else {
      console.error("Error details:", {
        error: error.message,
        stack: error.stack,
        statusCode: error.statusCode || 500,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id || "anonymous",
      });
    }
  } catch (loggerError) {
    console.error("Logger error:", loggerError);
    console.error("Original error details:", {
      error: error.message,
      stack: error.stack,
      statusCode: error.statusCode || 500,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id || "anonymous",
    });
  }

  // Send error response
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details || null,
      timestamp: new Date().toISOString(),
      requestId: req.id || "unknown",
    });
  }

  // Handle unknown errors
  const statusCode = error.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Something went wrong!"
      : error.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    requestId: req.id || "unknown",
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
};
