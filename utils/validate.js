// Add your validation functions here (e.g., validate order data, payment data, etc.)
const validateOrder = (orderData) => {
  if (
    !orderData.product ||
    !orderData.buyer ||
    !orderData.seller ||
    !orderData.quantity ||
    !orderData.totalPrice
  ) {
    throw new Error("Invalid order data");
  }
};

module.exports = {
  validateOrder,
};
