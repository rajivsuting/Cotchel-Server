const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { healthLogger } = require("../utils/logger");
const { addCSRFToken } = require("../middleware/securityMiddleware");

// Basic health check
router.get("/", addCSRFToken, async (req, res) => {
  try {
    const startTime = Date.now();

    // Check database connection
    const dbStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    const dbConnectionState = mongoose.connection.readyState;

    // Get memory usage
    const memoryUsage = process.memoryUsage();

    // Get system uptime
    const uptime = process.uptime();

    // Calculate response time
    const responseTime = Date.now() - startTime;

    const healthData = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: uptime,
      responseTime: `${responseTime}ms`,
      database: {
        status: dbStatus,
        connectionState: dbConnectionState,
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
    };

    // Log health check
    healthLogger.systemHealth("ok", healthData);

    res.status(200).json(healthData);
  } catch (error) {
    healthLogger.systemHealth("error", { error: error.message });
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Detailed health check
router.get("/detailed", async (req, res) => {
  try {
    const startTime = Date.now();
    const checks = {};

    // Database health check
    try {
      const dbStart = Date.now();
      await mongoose.connection.db.admin().ping();
      const dbResponseTime = Date.now() - dbStart;

      checks.database = {
        status: "healthy",
        responseTime: `${dbResponseTime}ms`,
        connectionState: mongoose.connection.readyState,
      };

      healthLogger.databaseHealth("healthy", { responseTime: dbResponseTime });
    } catch (dbError) {
      checks.database = {
        status: "unhealthy",
        error: dbError.message,
        connectionState: mongoose.connection.readyState,
      };

      healthLogger.databaseHealth("unhealthy", { error: dbError.message });
    }

    // Memory health check
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 500 * 1024 * 1024; // 500MB
    const isMemoryHealthy = memoryUsage.heapUsed < memoryThreshold;

    checks.memory = {
      status: isMemoryHealthy ? "healthy" : "warning",
      usage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      threshold: memoryThreshold,
      percentage: Math.round((memoryUsage.heapUsed / memoryThreshold) * 100),
    };

    healthLogger.memoryUsage(memoryUsage);

    // System health check
    const uptime = process.uptime();
    const uptimeThreshold = 24 * 60 * 60; // 24 hours
    const isUptimeHealthy = uptime > uptimeThreshold;

    checks.system = {
      status: isUptimeHealthy ? "healthy" : "warning",
      uptime: uptime,
      uptimeFormatted: formatUptime(uptime),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    };

    // Overall health status
    const allChecks = Object.values(checks);
    const hasErrors = allChecks.some((check) => check.status === "unhealthy");
    const hasWarnings = allChecks.some((check) => check.status === "warning");

    let overallStatus = "healthy";
    if (hasErrors) overallStatus = "unhealthy";
    else if (hasWarnings) overallStatus = "degraded";

    const responseTime = Date.now() - startTime;

    const detailedHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks: checks,
      summary: {
        total: allChecks.length,
        healthy: allChecks.filter((c) => c.status === "healthy").length,
        warnings: allChecks.filter((c) => c.status === "warning").length,
        errors: allChecks.filter((c) => c.status === "unhealthy").length,
      },
    };

    healthLogger.systemHealth(overallStatus, detailedHealth);

    const statusCode = hasErrors ? 503 : hasWarnings ? 200 : 200;
    res.status(statusCode).json(detailedHealth);
  } catch (error) {
    healthLogger.systemHealth("error", { error: error.message });
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Database health check
router.get("/database", async (req, res) => {
  try {
    const startTime = Date.now();

    // Test database connection
    await mongoose.connection.db.admin().ping();

    const responseTime = Date.now() - startTime;

    const dbHealth = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      connectionState: mongoose.connection.readyState,
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
    };

    healthLogger.databaseHealth("healthy", dbHealth);
    res.status(200).json(dbHealth);
  } catch (error) {
    const dbHealth = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      connectionState: mongoose.connection.readyState,
    };

    healthLogger.databaseHealth("unhealthy", dbHealth);
    res.status(503).json(dbHealth);
  }
});

// Memory health check
router.get("/memory", async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 500 * 1024 * 1024; // 500MB
    const isMemoryHealthy = memoryUsage.heapUsed < memoryThreshold;

    const memoryHealth = {
      status: isMemoryHealthy ? "healthy" : "warning",
      timestamp: new Date().toISOString(),
      usage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      threshold: memoryThreshold,
      percentage: Math.round((memoryUsage.heapUsed / memoryThreshold) * 100),
      formatted: {
        rss: formatBytes(memoryUsage.rss),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        external: formatBytes(memoryUsage.external),
      },
    };

    healthLogger.memoryUsage(memoryUsage);
    res.status(200).json(memoryHealth);
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// System info
router.get("/system", async (req, res) => {
  try {
    const uptime = process.uptime();

    const systemInfo = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: uptime,
      uptimeFormatted: formatUptime(uptime),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      environment: process.env.NODE_ENV || "development",
      memory: {
        rss: formatBytes(process.memoryUsage().rss),
        heapTotal: formatBytes(process.memoryUsage().heapTotal),
        heapUsed: formatBytes(process.memoryUsage().heapUsed),
      },
    };

    res.status(200).json(systemInfo);
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Helper functions
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

module.exports = router;
