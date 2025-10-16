const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, { text, html }) => {
  // Check if required environment variables are set
  if (!process.env.SENDGRID_API_KEY) {
    console.error("SendGrid API key is not configured");
    throw new Error("Email service not configured: Missing SENDGRID_API_KEY");
  }

  if (!process.env.SENDGRID_FROM_EMAIL) {
    console.error("SendGrid from email is not configured");
    throw new Error(
      "Email service not configured: Missing SENDGRID_FROM_EMAIL"
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error(`Invalid email address: ${to}`);
  }

  // Validate subject line (should not be empty and not too long)
  if (!subject || subject.trim().length === 0) {
    throw new Error("Email subject cannot be empty");
  }
  if (subject.length > 200) {
    throw new Error("Email subject is too long (max 200 characters)");
  }

  try {
    console.log(`Attempting to send email to: ${to}`);
    console.log(`From: ${process.env.SENDGRID_FROM_EMAIL}`);
    console.log(`Subject: ${subject}`);

    await sgMail.send({
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: "Cotchel - Electronics Marketplace",
      },
      replyTo: {
        email: "support@cotchel.com",
        name: "Cotchel Support",
      },
      subject,
      text,
      html,
      // Add headers to improve deliverability
      headers: {
        "X-Mailer": "Cotchel-Email-Service",
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        Importance: "Normal",
        "X-Cotchel-Order": "true",
      },
      // Add categories for better email management
      categories: ["order-confirmation", "transactional"],
      // Add custom args for tracking
      customArgs: {
        source: "order-system",
        type: "transactional",
      },
    });

    console.log("Email sent successfully");
  } catch (error) {
    console.error("SendGrid error details:");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);

    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response body:",
        JSON.stringify(error.response.body, null, 2)
      );
    }

    // Provide more specific error messages
    if (error.code === 401) {
      throw new Error("Email service error: Invalid API key");
    } else if (error.code === 403) {
      throw new Error(
        "Email service error: Forbidden - check sender email verification"
      );
    } else if (error.response?.body?.errors) {
      const errorMessages = error.response.body.errors
        .map((err) => err.message)
        .join(", ");
      throw new Error(`Email service error: ${errorMessages}`);
    } else {
      throw new Error(`Email service error: ${error.message}`);
    }
  }
};

module.exports = sendEmail;
