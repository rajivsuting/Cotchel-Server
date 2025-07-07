const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const authMiddleware = require("../middleware/authMiddleware");

// Add item to cart
router.post(
  "/add-item",
  authMiddleware.verifyToken,
  cartController.addItemToCart
);

// Get cart details
router.get("/items", authMiddleware.verifyToken, cartController.getCart);

// Remove item from cart
router.delete(
  "/remove-item/:productId",
  authMiddleware.verifyToken,
  cartController.removeItemFromCart
);

// Clear cart
router.delete(
  "/:userId/clear",
  authMiddleware.verifyToken,
  cartController.clearCart
);

// Update cart item (change item quantity)
router.put(
  "/update-item/:productId",
  authMiddleware.verifyToken,
  cartController.updateCartItem
);

// Apply coupon
router.post("/apply-coupon", cartController.applyCoupon);

router.get(
  "/item-count",
  authMiddleware.verifyToken,
  cartController.getCartItemCount
);

module.exports = router;
