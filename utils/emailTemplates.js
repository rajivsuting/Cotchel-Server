/**
 * Professional Email Templates for Order Notifications
 * Provides HTML and text templates for various order-related emails
 */

const getOrderConfirmationTemplate = (orderData) => {
  const {
    orderId,
    buyerName,
    buyerEmail,
    totalPrice,
    products,
    shippingAddress,
    orderDate,
    estimatedDelivery,
    trackingInfo,
    sellerInfo,
  } = orderData;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="format-detection" content="telephone=no">
    <meta name="format-detection" content="date=no">
    <meta name="format-detection" content="address=no">
    <meta name="format-detection" content="email=no">
    <title>Order Confirmation - Cotchel</title>
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
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 30px;
        }
        .order-info {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #0c0b45;
        }
        .order-info h3 {
            margin: 0 0 15px 0;
            color: #0c0b45;
            font-size: 18px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            font-weight: 600;
            color: #495057;
        }
        .info-value {
            color: #212529;
        }
        .products-section {
            margin: 25px 0;
        }
        .product-item {
            display: flex;
            align-items: center;
            padding: 15px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin: 10px 0;
            background-color: #ffffff;
        }
        .product-image {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 6px;
            margin-right: 15px;
        }
        .product-details {
            flex: 1;
        }
        .product-name {
            font-weight: 600;
            color: #0c0b45;
            margin: 0 0 5px 0;
        }
        .product-meta {
            color: #6c757d;
            font-size: 14px;
            margin: 2px 0;
        }
        .product-price {
            font-weight: 700;
            color: #28a745;
            font-size: 16px;
        }
        .address-section {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .address-section h3 {
            margin: 0 0 15px 0;
            color: #0c0b45;
            font-size: 18px;
        }
        .address-details {
            color: #495057;
            line-height: 1.8;
        }
        .total-section {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 25px 0;
        }
        .total-section h3 {
            margin: 0 0 10px 0;
            font-size: 20px;
        }
        .total-amount {
            font-size: 32px;
            font-weight: 700;
            margin: 0;
        }
        .next-steps {
            background-color: #e3f2fd;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            border-left: 4px solid #2196f3;
        }
        .next-steps h3 {
            margin: 0 0 15px 0;
            color: #1976d2;
            font-size: 18px;
        }
        .next-steps ul {
            margin: 0;
            padding-left: 20px;
        }
        .next-steps li {
            margin: 8px 0;
            color: #424242;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer p {
            margin: 5px 0;
            color: #6c757d;
            font-size: 14px;
        }
        .footer a {
            color: #0c0b45;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #0c0b45 0%, #1c1a7a 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 15px 0;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .content {
                padding: 20px;
            }
            .product-item {
                flex-direction: column;
                text-align: center;
            }
            .product-image {
                margin: 0 0 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Order Confirmed!</h1>
            <p>Thank you for your purchase. Your order has been successfully placed.</p>
        </div>
        
        <div class="content">
            <div class="order-info">
                <h3>Order Details</h3>
                <div class="info-row">
                    <span class="info-label">Order Number:</span>
                    <span class="info-value">#${orderId}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Order Date:</span>
                    <span class="info-value">${new Date(
                      orderDate
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Payment Status:</span>
                    <span class="info-value" style="color: #28a745; font-weight: 600;">✅ Paid</span>
                </div>
                ${
                  estimatedDelivery
                    ? `
                <div class="info-row">
                    <span class="info-label">Estimated Delivery:</span>
                    <span class="info-value">${new Date(
                      estimatedDelivery
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}</span>
                </div>
                `
                    : ""
                }
                ${
                  trackingInfo
                    ? `
                <div class="info-row">
                    <span class="info-label">Tracking Number:</span>
                    <span class="info-value">${trackingInfo}</span>
                </div>
                `
                    : ""
                }
            </div>

            <div class="products-section">
                <h3 style="color: #0c0b45; margin-bottom: 20px;">Items Ordered</h3>
                ${products
                  .map(
                    (product) => `
                    <div class="product-item">
                        <img src="${
                          product.featuredImage || "/placeholder.png"
                        }" 
                             alt="${product.name}" 
                             class="product-image"
                             onerror="this.src='/placeholder.png'">
                        <div class="product-details">
                            <h4 class="product-name">${product.name}</h4>
                            <p class="product-meta">Quantity: ${
                              product.quantity
                            } ${
                      product.lotSize ? `× ${product.lotSize} units` : "units"
                    }</p>
                            <p class="product-meta">Unit Price: ₹${product.price.toFixed(
                              2
                            )}</p>
                            ${
                              sellerInfo
                                ? `<p class="product-meta">Sold by: ${
                                    sellerInfo.businessName ||
                                    sellerInfo.personalName
                                  }</p>`
                                : ""
                            }
                        </div>
                        <div class="product-price">₹${product.totalPrice.toFixed(
                          2
                        )}</div>
                    </div>
                `
                  )
                  .join("")}
            </div>

            ${
              shippingAddress
                ? `
            <div class="address-section">
                <h3>Shipping Address</h3>
                <div class="address-details">
                    <strong>${shippingAddress.name}</strong><br>
                    ${shippingAddress.street}<br>
                    ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.pincode}<br>
                    ${shippingAddress.country}<br>
                    <strong>Phone:</strong> ${shippingAddress.phone}
                </div>
            </div>
            `
                : ""
            }

            <div class="total-section">
                <h3>Total Amount Paid</h3>
                <p class="total-amount">₹${totalPrice.toFixed(2)}</p>
            </div>

            <div class="next-steps">
                <h3>What's Next?</h3>
                <ul>
                    <li>Your order is being processed by the seller</li>
                    <li>You'll receive a shipping confirmation email once your items are dispatched</li>
                    <li>Track your order status in your account dashboard</li>
                    <li>Contact support if you have any questions</li>
                </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${
                  process.env.CLIENT_URL || "https://cotchel.com"
                }/buyer/orders" class="cta-button">
                    View Order Details
                </a>
            </div>
        </div>

        <div class="footer">
            <p><strong>Cotchel - Your Trusted Electronics Marketplace</strong></p>
            <p>Questions? Contact us at <a href="mailto:support@cotchel.com">support@cotchel.com</a></p>
            <p>Visit us at <a href="${
              process.env.CLIENT_URL || "https://cotchel.com"
            }">cotchel.com</a></p>
            <p style="margin-top: 15px; font-size: 12px; color: #adb5bd;">
                This is an automated transactional email regarding your order. Please do not reply to this message.
            </p>
            <p style="font-size: 11px; color: #adb5bd; margin-top: 10px;">
                You received this email because you placed an order with Cotchel. 
                <a href="${
                  process.env.CLIENT_URL || "https://cotchel.com"
                }/unsubscribe" style="color: #6c757d;">Unsubscribe</a> from order notifications.
            </p>
        </div>
    </div>
</body>
</html>`;

  const text = `
🎉 ORDER CONFIRMED - Thank you for your purchase!

Order Details:
- Order Number: #${orderId}
- Order Date: ${new Date(orderDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}
- Payment Status: ✅ Paid
${
  estimatedDelivery
    ? `- Estimated Delivery: ${new Date(estimatedDelivery).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      )}`
    : ""
}
${trackingInfo ? `- Tracking Number: ${trackingInfo}` : ""}

Items Ordered:
${products
  .map(
    (product) => `
• ${product.name}
  Quantity: ${product.quantity} ${
      product.lotSize ? `× ${product.lotSize} units` : "units"
    }
  Unit Price: ₹${product.price.toFixed(2)}
  Total: ₹${product.totalPrice.toFixed(2)}
  ${
    sellerInfo
      ? `Sold by: ${sellerInfo.businessName || sellerInfo.personalName}`
      : ""
  }
`
  )
  .join("")}

${
  shippingAddress
    ? `
Shipping Address:
${shippingAddress.name}
${shippingAddress.street}
${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.pincode}
${shippingAddress.country}
Phone: ${shippingAddress.phone}
`
    : ""
}

Total Amount Paid: ₹${totalPrice.toFixed(2)}

What's Next?
• Your order is being processed by the seller
• You'll receive a shipping confirmation email once your items are dispatched
• Track your order status in your account dashboard
• Contact support if you have any questions

View your order: ${process.env.CLIENT_URL || "https://cotchel.com"}/buyer/orders

---
Cotchel - Your Trusted Electronics Marketplace
Questions? Contact us at support@cotchel.com
Visit us at ${process.env.CLIENT_URL || "https://cotchel.com"}

This is an automated transactional email regarding your order. Please do not reply to this message.

You received this email because you placed an order with Cotchel.
To unsubscribe from order notifications, visit: ${
    process.env.CLIENT_URL || "https://cotchel.com"
  }/unsubscribe
`;

  return { html, text };
};

const getOrderShippedTemplate = (orderData) => {
  const {
    orderId,
    buyerName,
    trackingNumber,
    carrier,
    estimatedDelivery,
    products,
    shippingAddress,
  } = orderData;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Shipped - Cotchel</title>
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
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .tracking-info {
            background-color: #e8f5e8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #28a745;
            text-align: center;
        }
        .tracking-number {
            font-size: 24px;
            font-weight: 700;
            color: #28a745;
            margin: 10px 0;
        }
        .content {
            padding: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚚 Order Shipped!</h1>
            <p>Your order is on its way to you.</p>
        </div>
        
        <div class="content">
            <div class="tracking-info">
                <h3>Tracking Information</h3>
                <p class="tracking-number">${trackingNumber}</p>
                <p><strong>Carrier:</strong> ${carrier}</p>
                ${
                  estimatedDelivery
                    ? `<p><strong>Estimated Delivery:</strong> ${new Date(
                        estimatedDelivery
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}</p>`
                    : ""
                }
            </div>
            
            <p>Hello ${buyerName},</p>
            <p>Great news! Your order #${orderId} has been shipped and is on its way to you.</p>
            
            <p>You can track your package using the tracking number above. We'll also send you updates as your package moves through the delivery process.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${
                  process.env.CLIENT_URL || "https://cotchel.com"
                }/buyer/orders" class="cta-button">
                    Track Your Order
                </a>
            </div>
        </div>
    </div>
</body>
</html>`;

  const text = `
🚚 ORDER SHIPPED - Your order is on its way!

Hello ${buyerName},

Great news! Your order #${orderId} has been shipped and is on its way to you.

Tracking Information:
- Tracking Number: ${trackingNumber}
- Carrier: ${carrier}
${
  estimatedDelivery
    ? `- Estimated Delivery: ${new Date(estimatedDelivery).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      )}`
    : ""
}

You can track your package using the tracking number above. We'll also send you updates as your package moves through the delivery process.

Track your order: ${
    process.env.CLIENT_URL || "https://cotchel.com"
  }/buyer/orders

---
Cotchel - Your Trusted Electronics Marketplace
`;

  return { html, text };
};

const getOrderDeliveredTemplate = (orderData) => {
  const { orderId, buyerName, products, deliveryDate } = orderData;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Delivered - Cotchel</title>
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
            background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .content {
            padding: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Order Delivered!</h1>
            <p>Your order has been successfully delivered.</p>
        </div>
        
        <div class="content">
            <p>Hello ${buyerName},</p>
            <p>Excellent! Your order #${orderId} has been successfully delivered on ${new Date(
    deliveryDate
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}.</p>
            
            <p>We hope you're satisfied with your purchase! If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${
                  process.env.CLIENT_URL || "https://cotchel.com"
                }/buyer/orders" class="cta-button">
                    View Order Details
                </a>
            </div>
        </div>
    </div>
</body>
</html>`;

  const text = `
📦 ORDER DELIVERED - Your order has been successfully delivered!

Hello ${buyerName},

Excellent! Your order #${orderId} has been successfully delivered on ${new Date(
    deliveryDate
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}.

We hope you're satisfied with your purchase! If you have any questions or need assistance, please don't hesitate to contact our support team.

View your order: ${process.env.CLIENT_URL || "https://cotchel.com"}/buyer/orders

---
Cotchel - Your Trusted Electronics Marketplace
`;

  return { html, text };
};

const getPasswordResetTemplate = (resetData) => {
  const { userName, resetLink, expiryTime = "1 hour" } = resetData;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="format-detection" content="telephone=no">
    <meta name="format-detection" content="date=no">
    <meta name="format-detection" content="address=no">
    <meta name="format-detection" content="email=no">
    <title>Password Reset - Cotchel</title>
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
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 30px;
        }
        .security-notice {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #f39c12;
        }
        .security-notice h3 {
            margin: 0 0 10px 0;
            color: #856404;
            font-size: 16px;
        }
        .security-notice p {
            margin: 5px 0;
            color: #856404;
            font-size: 14px;
        }
        .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #0c0b45 0%, #1c1a7a 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .reset-button:hover {
            transform: translateY(-2px);
        }
        .reset-link {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            word-break: break-all;
            font-family: monospace;
            font-size: 12px;
            color: #6c757d;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer p {
            margin: 5px 0;
            color: #6c757d;
            font-size: 14px;
        }
        .footer a {
            color: #0c0b45;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .steps {
            background-color: #e3f2fd;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #2196f3;
        }
        .steps h3 {
            margin: 0 0 15px 0;
            color: #1976d2;
            font-size: 18px;
        }
        .steps ol {
            margin: 0;
            padding-left: 20px;
        }
        .steps li {
            margin: 8px 0;
            color: #424242;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .content {
                padding: 20px;
            }
            .reset-button {
                display: block;
                text-align: center;
                margin: 20px auto;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset</h1>
            <p>Secure your account with a new password</p>
        </div>
        
        <div class="content">
            <p>Hello ${userName || "Valued Customer"},</p>
            
            <p>We received a request to reset your password for your Cotchel account. If you made this request, please click the button below to create a new password.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" class="reset-button">
                    Reset My Password
                </a>
            </div>
            
            <div class="security-notice">
                <h3>🛡️ Security Notice</h3>
                <p><strong>This link will expire in ${expiryTime}.</strong></p>
                <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                <p>For your security, never share this link with anyone.</p>
            </div>
            
            <div class="steps">
                <h3>How to Reset Your Password</h3>
                <ol>
                    <li>Click the "Reset My Password" button above</li>
                    <li>Enter your new password (minimum 8 characters)</li>
                    <li>Confirm your new password</li>
                    <li>Click "Update Password" to save changes</li>
                </ol>
            </div>
            
            <p><strong>Can't click the button?</strong> Copy and paste this link into your browser:</p>
            <div class="reset-link">${resetLink}</div>
            
            <p>If you continue to have problems, please contact our support team at <a href="mailto:support@cotchel.com">support@cotchel.com</a>.</p>
        </div>

        <div class="footer">
            <p><strong>Cotchel - Your Trusted Electronics Marketplace</strong></p>
            <p>Questions? Contact us at <a href="mailto:support@cotchel.com">support@cotchel.com</a></p>
            <p>Visit us at <a href="${
              process.env.CLIENT_URL || "https://cotchel.com"
            }">cotchel.com</a></p>
            <p style="margin-top: 15px; font-size: 12px; color: #adb5bd;">
                This is an automated security email. Please do not reply to this message.
            </p>
            <p style="font-size: 11px; color: #adb5bd; margin-top: 10px;">
                You received this email because a password reset was requested for your Cotchel account.
            </p>
        </div>
    </div>
</body>
</html>`;

  const text = `
🔐 PASSWORD RESET - Secure your account with a new password

Hello ${userName || "Valued Customer"},

We received a request to reset your password for your Cotchel account. If you made this request, please use the link below to create a new password.

Reset your password: ${resetLink}

🛡️ SECURITY NOTICE:
- This link will expire in ${expiryTime}
- If you didn't request this password reset, please ignore this email
- Your password will remain unchanged if you don't use this link
- For your security, never share this link with anyone

HOW TO RESET YOUR PASSWORD:
1. Click the link above or copy it to your browser
2. Enter your new password (minimum 8 characters)
3. Confirm your new password
4. Click "Update Password" to save changes

If you continue to have problems, please contact our support team at support@cotchel.com.

---
Cotchel - Your Trusted Electronics Marketplace
Questions? Contact us at support@cotchel.com
Visit us at ${process.env.CLIENT_URL || "https://cotchel.com"}

This is an automated security email. Please do not reply to this message.

You received this email because a password reset was requested for your Cotchel account.
`;

  return { html, text };
};

const getEmailVerificationTemplate = (verificationData) => {
  const {
    userName,
    verificationCode,
    expiryTime = "10 minutes",
  } = verificationData;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="format-detection" content="telephone=no">
    <meta name="format-detection" content="date=no">
    <meta name="format-detection" content="address=no">
    <meta name="format-detection" content="email=no">
    <title>Email Verification - Cotchel</title>
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
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 30px;
        }
        .verification-code {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 25px 0;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
        }
        .verification-code h2 {
            margin: 0 0 15px 0;
            font-size: 24px;
            font-weight: 700;
        }
        .code-display {
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }
        .security-notice {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #f39c12;
        }
        .security-notice h3 {
            margin: 0 0 10px 0;
            color: #856404;
            font-size: 16px;
        }
        .security-notice p {
            margin: 5px 0;
            color: #856404;
            font-size: 14px;
        }
        .steps {
            background-color: #e3f2fd;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #2196f3;
        }
        .steps h3 {
            margin: 0 0 15px 0;
            color: #1976d2;
            font-size: 18px;
        }
        .steps ol {
            margin: 0;
            padding-left: 20px;
        }
        .steps li {
            margin: 8px 0;
            color: #424242;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer p {
            margin: 5px 0;
            color: #6c757d;
            font-size: 14px;
        }
        .footer a {
            color: #0c0b45;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .content {
                padding: 20px;
            }
            .code-display {
                font-size: 24px;
                letter-spacing: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 Email Verification</h1>
            <p>Verify your email address to complete your registration</p>
        </div>
        
        <div class="content">
            <p>Hello ${userName || "Valued Customer"},</p>
            
            <p>Welcome to Cotchel! To complete your account setup and start shopping, please verify your email address using the verification code below.</p>
            
            <div class="verification-code">
                <h2>Your Verification Code</h2>
                <div class="code-display">${verificationCode}</div>
                <p style="margin: 0; opacity: 0.9;">Enter this code in the verification form</p>
            </div>
            
            <div class="security-notice">
                <h3>🛡️ Security Notice</h3>
                <p><strong>This code will expire in ${expiryTime}.</strong></p>
                <p>If you didn't create an account with Cotchel, please ignore this email.</p>
                <p>For your security, never share this verification code with anyone.</p>
            </div>
            
            <div class="steps">
                <h3>How to Verify Your Email</h3>
                <ol>
                    <li>Return to the Cotchel verification page</li>
                    <li>Enter the verification code shown above</li>
                    <li>Click "Verify Email" to complete your registration</li>
                    <li>Start shopping on Cotchel!</li>
                </ol>
            </div>
            
            <p>If you're having trouble with the verification process, please contact our support team at <a href="mailto:support@cotchel.com">support@cotchel.com</a>.</p>
        </div>

        <div class="footer">
            <p><strong>Cotchel - Your Trusted Electronics Marketplace</strong></p>
            <p>Questions? Contact us at <a href="mailto:support@cotchel.com">support@cotchel.com</a></p>
            <p>Visit us at <a href="${
              process.env.CLIENT_URL || "https://cotchel.com"
            }">cotchel.com</a></p>
            <p style="margin-top: 15px; font-size: 12px; color: #adb5bd;">
                This is an automated verification email. Please do not reply to this message.
            </p>
            <p style="font-size: 11px; color: #adb5bd; margin-top: 10px;">
                You received this email because you registered for a Cotchel account.
            </p>
        </div>
    </div>
</body>
</html>`;

  const text = `
📧 EMAIL VERIFICATION - Verify your email address to complete your registration

Hello ${userName || "Valued Customer"},

Welcome to Cotchel! To complete your account setup and start shopping, please verify your email address using the verification code below.

YOUR VERIFICATION CODE: ${verificationCode}

🛡️ SECURITY NOTICE:
- This code will expire in ${expiryTime}
- If you didn't create an account with Cotchel, please ignore this email
- For your security, never share this verification code with anyone

HOW TO VERIFY YOUR EMAIL:
1. Return to the Cotchel verification page
2. Enter the verification code shown above
3. Click "Verify Email" to complete your registration
4. Start shopping on Cotchel!

If you're having trouble with the verification process, please contact our support team at support@cotchel.com.

---
Cotchel - Your Trusted Electronics Marketplace
Questions? Contact us at support@cotchel.com
Visit us at ${process.env.CLIENT_URL || "https://cotchel.com"}

This is an automated verification email. Please do not reply to this message.

You received this email because you registered for a Cotchel account.
`;

  return { html, text };
};

module.exports = {
  getOrderConfirmationTemplate,
  getOrderShippedTemplate,
  getOrderDeliveredTemplate,
  getPasswordResetTemplate,
  getEmailVerificationTemplate,
};
