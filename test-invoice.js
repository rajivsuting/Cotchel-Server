/**
 * Test Invoice Generation
 * Run this script to test if invoice generation works correctly
 * Usage: node test-invoice.js <orderId>
 */

require("dotenv").config();
const mongoose = require("mongoose");
const InvoiceService = require("./services/invoiceService");
const fs = require("fs");
const path = require("path");

// Get order ID from command line
const orderId = process.argv[2];

if (!orderId) {
  console.error("❌ Please provide an order ID");
  console.log("Usage: node test-invoice.js <orderId>");
  process.exit(1);
}

async function testInvoiceGeneration() {
  try {
    // Connect to database
    console.log("📦 Connecting to database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to database");

    // Fetch order
    const Order = require("./models/order");
    const order = await Order.findById(orderId)
      .populate("products.product", "title sku brand model")
      .populate("buyer", "fullName email phoneNumber")
      .populate("seller", "fullName email phoneNumber")
      .lean();

    if (!order) {
      console.error("❌ Order not found");
      process.exit(1);
    }

    console.log("\n📋 Order Details:");
    console.log("  Order ID:", orderId);
    console.log("  Status:", order.status);
    console.log("  Payment Status:", order.paymentStatus);
    console.log("  Total Price:", order.totalPrice);
    console.log("  Products:", order.products.length);

    // Check if invoice can be generated
    const canGenerate = InvoiceService.canGenerateInvoice(order);
    console.log("\n📄 Invoice Eligibility:", canGenerate ? "✅ Yes" : "❌ No");

    if (!canGenerate) {
      console.log("\n⚠️  Invoice can only be generated for:");
      console.log(
        "   - Orders with status: Confirmed, Processing, Packed, Shipped, In Transit, Out for Delivery, Delivered, Completed"
      );
      console.log("   - Orders with payment status: Paid");
      console.log("\n   Current status:", order.status);
      console.log("   Current payment status:", order.paymentStatus);
      process.exit(1);
    }

    // Generate invoice
    console.log("\n🔨 Generating invoice...");
    const testDir = path.join(__dirname, "test-invoices");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const filename = `test-invoice-${orderId}.pdf`;
    const filepath = path.join(testDir, filename);

    const doc = await InvoiceService.generateInvoice(orderId);
    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    writeStream.on("finish", () => {
      console.log("✅ Invoice generated successfully!");
      console.log("📁 Saved to:", filepath);
      console.log("\n✨ Test completed successfully!");
      mongoose.disconnect();
      process.exit(0);
    });

    writeStream.on("error", (error) => {
      console.error("❌ Error saving invoice:", error);
      mongoose.disconnect();
      process.exit(1);
    });
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    mongoose.disconnect();
    process.exit(1);
  }
}

testInvoiceGeneration();
