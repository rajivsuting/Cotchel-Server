/**
 * Production-Grade Caching Service
 * 
 * Uses Redis (ioredis) for distributed caching
 * Falls back to in-memory cache if Redis not available
 */

const Redis = require("ioredis");

// Try to connect to Redis, fall back to memory cache if not available
let redis = null;
let useRedis = false;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn("⚠️ Redis connection failed, using in-memory cache");
        return null; // Stop retrying
      }
      return Math.min(times * 100, 2000);
    },
    maxRetriesPerRequest: 3,
  });

  redis.on("connect", () => {
    console.log("✅ Redis connected for caching");
    useRedis = true;
  });

  redis.on("error", (err) => {
    console.warn("⚠️ Redis error, falling back to memory cache:", err.message);
    useRedis = false;
  });
} catch (error) {
  console.warn("⚠️ Redis not available, using in-memory cache");
}

// Simple in-memory cache fallback
const memoryCache = new Map();

/**
 * Get from cache
 */
async function get(key) {
  try {
    if (useRedis && redis) {
      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data);
      }
    } else {
      // Fallback to memory
      const cached = memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }
    }
    return null;
  } catch (error) {
    console.error("Cache get error:", error.message);
    return null;
  }
}

/**
 * Set in cache
 */
async function set(key, value, ttlSeconds = 300) {
  try {
    if (useRedis && redis) {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } else {
      // Fallback to memory
      memoryCache.set(key, {
        data: value,
        expiry: Date.now() + ttlSeconds * 1000,
      });
    }
  } catch (error) {
    console.error("Cache set error:", error.message);
  }
}

/**
 * Delete from cache
 */
async function del(key) {
  try {
    if (useRedis && redis) {
      await redis.del(key);
    } else {
      memoryCache.delete(key);
    }
  } catch (error) {
    console.error("Cache delete error:", error.message);
  }
}

/**
 * Delete multiple keys by pattern
 */
async function delPattern(pattern) {
  try {
    if (useRedis && redis) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      // Memory cache pattern matching
      for (const [key] of memoryCache) {
        if (key.includes(pattern.replace("*", ""))) {
          memoryCache.delete(key);
        }
      }
    }
  } catch (error) {
    console.error("Cache pattern delete error:", error.message);
  }
}

/**
 * Clear all cache
 */
async function flushAll() {
  try {
    if (useRedis && redis) {
      await redis.flushall();
    } else {
      memoryCache.clear();
    }
    console.log("🗑️  Cache cleared");
  } catch (error) {
    console.error("Cache flush error:", error.message);
  }
}

/**
 * Get cache stats
 */
async function getStats() {
  try {
    if (useRedis && redis) {
      const info = await redis.info("stats");
      return {
        type: "redis",
        connected: useRedis,
        info: info,
      };
    } else {
      return {
        type: "memory",
        keys: memoryCache.size,
        connected: true,
      };
    }
  } catch (error) {
    return {
      type: "error",
      connected: false,
      error: error.message,
    };
  }
}

/**
 * Cache invalidation strategies
 */
const CacheInvalidation = {
  // Invalidate product caches
  onProductUpdate: async (productId) => {
    await del(`product:${productId}`);
    await delPattern("products:list:*");
    console.log(`🗑️  Product cache invalidated: ${productId}`);
  },

  // Invalidate user caches
  onUserUpdate: async (userId) => {
    await del(`user:${userId}`);
    console.log(`🗑️  User cache invalidated: ${userId}`);
  },

  // Invalidate order caches
  onOrderUpdate: async (userId) => {
    await delPattern(`orders:${userId}:*`);
    console.log(`🗑️  Order cache invalidated for user: ${userId}`);
  },

  // Invalidate on stock change
  onStockUpdate: async (productId) => {
    await del(`product:${productId}`);
    await delPattern("products:list:*");
    console.log(`🗑️  Stock update - cache invalidated: ${productId}`);
  },
};

module.exports = {
  get,
  set,
  del,
  delPattern,
  flushAll,
  getStats,
  CacheInvalidation,
  isRedisAvailable: () => useRedis,
};

