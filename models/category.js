const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
    },
    subCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],
  },
  { timestamps: true }
);

categorySchema.pre(/^find/, function (next) {
  this.populate("subCategories");
  next();
});

categorySchema.methods.deleteWithSubCategories = async function () {
  const SubCategory = mongoose.model("SubCategory");
  await SubCategory.deleteMany({ category: this._id });
  await this.deleteOne();
};

categorySchema.post("save", function (error, doc, next) {
  if (error.name === "MongoServerError" && error.code === 11000) {
    next(new Error("Category name must be unique"));
  } else {
    next(error);
  }
});

module.exports = mongoose.model("Category", categorySchema);
