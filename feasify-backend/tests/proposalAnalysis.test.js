const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeProposalInput,
  buildProposalPrompt,
  normalizeProposalResult,
  RUBRIC_VERSION,
  PASSING_SCORE,
  CATEGORIES,
} = require("../services/proposalAnalysis");

test("Rubric version and passing score constants", () => {
  assert.equal(RUBRIC_VERSION, "proposal-v2");
  assert.equal(PASSING_SCORE, 80);
  assert.equal(CATEGORIES.length, 4);

  const keys = CATEGORIES.map((c) => c.key);
  assert.deepEqual(keys, [
    "strategicAlignment",
    "marketFeasibility",
    "operationalFeasibility",
    "capitalPlanning",
  ]);

  CATEGORIES.forEach((c) => {
    assert.equal(c.maxScore, 25);
  });

  const marketCat = CATEGORIES.find((c) => c.key === "marketFeasibility");
  assert.equal(marketCat.alias, "marketViability");

  const capitalCat = CATEGORIES.find((c) => c.key === "capitalPlanning");
  assert.equal(capitalCat.alias, "financialViability");
});

test("normalizeProposalInput throws INVALID_PROPOSAL_INPUT only for fatal issues", () => {
  // Missing businessName
  assert.throws(
    () => normalizeProposalInput({ totalCapital: 50000 }),
    (err) => err.code === "INVALID_PROPOSAL_INPUT" && err.message.includes("Business name")
  );

  // Negative totalCapital
  assert.throws(
    () => normalizeProposalInput({ businessName: "Acme Corp", totalCapital: -500 }),
    (err) => err.code === "INVALID_PROPOSAL_INPUT" && err.message.includes("Total capital")
  );

  // Non-numeric totalCapital
  assert.throws(
    () => normalizeProposalInput({ businessName: "Acme Corp", totalCapital: "invalid_money" }),
    (err) => err.code === "INVALID_PROPOSAL_INPUT" && err.message.includes("Total capital")
  );
});

test("normalizeProposalInput cleanly parses numbers, accepts custom businessType, and records soft issues", () => {
  const payload = {
    businessName: "  Artisan Brews Cafe  ",
    businessType: "Eco-Friendly Micro-Roastery", // Custom business type
    totalCapital: "₱ 120,000.50",
    contributorsCount: "3",
    financialData: {
      equipmentList: [
        { name: "Espresso Machine", quantity: "2", unitPrice: "₱ 25,000" },
        { name: "Commercial Grinder", quantity: 1, unitPrice: "15000.25" },
      ],
      products: ["Cold Brew Bottle", { name: "Oat Latte" }],
      isCapitalBorrowed: true,
      interestRate: "5.5",
    },
  };

  const normalized = normalizeProposalInput(payload);

  assert.equal(normalized.businessName, "Artisan Brews Cafe");
  assert.equal(normalized.businessType, "Eco-Friendly Micro-Roastery");
  assert.equal(normalized.totalCapital, 120000.5);
  assert.equal(normalized.contributorsCount, 3);
  assert.equal(normalized.financialData.products.length, 2);
  assert.equal(normalized.financialData.equipmentList.length, 2);
  assert.equal(normalized.financialData.equipmentList[0].quantity, 2);
  assert.equal(normalized.financialData.equipmentList[0].unitPrice, 25000);
  assert.equal(normalized.financialData.equipmentList[0].totalCost, 50000);

  // Equipment total: 50,000 + 15,000.25 = 65,000.25
  assert.equal(normalized.capitalChecks.equipmentTotal, 65000.25);
  assert.equal(normalized.capitalChecks.unallocatedCapital, 55000.25);

  // Soft issues populated without throwing
  assert.ok(Array.isArray(normalized.softIssues));
  assert.ok(normalized.softIssues.some((issue) => issue.includes("Tagline")));
  assert.equal(normalized.validationIssues.length, 0);
});

test("buildProposalPrompt includes dedicated instructions and excludes financial feasibility audit requirements", () => {
  const prompt = buildProposalPrompt({
    businessName: "Lumina Studio",
    totalCapital: 80000,
    businessType: "Creative Design",
  });

  assert.ok(prompt.includes("NOT a financial feasibility audit"));
  assert.ok(prompt.includes("DO NOT require, infer, or deduct points for unavailable COGS"));
  assert.ok(prompt.includes("strategicAlignment"));
  assert.ok(prompt.includes("marketFeasibility"));
  assert.ok(prompt.includes("operationalFeasibility"));
  assert.ok(prompt.includes("capitalPlanning"));
  assert.ok(prompt.includes("20-23 points per category"));
});

test("normalizeProposalResult produces passing verdict and backward compatible structure", () => {
  const samplePayload = {
    businessName: "TechNova Solutions",
    businessType: "IT Consulting",
    totalCapital: 200000,
    tagline: "Empowering Modern Teams",
    missionStatement: "Deliver agile tech solutions.",
    visionStatement: "Be the leading regional IT partner.",
    targetMarket: "SMEs in Cavite",
    productDescription: "Custom web and cloud setups.",
    priceRanges: "₱15,000 - ₱50,000",
    proposedLocation: "Dasmariñas City, Cavite",
    promotionalStrategy: "B2B referrals and digital marketing",
  };

  const modelResult = {
    categoryScores: {
      strategicAlignment: 22,
      marketFeasibility: 21,
      operationalFeasibility: 20,
      capitalPlanning: 22,
    },
    categoryRationales: {
      strategicAlignment: "Clear vision and cohesive branding.",
      marketFeasibility: "Well-scoped SME market in Cavite.",
      operationalFeasibility: "Low-overhead remote-capable operational model.",
      capitalPlanning: "Solid startup capital cushion of ₱200,000.",
    },
    insights: [
      { type: "positive", title: "Strong Vision", description: "Clear strategic alignment with target SMEs." },
      { type: "suggestion", title: "Refine Pricing", description: "Specify tier packages for web services." },
    ],
    realityCheck: "Operational plan is well-suited for service deployment.",
    draftFeedback: "Excellent foundation. Ready for adviser review.",
  };

  const result = normalizeProposalResult(modelResult, samplePayload);

  // Score total = 22 + 21 + 20 + 22 = 85
  assert.equal(result.score, 85);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.status, "FEASIBLE");
  assert.equal(result.performanceGrade, "Satisfactory");
  assert.equal(result.rubricVersion, "proposal-v2");
  assert.equal(result.passingScore, 80);
  assert.equal(result.performanceRecommendation, "Proposal feasibility verified. Ready for adviser review.");

  // Category scores and backward compatibility aliases
  assert.equal(result.categoryScores.strategicAlignment, 22);
  assert.equal(result.categoryScores.marketFeasibility, 21);
  assert.equal(result.categoryScores.operationalFeasibility, 20);
  assert.equal(result.categoryScores.capitalPlanning, 22);
  assert.equal(result.categoryScores.marketViability, 21);
  assert.equal(result.categoryScores.financialViability, 22);

  // Metrics percentages (0-100) and aliases
  assert.equal(result.metrics.strategicAlignment, Math.round((22 / 25) * 100)); // 88
  assert.equal(result.metrics.marketFeasibility, Math.round((21 / 25) * 100)); // 84
  assert.equal(result.metrics.operationalFeasibility, Math.round((20 / 25) * 100)); // 80
  assert.equal(result.metrics.capitalPlanning, Math.round((22 / 25) * 100)); // 88
  assert.equal(result.metrics.financial, 88);
  assert.equal(result.metrics.risk, 80);
  assert.equal(result.metrics.market, 84);

  // Explanations backward compatibility
  assert.equal(result.explanations.financial, "Solid startup capital cushion of ₱200,000.");
  assert.equal(result.explanations.market, "Well-scoped SME market in Cavite.");
  assert.equal(result.explanations.risk, "Low-overhead remote-capable operational model.");

  assert.equal(result.insights.length, 2);
  assert.ok(result.realityCheck);
  assert.ok(result.draftFeedback);
});

test("normalizeProposalResult handles score bands (Outstanding, Conditional, Unsatisfactory)", () => {
  const basePayload = {
    businessName: "Sample Shop",
    totalCapital: 50000,
  };

  // Outstanding (>= 90)
  const outstandingResult = normalizeProposalResult(
    {
      categoryScores: { strategicAlignment: 24, marketFeasibility: 24, operationalFeasibility: 23, capitalPlanning: 23 },
    },
    basePayload
  );
  assert.equal(outstandingResult.score, 94);
  assert.equal(outstandingResult.verdict, "PASS");
  assert.equal(outstandingResult.performanceGrade, "Outstanding");

  // Conditional (70 - 79)
  const conditionalResult = normalizeProposalResult(
    {
      categoryScores: { strategicAlignment: 18, marketFeasibility: 19, operationalFeasibility: 18, capitalPlanning: 18 },
    },
    basePayload
  );
  assert.equal(conditionalResult.score, 73);
  assert.equal(conditionalResult.verdict, "CONDITIONAL");
  assert.equal(conditionalResult.status, "CONDITIONALLY_FEASIBLE");
  assert.equal(conditionalResult.performanceGrade, "Conditional");
  assert.equal(conditionalResult.performanceRecommendation, "Revise highlighted details before adviser submission.");

  // Unsatisfactory (< 70)
  const failResult = normalizeProposalResult(
    {
      categoryScores: { strategicAlignment: 15, marketFeasibility: 15, operationalFeasibility: 15, capitalPlanning: 15 },
    },
    basePayload
  );
  assert.equal(failResult.score, 60);
  assert.equal(failResult.verdict, "FAIL");
  assert.equal(failResult.status, "NOT_FEASIBLE");
  assert.equal(failResult.performanceGrade, "Unsatisfactory");
});

test("normalizeProposalResult is resilient to model output quirks and legacy aliases", () => {
  const samplePayload = {
    businessName: "Heritage Pastries",
    totalCapital: 75000,
  };

  // Model returns legacy keys financialViability and marketViability with string numbers and string insight types
  const legacyModelOutput = {
    categoryScores: {
      strategicAlignment: "21",
      marketViability: "22",
      operationalFeasibility: "20",
      financialViability: "23",
    },
    categoryRationales: {
      strategicAlignment: "Sound branding.",
      marketViability: "Appealing local market.",
      operationalFeasibility: "Adequate bakery tools.",
      financialViability: "Good capital buffer.",
    },
    insights: [
      { type: "strength", title: "Solid Capital", description: "Good starting fund." },
      { type: "weakness", title: "Unspecified Packaging", description: "Need supplier quotes." },
    ],
  };

  const result = normalizeProposalResult(legacyModelOutput, samplePayload);

  assert.equal(result.score, 86);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.categoryScores.marketFeasibility, 22);
  assert.equal(result.categoryScores.capitalPlanning, 23);
  assert.equal(result.insights[0].type, "positive");
  assert.equal(result.insights[1].type, "warning");
});
