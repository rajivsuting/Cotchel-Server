const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  lotSize: { type: Number, required: true },
  reservedStock: { type: Boolean, default: false },
  reservationExpiry: { type: Date },
});

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [cartItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  shippingFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

cartSchema.pre("save", function (next) {
  this.subtotal = this.items.reduce(
    (sum, item) => sum + item.quantity * item.price * item.lotSize,
    0
  );
  this.totalPrice = this.subtotal + this.shippingFee - this.discount;
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Cart", cartSchema);
