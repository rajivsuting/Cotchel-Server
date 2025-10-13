/**
 * Order Management Controller - Production-ready like Flipkart
 * Handles all order status transitions, cancellations, returns, and refunds
 */

const Order = require("../models/order");
const OrderService = require("../services/orderService");
const RefundService = require("../services/refundService");
const { ValidationError } = require("../utils/errors");

/**
 * Mark order as Processing (Seller action)
 */
exports.markAsProcessing = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await OrderService.markAsProcessing(orderId, req.user._id);

    res.status(200).json({
      success: true,
      message: "Order marked as processing",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Mark order as Packed (Seller action)
 */
exports.markAsPacked = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await OrderService.markAsPacked(orderId, req.user._id);

    res.status(200).json({
      success: true,
      message: "Order marked as packed",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Mark order as Shipped (Seller/Admin action)
 */
exports.markAsShipped = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { awbCode, courierName, trackingUrl, estimatedDeliveryDate } =
      req.body;

    if (!awbCode || !courierName) {
      throw new ValidationError("AWB code and courier name are required");
    }

    const shippingDetails = {
      awbCode,
      courierName,
      trackingUrl,
      estimatedDeliveryDate: estimatedDeliveryDate
        ? new Date(estimatedDeliveryDate)
        : null,
    };

    const order = await OrderService.markAsShipped(
      orderId,
      shippingDetails,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Order marked as shipped",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Mark order as In Transit (Auto/Admin action)
 */
exports.markAsInTransit = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await OrderService.markAsInTransit(orderId, req.user._id);

    res.status(200).json({
      success: true,
      message: "Order marked as in transit",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Mark order as Out for Delivery (Courier/Admin action)
 */
exports.markAsOutForDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await OrderService.markAsOutForDelivery(
      orderId,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Order is out for delivery",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Mark order as Delivered (Courier/Admin action)
 */
exports.markAsDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveredAt, note } = req.body;

    const deliveryDetails = {
      deliveredAt: deliveredAt ? new Date(deliveredAt) : new Date(),
      note: note || "Order delivered successfully",
    };

    const order = await OrderService.markAsDelivered(
      orderId,
      deliveryDetails,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Order marked as delivered",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Mark delivery as failed (Courier/Admin action)
 */
exports.markDeliveryFailed = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, note } = req.body;

    if (!reason) {
      throw new ValidationError("Failure reason is required");
    }

    const failureDetails = { reason, note };
    const order = await OrderService.markDeliveryFailed(
      orderId,
      failureDetails,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Delivery marked as failed",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Request order cancellation (Buyer action)
 */
exports.requestCancellation = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new ValidationError("Cancellation reason is required");
    }

    const order = await OrderService.requestCancellation(
      orderId,
      { reason },
      req.user._id
    );

    res.status(200).json({
      success: true,
      message:
        order.status === "Cancelled"
          ? "Order cancelled successfully"
          : "Cancellation request submitted",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Approve cancellation and process refund (Seller/Admin action)
 */
exports.approveCancellation = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "Cancellation Requested") {
      return res.status(400).json({
        success: false,
        message: "Order cancellation not requested",
      });
    }

    // Cancel and initiate refund if needed
    await RefundService.cancelAndRefund(
      orderId,
      order.cancellationReason,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Cancellation approved and refund initiated",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Request return (Buyer action after delivery)
 */
exports.requestReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, images } = req.body;

    if (!reason) {
      throw new ValidationError("Return reason is required");
    }

    const returnDetails = { reason, images: images || [] };
    const order = await OrderService.requestReturn(
      orderId,
      returnDetails,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Return request submitted successfully",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Approve return (Seller/Admin action)
 */
exports.approveReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await OrderService.approveReturn(orderId, req.user._id);

    res.status(200).json({
      success: true,
      message: "Return approved, pickup will be scheduled",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Reject return (Seller/Admin action)
 */
exports.rejectReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new ValidationError("Rejection reason is required");
    }

    const order = await OrderService.rejectReturn(
      orderId,
      reason,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Return rejected",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Mark item as returned and initiate refund (Seller/Admin action)
 */
exports.markAsReturnedAndRefund = async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await RefundService.returnAndRefund(orderId, req.user._id);

    res.status(200).json({
      success: true,
      message: "Item marked as returned and refund initiated",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get order status history
 */
exports.getOrderHistory = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("statusHistory.updatedBy", "fullName email")
      .select("statusHistory status paymentStatus");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        currentStatus: order.status,
        paymentStatus: order.paymentStatus,
        history: order.statusHistory,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Check if order can be cancelled (Buyer action)
 */
exports.checkCancellable = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isCancellable = order.isCancellable;
    const reason = isCancellable
      ? "Order can be cancelled"
      : `Cannot cancel order with status: ${order.status}`;

    res.status(200).json({
      success: true,
      data: {
        canCancel: isCancellable,
        currentStatus: order.status,
        reason,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Check if order can be returned (Buyer action)
 */
exports.checkReturnable = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isReturnable = order.isReturnable;
    let reason = "";

    if (!isReturnable) {
      if (order.status !== "Delivered") {
        reason = "Order must be delivered before return";
      } else if (!order.canReturn) {
        reason = "This order cannot be returned";
      } else if (
        order.returnWindowExpiry &&
        new Date() > order.returnWindowExpiry
      ) {
        reason = "Return window has expired";
      }
    } else {
      reason = "Order can be returned";
    }

    res.status(200).json({
      success: true,
      data: {
        canReturn: isReturnable,
        currentStatus: order.status,
        returnWindowExpiry: order.returnWindowExpiry,
        reason,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get refund status
 */
exports.getRefundStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).select(
      "refundDetails paymentStatus"
    );
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check refund status from Razorpay if refund ID exists
    let razorpayRefundStatus = null;
    if (order.refundDetails?.refundId) {
      try {
        razorpayRefundStatus = await RefundService.checkRefundStatus(
          order.refundDetails.refundId
        );
      } catch (error) {
        console.error("Error fetching refund status from Razorpay:", error);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        paymentStatus: order.paymentStatus,
        refundDetails: order.refundDetails,
        razorpayStatus: razorpayRefundStatus,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Buyer gets their orders with filters
 */
exports.getBuyerOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const buyerId = req.user._id;

    const filter = { buyer: buyerId };
    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate("products.product", "title featuredImage")
      .populate("seller", "fullName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Seller gets their orders with filters
 */
exports.getSellerOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const sellerId = req.user._id;

    const filter = { seller: sellerId };
    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate("products.product", "title featuredImage")
      .populate("buyer", "fullName email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Admin gets all orders with filters
 */
exports.getAdminOrders = async (req, res) => {
  try {
    const { status, paymentStatus, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const orders = await Order.find(filter)
      .populate("products.product", "title featuredImage")
      .populate("buyer", "fullName email")
      .populate("seller", "fullName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = exports;
