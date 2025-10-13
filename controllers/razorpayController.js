const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");

const apiResponse = require("../utils/apiResponse");
const razorpayService = require("../services/razorpayService");
const Order = require("../models/order");

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Helper function to restore stock when payment fails
async function restoreStock(items, session) {
  for (const item of items) {
    const product = await require("../models/product")
      .findById(item.product)
      .session(session);
    if (!product) {
      console.error(`Product not found for stock restoration:`, item.product);
      continue;
    }

    // Calculate quantity to restore based on the order structure
    // For cart orders: quantity is the number of lots, lotSize is stored in the order
    // For buy now orders: quantity is the total quantity, no lotSize in order
    let quantityToRestore;

    if (item.lotSize) {
      // Cart order: quantity * lotSize
      quantityToRestore = item.quantity * item.lotSize;
    } else {
      // Buy now order: quantity is already the total
      quantityToRestore = item.quantity;
    }

    product.quantityAvailable += quantityToRestore;
    await product.save({ session });

    console.log(
      `Stock restored for ${product.title}: +${quantityToRestore} units (new total: ${product.quantityAvailable})`
    );
  }
}

// Helper function to handle failed payments and restore stock
async function handlePaymentFailure(orderId, reason = "Payment failed") {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error("Order not found");
    }

    // Restore stock
    await restoreStock(order.products, session);

    // Update order status
    order.status = "Cancelled";
    order.paymentStatus = "Failed";
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    order.statusHistory.push({
      status: "Cancelled",
      note: reason,
      timestamp: new Date(),
    });

    await order.save({ session });

    // Clear cart if it exists
    if (order.cartId) {
      await require("../models/cartModel")
        .findByIdAndDelete(order.cartId)
        .session(session);
    }

    await session.commitTransaction();
    console.log(
      `Payment failure handled for order ${orderId}: Stock restored and order cancelled`
    );

    return order;
  } catch (error) {
    await session.abortTransaction();
    console.error(
      `Error handling payment failure for order ${orderId}:`,
      error
    );
    throw error;
  } finally {
    session.endSession();
  }
}

const razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const signature = req.headers["x-razorpay-signature"];
  const payload = JSON.stringify(req.body);

  const hmac = crypto.createHmac("sha256", secret);
  const generatedSignature = hmac.update(payload).digest("hex");

  if (generatedSignature !== signature) {
    return apiResponse.errorResponse(res, "Invalid signature", 400);
  }

  const event = req.body.event;
  const data = req.body.payload.payment.entity;

  try {
    if (event === "payment.captured") {
      const order = await Order.findOne({ razorpayOrderId: data.order_id });

      if (!order) {
        return apiResponse.errorResponse(res, "Order not found", 404);
      }

      order.paymentStatus = "Paid";
      order.razorpayPaymentId = data.id;
      order.paymentTransactionId = data.order_id;
      order.status = "Confirmed";
      order.confirmedAt = new Date();
      order.canCancel = true;
      order.statusHistory.push({
        status: "Confirmed",
        note: "Payment captured successfully",
        timestamp: new Date(),
      });
      await order.save();

      await razorpayService.processPayout(order._id);

      return apiResponse.successResponse(res, "Payment captured successfully");
    }

    if (event === "payment.failed") {
      const order = await Order.findOne({ razorpayOrderId: data.order_id });

      if (!order) {
        return apiResponse.errorResponse(res, "Order not found", 404);
      }

      // Handle payment failure and restore stock
      await handlePaymentFailure(
        order._id,
        "Payment failed via Razorpay webhook"
      );
      return apiResponse.successResponse(
        res,
        "Payment failed, stock restored and order cancelled"
      );
    }

    return apiResponse.successResponse(
      res,
      "Webhook event handled successfully"
    );
  } catch (error) {
    return apiResponse.errorResponse(res, error.message);
  }
};

module.exports = {
  razorpayWebhook,
};
