const winston = require("winston");
const { format } = winston;
const path = require("path");

// Create logs directory if it doesn't exist
const fs = require("fs");
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const structuredFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
      service: "cotchel-server",
      environment: process.env.NODE_ENV || "development",
    });
  })
);

// Console format for development
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : "";
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: structuredFormat,
  defaultMeta: {
    service: "cotchel-server",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    }),

    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    }),

    // Access logs
    new winston.transports.File({
      filename: path.join(logsDir, "access.log"),
      level: "info",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    }),

    // Security logs
    new winston.transports.File({
      filename: path.join(logsDir, "security.log"),
      level: "warn",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Add request ID for tracking
  req.id = req.headers["x-request-id"] || generateRequestId();

  // Log request
  logger.info("Incoming request", {
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id || "anonymous",
    timestamp: new Date().toISOString(),
  });

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? "warn" : "info";

    logger.log(logLevel, "Request completed", {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id || "anonymous",
      timestamp: new Date().toISOString(),
    });
  });

  next();
};

// Security event logger
const securityLogger = {
  csrfViolation: (req, details) => {
    logger.warn("CSRF violation detected", {
      requestId: req.id,
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
      details,
      timestamp: new Date().toISOString(),
    });
  },

  rateLimitExceeded: (req, details) => {
    logger.warn("Rate limit exceeded", {
      requestId: req.id,
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
      details,
      timestamp: new Date().toISOString(),
    });
  },

  authenticationFailure: (req, details) => {
    logger.warn("Authentication failure", {
      requestId: req.id,
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
      details,
      timestamp: new Date().toISOString(),
    });
  },

  suspiciousActivity: (req, details) => {
    logger.error("Suspicious activity detected", {
      requestId: req.id,
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
      details,
      timestamp: new Date().toISOString(),
    });
  },
};

// Performance monitoring
const performanceLogger = {
  slowRequest: (req, duration, threshold = 1000) => {
    if (duration > threshold) {
      logger.warn("Slow request detected", {
        requestId: req.id,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        threshold: `${threshold}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  },

  databaseQuery: (operation, duration, collection) => {
    if (duration > 100) {
      // Log queries taking more than 100ms
      logger.info("Database query", {
        operation,
        collection,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  },
};

// Generate unique request ID
function generateRequestId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// Health check logger
const healthLogger = {
  systemHealth: (status, details) => {
    logger.info("System health check", {
      status,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  databaseHealth: (status, details) => {
    logger.info("Database health check", {
      status,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  memoryUsage: (usage) => {
    logger.info("Memory usage", {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      timestamp: new Date().toISOString(),
    });
  },
};

module.exports = {
  logger,
  requestLogger,
  securityLogger,
  performanceLogger,
  healthLogger,
};
