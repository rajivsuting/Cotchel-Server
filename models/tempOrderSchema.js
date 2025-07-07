const mongoose = require("mongoose");

const tempOrderSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  cartItems: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      totalPrice: { type: Number, required: true },
    },
  ],
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String,
  },
  totalPrice: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => Date.now() + 60 * 60 * 1000 },
});

module.exports = mongoose.model("TempOrder", tempOrderSchema);
