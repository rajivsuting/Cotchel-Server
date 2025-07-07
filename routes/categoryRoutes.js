const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/create", categoryController.createCategory);
router.get("/all", categoryController.getCategories);
router.get("/get/:id", categoryController.getCategoryById);
router.delete("/get/:id", categoryController.deleteCategory);

module.exports = router;
