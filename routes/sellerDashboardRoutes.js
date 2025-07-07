const express = require("express");
const router = express.Router();
const sellerDashboardController = require("../controllers/sellerDashboardController");
const { verifyToken, restrictTo } = require("../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(verifyToken);
router.use(restrictTo("Seller")); // Only allow sellers to access these routes

// Single endpoint for all dashboard data
router.get("/", sellerDashboardController.getDashboardData);

module.exports = router;
