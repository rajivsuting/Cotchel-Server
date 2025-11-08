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

// Get all orders
router.get("/", authMiddleware.verifyToken, orderController.getAllOrders);

// Payment verification (needs JSON body, not raw - must be before raw parser)
router.post(
  "/razorpay-webhook",
  (req, res, next) => {
    console.log("[ROUTE DEBUG] /razorpay-webhook route hit");
    next();
  },
  authMiddleware.verifyClientToken,
  orderController.verifyPayment
);

// Webhook routes (need raw body for signature verification)
router.use(bodyParser.raw({ type: "application/json" }));
router.post("/webhook/payment", webhookController.handlePaymentWebhook);
router.post("/webhook/shipment", webhookController.handleShipmentWebhook);

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

// ============ PAYMENT RETRY ROUTES (Like Flipkart) ============
// IMPORTANT: These specific routes must come BEFORE the generic /:id route

// Get pending payment orders
router.get(
  "/pending-payment",
  authMiddleware.verifyToken,
  paymentRetryController.getPendingPaymentOrders
);

// Check if payment can be retried
router.get(
  "/:orderId/can-retry-payment",
  authMiddleware.verifyToken,
  paymentRetryController.checkPaymentRetryEligibility
);

// Retry payment for a pending order
router.post(
  "/:orderId/retry-payment",
  authMiddleware.verifyToken,
  paymentRetryController.retryPayment
);

// Cancel pending payment order
router.delete(
  "/:orderId/cancel-pending",
  authMiddleware.verifyToken,
  paymentRetryController.cancelPendingOrder
);

// Handle payment cancellation
router.post(
  "/cancel-payment",
  authMiddleware.verifyToken,
  orderController.handlePaymentCancellation
);

// Get all orders by payment transaction ID (for multi-seller orders)
router.get(
  "/payment/:paymentTransactionId",
  authMiddleware.verifyToken,
  orderController.getOrdersByPaymentTransactionId
);

// Test endpoints (development only)
if (process.env.NODE_ENV === "development") {
  router.post("/test-restore-stock", orderController.testRestoreStock);
  router.post(
    "/test-order-confirmation-email",
    orderController.testOrderConfirmationEmail
  );
}

// ============ SHIPPING MANAGEMENT ROUTES ============

// Calculate shipping fee before checkout
router.post(
  "/calculate-shipping",
  authMiddleware.verifyToken,
  require("../controllers/shippingController").calculateShippingFee
);

// Seller shipping actions
router.post(
  "/:orderId/generate-label",
  authMiddleware.verifyToken,
  require("../controllers/shippingController").generateShippingLabel
);

router.post(
  "/:orderId/schedule-pickup",
  authMiddleware.verifyToken,
  require("../controllers/shippingController").schedulePickup
);

// Sync shipment tracking from Shiprocket (real-time)
router.post(
  "/:orderId/sync-tracking",
  authMiddleware.verifyToken,
  require("../controllers/webhookController").syncShipmentTracking
);

// Get order by ID - MUST be last among GET routes
router.get("/:id", authMiddleware.verifyToken, orderController.getOrderById);

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
  authMiddleware.verifyAdminToken,
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
