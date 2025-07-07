// CSRF Token utility functions

/**
 * Get CSRF token from cookies
 * @param {Object} cookies - Request cookies object
 * @returns {string|null} CSRF token or null if not found
 */
const getCSRFToken = (cookies) => {
  return cookies["XSRF-TOKEN"] || null;
};

/**
 * Validate CSRF token
 * @param {string} token - CSRF token to validate
 * @param {string} expectedToken - Expected CSRF token
 * @returns {boolean} True if valid, false otherwise
 */
const validateCSRFToken = (token, expectedToken) => {
  if (!token || !expectedToken) {
    return false;
  }
  return token === expectedToken;
};

/**
 * Generate CSRF token for testing purposes
 * @returns {string} Random CSRF token
 */
const generateTestCSRFToken = () => {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
};

module.exports = {
  getCSRFToken,
  validateCSRFToken,
  generateTestCSRFToken,
};
