const mongoose = require("mongoose");
const Address = require("./address");
const SellerDetails = require("./sellerDetails");

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhoneNumber = (phone) =>
  /^(\+91[-\s]?)?[56789]\d{9}$/.test(phone);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String },
    email: {
      type: String,
      unique: true,
      required: true,
      validate: {
        validator: validateEmail,
        message: "Please enter a valid email address.",
      },
    },
    password: { type: String },
    phoneNumber: {
      type: String,
      validate: {
        validator: validatePhoneNumber,
        message: "Please enter a valid phone number.",
      },
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: (dob) => dob < Date.now(),
        message: "Date of birth must be in the past.",
      },
    },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    role: {
      type: String,
      enum: ["Buyer", "Seller", "Admin"],
      default: "Buyer",
    },
    lastActiveRole: {
      type: String,
      enum: ["Buyer", "Seller"],
      default: "Buyer",
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String },
    resetToken: {
      type: String,
      default: null,
    },
    tokenExpiry: {
      type: Date,
      default: Date.now() + 3600000,
    },
    emailVerificationCodeExpiry: {
      type: Date,
      default: () => Date.now() + 2 * 60 * 1000,
    },
    isVerifiedSeller: {
      type: Boolean,
      default: false,
    },
    sellerDetails: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SellerDetails",
    },
    active: {
      type: Boolean,
      default: true,
    },
    addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Address" }],
  },
  { timestamps: true }
);

userSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 120, // 2 minutes
    partialFilterExpression: { isEmailVerified: false },
  }
);

userSchema.pre("findOne", function () {
  this.populate("addresses");
});

userSchema.pre("find", function () {
  this.populate("addresses");
});

userSchema.pre("findByIdAndUpdate", function () {
  this.populate("addresses");
});
module.exports = mongoose.model("User", userSchema);
