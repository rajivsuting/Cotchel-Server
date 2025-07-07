const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const router = express.Router();

// Validate environment variables
const validateEnvVariables = () => {
  const requiredVars = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "S3_BUCKET_NAME",
  ];
  requiredVars.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Environment variable ${key} is required but not set.`);
    }
  });
};

try {
  validateEnvVariables();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// Initialize S3 client
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
  maxAttempts: 5,
  requestTimeout: 60000,
});

// Disk storage configuration
const tempUploadDir = os.tmpdir(); // Uses OS default temp folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

// File filters
const imageFileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};

const docFileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(xls|xlsx|csv|pdf|doc|docx|ppt|pptx)$/i;
  if (!allowedExtensions.test(file.originalname)) {
    return cb(
      new Error(
        "Invalid file type. Allowed: XLS, CSV, PDF, DOC, DOCX, PPT, PPTX."
      ),
      false
    );
  }
  cb(null, true);
};

// Multer instances
const imageUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).array("images", 10);

const fileUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: docFileFilter,
}).array("files", 5);

// Upload to S3
const uploadToS3 = async (filePath, fileName, mimeType, folder) => {
  const fileStream = fs.createReadStream(filePath);

  const uniqueFileName = `${folder}/${uuidv4()}_${fileName}`;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: uniqueFileName,
      Body: fileStream,
      ContentType: mimeType,
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024,
  });

  await upload.done();
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;
};

// Clean up file after upload
const deleteLocalFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.error("Failed to delete temp file:", filePath, err);
  });
};

// Image upload route
router.post("/upload", (req, res) => {
  console.log("uploading images");
  imageUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    const results = await Promise.allSettled(
      req.files.map((file) =>
        uploadToS3(file.path, file.originalname, file.mimetype, "products")
          .then((url) => {
            deleteLocalFile(file.path);
            return url;
          })
          .catch((error) => {
            deleteLocalFile(file.path);
            throw new Error(error.message);
          })
      )
    );

    const imageUrls = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason.message);

    res.status(200).json({
      message: errors.length
        ? "Some images failed to upload"
        : "Images uploaded successfully",
      imageUrls,
      errors,
    });
  });
});

// File upload route
router.post("/upload-file", (req, res) => {
  fileUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const results = await Promise.allSettled(
      req.files.map((file) =>
        uploadToS3(file.path, file.originalname, file.mimetype, "attachments")
          .then((url) => {
            deleteLocalFile(file.path);
            return url;
          })
          .catch((error) => {
            deleteLocalFile(file.path);
            throw new Error(error.message);
          })
      )
    );

    const fileUrls = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason.message);

    res.status(200).json({
      message: errors.length
        ? "Some files failed to upload"
        : "Files uploaded successfully",
      fileUrls,
      errors,
    });
  });
});

module.exports = router;
