const Inquiry = require("../models/inquiry");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Get all inquiries with pagination and filters
exports.getAllInquiries = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, inquiryType, search } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (inquiryType) filter.inquiryType = inquiryType;
    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    // Get inquiries with pagination
    const inquiries = await Inquiry.find(filter)
      .populate("user", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await Inquiry.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        inquiries,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching inquiries:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inquiries",
      error: error.message,
    });
  }
};

// Get single inquiry by ID
exports.getInquiryById = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id)
      .populate("user", "fullName email")
      .populate("history.updatedBy", "fullName")
      .populate("responses.sentBy", "fullName")
      .lean();

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found",
      });
    }

    res.status(200).json({
      success: true,
      data: inquiry,
    });
  } catch (error) {
    console.error("Error fetching inquiry:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inquiry",
      error: error.message,
    });
  }
};

// Create new inquiry
exports.createInquiry = async (req, res) => {
  try {
    const { subject, message, inquiryType, attachments } = req.body;
    const userId = req.user._id;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    // Extract only URLs from attachments
    const attachmentUrls = attachments
      ? attachments.map((attachment) => attachment.url)
      : [];

    const inquiry = await Inquiry.create({
      user: userId,
      subject,
      message,
      inquiryType,
      attachments: attachmentUrls,
      history: [
        {
          message: "Inquiry created",
          status: "Open",
          updatedBy: userId,
        },
      ],
    });

    // Populate user details
    await inquiry.populate("user", "fullName email");

    res.status(201).json({
      success: true,
      message: "Inquiry created successfully",
      data: inquiry,
    });
  } catch (error) {
    console.error("Error creating inquiry:", error);
    res.status(500).json({
      success: false,
      message: "Error creating inquiry",
      error: error.message,
    });
  }
};

// Update inquiry status
exports.updateInquiryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found",
      });
    }

    inquiry.status = status;
    inquiry.history.push({
      message: `Status updated to ${status}`,
      status,
      updatedBy: req.user._id,
    });
    inquiry.lastUpdated = new Date();

    await inquiry.save();

    res.status(200).json({
      success: true,
      data: inquiry,
    });
  } catch (error) {
    console.error("Error updating inquiry status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating inquiry status",
      error: error.message,
    });
  }
};

// Add response to inquiry
exports.addResponse = async (req, res) => {
  try {
    const { message, subject } = req.body;
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found",
      });
    }

    // Get the user to send email to
    const user = await User.findById(inquiry.user);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Send email to user
    const url =
      process.env.NODE_ENV === "production"
        ? process.env.PRO_URL
        : process.env.DEV_URL;
    const inquiryLink = `${url}/customer-support/${inquiry._id}`;

    await sendEmail(user.email, subject || "Response to Your Inquiry", {
      text: `A response has been sent regarding your inquiry "${inquiry.subject}". Click here to view: ${inquiryLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0c0b45;">${
            subject || "Response to Your Inquiry"
          }</h2>
          <p>Hello ${user.fullName},</p>
          <p>Regarding your inquiry: <strong>${inquiry.subject}</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            ${message}
          </div>
          <a href="${inquiryLink}" 
             style="display: inline-block; background-color: #0c0b45; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
            View Inquiry
          </a>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            If you didn't create this inquiry, please ignore this email.
          </p>
        </div>
      `,
    });

    // Record the response in the application
    inquiry.responses.push({
      message,
      subject,
      sentBy: req.user._id,
      sentAt: new Date(),
      sentVia: "email",
    });
    inquiry.lastUpdated = new Date();

    await inquiry.save();

    res.status(200).json({
      success: true,
      data: inquiry,
      message: "Response sent successfully via email",
    });
  } catch (error) {
    console.error("Error sending response:", error);
    res.status(500).json({
      success: false,
      message: "Error sending response",
      error: error.message,
    });
  }
};

// Delete inquiry
exports.deleteInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findByIdAndDelete(req.params.id);

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Inquiry deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting inquiry:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting inquiry",
      error: error.message,
    });
  }
};
