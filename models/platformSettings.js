const mongoose = require("mongoose");

const platformSettingsSchema = new mongoose.Schema(
  {
    platformFeePercentage: {
      type: Number,
      required: true,
      default: 10, // Default 10%
      min: 0,
      max: 100,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
