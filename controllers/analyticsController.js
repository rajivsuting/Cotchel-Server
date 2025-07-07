const Order = require("../models/order");
const User = require("../models/User");
const Product = require("../models/product");
const mongoose = require("mongoose");

// Get monthly revenue data
exports.getMonthlyRevenue = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1),
          },
          status: { $ne: "Cancelled" },
          paymentStatus: "Paid",
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          value: { $sum: "$totalPrice" },
        },
      },
      {
        $project: {
          _id: 0,
          month: "$_id",
          value: 1,
        },
      },
      {
        $sort: { month: 1 },
      },
    ]);

    // Convert month numbers to names and ensure all months are present
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const formattedData = months.map((name, index) => ({
      name,
      value:
        monthlyRevenue.find((item) => item.month === index + 1)?.value || 0,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("Error fetching monthly revenue:", error);
    res.status(500).json({ message: "Error fetching monthly revenue data" });
  }
};

// Get user growth data
exports.getUserGrowth = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const monthlyGrowth = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1),
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            role: "$role",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.month",
          buyers: {
            $sum: {
              $cond: [{ $eq: ["$_id.role", "Buyer"] }, "$count", 0],
            },
          },
          sellers: {
            $sum: {
              $cond: [{ $eq: ["$_id.role", "Seller"] }, "$count", 0],
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Format data with all months
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const formattedData = months.map((name, index) => {
      const monthData = monthlyGrowth.find(
        (item) => item._id === index + 1
      ) || { buyers: 0, sellers: 0 };
      return {
        name,
        buyers: monthData.buyers,
        sellers: monthData.sellers,
      };
    });

    res.json(formattedData);
  } catch (error) {
    console.error("Error fetching user growth:", error);
    res.status(500).json({ message: "Error fetching user growth data" });
  }
};

// Combined endpoint for dashboard data
exports.getDashboardData = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear + 1, 0, 1);

    // Get total active users (current)
    const [activeSellers, activeBuyers, lastMonthSellers, lastMonthBuyers] =
      await Promise.all([
        // Current active sellers
        User.countDocuments({
          $or: [
            { role: "Seller", isEmailVerified: true },
            { role: "Buyer", isVerifiedSeller: true, isEmailVerified: true },
          ],
          // isActive: true,
        }),

        // Current active buyers
        User.countDocuments({
          role: "Buyer",
          isEmailVerified: true,
          // isActive: true,
        }),

        // Last month active sellers
        User.countDocuments({
          role: "Seller",
          isEmailVerified: true,
          isActive: true,
          createdAt: {
            $lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        }),

        // Last month active buyers
        User.countDocuments({
          role: "Buyer",
          isEmailVerified: true,
          isActive: true,
          createdAt: {
            $lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        }),
      ]);

    // Calculate growth percentages
    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // Get monthly user growth data
    const userGrowthData = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfYear,
            $lt: endOfYear,
          },
          isEmailVerified: true,
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            role: "$role",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.month",
          data: {
            $push: {
              role: "$_id.role",
              count: "$count",
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Format user growth data with all months
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const formattedUserGrowth = months.map((name, index) => {
      const monthData = userGrowthData.find((item) => item._id === index + 1);
      const data = monthData?.data || [];

      return {
        name,
        buyers: data.find((d) => d.role === "Buyer")?.count || 0,
        sellers: data.find((d) => d.role === "Seller")?.count || 0,
      };
    });

    // Get revenue data
    const [totalRevenue, revenueByMonth] = await Promise.all([
      // Total revenue
      Order.aggregate([
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
      ]),

      // Monthly revenue
      Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startOfYear,
              $lt: endOfYear,
            },
            status: { $ne: "Cancelled" },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            value: { $sum: "$totalPrice" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
    ]);

    // Format revenue data
    const revenueData = months.map((name, index) => ({
      name,
      value: revenueByMonth.find((item) => item._id === index + 1)?.value || 0,
    }));

    // Calculate current and last month's revenue for growth
    const currentMonthRevenue =
      revenueByMonth.find((m) => m._id === new Date().getMonth() + 1)?.value ||
      0;
    const lastMonthRevenue =
      revenueByMonth.find((m) => m._id === new Date().getMonth())?.value || 0;

    // Format summary stats
    const summaryStats = {
      totalRevenue: {
        value: totalRevenue[0]?.total || 0,
        percentage: calculateGrowth(currentMonthRevenue, lastMonthRevenue),
      },
      activeSellers: {
        value: activeSellers,
        percentage: calculateGrowth(activeSellers, lastMonthSellers),
      },
      activeBuyers: {
        value: activeBuyers,
        percentage: calculateGrowth(activeBuyers, lastMonthBuyers),
      },
    };

    // Get top sellers data
    const topSellers = await Order.aggregate([
      {
        $match: {
          status: { $ne: "Cancelled" },
          paymentStatus: "Paid",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "seller",
          foreignField: "_id",
          as: "sellerInfo",
        },
      },
      {
        $unwind: "$sellerInfo",
      },
      {
        $group: {
          _id: "$seller",
          name: { $first: "$sellerInfo.fullName" },
          sales: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
      {
        $sort: { revenue: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    // Format response
    res.json({
      revenueData,
      userGrowthData: formattedUserGrowth,
      summaryStats,
      topSellers: topSellers.map((seller) => ({
        id: seller._id,
        name: seller.name,
        sales: seller.sales,
        revenue: `$${seller.revenue.toFixed(2)}`,
        growth: 0, // You can calculate this if needed
      })),
      recentActivities: [], // You can implement this based on your needs
    });
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    res.status(500).json({
      message: "Error fetching dashboard data",
      error: error.message,
    });
  }
};

// Helper function to format time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";

  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "m ago";

  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";

  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";

  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";

  return Math.floor(seconds) + "s ago";
}

// Real-time stats endpoint
exports.getRealTimeStats = async (req, res) => {
  try {
    const [activeProducts, activeUsers, openTickets] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      User.countDocuments({ isEmailVerified: true }),
      Order.countDocuments({ status: "Pending" }),
    ]);

    const response = {
      activeUsers,
      activeProducts,
      openTickets,
    };

    console.log("Debug - Real-time stats:", response);

    res.json(response);
  } catch (error) {
    console.error("Error in getRealTimeStats:", error);
    res.status(500).json({
      message: "Error fetching real-time statistics",
      error: error.message,
    });
  }
};

// Get summary statistics
exports.getSummaryStats = async (req, res) => {
  try {
    const [totalRevenue, activeSellers, activeBuyers] = await Promise.all([
      Order.aggregate([
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
      ]),
      User.countDocuments({
        role: "Seller",
        isEmailVerified: true,
        isVerifiedSeller: true,
      }),
      User.countDocuments({
        role: "Buyer",
        isEmailVerified: true,
      }),
    ]);

    // Calculate percentage changes (mock data for now, can be implemented based on historical data)
    res.json({
      totalRevenue: {
        value: totalRevenue[0]?.total || 0,
        percentage: 12.5,
      },
      activeSellers: {
        value: activeSellers,
        percentage: 11.4,
      },
      activeBuyers: {
        value: activeBuyers,
        percentage: 16.8,
      },
    });
  } catch (error) {
    console.error("Error fetching summary stats:", error);
    res.status(500).json({ message: "Error fetching summary statistics" });
  }
};
