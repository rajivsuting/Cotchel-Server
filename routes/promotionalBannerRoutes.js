const express = require("express");
const router = express.Router();
const promotionalBannerController = require("../controllers/promotionalBannersController");
const authMiddleware = require("../middleware/authMiddleware");

// Public routes - anyone can view promotional banners
router.get("/", promotionalBannerController.getAllBanners);
router.get("/:id", promotionalBannerController.getBannerById);

// Admin-only routes - require admin authentication
router.post(
  "/",
  authMiddleware.verifyAdminToken,
  promotionalBannerController.createBanner
);
router.put(
  "/:id",
  authMiddleware.verifyAdminToken,
  promotionalBannerController.updateBanner
);
router.delete(
  "/:id",
  authMiddleware.verifyAdminToken,
  promotionalBannerController.deleteBanner
);

module.exports = router;
