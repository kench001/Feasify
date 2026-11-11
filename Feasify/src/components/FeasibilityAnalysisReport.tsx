import React, { useId, useMemo, useState } from "react";
import {
  Zap,
  Lightbulb,
  Info,
  CheckCircle2,
  AlertCircle,
  Target,
  Store,
  Layers,
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  buildProFormaProjection,
  formatProFormaCurrency,
  PRO_FORMA_SERIES_CONFIG,
  DEFAULT_PRO_FORMA_REVENUE_GROWTH,
  DEFAULT_PRO_FORMA_COST_GROWTH,
  type ResolvedAIAnalysisData,
  type ExtractedFinancialData,
} from "../utils/aiAnalysisHelpers";
import { AIAdvisoryDisclaimerBanner } from "./AIAdvisoryDisclaimerBanner";

export interface FeasibilityAnalysisReportProps {
  aiData: ResolvedAIAnalysisData;
  financials: ExtractedFinancialData | Record<string, any>;
  viewerRole?: "student" | "adviser";
}

const toSafeText = (value: any, fallback = ""): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => toSafeText(item))
      .filter(Boolean)
      .join(" ");
    return joined || fallback;
  }
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.description === "string") return value.description;
    if (typeof value.title === "string") return value.title;
    if (typeof value.message === "string") return value.message;
    return fallback;
  }
  return fallback;
};

const toSafeStringArray = (value: any): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toSafeText(item)).filter(Boolean);
};

const ProFormaCustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const revItem = payload.find((p: any) => p.dataKey === "Revenue");
  const netProfitItem = payload.find((p: any) => p.dataKey === "Net Profit");
  const revenueVal = revItem ? Number(revItem.value) || 0 : 0;
  const netProfitVal = netProfitItem ? Number(netProfitItem.value) || 0 : 0;
  const netMargin =
    revenueVal > 0 ? ((netProfitVal / revenueVal) * 100).toFixed(1) : null;

  return (
    <div className="bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-xl shadow-xl p-3.5 min-w-[230px] transition-all text-xs">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
        <span className="font-extrabold text-[#122244] text-[13px] tracking-tight">
          {label} Projection
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#c9a654] bg-[#c9a654]/10 px-2 py-0.5 rounded-full">
          Executive Combo
        </span>
      </div>
      <div className="space-y-2">
        {payload.map((item: any) => {
          const val = Number(item.value) || 0;
          const config = PRO_FORMA_SERIES_CONFIG.find(
            (c) => c.key === item.dataKey
          );
          const percentOfRev =
            revenueVal > 0 && item.dataKey !== "Revenue"
              ? ((val / revenueVal) * 100).toFixed(1)
              : null;

          return (
            <div
              key={item.dataKey}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex-shrink-0 ${
                    config?.type === "line"
                      ? "w-3 h-1 rounded-full"
                      : "w-2.5 h-2.5 rounded-xs"
                  }`}
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-600 font-semibold text-[11px]">
                  {config ? config.shortLabel : item.name}:
                </span>
              </div>
              <div className="text-right">
                <span
                  className="font-bold text-[12px] block"
                  style={{ color: item.color }}
                >
                  {val < 0
                    ? `-₱${Math.abs(val).toLocaleString("en-PH")}`
                    : `₱${val.toLocaleString("en-PH")}`}
                </span>
                {percentOfRev !== null && (
                  <span className="text-[9px] text-gray-400 block font-normal">
                    {percentOfRev}% of rev
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {netMargin !== null && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            Net Profit Margin
          </span>
          <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
            {netMargin}%
          </span>
        </div>
      )}
    </div>
  );
};

export const FeasibilityAnalysisReport: React.FC<
  FeasibilityAnalysisReportProps
> = ({ aiData, financials, viewerRole = "student" }) => {
  const chartUid = useId().replace(/:/g, "");

  // Pro Forma Financial Statement States
  const [revenueGrowthRate, setRevenueGrowthRate] = useState<number>(
    DEFAULT_PRO_FORMA_REVENUE_GROWTH
  );
  const [costGrowthRate, setCostGrowthRate] = useState<number>(
    DEFAULT_PRO_FORMA_COST_GROWTH
  );
  const [showProFormaInputs, setShowProFormaInputs] = useState<boolean>(false);
  const [chartMode, setChartMode] = useState<"grouped" | "stacked">("grouped");
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    Revenue: true,
    COGS: true,
    "Fixed Costs": true,
    "Net Profit": true,
  });

  const toggleSeries = (key: string) => {
    setVisibleSeries((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activeCount <= 1) {
        return prev;
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  const showAllSeries = () => {
    setVisibleSeries({
      Revenue: true,
      COGS: true,
      "Fixed Costs": true,
      "Net Profit": true,
    });
  };

  const proFormaProjection = useMemo(
    () =>
      buildProFormaProjection(financials, revenueGrowthRate, costGrowthRate),
    [financials, revenueGrowthRate, costGrowthRate]
  );

  const chartData = proFormaProjection.chartData;
  const proFormaSummary = proFormaProjection.summary;

  const feasibilityStatus = aiData.status || "PENDING";
  const performanceGrade = toSafeText(aiData.performanceGrade);
  const performanceRecommendation = toSafeText(
    aiData.performanceRecommendation
  );
  const explanations =
    aiData.explanations && typeof aiData.explanations === "object"
      ? aiData.explanations
      : { feasibility: "" };
  const feasibilityExplanation = toSafeText(
    explanations.feasibility,
    "Calculated based on current inputs."
  );
  const improvementTips =
    aiData.improvementTips && typeof aiData.improvementTips === "object"
      ? aiData.improvementTips
      : { feasibility: "" };
  const feasibilityTip = toSafeText(improvementTips.feasibility);
  const severeFlags = Array.isArray(aiData.severeFlags)
    ? aiData.severeFlags
    : [];
  const validSevereFlags = severeFlags.filter(
    (flag: any) => flag && typeof flag === "object"
  );
  const fatalFlaws = toSafeStringArray(aiData.fatalFlaws);
  const insights = Array.isArray(aiData.insights) ? aiData.insights : [];
  const marketAnalysis =
    aiData.marketAnalysis && typeof aiData.marketAnalysis === "object"
      ? aiData.marketAnalysis
      : null;

  const marketSummary = toSafeText(marketAnalysis?.summary);
  const competitorInsight =
    marketAnalysis?.competitorInsight &&
    typeof marketAnalysis.competitorInsight === "object"
      ? marketAnalysis.competitorInsight
      : null;
  const footTrafficInsight =
    marketAnalysis?.footTrafficInsight &&
    typeof marketAnalysis.footTrafficInsight === "object"
      ? marketAnalysis.footTrafficInsight
      : null;
  const demographicInsight =
    marketAnalysis?.demographicInsight &&
    typeof marketAnalysis.demographicInsight === "object"
      ? marketAnalysis.demographicInsight
      : null;

  const directCompetitors = toSafeStringArray(financials?.directCompetitors);
  const otherCompetitors = toSafeStringArray(financials?.otherCompetitors);
  const nearbyEstablishments = toSafeStringArray(
    financials?.nearbyEstablishments
  );
  const footTrafficPeak = toSafeText(financials?.footTrafficPeak);
  const marketDemandNotes = toSafeText(financials?.marketDemandNotes);
  const marketDemand = toSafeText(financials?.marketDemand, "Medium");

  const showMarketSection =
    directCompetitors.length > 0 ||
    otherCompetitors.length > 0 ||
    nearbyEstablishments.length > 0 ||
    Boolean(footTrafficPeak) ||
    Boolean(marketDemandNotes) ||
    Boolean(marketSummary);

  return (
    <div className="space-y-8 min-w-0">
      {/* AI Advisory Disclaimer Banner (Adviser Portal View) */}
      {viewerRole === "adviser" && <AIAdvisoryDisclaimerBanner />}

      {/* 1. Feasibility Verdict Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 md:p-8 shadow-sm min-w-0">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
          <div className="flex-shrink-0">
            <div
              className={`flex items-center justify-center w-20 h-20 rounded-2xl shadow-inner mx-auto md:mx-0 ${
                feasibilityStatus === "FEASIBLE"
                  ? "bg-emerald-500"
                  : feasibilityStatus === "CONDITIONALLY_FEASIBLE"
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
            >
              <Zap className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center md:items-start min-w-0 w-full">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 mb-2.5 flex-wrap justify-center sm:justify-start">
              <h2 className="text-2xl font-extrabold text-[#122244]">
                Feasibility Verdict
              </h2>
              <span
                className={`inline-block px-3 py-1 text-white text-xs font-black uppercase rounded-full shadow-2xs tracking-wide ${
                  feasibilityStatus === "FEASIBLE"
                    ? "bg-emerald-600"
                    : feasibilityStatus === "CONDITIONALLY_FEASIBLE"
                      ? "bg-amber-500"
                      : "bg-rose-600"
                }`}
              >
                {feasibilityStatus === "CONDITIONALLY_FEASIBLE"
                  ? "CONDITIONALLY FEASIBLE"
                  : feasibilityStatus?.replace(/_/g, " ")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border bg-amber-50 border-amber-200 text-amber-800 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                AI-Generated Assessment
              </span>
              {performanceGrade && (
                <span
                  className={`inline-block px-3 py-1 text-xs font-bold rounded-full border ${
                    feasibilityStatus === "FEASIBLE"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : feasibilityStatus === "CONDITIONALLY_FEASIBLE"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  Grade: {performanceGrade}
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              {feasibilityExplanation}
            </p>
            {performanceRecommendation && (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-500 w-full text-left">
                <span className="font-bold text-gray-700 block mb-1">
                  Recommendation:
                </span>
                {performanceRecommendation}
              </div>
            )}
            {feasibilityTip && (
              <div
                className={`mt-3 inline-flex items-center gap-2 px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-medium border text-left ${
                  feasibilityStatus === "FEASIBLE"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : feasibilityStatus === "CONDITIONALLY_FEASIBLE"
                      ? "bg-amber-50 text-amber-900 border-amber-200"
                      : "bg-rose-50 text-rose-900 border-rose-200"
                }`}
              >
                <Lightbulb size={16} className="flex-shrink-0 text-amber-600" />
                <span>
                  <strong className="mr-1">
                    {feasibilityStatus === "FEASIBLE" ? "Next Step:" : "Key Fix:"}
                  </strong>
                  {feasibilityTip}
                </span>
              </div>
            )}

            <div className="mt-3.5 flex items-center gap-2 text-xs text-gray-500 w-full text-left">
              <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" aria-hidden="true" />
              <span className="text-[11px] text-gray-500 leading-normal">
                <strong className="text-gray-700 font-semibold">Advisory Reminder:</strong> AI-generated evaluation. Validate all findings and next steps with your research adviser.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Action Guide: 3-Tier Defense System */}
      {feasibilityStatus === "FEASIBLE" ? (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border-2 border-emerald-200 p-5 sm:p-6 md:p-8 shadow-sm min-w-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="text-4xl sm:text-5xl">🎉</div>
            <div className="flex-1 w-full min-w-0">
              <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Defense Ready
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-950">
                  Excellent News! Ready for Defense
                </h3>
              </div>
              <p className="text-emerald-800 font-medium mb-4 text-sm sm:text-base">
                {viewerRole === "adviser"
                  ? "This feasibility study demonstrates sound business fundamentals and realistic financial projections:"
                  : "Your feasibility study demonstrates sound business fundamentals and realistic financial projections:"}
              </p>
              <ul className="space-y-2.5 text-emerald-900 text-sm text-left">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>
                    <strong>Defensible Profit Margins:</strong> Net profit is positive and within normal commercial standards.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>
                    <strong>Cash Safety Buffer:</strong> Cash reserves cover recurring monthly bills without risk of immediate deficit.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>
                    <strong>Realistic Capital Payback:</strong> Initial capital investments are projected to recover within 3 years.
                  </span>
                </li>
              </ul>
              <div className="mt-5 p-4 bg-white/80 rounded-xl border border-emerald-200 text-left">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Recommended Defense Next Steps:
                </p>
                <ul className="text-sm text-emerald-900 space-y-1.5">
                  <li className="flex gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>
                      {viewerRole === "adviser"
                        ? "Advise the team to export their final feasibility report for defense presentation slides."
                        : "Export your final feasibility report for your defense presentation slides."}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>
                      {viewerRole === "adviser"
                        ? "Verify supplier quotations so students can defend raw material costs during Q&A."
                        : "Prepare supplier quotations to defend your raw material costs during Q&A."}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>
                      {viewerRole === "adviser"
                        ? "Have presenters highlight their break-even sales target to show panelists the sales plan is achievable."
                        : "Highlight your break-even sales target to show panelists your sales plan is achievable."}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : feasibilityStatus === "CONDITIONALLY_FEASIBLE" ? (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-300 p-5 sm:p-6 md:p-8 shadow-sm min-w-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="text-4xl sm:text-5xl">⚠️</div>
            <div className="flex-1 w-full min-w-0">
              <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-200 text-amber-900 border border-amber-300">
                  Action Required Before Defense
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-amber-950">
                  Defense Revision Checklist
                </h3>
              </div>
              <p className="text-amber-900 font-medium mb-4 text-sm sm:text-base">
                {viewerRole === "adviser" ? (
                  <>
                    This project is conditionally viable, but defense panelists will challenge these specific numbers. Students should adjust them in{" "}
                    <strong>Financial Input</strong> before final defense:
                  </>
                ) : (
                  <>
                    Your project is conditionally viable, but defense panelists will challenge these specific numbers. Adjust them in{" "}
                    <strong>Financial Input</strong> before your final defense:
                  </>
                )}
              </p>

              {/* Dynamic List of Specific Severe Flags */}
              <div className="space-y-3 mb-5">
                {validSevereFlags.length > 0 ? (
                  validSevereFlags.map((flag, idx) => {
                    if (!flag || typeof flag !== "object") return null;
                    const flagTitle = toSafeText(flag.title, "Flagged Item");
                    const flagDescription = toSafeText(flag.description);
                    const flagTip = toSafeText(flag.tip);
                    return (
                      <div
                        key={toSafeText(flag.id) || idx}
                        className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs text-left"
                      >
                        <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <h4 className="font-bold text-[#122244] text-sm">
                              {flagTitle}
                            </h4>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded shrink-0">
                            Fix Needed
                          </span>
                        </div>
                        {flagDescription && (
                          <p className="text-xs text-gray-700 leading-relaxed mb-2">
                            {flagDescription}
                          </p>
                        )}
                        {flagTip && (
                          <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900 font-medium flex items-start gap-2">
                            <span className="font-extrabold text-amber-700 shrink-0">
                              Action:
                            </span>
                            <span>{flagTip}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-white rounded-xl border border-amber-200 p-4 text-left">
                    <p className="text-xs text-gray-700">
                      Review your profit margins and operating expenses to ensure they align with typical business benchmarks.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/80 rounded-xl border border-amber-200 text-left">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  How to Clear These Flags:
                </p>
                <ul className="text-sm text-amber-950 space-y-1.5">
                  <li className="flex gap-2">
                    <span className="font-bold text-amber-700">1.</span>
                    <span>
                      {viewerRole === "adviser" ? (
                        <>
                          Ask the student team to update selling prices, overhead, or cash reserves in{" "}
                          <strong>Financial Input</strong>.
                        </>
                      ) : (
                        <>
                          Click <strong>Revise Financial Data</strong> below to update selling prices, overhead, or cash reserves.
                        </>
                      )}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-amber-700">2.</span>
                    <span>
                      {viewerRole === "adviser" ? (
                        <>
                          Have the team run <strong>AI Feasibility Analysis</strong> again to re-audit their revised numbers.
                        </>
                      ) : (
                        <>
                          Click <strong>Run Feasibility Analysis</strong> again to re-audit your revised numbers.
                        </>
                      )}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-amber-700">3.</span>
                    <span>
                      Once flags are cleared, the verdict will elevate to{" "}
                      <strong>FEASIBLE</strong>.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-rose-50 to-red-50 rounded-2xl border-2 border-rose-300 p-5 sm:p-6 md:p-8 shadow-sm min-w-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="text-4xl sm:text-5xl">🛑</div>
            <div className="flex-1 w-full min-w-0">
              <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-200 text-rose-900 border border-rose-300">
                  Critical Defense Warning
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-rose-950">
                  Major Financial Revisions Required
                </h3>
              </div>
              <p className="text-rose-900 font-medium mb-4 text-sm sm:text-base">
                This study cannot pass defense in its current state due to critical financial deficits:
              </p>
              <div className="space-y-2 mb-5">
                {fatalFlaws.length > 0 ? (
                  fatalFlaws.map((flaw, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl border border-rose-200 p-3.5 shadow-2xs text-left flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-rose-900 font-medium">
                        {flaw}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-xl border border-rose-200 p-3.5 text-left">
                    <span className="text-xs text-rose-900 font-medium">
                      Business operates at a net monthly loss or has negative gross margins.
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-white/80 rounded-xl border border-rose-200 text-left">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Required Revisions Before Defense:
                </p>
                <ul className="text-sm text-rose-950 space-y-1.5">
                  <li className="flex gap-2">
                    <span className="font-bold text-rose-700">1.</span>
                    <span>
                      Ensure unit selling price is higher than the unit cost of production.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-rose-700">2.</span>
                    <span>
                      Increase declared startup capital so it fully covers all initial equipment.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-rose-700">3.</span>
                    <span>
                      Adjust monthly sales volume or reduce fixed monthly bills to stop operating at a loss.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Market Environment & Competitive Landscape */}
      {showMarketSection && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 md:p-8 shadow-sm space-y-5 min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#c9a654]/15 border border-[#c9a654]/30 flex items-center justify-center text-[#c9a654] shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold text-[#122244]">
                  Market Indicators & Competitive Landscape
                </h3>
                <p className="text-xs text-gray-500">
                  Audited competitor density, nearby establishment foot traffic & business ROI drivers
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black rounded-lg shrink-0">
              {marketDemand} Demand Profile
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Direct Competitors */}
            <div className="p-4 bg-gray-50/70 border border-gray-200/80 rounded-xl space-y-2.5 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1.5">
                  <Store size={14} className="text-[#c9a654] shrink-0" /> Direct Competitors
                </span>
                <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded shrink-0">
                  {directCompetitors.length} Listed
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {directCompetitors.length > 0 ? (
                  directCompetitors.map((comp, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-white border border-amber-200 text-amber-900 text-xs font-bold rounded-lg shadow-2xs"
                    >
                      {comp}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">
                    None specified in financial input.
                  </span>
                )}
              </div>
            </div>

            {/* Other / Indirect Competitors */}
            <div className="p-4 bg-gray-50/70 border border-gray-200/80 rounded-xl space-y-2.5 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-sky-600 shrink-0" /> Other / Indirect Competitors
                </span>
                <span className="text-[10px] font-black text-sky-700 bg-sky-100 px-2 py-0.5 rounded shrink-0">
                  {otherCompetitors.length} Listed
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {otherCompetitors.length > 0 ? (
                  otherCompetitors.map((comp, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-white border border-sky-200 text-sky-900 text-xs font-bold rounded-lg shadow-2xs"
                    >
                      {comp}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">
                    None specified in financial input.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Nearby Establishments Driving ROI */}
          <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-xl space-y-2.5 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={14} className="text-emerald-600 shrink-0" /> Nearby Establishments Affecting ROI (Foot Traffic Drivers)
              </span>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                {nearbyEstablishments.length} Establishments
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {nearbyEstablishments.length > 0 ? (
                nearbyEstablishments.map((est, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-950 text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1"
                  >
                    <MapPin size={11} className="text-emerald-600 shrink-0" /> {est}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">
                  No nearby establishments listed.
                </span>
              )}
            </div>
            {footTrafficPeak && (
              <p className="text-xs text-emerald-800 pt-1">
                <strong>Foot Traffic Pattern:</strong> {footTrafficPeak}
              </p>
            )}
            {marketDemandNotes && (
              <p className="text-xs text-gray-600 italic bg-white/70 p-2.5 rounded-lg border border-emerald-100 mt-2">
                "{marketDemandNotes}"
              </p>
            )}
          </div>

          {/* AI Market Indicators & Viability Evaluation */}
          <div className="pt-4 border-t border-gray-100 space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={14} className="text-[#c9a654] shrink-0" /> AI Market Viability & Competitive Intelligence
              </span>
              {toSafeText(competitorInsight?.badge) && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                  Market Feasibility Audited
                </span>
              )}
            </div>

            {marketSummary ? (
              <div className="space-y-3">
                {/* High-Level Narrative Summary */}
                <div className="p-3.5 bg-amber-50/60 border border-amber-200/70 rounded-xl text-xs sm:text-sm text-[#122244] leading-relaxed">
                  <span className="font-bold text-amber-900">
                    Market Assessment:{" "}
                  </span>
                  {marketSummary}
                </div>

                {/* 3 Structured Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Pillar 1: Competitors */}
                  {competitorInsight && (
                    <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-2xs space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1">
                          <Store size={12} className="text-amber-600 shrink-0" /> Competitor Density
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 ${
                            competitorInsight.status === "positive"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {toSafeText(competitorInsight.badge, "Reviewed")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-normal">
                        {toSafeText(competitorInsight.text)}
                      </p>
                    </div>
                  )}

                  {/* Pillar 2: Foot Traffic & Anchors */}
                  {footTrafficInsight && (
                    <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-2xs space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1">
                          <Building2 size={12} className="text-emerald-600 shrink-0" /> Foot Traffic & Anchors
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 ${
                            footTrafficInsight.status === "positive"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {toSafeText(footTrafficInsight.badge, "Reviewed")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-normal">
                        {toSafeText(footTrafficInsight.text)}
                      </p>
                    </div>
                  )}

                  {/* Pillar 3: Demographics & Pricing */}
                  {demographicInsight && (
                    <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-2xs space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1">
                          <Lightbulb size={12} className="text-sky-600 shrink-0" /> Demographic Strategy
                        </span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-sky-100 text-sky-800 border border-sky-200 shrink-0">
                          {toSafeText(demographicInsight.badge, "Reviewed")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-normal">
                        {toSafeText(demographicInsight.text)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center">
                <p className="text-xs text-gray-500 italic">
                  Run AI Feasibility Analysis to evaluate competitor density, walk-in foot traffic, and demographic viability.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. 5-Year Pro Forma Financial Projection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 md:p-8 shadow-sm min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-extrabold text-[#122244] flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#c9a654] flex-shrink-0" />{" "}
            5-Year Pro Forma Financial Projection
          </h3>
          <button
            type="button"
            onClick={() => setShowProFormaInputs(!showProFormaInputs)}
            className="w-full sm:w-auto text-[11px] font-bold uppercase text-[#c9a654] hover:text-[#a87d3a] transition-colors px-3 py-2 sm:py-1.5 border border-[#c9a654]/30 rounded-lg hover:bg-[#c9a654]/5 flex-shrink-0 cursor-pointer"
          >
            {showProFormaInputs ? "Hide" : "Show"} Assumptions
          </button>
        </div>

        {/* Growth Rate Inputs */}
        {showProFormaInputs && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-2">
                Revenue Growth Rate (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={revenueGrowthRate}
                  onChange={(e) => setRevenueGrowthRate(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#c9a654]"
                />
                <div className="w-12 px-2 py-1.5 text-center bg-white border border-gray-300 rounded font-bold text-[#122244] text-sm tabular-nums">
                  {revenueGrowthRate}%
                </div>
              </div>
              <p className="text-[9px] text-gray-500 mt-1 italic">
                Projected annual revenue increase
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-2">
                Cost Growth Rate (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={costGrowthRate}
                  onChange={(e) => setCostGrowthRate(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#c9a654]"
                />
                <div className="w-12 px-2 py-1.5 text-center bg-white border border-gray-300 rounded font-bold text-[#122244] text-sm tabular-nums">
                  {costGrowthRate}%
                </div>
              </div>
              <p className="text-[9px] text-gray-500 mt-1 italic">
                Projected annual cost increase
              </p>
            </div>
          </div>
        )}

        {/* Metric Filter Badges & View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
              Metrics:
            </span>
            {(() => {
              const yr5 = chartData[chartData.length - 1];
              return PRO_FORMA_SERIES_CONFIG.map((series) => {
                const isVisible = visibleSeries[series.key];
                const yr5Val = yr5 ? yr5[series.key] : null;

                return (
                  <button
                    key={series.key}
                    type="button"
                    onClick={() => toggleSeries(series.key)}
                    title={`Click to ${isVisible ? "hide" : "show"} ${series.label}`}
                    className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border cursor-pointer ${
                      isVisible
                        ? `${series.lightBg} ${series.borderActive} ${series.textActive} shadow-xs`
                        : "bg-gray-50 border-gray-200 text-gray-400 opacity-60 hover:opacity-80"
                    }`}
                  >
                    <span
                      className={`transition-transform group-hover:scale-110 flex-shrink-0 ${
                        series.type === "line"
                          ? "w-3 h-1 rounded-full"
                          : "w-2.5 h-2.5 rounded-xs"
                      }`}
                      style={{
                        backgroundColor: isVisible ? series.color : "#9ca3af",
                      }}
                    />
                    <span
                      className={
                        isVisible
                          ? "font-bold text-[11px]"
                          : "line-through text-gray-400 text-[11px]"
                      }
                    >
                      {series.shortLabel}
                    </span>
                    {typeof yr5Val === "number" && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors tabular-nums ${
                          isVisible
                            ? "bg-white/80 text-gray-700 shadow-2xs"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        Yr 5: {formatProFormaCurrency(yr5Val)}
                      </span>
                    )}
                  </button>
                );
              });
            })()}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle: Grouped vs Stacked */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
              <button
                type="button"
                onClick={() => setChartMode("grouped")}
                className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                  chartMode === "grouped"
                    ? "bg-white text-[#122244] shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Grouped Bars
              </button>
              <button
                type="button"
                onClick={() => setChartMode("stacked")}
                className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                  chartMode === "stacked"
                    ? "bg-white text-[#122244] shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Stacked Costs
              </button>
            </div>

            {Object.values(visibleSeries).some((v) => !v) && (
              <button
                type="button"
                onClick={showAllSeries}
                className="text-[11px] font-bold text-gray-500 hover:text-[#c9a654] transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Executive Combo Chart Canvas */}
        <div className="mb-6 w-full min-w-0 relative h-[320px] sm:h-[380px] md:h-[430px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 18, right: 20, left: 4, bottom: 20 }}
              barGap={chartMode === "grouped" ? 4 : 0}
              barCategoryGap="22%"
            >
              <defs>
                {/* Revenue Bar Gradient */}
                <linearGradient
                  id={`revenueBarGrad-${chartUid}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#047857" stopOpacity={0.85} />
                </linearGradient>
                {/* COGS Bar Gradient */}
                <linearGradient
                  id={`cogsBarGrad-${chartUid}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#be123c" stopOpacity={0.8} />
                </linearGradient>
                {/* Fixed Costs Bar Gradient */}
                <linearGradient
                  id={`fixedCostsBarGrad-${chartUid}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#b45309" stopOpacity={0.8} />
                </linearGradient>
                {/* Net Profit Flow Aura */}
                <linearGradient
                  id={`netProfitAura-${chartUid}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                dy={8}
                padding={{ left: 20, right: 20 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
                tickFormatter={formatProFormaCurrency}
                width={65}
                dx={-4}
              />
              <Tooltip content={<ProFormaCustomTooltip />} />

              {visibleSeries["Revenue"] && (
                <Bar
                  dataKey="Revenue"
                  name="Revenue"
                  fill={`url(#revenueBarGrad-${chartUid})`}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={34}
                />
              )}
              {visibleSeries["COGS"] && (
                <Bar
                  dataKey="COGS"
                  name="COGS"
                  stackId={chartMode === "stacked" ? "expenses" : undefined}
                  fill={`url(#cogsBarGrad-${chartUid})`}
                  radius={
                    chartMode === "grouped" ||
                    !visibleSeries["Fixed Costs"] ||
                    !chartData.some((d) => (d["Fixed Costs"] || 0) > 0)
                      ? [6, 6, 0, 0]
                      : [0, 0, 0, 0]
                  }
                  maxBarSize={34}
                />
              )}
              {visibleSeries["Fixed Costs"] && (
                <Bar
                  dataKey="Fixed Costs"
                  name="Fixed Costs"
                  stackId={chartMode === "stacked" ? "expenses" : undefined}
                  fill={`url(#fixedCostsBarGrad-${chartUid})`}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={34}
                />
              )}
              {visibleSeries["Net Profit"] && (
                <Area
                  type="monotone"
                  dataKey="Net Profit"
                  name="Net Profit"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill={`url(#netProfitAura-${chartUid})`}
                  dot={{
                    fill: "#ffffff",
                    stroke: "#2563eb",
                    strokeWidth: 2.5,
                    r: 4.5,
                  }}
                  activeDot={{
                    fill: "#2563eb",
                    stroke: "#ffffff",
                    strokeWidth: 3,
                    r: 7,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Pro Forma Summary Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-bold text-gray-700 whitespace-nowrap">
                  Metric
                </th>
                {chartData.map((row, idx) => (
                  <th
                    key={idx}
                    className="text-right px-4 py-3 font-bold text-gray-700 whitespace-nowrap"
                  >
                    {row.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                  Revenue
                </td>
                {chartData.map((row, idx) => (
                  <td
                    key={idx}
                    className="text-right px-4 py-3 text-emerald-600 font-bold tabular-nums whitespace-nowrap"
                  >
                    ₱{row.Revenue.toLocaleString("en-PH")}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                  COGS
                </td>
                {chartData.map((row, idx) => (
                  <td
                    key={idx}
                    className="text-right px-4 py-3 text-rose-600 font-bold tabular-nums whitespace-nowrap"
                  >
                    ₱{row.COGS.toLocaleString("en-PH")}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                  Fixed Costs
                </td>
                {chartData.map((row, idx) => (
                  <td
                    key={idx}
                    className="text-right px-4 py-3 text-amber-600 font-bold tabular-nums whitespace-nowrap"
                  >
                    ₱{row["Fixed Costs"].toLocaleString("en-PH")}
                  </td>
                ))}
              </tr>
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td className="px-4 py-3 font-extrabold text-blue-900 whitespace-nowrap">
                  Net Profit
                </td>
                {chartData.map((row, idx) => {
                  const net = row["Net Profit"];
                  return (
                    <td
                      key={idx}
                      className={`text-right px-4 py-3 font-extrabold tabular-nums whitespace-nowrap ${
                        net >= 0 ? "text-blue-600" : "text-rose-600"
                      }`}
                    >
                      {net < 0 ? "-" : ""}₱
                      {Math.abs(net).toLocaleString("en-PH")}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pro Forma Insights */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-[11px] font-bold text-blue-900 uppercase mb-2">
            💡 Projection Insights
          </p>
          <ul className="text-sm text-blue-800 space-y-1">
            {proFormaSummary.year1Revenue <= 0 ? (
              <li>• {proFormaProjection.insights[0]}</li>
            ) : (
              <>
                <li>
                  • Revenue is projected to grow at{" "}
                  <strong>{revenueGrowthRate}% annually</strong>, reaching{" "}
                  <strong>
                    ₱{proFormaSummary.year5Revenue.toLocaleString("en-PH")}
                  </strong>{" "}
                  by Year 5 (
                  <strong>
                    +₱{proFormaSummary.revenueIncrease.toLocaleString("en-PH")}
                  </strong>{" "}
                  over Year 1),{" "}
                  {proFormaSummary.isNetProfitGrowing
                    ? "showing strong profit expansion"
                    : "indicating need for cost optimization"}
                  .
                </li>
                <li>
                  • 5-Year cumulative net profit totals{" "}
                  <strong>
                    {proFormaSummary.cumulativeNetProfit < 0 ? "-" : ""}₱
                    {Math.abs(
                      proFormaSummary.cumulativeNetProfit
                    ).toLocaleString("en-PH")}
                  </strong>{" "}
                  across{" "}
                  <strong>
                    ₱{proFormaSummary.cumulativeRevenue.toLocaleString("en-PH")}
                  </strong>{" "}
                  in total projected sales (Year 5 net margin:{" "}
                  <strong>{proFormaSummary.year5NetMarginPct}%</strong>).
                </li>
              </>
            )}
          </ul>
        </div>
      </div>

      {/* 5. Strategic Insights & Financial Health (4 Core Feasibility Pillars) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 md:p-8 shadow-sm min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-gray-100 gap-2 mb-6">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-[#122244] flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#c9a654] shrink-0" />{" "}
              Strategic Insights & Financial Health
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Audited benchmarks for profit margins, cash safety buffer, break-even targets, and payback speed
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md shrink-0">
            4 Core Feasibility Pillars
          </span>
        </div>

        {insights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, idx) => {
              if (!insight || typeof insight !== "object") return null;
              const isPos = insight.type === "positive";
              const isWarn = insight.type === "warning";
              const insightTitle = toSafeText(
                insight.title,
                `Insight ${idx + 1}`
              );
              const insightDesc = toSafeText(insight.description);
              return (
                <div
                  key={toSafeText(insight.id) || idx}
                  className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between transition-all shadow-2xs hover:shadow-xs bg-white min-w-0 ${
                    isPos
                      ? "border-emerald-200/90"
                      : isWarn
                        ? "border-amber-300"
                        : "border-sky-200"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isPos
                              ? "bg-emerald-50 text-emerald-600"
                              : isWarn
                                ? "bg-amber-50 text-amber-600"
                                : "bg-sky-50 text-sky-600"
                          }`}
                        >
                          {isPos ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isWarn ? (
                            <AlertCircle className="w-4 h-4" />
                          ) : (
                            <Lightbulb className="w-4 h-4" />
                          )}
                        </div>
                        <h4 className="font-extrabold text-[#122244] text-sm">
                          {insightTitle}
                        </h4>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                          isPos
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isWarn
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-sky-50 text-sky-700 border border-sky-200"
                        }`}
                      >
                        {isPos ? "Healthy" : isWarn ? "Needs Review" : "Good"}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                      {insightDesc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
            <Lightbulb className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm font-medium">
              Run Feasibility Analysis to calculate strategic insights.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeasibilityAnalysisReport;
