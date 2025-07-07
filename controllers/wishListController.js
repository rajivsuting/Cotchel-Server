const Wishlist = require("../models/wishList");
const Product = require("../models/product");

const checkProductExists = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error("Product not found");
  }
};

exports.addToWishlist = async (req, res) => {
  const { productId } = req.body;
  const { _id: userId } = req.user;

  try {
    await checkProductExists(productId);

    let wishlist = await Wishlist.findOne({ userId });

    if (wishlist) {
      const productExists = wishlist.products.some(
        (item) => item.productId.toString() === productId
      );

      if (productExists) {
        return res.status(400).json({ message: "Product already in wishlist" });
      }

      wishlist.products.push({ productId });
      await wishlist.save();
    } else {
      wishlist = new Wishlist({
        userId,
        products: [{ productId }],
      });
      await wishlist.save();
    }

    res.status(200).json({ message: "Product added to wishlist", wishlist });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

// Remove Product from Wishlist
exports.removeFromWishlist = async (req, res) => {
  const { productId } = req.body;
  const { _id: userId } = req.user;

  try {
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    wishlist.products = wishlist.products.filter(
      (item) => item.productId.toString() !== productId
    );

    if (wishlist.products.length === 0) {
      await Wishlist.deleteOne({ userId });
      return res.status(200).json({ message: "Wishlist is empty now" });
    }

    await wishlist.save();
    res
      .status(200)
      .json({ message: "Product removed from wishlist", wishlist });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

exports.getUserWishlist = async (req, res) => {
  const { _id: userId } = req.user;

  try {
    const wishlist = await Wishlist.findOne({ userId }).populate(
      "products.productId",
      "title price compareAtPrice lotSize images featuredImage"
    );

    if (!wishlist) {
      return res.status(200).json({ wishlist: [] });
    }

    res.status(200).json({ wishlist: wishlist.products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};
