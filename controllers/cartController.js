const Cart = require("../models/cartModel");
const Product = require("../models/product");

// Add item to cart
exports.addItemToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body; // quantity refers to number of lots

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: "Invalid product or quantity." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const userId = req.user;
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    let totalLotsInCart = quantity; // New quantity being added

    if (existingItemIndex > -1) {
      totalLotsInCart += cart.items[existingItemIndex].quantity; // Include existing lots in cart
    }

    const totalUnitsInCart = totalLotsInCart * product.lotSize; // Convert lots to actual quantity

    if (totalUnitsInCart > product.quantityAvailable) {
      return res.status(400).json({
        message: `Only ${Math.floor(
          product.quantityAvailable / product.lotSize
        )} lots available.`,
      });
    }

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      cart.items.push({
        productId,
        quantity, // Number of lots
        price: product.price, // Unit price
        lotSize: product.lotSize, // Store lot size
      });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Item added to cart successfully.",
      data: cart,
    });
  } catch (error) {
    return res.status(500).json({
      message: "An error occurred while adding the item to the cart.",
      error: error.message,
    });
  }
};

// Update cart item (e.g., change item quantity)
exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const { productId } = req.params;
    const userId = req.user._id || req.user;

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than zero.",
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found.",
      });
    }

    const item = cart.items.find(
      (item) => item.productId.toString() === productId
    );
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart.",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const totalUnitsRequested = quantity * product.lotSize;

    if (totalUnitsRequested > product.quantityAvailable) {
      return res.status(400).json({
        success: false,
        message: `Only ${Math.floor(
          product.quantityAvailable / product.lotSize
        )} lots available. You cannot add more.`,
      });
    }

    item.quantity = quantity;

    // Recalculate subtotal & total price
    cart.subtotal = cart.items.reduce(
      (acc, item) => acc + item.quantity * item.price,
      0
    );
    cart.totalPrice = cart.subtotal + cart.shippingFee - cart.discount;

    await cart.save();

    // Populate the updated cart with product details
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: "items.productId",
        select:
          "title images featuredImage price category subCategory lotSize quantityAvailable user sku length breadth weight height",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
        ],
      })
      .populate("user", "name email")
      .lean();

    res.status(200).json({
      success: true,
      message: "Cart item updated successfully.",
      data: updatedCart,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "An internal server error occurred.",
      error: error.message,
    });
  }
};

// Get cart details
exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id || req.user;

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.productId",
        select:
          "title images featuredImage price category subCategory lotSize quantityAvailable user sku length breadth weight height",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
        ],
      })
      .populate("user", "name email")
      .lean(); // Improves performance

    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    res.status(200).json({
      message: "Cart retrieved successfully.",
      data: cart,
    });
  } catch (error) {
    console.error("Error retrieving cart:", error);
    res.status(500).json({
      message: "An error occurred while retrieving the cart.",
      error: error.message,
    });
  }
};

// Remove item from cart
exports.removeItemFromCart = async (req, res) => {
  try {
    const userId = req.user._id || req.user;
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    // Remove item
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );

    // Update subtotal & total price
    cart.subtotal = cart.items.reduce(
      (acc, item) => acc + item.quantity * item.price,
      0
    );
    cart.totalPrice = cart.subtotal + cart.shippingFee - cart.discount;

    await cart.save();

    // Populate the updated cart with product details
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: "items.productId",
        select:
          "title images featuredImage price category subCategory lotSize user sku length breadth weight height",
        populate: [
          { path: "category", select: "name" },
          { path: "subCategory", select: "name" },
        ],
      })
      .populate("user", "name email")
      .lean();

    res.status(200).json({
      success: true,
      message: "Item removed from cart successfully.",
      data: updatedCart,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred.", error });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id || req.user;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    // Clear items and reset prices
    cart.items = [];
    cart.subtotal = 0;
    cart.totalPrice = 0;
    cart.shippingFee = 0;
    cart.discount = 0;

    await cart.save();

    res.status(200).json({
      message: "Cart cleared successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred.", error });
  }
};

// Apply coupon to cart
exports.applyCoupon = async (req, res) => {
  try {
    const { userId, couponCode, discount } = req.body;

    if (!couponCode || discount <= 0) {
      return res.status(400).json({ message: "Invalid coupon details." });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    cart.totalPrice = cart.subtotal - discount;
    if (cart.totalPrice < 0) cart.totalPrice = 0;

    await cart.save();

    res.status(200).json({
      message: "Coupon applied successfully.",
      data: cart,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred.", error });
  }
};

exports.getCartItemCount = async (req, res) => {
  try {
    const userId = req.user; // Extract user ID from the request (e.g., via authentication middleware)

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required to fetch cart item count.",
      });
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty.",
        data: { itemCount: 0 },
      });
    }

    const itemCount = cart.items.reduce(
      (total, item) => total + item.quantity,
      0
    );
    console.log(itemCount, itemCount);

    return res.status(200).json({
      success: true,
      message: "Cart item count fetched successfully.",
      data: { itemCount },
    });
  } catch (error) {
    console.error("Error fetching cart item count:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching the cart item count.",
      error: error.message,
    });
  }
};
