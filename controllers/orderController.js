const Order = require("../models/order");
const Cart = require("../models/cartModel");
const Product = require("../models/product");
const Razorpay = require("razorpay");
const paymentService = require("../services/paymentService");
const crypto = require("crypto");
const User = require("../models/User");
const axios = require("axios");
const Address = require("../models/address");
const mongoose = require("mongoose");
const Review = require("../models/reviewSchema"); // Import the Review model
const { OrderError, PaymentError } = require("../utils/errors");
const { authenticateShiprocket } = require("../services/shiprocketService");
const Transaction = require("../models/transaction");
const PlatformSettings = require("../models/platformSettings");
const NotificationService = require("../services/notificationService");
const OrderEmailService = require("../services/orderEmailService");

const SHIPROCKET_API_URL = "https://apiv2.shiprocket.in/v1/external";

// Export for use in shipping controller
exports.createShiprocketShipment = async function createShiprocketShipment(
  order
) {
  try {
    console.log("=== Starting Shiprocket Shipment Creation ===");
    console.log("Order ID:", order._id);

    // Get authentication token
    console.log("Attempting to authenticate with Shiprocket...");
    const token = await authenticateShiprocket();
    console.log("✅ Shiprocket authentication successful, token received");

    // Get buyer details
    console.log("Fetching buyer details...");
    const buyer = await User.findById(order.buyer).select("email name");
    if (!buyer?.email) {
      console.error("❌ Buyer email missing for order:", order._id);
      throw new Error("Buyer email is required for shipment");
    }
    console.log("✅ Buyer details retrieved:", {
      email: buyer.email,
      name: buyer.name,
    });

    // Get seller details with populated sellerDetails
    console.log("Fetching seller details...");
    const seller = await User.findById(order.seller)
      .select("name email phoneNumber sellerDetails")
      .populate("sellerDetails");

    if (!seller) {
      console.error("❌ Seller not found for order:", order._id);
      throw new Error("Seller not found");
    }

    if (!seller.sellerDetails) {
      console.error(
        "❌ Seller business details missing for seller:",
        seller._id
      );
      throw new Error("Seller business details not found");
    }
    console.log("✅ Seller details retrieved:", {
      email: seller.email,
      name: seller.name,
      businessName: seller.sellerDetails?.businessName,
    });

    // Get first product for dimensions
    console.log("Fetching product details...");
    const firstProduct = await Product.findById(order.products[0].product);
    if (!firstProduct) {
      console.error("❌ Product not found for order:", order._id);
      throw new Error("Product not found");
    }
    console.log("✅ Product details retrieved:", {
      title: firstProduct.title,
      dimensions: {
        length: firstProduct.length,
        breadth: firstProduct.breadth,
        height: firstProduct.height,
        weight: firstProduct.weight,
      },
    });

    // CRITICAL: Calculate total weight for ALL products (not just first)
    let totalWeight = 0;
    let maxLength = 0;
    let maxBreadth = 0;
    let maxHeight = 0;

    for (const item of order.products) {
      const product = await Product.findById(item.product);
      if (!product) {
        throw new Error(`Product ${item.product} not found in order`);
      }
      // Sum weight of all items (weight × quantity)
      totalWeight += product.weight * item.quantity;
      // Track maximum dimensions for package size
      maxLength = Math.max(maxLength, product.length);
      maxBreadth = Math.max(maxBreadth, product.breadth);
      maxHeight = Math.max(maxHeight, product.height);
    }

    console.log("📦 Calculated shipping package:", {
      totalWeight: `${totalWeight}kg`,
      dimensions: `${maxLength}×${maxBreadth}×${maxHeight}cm`,
      productCount: order.products.length,
      totalItems: order.products.reduce((sum, item) => sum + item.quantity, 0),
    });

    // First, get available pickup locations
    console.log("Fetching pickup locations from Shiprocket...");
    const pickupLocationsResponse = await axios.get(
      `${SHIPROCKET_API_URL}/settings/company/pickup`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Pickup Locations Response:",
      JSON.stringify(pickupLocationsResponse.data, null, 2)
    );

    if (!pickupLocationsResponse.data?.data?.shipping_address?.length) {
      console.error("❌ No pickup locations found in Shiprocket");
      throw new Error("No pickup locations found in Shiprocket");
    }

    // Use the first shipping address as pickup location
    const shippingAddress =
      pickupLocationsResponse.data.data.shipping_address[0];
    const pickupLocation = shippingAddress.pickup_location;
    console.log("✅ Selected Pickup Location:", pickupLocation);
    console.log("✅ Pickup Location Details:", {
      name: shippingAddress.pickup_location,
      address: `${shippingAddress.address}, ${shippingAddress.address_2}`,
      city: shippingAddress.city,
      state: shippingAddress.state,
      pincode: shippingAddress.pin_code,
    });

    const shipmentData = {
      order_id: order._id.toString(),
      order_date: new Date(order.createdAt)
        .toISOString()
        .substring(0, 19)
        .replace("T", " "),
      pickup_location: pickupLocation,
      billing_customer_name: order.address.name,
      billing_last_name: "",
      billing_address: order.address.street,
      billing_city: order.address.city,
      billing_pincode: order.address.pincode,
      billing_state: order.address.state,
      billing_country: order.address.country || "India",
      billing_email: buyer.email,
      billing_phone: order.address.phone,
      shipping_is_billing: true,
      order_items: await Promise.all(
        order.products.map(async (item) => {
          const product = await Product.findById(item.product);
          if (!product) {
            throw new Error(`Product ${item.product} not found`);
          }
          return {
            name: product.title,
            sku: product.sku,
            units: item.quantity,
            selling_price: item.price,
            hsn: 8471, // Default HSN for electronics (can be made dynamic later)
          };
        })
      ),
      payment_method: "Prepaid",
      sub_total: order.totalPrice,
      length: maxLength,
      breadth: maxBreadth,
      height: maxHeight,
      weight: totalWeight,
    };

    console.log(
      "Preparing to create Shiprocket order with data:",
      JSON.stringify(shipmentData, null, 2)
    );

    console.log("Making API call to create Shiprocket order...");
    const response = await axios.post(
      `${SHIPROCKET_API_URL}/orders/create/adhoc`,
      shipmentData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Shiprocket API Response:",
      JSON.stringify(response.data, null, 2)
    );

    if (!response.data || !response.data.shipment_id) {
      console.error("❌ Invalid response from Shiprocket API:", response.data);
      throw new Error("Invalid response from Shiprocket API");
    }

    // Update order with Shiprocket details
    console.log("Updating order with Shiprocket details...");
    order.shipmentId = response.data.shipment_id;
    order.shiprocketOrderId = response.data.order_id;
    await order.save();
    console.log("✅ Order updated with Shiprocket details:", {
      shipmentId: order.shipmentId,
      shiprocketOrderId: order.shiprocketOrderId,
    });

    // Step 2: Assign courier in background (non-blocking for faster checkout)
    setImmediate(async () => {
      try {
        console.log(
          `[Background] Assigning courier for shipment ${order.shipmentId}...`
        );
        const serviceabilityResponse = await axios.get(
          `${SHIPROCKET_API_URL}/courier/serviceability`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            params: {
              pickup_postcode: shippingAddress.pin_code,
              delivery_postcode: order.address.pincode,
              weight: totalWeight,
              cod: 0,
            },
            timeout: 10000, // 10 second timeout
          }
        );

        const couriers =
          serviceabilityResponse.data?.data?.available_courier_companies || [];
        if (couriers.length > 0) {
          const bestCourier = couriers.sort(
            (a, b) => a.freight_charge - b.freight_charge
          )[0];
          console.log(
            `[Background] Selected courier: ${bestCourier.courier_name} - ₹${bestCourier.freight_charge}`
          );

          const awbResponse = await axios.post(
            `${SHIPROCKET_API_URL}/courier/assign/awb`,
            {
              shipment_id: order.shipmentId,
              courier_id: bestCourier.courier_company_id,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              timeout: 10000,
            }
          );

          console.log(
            "[Background] AWB Response:",
            JSON.stringify(awbResponse.data, null, 2)
          );

          // Check for Shiprocket wallet balance error
          if (
            awbResponse.data?.status_code === 350 ||
            awbResponse.data?.message?.includes("recharge") ||
            awbResponse.data?.response?.data?.awb_assign_error?.includes(
              "recharge"
            )
          ) {
            console.error("❌ [CRITICAL] SHIPROCKET WALLET BALANCE LOW!");
            console.error("❌ Message:", awbResponse.data.message);

            // Alert ADMIN (not seller) about wallet issue
            const AdminAlertService = require("../services/adminAlertService");
            const orderToUpdate = await Order.findById(order._id);

            if (orderToUpdate) {
              const seller = await User.findById(orderToUpdate.seller)
                .select("fullName sellerDetails")
                .populate("sellerDetails");
              const sellerName =
                seller?.sellerDetails?.businessName ||
                seller?.fullName ||
                "Unknown Seller";

              // Send critical alert to admin
              await AdminAlertService.alertShiprocketWalletLow(
                orderToUpdate._id.toString(),
                sellerName
              );
            }

            throw new Error(
              "Platform shipping configuration issue. Our team has been notified and will resolve this shortly."
            );
          }

          // Handle different Shiprocket AWB response structures
          let awbCode = null;
          let trackingUrl = null;
          let edd = null;

          // Try different response structures from Shiprocket
          if (
            awbResponse.data?.awb_assign_status === 1 ||
            awbResponse.data?.success === true
          ) {
            // Common structure 1: Direct in response
            const responseData =
              awbResponse.data.response?.data || awbResponse.data;
            awbCode =
              responseData.awb_code ||
              responseData.awb ||
              responseData.awb_number;
            trackingUrl =
              responseData.label_url ||
              responseData.manifest_url ||
              responseData.tracking_url;
            edd = responseData.edd || responseData.estimated_delivery_date;
          } else if (awbResponse.data?.response?.data) {
            // Common structure 2: Nested in response.data
            const nestedData = awbResponse.data.response.data;
            awbCode =
              nestedData.awb_code || nestedData.awb || nestedData.awb_number;
            trackingUrl = nestedData.label_url || nestedData.manifest_url;
            edd = nestedData.edd;
          } else if (awbResponse.data?.awb_data) {
            // Common structure 3: In awb_data
            awbCode = awbResponse.data.awb_data.awb_code;
            trackingUrl = awbResponse.data.awb_data.label_url;
          }

          console.log("[Background] Extracted AWB:", {
            awbCode,
            trackingUrl,
            edd,
            rawStructure: Object.keys(awbResponse.data),
          });

          if (awbCode && awbCode !== "TEMP") {
            const orderToUpdate = await Order.findById(order._id);
            if (orderToUpdate) {
              orderToUpdate.awbCode = awbCode;
              orderToUpdate.courierName = bestCourier.courier_name;
              orderToUpdate.trackingUrl = trackingUrl;
              orderToUpdate.estimatedDeliveryDate = edd ? new Date(edd) : null;

              // Auto-transition to "Packed" once AWB is assigned (ready for pickup)
              if (
                orderToUpdate.status === "Confirmed" ||
                orderToUpdate.status === "Processing"
              ) {
                orderToUpdate.status = "Packed";
                orderToUpdate.packedAt = new Date();
                orderToUpdate.statusHistory.push({
                  status: "Packed",
                  note: "Order ready for pickup - Courier assigned and pickup scheduled",
                  timestamp: new Date(),
                });
                console.log(
                  `✅ [Auto] Order ${orderToUpdate._id} auto-transitioned to Packed`
                );
              }

              await orderToUpdate.save();
              console.log(
                `✅ [Background] Courier assigned: ${orderToUpdate.courierName}, AWB: ${orderToUpdate.awbCode}`
              );

              // Emit real-time order update
              const { notifyOrderUpdate } = require("../utils/emitOrderUpdate");
              await notifyOrderUpdate(orderToUpdate);

              // Notify seller that courier is assigned and order is ready for pickup
              const NotificationService = require("../services/notificationService");
              await NotificationService.createNotification({
                type: "courier_assigned",
                sellerId: orderToUpdate.seller,
                orderId: orderToUpdate._id,
                message: `🚚 Courier assigned: ${orderToUpdate.courierName}. AWB: ${orderToUpdate.awbCode}. Pack your order - Pickup will be scheduled automatically.`,
              });

              // Schedule pickup automatically (1 day from now by default)
              try {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(10, 0, 0, 0); // 10 AM tomorrow

                const pickupResponse = await axios.post(
                  `${SHIPROCKET_API_URL}/courier/generate/pickup`,
                  {
                    shipment_id: [orderToUpdate.shipmentId],
                    pickup_date: tomorrow.toISOString().split("T")[0],
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                    },
                    timeout: 10000,
                  }
                );

                // Save pickup date to order
                orderToUpdate.scheduledPickupDate = tomorrow;
                orderToUpdate.pickupTime = "10:00 AM";
                await orderToUpdate.save();

                // Emit real-time order update
                const {
                  notifyOrderUpdate,
                } = require("../utils/emitOrderUpdate");
                await notifyOrderUpdate(orderToUpdate);

                // Update notification with pickup details
                await NotificationService.createNotification({
                  type: "pickup_scheduled",
                  sellerId: orderToUpdate.seller,
                  orderId: orderToUpdate._id,
                  message: `📅 Pickup scheduled: ${tomorrow.toLocaleDateString(
                    "en-US",
                    { weekday: "long", month: "short", day: "numeric" }
                  )} at 10:00 AM. Courier: ${
                    orderToUpdate.courierName
                  }. Keep your packed order ready!`,
                });

                console.log(
                  `✅ [Auto] Pickup scheduled for ${tomorrow.toDateString()} at 10:00 AM`
                );
              } catch (pickupError) {
                console.log(
                  `⚠️ [Auto] Pickup scheduling failed (seller can schedule manually):`,
                  pickupError.response?.data?.message || pickupError.message
                );
              }
            }
          } else {
            console.warn(
              `⚠️ [Background] Failed to extract AWB code from Shiprocket response`
            );
            console.warn(
              `⚠️ Shiprocket may still have assigned AWB. Check Shiprocket dashboard for shipment ${order.shipmentId}`
            );

            // Still update order with courier info even without AWB
            const orderToUpdate = await Order.findById(order._id);
            if (orderToUpdate) {
              orderToUpdate.courierName = bestCourier.courier_name;
              orderToUpdate.status = "Packed";
              orderToUpdate.packedAt = new Date();
              orderToUpdate.statusHistory.push({
                status: "Packed",
                note: `Courier assigned: ${bestCourier.courier_name}. Check Shiprocket dashboard for AWB code.`,
                timestamp: new Date(),
              });
              await orderToUpdate.save();

              // Emit real-time order update
              const { notifyOrderUpdate } = require("../utils/emitOrderUpdate");
              await notifyOrderUpdate(orderToUpdate);

              // Notify seller to check Shiprocket dashboard
              await NotificationService.createNotification({
                type: "courier_assigned",
                sellerId: orderToUpdate.seller,
                orderId: orderToUpdate._id,
                message: `🚚 Courier assigned: ${orderToUpdate.courierName}. Please check Shiprocket dashboard for AWB code and tracking details.`,
              });
            }
          }
        } else {
          console.warn(
            `⚠️ [Background] No couriers available for shipment ${order.shipmentId}`
          );
        }
      } catch (courierError) {
        console.error(
          `❌ [Background] Courier assignment failed for ${order.shipmentId}:`,
          courierError.response?.data || courierError.message
        );
        // Courier can be assigned later via background sync
      }
    });

    console.log("=== Shiprocket Shipment Creation Completed Successfully ===");
    return response.data;
  } catch (error) {
    console.error("=== Shiprocket Shipment Creation Failed ===");
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      orderId: order._id,
    });
    throw new Error(
      `Error creating Shiprocket shipment: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

// Helper function to update order status
async function updateOrderStatus(orderId, status, note) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  order.status = status;
  order.statusHistory.push({
    status,
    note,
  });
  await order.save();

  // Create notification for status change
  await NotificationService.createNotification({
    type: "order_status_update",
    sellerId: order.seller,
    orderId: order._id,
    message: `Order #${order._id} status updated to ${status}`,
  });

  // Send email notification to buyer for status updates
  try {
    console.log(
      `📧 Sending status update email for order ${orderId} - Status: ${status}`
    );
    await OrderEmailService.sendOrderStatusUpdateEmail(orderId, status, note);
  } catch (emailError) {
    console.error(
      `❌ Error sending status update email for order ${orderId}:`,
      emailError
    );
    // Don't fail the status update if email fails
  }

  return order;
}

// Helper function to reserve stock
async function reserveStock(items, session) {
  for (const item of items) {
    // Support both item.productId (from cart) and item.product (from order)
    const productId = item.productId || item.product;

    if (!productId) {
      throw new OrderError("Product ID missing in order item", 400, {
        item: item,
      });
    }

    console.log(`[DEBUG] reserveStock looking for product:`, {
      productId,
      hasProductId: !!item.productId,
      hasProduct: !!item.product,
    });

    let product = await Product.findById(productId)
      .session(session)
      .populate("user");

    // If not found with session, try without session
    if (!product) {
      console.log(
        `[DEBUG] Product not found with session in reserveStock, trying without session...`
      );
      product = await Product.findById(productId).populate("user");
    }

    if (!product) {
      throw new OrderError("Product not found", 404, {
        productId: productId,
      });
    }

    const requiredQuantity = item.quantity * item.lotSize;
    if (product.quantityAvailable < requiredQuantity) {
      throw new OrderError(`Insufficient stock for ${product.title}`, 400, {
        productId: product._id,
        available: product.quantityAvailable,
        requested: requiredQuantity,
      });
    }
    console.log(
      `Current stock for ${product.title}: ${product.quantityAvailable}`
    );
    product.quantityAvailable -= requiredQuantity;
    await product.save({ session });
    console.log(
      `Updated stock for ${product.title}: ${product.quantityAvailable}`
    );

    // Check stock status and send notifications if needed
    console.log(`Checking stock status for ${product.title}...`);
    try {
      // Ensure product has user field populated
      if (!product.user) {
        console.error(`Product ${product._id} has no user field`);
        continue;
      }
      console.log(`Product user ID: ${product.user._id}`);
      await NotificationService.checkStockStatus(product);
      console.log(`Stock status check completed for ${product.title}`);
    } catch (error) {
      console.error(`Error checking stock status for ${product.title}:`, error);
    }
  }
}

// Helper function to create seller order
async function createSellerOrder(
  sellerId,
  items,
  buyer,
  address,
  razorpayOrder,
  session,
  cartId,
  shippingFee = 0
) {
  try {
    const subtotal = items.reduce(
      (sum, item) =>
        sum + item.quantity * item.productId.lotSize * item.productId.price,
      0
    );

    const order = new Order({
      products: items.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        lotSize: item.productId.lotSize,
        price: item.productId.price,
        totalPrice:
          item.quantity * item.productId.lotSize * item.productId.price,
      })),
      buyer: buyer._id,
      seller: sellerId,
      cartId: cartId,
      subtotal: subtotal,
      shippingFee: shippingFee,
      totalPrice: subtotal, // Keep for backward compatibility
      grandTotal: subtotal + shippingFee,
      status: "Payment Pending",
      paymentStatus: "Pending",
      paymentTransactionId: razorpayOrder.id,
      address: {
        street: `${address.addressLine1} ${address.addressLine2}`,
        city: address.city,
        state: address.state,
        country: address.country,
        pincode: address.postalCode,
        phone: address.phone,
        name: address.name,
      },
      statusHistory: [
        {
          status: "Payment Pending",
          note: "Order created, awaiting payment",
        },
      ],
    });

    await order.save({ session });
    return order;
  } catch (error) {
    throw new OrderError("Failed to create order", 500, {
      sellerId,
      error: error.message,
    });
  }
}

// Helper function to restore stock when payment fails
async function restoreStock(items, session) {
  console.log("=== Starting Stock Restoration ===");
  console.log("Items to restore stock for:", JSON.stringify(items, null, 2));

  for (const item of items) {
    console.log(`Processing item:`, {
      productId: item.product,
      quantity: item.quantity,
      lotSize: item.lotSize,
      hasLotSize: !!item.lotSize,
    });

    // Find the product using the product ID from the order
    const product = await Product.findById(item.product).session(session);
    if (!product) {
      console.error(`Product not found for stock restoration:`, item.product);
      continue;
    }

    // Calculate quantity to restore based on the order structure
    // For cart orders: quantity is the number of lots, lotSize is stored in the order
    // For buy now orders: quantity is the number of lots, lotSize is stored in the order
    let quantityToRestore;

    if (item.lotSize) {
      // Cart order or buy now order: quantity * lotSize
      quantityToRestore = item.quantity * item.lotSize;
      console.log(
        `Cart/Buy Now order: ${item.quantity} lots × ${item.lotSize} units = ${quantityToRestore} total units`
      );
    } else {
      // Fallback: assume quantity is already the total (for backward compatibility)
      quantityToRestore = item.quantity;
      console.log(
        `Fallback calculation: ${item.quantity} units (no lotSize found)`
      );
    }

    const oldStock = product.quantityAvailable;
    product.quantityAvailable += quantityToRestore;
    await product.save({ session });

    console.log(
      `Stock restored for ${product.title}: +${quantityToRestore} units (${oldStock} → ${product.quantityAvailable})`
    );
  }

  console.log("=== Stock Restoration Completed ===");
}

// Helper function to handle failed payments and restore stock
async function handlePaymentFailure(orderId, reason = "Payment failed") {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error("Order not found");
    }

    // Restore stock
    await restoreStock(order.products, session);

    // Update order status
    order.status = "Cancelled";
    order.paymentStatus = "Failed";
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    order.statusHistory.push({
      status: "Cancelled",
      note: reason,
      timestamp: new Date(),
    });

    await order.save({ session });

    // Clear cart if it exists
    if (order.cartId) {
      await Cart.findByIdAndDelete(order.cartId).session(session);
    }

    await session.commitTransaction();
    console.log(
      `Payment failure handled for order ${orderId}: Stock restored and order cancelled`
    );

    return order;
  } catch (error) {
    await session.abortTransaction();
    console.error(
      `Error handling payment failure for order ${orderId}:`,
      error
    );
    throw error;
  } finally {
    session.endSession();
  }
}

// Helper function to get seller display name
function getSellerDisplayName(seller) {
  if (!seller) return "Unknown Seller";

  // Prioritize business name if available
  if (seller.sellerDetails?.businessName) {
    return seller.sellerDetails.businessName;
  }

  // Fallback to personal name
  return seller.fullName || "Unknown Seller";
}

// Helper function to format seller information consistently
function formatSellerInfo(seller) {
  if (!seller) {
    return {
      businessName: "Unknown Seller",
      personalName: "Unknown Seller",
      email: null,
      phone: null,
      businessDetails: null,
      isBusiness: false,
    };
  }

  return {
    businessName:
      seller.sellerDetails?.businessName || seller.fullName || "Unknown Seller",
    personalName: seller.fullName || "Unknown Seller",
    email: seller.email,
    phone: seller.phoneNumber,
    businessDetails: seller.sellerDetails
      ? {
          gstin: seller.sellerDetails.gstin,
          pan: seller.sellerDetails.pan,
          bankName: seller.sellerDetails.bankName,
          accountName: seller.sellerDetails.accountName,
          ifscCode: seller.sellerDetails.ifscCode,
          branch: seller.sellerDetails.branch,
          address: {
            addressLine1: seller.sellerDetails.addressLine1,
            addressLine2: seller.sellerDetails.addressLine2,
            city: seller.sellerDetails.city,
            state: seller.sellerDetails.state,
            postalCode: seller.sellerDetails.postalCode,
            country: seller.sellerDetails.country,
          },
        }
      : null,
    isBusiness: !!seller.sellerDetails?.businessName,
  };
}

// Create Order from Cart
exports.createOrderFromCart = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("=== Starting Order Creation Process ===");
    const { addressId, shippingFee = 0 } = req.body;
    const { _id: userId } = req.user;

    if (!addressId) {
      throw new OrderError("Shipping address is required", 400);
    }

    console.log("Checkout details:", { addressId, shippingFee });

    console.log("Fetching required data...");
    const [shippingAddress, cart, buyer] = await Promise.all([
      Address.findById(addressId),
      Cart.findOne({ user: userId }).populate({
        path: "items.productId",
        select: "user price lotSize quantityAvailable title sku",
        populate: { path: "user", select: "name email address" },
      }),
      User.findById(userId).select("name email"),
    ]);

    console.log("Data fetched:", {
      hasShippingAddress: !!shippingAddress,
      hasCart: !!cart,
      cartItemsCount: cart?.items?.length,
      hasBuyer: !!buyer,
    });

    if (!shippingAddress) {
      throw new OrderError("Shipping address not found", 404);
    }

    if (!cart || cart.items.length === 0) {
      throw new OrderError("Cart is empty", 400);
    }

    if (!buyer) {
      throw new OrderError("Buyer details not found", 404);
    }

    // Note: Stock will be deducted only after successful payment verification
    // This prevents stock deduction if payment fails or is abandoned
    console.log(
      "Order created with pending payment - stock will be deducted after payment success"
    );

    const sellerOrders = cart.items.reduce((acc, item) => {
      if (!item.productId?.user) {
        throw new OrderError("Seller information missing for product", 400, {
          productId: item.productId?._id,
        });
      }

      const sellerId = item.productId.user._id.toString();
      if (!acc[sellerId]) {
        acc[sellerId] = [];
      }
      acc[sellerId].push(item);
      return acc;
    }, {});

    console.log(
      "Orders grouped by seller:",
      Object.keys(sellerOrders).length,
      "sellers"
    );

    const subtotal = cart.items.reduce(
      (sum, item) =>
        sum + item.quantity * item.productId.lotSize * item.productId.price,
      0
    );
    const grandTotal = subtotal + shippingFee;

    console.log("Creating Razorpay payment order...");
    console.log(
      `Subtotal: ₹${subtotal}, Shipping: ₹${shippingFee}, Grand Total: ₹${grandTotal}`
    );

    let razorpayOrder;
    try {
      razorpayOrder = await paymentService.createPaymentOrder({
        totalPrice: grandTotal, // Include shipping fee in payment
        buyerId: buyer._id,
      });
      console.log("Razorpay order created:", razorpayOrder.id);
    } catch (error) {
      throw new PaymentError("Payment order creation failed", 500, {
        error: error.message,
      });
    }

    const createdOrders = [];

    // Create orders for each sellernt
    console.log("Creating orders for each seller...");
    for (const [sellerId, items] of Object.entries(sellerOrders)) {
      console.log(`Creating order for seller ${sellerId}...`);

      // Calculate shipping fee per seller (proportional to their items)
      const sellerSubtotal = items.reduce(
        (sum, item) =>
          sum + item.quantity * item.productId.lotSize * item.productId.price,
        0
      );
      const sellerShippingFee = (sellerSubtotal / subtotal) * shippingFee;

      const order = await createSellerOrder(
        sellerId,
        items,
        buyer,
        shippingAddress,
        razorpayOrder,
        session,
        cart._id,
        sellerShippingFee
      );
      createdOrders.push(order);
      console.log(`Order created for seller ${sellerId}:`, order._id);

      // Note: Shiprocket shipment will be created by SELLER when they're ready to ship
      // This gives sellers control and speeds up checkout
    }

    // Don't clear the cart here - it will be cleared after successful payment
    // await Cart.findByIdAndDelete(cart._id, { session });

    await session.commitTransaction();
    console.log("=== Order Creation Process Completed Successfully ===");

    res.status(201).json({
      message: "Orders created successfully",
      orders: createdOrders.map((order) => ({
        orderId: order._id,
        paymentOrderId: order.paymentTransactionId,
        amount: order.totalPrice,
      })),
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("=== Order Creation Process Failed ===");
    console.error("Error:", error.message);

    if (error instanceof OrderError || error instanceof PaymentError) {
      return res.status(error.code).json({
        message: error.message,
        details: error.details,
      });
    }

    console.error("Error creating orders:", error);
    res.status(500).json({
      message: "Error creating orders",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

// Verify Payment
exports.verifyPayment = async (req, res) => {
  console.log("[DEBUG] ===== PAYMENT VERIFICATION START =====");
  console.log("[DEBUG] Request body:", req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { order_id, payment_id, signature } = req.body;
    console.log("[DEBUG] Payment details:", {
      order_id,
      payment_id,
      signature,
    });
    const body = `${order_id}|${payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      throw new PaymentError("Invalid payment signature", 400);
    }

    // Find all orders with the same paymentTransactionId
    console.log(
      "[DEBUG] Looking for orders with paymentTransactionId:",
      order_id
    );
    const orders = await Order.find({
      paymentTransactionId: order_id,
    }).session(session);

    console.log("[DEBUG] Found orders:", orders.length);
    if (orders.length > 0) {
      console.log(
        "[DEBUG] Order details:",
        orders.map((o) => ({
          id: o._id.toString(),
          products: o.products.map((p) => ({
            product: p.product?.toString ? p.product.toString() : p.product,
            productType: typeof p.product,
            productIsObjectId: p.product instanceof mongoose.Types.ObjectId,
            quantity: p.quantity,
            lotSize: p.lotSize,
          })),
          status: o.status,
          paymentStatus: o.paymentStatus,
        }))
      );
    }

    if (!orders.length) {
      throw new OrderError("Orders not found", 404);
    }

    // Check if payment is already verified
    const alreadyPaid = orders.every((order) => order.paymentStatus === "Paid");
    if (alreadyPaid) {
      throw new PaymentError("Payment already verified", 400);
    }

    // Fetch payment details from Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const payment = await razorpay.payments.fetch(payment_id);

    // Check if payment actually succeeded
    if (payment.status !== "captured") {
      // Payment failed or is pending, restore stock and cancel orders
      console.log(
        `Payment verification failed for orders with transaction ID ${order_id}. Payment status: ${payment.status}`
      );

      await session.abortTransaction();
      session.endSession();

      // Handle payment failure for all orders
      await Promise.all(
        orders.map((order) =>
          handlePaymentFailure(
            order._id,
            `Payment verification failed: ${payment.status}`
          )
        )
      );

      return res.status(400).json({
        message: "Payment verification failed",
        details: `Payment status: ${payment.status}`,
      });
    }

    // Get platform fee percentage from settings
    const platformSettings = await PlatformSettings.findOne()
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!platformSettings) {
      console.warn("No platform settings found, using default fee of 10%");
    }

    const platformFeePercentage = platformSettings?.platformFeePercentage || 10; // Default to 10% if no settings found
    console.log("Using platform fee percentage:", platformFeePercentage);

    // Deduct stock only after successful payment verification
    console.log(
      "Payment successful - validating and deducting stock for all orders..."
    );

    // First, validate that all products still have sufficient stock
    for (const order of orders) {
      for (const item of order.products) {
        // Ensure product ID is a valid ObjectId
        let productId = item.product;
        if (typeof productId === "string") {
          productId = new mongoose.Types.ObjectId(productId);
        }

        console.log(`[DEBUG] Looking for product:`, {
          original: item.product,
          converted: productId,
          type: typeof item.product,
          isObjectId: productId instanceof mongoose.Types.ObjectId,
        });

        // Try finding the product with and without session if session fails
        let product = await Product.findById(productId).session(session);

        // If not found with session, try without session (session might have read concerns)
        if (!product) {
          console.log(
            `[DEBUG] Product not found with session, trying without session...`
          );
          product = await Product.findById(productId);
        }

        console.log(
          `[DEBUG] Product lookup result:`,
          product
            ? {
                id: product._id.toString(),
                title: product.title,
                isActive: product.isActive,
                sellerDeleted: product.sellerDeleted,
                quantityAvailable: product.quantityAvailable,
              }
            : "NOT FOUND - Product may have been deleted"
        );

        if (!product) {
          console.error(
            `[ERROR] Product not found during payment verification:`,
            {
              productId: item.product,
              productIdType: typeof item.product,
              productIdString: item.product?.toString(),
              orderId: order._id,
              itemQuantity: item.quantity,
              allProductIds: order.products.map((p) => ({
                id: p.product,
                type: typeof p.product,
              })),
            }
          );

          // Try to find all products to see what exists
          const allProducts = await Product.find({})
            .limit(5)
            .select("_id title");
          console.log(
            `[DEBUG] Sample products in DB:`,
            allProducts.map((p) => p._id.toString())
          );

          throw new OrderError(
            `Product not found for order. The product may have been deleted. Please contact support.`,
            404,
            {
              productId: item.product?.toString(),
              orderId: order._id.toString(),
            }
          );
        }

        const requiredQuantity = item.quantity * item.lotSize;
        if (product.quantityAvailable < requiredQuantity) {
          throw new OrderError(
            `Insufficient stock for ${product.title}. Available: ${product.quantityAvailable}, Required: ${requiredQuantity}`,
            400,
            {
              productId: product._id,
              available: product.quantityAvailable,
              required: requiredQuantity,
            }
          );
        }
      }
    }

    // If all validations pass, deduct stock
    await Promise.all(
      orders.map(async (order) => {
        // Deduct stock for this order's products
        await reserveStock(order.products, session);
        console.log(`Stock deducted for order ${order._id}`);
      })
    );

    // Update all orders and create transactions
    await Promise.all(
      orders.map(async (order) => {
        // Calculate platform fee based on settings
        const platformFee = (order.totalPrice * platformFeePercentage) / 100;
        const sellerAmount = order.totalPrice - platformFee;

        console.log("Transaction calculations:", {
          orderId: order._id,
          totalPrice: order.totalPrice,
          platformFeePercentage,
          platformFee,
          sellerAmount,
        });

        // Create transaction record
        const transaction = new Transaction({
          order: order._id,
          buyer: order.buyer,
          seller: order.seller,
          amount: order.totalPrice,
          platformFee,
          platformFeePercentage,
          sellerAmount,
          paymentMethod: "Razorpay",
          paymentId: payment_id,
          status: "Completed",
          paymentDetails: {
            bank: payment.bank,
            cardType: payment.method,
            last4: payment.card?.last4,
            email: payment.email,
            contact: payment.contact,
          },
          completedAt: new Date(),
        });

        await transaction.save({ session });

        // Update order status to Confirmed (payment received)
        order.paymentStatus = "Paid";
        order.razorpayPaymentId = payment_id;
        order.razorpayOrderId = order_id;
        order.razorpaySignature = signature;
        order.status = "Processing"; // Directly mark as Processing (skip Confirmed)
        order.confirmedAt = new Date();
        order.processingAt = new Date();
        order.platformFee = platformFee;
        order.platformFeePercentage = platformFeePercentage;
        order.sellerEarnings = sellerAmount;
        order.canCancel = true;
        order.canReturn = false;
        order.stockDeducted = true; // Mark that stock has been deducted
        order.statusHistory.push({
          status: "Confirmed",
          note: "Payment verified successfully, stock deducted, order confirmed",
          timestamp: new Date(),
        });
        order.statusHistory.push({
          status: "Processing",
          note: "Order is being prepared by seller",
          timestamp: new Date(),
        });
        await order.save({ session });

        // Create both notifications after payment confirmation
        await NotificationService.notifyNewOrder(order.seller, order._id);
        await NotificationService.notifyPaymentReceived(
          order.seller,
          order._id,
          sellerAmount
        );
      })
    );

    // Auto-transition to "Processing" after 10 seconds (gives time for courier assignment)
    setTimeout(async () => {
      try {
        for (const order of orders) {
          const orderToUpdate = await Order.findById(order._id);
          if (orderToUpdate && orderToUpdate.status === "Confirmed") {
            orderToUpdate.status = "Processing";
            orderToUpdate.processingAt = new Date();
            orderToUpdate.statusHistory.push({
              status: "Processing",
              note: "Automatically started processing - preparing order for shipment",
              timestamp: new Date(),
            });
            await orderToUpdate.save();
            console.log(
              `✅ [Auto] Order ${orderToUpdate._id} auto-transitioned to Processing`
            );
          }
        }
      } catch (error) {
        console.error("Error auto-transitioning to Processing:", error);
      }
    }, 10000); // 10 seconds after payment

    // Delete the cart if all orders are paid
    if (orders[0].cartId) {
      await Cart.findByIdAndDelete(orders[0].cartId).session(session);
    }

    await session.commitTransaction();

    // Send order confirmation emails to buyers
    console.log("📧 Sending order confirmation emails...");
    try {
      const emailResults =
        await OrderEmailService.sendBulkOrderConfirmationEmails(
          orders.map((order) => order._id),
          {
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          }
        );

      const successCount = emailResults.filter((r) => r.success).length;
      console.log(
        `✅ Order confirmation emails sent: ${successCount}/${orders.length} successful`
      );

      // Log any email failures (but don't fail the payment verification)
      emailResults
        .filter((r) => !r.success)
        .forEach((result) => {
          console.warn(
            `⚠️ Email failed for order ${result.orderId}: ${result.error}`
          );
        });
    } catch (emailError) {
      console.error("❌ Error sending order confirmation emails:", emailError);
      // Don't fail the payment verification if emails fail
    }

    res.status(200).json({ message: "Payment verified successfully" });
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof OrderError || error instanceof PaymentError) {
      return res.status(error.code).json({
        message: error.message,
        details: error.details,
      });
    }

    console.error("Error verifying payment:", error);
    res.status(500).json({
      message: "Error verifying payment",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

// Create Order from Buy Now
exports.createOrderFromBuyNow = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("=== Starting Buy Now Order Creation Process ===");
    const { productId, quantity, addressId } = req.body;
    const { _id: userId } = req.user;

    if (!productId || !quantity || !addressId) {
      throw new OrderError("Product, quantity, and address are required", 400);
    }

    if (quantity <= 0) {
      throw new OrderError("Quantity must be greater than 0", 400);
    }

    const [product, shippingAddress, buyer] = await Promise.all([
      Product.findById(productId).populate("user", "name email address"),
      Address.findById(addressId),
      User.findById(userId).select("name email"),
    ]);

    if (!product) {
      throw new OrderError("Product not found", 404);
    }

    if (!shippingAddress) {
      throw new OrderError("Shipping address not found", 404);
    }

    if (!buyer) {
      throw new OrderError("Buyer details not found", 404);
    }

    // Ensure product has a lotSize property
    if (!product.lotSize || product.lotSize <= 0) {
      throw new OrderError("Invalid lot size for product", 400);
    }

    // Calculate total quantity based on lot size
    const totalQuantity = quantity * product.lotSize;
    const totalPrice = product.price * totalQuantity;

    console.log("Buy Now calculations:", {
      productId: product._id,
      productTitle: product.title,
      requestedLots: quantity,
      lotSize: product.lotSize,
      totalQuantity,
      totalPrice,
      availableStock: product.quantityAvailable,
    });

    // Validate stock availability
    if (product.quantityAvailable < totalQuantity) {
      throw new OrderError(
        `Insufficient quantity available for ${
          product.title
        }. Available: ${Math.floor(
          product.quantityAvailable / product.lotSize
        )} lots, Requested: ${quantity} lots`,
        400
      );
    }

    const order = new Order({
      products: [
        {
          product: product._id,
          quantity: quantity, // Store the number of lots requested
          lotSize: product.lotSize, // Include lotSize for consistency
          price: product.price,
          totalPrice,
        },
      ],
      buyer: buyer._id,
      seller: product.user._id,
      totalPrice,
      status: "Payment Pending",
      paymentStatus: "Pending",
      address: {
        street: `${shippingAddress.addressLine1} ${shippingAddress.addressLine2}`,
        city: shippingAddress.city,
        state: shippingAddress.state,
        country: shippingAddress.country,
        pincode: shippingAddress.postalCode,
        phone: shippingAddress.phone,
        name: shippingAddress.name,
      },
      cartId: null, // No cart ID since it's a Buy Now
    });

    // Deduct stock based on lot size
    await Product.findByIdAndUpdate(
      product._id,
      { $inc: { quantityAvailable: -totalQuantity } },
      { session }
    );

    // Fetch the updated product to check stock status
    const updatedProduct = await Product.findById(product._id).populate("user");
    if (!updatedProduct) {
      throw new Error("Failed to fetch updated product");
    }

    // Check stock status and send notifications if needed
    console.log(`Checking stock status for ${updatedProduct.title}...`);
    try {
      await NotificationService.checkStockStatus(updatedProduct);
      console.log(`Stock status check completed for ${updatedProduct.title}`);
    } catch (error) {
      console.error(
        `Error checking stock status for ${updatedProduct.title}:`,
        error
      );
    }

    await order.save({ session });

    // Generate the payment order
    const razorpayOrder = await paymentService.createPaymentOrder({
      totalPrice: order.totalPrice,
      buyerId: buyer._id,
    });
    order.paymentTransactionId = razorpayOrder.id;
    await order.save({ session });

    // Note: Shiprocket shipment will be created by SELLER when they're ready to ship
    // This gives sellers control and speeds up checkout

    // Respond with the created order details
    res.status(201).json({
      message: "Order created successfully",
      order: {
        orderId: order._id,
        paymentOrderId: order.paymentTransactionId,
        amount: order.totalPrice,
      },
    });

    await session.commitTransaction();

    // Note: Order confirmation email will be sent after payment verification
    // This happens in the verifyPayment function
  } catch (error) {
    await session.abortTransaction();
    console.error("=== Buy Now Order Creation Process Failed ===");
    console.error("Error:", error.message);

    if (error instanceof OrderError || error instanceof PaymentError) {
      return res.status(error.code).json({
        message: error.message,
        details: error.details,
      });
    }

    console.error("Error creating buy now order:", error);
    res.status(500).json({
      message: "Error creating order",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { _id: userId, role, lastActiveRole } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {};
    // Use lastActiveRole for filtering orders based on current mode
    const activeRole = lastActiveRole || role;

    if (activeRole === "Buyer") {
      filter.buyer = userId;
    } else if (activeRole === "Seller") {
      filter.seller = userId;
    } else if (activeRole !== "Admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "products.product",
          model: "Product",
          select: "title images featuredImage",
        })
        .populate("buyer", "fullName phone email")
        .populate({
          path: "seller",
          select: "fullName email sellerDetails",
          populate: {
            path: "sellerDetails",
            select:
              "businessName gstin pan bankName accountName ifscCode branch addressLine1 addressLine2 city state postalCode country",
          },
        })
        .lean()
        .exec(),
      Order.countDocuments(filter),
    ]);

    if (!orders.length && page !== 1) {
      return res.status(404).json({ message: "No orders found" });
    }

    // Get all product IDs from orders
    const productIds = orders.flatMap((order) =>
      order.products.map((item) => item.product?._id).filter(Boolean)
    );

    // Fetch user's reviews for these products
    const userReviews = await Review.find({
      user: userId,
      product: { $in: productIds },
    }).select("product rating");

    // Convert user reviews into a Map for quick lookup
    const userRatings = new Map(
      userReviews.map((review) => [review.product.toString(), review.rating])
    );

    // Format orders and include the user's rating
    const formattedOrders = orders.map((order) => ({
      orderId: order._id,
      buyer: order.buyer?.fullName || "Unknown Buyer",
      buyerName: order.buyer?.fullName || "Unknown Buyer",
      buyerPhone: order.buyer?.phone || order.address?.phone || "N/A",
      buyerEmail: order.buyer?.email || "N/A",
      seller: formatSellerInfo(order.seller),
      totalPrice: order.totalPrice,
      paymentStatus: order.paymentStatus,
      status: order.status,
      createdAt: order.createdAt,
      // Shipping info for seller dashboard
      awbCode: order.awbCode,
      courierName: order.courierName,
      scheduledPickupDate: order.scheduledPickupDate,
      pickupTime: order.pickupTime,
      address: order.address
        ? {
            street: order.address.street || "",
            city: order.address.city || "",
            state: order.address.state || "",
            country: order.address.country || "",
            pincode: order.address.pincode || "",
            phone: order.address.phone || "",
            name: order.address.name || "",
          }
        : null,
      products: order.products.map((productItem) => {
        const product = productItem.product || {};
        return {
          productId: product._id,
          name: product.title || "Unknown Product",
          images: product.images,
          featuredImage: product.featuredImage,
          quantity: productItem.quantity,
          lotSize: productItem.lotSize,
          price: productItem.price,
          totalPrice: productItem.totalPrice,
          userRating: userRatings.get(product._id?.toString()) || null,
        };
      }),
      // Tracking information
      statusHistory: order.statusHistory || [],
      trackingUrl: order.trackingUrl,
      awbCode: order.awbCode,
      courierName: order.courierName,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
    }));

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: formattedOrders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasMore: page * limit < totalOrders,
      },
    });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res
      .status(500)
      .json({ message: "Error fetching orders", error: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, role } = req.user;

    // Build the query based on user role
    let query = { _id: id };
    if (role === "Buyer") {
      query.buyer = userId;
    } else if (role === "Seller") {
      query.seller = userId;
    } else if (role !== "Admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const order = await Order.findOne(query)
      .populate({
        path: "products.product",
        model: "Product",
        select: "title images featuredImage price",
      })
      .populate("buyer", "fullName email phone")
      .populate({
        path: "seller",
        select: "fullName email phoneNumber sellerDetails",
        populate: {
          path: "sellerDetails",
          select:
            "businessName gstin pan bankName accountName ifscCode branch addressLine1 addressLine2 city state postalCode country",
        },
      })
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Format the order response
    console.log("Raw order from DB:", JSON.stringify(order.products, null, 2));
    const formattedOrder = {
      orderId: order._id,
      buyer: {
        name: order.buyer?.fullName || "Unknown Buyer",
        email: order.buyer?.email,
        phone: order.buyer?.phone,
      },
      seller: formatSellerInfo(order.seller),
      subtotal: order.subtotal || order.totalPrice,
      shippingFee: order.shippingFee || 0,
      grandTotal: order.grandTotal || order.totalPrice,
      totalPrice: order.totalPrice, // Kept for backward compatibility
      paymentStatus: order.paymentStatus,
      paymentTransactionId: order.paymentTransactionId,
      status: order.status,
      createdAt: order.createdAt,
      address: order.address
        ? {
            street: order.address.street || "",
            city: order.address.city || "",
            state: order.address.state || "",
            country: order.address.country || "",
            pincode: order.address.pincode || "",
            phone: order.address.phone || "",
            name: order.address.name || "",
          }
        : null,
      products: order.products.map((productItem) => {
        const product = productItem.product || {};
        console.log("Mapping product item:", {
          productId: product._id,
          name: product.title,
          quantity: productItem.quantity,
          lotSize: productItem.lotSize,
          price: product.price,
          totalPrice: productItem.totalPrice,
        });
        return {
          productId: product._id,
          name: product.title || "Unknown Product",
          images: product.images,
          featuredImage: product.featuredImage,
          quantity: productItem.quantity,
          lotSize: productItem.lotSize,
          price: product.price,
          totalPrice: productItem.totalPrice,
        };
      }),
      // Tracking information
      statusHistory: order.statusHistory || [],
      trackingUrl: order.trackingUrl,
      awbCode: order.awbCode,
      courierName: order.courierName,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      shipmentId: order.shipmentId,
      shiprocketOrderId: order.shiprocketOrderId,
      // Pickup information
      scheduledPickupDate: order.scheduledPickupDate,
      pickupTime: order.pickupTime,
      // Cancellation information
      cancellationReason: order.cancellationReason,
      cancelledAt: order.cancelledAt,
      // Timestamps
      confirmedAt: order.confirmedAt,
      processingAt: order.processingAt,
      packedAt: order.packedAt,
      shippedAt: order.shippedAt,
      inTransitAt: order.inTransitAt,
      outForDeliveryAt: order.outForDeliveryAt,
      deliveredAt: order.deliveredAt,
      completedAt: order.completedAt,
    };

    res.status(200).json({
      message: "Order fetched successfully",
      order: formattedOrder,
    });
  } catch (err) {
    console.error("Error fetching order:", err);
    res.status(500).json({
      message: "Error fetching order details",
      error: err.message,
    });
  }
};

// Cancel order function
exports.cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the order and verify ownership
    const order = await Order.findOne({
      _id: id,
      buyer: userId,
      paymentStatus: "Pending", // Only allow cancellation of pending orders
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Order not found or cannot be cancelled",
      });
    }

    // Check if order is in a cancellable state
    if (
      order.paymentStatus !== "Pending" ||
      order.status !== "Payment Pending"
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Order cannot be cancelled in its current state",
      });
    }

    // Release reserved stock back to inventory
    for (const item of order.products) {
      await Product.findByIdAndUpdate(
        item.product,
        {
          $inc: { quantityAvailable: item.quantity * item.lotSize },
        },
        { session }
      );
    }

    // Update order status to cancelled
    await Order.findByIdAndUpdate(
      id,
      {
        status: "Cancelled",
        paymentStatus: "Failed",
        cancelledAt: new Date(),
        cancellationReason: "User cancelled payment",
      },
      { session }
    );

    // If there's a Razorpay order ID, we should also cancel it on Razorpay's side
    if (order.razorpayOrderId) {
      try {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Attempt to close the Razorpay order
        await razorpay.orders.edit(order.razorpayOrderId, {
          notes: { cancelled: "User cancelled payment" },
        });
      } catch (razorpayError) {
        console.error("Error cancelling Razorpay order:", razorpayError);
        // Don't fail the entire cancellation if Razorpay fails
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      message: "Order cancelled successfully",
      orderId: id,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error cancelling order:", error);
    res.status(500).json({
      message: "Failed to cancel order",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Handle payment cancellation or timeout (DO NOT cancel immediately like Flipkart)
exports.handlePaymentCancellation = async (req, res) => {
  try {
    const { orderId, reason = "Payment not completed" } = req.body;
    const { _id: userId } = req.user;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    // Find the order and verify ownership
    const order = await Order.findOne({
      _id: orderId,
      buyer: userId,
      paymentStatus: "Pending",
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found or already processed",
      });
    }

    // DON'T cancel immediately - keep as "Payment Pending" for retry
    // Just add a note to status history
    order.statusHistory.push({
      status: "Payment Pending",
      note: reason,
      timestamp: new Date(),
    });

    await order.save();

    res.status(200).json({
      message: "Order is pending payment",
      orderId: orderId,
      status: "Payment Pending",
      note: "You can retry payment anytime. Order will be auto-cancelled after 30 minutes.",
    });
  } catch (error) {
    console.error("Error handling payment cancellation:", error);
    res.status(500).json({
      message: "Failed to process payment cancellation",
      error: error.message,
    });
  }
};

// Handle abandoned payments (timeout mechanism)
exports.handleAbandonedPayments = async () => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

    // Find orders that are pending payment for more than 30 minutes
    const abandonedOrders = await Order.find({
      paymentStatus: "Pending",
      status: "Payment Pending",
      createdAt: { $lt: thirtyMinutesAgo },
    });

    console.log(`Found ${abandonedOrders.length} abandoned orders`);

    // Handle each abandoned order
    for (const order of abandonedOrders) {
      try {
        await handlePaymentFailure(order._id, "Payment abandoned - timeout");
        console.log(`Abandoned order ${order._id} handled successfully`);
      } catch (error) {
        console.error(`Error handling abandoned order ${order._id}:`, error);
      }
    }

    return abandonedOrders.length;
  } catch (error) {
    console.error("Error handling abandoned payments:", error);
    throw error;
  }
};

// Test endpoint for stock restoration (development only)
exports.testRestoreStock = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    console.log("=== Testing Stock Restoration ===");
    console.log("Order:", {
      id: order._id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      products: order.products,
    });

    // Test the restoreStock function
    await restoreStock(order.products, null);

    res.status(200).json({
      message: "Stock restoration test completed",
      order: {
        id: order._id,
        products: order.products,
      },
    });
  } catch (error) {
    console.error("Error in test restore stock:", error);
    res.status(500).json({
      message: "Error testing stock restoration",
      error: error.message,
    });
  }
};

// Test endpoint for order confirmation email (development only)
exports.testOrderConfirmationEmail = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    console.log("=== Testing Order Confirmation Email ===");
    console.log("Order ID:", orderId);

    // Test sending order confirmation email
    const result = await OrderEmailService.sendOrderConfirmationEmail(orderId, {
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });

    res.status(200).json({
      message: "Order confirmation email test completed",
      result: result,
    });
  } catch (error) {
    console.error("Error in test order confirmation email:", error);
    res.status(500).json({
      message: "Error testing order confirmation email",
      error: error.message,
    });
  }
};

// module.exports = {
//   createOrderFromCart,
//   createOrderFromBuyNow,
//   verifyPayment,
//   getAllOrders,
//   getOrderById,
//   cancelOrder,
// };

// Get all orders by payment transaction ID (for multi-seller orders)
exports.getOrdersByPaymentTransactionId = async (req, res) => {
  try {
    const { paymentTransactionId } = req.params;
    const { _id: userId, role } = req.user;

    // Build the query based on user role
    let query = { paymentTransactionId };
    if (role === "Buyer") {
      query.buyer = userId;
    } else if (role === "Seller") {
      query.seller = userId;
    } else if (role !== "Admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const orders = await Order.find(query)
      .populate({
        path: "products.product",
        model: "Product",
        select: "title images featuredImage price",
      })
      .populate("buyer", "fullName email phone")
      .populate({
        path: "seller",
        select: "fullName email phoneNumber sellerDetails",
        populate: {
          path: "sellerDetails",
          select:
            "businessName gstin pan bankName accountName ifscCode branch addressLine1 addressLine2 city state postalCode country",
        },
      })
      .sort({ createdAt: 1 })
      .lean();

    if (!orders.length) {
      return res.status(404).json({ message: "Orders not found" });
    }

    // Format the orders response
    console.log(
      "Raw orders from DB:",
      orders.map((o) => ({ id: o._id, products: o.products }))
    );
    const formattedOrders = orders.map((order) => ({
      orderId: order._id,
      buyer: {
        name: order.buyer?.fullName || "Unknown Buyer",
        email: order.buyer?.email,
        phone: order.buyer?.phone,
      },
      seller: formatSellerInfo(order.seller),
      subtotal: order.subtotal || order.totalPrice,
      shippingFee: order.shippingFee || 0,
      grandTotal: order.grandTotal || order.totalPrice,
      totalPrice: order.totalPrice, // Kept for backward compatibility
      paymentStatus: order.paymentStatus,
      paymentTransactionId: order.paymentTransactionId,
      status: order.status,
      createdAt: order.createdAt,
      address: order.address
        ? {
            street: order.address.street || "",
            city: order.address.city || "",
            state: order.address.state || "",
            country: order.address.country || "",
            pincode: order.address.pincode || "",
            phone: order.address.phone || "",
            name: order.address.name || "",
          }
        : null,
      products: order.products.map((productItem) => {
        const product = productItem.product || {};
        console.log(
          "Mapping product item in getOrdersByPaymentTransactionId:",
          {
            productId: product._id,
            name: product.title,
            quantity: productItem.quantity,
            lotSize: productItem.lotSize,
            price: product.price,
            totalPrice: productItem.totalPrice,
          }
        );
        return {
          productId: product._id,
          name: product.title || "Unknown Product",
          images: product.images,
          featuredImage: product.featuredImage,
          quantity: productItem.quantity,
          lotSize: productItem.lotSize,
          price: product.price,
          totalPrice: productItem.totalPrice,
        };
      }),
      // Tracking information
      statusHistory: order.statusHistory || [],
      trackingUrl: order.trackingUrl,
      awbCode: order.awbCode,
      courierName: order.courierName,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
    }));

    // Calculate total amount across all orders
    const totalAmount = formattedOrders.reduce(
      (sum, order) => sum + order.totalPrice,
      0
    );
    // console.log("formattedOrders: " + formattedOrders);

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: formattedOrders,
      totalAmount,
      orderCount: formattedOrders.length,
    });
  } catch (err) {
    console.error("Error fetching orders by payment transaction ID:", err);
    res.status(500).json({
      message: "Error fetching order details",
      error: err.message,
    });
  }
};
