const Order = require("../models/order");
const Product = require("../models/product");
const Review = require("../models/reviewSchema");
const User = require("../models/User");
const { DatabaseError, NotFoundError } = require("../utils/errors");
const mongoose = require("mongoose");

const sellerDashboardController = {
  // Get all dashboard data in a single request
  getDashboardData: async (req, res, next) => {
    console.log("[DEBUG] ===== SELLER DASHBOARD REQUEST START =====");
    console.log("[DEBUG] Starting getDashboardData");
    console.log("[DEBUG] User ID:", req.user._id);
    console.log("[DEBUG] User role:", req.user.role);
    console.log("[DEBUG] User lastActiveRole:", req.user.lastActiveRole);
    console.log("[DEBUG] User isVerifiedSeller:", req.user.isVerifiedSeller);

    try {
      const sellerId = req.user._id;

      // Ensure sellerId is a valid ObjectId
      if (!sellerId) {
        throw new NotFoundError("Seller ID missing from request");
      }

      // Convert sellerId to ObjectId if it's a string
      const sellerObjectId = mongoose.Types.ObjectId.isValid(sellerId)
        ? typeof sellerId === "string"
          ? new mongoose.Types.ObjectId(sellerId)
          : sellerId
        : sellerId;

      console.log("[DEBUG] Seller ID:", {
        original: sellerId,
        type: typeof sellerId,
        objectId: sellerObjectId.toString(),
        isObjectId: sellerObjectId instanceof mongoose.Types.ObjectId,
      });
      console.log("[DEBUG] user role:", req.user.role);
      console.log("[DEBUG] user lastActiveRole:", req.user.lastActiveRole);

      // Verify seller status
      const seller = await User.findById(sellerObjectId);
      if (!seller || !seller.isVerifiedSeller) {
        throw new NotFoundError("Seller not found or not verified");
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      console.log("[DEBUG] Date ranges:", {
        today: today.toISOString(),
        tomorrow: tomorrow.toISOString(),
        yesterday: yesterday.toISOString(),
      });

      console.log("[DEBUG] Starting parallel data fetch");
      console.log("[DEBUG] Seller ID:", sellerObjectId.toString());
      console.log(
        "[DEBUG] Seller verification status:",
        seller.isVerifiedSeller
      );

      // First, let's check what data actually exists for this seller
      const allSellerOrders = await Order.find({ seller: sellerObjectId });
      const allSellerProducts = await Product.find({ user: sellerObjectId });

      console.log("[DEBUG] Raw seller data:");
      console.log("  - Total orders for seller:", allSellerOrders.length);
      console.log("  - Total products for seller:", allSellerProducts.length);

      if (allSellerOrders.length > 0) {
        console.log(
          "  - Sample order statuses:",
          allSellerOrders.map((o) => ({
            id: o._id,
            status: o.status,
            paymentStatus: o.paymentStatus,
          }))
        );
      }

      if (allSellerProducts.length > 0) {
        console.log(
          "  - Sample products:",
          allSellerProducts.map((p) => ({
            id: p._id,
            title: p.title,
            isActive: p.isActive,
          }))
        );
      }

      // Get all data in parallel
      const [
        todayOrders,
        yesterdayOrders,
        activeOrders,
        yesterdayActiveOrders,
        totalProducts,
        yesterdayProducts,
        allTimeOrders,
        recentOrders,
        topProducts,
      ] = await Promise.all([
        // Today's sales (include Confirmed, Completed, and Delivered orders)
        Order.find({
          seller: sellerObjectId,
          createdAt: { $gte: today, $lt: tomorrow },
          status: {
            $in: [
              "Confirmed",
              "Processing",
              "Packed",
              "Shipped",
              "In Transit",
              "Out for Delivery",
              "Completed",
              "Delivered",
            ],
          },
          paymentStatus: "Paid",
        }).populate({
          path: "products.product",
          select: "title price images",
        }),
        // Yesterday's sales
        Order.find({
          seller: sellerObjectId,
          createdAt: { $gte: yesterday, $lt: today },
          status: {
            $in: [
              "Confirmed",
              "Processing",
              "Packed",
              "Shipped",
              "In Transit",
              "Out for Delivery",
              "Completed",
              "Delivered",
            ],
          },
          paymentStatus: "Paid",
        }).populate({
          path: "products.product",
          select: "title price images",
        }),
        // Active orders (orders that are not completed, cancelled, or returned)
        Order.countDocuments({
          seller: sellerObjectId,
          status: {
            $in: [
              "Payment Pending",
              "Confirmed",
              "Processing",
              "Packed",
              "Shipped",
              "In Transit",
              "Out for Delivery",
            ],
          },
          paymentStatus: "Paid",
        }),
        // Yesterday's active orders
        Order.countDocuments({
          seller: sellerObjectId,
          status: {
            $in: [
              "Payment Pending",
              "Confirmed",
              "Processing",
              "Packed",
              "Shipped",
              "In Transit",
              "Out for Delivery",
            ],
          },
          paymentStatus: "Paid",
          createdAt: { $gte: yesterday, $lt: today },
        }),
        // Total products
        Product.countDocuments({ user: sellerObjectId, isActive: true }),
        // Yesterday's products
        Product.countDocuments({
          user: sellerObjectId,
          isActive: true,
          createdAt: { $gte: yesterday, $lt: today },
        }),
        // All time orders for total sales (include all paid orders except cancelled)
        Order.find({
          seller: sellerObjectId,
          status: {
            $in: [
              "Confirmed",
              "Processing",
              "Packed",
              "Shipped",
              "In Transit",
              "Out for Delivery",
              "Completed",
              "Delivered",
            ],
          },
          paymentStatus: "Paid",
        }).populate({
          path: "products.product",
          select: "title price images",
        }),
        // Recent orders with populated data (show all orders, not just paid)
        Order.find({
          seller: sellerObjectId,
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate({
            path: "products.product",
            select: "title images price",
          })
          .populate("buyer", "fullName"),
        // Top selling products with proper aggregation
        Order.aggregate([
          {
            $match: {
              seller: sellerObjectId,
              paymentStatus: "Paid",
              status: {
                $in: [
                  "Confirmed",
                  "Processing",
                  "Packed",
                  "Shipped",
                  "In Transit",
                  "Out for Delivery",
                  "Completed",
                  "Delivered",
                ],
              },
            },
          },
          { $unwind: "$products" },
          {
            $group: {
              _id: "$products.product",
              totalSold: { $sum: "$products.quantity" },
              totalRevenue: {
                $sum: { $multiply: ["$products.price", "$products.quantity"] },
              },
            },
          },
          { $sort: { totalSold: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: "products",
              let: { productId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$_id", "$$productId"] },
                        { $eq: ["$isActive", true] },
                        {
                          $eq: ["$user", sellerObjectId],
                        },
                      ],
                    },
                  },
                },
              ],
              as: "productDetails",
            },
          },
          { $unwind: "$productDetails" },
          {
            $project: {
              _id: 1,
              totalSold: 1,
              totalRevenue: 1,
              "productDetails.title": 1,
              "productDetails.images": 1,
              "productDetails.quantityAvailable": 1,
            },
          },
        ]),
      ]);

      console.log("[DEBUG] Data fetch results:", {
        todayOrdersCount: todayOrders.length,
        yesterdayOrdersCount: yesterdayOrders.length,
        activeOrders,
        yesterdayActiveOrders,
        totalProducts,
        yesterdayProducts,
        allTimeOrdersCount: allTimeOrders.length,
        recentOrdersCount: recentOrders.length,
        topProductsCount: topProducts.length,
      });

      // Calculate sales data with null checks
      const totalSales = todayOrders.reduce(
        (sum, order) => sum + (order.totalPrice || 0),
        0
      );
      const yesterdaySales = yesterdayOrders.reduce(
        (sum, order) => sum + (order.totalPrice || 0),
        0
      );
      const salesPercentageChange =
        yesterdaySales === 0
          ? 100
          : ((totalSales - yesterdaySales) / yesterdaySales) * 100;

      // Calculate total all-time sales
      const allTimeTotalSales = allTimeOrders.reduce(
        (sum, order) => sum + (order.totalPrice || 0),
        0
      );

      // Calculate active orders change
      const ordersPercentageChange =
        yesterdayActiveOrders === 0
          ? 100
          : ((activeOrders - yesterdayActiveOrders) / yesterdayActiveOrders) *
            100;

      // Calculate products change
      const productsPercentageChange =
        yesterdayProducts === 0
          ? 100
          : ((totalProducts - yesterdayProducts) / yesterdayProducts) * 100;

      // Format the response with null checks
      const dashboardData = {
        stats: [
          {
            title: "Today's Sales",
            value: totalSales || 0,
            change: salesPercentageChange.toFixed(1),
            positive: salesPercentageChange >= 0,
          },
          {
            title: "Active Orders",
            value: activeOrders || 0,
            change: ordersPercentageChange.toFixed(1),
            positive: ordersPercentageChange >= 0,
          },
          {
            title: "Total Products",
            value: totalProducts || 0,
            change: productsPercentageChange.toFixed(1),
            positive: productsPercentageChange >= 0,
          },
          {
            title: "Total Sales",
            value: allTimeTotalSales || 0,
            change: "0.0", // No change percentage for total sales
            positive: true,
          },
        ],
        recentOrders: recentOrders.map((order) => ({
          id: order._id,
          product: order.products[0]?.product?.title || "N/A",
          image: order.products[0]?.product?.images?.[0] || "/placeholder.png",
          customer: order.buyer?.fullName || "Anonymous",
          date: order.createdAt,
          status: order.status,
          amount: order.totalPrice || 0,
        })),
        topProducts: topProducts.map((product) => ({
          id: product._id,
          name: product.productDetails?.title || "N/A",
          image: product.productDetails?.images?.[0] || "/placeholder.png",
          sold: product.totalSold || 0,
          revenue: product.totalRevenue || 0,
          stock: product.productDetails?.quantityAvailable || 0,
        })),
      };

      console.log("[DEBUG] ===== SELLER DASHBOARD RESPONSE =====");
      console.log("[DEBUG] Stats:", dashboardData.stats);
      console.log("[DEBUG] Recent Orders:", dashboardData.recentOrders);
      console.log("[DEBUG] Top Products:", dashboardData.topProducts);
      console.log("[DEBUG] ===== SELLER DASHBOARD REQUEST END =====");

      res.status(200).json({
        success: true,
        message: "Dashboard data fetched successfully",
        stats: dashboardData.stats,
        recentOrders: dashboardData.recentOrders,
        topProducts: dashboardData.topProducts,
      });
    } catch (error) {
      console.error("[ERROR] Dashboard data fetch failed:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      next(new DatabaseError("Failed to fetch dashboard data", error));
    }
  },

  // Debug endpoint to check seller data
  debugSellerData: async (req, res, next) => {
    try {
      const sellerId = req.user._id;
      const sellerObjectId = mongoose.Types.ObjectId.isValid(sellerId)
        ? typeof sellerId === "string"
          ? new mongoose.Types.ObjectId(sellerId)
          : sellerId
        : sellerId;

      // Get all data for this seller
      const [allOrders, allProducts, seller] = await Promise.all([
        Order.find({ seller: sellerObjectId }),
        Product.find({ user: sellerObjectId }),
        User.findById(sellerObjectId),
      ]);

      // Group orders by status
      const ordersByStatus = allOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});

      // Group orders by payment status
      const ordersByPaymentStatus = allOrders.reduce((acc, order) => {
        acc[order.paymentStatus] = (acc[order.paymentStatus] || 0) + 1;
        return acc;
      }, {});

      // Group products by active status
      const productsByStatus = allProducts.reduce((acc, product) => {
        acc[product.isActive ? "active" : "inactive"] =
          (acc[product.isActive ? "active" : "inactive"] || 0) + 1;
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        debug: {
          seller: {
            id: seller._id,
            email: seller.email,
            role: seller.role,
            lastActiveRole: seller.lastActiveRole,
            isVerifiedSeller: seller.isVerifiedSeller,
            sellerDetailsStatus: seller.sellerDetailsStatus,
          },
          orders: {
            total: allOrders.length,
            byStatus: ordersByStatus,
            byPaymentStatus: ordersByPaymentStatus,
            sample: allOrders.slice(0, 3).map((o) => ({
              id: o._id,
              status: o.status,
              paymentStatus: o.paymentStatus,
              totalPrice: o.totalPrice,
              createdAt: o.createdAt,
            })),
          },
          products: {
            total: allProducts.length,
            byStatus: productsByStatus,
            sample: allProducts.slice(0, 3).map((p) => ({
              id: p._id,
              title: p.title,
              isActive: p.isActive,
              quantityAvailable: p.quantityAvailable,
              createdAt: p.createdAt,
            })),
          },
        },
      });
    } catch (error) {
      console.error("Error in debugSellerData:", error);
      next(error);
    }
  },
};

module.exports = sellerDashboardController;
