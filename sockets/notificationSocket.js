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

module.exports = { setupSocket, emitNotification };
