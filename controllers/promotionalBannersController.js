const PromotionalBanner = require("../models/promotionalBanners");

exports.createBanner = async (req, res) => {
  try {
    const banner = new PromotionalBanner(req.body);
    await banner.save();
    return res.status(201).json({
      message: "Banner created successfully",
      data: banner,
    });
  } catch (err) {
    console.error("Error creating banner:", err.message);
    return res.status(500).json({
      message: "Something went wrong while creating the banner.",
      error: err.message,
    });
  }
};

exports.getAllBanners = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const query = {};
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalBanners = await PromotionalBanner.countDocuments(query);

    const banners = await PromotionalBanner.find(query)
      .sort({ position: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      message: "Banners retrieved successfully",
      data: banners,
      pagination: {
        total: totalBanners,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalBanners / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching banners:", err.message);
    return res.status(500).json({
      message: "Failed to fetch banners.",
      error: err.message,
    });
  }
};

exports.getBannerById = async (req, res) => {
  try {
    const banner = await PromotionalBanner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({
        message: "Banner not found",
      });
    }
    return res.status(200).json({
      message: "Banner fetched successfully",
      data: banner,
    });
  } catch (err) {
    console.error("Error fetching banner by ID:", err.message);
    return res.status(500).json({
      message: "Failed to fetch banner by ID.",
      error: err.message,
    });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const updatedBanner = await PromotionalBanner.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedBanner) {
      return res.status(404).json({
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      message: "Banner updated successfully",
      data: updatedBanner,
    });
  } catch (err) {
    console.error("Error updating banner:", err.message);
    return res.status(500).json({
      message: "Failed to update banner.",
      error: err.message,
    });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const deletedBanner = await PromotionalBanner.findByIdAndDelete(
      req.params.id
    );
    if (!deletedBanner) {
      return res.status(404).json({
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      message: "Banner deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting banner:", err.message);
    return res.status(500).json({
      message: "Failed to delete banner.",
      error: err.message,
    });
  }
};
