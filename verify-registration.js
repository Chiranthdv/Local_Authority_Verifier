#!/usr/bin/env node

/**
 * Quick Test Script for MERN Registration Flow
 * Usage: node verify-registration.js
 */

const axios = require("axios");

const API_BASE = "http://localhost:5000/api";
const TEST_EMAIL = "verify-test-" + Date.now() + "@example.com";
const TEST_PASSWORD = "password123"; // 8+ characters required!
const TEST_NAME = "Verification Test";

const tests = [];
let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  tests.push({ name, fn });
}

function log(step, message) {
  console.log(`\n${step} ${message}`);
}

async function runTests() {
  console.log("═══════════════════════════════════════════════════");
  console.log("MERN Registration Verification Tests");
  console.log("═══════════════════════════════════════════════════\n");

  // Test 1: Health Check
  test("Backend Health Check", async () => {
    const res = await axios.get("http://localhost:5000/");
    if (res.data === "API is running") {
      return { passed: true, message: "Backend is running ✓" };
    }
    throw new Error("Backend health check failed");
  });

  // Test 2: Register with Valid Data
  test("Register User", async () => {
    const res = await axios.post(`${API_BASE}/auth/register`, {
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      role: "customer"
    });

    if (res.status === 201 && res.data.user) {
      return {
        passed: true,
        message: `User created: ${res.data.user.name} (${res.data.user.email})`,
        user: res.data.user
      };
    }
    throw new Error("Registration failed");
  });

  // Test 3: Prevent Duplicate Registration
  test("Duplicate Email Prevention", async () => {
    try {
      await axios.post(`${API_BASE}/auth/register`, {
        name: TEST_NAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        role: "customer"
      });
      throw new Error("Should have rejected duplicate email");
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.error?.includes("Email already registered")) {
        return { passed: true, message: "Duplicate email rejected ✓" };
      }
      throw err;
    }
  });

  // Test 4: Validate Password Length
  test("Password Length Validation", async () => {
    try {
      await axios.post(`${API_BASE}/auth/register`, {
        name: "Short Pass",
        email: "short" + Date.now() + "@example.com",
        password: "short",
        role: "customer"
      });
      throw new Error("Should have rejected short password");
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error?.includes("at least 8 characters")) {
        return { passed: true, message: "Short password rejected ✓" };
      }
      throw err;
    }
  });

  // Test 5: Validate Required Fields
  test("Required Fields Validation", async () => {
    try {
      await axios.post(`${API_BASE}/auth/register`, {
        name: "No Email",
        password: TEST_PASSWORD,
        role: "customer"
      });
      throw new Error("Should have rejected missing email");
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error?.includes("All fields are required")) {
        return { passed: true, message: "Missing fields rejected ✓" };
      }
      throw err;
    }
  });

  // Test 6: Login with Valid Credentials
  test("Login with Valid Credentials", async () => {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (res.status === 200 && res.data.token) {
      return {
        passed: true,
        message: `Login successful, token received (length: ${res.data.token.length})`,
        token: res.data.token
      };
    }
    throw new Error("Login failed");
  });

  // Test 7: Reject Invalid Password
  test("Reject Invalid Password", async () => {
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: TEST_EMAIL,
        password: "wrongpassword"
      });
      throw new Error("Should have rejected invalid password");
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error?.includes("Invalid credentials")) {
        return { passed: true, message: "Invalid password rejected ✓" };
      }
      throw err;
    }
  });

  // Run all tests
  for (const testcase of tests) {
    try {
      const result = await testcase.fn();
      console.log(`\n✓ ${testcase.name}`);
      console.log(`  ${result.message}`);
      passedTests++;
    } catch (error) {
      console.log(`\n✗ ${testcase.name}`);
      console.log(`  Error: ${error.response?.data?.error || error.message}`);
      failedTests++;
    }
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log(`Tests Passed: ${passedTests}/${tests.length}`);
  console.log(`Tests Failed: ${failedTests}/${tests.length}`);
  console.log("═══════════════════════════════════════════════════\n");

  if (failedTests > 0) {
    console.log("❌ Some tests failed. Check backend logs and .env configuration.\n");
    process.exit(1);
  } else {
    console.log("✅ All tests passed! Registration flow is working correctly.\n");
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error("\n❌ Fatal Error:", error.message);
  if (error.code === "ECONNREFUSED") {
    console.error("   Backend is not running on http://localhost:5000");
    console.error("   Start it with: cd backend && npm start");
  }
  process.exit(1);
});
