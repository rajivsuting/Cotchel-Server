const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getCategories,
} = require("../controllers/dashboardController");

// Get dashboard statistics
router.get("/stats", getDashboardStats);

// Get categories with filtering, sorting, and pagination
router.get("/categories", getCategories);

module.exports = router;
