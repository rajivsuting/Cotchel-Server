const NotificationService = require("../services/notificationService");
const Notification = require("../models/notification");

class NotificationController {
  // Get all notifications for a seller
  static async getSellerNotifications(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const sellerId = req.user._id; // Use _id from the access token

      console.log("Getting notifications for seller:", sellerId);

      if (!sellerId) {
        console.error("No seller ID found in request user:", req.user);
        return res.status(400).json({
          success: false,
          message: "Seller ID not found in request",
        });
      }

      const result = await NotificationService.getSellerNotifications(
        sellerId,
        parseInt(page),
        parseInt(limit)
      );

      console.log("Found notifications:", result);

      res.status(200).json({
        success: true,
        data: {
          notifications: result.notifications || [],
          total: result.total || 0,
          page: result.page || 1,
          totalPages: result.totalPages || 1,
        },
      });
    } catch (error) {
      console.error("Error in getSellerNotifications:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Mark notification as read
  static async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const notification = await NotificationService.markAsRead(notificationId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(req, res) {
    try {
      const sellerId = req.user.id; // Updated to use req.user.id instead of req.user._id
      await Notification.updateMany({ sellerId, read: false }, { read: true });

      res.status(200).json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = NotificationController;
