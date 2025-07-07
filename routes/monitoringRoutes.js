const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { performanceLogger, healthLogger } = require("../utils/logger");
const os = require("os");

// Get system metrics
router.get("/metrics", async (req, res) => {
  try {
    const startTime = Date.now();

    // System metrics
    const systemMetrics = {
      cpu: {
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
        architecture: os.arch(),
        platform: os.platform(),
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percentage: Math.round(
          ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
        ),
      },
      uptime: {
        system: os.uptime(),
        process: process.uptime(),
      },
    };

    // Process metrics
    const processMetrics = {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      pid: process.pid,
      version: process.version,
      platform: process.platform,
    };

    // Database metrics
    let dbMetrics = {};
    try {
      const dbStart = Date.now();
      await mongoose.connection.db.admin().ping();
      const dbResponseTime = Date.now() - dbStart;

      dbMetrics = {
        status: "connected",
        responseTime: dbResponseTime,
        connectionState: mongoose.connection.readyState,
        collections: await mongoose.connection.db
          .listCollections()
          .toArray()
          .then((cols) => cols.length),
      };
    } catch (error) {
      dbMetrics = {
        status: "disconnected",
        error: error.message,
        connectionState: mongoose.connection.readyState,
      };
    }

    const responseTime = Date.now() - startTime;

    const metrics = {
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      system: systemMetrics,
      process: processMetrics,
      database: dbMetrics,
    };

    // Log metrics collection
    healthLogger.systemHealth("metrics_collected", metrics);

    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Get performance metrics
router.get("/performance", async (req, res) => {
  try {
    const performanceMetrics = {
      timestamp: new Date().toISOString(),
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external,
        formatted: {
          rss: formatBytes(process.memoryUsage().rss),
          heapTotal: formatBytes(process.memoryUsage().heapTotal),
          heapUsed: formatBytes(process.memoryUsage().heapUsed),
          external: formatBytes(process.memoryUsage().external),
        },
      },
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: os.loadavg(),
      },
      uptime: {
        system: formatUptime(os.uptime()),
        process: formatUptime(process.uptime()),
      },
    };

    res.status(200).json(performanceMetrics);
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Get database statistics
router.get("/database/stats", async (req, res) => {
  try {
    const dbStats = await mongoose.connection.db.stats();

    const stats = {
      timestamp: new Date().toISOString(),
      collections: dbStats.collections,
      dataSize: {
        bytes: dbStats.dataSize,
        formatted: formatBytes(dbStats.dataSize),
      },
      storageSize: {
        bytes: dbStats.storageSize,
        formatted: formatBytes(dbStats.storageSize),
      },
      indexes: dbStats.indexes,
      indexSize: {
        bytes: dbStats.indexSize,
        formatted: formatBytes(dbStats.indexSize),
      },
      objects: dbStats.objects,
      avgObjSize: {
        bytes: dbStats.avgObjSize,
        formatted: formatBytes(dbStats.avgObjSize),
      },
    };

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Get collection statistics
router.get("/database/collections", async (req, res) => {
  try {
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const collectionStats = [];

    for (const collection of collections) {
      try {
        const stats = await mongoose.connection.db
          .collection(collection.name)
          .stats();
        collectionStats.push({
          name: collection.name,
          count: stats.count,
          size: {
            bytes: stats.size,
            formatted: formatBytes(stats.size),
          },
          avgObjSize: {
            bytes: stats.avgObjSize,
            formatted: formatBytes(stats.avgObjSize),
          },
          storageSize: {
            bytes: stats.storageSize,
            formatted: formatBytes(stats.storageSize),
          },
          indexes: stats.nindexes,
          indexSize: {
            bytes: stats.totalIndexSize,
            formatted: formatBytes(stats.totalIndexSize),
          },
        });
      } catch (error) {
        collectionStats.push({
          name: collection.name,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      timestamp: new Date().toISOString(),
      collections: collectionStats,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Get system alerts
router.get("/alerts", async (req, res) => {
  try {
    const alerts = [];
    const memoryUsage = process.memoryUsage();
    const systemMemory = os.totalmem() - os.freemem();
    const systemMemoryPercentage = (systemMemory / os.totalmem()) * 100;

    // Memory alerts
    if (memoryUsage.heapUsed > 500 * 1024 * 1024) {
      // 500MB
      alerts.push({
        type: "warning",
        category: "memory",
        message: "High heap memory usage detected",
        value: formatBytes(memoryUsage.heapUsed),
        threshold: "500MB",
        timestamp: new Date().toISOString(),
      });
    }

    if (systemMemoryPercentage > 80) {
      alerts.push({
        type: "warning",
        category: "system",
        message: "High system memory usage",
        value: `${Math.round(systemMemoryPercentage)}%`,
        threshold: "80%",
        timestamp: new Date().toISOString(),
      });
    }

    // CPU alerts
    const loadAverage = os.loadavg()[0];
    const cpuCores = os.cpus().length;
    if (loadAverage > cpuCores * 0.8) {
      alerts.push({
        type: "warning",
        category: "cpu",
        message: "High CPU load detected",
        value: loadAverage.toFixed(2),
        threshold: `${(cpuCores * 0.8).toFixed(2)}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Database alerts
    if (mongoose.connection.readyState !== 1) {
      alerts.push({
        type: "error",
        category: "database",
        message: "Database connection issue",
        value: mongoose.connection.readyState,
        expected: 1,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      timestamp: new Date().toISOString(),
      alerts: alerts,
      count: alerts.length,
    });
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
