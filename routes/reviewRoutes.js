const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const reviewController = require("../controllers/reviewController");
const router = express.Router();

router.post(
  "/:productId",
  authMiddleware.verifyToken,
  reviewController.addReview
);
router.get("/:productId", reviewController.getReviews);
router.put(
  "/:reviewId",
  authMiddleware.verifyToken,
  reviewController.updateReview
);
router.delete(
  "/:reviewId",
  authMiddleware.verifyToken,
  reviewController.deleteReview
);

module.exports = router;
