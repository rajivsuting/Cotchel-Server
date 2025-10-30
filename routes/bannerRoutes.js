const express = require("express");
const router = express.Router();
const bannerController = require("../controllers/bannerController");
const authMiddleware = require("../middleware/authMiddleware");

// Public routes - anyone can view banners
router.get("/", bannerController.getAllBanners);
router.get("/:id", bannerController.getBannerById);

// Admin-only routes - require admin authentication
router.post(
  "/",
  authMiddleware.verifyAdminToken,
  bannerController.createBanner
);
router.put(
  "/:id",
  authMiddleware.verifyAdminToken,
  bannerController.updateBanner
);
router.delete(
  "/:id",
  authMiddleware.verifyAdminToken,
  bannerController.deleteBanner
);

module.exports = router;
