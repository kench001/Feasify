import {
  cleanUserFacingText,
  calculateLocalAudit,
  evaluateDefenseFeasibility,
  generateProFormaData,
  type MarketAnalysisData,
  type MarketPillarInsight,
} from "./feasibilityAudit";
import {
  normalizeProposalProducts,
  computeProductMetrics,
  type EquipmentItem,
  type OpexItem,
  type ProductCostingItem,
  type ContributorItem,
} from "./productCosting";

export type FeasibilityVerdictStatus =
  | "FEASIBLE"
  | "CONDITIONALLY_FEASIBLE"
  | "NOT_FEASIBLE"
  | "MODERATE"
  | "PENDING";

export type InsightType = "positive" | "warning" | "info" | "suggestion";

export interface NormalizedInsightItem {
  id: string;
  title: string;
  description: string;
  type: InsightType;
}

export interface SevereFlagItem {
  id: string;
  title: string;
  description: string;
  tip: string;
}

export interface ExtractFinancialDataOptions {
  /** Optional month index override (e.g. Adviser viewing a historical/non-active month). */
  monthIndex?: number;
  /** Optional draft ID override (e.g. Adviser switching scenario drafts). */
  draftId?: string;
}

export interface ProposalMonthDraftContext {
  rawFinancialData: Record<string, any>;
  monthlyRecords: any[] | null;
  monthIndex: number;
  monthNumber: number;
  monthRecord: any | null;
  drafts: any[] | null;
  draftId: string;
  draftName: string;
  draftRecord: any | null;
  activeMonthIndexInProject: number;
  activeDraftIdInMonth: string;
  activeMonthFin: Record<string, any>;
  financialUpdatedAtMs: number;
  draftUpdatedAtMs: number;
}

export interface ExtractedFinancialData {
  products: ProductCostingItem[];
  sellingPrice: number;
  monthlySales: number;
  variableCost: number;
  fixedCosts: number;
  startupCapital: number;
  cashInvested: string;
  contributorsList: ContributorItem[];
  totalCapital: number;
  proposalCapital: number;
  equipmentList: EquipmentItem[];
  opexList: OpexItem[];
  operatingDays: number;
  isCapitalBorrowed: boolean;
  interestRate: number;
  competitorCount: number;
  marketDemand: string;
  directCompetitors: string[];
  otherCompetitors: string[];
  competitorNotes: string;
  nearbyEstablishments: string[];
  targetDemographics: string[];
  footTrafficPeak: string;
  marketDemandNotes: string;
  businessName: string;
  businessType: string;
  [key: string]: any;
}

export interface AnalysisStalenessResult {
  hasStoredAnalysis: boolean;
  isProposalStageOnly: boolean;
  isTimestampStale: boolean;
  isDifferentMonthOrDraft: boolean;
  isSignatureMismatch: boolean;
  isMetricsMismatch: boolean;
  hasNewerInputs: boolean;
  reason: string | null;
  inputSignature: string;
  financialUpdatedAtMs: number;
  aiLastRunMs: number;
}

export interface ResolvedAIAnalysisData {
  score: number;
  status: FeasibilityVerdictStatus;
  performanceGrade: string;
  performanceStatus: string;
  performanceRecommendation: string;
  metrics: {
    feasibility: number;
    financial: number;
    risk: number;
    market: number;
  };
  aiScores: {
    financial: number;
    operational: number;
    market: number;
  };
  explanations: {
    feasibility: string;
    financial: string;
    risk: string;
    market: string;
  };
  insights: NormalizedInsightItem[];
  improvementTips: {
    feasibility: string;
    financial: string[];
    operations: string[];
    marketing: string[];
  };
  aiScoreExplanations: {
    financial: string;
    operational: string;
    market: string;
  };
  marketAnalysis: MarketAnalysisData;
  severeFlags: SevereFlagItem[];
  fatalFlaws: string[];
  bepRevenue: number;
  bepRevenueStr: string;
  bepRevenueRatio: number;
  cmr: number;
  isBmbeQualified: boolean;
  taxTypeLabel: string;
  lastRun: string | null;
  _fallback: boolean;
  _model?: string;
  _fallbackReason?: string;
  inputSignature: string;
  analyzedMonthIndex?: number;
  analyzedDraftId?: string;
}

export interface ResolveSyncedAIAnalysisOptions extends ExtractFinancialDataOptions {
  /**
   * When true (default, recommended for Adviser view), stale or mismatched stored AI data
   * is replaced with live audit calculations so displayed metrics, verdict, flags, and insights
   * stay 100% synchronized with the selected financial inputs.
   * When false, valid stored financial AI commentary is preserved alongside `staleness` flags.
   */
  preferLiveOnStale?: boolean;
}

export interface SyncedAIAnalysisResult {
  aiData: ResolvedAIAnalysisData;
  effectiveFin: ExtractedFinancialData;
  context: ProposalMonthDraftContext;
  liveEval: ReturnType<typeof evaluateDefenseFeasibility>;
  liveAudit: ReturnType<typeof calculateLocalAudit>;
  staleness: AnalysisStalenessResult;
  source: "stored-ai" | "stored-fallback" | "live-audit";
  isFallback: boolean;
  isStale: boolean;
  /** Qualitative proposal-stage extras (only exposed if synced & non-proposal-only). */
  qualitativeExtras: {
    strengths: string[];
    weaknesses: string[];
    realityCheck: string;
    recommendations: string[];
    draftFeedback: string;
  } | null;
}

export interface ProFormaSeriesConfigItem {
  key: "Revenue" | "COGS" | "Fixed Costs" | "Net Profit";
  label: string;
  shortLabel: string;
  color: string;
  lightBg: string;
  borderActive: string;
  textActive: string;
  type: "bar" | "line";
  strokeDasharray?: string;
}

export interface ProFormaChartPoint {
  year: string;
  Revenue: number;
  COGS: number;
  "Fixed Costs": number;
  "Fixed Cost"?: number;
  "Net Profit": number;
  netMarginPct: number;
}

export interface ProFormaSummary {
  year1Revenue: number;
  year5Revenue: number;
  revenueIncrease: number;
  year1NetProfit: number;
  year5NetProfit: number;
  netProfitChange: number;
  cumulativeRevenue: number;
  cumulativeCOGS: number;
  cumulativeFixedCosts: number;
  cumulativeNetProfit: number;
  year1NetMarginPct: number;
  year5NetMarginPct: number;
  isNetProfitGrowing: boolean;
  revenueGrowthRate: number;
  costGrowthRate: number;
}

export interface ProFormaProjectionResult {
  raw: ReturnType<typeof generateProFormaData>;
  chartData: ProFormaChartPoint[];
  summary: ProFormaSummary;
  insights: string[];
}

export interface ProposalFeasibilityClassification {
  aiStatus: FeasibilityVerdictStatus;
  aiScore: number | null;
  sentiment: "positive" | "negative" | "pending";
  isConditional: boolean;
  source: "financial-audit" | "stored-ai" | "pending";
}

export type ProposalDisplayStatusLabel =
  | "Active Business"
  | "Approved Proposal"
  | "In Revision"
  | "Rejected Proposal"
  | "Pending Review"
  | "Draft";

export interface ProposalDisplayStatusInfo {
  label: ProposalDisplayStatusLabel;
  rawStatus: string;
}

export const DEFAULT_PRO_FORMA_REVENUE_GROWTH = 15;
export const DEFAULT_PRO_FORMA_COST_GROWTH = 8;

export const PRO_FORMA_SERIES_CONFIG: ProFormaSeriesConfigItem[] = [
  {
    key: "Revenue",
    label: "Gross Revenue",
    shortLabel: "Revenue",
    color: "#059669",
    lightBg: "bg-emerald-50",
    borderActive: "border-emerald-500",
    textActive: "text-emerald-700",
    type: "bar",
  },
  {
    key: "COGS",
    label: "Cost of Goods Sold (COGS)",
    shortLabel: "COGS",
    color: "#e11d48",
    lightBg: "bg-rose-50",
    borderActive: "border-rose-500",
    textActive: "text-rose-700",
    type: "bar",
  },
  {
    key: "Fixed Costs",
    label: "Operating / Fixed Costs",
    shortLabel: "Fixed Costs",
    color: "#d97706",
    lightBg: "bg-amber-50",
    borderActive: "border-amber-500",
    textActive: "text-amber-700",
    type: "bar",
  },
  {
    key: "Net Profit",
    label: "Net Income / Profit",
    shortLabel: "Net Profit",
    color: "#2563eb",
    lightBg: "bg-blue-50",
    borderActive: "border-blue-500",
    textActive: "text-blue-700",
    type: "line",
    strokeDasharray: "5 5",
  },
];

/** Converts Firestore Timestamps, ISO strings, Dates, or epoch numbers into epoch milliseconds (0 if invalid). */
export const toEpochMs = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : 0;
  if (typeof ts?.toDate === "function") {
    const d = ts.toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }
  if (typeof ts?.seconds === "number") {
    return ts.seconds * 1000 + Math.floor((Number(ts.nanoseconds) || 0) / 1e6);
  }
  const parsed = new Date(ts).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeInsightType = (type: any): InsightType => {
  if (type === "positive" || type === "warning" || type === "info" || type === "suggestion") {
    return type;
  }
  return "info";
};

const normalizeStatus = (status: any): FeasibilityVerdictStatus => {
  if (
    status === "FEASIBLE" ||
    status === "CONDITIONALLY_FEASIBLE" ||
    status === "NOT_FEASIBLE" ||
    status === "MODERATE" ||
    status === "PENDING"
  ) {
    return status;
  }
  return "PENDING";
};

const pickFirstNonEmptyArray = (...candidates: any[]): any[] => {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
};

const coerceText = (val: any, fallback = ""): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return String(cleanUserFacingText(val));
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object" && !Array.isArray(val)) {
    const title = typeof val.title === "string" ? val.title.trim() : "";
    const desc = typeof val.description === "string" ? val.description.trim() : "";
    const text = typeof val.text === "string" ? val.text.trim() : "";
    if (title && desc) return String(cleanUserFacingText(`${title}: ${desc}`));
    if (desc || title || text) return String(cleanUserFacingText(desc || title || text));
  }
  return fallback;
};

const coerceTextArray = (items: any, fallback: string[] = []): string[] => {
  if (!Array.isArray(items)) return fallback;
  return items.map((item) => coerceText(item)).filter(Boolean);
};

const coerceNumber = (val: any, fallback: number): number => {
  if (val === null || val === undefined || val === "") return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
};

const coerceSevereFlags = (flags: any, fallback: SevereFlagItem[] = []): SevereFlagItem[] => {
  if (!Array.isArray(flags)) return fallback;
  return flags
    .filter((f): f is Record<string, any> => Boolean(f && typeof f === "object" && !Array.isArray(f)))
    .map((f, idx) => ({
      id: coerceText(f.id, `flag-${idx}`) || `flag-${idx}`,
      title: coerceText(f.title, "Financial Warning") || "Financial Warning",
      description: coerceText(f.description),
      tip: coerceText(f.tip),
    }))
    .filter((f) => Boolean(f.title || f.description));
};

const coerceMarketPillar = (
  pillar: any,
  fallback?: MarketPillarInsight
): MarketPillarInsight | undefined => {
  if (!pillar || typeof pillar !== "object" || Array.isArray(pillar)) return fallback;
  const status: MarketPillarInsight["status"] =
    pillar.status === "positive" || pillar.status === "warning" || pillar.status === "info"
      ? pillar.status
      : fallback?.status || "info";
  const badge = coerceText(pillar.badge, fallback?.badge || "");
  const text = coerceText(pillar.text, fallback?.text || "");
  if (!badge && !text) return fallback;
  return { status, badge, text };
};

/**
 * Resolves the active (or explicitly selected) month record and scenario draft from a proposal.
 * Matches `Financial_input.tsx` and `AdviserDashboard.tsx` by defaulting to the latest month
 * (`monthlyRecords.length - 1`) when `activeMonthIndex` is unset.
 */
export const resolveProposalMonthAndDraft = (
  proj: any,
  options?: ExtractFinancialDataOptions
): ProposalMonthDraftContext => {
  const finData =
    proj?.financialData ||
    proj?.originalProposalFinancials ||
    (proj &&
    (Array.isArray(proj.monthlyRecords) ||
      Array.isArray(proj.products) ||
      proj.sellingPrice !== undefined ||
      proj.monthlySales !== undefined ||
      proj.fixedCosts !== undefined)
      ? proj
      : {}) ||
    {};
  const monthlyRecords =
    Array.isArray(finData.monthlyRecords) && finData.monthlyRecords.length > 0
      ? finData.monthlyRecords
      : null;

  const activeMonthIndexInProject = monthlyRecords
    ? typeof finData.activeMonthIndex === "number" &&
      finData.activeMonthIndex >= 0 &&
      finData.activeMonthIndex < monthlyRecords.length
      ? finData.activeMonthIndex
      : Math.max(0, monthlyRecords.length - 1)
    : 0;

  const monthIndex = monthlyRecords
    ? options?.monthIndex !== undefined && Number.isFinite(options.monthIndex)
      ? Math.min(Math.max(0, Math.floor(options.monthIndex)), monthlyRecords.length - 1)
      : activeMonthIndexInProject
    : 0;

  const monthRecord = monthlyRecords ? monthlyRecords[monthIndex] : null;
  const monthNumber = Number(monthRecord?.month) || monthIndex + 1;

  const drafts =
    monthRecord?.drafts && Array.isArray(monthRecord.drafts) && monthRecord.drafts.length > 0
      ? monthRecord.drafts
      : null;

  const activeDraftIdInMonth = monthRecord?.activeDraftId || drafts?.[0]?.id || "draft-1";
  const targetDraftId = options?.draftId || activeDraftIdInMonth;
  const draftRecord = drafts
    ? drafts.find((d: any) => d.id === targetDraftId) || drafts[0]
    : null;

  const activeMonthFin = draftRecord?.financials || monthRecord?.financials || finData;

  return {
    rawFinancialData: finData,
    monthlyRecords,
    monthIndex,
    monthNumber,
    monthRecord,
    drafts,
    draftId: draftRecord?.id || targetDraftId || "",
    draftName: draftRecord?.name || "",
    draftRecord,
    activeMonthIndexInProject,
    activeDraftIdInMonth,
    activeMonthFin,
    financialUpdatedAtMs: toEpochMs(finData?.updatedAt),
    draftUpdatedAtMs: toEpochMs(draftRecord?.updatedAt),
  };
};

/**
 * Extracts normalized `FinancialData` for a proposal, supporting multi-month records & scenario drafts.
 * When `monthlyRecords` exist, isolates the selected month/draft's own financials so empty or historical
 * drafts do not inherit top-level `finData` values from another month; only falls back to top-level
 * `finData` when no `monthlyRecords` exist.
 */
export const extractActiveFinancialData = (
  proj: any,
  options?: ExtractFinancialDataOptions
): ExtractedFinancialData => {
  const ctx = resolveProposalMonthAndDraft(proj, options);
  const finData = ctx.rawFinancialData;
  const activeMonthFin = ctx.activeMonthFin;
  const hasMonthlyScope = Boolean(ctx.monthRecord || ctx.draftRecord);

  // Strip monthlyRecords/activeMonthIndex from spread base so downstream helpers evaluate
  // only the already-selected month/draft rather than re-resolving raw monthlyRecords.
  const rawSpreadSource = hasMonthlyScope ? activeMonthFin : { ...finData, ...activeMonthFin };
  const {
    monthlyRecords: _omittedMonthlyRecords,
    activeMonthIndex: _omittedActiveMonthIndex,
    ...scopedFinBase
  } = rawSpreadSource || {};

  const contribList = hasMonthlyScope
    ? Array.isArray(activeMonthFin.contributorsList)
      ? activeMonthFin.contributorsList
      : []
    : pickFirstNonEmptyArray(activeMonthFin.contributorsList, finData.contributorsList);
  const contribSum = contribList.reduce(
    (sum: number, c: any) => sum + Math.max(0, Number(c?.amount) || 0),
    0
  );

  const proposalCap = Math.max(
    0,
    Number(proj?.proposalCapital || proj?.totalCapital || finData.startupCapital || 0)
  );
  const resolvedCapital =
    contribSum > 0
      ? contribSum
      : Math.max(
          0,
          hasMonthlyScope
            ? Number(activeMonthFin.cashInvested) ||
                Number(activeMonthFin.startupCapital) ||
                proposalCap ||
                0
            : Number(activeMonthFin.cashInvested) ||
                Number(activeMonthFin.startupCapital) ||
                Number(finData.startupCapital) ||
                proposalCap ||
                0
        );

  const equipmentList = hasMonthlyScope
    ? Array.isArray(activeMonthFin.equipmentList)
      ? activeMonthFin.equipmentList
      : []
    : Array.isArray(activeMonthFin.equipmentList)
      ? activeMonthFin.equipmentList
      : Array.isArray(finData.equipmentList)
        ? finData.equipmentList
        : [];

  const opexList = hasMonthlyScope
    ? Array.isArray(activeMonthFin.opexList)
      ? activeMonthFin.opexList
      : []
    : Array.isArray(activeMonthFin.opexList)
      ? activeMonthFin.opexList
      : Array.isArray(finData.opexList)
        ? finData.opexList
        : [];

  const fixedCosts =
    opexList.length > 0
      ? opexList.reduce((sum: number, item: any) => sum + Math.max(0, Number(item?.amount) || 0), 0)
      : Math.max(
          0,
          hasMonthlyScope
            ? Number(activeMonthFin.fixedCosts) || 0
            : Number(activeMonthFin.fixedCosts) || Number(finData.fixedCosts) || 0
        );

  const products = hasMonthlyScope
    ? Array.isArray(activeMonthFin.products)
      ? activeMonthFin.products
      : []
    : pickFirstNonEmptyArray(
        activeMonthFin.products,
        finData.products,
        proj?.products,
        proj?.rawProposalData?.products,
        proj?.originalProposalFinancials?.products
      );

  // Derive scalar unit metrics from the scoped products when available
  let productSellingPrice = 0;
  let productMonthlySales = 0;
  let productVariableCost = 0;
  if (products.length > 0) {
    const normalized = normalizeProposalProducts({ ...scopedFinBase, products });
    if (normalized.length > 1) {
      const totalRev = normalized.reduce((s, p) => s + computeProductMetrics(p).revenue, 0);
      const totalCogs = normalized.reduce((s, p) => s + computeProductMetrics(p).cogsSold, 0);
      const totalUnits = normalized.reduce((s, p) => s + computeProductMetrics(p).unitsSold, 0);
      productMonthlySales = totalUnits;
      productSellingPrice = totalUnits > 0 ? totalRev / totalUnits : 0;
      productVariableCost = totalUnits > 0 ? totalCogs / totalUnits : 0;
    } else if (normalized.length === 1) {
      const m = computeProductMetrics(normalized[0]);
      productMonthlySales = m.unitsSold;
      productSellingPrice = m.netSellingPrice > 0 ? m.netSellingPrice : m.sellingPrice;
      productVariableCost = m.unitCost;
    }
  }

  const readStringArray = (key: string): string[] => {
    if (hasMonthlyScope) {
      return Array.isArray(activeMonthFin[key]) ? activeMonthFin[key] : [];
    }
    return Array.isArray(activeMonthFin[key])
      ? activeMonthFin[key]
      : Array.isArray(finData[key])
        ? finData[key]
        : [];
  };

  const directCompetitors = readStringArray("directCompetitors");
  const otherCompetitors = readStringArray("otherCompetitors");
  const nearbyEstablishments = readStringArray("nearbyEstablishments");
  const targetDemographics = readStringArray("targetDemographics");

  const hasExplicitProductUnits =
    products.length > 1 ||
    (products.length === 1 &&
      (Number(products[0]?.quantityYield) > 0 ||
        (products[0]?.unitsSold !== undefined && products[0]?.unitsSold !== "")));

  const resolvedSellingPrice = hasMonthlyScope
    ? hasExplicitProductUnits
      ? productSellingPrice || Number(activeMonthFin.sellingPrice) || 0
      : Number(activeMonthFin.sellingPrice) || 0
    : Number(activeMonthFin.sellingPrice) || productSellingPrice || Number(finData.sellingPrice) || 0;
  const resolvedMonthlySales = hasMonthlyScope
    ? hasExplicitProductUnits
      ? productMonthlySales
      : Number(activeMonthFin.monthlySales) || 0
    : hasExplicitProductUnits
      ? productMonthlySales || Number(activeMonthFin.monthlySales) || Number(finData.monthlySales) || 0
      : Number(activeMonthFin.monthlySales) || Number(finData.monthlySales) || 0;
  const resolvedVariableCost = hasMonthlyScope
    ? hasExplicitProductUnits
      ? productVariableCost || Number(activeMonthFin.variableCost) || 0
      : Number(activeMonthFin.variableCost) || 0
    : Number(activeMonthFin.variableCost) || productVariableCost || Number(finData.variableCost) || 0;

  return {
    ...scopedFinBase,
    products,
    sellingPrice: Math.max(0, resolvedSellingPrice),
    monthlySales: Math.max(0, resolvedMonthlySales),
    variableCost: Math.max(0, resolvedVariableCost),
    fixedCosts,
    startupCapital: resolvedCapital,
    cashInvested: hasMonthlyScope
      ? activeMonthFin.cashInvested || String(resolvedCapital)
      : activeMonthFin.cashInvested || finData.cashInvested || String(resolvedCapital),
    contributorsList: contribList,
    totalCapital: resolvedCapital,
    proposalCapital: proposalCap,
    equipmentList,
    opexList,
    operatingDays: Math.max(
      1,
      hasMonthlyScope
        ? Number(activeMonthFin.operatingDays) || 300
        : Number(activeMonthFin.operatingDays) || Number(finData.operatingDays) || 300
    ),
    isCapitalBorrowed: Boolean(
      hasMonthlyScope
        ? activeMonthFin.isCapitalBorrowed
        : activeMonthFin.isCapitalBorrowed ?? finData.isCapitalBorrowed
    ),
    interestRate: Math.max(
      0,
      hasMonthlyScope
        ? Number(activeMonthFin.interestRate) || 0
        : Number(activeMonthFin.interestRate) || Number(finData.interestRate) || 0
    ),
    competitorCount:
      Number(activeMonthFin.competitorCount) ||
      directCompetitors.length + otherCompetitors.length,
    marketDemand: hasMonthlyScope
      ? activeMonthFin.marketDemand || "Medium"
      : activeMonthFin.marketDemand || finData.marketDemand || "Medium",
    directCompetitors,
    otherCompetitors,
    competitorNotes: hasMonthlyScope
      ? activeMonthFin.competitorNotes || ""
      : activeMonthFin.competitorNotes || finData.competitorNotes || "",
    nearbyEstablishments,
    targetDemographics,
    footTrafficPeak: hasMonthlyScope
      ? activeMonthFin.footTrafficPeak || ""
      : activeMonthFin.footTrafficPeak || finData.footTrafficPeak || "",
    marketDemandNotes: hasMonthlyScope
      ? activeMonthFin.marketDemandNotes || ""
      : activeMonthFin.marketDemandNotes || finData.marketDemandNotes || "",
    businessName: proj?.name || proj?.businessName || proj?.rawProposalData?.businessName || "",
    businessType: proj?.businessType || proj?.rawProposalData?.businessType || "",
  };
};

/**
 * Generates a deterministic canonical fingerprint of the quantitative & market fields
 * that affect feasibility scoring, margins, CapEx/OpEx, BEP, payback, and market indicators.
 */
export const computeFinancialInputSignature = (finData: any): string => {
  const prods = Array.isArray(finData?.products)
    ? finData.products.map((p: any) => ({
        name: String(p?.name || "").trim(),
        quantityYield: Number(p?.quantityYield) || 0,
        batchesPerMonth: Number(p?.batchesPerMonth) || 1,
        unitsSold: p?.unitsSold === undefined || p?.unitsSold === "" ? null : Number(p.unitsSold) || 0,
        productionCost: Number(p?.productionCost) || 0,
        markupPercentage: Number(p?.markupPercentage) || 0,
        sellingPrice: p?.sellingPrice === undefined || p?.sellingPrice === "" ? null : Number(p.sellingPrice) || 0,
        applyVat: p?.applyVat !== false,
        vatRate: p?.vatRate !== undefined ? Number(p.vatRate) : 12,
        ingredients: Array.isArray(p?.ingredients)
          ? p.ingredients.map((ing: any) => ({
              name: String(ing?.name || "").trim(),
              price: Number(ing?.price) || 0,
            }))
          : [],
      }))
    : [];

  const hasExplicitProductUnits =
    prods.length > 1 ||
    (prods.length === 1 && (prods[0].quantityYield > 0 || prods[0].unitsSold !== null));

  const opexList = Array.isArray(finData?.opexList)
    ? finData.opexList.map((o: any) => ({
        id: String(o?.id || o?.name || "").trim(),
        amount: Math.max(0, Number(o?.amount) || 0),
      }))
    : [];
  const resolvedFixedCosts =
    opexList.length > 0
      ? opexList.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0)
      : Math.max(0, Number(finData?.fixedCosts) || 0);

  const contributorsList = Array.isArray(finData?.contributorsList)
    ? finData.contributorsList.map((c: any) => Math.max(0, Number(c?.amount) || 0))
    : [];
  const contribSum = contributorsList.reduce((sum: number, a: number) => sum + a, 0);
  const resolvedCapital =
    contribSum > 0
      ? contribSum
      : Math.max(
          0,
          Number(finData?.cashInvested) ||
            Number(finData?.startupCapital) ||
            Number(finData?.totalCapital) ||
            Number(finData?.proposalCapital) ||
            0
        );

  const canonical = {
    businessType: String(finData?.businessType || finData?.category || "").trim().toLowerCase(),
    products: prods,
    sellingPrice: hasExplicitProductUnits ? 0 : Math.max(0, Number(finData?.sellingPrice) || 0),
    monthlySales: hasExplicitProductUnits ? 0 : Math.max(0, Number(finData?.monthlySales) || 0),
    variableCost: hasExplicitProductUnits ? 0 : Math.max(0, Number(finData?.variableCost) || 0),
    fixedCosts: resolvedFixedCosts,
    opexList,
    equipmentList: Array.isArray(finData?.equipmentList)
      ? finData.equipmentList.map((e: any) => ({
          name: String(e?.name || "").trim(),
          quantity: Math.max(0, Number(e?.quantity) || 0),
          unitPrice: Math.max(0, Number(e?.unitPrice) || 0),
          total: Math.max(0, Number(e?.total) || 0),
        }))
      : [],
    contributorsList,
    resolvedCapital,
    operatingDays: Math.max(1, Number(finData?.operatingDays) || 300),
    isCapitalBorrowed: Boolean(finData?.isCapitalBorrowed),
    interestRate: Math.max(0, Number(finData?.interestRate) || 0),
    marketDemand: String(finData?.marketDemand || "Medium").trim(),
    directCompetitors: Array.isArray(finData?.directCompetitors)
      ? finData.directCompetitors.map((s: any) => String(s).trim())
      : [],
    otherCompetitors: Array.isArray(finData?.otherCompetitors)
      ? finData.otherCompetitors.map((s: any) => String(s).trim())
      : [],
    nearbyEstablishments: Array.isArray(finData?.nearbyEstablishments)
      ? finData.nearbyEstablishments.map((s: any) => String(s).trim())
      : [],
    targetDemographics: Array.isArray(finData?.targetDemographics)
      ? finData.targetDemographics.map((s: any) => String(s).trim())
      : [],
  };

  const str = JSON.stringify(canonical);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fin-${(hash >>> 0).toString(16).padStart(8, "0")}-${str.length}`;
};

/**
 * Identifies whether a stored `aiAnalysis` object originated from Adviser proposal-stage grading
 * (`/api/analyze-proposal`) rather than the Student financial defense feasibility engine (`/api/analyze`).
 */
export const isProposalStageAnalysis = (aiAnalysis: any): boolean => {
  if (!aiAnalysis || typeof aiAnalysis !== "object") return false;
  if (
    aiAnalysis.analysisType === "ADVISER_PROPOSAL_ANALYSIS" ||
    aiAnalysis.sourceModule === "adviser-proposal-modal"
  ) {
    return true;
  }
  if (
    aiAnalysis.analysisType === "STUDENT_FINANCIAL_FEASIBILITY" ||
    aiAnalysis.sourceModule === "student-financial-input"
  ) {
    return false;
  }
  if (!aiAnalysis.status) return true;
  if (
    Boolean(aiAnalysis.draftFeedback) &&
    !aiAnalysis.performanceGrade &&
    !Array.isArray(aiAnalysis.severeFlags) &&
    !aiAnalysis.marketAnalysis
  ) {
    return true;
  }
  return false;
};

/**
 * Checks whether stored `proj.aiAnalysis` is missing, from proposal-stage grading, stale by timestamp,
 * computed for a different month/draft, or mismatched against current `evaluateDefenseFeasibility(effectiveFin)`.
 */
export const detectAnalysisStaleness = (
  proj: any,
  options?: ExtractFinancialDataOptions & {
    effectiveFin?: ExtractedFinancialData;
    liveEval?: ReturnType<typeof evaluateDefenseFeasibility>;
    context?: ProposalMonthDraftContext;
  }
): AnalysisStalenessResult => {
  const ctx = options?.context || resolveProposalMonthAndDraft(proj, options);
  const effectiveFin = options?.effectiveFin || extractActiveFinancialData(proj, options);
  const liveEval = options?.liveEval || evaluateDefenseFeasibility(effectiveFin);
  const inputSignature = computeFinancialInputSignature(effectiveFin);

  const storedAi = proj?.aiAnalysis;
  const hasStoredAnalysis = Boolean(storedAi && typeof storedAi === "object");

  const financialUpdatedAtMs = Math.max(ctx.financialUpdatedAtMs, ctx.draftUpdatedAtMs);
  const aiLastRunMs = toEpochMs(storedAi?.lastRun);

  if (!hasStoredAnalysis) {
    return {
      hasStoredAnalysis: false,
      isProposalStageOnly: false,
      isTimestampStale: false,
      isDifferentMonthOrDraft: false,
      isSignatureMismatch: false,
      isMetricsMismatch: false,
      hasNewerInputs: false,
      reason: "No stored AI feasibility analysis yet.",
      inputSignature,
      financialUpdatedAtMs,
      aiLastRunMs,
    };
  }

  const isProposalStageOnly = isProposalStageAnalysis(storedAi);

  const hasStoredSignature =
    typeof storedAi.inputSignature === "string" && storedAi.inputSignature.length > 0;
  const isSignatureMismatch = hasStoredSignature && storedAi.inputSignature !== inputSignature;

  // Avoid false staleness from Firestore serverTimestamp() vs client Date.toISOString() clock skew:
  // only fall back to timestamp comparison for legacy documents that do not store an inputSignature.
  const rawTimestampStale =
    financialUpdatedAtMs > 0 && aiLastRunMs > 0 && financialUpdatedAtMs > aiLastRunMs + 2000;
  const isTimestampStale = hasStoredSignature ? false : rawTimestampStale;

  const isDifferentMonthOrDraft = (() => {
    if (
      typeof storedAi.analyzedMonthIndex === "number" &&
      storedAi.analyzedMonthIndex !== ctx.monthIndex
    ) {
      return true;
    }
    if (storedAi.analyzedDraftId && ctx.draftId && storedAi.analyzedDraftId !== ctx.draftId) {
      return true;
    }
    if (options?.monthIndex !== undefined && ctx.monthIndex !== ctx.activeMonthIndexInProject) {
      return true;
    }
    if (
      options?.draftId &&
      ctx.activeDraftIdInMonth &&
      ctx.draftId !== ctx.activeDraftIdInMonth
    ) {
      return true;
    }
    return false;
  })();

  const isMetricsMismatch = (() => {
    if (isProposalStageOnly) return true;
    if (Number(storedAi.score) !== liveEval.score) return true;
    if (storedAi.status !== liveEval.status) return true;
    if (Number(storedAi.metrics?.financial) !== liveEval.financialScore) return true;
    if (Number(storedAi.metrics?.risk) !== liveEval.riskScore) return true;
    if (Number(storedAi.metrics?.market) !== liveEval.marketScore) return true;

    if (Array.isArray(storedAi.severeFlags)) {
      const storedFlagIds = storedAi.severeFlags
        .filter((f: any) => Boolean(f && typeof f === "object"))
        .map((f: any) => f?.id || f?.title || "")
        .sort()
        .join("|");
      const liveFlagIds = liveEval.severeFlags.map((f) => f.id || f.title).sort().join("|");
      if (storedFlagIds !== liveFlagIds) return true;
    }
    if (
      Array.isArray(storedAi.fatalFlaws) &&
      storedAi.fatalFlaws.length !== liveEval.fatalFlaws.length
    ) {
      return true;
    }
    return false;
  })();

  const hasNewerInputs =
    isProposalStageOnly ||
    isTimestampStale ||
    isDifferentMonthOrDraft ||
    isSignatureMismatch ||
    isMetricsMismatch;

  let reason: string | null = null;
  if (isProposalStageOnly) {
    reason = "Stored analysis was generated during proposal grading before detailed financial audit.";
  } else if (isDifferentMonthOrDraft) {
    reason = "Selected month or scenario draft differs from the last analyzed snapshot.";
  } else if (isTimestampStale || isSignatureMismatch) {
    reason = "Financial inputs were modified after the last AI analysis.";
  } else if (isMetricsMismatch) {
    reason = "Stored AI metrics differ from live defense evaluation for the current inputs.";
  }

  return {
    hasStoredAnalysis,
    isProposalStageOnly,
    isTimestampStale,
    isDifferentMonthOrDraft,
    isSignatureMismatch,
    isMetricsMismatch,
    hasNewerInputs,
    reason,
    inputSignature,
    financialUpdatedAtMs,
    aiLastRunMs,
  };
};

/**
 * Resolves an always-valid, mathematically synchronized AI feasibility evaluation for a proposal
 * (and optional month/draft selection). Combines `evaluateDefenseFeasibility`, `calculateLocalAudit`,
 * `detectAnalysisStaleness`, and `cleanUserFacingText`.
 */
export const resolveSyncedAIAnalysis = (
  proj: any,
  options?: ResolveSyncedAIAnalysisOptions
): SyncedAIAnalysisResult => {
  const preferLiveOnStale = options?.preferLiveOnStale ?? true;
  const context = resolveProposalMonthAndDraft(proj, options);
  const effectiveFin = extractActiveFinancialData(proj, options);
  const liveEval = evaluateDefenseFeasibility(effectiveFin);
  const liveAudit = calculateLocalAudit(effectiveFin);
  const staleness = detectAnalysisStaleness(proj, {
    ...options,
    context,
    effectiveFin,
    liveEval,
  });

  const storedAi = proj?.aiAnalysis;
  const canUseStoredCommentary =
    staleness.hasStoredAnalysis &&
    !staleness.isProposalStageOnly &&
    (!preferLiveOnStale || !staleness.hasNewerInputs);

  const cleanedLiveInsights: NormalizedInsightItem[] = (liveAudit.insights || []).map(
    (item: any, idx: number) => ({
      id: coerceText(item?.id, `local-${idx}`) || `local-${idx}`,
      title: coerceText(item?.title, `Insight ${idx + 1}`),
      description: coerceText(item?.description),
      type: normalizeInsightType(item?.type),
    })
  );

  const rawLiveExplanations: Record<string, any> =
    liveAudit.explanations && typeof liveAudit.explanations === "object" ? liveAudit.explanations : {};
  const rawLiveTips: Record<string, any> =
    liveAudit.improvementTips && typeof liveAudit.improvementTips === "object" ? liveAudit.improvementTips : {};
  const rawLiveScoreExp: Record<string, any> =
    liveAudit.aiScoreExplanations && typeof liveAudit.aiScoreExplanations === "object"
      ? liveAudit.aiScoreExplanations
      : {};
  const rawLiveMarket: Record<string, any> =
    liveAudit.marketAnalysis && typeof liveAudit.marketAnalysis === "object"
      ? liveAudit.marketAnalysis
      : {};

  const cleanedLiveMarket: MarketAnalysisData = {
    summary: coerceText(rawLiveMarket.summary),
    competitorInsight: coerceMarketPillar(rawLiveMarket.competitorInsight),
    footTrafficInsight: coerceMarketPillar(rawLiveMarket.footTrafficInsight),
    demographicInsight: coerceMarketPillar(rawLiveMarket.demographicInsight),
  };

  const normalizedLiveSevereFlags = coerceSevereFlags(liveAudit.severeFlags || []);
  const normalizedLiveFatalFlaws = coerceTextArray(liveAudit.fatalFlaws || []);

  if (!canUseStoredCommentary) {
    const aiData: ResolvedAIAnalysisData = {
      score: liveAudit.score,
      status: normalizeStatus(liveAudit.status),
      performanceGrade: coerceText(liveAudit.performanceGrade),
      performanceStatus: coerceText(liveAudit.performanceStatus),
      performanceRecommendation: coerceText(liveAudit.performanceRecommendation),
      metrics: {
        feasibility: liveAudit.score,
        financial: liveAudit.metrics.financial,
        risk: liveAudit.metrics.risk,
        market: liveAudit.metrics.market,
      },
      aiScores: { ...liveAudit.aiScores },
      explanations: {
        feasibility: coerceText(rawLiveExplanations.feasibility),
        financial: coerceText(rawLiveExplanations.financial),
        risk: coerceText(rawLiveExplanations.risk),
        market: coerceText(rawLiveExplanations.market),
      },
      insights: cleanedLiveInsights,
      improvementTips: {
        feasibility: coerceText(rawLiveTips.feasibility),
        financial: coerceTextArray(rawLiveTips.financial),
        operations: coerceTextArray(rawLiveTips.operations),
        marketing: coerceTextArray(rawLiveTips.marketing),
      },
      aiScoreExplanations: {
        financial: coerceText(rawLiveScoreExp.financial),
        operational: coerceText(rawLiveScoreExp.operational),
        market: coerceText(rawLiveScoreExp.market),
      },
      marketAnalysis: cleanedLiveMarket,
      severeFlags: normalizedLiveSevereFlags,
      fatalFlaws: normalizedLiveFatalFlaws,
      bepRevenue: liveAudit.bepRevenue,
      bepRevenueStr: liveAudit.bepRevenueStr,
      bepRevenueRatio: liveAudit.bepRevenueRatio,
      cmr: liveAudit.cmr,
      isBmbeQualified: liveAudit.isBmbeQualified,
      taxTypeLabel: liveAudit.taxTypeLabel,
      lastRun: typeof storedAi?.lastRun === "string" ? storedAi.lastRun : null,
      _fallback: true,
      inputSignature: staleness.inputSignature,
      analyzedMonthIndex: context.monthIndex,
      analyzedDraftId: context.draftId,
    };

    return {
      aiData,
      effectiveFin,
      context,
      liveEval,
      liveAudit,
      staleness,
      source: "live-audit",
      isFallback: true,
      isStale: staleness.hasNewerInputs,
      qualitativeExtras: null,
    };
  }

  // Stored financial AI analysis is valid (and synced, or caller explicitly requested stored commentary)
  const rawStoredExp: Record<string, any> =
    storedAi.explanations && typeof storedAi.explanations === "object" ? storedAi.explanations : {};
  const rawStoredTips: Record<string, any> =
    storedAi.improvementTips && typeof storedAi.improvementTips === "object" ? storedAi.improvementTips : {};
  const rawStoredScoreExp: Record<string, any> =
    storedAi.aiScoreExplanations && typeof storedAi.aiScoreExplanations === "object"
      ? storedAi.aiScoreExplanations
      : {};
  const rawStoredMarket: Record<string, any> | null =
    storedAi.marketAnalysis && typeof storedAi.marketAnalysis === "object"
      ? storedAi.marketAnalysis
      : null;
  const rawStoredInsights =
    Array.isArray(storedAi.insights) && storedAi.insights.length > 0 ? storedAi.insights : null;

  const isStoredFallback = storedAi._fallback === true;
  const mergedInsights: NormalizedInsightItem[] = (rawStoredInsights || cleanedLiveInsights)
    .filter((item: any) => Boolean(item && typeof item === "object"))
    .map((item: any, idx: number) => ({
      id: coerceText(item?.id, `${isStoredFallback ? "local" : "ai"}-${idx}`) || `${isStoredFallback ? "local" : "ai"}-${idx}`,
      title: coerceText(item?.title, cleanedLiveInsights[idx]?.title || `Insight ${idx + 1}`),
      description: coerceText(item?.description, cleanedLiveInsights[idx]?.description || ""),
      type: normalizeInsightType(item?.type ?? cleanedLiveInsights[idx]?.type),
    }));

  const finalInsights = mergedInsights.length > 0 ? mergedInsights : cleanedLiveInsights;

  const storedSummary = rawStoredMarket ? coerceText(rawStoredMarket.summary) : "";
  const mergedMarketAnalysis: MarketAnalysisData = storedSummary
    ? {
        summary: storedSummary,
        competitorInsight: coerceMarketPillar(
          rawStoredMarket?.competitorInsight,
          cleanedLiveMarket.competitorInsight
        ),
        footTrafficInsight: coerceMarketPillar(
          rawStoredMarket?.footTrafficInsight,
          cleanedLiveMarket.footTrafficInsight
        ),
        demographicInsight: coerceMarketPillar(
          rawStoredMarket?.demographicInsight,
          cleanedLiveMarket.demographicInsight
        ),
      }
    : cleanedLiveMarket;

  // Enforce canonical quantitative scores/verdicts/flags from liveEval unless caller disabled preferLiveOnStale
  const useLiveNumbers = preferLiveOnStale || !staleness.hasNewerInputs;
  const resolvedScore = useLiveNumbers ? liveEval.score : coerceNumber(storedAi.score, liveEval.score);
  const resolvedStatus = normalizeStatus(useLiveNumbers ? liveEval.status : storedAi.status || liveEval.status);

  const aiData: ResolvedAIAnalysisData = {
    score: resolvedScore,
    status: resolvedStatus,
    performanceGrade: useLiveNumbers
      ? coerceText(liveEval.performanceGrade)
      : coerceText(storedAi.performanceGrade, coerceText(liveEval.performanceGrade)),
    performanceStatus: useLiveNumbers
      ? coerceText(liveEval.performanceStatus)
      : coerceText(storedAi.performanceStatus, coerceText(liveEval.performanceStatus)),
    performanceRecommendation: useLiveNumbers
      ? coerceText(liveEval.performanceRecommendation)
      : coerceText(storedAi.performanceRecommendation, coerceText(liveEval.performanceRecommendation)),
    metrics: useLiveNumbers
      ? {
          feasibility: liveEval.score,
          financial: liveEval.financialScore,
          risk: liveEval.riskScore,
          market: liveEval.marketScore,
        }
      : {
          feasibility: resolvedScore,
          financial: coerceNumber(storedAi.metrics?.financial, liveEval.financialScore),
          risk: coerceNumber(storedAi.metrics?.risk, liveEval.riskScore),
          market: coerceNumber(storedAi.metrics?.market, liveEval.marketScore),
        },
    aiScores: useLiveNumbers
      ? { ...liveAudit.aiScores }
      : {
          financial: coerceNumber(storedAi.aiScores?.financial, liveAudit.aiScores.financial),
          operational: coerceNumber(storedAi.aiScores?.operational, liveAudit.aiScores.operational),
          market: coerceNumber(storedAi.aiScores?.market, liveAudit.aiScores.market),
        },
    explanations: {
      feasibility: coerceText(rawStoredExp.feasibility, coerceText(rawLiveExplanations.feasibility)),
      financial: coerceText(rawStoredExp.financial, coerceText(rawLiveExplanations.financial)),
      risk: coerceText(rawStoredExp.risk, coerceText(rawLiveExplanations.risk)),
      market: coerceText(rawStoredExp.market, coerceText(rawLiveExplanations.market)),
    },
    insights: finalInsights,
    improvementTips: {
      feasibility: coerceText(rawStoredTips.feasibility, coerceText(rawLiveTips.feasibility)),
      financial: coerceTextArray(rawStoredTips.financial, coerceTextArray(rawLiveTips.financial)),
      operations: coerceTextArray(rawStoredTips.operations, coerceTextArray(rawLiveTips.operations)),
      marketing: coerceTextArray(rawStoredTips.marketing, coerceTextArray(rawLiveTips.marketing)),
    },
    aiScoreExplanations: {
      financial: coerceText(rawStoredScoreExp.financial, coerceText(rawLiveScoreExp.financial)),
      operational: coerceText(rawStoredScoreExp.operational, coerceText(rawLiveScoreExp.operational)),
      market: coerceText(rawStoredScoreExp.market, coerceText(rawLiveScoreExp.market)),
    },
    marketAnalysis: mergedMarketAnalysis,
    severeFlags: useLiveNumbers
      ? normalizedLiveSevereFlags
      : coerceSevereFlags(storedAi.severeFlags, normalizedLiveSevereFlags),
    fatalFlaws: useLiveNumbers
      ? normalizedLiveFatalFlaws
      : coerceTextArray(storedAi.fatalFlaws, normalizedLiveFatalFlaws),
    bepRevenue: liveAudit.bepRevenue,
    bepRevenueStr: liveAudit.bepRevenueStr,
    bepRevenueRatio: liveAudit.bepRevenueRatio,
    cmr: liveAudit.cmr,
    isBmbeQualified: liveAudit.isBmbeQualified,
    taxTypeLabel: liveAudit.taxTypeLabel,
    lastRun: typeof storedAi.lastRun === "string" ? storedAi.lastRun : null,
    _fallback: isStoredFallback,
    _model: typeof storedAi._model === "string" ? storedAi._model : undefined,
    _fallbackReason: typeof storedAi._fallbackReason === "string" ? storedAi._fallbackReason : undefined,
    inputSignature:
      typeof storedAi.inputSignature === "string" && storedAi.inputSignature.length > 0
        ? storedAi.inputSignature
        : staleness.inputSignature,
    analyzedMonthIndex:
      typeof storedAi.analyzedMonthIndex === "number" ? storedAi.analyzedMonthIndex : context.monthIndex,
    analyzedDraftId:
      typeof storedAi.analyzedDraftId === "string" && storedAi.analyzedDraftId.length > 0
        ? storedAi.analyzedDraftId
        : context.draftId,
  };

  const hasQualitativeExtras =
    (Array.isArray(storedAi.strengths) && storedAi.strengths.length > 0) ||
    (Array.isArray(storedAi.weaknesses) && storedAi.weaknesses.length > 0) ||
    Boolean(storedAi.realityCheck) ||
    (Array.isArray(storedAi.recommendations) && storedAi.recommendations.length > 0) ||
    Boolean(storedAi.draftFeedback);

  const qualitativeExtras =
    !staleness.hasNewerInputs && hasQualitativeExtras
      ? {
          strengths: coerceTextArray(storedAi.strengths),
          weaknesses: coerceTextArray(storedAi.weaknesses),
          realityCheck: coerceText(storedAi.realityCheck),
          recommendations: coerceTextArray(storedAi.recommendations),
          draftFeedback: coerceText(storedAi.draftFeedback),
        }
      : null;

  return {
    aiData,
    effectiveFin,
    context,
    liveEval,
    liveAudit,
    staleness,
    source: isStoredFallback ? "stored-fallback" : "stored-ai",
    isFallback: isStoredFallback,
    isStale: staleness.hasNewerInputs,
    qualitativeExtras,
  };
};

/** Compact PHP currency formatter matching `AI_Analysis.tsx` Pro Forma axis & badge pills. */
export const formatProFormaCurrency = (val: number): string => {
  if (!Number.isFinite(val) || val === 0) return "₱0";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const num = abs / 1_000_000;
    const formatted = num >= 10 || Number.isInteger(num) ? num.toFixed(0) : num.toFixed(1);
    return `${sign}₱${formatted}M`;
  }
  if (abs >= 1_000) {
    const num = abs / 1_000;
    const formatted =
      num >= 100 || Number.isInteger(Number(num.toFixed(1)))
        ? num.toFixed(0)
        : num.toFixed(1);
    return `${sign}₱${formatted}K`;
  }
  return `${sign}₱${abs.toLocaleString("en-PH")}`;
};

/**
 * Computes the complete 5-Year Pro Forma projection dataset, Recharts rows, KPI summaries,
 * and human-readable projection insights using the unified BMBE/CREATE + product-aware engine.
 */
export const buildProFormaProjection = (
  financials: any,
  revenueGrowthRate: number = DEFAULT_PRO_FORMA_REVENUE_GROWTH,
  costGrowthRate: number = DEFAULT_PRO_FORMA_COST_GROWTH
): ProFormaProjectionResult => {
  const safeRevRate = Number.isFinite(Number(revenueGrowthRate))
    ? Number(revenueGrowthRate)
    : DEFAULT_PRO_FORMA_REVENUE_GROWTH;
  const safeCostRate = Number.isFinite(Number(costGrowthRate))
    ? Number(costGrowthRate)
    : DEFAULT_PRO_FORMA_COST_GROWTH;

  const raw = generateProFormaData(financials, safeRevRate, safeCostRate);

  const chartData: ProFormaChartPoint[] = raw.yearLabels.map((label, idx) => {
    const rev = raw.yearlyRevenue[idx] || 0;
    const cogs = raw.yearlyCOGS[idx] || 0;
    const fixed = raw.yearlyFixedCosts[idx] || 0;
    const net = raw.yearlyNetProfit[idx] || 0;
    const netMarginPct = rev > 0 ? Number(((net / rev) * 100).toFixed(1)) : 0;
    return {
      year: label,
      Revenue: rev,
      COGS: cogs,
      "Fixed Costs": fixed,
      "Fixed Cost": fixed,
      "Net Profit": net,
      netMarginPct,
    };
  });

  const year1Revenue = raw.yearlyRevenue[0] || 0;
  const year5Revenue = raw.yearlyRevenue[4] || 0;
  const revenueIncrease = year5Revenue - year1Revenue;

  const year1NetProfit = raw.yearlyNetProfit[0] || 0;
  const year5NetProfit = raw.yearlyNetProfit[4] || 0;
  const netProfitChange = year5NetProfit - year1NetProfit;

  const cumulativeRevenue = raw.yearlyRevenue.reduce((sum, v) => sum + v, 0);
  const cumulativeCOGS = raw.yearlyCOGS.reduce((sum, v) => sum + v, 0);
  const cumulativeFixedCosts = raw.yearlyFixedCosts.reduce((sum, v) => sum + v, 0);
  const cumulativeNetProfit = raw.yearlyNetProfit.reduce((sum, v) => sum + v, 0);

  const year1NetMarginPct =
    year1Revenue > 0 ? Number(((year1NetProfit / year1Revenue) * 100).toFixed(1)) : 0;
  const year5NetMarginPct =
    year5Revenue > 0 ? Number(((year5NetProfit / year5Revenue) * 100).toFixed(1)) : 0;
  const isNetProfitGrowing = year5NetProfit > year1NetProfit;

  const insights: string[] = [];
  if (year1Revenue <= 0) {
    insights.push(
      "No active product revenue is projected yet. Enter selling price and monthly sales volume in Financial Input to model 5-year growth."
    );
  } else {
    insights.push(
      `Revenue is projected to grow at ${safeRevRate}% annually, reaching ₱${year5Revenue.toLocaleString("en-PH")} by Year 5 (+₱${revenueIncrease.toLocaleString("en-PH")} over Year 1), ${isNetProfitGrowing ? "showing strong profit expansion" : "indicating need for cost optimization"}.`
    );
    insights.push(
      `5-Year cumulative net profit totals ${cumulativeNetProfit < 0 ? "-" : ""}₱${Math.abs(cumulativeNetProfit).toLocaleString("en-PH")} across ₱${cumulativeRevenue.toLocaleString("en-PH")} in total projected sales (Year 5 net margin: ${year5NetMarginPct}%).`
    );
  }

  return {
    raw,
    chartData,
    summary: {
      year1Revenue,
      year5Revenue,
      revenueIncrease,
      year1NetProfit,
      year5NetProfit,
      netProfitChange,
      cumulativeRevenue,
      cumulativeCOGS,
      cumulativeFixedCosts,
      cumulativeNetProfit,
      year1NetMarginPct,
      year5NetMarginPct,
      isNetProfitGrowing,
      revenueGrowthRate: safeRevRate,
      costGrowthRate: safeCostRate,
    },
    insights,
  };
};

const PLACEHOLDER_BUSINESS_NAMES = new Set([
  "pending business name",
  "pending company name",
  "pending title...",
  "pending title",
  "feasibility project",
]);

const pickNonPlaceholderName = (...candidates: any[]): string => {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (PLACEHOLDER_BUSINESS_NAMES.has(trimmed.toLowerCase())) continue;
    return trimmed;
  }
  return "";
};

/**
 * Guards against classifying empty/unfilled `financialData` as `NOT_FEASIBLE` in summary tables.
 * Accepts either already-extracted `ExtractedFinancialData` or raw `financialData` (with `monthlyRecords`).
 */
export const hasMeaningfulFinancialInputs = (finData: any): boolean => {
  if (!finData || typeof finData !== "object") return false;

  const source =
    Array.isArray(finData.monthlyRecords) && finData.monthlyRecords.length > 0
      ? extractActiveFinancialData({ financialData: finData })
      : finData;

  const products = Array.isArray(source.products) ? source.products : [];
  const hasProductEntry = products.some((p: any) => {
    if (!p || typeof p !== "object") return false;
    if (
      Number(p.quantityYield) > 0 ||
      Number(p.sellingPrice) > 0 ||
      Number(p.productionCost) > 0 ||
      Number(p.unitCost) > 0 ||
      Number(p.unitsSold) > 0
    ) {
      return true;
    }
    return (
      Array.isArray(p.ingredients) &&
      p.ingredients.some((ing: any) => Number(ing?.price) > 0)
    );
  });
  if (hasProductEntry) return true;

  if (
    Number(source.sellingPrice) > 0 ||
    Number(source.monthlySales) > 0 ||
    Number(source.fixedCosts) > 0
  ) {
    return true;
  }

  const equipmentList = Array.isArray(source.equipmentList) ? source.equipmentList : [];
  if (
    equipmentList.some(
      (e: any) =>
        Boolean(e && typeof e === "object") &&
        (Number(e.total) > 0 ||
          Number(e.unitPrice) > 0 ||
          Number(e.cost) > 0 ||
          Number(e.price) > 0 ||
          Number(e.amount) > 0 ||
          Number(e.quantity) > 0)
    )
  ) {
    return true;
  }

  const opexList = Array.isArray(source.opexList) ? source.opexList : [];
  if (opexList.some((o: any) => Number(o?.amount) > 0)) {
    return true;
  }

  const contributorsList = Array.isArray(source.contributorsList) ? source.contributorsList : [];
  const contribSum = contributorsList.reduce(
    (sum: number, c: any) => sum + Math.max(0, Number(c?.amount) || 0),
    0
  );
  if (contribSum > 0) {
    return true;
  }

  return false;
};

/**
 * Resolves the canonical active/approved proposal for a group from all proposals belonging to that group.
 * Aligned with `AdviserDashboard.tsx`: checks `activeProposalId` -> `approvedProposalId` -> `Approved`
 * status -> (if `group.status === "Active Business"`) `groupProposals[0]` -> `null`.
 */
export const selectActiveProposalForGroup = (group: any, groupProposals: any[]): any | null => {
  if (!Array.isArray(groupProposals) || groupProposals.length === 0) return null;

  if (group?.activeProposalId) {
    const activeById = groupProposals.find((p: any) => p?.id === group.activeProposalId);
    if (activeById) return activeById;
  }

  if (group?.approvedProposalId) {
    const approvedById = groupProposals.find((p: any) => p?.id === group.approvedProposalId);
    if (approvedById) return approvedById;
  }

  const approvedByStatus = groupProposals.find(
    (p: any) => p?.status === "Approved" || p?.status === "APPROVED"
  );
  if (approvedByStatus) return approvedByStatus;

  if (group?.status === "Active Business") {
    return groupProposals[0] || null;
  }

  return null;
};

/**
 * Lightweight, zero-regex feasibility classifier designed for Chairperson summary tables & KPI cards.
 * Uses `extractActiveFinancialData` + `evaluateDefenseFeasibility` when meaningful financial inputs
 * exist (matching `resolveSyncedAIAnalysis` score/status 100%), and falls back to stored proposal-stage
 * `aiAnalysis.status` / `aiAnalysis.score` otherwise.
 */
export const classifyProposalFeasibility = (
  proposal: any,
  options?: ExtractFinancialDataOptions
): ProposalFeasibilityClassification => {
  if (!proposal || typeof proposal !== "object") {
    return {
      aiStatus: "PENDING",
      aiScore: null,
      sentiment: "pending",
      isConditional: false,
      source: "pending",
    };
  }

  const effectiveFin = extractActiveFinancialData(proposal, options);
  if (hasMeaningfulFinancialInputs(effectiveFin)) {
    const evalRes = evaluateDefenseFeasibility(effectiveFin);
    const aiStatus = normalizeStatus(evalRes.status);
    const aiScore = Number.isFinite(evalRes.score) ? evalRes.score : null;

    if (aiStatus === "FEASIBLE") {
      return {
        aiStatus: "FEASIBLE",
        aiScore,
        sentiment: "positive",
        isConditional: false,
        source: "financial-audit",
      };
    }
    if (aiStatus === "CONDITIONALLY_FEASIBLE" || aiStatus === "MODERATE") {
      return {
        aiStatus,
        aiScore,
        sentiment: "positive",
        isConditional: true,
        source: "financial-audit",
      };
    }
    return {
      aiStatus: "NOT_FEASIBLE",
      aiScore,
      sentiment: "negative",
      isConditional: false,
      source: "financial-audit",
    };
  }

  const storedAi = proposal?.aiAnalysis;
  if (storedAi && typeof storedAi === "object") {
    const rawScore = Number(storedAi.score);
    const aiScore =
      storedAi.score !== null &&
      storedAi.score !== undefined &&
      storedAi.score !== "" &&
      Number.isFinite(rawScore)
        ? rawScore
        : null;

    const explicitStatus = storedAi.status;
    if (explicitStatus === "FEASIBLE") {
      return {
        aiStatus: "FEASIBLE",
        aiScore,
        sentiment: "positive",
        isConditional: false,
        source: "stored-ai",
      };
    }
    if (explicitStatus === "CONDITIONALLY_FEASIBLE" || explicitStatus === "MODERATE") {
      return {
        aiStatus: explicitStatus,
        aiScore,
        sentiment: "positive",
        isConditional: true,
        source: "stored-ai",
      };
    }
    if (explicitStatus === "NOT_FEASIBLE") {
      return {
        aiStatus: "NOT_FEASIBLE",
        aiScore,
        sentiment: "negative",
        isConditional: false,
        source: "stored-ai",
      };
    }

    if (aiScore !== null) {
      if (aiScore >= 80) {
        return {
          aiStatus: "FEASIBLE",
          aiScore,
          sentiment: "positive",
          isConditional: false,
          source: "stored-ai",
        };
      }
      if (aiScore >= 70) {
        return {
          aiStatus: "CONDITIONALLY_FEASIBLE",
          aiScore,
          sentiment: "positive",
          isConditional: true,
          source: "stored-ai",
        };
      }
      return {
        aiStatus: "NOT_FEASIBLE",
        aiScore,
        sentiment: "negative",
        isConditional: false,
        source: "stored-ai",
      };
    }
  }

  return {
    aiStatus: "PENDING",
    aiScore: null,
    sentiment: "pending",
    isConditional: false,
    source: "pending",
  };
};

/**
 * Resolves the canonical Chairperson display status label for a proposal + its parent group.
 * Optional `resolvedActiveProposalId` (from `selectActiveProposalForGroup`) marks legacy Active Business
 * groups missing `group.activeProposalId` without leaking `"Active Business"` to sibling proposals.
 */
export const resolveProposalDisplayStatus = (
  proposal: any,
  group: any,
  resolvedActiveProposalId?: string
): ProposalDisplayStatusInfo => {
  const rawStatus = typeof proposal?.status === "string" ? proposal.status.trim() : "";
  const hasProposalId = Boolean(proposal?.id);
  const isGroupActive =
    Boolean(group) && (group.status === "Active Business" || Boolean(group.isSetup));

  const isActiveBusiness =
    isGroupActive &&
    hasProposalId &&
    (group.activeProposalId === proposal.id ||
      (!group.activeProposalId &&
        ((Boolean(resolvedActiveProposalId) && resolvedActiveProposalId === proposal.id) ||
          group.approvedProposalId === proposal.id ||
          rawStatus === "Approved" ||
          rawStatus === "APPROVED")));

  if (isActiveBusiness) {
    return { label: "Active Business", rawStatus };
  }

  if (
    rawStatus === "Approved" ||
    rawStatus === "APPROVED" ||
    (hasProposalId && group?.approvedProposalId === proposal.id)
  ) {
    return { label: "Approved Proposal", rawStatus };
  }

  if (rawStatus === "Rejected") {
    return { label: "Rejected Proposal", rawStatus };
  }

  if (rawStatus === "Revision Required" || rawStatus === "Revision") {
    return { label: "In Revision", rawStatus };
  }

  if (
    rawStatus === "Submitted" ||
    rawStatus === "Pending" ||
    rawStatus === "Under Review"
  ) {
    return { label: "Pending Review", rawStatus };
  }

  return { label: "Draft", rawStatus };
};

/**
 * Resolves non-placeholder business & company display names for a proposal + optional group.
 * Only falls back from an empty/placeholder `proposal.businessName` to `group` names when
 * `!proposal?.id` or the proposal is the group's active/approved proposal (preventing unnamed
 * sibling drafts from duplicating the approved sibling's business name).
 */
export const resolveProposalBusinessName = (
  proposal: any,
  group?: any
): { businessName: string; companyName: string } => {
  const proposalOwnName = pickNonPlaceholderName(proposal?.businessName);
  const rawStatus = typeof proposal?.status === "string" ? proposal.status.trim() : "";

  const isGroupPrimaryProposal =
    !proposal?.id ||
    (Boolean(group) &&
      (group.activeProposalId === proposal.id ||
        group.approvedProposalId === proposal.id ||
        rawStatus === "Approved" ||
        rawStatus === "APPROVED"));

  const resolvedBusiness = proposalOwnName
    ? proposalOwnName
    : isGroupPrimaryProposal
      ? pickNonPlaceholderName(group?.businessName, group?.companyName, group?.title)
      : "";

  const fallbackBusiness = isGroupPrimaryProposal
    ? proposal?.proposalNumber
      ? `Proposal #${proposal.proposalNumber}`
      : proposal?.id
        ? "Proposal #1"
        : "Untitled Business"
    : proposal?.proposalNumber
      ? `Untitled Proposal #${proposal.proposalNumber}`
      : "Untitled Proposal";

  const companyName = pickNonPlaceholderName(
    group?.companyName,
    group?.title,
    proposal?.teamName
  );

  return {
    businessName: resolvedBusiness || fallbackBusiness,
    companyName,
  };
};
