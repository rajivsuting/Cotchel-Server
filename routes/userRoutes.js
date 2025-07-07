const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", authController.register);
router.post("/verify-email", authController.verifyEmail);
router.put("/update-details", authController.updateDetails);
router.post("/login", authController.loginUser);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logoutUser);
router.put(
  "/seller-details",
  authMiddleware.verifyToken,
  authController.addSellerDetails
);
router.get(
  "/profile",
  authMiddleware.verifyToken,
  authController.getUserProfile
);
router.get("/me", authMiddleware.verifyToken, (req, res) => {
  return res.status(200).json({
    user: req.user,
  });
});
router.patch("/edit", authMiddleware.verifyToken, authController.editUser);
// router.get("/get/:id", authController.getUserById);
router.post("/request-reset", authController.requestResetLink);

router.post("/reset-password", authController.resetPassword);
router.get("/all", authController.getAllUsers);
router.get("/get/:id", authController.getUserById);

router.get("/google-signin", authController.continueWithGoogle);
router.post("/resend-otp", authController.resendOTP);

router.get("/pending-sellers", authController.getPendingSellers);
router.patch("/approve-seller/:id", authController.approveSeller);
router.patch("/reject-seller/:id", authController.rejectSeller);

router.get("/notifications", authController.getNotifications);
router.patch("/notifications/:id/read", authController.markNotificationAsRead);
router.patch(
  "/notifications/mark-all-read",
  authController.markAllNotificationsAsRead
);

// Update last active role
router.put(
  "/update-last-active-role",
  authMiddleware.verifyToken,
  authController.updateLastActiveRole
);

module.exports = router;
