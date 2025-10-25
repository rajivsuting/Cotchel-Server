const Product = require("../models/product");
const { createProductSchema } = require("../validation/productValidation");
const { ValidationError, DatabaseError } = require("../utils/errors");
const mongoose = require("mongoose");
const Wishlist = require("../models/wishList");
const User = require("../models/User");
const Category = require("../models/category");
const SubCategory = require("../models/subCategory");
const NotificationService = require("../services/notificationService");
const Order = require("../models/order");

function generateSKU(name, model, brand, category) {
  const brandCode = brand.slice(0, 3).toUpperCase();
  const nameCode = name.slice(0, 3).toUpperCase();
  const modelCode = model.replace(/\s+/g, "").toUpperCase();
  const randomNum = Math.floor(1000 + Math.random() * 9000);

  return `${brandCode}-${nameCode}-${modelCode}-${randomNum}`;
}
exports.createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      images,
      files,
      category,
      subCategory,
      quantityAvailable,
      price,
      compareAtPrice,
      keyHighLights,
      featuredImage,
      brand,
      model,
      lotSize,
      length,
      breadth,
      height,
      weight,
    } = req.body;

    // Debug logging for files
    console.log("=== CREATE PRODUCT DEBUG ===");
    console.log("Files received:", files);
    console.log("Files type:", typeof files);
    console.log(
      "Files length:",
      Array.isArray(files) ? files.length : "Not an array"
    );
    console.log("Files content:", files);
    console.log("=== END DEBUG ===");

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    if (
      !title?.trim() ||
      !category ||
      !subCategory ||
      !quantityAvailable ||
      !price ||
      !brand?.trim() ||
      !model?.trim() ||
      !featuredImage?.trim()
    ) {
      console.log("Missing fields:", {
        title,
        category,
        subCategory,
        quantityAvailable,
        price,
        brand,
        model,
        featuredImage,
      });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Convert string values to numbers
    const parsedQuantity = Number(quantityAvailable);
    const parsedPrice = Number(price);
    const parsedCompareAtPrice = compareAtPrice
      ? Number(compareAtPrice)
      : undefined;
    const parsedLotSize = lotSize ? Number(lotSize) : undefined;
    const parsedLength = Number(length);
    const parsedBreadth = Number(breadth);
    const parsedHeight = Number(height);
    const parsedWeight = Number(weight);

    if (
      isNaN(parsedQuantity) ||
      isNaN(parsedPrice) ||
      isNaN(parsedLength) ||
      isNaN(parsedBreadth) ||
      isNaN(parsedHeight) ||
      isNaN(parsedWeight)
    ) {
      return res.status(400).json({ message: "Invalid number values" });
    }

    if (parsedLotSize > parsedQuantity) {
      return res.status(400).json({
        message: "Lot size must be lower or equal to total quantity",
      });
    }

    const sku = generateSKU(title, model, brand, category);

    // Ensure files is an array and filter out any empty values
    const fileAttachments = Array.isArray(files)
      ? files.filter(
          (file) => file && (typeof file === "string" ? file.trim() : true)
        )
      : [];

    console.log("=== PROCESSED FILES ===");
    console.log("Original files:", files);
    console.log("Processed fileAttachments:", fileAttachments);
    console.log("=== END PROCESSED FILES ===");

    const newProduct = new Product({
      title,
      description,
      images,
      fileAttachments: fileAttachments,
      category,
      subCategory,
      quantityAvailable: parsedQuantity,
      price: parsedPrice,
      compareAtPrice: parsedCompareAtPrice,
      keyHighLights,
      brand,
      model,
      featuredImage,
      lotSize: parsedLotSize,
      length: parsedLength,
      breadth: parsedBreadth,
      height: parsedHeight,
      weight: parsedWeight,
      sku,
      user: req.user._id,
    });

    await newProduct.save();

    console.log("=== SAVED PRODUCT ===");
    console.log("Product ID:", newProduct._id);
    console.log("File Attachments saved:", newProduct.fileAttachments);
    console.log("=== END SAVED PRODUCT ===");

    res
      .status(201)
      .json({ message: "Product created successfully", product: newProduct });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllProducts = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    subCategories,
    sortBy = "createdAt",
    order = "desc",
    search,
    ratings,
    lotSizeMin,
    lotSizeMax,
    minPrice,
    maxPrice,
    brands,
    status, // Add status to the query parameters
    lotSize, // Add lotSize as a possible range string (e.g., 10-20, 30+)
  } = req.query;

  const user = req.user || {};
  const { role, _id: userId } = user;
  console.log(req.query);

  try {
    const filter = {};

    if (category) filter.category = category;
    if (subCategories) {
      filter.subCategory = { $in: subCategories.split(",") };
    }
    if (brands) {
      filter.brand = { $in: brands.split(",") };
    }

    let userIds = [];

    if (search) {
      const matchingUsers = await User.find(
        {
          fullName: { $regex: search, $options: "i" },
          isVerifiedSeller: true,
        },
        { _id: 1 }
      );

      userIds = matchingUsers.map((user) => user._id);

      const matchingCategories = await Category.find(
        { name: { $regex: search, $options: "i" } },
        { _id: 1 }
      );

      const matchingSubCategories = await SubCategory.find(
        { name: { $regex: search, $options: "i" } },
        { _id: 1 }
      );

      const categoryIds = matchingCategories.map((cat) => cat._id);
      const subCategoryIds = matchingSubCategories.map((sub) => sub._id);

      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { category: { $in: categoryIds } },
        { subCategory: { $in: subCategoryIds } },
        { user: { $in: userIds } },
      ];
    }

    // Ratings: use $gte for 'X★ & up'
    if (ratings) {
      const ratingValue = Number(ratings);
      if (!isNaN(ratingValue)) {
        filter.ratings = { $gte: ratingValue };
      }
    }

    // Lot size: use lotSizeMin/lotSizeMax if present, otherwise parse lotSize as a range string
    if (lotSizeMin || lotSizeMax) {
      filter.lotSize = {};
      if (lotSizeMin) {
        const minValue = Number(lotSizeMin);
        if (!isNaN(minValue)) {
          filter.lotSize.$gte = minValue;
        }
      }
      if (lotSizeMax) {
        const maxValue = Number(lotSizeMax);
        if (!isNaN(maxValue)) {
          filter.lotSize.$lte = maxValue;
        }
      }
    } else if (lotSize) {
      if (typeof lotSize === "string") {
        if (lotSize.endsWith("+")) {
          const min = Number(lotSize.replace("+", ""));
          if (!isNaN(min)) {
            filter.lotSize = { $gte: min };
          }
        } else if (lotSize.includes("-")) {
          const [min, max] = lotSize.split("-").map(Number);
          if (!isNaN(min) && !isNaN(max)) {
            filter.lotSize = { $gte: min, $lte: max };
          }
        } else {
          const exactValue = Number(lotSize);
          if (!isNaN(exactValue)) {
            filter.lotSize = exactValue;
          }
        }
      }
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Add status filter logic
    if (status) {
      if (status === "Active") {
        filter.quantityAvailable = { $gt: 50 };
      } else if (status === "Low Stock") {
        filter.quantityAvailable = { $gt: 0, $lte: 50 };
      } else if (status === "Out of Stock") {
        filter.quantityAvailable = 0;
      }
    }

    // Apply role-based filters last to avoid conflicts
    if (role === "Buyer") {
      filter.quantityAvailable = { $gt: 0 };
      filter.isActive = true; // Only show active products to buyers
    } else if (role === "Seller") {
      filter.user = userId;
    }

    const validSortFields = ["createdAt", "price", "ratings", "lotSize"];
    const defaultSort = order === "desc" ? -1 : 1;
    const sortOptions = validSortFields.includes(sortBy)
      ? { [sortBy]: order === "desc" ? -1 : 1 }
      : { createdAt: defaultSort };

    const parsedLimit = isNaN(parseInt(limit, 10)) ? 10 : parseInt(limit, 10);
    const parsedPage = isNaN(parseInt(page, 10)) ? 1 : parseInt(page, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parsedLimit)
        .populate("category")
        .populate("subCategory")
        .populate("brand")
        .populate({
          path: "user",
          select: "fullName sellerDetails",
          populate: {
            path: "sellerDetails",
            select: "businessName",
          },
        })
        .lean(),
      Product.countDocuments(filter),
    ]);

    let productsWithWishlistStatus = products;

    if (userId) {
      const wishlist = await Wishlist.findOne({ userId }).select(
        "products.productId"
      );
      if (wishlist) {
        const wishlistProductIds = new Set(
          wishlist.products.map((item) => item.productId.toString())
        );
        productsWithWishlistStatus = products.map((product) => ({
          ...product,
          isWishlisted: wishlistProductIds.has(product._id.toString()),
        }));
      }
    }

    res.status(200).json({
      success: true,
      totalProducts: total,
      totalPages: total > 0 ? Math.ceil(total / parsedLimit) : 1,
      currentPage: parsedPage,
      products: productsWithWishlistStatus,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("user")
      .populate({
        path: "reviews",
        populate: { path: "user", select: "fullName" },
      })
      .populate("subCategory", "name");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if product is active for buyers
    const user = req.user || {};
    if (user.role === "Buyer" && !product.isActive) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if seller is trying to access someone else's deactivated product
    if (
      user.role === "Seller" &&
      !product.isActive &&
      product.user._id.toString() !== user._id?.toString()
    ) {
      return res.status(404).json({ message: "Product not found" });
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isActive: true, // Only show active related products
    })
      .limit(5)
      .populate("category", "name");

    // Debug logging for product data
    console.log("=== PRODUCT DATA DEBUG ===");
    console.log("Product ID:", product._id);
    console.log("Product ratings:", product.ratings);
    console.log("Product reviewsCount:", product.reviewsCount);
    console.log("Reviews array length:", product.reviews?.length || 0);

    if (product.reviews && product.reviews.length > 0) {
      console.log("Reviews in product:");
      product.reviews.forEach((review, index) => {
        console.log(`Review ${index + 1}:`, {
          id: review._id,
          rating: review.rating,
          ratingType: typeof review.rating,
          user: review.user?.fullName || review.user?._id,
        });
      });
    }
    console.log("=== END PRODUCT DATA DEBUG ===");

    res.status(200).json({
      message: "Product retrieved successfully",
      product,
      relatedProducts,
    });
  } catch (error) {
    next(error);
  }
};

exports.searchProduct = async (req, res) => {
  const searchQuery = req.query.query;

  if (!searchQuery) {
    return res.status(400).json({
      message: "Query parameter is required.",
    });
  }

  try {
    // Find users with matching fullName first
    const matchingUsers = await User.find(
      { fullName: { $regex: searchQuery, $options: "i" } },
      { _id: 1 }
    );

    const userIds = matchingUsers.map((user) => user._id);

    // Search products including user matches
    const products = await Product.find({
      $or: [
        { title: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } },
        { brand: { $regex: searchQuery, $options: "i" } },
        { model: { $regex: searchQuery, $options: "i" } },
        { user: { $in: userIds } },
      ],
      isActive: true,
    })
      .populate({
        path: "user",
        select: "fullName",
      })
      .limit(10)
      .select("title price images featuredImage category sku user");

    res.status(200).json({
      message: "Search results fetched successfully.",
      data: products,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error. Please try again later.",
    });
  }
};

exports.searchSuggestions = async (req, res) => {
  const searchQuery = req.query.query;

  if (!searchQuery) {
    return res.status(400).json({
      message: "Query parameter is required.",
    });
  }

  if (mongoose.Types.ObjectId.isValid(searchQuery)) {
    return res.status(400).json({
      message: "Search query cannot be a valid ObjectId.",
    });
  }

  try {
    // Find users with matching fullName first
    const matchingUsers = await User.find(
      { fullName: { $regex: searchQuery, $options: "i" } },
      { _id: 1, fullName: 1 }
    );

    const userIds = matchingUsers.map((user) => user._id);

    // Search products with more comprehensive matching
    let suggestions = await Product.find(
      {
        $or: [
          { title: { $regex: searchQuery, $options: "i" } },
          { brand: { $regex: searchQuery, $options: "i" } },
          { model: { $regex: searchQuery, $options: "i" } },
          { description: { $regex: searchQuery, $options: "i" } },
          { user: { $in: userIds } },
        ],
        isActive: true,
        quantityAvailable: { $gt: 0 }, // Only show products in stock
      },
      {
        title: 1,
        brand: 1,
        model: 1,
        user: 1,
        price: 1,
        featuredImage: 1,
        ratings: 1,
        category: 1,
        subCategory: 1,
      }
    )
      .populate({
        path: "user",
        select: "fullName",
      })
      .populate("category", "name")
      .populate("subCategory", "name")
      .sort({
        // Priority: exact matches first, then popularity, then price
        $expr: {
          $cond: {
            if: { $eq: [{ $toLower: "$title" }, searchQuery.toLowerCase()] },
            then: 1,
            else: {
              $cond: {
                if: {
                  $eq: [{ $toLower: "$brand" }, searchQuery.toLowerCase()],
                },
                then: 2,
                else: 3,
              },
            },
          },
        },
        ratings: -1,
        price: 1,
      })
      .limit(8);

    // Create structured suggestions with relevance scoring
    const structuredSuggestions = [];
    const seenSuggestions = new Set();

    // Add product-based suggestions
    suggestions.forEach((product) => {
      // Title suggestions
      if (
        new RegExp(searchQuery, "i").test(product.title) &&
        !seenSuggestions.has(product.title)
      ) {
        seenSuggestions.add(product.title);
        structuredSuggestions.push({
          type: "product",
          text: product.title,
          relevance: product.title
            .toLowerCase()
            .startsWith(searchQuery.toLowerCase())
            ? 1
            : 2,
          product: {
            id: product._id,
            title: product.title,
            price: product.price,
            image: product.featuredImage,
            brand: product.brand,
            ratings: product.ratings || 0,
          },
        });
      }

      // Brand suggestions
      if (
        new RegExp(searchQuery, "i").test(product.brand) &&
        !seenSuggestions.has(product.brand)
      ) {
        seenSuggestions.add(product.brand);
        structuredSuggestions.push({
          type: "brand",
          text: product.brand,
          relevance: product.brand
            .toLowerCase()
            .startsWith(searchQuery.toLowerCase())
            ? 1
            : 2,
        });
      }

      // Model suggestions
      if (
        new RegExp(searchQuery, "i").test(product.model) &&
        !seenSuggestions.has(product.model)
      ) {
        seenSuggestions.add(product.model);
        structuredSuggestions.push({
          type: "model",
          text: product.model,
          relevance: product.model
            .toLowerCase()
            .startsWith(searchQuery.toLowerCase())
            ? 1
            : 2,
        });
      }
    });

    // Add seller suggestions
    matchingUsers.forEach((user) => {
      if (!seenSuggestions.has(user.fullName)) {
        seenSuggestions.add(user.fullName);
        structuredSuggestions.push({
          type: "seller",
          text: user.fullName,
          relevance: 3,
        });
      }
    });

    // Sort by relevance and limit to top 10
    const sortedSuggestions = structuredSuggestions
      .sort((a, b) => a.relevance - b.relevance)
      .slice(0, 10)
      .map((suggestion) => suggestion.text);

    res.status(200).json({
      message: "Search suggestions fetched successfully.",
      data: sortedSuggestions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error. Please try again later.",
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if the logged-in user is authorized to delete the product
    if (product.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this product" });
    }

    await Product.findByIdAndDelete(productId);

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.editProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const productData = req.body;

    console.log("Product Data:", productData);

    // Get the current product state
    const currentProduct = await Product.findById(productId);
    if (!currentProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Convert prices to numbers if they exist
    if (productData.compareAtPrice)
      productData.compareAtPrice = Number(productData.compareAtPrice);
    if (productData.price) productData.price = Number(productData.price);

    // Convert numeric fields to numbers if they exist
    if (productData.quantityAvailable !== undefined)
      productData.quantityAvailable = Number(productData.quantityAvailable);
    if (productData.lotSize !== undefined)
      productData.lotSize = Number(productData.lotSize);
    if (productData.length !== undefined)
      productData.length = Number(productData.length);
    if (productData.breadth !== undefined)
      productData.breadth = Number(productData.breadth);
    if (productData.height !== undefined)
      productData.height = Number(productData.height);
    if (productData.weight !== undefined)
      productData.weight = Number(productData.weight);

    console.log(
      "CompareAtPrice:",
      productData.compareAtPrice,
      "Price:",
      productData.price
    );

    // Validate compareAtPrice
    if (
      typeof productData.compareAtPrice === "number" &&
      typeof productData.price === "number" &&
      productData.compareAtPrice < productData.price
    ) {
      return res.status(400).json({
        message: "Compare at price must be greater than or equal to the price.",
      });
    }

    // Ensure SKU is unique if being updated
    if (productData.sku) {
      const existingProduct = await Product.findOne({
        sku: productData.sku,
        _id: { $ne: productId },
      });
      if (existingProduct) {
        return res.status(400).json({ message: "SKU already exists." });
      }
    }

    // Validate isActive field if provided
    if (
      productData.hasOwnProperty("isActive") &&
      typeof productData.isActive !== "boolean"
    ) {
      return res.status(400).json({
        message: "isActive must be a boolean value.",
      });
    }

    // Validate image and highlights limits
    if (Array.isArray(productData.images) && productData.images.length > 10) {
      return res.status(400).json({ message: "Maximum 10 images allowed." });
    }
    if (
      Array.isArray(productData.keyHighLights) &&
      productData.keyHighLights.length > 10
    ) {
      return res
        .status(400)
        .json({ message: "Maximum 10 highlights allowed." });
    }

    // Ensure `fileAttachments` is set if `files` is provided
    if (productData.files) {
      if (!Array.isArray(productData.files)) {
        return res.status(400).json({
          message: "Invalid fileAttachments format. Expected an array.",
        });
      }
      productData.fileAttachments = productData.files; // Rename files -> fileAttachments
      delete productData.files; // Remove unnecessary key
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: productData },
      { new: true }
    );

    // Check if quantity was updated and is different from current
    if (
      productData.quantityAvailable !== undefined &&
      productData.quantityAvailable !== currentProduct.quantityAvailable
    ) {
      // Check stock status and send notifications if needed
      await NotificationService.checkStockStatus(updatedProduct);
    }

    // Log isActive status changes
    if (
      productData.hasOwnProperty("isActive") &&
      productData.isActive !== currentProduct.isActive
    ) {
      console.log(`Product ${productId} isActive status changed:`, {
        from: currentProduct.isActive,
        to: productData.isActive,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error.message,
    });
  }
};

// Debug endpoint to check product data
exports.debugProducts = async (req, res) => {
  try {
    const products = await Product.find({})
      .select("title ratings lotSize quantityAvailable price")
      .limit(10)
      .lean();

    const stats = {
      totalProducts: await Product.countDocuments({}),
      productsWithRatings: await Product.countDocuments({
        ratings: { $gt: 0 },
      }),
      productsWithZeroRatings: await Product.countDocuments({ ratings: 0 }),
      productsWithoutRatings: await Product.countDocuments({
        ratings: { $exists: false },
      }),
      avgLotSize: await Product.aggregate([
        { $group: { _id: null, avgLotSize: { $avg: "$lotSize" } } },
      ]),
      lotSizeRange: await Product.aggregate([
        {
          $group: {
            _id: null,
            minLotSize: { $min: "$lotSize" },
            maxLotSize: { $max: "$lotSize" },
          },
        },
      ]),
      sampleProducts: products,
    };

    res.status(200).json({
      message: "Product debug data",
      data: stats,
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.enhancedSearchSuggestions = async (req, res) => {
  const searchQuery = req.query.query;

  if (!searchQuery) {
    return res.status(400).json({
      message: "Query parameter is required.",
    });
  }

  if (mongoose.Types.ObjectId.isValid(searchQuery)) {
    return res.status(400).json({
      message: "Search query cannot be a valid ObjectId.",
    });
  }

  try {
    // Normalize search query - remove extra spaces and convert to lowercase
    const normalizedQuery = searchQuery.trim().toLowerCase();

    // Create multiple search patterns for flexible matching
    const searchPatterns = [
      // Original query
      normalizedQuery,
      // Query with spaces removed (for "iphone" matching "I phone")
      normalizedQuery.replace(/\s+/g, ""),
      // Query with spaces added between characters (for "iphone" matching "i phone")
      normalizedQuery.split("").join(" "),
      // Individual words from query
      ...normalizedQuery.split(/\s+/),
    ];

    // Create regex patterns for flexible matching
    const regexPatterns = searchPatterns.map(
      (pattern) =>
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    );

    // Find users with matching fullName
    const matchingUsers = await User.find(
      {
        fullName: {
          $regex: normalizedQuery,
          $options: "i",
        },
      },
      { _id: 1, fullName: 1 }
    );

    const userIds = matchingUsers.map((user) => user._id);

    // Enhanced product search with multiple matching strategies
    let products = await Product.find(
      {
        $or: [
          // Title matching with multiple patterns
          { title: { $regex: normalizedQuery, $options: "i" } },
          {
            title: {
              $regex: normalizedQuery.replace(/\s+/g, ""),
              $options: "i",
            },
          },
          {
            title: {
              $regex: normalizedQuery.split("").join("\\s*"),
              $options: "i",
            },
          },
          // Brand matching with multiple patterns
          { brand: { $regex: normalizedQuery, $options: "i" } },
          {
            brand: {
              $regex: normalizedQuery.replace(/\s+/g, ""),
              $options: "i",
            },
          },
          // Model matching with multiple patterns
          { model: { $regex: normalizedQuery, $options: "i" } },
          {
            model: {
              $regex: normalizedQuery.replace(/\s+/g, ""),
              $options: "i",
            },
          },
          // Description matching
          { description: { $regex: normalizedQuery, $options: "i" } },
          // Seller matching
          { user: { $in: userIds } },
        ],
        isActive: true,
        quantityAvailable: { $gt: 0 },
      },
      {
        title: 1,
        brand: 1,
        model: 1,
        user: 1,
        price: 1,
        featuredImage: 1,
        ratings: 1,
        category: 1,
        subCategory: 1,
        compareAtPrice: 1,
      }
    )
      .populate({
        path: "user",
        select: "fullName",
      })
      .populate("category", "name")
      .populate("subCategory", "name")
      .sort({
        ratings: -1,
        price: 1,
      })
      .limit(10);

    // Create structured response with enhanced relevance scoring
    const response = {
      products: products.map((product) => ({
        id: product._id,
        title: product.title,
        brand: product.brand,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        image: product.featuredImage,
        ratings: product.ratings || 0,
        seller:
          product.user?.sellerDetails?.businessName ||
          product.user?.fullName ||
          "Unknown Seller",
      })),
      suggestions: [],
    };

    // Enhanced suggestion extraction with relevance scoring
    const suggestionMap = new Map();

    products.forEach((product) => {
      // Score each field based on match quality
      const scoreTitle = getMatchScore(
        product.title,
        normalizedQuery,
        searchPatterns
      );
      const scoreBrand = getMatchScore(
        product.brand,
        normalizedQuery,
        searchPatterns
      );
      const scoreModel = getMatchScore(
        product.model,
        normalizedQuery,
        searchPatterns
      );

      // Add title suggestions
      if (scoreTitle > 0 && !suggestionMap.has(product.title)) {
        suggestionMap.set(product.title, {
          text: product.title,
          score: scoreTitle,
          type: "title",
        });
      }

      // Add brand suggestions
      if (scoreBrand > 0 && !suggestionMap.has(product.brand)) {
        suggestionMap.set(product.brand, {
          text: product.brand,
          score: scoreBrand,
          type: "brand",
        });
      }

      // Add model suggestions
      if (scoreModel > 0 && !suggestionMap.has(product.model)) {
        suggestionMap.set(product.model, {
          text: product.model,
          score: scoreModel,
          type: "model",
        });
      }
    });

    // Add seller suggestions
    matchingUsers.forEach((user) => {
      if (!suggestionMap.has(user.fullName)) {
        suggestionMap.set(user.fullName, {
          text: user.fullName,
          score: 1,
          type: "seller",
        });
      }
    });

    // Sort suggestions by score and extract text
    response.suggestions = Array.from(suggestionMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.text);

    res.status(200).json({
      message: "Enhanced search suggestions fetched successfully.",
      data: response,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error. Please try again later.",
    });
  }
};

// Helper function to calculate match score
function getMatchScore(text, query, patterns) {
  if (!text) return 0;

  const normalizedText = text.toLowerCase();
  let score = 0;

  // Exact match gets highest score
  if (normalizedText === query) {
    score += 10;
  }

  // Starts with query gets high score
  if (normalizedText.startsWith(query)) {
    score += 8;
  }

  // Contains query gets medium score
  if (normalizedText.includes(query)) {
    score += 6;
  }

  // Check against all patterns
  patterns.forEach((pattern) => {
    if (normalizedText.includes(pattern.toLowerCase())) {
      score += 4;
    }
  });

  // Check for word boundaries
  const words = normalizedText.split(/\s+/);
  const queryWords = query.split(/\s+/);

  queryWords.forEach((queryWord) => {
    if (words.some((word) => word.startsWith(queryWord))) {
      score += 3;
    }
  });

  return score;
}

exports.getTopSellingProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = "sold",
      order = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build aggregation pipeline
    const pipeline = [
      // Lookup orders to get sales data
      {
        $lookup: {
          from: "orders",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$status", "Cancelled"] },
                    { $eq: ["$paymentStatus", "Paid"] },
                    {
                      $in: [
                        "$$productId",
                        {
                          $map: {
                            input: "$products",
                            as: "product",
                            in: "$$product.product",
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "orders",
        },
      },
      // Add sales calculations
      {
        $addFields: {
          sold: {
            $sum: {
              $map: {
                input: "$orders",
                as: "order",
                in: {
                  $sum: {
                    $map: {
                      input: "$$order.products",
                      as: "product",
                      in: {
                        $cond: [
                          { $eq: ["$$product.product", "$_id"] },
                          "$$product.quantity",
                          0,
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          revenue: {
            $sum: {
              $map: {
                input: "$orders",
                as: "order",
                in: {
                  $sum: {
                    $map: {
                      input: "$$order.products",
                      as: "product",
                      in: {
                        $cond: [
                          { $eq: ["$$product.product", "$_id"] },
                          {
                            $multiply: [
                              "$$product.quantity",
                              "$$product.price",
                            ],
                          },
                          0,
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          orders: { $size: "$orders" },
          lastSold: {
            $max: {
              $map: {
                input: "$orders",
                as: "order",
                in: "$$order.createdAt",
              },
            },
          },
        },
      },
      // Filter out products with no sales if needed
      {
        $match: {
          sold: { $gt: 0 },
        },
      },
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { brand: { $regex: search, $options: "i" } },
            { model: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Add sorting
    const sortField =
      sortBy === "sold"
        ? "sold"
        : sortBy === "revenue"
        ? "revenue"
        : sortBy === "price"
        ? "price"
        : "sold";
    const sortOrder = order === "asc" ? 1 : -1;

    pipeline.push({ $sort: { [sortField]: sortOrder } });

    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    // Lookup category and user data
    pipeline.push(
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $addFields: {
          category: { $arrayElemAt: ["$category", 0] },
          user: { $arrayElemAt: ["$user", 0] },
        },
      }
    );

    // Execute aggregation
    const products = await Product.aggregate(pipeline);

    // Get total count for pagination
    const countPipeline = [...pipeline];
    countPipeline.splice(-5, 5); // Remove pagination and lookup stages
    countPipeline.push({ $count: "total" });

    const totalResult = await Product.aggregate(countPipeline);
    const totalProducts = totalResult[0]?.total || 0;

    // Calculate stats
    const statsPipeline = [
      {
        $lookup: {
          from: "orders",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$status", "Cancelled"] },
                    { $eq: ["$paymentStatus", "Paid"] },
                    {
                      $in: [
                        "$$productId",
                        {
                          $map: {
                            input: "$products",
                            as: "product",
                            in: "$$product.product",
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "orders",
        },
      },
      {
        $addFields: {
          sold: {
            $sum: {
              $map: {
                input: "$orders",
                as: "order",
                in: {
                  $sum: {
                    $map: {
                      input: "$$order.products",
                      as: "product",
                      in: {
                        $cond: [
                          { $eq: ["$$product.product", "$_id"] },
                          "$$product.quantity",
                          0,
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          revenue: {
            $sum: {
              $map: {
                input: "$orders",
                as: "order",
                in: {
                  $sum: {
                    $map: {
                      input: "$$order.products",
                      as: "product",
                      in: {
                        $cond: [
                          { $eq: ["$$product.product", "$_id"] },
                          {
                            $multiply: [
                              "$$product.quantity",
                              "$$product.price",
                            ],
                          },
                          0,
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $match: {
          sold: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$revenue" },
          totalUnitsSold: { $sum: "$sold" },
          averageOrderValue: { $avg: "$revenue" },
          topPerformer: {
            $first: {
              $cond: [
                { $eq: ["$sold", { $max: "$sold" }] },
                { name: "$title", sold: "$sold", revenue: "$revenue" },
                null,
              ],
            },
          },
        },
      },
    ];

    const statsResult = await Product.aggregate(statsPipeline);
    const stats = statsResult[0] || {
      totalRevenue: 0,
      totalUnitsSold: 0,
      averageOrderValue: 0,
      topPerformer: null,
    };

    res.status(200).json({
      success: true,
      products,
      totalProducts,
      totalPages: Math.ceil(totalProducts / parseInt(limit)),
      currentPage: parseInt(page),
      stats,
    });
  } catch (error) {
    console.error("Error fetching top selling products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top selling products",
      error: error.message,
    });
  }
};
