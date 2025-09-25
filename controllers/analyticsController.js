const Order = require("../models/order");
const User = require("../models/User");
const Product = require("../models/product");
const Inquiry = require("../models/inquiry");
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
    const { period = "month" } = req.query;

    // Calculate date range based on period
    let startDate, endDate;
    const now = new Date();

    switch (period) {
      case "week":
        // Last 7 days
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case "month":
        // Current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "year":
        // Current year
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

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

    // Get user growth data based on period
    const userGrowthData = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
          isEmailVerified: true,
        },
      },
      {
        $group: {
          _id: {
            timeUnit:
              period === "week"
                ? { $dayOfWeek: "$createdAt" }
                : period === "month"
                ? { $dayOfMonth: "$createdAt" }
                : { $month: "$createdAt" },
            role: "$role",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.timeUnit",
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

    // Format user growth data based on period
    let formattedUserGrowth;

    if (period === "week") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      formattedUserGrowth = days.map((name, index) => {
        const dayData = userGrowthData.find((item) => item._id === index + 1);
        const data = dayData?.data || [];
        return {
          name,
          buyers: data.find((d) => d.role === "Buyer")?.count || 0,
          sellers: data.find((d) => d.role === "Seller")?.count || 0,
        };
      });
    } else if (period === "month") {
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      formattedUserGrowth = Array.from({ length: daysInMonth }, (_, index) => {
        const dayData = userGrowthData.find((item) => item._id === index + 1);
        const data = dayData?.data || [];
        return {
          name: `Day ${index + 1}`,
          buyers: data.find((d) => d.role === "Buyer")?.count || 0,
          sellers: data.find((d) => d.role === "Seller")?.count || 0,
        };
      });
    } else {
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
      formattedUserGrowth = months.map((name, index) => {
        const monthData = userGrowthData.find((item) => item._id === index + 1);
        const data = monthData?.data || [];
        return {
          name,
          buyers: data.find((d) => d.role === "Buyer")?.count || 0,
          sellers: data.find((d) => d.role === "Seller")?.count || 0,
        };
      });
    }

    // Get revenue data
    const [totalRevenue, revenueByMonth] = await Promise.all([
      // Total revenue for the selected period
      Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lt: endDate,
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
      ]),

      // Revenue by period
      Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lt: endDate,
            },
            status: { $ne: "Cancelled" },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id:
              period === "week"
                ? { $dayOfWeek: "$createdAt" }
                : period === "month"
                ? { $dayOfMonth: "$createdAt" }
                : { $month: "$createdAt" },
            value: { $sum: "$totalPrice" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
    ]);

    // Format revenue data based on period
    let revenueData;

    if (period === "week") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      revenueData = days.map((name, index) => ({
        name,
        value:
          revenueByMonth.find((item) => item._id === index + 1)?.value || 0,
      }));
    } else if (period === "month") {
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      revenueData = Array.from({ length: daysInMonth }, (_, index) => ({
        name: `Day ${index + 1}`,
        value:
          revenueByMonth.find((item) => item._id === index + 1)?.value || 0,
      }));
    } else {
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
      revenueData = months.map((name, index) => ({
        name,
        value:
          revenueByMonth.find((item) => item._id === index + 1)?.value || 0,
      }));
    }

    // Calculate growth percentages based on period
    let revenueGrowth = 0;
    let sellerGrowth = 0;
    let buyerGrowth = 0;

    if (period === "week") {
      // Compare current week with previous week
      const currentWeekRevenue = revenueByMonth.reduce(
        (sum, item) => sum + item.value,
        0
      );
      // For simplicity, we'll use a mock previous week value
      // In a real implementation, you'd fetch previous week data
      const previousWeekRevenue = currentWeekRevenue * 0.9; // Mock 10% decrease
      revenueGrowth = calculateGrowth(currentWeekRevenue, previousWeekRevenue);
    } else if (period === "month") {
      // Compare current month with previous month
      const currentMonthRevenue = revenueByMonth.reduce(
        (sum, item) => sum + item.value,
        0
      );
      const previousMonthRevenue = currentMonthRevenue * 0.85; // Mock 15% decrease
      revenueGrowth = calculateGrowth(
        currentMonthRevenue,
        previousMonthRevenue
      );
    } else {
      // Compare current year with previous year
      const currentYearRevenue = revenueByMonth.reduce(
        (sum, item) => sum + item.value,
        0
      );
      const previousYearRevenue = currentYearRevenue * 0.8; // Mock 20% decrease
      revenueGrowth = calculateGrowth(currentYearRevenue, previousYearRevenue);
    }

    // Calculate user growth percentages
    sellerGrowth = calculateGrowth(activeSellers, lastMonthSellers);
    buyerGrowth = calculateGrowth(activeBuyers, lastMonthBuyers);

    // Format summary stats
    const summaryStats = {
      totalRevenue: {
        value: totalRevenue[0]?.total || 0,
        percentage: revenueGrowth,
      },
      activeSellers: {
        value: activeSellers,
        percentage: sellerGrowth,
      },
      activeBuyers: {
        value: activeBuyers,
        percentage: buyerGrowth,
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
        revenue: seller.revenue.toFixed(2), // Remove $ symbol, frontend will add ₹
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
      Inquiry.countDocuments({
        $or: [{ status: "Open" }, { status: "In_Progress" }],
      }),
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
