const Transaction = require("../models/transaction");
const mongoose = require("mongoose");

// Get seller earnings statistics
exports.getEarningsStats = async (req, res) => {
  try {
    const sellerId = req.user._id;

    // Convert string ID to ObjectId if needed
    const sellerObjectId =
      typeof sellerId === "string"
        ? new mongoose.Types.ObjectId(sellerId)
        : sellerId;

    // Get total earnings (all completed transactions)
    const totalEarnings = await Transaction.aggregate([
      {
        $match: {
          seller: sellerObjectId,
          status: "Completed",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$sellerAmount" },
        },
      },
    ]);

    // Get pending payout (earnings from last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pendingPayout = await Transaction.aggregate([
      {
        $match: {
          seller: sellerObjectId,
          status: "Completed",
          completedAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$sellerAmount" },
        },
      },
    ]);

    // Get last payout (most recent completed transaction)
    const lastPayout = await Transaction.findOne({
      seller: sellerObjectId,
      status: "Completed",
    }).sort({ completedAt: -1 });
    console.log("4. Last payout found:", lastPayout);

    // Get active orders count (pending transactions)
    const activeOrders = await Transaction.countDocuments({
      seller: sellerObjectId,
      status: "Pending",
    });

    // Get earnings growth percentage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const last30DaysEarnings = await Transaction.aggregate([
      {
        $match: {
          seller: sellerObjectId,
          status: "Completed",
          completedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$sellerAmount" },
        },
      },
    ]);

    const previous30DaysEarnings = await Transaction.aggregate([
      {
        $match: {
          seller: sellerObjectId,
          status: "Completed",
          completedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$sellerAmount" },
        },
      },
    ]);

    const currentPeriodEarnings = last30DaysEarnings[0]?.total || 0;
    const previousPeriodEarnings = previous30DaysEarnings[0]?.total || 0;

    // Calculate growth percentage
    let growthPercentage = 0;
    if (previousPeriodEarnings > 0) {
      growthPercentage =
        ((currentPeriodEarnings - previousPeriodEarnings) /
          previousPeriodEarnings) *
        100;
    } else if (currentPeriodEarnings > 0) {
      growthPercentage = 100;
    }

    // Calculate next payout date (7 days from now)
    const nextPayoutDate = new Date();
    nextPayoutDate.setDate(nextPayoutDate.getDate() + 7);

    // Debug: Log all completed transactions for this seller
    const allCompletedTransactions = await Transaction.find({
      seller: sellerObjectId,
      status: "Completed",
    });

    // Prepare response data
    const responseData = {
      totalEarnings: totalEarnings[0]?.total || 0,
      pendingPayout: pendingPayout[0]?.total || 0,
      lastPayout: lastPayout
        ? {
            amount: lastPayout.sellerAmount,
            date: lastPayout.completedAt,
          }
        : null,
      activeOrders,
      growthPercentage: Math.round(growthPercentage * 100) / 100,
      nextPayoutDate,
    };

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error in getEarningsStats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching earnings statistics",
      error: error.message,
    });
  }
};

// Get seller transaction history
exports.getTransactionHistory = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { seller: sellerId };
    if (status) {
      query.status = status;
    }

    const transactions = await Transaction.find(query)
      .populate("order", "orderNumber")
      .populate("buyer", "fullName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalTransactions = await Transaction.countDocuments(query);

    const formattedTransactions = transactions.map((transaction) => ({
      id: transaction._id,
      orderId: transaction.order?.orderNumber,
      buyer: {
        name: transaction.buyer?.fullName,
        email: transaction.buyer?.email,
      },
      amount: transaction.sellerAmount,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      date: transaction.completedAt || transaction.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTransactions / limit),
          totalTransactions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transaction history",
    });
  }
};
