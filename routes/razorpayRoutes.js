const express = require("express");
const razorpayController = require("../controllers/razorpayController");

const router = express.Router();

router.post("/webhook", razorpayController.razorpayWebhook);

module.exports = router;
