const Order = require("../models/order");
const { retryAxiosRequest } = require("../utils/retryUtils");
const crypto = require("crypto");
const axios = require("axios");
const mongoose = require("mongoose");

const SHIPROCKET_API_URL = "https://apiv2.shiprocket.in/v1/external";

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

// Verify Razorpay webhook signature
const verifyRazorpaySignature = (body, signature, secret) => {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");
  return expectedSignature === signature;
};

// Handle Razorpay payment webhook
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { event, payload } = req.body;
    const signature = req.headers["x-razorpay-signature"];

    // Verify webhook signature
    if (
      !verifyRazorpaySignature(
        req.body,
        signature,
        process.env.RAZORPAY_WEBHOOK_SECRET
      )
    ) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const order = await Order.findOne({
      paymentTransactionId: payload.payment.entity.order_id,
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    switch (event) {
      case "payment.captured":
        order.paymentStatus = "Paid";
        order.status = "Confirmed";
        order.confirmedAt = new Date();
        order.canCancel = true;
        order.statusHistory.push({
          status: "Confirmed",
          note: "Payment captured via webhook",
          timestamp: new Date(),
        });
        break;
      case "payment.failed":
        // Handle payment failure and restore stock
        await handlePaymentFailure(order._id, "Payment failed via webhook");
        return res
          .status(200)
          .json({ message: "Payment failure handled, stock restored" });
      case "payment.refunded":
        order.paymentStatus = "Refunded";
        // For refunds, we might want to restore stock as well
        await restoreStock(order.products, null); // No session needed for webhook
        break;
    }

    await order.save();

    // Emit real-time order update
    const { notifyOrderUpdate } = require("../utils/emitOrderUpdate");
    await notifyOrderUpdate(order);

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Payment webhook error:", error);
    res.status(500).json({ message: "Error processing webhook" });
  }
};

// Verify Shiprocket webhook signature
const verifyShiprocketSignature = (payload, signature) => {
  // Skip verification in development if secret not set
  if (!process.env.SHIPROCKET_WEBHOOK_SECRET) {
    console.warn(
      "⚠️ SHIPROCKET_WEBHOOK_SECRET not set, skipping signature verification (DEV ONLY)"
    );
    return process.env.NODE_ENV === "development";
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.SHIPROCKET_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");
    return expectedSignature === signature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
};

// Handle Shiprocket webhook
exports.handleShipmentWebhook = async (req, res) => {
  try {
    console.log(
      "Shiprocket webhook received:",
      JSON.stringify(req.body, null, 2)
    );

    const signature = req.headers["x-shiprocket-signature"];
    if (!verifyShiprocketSignature(req.body, signature)) {
      console.error("Invalid Shiprocket webhook signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const {
      order_id,
      awb,
      current_status,
      shipment_status,
      courier_name,
      etd,
    } = req.body;

    // Find order by shiprocketOrderId or channel_order_id
    const order = await Order.findOne({
      $or: [{ shiprocketOrderId: order_id }, { _id: order_id }],
    });

    if (!order) {
      console.error("Order not found for Shiprocket webhook:", order_id);
      return res.status(404).json({ message: "Order not found" });
    }

    console.log(
      `Processing Shiprocket webhook for order ${order._id}, status: ${current_status}`
    );

    // Map Shiprocket status to your order status
    const statusMap = {
      NEW: "Confirmed",
      "READY TO SHIP": "Packed",
      "PICKUP SCHEDULED": "Packed",
      "PICKED UP": "Shipped",
      "PICKUP EXCEPTION": "Processing",
      "IN TRANSIT": "In Transit",
      "OUT FOR DELIVERY": "Out for Delivery",
      DELIVERED: "Delivered",
      "RTO INITIATED": "RTO Initiated",
      "RTO DELIVERED": "RTO Delivered",
      CANCELLED: "Cancelled",
      LOST: "Delivery Failed",
      DAMAGED: "Delivery Failed",
    };

    const newStatus = statusMap[current_status?.toUpperCase()] || order.status;

    // Only update if status actually changed
    if (newStatus !== order.status) {
      order.status = newStatus;
      order.statusHistory.push({
        status: newStatus,
        note: `Updated via Shiprocket: ${current_status}`,
        timestamp: new Date(),
      });

      // Update specific timestamps based on status
      if (newStatus === "Shipped" && !order.shippedAt) {
        order.shippedAt = new Date();
      } else if (newStatus === "In Transit" && !order.inTransitAt) {
        order.inTransitAt = new Date();
      } else if (newStatus === "Out for Delivery" && !order.outForDeliveryAt) {
        order.outForDeliveryAt = new Date();
      } else if (newStatus === "Delivered" && !order.deliveredAt) {
        order.deliveredAt = new Date();
        order.canReturn = true;
        // Set return window (7 days)
        const returnWindow = new Date();
        returnWindow.setDate(returnWindow.getDate() + 7);
        order.returnWindowExpiry = returnWindow;

        // Mark transaction eligible for payout (7 days after delivery)
        const payoutController = require("./payoutController");
        await payoutController.makeTransactionEligible(order._id);
      }
    }

    // Update tracking information
    if (awb) order.awbCode = awb;
    if (courier_name) order.courierName = courier_name;
    if (etd) order.estimatedDeliveryDate = new Date(etd);
    if (req.body.track_url) order.trackingUrl = req.body.track_url;

    await order.save();

    console.log(
      `Order ${order._id} updated successfully via Shiprocket webhook`
    );
    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ message: "Error processing webhook" });
  }
};

// Fetch real-time tracking from Shiprocket (with retry)
exports.syncShipmentTracking = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { _id: userId } = req.user;

    const order = await Order.findOne({
      _id: orderId,
      buyer: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!order.shipmentId) {
      return res.status(400).json({
        success: false,
        message: "Shipment not yet created",
      });
    }

    // Retry logic for Shiprocket API
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        const token = await authenticateShiprocket();
        const response = await axios.get(
          `${SHIPROCKET_API_URL}/courier/track/shipment/${order.shipmentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 8000,
          }
        );

        console.log(
          "Shiprocket tracking response:",
          JSON.stringify(response.data, null, 2)
        );

        const trackingData = response.data.tracking_data;
        if (trackingData) {
          const statusMap = {
            "READY TO SHIP": "Packed",
            "PICKUP SCHEDULED": "Packed",
            "PICKED UP": "Shipped",
            "IN TRANSIT": "In Transit",
            "OUT FOR DELIVERY": "Out for Delivery",
            DELIVERED: "Delivered",
            "RTO INITIATED": "RTO Initiated",
            "RTO DELIVERED": "RTO Delivered",
            CANCELLED: "Cancelled",
          };

          const shiprocketStatus = trackingData.shipment_status_code;
          const newStatus = statusMap[shiprocketStatus] || order.status;

          if (newStatus !== order.status) {
            order.status = newStatus;
            order.statusHistory.push({
              status: newStatus,
              note: `Updated from Shiprocket: ${trackingData.shipment_status}`,
              timestamp: new Date(),
            });

            // Update timestamps
            if (newStatus === "Shipped" && !order.shippedAt) {
              order.shippedAt = new Date();
            } else if (newStatus === "In Transit" && !order.inTransitAt) {
              order.inTransitAt = new Date();
            } else if (
              newStatus === "Out for Delivery" &&
              !order.outForDeliveryAt
            ) {
              order.outForDeliveryAt = new Date();
            } else if (newStatus === "Delivered" && !order.deliveredAt) {
              order.deliveredAt = new Date();
              order.canReturn = true;
              const returnWindow = new Date();
              returnWindow.setDate(returnWindow.getDate() + 7);
              order.returnWindowExpiry = returnWindow;

              // Mark transaction eligible for payout (7 days after delivery)
              const payoutController = require("./payoutController");
              await payoutController.makeTransactionEligible(order._id);
            }
          }

          // Update tracking details
          if (trackingData.awb_code) order.awbCode = trackingData.awb_code;
          if (trackingData.courier_name)
            order.courierName = trackingData.courier_name;
          if (trackingData.edd)
            order.estimatedDeliveryDate = new Date(trackingData.edd);
          if (trackingData.track_url)
            order.trackingUrl = trackingData.track_url;

          await order.save();
          console.log(`✅ Order ${order._id} tracking synced from Shiprocket`);
        }

        return res.status(200).json({
          success: true,
          message: "Tracking synced successfully",
          data: {
            status: order.status,
            trackingData: trackingData,
          },
        });
      } catch (error) {
        lastError = error;
        retries--;
        if (retries > 0) {
          console.log(
            `Shiprocket sync failed, retrying... (${retries} attempts left)`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }
    }

    // All retries failed
    throw lastError;
  } catch (error) {
    console.error("Error syncing shipment tracking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync tracking from Shiprocket",
      error: error.message,
    });
  }
};

// Background job to sync all active shipments
exports.syncAllActiveShipments = async () => {
  try {
    console.log("Starting background sync of active shipments...");

    // Find all orders with active shipments
    const activeOrders = await Order.find({
      shipmentId: { $exists: true, $ne: null },
      status: {
        $in: [
          "Confirmed",
          "Processing",
          "Packed",
          "Shipped",
          "In Transit",
          "Out for Delivery",
        ],
      },
    });

    console.log(`Found ${activeOrders.length} active shipments to sync`);

    const token = await authenticateShiprocket();
    let syncedCount = 0;

    for (const order of activeOrders) {
      try {
        console.log(
          `Syncing shipment ${order.shipmentId} for order ${order._id}...`
        );

        const response = await axios.get(
          `${SHIPROCKET_API_URL}/courier/track/shipment/${order.shipmentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log(
          `Shiprocket response for ${order.shipmentId}:`,
          JSON.stringify(response.data, null, 2)
        );

        const trackingData = response.data.tracking_data;
        if (trackingData) {
          const statusMap = {
            "READY TO SHIP": "Packed",
            "PICKUP SCHEDULED": "Packed",
            "PICKED UP": "Shipped",
            "IN TRANSIT": "In Transit",
            "OUT FOR DELIVERY": "Out for Delivery",
            DELIVERED: "Delivered",
          };

          const shiprocketStatus = trackingData.shipment_status_code;
          const newStatus = statusMap[shiprocketStatus] || order.status;

          console.log(
            `Order ${order._id}: Current status="${order.status}", Shiprocket status="${shiprocketStatus}", New status="${newStatus}"`
          );

          if (newStatus !== order.status) {
            console.log(
              `Updating order ${order._id} from ${order.status} to ${newStatus}`
            );
            order.status = newStatus;
            order.statusHistory.push({
              status: newStatus,
              note: `Auto-synced from Shiprocket: ${trackingData.shipment_status}`,
              timestamp: new Date(),
            });

            // Update timestamps
            if (newStatus === "Shipped" && !order.shippedAt)
              order.shippedAt = new Date();
            if (newStatus === "In Transit" && !order.inTransitAt)
              order.inTransitAt = new Date();
            if (newStatus === "Out for Delivery" && !order.outForDeliveryAt)
              order.outForDeliveryAt = new Date();
            if (newStatus === "Delivered" && !order.deliveredAt) {
              order.deliveredAt = new Date();
              order.canReturn = true;
              const returnWindow = new Date();
              returnWindow.setDate(returnWindow.getDate() + 7);
              order.returnWindowExpiry = returnWindow;
            }

            // Update tracking info
            if (trackingData.awb_code && !order.awbCode)
              order.awbCode = trackingData.awb_code;
            if (trackingData.courier_name && !order.courierName)
              order.courierName = trackingData.courier_name;
            if (trackingData.track_url && !order.trackingUrl)
              order.trackingUrl = trackingData.track_url;
            if (trackingData.edd && !order.estimatedDeliveryDate)
              order.estimatedDeliveryDate = new Date(trackingData.edd);

            await order.save();
            syncedCount++;
            console.log(`✅ Order ${order._id} updated successfully`);
          } else {
            console.log(`No status change for order ${order._id}`);
          }
        } else {
          console.log(
            `No tracking data received for shipment ${order.shipmentId}`
          );
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(
          `❌ Error syncing shipment ${order.shipmentId}:`,
          error.response?.data || error.message
        );
      }
    }

    console.log(
      `Background sync completed: ${syncedCount}/${activeOrders.length} orders updated`
    );
    return { synced: syncedCount, total: activeOrders.length };
  } catch (error) {
    console.error("Error in background shipment sync:", error);
    throw error;
  }
};

// Helper function to authenticate with Shiprocket
async function authenticateShiprocket() {
  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });
    return response.data.token;
  } catch (error) {
    console.error("Shiprocket authentication error:", error);
    throw error;
  }
}
