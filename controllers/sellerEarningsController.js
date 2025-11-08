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

    // Get pending payout (transactions eligible for payout but not yet paid)
    // This includes transactions with payoutStatus: "Eligible" (delivered 7+ days ago)
    const pendingPayout = await Transaction.aggregate([
      {
        $match: {
          seller: sellerObjectId,
          status: "Completed",
          payoutStatus: { $in: ["Pending", "Eligible"] }, // Not yet paid out
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$sellerAmount" },
        },
      },
    ]);

    // Get last payout (most recent payout batch that was actually paid out)
    // This is based on payoutStatus: "Completed" (admin marked as paid after manual transfer)
    const lastPayoutTransaction = await Transaction.findOne({
      seller: sellerObjectId,
      status: "Completed",
      payoutStatus: "Completed", // Actually paid out
      payoutDate: { $exists: true }, // Has payout date
    }).sort({ payoutDate: -1 });

    // If there's a last payout, get the total amount of that payout batch
    let lastPayout = null;
    if (lastPayoutTransaction) {
      // Match by batchId if available, otherwise by payoutDate (for same seller)
      const matchCriteria = lastPayoutTransaction.payoutBatchId
        ? {
            seller: sellerObjectId,
            status: "Completed",
            payoutStatus: "Completed",
            payoutBatchId: lastPayoutTransaction.payoutBatchId,
          }
        : {
            seller: sellerObjectId,
            status: "Completed",
            payoutStatus: "Completed",
            payoutDate: lastPayoutTransaction.payoutDate,
          };

      const lastPayoutBatch = await Transaction.aggregate([
        {
          $match: matchCriteria,
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$sellerAmount" },
            payoutDate: { $first: "$payoutDate" },
            referenceNumber: { $first: "$payoutReferenceNumber" },
            batchId: { $first: "$payoutBatchId" },
          },
        },
      ]);

      if (lastPayoutBatch.length > 0) {
        lastPayout = {
          amount: lastPayoutBatch[0].totalAmount,
          date: lastPayoutBatch[0].payoutDate,
          referenceNumber: lastPayoutBatch[0].referenceNumber,
          batchId: lastPayoutBatch[0].batchId,
        };
      }
    }

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
      lastPayout: lastPayout, // Already formatted with amount, date, referenceNumber, batchId
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
