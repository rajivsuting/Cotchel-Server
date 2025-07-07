const mongoose = require("mongoose");

const promotionalBannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, index: true }, // added index here
    imageUrl: { type: String, required: true },
    redirectUrl: { type: String, trim: true },
    position: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PromotionalBanner", promotionalBannerSchema);
