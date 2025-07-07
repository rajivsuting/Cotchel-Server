const Product = require("../models/product");
const Review = require("../models/reviewSchema");
const Order = require("../models/order");

exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const { productId, orderId } = req.params;
    const userId = req.user._id;

    console.log(userId);

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Check if the user has already reviewed this product
    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
    });
    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this product" });
    }

    // Create a new review
    const review = await Review.create({
      user: userId,
      product: productId,
      rating,
      comment,
    });

    // Add review to the product and recalculate average rating
    product.reviews.push(review._id);
    await product.save(); // **This ensures the reviews array is updated in the database**

    await updateProductRating(productId);
    await Order.updateOne(
      { _id: orderId, "products.product": productId },
      { $set: { "products.$.isRated": true } }
    );

    res.status(201).json({ message: "Review added successfully", review });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ product: productId })
      .populate("user", "name email") // Fetch user's name and email
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ message: "Reviews fetched successfully", data: reviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.user.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this review" });
    }

    if (rating) review.rating = rating;
    if (comment) review.comment = comment;

    await review.save();
    await updateProductRating(review.product);

    res.status(200).json({ message: "Review updated successfully", review });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role; // Assuming role is stored in req.user

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.user.toString() !== userId.toString() && userRole !== "admin") {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this review" });
    }

    await Review.findByIdAndDelete(reviewId);
    await updateProductRating(review.product);

    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

async function updateProductRating(productId) {
  const reviews = await Review.find({ product: productId });

  const totalReviews = reviews.length;
  const avgRating =
    totalReviews > 0
      ? reviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews
      : 0;

  await Product.findByIdAndUpdate(productId, {
    ratings: avgRating.toFixed(1),
    reviewsCount: totalReviews,
  });
}
