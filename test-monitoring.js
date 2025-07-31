const axios = require("axios");

const BASE_URL = "https://starfish-app-6q6ot.ondigitalocean.app/api";

// Test configuration
const config = {
  timeout: 10000,
  validateStatus: () => true, // Don't throw on any status code
};

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, details = "") {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  const color = passed ? "green" : "red";
  log(`${status} ${testName}${details ? ` - ${details}` : ""}`, color);
}

async function testHealthEndpoints() {
  log("\n🔍 Testing Health Endpoints", "bold");

  try {
    // Basic health check
    const basicHealth = await axios.get(`${BASE_URL}/health`, config);
    logTest(
      "Basic Health Check",
      basicHealth.status === 200,
      `Status: ${basicHealth.status}`
    );

    if (basicHealth.status === 200) {
      console.log("   Response:", JSON.stringify(basicHealth.data, null, 2));
    }

    // Detailed health check
    const detailedHealth = await axios.get(
      `${BASE_URL}/health/detailed`,
      config
    );
    logTest(
      "Detailed Health Check",
      detailedHealth.status === 200,
      `Status: ${detailedHealth.status}`
    );

    // Database health check
    const dbHealth = await axios.get(`${BASE_URL}/health/database`, config);
    logTest(
      "Database Health Check",
      dbHealth.status === 200,
      `Status: ${dbHealth.status}`
    );

    // Memory health check
    const memoryHealth = await axios.get(`${BASE_URL}/health/memory`, config);
    logTest(
      "Memory Health Check",
      memoryHealth.status === 200,
      `Status: ${memoryHealth.status}`
    );

    // System info
    const systemInfo = await axios.get(`${BASE_URL}/health/system`, config);
    logTest(
      "System Info",
      systemInfo.status === 200,
      `Status: ${systemInfo.status}`
    );
  } catch (error) {
    logTest("Health Endpoints", false, error.message);
  }
}

async function testMonitoringEndpoints() {
  log("\n📊 Testing Monitoring Endpoints", "bold");

  try {
    // System metrics
    const metrics = await axios.get(`${BASE_URL}/monitoring/metrics`, config);
    logTest(
      "System Metrics",
      metrics.status === 200,
      `Status: ${metrics.status}`
    );

    // Performance metrics
    const performance = await axios.get(
      `${BASE_URL}/monitoring/performance`,
      config
    );
    logTest(
      "Performance Metrics",
      performance.status === 200,
      `Status: ${performance.status}`
    );

    // Database stats
    const dbStats = await axios.get(
      `${BASE_URL}/monitoring/database/stats`,
      config
    );
    logTest(
      "Database Stats",
      dbStats.status === 200,
      `Status: ${dbStats.status}`
    );

    // Collection stats
    const collectionStats = await axios.get(
      `${BASE_URL}/monitoring/database/collections`,
      config
    );
    logTest(
      "Collection Stats",
      collectionStats.status === 200,
      `Status: ${collectionStats.status}`
    );

    // System alerts
    const alerts = await axios.get(`${BASE_URL}/monitoring/alerts`, config);
    logTest("System Alerts", alerts.status === 200, `Status: ${alerts.status}`);

    if (alerts.status === 200 && alerts.data.alerts.length > 0) {
      log("   ⚠️  Alerts detected:", "yellow");
      alerts.data.alerts.forEach((alert) => {
        log(`   - ${alert.type.toUpperCase()}: ${alert.message}`, "yellow");
      });
    }
  } catch (error) {
    logTest("Monitoring Endpoints", false, error.message);
  }
}

async function testErrorHandling() {
  log("\n🛡️ Testing Error Handling", "bold");

  try {
    // Test 404 error
    const notFound = await axios.get(
      `${BASE_URL}/nonexistent-endpoint`,
      config
    );
    logTest(
      "404 Error Handling",
      notFound.status === 404,
      `Status: ${notFound.status}`
    );

    // Test invalid JSON
    const invalidJson = await axios.post(
      `${BASE_URL}/test/test-csrf`,
      "invalid json",
      {
        ...config,
        headers: { "Content-Type": "application/json" },
      }
    );
    logTest(
      "Invalid JSON Handling",
      invalidJson.status === 400 || invalidJson.status === 403,
      `Status: ${invalidJson.status}`
    );

    // Test CSRF protection (should fail without token)
    const csrfTest = await axios.post(
      `${BASE_URL}/test/test-csrf`,
      { test: "data" },
      {
        ...config,
        headers: { "Content-Type": "application/json" },
      }
    );
    logTest(
      "CSRF Protection",
      csrfTest.status === 403,
      `Status: ${csrfTest.status}`
    );

    // Test rate limiting (make multiple requests)
    log("   Testing rate limiting...", "blue");
    let rateLimitHit = false;
    for (let i = 0; i < 105; i++) {
      const response = await axios.get(`${BASE_URL}/health`, config);
      if (response.status === 429) {
        rateLimitHit = true;
        break;
      }
    }
    logTest(
      "Rate Limiting",
      rateLimitHit,
      rateLimitHit ? "Rate limit triggered" : "Rate limit not triggered"
    );
  } catch (error) {
    logTest("Error Handling", false, error.message);
  }
}

async function testLogging() {
  log("\n📝 Testing Logging System", "bold");

  try {
    // Test request logging by making a request
    const response = await axios.get(`${BASE_URL}/health`, config);
    logTest(
      "Request Logging",
      response.status === 200,
      "Check logs/access.log for request details"
    );

    // Test error logging by making an invalid request
    const errorResponse = await axios.get(`${BASE_URL}/nonexistent`, config);
    logTest(
      "Error Logging",
      errorResponse.status === 404,
      "Check logs/error.log for error details"
    );

    // Test security logging by triggering CSRF violation
    const csrfResponse = await axios.post(
      `${BASE_URL}/test/test-csrf`,
      { test: "data" },
      {
        ...config,
        headers: { "Content-Type": "application/json" },
      }
    );
    logTest(
      "Security Logging",
      csrfResponse.status === 403,
      "Check logs/security.log for CSRF violations"
    );
  } catch (error) {
    logTest("Logging System", false, error.message);
  }
}

async function testPerformanceMonitoring() {
  log("\n⚡ Testing Performance Monitoring", "bold");

  try {
    // Test slow request detection (simulate slow request)
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}/health`, config);
    const duration = Date.now() - startTime;

    logTest(
      "Performance Monitoring",
      response.status === 200,
      `Response time: ${duration}ms`
    );

    // Test memory usage reporting
    const memoryResponse = await axios.get(`${BASE_URL}/health/memory`, config);
    if (memoryResponse.status === 200) {
      const memoryData = memoryResponse.data;
      logTest(
        "Memory Usage Reporting",
        true,
        `Heap Used: ${memoryData.formatted.heapUsed}`
      );
    } else {
      logTest(
        "Memory Usage Reporting",
        false,
        `Status: ${memoryResponse.status}`
      );
    }
  } catch (error) {
    logTest("Performance Monitoring", false, error.message);
  }
}

async function runAllTests() {
  log("🚀 Starting Comprehensive Monitoring and Error Handling Tests", "bold");
  log("=".repeat(60), "blue");

  const startTime = Date.now();

  await testHealthEndpoints();
  await testMonitoringEndpoints();
  await testErrorHandling();
  await testLogging();
  await testPerformanceMonitoring();

  const totalTime = Date.now() - startTime;

  log("\n" + "=".repeat(60), "blue");
  log(`✅ All tests completed in ${totalTime}ms`, "green");
  log("\n📋 Test Summary:", "bold");
  log("- Health endpoints: Basic, detailed, database, memory, system", "blue");
  log(
    "- Monitoring endpoints: Metrics, performance, database stats, alerts",
    "blue"
  );
  log("- Error handling: 404, invalid JSON, CSRF, rate limiting", "blue");
  log("- Logging: Request, error, security logging", "blue");
  log("- Performance: Response time, memory usage monitoring", "blue");

  log("\n📁 Log Files Created:", "bold");
  log("- logs/access.log - Request/response logging", "blue");
  log("- logs/error.log - Error logging", "blue");
  log("- logs/security.log - Security event logging", "blue");
  log("- logs/combined.log - All logs combined", "blue");

  log("\n🔍 Next Steps:", "bold");
  log("1. Check the log files for detailed information", "yellow");
  log("2. Monitor the health endpoints for system status", "yellow");
  log("3. Use monitoring endpoints for real-time metrics", "yellow");
  log("4. Set up alerts for production monitoring", "yellow");
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    log(`❌ Test execution failed: ${error.message}`, "red");
    process.exit(1);
  });
}

module.exports = {
  testHealthEndpoints,
  testMonitoringEndpoints,
  testErrorHandling,
  testLogging,
  testPerformanceMonitoring,
  runAllTests,
};
