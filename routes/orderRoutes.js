const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const orderController = require("../controllers/orderController");
const orderManagementController = require("../controllers/orderManagementController");
const paymentRetryController = require("../controllers/paymentRetryController");
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

// Get all orders by payment transaction ID (for multi-seller orders)
router.get(
  "/payment/:paymentTransactionId",
  authMiddleware.verifyToken,
  orderController.getOrdersByPaymentTransactionId
);

// Get order by ID
router.get("/:id", authMiddleware.verifyToken, orderController.getOrderById);

// Handle payment cancellation
router.post(
  "/cancel-payment",
  authMiddleware.verifyToken,
  orderController.handlePaymentCancellation
);

// Test endpoint for stock restoration (development only)
if (process.env.NODE_ENV === "development") {
  router.post("/test-restore-stock", orderController.testRestoreStock);
}

// ============ PAYMENT RETRY ROUTES (Like Flipkart) ============

// Get pending payment orders
router.get(
  "/pending-payment",
  authMiddleware.verifyToken,
  paymentRetryController.getPendingPaymentOrders
);

// Retry payment for a pending order
router.post(
  "/:orderId/retry-payment",
  authMiddleware.verifyToken,
  paymentRetryController.retryPayment
);

// Check if payment can be retried
router.get(
  "/:orderId/can-retry-payment",
  authMiddleware.verifyToken,
  paymentRetryController.checkPaymentRetryEligibility
);

// Cancel pending payment order
router.delete(
  "/:orderId/cancel-pending",
  authMiddleware.verifyToken,
  paymentRetryController.cancelPendingOrder
);

// ============ ORDER MANAGEMENT ROUTES (Production-Ready) ============

// Buyer Routes
router.get(
  "/buyer/my-orders",
  authMiddleware.verifyToken,
  orderManagementController.getBuyerOrders
);

router.post(
  "/:orderId/cancel",
  authMiddleware.verifyToken,
  orderManagementController.requestCancellation
);

router.post(
  "/:orderId/return",
  authMiddleware.verifyToken,
  orderManagementController.requestReturn
);

router.get(
  "/:orderId/cancellable",
  authMiddleware.verifyToken,
  orderManagementController.checkCancellable
);

router.get(
  "/:orderId/returnable",
  authMiddleware.verifyToken,
  orderManagementController.checkReturnable
);

router.get(
  "/:orderId/refund-status",
  authMiddleware.verifyToken,
  orderManagementController.getRefundStatus
);

router.get(
  "/:orderId/history",
  authMiddleware.verifyToken,
  orderManagementController.getOrderHistory
);

// Seller Routes
router.get(
  "/seller/my-orders",
  authMiddleware.verifyToken,
  orderManagementController.getSellerOrders
);

router.put(
  "/:orderId/processing",
  authMiddleware.verifyToken,
  orderManagementController.markAsProcessing
);

router.put(
  "/:orderId/packed",
  authMiddleware.verifyToken,
  orderManagementController.markAsPacked
);

router.put(
  "/:orderId/shipped",
  authMiddleware.verifyToken,
  orderManagementController.markAsShipped
);

router.put(
  "/:orderId/approve-cancellation",
  authMiddleware.verifyToken,
  orderManagementController.approveCancellation
);

router.put(
  "/:orderId/approve-return",
  authMiddleware.verifyToken,
  orderManagementController.approveReturn
);

router.put(
  "/:orderId/reject-return",
  authMiddleware.verifyToken,
  orderManagementController.rejectReturn
);

router.put(
  "/:orderId/mark-returned",
  authMiddleware.verifyToken,
  orderManagementController.markAsReturnedAndRefund
);

// Admin Routes (all order management capabilities)
router.get(
  "/admin/all-orders",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin"),
  orderManagementController.getAdminOrders
);

router.put(
  "/:orderId/in-transit",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin", "Seller"),
  orderManagementController.markAsInTransit
);

router.put(
  "/:orderId/out-for-delivery",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin", "Seller"),
  orderManagementController.markAsOutForDelivery
);

router.put(
  "/:orderId/delivered",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin", "Seller"),
  orderManagementController.markAsDelivered
);

router.put(
  "/:orderId/delivery-failed",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin", "Seller"),
  orderManagementController.markDeliveryFailed
);

module.exports = router;
