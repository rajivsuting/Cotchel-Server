const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: {
    type: String,
    enum: [
      "new_order",
      "payment_received",
      "product_out_of_stock",
      "low_inventory",
      "account_verification",
      "seller_registered",
      "order_placed",
      "error",
    ],
    required: true,
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  // Additional fields for seller notifications
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  amount: { type: Number }, // For payment notifications
  inventoryCount: { type: Number }, // For inventory notifications
  verificationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
