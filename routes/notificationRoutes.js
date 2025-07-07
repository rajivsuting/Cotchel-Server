const express = require("express");
const router = express.Router();
const NotificationController = require("../controllers/notificationController");
const { verifyToken, restrictTo } = require("../middleware/authMiddleware");

// Get all notifications for a seller
router.get(
  "/seller",
  verifyToken,
  restrictTo("Seller"),
  NotificationController.getSellerNotifications
);

// Mark a specific notification as read
router.patch(
  "/:notificationId/read",
  verifyToken,
  restrictTo("Seller"),
  NotificationController.markAsRead
);

// Mark all notifications as read
router.patch(
  "/seller/read-all",
  verifyToken,
  restrictTo("Seller"),
  NotificationController.markAllAsRead
);

module.exports = router;
