const express = require("express");
const router = express.Router();
const adminTransactionController = require("../controllers/adminTransactionController");
const authMiddleware = require("../middleware/authMiddleware");
const adminSettingsController = require("../controllers/adminSettingsController");

// Admin transaction routes
router.get(
  "/transactions",
  authMiddleware.verifyToken,
  adminTransactionController.getAllTransactions
);

router.get(
  "/transactions/:id",
  authMiddleware.verifyToken,
  adminTransactionController.getTransactionById
);

router.get(
  "/transactions/seller/:sellerId",
  authMiddleware.verifyToken,
  adminTransactionController.getSellerTransactions
);

router.get(
  "/transactions/stats",
  authMiddleware.verifyToken,
  adminTransactionController.getTransactionStats
);

// Platform Settings Routes
router.get(
  "/settings/platform",
  authMiddleware.verifyToken,
  adminSettingsController.getPlatformSettings
);

router.post(
  "/settings/platform",
  authMiddleware.verifyToken,
  adminSettingsController.updatePlatformSettings
);

// Admin Management Routes
router.get(
  "/admins",
  authMiddleware.verifyToken,
  adminSettingsController.getAdmin
);

router.post(
  "/create-admin",
  authMiddleware.verifyToken,
  adminSettingsController.createAdmin
);

module.exports = router;
