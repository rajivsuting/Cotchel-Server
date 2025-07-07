const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { verifyToken, restrictTo } = require("../middleware/authMiddleware");

// All routes should be protected and only accessible by admin
router.use(verifyToken, restrictTo("Admin"));

// Get combined dashboard data
router.get("/dashboard", analyticsController.getDashboardData);

// Get real-time statistics
router.get("/real-time-stats", analyticsController.getRealTimeStats);

// Legacy endpoints - can be removed if not needed
router.get("/revenue", analyticsController.getMonthlyRevenue);
router.get("/user-growth", analyticsController.getUserGrowth);
router.get("/summary-stats", analyticsController.getSummaryStats);

module.exports = router;
