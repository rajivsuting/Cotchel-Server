const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      quantity: Number,
      lotSize: Number,
      price: Number,
      totalPrice: Number,
      isRated: { type: Boolean, default: false },
      canReturn: { type: Boolean, default: true }, // Can this item be returned
      returnReason: String,
      returnStatus: {
        type: String,
        enum: [
          "Not Applicable",
          "Requested",
          "Approved",
          "Rejected",
          "Completed",
        ],
        default: "Not Applicable",
      },
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

  // Main order status
  status: {
    type: String,
    enum: [
      "Payment Pending", // Order created, waiting for payment
      "Confirmed", // Payment successful, order confirmed
      "Processing", // Being prepared/packed
      "Packed", // Ready for pickup
      "Shipped", // Given to courier
      "In Transit", // On the way
      "Out for Delivery", // Arriving today
      "Delivered", // Successfully delivered
      "Completed", // Order completed, no returns possible
      "Cancellation Requested", // User requested cancellation
      "Cancelled", // Order cancelled
      "Return Requested", // User wants to return
      "Return Approved", // Return approved by seller
      "Return Rejected", // Return rejected by seller
      "Returned", // Item returned to seller
      "Refunded", // Money refunded
      "Delivery Failed", // Failed delivery attempt
      "RTO Initiated", // Return to origin started
      "RTO Delivered", // Returned to seller
    ],
    default: "Payment Pending",
  },

  // Payment status
  paymentStatus: {
    type: String,
    enum: [
      "Pending",
      "Paid",
      "Failed",
      "Refund Requested",
      "Refund Processing",
      "Partially Refunded",
      "Refunded",
    ],
    default: "Pending",
  },

  paymentTransactionId: String,
  razorpayPaymentId: String,
  razorpayOrderId: String,
  razorpaySignature: String,

  // Refund details
  refundDetails: {
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundStatus: String,
    refundInitiatedAt: Date,
    refundCompletedAt: Date,
    refundProcessingFee: { type: Number, default: 0 },
  },

  // Shipping details
  shipmentId: String,
  shiprocketOrderId: String,
  awbCode: String, // Air Waybill number
  courierName: String,
  trackingUrl: String,
  estimatedDeliveryDate: Date,
  actualDeliveryDate: Date,

  // Delivery attempts
  deliveryAttempts: [
    {
      attemptNumber: Number,
      attemptDate: Date,
      status: String, // "Failed", "Successful"
      reason: String,
      note: String,
    },
  ],

  // Address
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
    phone: String,
    name: String,
  },

  // Cancellation details
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  cancellationReason: String,
  cancellationApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  cancellationApprovedAt: Date,

  // Stock management
  stockDeducted: { type: Boolean, default: false }, // Track if stock has been deducted

  // Return details
  returnRequestedAt: Date,
  returnApprovedAt: Date,
  returnReceivedAt: Date,
  returnReason: String,
  returnImages: [String], // Images of damaged/wrong items
  returnPickupScheduled: Date,
  returnAwbCode: String,

  // Timestamps for tracking
  confirmedAt: Date,
  processingAt: Date,
  packedAt: Date,
  shippedAt: Date,
  inTransitAt: Date,
  outForDeliveryAt: Date,
  deliveredAt: Date,
  completedAt: Date,

  // Status history
  statusHistory: [
    {
      status: String,
      timestamp: { type: Date, default: Date.now },
      note: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  ],

  // Cart reference
  cartId: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },

  // Additional flags
  canCancel: { type: Boolean, default: true },
  canReturn: { type: Boolean, default: false },
  returnWindowExpiry: Date, // Date when return window closes

  // Platform commission
  platformFee: Number,
  platformFeePercentage: Number,
  sellerEarnings: Number,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for faster queries
orderSchema.index({ buyer: 1, status: 1 });
orderSchema.index({ seller: 1, status: 1 });
orderSchema.index({ paymentTransactionId: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1 });

// Update timestamps
orderSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for checking if order can be cancelled
orderSchema.virtual("isCancellable").get(function () {
  const cancellableStatuses = [
    "Payment Pending",
    "Confirmed",
    "Processing",
    "Packed",
  ];
  return cancellableStatuses.includes(this.status) && this.canCancel;
});

// Virtual for checking if order can be returned
orderSchema.virtual("isReturnable").get(function () {
  if (this.status !== "Delivered") return false;
  if (!this.canReturn) return false;
  if (!this.returnWindowExpiry) return false;
  return new Date() < this.returnWindowExpiry;
});

// Set toJSON virtuals
orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Order", orderSchema);
