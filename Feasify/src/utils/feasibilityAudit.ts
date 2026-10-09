import { normalizeProposalProducts, computeProductMetrics } from "./productCosting";

export interface MarketPillarInsight {
  status: "positive" | "warning" | "info";
  badge: string;
  text: string;
}

export interface MarketAnalysisData {
  summary?: string;
  competitorInsight?: MarketPillarInsight;
  footTrafficInsight?: MarketPillarInsight;
  demographicInsight?: MarketPillarInsight;
}

// Helper to strip internal framework codes and arbitrary numeric scores
export const cleanUserFacingText = (data: any): any => {
  if (typeof data === "string") {
    return data
      .replace(/(?:Overall\s+)?Feasibility\s+Score:\s*\d+(?:\.\d+)?\/100\s*(?:\([^)]*\))?\.?\s*/gi, "")
      .replace(/\bScore:\s*\d+(?:\.\d+)?\/100\.?\s*/gi, "")
      .replace(/\b\d+\/100\s*\((?:NOT_)?FEASIBLE\)\.?\s*/gi, "")
      .replace(/\bthe\s+DF-\d+\s+gross\s+margin\s+test\b/gi, "the gross profit margin test")
      .replace(/\bDF-\d+\s+gross\s+margin\s+test\b/gi, "gross profit margin test")
      .replace(/\bthe\s+DF-\d+\s+margin\s+test\b/gi, "the gross margin test")
      .replace(/\bDF-\d+\s+margin\s+test\b/gi, "gross margin test")
      .replace(/\bpasses\s+(?:the\s+)?DF-\d+\s+test\b/gi, "maintains a positive gross profit margin")
      .replace(/\bfails\s+(?:the\s+)?DF-\d+\s+test\b/gi, "has a negative or zero gross profit margin")
      .replace(/\bpasses\s+DF-\d+\b/gi, "maintains positive gross profit")
      .replace(/\bfails\s+DF-\d+\b/gi, "has negative gross profit")
      .replace(/\bRule\s+DF-\d+[:\s]*/gi, "Gross Margin Rule: ")
      .replace(/\(DF-\d+\)/gi, "")
      .replace(/\bDF-\d+[:\s-]*/gi, "")
      .replace(/[—–-]\s*(?:similar to|based on|like|aligned with)?\s*(?:proven\s+|local\s+)?benchmarks?(?:\s+(?:such as|like))?\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy)(?:\s*(?:and|,|or)\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy))*\s*[—–-]/gi, " ")
      .replace(/(?:,\s*)?(?:similar to|based on|like|aligned with)\s*(?:proven\s+|local\s+)?benchmarks?(?:\s+(?:such as|like))?\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy)(?:\s*(?:and|,|or)\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy))*/gi, "")
      .replace(/(?:proven\s+|local\s+)?benchmarks?\s*(?:such as|like)\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy)(?:\s*(?:and|,|or)\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy))*/gi, "proven market standards")
      .replace(/\b(?:Mr\.?\s*Cabbage(?:\s*\(Brassica Foods\))?|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy)\b/gi, "market standards")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.])/g, "$1")
      .trim();
  }
  if (Array.isArray(data)) {
    return data.map(cleanUserFacingText);
  }
  if (data && typeof data === "object") {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      cleaned[key] = cleanUserFacingText(data[key]);
    }
    return cleaned;
  }
  return data;
};

// Derives standard grade, performance status, and recommendation based on score and status
export const derivePerformanceGrade = (score: number, status?: string) => {
  let performanceGrade = "Satisfactory";
  let performanceStatus = "PASS (Feasible with Risks)";
  let performanceRecommendation = "Mathematically sound and logical. Minor adjustments recommended.";

  if (score >= 90) {
    performanceGrade = "Outstanding";
    performanceStatus = "PASS (Highly Feasible)";
    performanceRecommendation = "Strong, well-designed study with realistic financial buffers. Ready for execution.";
  } else if (score >= 75) {
    performanceGrade = "Satisfactory";
    performanceStatus = "PASS (Feasible with Risks)";
    performanceRecommendation = "Mathematically sound and logical. Minor adjustments (such as increasing working capital or refining marketing) recommended.";
  } else if (score >= 70) {
    performanceGrade = "Conditional";
    performanceStatus = "CONDITIONAL PASS";
    performanceRecommendation = "Requires major revisions to either the operational or financial section before receiving a passing grade.";
  } else {
    performanceGrade = "Unsatisfactory";
    performanceStatus = "FAIL";
    performanceRecommendation = "Serious structural, operational, or financial issues requiring a complete rewrite or concept pivot.";
  }

  return { performanceGrade, performanceStatus, performanceRecommendation };
};

// Calculates client-side audited feasibility results (100% matched with AI_Analysis.tsx)
export const calculateLocalAudit = (finData: any) => {
  const prods = (finData?.products && Array.isArray(finData.products) && finData.products.length > 0)
    ? normalizeProposalProducts(finData)
    : (finData?.monthlyRecords && finData.monthlyRecords[0]?.financials?.products
      ? normalizeProposalProducts(finData.monthlyRecords[0].financials)
      : []);

  let monthlyRevenue = 0;
  let totalMonthlyVariableCosts = 0;
  let safeMonthlySales = 0;
  let safeSellingPrice = 0;
  let safeVariableCost = 0;

  if (prods.length > 1) {
    monthlyRevenue = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).revenue, 0);
    totalMonthlyVariableCosts = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).cogsSold, 0);
    safeMonthlySales = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).unitsSold, 0);
    safeSellingPrice = safeMonthlySales > 0 ? monthlyRevenue / safeMonthlySales : 0;
    safeVariableCost = safeMonthlySales > 0 ? totalMonthlyVariableCosts / safeMonthlySales : 0;
  } else if (prods.length === 1) {
    const m = computeProductMetrics(prods[0]);
    monthlyRevenue = m.revenue;
    totalMonthlyVariableCosts = m.cogsSold;
    safeMonthlySales = m.unitsSold;
    safeSellingPrice = m.netSellingPrice > 0 ? m.netSellingPrice : (m.sellingPrice > 0 ? m.sellingPrice : (Number(finData?.sellingPrice) || 0));
    safeVariableCost = m.unitCost > 0 ? m.unitCost : (Number(finData?.variableCost) || 0);
  } else {
    safeSellingPrice = Number(finData?.sellingPrice) || 0;
    safeVariableCost = Number(finData?.variableCost) || 0;
    safeMonthlySales = Number(finData?.monthlySales) || 0;
    monthlyRevenue = safeSellingPrice * safeMonthlySales;
    totalMonthlyVariableCosts = safeVariableCost * safeMonthlySales;
  }

  const safeOperatingDays = Number(finData?.operatingDays) || 300;
  const isCapitalBorrowed = Boolean(finData?.isCapitalBorrowed);
  const interestRate = Number(finData?.interestRate) || 0;

  const equipmentList = finData?.equipmentList || [];
  const equipmentTotal = equipmentList.reduce(
    (sum: number, item: any) => sum + (Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0),
    0
  );

  const contribSum =
    Array.isArray(finData?.contributorsList) && finData.contributorsList.length > 0
      ? finData.contributorsList.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0)
      : 0;

  const declaredCapital =
    contribSum > 0
      ? contribSum
      : Number(finData?.cashInvested) ||
        Number(finData?.startupCapital) ||
        Number(finData?.totalCapital) ||
        Number(finData?.proposalCapital) ||
        0;

  const safeStartupCapital = equipmentTotal > 0 ? equipmentTotal : declaredCapital;

  const opexList = finData?.opexList || [];
  const monthlyOpex = opexList.length > 0
    ? opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
    : (Number(finData?.fixedCosts) || 0);

  const monthlyInterest = isCapitalBorrowed ? (safeStartupCapital * (interestRate / 100)) / 12 : 0;
  const netMonthlyProfit = monthlyRevenue - totalMonthlyVariableCosts - monthlyOpex - monthlyInterest;

  const annualRevenue = (monthlyRevenue / 30) * safeOperatingDays;
  const annualExpenses = ((totalMonthlyVariableCosts + monthlyOpex + monthlyInterest) / 30) * safeOperatingDays;
  const annualNetProfitPreTax = annualRevenue - annualExpenses;
  const percentageTax = annualRevenue > 0 ? annualRevenue * 0.03 : 0;
  const annualNetProfitAfterTax = (annualNetProfitPreTax > 0 ? annualNetProfitPreTax : 0) - percentageTax;

  const paybackBase = declaredCapital > 0 ? declaredCapital : safeStartupCapital;
  const paybackPeriodMonths = annualNetProfitAfterTax > 0
    ? (paybackBase / (annualNetProfitAfterTax / 12))
    : Infinity;
  const paybackPeriodStr = paybackPeriodMonths === Infinity ? "Never (Negative Cash Flow)" : `${paybackPeriodMonths.toFixed(1)} months`;

  let status = "FEASIBLE";
  let score = 85;

  if (safeSellingPrice - safeVariableCost <= 0) {
    status = "NOT_FEASIBLE";
    score = 15;
  } else if (netMonthlyProfit <= 0 || annualNetProfitAfterTax <= 0) {
    status = "NOT_FEASIBLE";
    score = 30;
  } else {
    const marginRatio = netMonthlyProfit / (monthlyOpex || 1);
    status = "FEASIBLE";
    score = Math.min(100, Math.max(70, Math.round(75 + Math.min(25, marginRatio * 2))));
  }

  const financialScore = status === "NOT_FEASIBLE" ? Math.min(45, score + 10) : 88;
  const riskScore = status === "NOT_FEASIBLE" ? 30 : 90;
  const marketScore = safeMonthlySales > 0 ? 80 : 50;

  const { performanceGrade, performanceStatus, performanceRecommendation } = derivePerformanceGrade(score, status);

  const unitGrossMargin = safeSellingPrice - safeVariableCost;
  const marginTitle = prods.length > 1 ? "Blended Unit Margin" : "Unit Gross Margin";

  return {
    score,
    status,
    performanceGrade,
    performanceStatus,
    performanceRecommendation,
    metrics: { financial: financialScore, risk: riskScore, market: marketScore },
    explanations: {
      feasibility: `Feasibility Assessment: ${status === "FEASIBLE" ? "Feasible" : "Not Feasible"}. ${marginTitle} is ₱${unitGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per unit with estimated monthly net profit of ₱${Math.round(netMonthlyProfit).toLocaleString()}. Estimated payback period is ${paybackPeriodStr}.`,
      financial: `Gross margin is ${safeSellingPrice > 0 ? Math.round((unitGrossMargin / safeSellingPrice) * 100) : 0}%. Projected monthly sales of ${safeMonthlySales.toLocaleString()} units produce ₱${Math.round(monthlyRevenue).toLocaleString()} gross monthly revenue across ${prods.length > 1 ? `${prods.length} products` : "product line"}.`,
      risk: status === "FEASIBLE"
        ? `Capital recovery amortizes in ${paybackPeriodStr}. Operating overhead of ₱${Math.round(monthlyOpex).toLocaleString()}/month is covered by contribution margin.`
        : `Deficit cash flow detected: ongoing operations yield negative net margins, creating liquidity risk.`,
      market: `Target monthly volume of ${safeMonthlySales.toLocaleString()} units produces annualized gross revenue of ₱${Math.round(annualRevenue).toLocaleString()} across ${safeOperatingDays} operating days.`
    },
    insights: [
      {
        id: "local-0",
        type: unitGrossMargin > 0 ? "positive" : "warning",
        title: marginTitle,
        description: unitGrossMargin > 0
          ? `Positive Gross Margin: Average selling price (₱${safeSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) exceeds unit variable cost (₱${safeVariableCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) by ₱${unitGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per unit.`
          : `Negative Unit Margin: Selling price (₱${safeSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) is less than or equal to unit variable cost (₱${safeVariableCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Direct production costs exceed selling price.`
      },
      {
        id: "local-1",
        type: netMonthlyProfit > 0 ? "positive" : "warning",
        title: "Operating Cash Flow",
        description: netMonthlyProfit > 0
          ? `Positive monthly operating profit of ₱${Math.round(netMonthlyProfit).toLocaleString()} after covering OPEX and financing obligations.`
          : `Negative monthly net margin of ₱${Math.round(netMonthlyProfit).toLocaleString()}/month. Re-evaluate pricing or overhead.`
      },
      {
        id: "local-2",
        type: paybackPeriodMonths !== Infinity && paybackPeriodMonths <= 36 ? "positive" : "info",
        title: "Capital Payback Duration",
        description: `Estimated investment payback period is ${paybackPeriodStr}.`
      }
    ],
    improvementTips: {
      feasibility: status === "FEASIBLE"
        ? "Maintain product pricing and monitor supplier costs to preserve positive operating net margins."
        : "Re-evaluate selling price, negotiate supplier variable costs, or reduce monthly overhead to achieve positive cash flow.",
      financial: [
        unitGrossMargin <= 0
          ? "Increase unit selling price or negotiate bulk supplier rates to achieve positive contribution margins."
          : "Audit recurring utility and overhead expenses to protect operating net margins."
      ],
      operations: [
        "Validate equipment quotation list to avoid unexpected initial capital expansion."
      ],
      marketing: [
        "Focus marketing on core demographic segments to reliably meet targeted monthly sales volume."
      ]
    },
    aiScores: { financial: financialScore, operational: riskScore, market: marketScore },
    aiScoreExplanations: {
      financial: `Evaluates unit contribution margins, OPEX coverage, and net profit.`,
      operational: `Evaluates startup capital requirements and fixed cost commitments.`,
      market: `Evaluates monthly volume and sales revenue capacity.`
    },
    marketAnalysis: (() => {
      const directCount = Array.isArray(finData?.directCompetitors) ? finData.directCompetitors.length : 0;
      const indirectCount = Array.isArray(finData?.otherCompetitors) ? finData.otherCompetitors.length : 0;
      const nearbyCount = Array.isArray(finData?.nearbyEstablishments) ? finData.nearbyEstablishments.length : 0;
      const demos = Array.isArray(finData?.targetDemographics) && finData.targetDemographics.length > 0
        ? finData.targetDemographics.join(", ")
        : "local residents and commuters";

      return {
        summary: directCount <= 2 && nearbyCount > 0
          ? "The location demonstrates positive market viability with low direct competition and strong nearby foot traffic anchors."
          : (nearbyCount === 0
            ? "Direct competitor count is manageable, but the location lacks anchor establishments, meaning customer walk-ins will depend heavily on local promotions."
            : "The area has an active commercial presence with established competitors; sustainable sales will require distinct product value or competitive pricing."),
        competitorInsight: {
          status: directCount <= 2 ? "positive" : "warning",
          badge: directCount === 0 ? "Zero Direct Competition" : (directCount <= 2 ? "Manageable Competition" : "Competitive Density"),
          text: directCount <= 2
            ? `${directCount} direct competitor(s) and ${indirectCount} indirect competitor(s) listed. Low saturation gives your business ample room to capture local market share.`
            : `${directCount} direct competitor(s) listed in the immediate vicinity. You will need clear menu differentiation or pricing advantage to prevent customer loss.`
        },
        footTrafficInsight: {
          status: nearbyCount > 0 ? "positive" : "warning",
          badge: nearbyCount > 0 ? "Anchor Foot Traffic Present" : "Customer Acquisition Risk",
          text: nearbyCount > 0
            ? `${nearbyCount} nearby establishment(s) listed. These anchors generate consistent daily foot traffic, reducing reliance on expensive marketing.`
            : "No nearby anchor establishments listed. Without natural walk-in foot traffic, expect higher customer acquisition costs through social media or flyers."
        },
        demographicInsight: {
          status: "positive",
          badge: "Demographic Strategy",
          text: `Focus your promotions on ${demos}. Keeping entry-level prices accessible and offering value combos encourages steady repeat purchases.`
        }
      } as MarketAnalysisData;
    })(),
    _fallback: true
  };
};

export const generateProFormaData = (financials: any, revenueGrowthRate = 10, costGrowthRate = 5) => {
  const yearlyRevenue: number[] = [];
  const yearlyCOGS: number[] = [];
  const yearlyFixedCosts: number[] = [];
  const yearlyNetProfit: number[] = [];
  const yearLabels: string[] = [];

  const prods = (financials?.products && Array.isArray(financials.products) && financials.products.length > 0)
    ? normalizeProposalProducts(financials)
    : [];

  let monthlyRevenue = 0;
  let totalMonthlyVariableCosts = 0;

  if (prods.length > 1) {
    monthlyRevenue = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).revenue, 0);
    totalMonthlyVariableCosts = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).cogsSold, 0);
  } else if (prods.length === 1) {
    const m = computeProductMetrics(prods[0]);
    monthlyRevenue = m.revenue;
    totalMonthlyVariableCosts = m.cogsSold;
  } else {
    const safeSellingPrice = Number(financials?.sellingPrice) || 0;
    const safeMonthlySales = Number(financials?.monthlySales) || 0;
    const safeVariableCost = Number(financials?.variableCost) || 0;
    monthlyRevenue = safeSellingPrice * safeMonthlySales;
    totalMonthlyVariableCosts = safeVariableCost * safeMonthlySales;
  }

  const safeFixedCosts = financials?.opexList && financials.opexList.length > 0
    ? financials.opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
    : (Number(financials?.fixedCosts) || 0);

  const safeOperatingDays = Number(financials?.operatingDays) || 300;

  const calculatedStartupCapital = financials?.equipmentList && financials.equipmentList.length > 0
    ? financials.equipmentList.reduce((sum: any, item: any) => sum + (Number(item.total) || 0), 0)
    : (Number(financials?.startupCapital) || 0);

  const monthlyInterest = financials?.isCapitalBorrowed ? (calculatedStartupCapital * (Number(financials?.interestRate || 0) / 100)) / 12 : 0;

  const currentAnnualRevenue = (monthlyRevenue / 30) * safeOperatingDays;
  const currentAnnualCOGS = (totalMonthlyVariableCosts / 30) * safeOperatingDays;
  const currentAnnualFixedCosts = ((safeFixedCosts + monthlyInterest) / 30) * safeOperatingDays;

  for (let year = 1; year <= 5; year++) {
    const revenueMultiplier = Math.pow(1 + revenueGrowthRate / 100, year - 1);
    const costMultiplier = Math.pow(1 + costGrowthRate / 100, year - 1);

    const projectedRevenue = currentAnnualRevenue * revenueMultiplier;
    const projectedCOGS = currentAnnualCOGS * costMultiplier;
    const projectedFixedCosts = currentAnnualFixedCosts * costMultiplier;
    const percentageTax = projectedRevenue > 0 ? projectedRevenue * 0.03 : 0;

    const projectedNetProfit = projectedRevenue - projectedCOGS - projectedFixedCosts - percentageTax;

    yearlyRevenue.push(Math.round(projectedRevenue));
    yearlyCOGS.push(Math.round(projectedCOGS));
    yearlyFixedCosts.push(Math.round(projectedFixedCosts));
    yearlyNetProfit.push(Math.round(projectedNetProfit));
    yearLabels.push(`Year ${year}`);
  }

  return {
    yearLabels,
    yearlyRevenue,
    yearlyCOGS,
    yearlyFixedCosts,
    yearlyNetProfit,
  };
};
