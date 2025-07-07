const Razorpay = require("razorpay");
// const Order = require("../models/order");
const User = require("../models/User");

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createRazorpayOrder = async (orderDetails) => {
  try {
    const options = {
      amount: orderDetails.totalPrice * 100,
      currency: "INR",
      receipt: `order_${Date.now()}`,
      notes: {
        buyerId: orderDetails.buyer,
        sellerId: orderDetails.seller,
      },
    };
    const order = await instance.orders.create(options);
    return order;
  } catch (error) {
    throw new Error("Error creating Razorpay order: " + error.message);
  }
};

exports.capturePayment = async (paymentId, orderId) => {
  try {
    const payment = await instance.payments.capture(paymentId, 100, "INR");
    if (payment.status === "captured") {
      await Order.findOneAndUpdate(
        { razorpayOrderId: orderId },
        {
          paymentStatus: "Paid",
          paymentTransactionId: payment.id,
          status: "Completed",
        },
        { new: true }
      );
    }
    return payment;
  } catch (error) {
    throw new Error("Error capturing Razorpay payment: " + error.message);
  }
};

exports.processPayout = async (orderId) => {
  const order = await Order.findById(orderId);
  const seller = await User.findById(order.seller);
  const admin = await User.findById("admin-user-id");

  const adminShare = order.totalPrice * 0.1;
  const sellerShare = order.totalPrice - adminShare;

  try {
    await instance.payouts.create({
      account: admin.razorpayAccountId,
      amount: adminShare * 100,
      currency: "INR",
    });

    await instance.payouts.create({
      account: seller.razorpayAccountId,
      amount: sellerShare * 100,
      currency: "INR",
    });
  } catch (error) {
    throw new Error("Error processing payout: " + error.message);
  }
};
