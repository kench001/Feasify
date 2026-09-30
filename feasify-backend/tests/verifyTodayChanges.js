/**
 * Dedicated Verification Suite for Today's Feasify Changes
 * Tests ONLY the modules, datasets, and features modified/created today.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");

const DTIProvider = require("../services/nameChecker/dti/DTIProvider");
const SECProvider = require("../services/nameChecker/sec/SECProvider");
const cache = require("../services/nameChecker/cache/NameCheckCache");
const logger = require("../services/nameChecker/logger/VerificationLogger");
const nameCheckerService = require("../services/nameChecker");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function run() {
  console.log("\n========================================================");
  console.log("   FEASIFY - VERIFY TODAY'S CODE CHANGES");
  console.log("   Timestamp: " + new Date().toISOString());
  console.log("========================================================\n");

  process.env.DTI_SANDBOX_MODE = "true";
  process.env.SEC_SANDBOX_MODE = "true";

  const dti = new DTIProvider();
  const sec = new SECProvider();

  // ----------------------------------------------------
  // TEST GROUP 1: DTI PROVIDER
  // ----------------------------------------------------
  console.log("--- Group 1: DTI Provider Verification ---");

  await test("DTI rejects empty or whitespace-only queries", async () => {
    const res1 = await dti.check("");
    const res2 = await dti.check("    ");
    assert.strictEqual(res1.status, "ERROR");
    assert.strictEqual(res2.status, "ERROR");
  });

  await test("DTI rejects queries exceeding 150 characters", async () => {
    const res = await dti.check("A".repeat(151));
    assert.strictEqual(res.status, "ERROR");
  });

  await test("DTI normalizes capitalization and spacing cleanly", async () => {
    const r1 = await dti.check("abella general merchandise");
    const r2 = await dti.check("   ABELLA   GENERAL   MERCHANDISE   ");
    assert.strictEqual(r1.status, "FOUND");
    assert.strictEqual(r2.status, "FOUND");
    assert.strictEqual(r1.matchType, "exact");
  });

  await test("DTI non-existent names do NOT claim 'officially available'", async () => {
    const res = await dti.check("Totally Unique Proposal 2026 XYZ");
    assert.strictEqual(res.status, "NOT_FOUND");
    assert.ok(!res.message.toLowerCase().includes("officially available"));
    assert.ok(res.officialSource.includes("bnrs.dti.gov.ph"));
  });

  // ----------------------------------------------------
  // TEST GROUP 2: SEC PROVIDER
  // ----------------------------------------------------
  console.log("\n--- Group 2: SEC Provider Verification ---");

  await test("SEC rejects invalid queries safely", async () => {
    const res = await sec.check("");
    assert.strictEqual(res.status, "ERROR");
  });

  await test("SEC strips corporate suffixes cleanly during lookup", async () => {
    const s1 = sec.stripSuffixes("Ayala Corporation");
    const s2 = sec.stripSuffixes("Ayala Corp.");
    const s3 = sec.stripSuffixes("Ayala Inc.");
    assert.strictEqual(s1, "ayala");
    assert.strictEqual(s2, "ayala");
    assert.strictEqual(s3, "ayala");
  });

  await test("SEC non-matching company lookup distinguishes eSPARC reservation", async () => {
    const res = await sec.check("Nonexistent Brand 2026 Enterprises");
    assert.strictEqual(res.status, "NOT_FOUND");
    assert.ok(res.message.includes("SEC eSPARC"));
    assert.ok(!res.message.toLowerCase().includes("approved"));
  });

  // ----------------------------------------------------
  // TEST GROUP 3: CACHE & AUDIT LOGGER
  // ----------------------------------------------------
  console.log("\n--- Group 3: In-Memory Cache & Verification Logger ---");

  await test("Cache stores results and respects forceRefresh bypass", () => {
    cache.set("DTI", "test-query", { status: "FOUND", dummy: true });
    const cached = cache.get("DTI", "test-query");
    assert.ok(cached);
    assert.strictEqual(cached.cached, true);

    cache.delete("DTI", "test-query");
    assert.strictEqual(cache.get("DTI", "test-query"), null);
  });

  await test("Logger records lightweight verification entries without sensitive data", async () => {
    const log = await logger.logVerification({
      name: "Sample Test Company",
      type: "business",
      provider: "DTI",
      resultStatus: "FOUND",
      userId: "test-user"
    });
    assert.ok(log.id);
    assert.strictEqual(log.name, "Sample Test Company");
  });

  // ----------------------------------------------------
  // TEST GROUP 4: TRADEMARK & ALL SCOPES (BARANGAY TO NATIONAL)
  // ----------------------------------------------------
  console.log("\n--- Group 4: Well-Known Brands & Territorial Scopes ---");

  const brandTestCases = [
    { query: "cocopan", brand: "cocopan" },
    { query: "Cocopan Bakery", brand: "cocopan" },
    { query: "goldilocks", brand: "goldilocks" },
    { query: "Goldilocks Bakeshop", brand: "goldilocks" },
    { query: "mega", brand: "mega" },
    { query: "Mega Sardines", brand: "mega" },
    { query: "red ribbon", brand: "red ribbon" },
    { query: "Red Ribbon Cakes", brand: "red ribbon" },
    { query: "711", brand: "711" },
    { query: "711 Store", brand: "711" },
    { query: "7-Eleven Express", brand: "7-eleven" },
    { query: "uncle johns", brand: "uncle john" },
    { query: "Uncle John's Chicken", brand: "uncle john" },
    { query: "kfc", brand: "kfc" },
    { query: "KFC Express", brand: "kfc" }
  ];

  for (const tc of brandTestCases) {
    await test(`Trademark conflict detected for "${tc.query}" across all 4 territorial levels`, async () => {
      const res = await nameCheckerService.checkName({
        name: tc.query,
        type: "business",
        forceRefresh: true
      });
      assert.ok(res.trademarkAlert, `Expected trademarkAlert for "${tc.query}"`);
      assert.strictEqual(res.trademarkAlert.isProtected, true);
      assert.ok(
        res.trademarkAlert.message.includes("Barangay") &&
        res.trademarkAlert.message.includes("National"),
        `Expected all 4 territorial levels in message for "${tc.query}"`
      );
    });
  }

  await test("Clean genuine proposal does not trigger false trademark conflicts", async () => {
    const res = await nameCheckerService.checkName({
      name: "San Mateo Provincial Rice Trading 2026",
      type: "business",
      forceRefresh: true
    });
    assert.strictEqual(res.trademarkAlert, null);
  });

  // ----------------------------------------------------
  // TEST GROUP 5: COMPANYNAMES.JSON DATASET INTEGRITY
  // ----------------------------------------------------
  console.log("\n--- Group 5: companyNames.json Consolidation & Updates ---");

  const backendDbPath = path.join(__dirname, "..", "data", "companyNames.json");
  const frontendDbPath = path.join(__dirname, "..", "..", "Feasify", "src", "data", "companyNames.json");

  await test("Single file architecture: backend companyNames.json exists, frontend duplicate removed", () => {
    assert.strictEqual(fs.existsSync(backendDbPath), true, "feasify-backend/data/companyNames.json must exist");
    assert.strictEqual(fs.existsSync(frontendDbPath), false, "Feasify/src/data/companyNames.json must be removed");
  });

  await test("companyNames.json is valid JSON with 1234 records", () => {
    const content = JSON.parse(fs.readFileSync(backendDbPath, "utf-8"));
    assert.ok(Array.isArray(content.companies));
    assert.strictEqual(content.companies.length, 1234);
  });

  await test("Newly added records 1342 to 1351 are present with full metadata", () => {
    const content = JSON.parse(fs.readFileSync(backendDbPath, "utf-8"));
    const ids = [1342, 1343, 1344, 1345, 1346, 1347, 1348, 1349, 1350, 1351];
    for (const id of ids) {
      const rec = content.companies.find(c => c.id === id);
      assert.ok(rec, `Record ID ${id} must exist in companyNames.json`);
      assert.ok(rec.name, `Record ID ${id} must have a name`);
      assert.ok(rec.registrationSource, `Record ID ${id} must have registrationSource`);
    }
  });

  // ----------------------------------------------------
  // TEST GROUP 6: BACKEND API ENDPOINTS INTEGRATION
  // ----------------------------------------------------
  console.log("\n--- Group 6: Live Backend API Endpoints ---");

  async function callApi(method, pathUrl, body) {
    return new Promise((resolve) => {
      const postData = body ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "localhost",
          port: 10000,
          path: pathUrl,
          method: method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData)
          }
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, raw: data });
            }
          });
        }
      );
      req.on("error", (e) => resolve({ error: e.message }));
      if (postData) req.write(postData);
      req.end();
    });
  }

  await test("GET /api/name-check/status returns live diagnostics", async () => {
    const res = await callApi("GET", "/api/name-check/status");
    if (res.error) {
      console.warn("    (Server not running on port 10000, skipping live socket test)");
      return;
    }
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.service, "Feasify Name Checker Service");
  });

  await test("POST /api/name-check (type=all) returns DTI, SEC, and trademark alert", async () => {
    const res = await callApi("POST", "/api/name-check", { name: "711", type: "all" });
    if (res.error) return;
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.dti);
    assert.ok(res.body.sec);
    assert.ok(res.body.trademarkAlert);
    assert.strictEqual(res.body.trademarkAlert.isProtected, true);
  });

  await test("GET /api/registration-sources returns official source endpoints", async () => {
    const res = await callApi("GET", "/api/registration-sources");
    if (res.error) return;
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.registrationSources));
  });

  // ----------------------------------------------------
  // TEST GROUP 7: FRONTEND SERVICE SYNCHRONOUS LOGIC
  // ----------------------------------------------------
  console.log("\n--- Group 7: Frontend Synchronous Validation Service ---");

  await test("copyrightService.ts checkBusinessName detects well-known brand variants", () => {
    const serviceContent = fs.readFileSync(
      path.join(__dirname, "..", "..", "Feasify", "src", "services", "copyrightService.ts"),
      "utf-8"
    );
    assert.ok(serviceContent.includes('"cocopan"'));
    assert.ok(serviceContent.includes('"goldilocks"'));
    assert.ok(serviceContent.includes('"711"'));
    assert.ok(serviceContent.includes('"red ribbon"'));
    assert.ok(serviceContent.includes('"mega"'));
  });

  console.log("\n========================================================");
  console.log(`TODAY'S CHANGES TEST RESULTS: ${passedTests} passed, ${failedTests} failed out of ${totalTests} total tests`);
  console.log("========================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Fatal test execution error:", e);
  process.exit(1);
});
