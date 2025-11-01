/**
 * Payment Retry Controller - Like Flipkart
 * Allows users to retry payment for pending orders
 */

const Order = require("../models/order");
const paymentService = require("../services/paymentService");

/**
 * Get pending payment orders (for buyer dashboard)
 */
exports.getPendingPaymentOrders = async (req, res) => {
  try {
    const { _id: buyerId } = req.user;

    // Find orders with payment pending, created in last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const pendingOrders = await Order.find({
      buyer: buyerId,
      status: "Payment Pending",
      paymentStatus: "Pending",
      createdAt: { $gte: thirtyMinutesAgo },
    })
      .populate("products.product", "title featuredImage price")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Pending payment orders retrieved",
      data: pendingOrders,
    });
  } catch (error) {
    console.error("Error fetching pending orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending orders",
      error: error.message,
    });
  }
};

/**
 * Retry payment for a pending order (Like Flipkart "Retry Payment" button)
 */
exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { _id: buyerId } = req.user;

    // Find the order by either _id or orderId field
    const order = await Order.findOne({
      $or: [{ _id: orderId }, { orderId: orderId }],
      buyer: buyerId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order is eligible for payment retry
    if (order.status !== "Payment Pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot retry payment for order with status: ${order.status}`,
      });
    }

    if (order.paymentStatus !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Order payment already processed",
      });
    }

    // Check if order is not expired (30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (order.createdAt < thirtyMinutesAgo) {
      return res.status(400).json({
        success: false,
        message: "Order has expired. Please create a new order.",
      });
    }

    // Return existing Razorpay order details for retry
    res.status(200).json({
      success: true,
      message: "Payment can be retried",
      data: {
        orderId: order._id,
        paymentOrderId: order.paymentTransactionId,
        amount: order.totalPrice,
        currency: "INR",
      },
    });
  } catch (error) {
    console.error("Error retrying payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retry payment",
      error: error.message,
    });
  }
};

/**
 * Cancel a pending payment order manually
 */
exports.cancelPendingOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { _id: buyerId } = req.user;

    // Find the order by either _id or orderId field
    const order = await Order.findOne({
      $or: [{ _id: orderId }, { orderId: orderId }],
      buyer: buyerId,
      status: "Payment Pending",
      paymentStatus: "Pending",
    }).populate("products.product");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Pending order not found",
      });
    }

    // Use OrderService to cancel the order properly
    // Pass the MongoDB _id, not the orderId field
    const OrderService = require("../services/orderService");
    await OrderService.cancelOrder(
      order._id,
      "Cancelled by user - payment not completed",
      buyerId
    );

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling pending order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

/**
 * Check if payment can be retried
 */
exports.checkPaymentRetryEligibility = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { _id: buyerId } = req.user;

    // Find the order by either _id or orderId field
    const order = await Order.findOne({
      $or: [{ _id: orderId }, { orderId: orderId }],
      buyer: buyerId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isExpired = order.createdAt < thirtyMinutesAgo;
    const canRetry =
      order.status === "Payment Pending" &&
      order.paymentStatus === "Pending" &&
      !isExpired;

    const timeLeft = isExpired
      ? 0
      : Math.max(0, 30 - Math.floor((Date.now() - order.createdAt) / 60000));

    res.status(200).json({
      success: true,
      data: {
        canRetry,
        isExpired,
        status: order.status,
        paymentStatus: order.paymentStatus,
        timeLeftMinutes: timeLeft,
        message: canRetry
          ? `You have ${timeLeft} minutes to complete payment`
          : isExpired
          ? "Order has expired"
          : "Order payment already processed",
      },
    });
  } catch (error) {
    console.error("Error checking retry eligibility:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check eligibility",
      error: error.message,
    });
  }
};

module.exports = exports;
