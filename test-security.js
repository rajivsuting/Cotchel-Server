const axios = require("axios");
const https = require("https");

// Test configuration
const BASE_URL = "http://localhost:5000";
const API_BASE = `${BASE_URL}/api`;

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg) =>
    console.log(`${colors.bold}${colors.blue}${msg}${colors.reset}`),
};

// Test 1: Security Headers Test
async function testSecurityHeaders() {
  log.header("\n🔒 Testing Security Headers...");

  try {
    const response = await axios.get(`${API_BASE}/health`);
    const headers = response.headers;

    const requiredHeaders = {
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "strict-transport-security":
        "max-age=31536000; includeSubDomains; preload",
      "content-security-policy": "default-src 'self'",
    };

    let allHeadersPresent = true;

    for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
      const actualValue = headers[header];
      if (actualValue) {
        if (
          actualValue.includes(expectedValue) ||
          actualValue === expectedValue
        ) {
          log.success(`${header}: ${actualValue}`);
        } else {
          log.warning(`${header}: ${actualValue} (expected: ${expectedValue})`);
          allHeadersPresent = false;
        }
      } else {
        log.error(`${header}: Missing`);
        allHeadersPresent = false;
      }
    }

    if (allHeadersPresent) {
      log.success("All security headers are properly configured!");
    } else {
      log.warning("Some security headers may need adjustment.");
    }
  } catch (error) {
    log.error(`Failed to test security headers: ${error.message}`);
  }
}

// Test 2: CSRF Protection Test
async function testCSRFProtection() {
  log.header("\n🛡️ Testing CSRF Protection...");

  try {
    // Test 1: GET request should work (no CSRF required)
    log.info("Testing GET request (should work without CSRF token)...");
    const getResponse = await axios.get(`${API_BASE}/test/test-csrf`);
    log.success(`GET request successful: ${getResponse.data.message}`);

    // Test 2: POST request without CSRF token should fail
    log.info("Testing POST request without CSRF token (should fail)...");
    try {
      await axios.post(`${API_BASE}/test/test-csrf`, { test: "data" });
      log.error(
        "POST request succeeded without CSRF token - CSRF protection not working!"
      );
    } catch (error) {
      if (error.response && error.response.status === 403) {
        log.success("POST request correctly blocked without CSRF token");
      } else {
        log.error(`Unexpected error: ${error.message}`);
      }
    }

    // Test 3: POST request with CSRF token should work
    log.info("Testing POST request with CSRF token...");
    try {
      // First get a CSRF token by making a GET request
      const tokenResponse = await axios.get(`${API_BASE}/test/test-csrf`, {
        withCredentials: true,
      });

      // Extract CSRF token from cookies (this is a simplified test)
      // In real scenarios, the token would be in the XSRF-TOKEN cookie
      const csrfToken = "test-csrf-token"; // This is simplified for testing

      const postResponse = await axios.post(
        `${API_BASE}/test/test-csrf`,
        { test: "data" },
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          withCredentials: true,
        }
      );

      if (postResponse.data.message.includes("CSRF protection is working")) {
        log.success("POST request with CSRF token successful");
      } else {
        log.warning("POST request succeeded but response unexpected");
      }
    } catch (error) {
      log.warning(`CSRF token test failed: ${error.message}`);
    }
  } catch (error) {
    log.error(`Failed to test CSRF protection: ${error.message}`);
  }
}

// Test 3: Rate Limiting Test
async function testRateLimiting() {
  log.header("\n⏱️ Testing Rate Limiting...");

  try {
    log.info(
      "Making 105 requests to test rate limiting (limit: 100 per 15 minutes)..."
    );

    const requests = [];
    for (let i = 0; i < 105; i++) {
      requests.push(axios.get(`${API_BASE}/health`).catch((error) => error));
    }

    const responses = await Promise.all(requests);

    let successCount = 0;
    let blockedCount = 0;

    responses.forEach((response, index) => {
      if (response.status === 200) {
        successCount++;
      } else if (response.response && response.response.status === 429) {
        blockedCount++;
      }
    });

    log.info(`Successful requests: ${successCount}`);
    log.info(`Blocked requests: ${blockedCount}`);

    if (blockedCount > 0) {
      log.success("Rate limiting is working correctly!");
    } else {
      log.warning(
        "No requests were blocked - rate limiting may not be working"
      );
    }
  } catch (error) {
    log.error(`Failed to test rate limiting: ${error.message}`);
  }
}

// Test 4: Health Check Test
async function testHealthCheck() {
  log.header("\n🏥 Testing Health Check...");

  try {
    const response = await axios.get(`${API_BASE}/health`);

    if (response.status === 200) {
      log.success("Health check endpoint is working");

      const data = response.data;
      log.info(`Status: ${data.status}`);
      log.info(`Database: ${data.database.status}`);
      log.info(`Uptime: ${Math.round(data.uptime)} seconds`);
      log.info(
        `Memory Usage: ${Math.round(data.memory.heapUsed / 1024 / 1024)} MB`
      );

      if (data.database.status === "connected") {
        log.success("Database connection is healthy");
      } else {
        log.error("Database connection is not healthy");
      }
    } else {
      log.error(`Health check failed with status: ${response.status}`);
    }
  } catch (error) {
    log.error(`Failed to test health check: ${error.message}`);
  }
}

// Test 5: CORS Test
async function testCORS() {
  log.header("\n🌐 Testing CORS Configuration...");

  try {
    const response = await axios.get(`${API_BASE}/health`);
    const headers = response.headers;

    const corsHeaders = {
      "access-control-allow-origin": headers["access-control-allow-origin"],
      "access-control-allow-credentials":
        headers["access-control-allow-credentials"],
      "access-control-allow-methods": headers["access-control-allow-methods"],
      "access-control-allow-headers": headers["access-control-allow-headers"],
    };

    log.info("CORS Headers:");
    Object.entries(corsHeaders).forEach(([header, value]) => {
      if (value) {
        log.success(`${header}: ${value}`);
      } else {
        log.warning(`${header}: Not set`);
      }
    });
  } catch (error) {
    log.error(`Failed to test CORS: ${error.message}`);
  }
}

// Main test runner
async function runAllTests() {
  log.header("🚀 Starting Security Tests for Cotchel Server");
  log.info(`Testing against: ${BASE_URL}`);

  try {
    await testHealthCheck();
    await testSecurityHeaders();
    await testCORS();
    await testCSRFProtection();
    await testRateLimiting();

    log.header("\n🎉 Security Tests Completed!");
    log.info("Check the results above to verify your security implementation.");
  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testSecurityHeaders,
  testCSRFProtection,
  testRateLimiting,
  testHealthCheck,
  testCORS,
  runAllTests,
};
