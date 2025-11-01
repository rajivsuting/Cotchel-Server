const http = require("http");

const BASE_URL = "https://starfish-app-6q6ot.ondigitalocean.app";

console.log("🔍 Quick Security Test for Cotchel Server");
console.log("==========================================\n");

// Test 1: Check if server is running
function testServerRunning() {
  console.log("1. Testing if server is running...");

  const req = http
    .get(`${BASE_URL}/api/health`, (res) => {
      console.log(`   ✅ Server is running (Status: ${res.statusCode})`);

      // Test 2: Check security headers
      console.log("\n2. Testing security headers...");
      const headers = res.headers;

      const securityHeaders = {
        "x-frame-options": "X-Frame-Options",
        "x-content-type-options": "X-Content-Type-Options",
        "strict-transport-security": "Strict-Transport-Security",
        "content-security-policy": "Content-Security-Policy",
      };

      let headersFound = 0;
      Object.entries(securityHeaders).forEach(([key, name]) => {
        if (headers[key]) {
          console.log(`   ✅ ${name}: ${headers[key]}`);
          headersFound++;
        } else {
          console.log(`   ❌ ${name}: Missing`);
        }
      });

      if (headersFound >= 3) {
        console.log("   ✅ Security headers are properly configured!");
      } else {
        console.log("   ⚠️  Some security headers are missing");
      }

      // Test 3: Check CSRF protection
      console.log("\n3. Testing CSRF protection...");
      testCSRFProtection();
    })
    .on("error", (err) => {
      console.log("   ❌ Server is not running or not accessible");
      console.log(`   Error: ${err.message}`);
      console.log("\n   Please start the server with: npm start");
    });

  req.setTimeout(5000, () => {
    console.log("   ❌ Request timeout - server may not be running");
  });
}

// Test CSRF protection
function testCSRFProtection() {
  const postData = JSON.stringify({ test: "data" });

  const options = {
    hostname: "localhost",
    port: 5000,
    path: "/api/test/test-csrf",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 403) {
      console.log(
        "   ✅ CSRF protection is working (POST blocked without token)"
      );
    } else {
      console.log(
        `   ⚠️  CSRF protection may not be working (Status: ${res.statusCode})`
      );
    }

    // Test 4: Check rate limiting
    console.log("\n4. Testing rate limiting...");
    testRateLimiting();
  });

  req.on("error", (err) => {
    console.log(`   ❌ CSRF test failed: ${err.message}`);
  });

  req.write(postData);
  req.end();
}

// Test rate limiting
function testRateLimiting() {
  console.log("   Making 5 quick requests to test rate limiting...");

  let completed = 0;
  let blocked = 0;

  for (let i = 0; i < 5; i++) {
    const req = http.get(`${BASE_URL}/api/health`, (res) => {
      completed++;

      if (res.statusCode === 429) {
        blocked++;
      }

      if (completed === 5) {
        if (blocked > 0) {
          console.log("   ✅ Rate limiting is working");
        } else {
          console.log(
            "   ⚠️  Rate limiting may not be active (normal for small number of requests)"
          );
        }

        console.log("\n🎉 Quick test completed!");
        console.log("\nFor detailed testing, run: npm run test:security");
        console.log("For manual testing, see: TESTING-GUIDE.md");
      }
    });

    req.on("error", (err) => {
      completed++;
      console.log(`   ❌ Request ${i + 1} failed: ${err.message}`);

      if (completed === 5) {
        console.log("\n🎉 Quick test completed!");
      }
    });
  }
}

// Start the test
testServerRunning();
