const Order = require("../models/order");
const { retryAxiosRequest } = require("../utils/retryUtils");
const crypto = require("crypto");
const axios = require("axios");

const SHIPROCKET_API_URL = "https://apiv2.shiprocket.in/v1/external";

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
        order.status = "Processing";
        break;
      case "payment.failed":
        order.paymentStatus = "Failed";
        order.status = "Payment Failed";
        break;
      case "payment.refunded":
        order.paymentStatus = "Refunded";
        break;
    }

    await order.save();
    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Payment webhook error:", error);
    res.status(500).json({ message: "Error processing webhook" });
  }
};

// Verify Shiprocket webhook signature
const verifyShiprocketSignature = (payload, signature) => {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.SHIPROCKET_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
  return expectedSignature === signature;
};

// Handle Shiprocket webhook
exports.handleShipmentWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-shiprocket-signature"];
    if (!verifyShiprocketSignature(req.body, signature)) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const { order_id, status, awb_code, courier_name } = req.body;

    // Update order status based on Shiprocket status
    const order = await Order.findOne({ _id: order_id });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Map Shiprocket status to your order status
    const statusMap = {
      NEW: "Processing",
      PICKUP_COMPLETED: "Shipped",
      IN_TRANSIT: "In Transit",
      OUT_FOR_DELIVERY: "Out for Delivery",
      DELIVERED: "Delivered",
      RTO_DELIVERED: "Returned",
      CANCELLED: "Cancelled",
    };

    order.status = statusMap[status] || status;
    order.shippingDetails = {
      awbCode: awb_code,
      courierName: courier_name,
      lastUpdated: new Date(),
    };

    await order.save();
    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ message: "Error processing webhook" });
  }
};

// Periodic status check function
exports.checkShipmentStatus = async (orderId) => {
  try {
    const token = await authenticateShiprocket();
    const order = await Order.findById(orderId);

    if (!order || !order.shipmentId) {
      throw new Error("Order or shipment ID not found");
    }

    const response = await axios.get(
      `${SHIPROCKET_API_URL}/courier/track/shipment/${order.shipmentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { tracking_data } = response.data;
    if (tracking_data) {
      order.shippingDetails = {
        ...order.shippingDetails,
        currentStatus: tracking_data.status,
        trackingHistory: tracking_data.track_history,
        lastUpdated: new Date(),
      };
      await order.save();
    }

    return tracking_data;
  } catch (error) {
    console.error("Error checking shipment status:", error);
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
