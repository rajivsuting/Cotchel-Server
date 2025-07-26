const express = require("express");
const router = express.Router();
const inquiryController = require("../controllers/inquiryController");
const authMiddleware = require("../middleware/authMiddleware");

// User routes (for authenticated users)
router.post("/", authMiddleware.verifyToken, inquiryController.createInquiry);
router.get(
  "/user",
  authMiddleware.verifyToken,
  inquiryController.getUserInquiries
);
router.get(
  "/:id",
  authMiddleware.verifyToken,
  inquiryController.getInquiryById
);

// Admin routes (for admin users only)
router.get(
  "/",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin"),
  inquiryController.getAllInquiries
);
router.patch(
  "/:id/status",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin"),
  inquiryController.updateInquiryStatus
);
router.post(
  "/:id/response",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin"),
  inquiryController.addResponse
);
router.delete(
  "/:id",
  authMiddleware.verifyToken,
  authMiddleware.restrictTo("Admin"),
  inquiryController.deleteInquiry
);

module.exports = router;
