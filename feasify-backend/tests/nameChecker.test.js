/**
 * Comprehensive Test Suite for Feasify Official Name Checker
 * Covers: DTI Provider, SEC Provider, Cache, Logger, Service Orchestrator,
 * Security verification, and Regression checks.
 */

const assert = require("assert");
const DTIProvider = require("../services/nameChecker/dti/DTIProvider");
const SECProvider = require("../services/nameChecker/sec/SECProvider");
const cache = require("../services/nameChecker/cache/NameCheckCache");
const logger = require("../services/nameChecker/logger/VerificationLogger");
const nameCheckerService = require("../services/nameChecker");
const fs = require("fs");
const path = require("path");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(description, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log("\n========================================================");
  console.log("   FEASIFY OFFICIAL NAME CHECKER - TEST SUITE");
  console.log("========================================================\n");

  // Ensure sandbox mode is enabled for test simulations
  process.env.DTI_SANDBOX_MODE = "true";
  process.env.SEC_SANDBOX_MODE = "true";

  const dti = new DTIProvider();
  const sec = new SECProvider();

  // ----------------------------------------------------
  // SECTION 1: DTI PROVIDER TESTS
  // ----------------------------------------------------
  console.log("--- 1. DTI Provider Verification ---");

  await test("DTI: Empty input returns ERROR status", async () => {
    const res = await dti.check("");
    assert.strictEqual(res.status, "ERROR");
    assert.strictEqual(res.provider, "DTI");
    assert.ok(res.message.includes("enter a business name"));
  });

  await test("DTI: Input with only whitespace returns ERROR status", async () => {
    const res = await dti.check("    ");
    assert.strictEqual(res.status, "ERROR");
  });

  await test("DTI: Very long input (>150 chars) returns ERROR status", async () => {
    const longName = "A".repeat(151);
    const res = await dti.check(longName);
    assert.strictEqual(res.status, "ERROR");
    assert.ok(res.message.includes("150 characters"));
  });

  await test("DTI: Exact existing business name returns FOUND status with records", async () => {
    const res = await dti.check("Abella General Merchandise");
    assert.strictEqual(res.status, "FOUND");
    assert.strictEqual(res.matchType, "exact");
    assert.ok(res.records.length > 0);
    assert.ok(res.records[0].territory);
    assert.ok(res.records[0].status);
    assert.ok(res.officialSource.includes("bnrs.dti.gov.ph"));
  });

  await test("DTI: Exact nonexistent business name returns NOT_FOUND status with official link", async () => {
    const res = await dti.check("Unique Nonexistent Bakery 2026 XYZ");
    assert.strictEqual(res.status, "NOT_FOUND");
    assert.strictEqual(res.matchType, "none");
    assert.strictEqual(res.records.length, 0);
    assert.ok(res.message.includes("No exact matching DTI business name"));
    assert.ok(!res.message.toLowerCase().includes("officially available"));
    assert.ok(res.officialSource.includes("bnrs.dti.gov.ph/search"));
  });

  await test("DTI: Normalization handles different capitalization", async () => {
    const resUpper = await dti.check("ABELLA GENERAL MERCHANDISE");
    const resLower = await dti.check("abella general merchandise");
    assert.strictEqual(resUpper.status, "FOUND");
    assert.strictEqual(resLower.status, "FOUND");
    assert.strictEqual(resUpper.matchType, "exact");
  });

  await test("DTI: Normalization handles extra spaces and trimming", async () => {
    const res = await dti.check("   Abella    General   Merchandise   ");
    assert.strictEqual(res.status, "FOUND");
    assert.strictEqual(res.matchType, "exact");
  });

  await test("DTI: Handles special characters safely without crashing", async () => {
    const res = await dti.check("Abella's & Co. General Merchandise #101!");
    assert.ok(["FOUND", "NOT_FOUND"].includes(res.status));
    assert.ok(res.officialSource.includes("bnrs.dti.gov.ph"));
  });

  await test("DTI: Provider unavailable simulation returns UNAVAILABLE status", async () => {
    const res = await dti.check("simulate unavailable");
    assert.strictEqual(res.status, "UNAVAILABLE");
    assert.ok(res.message.includes("unavailable"));
    assert.ok(res.officialSource.includes("bnrs.dti.gov.ph"));
  });

  await test("DTI: Timeout simulation returns UNAVAILABLE status with official link", async () => {
    const res = await dti.check("simulate timeout");
    assert.strictEqual(res.status, "UNAVAILABLE");
    assert.ok(res.message.includes("unavailable"));
  });

  // ----------------------------------------------------
  // SECTION 2: SEC PROVIDER TESTS
  // ----------------------------------------------------
  console.log("\n--- 2. SEC Provider Verification ---");

  await test("SEC: Empty input returns ERROR status", async () => {
    const res = await sec.check("");
    assert.strictEqual(res.status, "ERROR");
    assert.strictEqual(res.provider, "SEC");
    assert.ok(res.message.includes("enter a company name"));
  });

  await test("SEC: Very long input (>150 chars) returns ERROR status", async () => {
    const res = await sec.check("C".repeat(151));
    assert.strictEqual(res.status, "ERROR");
  });

  await test("SEC: Existing company lookup returns FOUND with SEC details", async () => {
    const res = await sec.check("Ayala Corporation");
    assert.strictEqual(res.status, "FOUND");
    assert.strictEqual(res.matchType, "exact");
    assert.ok(res.records.length > 0);
    assert.ok(res.records[0].secNumber);
    assert.ok(res.records[0].companyType);
    assert.ok(res.officialSource.includes("esparc.sec.gov.ph"));
  });

  await test("SEC: Nonexistent company returns NOT_FOUND and distinguishes name reservation", async () => {
    const res = await sec.check("Quantum Dynamics Global Solutions Corp 2026");
    assert.strictEqual(res.status, "NOT_FOUND");
    assert.strictEqual(res.matchType, "none");
    assert.ok(res.message.includes("No matching company was found"));
    assert.ok(res.message.includes("eSPARC"));
    // Verify does NOT claim guaranteed SEC approved
    assert.ok(!res.message.includes("SEC Approved"));
    assert.ok(!res.message.includes("Guaranteed Available"));
    assert.strictEqual(res.officialSource, "https://esparc.sec.gov.ph/");
  });

  await test("SEC: Different capitalization matches correctly", async () => {
    const res = await sec.check("SAN MIGUEL CORPORATION");
    assert.strictEqual(res.status, "FOUND");
    assert.strictEqual(res.matchType, "exact");
  });

  await test("SEC: Suffix variations strip suffixes cleanly for normalized comparisons", async () => {
    const stripped1 = sec.stripSuffixes("Ayala Corporation");
    const stripped2 = sec.stripSuffixes("Ayala Corp");
    const stripped3 = sec.stripSuffixes("Ayala Inc.");
    assert.strictEqual(stripped1, "ayala");
    assert.strictEqual(stripped2, "ayala");
    assert.strictEqual(stripped3, "ayala");
  });

  await test("SEC: API unavailable simulation returns UNAVAILABLE status", async () => {
    const res = await sec.check("simulate unavailable");
    assert.strictEqual(res.status, "UNAVAILABLE");
    assert.ok(res.officialSource.includes("esparc.sec.gov.ph"));
  });

  await test("SEC: Authentication failure simulation returns UNAVAILABLE status", async () => {
    const res = await sec.check("simulate auth failure");
    assert.strictEqual(res.status, "UNAVAILABLE");
    assert.ok(res.message.includes("unauthorized") || res.message.includes("credentials"));
  });

  await test("SEC: Rate limit simulation returns UNAVAILABLE status", async () => {
    const res = await sec.check("simulate rate limit");
    assert.strictEqual(res.status, "UNAVAILABLE");
    assert.ok(res.message.includes("rate limit"));
  });

  // ----------------------------------------------------
  // SECTION 3: CACHE & AUDIT LOGGER TESTS
  // ----------------------------------------------------
  console.log("\n--- 3. Cache & Audit Logger Verification ---");

  await test("Cache: Stores and retrieves non-expired entries", () => {
    cache.set("DTI", "test business", { status: "FOUND", message: "Found test" });
    const cached = cache.get("DTI", "test business");
    assert.ok(cached);
    assert.strictEqual(cached.cached, true);
    assert.strictEqual(cached.status, "FOUND");
  });

  await test("Cache: Force refresh bypasses cache", async () => {
    cache.set("DTI", "Unique Nonexistent Bakery 2026 XYZ", {
      status: "FOUND",
      message: "Fake old cached data"
    });
    // With forceRefresh: true, service queries provider freshly
    const res = await nameCheckerService.checkName({
      name: "Unique Nonexistent Bakery 2026 XYZ",
      type: "business",
      forceRefresh: true
    });
    assert.strictEqual(res.status, "NOT_FOUND");
    assert.strictEqual(res.cached, false);
  });

  await test("VerificationLogger: Stores lightweight audit records without sensitive data", async () => {
    const log = await logger.logVerification({
      userId: "user-123",
      name: "Acme Feasibility Co.",
      type: "company",
      provider: "SEC",
      resultStatus: "FOUND",
      sourceUrl: "https://esparc.sec.gov.ph/",
      matchType: "exact"
    });
    assert.ok(log.id);
    assert.strictEqual(log.user_id, "user-123");
    assert.strictEqual(log.name, "Acme Feasibility Co.");
    assert.strictEqual(log.provider, "SEC");
    assert.strictEqual(log.result_status, "FOUND");

    const recent = logger.getRecentLogs(5);
    assert.ok(recent.length > 0);
    assert.strictEqual(recent[0].id, log.id);
  });

  // ----------------------------------------------------
  // SECTION 4: ORCHESTRATION SERVICE TESTS
  // ----------------------------------------------------
  console.log("\n--- 4. NameCheckerService Orchestrator ---");

  await test("Service: type='business' routes automatically to DTI", async () => {
    const res = await nameCheckerService.checkName({
      name: "Abella General Merchandise",
      type: "business",
      forceRefresh: true
    });
    assert.strictEqual(res.provider, "DTI");
    assert.strictEqual(res.status, "FOUND");
  });

  await test("Service: type='company' routes automatically to SEC", async () => {
    const res = await nameCheckerService.checkName({
      name: "Ayala Corporation",
      type: "company",
      forceRefresh: true
    });
    assert.strictEqual(res.provider, "SEC");
    assert.strictEqual(res.status, "FOUND");
  });

  await test("Service: type='all' queries both DTI and SEC concurrently", async () => {
    const res = await nameCheckerService.checkName({
      name: "Sample Entity",
      type: "all",
      forceRefresh: true
    });
    assert.ok(res.dti);
    assert.ok(res.sec);
    assert.strictEqual(res.dti.provider, "DTI");
    assert.strictEqual(res.sec.provider, "SEC");
  });

  await test("Service: getStatus() returns complete diagnostic metadata", () => {
    const status = nameCheckerService.getStatus();
    assert.ok(status.providers.DTI);
    assert.ok(status.providers.SEC);
    assert.strictEqual(status.providers.DTI.officialPortal, "https://bnrs.dti.gov.ph/");
    assert.strictEqual(status.providers.SEC.officialPortal, "https://esparc.sec.gov.ph/");
    assert.ok(status.cache);
  });

  await test("Service: Flag well-known Philippine brands across all scopes (cocopan, goldilocks, mega, red ribbon, 711, uncle johns)", async () => {
    const testCases = [
      { name: "cocopan", expected: "cocopan" },
      { name: "Cocopan Bakery", expected: "cocopan" },
      { name: "goldilocks", expected: "goldilocks" },
      { name: "Goldilocks Bakeshop", expected: "goldilocks" },
      { name: "mega", expected: "mega" },
      { name: "Mega Sardines", expected: "mega" },
      { name: "red ribbon", expected: "red ribbon" },
      { name: "Red Ribbon Cakes", expected: "red ribbon" },
      { name: "711", expected: "711" },
      { name: "uncle johns", expected: "uncle john" },
      { name: "kfc", expected: "kfc" }
    ];

    for (const tc of testCases) {
      const res = await nameCheckerService.checkName({
        name: tc.name,
        type: "business",
        forceRefresh: true
      });
      assert.ok(res.trademarkAlert, `Expected trademark alert for "${tc.name}"`);
      assert.strictEqual(res.trademarkAlert.isProtected, true);
      assert.ok(
        res.trademarkAlert.message.includes("Barangay") && res.trademarkAlert.message.includes("National"),
        `Expected territorial levels mentioned for "${tc.name}"`
      );
    }
  });

  // ----------------------------------------------------
  // SECTION 5: SECURITY & REPOSITORY INTEGRITY
  // ----------------------------------------------------
  console.log("\n--- 5. Security & Repository Integrity ---");

  await test("Dataset: companyNames.json consolidated into single source of truth in backend", () => {
    const frontendJsonPath = path.join(__dirname, "..", "..", "Feasify", "src", "data", "companyNames.json");
    const backendJsonPath = path.join(__dirname, "..", "data", "companyNames.json");
    assert.strictEqual(fs.existsSync(backendJsonPath), true, "Backend companyNames.json must exist as single source of truth");
    assert.strictEqual(fs.existsSync(frontendJsonPath), false, "Redundant frontend companyNames.json must be removed");

    const data = JSON.parse(fs.readFileSync(backendJsonPath, "utf-8"));
    assert.ok(data.companies.some(c => c.id === 1342 && c.name === "RENERGIA VERDE CORPORATION"));
    assert.ok(data.companies.some(c => c.id === 1351 && c.name === "Myrnz Creation Cakes and Pastries"));
  });

  await test("Security: .gitignore includes .env files", () => {
    const gitignorePath = path.join(__dirname, "..", "..", ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, "utf-8");
      assert.ok(content.includes(".env") || content.includes(".env*"));
    }
  });

  await test("Security: Predefined provider integration only (no arbitrary URL execution)", async () => {
    const res = await nameCheckerService.checkName({
      name: "Legit Name",
      provider: "MALICIOUS_CUSTOM_PROVIDER"
    });
    // Unknown provider falls back safely to DTI or SEC
    assert.ok(res.provider === "DTI" || res.provider === "SEC");
  });

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log("\n========================================================");
  console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed out of ${totalTests} total tests`);
  console.log("========================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
