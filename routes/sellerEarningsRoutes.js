const express = require("express");
const router = express.Router();
const sellerEarningsController = require("../controllers/sellerEarningsController");
const { verifyToken } = require("../middleware/authMiddleware");

// Protect all routes and authorize only sellers
router.use(verifyToken);
// router.use(authorize("Seller"));

// Get earnings statistics
router.get("/stats", sellerEarningsController.getEarningsStats);

// Get transaction history
router.get("/transactions", sellerEarningsController.getTransactionHistory);

module.exports = router;
