const express = require("express");
const router = express.Router();
const bannerController = require("../controllers/bannerController");
// const { verifyAdmin } = require("../middlewares/auth"); // Optional

// router.use(verifyAdmin); // Uncomment if needed

router.post("/", bannerController.createBanner);
router.get("/", bannerController.getAllBanners);
router.get("/:id", bannerController.getBannerById);
router.put("/:id", bannerController.updateBanner);
router.delete("/:id", bannerController.deleteBanner);

module.exports = router;
