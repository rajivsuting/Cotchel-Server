const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const webhookController = require("../controllers/webhookController");
const {
  orderRateLimiter,
  fraudDetection,
} = require("../middleware/securityMiddleware");

router.use(bodyParser.raw({ type: "application/json" }));

// Get all orders
router.get("/", authMiddleware.verifyToken, orderController.getAllOrders);

// Payment verification
router.post("/razorpay-webhook", orderController.verifyPayment);

// Order creation routes with security middleware
router.post(
  "/cart-checkout",
  authMiddleware.verifyToken,
  orderRateLimiter,
  fraudDetection,
  orderController.createOrderFromCart
);

router.post(
  "/buy-now",
  authMiddleware.verifyToken,
  orderRateLimiter,
  fraudDetection,
  orderController.createOrderFromBuyNow
);

// Webhook routes
router.post("/webhook/payment", webhookController.handlePaymentWebhook);
router.post("/webhook/shipment", webhookController.handleShipmentWebhook);

// Get order by ID
router.get("/:id", authMiddleware.verifyToken, orderController.getOrderById);

module.exports = router;
