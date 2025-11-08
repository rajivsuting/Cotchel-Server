/**
 * Simple In-Memory Cache Middleware
 * 
 * Can be upgraded to Redis later for distributed caching
 * For now, provides significant performance boost with zero dependencies
 */

const NodeCache = require("node-cache");

// Create cache instances with different TTLs
const productCache = new NodeCache({
  stdTTL: 300, // 5 minutes for products
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // Better performance (be careful with mutations)
});

const orderCache = new NodeCache({
  stdTTL: 30, // 30 seconds for orders (frequently updated)
  checkperiod: 10,
  useClones: false,
});

const userCache = new NodeCache({
  stdTTL: 600, // 10 minutes for user data
  checkperiod: 120,
  useClones: false,
});

/**
 * Cache middleware factory
 */
function createCacheMiddleware(cacheInstance, keyGenerator, ttl) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Generate cache key
    const key = keyGenerator ? keyGenerator(req) : req.originalUrl;

    // Try to get from cache
    const cachedResponse = cacheInstance.get(key);

    if (cachedResponse) {
      console.log(`💾 Cache HIT: ${key}`);
      return res.status(200).json(cachedResponse);
    }

    console.log(`🔍 Cache MISS: ${key}`);

    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function (body) {
      // Only cache successful responses
      if (res.statusCode === 200 || res.statusCode === 304) {
        cacheInstance.set(key, body, ttl || undefined);
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Key generators for different routes
 */
const keyGenerators = {
  // Cache products by ID
  productById: (req) => `product:${req.params.id}`,
  
  // Cache product listings with pagination
  productList: (req) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const category = req.query.category || 'all';
    return `products:list:${category}:${page}:${limit}`;
  },

  // Cache user profile
  userProfile: (req) => `user:${req.user._id}`,

  // Cache orders with user context
  ordersByUser: (req) => `orders:${req.user._id}:${req.query.page || 1}`,
  
  // Don't cache individual order details (changes too frequently)
  // Don't cache cart (user-specific and changes often)
};

/**
 * Cache invalidation helpers
 */
function invalidateProductCache(productId) {
  if (productId) {
    productCache.del(`product:${productId}`);
    console.log(`🗑️  Invalidated cache for product: ${productId}`);
  }
  // Also clear product listings
  productCache.flushAll();
  console.log(`🗑️  Cleared all product caches`);
}

function invalidateUserCache(userId) {
  if (userId) {
    userCache.del(`user:${userId}`);
    console.log(`🗑️  Invalidated cache for user: ${userId}`);
  }
}

function invalidateOrderCache(userId) {
  // Clear all order caches for this user
  const keys = orderCache.keys();
  keys.forEach(key => {
    if (key.includes(userId)) {
      orderCache.del(key);
    }
  });
  console.log(`🗑️  Invalidated order cache for user: ${userId}`);
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    products: {
      keys: productCache.keys().length,
      hits: productCache.getStats().hits,
      misses: productCache.getStats().misses,
      hitRate: (productCache.getStats().hits / (productCache.getStats().hits + productCache.getStats().misses) * 100).toFixed(2) + '%',
    },
    orders: {
      keys: orderCache.keys().length,
      hits: orderCache.getStats().hits,
      misses: orderCache.getStats().misses,
      hitRate: (orderCache.getStats().hits / (orderCache.getStats().hits + orderCache.getStats().misses) * 100).toFixed(2) + '%',
    },
    users: {
      keys: userCache.keys().length,
      hits: userCache.getStats().hits,
      misses: userCache.getStats().misses,
      hitRate: (userCache.getStats().hits / (userCache.getStats().hits + userCache.getStats().misses) * 100).toFixed(2) + '%',
    },
  };
}

/**
 * Middleware exports
 */
module.exports = {
  // Cache instances
  productCache,
  orderCache,
  userCache,

  // Middleware factories
  cacheProducts: createCacheMiddleware(productCache, keyGenerators.productById, 300),
  cacheProductList: createCacheMiddleware(productCache, keyGenerators.productList, 180),
  cacheUserProfile: createCacheMiddleware(userCache, keyGenerators.userProfile, 600),
  
  // Don't cache orders aggressively (they update frequently)
  // Use short TTL only for list views
  cacheOrderList: createCacheMiddleware(orderCache, keyGenerators.ordersByUser, 30),

  // Invalidation helpers
  invalidateProductCache,
  invalidateUserCache,
  invalidateOrderCache,

  // Stats
  getCacheStats,
};

