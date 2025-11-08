const express = require("express");
const router = express.Router();
const payoutController = require("../controllers/payoutController");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * GET /api/payouts/pending
 * Get all pending payouts (Admin only)
 */
router.get(
  "/pending",
  authMiddleware.verifyAdminToken,
  payoutController.getPendingPayouts
);

/**
 * GET /api/payouts/export
 * Export pending payouts as CSV (Admin only)
 */
router.get(
  "/export",
  authMiddleware.verifyAdminToken,
  payoutController.exportPayoutsCSV
);

/**
 * POST /api/payouts/mark-completed
 * Mark payouts as completed after manual transfer (Admin only)
 */
router.post(
  "/mark-completed",
  authMiddleware.verifyAdminToken,
  payoutController.markPayoutsCompleted
);

/**
 * GET /api/payouts/history
 * Get payout history (Admin only)
 */
router.get(
  "/history",
  authMiddleware.verifyAdminToken,
  payoutController.getPayoutHistory
);

module.exports = router;

