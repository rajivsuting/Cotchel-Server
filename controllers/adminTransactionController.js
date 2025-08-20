const Transaction = require("../models/transaction");
const Order = require("../models/order");
const User = require("../models/User");

// Get all transactions with filtering and pagination
exports.getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      status,
      sellerId,
      buyerId,
      search,
    } = req.query;

    // Build filter object
    const filter = {};

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Status filter
    if (status && status !== "all") {
      filter.status = status;
    }

    // Seller filter
    if (sellerId) {
      filter.seller = sellerId;
    }

    // Buyer filter
    if (buyerId) {
      filter.buyer = buyerId;
    }

    // Search filter (for transaction ID, buyer name, or seller name)
    if (search) {
      filter.$or = [
        { _id: search },
        { "buyer.fullName": { $regex: search, $options: "i" } },
        { "seller.fullName": { $regex: search, $options: "i" } },
        {
          "seller.sellerDetails.businessName": {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    console.log("Filter being used:", JSON.stringify(filter, null, 2));

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch transactions with populated buyer and seller details
    const transactions = await Transaction.find(filter)
      .populate("buyer", "fullName email")
      .populate({
        path: "seller",
        select: "fullName email sellerDetails",
        populate: {
          path: "sellerDetails",
          select: "businessName",
        },
      })
      .populate("order", "status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalTransactions = await Transaction.countDocuments(filter);

    // Calculate statistics
    const statistics = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalPlatformFee: { $sum: "$platformFee" },
          totalSellerAmount: { $sum: "$sellerAmount" },
          statusDistribution: {
            $push: "$status",
          },
          paymentMethodDistribution: {
            $push: "$paymentMethod",
          },
        },
      },
    ]);

    console.log("Statistics result:", JSON.stringify(statistics, null, 2));

    // Process statistics
    const stats = statistics[0] || {
      totalTransactions: 0,
      totalAmount: 0,
      totalPlatformFee: 0,
      totalSellerAmount: 0,
      statusDistribution: [],
      paymentMethodDistribution: [],
    };

    // Calculate status distribution
    const statusCount = {};
    stats.statusDistribution.forEach((status) => {
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    // Calculate payment method distribution
    const paymentMethodCount = {};
    stats.paymentMethodDistribution.forEach((method) => {
      paymentMethodCount[method] = (paymentMethodCount[method] || 0) + 1;
    });

    // Format transactions for response
    const formattedTransactions = transactions.map((transaction) => ({
      id: transaction._id,
      orderId: transaction.order?._id,
      buyer: {
        id: transaction.buyer?._id,
        name: transaction.buyer?.fullName,
        email: transaction.buyer?.email,
      },
      seller: {
        id: transaction.seller?._id,
        name:
          transaction.seller?.sellerDetails?.businessName ||
          transaction.seller?.fullName,
        businessName: transaction.seller?.sellerDetails?.businessName,
        personalName: transaction.seller?.fullName,
        email: transaction.seller?.email,
        isBusiness: !!transaction.seller?.sellerDetails?.businessName,
      },
      amount: transaction.amount,
      platformFee: transaction.platformFee,
      sellerAmount: transaction.sellerAmount,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      paymentDetails: transaction.paymentDetails,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
    }));

    res.status(200).json({
      message: "Transactions fetched successfully",
      data: {
        transactions: formattedTransactions,
        statistics: {
          totalTransactions: stats.totalTransactions,
          totalAmount: stats.totalAmount,
          totalPlatformFee: stats.totalPlatformFee,
          totalSellerAmount: stats.totalSellerAmount,
          statusDistribution: statusCount,
          paymentMethodDistribution: paymentMethodCount,
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTransactions / parseInt(limit)),
          totalTransactions,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      message: "Error fetching transactions",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get transaction statistics for dashboard
exports.getTransactionStats = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const now = new Date();
    let startDate;

    // Calculate start date based on period
    switch (period) {
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case "year":
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Get daily transaction amounts
    const dailyStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: "Completed",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          amount: { $sum: "$amount" },
          platformFee: { $sum: "$platformFee" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get top sellers
    const topSellers = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: "Completed",
        },
      },
      {
        $group: {
          _id: "$seller",
          totalAmount: { $sum: "$sellerAmount" },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "sellerDetails",
        },
      },
      {
        $unwind: "$sellerDetails",
      },
    ]);

    res.status(200).json({
      message: "Transaction statistics fetched successfully",
      data: {
        dailyStats,
        topSellers: topSellers.map((seller) => ({
          id: seller._id,
          name: seller.sellerDetails.fullName,
          totalAmount: seller.totalAmount,
          transactionCount: seller.transactionCount,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching transaction statistics:", error);
    res.status(500).json({
      message: "Error fetching transaction statistics",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get single transaction by ID
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id)
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
      .populate({
        path: "order",
        select: "status paymentStatus totalPrice products",
        populate: {
          path: "products.product",
          select: "title images featuredImage price",
        },
      })
      .lean();

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    // Format the transaction response
    const formattedTransaction = {
      id: transaction._id,
      order: {
        id: transaction.order?._id,
        status: transaction.order?.status,
        paymentStatus: transaction.order?.paymentStatus,
        totalPrice: transaction.order?.totalPrice,
        products: transaction.order?.products?.map((item) => ({
          productId: item.product?._id,
          name: item.product?.title,
          images: item.product?.images,
          featuredImage: item.product?.featuredImage,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
        })),
      },
      buyer: {
        id: transaction.buyer?._id,
        name: transaction.buyer?.fullName,
        email: transaction.buyer?.email,
        phone: transaction.buyer?.phone,
      },
      seller: {
        id: transaction.seller?._id,
        name: transaction.seller?.fullName,
        email: transaction.seller?.email,
        phone: transaction.seller?.phone,
        businessName: transaction.seller?.sellerDetails?.businessName,
        address: transaction.seller?.sellerDetails
          ? {
              addressLine1: transaction.seller.sellerDetails.addressLine1,
              addressLine2: transaction.seller.sellerDetails.addressLine2,
              city: transaction.seller.sellerDetails.city,
              state: transaction.seller.sellerDetails.state,
              postalCode: transaction.seller.sellerDetails.postalCode,
              country: transaction.seller.sellerDetails.country,
            }
          : null,
      },
      amount: transaction.amount,
      platformFee: transaction.platformFee,
      sellerAmount: transaction.sellerAmount,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      paymentDetails: transaction.paymentDetails,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
    };

    res.status(200).json({
      message: "Transaction details fetched successfully",
      data: formattedTransaction,
    });
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    res.status(500).json({
      message: "Error fetching transaction details",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get seller-specific transactions
exports.getSellerTransactions = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { page = 1, limit = 10, startDate, endDate, status } = req.query;

    console.log("Fetching transactions for seller:", sellerId);
    console.log("Query parameters:", {
      page,
      limit,
      startDate,
      endDate,
      status,
    });

    // Validate seller exists
    const seller = await User.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        message: "Seller not found",
      });
    }

    // Build filter object
    const filter = { seller: sellerId };

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Status filter
    if (status && status !== "all") {
      filter.status = status;
    }

    console.log("Filter being used:", JSON.stringify(filter, null, 2));

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch transactions with populated details
    const transactions = await Transaction.find(filter)
      .populate("buyer", "fullName email")
      .populate("order", "status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    console.log("Found transactions:", transactions.length);

    // Get total count for pagination
    const totalTransactions = await Transaction.countDocuments(filter);
    console.log("Total transactions count:", totalTransactions);

    // Calculate statistics directly from the transactions
    const stats = {
      totalTransactions: totalTransactions,
      totalAmount: 0,
      totalPlatformFee: 0,
      totalSellerAmount: 0,
      statusDistribution: [],
      paymentMethodDistribution: [],
      monthlyEarnings: [],
    };

    // Calculate totals from all transactions (not just the paginated ones)
    const allTransactions = await Transaction.find(filter).lean();

    allTransactions.forEach((transaction) => {
      stats.totalAmount += transaction.amount || 0;
      stats.totalPlatformFee += transaction.platformFee || 0;
      stats.totalSellerAmount += transaction.sellerAmount || 0;
      stats.statusDistribution.push(transaction.status);
      stats.paymentMethodDistribution.push(transaction.paymentMethod);

      if (transaction.createdAt) {
        const month = transaction.createdAt.getMonth() + 1;
        const year = transaction.createdAt.getFullYear();
        const key = `${year}-${month}`;
        if (!stats.monthlyEarnings[key]) {
          stats.monthlyEarnings[key] = 0;
        }
        stats.monthlyEarnings[key] += transaction.sellerAmount || 0;
      }
    });

    console.log("Calculated statistics:", JSON.stringify(stats, null, 2));

    // Calculate status distribution
    const statusCount = {};
    stats.statusDistribution.forEach((status) => {
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    // Calculate payment method distribution
    const paymentMethodCount = {};
    stats.paymentMethodDistribution.forEach((method) => {
      paymentMethodCount[method] = (paymentMethodCount[method] || 0) + 1;
    });

    // Format transactions for response
    const formattedTransactions = transactions.map((transaction) => ({
      id: transaction._id,
      orderId: transaction.order?._id,
      buyer: {
        id: transaction.buyer?._id,
        name: transaction.buyer?.fullName,
        email: transaction.buyer?.email,
      },
      amount: transaction.amount,
      platformFee: transaction.platformFee,
      sellerAmount: transaction.sellerAmount,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      paymentDetails: transaction.paymentDetails,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
    }));

    res.status(200).json({
      message: "Seller transactions fetched successfully",
      data: {
        seller: {
          id: seller._id,
          name: seller.fullName,
          email: seller.email,
        },
        transactions: formattedTransactions,
        statistics: {
          totalTransactions: stats.totalTransactions,
          totalAmount: stats.totalAmount,
          totalPlatformFee: stats.totalPlatformFee,
          totalSellerAmount: stats.totalSellerAmount,
          statusDistribution: statusCount,
          paymentMethodDistribution: paymentMethodCount,
          monthlyEarnings: stats.monthlyEarnings,
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTransactions / parseInt(limit)),
          totalTransactions,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching seller transactions:", error);
    res.status(500).json({
      message: "Error fetching seller transactions",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};
