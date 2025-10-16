/**
 * Order Email Service
 * Handles sending professional email notifications for order-related events
 */

const sendEmail = require("../utils/sendEmail");
const {
  getOrderConfirmationTemplate,
  getOrderShippedTemplate,
  getOrderDeliveredTemplate,
} = require("../utils/emailTemplates");
const Order = require("../models/order");
const User = require("../models/User");

class OrderEmailService {
  /**
   * Send order confirmation email to buyer
   * @param {string} orderId - The order ID
   * @param {Object} options - Additional options
   */
  static async sendOrderConfirmationEmail(orderId, options = {}) {
    try {
      console.log(
        `📧 Preparing to send order confirmation email for order: ${orderId}`
      );

      // Fetch order with all required details
      const order = await Order.findById(orderId)
        .populate("products.product", "title featuredImage price")
        .populate("buyer", "fullName email")
        .populate({
          path: "seller",
          select: "fullName email sellerDetails",
          populate: {
            path: "sellerDetails",
            select: "businessName",
          },
        })
        .lean();

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (!order.buyer?.email) {
        throw new Error(`Buyer email not found for order: ${orderId}`);
      }

      // Format seller information
      const sellerInfo = order.seller
        ? {
            businessName: order.seller.sellerDetails?.businessName,
            personalName: order.seller.fullName,
          }
        : null;

      // Prepare email data
      const emailData = {
        orderId: order._id,
        buyerName: order.buyer.fullName || "Valued Customer",
        buyerEmail: order.buyer.email,
        totalPrice: order.totalPrice,
        products: order.products.map((item) => ({
          name: item.product?.title || "Unknown Product",
          featuredImage: item.product?.featuredImage,
          quantity: item.quantity,
          lotSize: item.lotSize,
          price: item.price,
          totalPrice: item.totalPrice,
        })),
        shippingAddress: order.address,
        orderDate: order.createdAt,
        estimatedDelivery: options.estimatedDelivery,
        trackingInfo: options.trackingInfo,
        sellerInfo,
      };

      // Generate email templates
      const { html, text } = getOrderConfirmationTemplate(emailData);

      // Send email with improved subject line
      await sendEmail(
        order.buyer.email,
        `Your Order #${order._id} is Confirmed - Cotchel`,
        { html, text }
      );

      console.log(
        `✅ Order confirmation email sent successfully to: ${order.buyer.email}`
      );
      return { success: true, email: order.buyer.email };
    } catch (error) {
      console.error(
        `❌ Error sending order confirmation email for order ${orderId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Send order shipped email to buyer
   * @param {string} orderId - The order ID
   * @param {Object} shippingDetails - Shipping information
   */
  static async sendOrderShippedEmail(orderId, shippingDetails = {}) {
    try {
      console.log(
        `📧 Preparing to send order shipped email for order: ${orderId}`
      );

      // Fetch order with buyer details
      const order = await Order.findById(orderId)
        .populate("buyer", "fullName email")
        .populate("products.product", "title")
        .lean();

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (!order.buyer?.email) {
        throw new Error(`Buyer email not found for order: ${orderId}`);
      }

      // Prepare email data
      const emailData = {
        orderId: order._id,
        buyerName: order.buyer.fullName || "Valued Customer",
        trackingNumber:
          shippingDetails.trackingNumber || order.shipmentId || "N/A",
        carrier: shippingDetails.carrier || "Standard Shipping",
        estimatedDelivery: shippingDetails.estimatedDelivery,
        products: order.products.map((item) => ({
          name: item.product?.title || "Unknown Product",
        })),
        shippingAddress: order.address,
      };

      // Generate email templates
      const { html, text } = getOrderShippedTemplate(emailData);

      // Send email with improved subject line
      await sendEmail(
        order.buyer.email,
        `Your Order #${order._id} has been Shipped - Cotchel`,
        { html, text }
      );

      console.log(
        `✅ Order shipped email sent successfully to: ${order.buyer.email}`
      );
      return { success: true, email: order.buyer.email };
    } catch (error) {
      console.error(
        `❌ Error sending order shipped email for order ${orderId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Send order delivered email to buyer
   * @param {string} orderId - The order ID
   * @param {Object} deliveryDetails - Delivery information
   */
  static async sendOrderDeliveredEmail(orderId, deliveryDetails = {}) {
    try {
      console.log(
        `📧 Preparing to send order delivered email for order: ${orderId}`
      );

      // Fetch order with buyer details
      const order = await Order.findById(orderId)
        .populate("buyer", "fullName email")
        .populate("products.product", "title")
        .lean();

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (!order.buyer?.email) {
        throw new Error(`Buyer email not found for order: ${orderId}`);
      }

      // Prepare email data
      const emailData = {
        orderId: order._id,
        buyerName: order.buyer.fullName || "Valued Customer",
        products: order.products.map((item) => ({
          name: item.product?.title || "Unknown Product",
        })),
        deliveryDate: deliveryDetails.deliveryDate || new Date(),
      };

      // Generate email templates
      const { html, text } = getOrderDeliveredTemplate(emailData);

      // Send email with improved subject line
      await sendEmail(
        order.buyer.email,
        `Your Order #${order._id} has been Delivered - Cotchel`,
        { html, text }
      );

      console.log(
        `✅ Order delivered email sent successfully to: ${order.buyer.email}`
      );
      return { success: true, email: order.buyer.email };
    } catch (error) {
      console.error(
        `❌ Error sending order delivered email for order ${orderId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Send order status update email to buyer
   * @param {string} orderId - The order ID
   * @param {string} newStatus - The new order status
   * @param {string} message - Additional message
   */
  static async sendOrderStatusUpdateEmail(orderId, newStatus, message = "") {
    try {
      console.log(
        `📧 Preparing to send order status update email for order: ${orderId}`
      );

      // Fetch order with buyer details
      const order = await Order.findById(orderId)
        .populate("buyer", "fullName email")
        .lean();

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (!order.buyer?.email) {
        throw new Error(`Buyer email not found for order: ${orderId}`);
      }

      // Create status-specific email content
      let subject, html, text;

      switch (newStatus.toLowerCase()) {
        case "processing":
          subject = `Your Order #${order._id} is being Processed - Cotchel`;
          html = this.createStatusUpdateHTML(
            order,
            "Processing",
            "Your order is being prepared for shipment.",
            message
          );
          text = this.createStatusUpdateText(
            order,
            "Processing",
            "Your order is being prepared for shipment.",
            message
          );
          break;
        case "packed":
          subject = `Your Order #${order._id} has been Packed - Cotchel`;
          html = this.createStatusUpdateHTML(
            order,
            "Packed",
            "Your order has been packed and is ready for shipment.",
            message
          );
          text = this.createStatusUpdateText(
            order,
            "Packed",
            "Your order has been packed and is ready for shipment.",
            message
          );
          break;
        case "shipped":
          return this.sendOrderShippedEmail(orderId);
        case "delivered":
          return this.sendOrderDeliveredEmail(orderId);
        default:
          subject = `Update on Your Order #${order._id} - Cotchel`;
          html = this.createStatusUpdateHTML(
            order,
            newStatus,
            "Your order status has been updated.",
            message
          );
          text = this.createStatusUpdateText(
            order,
            newStatus,
            "Your order status has been updated.",
            message
          );
      }

      // Send email
      await sendEmail(order.buyer.email, subject, { html, text });

      console.log(
        `✅ Order status update email sent successfully to: ${order.buyer.email}`
      );
      return { success: true, email: order.buyer.email };
    } catch (error) {
      console.error(
        `❌ Error sending order status update email for order ${orderId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create HTML template for status update emails
   */
  static createStatusUpdateHTML(order, status, description, message) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Update - Cotchel</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #0c0b45 0%, #1c1a7a 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .content {
            padding: 30px;
        }
        .status-badge {
            display: inline-block;
            background-color: #e3f2fd;
            color: #1976d2;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Order Update</h1>
            <p>Your order status has been updated</p>
        </div>
        
        <div class="content">
            <p>Hello ${order.buyer?.fullName || "Valued Customer"},</p>
            
            <div class="status-badge">${status}</div>
            
            <p>${description}</p>
            
            <p><strong>Order Number:</strong> #${order._id}</p>
            
            ${
              message
                ? `<p><strong>Additional Information:</strong> ${message}</p>`
                : ""
            }
            
            <p>You can track your order status in your account dashboard.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${
                  process.env.CLIENT_URL || "https://cotchel.com"
                }/buyer/orders" 
                   style="display: inline-block; background: linear-gradient(135deg, #0c0b45 0%, #1c1a7a 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                    View Order Details
                </a>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Create text template for status update emails
   */
  static createStatusUpdateText(order, status, description, message) {
    return `
📦 ORDER UPDATE - Your order status has been updated

Hello ${order.buyer?.fullName || "Valued Customer"},

Status: ${status}
${description}

Order Number: #${order._id}
${message ? `Additional Information: ${message}` : ""}

You can track your order status in your account dashboard.

View your order: ${process.env.CLIENT_URL || "https://cotchel.com"}/buyer/orders

---
Cotchel - Your Trusted Electronics Marketplace
`;
  }

  /**
   * Send bulk order confirmation emails (for multiple orders from same payment)
   * @param {Array} orderIds - Array of order IDs
   * @param {Object} options - Additional options
   */
  static async sendBulkOrderConfirmationEmails(orderIds, options = {}) {
    try {
      console.log(
        `📧 Preparing to send bulk order confirmation emails for ${orderIds.length} orders`
      );

      const results = [];

      for (const orderId of orderIds) {
        try {
          const result = await this.sendOrderConfirmationEmail(
            orderId,
            options
          );
          results.push({ orderId, success: true, ...result });
        } catch (error) {
          console.error(`Failed to send email for order ${orderId}:`, error);
          results.push({ orderId, success: false, error: error.message });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      console.log(
        `✅ Bulk email sending completed: ${successCount}/${orderIds.length} emails sent successfully`
      );

      return results;
    } catch (error) {
      console.error(
        `❌ Error in bulk order confirmation email sending:`,
        error
      );
      throw error;
    }
  }
}

module.exports = OrderEmailService;
