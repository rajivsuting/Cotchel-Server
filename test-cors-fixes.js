#!/usr/bin/env node

/**
 * Test script for CORS fixes
 * Run with: node test-cors-fixes.js
 */

const axios = require("axios");

const API_BASE_URL =
  process.env.API_URL || "https://starfish-app-6q6ot.ondigitalocean.app/api";

// Test configuration
const testConfig = {
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000,
};

// Test 1: Check CORS preflight with X-Request-ID header
async function testCORSWithRequestID() {
  console.log("\n🔍 Test 1: Testing CORS with X-Request-ID header...");

  try {
    const response = await axios.options(`${API_BASE_URL}/auth/login`, {
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "X-CSRF-Token, X-Request-ID, Content-Type",
      },
    });

    const corsHeaders = response.headers;
    console.log("✅ CORS preflight request successful");
    console.log(
      "   Access-Control-Allow-Origin:",
      corsHeaders["access-control-allow-origin"]
    );
    console.log(
      "   Access-Control-Allow-Headers:",
      corsHeaders["access-control-allow-headers"]
    );
    console.log(
      "   Access-Control-Allow-Methods:",
      corsHeaders["access-control-allow-methods"]
    );

    // Check if X-Request-ID is allowed
    const allowedHeaders = corsHeaders["access-control-allow-headers"];
    if (allowedHeaders && allowedHeaders.includes("X-Request-ID")) {
      console.log("✅ X-Request-ID header is allowed");
      return true;
    } else {
      console.log("❌ X-Request-ID header is not allowed");
      console.log("   Allowed headers:", allowedHeaders);
      return false;
    }
  } catch (error) {
    console.log("❌ CORS preflight request failed:", error.message);
    if (error.response) {
      console.log("   Status:", error.response.status);
      console.log("   Headers:", error.response.headers);
    }
    return false;
  }
}

// Test 2: Test actual request with X-Request-ID
async function testRequestWithRequestID() {
  console.log("\n🔍 Test 2: Testing actual request with X-Request-ID...");

  try {
    const response = await axios.get(`${API_BASE_URL}/health`, {
      ...testConfig,
      headers: {
        "X-Request-ID": "test-request-id-" + Date.now(),
      },
    });

    console.log("✅ Request with X-Request-ID successful");
    console.log("   Status:", response.status);
    console.log("   Response:", response.data);
    return true;
  } catch (error) {
    console.log("❌ Request with X-Request-ID failed:", error.message);
    if (error.response) {
      console.log("   Status:", error.response.status);
      console.log("   Data:", error.response.data);
    }
    return false;
  }
}

// Test 3: Test CSRF token handling
async function testCSRFToken() {
  console.log("\n🔍 Test 3: Testing CSRF token handling...");

  try {
    // First, get a CSRF token
    const loginResponse = await axios.get(`${API_BASE_URL}/auth/login`, {
      withCredentials: true,
    });
    const cookies = loginResponse.headers["set-cookie"];

    let csrfToken = null;
    if (cookies) {
      const csrfCookie = cookies.find((cookie) =>
        cookie.startsWith("XSRF-TOKEN=")
      );
      if (csrfCookie) {
        csrfToken = csrfCookie.split("=")[1].split(";")[0];
      }
    }

    if (!csrfToken) {
      console.log("❌ No CSRF token found");
      return false;
    }

    console.log("✅ CSRF token found:", csrfToken.substring(0, 10) + "...");

    // Test with CSRF token
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      {
        email: "test@example.com",
        password: "password",
      },
      {
        ...testConfig,
        headers: {
          "X-CSRF-Token": csrfToken,
          "X-Request-ID": "test-csrf-" + Date.now(),
        },
      }
    );

    console.log("✅ CSRF protected request successful");
    return true;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log(
        "✅ CSRF token accepted (401 is expected for invalid credentials)"
      );
      return true;
    } else {
      console.log("❌ CSRF token test failed:", error.message);
      return false;
    }
  }
}

// Test 4: Test multiple origins
async function testMultipleOrigins() {
  console.log("\n🔍 Test 4: Testing multiple origins...");

  const origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://cotchel-admin-hy3ln.ondigitalocean.app",
  ];

  const results = [];

  for (const origin of origins) {
    try {
      const response = await axios.options(`${API_BASE_URL}/health`, {
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "X-Request-ID",
        },
      });

      const allowedOrigin = response.headers["access-control-allow-origin"];
      const isAllowed = allowedOrigin === origin;

      console.log(
        `   ${origin}: ${isAllowed ? "✅ ALLOWED" : "❌ NOT ALLOWED"}`
      );
      results.push({ origin, allowed: isAllowed });
    } catch (error) {
      console.log(`   ${origin}: ❌ ERROR - ${error.message}`);
      results.push({ origin, allowed: false });
    }
  }

  const allAllowed = results.every((r) => r.allowed);
  console.log(`✅ Multiple origins test: ${allAllowed ? "PASS" : "FAIL"}`);
  return allAllowed;
}

// Main test runner
async function runTests() {
  console.log("🚀 Starting CORS Fixes Tests...");
  console.log(`📡 Testing against: ${API_BASE_URL}`);

  const tests = [
    { name: "CORS with X-Request-ID", fn: testCORSWithRequestID },
    { name: "Request with X-Request-ID", fn: testRequestWithRequestID },
    { name: "CSRF Token Handling", fn: testCSRFToken },
    { name: "Multiple Origins", fn: testMultipleOrigins },
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      console.log(`❌ Test "${test.name}" failed with error:`, error.message);
      results.push({ name: test.name, passed: false });
    }
  }

  // Summary
  console.log("\n📊 Test Results Summary:");
  console.log("========================");

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.name}`);
  });

  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("🎉 All tests passed! CORS fixes are working correctly.");
    console.log("\n📝 Next steps:");
    console.log("   1. Deploy these changes to production");
    console.log(
      "   2. Update production server with the same CORS configuration"
    );
    console.log("   3. Test the frontend with the production server");
  } else {
    console.log("⚠️  Some tests failed. Please check the CORS configuration.");
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCORSWithRequestID,
  testRequestWithRequestID,
  testCSRFToken,
  testMultipleOrigins,
  runTests,
};
