const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createPaymentOrder = async (order) => {
  try {
    const options = {
      amount: Math.round(order.totalPrice * 100),
      currency: "INR",
      receipt: `receipt_${order._id}`,
      payment_capture: 1,
    };

    return await razorpay.orders.create(options);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw { statusCode: 401, error: error.error || "Authentication failed" };
  }
};
