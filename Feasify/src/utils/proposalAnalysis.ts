import { getOtherRelevantInformation } from "./proposalDetails";

export const PROPOSAL_RUBRIC_VERSION = "proposal-v2";
export const PROPOSAL_PASSING_SCORE = 80;

export const PROPOSAL_CATEGORIES = [
  { key: "strategicAlignment", label: "Strategic Foundation & Alignment", maxScore: 25 },
  { key: "marketFeasibility", label: "Market & Offering Feasibility", maxScore: 25 },
  { key: "operationalFeasibility", label: "Operational & Location Feasibility", maxScore: 25 },
  { key: "capitalPlanning", label: "Capital & Asset Planning", maxScore: 25 },
] as const;

export const PROPOSAL_CATEGORIES_V1 = [
  { key: "financialViability", label: "Financial Viability", maxScore: 35 },
  { key: "operationalFeasibility", label: "Operational Feasibility", maxScore: 25 },
  { key: "marketViability", label: "Market Viability", maxScore: 25 },
  { key: "strategicAlignment", label: "Strategic Alignment", maxScore: 15 },
] as const;

export type ProposalCategoryKey = (typeof PROPOSAL_CATEGORIES)[number]["key"];

// Include only fields visible in the proposal form; financial-stage costing stays out.
export const buildProposalAnalysisInput = (proposal: any) => {
  const text = (value: unknown) => String(value ?? "").trim();
  const financial = proposal?.financialData || {};
  return {
    businessName: text(proposal?.businessName),
    businessType: text(proposal?.businessType),
    totalCapital: text(proposal?.totalCapital),
    contributorsCount: text(proposal?.contributorsCount ?? financial.contributorsCount ?? "1"),
    tagline: text(proposal?.tagline),
    targetMarket: text(proposal?.targetMarket),
    missionStatement: text(proposal?.missionStatement),
    visionStatement: text(proposal?.visionStatement),
    productDescription: text(proposal?.productDescription),
    priceRanges: text(proposal?.priceRanges),
    proposedLocation: text(proposal?.proposedLocation),
    promotionalStrategy: text(proposal?.promotionalStrategy),
    otherDetails: text(getOtherRelevantInformation(proposal)),
    financialData: {
      products: (Array.isArray(financial.products) ? financial.products : []).map((product: any) => ({
        name: text(typeof product === "string" ? product : product?.name),
      })),
      equipmentList: (Array.isArray(financial.equipmentList) ? financial.equipmentList : []).map((equipment: any) => ({
        name: text(equipment?.name),
        quantity: text(equipment?.quantity),
        unitPrice: text(equipment?.unitPrice),
      })),
      isCapitalBorrowed: financial.isCapitalBorrowed === true,
      interestRate: financial.isCapitalBorrowed === true ? text(financial.interestRate) : "",
    },
  };
};

export const getProposalInputSignature = (proposal: any) => JSON.stringify(buildProposalAnalysisInput(proposal));

/**
 * Deterministic proposal evaluation heuristic matrix.
 * Scores ONLY preliminary proposal fields (business name, type, tagline, mission, vision,
 * target market, product description, price ranges, proposed location, promotional strategy,
 * declared capital, contributors, equipment list, and loan financing terms).
 * NEVER touches or requires COGS, recipe costs, unit costs, direct materials, direct labor,
 * profit margins, or multi-year financial statements.
 */
export const evaluateProposalHeuristic = (proposal: any) => {
  const text = (value: unknown) => String(value ?? "").trim();
  const parseNum = (val: unknown): number => {
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    if (typeof val !== "string" || !val.trim()) return 0;
    const cleaned = val.replace(/^(?:PHP|₱)\s*/i, "").replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const businessName = text(proposal?.businessName);
  const businessType = text(proposal?.businessType);
  const tagline = text(proposal?.tagline);
  const missionStatement = text(proposal?.missionStatement);
  const visionStatement = text(proposal?.visionStatement);
  const targetMarket = text(proposal?.targetMarket);
  const productDescription = text(proposal?.productDescription);
  const priceRanges = text(proposal?.priceRanges);
  const proposedLocation = text(proposal?.proposedLocation);
  const promotionalStrategy = text(proposal?.promotionalStrategy);

  const fin = proposal?.financialData || {};
  const totalCapital = parseNum(proposal?.totalCapital ?? fin.totalCapital);
  const contributorsCount = Math.max(1, Math.round(parseNum(proposal?.contributorsCount ?? fin.contributorsCount ?? 1)));
  const isCapitalBorrowed = fin.isCapitalBorrowed === true;
  const interestRate = parseNum(fin.interestRate);

  const equipmentList: Array<{ name: string; quantity: number; unitPrice: number }> = (
    Array.isArray(fin.equipmentList) ? fin.equipmentList : Array.isArray(proposal?.equipmentList) ? proposal.equipmentList : []
  ).map((item: any) => ({
    name: text(item?.name),
    quantity: Math.max(0, Math.round(parseNum(item?.quantity))),
    unitPrice: Math.max(0, parseNum(item?.unitPrice)),
  }));

  const totalEquipmentCost = equipmentList.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // 1. Strategic Foundation & Alignment (25 max)
  let strategicScore = 0;
  // Business Name: 0 - 5
  if (businessName.length >= 3) strategicScore += 5;
  else if (businessName.length > 0) strategicScore += 2;

  // Business Type: 0 - 5
  if (businessType && businessType.toLowerCase() !== "other") strategicScore += 5;
  else if (businessType) strategicScore += 2;

  // Tagline: 0 - 5
  if (tagline.length >= 10) strategicScore += 5;
  else if (tagline.length > 0) strategicScore += 3;
  else strategicScore += 1;

  // Mission Statement: 0 - 5
  if (missionStatement.length >= 25) strategicScore += 5;
  else if (missionStatement.length >= 10) strategicScore += 3;
  else if (missionStatement.length > 0) strategicScore += 1;

  // Vision Statement: 0 - 5
  if (visionStatement.length >= 25) strategicScore += 5;
  else if (visionStatement.length >= 10) strategicScore += 3;
  else if (visionStatement.length > 0) strategicScore += 1;

  // 2. Market & Offering Feasibility (25 max)
  let marketScore = 0;
  // Target Market: 0 - 7
  if (targetMarket.length >= 20) marketScore += 7;
  else if (targetMarket.length >= 10) marketScore += 4;
  else if (targetMarket.length > 0) marketScore += 2;

  // Product / Service Description: 0 - 7
  if (productDescription.length >= 20) marketScore += 7;
  else if (productDescription.length >= 10) marketScore += 4;
  else if (productDescription.length > 0) marketScore += 2;

  // Price Ranges: 0 - 6
  if (priceRanges.length > 0 && (/\d/.test(priceRanges) || /(?:low|mid|high|standard|affordable)/i.test(priceRanges))) marketScore += 6;
  else if (priceRanges.length > 0) marketScore += 3;

  // Promotional Strategy: 0 - 5
  if (promotionalStrategy.length >= 15) marketScore += 5;
  else if (promotionalStrategy.length >= 6) marketScore += 3;
  else if (promotionalStrategy.length > 0) marketScore += 1;

  // 3. Operational & Location Feasibility (25 max)
  let operationalScore = 0;
  // Proposed Location: 0 - 10
  if (proposedLocation.length >= 15) operationalScore += 10;
  else if (proposedLocation.length >= 5) operationalScore += 6;
  else if (proposedLocation.length > 0) operationalScore += 3;

  // Operational Assets & Equipment Match: 0 - 10
  const isServiceOrDigital = /(?:service|digital|consulting|tech|software|freelance|tutoring)/i.test(businessType);
  if (equipmentList.length > 0 && equipmentList.some((e) => e.name && e.quantity > 0 && e.unitPrice > 0)) {
    operationalScore += 10;
  } else if (isServiceOrDigital) {
    operationalScore += 8;
  } else if (equipmentList.length > 0) {
    operationalScore += 5;
  } else {
    operationalScore += 4;
  }

  // Location / Concept Coherence: 0 - 5
  if (proposedLocation.length >= 10 && businessType) operationalScore += 5;
  else if (proposedLocation.length > 0) operationalScore += 3;
  else operationalScore += 1;

  // 4. Capital & Asset Planning (25 max)
  let capitalScore = 0;
  // Declared Capital Adequacy: 0 - 10
  if (totalCapital >= 20000) capitalScore += 10;
  else if (totalCapital >= 10000) capitalScore += 8;
  else if (totalCapital >= 3000) capitalScore += 6;
  else if (totalCapital > 0) capitalScore += 4;

  // Contributor / Equity Distribution: 0 - 5
  if (contributorsCount >= 1 && totalCapital > 0) capitalScore += 5;
  else if (contributorsCount >= 1) capitalScore += 3;

  // Equipment vs Total Capital Coherence: 0 - 6
  if (totalCapital > 0) {
    if (totalEquipmentCost > totalCapital) {
      capitalScore += 0; // Asset expense exceeds total capital
    } else if (totalEquipmentCost === 0) {
      capitalScore += 5; // Clean working capital reserve
    } else if (totalEquipmentCost <= totalCapital * 0.65) {
      capitalScore += 6; // Healthy working capital reserve
    } else if (totalEquipmentCost <= totalCapital * 0.9) {
      capitalScore += 4; // Moderate working capital reserve
    } else {
      capitalScore += 2; // Very tight working capital reserve
    }
  } else {
    capitalScore += 1;
  }

  // Financing / Borrowing Terms: 0 - 4
  if (!isCapitalBorrowed) {
    capitalScore += 4; // Equity-funded, zero debt service pressure
  } else if (interestRate >= 0 && interestRate <= 20) {
    capitalScore += 4; // Manageable borrowing rate
  } else if (interestRate > 20 && interestRate <= 36) {
    capitalScore += 2; // Elevated borrowing rate
  } else {
    capitalScore += 1; // Unrealistic or negative rate
  }

  // Clamp category scores
  strategicScore = Math.max(0, Math.min(25, strategicScore));
  marketScore = Math.max(0, Math.min(25, marketScore));
  operationalScore = Math.max(0, Math.min(25, operationalScore));
  capitalScore = Math.max(0, Math.min(25, capitalScore));

  const totalScore = strategicScore + marketScore + operationalScore + capitalScore;
  const verdict: "PASS" | "CONDITIONAL" | "FAIL" =
    totalScore >= PROPOSAL_PASSING_SCORE ? "PASS" : totalScore >= 70 ? "CONDITIONAL" : "FAIL";
  const status: "FEASIBLE" | "CONDITIONALLY_FEASIBLE" | "NOT_FEASIBLE" =
    verdict === "PASS" ? "FEASIBLE" : verdict === "CONDITIONAL" ? "CONDITIONALLY_FEASIBLE" : "NOT_FEASIBLE";

  // Insights / Feedback construction
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  // Strengths
  if (totalCapital >= 10000 && totalEquipmentCost <= totalCapital) {
    strengths.push(
      `Declared startup capital of PHP ${totalCapital.toLocaleString()} provides a sound financial base with balanced equipment allocation.`
    );
  }
  if (strategicScore >= 20) {
    strengths.push(
      `Strong strategic foundation with clearly defined business scope, mission, and forward-looking vision statements.`
    );
  }
  if (marketScore >= 18) {
    strengths.push(
      `Target market demographic and product/service concept are well-matched with stated price ranges.`
    );
  }
  if (operationalScore >= 18) {
    strengths.push(
      `Proposed operating location at ${proposedLocation || "the designated venue"} aligns with the business concept.`
    );
  }
  if (strengths.length === 0) {
    strengths.push(`Core concept "${businessName || "Business Proposal"}" registered under ${businessType || "General"} sector.`);
  }

  // Weaknesses
  if (totalEquipmentCost > totalCapital && totalCapital > 0) {
    weaknesses.push(
      `Listed equipment cost (PHP ${totalEquipmentCost.toLocaleString()}) exceeds declared total capital (PHP ${totalCapital.toLocaleString()}).`
    );
  }
  if (totalCapital < 5000) {
    weaknesses.push("Declared initial capital is very lean; consider whether additional contingency capital is required.");
  }
  if (proposedLocation.length < 10) {
    weaknesses.push("Proposed location lacks specific site address, commercial area, or venue details.");
  }
  if (missionStatement.length < 15 || visionStatement.length < 15) {
    weaknesses.push("Mission and/or vision statements are minimal and should clearly define organizational goals and beneficiaries.");
  }
  if (targetMarket.length < 15) {
    weaknesses.push("Target market description is brief; define primary customer personas, demographics, and purchasing habits.");
  }
  if (promotionalStrategy.length < 10) {
    weaknesses.push("Promotional strategy requires specific channels (e.g. social media campaigns, local partnerships, flyers).");
  }

  // Recommendations
  if (operationalScore < 20) {
    recommendations.push(
      `Specify the exact physical or online operating hub at ${proposedLocation || "your chosen venue"} to demonstrate location feasibility.`
    );
  }
  if (marketScore < 20) {
    recommendations.push("Elaborate on customer acquisition tactics and concrete promotional campaigns for your target audience.");
  }
  if (capitalScore < 20 && totalEquipmentCost > totalCapital) {
    recommendations.push("Adjust initial equipment list or increase declared startup capital to ensure equipment does not exceed capital.");
  } else if (capitalScore < 20) {
    recommendations.push("Maintain a healthy unallocated capital buffer to absorb pre-operating and promotional startup costs.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Review proposal summary with team members and submit to faculty adviser for formal evaluation.");
  }

  const realityCheck = `Declared capital of PHP ${totalCapital.toLocaleString()} for ${businessName || "the venture"} in ${businessType || "general industry"} at ${proposedLocation || "designated venue"}. Initial equipment budget stands at PHP ${totalEquipmentCost.toLocaleString()} across ${equipmentList.length} item(s).`;

  const draftFeedback =
    verdict === "PASS"
      ? "Proposal demonstrates satisfactory feasibility across strategic foundation, market reach, location, and capital planning. Ready for adviser review."
      : "Address highlighted areas of concern—particularly location specificity, promotional reach, or capital allocation—and re-analyze before submitting.";

  const categoryScores = {
    strategicAlignment: strategicScore,
    marketFeasibility: marketScore,
    operationalFeasibility: operationalScore,
    capitalPlanning: capitalScore,
  };

  const categoryRationales = {
    strategicAlignment:
      strategicScore >= 20
        ? "Strong alignment between business name, industry type, mission, and long-term vision."
        : "Strengthen mission and vision clarity to ensure distinct organizational positioning.",
    marketFeasibility:
      marketScore >= 18
        ? "Target customer demographic and promotional channels are clearly defined."
        : "Expand target customer segmentation and marketing outreach channels.",
    operationalFeasibility:
      operationalScore >= 18
        ? "Proposed venue location and operational assets align with the business model."
        : "Provide specific address details and confirm operational asset requirements.",
    capitalPlanning:
      capitalScore >= 18
        ? "Initial capital structure and asset allocation show balanced planning."
        : "Ensure equipment costs fit within declared capital and maintain working capital reserves.",
  };

  const explanations = {
    feasibility:
      verdict === "PASS"
        ? "Proposal demonstrates high feasibility and meets academic criteria for adviser submission."
        : "Proposal requires refinement in key areas before adviser submission.",
    financial: categoryRationales.capitalPlanning,
    market: categoryRationales.marketFeasibility,
    risk: categoryRationales.operationalFeasibility,
    strategic: categoryRationales.strategicAlignment,
  };

  const metrics = {
    financial: Math.round((capitalScore / 25) * 100),
    risk: Math.round((operationalScore / 25) * 100),
    market: Math.round((marketScore / 25) * 100),
    strategic: Math.round((strategicScore / 25) * 100),
  };

  const insights = [
    ...strengths.map((s) => ({ type: "positive" as const, title: "Strength", description: s })),
    ...weaknesses.map((w) => ({ type: "warning" as const, title: "Area of Concern", description: w })),
    ...recommendations.map((r) => ({ type: "info" as const, title: "Recommendation", description: r })),
  ];

  return {
    score: totalScore,
    verdict,
    status,
    passingScore: PROPOSAL_PASSING_SCORE,
    rubricVersion: PROPOSAL_RUBRIC_VERSION,
    categoryScores,
    categoryRationales,
    metrics,
    explanations,
    insights,
    strengths,
    weaknesses,
    recommendations,
    realityCheck,
    draftFeedback,
    _fallback: true,
    analysisType: "STUDENT_PROPOSAL_ANALYSIS",
    sourceModule: "student-proposal-heuristic",
  };
};

export const isValidProposalAnalysis = (analysis: any): boolean => {
  if (!analysis || !Number.isFinite(analysis.score)) return false;
  const rubricVersion = analysis.rubricVersion;

  // Support proposal-v2 (current standard)
  if (rubricVersion === "proposal-v2" || !rubricVersion) {
    if (analysis.categoryScores) {
      let total = 0;
      for (const category of PROPOSAL_CATEGORIES) {
        const catScore = analysis.categoryScores[category.key];
        if (typeof catScore !== "number" || catScore < 0 || catScore > category.maxScore) {
          return false;
        }
        total += catScore;
      }
      const roundedTotal = Math.round(total);
      if (Math.abs(roundedTotal - analysis.score) > 1) return false;
    }
    const expectedVerdict = analysis.score >= PROPOSAL_PASSING_SCORE ? "PASS" : analysis.score >= 70 ? "CONDITIONAL" : "FAIL";
    if (analysis.verdict && analysis.verdict !== expectedVerdict && !(analysis.score >= PROPOSAL_PASSING_SCORE && analysis.verdict === "PASS")) {
      return false;
    }
    return true;
  }

  // Support proposal-v1 (backward compatibility)
  if (rubricVersion === "proposal-v1") {
    if (analysis.categoryScores) {
      let total = 0;
      for (const category of PROPOSAL_CATEGORIES_V1) {
        const catScore = analysis.categoryScores[category.key];
        if (typeof catScore !== "number" || catScore < 0 || catScore > category.maxScore) return false;
        total += catScore;
      }
      const roundedTotal = Math.round(total);
      if (Math.abs(roundedTotal - analysis.score) > 1) return false;
    }
    return true;
  }

  return false;
};

export const isCurrentProposalAnalysis = (proposal: any): boolean =>
  isValidProposalAnalysis(proposal?.aiAnalysis) &&
  proposal.aiAnalysis.analysisType === "STUDENT_PROPOSAL_ANALYSIS" &&
  proposal.aiAnalysis.inputSignature === getProposalInputSignature(proposal);

export const getProposalScoreLabel = (score: number): string =>
  score >= 90 ? "Outstanding" : score >= 80 ? "High Feasibility" : score >= 65 ? "Moderate Feasibility" : "Needs Improvement";
