/**
 * Invoice Generation Service - Production-ready with improved design
 * Generates professional invoices for confirmed orders
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Order = require("../models/order");

class InvoiceService {
  /**
   * Generate invoice PDF for an order
   */
  static async generateInvoice(orderId) {
    try {
      // Fetch order with all details
      const order = await Order.findById(orderId)
        .populate("products.product", "title sku brand model")
        .populate("buyer", "fullName email phoneNumber")
        .populate("seller", "fullName email phoneNumber")
        .lean();

      if (!order) {
        throw new Error("Order not found");
      }

      // Check if order is eligible for invoice
      if (order.paymentStatus !== "Paid") {
        throw new Error("Invoice can only be generated for paid orders");
      }

      // Create PDF document with proper margins
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        bufferPages: true,
      });

      // Add content to PDF
      let currentY = 50;
      currentY = this.addHeader(doc, order, currentY);
      currentY = this.addInvoiceDetails(doc, order, currentY);
      currentY = this.addBillingShippingInfo(doc, order, currentY);
      currentY = this.addProductTable(doc, order, currentY);
      currentY = this.addTotalSection(doc, order, currentY);
      this.addFooter(doc);

      // Finalize PDF
      doc.end();

      return doc;
    } catch (error) {
      console.error("Error generating invoice:", error);
      throw error;
    }
  }

  /**
   * Add header with logo and company details
   */
  static addHeader(doc, order, startY) {
    // Company Logo and Name (Left side)
    doc
      .fontSize(26)
      .font("Helvetica-Bold")
      .fillColor("#0c0b45")
      .text("COTCHEL", 50, startY);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Your Trusted B2B Marketplace", 50, startY + 30);

    // Invoice Title (Right side)
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor("#0c0b45")
      .text("TAX INVOICE", 400, startY, {
        width: 145,
        align: "right",
      });

    // Add line separator
    doc
      .strokeColor("#0c0b45")
      .lineWidth(2)
      .moveTo(50, startY + 50)
      .lineTo(545, startY + 50)
      .stroke();

    return startY + 70;
  }

  /**
   * Add invoice details (invoice number, date, etc.)
   */
  static addInvoiceDetails(doc, order, startY) {
    const leftX = 50;
    const rightLabelX = 380;
    const rightValueX = 480;

    // Left column - Company details
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("From:", leftX, startY);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#444444")
      .text("Cotchel Marketplace", leftX, startY + 15)
      .text("support@cotchel.com", leftX, startY + 28)
      .text("+91-1234567890", leftX, startY + 41);

    // Right column - Invoice details with proper spacing
    let rightY = startY;

    // Invoice Number
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Invoice Number:", rightLabelX, rightY);

    doc
      .font("Helvetica")
      .fillColor("#444444")
      .text(
        `INV-${order._id.toString().slice(-8).toUpperCase()}`,
        rightValueX,
        rightY,
        {
          width: 65,
          align: "right",
        }
      );

    rightY += 18; // Increased spacing

    // Order ID - Use the full MongoDB _id as it's the real order ID
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Order ID:", rightLabelX, rightY);

    doc
      .font("Helvetica")
      .fillColor("#444444")
      .text(order._id.toString(), rightValueX, rightY, {
        width: 65,
        align: "right",
      });

    rightY += 18; // Increased spacing

    // Invoice Date
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Invoice Date:", rightLabelX, rightY);

    doc
      .font("Helvetica")
      .fillColor("#444444")
      .text(
        new Date(order.confirmedAt || order.createdAt).toLocaleDateString(
          "en-IN",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        ),
        rightValueX,
        rightY,
        {
          width: 65,
          align: "right",
        }
      );

    rightY += 18; // Increased spacing

    // Payment Status
    doc
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Payment Status:", rightLabelX, rightY);

    doc
      .font("Helvetica-Bold")
      .fillColor("#10B981")
      .text(order.paymentStatus, rightValueX, rightY, {
        width: 65,
        align: "right",
      });

    // Return the maximum Y position to ensure no overlap
    return Math.max(startY + 70, rightY + 20);
  }

  /**
   * Add billing and shipping information
   */
  static addBillingShippingInfo(doc, order, startY) {
    const leftX = 50;
    const middleX = 200;
    const rightX = 370;

    // Add spacing line
    doc
      .strokeColor("#E5E7EB")
      .lineWidth(1)
      .moveTo(50, startY)
      .lineTo(545, startY)
      .stroke();

    startY += 20;

    // Sold By (Seller Info) - Left column
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Sold By:", leftX, startY);

    let leftY = startY + 15;
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#444444")
      .text(order.seller?.fullName || "N/A", leftX, leftY, { width: 130 });

    if (order.seller?.email) {
      leftY += 13;
      doc.text(order.seller.email, leftX, leftY, { width: 130 });
    }

    if (order.seller?.phoneNumber) {
      leftY += 13;
      doc.text(order.seller.phoneNumber, leftX, leftY, { width: 130 });
    }

    // Billing Address (Buyer Info) - Middle column
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Bill To:", middleX, startY);

    let middleY = startY + 15;
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#444444")
      .text(order.buyer?.fullName || "N/A", middleX, middleY, { width: 150 });

    if (order.buyer?.email) {
      middleY += 13;
      doc.text(order.buyer.email, middleX, middleY, { width: 150 });
    }

    if (order.buyer?.phoneNumber) {
      middleY += 13;
      doc.text(order.buyer.phoneNumber, middleX, middleY, { width: 150 });
    }

    // Shipping Address - Right column
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Ship To:", rightX, startY);

    let rightY = startY + 15;
    if (order.address?.name) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#444444")
        .text(order.address.name, rightX, rightY, { width: 175 });
      rightY += 13;
    }

    if (order.address?.street) {
      doc.text(order.address.street, rightX, rightY, { width: 175 });
      rightY += 13;
    }

    const cityStatePin = [
      order.address?.city,
      order.address?.state,
      order.address?.pincode,
    ]
      .filter(Boolean)
      .join(", ");

    if (cityStatePin) {
      doc.text(cityStatePin, rightX, rightY, { width: 175 });
      rightY += 13;
    }

    if (order.address?.phone) {
      doc.text(`Phone: ${order.address.phone}`, rightX, rightY, { width: 175 });
    }

    // Return the maximum Y position from all three columns
    const maxY = Math.max(leftY, middleY, rightY);
    return maxY + 30;
  }

  /**
   * Add product table with proper spacing
   */
  static addProductTable(doc, order, startY) {
    const tableTop = startY;
    const itemCodeX = 50;
    const descriptionX = 120;
    const qtyX = 280;
    const priceX = 360;
    const amountX = 470;
    const rowHeight = 45; // Increased row height
    const tableWidth = 500; // Significantly increased table width

    // Table Header
    doc.rect(50, tableTop, tableWidth, 25).fillAndStroke("#0c0b45", "#0c0b45");

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text("Item", itemCodeX + 5, tableTop + 8, { width: 60 })
      .text("Description", descriptionX + 5, tableTop + 8, { width: 150 })
      .text("Qty", qtyX, tableTop + 8, { width: 50, align: "center" })
      .text("Price", priceX - 20, tableTop + 8, { width: 90, align: "right" })
      .text("Amount", amountX - 20, tableTop + 8, {
        width: 90,
        align: "right",
      });

    // Table Rows
    let currentY = tableTop + 30;

    order.products.forEach((item, index) => {
      const product = item.product || {};
      const bgColor = index % 2 === 0 ? "#F9FAFB" : "#FFFFFF";

      // Row background
      doc
        .rect(50, currentY, tableWidth, rowHeight)
        .fillAndStroke(bgColor, "#E5E7EB");

      // Item Code/SKU
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#000000")
        .text(
          (product.sku || "N/A").substring(0, 8),
          itemCodeX + 5,
          currentY + 10,
          { width: 60, lineBreak: false }
        );

      // Product Description - Much shorter
      const productTitle = (product.title || "Unknown Product").substring(
        0,
        35
      );
      const brandModel = [product.brand, product.model]
        .filter(Boolean)
        .join(" ")
        .substring(0, 25);

      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text(productTitle, descriptionX + 5, currentY + 8, {
          width: 150,
          lineBreak: false,
          ellipsis: true,
        });

      if (brandModel) {
        doc
          .fontSize(7)
          .font("Helvetica")
          .fillColor("#666666")
          .text(brandModel, descriptionX + 5, currentY + 22, {
            width: 150,
            lineBreak: false,
            ellipsis: true,
          });
      }

      // Quantity
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#000000")
        .text(item.quantity.toString(), qtyX + 5, currentY + 15, {
          width: 40,
          align: "center",
        });

      // Unit Price
      doc.text(`₹${(item.price || 0).toFixed(2)}`, priceX - 20, currentY + 15, {
        width: 85,
        align: "right",
      });

      // Total Amount
      doc
        .font("Helvetica-Bold")
        .text(
          `₹${(item.totalPrice || 0).toFixed(2)}`,
          amountX - 20,
          currentY + 15,
          {
            width: 85,
            align: "right",
          }
        );

      currentY += rowHeight;
    });

    // Table bottom border
    doc
      .strokeColor("#0c0b45")
      .lineWidth(2)
      .moveTo(50, currentY)
      .lineTo(50 + tableWidth, currentY)
      .stroke();

    return currentY + 20;
  }

  /**
   * Add total section with breakdown
   */
  static addTotalSection(doc, order, startY) {
    const labelX = 320; // Adjusted to align with much wider table
    const valueX = 440; // Adjusted to fit within much wider table width
    const maxWidth = 90; // Increased width for better readability
    let currentY = startY;

    // Subtotal
    const subtotal = order.products.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    );

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Subtotal:", labelX, currentY, { width: 90 });

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#000000")
      .text(`₹${subtotal.toFixed(2)}`, valueX + 5, currentY, {
        width: maxWidth,
        align: "right",
      });

    currentY += 20; // Increased spacing

    // Platform Fee (if applicable)
    if (order.platformFee && order.platformFee > 0) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#666666")
        .text(
          `Platform Fee (${order.platformFeePercentage || 0}%):`,
          labelX,
          currentY,
          { width: 90 }
        );

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#000000")
        .text(`₹${order.platformFee.toFixed(2)}`, valueX + 5, currentY, {
          width: maxWidth,
          align: "right",
        });

      currentY += 20; // Increased spacing
    }

    // Shipping
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Shipping:", labelX, currentY, { width: 90 });

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#10B981")
      .text("FREE", valueX, currentY, {
        width: maxWidth,
        align: "right",
      });

    currentY += 25;

    // Total Amount with background - adjusted width
    const totalBoxWidth = 240; // Increased width to accommodate much wider table
    doc
      .rect(labelX - 10, currentY - 5, totalBoxWidth, 35)
      .fillAndStroke("#0c0b45", "#0c0b45");

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text("Total Amount:", labelX, currentY + 10, { width: 90 });

    doc
      .fontSize(12)
      .text(`₹${order.totalPrice.toFixed(2)}`, valueX + 5, currentY + 10, {
        width: maxWidth,
        align: "right",
      });

    currentY += 50;

    // Payment Details - adjusted positioning
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Payment Method: Razorpay (Online)", labelX, currentY, {
        width: 170,
      });

    currentY += 15;

    const txnId = order.razorpayPaymentId
      ? order.razorpayPaymentId.substring(0, 18) // Further reduced character limit
      : "N/A";

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#666666")
      .text(`Transaction: ${txnId}`, labelX, currentY, { width: 170 });

    return currentY + 30;
  }

  /**
   * Add footer with terms and company info
   */
  static addFooter(doc) {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 100;

    // Add separator line
    doc
      .strokeColor("#E5E7EB")
      .lineWidth(1)
      .moveTo(50, footerY)
      .lineTo(545, footerY)
      .stroke();

    // Terms and conditions
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("Terms & Conditions:", 50, footerY + 15);

    doc
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#666666")
      .text(
        "• Goods once sold cannot be exchanged    • Returns accepted within 7 days for eligible items    • Subject to local jurisdiction",
        50,
        footerY + 28,
        { width: 495, align: "left" }
      );

    // Company info at the very bottom
    doc
      .fontSize(7)
      .fillColor("#999999")
      .text(
        "This is a computer-generated invoice and does not require a signature.",
        50,
        footerY + 50,
        { align: "center", width: 495 }
      );

    doc.text(
      "Cotchel - Your Trusted B2B Marketplace | support@cotchel.com | +91-1234567890",
      50,
      footerY + 63,
      { align: "center", width: 495 }
    );
  }

  /**
   * Save invoice to file system
   */
  static async saveInvoiceToFile(orderId) {
    try {
      const doc = await this.generateInvoice(orderId);
      const invoicesDir = path.join(__dirname, "../invoices");

      // Create invoices directory if it doesn't exist
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const filename = `invoice-${orderId}.pdf`;
      const filepath = path.join(invoicesDir, filename);

      // Write to file
      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(filepath));
        writeStream.on("error", reject);
      });
    } catch (error) {
      console.error("Error saving invoice:", error);
      throw error;
    }
  }

  /**
   * Generate invoice and return as buffer
   */
  static async generateInvoiceBuffer(orderId) {
    try {
      const doc = await this.generateInvoice(orderId);

      return new Promise((resolve, reject) => {
        const buffers = [];
        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", reject);
      });
    } catch (error) {
      console.error("Error generating invoice buffer:", error);
      throw error;
    }
  }

  /**
   * Check if invoice can be generated for order
   */
  static canGenerateInvoice(order) {
    const eligibleStatuses = [
      "Confirmed",
      "Processing",
      "Packed",
      "Shipped",
      "In Transit",
      "Out for Delivery",
      "Delivered",
      "Completed",
    ];

    return (
      eligibleStatuses.includes(order.status) && order.paymentStatus === "Paid"
    );
  }
}

module.exports = InvoiceService;
