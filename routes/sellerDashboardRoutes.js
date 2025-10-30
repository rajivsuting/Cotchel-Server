const express = require("express");
const router = express.Router();
const sellerDashboardController = require("../controllers/sellerDashboardController");
const {
  verifyClientToken,
  restrictTo,
} = require("../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(verifyClientToken);
// Only allow sellers to access these routes

// Single endpoint for all dashboard data
router.get("/", sellerDashboardController.getDashboardData);

// Debug endpoint to check seller data
router.get("/debug", sellerDashboardController.debugSellerData);

module.exports = router;
