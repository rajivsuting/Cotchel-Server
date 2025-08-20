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

  try {
    console.log(`Attempting to send email to: ${to}`);
    console.log(`From: ${process.env.SENDGRID_FROM_EMAIL}`);

    await sgMail.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      text,
      html,
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
