const express = require("express");
const addressController = require("../controllers/addressController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware.verifyToken, addressController.createAddress);
router.get("/", authMiddleware.verifyToken, addressController.getAddresses);
router.get(
  "/:id",

  addressController.getAddressById
);
router.put("/:id", authMiddleware.verifyToken, addressController.updateAddress);
router.delete(
  "/:id",
  authMiddleware.verifyToken,
  addressController.deleteAddress
);

module.exports = router;
