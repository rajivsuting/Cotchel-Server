const Notification = require("../models/notification");
const { emitNotification } = require("../sockets/notificationSocket");

class NotificationService {
  // Create a new notification
  static async createNotification(data) {
    try {
      console.log("Creating notification:", data);
      const notification = new Notification(data);
      await notification.save();
      console.log("Notification created:", notification);

      // Emit the notification to the specific seller
      if (global.io) {
        console.log(
          "Emitting notification to seller:",
          `seller_${data.sellerId}`
        );
        emitNotification(
          global.io,
          "newNotification",
          notification,
          `seller_${data.sellerId}`
        );
      } else {
        console.error("Socket.io instance not found!");
      }

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw new Error(`Error creating notification: ${error.message}`);
    }
  }

  // New order notification
  static async notifyNewOrder(sellerId, orderId) {
    return this.createNotification({
      type: "new_order",
      sellerId,
      orderId,
      message: "You have received a new order!",
    });
  }

  // Payment received notification
  static async notifyPaymentReceived(sellerId, orderId, amount) {
    return this.createNotification({
      type: "payment_received",
      sellerId,
      orderId,
      amount,
      message: `Payment of ₹${amount} has been received for your order.`,
    });
  }

  // Product out of stock notification
  static async notifyProductOutOfStock(sellerId, productId) {
    return this.createNotification({
      type: "product_out_of_stock",
      sellerId,
      productId,
      message: "One of your products is out of stock!",
    });
  }

  // Low inventory warning
  static async notifyLowInventory(sellerId, productId, currentCount) {
    return this.createNotification({
      type: "low_inventory",
      sellerId,
      productId,
      inventoryCount: currentCount,
      message: `Low inventory alert! Only ${currentCount} items remaining.`,
    });
  }

  // Account verification status
  static async notifyVerificationStatus(sellerId, status) {
    const statusMessages = {
      pending: "Your account verification is pending review.",
      approved: "Your account has been verified successfully!",
      rejected:
        "Your account verification has been rejected. Please check the reason and resubmit.",
    };

    return this.createNotification({
      type: "account_verification",
      sellerId,
      verificationStatus: status,
      message: statusMessages[status],
    });
  }

  // Get all notifications for a seller
  static async getSellerNotifications(sellerId, page = 1, limit = 10) {
    try {
      console.log("Fetching notifications for seller:", sellerId);
      const skip = (page - 1) * limit;
      const notifications = await Notification.find({ sellerId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);
      console.log(`Found ${notifications.length} notifications`);

      const total = await Notification.countDocuments({ sellerId });

      return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error("Error fetching notifications:", error);
      throw new Error(`Error fetching notifications: ${error.message}`);
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId) {
    try {
      console.log("Marking notification as read:", notificationId);

      // First check if notification exists
      const existingNotification = await Notification.findById(notificationId);
      console.log("Existing notification:", existingNotification);

      if (!existingNotification) {
        console.log("Notification not found in database");
        return null;
      }

      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { read: true },
        { new: true }
      );
      console.log("Notification marked as read:", notification);
      return notification;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw new Error(`Error marking notification as read: ${error.message}`);
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(sellerId) {
    try {
      console.log("Marking all notifications as read for seller:", sellerId);
      const result = await Notification.updateMany(
        { sellerId, read: false },
        { read: true }
      );
      console.log("Marked all notifications as read:", result);
      return result;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  // Check stock status and notify if needed
  static async checkStockStatus(product) {
    try {
      console.log(`Starting stock status check for ${product.title}:`, {
        currentQuantity: product.quantityAvailable,
        threshold: 50,
        sellerId: product.user?._id || product.user,
      });

      if (!product.user) {
        console.error(`Product ${product._id} has no user field`);
        return;
      }

      // Check for out of stock first
      if (product.quantityAvailable === 0) {
        console.log(`${product.title} is out of stock`);
        await this.checkAndNotifyOutOfStock(product);
      }
      // Then check for low stock
      else if (product.quantityAvailable <= 50) {
        console.log(
          `${product.title} is low on stock (${product.quantityAvailable} remaining)`
        );
        await this.checkAndNotifyLowStock(product);
      } else {
        console.log(
          `${product.title} has sufficient stock (${product.quantityAvailable} remaining)`
        );
      }

      console.log(`Completed stock status check for ${product.title}`);
    } catch (error) {
      console.error("Error checking stock status:", error);
      throw error; // Re-throw to handle in the calling function
    }
  }

  // Check and notify for low stock
  static async checkAndNotifyLowStock(product) {
    const LOW_STOCK_THRESHOLD = 50;
    console.log(`Checking low stock for ${product.title}:`, {
      currentQuantity: product.quantityAvailable,
      threshold: LOW_STOCK_THRESHOLD,
      sellerId: product.user?._id || product.user,
    });

    if (
      product.quantityAvailable <= LOW_STOCK_THRESHOLD &&
      product.quantityAvailable > 0
    ) {
      console.log(`Low stock detected for ${product.title}`);
      const notification = await this.createNotification({
        type: "low_inventory",
        sellerId: product.user?._id || product.user,
        productId: product._id,
        inventoryCount: product.quantityAvailable,
        message: `Low inventory alert! Only ${product.quantityAvailable} items remaining for ${product.title}.`,
      });
      console.log(
        `Low stock notification created for ${product.title}:`,
        notification
      );
      return notification;
    }
    return null;
  }

  // Check and notify for out of stock
  static async checkAndNotifyOutOfStock(product) {
    console.log(`Checking out of stock for ${product.title}:`, {
      currentQuantity: product.quantityAvailable,
      sellerId: product.user?._id || product.user,
    });

    if (product.quantityAvailable === 0) {
      console.log(`Out of stock detected for ${product.title}`);
      const notification = await this.createNotification({
        type: "product_out_of_stock",
        sellerId: product.user?._id || product.user,
        productId: product._id,
        message: `${product.title} is now out of stock!`,
      });
      console.log(
        `Out of stock notification created for ${product.title}:`,
        notification
      );
      return notification;
    }
    return null;
  }
}

module.exports = NotificationService;
