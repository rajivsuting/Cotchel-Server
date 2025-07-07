const SubCategory = require("../models/subCategory");
const Category = require("../models/category");
const Product = require("../models/product");

/**
 * Create a new SubCategory
 */
exports.createSubCategory = async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name || !category) {
      return res
        .status(400)
        .json({ message: "SubCategory name and category are required" });
    }

    // Validate that the category exists
    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      return res
        .status(404)
        .json({ message: "Category not found with the provided ID" });
    }

    // Create the new subcategory
    const subCategory = new SubCategory({ name, category });
    await subCategory.save();

    // Add the new subcategory to the category's subCategories array
    existingCategory.subCategories.push(subCategory._id);
    await existingCategory.save();

    return res.status(201).json({
      message: "SubCategory created successfully",
      data: subCategory,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "SubCategory name must be unique within the same category",
      });
    }
    return res
      .status(500)
      .json({ message: "Failed to create subcategory", error: error.message });
  }
};

/**
 * Get all SubCategories for a given Category
 */
exports.getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    // console.log(categoryId);

    const subCategories = await SubCategory.find({ category: categoryId });
    if (!subCategories.length) {
      return res
        .status(404)
        .json({ message: "No subcategories found for this category" });
    }
    // console.log(subCategories);
    return res.status(200).json({
      message: "SubCategories retrieved successfully",
      data: subCategories,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch subcategories", error: error.message });
  }
};

/**
 * Delete a SubCategory
 */
exports.deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const subCategory = await SubCategory.findById(id);
    if (!subCategory) {
      return res.status(404).json({ message: "SubCategory not found" });
    }

    await subCategory.remove();
    return res
      .status(200)
      .json({ message: "SubCategory deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to delete subcategory", error: error.message });
  }
};

exports.getSubcategories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = "createdAt",
      order = "asc",
      category, // Filter subcategories by category
    } = req.query;

    const filter = {};

    // Search filter (case-insensitive)
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // Filter by category (optional)
    if (category) {
      filter.category = category;
    }

    // Define valid sort fields
    const validSortFields = ["createdAt", "name"];
    const sortOrder = order === "desc" ? -1 : 1;
    const sortOptions = validSortFields.includes(sortBy)
      ? { [sortBy]: sortOrder }
      : { createdAt: sortOrder };

    // Pagination settings
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    // Fetch subcategories
    const subcategories = await SubCategory.find(filter)
      .populate("category", "name") // Populate category name
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize)
      .select("name category createdAt"); // Select required fields

    // Fetch product count for each subcategory
    const subcategoriesWithProductCount = await Promise.all(
      subcategories.map(async (subcategory) => {
        const productCount = await Product.countDocuments({
          subCategory: subcategory._id,
        });

        return {
          ...subcategory.toObject(),
          productCount,
        };
      })
    );

    // Get total subcategory count
    const totalSubcategories = await SubCategory.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: "Subcategories retrieved successfully",
      data: subcategoriesWithProductCount,
      pagination: {
        totalSubcategories,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalSubcategories / pageSize),
        pageSize,
      },
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving subcategories",
      error: error.message,
    });
  }
};

exports.getSubcategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the subcategory by ID and populate the category name
    const subcategory = await SubCategory.findById(id).populate(
      "category",
      "name"
    );

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    // Fetch products associated with the subcategory
    const products = await Product.find({ subCategory: id }).select(
      "title price createdAt"
    ); // Selecting relevant fields

    return res.status(200).json({
      success: true,
      message: "Subcategory retrieved successfully",
      data: {
        ...subcategory.toObject(),
        products,
      },
    });
  } catch (error) {
    console.error("Error fetching subcategory by ID:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving the subcategory",
      error: error.message,
    });
  }
};
