const express = require("express");
const router = express.Router();
const inquiryController = require("../controllers/inquiryController");
const authMiddleware = require("../middleware/authMiddleware");

// Public routes (for users)
router.post("/", authMiddleware.verifyToken, inquiryController.createInquiry);

// Admin routes
router.get(
  "/",
  authMiddleware.verifyToken,

  inquiryController.getAllInquiries
);

router.get(
  "/:id",
  authMiddleware.verifyToken,
  inquiryController.getInquiryById
);

router.patch(
  "/:id/status",
  authMiddleware.verifyToken,

  inquiryController.updateInquiryStatus
);

router.post(
  "/:id/response",
  authMiddleware.verifyToken,

  inquiryController.addResponse
);

router.delete(
  "/:id",
  authMiddleware.verifyToken,

  inquiryController.deleteInquiry
);

module.exports = router;
