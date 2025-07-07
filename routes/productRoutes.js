const express = require("express");
const productController = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware.verifyToken, productController.createProduct);

router.get("/", authMiddleware.optionalAuth, productController.getAllProducts);
router.get("/get/:id", productController.getProductById);
router.get("/search", productController.searchProduct);
router.get("/suggestions", productController.searchSuggestions);
router.get(
  "/enhanced-suggestions",
  productController.enhancedSearchSuggestions
);

router.delete(
  "/delete/:productId",
  authMiddleware.verifyToken,
  productController.deleteProduct
);

router.put(
  "/:productId",
  // authMiddleware.verifyToken,
  productController.editProduct
);

module.exports = router;
