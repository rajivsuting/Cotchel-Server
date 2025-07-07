const Razorpay = require("razorpay");
const crypto = require("crypto");

const apiResponse = require("../utils/apiResponse");
const razorpayService = require("../services/razorpayService");

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
      order.paymentTransactionId = data.id;
      order.status = "Completed";
      await order.save();

      await razorpayService.processPayout(order._id);

      return apiResponse.successResponse(res, "Payment captured successfully");
    }

    if (event === "payment.failed") {
      const order = await Order.findOne({ razorpayOrderId: data.order_id });

      if (!order) {
        return apiResponse.errorResponse(res, "Order not found", 404);
      }

      order.paymentStatus = "Failed";
      await order.save();

      return apiResponse.successResponse(res, "Payment failed, order updated");
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
