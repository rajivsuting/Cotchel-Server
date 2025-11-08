const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Join admin room
    socket.on("joinAdminRoom", () => {
      socket.join("admins");
      console.log(`${socket.id} joined admin room`);
    });

    // Join seller room
    socket.on("joinSellerRoom", (sellerId) => {
      console.log(`Attempting to join seller room: seller_${sellerId}`);
      socket.join(`seller_${sellerId}`);
      console.log(`${socket.id} joined seller room: seller_${sellerId}`);
    });

    // Join user room (for buyer notifications)
    socket.on("joinUserRoom", (userId) => {
      socket.join(`user_${userId}`);
      console.log(`${socket.id} joined user room: user_${userId}`);
    });

    // Join order room (for real-time order updates)
    socket.on("joinOrderRoom", (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`${socket.id} joined order room: order_${orderId}`);
    });

    // Leave order room
    socket.on("leaveOrderRoom", (orderId) => {
      socket.leave(`order_${orderId}`);
      console.log(`${socket.id} left order room: order_${orderId}`);
    });

    // Join orders list room (for seller/buyer order lists)
    socket.on("joinOrdersListRoom", (userId, userType) => {
      const room = `${userType}_orders_${userId}`;
      socket.join(room);
      console.log(`${socket.id} joined orders list room: ${room}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

const emitNotification = (io, eventName, data, target = "admins") => {
  console.log(`Emitting ${eventName} to ${target}:`, data);

  if (target === "admins") {
    io.to("admins").emit(eventName, data);
  } else if (target.startsWith("seller_")) {
    io.to(target).emit(eventName, data);
    console.log(`Emitted to ${target}`);
  }
};

/**
 * Emit order update to specific order room
 */
const emitOrderUpdate = (io, orderId, orderData) => {
  console.log(`🔔 Emitting order update to order_${orderId}`);
  io.to(`order_${orderId}`).emit("orderUpdated", orderData);
};

/**
 * Emit order list update to buyer's orders list
 */
const emitBuyerOrdersUpdate = (io, buyerId) => {
  console.log(`🔔 Emitting orders list update to buyer_orders_${buyerId}`);
  io.to(`buyer_orders_${buyerId}`).emit("ordersListUpdated");
};

/**
 * Emit order list update to seller's orders list
 */
const emitSellerOrdersUpdate = (io, sellerId) => {
  console.log(`🔔 Emitting orders list update to seller_orders_${sellerId}`);
  io.to(`seller_orders_${sellerId}`).emit("ordersListUpdated");
};

/**
 * Emit notification to user
 */
const emitUserNotification = (io, userId, notification) => {
  console.log(`🔔 Emitting notification to user_${userId}`);
  io.to(`user_${userId}`).emit("notification", notification);
};

module.exports = { 
  setupSocket, 
  emitNotification, 
  emitOrderUpdate,
  emitBuyerOrdersUpdate,
  emitSellerOrdersUpdate,
  emitUserNotification
};
