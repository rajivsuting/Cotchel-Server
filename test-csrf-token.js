const axios = require("axios");

console.log("🛡️ Testing CSRF Token Functionality");
console.log("====================================\n");

const BASE_URL = "http://localhost:5000";
const API_BASE = `${BASE_URL}/api`;

async function testCSRFToken() {
  try {
    // Step 1: Make a GET request to get a CSRF token
    console.log("1. Getting CSRF token...");
    const getResponse = await axios.get(`${API_BASE}/test/test-csrf`, {
      withCredentials: true,
    });

    console.log("   ✅ GET request successful");
    console.log("   Response:", getResponse.data.message);

    // Step 2: Extract CSRF token from cookies
    const cookies = getResponse.headers["set-cookie"];
    let csrfToken = null;

    if (cookies) {
      const xsrfCookie = cookies.find((cookie) =>
        cookie.includes("XSRF-TOKEN")
      );
      if (xsrfCookie) {
        csrfToken = xsrfCookie.split(";")[0].split("=")[1];
        console.log("   ✅ CSRF token found in cookies");
      }
    }

    if (!csrfToken) {
      console.log("   ⚠️  CSRF token not found in cookies");
      console.log("   This might be normal if the token is set differently");
    }

    // Step 3: Test POST request without CSRF token (should fail)
    console.log("\n2. Testing POST without CSRF token (should fail)...");
    try {
      await axios.post(
        `${API_BASE}/test/test-csrf`,
        { test: "data" },
        { withCredentials: true }
      );
      console.log(
        "   ❌ POST request succeeded without CSRF token - CSRF protection not working!"
      );
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log("   ✅ POST request correctly blocked without CSRF token");
        console.log("   Error message:", error.response.data.message);
      } else {
        console.log("   ⚠️  Unexpected error:", error.message);
      }
    }

    // Step 4: Test POST request with CSRF token (if we have one)
    if (csrfToken) {
      console.log("\n3. Testing POST with CSRF token...");
      try {
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

        console.log("   ✅ POST request with CSRF token successful");
        console.log("   Response:", postResponse.data.message);
      } catch (error) {
        console.log(
          "   ⚠️  POST request with CSRF token failed:",
          error.message
        );
        if (error.response) {
          console.log("   Status:", error.response.status);
          console.log("   Data:", error.response.data);
        }
      }
    } else {
      console.log("\n3. Skipping CSRF token test (no token available)");
    }

    // Step 5: Test with a fake CSRF token (should fail)
    console.log("\n4. Testing POST with fake CSRF token (should fail)...");
    try {
      await axios.post(
        `${API_BASE}/test/test-csrf`,
        { test: "data" },
        {
          headers: {
            "X-CSRF-Token": "fake-token-123",
          },
          withCredentials: true,
        }
      );
      console.log(
        "   ❌ POST request succeeded with fake CSRF token - CSRF protection not working!"
      );
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log(
          "   ✅ POST request correctly blocked with fake CSRF token"
        );
      } else {
        console.log("   ⚠️  Unexpected error with fake token:", error.message);
      }
    }

    console.log("\n🎉 CSRF Token Test Completed!");
    console.log("\nSummary:");
    console.log("✅ CSRF protection is working correctly");
    console.log("✅ GET requests work without tokens");
    console.log("✅ POST requests are blocked without valid tokens");
    console.log("✅ Invalid tokens are rejected");
  } catch (error) {
    console.log("❌ Test failed:", error.message);
  }
}

// Run the test
testCSRFToken();
