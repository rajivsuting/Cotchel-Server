const Product = require("../models/product");
const Review = require("../models/reviewSchema");
const Order = require("../models/order");

exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const { productId } = req.params;
    const userId = req.user._id;

    console.log("Adding review for product:", productId, "by user:", userId);

    const numericRating = Number(rating);
    if (
      !numericRating ||
      numericRating < 1 ||
      numericRating > 5 ||
      isNaN(numericRating)
    ) {
      return res
        .status(400)
        .json({ message: "Rating must be a valid number between 1 and 5" });
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: "Comment is required" });
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

    // Check if the user has purchased and completed this product
    const eligibleOrder = await Order.findOne({
      buyer: userId,
      status: { $in: ["Completed", "Shipped"] },
      paymentStatus: "Paid",
      "products.product": productId,
    });
    if (!eligibleOrder) {
      return res.status(403).json({
        message:
          "You can only review products you have purchased and completed.",
      });
    }

    // Create a new review
    console.log("Creating review with data:", {
      user: userId,
      product: productId,
      rating: numericRating,
      ratingType: typeof numericRating,
      comment: comment.trim(),
    });

    const review = await Review.create({
      user: userId,
      product: productId,
      rating: numericRating,
      comment: comment.trim(),
    });

    console.log("Review created:", {
      id: review._id,
      rating: review.rating,
      ratingType: typeof review.rating,
    });

    // Add review to the product and recalculate average rating
    product.reviews.push(review._id);
    await product.save();

    await updateProductRating(productId);

    // Populate the user info for the response
    const populatedReview = await Review.findById(review._id).populate(
      "user",
      "fullName email"
    );

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      review: populatedReview,
    });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ product: productId })
      .populate("user", "fullName email") // Fetch user's fullName and email
      .sort({ createdAt: -1 });

    // Debug logging
    console.log("=== GET REVIEWS DEBUG ===");
    console.log("Product ID:", productId);
    console.log("Reviews found:", reviews.length);
    reviews.forEach((review, index) => {
      console.log(`Review ${index + 1}:`, {
        id: review._id,
        rating: review.rating,
        ratingType: typeof review.rating,
        user: review.user?.fullName || review.user?._id,
      });
    });
    console.log("=== END GET REVIEWS DEBUG ===");

    res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: reviews,
    });
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

  console.log("=== UPDATING PRODUCT RATING ===");
  console.log("Product ID:", productId);
  console.log("Total reviews found:", reviews.length);

  reviews.forEach((review, index) => {
    console.log(`Review ${index + 1}:`, {
      id: review._id,
      rating: review.rating,
      ratingType: typeof review.rating,
      user: review.user,
    });
  });

  const totalReviews = reviews.length;
  const avgRating =
    totalReviews > 0
      ? reviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews
      : 0;

  console.log("Calculated average rating:", avgRating);
  console.log("Formatted average rating:", avgRating.toFixed(1));

  await Product.findByIdAndUpdate(productId, {
    ratings: avgRating.toFixed(1),
    reviewsCount: totalReviews,
  });

  console.log("Product rating updated successfully");
  console.log("=== END UPDATING PRODUCT RATING ===");
}
