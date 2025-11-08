/**
 * Utility to emit real-time order updates via Socket.IO
 * 
 * This replaces polling with WebSocket push updates
 */

const { 
  emitOrderUpdate, 
  emitBuyerOrdersUpdate, 
  emitSellerOrdersUpdate 
} = require("../sockets/notificationSocket");

/**
 * Emit order update to all relevant parties
 * @param {Object} order - Order object with buyer and seller populated
 */
async function notifyOrderUpdate(order) {
  try {
    if (!global.io) {
      console.warn("⚠️ Socket.IO not initialized, skipping real-time update");
      return;
    }

    // Populate order if needed (for lean queries)
    if (!order.buyer || !order.seller) {
      const Order = require("../models/order");
      order = await Order.findById(order._id)
        .populate("buyer", "_id")
        .populate("seller", "_id")
        .lean();
    }

    const orderId = order._id.toString();
    const buyerId = order.buyer?._id?.toString() || order.buyer?.toString();
    const sellerId = order.seller?._id?.toString() || order.seller?.toString();

    // Emit to specific order room (for OrderDetails page)
    emitOrderUpdate(global.io, orderId, {
      orderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      statusHistory: order.statusHistory,
      awbCode: order.awbCode,
      courierName: order.courierName,
      trackingUrl: order.trackingUrl,
      scheduledPickupDate: order.scheduledPickupDate,
      pickupTime: order.pickupTime,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      updatedAt: new Date(),
    });

    // Emit to buyer's orders list
    if (buyerId) {
      emitBuyerOrdersUpdate(global.io, buyerId);
    }

    // Emit to seller's orders list
    if (sellerId) {
      emitSellerOrdersUpdate(global.io, sellerId);
    }

    console.log(`✅ Real-time updates sent for order ${orderId}`);
  } catch (error) {
    console.error("Error emitting order update:", error);
  }
}

module.exports = { notifyOrderUpdate };

