const express = require("express");
const router = express.Router();
const promotionalBannerController = require("../controllers/promotionalBannersController");
// const { verifyAdmin } = require("../middlewares/auth"); // Optional

// router.use(verifyAdmin); // Uncomment if needed

router.post("/", promotionalBannerController.createBanner);
router.get("/", promotionalBannerController.getAllBanners);
router.get("/:id", promotionalBannerController.getBannerById);
router.put("/:id", promotionalBannerController.updateBanner);
router.delete("/:id", promotionalBannerController.deleteBanner);

module.exports = router;
