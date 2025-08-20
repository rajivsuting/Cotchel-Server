const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      quantity: Number,
      lotSize: Number, // Add lotSize field for consistency
      price: Number,
      totalPrice: Number,
      isRated: { type: Boolean, default: false },
    },
  ],
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  totalPrice: Number,
  status: {
    type: String,
    enum: [
      "Pending",
      "Completed",
      "Cancelled",
      "Payment Failed",
      "Payment Pending",
      "Shipped",
    ],
    default: "Pending",
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    default: "Pending",
  },
  paymentTransactionId: String,
  shipmentId: String, // Shiprocket shipment ID
  shiprocketOrderId: String, // Shiprocket order ID
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
    phone: String,
    name: String,
  },
  // paymentMethod: {
  //   type: String,
  //   enum: ["COD", "Prepaid"],
  //   required: true,
  // },
  cartId: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },
  cancelledAt: Date, // When the order was cancelled
  cancellationReason: String, // Reason for cancellation
  statusHistory: [
    {
      status: String,
      timestamp: { type: Date, default: Date.now },
      note: String,
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
