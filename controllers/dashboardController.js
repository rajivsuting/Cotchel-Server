const Order = require("../models/order");
const User = require("../models/User");
const Product = require("../models/product");
const mongoose = require("mongoose");

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get date range for comparison (last 7 days)
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log("Date range debug:", {
      today: today.toISOString(),
      lastWeek: lastWeek.toISOString(),
      lastWeekStart: new Date(
        lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });

    // Get total sales and compare with last week
    const currentWeekSales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: lastWeek },
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

    const lastWeekSales = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
            $lt: lastWeek,
          },
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

    const totalSales = currentWeekSales[0]?.total || 0;
    const lastWeekTotal = lastWeekSales[0]?.total || 0;
    const salesChange =
      lastWeekTotal === 0
        ? 100
        : ((totalSales - lastWeekTotal) / lastWeekTotal) * 100;

    // Get new customers count and compare with last week
    const currentWeekCustomers = await User.countDocuments({
      createdAt: { $gte: lastWeek },
      role: { $in: ["Buyer", "Seller"] },
    });

    const lastWeekCustomers = await User.countDocuments({
      createdAt: {
        $gte: new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
        $lt: lastWeek,
      },
      role: { $in: ["Buyer", "Seller"] },
    });

    console.log("Customer counts debug:", {
      currentWeekCustomers,
      lastWeekCustomers,
    });

    // If there are customers this week but none last week, show 100% increase
    // If there are no customers in either week, show 0% change
    // Otherwise calculate normal percentage change
    const customersChange =
      currentWeekCustomers > 0 && lastWeekCustomers === 0
        ? 100
        : currentWeekCustomers === 0
        ? 0
        : ((currentWeekCustomers - lastWeekCustomers) / lastWeekCustomers) *
          100;

    // Get total orders and compare with last week
    const currentWeekOrders = await Order.countDocuments({
      createdAt: { $gte: lastWeek },
    });

    const lastWeekOrders = await Order.countDocuments({
      createdAt: {
        $gte: new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
        $lt: lastWeek,
      },
    });

    // If there are no orders in either week, show 0% change
    // If there are orders this week but none last week, show 100% increase
    // Otherwise calculate normal percentage change
    const ordersChange =
      currentWeekOrders === 0
        ? 0
        : lastWeekOrders === 0
        ? 100
        : ((currentWeekOrders - lastWeekOrders) / lastWeekOrders) * 100;

    // Get category statistics
    const categoryStats = await Order.aggregate([
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
            $sum: { $multiply: ["$products.quantity", "$products.price"] },
          },
          orderCount: {
            $addToSet: "$_id", // Count unique orders
          },
        },
      },
      {
        $project: {
          _id: 1,
          totalSales: 1,
          orderCount: { $size: "$orderCount" }, // Convert array to count
        },
      },
      {
        $sort: { totalSales: -1 },
      },
      {
        $limit: 3,
      },
    ]);

    console.log("Category statistics:", JSON.stringify(categoryStats, null, 2));

    // For now, we'll use placeholder data for product visits
    const productVisits = 0;
    const visitsChange = 0;

    // Get order status counts with proper filtering
    const orderStatus = await Order.aggregate([
      {
        $match: {
          status: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    console.log("Raw order status aggregation result:", orderStatus);

    // Initialize order status map with all possible statuses
    const orderStatusMap = {
      Pending: 0,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
      Completed: 0,
    };

    // Update counts from aggregation results
    orderStatus.forEach((status) => {
      console.log(
        "Processing status:",
        status._id,
        "with count:",
        status.count
      );
      if (orderStatusMap.hasOwnProperty(status._id)) {
        orderStatusMap[status._id] = status.count;
      } else {
        console.log("Unknown status found:", status._id);
      }
    });

    console.log("Final order status map:", orderStatusMap);

    // Get total orders count directly from the database
    const totalOrders = await Order.countDocuments();
    console.log("Total orders from database:", totalOrders);

    // Get recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: "products.product",
        select: "title featuredImage",
      })
      .populate("buyer", "fullName");

    // Get top selling products
    const topProducts = await Order.aggregate([
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
          title: "$productDetails.title",
          featuredImage: "$productDetails.featuredImage",
          quantityAvailable: "$productDetails.quantityAvailable",
          category: "$productDetails.category",
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

    res.json({
      totalSales,
      salesChange: Math.round(salesChange),
      newCustomers: currentWeekCustomers,
      customersChange: Math.round(customersChange),
      totalOrders,
      ordersChange: Math.round(ordersChange),
      productVisits,
      visitsChange: Math.round(visitsChange),
      orderStatus: orderStatusMap,
      recentOrders,
      topProducts,
      categoryStats: categoryStats.map((stat) => ({
        id: stat._id.id,
        name: stat._id.name,
        totalSales: stat.totalSales,
        orderCount: stat.orderCount,
      })),
    });
  } catch (error) {
    console.error("Dashboard data error:", error);
    res.status(500).json({ message: "Error fetching dashboard data" });
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
