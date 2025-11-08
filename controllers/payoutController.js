/**
 * Payout Controller - Weekly Manual Payouts
 * Production-ready system for admin to manage seller payouts
 */

const Transaction = require("../models/transaction");
const Order = require("../models/order");
const User = require("../models/User");
const mongoose = require("mongoose");
const NotificationService = require("../services/notificationService");

/**
 * Get pending payouts for all sellers (Admin only)
 * Groups by seller, shows total eligible amount
 */
exports.getPendingPayouts = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Debug: Log the query criteria
    console.log("[PAYOUT DEBUG] Query Criteria:", {
      sevenDaysAgo: sevenDaysAgo.toISOString(),
      lookingForDeliveredBefore: sevenDaysAgo.toLocaleDateString(),
    });

    // Debug: Check all delivered orders regardless of date
    const allDeliveredOrders = await Order.find({
      status: "Delivered",
      paymentStatus: "Paid",
    })
      .select("_id status deliveredAt")
      .lean();

    console.log("[PAYOUT DEBUG] All delivered orders count:", allDeliveredOrders.length);
    if (allDeliveredOrders.length > 0) {
      console.log("[PAYOUT DEBUG] Sample delivered orders:", allDeliveredOrders.slice(0, 3));
    }

    // Debug: Check all transactions
    const allTransactions = await Transaction.find({})
      .select("_id order status payoutStatus payoutEligibleDate")
      .limit(5)
      .lean();

    console.log("[PAYOUT DEBUG] Sample transactions:", allTransactions);

    // Find eligible orders (delivered 7+ days ago)
    const eligibleOrders = await Order.find({
      status: "Delivered",
      deliveredAt: { $lte: sevenDaysAgo }, // Delivered 7+ days ago
      paymentStatus: "Paid",
    })
      .populate("seller", "fullName email")
      .populate("buyer", "fullName")
      .lean();

    console.log("[PAYOUT DEBUG] Found eligible orders:", eligibleOrders.length);

    // Get transactions for these orders
    const orderIds = eligibleOrders.map((order) => order._id);
    const transactions = await Transaction.find({
      order: { $in: orderIds },
      status: "Completed",
      payoutStatus: { $in: ["Pending", "Eligible"] }, // Not yet paid out
    }).lean();

    console.log("[PAYOUT DEBUG] Found transactions for eligible orders:", transactions.length);

    // Create a map of orderId -> transaction
    const transactionMap = {};
    transactions.forEach((txn) => {
      transactionMap[txn.order.toString()] = txn;
    });

    // Group by seller with bank details
    const sellerPayouts = {};

    for (const order of eligibleOrders) {
      const transaction = transactionMap[order._id.toString()];
      if (!transaction) continue; // Skip if no transaction

      const sellerId = order.seller._id.toString();

      if (!sellerPayouts[sellerId]) {
        // Fetch seller details with bank info
        const seller = await User.findById(sellerId)
          .populate("sellerDetails")
          .lean();

        sellerPayouts[sellerId] = {
          sellerId,
          sellerName: seller.fullName,
          sellerEmail: seller.email,
          bankDetails: {
            bankName: seller.sellerDetails?.bankName || "Not provided",
            accountName: seller.sellerDetails?.accountName || "Not provided",
            accountNumber: seller.sellerDetails?.accountNumber || "Not provided",
            ifscCode: seller.sellerDetails?.ifscCode || "Not provided",
            branch: seller.sellerDetails?.branch || "N/A",
          },
          hasBankDetails: !!(
            seller.sellerDetails?.bankName &&
            seller.sellerDetails?.accountNumber &&
            seller.sellerDetails?.ifscCode
          ),
          totalAmount: 0,
          orderCount: 0,
          orders: [],
          transactions: [],
        };
      }

      sellerPayouts[sellerId].totalAmount += transaction.sellerAmount;
      sellerPayouts[sellerId].orderCount += 1;
      sellerPayouts[sellerId].orders.push({
        orderId: order._id,
        orderNumber: order._id.toString().slice(-8).toUpperCase(),
        buyerName: order.buyer?.fullName,
        amount: order.totalPrice,
        sellerAmount: transaction.sellerAmount,
        platformFee: transaction.platformFee,
        deliveredAt: order.deliveredAt,
      });
      sellerPayouts[sellerId].transactions.push(transaction._id);
    }

    // Convert to array and sort by amount (highest first)
    const payoutsList = Object.values(sellerPayouts)
      .filter((payout) => payout.totalAmount >= 100) // Minimum ₹100
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const totalPayoutAmount = payoutsList.reduce(
      (sum, payout) => sum + payout.totalAmount,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        payouts: payoutsList,
        summary: {
          totalSellers: payoutsList.length,
          totalAmount: totalPayoutAmount,
          totalOrders: payoutsList.reduce((sum, p) => sum + p.orderCount, 0),
          generatedAt: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching pending payouts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending payouts",
      error: error.message,
    });
  }
};

/**
 * Export pending payouts as CSV (for bank transfers)
 */
exports.exportPayoutsCSV = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const eligibleOrders = await Order.find({
      status: "Delivered",
      deliveredAt: { $lte: sevenDaysAgo },
      paymentStatus: "Paid",
    })
      .populate("seller", "fullName email")
      .lean();

    const orderIds = eligibleOrders.map((order) => order._id);
    const transactions = await Transaction.find({
      order: { $in: orderIds },
      status: "Completed",
      payoutStatus: { $in: ["Pending", "Eligible"] },
    }).lean();

    const transactionMap = {};
    transactions.forEach((txn) => {
      transactionMap[txn.order.toString()] = txn;
    });

    const sellerPayouts = {};

    for (const order of eligibleOrders) {
      const transaction = transactionMap[order._id.toString()];
      if (!transaction) continue;

      const sellerId = order.seller._id.toString();

      if (!sellerPayouts[sellerId]) {
        const seller = await User.findById(sellerId)
          .populate("sellerDetails")
          .lean();

        sellerPayouts[sellerId] = {
          sellerName: seller.fullName,
          sellerEmail: seller.email,
          bankName: seller.sellerDetails?.bankName || "",
          accountName: seller.sellerDetails?.accountName || "",
          accountNumber: seller.sellerDetails?.accountNumber || "",
          ifscCode: seller.sellerDetails?.ifscCode || "",
          branch: seller.sellerDetails?.branch || "",
          totalAmount: 0,
          orderCount: 0,
        };
      }

      sellerPayouts[sellerId].totalAmount += transaction.sellerAmount;
      sellerPayouts[sellerId].orderCount += 1;
    }

    // Generate CSV
    const csvRows = [];
    csvRows.push([
      "Seller Name",
      "Email",
      "Bank Name",
      "Account Name",
      "Account Number",
      "IFSC Code",
      "Branch",
      "Payout Amount",
      "Order Count",
      "Status",
    ]);

    Object.values(sellerPayouts)
      .filter((p) => p.totalAmount >= 100)
      .forEach((payout) => {
        csvRows.push([
          payout.sellerName,
          payout.sellerEmail,
          payout.bankName,
          payout.accountName,
          payout.accountNumber,
          payout.ifscCode,
          payout.branch,
          payout.totalAmount.toFixed(2),
          payout.orderCount,
          payout.accountNumber ? "Ready" : "Missing Bank Details",
        ]);
      });

    const csv = csvRows.map((row) => row.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payouts_${new Date().toISOString().split("T")[0]}.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error("Error exporting payouts CSV:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export payouts",
      error: error.message,
    });
  }
};

/**
 * Mark payouts as completed (after manual transfer)
 */
exports.markPayoutsCompleted = async (req, res) => {
  try {
    const { sellerIds, batchId, referenceNumbers, notes } = req.body;

    if (!sellerIds || !Array.isArray(sellerIds) || sellerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Seller IDs are required",
      });
    }

    const batchIdGenerated =
      batchId || `PAYOUT_${new Date().toISOString().split("T")[0]}_${Date.now()}`;
    const payoutDate = new Date();

    // Update transactions for all sellers
    let totalUpdated = 0;

    for (let i = 0; i < sellerIds.length; i++) {
      const sellerId = sellerIds[i];
      const referenceNumber = referenceNumbers?.[i] || `REF_${Date.now()}_${i}`;

      const result = await Transaction.updateMany(
        {
          seller: sellerId,
          status: "Completed",
          payoutStatus: { $in: ["Pending", "Eligible"] },
        },
        {
          $set: {
            payoutStatus: "Completed",
            payoutDate,
            payoutBatchId: batchIdGenerated,
            payoutReferenceNumber: referenceNumber,
            payoutMethod: "Manual",
            payoutNotes: notes || "Manual bank transfer",
          },
        }
      );

      totalUpdated += result.modifiedCount;

      // Notify seller
      const transactions = await Transaction.find({
        seller: sellerId,
        payoutBatchId: batchIdGenerated,
      });

      const totalPaidAmount = transactions.reduce(
        (sum, txn) => sum + txn.sellerAmount,
        0
      );

      if (totalPaidAmount > 0) {
        await NotificationService.createNotification({
          type: "new_order", // Reusing type
          sellerId: sellerId,
          message: `💰 Payout Completed! ₹${totalPaidAmount.toFixed(2)} has been credited to your bank account. Reference: ${referenceNumber}`,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Payouts marked as completed for ${sellerIds.length} sellers`,
      data: {
        batchId: batchIdGenerated,
        totalTransactionsUpdated: totalUpdated,
        payoutDate,
      },
    });
  } catch (error) {
    console.error("Error marking payouts completed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark payouts as completed",
      error: error.message,
    });
  }
};

/**
 * Get payout history (Admin only)
 */
exports.getPayoutHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    const filter = { payoutStatus: "Completed" };

    if (startDate || endDate) {
      filter.payoutDate = {};
      if (startDate) filter.payoutDate.$gte = new Date(startDate);
      if (endDate) filter.payoutDate.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate("seller", "fullName email")
      .populate("order", "_id")
      .sort({ payoutDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalTransactions = await Transaction.countDocuments(filter);

    // Group by batch
    const batches = {};
    transactions.forEach((txn) => {
      const batchId = txn.payoutBatchId || "Unknown";
      if (!batches[batchId]) {
        batches[batchId] = {
          batchId,
          payoutDate: txn.payoutDate,
          sellers: new Set(),
          totalAmount: 0,
          transactionCount: 0,
        };
      }
      batches[batchId].sellers.add(txn.seller._id.toString());
      batches[batchId].totalAmount += txn.sellerAmount;
      batches[batchId].transactionCount += 1;
    });

    const batchesArray = Object.values(batches).map((batch) => ({
      ...batch,
      sellerCount: batch.sellers.size,
      sellers: undefined, // Remove Set from response
    }));

    res.status(200).json({
      success: true,
      data: {
        transactions,
        batches: batchesArray,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTransactions / limit),
          totalTransactions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching payout history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payout history",
      error: error.message,
    });
  }
};

/**
 * Update order delivered dates to make transactions eligible
 * (Called automatically when order is delivered)
 */
exports.makeTransactionEligible = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order || order.status !== "Delivered") return;

    const transaction = await Transaction.findOne({ order: orderId });
    if (!transaction) return;

    // Calculate eligible date (7 days after delivery)
    const eligibleDate = new Date(order.deliveredAt);
    eligibleDate.setDate(eligibleDate.getDate() + 7);

    transaction.payoutStatus = "Eligible";
    transaction.payoutEligibleDate = eligibleDate;
    await transaction.save();

    console.log(`✅ Transaction ${transaction._id} marked eligible for payout on ${eligibleDate.toLocaleDateString()}`);
  } catch (error) {
    console.error("Error making transaction eligible:", error);
  }
};

