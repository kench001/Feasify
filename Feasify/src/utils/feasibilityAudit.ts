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
      .replace(/\s*\(PLV\s*[\d\.\s-]+\)/gi, "")
      .replace(/\s*-\s*PLV\s*[\d\.\s-]+/gi, "")
      .replace(/\bPLV\s*[\d\.\s-]+\b/gi, "")
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
  let performanceStatus = "Pass (Feasible with Minor Risks)";
  let performanceRecommendation = "Mathematically sound and logical. Minor operational refinements recommended.";

  if (status === "NOT_FEASIBLE" || score < 70) {
    performanceGrade = "Unsatisfactory";
    performanceStatus = "Fail (Major Revisions Required)";
    performanceRecommendation = "Serious structural, operational, or financial defects detected. Review production costs, capital adequacy, and monthly expenses before defense.";
  } else if (status === "CONDITIONALLY_FEASIBLE" || (score >= 70 && score < 80)) {
    performanceGrade = "Conditional";
    performanceStatus = "Conditional Pass (Revision Required)";
    performanceRecommendation = "Revisions required for panel defense: review the highlighted warning flags (unrealistic profit margins, cash runway, or break-even target) before final defense sign-off.";
  } else if (score >= 90) {
    performanceGrade = "Outstanding";
    performanceStatus = "Pass (Highly Feasible)";
    performanceRecommendation = "Strong, well-designed study with realistic financial buffers and defensible margins. Ready for implementation.";
  } else {
    performanceGrade = "Satisfactory";
    performanceStatus = "Pass (Feasible with Minor Risks)";
    performanceRecommendation = "Mathematically sound and logical. Minor operational refinements recommended.";
  }

  return { performanceGrade, performanceStatus, performanceRecommendation };
};

// Normalizes business type string to category
export const normalizeCategory = (typeStr = ""): string => {
  const s = String(typeStr || "").toLowerCase();
  if (s.includes("food") || s.includes("beverage") || s.includes("restaurant") || s.includes("cafe") || s.includes("bakery") || s.includes("snack") || s.includes("kiosk") || s.includes("stall") || s.includes("dory") || s.includes("cabbage")) {
    return "Food & Beverage / Food Service";
  }
  if (s.includes("retail") || s.includes("store") || s.includes("shop") || s.includes("apparel") || s.includes("clothing") || s.includes("goods") || s.includes("merchandise")) {
    return "Retail & Consumer Goods";
  }
  if (s.includes("service") || s.includes("salon") || s.includes("repair") || s.includes("laundry") || s.includes("consult") || s.includes("logistics")) {
    return "Services & Personal Care";
  }
  if (s.includes("tech") || s.includes("software") || s.includes("digital") || s.includes("app") || s.includes("it ") || s.includes("platform")) {
    return "Technology & Digital Services";
  }
  if (s.includes("manufac") || s.includes("craft") || s.includes("product") || s.includes("assem") || s.includes("pack")) {
    return "Manufacturing & Production";
  }
  return "General Enterprise";
};

// Defense-grade multi-factor financial feasibility evaluation engine
export const evaluateDefenseFeasibility = (finData: any) => {
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
  const cashReserve =
    declaredCapital > 0
      ? Math.max(0, declaredCapital - equipmentTotal)
      : equipmentList.length > 0
      ? 0
      : declaredCapital;

  const capitalDeficit = equipmentList.length > 0 && declaredCapital > 0 && equipmentTotal > declaredCapital;

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
  const paybackPeriodStr = paybackPeriodMonths === Infinity ? "Infinity (Never)" : `${paybackPeriodMonths.toFixed(1)} months`;

  const unitGrossMargin = safeSellingPrice - safeVariableCost;
  const netMarginPct = monthlyRevenue > 0 ? (netMonthlyProfit / monthlyRevenue) * 100 : 0;
  const cashRunwayMonths = monthlyOpex > 0 ? (cashReserve / monthlyOpex) : (cashReserve > 0 ? 12 : 0);

  const unitContribution = Math.max(0, unitGrossMargin);
  const bepUnits = unitContribution > 0 ? Math.ceil((monthlyOpex + monthlyInterest) / unitContribution) : Infinity;
  const bepRatio = safeMonthlySales > 0 && bepUnits !== Infinity ? (bepUnits / safeMonthlySales) * 100 : Infinity;

  const category = normalizeCategory(finData?.businessType || finData?.category || "");

  let bounds = { primeMin: 12, primeMax: 28, fantasyCap: 38, vulnerableFloor: 8, label: "General Enterprise" };
  if (category.includes("Food")) {
    bounds = { primeMin: 12, primeMax: 22, fantasyCap: 30, vulnerableFloor: 10, label: "Food & Beverage / Food Service" };
  } else if (category.includes("Retail")) {
    bounds = { primeMin: 8, primeMax: 16, fantasyCap: 25, vulnerableFloor: 6, label: "Retail & Consumer Goods" };
  } else if (category.includes("Manufacturing")) {
    bounds = { primeMin: 15, primeMax: 25, fantasyCap: 35, vulnerableFloor: 10, label: "Manufacturing & Production" };
  } else if (category.includes("Service") || category.includes("Tech") || category.includes("Digital")) {
    bounds = { primeMin: 20, primeMax: 32, fantasyCap: 40, vulnerableFloor: 12, label: "Services & Tech" };
  }

  const fatalFlaws: string[] = [];
  if (unitGrossMargin <= 0) {
    fatalFlaws.push("Selling price is less than or equal to unit production cost (negative unit margin).");
  }
  if (netMonthlyProfit <= 0 || annualNetProfitAfterTax <= 0) {
    fatalFlaws.push("Business operates at a net cash loss per month after operating expenses.");
  }
  if (capitalDeficit) {
    fatalFlaws.push(`Equipment costs (₱${Math.round(equipmentTotal).toLocaleString()}) exceed declared capital (₱${Math.round(declaredCapital).toLocaleString()}), creating an immediate startup deficit.`);
  }
  if (paybackPeriodMonths > 48 || paybackPeriodMonths === Infinity) {
    fatalFlaws.push("Capital recovery period exceeds 4 years or is never recovered with current earnings.");
  }

  const severeFlags: { id: string; title: string; description: string; tip: string }[] = [];
  if (netMarginPct > bounds.fantasyCap) {
    severeFlags.push({
      id: "fantasy-margin",
      title: "Unrealistic High Net Profit Margin",
      description: `Your net profit margin of ${netMarginPct.toFixed(1)}% is an unrealistic outlier for ${category} (standard student capstone ceiling is ${bounds.fantasyCap}%). Please check if monthly rent, worker salaries, electricity, or taxes were missed.`,
      tip: `Check monthly OPEX: ensure you budgeted commercial stall rent, crew wages, electricity, and taxes so profit margins stay within realistic ${bounds.primeMin}%-${bounds.primeMax}% standards.`
    });
  } else if (netMarginPct > 0 && netMarginPct < bounds.vulnerableFloor) {
    severeFlags.push({
      id: "vulnerable-margin",
      title: "Fragile Profit Margin",
      description: `Your net profit margin of ${netMarginPct.toFixed(1)}% is below the ${bounds.vulnerableFloor}% safe cushion for ${category}. A minor rise in ingredient or supply costs will wipe out your profits.`,
      tip: "Increase selling price slightly or negotiate lower supplier costs to build a safer profit buffer."
    });
  }

  if (cashRunwayMonths < 1.0 && !capitalDeficit) {
    severeFlags.push({
      id: "low-runway",
      title: "Low Cash Buffer for Bills",
      description: `Your cash savings (₱${Math.round(cashReserve).toLocaleString()}) only cover ${cashRunwayMonths.toFixed(1)} months of monthly bills and rent. Allocate at least 1.5 to 2.0 months of cash reserve so you do not run out of money before sales stabilize.`,
      tip: "Increase declared startup capital to ensure at least 1.5 to 2.0 months of fixed operating overhead is kept as a cash buffer."
    });
  }

  if (bepRatio > 75 && bepUnits !== Infinity) {
    severeFlags.push({
      id: "high-bep",
      title: "High Break-Even Sales Pressure",
      description: `You must sell ${bepUnits.toLocaleString()} units (${bepRatio.toFixed(0)}% of your monthly goal) just to pay your bills. A slight 15% drop in sales will push the business into a loss.`,
      tip: "Lower fixed monthly bills or improve unit profit margin to reduce the number of sales needed to break even."
    });
  }

  if (paybackPeriodMonths > 0 && paybackPeriodMonths < 3.0) {
    severeFlags.push({
      id: "unrealistic-fast-payback",
      title: "Unrealistically Fast Payback Period",
      description: `An estimated payback period of ${paybackPeriodMonths.toFixed(1)} months is unusually fast for capital investments. Verify that startup equipment and pre-operating costs are fully budgeted.`,
      tip: "Double-check your equipment list and pre-operating costs to make sure all startup assets were budgeted."
    });
  } else if (paybackPeriodMonths > 36.0 && paybackPeriodMonths <= 48.0) {
    severeFlags.push({
      id: "slow-payback",
      title: "Slow Capital Payback",
      description: `Earning back your initial capital takes ${paybackPeriodMonths.toFixed(1)} months (over 3 years), which poses a high risk of tying up money for too long.`,
      tip: "Increase monthly sales volume or trim operating expenses to accelerate capital payback time."
    });
  }

  let status = "FEASIBLE";
  let score = 85;

  if (fatalFlaws.length > 0) {
    status = "NOT_FEASIBLE";
    if (unitGrossMargin <= 0) score = 15;
    else if (capitalDeficit) score = 35;
    else if (paybackPeriodMonths > 48) score = 50;
    else score = 30;
  } else if (severeFlags.length > 0) {
    status = "CONDITIONALLY_FEASIBLE";
    score = Math.min(78, Math.max(70, Math.round(76 - (severeFlags.length - 1) * 2)));
  } else {
    status = "FEASIBLE";
    let base = 84;
    if (netMarginPct >= bounds.primeMin && netMarginPct <= bounds.primeMax) base += 4;
    if (cashRunwayMonths >= 1.5) base += 3;
    if (bepRatio <= 60) base += 3;
    if (paybackPeriodMonths <= 24) base += 3;
    score = Math.min(98, Math.max(80, base));
  }

  let financialScore = 88;
  let riskScore = 90;
  let marketScore = 80;

  if (status === "NOT_FEASIBLE") {
    financialScore = Math.min(45, score + 10);
    riskScore = 30;
    marketScore = safeMonthlySales > 0 ? 60 : 40;
  } else if (status === "CONDITIONALLY_FEASIBLE") {
    financialScore = 75;
    riskScore = cashRunwayMonths < 1.0 ? 68 : 74;
    marketScore = 76;
  } else {
    financialScore = score >= 90 ? 94 : 88;
    riskScore = cashRunwayMonths >= 2.0 ? 94 : 88;
    marketScore = 85;
  }

  const { performanceGrade, performanceStatus, performanceRecommendation } = derivePerformanceGrade(score, status);

  return {
    category,
    prods,
    safeSellingPrice,
    safeVariableCost,
    unitGrossMargin,
    safeMonthlySales,
    monthlyRevenue,
    totalMonthlyVariableCosts,
    monthlyOpex,
    cashReserve,
    cashRunwayMonths,
    netMonthlyProfit,
    netMarginPct,
    annualRevenue,
    paybackPeriodMonths,
    paybackPeriodStr,
    bepUnits,
    bepRatio,
    bounds,
    fatalFlaws,
    severeFlags,
    status,
    score,
    performanceGrade,
    performanceStatus,
    performanceRecommendation,
    financialScore,
    riskScore,
    marketScore
  };
};

// Calculates client-side audited feasibility results (100% matched with backend defense engine)
export const calculateLocalAudit = (finData: any) => {
  const evalRes = evaluateDefenseFeasibility(finData);
  const {
    category,
    prods,
    safeSellingPrice,
    safeVariableCost,
    unitGrossMargin,
    safeMonthlySales,
    monthlyRevenue,
    monthlyOpex,
    cashReserve,
    cashRunwayMonths,
    netMonthlyProfit,
    netMarginPct,
    annualRevenue,
    paybackPeriodStr,
    paybackPeriodMonths,
    bepUnits,
    bepRatio,
    bounds,
    severeFlags,
    status,
    score,
    performanceGrade,
    performanceStatus,
    performanceRecommendation,
    financialScore,
    riskScore,
    marketScore
  } = evalRes;

  const marginTitle = prods.length > 1 ? "Blended Unit Margin" : "Unit Gross Margin";

  return {
    score,
    status,
    performanceGrade,
    performanceStatus,
    performanceRecommendation,
    metrics: { financial: financialScore, risk: riskScore, market: marketScore },
    explanations: {
      feasibility: `Feasibility Assessment: ${status === "FEASIBLE" ? "Feasible" : (status === "CONDITIONALLY_FEASIBLE" ? "Conditionally Feasible" : "Not Feasible")}. ${status === "FEASIBLE" ? "Business shows healthy positive net margins and stable operating profit." : (status === "CONDITIONALLY_FEASIBLE" ? "Business is profitable but has warning flags requiring revision before final defense presentation." : "Business shows negative margins or capital deficit - review costs.")}`,
      financial: `Average selling price of ₱${safeSellingPrice.toFixed(2)} produces ₱${Math.round(netMonthlyProfit).toLocaleString()} estimated monthly net profit (${netMarginPct.toFixed(1)}% margin). Projected sales of ${safeMonthlySales.toLocaleString()} units yield ₱${Math.round(monthlyRevenue).toLocaleString()} monthly revenue.`,
      risk: `Cash buffer of ₱${Math.round(cashReserve).toLocaleString()} covers ${cashRunwayMonths.toFixed(1)} months of monthly expenses (₱${Math.round(monthlyOpex).toLocaleString()}/month). Capital payback amortizes in ${paybackPeriodStr}.`,
      market: `Target monthly sales volume of ${safeMonthlySales.toLocaleString()} units produces annualized gross revenue of ₱${Math.round(annualRevenue).toLocaleString()}.`
    },
    insights: [
      {
        id: "local-0",
        type: status === "CONDITIONALLY_FEASIBLE" && netMarginPct > bounds.fantasyCap ? "warning" : (netMarginPct <= 0 ? "warning" : "positive"),
        title: "Profit Margin Status",
        description: netMarginPct > bounds.fantasyCap
          ? `Your net profit margin is ${netMarginPct.toFixed(1)}%. This is unusually high for ${category}. Check if commercial stall rent, employee wages, or utility bills were omitted.`
          : (netMarginPct <= 0
            ? `Your net margin is negative (${netMarginPct.toFixed(1)}%). Ongoing operations run at a monthly loss.`
            : `Your net profit margin is ${netMarginPct.toFixed(1)}%, which is healthy and realistic for a ${category} business.`)
      },
      {
        id: "local-1",
        type: cashRunwayMonths >= 1.5 ? "positive" : (cashRunwayMonths >= 1.0 ? "info" : "warning"),
        title: "Cash Runway Buffer",
        description: cashRunwayMonths >= 1.5
          ? `Your cash reserve (₱${Math.round(cashReserve).toLocaleString()}) covers ${cashRunwayMonths.toFixed(1)} months of monthly expenses, providing a safe operational buffer.`
          : `Your cash reserve (₱${Math.round(cashReserve).toLocaleString()}) covers only ${cashRunwayMonths.toFixed(1)} months of expenses. Allocate a larger cash buffer.`
      },
      {
        id: "local-2",
        type: bepRatio <= 65 ? "positive" : (bepRatio <= 80 ? "info" : "warning"),
        title: "Break-Even Target",
        description: bepUnits === Infinity
          ? "Break-even cannot be calculated due to zero or negative unit margins."
          : `You need to sell ${bepUnits.toLocaleString()} units each month (${bepRatio.toFixed(0)}% of your target) just to cover fixed monthly bills.`
      },
      {
        id: "local-3",
        type: paybackPeriodMonths <= 30 && paybackPeriodMonths >= 3 ? "positive" : (paybackPeriodMonths <= 36 ? "info" : "warning"),
        title: "Capital Payback Time",
        description: `Estimated investment payback takes ${paybackPeriodStr} based on annual net earnings after tax.`
      }
    ],
    improvementTips: {
      feasibility: status === "CONDITIONALLY_FEASIBLE"
        ? (severeFlags.length > 0 ? severeFlags.map(f => f.tip).join(" ") : "Refine cost projections and cash reserves.")
        : (status === "FEASIBLE" ? "Maintain pricing and monitor supplier costs to preserve positive operating net margins." : "Re-evaluate selling price, negotiate supplier variable costs, or reduce monthly overhead to achieve positive cash flow."),
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
    severeFlags: evalRes.severeFlags,
    fatalFlaws: evalRes.fatalFlaws,
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
