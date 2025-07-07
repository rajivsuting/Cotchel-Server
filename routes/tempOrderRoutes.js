const express = require("express");
const tempOrderController = require("../controllers/tempOrderController");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

router.post(
  "/",
  authMiddleware.verifyToken,
  tempOrderController.createTempOrder
);
module.exports = router;
