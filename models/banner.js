const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, index: true }, // added index here
    imageUrl: { type: String, required: true },
    redirectUrl: { type: String, trim: true },
    position: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Optional: compound index for more advanced queries (if needed)
// bannerSchema.index({ title: "text" });

module.exports = mongoose.model("Banner", bannerSchema);
