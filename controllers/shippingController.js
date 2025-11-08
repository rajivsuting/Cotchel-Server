const axios = require("axios");
const { authenticateShiprocket } = require("../services/shiprocketService");
const Cart = require("../models/cartModel");
const Product = require("../models/product");
const Address = require("../models/address");

const SHIPROCKET_API_URL = "https://apiv2.shiprocket.in/v1/external";

/**
 * Calculate shipping fee for cart
 */
exports.calculateShippingFee = async (req, res) => {
  try {
    const { addressId } = req.body;
    const { _id: userId } = req.user;

    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }

    // Fetch address and cart
    const [address, cart] = await Promise.all([
      Address.findById(addressId),
      Cart.findOne({ user: userId }).populate("items.productId"),
    ]);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // CRITICAL: Calculate total weight for ALL products in cart
    const totalWeight = cart.items.reduce((sum, item) => {
      if (!item.productId.weight) {
        throw new Error(`Product ${item.productId.title} is missing weight information`);
      }
      return sum + item.productId.weight * item.quantity;
    }, 0);

    console.log("📦 Cart shipping calculation:", {
      totalWeight: `${totalWeight}kg`,
      itemCount: cart.items.length,
      totalQuantity: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    });

    // Get seller's pickup pincode (from first product's seller)
    const Product = require("../models/product");
    const User = require("../models/User");
    
    const firstCartItem = cart.items[0];
    const product = await Product.findById(firstCartItem.productId._id).populate({
      path: "user",
      select: "sellerDetails",
      populate: {
        path: "sellerDetails",
        select: "postalCode",
      },
    });

    if (!product?.user?.sellerDetails?.postalCode) {
      throw new Error("Seller postal code not found. Please update seller profile.");
    }

    const pickupPincode = product.user.sellerDetails.postalCode;
    console.log(`📍 Pickup location: ${pickupPincode}`);

    // Calculate shipping via Shiprocket
    try {
      const token = await authenticateShiprocket();
      const response = await axios.get(
        `${SHIPROCKET_API_URL}/courier/serviceability`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          params: {
            pickup_postcode: pickupPincode,
            delivery_postcode: address.postalCode,
            weight: totalWeight,
            cod: 0, // Prepaid
          },
          timeout: 10000,
        }
      );

      const couriers =
        response.data?.data?.available_courier_companies || [];
      
      if (couriers.length === 0) {
        return res.status(200).json({
          success: true,
          message: "Shipping calculated",
          data: {
            shippingFee: 0,
            isFreeShipping: true,
            estimatedDays: 5,
            message: "Free shipping available",
          },
        });
      }

      // Get cheapest courier
      const cheapestCourier = couriers.sort(
        (a, b) => a.freight_charge - b.freight_charge
      )[0];

      res.status(200).json({
        success: true,
        message: "Shipping calculated successfully",
        data: {
          shippingFee: cheapestCourier.freight_charge,
          isFreeShipping: cheapestCourier.freight_charge === 0,
          estimatedDays: cheapestCourier.estimated_delivery_days,
          courierName: cheapestCourier.courier_name,
          etd: cheapestCourier.etd,
        },
      });
    } catch (shiprocketError) {
      console.error("Shiprocket serviceability error:", shiprocketError.response?.data || shiprocketError.message);
      
      // Fallback to default shipping fee if Shiprocket fails
      res.status(200).json({
        success: true,
        message: "Using default shipping",
        data: {
          shippingFee: 0,
          isFreeShipping: true,
          estimatedDays: 5,
          message: "Free shipping",
        },
      });
    }
  } catch (error) {
    console.error("Error calculating shipping fee:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate shipping fee",
      error: error.message,
    });
  }
};

/**
 * Generate shipping label for seller
 */
exports.generateShippingLabel = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { _id: userId } = req.user;

    const Order = require("../models/order");
    const order = await Order.findOne({
      _id: orderId,
      seller: userId,
    }).populate("products.product");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "Packed" && order.status !== "Processing") {
      return res.status(400).json({
        success: false,
        message: "Order must be in Packed or Processing status",
      });
    }

    // If shipment already exists, just return the label
    if (order.shipmentId && order.awbCode) {
      return res.status(200).json({
        success: true,
        message: "Label already generated",
        data: {
          awbCode: order.awbCode,
          courierName: order.courierName,
          trackingUrl: order.trackingUrl,
          shipmentId: order.shipmentId,
        },
      });
    }

    // Create shipment in Shiprocket
    const orderController = require("./orderController");
    const shipmentData = await orderController.createShiprocketShipment(order);

    res.status(200).json({
      success: true,
      message: "Shipping label generated successfully",
      data: {
        shipmentId: order.shipmentId,
        awbCode: order.awbCode,
        courierName: order.courierName,
        trackingUrl: order.trackingUrl,
      },
    });
  } catch (error) {
    console.error("Error generating shipping label:", error);
    
    // Check if it's a wallet balance error (admin issue, not seller issue)
    if (error.message?.includes("wallet") || 
        error.message?.includes("recharge") ||
        error.message?.includes("Platform shipping configuration")) {
      return res.status(503).json({
        success: false,
        message: "Unable to generate shipping label at this time. Our team has been notified and is working to resolve this. Please try again in a few minutes.",
        errorType: "PLATFORM_ISSUE",
      });
    }
    
    // Generic error for sellers
    res.status(500).json({
      success: false,
      message: "Failed to generate shipping label. Please contact support if this issue persists.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Schedule courier pickup for seller
 */
exports.schedulePickup = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { pickupDate, pickupTime } = req.body;
    const { _id: userId } = req.user;

    const Order = require("../models/order");
    const order = await Order.findOne({
      _id: orderId,
      seller: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!order.shipmentId) {
      return res.status(400).json({
        success: false,
        message: "Generate shipping label first",
      });
    }

    // Schedule pickup with Shiprocket
    const token = await authenticateShiprocket();
    const pickupResponse = await axios.post(
      `${SHIPROCKET_API_URL}/courier/generate/pickup`,
      {
        shipment_id: [order.shipmentId],
        pickup_date: pickupDate || new Date().toISOString().split("T")[0],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Pickup scheduled:", pickupResponse.data);

    res.status(200).json({
      success: true,
      message: "Pickup scheduled successfully",
      data: pickupResponse.data,
    });
  } catch (error) {
    console.error("Error scheduling pickup:", error);
    res.status(500).json({
      success: false,
      message: "Failed to schedule pickup",
      error: error.response?.data || error.message,
    });
  }
};

module.exports = exports;

