const express = require("express");
const router = express.Router();
const subCategoryController = require("../controllers/subCategoryController");
const authMiddleware = require("../middleware/authMiddleware");

// Public routes - anyone can view subcategories
router.get("/all", subCategoryController.getSubcategories);
router.get("/:categoryId", subCategoryController.getSubCategoriesByCategory);
router.get("/get/:id", subCategoryController.getSubcategoryById);

// Admin-only routes - require admin authentication
router.post(
  "/create",
  authMiddleware.verifyAdminToken,
  subCategoryController.createSubCategory
);
router.put(
  "/:id",
  authMiddleware.verifyAdminToken,
  subCategoryController.updateSubCategory
);
router.delete(
  "/:id",
  authMiddleware.verifyAdminToken,
  subCategoryController.deleteSubCategory
);

module.exports = router;
