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
      console.log("Marking notification as read:", notificationId);
      console.log("User:", req.user._id);

      const notification = await NotificationService.markAsRead(notificationId);

      console.log("Notification marked as read result:", notification);

      if (!notification) {
        console.log("Notification not found");
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      console.log("Successfully marked notification as read");
      res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (error) {
      console.error("Error in markAsRead:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(req, res) {
    try {
      const sellerId = req.user._id; // Use _id consistently with other methods
      console.log("Marking all notifications as read for seller:", sellerId);

      const result = await NotificationService.markAllAsRead(sellerId);

      console.log("Mark all as read result:", result);

      res.status(200).json({
        success: true,
        message: "All notifications marked as read",
        data: result,
      });
    } catch (error) {
      console.error("Error in markAllAsRead:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = NotificationController;