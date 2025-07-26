const Order = require("../models/order");
const Cart = require("../models/cartModel");
const Product = require("../models/product");
const Razorpay = require("razorpay");
const paymentService = require("../services/paymentService");
const crypto = require("crypto");
const User = require("../models/User");
const axios = require("axios");
const Address = require("../models/address");
const mongoose = require("mongoose");
const Review = require("../models/reviewSchema"); // Import the Review model
const { OrderError, PaymentError } = require("../utils/errors");
const { authenticateShiprocket } = require("../services/shiprocketService");
const Transaction = require("../models/transaction");
const PlatformSettings = require("../models/platformSettings");
const NotificationService = require("../services/notificationService");

const SHIPROCKET_API_URL = "https://apiv2.shiprocket.in/v1/external";

async function createShiprocketShipment(order) {
  try {
    console.log("=== Starting Shiprocket Shipment Creation ===");
    console.log("Order ID:", order._id);

    // Get authentication token
    console.log("Attempting to authenticate with Shiprocket...");
    const token = await authenticateShiprocket();
    console.log("✅ Shiprocket authentication successful, token received");

    // Get buyer details
    console.log("Fetching buyer details...");
    const buyer = await User.findById(order.buyer).select("email name");
    if (!buyer?.email) {
      console.error("❌ Buyer email missing for order:", order._id);
      throw new Error("Buyer email is required for shipment");
    }
    console.log("✅ Buyer details retrieved:", {
      email: buyer.email,
      name: buyer.name,
    });

    // Get seller details with populated sellerDetails
    console.log("Fetching seller details...");
    const seller = await User.findById(order.seller)
      .select("name email phone sellerDetails")
      .populate("sellerDetails");

    if (!seller) {
      console.error("❌ Seller not found for order:", order._id);
      throw new Error("Seller not found");
    }

    if (!seller.sellerDetails) {
      console.error(
        "❌ Seller business details missing for seller:",
        seller._id
      );
      throw new Error("Seller business details not found");
    }
    console.log("✅ Seller details retrieved:", {
      email: seller.email,
      name: seller.name,
      businessName: seller.sellerDetails?.businessName,
    });

    // Get first product for dimensions
    console.log("Fetching product details...");
    const firstProduct = await Product.findById(order.products[0].product);
    if (!firstProduct) {
      console.error("❌ Product not found for order:", order._id);
      throw new Error("Product not found");
    }
    console.log("✅ Product details retrieved:", {
      title: firstProduct.title,
      dimensions: {
        length: firstProduct.length,
        breadth: firstProduct.breadth,
        height: firstProduct.height,
        weight: firstProduct.weight,
      },
    });

    // First, get available pickup locations
    console.log("Fetching pickup locations from Shiprocket...");
    const pickupLocationsResponse = await axios.get(
      `${SHIPROCKET_API_URL}/settings/company/pickup`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Pickup Locations Response:",
      JSON.stringify(pickupLocationsResponse.data, null, 2)
    );

    if (!pickupLocationsResponse.data?.data?.shipping_address?.length) {
      console.error("❌ No pickup locations found in Shiprocket");
      throw new Error("No pickup locations found in Shiprocket");
    }

    // Use the first shipping address as pickup location
    const shippingAddress =
      pickupLocationsResponse.data.data.shipping_address[0];
    const pickupLocation = `${shippingAddress.address}, ${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.pincode}`;
    console.log("✅ Selected Pickup Location:", pickupLocation);

    const shipmentData = {
      order_id: order._id.toString(),
      order_date: new Date(order.createdAt)
        .toISOString()
        .substring(0, 19)
        .replace("T", " "),
      pickup_location: pickupLocation,
      billing_customer_name: order.address.name,
      billing_last_name: "",
      billing_address: order.address.street,
      billing_city: order.address.city,
      billing_pincode: order.address.pincode,
      billing_state: order.address.state,
      billing_country: order.address.country || "India",
      billing_email: buyer.email,
      billing_phone: order.address.phone,
      shipping_is_billing: true,
      order_items: await Promise.all(
        order.products.map(async (item) => {
          const product = await Product.findById(item.product);
          return {
            name: product.title,
            sku: product.sku || "SKU001",
            units: item.quantity,
            selling_price: item.price,
            hsn: 8471,
          };
        })
      ),
      payment_method: "Prepaid",
      sub_total: order.totalPrice,
      length: firstProduct.length || 10,
      breadth: firstProduct.breadth || 10,
      height: firstProduct.height || 10,
      weight: firstProduct.weight || 0.5,
    };

    console.log(
      "Preparing to create Shiprocket order with data:",
      JSON.stringify(shipmentData, null, 2)
    );

    console.log("Making API call to create Shiprocket order...");
    const response = await axios.post(
      `${SHIPROCKET_API_URL}/orders/create/adhoc`,
      shipmentData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Shiprocket API Response:",
      JSON.stringify(response.data, null, 2)
    );

    if (!response.data || !response.data.shipment_id) {
      console.error("❌ Invalid response from Shiprocket API:", response.data);
      throw new Error("Invalid response from Shiprocket API");
    }

    // Update order with Shiprocket details
    console.log("Updating order with Shiprocket details...");
    order.shipmentId = response.data.shipment_id;
    order.shiprocketOrderId = response.data.order_id;
    await order.save();
    console.log("✅ Order updated with Shiprocket details:", {
      shipmentId: order.shipmentId,
      shiprocketOrderId: order.shiprocketOrderId,
    });

    console.log("=== Shiprocket Shipment Creation Completed Successfully ===");
    return response.data;
  } catch (error) {
    console.error("=== Shiprocket Shipment Creation Failed ===");
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      orderId: order._id,
    });
    throw new Error(
      `Error creating Shiprocket shipment: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

// Helper function to update order status
async function updateOrderStatus(orderId, status, note) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  order.status = status;
  order.statusHistory.push({
    status,
    note,
  });
  await order.save();

  // Create notification for status change
  await NotificationService.createNotification({
    type: "order_status_update",
    sellerId: order.seller,
    orderId: order._id,
    message: `Order #${order._id} status updated to ${status}`,
  });

  return order;
}

// Helper function to reserve stock
async function reserveStock(items, session) {
  for (const item of items) {
    const product = await Product.findById(item.productId).populate("user");
    if (!product) {
      throw new OrderError("Product not found", 404, {
        productId: item.productId,
      });
    }
    if (product.quantityAvailable < item.quantity * item.lotSize) {
      throw new OrderError(`Insufficient stock for ${product.title}`, 400, {
        productId: product._id,
        available: product.quantityAvailable,
        requested: item.quantity * item.lotSize,
      });
    }
    console.log(
      `Current stock for ${product.title}: ${product.quantityAvailable}`
    );
    product.quantityAvailable -= item.quantity * item.lotSize;
    await product.save({ session });
    console.log(
      `Updated stock for ${product.title}: ${product.quantityAvailable}`
    );

    // Check stock status and send notifications if needed
    console.log(`Checking stock status for ${product.title}...`);
    try {
      // Ensure product has user field populated
      if (!product.user) {
        console.error(`Product ${product._id} has no user field`);
        continue;
      }
      console.log(`Product user ID: ${product.user._id}`);
      await NotificationService.checkStockStatus(product);
      console.log(`Stock status check completed for ${product.title}`);
    } catch (error) {
      console.error(`Error checking stock status for ${product.title}:`, error);
    }
  }
}

// Helper function to create seller order
async function createSellerOrder(
  sellerId,
  items,
  buyer,
  address,
  razorpayOrder,
  session,
  cartId
) {
  try {
    const order = new Order({
      products: items.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        lotSize: item.productId.lotSize,
        price: item.productId.price,
        totalPrice:
          item.quantity * item.productId.lotSize * item.productId.price,
      })),
      buyer: buyer._id,
      seller: sellerId,
      cartId: cartId, // Add cartId to track which cart this order came from
      totalPrice: items.reduce(
        (sum, item) =>
          sum + item.quantity * item.productId.lotSize * item.productId.price,
        0
      ),
      status: "Pending",
      paymentStatus: "Pending",
      paymentTransactionId: razorpayOrder.id,
      address: {
        street: `${address.addressLine1} ${address.addressLine2}`,
        city: address.city,
        state: address.state,
        country: address.country,
        pincode: address.postalCode,
        phone: address.phone,
        name: address.name,
      },
      statusHistory: [
        {
          status: "Pending",
          note: "Order created",
        },
      ],
    });

    await order.save({ session });

    // Remove notification creation from here - it will be created after payment confirmation
    return order;
  } catch (error) {
    throw new OrderError("Failed to create order", 500, {
      sellerId,
      error: error.message,
    });
  }
}

// Create Order from Cart
exports.createOrderFromCart = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("=== Starting Order Creation Process ===");
    const { addressId } = req.body;
    const { _id: userId } = req.user;

    if (!addressId) {
      throw new OrderError("Shipping address is required", 400);
    }

    console.log("Fetching required data...");
    const [shippingAddress, cart, buyer] = await Promise.all([
      Address.findById(addressId),
      Cart.findOne({ user: userId }).populate({
        path: "items.productId",
        select: "user price lotSize quantityAvailable title sku",
        populate: { path: "user", select: "name email address" },
      }),
      User.findById(userId).select("name email"),
    ]);

    console.log("Data fetched:", {
      hasShippingAddress: !!shippingAddress,
      hasCart: !!cart,
      cartItemsCount: cart?.items?.length,
      hasBuyer: !!buyer,
    });

    if (!shippingAddress) {
      throw new OrderError("Shipping address not found", 404);
    }

    if (!cart || cart.items.length === 0) {
      throw new OrderError("Cart is empty", 400);
    }

    if (!buyer) {
      throw new OrderError("Buyer details not found", 404);
    }

    // Reserve stock for all items
    console.log("Reserving stock for items...");
    await reserveStock(cart.items, session);

    const sellerOrders = cart.items.reduce((acc, item) => {
      if (!item.productId?.user) {
        throw new OrderError("Seller information missing for product", 400, {
          productId: item.productId?._id,
        });
      }

      const sellerId = item.productId.user._id.toString();
      if (!acc[sellerId]) {
        acc[sellerId] = [];
      }
      acc[sellerId].push(item);
      return acc;
    }, {});

    console.log(
      "Orders grouped by seller:",
      Object.keys(sellerOrders).length,
      "sellers"
    );

    const totalPrice = cart.items.reduce(
      (sum, item) =>
        sum + item.quantity * item.productId.lotSize * item.productId.price,
      0
    );

    console.log("Creating Razorpay payment order...");
    let razorpayOrder;
    try {
      razorpayOrder = await paymentService.createPaymentOrder({
        totalPrice,
        buyerId: buyer._id,
      });
      console.log("Razorpay order created:", razorpayOrder.id);
    } catch (error) {
      throw new PaymentError("Payment order creation failed", 500, {
        error: error.message,
      });
    }

    const createdOrders = [];

    // Create orders for each sellernt
    console.log("Creating orders for each seller...");
    for (const [sellerId, items] of Object.entries(sellerOrders)) {
      console.log(`Creating order for seller ${sellerId}...`);
      const order = await createSellerOrder(
        sellerId,
        items,
        buyer,
        shippingAddress,
        razorpayOrder,
        session,
        cart._id
      );
      createdOrders.push(order);
      console.log(`Order created for seller ${sellerId}:`, order._id);

      try {
        console.log(
          `Attempting to create Shiprocket shipment for order ${order._id}...`
        );
        const shiprocketResponse = await createShiprocketShipment(order);
        console.log(
          "Shiprocket shipment created successfully:",
          shiprocketResponse
        );
        await updateOrderStatus(order._id, "Shipped", "Shipment created");
      } catch (error) {
        console.error(
          `Failed to create Shiprocket shipment for order ${order._id}:`,
          error.message
        );
        // Continue with order creation even if shipping fails
      }
    }

    // Don't clear the cart here - it will be cleared after successful payment
    // await Cart.findByIdAndDelete(cart._id, { session });

    await session.commitTransaction();
    console.log("=== Order Creation Process Completed Successfully ===");

    res.status(201).json({
      message: "Orders created successfully",
      orders: createdOrders.map((order) => ({
        orderId: order._id,
        paymentOrderId: order.paymentTransactionId,
        amount: order.totalPrice,
      })),
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("=== Order Creation Process Failed ===");
    console.error("Error:", error.message);

    if (error instanceof OrderError || error instanceof PaymentError) {
      return res.status(error.code).json({
        message: error.message,
        details: error.details,
      });
    }

    console.error("Error creating orders:", error);
    res.status(500).json({
      message: "Error creating orders",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

// Verify Payment
exports.verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { order_id, payment_id, signature } = req.body;
    const body = `${order_id}|${payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      throw new PaymentError("Invalid payment signature", 400);
    }

    // Find all orders with the same paymentTransactionId
    const orders = await Order.find({
      paymentTransactionId: order_id,
    }).session(session);

    if (!orders.length) {
      throw new OrderError("Orders not found", 404);
    }

    // Check if payment is already verified
    const alreadyPaid = orders.every((order) => order.paymentStatus === "Paid");
    if (alreadyPaid) {
      throw new PaymentError("Payment already verified", 400);
    }

    // Fetch payment details from Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const payment = await razorpay.payments.fetch(payment_id);

    // Get platform fee percentage from settings
    const platformSettings = await PlatformSettings.findOne()
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!platformSettings) {
      console.warn("No platform settings found, using default fee of 10%");
    }

    const platformFeePercentage = platformSettings?.platformFeePercentage || 10; // Default to 10% if no settings found
    console.log("Using platform fee percentage:", platformFeePercentage);

    // Update all orders and create transactions
    await Promise.all(
      orders.map(async (order) => {
        // Calculate platform fee based on settings
        const platformFee = (order.totalPrice * platformFeePercentage) / 100;
        const sellerAmount = order.totalPrice - platformFee;

        console.log("Transaction calculations:", {
          orderId: order._id,
          totalPrice: order.totalPrice,
          platformFeePercentage,
          platformFee,
          sellerAmount,
        });

        // Create transaction record
        const transaction = new Transaction({
          order: order._id,
          buyer: order.buyer,
          seller: order.seller,
          amount: order.totalPrice,
          platformFee,
          platformFeePercentage,
          sellerAmount,
          paymentMethod: "Razorpay",
          paymentId: payment_id,
          status: "Completed",
          paymentDetails: {
            bank: payment.bank,
            cardType: payment.method,
            last4: payment.card?.last4,
            email: payment.email,
            contact: payment.contact,
          },
          completedAt: new Date(),
        });

        await transaction.save({ session });

        // Update order status
        order.paymentStatus = "Paid";
        order.paymentTransactionId = payment_id;
        order.status = "Completed";
        order.statusHistory.push({
          status: "Completed",
          note: "Payment verified successfully",
        });
        await order.save({ session });

        // Create both notifications after payment confirmation
        await NotificationService.notifyNewOrder(order.seller, order._id);
        await NotificationService.notifyPaymentReceived(
          order.seller,
          order._id,
          sellerAmount
        );
      })
    );

    // Delete the cart if all orders are paid
    if (orders[0].cartId) {
      await Cart.findByIdAndDelete(orders[0].cartId).session(session);
    }

    await session.commitTransaction();
    res.status(200).json({ message: "Payment verified successfully" });
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof OrderError || error instanceof PaymentError) {
      return res.status(error.code).json({
        message: error.message,
        details: error.details,
      });
    }

    console.error("Error verifying payment:", error);
    res.status(500).json({
      message: "Error verifying payment",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

// Create Order from Buy Now
exports.createOrderFromBuyNow = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("=== Starting Buy Now Order Creation Process ===");
    const { productId, quantity, addressId } = req.body;
    const { _id: userId } = req.user;

    if (!productId || !quantity || !addressId) {
      throw new OrderError("Product, quantity, and address are required", 400);
    }

    if (quantity <= 0) {
      throw new OrderError("Quantity must be greater than 0", 400);
    }

    const [product, shippingAddress, buyer] = await Promise.all([
      Product.findById(productId).populate("user", "name email address"),
      Address.findById(addressId),
      User.findById(userId).select("name email"),
    ]);

    if (!product) {
      throw new OrderError("Product not found", 404);
    }

    if (!shippingAddress) {
      throw new OrderError("Shipping address not found", 404);
    }

    if (!buyer) {
      throw new OrderError("Buyer details not found", 404);
    }

    // Ensure product has a lotSize property
    if (!product.lotSize || product.lotSize <= 0) {
      throw new OrderError("Invalid lot size for product", 400);
    }

    // Calculate total quantity based on lot size
    const totalQuantity = quantity * product.lotSize;
    const totalPrice = product.price * totalQuantity;

    console.log("Buy Now calculations:", {
      productId: product._id,
      productTitle: product.title,
      requestedLots: quantity,
      lotSize: product.lotSize,
      totalQuantity,
      totalPrice,
      availableStock: product.quantityAvailable,
    });

    // Validate stock availability
    if (product.quantityAvailable < totalQuantity) {
      throw new OrderError(
        `Insufficient quantity available for ${
          product.title
        }. Available: ${Math.floor(
          product.quantityAvailable / product.lotSize
        )} lots, Requested: ${quantity} lots`,
        400
      );
    }

    const order = new Order({
      products: [
        {
          product: product._id,
          quantity: totalQuantity, // Store actual quantity
          price: product.price,
          totalPrice,
        },
      ],
      buyer: buyer._id,
      seller: product.user._id,
      totalPrice,
      status: "Pending",
      paymentStatus: "Pending",
      address: {
        street: `${shippingAddress.addressLine1} ${shippingAddress.addressLine2}`,
        city: shippingAddress.city,
        state: shippingAddress.state,
        country: shippingAddress.country,
        pincode: shippingAddress.postalCode,
        phone: shippingAddress.phone,
        name: shippingAddress.name,
      },
      cartId: null, // No cart ID since it's a Buy Now
    });

    // Deduct stock based on lot size
    await Product.findByIdAndUpdate(
      product._id,
      { $inc: { quantityAvailable: -totalQuantity } },
      { session }
    );

    // Fetch the updated product to check stock status
    const updatedProduct = await Product.findById(product._id).populate("user");
    if (!updatedProduct) {
      throw new Error("Failed to fetch updated product");
    }

    // Check stock status and send notifications if needed
    console.log(`Checking stock status for ${updatedProduct.title}...`);
    try {
      await NotificationService.checkStockStatus(updatedProduct);
      console.log(`Stock status check completed for ${updatedProduct.title}`);
    } catch (error) {
      console.error(
        `Error checking stock status for ${updatedProduct.title}:`,
        error
      );
    }

    await order.save({ session });

    // Generate the payment order
    const razorpayOrder = await paymentService.createPaymentOrder({
      totalPrice: order.totalPrice,
      buyerId: buyer._id,
    });
    order.paymentTransactionId = razorpayOrder.id;
    await order.save({ session });

    // Create Shiprocket shipment for buy now order
    try {
      console.log(
        `Attempting to create Shiprocket shipment for buy now order ${order._id}...`
      );
      const shiprocketResponse = await createShiprocketShipment(order);
      console.log(
        "Shiprocket shipment created successfully:",
        shiprocketResponse
      );
      await updateOrderStatus(order._id, "Shipped", "Shipment created");
    } catch (error) {
      console.error(
        `Failed to create Shiprocket shipment for buy now order ${order._id}:`,
        error.message
      );
      // Continue with order creation even if shipping fails
    }

    // Respond with the created order details
    res.status(201).json({
      message: "Order created successfully",
      order: {
        orderId: order._id,
        paymentOrderId: order.paymentTransactionId,
        amount: order.totalPrice,
      },
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error("=== Buy Now Order Creation Process Failed ===");
    console.error("Error:", error.message);

    if (error instanceof OrderError || error instanceof PaymentError) {
      return res.status(error.code).json({
        message: error.message,
        details: error.details,
      });
    }

    console.error("Error creating buy now order:", error);
    res.status(500).json({
      message: "Error creating order",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { _id: userId, role } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {};
    if (role === "Buyer") {
      filter.buyer = userId;
    } else if (role === "Seller") {
      filter.seller = userId;
    } else if (role !== "Admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "products.product",
          model: "Product",
          select: "title images featuredImage",
        })
        .populate("buyer", "fullName")
        .populate("seller", "fullName")
        .lean()
        .exec(),
      Order.countDocuments(filter),
    ]);

    if (!orders.length && page !== 1) {
      return res.status(404).json({ message: "No orders found" });
    }

    // Get all product IDs from orders
    const productIds = orders.flatMap((order) =>
      order.products.map((item) => item.product?._id).filter(Boolean)
    );

    // Fetch user's reviews for these products
    const userReviews = await Review.find({
      user: userId,
      product: { $in: productIds },
    }).select("product rating");

    // Convert user reviews into a Map for quick lookup
    const userRatings = new Map(
      userReviews.map((review) => [review.product.toString(), review.rating])
    );

    // Format orders and include the user's rating
    const formattedOrders = orders.map((order) => ({
      orderId: order._id,
      buyer: order.buyer?.fullName || "Unknown Buyer",
      seller: order.seller?.fullName || "Unknown Seller",
      totalPrice: order.totalPrice,
      paymentStatus: order.paymentStatus,
      status: order.status,
      createdAt: order.createdAt,
      address: order.address
        ? {
            street: order.address.street || "",
            city: order.address.city || "",
            state: order.address.state || "",
            country: order.address.country || "",
            pincode: order.address.pincode || "",
            phone: order.address.phone || "",
            name: order.address.name || "",
          }
        : null,
      products: order.products.map((productItem) => {
        const product = productItem.product || {};
        return {
          productId: product._id,
          name: product.title || "Unknown Product",
          images: product.images,
          featuredImage: product.featuredImage,
          quantity: productItem.quantity,
          price: productItem.price,
          totalPrice: productItem.totalPrice,
          userRating: userRatings.get(product._id?.toString()) || null,
        };
      }),
    }));

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: formattedOrders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasMore: page * limit < totalOrders,
      },
    });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res
      .status(500)
      .json({ message: "Error fetching orders", error: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, role } = req.user;

    // Build the query based on user role
    let query = { _id: id };
    if (role === "Buyer") {
      query.buyer = userId;
    } else if (role === "Seller") {
      query.seller = userId;
    } else if (role !== "Admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const order = await Order.findOne(query)
      .populate({
        path: "products.product",
        model: "Product",
        select: "title images featuredImage price",
      })
      .populate("buyer", "fullName email phone")
      .populate({
        path: "seller",
        select: "fullName email phone sellerDetails",
        populate: {
          path: "sellerDetails",
          select:
            "businessName addressLine1 addressLine2 city state postalCode country",
        },
      })
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Format the order response
    const formattedOrder = {
      orderId: order._id,
      buyer: {
        name: order.buyer?.fullName || "Unknown Buyer",
        email: order.buyer?.email,
        phone: order.buyer?.phone,
      },
      seller: {
        name: order.seller?.fullName || "Unknown Seller",
        email: order.seller?.email,
        phone: order.seller?.phone,
        businessName: order.seller?.sellerDetails?.businessName,
        address: order.seller?.sellerDetails
          ? {
              addressLine1: order.seller.sellerDetails.addressLine1,
              addressLine2: order.seller.sellerDetails.addressLine2,
              city: order.seller.sellerDetails.city,
              state: order.seller.sellerDetails.state,
              postalCode: order.seller.sellerDetails.postalCode,
              country: order.seller.sellerDetails.country,
            }
          : null,
      },
      totalPrice: order.totalPrice,
      paymentStatus: order.paymentStatus,
      paymentTransactionId: order.paymentTransactionId,
      status: order.status,
      createdAt: order.createdAt,
      address: order.address
        ? {
            street: order.address.street || "",
            city: order.address.city || "",
            state: order.address.state || "",
            country: order.address.country || "",
            pincode: order.address.pincode || "",
            phone: order.address.phone || "",
            name: order.address.name || "",
          }
        : null,
      products: order.products.map((productItem) => {
        const product = productItem.product || {};
        return {
          productId: product._id,
          name: product.title || "Unknown Product",
          images: product.images,
          featuredImage: product.featuredImage,
          quantity: productItem.quantity,
          price: product.price,
          totalPrice: productItem.quantity * product.price,
        };
      }),
    };

    res.status(200).json({
      message: "Order fetched successfully",
      order: formattedOrder,
    });
  } catch (err) {
    console.error("Error fetching order:", err);
    res.status(500).json({
      message: "Error fetching order details",
      error: err.message,
    });
  }
};
