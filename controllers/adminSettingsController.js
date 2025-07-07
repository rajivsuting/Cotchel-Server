const PlatformSettings = require("../models/platformSettings");
const User = require("../models/User"); // adjust the path if needed
const bcrypt = require("bcryptjs");
// Get current platform settings
exports.getPlatformSettings = async (req, res) => {
  try {
    const settings = await PlatformSettings.findOne();
    res.status(200).json({
      message: "Platform settings retrieved successfully",
      data: settings || { platformFeePercentage: 10 }, // Default if no settings exist
    });
  } catch (error) {
    console.error("Error getting platform settings:", error);
    res.status(500).json({
      message: "Error retrieving platform settings",
      error: error.message,
    });
  }
};

// Update platform settings
exports.updatePlatformSettings = async (req, res) => {
  try {
    const { platformFeePercentage } = req.body;

    if (platformFeePercentage < 0 || platformFeePercentage > 100) {
      return res.status(400).json({
        message: "Platform fee percentage must be between 0 and 100",
      });
    }

    // Find and update the existing settings, or create if none exist
    const settings = await PlatformSettings.findOneAndUpdate(
      {}, // empty filter to match any document
      {
        platformFeePercentage,
        lastUpdatedBy: req.user._id,
      },
      {
        new: true, // return the updated document
        upsert: true, // create if doesn't exist
      }
    );

    res.status(200).json({
      message: "Platform settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating platform settings:", error);
    res.status(500).json({
      message: "Error updating platform settings",
      error: error.message,
    });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, gender } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "Admin with this email already exists.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const adminUser = new User({
      fullName,
      email,
      password: hashedPassword,
      phoneNumber,
      gender,
      role: "Admin",
      isEmailVerified: true, // assume already verified
      active: true,
    });

    await adminUser.save();

    return res.status(201).json({
      message: "Admin user created successfully.",
      data: {
        id: adminUser._id,
        fullName: adminUser.fullName,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    return res.status(500).json({
      message: "Internal server error while creating admin.",
    });
  }
};

exports.getAdmin = async (req, res) => {
  try {
    const admins = await User.find({ role: "Admin" });

    if (!admins.length) {
      return res.status(404).json({
        message: "No admin users found.",
      });
    }

    return res.status(200).json({
      message: "Admin users retrieved successfully.",
      data: admins.map(
        ({
          _id,
          fullName,
          email,
          phoneNumber,
          dateOfBirth,
          gender,
          createdAt,
        }) => ({
          id: _id,
          fullName,
          email,
          phoneNumber,
          dateOfBirth,
          gender,
          createdAt,
        })
      ),
    });
  } catch (error) {
    console.error("Error retrieving admin users:", error);
    return res.status(500).json({
      message: "Internal server error while retrieving admin users.",
    });
  }
};
