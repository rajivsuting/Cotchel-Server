const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const authMiddleware = require("../middleware/authMiddleware");

// Public routes - anyone can view categories
router.get("/all", categoryController.getCategories);
router.get("/get/:id", categoryController.getCategoryById);

// Admin-only routes - require admin authentication
router.post(
  "/create",
  authMiddleware.verifyAdminToken,
  categoryController.createCategory
);
router.put(
  "/:id",
  authMiddleware.verifyAdminToken,
  categoryController.updateCategory
);
router.delete(
  "/:id",
  authMiddleware.verifyAdminToken,
  categoryController.deleteCategory
);

module.exports = router;
