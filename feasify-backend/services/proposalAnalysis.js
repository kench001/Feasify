const RUBRIC_VERSION = "proposal-v2";
const PASSING_SCORE = 80;

const CATEGORIES = [
  { key: "strategicAlignment", category: "Strategic Foundation & Alignment", maxScore: 25 },
  { key: "marketFeasibility", category: "Market & Offering Feasibility", maxScore: 25, alias: "marketViability" },
  { key: "operationalFeasibility", category: "Operational & Location Feasibility", maxScore: 25 },
  { key: "capitalPlanning", category: "Capital & Asset Planning", maxScore: 25, alias: "financialViability" },
];

const text = (value) => (typeof value === "string" ? value.trim() : "");

const number = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const cleaned = value
    .trim()
    .replace(/^(?:PHP|₱|\$|USD)\s*/i, "")
    .replace(/\s*(?:PHP|₱|\$|USD)$/i, "")
    .replace(/,/g, "")
    .trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const money = (value) => (Number.isFinite(value) ? Math.round(value * 100) / 100 : 0);
const invalid = (code, message) => Object.assign(new Error(message), { code });

function normalizeProposalInput(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const fin = source.financialData && typeof source.financialData === "object" ? source.financialData : {};

  const businessName = text(source.businessName || source.companyName);
  if (!businessName) {
    throw invalid("INVALID_PROPOSAL_INPUT", "Business name is required.");
  }

  // Parse total capital cleanly
  const rawCapital =
    source.totalCapital !== undefined
      ? source.totalCapital
      : fin.totalCapital !== undefined
      ? fin.totalCapital
      : source.proposalCapital;
  const totalCapital = number(rawCapital);
  if (totalCapital === null || totalCapital < 0 || !Number.isFinite(totalCapital)) {
    throw invalid("INVALID_PROPOSAL_INPUT", "Total capital must be a valid non-negative amount.");
  }

  // Text fields — custom businessType accepted cleanly without error
  const businessType = text(source.businessType) || "General Business";
  const tagline = text(source.tagline);
  const missionStatement = text(source.missionStatement || source.mission);
  const visionStatement = text(source.visionStatement || source.vision);
  const targetMarket = text(source.targetMarket);
  const productDescription = text(source.productDescription);
  const priceRanges = text(source.priceRanges);
  const proposedLocation = text(source.proposedLocation);
  const promotionalStrategy = text(source.promotionalStrategy);
  const otherDetails = text(source.otherDetails || source.additionalFeasibilityDetails);

  // Contributors count
  const rawContributors = source.contributorsCount ?? fin.contributorsCount;
  const parsedContributors = number(rawContributors);
  const contributorsCount =
    parsedContributors !== null && parsedContributors >= 1
      ? Math.round(parsedContributors)
      : 1;

  // Products array
  const rawProducts = Array.isArray(fin.products)
    ? fin.products
    : Array.isArray(source.products)
    ? source.products
    : [];
  const products = rawProducts
    .map((item) =>
      typeof item === "string"
        ? { name: text(item) }
        : { name: text(item?.name || item?.productName) }
    )
    .filter((item) => item.name);

  // Equipment list cleanly parsed (quantities and prices)
  const rawEquipment = Array.isArray(fin.equipmentList)
    ? fin.equipmentList
    : Array.isArray(source.equipmentList)
    ? source.equipmentList
    : [];
  const equipmentList = rawEquipment
    .map((item) => {
      const name = text(item?.name || item?.itemName || item?.equipmentName);
      const rawQty = number(item?.quantity);
      const rawPrice = number(item?.unitPrice ?? item?.cost ?? item?.price);
      const quantity = rawQty !== null && rawQty > 0 ? Math.round(rawQty) : 1;
      const unitPrice = rawPrice !== null && rawPrice >= 0 ? money(rawPrice) : 0;
      return {
        name,
        quantity,
        unitPrice,
        totalCost: money(quantity * unitPrice),
      };
    })
    .filter((item) => item.name);

  const isCapitalBorrowed = fin.isCapitalBorrowed === true || source.isCapitalBorrowed === true;
  const rawInterest = fin.isCapitalBorrowed
    ? fin.interestRate
    : source.isCapitalBorrowed
    ? source.interestRate
    : 0;
  const interestRate = isCapitalBorrowed ? (number(rawInterest) ?? 0) : 0;

  // Equipment total and capital calculations
  const equipmentTotal = money(equipmentList.reduce((sum, item) => sum + item.totalCost, 0));
  const unallocatedCapital = money(totalCapital - equipmentTotal);
  const equalContributionEstimate =
    contributorsCount > 0 ? money(totalCapital / contributorsCount) : totalCapital;

  // Soft issues for AI context (do NOT throw 503 or abort validation)
  const softIssues = [];
  if (!tagline) softIssues.push("Tagline not provided.");
  if (!missionStatement) softIssues.push("Mission statement not provided.");
  if (!visionStatement) softIssues.push("Vision statement not provided.");
  if (!targetMarket) softIssues.push("Target market description is minimal or not provided.");
  if (!productDescription) softIssues.push("Product description is minimal or not provided.");
  if (!priceRanges) softIssues.push("Price ranges not explicitly stated.");
  if (!proposedLocation) softIssues.push("Proposed location not provided.");
  if (!promotionalStrategy) softIssues.push("Promotional strategy not specified.");
  if (equipmentList.length === 0) {
    softIssues.push("No specific equipment items listed (acceptable for service/digital businesses).");
  }
  if (equipmentTotal > totalCapital) {
    softIssues.push(`Equipment cost (₱${equipmentTotal.toLocaleString()}) exceeds total capital (₱${totalCapital.toLocaleString()}).`);
  }

  return {
    businessName,
    businessType,
    tagline,
    missionStatement,
    visionStatement,
    targetMarket,
    productDescription,
    priceRanges,
    proposedLocation,
    promotionalStrategy,
    otherDetails,
    totalCapital,
    contributorsCount,
    financialData: {
      products,
      equipmentList,
      isCapitalBorrowed,
      interestRate,
      contributorsCount,
    },
    capitalChecks: {
      equipmentTotal,
      unallocatedCapital,
      equalContributionEstimate,
      equipmentCount: equipmentList.length,
    },
    softIssues,
    validationIssues: [],
  };
}

function buildProposalPrompt(payload) {
  const input = normalizeProposalInput(payload);
  return `You are the Feasify Academic Proposal Evaluation Specialist.
Evaluate this preliminary student BUSINESS PROPOSAL for faculty adviser review.
This is preliminary student business proposal screening for adviser review, NOT a financial feasibility audit.

CRITICAL INSTRUCTIONS:
1. DO NOT require, infer, or deduct points for unavailable COGS, recipe costs, unit costs, direct materials, direct labor, profit margins, 12-month projections, cash flow, ROI, payback, or taxes. These fields DO NOT exist on the business proposal form and belong strictly to subsequent financial feasibility stages.
2. Evaluate ONLY the supplied form fields:
   - Business Identity: businessName, businessType, tagline, mission, vision
   - Market & Offering: targetMarket, productDescription, priceRanges, proposed products, promotionalStrategy
   - Operations & Location: proposedLocation, equipmentList (tools/machinery/fixtures)
   - Capital & Planning: totalCapital, contributorsCount, equipmentList, isCapitalBorrowed, interestRate, otherDetails
3. Custom or non-standard business types are completely acceptable and valid. Service or digital businesses may legitimately have minimal or zero equipment listed.
4. Capital minus equipment represents UNALLOCATED initial startup capital (buffer/working funds), NOT a deficit or proof of operational failure.
5. Grading Philosophy: Any complete, coherent proposal with realistic numbers should easily earn passing points (20-23 points per category, yielding 80-92 total points). Reserve deductions only for clear internal contradictions or glaringly missing core concepts. Tie any deduction directly to an actionable recommendation.

EVALUATION RUBRIC (4 categories, 25 points maximum each, Total 100 points. PASS threshold: 80):

1. strategicAlignment (max 25 points):
   - Scope: Strategic Foundation & Alignment. Evaluates business name, business type (including custom types), tagline, mission statement, vision statement, and overall conceptual coherence.
   - Scoring: 23-25 (Outstanding alignment), 20-22 (Satisfactory/solid foundation), 16-19 (Minor clarity gaps), 0-15 (Contradictory or severely incoherent).

2. marketFeasibility (max 25 points):
   - Scope: Market & Offering Feasibility. Evaluates target market segmentation, product/service description, proposed products, stated price ranges, and promotional/marketing strategy.
   - Scoring: 23-25 (Well-defined audience and offering), 20-22 (Viable market and promotion concept), 16-19 (Broad or generic market approach), 0-15 (Mismatched product/market/pricing).

3. operationalFeasibility (max 25 points):
   - Scope: Operational & Location Feasibility. Evaluates proposed operating location and appropriateness of listed equipment/tools for the proposed business model.
   - Scoring: 23-25 (Practical location and operational readiness), 20-22 (Workable setup), 16-19 (Vague location or equipment gaps), 0-15 (Unrealistic operational setup).

4. capitalPlanning (max 25 points):
   - Scope: Capital & Asset Planning. Evaluates declared total capital adequacy, equipment expense allocation, headroom in unallocated capital, partner contribution splitting, and borrowing terms.
   - Scoring: 23-25 (Sensible startup capitalization and asset allocation), 20-22 (Coherent budget with adequate cushion), 16-19 (Tight budget or unaddressed equipment costs), 0-15 (Severe capital misallocation).

Return ONLY valid JSON in this exact structure:
{
  "categoryScores": {
    "strategicAlignment": <integer 0-25>,
    "marketFeasibility": <integer 0-25>,
    "operationalFeasibility": <integer 0-25>,
    "capitalPlanning": <integer 0-25>
  },
  "categoryRationales": {
    "strategicAlignment": "<specific evidence and reason for score>",
    "marketFeasibility": "<specific evidence and reason for score>",
    "operationalFeasibility": "<specific evidence and reason for score>",
    "capitalPlanning": "<specific evidence and reason for score>"
  },
  "insights": [
    {
      "type": "positive" | "warning" | "info" | "suggestion",
      "title": "<concise title>",
      "description": "<actionable observation referencing supplied proposal fields>"
    }
  ],
  "realityCheck": "<concise paragraph highlighting what the supplied data supports and key assumptions for the upcoming feasibility stage>",
  "draftFeedback": "<constructive, professional feedback summary directly addressing the student team>"
}

INPUT PROPOSAL DATA:
${JSON.stringify(input, null, 2)}`;
}

function normalizeProposalResult(modelResult, payload) {
  const input = normalizeProposalInput(payload);
  const result =
    modelResult && typeof modelResult === "object" && !Array.isArray(modelResult)
      ? modelResult
      : {};
  const scores =
    result.categoryScores && typeof result.categoryScores === "object"
      ? result.categoryScores
      : {};
  const rationales =
    result.categoryRationales && typeof result.categoryRationales === "object"
      ? result.categoryRationales
      : {};

  // Extract each category score safely (0 - 25 integer)
  const extractScore = (key, alias) => {
    const raw =
      scores[key] !== undefined
        ? scores[key]
        : alias && scores[alias] !== undefined
        ? scores[alias]
        : undefined;
    const num = number(raw);
    if (num === null) {
      return 20; // Default to satisfactory baseline if omitted
    }
    return Math.max(0, Math.min(25, Math.round(num)));
  };

  const strategicAlignmentScore = extractScore("strategicAlignment");
  const marketFeasibilityScore = extractScore("marketFeasibility", "marketViability");
  const operationalFeasibilityScore = extractScore("operationalFeasibility");
  const capitalPlanningScore = extractScore("capitalPlanning", "financialViability");

  const extractRationale = (key, alias, fallback) => {
    const val = text(rationales[key] || (alias ? rationales[alias] : "") || "");
    return val || fallback;
  };

  const strategicAlignmentRationale = extractRationale(
    "strategicAlignment",
    null,
    "Strategic foundation evaluated based on business identity, mission, and vision."
  );
  const marketFeasibilityRationale = extractRationale(
    "marketFeasibility",
    "marketViability",
    "Market offering evaluated based on target segment, products, and promotion."
  );
  const operationalFeasibilityRationale = extractRationale(
    "operationalFeasibility",
    null,
    "Operational feasibility evaluated based on proposed location and equipment setup."
  );
  const capitalPlanningRationale = extractRationale(
    "capitalPlanning",
    "financialViability",
    "Capital and asset planning evaluated based on startup funds and equipment allocation."
  );

  const matrixBreakdown = [
    {
      key: "strategicAlignment",
      category: "Strategic Foundation & Alignment",
      maxScore: 25,
      score: strategicAlignmentScore,
      rationale: strategicAlignmentRationale,
    },
    {
      key: "marketFeasibility",
      category: "Market & Offering Feasibility",
      maxScore: 25,
      alias: "marketViability",
      score: marketFeasibilityScore,
      rationale: marketFeasibilityRationale,
    },
    {
      key: "operationalFeasibility",
      category: "Operational & Location Feasibility",
      maxScore: 25,
      score: operationalFeasibilityScore,
      rationale: operationalFeasibilityRationale,
    },
    {
      key: "capitalPlanning",
      category: "Capital & Asset Planning",
      maxScore: 25,
      alias: "financialViability",
      score: capitalPlanningScore,
      rationale: capitalPlanningRationale,
    },
  ];

  const score =
    strategicAlignmentScore +
    marketFeasibilityScore +
    operationalFeasibilityScore +
    capitalPlanningScore;
  const verdict = score >= 80 ? "PASS" : score >= 70 ? "CONDITIONAL" : "FAIL";
  const performanceGrade =
    score >= 90
      ? "Outstanding"
      : score >= 80
      ? "Satisfactory"
      : score >= 70
      ? "Conditional"
      : "Unsatisfactory";
  const performanceRecommendation =
    verdict === "PASS"
      ? "Proposal feasibility verified. Ready for adviser review."
      : "Revise highlighted details before adviser submission.";

  // Normalize insights
  const typeMap = {
    strength: "positive",
    strengths: "positive",
    positive: "positive",
    weakness: "warning",
    weaknesses: "warning",
    warning: "warning",
    info: "info",
    information: "info",
    suggestion: "suggestion",
    recommendation: "suggestion",
    recommendations: "suggestion",
  };

  const rawInsights = Array.isArray(result.insights) ? result.insights : [];
  const insights = rawInsights
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const mappedType = typeMap[String(item.type || "").toLowerCase()] || "info";
      const title = text(item.title) || "Proposal Assessment";
      const description = text(item.description || item.detail || item.message);
      if (!description) return null;
      return { type: mappedType, title, description };
    })
    .filter(Boolean);

  if (insights.length === 0) {
    if (verdict === "PASS") {
      insights.push({
        type: "positive",
        title: "Proposal Foundation Verified",
        description: `Your proposal for ${input.businessName} presents a coherent operational and capital framework.`,
      });
      insights.push({
        type: "suggestion",
        title: "Next Steps for Adviser Submission",
        description:
          "Submit this proposal for faculty adviser review and begin preparing detailed unit economics for the defense feasibility stage.",
      });
    } else {
      insights.push({
        type: "warning",
        title: "Refinement Required",
        description:
          "Review unallocated capital, location specifics, or product descriptions before final adviser submission.",
      });
    }
  }

  const realityCheck =
    text(result.realityCheck) ||
    `Declared capital of ₱${input.totalCapital.toLocaleString()} and equipment total of ₱${input.capitalChecks.equipmentTotal.toLocaleString()} support initial screening. Subsequent financial feasibility will require detailed operational expenses and unit costing.`;

  const draftFeedback =
    text(result.draftFeedback) ||
    `Proposal ${input.businessName} scored ${score}/100 (${performanceGrade}). ${performanceRecommendation}`;

  const categoryScores = {
    strategicAlignment: strategicAlignmentScore,
    marketFeasibility: marketFeasibilityScore,
    operationalFeasibility: operationalFeasibilityScore,
    capitalPlanning: capitalPlanningScore,
    // Backward compatibility aliases
    financialViability: capitalPlanningScore,
    marketViability: marketFeasibilityScore,
  };

  const metrics = {
    strategicAlignment: Math.round((strategicAlignmentScore / 25) * 100),
    marketFeasibility: Math.round((marketFeasibilityScore / 25) * 100),
    operationalFeasibility: Math.round((operationalFeasibilityScore / 25) * 100),
    capitalPlanning: Math.round((capitalPlanningScore / 25) * 100),
    // Backward-compatible metrics
    financial: Math.round((capitalPlanningScore / 25) * 100),
    risk: Math.round((operationalFeasibilityScore / 25) * 100),
    market: Math.round((marketFeasibilityScore / 25) * 100),
    financialViability: Math.round((capitalPlanningScore / 25) * 100),
    marketViability: Math.round((marketFeasibilityScore / 25) * 100),
  };

  const explanations = {
    feasibility: performanceRecommendation,
    strategicAlignment: strategicAlignmentRationale,
    marketFeasibility: marketFeasibilityRationale,
    operationalFeasibility: operationalFeasibilityRationale,
    capitalPlanning: capitalPlanningRationale,
    // Backward compatibility aliases
    financial: capitalPlanningRationale,
    financialViability: capitalPlanningRationale,
    market: marketFeasibilityRationale,
    marketViability: marketFeasibilityRationale,
    risk: operationalFeasibilityRationale,
    operationalFeasibility: operationalFeasibilityRationale,
  };

  return {
    score,
    status:
      verdict === "PASS"
        ? "FEASIBLE"
        : verdict === "CONDITIONAL"
        ? "CONDITIONALLY_FEASIBLE"
        : "NOT_FEASIBLE",
    verdict,
    passingScore: PASSING_SCORE,
    rubricVersion: RUBRIC_VERSION,
    performanceGrade,
    performanceStatus: verdict,
    performanceRecommendation,
    categoryScores,
    matrixBreakdown,
    metrics,
    explanations,
    insights,
    realityCheck,
    draftFeedback,
    capitalChecks: input.capitalChecks,
    softIssues: input.softIssues || [],
    validationIssues: [],
    _fallback: false,
  };
}

module.exports = {
  normalizeProposalInput,
  buildProposalPrompt,
  normalizeProposalResult,
  RUBRIC_VERSION,
  PASSING_SCORE,
  CATEGORIES,
};
