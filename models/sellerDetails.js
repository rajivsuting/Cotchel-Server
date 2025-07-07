const mongoose = require("mongoose");

const sellerDetailsSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true },
    gstin: {
      type: String,
      validate: {
        validator: (gst) =>
          /^(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1})$/.test(gst),
        message: "Invalid GSTIN format.",
      },
    },
    pan: {
      type: String,
      validate: {
        validator: (pan) => /^[A-Z]{5}\d{4}[A-Z]{1}$/.test(pan),
        message: "Invalid PAN format.",
      },
    },
    bankName: { type: String, required: true },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: {
      type: String,
      validate: {
        validator: (ifsc) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc),
        message: "Invalid IFSC code format.",
      },
    },
    branch: { type: String },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SellerDetails", sellerDetailsSchema);
