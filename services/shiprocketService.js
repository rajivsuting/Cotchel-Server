// services/shiprocketService.js
const axios = require("axios");

const SHIPROCKET_API_URL = "https://apiv2.shiprocket.in/v1/external";
const SHIPROCKET_API_KEY = process.env.SHIPROCKET_API_KEY;
const SHIPROCKET_SECRET_KEY = process.env.SHIPROCKET_SECRET_KEY;
exports.authenticateShiprocket = async () => {
  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });

    return response.data.token;
  } catch (error) {
    console.error(
      "Error authenticating with Shiprocket:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.message ||
        "Error authenticating with Shiprocket: " + error.message
    );
  }
};

exports.registerPickupLocation = async (token, pickupData) => {
  try {
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/settings/company/addpickup",
      pickupData,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Shiprocket Pickup Error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to register pickup address with Shiprocket.");
  }
};
