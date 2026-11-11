import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Download,
  FileText,
  Folder,
  Layers,
  Lock,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  User,
  Users,
  Zap,
} from "lucide-react";
import {
  normalizeProposalProducts,
  computeProductMetrics,
} from "../utils/productCosting";
import {
  resolveSyncedAIAnalysis,
  resolveProposalMonthAndDraft,
  toEpochMs,
  type ResolvedAIAnalysisData,
} from "../utils/aiAnalysisHelpers";
import type { ChairpersonRosterMember } from "../services/chairpersonFeasibilityService";
import { getOtherRelevantInformation } from "../utils/proposalDetails";
import FeasibilityAnalysisReport from "./FeasibilityAnalysisReport";

export interface ActiveBusinessDetailViewProps {
  group: any;
  proposal: any;
  groupNumber?: number;
  adviserName: string;
  advisers?: string[];
  rosterMembers?: ChairpersonRosterMember[];
  students?: any[];
  readOnlyBadgeLabel?: string;
  backLabel?: string;
  onBack: () => void;
  onOpenGroupHistory?: () => void;
  canPostFeedback?: boolean;
  feedbackInput?: string;
  onFeedbackInputChange?: (val: string) => void;
  onSubmitFeedback?: () => void;
  isSavingFeedback?: boolean;
  onExportAnalysis?: (aiData: ResolvedAIAnalysisData) => void;
  onReanalyze?: () => void;
  isExportingAnalysis?: boolean;
  isAnalyzing?: boolean;
}

const getInitials = (name?: string): string => {
  const clean = (name || "").trim();
  if (!clean) return "BZ";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
};

const formatBulletinTimestamp = (rawDate: any): string => {
  if (!rawDate) return "Recently";
  const epoch = toEpochMs(rawDate);
  if (epoch > 0) {
    return new Date(epoch).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "Recently";
};

const ActiveBusinessDetailView: React.FC<ActiveBusinessDetailViewProps> = ({
  group,
  proposal,
  groupNumber,
  adviserName,
  advisers,
  rosterMembers,
  students = [],
  readOnlyBadgeLabel = "READ-ONLY ADVISER VIEW",
  backLabel = "Back",
  onBack,
  onOpenGroupHistory,
  canPostFeedback = false,
  feedbackInput = "",
  onFeedbackInputChange,
  onSubmitFeedback,
  isSavingFeedback = false,
  onExportAnalysis,
  onReanalyze,
  isExportingAnalysis = false,
  isAnalyzing = false,
}) => {
  const [activeTab, setActiveTab] = useState<"Profile" | "Financial" | "AI">(
    "Profile"
  );
  const [finSubTab, setFinSubTab] = useState<"operations" | "market">(
    "operations"
  );
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => {
    const ctx = resolveProposalMonthAndDraft(proposal);
    return ctx.monthlyRecords ? ctx.monthIndex : 0;
  });
  const [selectedDraftId, setSelectedDraftId] = useState<string>(() => {
    const ctx = resolveProposalMonthAndDraft(proposal);
    return ctx.monthlyRecords && ctx.drafts ? ctx.draftId : "";
  });
  const [expandedProducts, setExpandedProducts] = useState<
    Record<string, boolean>
  >({});
  const [logoError, setLogoError] = useState<boolean>(false);

  const resolvedLogoUrl = useMemo(() => {
    const pLogo =
      typeof proposal?.businessLogo === "string"
        ? proposal.businessLogo.trim()
        : "";
    if (pLogo) return pLogo;
    const gLogo =
      typeof group?.businessLogo === "string" ? group.businessLogo.trim() : "";
    if (gLogo) return gLogo;
    const cLogo =
      typeof group?.companyLogo === "string" ? group.companyLogo.trim() : "";
    return cLogo;
  }, [proposal?.businessLogo, group?.businessLogo, group?.companyLogo]);

  useEffect(() => {
    const ctx = resolveProposalMonthAndDraft(proposal);
    setSelectedMonthIndex(ctx.monthlyRecords ? ctx.monthIndex : 0);
    setSelectedDraftId(ctx.monthlyRecords && ctx.drafts ? ctx.draftId : "");
    setActiveTab("Profile");
    setFinSubTab("operations");
    setExpandedProducts({});
    setLogoError(false);
  }, [proposal?.id]);

  useEffect(() => {
    setLogoError(false);
  }, [resolvedLogoUrl]);

  const resolvedGroupNumber =
    typeof groupNumber === "number" && groupNumber > 0 ? groupNumber : 1;

  const displayBusinessName =
    proposal?.businessName ||
    group?.businessName ||
    group?.title ||
    "Active Business";
  const displayBusinessType = proposal?.businessType || "Uncategorized";
  const displaySection = group?.section || "Unknown Section";

  const normalizedAdvisers = useMemo(() => {
    const fromArray = Array.isArray(advisers)
      ? advisers
          .map((a) => (typeof a === "string" ? a.trim() : ""))
          .filter((a) => a && a !== "Unassigned")
      : [];
    if (fromArray.length > 0) return Array.from(new Set(fromArray));

    const fallback = typeof adviserName === "string" ? adviserName.trim() : "";
    if (fallback && fallback !== "Unassigned") {
      return Array.from(
        new Set(
          fallback
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && s !== "Unassigned")
        )
      );
    }
    return [];
  }, [advisers, adviserName]);

  const bannerAdviserText =
    normalizedAdvisers.length > 0 ? normalizedAdvisers.join(", ") : "Unassigned";

  const resolvedRosterMembers: ChairpersonRosterMember[] = useMemo(() => {
    if (Array.isArray(rosterMembers) && rosterMembers.length > 0) {
      return rosterMembers;
    }

    const members: ChairpersonRosterMember[] = [];
    const seenIds = new Set<string>();
    const leaderId = typeof group?.leaderId === "string" ? group.leaderId : "";
    const leaderStudent = (students || []).find((s: any) => s?.id === leaderId);
    const leaderFullName =
      group?.leaderName ||
      (leaderStudent
        ? `${leaderStudent.firstName || ""} ${leaderStudent.lastName || ""}`.trim()
        : "") ||
      "Group Leader";

    members.push({
      id: leaderId || "leader",
      name: leaderFullName,
      studentId: leaderStudent?.studentId || "ID Unknown",
      role: "Leader",
    });
    if (leaderId) seenIds.add(leaderId);

    const memberIds = Array.isArray(group?.memberIds) ? group.memberIds : [];
    memberIds.forEach((memberId: string) => {
      if (!memberId || seenIds.has(memberId)) return;
      const member = (students || []).find((s: any) => s?.id === memberId);
      if (!member) return;
      seenIds.add(memberId);
      members.push({
        id: memberId,
        name:
          `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
          "Member",
        studentId: member.studentId || "ID Unknown",
        role: "Member",
      });
    });

    return members;
  }, [rosterMembers, group, students]);

  const feedbackHistory = Array.isArray(proposal?.feedbackHistory)
    ? proposal.feedbackHistory
    : [];

  const renderMonthAndDraftSelector = (
    monthlyRecords: any[] | null,
    currentMonthIndex: number,
    currentMonthRecord: any,
    drafts: any[] | null,
    currentDraft: any
  ) => {
    if (!monthlyRecords || monthlyRecords.length === 0) return null;

    return (
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar flex-1">
            {monthlyRecords.map((rec: any, idx: number) => {
              const isSelected = idx === currentMonthIndex;
              const isLocked = !!rec.isLocked;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedMonthIndex(idx);
                    setSelectedDraftId(
                      rec.activeDraftId || rec.drafts?.[0]?.id || ""
                    );
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
                    isSelected
                      ? "bg-[#122244] text-white border-[#122244] shadow-sm"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-[#c9a654]" />
                  <span>Month {rec.month || idx + 1}</span>
                  {isLocked ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 font-bold flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> LOCKED
                    </span>
                  ) : (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        isSelected
                          ? "bg-green-500/30 text-green-300"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      • ACTIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg border border-gray-200 shrink-0">
            Viewing Month {currentMonthRecord?.month || currentMonthIndex + 1}
          </span>
        </div>

        {/* DRAFTS BAR */}
        {drafts && drafts.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 overflow-x-auto text-xs custom-scrollbar">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 whitespace-nowrap flex items-center gap-1 shrink-0">
              <Layers className="w-3 h-3 text-[#c9a654]" /> Month{" "}
              {currentMonthRecord?.month || currentMonthIndex + 1} Drafts:
            </span>
            <div className="flex items-center gap-1.5">
              {drafts.map((d: any) => {
                const isDraftSelected =
                  d.id === (currentDraft?.id || drafts[0].id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDraftId(d.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      isDraftSelected
                        ? "bg-[#122244] text-white shadow-xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                    }`}
                  >
                    {d.name || "Draft"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Financial Calculations for Read-Only Display (100% Synchronized with Financial_input.tsx)
  const renderFinancialData = () => {
    const rawFin =
      proposal?.financialData || proposal?.originalProposalFinancials;
    if (!rawFin) {
      return (
        <div className="p-8 text-center text-gray-400 border border-dashed rounded-xl bg-white">
          No financial data has been input yet by the student team.
        </div>
      );
    }

    // 1. Resolve Monthly Records & Drafts
    const monthlyRecords =
      rawFin.monthlyRecords &&
      Array.isArray(rawFin.monthlyRecords) &&
      rawFin.monthlyRecords.length > 0
        ? rawFin.monthlyRecords
        : null;

    const currentMonthIndex = monthlyRecords
      ? Math.min(Math.max(0, selectedMonthIndex), monthlyRecords.length - 1)
      : 0;

    const currentMonthRecord = monthlyRecords
      ? monthlyRecords[currentMonthIndex]
      : null;

    const drafts =
      currentMonthRecord?.drafts &&
      Array.isArray(currentMonthRecord.drafts) &&
      currentMonthRecord.drafts.length > 0
        ? currentMonthRecord.drafts
        : null;

    const currentDraft = drafts
      ? drafts.find(
          (d: any) => d.id === (selectedDraftId || currentMonthRecord.activeDraftId)
        ) || drafts[0]
      : null;

    // The effective financials object for the selected month/draft
    const fin = currentDraft?.financials || currentMonthRecord?.financials || rawFin;

    // Proposal fallback products if any
    const proposalFallbackProducts =
      proposal?.products && proposal.products.length > 0
        ? proposal.products
        : proposal?.rawProposalData?.products &&
          proposal.rawProposalData.products.length > 0
        ? proposal.rawProposalData.products
        : proposal?.originalProposalFinancials?.products &&
          proposal.originalProposalFinancials.products.length > 0
        ? proposal.originalProposalFinancials.products
        : [];

    const normalizedProducts = normalizeProposalProducts(
      fin,
      displayBusinessName,
      proposalFallbackProducts
    );

    // Multi-product aggregate metrics (100% Identical to Financial_input.tsx)
    const firstProd = normalizedProducts[0];
    const firstMetrics = firstProd
      ? computeProductMetrics(firstProd)
      : {
          revenue: 0,
          cogsSold: 0,
          totalUnitsProduced: 0,
          unitsSold: 0,
          endingInventoryValue: 0,
          totalVat: 0,
          netSellingPrice: 0,
          sellingPrice: 0,
          unitCost: 0,
          totalBatchCost: 0,
          markupPct: 0,
          markupAmount: 0,
          computedBasePrice: 0,
        };

    const totalMultiRevenue = normalizedProducts.reduce(
      (sum, p) => sum + computeProductMetrics(p).revenue,
      0
    );
    const totalMultiVariableCost = normalizedProducts.reduce(
      (sum, p) => sum + computeProductMetrics(p).cogsSold,
      0
    );
    const totalMultiYield = normalizedProducts.reduce(
      (sum, p) => sum + computeProductMetrics(p).totalUnitsProduced,
      0
    );
    const totalMultiUnitsSold = normalizedProducts.reduce(
      (sum, p) => sum + computeProductMetrics(p).unitsSold,
      0
    );

    const safeSellingPrice =
      normalizedProducts.length > 1 && totalMultiUnitsSold > 0
        ? totalMultiRevenue / totalMultiUnitsSold
        : firstMetrics.netSellingPrice > 0
        ? firstMetrics.netSellingPrice
        : firstMetrics.sellingPrice > 0
        ? firstMetrics.sellingPrice
        : Number(fin.sellingPrice) || 0;

    const safeMonthlySales =
      normalizedProducts.length > 1
        ? totalMultiUnitsSold
        : firstMetrics.unitsSold > 0
        ? firstMetrics.unitsSold
        : Number(fin.monthlySales) || 0;

    const safeUnitsProduced =
      normalizedProducts.length > 1
        ? totalMultiYield
        : firstMetrics.totalUnitsProduced > 0
        ? firstMetrics.totalUnitsProduced
        : safeMonthlySales;

    const safeVariableCost =
      normalizedProducts.length > 1 && totalMultiUnitsSold > 0
        ? totalMultiVariableCost / totalMultiUnitsSold
        : firstMetrics.unitCost > 0
        ? firstMetrics.unitCost
        : Number(fin.variableCost) || 0;

    const safeFixedCosts =
      fin.opexList && fin.opexList.length > 0
        ? fin.opexList.reduce(
            (sum: number, item: any) => sum + (Number(item.amount) || 0),
            0
          )
        : Number(fin.fixedCosts) || 0;

    const calculatedEquipmentTotal =
      fin.equipmentList && fin.equipmentList.length > 0
        ? fin.equipmentList.reduce(
            (sum: number, item: any) =>
              sum +
              (Number(item.total) ||
                (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
            0
          )
        : Number(fin.startupCapital) || Number(proposal?.totalCapital) || 0;
    const safeStartupCapital = calculatedEquipmentTotal;

    const safeOperatingDays = Number(fin.operatingDays) || 300;

    const monthlyRevenue =
      normalizedProducts.length > 1
        ? totalMultiRevenue
        : safeSellingPrice * safeMonthlySales;
    const totalMonthlyVariableCosts =
      normalizedProducts.length > 1
        ? totalMultiVariableCost
        : safeVariableCost * safeMonthlySales;
    const grossProfitMargin =
      monthlyRevenue > 0
        ? ((monthlyRevenue - totalMonthlyVariableCosts) / monthlyRevenue) * 100
        : 0;
    const monthlyInterest =
      fin.isCapitalBorrowed && fin.interestRate
        ? (safeStartupCapital * (Number(fin.interestRate) / 100)) / 12
        : 0;
    const netMonthlyProfit =
      monthlyRevenue -
      totalMonthlyVariableCosts -
      safeFixedCosts -
      monthlyInterest;
    const monthlyNetProfitMargin =
      monthlyRevenue > 0 ? (netMonthlyProfit / monthlyRevenue) * 100 : 0;

    const annualRevenue = (monthlyRevenue / 30) * safeOperatingDays;
    const annualTax = annualRevenue * 0.03;

    const unitContributionMargin = safeSellingPrice - safeVariableCost;
    const breakEvenUnits =
      unitContributionMargin > 0
        ? Math.ceil(safeFixedCosts / unitContributionMargin)
        : "N/A";

    // Sources of Financing
    const sumFromContributors =
      fin.contributorsList && fin.contributorsList.length > 0
        ? fin.contributorsList.reduce(
            (sum: number, c: any) => sum + (Number(c.amount) || 0),
            0
          )
        : 0;
    const proposalCapNum = Number(proposal?.totalCapital || 0);
    const safeCashInvested =
      sumFromContributors > 0
        ? sumFromContributors
        : Number(fin.cashInvested) ||
          (proposalCapNum > 0 ? proposalCapNum : safeStartupCapital);
    const safePropertyInvested = Number(fin.propertyInvested) || 0;
    const totalInitialCapital = safeCashInvested + safePropertyInvested;

    // Startup Pre-Operating Costs
    const safeRentAdvance =
      Number(fin.rentAdvance) || Number(fin.rentAdvanceDeposit) || 0;
    const safeTrainings =
      Number(fin.trainings) || Number(fin.trainingsPrograms) || 0;
    const safeAdvertising =
      Number(fin.advertising) || Number(fin.advertisingExpense) || 0;
    const safeSalariesInitial =
      Number(fin.salariesInitial) || Number(fin.salariesExpenseInitial) || 0;
    const safeRenovationCosts = Number(fin.renovationCosts) || 0;
    const safePermitsLicenses = Number(fin.permitsLicensesInitial) || 0;
    const totalProjectCost =
      safeRentAdvance +
      safeTrainings +
      safeAdvertising +
      safeSalariesInitial +
      safeStartupCapital +
      safeRenovationCosts +
      safePermitsLicenses;

    // Formatted Hero KPI strings & responsive sizing so values stay cleanly within card bounds
    const monthlyExpensesTotal = totalMonthlyVariableCosts + safeFixedCosts;
    const formattedMonthlyRevenue = `₱${monthlyRevenue.toLocaleString(
      undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    )}`;
    const formattedMonthlyExpenses = `₱${monthlyExpensesTotal.toLocaleString(
      undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    )}`;
    const breakEvenDisplay =
      typeof breakEvenUnits === "number"
        ? breakEvenUnits.toLocaleString()
        : breakEvenUnits;
    const formattedGrossMargin = `${grossProfitMargin.toFixed(1)}%`;
    const formattedNetProfit = `${
      netMonthlyProfit < 0 ? "-" : ""
    }₱${Math.abs(netMonthlyProfit).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const getHeroValueSizeClass = (val: string) => {
      if (val.length >= 16) return "text-sm sm:text-base";
      if (val.length >= 13) return "text-base sm:text-lg";
      return "text-lg sm:text-xl";
    };

    // Product expansion helpers
    const toggleProductExpand = (key: string) => {
      setExpandedProducts((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    };
    const allProductsExpanded =
      normalizedProducts.length > 0 &&
      normalizedProducts.every(
        (p, idx) => !!expandedProducts[p.id || String(idx)]
      );
    const toggleAllProducts = () => {
      const nextState = !allProductsExpanded;
      const newMap: Record<string, boolean> = {};
      normalizedProducts.forEach((p, idx) => {
        newMap[p.id || String(idx)] = nextState;
      });
      setExpandedProducts(newMap);
    };

    return (
      <div className="space-y-6">
        {/* MULTI-MONTH SELECTOR (Synchronized with student monthly records) */}
        {renderMonthAndDraftSelector(
          monthlyRecords,
          currentMonthIndex,
          currentMonthRecord,
          drafts,
          currentDraft
        )}

        {/* SUB-TABS NAVIGATION (Operational & Market) */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl gap-2 border border-gray-200 shadow-inner">
          <button
            type="button"
            onClick={() => setFinSubTab("operations")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
              finSubTab === "operations"
                ? "bg-white text-[#122244] shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#c9a654]" /> Operational
            Inputs & Costing
          </button>
          <button
            type="button"
            onClick={() => setFinSubTab("market")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
              finSubTab === "market"
                ? "bg-white text-[#122244] shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Target className="w-3.5 h-3.5 text-[#c9a654]" /> Market &
            Competitive Indicators
          </button>
        </div>

        {/* TAB 1: OPERATIONAL INPUTS & COSTING */}
        {finSubTab === "operations" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 5 KPI Hero Cards (3+2 symmetrical bento on xl+, 2+2+1 on sm/lg, stacked on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3.5">
              {/* 1. Monthly Revenue */}
              <div className="xl:col-span-2 min-w-0 overflow-hidden bg-white rounded-xl border-l-4 border-l-emerald-500 p-4 shadow-sm border border-gray-100 flex flex-col justify-between">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    Monthly Revenue
                  </span>
                  <p
                    className={`${getHeroValueSizeClass(
                      formattedMonthlyRevenue
                    )} font-black text-emerald-600 tabular-nums tracking-tight whitespace-nowrap mt-0.5`}
                    title={formattedMonthlyRevenue}
                  >
                    {formattedMonthlyRevenue}
                  </p>
                </div>
                <div className="mt-2.5 text-[9px] text-gray-400 font-semibold bg-gray-50 py-1 px-1.5 rounded border border-gray-100 min-w-0 overflow-hidden">
                  {normalizedProducts.length > 1 ? (
                    <>
                      <span>
                        Sales: {safeMonthlySales.toLocaleString()} units sold
                      </span>
                      <p
                        className="text-[9px] text-[#c9a654] font-bold truncate"
                        title={`${safeUnitsProduced.toLocaleString()} produced • ${
                          normalizedProducts.length
                        } Products`}
                      >
                        {safeUnitsProduced.toLocaleString()} produced •{" "}
                        {normalizedProducts.length} Products
                      </p>
                    </>
                  ) : (
                    <>
                      <span>Price × Units Sold</span>
                      <p
                        className="text-[9px] text-[#c9a654] font-bold truncate"
                        title={`₱${safeSellingPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} × ${safeMonthlySales.toLocaleString()} sold (${safeUnitsProduced.toLocaleString()} produced)`}
                      >
                        ₱
                        {safeSellingPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        × {safeMonthlySales.toLocaleString()} sold (
                        {safeUnitsProduced.toLocaleString()} produced)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* 2. Monthly Expenses */}
              <div className="xl:col-span-2 min-w-0 overflow-hidden bg-white rounded-xl border-l-4 border-l-red-500 p-4 shadow-sm border border-gray-100 flex flex-col justify-between">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    Monthly Expenses
                  </span>
                  <p
                    className={`${getHeroValueSizeClass(
                      formattedMonthlyExpenses
                    )} font-black text-red-600 tabular-nums tracking-tight whitespace-nowrap mt-0.5`}
                    title={formattedMonthlyExpenses}
                  >
                    {formattedMonthlyExpenses}
                  </p>
                </div>
                <div className="mt-2.5 text-[9px] text-gray-400 font-semibold bg-gray-50 py-1 px-1.5 rounded border border-gray-100 min-w-0 overflow-hidden">
                  {normalizedProducts.length > 1 ? (
                    <>
                      <span>COGS (Units Sold) + Fixed</span>
                      <p
                        className="text-[9px] text-[#c9a654] font-bold truncate"
                        title={`₱${totalMonthlyVariableCosts.toLocaleString(
                          undefined,
                          { minimumFractionDigits: 0, maximumFractionDigits: 2 }
                        )} + ₱${safeFixedCosts.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}`}
                      >
                        ₱
                        {totalMonthlyVariableCosts.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}{" "}
                        + ₱
                        {safeFixedCosts.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </>
                  ) : (
                    <>
                      <span>[(COGS/Unit × Sold) + Fixed]</span>
                      <p
                        className="text-[9px] text-[#c9a654] font-bold truncate"
                        title={`(₱${safeVariableCost.toFixed(
                          2
                        )} × ${safeMonthlySales.toLocaleString()} sold) + ₱${safeFixedCosts.toLocaleString(
                          undefined,
                          { minimumFractionDigits: 0, maximumFractionDigits: 2 }
                        )}`}
                      >
                        (₱{safeVariableCost.toFixed(2)} ×{" "}
                        {safeMonthlySales.toLocaleString()} sold) + ₱
                        {safeFixedCosts.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* 3. Break-Even Point */}
              <div className="xl:col-span-2 min-w-0 overflow-hidden bg-white rounded-xl border-l-4 border-l-[#c9a654] p-4 shadow-sm border border-gray-100 flex flex-col justify-between">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    Break-Even Point
                  </span>
                  <p
                    className={`${getHeroValueSizeClass(
                      `${breakEvenDisplay} units`
                    )} font-black text-[#c9a654] tabular-nums tracking-tight whitespace-nowrap mt-0.5`}
                    title={`${breakEvenDisplay} units`}
                  >
                    {breakEvenDisplay}{" "}
                    <span className="text-[10px] text-gray-400 font-normal">
                      units
                    </span>
                  </p>
                </div>
                <div className="mt-2.5 text-[9px] text-gray-400 font-semibold bg-gray-50 py-1 px-1.5 rounded border border-gray-100 min-w-0 overflow-hidden">
                  <span>Monthly OpEx / Margin per Unit</span>
                  <p
                    className="text-[9px] text-[#c9a654] font-bold truncate"
                    title={`₱${safeFixedCosts.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })} / ₱${Math.max(
                      0,
                      safeSellingPrice - safeVariableCost
                    ).toFixed(2)}`}
                  >
                    ₱
                    {safeFixedCosts.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    / ₱
                    {Math.max(0, safeSellingPrice - safeVariableCost).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* 4. Gross Margin */}
              <div className="xl:col-span-3 min-w-0 overflow-hidden bg-white rounded-xl border-l-4 border-l-blue-500 p-4 shadow-sm border border-gray-100 flex flex-col justify-between">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    Gross Margin
                  </span>
                  <p
                    className={`${getHeroValueSizeClass(
                      formattedGrossMargin
                    )} font-black tabular-nums tracking-tight whitespace-nowrap mt-0.5 ${
                      grossProfitMargin >= 0 ? "text-blue-600" : "text-red-500"
                    }`}
                    title={formattedGrossMargin}
                  >
                    {formattedGrossMargin}
                  </p>
                </div>
                <div className="mt-2.5 text-[9px] text-gray-400 font-semibold bg-gray-50 py-1 px-1.5 rounded border border-gray-100 min-w-0 overflow-hidden">
                  <span>[(Revenue - COGS) / Revenue]</span>
                  <p
                    className="text-[9px] text-[#c9a654] font-bold truncate"
                    title={`(₱${monthlyRevenue.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} - ₱${totalMonthlyVariableCosts.toLocaleString(
                      undefined,
                      { maximumFractionDigits: 0 }
                    )}) / ₱${monthlyRevenue.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`}
                  >
                    (₱
                    {monthlyRevenue.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    - ₱
                    {totalMonthlyVariableCosts.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                    ) / ₱
                    {monthlyRevenue.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </div>

              {/* 5. Net Profit / Mo */}
              <div
                className={`sm:col-span-2 xl:col-span-3 min-w-0 overflow-hidden bg-white rounded-xl border-l-4 p-4 shadow-sm border border-gray-100 flex flex-col justify-between ${
                  netMonthlyProfit >= 0
                    ? "border-l-emerald-500"
                    : "border-l-red-500"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                      Net Profit / Mo
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        netMonthlyProfit >= 0
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-red-50 text-red-600 border border-red-200/60"
                      }`}
                      title="Net Profit Margin = (Net Profit ÷ Monthly Revenue) × 100"
                    >
                      {monthlyNetProfitMargin >= 0 ? "+" : ""}
                      {monthlyNetProfitMargin.toFixed(1)}%
                    </span>
                  </div>
                  <p
                    className={`${getHeroValueSizeClass(
                      formattedNetProfit
                    )} font-black tabular-nums tracking-tight whitespace-nowrap mt-0.5 ${
                      netMonthlyProfit < 0 ? "text-red-500" : "text-emerald-600"
                    }`}
                    title={formattedNetProfit}
                  >
                    {formattedNetProfit}
                  </p>
                </div>
                <div className="mt-2.5 text-[9px] text-gray-400 font-semibold bg-gray-50 py-1 px-1.5 rounded border border-gray-100 min-w-0 overflow-hidden">
                  <span>Revenue - Expenses</span>
                  <p
                    className="text-[9px] text-[#c9a654] font-bold truncate"
                    title={`₱${monthlyRevenue.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} - ₱${monthlyExpensesTotal.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}${
                      monthlyInterest > 0
                        ? ` - ₱${monthlyInterest.toLocaleString()} Int`
                        : ""
                    }`}
                  >
                    ₱
                    {monthlyRevenue.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    - ₱
                    {monthlyExpensesTotal.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                    {monthlyInterest > 0
                      ? ` - ₱${monthlyInterest.toLocaleString()} Int`
                      : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* PRODUCT COSTING, SALES & PRICING */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#122244] text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                    <Package size={16} className="text-[#c9a654]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm uppercase tracking-wider text-[#122244]">
                      Product Costing, Sales & Pricing
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Batch yield, raw material ingredients, mark-up percentage,
                      and target selling price ({normalizedProducts.length}{" "}
                      {normalizedProducts.length === 1 ? "Product" : "Products"})
                    </p>
                  </div>
                </div>
                {normalizedProducts.length > 1 && (
                  <button
                    type="button"
                    onClick={toggleAllProducts}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#122244] bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl border border-gray-200 transition-all self-start sm:self-auto"
                  >
                    {allProductsExpanded ? (
                      <>
                        <ChevronUp size={13} /> Fold All Products
                      </>
                    ) : (
                      <>
                        <ChevronDown size={13} /> Expand All Products
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Product Cards List */}
              <div className="space-y-4">
                {normalizedProducts.map((product, prodIdx) => {
                  const metrics = computeProductMetrics(product);
                  const ingredients = product.ingredients || [];
                  const productKey = product.id || String(prodIdx);
                  const isExpanded = !!expandedProducts[productKey];

                  return (
                    <div
                      key={productKey}
                      className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm ${
                        isExpanded
                          ? "p-5 sm:p-6 space-y-5 border-gray-300 ring-1 ring-gray-200/60"
                          : "p-4 sm:p-5 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {/* Product Card Header */}
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isExpanded ? "border-b border-gray-100 pb-4" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="px-3 py-1 bg-[#122244] text-white text-[11px] font-black rounded-lg uppercase tracking-wider shrink-0">
                            Product #{prodIdx + 1}
                          </span>
                          <h5 className="font-extrabold text-[#122244] text-base truncate">
                            {product.name || `Product ${prodIdx + 1}`}
                          </h5>
                          {product.applyVat !== false ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200 shrink-0">
                              12% VAT Applied
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-bold rounded border border-gray-200 shrink-0">
                              VAT Exempt
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleProductExpand(productKey)}
                          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all self-start sm:self-auto ${
                            isExpanded
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                              : "bg-amber-50 hover:bg-amber-100 text-[#b59545] border-amber-200/80"
                          }`}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={13} /> Fold Details
                            </>
                          ) : (
                            <>
                              <ChevronDown size={13} className="text-[#c9a654]" />{" "}
                              Expand Inputs & Costing
                            </>
                          )}
                        </button>
                      </div>

                      {/* Compact Summary Strip */}
                      {!isExpanded && (
                        <div className="pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                          <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-100 dark:border-[#c9a654]/40 shadow-xs">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase block">
                              Units per batch
                            </span>
                            <p className="font-black text-sm text-[#122244] dark:text-[#f3d98b] mt-0.5">
                              {metrics.batchYield.toLocaleString()} pcs
                            </p>
                            <span className="text-[9px] text-gray-400 dark:text-[#edd59b]/70">
                              Batch Yield
                            </span>
                          </div>
                          <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-100 dark:border-[#c9a654]/40 shadow-xs">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase block">
                              Batches / Mo
                            </span>
                            <p className="font-black text-sm text-[#c9a654] dark:text-[#f3d98b] mt-0.5">
                              {metrics.batchesPerMonth} batches
                            </p>
                            <span className="text-[9px] text-[#b59545] dark:text-[#edd59b] font-semibold">
                              {metrics.totalUnitsProduced.toLocaleString()} pcs
                              nagawa
                            </span>
                          </div>
                          <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-100 dark:border-[#c9a654]/40 shadow-xs">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase block">
                              Units Sold / Mo
                            </span>
                            <p className="font-black text-sm text-green-700 dark:text-emerald-400 mt-0.5">
                              {metrics.unitsSold.toLocaleString()} units
                            </p>
                            <span className="text-[9px] text-green-600 dark:text-emerald-300 font-semibold">
                              {metrics.unitsSold.toLocaleString()} pcs nabenta
                            </span>
                          </div>
                          <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-100 dark:border-[#c9a654]/40 shadow-xs">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase block">
                              Cost / Batch
                            </span>
                            <p className="font-black text-sm text-[#122244] dark:text-[#f3d98b] mt-0.5">
                              ₱
                              {metrics.totalBatchCost.toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </p>
                            <span className="text-[9px] text-gray-400 dark:text-[#edd59b]/70">
                              Unit Cost: ₱{metrics.unitCost.toFixed(2)}
                            </span>
                          </div>
                          <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-100 dark:border-[#c9a654]/40 shadow-xs">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase block">
                              Selling Price
                            </span>
                            <p className="font-black text-sm text-blue-700 dark:text-blue-300 mt-0.5">
                              ₱{metrics.sellingPrice.toFixed(2)}
                            </p>
                            <span className="text-[9px] text-blue-600 dark:text-blue-200 font-semibold">
                              Net: ₱{metrics.netSellingPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="space-y-5 animate-in fade-in duration-200">
                          {/* Ingredients Table */}
                          <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-[#c9a654]" />{" "}
                                Raw Materials & Production Ingredients
                              </span>
                              <span className="text-xs font-black text-[#122244]">
                                Total Batch Cost: ₱
                                {metrics.totalBatchCost.toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </span>
                            </div>
                            {ingredients.length > 0 ? (
                              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-2xs">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-gray-100/80 text-[10px] uppercase font-bold text-gray-500 tracking-wider border-b border-gray-200">
                                    <tr>
                                      <th className="p-2.5 pl-4">Category</th>
                                      <th className="p-2.5">
                                        Ingredient / Material
                                      </th>
                                      <th className="p-2.5 pr-4 text-right">
                                        Cost (₱)
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {ingredients.map((ing: any, iIdx: number) => (
                                      <tr
                                        key={ing.id || iIdx}
                                        className="hover:bg-gray-50/50"
                                      >
                                        <td className="p-2.5 pl-4">
                                          <span className="px-2 py-0.5 text-[9px] font-bold rounded uppercase bg-amber-50 text-amber-800 border border-amber-200">
                                            {ing.category || "Ingredient"}
                                          </span>
                                        </td>
                                        <td className="p-2.5 font-medium text-gray-900">
                                          {ing.name || "Direct Material"}
                                        </td>
                                        <td className="p-2.5 pr-4 text-right font-bold text-[#122244]">
                                          ₱
                                          {Number(ing.price || 0).toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">
                                Direct Batch Production Cost: ₱
                                {metrics.totalBatchCost.toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}{" "}
                                (Yield: {metrics.batchYield} pcs)
                              </p>
                            )}
                          </div>

                          {/* Pricing & Margin Breakdown Cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                              <span className="text-[10px] font-bold text-gray-400 uppercase block">
                                Unit Cost (COGS)
                              </span>
                              <p className="text-base font-black text-[#122244] mt-1">
                                ₱{metrics.unitCost.toFixed(2)}
                              </p>
                              <span className="text-[9px] text-gray-500">
                                per piece
                              </span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                              <span className="text-[10px] font-bold text-gray-400 uppercase block">
                                Proposed Mark-up
                              </span>
                              <p className="text-base font-black text-[#c9a654] mt-1">
                                +{metrics.markupPct}%
                              </p>
                              <span className="text-[9px] text-gray-500">
                                +₱{metrics.markupAmount.toFixed(2)} / unit
                              </span>
                            </div>
                            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 shadow-2xs">
                              <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                                Customer Selling Price
                              </span>
                              <p className="text-base font-black text-emerald-800 mt-1">
                                ₱{metrics.sellingPrice.toFixed(2)}
                              </p>
                              <span className="text-[9px] text-emerald-700 font-semibold">
                                {product.applyVat !== false
                                  ? `Net: ₱${metrics.netSellingPrice.toFixed(
                                      2
                                    )} excl. VAT`
                                  : "VAT Exempt"}
                              </span>
                            </div>
                            <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200 shadow-2xs">
                              <span className="text-[10px] font-bold text-purple-800 uppercase block">
                                Monthly Gross Profit
                              </span>
                              <p className="text-base font-black text-purple-800 mt-1">
                                ₱
                                {metrics.grossProfit.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                              <span className="text-[9px] text-purple-700 font-semibold truncate block">
                                Rev ₱
                                {metrics.revenue.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                - COGS ₱
                                {metrics.cogsSold.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sources of Financing & Start-up Costs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sources of Financing Card */}
              <div className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#c9a654]" /> Sources of
                  Financing & Project Cost
                </h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Cash Invested:</span>
                    <span className="font-bold text-gray-900">
                      ₱{safeCashInvested.toLocaleString()}
                    </span>
                  </div>
                  {safePropertyInvested > 0 && (
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">
                        Property / Asset Invested:
                      </span>
                      <span className="font-bold text-gray-900">
                        ₱{safePropertyInvested.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-gray-100 pb-2 font-bold text-sm bg-gray-50 p-2 rounded">
                    <span className="text-[#122244]">
                      Total Initial Capital:
                    </span>
                    <span className="text-green-700">
                      ₱{totalInitialCapital.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">
                      Advance Rent & Deposit:
                    </span>
                    <span className="font-medium text-gray-700">
                      ₱{safeRentAdvance.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">
                      Trainings & Pre-Op Marketing:
                    </span>
                    <span className="font-medium text-gray-700">
                      ₱{(safeTrainings + safeAdvertising).toLocaleString()}
                    </span>
                  </div>
                  {safeRenovationCosts > 0 && (
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">
                        Renovations & Facility Improvements:
                      </span>
                      <span className="font-medium text-gray-700">
                        ₱{safeRenovationCosts.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {safePermitsLicenses > 0 && (
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">
                        Initial Permits & Licenses:
                      </span>
                      <span className="font-medium text-gray-700">
                        ₱{safePermitsLicenses.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">
                      Startup Machinery & Equipment (CapEx):
                    </span>
                    <span className="font-medium text-gray-700">
                      ₱{safeStartupCapital.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-xs">
                    <span className="text-[#122244]">
                      Total Project Launch Cost:
                    </span>
                    <span className="text-blue-700">
                      ₱{totalProjectCost.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Itemized Contributors / Partners */}
                {fin.contributorsList && fin.contributorsList.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                      Itemized Capital Contributions (
                      {fin.contributorsList.length} Partners)
                    </span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {fin.contributorsList.map((c: any, cIdx: number) => (
                        <div
                          key={c.id || cIdx}
                          className="flex justify-between text-xs bg-gray-50 px-2.5 py-1 rounded border border-gray-100"
                        >
                          <span className="text-gray-700">
                            {c.name || `Partner ${cIdx + 1}`}
                          </span>
                          <span className="font-bold text-[#122244]">
                            ₱{Number(c.amount || 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CapEx Machinery & Equipment Table */}
              <div className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#c9a654]" /> Machinery &
                    Equipment (CapEx)
                  </h4>
                  <span className="text-xs font-bold text-[#122244]">
                    Total: ₱{safeStartupCapital.toLocaleString()}
                  </span>
                </div>
                {fin.equipmentList && fin.equipmentList.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {fin.equipmentList.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs bg-gray-50 px-3 py-2 rounded-lg border border-gray-100"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {item.name || "Equipment Item"}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {item.quantity || 1} units @ ₱
                            {Number(item.unitPrice || 0).toLocaleString()}/ea
                          </p>
                        </div>
                        <span className="font-black text-[#122244]">
                          ₱
                          {Number(
                            item.total ||
                              (Number(item.quantity) || 0) *
                                (Number(item.unitPrice) || 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic py-4">
                    No itemized equipment list provided. Default startup capital
                    applied.
                  </p>
                )}

                {/* Capital Loan Banner */}
                {fin.isCapitalBorrowed && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-amber-900">
                        Capital Funded via Loan
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Annual Interest Rate: {fin.interestRate || 0}%
                      </p>
                    </div>
                    <span className="text-xs font-black text-amber-900">
                      ₱{monthlyInterest.toFixed(2)}/mo interest
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* OpEx Breakdown Table */}
            <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#c9a654]" /> Itemized
                  Monthly Operating Expenses (OpEx)
                </h4>
                <span className="text-xs font-black text-red-600">
                  Total: ₱{safeFixedCosts.toLocaleString()}/mo
                </span>
              </div>
              {fin.opexList &&
              fin.opexList.filter((item: any) => Number(item.amount) > 0)
                .length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {fin.opexList
                    .filter((item: any) => Number(item.amount) > 0)
                    .map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs bg-gray-50 px-3 py-2 rounded-lg border border-gray-100"
                      >
                        <div>
                          <span className="text-[9px] font-bold text-[#c9a654] uppercase block">
                            {item.category || "General OpEx"}
                          </span>
                          <span className="text-gray-800 font-medium">
                            {item.name || "Expense Item"}
                          </span>
                        </div>
                        <span className="font-black text-gray-900">
                          ₱{Number(item.amount || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic py-2">
                  No itemized OpEx allocated. Default fixed overhead applied.
                </p>
              )}
            </div>

            {/* BMBE Tax & Loan Banner */}
            <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="font-bold text-[#122244]">
                    Philippine BMBE Framework (RA 9178)
                  </p>
                  <p className="text-gray-600">
                    Annual Gross Revenue:{" "}
                    <strong>₱{annualRevenue.toLocaleString()}</strong> • 3% Flat
                    Percentage Tax:{" "}
                    <strong>₱{annualTax.toLocaleString()}</strong> (Income Tax
                    Exempted)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-green-100 text-green-800 font-black rounded-lg text-[11px]">
                  0% Income Tax
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 font-black rounded-lg text-[11px]">
                  3% Gross Tax
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MARKET & COMPETITIVE INDICATORS */}
        {finSubTab === "market" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Card */}
            <div className="bg-[#122244] text-white p-6 rounded-2xl shadow-sm border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-[#c9a654]">
                  <Target size={24} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold uppercase tracking-wide">
                    Market & Competitive Indicators
                  </h3>
                  <p className="text-xs text-gray-300">
                    Local competitor mapping, target demographics, foot traffic
                    and market demand
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 self-start sm:self-auto">
                <span className="text-xs text-gray-300">Market Demand:</span>
                <span className="text-xs font-black text-[#c9a654] uppercase">
                  {fin.marketDemand || "Medium"}
                </span>
              </div>
            </div>

            {/* Competitors & Establishments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Direct Competitors */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#c9a654]" /> Direct
                  Competitors
                </h4>
                {fin.directCompetitors && fin.directCompetitors.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {fin.directCompetitors.map((comp: string, cIdx: number) => (
                      <span
                        key={cIdx}
                        className="px-3 py-1.5 bg-red-50 text-red-800 rounded-lg text-xs font-bold border border-red-200"
                      >
                        {comp}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No direct competitors specified.
                  </p>
                )}

                {fin.otherCompetitors && fin.otherCompetitors.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                      Indirect Competitors
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {fin.otherCompetitors.map((comp: string, cIdx: number) => (
                        <span
                          key={cIdx}
                          className="px-2.5 py-1 bg-gray-50 text-gray-700 rounded-lg text-xs font-medium border border-gray-200"
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {fin.competitorNotes && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Competitor Analysis Notes
                    </span>
                    <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed">
                      {fin.competitorNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Location & Demographic Indicators */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#c9a654]" /> Nearby
                  Establishments & Foot Traffic
                </h4>

                {/* Nearby establishments */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Nearby Anchors / Establishments
                  </span>
                  {fin.nearbyEstablishments &&
                  fin.nearbyEstablishments.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {fin.nearbyEstablishments.map(
                        (est: string, eIdx: number) => (
                          <span
                            key={eIdx}
                            className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg text-xs font-medium border border-blue-200"
                          >
                            {est}
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      No nearby establishments listed.
                    </p>
                  )}
                </div>

                {/* Target Demographics */}
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Target Demographics
                  </span>
                  {fin.targetDemographics &&
                  fin.targetDemographics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {fin.targetDemographics.map(
                        (demo: string, dIdx: number) => (
                          <span
                            key={dIdx}
                            className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg text-xs font-bold border border-amber-200"
                          >
                            {demo}
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      No target demographics specified.
                    </p>
                  )}
                </div>

                {/* Peak foot traffic */}
                {fin.footTrafficPeak && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Peak Foot Traffic Times
                    </span>
                    <p className="text-xs font-bold text-[#122244] bg-gray-50 p-2 rounded-lg border border-gray-100">
                      {fin.footTrafficPeak}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg bg-white shadow-sm transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> {backLabel}
          </button>
          <span className="px-3 py-1 bg-blue-50 text-[#4285F4] text-xs font-bold rounded-md uppercase tracking-wider">
            GROUP {resolvedGroupNumber}
          </span>
        </div>
      </div>

      {/* Banner Header */}
      <div className="bg-[#122244] rounded-2xl shadow-xl overflow-hidden mb-8 flex flex-col md:flex-row items-center p-5 sm:p-8 text-white relative border border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 w-full min-w-0">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-[#1a2f55] rounded-2xl flex items-center justify-center font-extrabold text-2xl sm:text-4xl shadow-inner border border-white/10 flex-shrink-0 text-[#c9a654] overflow-hidden">
            {resolvedLogoUrl && !logoError ? (
              <img
                src={resolvedLogoUrl}
                alt={displayBusinessName}
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              getInitials(displayBusinessName)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
              <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-bold rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> ACTIVE BUSINESS CHARTER
              </span>
              <span className="px-3 py-1 bg-white/10 text-gray-300 text-[10px] font-bold rounded flex items-center gap-1">
                <User className="w-3 h-3" /> SECTION: {displaySection}
              </span>
              <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold rounded flex items-center gap-1">
                <Lock className="w-3 h-3" /> {readOnlyBadgeLabel}
              </span>
            </div>
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-1 tracking-tight truncate"
              title={displayBusinessName}
            >
              {displayBusinessName}
            </h1>
            <p
              className="text-sm text-gray-400 font-medium truncate"
              title={`${displayBusinessType} • Adviser: ${bannerAdviserText}`}
            >
              {displayBusinessType} • Adviser: {bannerAdviserText}
            </p>
          </div>
          {onOpenGroupHistory && (
            <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={onOpenGroupHistory}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-white/10 whitespace-nowrap cursor-pointer"
              >
                <Users className="w-4 h-4" /> Group History
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs: Project Overview, Financial Input, AI Feasibility Analysis */}
      <div className="flex space-x-6 border-b border-gray-200 mb-8 overflow-x-auto custom-scrollbar">
        {[
          { id: "Profile", label: "Project Overview", icon: FileText },
          { id: "Financial", label: "Financial Input", icon: Calculator },
          { id: "AI", label: "AI Feasibility Analysis", icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 text-sm font-bold transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                isActive
                  ? "border-[#122244] text-[#122244]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? "text-[#c9a654]" : "text-gray-400"
                }`}
              />
              {tab.label}
              <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                Read-Only
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content & Roster Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 min-w-0 space-y-6">
          {/* TAB: BUSINESS PROFILE */}
          {activeTab === "Profile" && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="bg-blue-50 p-2.5 rounded-full border border-blue-100">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#122244]">
                    Complete Project Overview
                  </h3>
                  <p className="text-xs text-gray-400">
                    Approved Business Charter & Profile
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-200 text-center border border-gray-100">
                <div className="flex-1 min-w-0 pb-4 sm:pb-0 sm:pr-6">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Total Initial Capital
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600 tabular-nums break-words">
                    ₱{proposal?.totalCapital || "0"}
                  </p>
                </div>
                <div className="flex-1 min-w-0 pt-4 sm:pt-0 sm:pl-6">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Business Type
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-[#122244] break-words">
                    {displayBusinessType}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-widest mb-1">
                    Tagline
                  </p>
                  <p className="text-gray-900 dark:text-white font-bold text-lg">
                    {proposal?.tagline || "None Provided"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-widest mb-1">
                    Mission Statement
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                    {proposal?.missionStatement || "None Provided"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-widest mb-1">
                    Vision Statement
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                    {proposal?.visionStatement || "None Provided"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-widest mb-1">
                    Target Market
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                    {proposal?.targetMarket || "None Provided"}
                  </p>
                </div>

                <div className="h-px bg-gray-100 my-4"></div>

                <div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-widest mb-1">
                    Product Description
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                    {proposal?.productDescription || "None Provided"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-widest mb-1">
                    Specific Pricing
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                    {proposal?.priceRanges || "None Provided"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-widest mb-1">
                    Location
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {proposal?.proposedLocation || "None Provided"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-widest mb-1">
                    Promotional Strategy
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                    {proposal?.promotionalStrategy || "None Provided"}
                  </p>
                </div>

                {(() => {
                  const proposalFin =
                    proposal?.originalProposalFinancials ||
                    proposal?.financialData;
                  if (!proposalFin) return null;

                  const products = normalizeProposalProducts(
                    proposalFin,
                    displayBusinessName
                  );
                  const equipmentList = proposalFin.equipmentList || [];
                  const calculatedEquipmentTotal = equipmentList.reduce(
                    (s: number, e: any) =>
                      s +
                      (Number(e.total) ||
                        (Number(e.quantity) || 0) * (Number(e.unitPrice) || 0)),
                    0
                  );

                  return (
                    <div className="space-y-6 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-[#c9a654] uppercase tracking-widest flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5" /> Original
                          Financial Proposal Inputs (Approved Charter)
                        </p>
                        <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                          Proposal Record
                        </span>
                      </div>

                      {/* Proposed Products */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#122244] text-white text-[11px] font-bold flex items-center justify-center">
                            1
                          </span>
                          <span className="text-xs font-bold text-[#122244] uppercase tracking-wider">
                            Proposed Products ({products.length}{" "}
                            {products.length === 1 ? "Product" : "Products"})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {products.map((prod, pIdx) => {
                            const metrics = computeProductMetrics(prod);
                            const hasCosting =
                              (prod.ingredients && prod.ingredients.length > 0) ||
                              metrics.unitCost > 0 ||
                              metrics.sellingPrice > 0;

                            return (
                              <div
                                key={prod.id || pIdx}
                                className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 flex items-center gap-3"
                              >
                                <span className="px-2.5 py-1 bg-[#122244] text-white text-[11px] font-bold rounded-lg uppercase shrink-0">
                                  #{pIdx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <span className="font-extrabold text-xs text-[#122244] block truncate">
                                    {prod.name || `Product #${pIdx + 1}`}
                                  </span>
                                  {hasCosting && metrics.sellingPrice > 0 && (
                                    <span className="text-[10px] font-semibold text-[#c9a654]">
                                      Target: ₱{metrics.sellingPrice.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Equipment CapEx (if present) */}
                      {equipmentList.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[#122244] text-white text-[11px] font-bold flex items-center justify-center">
                                2
                              </span>
                              <span className="text-xs font-bold text-[#122244] uppercase tracking-wider">
                                Startup Equipment & Assets Breakdown (CapEx)
                              </span>
                            </div>
                            <span className="text-xs font-bold text-[#122244]">
                              Total: ₱
                              {calculatedEquipmentTotal.toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </span>
                          </div>
                          <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-gray-50 border-b border-gray-100 text-[9px] uppercase text-gray-400 font-bold">
                                <tr>
                                  <th className="p-2">Item / Asset name</th>
                                  <th className="p-2 text-center w-12">QTY</th>
                                  <th className="p-2 text-right w-20">
                                    UNIT PRICE
                                  </th>
                                  <th className="p-2 text-right w-24">TOTAL</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {equipmentList.map((eq: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="p-2 text-gray-800 font-medium">
                                      {eq.name || "-"}
                                    </td>
                                    <td className="p-2 text-center text-gray-600">
                                      {eq.quantity || 1}
                                    </td>
                                    <td className="p-2 text-right text-gray-600">
                                      ₱
                                      {Number(
                                        eq.unitPrice || 0
                                      ).toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right font-bold text-[#122244]">
                                      ₱
                                      {(
                                        Number(eq.total) ||
                                        (Number(eq.quantity) || 0) *
                                          (Number(eq.unitPrice) || 0)
                                      ).toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {proposalFin.isCapitalBorrowed && (
                        <div className="flex justify-between items-center text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200/70">
                          <span className="font-semibold">
                            Startup Capital Loan Financing:
                          </span>
                          <span className="font-black">
                            {proposalFin.interestRate || "0"}% Annual Interest
                            Rate
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Other Relevant Information */}
                <div className="pt-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Other Relevant Information
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    For manual adviser review only. These details are not included in AI analysis.
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap break-words bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {getOtherRelevantInformation(proposal) || 'No other relevant information has been provided.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FINANCIAL DATA */}
          {activeTab === "Financial" && renderFinancialData()}

          {/* TAB: AI ANALYSIS */}
          {activeTab === "AI" &&
            (() => {
              const hasAnyFinancialOrAi = Boolean(
                proposal?.financialData ||
                  proposal?.originalProposalFinancials ||
                  proposal?.aiAnalysis
              );

              if (!hasAnyFinancialOrAi) {
                return (
                  <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-500">
                    <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>
                      No AI analysis or financial data has been submitted for
                      this business yet.
                    </p>
                  </div>
                );
              }

              const synced = resolveSyncedAIAnalysis(proposal, {
                monthIndex: selectedMonthIndex,
                draftId: selectedDraftId || undefined,
                preferLiveOnStale: true,
              });

              const isLivePreview = synced.source === "live-audit";

              return (
                <div className="space-y-6 min-w-0">
                  {(onExportAnalysis || onReanalyze) && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                      <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest flex items-center gap-2.5">
                        <div className="p-1.5 bg-yellow-100/50 rounded-md">
                          <Sparkles className="w-4 h-4 text-[#c9a654]" />
                        </div>
                        AI Feasibility Analysis
                      </h3>
                      <div className="flex items-center gap-2">
                        {onExportAnalysis && (
                          <button
                            type="button"
                            onClick={() => onExportAnalysis(synced.aiData)}
                            disabled={isExportingAnalysis}
                            className="text-xs font-bold text-[#122244] hover:text-[#c9a654] flex items-center gap-1.5 transition-colors bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm hover:border-[#c9a654]/40 cursor-pointer disabled:opacity-50"
                            title="Export Analysis & Financials as PDF"
                          >
                            {isExportingAnalysis ? (
                              <Loader2 className="w-3 h-3 animate-spin text-[#c9a654]" />
                            ) : (
                              <Download className="w-3 h-3 text-[#c9a654]" />
                            )}
                            Export PDF
                          </button>
                        )}
                        {onReanalyze && (
                          <button
                            type="button"
                            onClick={onReanalyze}
                            disabled={isAnalyzing}
                            className="text-xs font-bold text-gray-500 hover:text-[#c9a654] flex items-center gap-1.5 transition-colors bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm cursor-pointer disabled:opacity-50"
                            title="Re-analyze Proposal"
                          >
                            <RefreshCw className={`w-3 h-3 ${isAnalyzing ? "animate-spin text-[#c9a654]" : "text-gray-400"}`} />
                            {isAnalyzing ? "Analyzing..." : "Re-analyze"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Multi-Month & Scenario Draft Selector */}
                  {renderMonthAndDraftSelector(
                    synced.context.monthlyRecords,
                    synced.context.monthIndex,
                    synced.context.monthRecord,
                    synced.context.drafts,
                    synced.context.draftRecord
                  )}

                  {/* Sync Status Bar */}
                  <div
                    className={`p-3.5 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isLivePreview
                        ? "bg-amber-50/70 border-amber-200/80"
                        : "bg-emerald-50/60 border-emerald-200/80"
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
                          isLivePreview
                            ? "bg-amber-100/80 text-amber-800 border-amber-300"
                            : "bg-emerald-100/80 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {isLivePreview ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />{" "}
                            Live Audited Preview
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />{" "}
                            Synced with Financial Inputs
                          </>
                        )}
                      </span>
                      <p className="text-xs text-gray-700 font-medium leading-snug">
                        {isLivePreview
                          ? synced.staleness.reason ||
                            "Calculated live from the selected financial inputs."
                          : (() => {
                              const lastRunMs = toEpochMs(
                                synced.aiData.lastRun
                              );
                              return `Matches student's latest saved ${
                                synced.isFallback
                                  ? "verified local"
                                  : "Cloud AI"
                              } evaluation${
                                lastRunMs > 0
                                  ? ` (${new Date(
                                      lastRunMs
                                    ).toLocaleDateString()})`
                                  : ""
                              }.`;
                            })()}
                      </p>
                    </div>
                    {synced.context.monthlyRecords &&
                      synced.context.monthlyRecords.length > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/80 text-[#122244] px-2.5 py-1 rounded-lg border border-gray-200 shrink-0 self-start sm:self-center">
                          Month {synced.context.monthNumber}
                          {synced.context.draftName
                            ? ` • ${synced.context.draftName}`
                            : ""}
                        </span>
                      )}
                  </div>

                  {/* Shared Student-Parity AI Feasibility Report */}
                  <FeasibilityAnalysisReport
                    aiData={synced.aiData}
                    financials={synced.effectiveFin}
                    viewerRole="adviser"
                  />
                </div>
              );
            })()}
        </div>

        {/* RIGHT SIDE: ROSTER + ADVISORY BULLETIN BOARD */}
        <div className="lg:col-span-1 space-y-6">
          {/* PROJECT ROSTER CARD */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-xs font-extrabold text-[#122244] uppercase tracking-widest mb-1">
              Project Roster
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              {resolvedRosterMembers.length}{" "}
              {resolvedRosterMembers.length === 1 ? "Member" : "Members"} Total
            </p>

            <div className="space-y-3">
              {normalizedAdvisers.length > 0 ? (
                normalizedAdvisers.map((adv, aIdx) => (
                  <div
                    key={`${adv}-${aIdx}`}
                    className="flex items-center justify-between gap-3 p-3 bg-blue-50/80 dark:bg-[#122244]/80 border border-blue-100 dark:border-[#c9a654]/40 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-[#122244] dark:bg-[#c9a654] rounded-lg text-white dark:text-[#122244] flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                        {getInitials(adv)}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="font-bold text-[#122244] dark:text-white text-sm truncate"
                          title={adv}
                        >
                          {normalizedAdvisers.length === 1
                            ? `Prof. ${adv.split(" ").pop()}`
                            : adv}
                        </p>
                        <p className="text-[10px] text-blue-600 dark:text-[#edd59b]">
                          Faculty
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase text-blue-600 dark:text-[#122244] bg-blue-100 dark:bg-[#c9a654] px-2 py-1 rounded shrink-0">
                      Adviser
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-gray-300 rounded-lg text-gray-700 flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                      UA
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-700 text-sm truncate">
                        Unassigned
                      </p>
                      <p className="text-[10px] text-gray-500">Faculty</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase text-gray-600 bg-gray-200 px-2 py-1 rounded shrink-0">
                    Adviser
                  </span>
                </div>
              )}

              <div className="pt-1 space-y-2">
                {resolvedRosterMembers.map((member, mIdx) => {
                  const isLeader = member.role === "Leader";
                  return (
                    <div
                      key={member.id || mIdx}
                      className="flex items-center gap-3 p-2"
                    >
                      <div
                        className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0 ${
                          isLeader ? "bg-purple-600" : "bg-green-500"
                        }`}
                      >
                        {getInitials(member.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {member.name}
                          </p>
                          {isLeader && (
                            <span className="text-[9px] font-bold uppercase text-[#c9a654] bg-[#c9a654]/10 px-1.5 py-0.5 rounded shrink-0">
                              Leader
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">
                          {member.studentId || "ID Unknown"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ADVISORY BULLETIN / FEEDBACK BOARD */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 lg:sticky lg:top-20 lg:z-10 lg:max-h-[calc(100vh-6.5rem)] lg:flex lg:flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <h3 className="text-xs font-extrabold text-[#122244] uppercase tracking-widest flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#c9a654]" /> Advisory
                Bulletin Board
              </h3>
              <span className="text-[10px] font-black text-gray-400 uppercase">
                {feedbackHistory.length}{" "}
                {feedbackHistory.length === 1 ? "Note" : "Notes"}
              </span>
            </div>

            {/* Bulletin Feed (Scrollable history) */}
            <div className="space-y-3 max-h-72 lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {feedbackHistory.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400 italic">
                  {canPostFeedback
                    ? "No feedback posted on the bulletin board yet. Write a note below to advise this group."
                    : "No adviser feedback notes have been posted for this business yet."}
                </div>
              ) : (
                feedbackHistory
                  .slice()
                  .reverse()
                  .map((item: any, idx: number) => (
                    <div
                      key={item.id || idx}
                      className="p-3.5 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-1.5 shadow-sm"
                    >
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-[#122244] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#c9a654]"></span>
                          {item.authorName ||
                            (normalizedAdvisers[0]
                              ? `Prof. ${normalizedAdvisers[0]
                                  .split(" ")
                                  .pop()}`
                              : "Faculty Adviser")}
                        </span>
                        <span className="text-gray-400">
                          {formatBulletinTimestamp(item.date)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap pl-3.5 border-l-2 border-[#c9a654]/40">
                        {item.text}
                      </p>
                    </div>
                  ))
              )}
            </div>

            {/* Inline Composer (Adviser) vs View-Only Notice (Chairperson) */}
            {canPostFeedback ? (
              <div className="pt-2 border-t border-gray-100 space-y-2 shrink-0">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Post Advisory Note
                </label>
                <textarea
                  rows={3}
                  value={feedbackInput}
                  onChange={(e) => onFeedbackInputChange?.(e.target.value)}
                  placeholder="Type guidance, required changes, or feedback for the students..."
                  className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#c9a654] outline-none resize-none transition-all placeholder:text-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      if (feedbackInput.trim() && !isSavingFeedback) {
                        onSubmitFeedback?.();
                      }
                    }
                  }}
                />
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-gray-400 italic">
                    Press Ctrl + Enter to send
                  </span>
                  <button
                    type="button"
                    onClick={onSubmitFeedback}
                    disabled={isSavingFeedback || !feedbackInput.trim()}
                    className="px-4 py-2 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSavingFeedback ? "Posting..." : "Post Feedback"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2.5 border-t border-gray-100 shrink-0 flex items-center justify-between text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1.5 font-semibold text-gray-500">
                  <Lock className="w-3.5 h-3.5 text-[#c9a654]" />
                  View-Only Bulletin Feed
                </span>
                <span className="text-[10px] text-gray-400">
                  Read-only archive
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveBusinessDetailView;
