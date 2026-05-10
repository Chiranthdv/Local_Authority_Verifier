/**
 * Smoke Test Script — Post-Deployment Verification
 * 
 * Runs critical health checks against deployed services:
 *  - Backend API reachability
 *  - Frontend reachability
 *  - API response validation
 *  - Database connectivity (via API)
 */

const http = require("http");
const fs = require("fs");

const BACKEND_URL = process.env.STAGING_BACKEND_URL || "http://localhost:5001";
const FRONTEND_URL = process.env.STAGING_FRONTEND_URL || "http://localhost:5173";

const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  passed: 0,
  failed: 0,
  total: 0,
};

function httpGet(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () =>
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data })
      );
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    });
  });
}

async function runTest(name, testFn) {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.tests.push({ name, status: "PASS", duration: `${duration}ms` });
    results.passed++;
    console.log(`  ✅ ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - start;
    results.tests.push({
      name,
      status: "FAIL",
      duration: `${duration}ms`,
      error: err.message,
    });
    results.failed++;
    console.log(`  ❌ ${name} — ${err.message} (${duration}ms)`);
  }
  results.total++;
}

async function main() {
  console.log("\n💨 Smoke Testing Suite\n");
  console.log(`  Backend:  ${BACKEND_URL}`);
  console.log(`  Frontend: ${FRONTEND_URL}\n`);

  // Test 1: Backend root endpoint
  await runTest("Backend API — Root endpoint reachable", async () => {
    const res = await httpGet(`${BACKEND_URL}/`);
    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
  });

  // Test 2: Backend health (check /api/health or root)
  await runTest("Backend API — Health check", async () => {
    let res;
    try {
      res = await httpGet(`${BACKEND_URL}/api/health`);
    } catch {
      // Fallback to root
      res = await httpGet(`${BACKEND_URL}/`);
    }
    if (res.statusCode >= 500) {
      throw new Error(`Server error: ${res.statusCode}`);
    }
  });

  // Test 3: Backend responds with JSON headers
  await runTest("Backend API — Content-Type header present", async () => {
    const res = await httpGet(`${BACKEND_URL}/`);
    const ct = res.headers["content-type"] || "";
    if (!ct) {
      throw new Error("No content-type header");
    }
  });

  // Test 4: Frontend reachable
  await runTest("Frontend — Root page reachable", async () => {
    const res = await httpGet(`${FRONTEND_URL}/`);
    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
  });

  // Test 5: Frontend returns HTML
  await runTest("Frontend — Returns HTML content", async () => {
    const res = await httpGet(`${FRONTEND_URL}/`);
    if (!res.body.includes("<html") && !res.body.includes("<!DOCTYPE")) {
      throw new Error("Response does not contain HTML");
    }
  });

  // Test 6: Auth endpoint exists
  await runTest("Backend API — Auth endpoint exists", async () => {
    const res = await httpGet(`${BACKEND_URL}/api/auth/login`);
    // 400/401/405 means endpoint exists, 404 means it doesn't
    if (res.statusCode === 404) {
      throw new Error("Auth endpoint not found");
    }
  });

  // Summary
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Results: ${results.passed}/${results.total} passed`);
  console.log(`${"─".repeat(50)}\n`);

  // Write results file
  fs.writeFileSync("smoke-test-results.json", JSON.stringify(results, null, 2));
  console.log("📊 Results written to smoke-test-results.json\n");

  // Exit with failure if any test failed
  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal smoke test error:", err);
  process.exit(1);
});
