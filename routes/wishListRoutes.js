const express = require("express");
const router = express.Router();
const wishListController = require("../controllers/wishListController");
const authMiddleware = require("../middleware/authMiddleware");

router.post(
  "/add",
  authMiddleware.verifyToken,
  wishListController.addToWishlist
);

router.get(
  "/all",
  authMiddleware.verifyToken,
  wishListController.getUserWishlist
);

router.post(
  "/remove",
  authMiddleware.verifyToken,
  wishListController.removeFromWishlist
);

module.exports = router;
