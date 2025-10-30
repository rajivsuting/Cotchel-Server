const express = require("express");
const router = express.Router();
const adminTransactionController = require("../controllers/adminTransactionController");
const authMiddleware = require("../middleware/authMiddleware");
const adminSettingsController = require("../controllers/adminSettingsController");

// Admin transaction routes
router.get(
  "/transactions",
  authMiddleware.verifyAdminToken,
  adminTransactionController.getAllTransactions
);

router.get(
  "/transactions/:id",
  authMiddleware.verifyAdminToken,
  adminTransactionController.getTransactionById
);

router.get(
  "/transactions/seller/:sellerId",
  authMiddleware.verifyAdminToken,
  adminTransactionController.getSellerTransactions
);

router.get(
  "/transactions/stats",
  authMiddleware.verifyAdminToken,
  adminTransactionController.getTransactionStats
);

// Platform Settings Routes
router.get(
  "/settings/platform",
  authMiddleware.verifyAdminToken,
  adminSettingsController.getPlatformSettings
);

router.post(
  "/settings/platform",
  authMiddleware.verifyAdminToken,
  adminSettingsController.updatePlatformSettings
);

// Admin Management Routes
router.get(
  "/admins",
  authMiddleware.verifyAdminToken,
  adminSettingsController.getAdmin
);

router.post(
  "/create-admin",
  authMiddleware.verifyAdminToken,
  adminSettingsController.createAdmin
);

// Password change route
router.put(
  "/change-password",
  authMiddleware.verifyAdminToken,
  require("../controllers/authController").changePassword
);

// Profile Routes
router.get(
  "/profile",
  authMiddleware.verifyAdminToken,
  adminSettingsController.getProfile
);

router.put(
  "/profile",
  authMiddleware.verifyAdminToken,
  adminSettingsController.updateProfile
);

// Delete admin route
router.delete(
  "/:id",
  authMiddleware.verifyAdminToken,
  adminSettingsController.deleteAdmin
);

module.exports = router;
