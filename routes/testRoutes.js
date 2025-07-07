const express = require("express");
const router = express.Router();

// Test route to verify CSRF protection
router.post("/test-csrf", (req, res) => {
  res.json({
    message: "CSRF protection is working!",
    timestamp: new Date().toISOString(),
    csrfToken: req.csrfToken ? "Present" : "Missing",
  });
});

// Test route that doesn't require CSRF (GET request)
router.get("/test-csrf", (req, res) => {
  res.json({
    message: "GET request successful - no CSRF required",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
