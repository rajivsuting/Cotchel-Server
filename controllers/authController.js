// controllers/userController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createTokens } = require("../utils/jwtUtils");
const User = require("../models/User");
const Notification = require("../models/notification");
const { emitNotification } = require("../sockets/notificationSocket");
const geoip = require("geoip-lite");
const parser = require("user-agent-parser");
const LoginDetails = require("../models/LoginDetails");
const sendEmail = require("../utils/sendEmail");
const {
  getPasswordResetTemplate,
  getEmailVerificationTemplate,
} = require("../utils/emailTemplates");
const crypto = require("crypto");
const SellerDetails = require("../models/sellerDetails");
const Address = require("../models/address");
const Product = require("../models/product");
const Order = require("../models/order");
const Review = require("../models/reviewSchema");
const Wishlist = require("../models/wishList");
const Inquiry = require("../models/inquiry");
const { oauth2client } = require("../utils/googleConfig");
const mongoose = require("mongoose");
const axios = require("axios");
const { registerPickupLocation } = require("../services/shiprocketService");
const { authenticateShiprocket } = require("../services/shiprocketService");
const NotificationService = require("../services/notificationService");

const isProduction = process.env.NODE_ENV === "production";

exports.register = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = crypto.randomInt(100000, 999999).toString();

    const newUser = await User.create({
      email,
      password: hashedPassword,
      emailVerificationCode: verificationCode,
    });

    try {
      // Prepare email data
      const emailData = {
        userName: "New User", // We don't have fullName yet during registration
        verificationCode: verificationCode,
        expiryTime: "10 minutes",
      };

      // Generate professional email templates
      const { html, text } = getEmailVerificationTemplate(emailData);

      // Send professional email verification
      await sendEmail(
        email,
        "Verify Your Cotchel Account - Complete Your Registration",
        { html, text }
      );

      console.log(`✅ Email verification sent successfully to: ${email}`);
      res.status(200).json({
        message: "Verification code sent to email.",
        userId: newUser._id,
      });
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError);

      // Still allow registration to succeed, but inform user
      res.status(200).json({
        message:
          "User registered successfully, but email verification failed. Please contact support.",
        userId: newUser._id,
        emailError: true,
        verificationCode: verificationCode, // Temporary - remove in production
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error registering user." });
  }
};

exports.resendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const newVerificationCode = crypto.randomInt(100000, 999999).toString();
    user.emailVerificationCode = newVerificationCode;
    await user.save();

    // Prepare email data
    const emailData = {
      userName: user.fullName || "Valued Customer",
      verificationCode: newVerificationCode,
      expiryTime: "10 minutes",
    };

    // Generate professional email templates
    const { html, text } = getEmailVerificationTemplate(emailData);

    // Send professional email verification
    await sendEmail(email, "New Verification Code - Cotchel Account", {
      html,
      text,
    });

    res.status(200).json({ message: "Verification code resent to email." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error resending verification code." });
  }
};

exports.requestResetLink = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.tokenExpiry = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    const url = isProduction ? process.env.PRO_URL : process.env.DEV_URL;
    const resetLink = `${url}/reset-password?token=${resetToken}`;

    // Prepare email data
    const emailData = {
      userName: user.fullName || "Valued Customer",
      resetLink: resetLink,
      expiryTime: "1 hour",
    };

    // Generate professional email templates
    const { html, text } = getPasswordResetTemplate(emailData);

    // Send professional password reset email
    try {
      await sendEmail(
        email,
        "Reset Your Cotchel Password - Secure Your Account",
        { html, text }
      );
      console.log(`✅ Password reset email sent successfully to: ${email}`);
    } catch (emailError) {
      console.warn(
        "⚠️ Email service not configured, but reset token generated:",
        emailError.message
      );
      console.log(`🔗 Reset link for development: ${resetLink}`);
    }

    res.json({
      message: "Password reset link sent!",
      resetLink: process.env.NODE_ENV === "development" ? resetLink : undefined,
    });
  } catch (error) {
    console.error("❌ Error sending password reset email:", error);
    res.status(500).json({
      message: "Failed to send password reset email. Please try again later.",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Invalid request." });
    }

    // Find user by reset token
    const user = await User.findOne({ resetToken: token });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    // Check if the token is expired
    if (user.tokenExpiry < Date.now()) {
      return res.status(400).json({ message: "Token has expired." });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    // Clear the reset token and expiry date
    user.resetToken = undefined;
    user.tokenExpiry = undefined;

    await user.save();

    return res.json({ message: "Password reset successful." });
  } catch (err) {
    console.error("Reset Password Error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

exports.verifyEmail = async (req, res) => {
  const { userId, code } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (user.isEmailVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Email already verified." });
    }

    if (user.emailVerificationCode !== code) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid verification code." });
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationCodeExpiry = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error verifying email." });
  }
};
exports.updateDetails = async (req, res) => {
  const { userId, fullName, phoneNumber, dateOfBirth, gender } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.isEmailVerified) {
      return res
        .status(400)
        .json({ message: "Please verify your email first." });
    }

    if (fullName) user.fullName = fullName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (gender) user.gender = gender;

    await user.save();

    const { accessToken, refreshToken } = createTokens(user);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("client_accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.cookie("client_refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.status(200).json({
      success: true,
      message: "Details added successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating details." });
  }
};

// Client login function
exports.loginClient = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Check if user account is deactivated
    if (!user.active) {
      return res.status(403).json({
        error: "Account deactivated",
        message:
          "Your account has been deactivated by an administrator. Please contact support for assistance.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ error: "Password is not set for this user." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const ipAddress =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const deviceInfo = parser(userAgent);
    const location = geoip.lookup(ipAddress) || {};

    await LoginDetails.create({
      user: user._id,
      ip: ipAddress,
      device: deviceInfo.browser?.name || "Unknown Device",
      location: {
        city: location.city || "Unknown City",
        region: location.region || "Unknown Region",
        country: location.country || "Unknown Country",
      },
    });

    const { accessToken, refreshToken } = createTokens(user);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("client_accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.cookie("client_refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.status(200).json({
      message: "User logged in successfully.",
      user: user,
      token: accessToken,
    });
  } catch (error) {
    console.error("Client Login Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Admin login function
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Check if user account is deactivated
    if (!user.active) {
      return res.status(403).json({
        error: "Account deactivated",
        message:
          "Your admin account has been deactivated. Please contact the system administrator for assistance.",
        code: "ADMIN_ACCOUNT_DEACTIVATED",
      });
    }

    // Check if user has admin role
    if (user.role !== "Admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ error: "Password is not set for this user." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const ipAddress =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const deviceInfo = parser(userAgent);
    const location = geoip.lookup(ipAddress) || {};

    await LoginDetails.create({
      user: user._id,
      ip: ipAddress,
      device: deviceInfo.browser?.name || "Unknown Device",
      location: {
        city: location.city || "Unknown City",
        region: location.region || "Unknown Region",
        country: location.country || "Unknown Country",
      },
    });

    const { accessToken, refreshToken } = createTokens(user);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("admin_accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.cookie("admin_refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.status(200).json({
      message: "Admin logged in successfully.",
      user: user,
      token: accessToken,
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Keep original loginUser for backward compatibility (will be removed later)
exports.loginUser = exports.loginClient;

exports.addSellerDetails = async (req, res) => {
  const {
    businessName,
    gstin,
    pan,
    addressLine1,
    addressLine2,
    postalCode,
    state,
    city,
    bankName,
    accountName,
    accountNumber,
    ifscCode,
    branch,
  } = req.body;

  const { _id } = req.user;

  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.isEmailVerified) {
      return res
        .status(400)
        .json({ message: "Please verify your email first." });
    }

    // Check if user already has seller details and is not rejected
    if (user.sellerDetails && user.sellerDetailsStatus !== "rejected") {
      return res.status(400).json({ message: "Seller details already added." });
    }

    let sellerDetails;

    // Check if user is reapplying after rejection
    if (user.sellerDetails && user.sellerDetailsStatus === "rejected") {
      // Update existing seller details
      sellerDetails = await SellerDetails.findByIdAndUpdate(
        user.sellerDetails,
        {
          businessName,
          gstin,
          pan,
          bankName,
          accountName,
          accountNumber,
          ifscCode,
          branch,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          country: "India",
        },
        { new: true }
      );
    } else {
      // Create new seller details for first-time applicants
      sellerDetails = await SellerDetails.create({
        businessName,
        gstin,
        pan,
        bankName,
        accountName,
        accountNumber,
        ifscCode,
        branch,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country: "India",
      });

      // Link seller details to user for new applicants
      user.sellerDetails = sellerDetails._id;
    }

    // Update user status
    user.isVerifiedSeller = false;
    user.sellerDetailsStatus = "pending"; // Reset status to pending for reapplication
    const updatedUser = await user.save();

    // Populate the seller details for the response
    await updatedUser.populate("sellerDetails");

    try {
      const pickupData = {
        pickup_location: `Pickup_${user._id}`, // Ensure uniqueness
        name: user.fullName || "Seller",
        email: user.email,
        phone: user.phoneNumber, // Ensure this field is collected
        address: addressLine1,
        address_2: addressLine2 || "",
        city,
        state,
        country: "India",
        pin_code: postalCode,
      };

      const shiprocketToken = await authenticateShiprocket(); // You get this from their Auth API
      const shiprocketResponse = await registerPickupLocation(
        shiprocketToken,
        pickupData
      );
      const { accessToken, refreshToken } = createTokens(user);

      const isProduction = process.env.NODE_ENV === "production";

      res.cookie("client_accessToken", accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
        maxAge: 3600000 * 24 * 7,
      });

      res.cookie("client_refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
        maxAge: 3600000 * 24 * 7,
      });

      console.log("Shiprocket Pickup Added:", shiprocketResponse);
    } catch (err) {
      console.warn("Shiprocket pickup location failed:", err.message);
    }

    // Notify admins of pending seller approval
    await NotificationService.notifyVerificationStatus(user._id, "pending");
    const { emitNotification } = require("../sockets/notificationSocket");
    emitNotification(req.io, "accountVerification", {
      sellerId: user._id,
      status: "pending",
    });

    res.status(200).json({
      success: true,
      message: "Seller details added successfully.",
      user: updatedUser,
      data: {
        sellerDetails,
        updatedUser,
      },
    });
  } catch (error) {
    console.error("Error adding seller details:", error);
    res.status(500).json({
      message: "Error adding seller details.",
      error: error.message,
    });
  }
};

// Client get profile function
exports.getClientProfile = async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await User.findById(_id)
      .populate({
        path: "addresses",
        select:
          "name phone addressLine1 addressLine2 city state postalCode country isDefault",
      })
      .populate({
        path: "sellerDetails",
        select:
          "businessName gstin pan bankName accountName accountNumber ifscCode branch addressLine1 addressLine2 city state postalCode country",
      });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const userProfile = {
      email: user.email,
      role: user.role,
      fullName: user.fullName || "",
      phoneNumber: user.phoneNumber || "",
      dateOfBirth: user.dateOfBirth || "",
      gender: user.gender || "",
      isEmailVerified: user.isEmailVerified,
      addresses: user.addresses || [],
      sellerDetails: user.sellerDetails || null,
      isVerifiedSeller: user.isVerifiedSeller || false,
      sellerDetailsStatus: user.sellerDetailsStatus || "pending",
    };

    res.status(200).json({
      success: true,
      message: "Client profile retrieved successfully.",
      data: userProfile,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error retrieving client profile." });
  }
};

// Admin get profile function
exports.getAdminProfile = async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await User.findById(_id)
      .populate({
        path: "addresses",
        select:
          "name phone addressLine1 addressLine2 city state postalCode country isDefault",
      })
      .populate({
        path: "sellerDetails",
        select:
          "businessName gstin pan bankName accountName accountNumber ifscCode branch addressLine1 addressLine2 city state postalCode country",
      });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Admin user not found." });
    }

    // Additional check for admin role
    if (user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin role required.",
      });
    }

    const userProfile = {
      email: user.email,
      role: user.role,
      fullName: user.fullName || "",
      phoneNumber: user.phoneNumber || "",
      dateOfBirth: user.dateOfBirth || "",
      gender: user.gender || "",
      isEmailVerified: user.isEmailVerified,
      addresses: user.addresses || [],
      sellerDetails: user.sellerDetails || null,
      isVerifiedSeller: user.isVerifiedSeller || false,
    };

    res.status(200).json({
      success: true,
      message: "Admin profile retrieved successfully.",
      data: userProfile,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error retrieving admin profile." });
  }
};

// Keep original getUserProfile for backward compatibility (will be removed later)
exports.getUserProfile = exports.getClientProfile;

// Client refresh token function
exports.refreshClientToken = (req, res) => {
  const { client_refreshToken } = req.cookies;
  if (!client_refreshToken) {
    return res.status(403).json({ error: "Client refresh token missing" });
  }

  jwt.verify(client_refreshToken, process.env.REFRESH_SECRET, (err, user) => {
    if (err) {
      res.clearCookie("client_accessToken");
      res.clearCookie("client_refreshToken");
      return res.status(403).json({
        error: "Invalid or expired client refresh token, please log in again",
      });
    }

    const { accessToken, refreshToken: newRefreshToken } = createTokens(user);
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("client_accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.cookie("client_refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });
    res.status(200).json({ message: "Client token refreshed" });
  });
};

// Admin refresh token function
exports.refreshAdminToken = (req, res) => {
  const { admin_refreshToken } = req.cookies;
  if (!admin_refreshToken) {
    return res.status(403).json({ error: "Admin refresh token missing" });
  }

  jwt.verify(admin_refreshToken, process.env.REFRESH_SECRET, (err, user) => {
    if (err) {
      res.clearCookie("admin_accessToken");
      res.clearCookie("admin_refreshToken");
      return res.status(403).json({
        error: "Invalid or expired admin refresh token, please log in again",
      });
    }

    // Additional check for admin role
    if (user.role !== "Admin") {
      res.clearCookie("admin_accessToken");
      res.clearCookie("admin_refreshToken");
      return res.status(403).json({
        error: "Access denied. Admin role required.",
      });
    }

    const { accessToken, refreshToken: newRefreshToken } = createTokens(user);
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("admin_accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.cookie("admin_refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });
    res.status(200).json({ message: "Admin token refreshed" });
  });
};

// Keep original refreshToken for backward compatibility (will be removed later)
exports.refreshToken = exports.refreshClientToken;

exports.editUser = async (req, res) => {
  try {
    const { _id: userId } = req.user;
    const { ...userUpdates } = req.body;

    // Fetch the user document
    const user = await User.findById(userId);
    const role = user.role;

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
        data: null,
      });
    }

    // Handle Address Updates
    // if (address && typeof address === "object") {
    //   if (!user.addresses || user.addresses.length === 0) {
    //     return res.status(404).json({
    //       message: "No associated addresses found for the user.",
    //       data: null,
    //     });
    //   }

    //   // Assuming the first address is being updated
    //   const addressId = user.addresses[0];

    //   const updatedAddress = await Address.findByIdAndUpdate(
    //     addressId,
    //     { $set: address },
    //     { new: true, runValidators: true }
    //   );

    //   if (!updatedAddress) {
    //     return res.status(404).json({
    //       message: "Address not found.",
    //       data: null,
    //     });
    //   }

    //   return res.status(200).json({
    //     message: "Address updated successfully.",
    //     data: updatedAddress,
    //   });
    // }

    // Handle SellerDetails Updates
    // if (sellerDetails && typeof sellerDetails === "object") {
    //   if (!user.sellerDetails) {
    //     return res.status(404).json({
    //       message: "No associated seller details found for the user.",
    //       data: null,
    //     });
    //   }

    //   const updatedSellerDetails = await SellerDetails.findByIdAndUpdate(
    //     user.sellerDetails,
    //     { $set: sellerDetails },
    //     { new: true, runValidators: true }
    //   );

    //   if (!updatedSellerDetails) {
    //     return res.status(404).json({
    //       message: "Seller details not found.",
    //       data: null,
    //     });
    //   }

    //   return res.status(200).json({
    //     message: "Seller details updated successfully.",
    //     data: updatedSellerDetails,
    //   });
    // }

    // Handle User Updates
    if (Object.keys(userUpdates).length > 0) {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: userUpdates },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        return res.status(404).json({
          message: "User not found.",
          data: null,
        });
      }
      const { accessToken, refreshToken } = createTokens(updatedUser);

      const isProduction = process.env.NODE_ENV === "production";

      res.cookie("client_accessToken", accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
        maxAge: 3600000 * 24 * 7,
      });

      res.cookie("client_refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
        maxAge: 3600000 * 24 * 7,
      });

      const user = await User.findById(userId)
        .populate({
          path: "addresses",
          select:
            "name phone addressLine1 addressLine2 city state postalCode country isDefault",
        })
        .populate({
          path: "sellerDetails",
          select:
            "businessName gstin pan bankName accountName accountNumber ifscCode branch addressLine1 addressLine2 city state postalCode country",
        });

      return res.status(200).json({
        success: true,
        message: "User updated successfully.",
        data: user,
      });
    }

    res.status(400).json({
      message: "No valid updates provided.",
      data: null,
    });
  } catch (error) {
    console.error("Error updating user or related fields:", error);
    res.status(500).json({
      message: "An error occurred while updating the user or related fields.",
      data: null,
      error: error.message,
    });
  }
};
exports.logoutUser = (req, res) => {
  console.log("Logout");

  const isProduction = process.env.NODE_ENV === "production";

  // Clear legacy cookies
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
  });

  // Clear client cookies
  res.clearCookie("client_accessToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
  });

  res.clearCookie("client_refreshToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
  });

  // Clear admin cookies
  res.clearCookie("admin_accessToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
  });

  res.clearCookie("admin_refreshToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
  });

  res.status(200).json({ message: "User logged out successfully" });
};

exports.continueWithGoogle = async (req, res) => {
  try {
    const { code } = req.query;
    // const { role } = req.body;
    const googleRes = await oauth2client.getToken(code);
    oauth2client.setCredentials(googleRes.tokens);

    const userRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`
    );

    const { email, name, gender, birthday } = userRes.data;

    let user = await User.findOne({ email: email });

    if (!user) {
      user = await User.create({
        email,
        fullName: name,
        gender: gender,
        dateOfBirth: birthday,
        isEmailVerified: true,
      });
    }
    const { _id } = user;
    const { accessToken, refreshToken } = createTokens(user);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("client_accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.cookie("client_refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    let savedUser = await User.findOne({ email: email });

    res.status(200).json({
      success: true,
      message: "Success",
      user: savedUser,
      data: { role: user.role },
    });
  } catch (error) {
    console.error("Error during Google OAuth2 login:", error);
    res.status(500).json({
      message: "An error occurred during Google OAuth2 login.",
      data: null,
      error: error.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    let { page, limit, role, isEmailVerified, search, sort } = req.query;

    // Default values
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    // Filters - exclude admin users from the list
    let filter = {
      role: { $ne: "Admin" },
    };

    // If a specific role is requested, override the default filter
    if (role) {
      filter.role = role;
    }

    if (isEmailVerified !== undefined)
      filter.isEmailVerified = isEmailVerified === "true";

    // Search by name or email
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Sorting (default: newest first)
    let sortOptions = { createdAt: sort === "asc" ? 1 : -1 };

    // Fetch users with pagination
    const users = await User.find(filter)
      .populate("addresses sellerDetails")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalUsers = await User.countDocuments(filter);

    return res.status(200).json({
      message: "Users fetched successfully.",
      data: {
        users,
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      message: "An error occurred while fetching users.",
      error: error.message,
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID format.",
        statusCode: 400,
      });
    }

    const user = await User.findById(id)
      .populate("addresses sellerDetails")
      .select("-password") // Exclude sensitive data
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
        statusCode: 404,
      });
    }

    return res.status(200).json({
      message: "User fetched successfully.",
      statusCode: 200,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return res.status(500).json({
      message: "An internal server error occurred.",
      statusCode: 500,
      error: error.message,
    });
  }
};

/**
 * Update a user by ID (Admin only)
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if user is admin
    if (!req.user || req.user.role !== "Admin") {
      return res.status(403).json({
        message: "Access denied. Admin role required.",
        statusCode: 403,
      });
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID format.",
        statusCode: 400,
      });
    }

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password;
    delete updateData.emailVerificationCode;
    delete updateData.resetPasswordToken;
    delete updateData.resetPasswordExpires;

    // Validate active field if provided
    if (
      updateData.hasOwnProperty("active") &&
      typeof updateData.active !== "boolean"
    ) {
      return res.status(400).json({
        message: "active must be a boolean value.",
        statusCode: 400,
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("addresses sellerDetails")
      .select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
        statusCode: 404,
      });
    }

    // Log admin action
    console.log(`Admin ${req.user._id} updated user ${id}:`, {
      updatedFields: Object.keys(updateData),
      active: updateData.active,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      message: "User updated successfully.",
      statusCode: 200,
      data: user,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      message: "An internal server error occurred.",
      statusCode: 500,
      error: error.message,
    });
  }
};

/**
 * Delete a user by ID (Admin only)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID format.",
        statusCode: 400,
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: "User not found.",
        statusCode: 404,
      });
    }

    // Delete related data
    await Promise.all([
      User.findByIdAndDelete(id),
      // Delete user's addresses
      Address.deleteMany({ user: id }),
      // Delete user's seller details
      SellerDetails.deleteMany({ user: id }),
      // Soft delete user's products - make them inactive instead of deleting
      Product.updateMany(
        { user: id },
        {
          isActive: false,
          sellerDeleted: true,
          deletedAt: new Date(),
          deletedBy: req.user._id, // Track which admin deleted the seller
        }
      ),
      // Delete user's orders (as buyer)
      Order.deleteMany({ buyer: id }),
      // Delete user's orders (as seller)
      Order.deleteMany({ seller: id }),
      // Delete user's reviews
      Review.deleteMany({ user: id }),
      // Delete user's wishlist
      Wishlist.deleteMany({ userId: id }),
      // Delete user's inquiries
      Inquiry.deleteMany({ user: id }),
    ]);

    return res.status(200).json({
      message: "User deleted successfully.",
      statusCode: 200,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      message: "An internal server error occurred.",
      statusCode: 500,
      error: error.message,
    });
  }
};

exports.getPendingSellers = async (req, res) => {
  try {
    const users = await User.find({
      sellerDetails: { $exists: true, $ne: null }, // Has sellerDetails
      isVerifiedSeller: false, // Not yet verified
      $or: [
        { sellerDetailsStatus: { $exists: false } }, // No status set (legacy)
        { sellerDetailsStatus: "pending" }, // Explicitly pending
      ],
    }).populate("sellerDetails");
    res.status(200).json({ data: { users } });
  } catch (error) {
    res.status(500).json({ message: "Error fetching pending sellers", error });
  }
};

// Approve seller
exports.approveSeller = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isVerifiedSeller: true,
        lastActiveRole: "Seller", // Set active role to Seller for dashboard access
        sellerDetailsStatus: "approved", // Set status to approved
      },
      { new: true }
    ).populate("sellerDetails");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Optionally emit a notification to admins about the approval
    await NotificationService.notifyVerificationStatus(user._id, "approved");
    const { emitNotification } = require("../sockets/notificationSocket");
    emitNotification(req.io, "accountVerification", {
      sellerId: user._id,
      status: "approved",
    });

    res.status(200).json({ message: "Seller approved", data: user });
  } catch (error) {
    res.status(500).json({ message: "Error approving seller", error });
  }
};

// Update existing approved sellers' lastActiveRole to Seller (one-time fix)
exports.updateApprovedSellersRole = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "Admin") {
      return res.status(403).json({
        message: "Access denied. Admin role required.",
        statusCode: 403,
      });
    }

    const result = await User.updateMany(
      {
        isVerifiedSeller: true,
        lastActiveRole: "Buyer", // Only update those who are still set to Buyer
      },
      {
        lastActiveRole: "Seller",
      }
    );

    res.status(200).json({
      message: `Updated ${result.modifiedCount} approved sellers' lastActiveRole to Seller`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating approved sellers role:", error);
    res.status(500).json({
      message: "Error updating approved sellers role",
      error: error.message,
    });
  }
};

// Reject seller
exports.rejectSeller = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isVerifiedSeller: false, // Explicitly set to false
        // Keep sellerDetails but mark as rejected
        sellerDetailsStatus: "rejected", // Add status tracking
      },
      { new: true }
    ).populate("sellerDetails");

    if (!user) return res.status(404).json({ message: "User not found" });

    // Notify admins of seller rejection
    await NotificationService.notifyVerificationStatus(user._id, "rejected");

    // Emit notification to user about rejection
    const { emitNotification } = require("../sockets/notificationSocket");
    emitNotification(req.io, "accountVerification", {
      sellerId: user._id,
      status: "rejected",
    });

    res.status(200).json({ message: "Seller rejected", data: user });
  } catch (error) {
    res.status(500).json({ message: "Error rejecting seller", error });
  }
};

// Get all notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ timestamp: -1 });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications", error });
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!notification)
      return res.status(404).json({ message: "Notification not found" });
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Error updating notification", error });
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { read: false },
      { read: true }
    );

    res.status(200).json({
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating notifications", error });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id || id.length !== 24) {
      return res.status(400).json({
        message: "Invalid user ID provided.",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // If already deactivated
    if (!user.active) {
      return res.status(400).json({
        message: "User is already deactivated.",
      });
    }

    // Optional: Add logic to allow only self or admin to deactivate
    // e.g., if (req.user.role !== "Admin" && req.user.id !== id) return ...

    user.active = false;
    await user.save();

    return res.status(200).json({
      message: "User deactivated successfully.",
    });
  } catch (error) {
    console.error("Error deactivating user:", error);
    return res.status(500).json({
      message: "Something went wrong while deactivating the user.",
    });
  }
};

exports.updateLastActiveRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate role
    if (!["Buyer", "Seller"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Check if user is allowed to switch to seller role
    if (role === "Seller" && !user.isVerifiedSeller) {
      return res
        .status(403)
        .json({ error: "User is not verified as a seller" });
    }

    // Update lastActiveRole, but preserve Admin role if user is an Admin
    // Admins can switch between Buyer/Seller views without losing their Admin role
    if (user.role === "Admin") {
      user.lastActiveRole = role;
    } else {
      // For non-Admin users, update both role and lastActiveRole
      user.role = role;
      user.lastActiveRole = role;
    }
    await user.save();

    // Create new tokens with updated role
    const { accessToken, refreshToken } = createTokens(user);

    const isProduction = process.env.NODE_ENV === "production";

    // Set new cookies with client-specific names
    res.cookie("client_accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.cookie("client_refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 3600000 * 24 * 7,
    });

    res.json({
      success: true,
      data: {
        role: user.role,
        lastActiveRole: user.lastActiveRole,
      },
    });
  } catch (error) {
    console.error("Error updating last active role:", error);
    res.status(500).json({ error: "Error updating role" });
  }
};

exports.updateSellerDetails = async (req, res) => {
  try {
    const { _id: userId } = req.user;
    const sellerDetailsUpdates = req.body;

    // Fetch the user document
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.sellerDetails) {
      return res.status(404).json({
        success: false,
        message: "No seller details found for this user.",
      });
    }

    // Update seller details
    const updatedSellerDetails = await SellerDetails.findByIdAndUpdate(
      user.sellerDetails,
      { $set: sellerDetailsUpdates },
      { new: true, runValidators: true }
    );

    if (!updatedSellerDetails) {
      return res.status(404).json({
        success: false,
        message: "Seller details not found.",
      });
    }

    // Refetch user with updated seller details
    const updatedUser = await User.findById(userId)
      .populate({
        path: "addresses",
        select:
          "name phone addressLine1 addressLine2 city state postalCode country isDefault",
      })
      .populate({
        path: "sellerDetails",
        select:
          "businessName gstin pan bankName accountName accountNumber ifscCode branch addressLine1 addressLine2 city state postalCode country",
      });

    return res.status(200).json({
      success: true,
      message: "Seller details updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating seller details:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating seller details.",
      error: error.message,
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { _id: userId } = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    // Fetch the user document
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    user.password = hashedNewPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while changing password.",
      error: error.message,
    });
  }
};

// Test endpoint for password reset email (development only)
exports.testPasswordResetEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    console.log("=== Testing Password Reset Email ===");
    console.log("Email:", email);

    // Create a test reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const url = isProduction ? process.env.PRO_URL : process.env.DEV_URL;
    const resetLink = `${url}/reset-password?token=${resetToken}`;

    // Prepare email data
    const emailData = {
      userName: "Test User",
      resetLink: resetLink,
      expiryTime: "1 hour",
    };

    // Generate professional email templates
    const { html, text } = getPasswordResetTemplate(emailData);

    // Send test password reset email
    await sendEmail(
      email,
      "Test - Reset Your Cotchel Password - Secure Your Account",
      { html, text }
    );

    res.status(200).json({
      message: "Password reset email test completed",
      email: email,
      resetLink: resetLink,
    });
  } catch (error) {
    console.error("Error in test password reset email:", error);
    res.status(500).json({
      message: "Error testing password reset email",
      error: error.message,
    });
  }
};
