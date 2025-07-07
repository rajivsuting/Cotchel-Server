const mongoose = require("mongoose");

const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "SubCategory name is required"],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category reference is required"],
      validate: {
        validator: async function (value) {
          const categoryExists = await mongoose
            .model("Category")
            .exists({ _id: value });
          return categoryExists !== null;
        },
        message: "Referenced category does not exist",
      },
    },
  },
  { timestamps: true }
);

subCategorySchema.index({ name: 1, category: 1 }, { unique: true });

subCategorySchema.post("save", function (error, doc, next) {
  if (error.name === "MongoServerError" && error.code === 11000) {
    next(new Error("SubCategory name must be unique within the same category"));
  } else {
    next(error);
  }
});

module.exports = mongoose.model("SubCategory", subCategorySchema);
