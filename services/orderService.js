const Order = require("../models/order");
const Product = require("../models/product");
const mongoose = require("mongoose");
const NotificationService = require("./notificationService");

/**
 * Order Service - Production-ready order management like Flipkart
 * Handles all order status transitions with proper validations
 */

class OrderService {
  /**
   * Transition order to Confirmed status after payment
   */
  static async confirmOrder(orderId, paymentDetails, userId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      if (order.status !== "Payment Pending") {
        throw new Error(`Cannot confirm order with status: ${order.status}`);
      }

      // Update order
      order.status = "Confirmed";
      order.paymentStatus = "Paid";
      order.razorpayPaymentId = paymentDetails.paymentId;
      order.razorpayOrderId = paymentDetails.orderId;
      order.razorpaySignature = paymentDetails.signature;
      order.confirmedAt = new Date();
      order.canCancel = true;
      order.canReturn = false;

      // Add to status history
      order.statusHistory.push({
        status: "Confirmed",
        timestamp: new Date(),
        note: "Payment successful, order confirmed",
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      // Send notification
      await NotificationService.sendOrderConfirmation(order);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Move order to Processing (seller is preparing)
   */
  static async markAsProcessing(orderId, userId) {
    return await this.updateOrderStatus(
      orderId,
      "Processing",
      "Order is being prepared",
      userId,
      {
        processingAt: new Date(),
        canCancel: true,
      }
    );
  }

  /**
   * Mark order as Packed (ready for pickup)
   */
  static async markAsPacked(orderId, userId) {
    return await this.updateOrderStatus(
      orderId,
      "Packed",
      "Order packed and ready for pickup",
      userId,
      {
        packedAt: new Date(),
        canCancel: true,
      }
    );
  }

  /**
   * Mark order as Shipped
   */
  static async markAsShipped(orderId, shippingDetails, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      const validStatuses = ["Confirmed", "Processing", "Packed"];
      if (!validStatuses.includes(order.status)) {
        throw new Error(`Cannot ship order with status: ${order.status}`);
      }

      // Update shipping details
      order.status = "Shipped";
      order.shippedAt = new Date();
      order.awbCode = shippingDetails.awbCode;
      order.courierName = shippingDetails.courierName;
      order.trackingUrl = shippingDetails.trackingUrl;
      order.estimatedDeliveryDate = shippingDetails.estimatedDeliveryDate;
      order.canCancel = false; // Cannot cancel once shipped
      order.canReturn = false;

      order.statusHistory.push({
        status: "Shipped",
        timestamp: new Date(),
        note: `Shipped via ${shippingDetails.courierName}`,
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      // Send notification
      await NotificationService.sendShipmentUpdate(order);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Mark order as In Transit
   */
  static async markAsInTransit(orderId, userId) {
    return await this.updateOrderStatus(
      orderId,
      "In Transit",
      "Order is on the way",
      userId,
      {
        inTransitAt: new Date(),
        canCancel: false,
        canReturn: false,
      }
    );
  }

  /**
   * Mark order as Out for Delivery
   */
  static async markAsOutForDelivery(orderId, userId) {
    return await this.updateOrderStatus(
      orderId,
      "Out for Delivery",
      "Order is out for delivery",
      userId,
      {
        outForDeliveryAt: new Date(),
        canCancel: false,
        canReturn: false,
      }
    );
  }

  /**
   * Mark order as Delivered
   */
  static async markAsDelivered(orderId, deliveryDetails, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      const validStatuses = ["Shipped", "In Transit", "Out for Delivery"];
      if (!validStatuses.includes(order.status)) {
        throw new Error(
          `Cannot mark as delivered with status: ${order.status}`
        );
      }

      // Update order
      order.status = "Delivered";
      order.deliveredAt = new Date();
      order.actualDeliveryDate = deliveryDetails.deliveredAt || new Date();
      order.canCancel = false;
      order.canReturn = true; // Enable returns

      // Set return window expiry (7 days from delivery)
      const returnWindow = new Date();
      returnWindow.setDate(returnWindow.getDate() + 7);
      order.returnWindowExpiry = returnWindow;

      order.statusHistory.push({
        status: "Delivered",
        timestamp: new Date(),
        note: deliveryDetails.note || "Order delivered successfully",
        updatedBy: userId,
      });

      // Add successful delivery attempt
      order.deliveryAttempts.push({
        attemptNumber: (order.deliveryAttempts?.length || 0) + 1,
        attemptDate: new Date(),
        status: "Successful",
        note: deliveryDetails.note,
      });

      await order.save({ session });
      await session.commitTransaction();

      // Send notification
      await NotificationService.sendDeliveryConfirmation(order);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Mark delivery as failed
   */
  static async markDeliveryFailed(orderId, failureDetails, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      order.status = "Delivery Failed";

      order.deliveryAttempts.push({
        attemptNumber: (order.deliveryAttempts?.length || 0) + 1,
        attemptDate: new Date(),
        status: "Failed",
        reason: failureDetails.reason,
        note: failureDetails.note,
      });

      order.statusHistory.push({
        status: "Delivery Failed",
        timestamp: new Date(),
        note: failureDetails.reason,
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      // Notify buyer about failed delivery
      await NotificationService.sendDeliveryFailedNotification(order);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Mark order as completed (after return window expires)
   */
  static async markAsCompleted(orderId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      if (order.status !== "Delivered") {
        throw new Error("Only delivered orders can be marked as completed");
      }

      order.status = "Completed";
      order.completedAt = new Date();
      order.canReturn = false;
      order.canCancel = false;

      order.statusHistory.push({
        status: "Completed",
        timestamp: new Date(),
        note: "Order completed successfully",
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Request order cancellation (by buyer)
   */
  static async requestCancellation(orderId, cancellationDetails, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      // Check if order can be cancelled
      if (!order.canCancel) {
        throw new Error("This order cannot be cancelled");
      }

      const cancellableStatuses = [
        "Payment Pending",
        "Confirmed",
        "Processing",
        "Packed",
      ];

      if (!cancellableStatuses.includes(order.status)) {
        throw new Error(`Cannot cancel order with status: ${order.status}`);
      }

      // If order is just confirmed/processing, allow immediate cancellation
      if (["Confirmed", "Processing"].includes(order.status)) {
        return await this.cancelOrder(
          orderId,
          cancellationDetails.reason,
          userId
        );
      }

      // For packed orders, request approval
      order.status = "Cancellation Requested";
      order.cancellationReason = cancellationDetails.reason;
      order.cancelledBy = userId;

      order.statusHistory.push({
        status: "Cancellation Requested",
        timestamp: new Date(),
        note: cancellationDetails.reason,
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      // Notify seller about cancellation request
      await NotificationService.sendCancellationRequest(order);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel order (final cancellation with stock restoration)
   */
  static async cancelOrder(orderId, reason, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId)
        .populate("products.product")
        .session(session);

      if (!order) {
        throw new Error("Order not found");
      }

      // Restore stock for all products
      for (const item of order.products) {
        const totalQuantity = item.quantity * item.lotSize;
        await Product.findByIdAndUpdate(
          item.product._id,
          { $inc: { quantityAvailable: totalQuantity } },
          { session }
        );
      }

      // Update order status
      order.status = "Cancelled";
      order.cancelledAt = new Date();
      order.cancelledBy = userId;
      order.cancellationReason = reason;
      order.canCancel = false;
      order.canReturn = false;

      // Handle refund if payment was made
      if (order.paymentStatus === "Paid") {
        order.paymentStatus = "Refund Processing";
        order.refundDetails = {
          refundReason: reason,
          refundAmount: order.totalPrice,
          refundInitiatedAt: new Date(),
        };
      } else {
        order.paymentStatus = "Failed";
      }

      order.statusHistory.push({
        status: "Cancelled",
        timestamp: new Date(),
        note: reason,
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      // Clear cart if exists
      if (order.cartId) {
        await require("../models/cartModel").findByIdAndDelete(order.cartId);
      }

      // Send notification
      await NotificationService.sendCancellationConfirmation(order);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Request return (by buyer after delivery)
   */
  static async requestReturn(orderId, returnDetails, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      if (order.status !== "Delivered") {
        throw new Error("Only delivered orders can be returned");
      }

      if (!order.canReturn) {
        throw new Error("Return window has expired for this order");
      }

      // Check return window
      if (order.returnWindowExpiry && new Date() > order.returnWindowExpiry) {
        throw new Error("Return window has expired");
      }

      order.status = "Return Requested";
      order.returnRequestedAt = new Date();
      order.returnReason = returnDetails.reason;
      order.returnImages = returnDetails.images || [];

      order.statusHistory.push({
        status: "Return Requested",
        timestamp: new Date(),
        note: returnDetails.reason,
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      // Notify seller about return request
      await NotificationService.sendReturnRequest(order);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Approve return (by seller/admin)
   */
  static async approveReturn(orderId, userId) {
    return await this.updateOrderStatus(
      orderId,
      "Return Approved",
      "Return approved, pickup will be scheduled",
      userId,
      {
        returnApprovedAt: new Date(),
      }
    );
  }

  /**
   * Reject return (by seller/admin)
   */
  static async rejectReturn(orderId, reason, userId) {
    return await this.updateOrderStatus(
      orderId,
      "Return Rejected",
      reason,
      userId,
      {
        canReturn: false,
      }
    );
  }

  /**
   * Mark item as returned (received by seller)
   */
  static async markAsReturned(orderId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId)
        .populate("products.product")
        .session(session);

      if (!order) {
        throw new Error("Order not found");
      }

      // Restore stock
      for (const item of order.products) {
        const totalQuantity = item.quantity * item.lotSize;
        await Product.findByIdAndUpdate(
          item.product._id,
          { $inc: { quantityAvailable: totalQuantity } },
          { session }
        );
      }

      order.status = "Returned";
      order.returnReceivedAt = new Date();
      order.paymentStatus = "Refund Processing";

      order.refundDetails = {
        refundReason: order.returnReason,
        refundAmount: order.totalPrice,
        refundInitiatedAt: new Date(),
      };

      order.statusHistory.push({
        status: "Returned",
        timestamp: new Date(),
        note: "Item returned and received by seller",
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      // Notify buyer about return confirmation
      await NotificationService.sendReturnConfirmation(order);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Mark order as refunded
   */
  static async markAsRefunded(orderId, refundDetails, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      order.status = "Refunded";
      order.paymentStatus = "Refunded";

      order.refundDetails = {
        ...order.refundDetails,
        refundId: refundDetails.refundId,
        refundStatus: "Completed",
        refundCompletedAt: new Date(),
      };

      order.statusHistory.push({
        status: "Refunded",
        timestamp: new Date(),
        note: `Refund processed: ₹${order.refundDetails.refundAmount}`,
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      // Send notification
      await NotificationService.sendRefundConfirmation(order);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Helper method to update order status
   */
  static async updateOrderStatus(
    orderId,
    status,
    note,
    userId,
    additionalFields = {}
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error("Order not found");
      }

      order.status = status;
      Object.assign(order, additionalFields);

      order.statusHistory.push({
        status,
        timestamp: new Date(),
        note,
        updatedBy: userId,
      });

      await order.save({ session });
      await session.commitTransaction();

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Auto-complete delivered orders after return window expires
   */
  static async autoCompleteOrders() {
    try {
      const orders = await Order.find({
        status: "Delivered",
        returnWindowExpiry: { $lt: new Date() },
      });

      let completedCount = 0;
      for (const order of orders) {
        try {
          await this.markAsCompleted(order._id, null);
          completedCount++;
        } catch (error) {
          console.error(`Error completing order ${order._id}:`, error);
        }
      }

      console.log(`Auto-completed ${completedCount} orders`);
      return completedCount;
    } catch (error) {
      console.error("Error auto-completing orders:", error);
      throw error;
    }
  }
}

module.exports = OrderService;
