const Address = require("../models/address");
const User = require("../models/User");

// Create a new address
exports.createAddress = async (req, res) => {
  try {
    const {
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;
    const userId = req.user._id;

    // If setting the address as default, mark all previous addresses as not default
    if (isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    // Create a new address document
    const address = new Address({
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault: isDefault || false,
      user: userId, // Ensure the address is associated with the user
    });

    // Save the address to the database
    const savedAddress = await address.save();

    // Update the user document to add the new address to the addresses array
    await User.findByIdAndUpdate(
      userId,
      { $push: { addresses: savedAddress._id } },
      { new: true } // To return the updated document
    );

    // Return the response
    return res
      .status(201)
      .json({ message: "Address created successfully.", data: savedAddress });
  } catch (error) {
    console.error("Error creating address:", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
};

// Get all addresses for a user
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user._id;

    const addresses = await Address.find({ user: userId });
    return res
      .status(200)
      .json({ message: "Addresses retrieved successfully.", data: addresses });
  } catch (error) {
    console.error("Error retrieving addresses:", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
};

// Get a single address by ID
exports.getAddressById = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findById(id);

    if (!address) {
      return res.status(404).json({ message: "Address not found." });
    }

    return res
      .status(200)
      .json({ message: "Address retrieved successfully.", data: address });
  } catch (error) {
    console.error("Error retrieving address:", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
};

// Update an address
exports.updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    if (updateData.isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: id, user: userId },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedAddress) {
      return res.status(404).json({
        message: "Address not found or you are not authorized to update it.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Address updated successfully.",
      data: updatedAddress,
    });
  } catch (error) {
    console.error("Error updating address:", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
};

// Delete an address
exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const deletedAddress = await Address.findOneAndDelete({
      _id: id,
      user: userId,
    });

    if (!deletedAddress) {
      return res.status(404).json({
        message: "Address not found or you are not authorized to delete it.",
      });
    }

    await User.updateOne({ _id: userId }, { $pull: { addresses: id } });

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully.",
      data: deletedAddress,
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
};
