/**
 * Invoice Controller - Handle invoice generation and download
 */

const InvoiceService = require("../services/invoiceService");
const Order = require("../models/order");

/**
 * Generate and download invoice (Buyer/Seller/Admin)
 */
exports.downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify access rights
    if (userRole === "Buyer" && order.buyer.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to download this invoice",
      });
    }

    if (userRole === "Seller" && order.seller.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to download this invoice",
      });
    }

    // Check if invoice can be generated
    if (!InvoiceService.canGenerateInvoice(order)) {
      return res.status(400).json({
        success: false,
        message: "Invoice can only be generated for confirmed and paid orders",
        currentStatus: order.status,
        paymentStatus: order.paymentStatus,
      });
    }

    // Generate invoice PDF
    const doc = await InvoiceService.generateInvoice(orderId);

    // Set response headers for PDF download
    const filename = `Cotchel-Invoice-${orderId.toString().slice(-8).toUpperCase()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Stream PDF to response
    doc.pipe(res);
  } catch (error) {
    console.error("Error downloading invoice:", error);
    
    // If headers not sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to generate invoice",
        error: error.message,
      });
    }
  }
};

/**
 * Preview invoice in browser (without download)
 */
exports.previewInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify access rights
    if (userRole === "Buyer" && order.buyer.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this invoice",
      });
    }

    if (userRole === "Seller" && order.seller.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this invoice",
      });
    }

    // Check if invoice can be generated
    if (!InvoiceService.canGenerateInvoice(order)) {
      return res.status(400).json({
        success: false,
        message: "Invoice can only be generated for confirmed and paid orders",
      });
    }

    // Generate invoice PDF
    const doc = await InvoiceService.generateInvoice(orderId);

    // Set response headers for inline display
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");

    // Stream PDF to response
    doc.pipe(res);
  } catch (error) {
    console.error("Error previewing invoice:", error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to generate invoice",
        error: error.message,
      });
    }
  }
};

/**
 * Check if invoice is available for order
 */
exports.checkInvoiceAvailability = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const canGenerate = InvoiceService.canGenerateInvoice(order);

    res.status(200).json({
      success: true,
      data: {
        available: canGenerate,
        status: order.status,
        paymentStatus: order.paymentStatus,
        message: canGenerate
          ? "Invoice is available for download"
          : "Invoice will be available after payment confirmation",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check invoice availability",
      error: error.message,
    });
  }
};

/**
 * Generate invoices for multiple orders (Admin bulk action)
 */
exports.bulkGenerateInvoices = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order IDs array is required",
      });
    }

    const results = await Promise.allSettled(
      orderIds.map((orderId) => InvoiceService.saveInvoiceToFile(orderId))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    res.status(200).json({
      success: true,
      message: `Generated ${successful} invoices, ${failed} failed`,
      data: {
        successful,
        failed,
        total: orderIds.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate invoices",
      error: error.message,
    });
  }
};

module.exports = exports;


