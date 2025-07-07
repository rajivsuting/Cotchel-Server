const Category = require("../models/category");
const SubCategory = require("../models/subCategory");
const Product = require("../models/product");

/**
 * Create a new Category
 */
exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const category = new Category({ name });
    await category.save();

    return res
      .status(201)
      .json({ message: "Category created successfully", data: category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Category name must be unique" });
    }
    return res
      .status(500)
      .json({ message: "Failed to create category", error: error.message });
  }
};

/**
 * Get all Categories
 */
exports.getCategories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = "createdAt",
      order = "asc",
      status,
      subCategories,
    } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (status) {
      filter.isActive = status.toLowerCase() === "active";
    }

    if (subCategories) {
      filter.subCategories = { $in: subCategories.split(",") };
    }

    const validSortFields = ["createdAt", "name"];
    const sortOrder = order === "desc" ? -1 : 1;
    const sortOptions = validSortFields.includes(sortBy)
      ? { [sortBy]: sortOrder }
      : { createdAt: sortOrder };

    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    // Fetch categories with populated subcategories
    const [categories, totalCategories] = await Promise.all([
      Category.find(filter)
        .populate({
          path: "subCategories",
          select: "name _id category createdAt",
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(pageSize)
        .lean(), // Use lean() for better performance
      Category.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
      pagination: {
        totalCategories,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCategories / pageSize),
        pageSize,
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving categories",
      error: error.message,
    });
  }
};

/**
 * Delete a Category and its SubCategories
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    await category.deleteWithSubCategories();
    return res
      .status(200)
      .json({ message: "Category and its subcategories deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to delete category", error: error.message });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find category by ID
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Count the number of products in this category
    const productCount = await Product.countDocuments({ category: id });

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully",
      data: {
        category,
        productCount,
      },
    });
  } catch (error) {
    console.error("Error fetching category by ID:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving the category",
      error: error.message,
    });
  }
};
