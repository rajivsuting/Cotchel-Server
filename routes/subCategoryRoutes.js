const express = require("express");
const router = express.Router();
const subCategoryController = require("../controllers/subCategoryController");

router.post("/create", subCategoryController.createSubCategory);
router.get("/all", subCategoryController.getSubcategories);
router.get("/:categoryId", subCategoryController.getSubCategoriesByCategory);
router.get("/get/:id", subCategoryController.getSubcategoryById);
router.delete("/subcategories/:id", subCategoryController.deleteSubCategory);

module.exports = router;
