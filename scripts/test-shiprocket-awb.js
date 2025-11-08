/**
 * TEST SCRIPT: Check Shiprocket AWB Response Format
 * 
 * This script helps debug AWB code extraction issues
 * 
 * Usage: 
 * 1. Create a test shipment in Shiprocket
 * 2. Update SHIPMENT_ID and COURIER_ID below
 * 3. Run: node scripts/test-shiprocket-awb.js
 */

const axios = require("axios");
require("dotenv").config();

const SHIPROCKET_API_URL = "https://apiv2.shiprocket.in/v1/external";

// ========================================
// CONFIGURATION - UPDATE THESE
// ========================================
const TEST_SHIPMENT_ID = 1024223029; // Replace with your actual shipment ID
const TEST_COURIER_ID = 12; // Replace with courier company ID (e.g., 12 for Xpressbees)

async function authenticateShiprocket() {
  try {
    const response = await axios.post(`${SHIPROCKET_API_URL}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });
    return response.data.token;
  } catch (error) {
    console.error("❌ Shiprocket authentication failed:", error.response?.data || error.message);
    throw error;
  }
}

async function testAWBAssignment() {
  try {
    console.log("🔍 Testing Shiprocket AWB Assignment...\n");
    
    // Step 1: Authenticate
    console.log("Step 1: Authenticating...");
    const token = await authenticateShiprocket();
    console.log("✅ Authentication successful\n");

    // Step 2: Assign AWB
    console.log("Step 2: Assigning AWB to shipment...");
    console.log(`Shipment ID: ${TEST_SHIPMENT_ID}`);
    console.log(`Courier ID: ${TEST_COURIER_ID}\n`);

    const awbResponse = await axios.post(
      `${SHIPROCKET_API_URL}/courier/assign/awb`,
      {
        shipment_id: TEST_SHIPMENT_ID,
        courier_id: TEST_COURIER_ID,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("=".repeat(60));
    console.log("📦 SHIPROCKET AWB RESPONSE STRUCTURE:");
    console.log("=".repeat(60));
    console.log(JSON.stringify(awbResponse.data, null, 2));
    console.log("=".repeat(60));
    console.log();

    // Analyze structure
    console.log("🔍 Response Analysis:");
    console.log(`  - Status Code: ${awbResponse.status}`);
    console.log(`  - Has 'response' key: ${awbResponse.data.response ? '✅' : '❌'}`);
    console.log(`  - Has 'response.data' key: ${awbResponse.data?.response?.data ? '✅' : '❌'}`);
    console.log(`  - Has 'awb_assign_status': ${awbResponse.data.awb_assign_status !== undefined ? '✅' : '❌'}`);
    console.log(`  - Has 'success' key: ${awbResponse.data.success !== undefined ? '✅' : '❌'}`);
    console.log();

    // Try to extract AWB
    let awbCode = null;
    
    if (awbResponse.data?.response?.data?.awb_code) {
      awbCode = awbResponse.data.response.data.awb_code;
      console.log("✅ Found AWB in: response.data.awb_code");
    } else if (awbResponse.data?.response?.awb_code) {
      awbCode = awbResponse.data.response.awb_code;
      console.log("✅ Found AWB in: response.awb_code");
    } else if (awbResponse.data?.awb_code) {
      awbCode = awbResponse.data.awb_code;
      console.log("✅ Found AWB in: awb_code");
    } else if (awbResponse.data?.awb_data?.awb_code) {
      awbCode = awbResponse.data.awb_data.awb_code;
      console.log("✅ Found AWB in: awb_data.awb_code");
    } else if (awbResponse.data?.awb) {
      awbCode = awbResponse.data.awb;
      console.log("✅ Found AWB in: awb");
    } else {
      console.log("❌ AWB code not found in any expected location");
      console.log("⚠️  Available keys:", Object.keys(awbResponse.data));
      if (awbResponse.data.response) {
        console.log("⚠️  Keys in response:", Object.keys(awbResponse.data.response));
      }
    }

    console.log();
    if (awbCode) {
      console.log("🎉 SUCCESS!");
      console.log(`   AWB Code: ${awbCode}`);
      console.log();
      console.log("📋 Update your code to extract AWB from the path shown above");
    } else {
      console.log("❌ FAILED to extract AWB code");
      console.log("📋 Please share the full response structure above with the developer");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response?.data) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run test
testAWBAssignment();

