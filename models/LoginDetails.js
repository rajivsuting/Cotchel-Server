const mongoose = require("mongoose");

const loginDetailsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ip: {
      type: String,
    },
    device: {
      type: String,
    },
    location: {
      city: String,
      region: String,
      country: String,
    },
    loginTime: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoginDetails", loginDetailsSchema);
