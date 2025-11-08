/**
 * Upstash Redis Cache Service (Production-Grade)
 * 
 * Uses Upstash REST API for serverless Redis caching
 * Perfect for scaling to 100K+ users
 */

const axios = require("axios");

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.warn("⚠️ Upstash Redis credentials not found in .env");
  console.warn("⚠️ Caching will be disabled");
}

const isEnabled = !!(UPSTASH_URL && UPSTASH_TOKEN);

/**
 * Execute Redis command via Upstash REST API
 */
async function executeCommand(command, ...args) {
  if (!isEnabled) return null;

  try {
    const response = await axios.post(
      `${UPSTASH_URL}/${command}/${args.join("/")}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
        },
        timeout: 3000, // 3 second timeout
      }
    );
    return response.data.result;
  } catch (error) {
    console.error(`Cache error (${command}):`, error.message);
    return null;
  }
}

/**
 * Get value from cache
 */
async function get(key) {
  try {
    const result = await executeCommand("GET", key);
    if (result) {
      return JSON.parse(result);
    }
    return null;
  } catch (error) {
    console.error("Cache GET error:", error.message);
    return null;
  }
}

/**
 * Set value in cache with TTL (seconds)
 */
async function set(key, value, ttlSeconds = 300) {
  try {
    const jsonValue = JSON.stringify(value);
    await executeCommand("SETEX", key, ttlSeconds, jsonValue);
    return true;
  } catch (error) {
    console.error("Cache SET error:", error.message);
    return false;
  }
}

/**
 * Delete key from cache
 */
async function del(key) {
  try {
    await executeCommand("DEL", key);
    return true;
  } catch (error) {
    console.error("Cache DEL error:", error.message);
    return false;
  }
}

/**
 * Delete multiple keys by pattern
 */
async function delPattern(pattern) {
  try {
    // Upstash supports KEYS command
    const keysResponse = await axios.post(
      `${UPSTASH_URL}/KEYS/${pattern}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
        },
      }
    );

    const keys = keysResponse.data.result;
    if (keys && keys.length > 0) {
      // Delete all matching keys
      for (const key of keys) {
        await del(key);
      }
      console.log(`🗑️  Deleted ${keys.length} keys matching: ${pattern}`);
    }
    return true;
  } catch (error) {
    console.error("Cache pattern delete error:", error.message);
    return false;
  }
}

/**
 * Increment counter (for rate limiting, analytics)
 */
async function incr(key, ttlSeconds = 60) {
  try {
    const result = await executeCommand("INCR", key);
    if (result === 1) {
      // First increment, set TTL
      await executeCommand("EXPIRE", key, ttlSeconds);
    }
    return result;
  } catch (error) {
    console.error("Cache INCR error:", error.message);
    return 0;
  }
}

/**
 * Get cache statistics
 */
async function getStats() {
  try {
    if (!isEnabled) {
      return { enabled: false };
    }

    const dbsize = await executeCommand("DBSIZE");
    
    return {
      enabled: true,
      type: "Upstash Redis",
      totalKeys: dbsize || 0,
      url: UPSTASH_URL?.split("@")[1] || "configured",
    };
  } catch (error) {
    return {
      enabled: false,
      error: error.message,
    };
  }
}

/**
 * Flush all cache (use sparingly!)
 */
async function flushAll() {
  try {
    await executeCommand("FLUSHDB");
    console.log("🗑️  All cache cleared");
    return true;
  } catch (error) {
    console.error("Cache flush error:", error.message);
    return false;
  }
}

/**
 * Cache wrapper for database queries
 */
async function cacheQuery(key, queryFn, ttlSeconds = 300) {
  // Try to get from cache first
  const cached = await get(key);
  if (cached) {
    console.log(`💾 Cache HIT: ${key}`);
    return cached;
  }

  console.log(`🔍 Cache MISS: ${key}`);
  
  // Execute query
  const result = await queryFn();
  
  // Store in cache
  await set(key, result, ttlSeconds);
  
  return result;
}

/**
 * Production-ready cache invalidation strategies
 */
const CacheInvalidation = {
  /**
   * Product updated
   */
  onProductUpdate: async (productId) => {
    console.log(`🗑️  Invalidating cache for product: ${productId}`);
    await del(`product:${productId}`);
    await del(`product:${productId}:reviews`);
    await delPattern("products:list:*");
    await delPattern("products:search:*");
    await del("products:top-selling");
  },

  /**
   * Product stock changed
   */
  onStockUpdate: async (productId) => {
    console.log(`🗑️  Stock updated, invalidating: ${productId}`);
    await del(`product:${productId}`);
    // Don't clear listings (stock shown separately)
  },

  /**
   * Category updated
   */
  onCategoryUpdate: async (categoryId = null) => {
    console.log(`🗑️  Invalidating category caches`);
    await del("categories:all");
    await del("subcategories:all");
    if (categoryId) {
      await del(`category:${categoryId}`);
      await delPattern(`products:list:category:${categoryId}:*`);
    } else {
      await delPattern("products:list:*");
    }
  },

  /**
   * User profile updated
   */
  onUserUpdate: async (userId) => {
    console.log(`🗑️  Invalidating user cache: ${userId}`);
    await del(`user:${userId}:profile`);
    await del(`seller:${userId}:public`);
    await del(`seller:${userId}:details`);
  },

  /**
   * Review added/updated
   */
  onReviewUpdate: async (productId) => {
    console.log(`🗑️  Review updated, invalidating: ${productId}`);
    await del(`product:${productId}`);
    await del(`product:${productId}:reviews`);
    // Ratings might affect top-selling
    await del("products:top-selling");
  },

  /**
   * Order placed (affects stock display)
   */
  onOrderPlaced: async (productIds) => {
    console.log(`🗑️  Order placed, updating product caches`);
    for (const productId of productIds) {
      await del(`product:${productId}`);
    }
  },
};

module.exports = {
  get,
  set,
  del,
  delPattern,
  incr,
  flushAll,
  getStats,
  cacheQuery,
  CacheInvalidation,
  isEnabled: () => isEnabled,
};

