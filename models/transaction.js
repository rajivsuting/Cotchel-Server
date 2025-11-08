const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  platformFee: {
    type: Number,
    required: true,
  },
  sellerAmount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["Razorpay", "COD"],
    default: "Razorpay",
  },
  paymentId: String,
  status: {
    type: String,
    enum: ["Pending", "Completed", "Failed", "Refunded"],
    default: "Pending",
  },
  paymentDetails: {
    bank: String,
    cardType: String,
    last4: String,
    email: String,
    contact: String,
  },

  // Payout tracking
  payoutStatus: {
    type: String,
    enum: ["Pending", "Eligible", "Processing", "Completed", "Failed"],
    default: "Pending",
  },
  payoutEligibleDate: Date, // When eligible for payout (deliveredAt + 7 days)
  payoutDate: Date, // When payout was actually made
  payoutBatchId: String, // For tracking bulk payouts
  payoutReferenceNumber: String, // Bank transfer reference
  payoutMethod: {
    type: String,
    enum: ["Manual", "Razorpay", "Bank Transfer"],
    default: "Manual",
  },
  payoutNotes: String, // Admin notes

  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
});

module.exports = mongoose.model("Transaction", transactionSchema);
