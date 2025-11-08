const express = require("express");
const router = express.Router();
const cache = require("../services/upstashCache");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * GET /api/cache/stats
 * Get cache statistics (Admin only)
 */
router.get(
  "/stats",
  authMiddleware.verifyAdminToken,
  async (req, res) => {
    try {
      const stats = await cache.getStats();
      
      res.status(200).json({
        success: true,
        data: stats,
        message: "Cache statistics retrieved successfully",
      });
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch cache statistics",
      });
    }
  }
);

/**
 * DELETE /api/cache/flush
 * Flush all cache (Admin only - use sparingly!)
 */
router.delete(
  "/flush",
  authMiddleware.verifyAdminToken,
  async (req, res) => {
    try {
      await cache.flushAll();
      
      res.status(200).json({
        success: true,
        message: "All cache cleared successfully",
      });
    } catch (error) {
      console.error("Error flushing cache:", error);
      res.status(500).json({
        success: false,
        message: "Failed to flush cache",
      });
    }
  }
);

/**
 * DELETE /api/cache/product/:productId
 * Invalidate specific product cache (Admin only)
 */
router.delete(
  "/product/:productId",
  authMiddleware.verifyAdminToken,
  async (req, res) => {
    try {
      const { productId } = req.params;
      await cache.CacheInvalidation.onProductUpdate(productId);
      
      res.status(200).json({
        success: true,
        message: `Cache cleared for product: ${productId}`,
      });
    } catch (error) {
      console.error("Error clearing product cache:", error);
      res.status(500).json({
        success: false,
        message: "Failed to clear product cache",
      });
    }
  }
);

module.exports = router;

