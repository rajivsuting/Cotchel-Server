const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * Invoice Routes - Production-ready like Flipkart
 */

// Download invoice (Buyer/Seller/Admin)
router.get(
  "/:orderId/download",
  authMiddleware.verifyToken,
  invoiceController.downloadInvoice
);

// Preview invoice in browser
router.get(
  "/:orderId/preview",
  authMiddleware.verifyToken,
  invoiceController.previewInvoice
);

// Check if invoice is available
router.get(
  "/:orderId/available",
  authMiddleware.verifyToken,
  invoiceController.checkInvoiceAvailability
);

// Bulk generate invoices (Admin only)
router.post(
  "/bulk-generate",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin"),
  invoiceController.bulkGenerateInvoices
);

module.exports = router;


