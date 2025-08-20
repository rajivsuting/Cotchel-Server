const mongoose = require("mongoose");
const Order = require("./models/order");
const Product = require("./models/product");

// Connect to database
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/cotchel",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

async function testStockRestoration() {
  try {
    console.log("=== Testing Stock Restoration ===");

    // Find a pending order
    const order = await Order.findOne({
      status: "Pending",
      paymentStatus: "Pending",
    }).populate("products.product");

    if (!order) {
      console.log("No pending orders found for testing");
      return;
    }

    console.log("Found order:", {
      id: order._id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      products: order.products.map((p) => ({
        productId: p.product._id,
        productName: p.product.title,
        quantity: p.quantity,
        lotSize: p.lotSize,
        currentStock: p.product.quantityAvailable,
      })),
    });

    // Simulate stock restoration
    for (const item of order.products) {
      const product = await Product.findById(item.product._id);
      if (!product) continue;

      const oldStock = product.quantityAvailable;
      let quantityToRestore;

      if (item.lotSize) {
        quantityToRestore = item.quantity * item.lotSize;
        console.log(
          `Restoring ${item.quantity} lots × ${item.lotSize} units = ${quantityToRestore} total units`
        );
      } else {
        quantityToRestore = item.quantity;
        console.log(`Restoring ${item.quantity} units (no lotSize)`);
      }

      product.quantityAvailable += quantityToRestore;
      await product.save();

      console.log(
        `Stock restored for ${product.title}: ${oldStock} → ${product.quantityAvailable}`
      );
    }

    console.log("=== Stock Restoration Test Completed ===");
  } catch (error) {
    console.error("Error testing stock restoration:", error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the test
testStockRestoration();
