const TempOrder = require("../models/tempOrderSchema");

exports.createTempOrder = async (req, res) => {
  const { cartItems, address } = req.body;
  const { _id } = req.user;

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  try {
    const tempOrder = new TempOrder({
      buyer: _id,
      cartItems: cartItems.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.price * item.quantity,
      })),
      address,
      totalPrice,
    });

    await tempOrder.save();

    res
      .status(201)
      .json({ message: "Temporary order created", tempOrderId: tempOrder._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create temporary order" });
  }
};

exports.getTempOrders = async (req, res) => {
  const { tempOrderId } = req.params;

  try {
    const tempOrder = await TempOrder.findById(tempOrderId).populate(
      "cartItems.product"
    );

    if (!tempOrder) {
      return res.status(404).json({ message: "Order not found or expired" });
    }

    res.status(200).json(tempOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve temporary order" });
  }
};
