const Razorpay = require("razorpay");
const Order = require("../models/order");
const OrderService = require("./orderService");

/**
 * Refund Service - Handle Razorpay refunds
 */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

class RefundService {
  /**
   * Initiate full refund
   */
  static async initiateFullRefund(orderId, reason) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      if (
        order.paymentStatus !== "Paid" &&
        order.paymentStatus !== "Refund Processing"
      ) {
        throw new Error("Order payment status does not allow refund");
      }

      if (!order.razorpayPaymentId) {
        throw new Error("Payment ID not found for this order");
      }

      // Create refund on Razorpay
      const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: order.totalPrice * 100, // Amount in paise
        speed: "normal", // normal or optimum
        notes: {
          orderId: order._id.toString(),
          reason: reason,
        },
      });

      // Update order with refund details
      order.paymentStatus = "Refund Processing";
      order.refundDetails = {
        refundId: refund.id,
        refundAmount: order.totalPrice,
        refundReason: reason,
        refundStatus: refund.status,
        refundInitiatedAt: new Date(),
      };

      await order.save();

      console.log(`Refund initiated for order ${orderId}: ${refund.id}`);
      return refund;
    } catch (error) {
      console.error("Error initiating refund:", error);
      throw new Error(`Failed to initiate refund: ${error.message}`);
    }
  }

  /**
   * Initiate partial refund
   */
  static async initiatePartialRefund(orderId, amount, reason) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      if (
        order.paymentStatus !== "Paid" &&
        order.paymentStatus !== "Refund Processing"
      ) {
        throw new Error("Order payment status does not allow refund");
      }

      if (!order.razorpayPaymentId) {
        throw new Error("Payment ID not found for this order");
      }

      if (amount > order.totalPrice) {
        throw new Error("Refund amount cannot exceed order total");
      }

      // Create partial refund on Razorpay
      const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: amount * 100, // Amount in paise
        speed: "normal",
        notes: {
          orderId: order._id.toString(),
          reason: reason,
          type: "partial",
        },
      });

      // Update order with refund details
      order.paymentStatus = "Partially Refunded";
      order.refundDetails = {
        refundId: refund.id,
        refundAmount: amount,
        refundReason: reason,
        refundStatus: refund.status,
        refundInitiatedAt: new Date(),
      };

      await order.save();

      console.log(
        `Partial refund initiated for order ${orderId}: ${refund.id}`
      );
      return refund;
    } catch (error) {
      console.error("Error initiating partial refund:", error);
      throw new Error(`Failed to initiate partial refund: ${error.message}`);
    }
  }

  /**
   * Check refund status from Razorpay
   */
  static async checkRefundStatus(refundId) {
    try {
      const refund = await razorpay.refunds.fetch(refundId);
      return refund;
    } catch (error) {
      console.error("Error checking refund status:", error);
      throw new Error(`Failed to check refund status: ${error.message}`);
    }
  }

  /**
   * Process refund webhook from Razorpay
   */
  static async handleRefundWebhook(eventData) {
    try {
      const refundEntity = eventData.payload.refund.entity;
      const paymentId = refundEntity.payment_id;
      const refundId = refundEntity.id;
      const status = refundEntity.status;

      // Find order by payment ID
      const order = await Order.findOne({ razorpayPaymentId: paymentId });
      if (!order) {
        console.error(`Order not found for payment ID: ${paymentId}`);
        return;
      }

      // Update refund status based on webhook
      if (status === "processed") {
        // Refund successful
        await OrderService.markAsRefunded(
          order._id,
          {
            refundId: refundId,
            refundAmount: refundEntity.amount / 100,
          },
          null
        );
      } else if (status === "failed") {
        // Refund failed
        order.refundDetails.refundStatus = "Failed";
        order.paymentStatus = "Paid"; // Revert to paid status
        await order.save();

        console.error(`Refund failed for order ${order._id}`);
      }

      console.log(`Refund webhook processed for order ${order._id}: ${status}`);
    } catch (error) {
      console.error("Error handling refund webhook:", error);
      throw error;
    }
  }

  /**
   * Get all refunds for a payment
   */
  static async getRefundsForPayment(paymentId) {
    try {
      const refunds = await razorpay.payments.fetchMultipleRefund(paymentId);
      return refunds;
    } catch (error) {
      console.error("Error fetching refunds:", error);
      throw new Error(`Failed to fetch refunds: ${error.message}`);
    }
  }

  /**
   * Cancel initiated order and refund (if payment was made)
   */
  static async cancelAndRefund(orderId, reason, userId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      // If payment was made, initiate refund
      if (order.paymentStatus === "Paid") {
        await this.initiateFullRefund(orderId, reason);
      }

      // Cancel the order
      await OrderService.cancelOrder(orderId, reason, userId);

      return {
        success: true,
        message: "Order cancelled and refund initiated",
      };
    } catch (error) {
      console.error("Error in cancelAndRefund:", error);
      throw error;
    }
  }

  /**
   * Process return and initiate refund
   */
  static async returnAndRefund(orderId, userId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      // Mark as returned first
      await OrderService.markAsReturned(orderId, userId);

      // Initiate refund
      const refund = await this.initiateFullRefund(
        orderId,
        order.returnReason || "Product returned by customer"
      );

      return {
        success: true,
        message: "Return processed and refund initiated",
        refund,
      };
    } catch (error) {
      console.error("Error in returnAndRefund:", error);
      throw error;
    }
  }

  /**
   * Instant refund (for eligible orders)
   */
  static async instantRefund(orderId, reason, userId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      if (!order.razorpayPaymentId) {
        throw new Error("Payment ID not found");
      }

      // Create instant refund
      const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: order.totalPrice * 100,
        speed: "optimum", // Instant refund
        notes: {
          orderId: order._id.toString(),
          reason: reason,
        },
      });

      // Update order
      order.paymentStatus = "Refund Processing";
      order.refundDetails = {
        refundId: refund.id,
        refundAmount: order.totalPrice,
        refundReason: reason,
        refundStatus: refund.status,
        refundInitiatedAt: new Date(),
      };

      await order.save();

      console.log(
        `Instant refund initiated for order ${orderId}: ${refund.id}`
      );
      return refund;
    } catch (error) {
      console.error("Error initiating instant refund:", error);
      // Fall back to normal refund if instant fails
      return await this.initiateFullRefund(orderId, reason);
    }
  }
}

module.exports = RefundService;
