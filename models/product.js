const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      maxlength: 255,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      maxlength: 5000,
      trim: true,
    },
    images: {
      type: [String],
      validate: [arrayLimit, "Maximum 10 images allowed"],
    },

    featuredImage: {
      type: String,
      required: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
    },
    quantityAvailable: {
      type: Number,
      required: true,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      required: false,
      min: 0,
    },

    keyHighLights: {
      type: [String],
      validate: [arrayLimit, "Maximum 10 highlights allowed"],
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
    ratings: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    lotSize: {
      type: Number,
      default: 1,
    },
    reviewsCount: {
      type: Number,
      default: 0,
    },
    length: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
      trim: true,
    },
    breadth: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
      trim: true,
    },
    height: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
      trim: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    fileAttachments: [
      {
        type: String,
        validate: {
          validator: function (value) {
            if (!value) return true; // Allow empty values
            return /\.(xls|xlsx|csv|pdf|doc|docx|ppt|pptx)$/i.test(value);
          },
          message:
            "Only XLS, CSV, PDF, DOC, DOCX, PPT, or PPTX files are allowed.",
        },
      },
    ],
  },
  { timestamps: true }
);

function arrayLimit(val) {
  return val.length <= 10;
}

module.exports = mongoose.model("Product", productSchema);
