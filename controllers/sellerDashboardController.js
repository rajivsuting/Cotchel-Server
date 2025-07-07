const Order = require("../models/order");
const Product = require("../models/product");
const Review = require("../models/reviewSchema");
const User = require("../models/User");
const { DatabaseError, NotFoundError } = require("../utils/errors");
const mongoose = require("mongoose");

const sellerDashboardController = {
  // Get all dashboard data in a single request
  getDashboardData: async (req, res, next) => {
    console.log("[DEBUG] Starting getDashboardData");
    console.log("[DEBUG] User ID:", req.user._id);

    try {
      const sellerId = req.user._id;

      // Verify seller status
      const seller = await User.findById(sellerId);
      if (!seller || seller.role !== "Seller" || !seller.isVerifiedSeller) {
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
        // Today's sales
        Order.find({
          seller: sellerId,
          createdAt: { $gte: today, $lt: tomorrow },
          status: { $in: ["Completed", "Delivered"] },
          paymentStatus: "Paid",
        }).populate({
          path: "products.product",
          select: "title price images",
        }),
        // Yesterday's sales
        Order.find({
          seller: sellerId,
          createdAt: { $gte: yesterday, $lt: today },
          status: { $in: ["Completed", "Delivered"] },
          paymentStatus: "Paid",
        }).populate({
          path: "products.product",
          select: "title price images",
        }),
        // Active orders
        Order.countDocuments({
          seller: sellerId,
          status: { $in: ["Pending", "Processing", "Shipped"] },
          paymentStatus: "Paid",
        }),
        // Yesterday's active orders
        Order.countDocuments({
          seller: sellerId,
          status: { $in: ["Pending", "Processing", "Shipped"] },
          paymentStatus: "Paid",
          createdAt: { $gte: yesterday, $lt: today },
        }),
        // Total products
        Product.countDocuments({ user: sellerId, isActive: true }),
        // Yesterday's products
        Product.countDocuments({
          user: sellerId,
          isActive: true,
          createdAt: { $gte: yesterday, $lt: today },
        }),
        // All time orders for total sales
        Order.find({
          seller: sellerId,
          status: { $in: ["Completed", "Delivered"] },
          paymentStatus: "Paid",
        }).populate({
          path: "products.product",
          select: "title price images",
        }),
        // Recent orders with populated data
        Order.find({
          seller: sellerId,
          paymentStatus: "Paid",
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
              seller: new mongoose.Types.ObjectId(sellerId),
              paymentStatus: "Paid",
              status: { $in: ["Completed", "Delivered"] },
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
                          $eq: ["$user", new mongoose.Types.ObjectId(sellerId)],
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

      console.log("[DEBUG] Final dashboard data structure:", {
        statsCount: dashboardData.stats.length,
        recentOrdersCount: dashboardData.recentOrders.length,
        topProductsCount: dashboardData.topProducts.length,
      });

      res.json(dashboardData);
    } catch (error) {
      console.error("[ERROR] Dashboard data fetch failed:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      next(new DatabaseError("Failed to fetch dashboard data", error));
    }
  },
};

module.exports = sellerDashboardController;
