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

exports.optionalAuth = async (req, res, next) => {
  const adminToken = req.cookies?.admin_accessToken;
  const clientToken = req.cookies?.client_accessToken;
  const legacyToken = req.cookies?.accessToken;

  // Determine if request is from admin dashboard
  // Check Referer, Origin, or custom header to identify admin requests
  const referer = req.headers.referer || req.headers.origin || "";
  const isAdminRequest =
    referer.includes("/admin") ||
    referer.includes("admin") ||
    req.headers["x-request-source"] === "admin" ||
    req.path.startsWith("/admin/");

  // Token selection logic:
  // 1. If both tokens exist: use admin token if request is from admin dashboard, otherwise client token
  // 2. If only one exists: use that one
  // 3. Fallback to legacy token
  let accessToken = null;
  let tokenType = null;

  if (adminToken && clientToken) {
    // Both exist - choose based on request context
    if (isAdminRequest) {
      accessToken = adminToken;
      tokenType = "admin";
    } else {
      accessToken = clientToken;
      tokenType = "client";
    }
  } else if (adminToken) {
    accessToken = adminToken;
    tokenType = "admin";
  } else if (clientToken) {
    accessToken = clientToken;
    tokenType = "client";
  } else if (legacyToken) {
    accessToken = legacyToken;
    tokenType = "client";
  }

  if (!accessToken) {
    req.user = null;
    return next();
  }

  jwt.verify(accessToken, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      req.user = null;
      return next();
    }

    // If it's an admin token, verify admin status
    if (tokenType === "admin") {
      try {
        const User = require("../models/User");
        const currentUser = await User.findById(user._id).select(
          "active role lastActiveRole isVerifiedSeller"
        );

        if (
          !currentUser ||
          !currentUser.active ||
          currentUser.role !== "Admin"
        ) {
          req.user = null;
          return next();
        }

        req.user = {
          ...user,
          role: currentUser.role,
          lastActiveRole: currentUser.lastActiveRole,
          isVerifiedSeller: currentUser.isVerifiedSeller,
        };
      } catch (error) {
        console.error("Error checking admin status in optionalAuth:", error);
        req.user = null;
      }
    } else if (tokenType === "client") {
      // If it's a client token, verify user status like verifyClientToken does
      try {
        const User = require("../models/User");
        const currentUser = await User.findById(user._id).select(
          "active role lastActiveRole isVerifiedSeller"
        );

        if (!currentUser || !currentUser.active) {
          req.user = null;
          return next();
        }

        req.user = {
          ...user,
          role: currentUser.role,
          lastActiveRole: currentUser.lastActiveRole,
          isVerifiedSeller: currentUser.isVerifiedSeller,
        };
      } catch (error) {
        console.error("Error checking user status in optionalAuth:", error);
        req.user = null;
      }
    } else {
      // Legacy token or unknown - set user as-is
      req.user = user;
    }

    next();
  });
};

/**
 * Verify either Admin or Client token
 * Used for endpoints that should be accessible by both admins and users
 * (e.g., order details that admin needs to view)
 */
exports.verifyAnyToken = async (req, res, next) => {
  const adminToken = req.cookies?.admin_accessToken;
  const clientToken = req.cookies?.client_accessToken;
  const legacyToken = req.cookies?.accessToken;

  // Try admin token first
  let accessToken = adminToken || clientToken || legacyToken;
  let tokenType = adminToken ? "admin" : "client";

  if (!accessToken) {
    return res.status(401).json({ error: "Authentication required" });
  }

  jwt.verify(accessToken, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired", reAuth: true });
      }
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const User = require("../models/User");
      const currentUser = await User.findById(user._id).select(
        "active role lastActiveRole isVerifiedSeller"
      );

      if (!currentUser || !currentUser.active) {
        return res.status(403).json({ error: "Account inactive or not found" });
      }

      req.user = {
        ...user,
        role: currentUser.role,
        lastActiveRole: currentUser.lastActiveRole,
        isVerifiedSeller: currentUser.isVerifiedSeller,
      };

      next();
    } catch (error) {
      console.error("Error in verifyAnyToken:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
};
