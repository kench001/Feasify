const assert = require("assert");
const fs = require("fs");
const path = require("path");
const dynamicExemplars = require("../services/dynamicExemplars");

console.log("🧪 Starting Dynamic Exemplars & Anti-Outlier Guardrails Test Suite...\n");

// Test 1: Rejection if proposal is not 'Approved'
{
  const proposal = {
    status: "Pending Review",
    businessName: "Super Coffee",
    businessType: "Food Service",
    totalCapital: "500000"
  };
  const result = dynamicExemplars.validateExemplarEligibility(proposal, {}, { score: 95 });
  assert.strictEqual(result.eligible, false);
  assert(result.reason.includes("Must be formally 'Approved'"));
  console.log("✅ Passed: Blocked unapproved proposal.");
}

// Test 2: Rejection if Feasibility Score is below 90
{
  const proposal = {
    status: "Approved",
    businessName: "Budget Kiosk",
    businessType: "Food Service",
    totalCapital: "200000"
  };
  const result = dynamicExemplars.validateExemplarEligibility(proposal, {}, { score: 85 });
  assert.strictEqual(result.eligible, false);
  assert(result.reason.includes("Must achieve at least 90/100"));
  console.log("✅ Passed: Blocked proposal with score < 90.");
}

// Test 3: Anti-Outlier Guardrail — Rejection of fantasy profit margin (> 35%)
{
  const proposal = {
    status: "Approved",
    businessName: "Lemon Magic",
    businessType: "Food Service",
    totalCapital: "100000",
    missionStatement: "Providing the highest quality fresh lemonade in Metro Manila.",
    visionStatement: "To become the leading youth beverage stall nationwide by 2028.",
    proposedLocation: "Commonwealth Avenue, Quezon City"
  };
  // Revenue ₱100,000, COGS ₱35,000, OPEX ₱15,000 -> Net Profit ₱50,000 (50% Margin! Outlier!)
  const fin = {
    monthlyRevenue: 100000,
    totalCogs: 35000,
    totalOpex: 15000,
    rent: 5000,
    salaries: 7000,
    utilities: 3000
  };
  const result = dynamicExemplars.validateExemplarEligibility(proposal, fin, { score: 96 });
  assert.strictEqual(result.eligible, false);
  assert(result.reason.includes("unrealistic outlier"));
  console.log("✅ Passed: Blocked fantasy 50% profit margin outlier (> 35%).");
}

// Test 4: Anti-Outlier Guardrail — Rejection of ₱0 OPEX (e.g. ₱0 rent or ₱0 salaries)
{
  const proposal = {
    status: "Approved",
    businessName: "Free Home Bakers",
    businessType: "Food Service",
    totalCapital: "100000",
    missionStatement: "Baking fresh cookies for local students daily.",
    visionStatement: "Expanding across school campuses by 2030.",
    proposedLocation: "Tandang Sora, Quezon City"
  };
  const fin = {
    monthlyRevenue: 100000,
    totalCogs: 45000,
    totalOpex: 30000,
    rent: 0, // Zero rent!
    salaries: 20000,
    utilities: 10000
  };
  const result = dynamicExemplars.validateExemplarEligibility(proposal, fin, { score: 94 });
  assert.strictEqual(result.eligible, false);
  assert(result.reason.includes("Missing or ₱0 rent"));
  console.log("✅ Passed: Blocked proposal with ₱0 rent.");
}

// Test 5: Anti-Outlier Guardrail — Rejection of unrealistically low COGS (< 30%)
{
  const proposal = {
    status: "Approved",
    businessName: "Miracle Ice Tea",
    businessType: "Food Service",
    totalCapital: "150000",
    missionStatement: "Serving premium iced tea to commuters and students.",
    visionStatement: "Building a trusted neighborhood beverage kiosk.",
    proposedLocation: "EDSA MRT Station, Quezon City"
  };
  const fin = {
    monthlyRevenue: 100000,
    totalCogs: 15000, // 15% COGS (unrealistic raw material cost)
    totalOpex: 65000,
    rent: 20000,
    salaries: 35000,
    utilities: 10000
  };
  const result = dynamicExemplars.validateExemplarEligibility(proposal, fin, { score: 93 });
  assert.strictEqual(result.eligible, false);
  assert(result.reason.includes("unrealistically low"));
  console.log("✅ Passed: Blocked unrealistically low COGS (< 30%).");
}

// Test 6: Successful Qualification of a realistic, high-quality, balanced study
{
  const proposal = {
    status: "Approved",
    businessName: "Golden Bao Express",
    businessType: "Food Service Quick-Service Kiosk",
    totalCapital: "250000",
    missionStatement: "Delivering affordable, freshly steamed dim sum to busy university students.",
    visionStatement: "To be the preferred on-the-go snack hub in North Caloocan by 2027.",
    proposedLocation: "Monumento Circle, Caloocan City",
    priceRanges: "₱35.00 to ₱85.00",
    promotionalStrategy: "Campus flyers, social media bundle discounts, student ID combo promos"
  };
  // Revenue ₱120,000, COGS ₱50,000 (41.6%), OPEX ₱44,000 -> Net Profit ₱26,000 (21.7% Net Margin!)
  const fin = {
    monthlyRevenue: 120000,
    totalCogs: 50000,
    totalOpex: 44000,
    rent: 14000,
    salaries: 22000,
    utilities: 8000
  };
  const result = dynamicExemplars.validateExemplarEligibility(proposal, fin, { score: 94 });
  assert.strictEqual(result.eligible, true);
  assert.strictEqual(result.details.netMarginPercentage, "21.7%");
  console.log("✅ Passed: Approved realistic proposal with healthy 21.7% net margin.");

  // Test Ingestion into dynamic storage
  const ingestRes = async () => {
    const res = await dynamicExemplars.ingestCandidateProposal(proposal, fin, { score: 94 }, null);
    assert.strictEqual(res.ingested, true);
    assert.strictEqual(res.exemplar.name, "Golden Bao Express");
    assert.strictEqual(res.exemplar.category, "Food & Beverage / Food Service");
    console.log("✅ Passed: Successfully ingested benchmark into dynamic_exemplars.json cache.");
  };
  ingestRes().then(() => {
    // Test 7: Category-Matched Selection (Strict 2-Exemplar Cap)
    const staticExemplars = [
      { name: "Mr. Cabbage", type: "Food Service Food Stall", category: "Food" },
      { name: "TechFix Repair", type: "Electronics Repair", category: "Services" }
    ];
    const matched = dynamicExemplars.getCategoryMatchedExemplars("Food Kiosk", staticExemplars);
    assert(matched.length <= 2, "Must be capped at strictly 2 exemplars!");
    assert(matched.some(e => e.name === "Mr. Cabbage"));
    assert(matched.some(e => e.name === "Golden Bao Express"));
    console.log(`✅ Passed: Category matching returned exactly ${matched.length} exemplars (capped under 800 tokens).`);
    console.log("\n🎉 ALL 7 GUARDRAIL AND DYNAMIC INGESTION TESTS PASSED PERFECTLY!");
  });
}
