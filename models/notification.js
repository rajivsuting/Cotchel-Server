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
      "courier_assigned",
      "pickup_scheduled",
      "error",
    ],
    required: true,
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  timestamp: { type: Date, default: Date.now, index: true },
  read: { type: Boolean, default: false, index: true },
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

// Compound index for efficient queries
notificationSchema.index({ sellerId: 1, read: 1, timestamp: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
