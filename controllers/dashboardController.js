const Order = require("../models/order");
const User = require("../models/User");
const Product = require("../models/product");
const mongoose = require("mongoose");

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    console.log("=== Dashboard Stats Calculation Started ===");

    // Get basic counts
    const [totalOrders, totalUsers, totalProducts] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ role: { $in: ["Buyer", "Seller"] } }),
      Product.countDocuments({ isActive: true }),
    ]);

    console.log("Basic counts:", { totalOrders, totalUsers, totalProducts });

    // Get total sales from paid orders
    const salesResult = await Order.aggregate([
      {
        $match: {
          status: { $ne: "Cancelled" },
          paymentStatus: "Paid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalPrice" },
        },
      },
    ]);

    const totalSales = salesResult[0]?.total || 0;
    console.log("Total sales:", totalSales);

    // Get order status counts
    const orderStatusResult = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const orderStatusMap = {
      Pending: 0,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
      Completed: 0,
    };

    orderStatusResult.forEach((status) => {
      if (orderStatusMap.hasOwnProperty(status._id)) {
        orderStatusMap[status._id] = status.count;
      }
    });

    console.log("Order status map:", orderStatusMap);

    // Get recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: "products.product",
        select: "title featuredImage",
      })
      .populate("buyer", "fullName");

    console.log("Recent orders count:", recentOrders.length);

    // Get top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          status: { $ne: "Cancelled" },
          paymentStatus: "Paid",
        },
      },
      {
        $unwind: "$products",
      },
      {
        $group: {
          _id: "$products.product",
          soldCount: { $sum: "$products.quantity" },
          revenue: { $sum: "$products.totalPrice" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $unwind: "$productDetails",
      },
      {
        $project: {
          _id: 1,
          title: "$productDetails.title",
          featuredImage: "$productDetails.featuredImage",
          quantityAvailable: "$productDetails.quantityAvailable",
          soldCount: 1,
          revenue: 1,
        },
      },
      {
        $sort: { soldCount: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    console.log("Top products count:", topProducts.length);

    // Get category statistics
    const categoryStats = await Order.aggregate([
      {
        $match: {
          status: { $ne: "Cancelled" },
          paymentStatus: "Paid",
        },
      },
      {
        $unwind: "$products",
      },
      {
        $lookup: {
          from: "products",
          localField: "products.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $unwind: "$productDetails",
      },
      {
        $lookup: {
          from: "categories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {
        $unwind: "$categoryDetails",
      },
      {
        $group: {
          _id: {
            id: "$productDetails.category",
            name: "$categoryDetails.name",
          },
          totalSales: {
            $sum: "$products.totalPrice",
          },
          orderCount: {
            $addToSet: "$_id",
          },
        },
      },
      {
        $project: {
          _id: 1,
          totalSales: 1,
          orderCount: { $size: "$orderCount" },
        },
      },
      {
        $sort: { totalSales: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    console.log("Category stats count:", categoryStats.length);

    const response = {
      // Basic stats - NO comparisons
      totalSales: Number(totalSales) || 0,
      totalRevenue: Number(totalSales) || 0,

      totalCustomers: Number(totalUsers) || 0,

      totalOrders: Number(totalOrders) || 0,

      totalProducts: Number(totalProducts) || 0,

      // Order status breakdown
      orderStatus: orderStatusMap,

      // Recent orders
      recentOrders: recentOrders || [],

      // Top selling products
      topProducts: topProducts || [],

      // Category statistics
      categoryStats: (categoryStats || []).map((stat) => ({
        id: stat._id?.id || stat._id || null,
        name: stat._id?.name || "Unknown Category",
        totalSales: Number(stat.totalSales) || 0,
        orderCount: Number(stat.orderCount) || 0,
      })),
    };

    console.log("=== Final Dashboard Response ===");
    console.log("Total Sales:", response.totalSales);
    console.log("Total Customers:", response.totalCustomers);
    console.log("Total Orders:", response.totalOrders);
    console.log("Total Products:", response.totalProducts);
    console.log("Recent Orders Count:", response.recentOrders.length);
    console.log("Top Products Count:", response.topProducts.length);
    console.log("Category Stats Count:", response.categoryStats.length);

    res.json(response);
  } catch (error) {
    console.error("Dashboard data error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      message: "Error fetching dashboard data",
      error: error.message,
    });
  }
};

// Helper function to get status color
function getStatusColor(status) {
  const colors = {
    Pending: "bg-yellow-500",
    Processing: "bg-blue-500",
    Shipped: "bg-indigo-500",
    Delivered: "bg-green-500",
    Cancelled: "bg-red-500",
    "Payment Failed": "bg-red-500",
    "Payment Pending": "bg-yellow-500",
  };
  return colors[status] || "bg-gray-500";
}
