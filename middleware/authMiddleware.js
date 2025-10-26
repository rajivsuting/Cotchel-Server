const jwt = require("jsonwebtoken");

// Client authentication middleware
exports.verifyClientToken = async (req, res, next) => {
  const accessToken = req.cookies?.client_accessToken;

  if (!accessToken) {
    return res.status(401).json({ error: "Client access token missing" });
  }

  jwt.verify(accessToken, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ error: "Client token expired", reAuth: true });
      }

      return res.status(401).json({ error: "Invalid client token" });
    }

    // Check if user account is still active and get complete user data
    try {
      const User = require("../models/User");
      const currentUser = await User.findById(user._id).select(
        "active role lastActiveRole isVerifiedSeller"
      );

      if (!currentUser) {
        return res.status(401).json({
          error: "Account not found",
          message: "Your account has been deleted. Please contact support.",
          code: "ACCOUNT_DELETED",
        });
      }

      if (!currentUser.active) {
        return res.status(403).json({
          error: "Account deactivated",
          message:
            "Your account has been deactivated by an administrator. Please contact support for assistance.",
          code: "ACCOUNT_DEACTIVATED",
        });
      }

      // Set complete user data including role and lastActiveRole
      req.user = {
        ...user,
        role: currentUser.role,
        lastActiveRole: currentUser.lastActiveRole,
        isVerifiedSeller: currentUser.isVerifiedSeller,
      };
      next();
    } catch (error) {
      console.error("Error checking user status:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
};

// Admin authentication middleware
exports.verifyAdminToken = async (req, res, next) => {
  const accessToken = req.cookies?.admin_accessToken;

  if (!accessToken) {
    return res.status(401).json({ error: "Admin access token missing" });
  }

  jwt.verify(accessToken, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ error: "Admin token expired", reAuth: true });
      }

      return res.status(401).json({ error: "Invalid admin token" });
    }

    // Check if user account is still active and exists
    try {
      const User = require("../models/User");
      const currentUser = await User.findById(user._id).select("active role");

      if (!currentUser) {
        return res.status(401).json({
          error: "Account not found",
          message:
            "Your admin account has been deleted. Please contact the system administrator.",
          code: "ADMIN_ACCOUNT_DELETED",
        });
      }

      if (!currentUser.active) {
        return res.status(403).json({
          error: "Account deactivated",
          message:
            "Your admin account has been deactivated. Please contact the system administrator for assistance.",
          code: "ADMIN_ACCOUNT_DEACTIVATED",
        });
      }

      // Additional check for admin role
      if (currentUser.role !== "Admin") {
        return res
          .status(403)
          .json({ error: "Access denied. Admin role required." });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Error checking admin status:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
};

// Keep original verifyToken for backward compatibility (will be removed later)
exports.verifyToken = exports.verifyClientToken;

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: "User not authenticated" });

    // Debug logging
    console.log("[DEBUG] restrictTo middleware:");
    console.log("  - req.user.role:", req.user.role);
    console.log("  - req.user.lastActiveRole:", req.user.lastActiveRole);
    console.log("  - req.user.isVerifiedSeller:", req.user.isVerifiedSeller);
    console.log("  - roles:", roles);

    // For seller routes, check lastActiveRole instead of role
    const userRole = roles.includes("Seller")
      ? req.user.lastActiveRole
      : req.user.role;

    console.log("  - userRole:", userRole);
    console.log("  - roles.includes(userRole):", roles.includes(userRole));

    if (!roles.includes(userRole))
      return res.status(403).json({ error: "Access denied" });
    next();
  };

exports.optionalAuth = (req, res, next) => {
  const accessToken = req.cookies?.accessToken;
  if (!accessToken) {
    req.user = null;
    return next();
  }

  jwt.verify(accessToken, process.env.JWT_SECRET, (err, user) => {
    req.user = err ? null : user;
    next();
  });
};
