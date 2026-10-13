import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { AIAnalysisLoading } from "./AIAnalysisLoading";
import ScrollToTopButton from "./components/ScrollToTopButton";
import MobileBurgerButton from "./components/MobileBurgerButton";
import SidebarCloseButton from "./components/SidebarCloseButton";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import {
  LayoutDashboard,
  Folder,
  FileEdit,
  Zap,
  BarChart3,
  MessageCircle,
  User,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sidebar as SidebarIcon,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  DollarSign,
  Bell,
  Target,
  Store,
  Layers,
  Building2,
  MapPin,
  ChevronUp,
  TrendingUp,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  normalizeProposalProducts,
  computeProductMetrics,
} from "./utils/productCosting";
import {
  cleanUserFacingText,
  calculateLocalAudit,
  evaluateDefenseFeasibility,
} from "./utils/feasibilityAudit";

interface InsightItem {
  id: string;
  title: string;
  description: string;
  type: "positive" | "warning" | "info" | "suggestion";
}

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

// Helper to extract clean, active financial inputs from project/proposal data (supporting multi-month records & scenarios)
const extractActiveFinancialData = (proj: any) => {
  const finData = proj?.financialData || {};

  // If multi-month records exist, locate the active month and active draft financials
  let activeMonthFin = finData;
  if (Array.isArray(finData.monthlyRecords) && finData.monthlyRecords.length > 0) {
    const activeIdx =
      typeof finData.activeMonthIndex === "number" &&
      finData.activeMonthIndex >= 0 &&
      finData.activeMonthIndex < finData.monthlyRecords.length
        ? finData.activeMonthIndex
        : 0;
    const activeRecord = finData.monthlyRecords[activeIdx];
    if (activeRecord) {
      const activeDraftId = activeRecord.activeDraftId || "draft-1";
      const activeDraft =
        (activeRecord.drafts || []).find((d: any) => d.id === activeDraftId) ||
        activeRecord.drafts?.[0];
      activeMonthFin = activeDraft?.financials || activeRecord.financials || finData;
    }
  }

  // Calculate partner / investor contributed equity
  const contribList =
    Array.isArray(activeMonthFin.contributorsList) && activeMonthFin.contributorsList.length > 0
      ? activeMonthFin.contributorsList
      : Array.isArray(finData.contributorsList)
      ? finData.contributorsList
      : [];
  const contribSum = contribList.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);

  const proposalCap = Number(
    proj?.proposalCapital || proj?.totalCapital || finData.startupCapital || 0
  );
  const resolvedCapital =
    contribSum > 0
      ? contribSum
      : Number(activeMonthFin.cashInvested) ||
        Number(activeMonthFin.startupCapital) ||
        Number(finData.startupCapital) ||
        proposalCap ||
        0;

  const equipmentList = activeMonthFin.equipmentList || finData.equipmentList || [];
  const opexList = activeMonthFin.opexList || finData.opexList || [];
  const fixedCosts =
    opexList.length > 0
      ? opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
      : Number(activeMonthFin.fixedCosts) || Number(finData.fixedCosts) || 0;

  const products =
    activeMonthFin.products && Array.isArray(activeMonthFin.products) && activeMonthFin.products.length > 0
      ? activeMonthFin.products
      : finData.products && Array.isArray(finData.products) && finData.products.length > 0
      ? finData.products
      : proj?.products || [];

  return {
    ...finData,
    ...activeMonthFin,
    products,
    sellingPrice: Number(activeMonthFin.sellingPrice) || Number(finData.sellingPrice) || 0,
    monthlySales: Number(activeMonthFin.monthlySales) || Number(finData.monthlySales) || 0,
    variableCost: Number(activeMonthFin.variableCost) || Number(finData.variableCost) || 0,
    fixedCosts,
    startupCapital: resolvedCapital,
    cashInvested: activeMonthFin.cashInvested || finData.cashInvested || String(resolvedCapital),
    contributorsList: contribList,
    totalCapital: resolvedCapital,
    proposalCapital: proposalCap,
    equipmentList,
    opexList,
    operatingDays: Number(activeMonthFin.operatingDays) || Number(finData.operatingDays) || 300,
    isCapitalBorrowed: Boolean(activeMonthFin.isCapitalBorrowed ?? finData.isCapitalBorrowed),
    interestRate: Number(activeMonthFin.interestRate) || Number(finData.interestRate) || 0,
    competitorCount:
      Number(activeMonthFin.competitorCount) ||
      (Array.isArray(activeMonthFin.directCompetitors)
        ? activeMonthFin.directCompetitors.length + (activeMonthFin.otherCompetitors?.length || 0)
        : 0),
    marketDemand: activeMonthFin.marketDemand || finData.marketDemand || "Medium",
    directCompetitors: Array.isArray(activeMonthFin.directCompetitors)
      ? activeMonthFin.directCompetitors
      : Array.isArray(finData.directCompetitors)
      ? finData.directCompetitors
      : [],
    otherCompetitors: Array.isArray(activeMonthFin.otherCompetitors)
      ? activeMonthFin.otherCompetitors
      : Array.isArray(finData.otherCompetitors)
      ? finData.otherCompetitors
      : [],
    competitorNotes: activeMonthFin.competitorNotes || finData.competitorNotes || "",
    nearbyEstablishments: Array.isArray(activeMonthFin.nearbyEstablishments)
      ? activeMonthFin.nearbyEstablishments
      : Array.isArray(finData.nearbyEstablishments)
      ? finData.nearbyEstablishments
      : [],
    targetDemographics: Array.isArray(activeMonthFin.targetDemographics)
      ? activeMonthFin.targetDemographics
      : Array.isArray(finData.targetDemographics)
      ? finData.targetDemographics
      : [],
    footTrafficPeak: activeMonthFin.footTrafficPeak || finData.footTrafficPeak || "",
    marketDemandNotes: activeMonthFin.marketDemandNotes || finData.marketDemandNotes || "",
    businessName: proj?.name || proj?.businessName || proj?.rawProposalData?.businessName || "",
    businessType: proj?.businessType || proj?.rawProposalData?.businessType || "",
  };
};

const AI_Analysis: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [financials, setFinancials] = useState({
    products: [] as any[],
    sellingPrice: 0,
    monthlySales: 0,
    variableCost: 0,
    fixedCosts: 0,
    startupCapital: 0,
    cashInvested: "",
    contributorsList: [] as any[],
    totalCapital: 0,
    proposalCapital: 0,
    competitorCount: 0,
    marketDemand: "Medium",
    directCompetitors: [] as string[],
    otherCompetitors: [] as string[],
    competitorNotes: "",
    nearbyEstablishments: [] as string[],
    targetDemographics: [] as string[],
    footTrafficPeak: "",
    marketDemandNotes: "",
    operatingDays: 300,
    equipmentList: [] as { id: string; name: string; quantity: number; unitPrice: number; total: number }[],
    opexList: [] as { id: string; name: string; amount: number }[],
    isCapitalBorrowed: false,
    interestRate: 0,
  });

  const [explanations, setExplanations] = useState<any>({});
  const [improvementTips, setImprovementTips] = useState<any>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feasibilityScore, setFeasibilityScore] = useState(0);
  const [feasibilityStatus, setFeasibilityStatus] = useState<
    "FEASIBLE" | "CONDITIONALLY_FEASIBLE" | "NOT_FEASIBLE" | "MODERATE" | "PENDING"
  >("PENDING");
  const [severeFlags, setSevereFlags] = useState<
    { id: string; title: string; description: string; tip: string }[]
  >([]);
  const [fatalFlaws, setFatalFlaws] = useState<string[]>([]);
  const [metrics, setMetrics] = useState({
    feasibility: 0,
    financial: 0,
    risk: 0,
    market: 0,
  });
  const [aiScores, setAiScores] = useState<any>({});
  const [aiScoreExplanations, setAiScoreExplanations] = useState<any>({});
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [performanceGrade, setPerformanceGrade] = useState("");
  const [performanceStatus, setPerformanceStatus] = useState("");
  const [performanceRecommendation, setPerformanceRecommendation] = useState("");
  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysisData | null>(null);
  const [hasNewerInputs, setHasNewerInputs] = useState(false);

  // Pro Forma Financial Statement States
  const [revenueGrowthRate, setRevenueGrowthRate] = useState<number>(15);
  const [costGrowthRate, setCostGrowthRate] = useState<number>(8);
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserName(
              [data.firstName, data.lastName].filter(Boolean).join(" ") ||
              u.displayName ||
              "",
            );
            if (data.section) {
              loadUserGroup(u.uid, data.section);
            } else {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        } catch (err) {
          console.error(err);
          setIsLoading(false);
        }
      } else navigate("/");
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const q = query(
            collection(db, "notifications"),
            where("userId", "==", u.uid),
            where("isRead", "==", false),
          );
          const snap = await getDocs(q);
          setUnreadNotificationCount(snap.size);
        } catch (error) {
          console.error("Error fetching unread notifications:", error);
        }
      }
    });
    return () => unsub();
  }, []);

  const loadUserGroup = async (uid: string, section: string) => {
    try {
      const groupQ = query(
        collection(db, "groups"),
        where("section", "==", section),
      );
      const groupSnap = await getDocs(groupQ);
      let userGroupId = "";
      let activeProposalId = "";
      groupSnap.forEach((doc) => {
        const gData = doc.data();
        if (
          gData.leaderId === uid ||
          (gData.memberIds && gData.memberIds.includes(uid))
        ) {
          userGroupId = doc.id;
          activeProposalId = gData.activeProposalId || "";
        }
      });

      if (userGroupId && activeProposalId) {
        const propQ = query(
          collection(db, "proposals"),
          where("groupId", "==", userGroupId),
        );
        const propSnap = await getDocs(propQ);
        const approvedProjects = propSnap.docs
          .filter(
            (doc) =>
              doc.data().status === "Approved" ||
              doc.data().status === "APPROVED",
          )
          .map((doc) => ({
            id: doc.id,
            name: doc.data().businessName || "Untitled Proposal",
            businessName: doc.data().businessName || "Untitled Proposal",
            businessType: doc.data().businessType || "",
            totalCapital: doc.data().totalCapital || "0",
            proposalCapital: doc.data().totalCapital || doc.data().proposalCapital || "0",
            priceRanges: doc.data().priceRanges || "",
            proposedLocation: doc.data().proposedLocation || "",
            financialData: doc.data().financialData || null,
            aiAnalysis: doc.data().aiAnalysis || null,
            products: doc.data().products || doc.data().financialData?.products || [],
            rawProposalData: doc.data(),
          }));

        const activeProp = approvedProjects.find((p) => p.id === activeProposalId);
        if (activeProp) {
          setProjects([activeProp]);
        } else {
          setProjects([]);
          setSelectedProjectId("");
        }
      } else {
        setProjects([]);
        setSelectedProjectId("");
      }
    } catch (error) {
      console.error("Load failed:", error);
      setProjects([]);
      setSelectedProjectId("");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projects.length === 0) return;
    const targetId =
      location.state?.projectId ||
      sessionStorage.getItem("lastSelectedProjectId") ||
      projects[0].id;
    const proj = projects.find((p) => p.id === targetId) || projects[0];

    if (proj) {
      setSelectedProjectId(proj.id);
      sessionStorage.setItem("lastSelectedProjectId", proj.id);
      const activeFin = extractActiveFinancialData(proj);
      setFinancials(activeFin);

      // Check if financial inputs have been updated since the last AI analysis was generated
      const finUpdatedAt = proj.financialData?.updatedAt?.toDate?.()
        ? proj.financialData.updatedAt.toDate().getTime()
        : (proj.financialData?.updatedAt ? new Date(proj.financialData.updatedAt).getTime() : 0);

      const aiLastRunTime = proj.aiAnalysis?.lastRun
        ? new Date(proj.aiAnalysis.lastRun).getTime()
        : 0;

      // Has newer updates if financialData timestamp > aiAnalysis lastRun timestamp (+ 2s clock buffer)
      const hasNewer = finUpdatedAt > 0 && aiLastRunTime > 0 && finUpdatedAt > (aiLastRunTime + 2000);
      setHasNewerInputs(hasNewer);

      const isExplicitRun = Boolean(location.state?.runAnalysis);

      if (isExplicitRun) {
        console.log("⚡ [AI Analysis] Explicit 'Run Analysis' clicked. Executing feasibility evaluation...");
        executeAnalysis(activeFin, proj.id);
        navigate(location.pathname, { replace: true, state: {} });
      } else if (proj.aiAnalysis) {
        setFeasibilityScore(proj.aiAnalysis.score || 0);
        setFeasibilityStatus(proj.aiAnalysis.status || "PENDING");
        setPerformanceGrade(proj.aiAnalysis.performanceGrade || "");
        setPerformanceStatus(proj.aiAnalysis.performanceStatus || "");
        setPerformanceRecommendation(proj.aiAnalysis.performanceRecommendation || "");
        if (Array.isArray(proj.aiAnalysis.severeFlags)) {
          setSevereFlags(proj.aiAnalysis.severeFlags);
        } else {
          const evalRes = evaluateDefenseFeasibility(activeFin);
          setSevereFlags(evalRes.severeFlags || []);
        }
        if (Array.isArray(proj.aiAnalysis.fatalFlaws)) {
          setFatalFlaws(proj.aiAnalysis.fatalFlaws);
        } else {
          const evalRes = evaluateDefenseFeasibility(activeFin);
          setFatalFlaws(evalRes.fatalFlaws || []);
        }
        setMetrics(
          proj.aiAnalysis.metrics || {
            feasibility: 0,
            financial: 0,
            risk: 0,
            market: 0,
          },
        );
        setExplanations(cleanUserFacingText(proj.aiAnalysis.explanations || {}));
        setImprovementTips(cleanUserFacingText(proj.aiAnalysis.improvementTips || {}));
        setInsights(cleanUserFacingText(proj.aiAnalysis.insights || []));
        setAiScores(proj.aiAnalysis.aiScores || {});
        setAiScoreExplanations(cleanUserFacingText(proj.aiAnalysis.aiScoreExplanations || {}));
        setMarketAnalysis(cleanUserFacingText(proj.aiAnalysis.marketAnalysis || null));
        const wasFallback = proj.aiAnalysis._fallback === true;
        setIsFallback(wasFallback);
        if (wasFallback) {
          console.warn("🛡️ [Feasify Engine] Loaded previous analysis generated via Verified Local Mode.");
        } else {
          console.log(`🤖 [Live AI] Loaded analysis generated via Gemini (${proj.aiAnalysis._model || "Cloud AI"})`);
        }
      } else {
        setFeasibilityScore(0);
        setFeasibilityStatus("PENDING");
        setPerformanceGrade("");
        setPerformanceStatus("");
        setPerformanceRecommendation("");
        setSevereFlags([]);
        setFatalFlaws([]);
        setInsights([]);
        setExplanations({});
        setImprovementTips({});
        setAiScores({});
        setAiScoreExplanations({});
        setMarketAnalysis(null);
      }
    }
  }, [location.state, projects, navigate]);

  const executeAnalysis = async (data: any, pId: string) => {
    if (!pId) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setIsFallback(false);
    setHasNewerInputs(false);

    const currentProj = projects.find((p) => p.id === pId);
    const activeFin = extractActiveFinancialData(currentProj);
    const mergedFin = { ...activeFin, ...(data || {}) };

    const enrichedData = {
      ...currentProj?.financialData,
      ...mergedFin,
      products:
        mergedFin?.products && Array.isArray(mergedFin.products) && mergedFin.products.length > 0
          ? mergedFin.products
          : currentProj?.financialData?.products || currentProj?.products || [],
      startupCapital: mergedFin.startupCapital,
      cashInvested: mergedFin.cashInvested,
      contributorsList: mergedFin.contributorsList,
      totalCapital: mergedFin.totalCapital,
      proposalCapital: mergedFin.proposalCapital,
      equipmentList: mergedFin.equipmentList,
      opexList: mergedFin.opexList,
      fixedCosts: mergedFin.fixedCosts,
      operatingDays: mergedFin.operatingDays,
      businessName: mergedFin.businessName || currentProj?.name || "",
      businessType: mergedFin.businessType || currentProj?.businessType || "",
    };

    try {
      const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:10000";

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(`${backendUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pId,
          financialData: enrichedData,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Server responded with ${response.status}`);
      }

      const rawAiResult = await response.json();
      const aiResult = cleanUserFacingText(rawAiResult);

      // 2. Format Insights to include IDs (for React keys)
      const generatedInsights = (aiResult.insights || []).map(
        (i: any, idx: number) => ({ ...i, id: `ai-${idx}` })
      );

      // 3. Save the AI's verdict back to Firebase so it persists in Reports
      const updatedAiAnalysis = {
        ...aiResult,
        insights: generatedInsights,
        lastRun: new Date().toISOString()
      };

      await updateDoc(doc(db, "proposals", pId), {
        aiAnalysis: updatedAiAnalysis
      });

      // Synchronize in-memory projects state with latest lastRun timestamp to prevent stale detection
      setProjects((prev) =>
        prev.map((p) =>
          p.id === pId ? { ...p, aiAnalysis: updatedAiAnalysis } : p
        )
      );

      // 4. Update Local State to reflect the AI's audited results
      setFeasibilityScore(aiResult.score);
      setFeasibilityStatus(aiResult.status);
      setPerformanceGrade(aiResult.performanceGrade || "");
      setPerformanceStatus(aiResult.performanceStatus || "");
      setPerformanceRecommendation(aiResult.performanceRecommendation || "");
      setSevereFlags(aiResult.severeFlags || []);
      setFatalFlaws(aiResult.fatalFlaws || []);
      setMetrics({
        feasibility: aiResult.score,
        financial: aiResult.metrics.financial,
        risk: aiResult.metrics.risk,
        market: aiResult.metrics.market,
      });
      setExplanations(aiResult.explanations || {}); // If AI provides them
      setImprovementTips(aiResult.improvementTips || {});
      setInsights(generatedInsights);
      setMarketAnalysis(aiResult.marketAnalysis || null);

      if (aiResult.aiScores) setAiScores(aiResult.aiScores);
      if (aiResult.aiScoreExplanations) setAiScoreExplanations(aiResult.aiScoreExplanations);

      const isFallbackResult = aiResult._fallback === true;
      setIsFallback(isFallbackResult);
      if (isFallbackResult) {
        console.warn("🛡️ [Feasify Engine] Backend used verified local calculations (Cloud AI unavailable).");
      } else {
        console.log(`🤖 [Live AI] Analysis generated successfully via Gemini (${aiResult._model || "Cloud AI"})`);
      }

    } catch (e: any) {
      console.warn("⚠️ [Live AI] Backend connection failed, engaging verified client-side financial audit engine:", e);
      try {
        const fallbackResult = calculateLocalAudit(enrichedData);
        const fallbackInsights = (fallbackResult.insights || []).map(
          (i: any, idx: number) => ({ ...i, id: `local-${idx}` })
        );

        const updatedFallback = {
          ...fallbackResult,
          insights: fallbackInsights,
          lastRun: new Date().toISOString(),
        };

        // Save fallback audit to Firebase so reports stay populated
        await updateDoc(doc(db, "proposals", pId), {
          aiAnalysis: updatedFallback
        }).catch((err) => console.warn("Failed saving fallback to Firestore:", err));

        // Synchronize in-memory projects state with fallback timestamp
        setProjects((prev) =>
          prev.map((p) =>
            p.id === pId ? { ...p, aiAnalysis: updatedFallback } : p
          )
        );

        // Update local state with the computed rubric results
        setFeasibilityScore(fallbackResult.score);
        setFeasibilityStatus(fallbackResult.status);
        setPerformanceGrade(fallbackResult.performanceGrade);
        setPerformanceStatus(fallbackResult.performanceStatus);
        setPerformanceRecommendation(fallbackResult.performanceRecommendation);
        setSevereFlags(fallbackResult.severeFlags || []);
        setFatalFlaws(fallbackResult.fatalFlaws || []);
        setMetrics({
          feasibility: fallbackResult.score,
          financial: fallbackResult.metrics.financial,
          risk: fallbackResult.metrics.risk,
          market: fallbackResult.metrics.market,
        });
        setExplanations(fallbackResult.explanations);
        setImprovementTips(fallbackResult.improvementTips);
        setInsights(fallbackInsights);
        setAiScores(fallbackResult.aiScores);
        setAiScoreExplanations(fallbackResult.aiScoreExplanations);
        setMarketAnalysis(fallbackResult.marketAnalysis || null);

        setIsFallback(true);
        setAnalysisError(null);
      } catch (fallbackError: any) {
        console.error("❌ Both Live AI and Local Audit failed:", fallbackError);
        setAnalysisError(e.message || "Analysis failed. Please check your financial inputs and try again.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Pro Forma Visual Configuration & Helpers
  const proFormaSeriesConfig = [
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

  const formatProFormaCurrency = (val: number) => {
    if (val === 0) return "₱0";
    const abs = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    if (abs >= 1_000_000) {
      const num = abs / 1_000_000;
      const formatted = num >= 10 || Number.isInteger(num) ? num.toFixed(0) : num.toFixed(1);
      return `${sign}₱${formatted}M`;
    }
    if (abs >= 1_000) {
      const num = abs / 1_000;
      const formatted = num >= 100 || Number.isInteger(num) ? num.toFixed(0) : (abs % 100 === 0 ? num.toFixed(0) : num.toFixed(1));
      return `${sign}₱${formatted}K`;
    }
    return `${sign}₱${abs.toLocaleString("en-PH")}`;
  };

  const ProFormaCustomTooltip = ({ active, payload, label }: any) => {
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
            const config = proFormaSeriesConfig.find((c) => c.key === item.dataKey);
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
                    {val < 0 ? `-₱${Math.abs(val).toLocaleString("en-PH")}` : `₱${val.toLocaleString("en-PH")}`}
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

  // Calculate 5-Year Pro Forma Financial Statement
  const generateProFormaData = () => {
    const yearlyRevenue: number[] = [];
    const yearlyCOGS: number[] = [];
    const yearlyFixedCosts: number[] = [];
    const yearlyNetProfit: number[] = [];
    const yearLabels: string[] = [];

    const safeSellingPrice = Number(financials.sellingPrice) || 0;
    const safeMonthlySales = Number(financials.monthlySales) || 0;
    const safeVariableCost = Number(financials.variableCost) || 0;
    const safeFixedCosts = financials.opexList && financials.opexList.length > 0
      ? financials.opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
      : (Number(financials.fixedCosts) || 0);
    const safeOperatingDays = Number(financials.operatingDays) || 300;

    const calculatedStartupCapital = financials.equipmentList && financials.equipmentList.length > 0
      ? financials.equipmentList.reduce((sum: any, item: any) => sum + item.total, 0)
      : (Number(financials.startupCapital) || 0);
    const monthlyInterest = financials.isCapitalBorrowed ? (calculatedStartupCapital * (Number(financials.interestRate) / 100)) / 12 : 0;

    const monthlyRevenue = safeSellingPrice * safeMonthlySales;
    const totalMonthlyVariableCosts = safeVariableCost * safeMonthlySales;

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

      const projectedNetProfit =
        projectedRevenue - projectedCOGS - projectedFixedCosts - percentageTax;

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

  // Format data for Recharts
  const getChartData = () => {
    const proForma = generateProFormaData();
    return proForma.yearLabels.map((label, index) => ({
      year: label,
      Revenue: proForma.yearlyRevenue[index],
      COGS: proForma.yearlyCOGS[index],
      "Fixed Costs": proForma.yearlyFixedCosts[index],
      "Net Profit": proForma.yearlyNetProfit[index],
    }));
  };



  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
      navigate("/");
    } catch (e) {
      navigate("/");
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const getInitials = (name: string) =>
    name
      ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
      : "U";

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside
        className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 w-64 lg:w-16 lg:hover:w-64`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between lg:justify-center px-4 lg:px-3 border-b border-white/10 shrink-0 overflow-hidden">
          {/* Logo.png when sidebar is folded (default) inside circular border with shadow effect */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-b from-white/15 to-white/5 border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.35)] flex items-center justify-center overflow-hidden hidden lg:flex lg:group-hover:hidden shrink-0 select-none pointer-events-none">
            <img
              src="/Logo.png"
              alt="FeasiFy"
              className="w-full h-full object-contain scale-[1.35]"
              style={{ transform: "scale(1.35)" }}
            />
          </div>
          {/* dashboard logo when sidebar is hovered or on mobile */}
          <img
            src="/dashboard logo.png"
            alt="FeasiFy"
            className="h-10.5 w-auto max-h-[42px] max-w-[200px] object-contain select-none pointer-events-none block lg:hidden lg:group-hover:block shrink-0"
          />
          <SidebarCloseButton onClick={() => setIsSidebarOpen(false)} />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/dashboard"); }}
            title="Dashboard"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <LayoutDashboard className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Dashboard
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/projects"); }}
            title="Business Proposal"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Folder className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Business Proposal
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/financial-input"); }}
            title="Financial Input"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <FileEdit className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Financial Input
            </span>
          </button>
          <button
            title="AI Feasibility Analysis"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold bg-[#c9a654] text-[#122244] transition-all shadow-md"
          >
            <Zap className="w-5 h-5 shrink-0 text-[#122244]" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              AI Feasibility Analysis
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/reports"); }}
            title="Reports"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <BarChart3 className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Reports
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/messages"); }}
            title="Message"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <MessageCircle className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Message
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/settings"); }}
            title="Settings"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Settings className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Settings
            </span>
          </button>
        </nav>

        {/* Bottom Logout Button */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="Logout"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Logout
            </span>
          </button>
        </div>
      </aside>

      <main
        className="flex-1 w-full max-w-full transition-all duration-300 ease-in-out min-h-screen lg:ml-16 ml-0"
      >
        <div className="bg-white border-b border-gray-200/80 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <MobileBurgerButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span
              className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors shrink-0"
              onClick={() => navigate("/dashboard")}
            >
              FeasiFy
            </span>
            <span className="text-gray-400 shrink-0">›</span>
            <span className="font-semibold text-gray-900 truncate">AI Analysis</span>
            <span className="text-gray-300 hidden sm:inline shrink-0">|</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#122244] text-white shadow-xs tracking-wide whitespace-nowrap hidden sm:inline-block shrink-0">
              Student Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/notifications")}
              className="p-2 text-gray-500 hover:text-[#122244] hover:bg-gray-100 rounded-lg transition-all relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></span>
              )}
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <div
              onClick={() => navigate("/settings")}
              className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-[#c9a654] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                {getInitials(userName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {userName || "User"}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">Student</p>
              </div>
            </div>
          </div>
        </div>

        {isAnalyzing ? (
          <AIAnalysisLoading projectName={selectedProject?.name} />
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-[#122244] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 font-medium text-sm">Loading project analysis...</p>
          </div>
        ) : analysisError && feasibilityScore === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-2xl border border-red-100 shadow-sm p-8 sm:p-12 max-w-xl mx-auto my-8">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-red-100">
              <AlertCircle className="w-8 h-8" />
            </div>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full uppercase tracking-wider mb-3">
              Evaluation Encountered an Issue
            </span>
            <h2 className="text-2xl font-extrabold text-[#122244] mb-3">
              Analysis Could Not Complete
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
              {analysisError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => executeAnalysis(financials, selectedProjectId)}
                className="flex items-center gap-2 px-6 py-3 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#c9a654]" /> Retry Feasibility Analysis
              </button>
            </div>
          </div>
        ) : projects.length === 0 || !selectedProjectId ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-12 max-w-2xl mx-auto my-8">
            <div className="w-20 h-20 bg-amber-50 text-[#c9a654] rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-amber-100">
              <Folder className="w-10 h-10" />
            </div>
            <span className="px-3 py-1 bg-amber-100 text-[#b59545] text-xs font-black rounded-full uppercase tracking-wider mb-3">
              Active Business Required
            </span>
            <h2 className="text-2xl font-extrabold text-[#122244] mb-3">
              No Active Business Setup
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
              Please submit a business proposal and have it approved by your adviser, then set it as your group's active business in the <strong>Business Proposal</strong> module to unlock AI Feasibility Analysis.
            </p>
            <button
              onClick={() => navigate("/projects")}
              className="flex items-center gap-2 px-6 py-3 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95"
            >
              <Folder className="w-4 h-4 text-[#c9a654]" /> Go to Business Proposals
            </button>
          </div>
        ) : (
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="w-full sm:w-auto min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#3d2c23]">
                  AI Analysis
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-sm text-gray-500 italic font-medium break-words">
                    Evaluation for{" "}
                    <span className="text-[#122244] font-bold">
                      {selectedProject?.name || "Selected Project"}
                    </span>
                  </p>
                  {hasNewerInputs ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertCircle className="w-3 h-3 text-amber-600" /> Financial Inputs Modified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Synced with Financial Inputs
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => executeAnalysis(financials, selectedProjectId)}
                disabled={!selectedProjectId || isAnalyzing}
                className={`w-full sm:w-auto flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm flex-shrink-0 disabled:opacity-50 ${
                  hasNewerInputs
                    ? "bg-[#c9a654] hover:bg-[#b59545] text-white shadow-md ring-2 ring-[#c9a654]/30"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <RotateCcw className={`w-4 h-4 ${isAnalyzing ? "animate-spin text-[#c9a654]" : ""}`} /> {isAnalyzing ? "Analyzing..." : "Re-analyze"}
              </button>
            </div>

            {/* Inputs Modified Notification Banner */}
            {hasNewerInputs && !isAnalyzing && selectedProject?.aiAnalysis && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-3 text-amber-900">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      Financial inputs have been updated
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Your financial inputs were modified since the last analysis was generated. Click Re-analyze to update this evaluation.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => executeAnalysis(financials, selectedProjectId)}
                  disabled={isAnalyzing}
                  className="px-4 py-2 bg-[#c9a654] hover:bg-[#b59545] text-white text-xs font-bold rounded-lg shadow-sm transition-all shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Re-analyze Now
                </button>
              </div>
            )}

            {analysisError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3">
                <div className="flex items-center gap-2 text-red-700 font-bold">
                  <AlertCircle className="w-5 h-5" />
                  <span>Analysis Failed</span>
                </div>
                <p className="text-sm text-red-600">{analysisError}</p>
                <button
                  onClick={() => executeAnalysis(financials, selectedProjectId)}
                  className="self-start px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {isFallback && (
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200/90 rounded-xl flex items-center gap-3.5 shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-800 font-bold">
                    Verified Feasibility Analysis Ready
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                    All business metrics, profit projections, and feasibility evaluations are fully calculated and ready. You can click <strong>Re-analyze</strong> above anytime to refresh with online AI.
                  </p>
                </div>
              </div>
            )}

            <div className="mb-8 bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                Active Project
              </label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex-shrink-0 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-lg border border-blue-100">
                  P#
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#122244] tracking-tight truncate">
                    {selectedProject?.name || "No Project Selected"}
                  </h2>
                  <span className="inline-block mt-1 text-[10px] font-black uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded break-words">
                    Verified Approved Business
                  </span>
                </div>
              </div>
            </div>

            {!selectedProject?.aiAnalysis && !isAnalyzing ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center shadow-sm mb-8 max-w-2xl mx-auto animate-in fade-in duration-200">
                <div className="w-16 h-16 bg-amber-50 text-[#c9a654] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100 shadow-inner">
                  <Zap className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-extrabold text-[#122244] mb-2">
                  Ready for AI Feasibility Analysis
                </h2>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                  Your business proposal and financial inputs are set up. Click below to run a comprehensive feasibility audit on product margins, capital adequacy, and market viability.
                </p>
                <button
                  onClick={() => executeAnalysis(financials, selectedProjectId)}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#c9a654] hover:bg-[#b59545] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-white" /> {isAnalyzing ? "Analyzing..." : "Run Feasibility Analysis"}
                </button>
              </div>
            ) : (
              <div
                className={`transition-opacity duration-300 ${!selectedProjectId || isAnalyzing ? "opacity-40 pointer-events-none" : "opacity-100"}`}
              >
              {/* Verdict Section */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm mb-8">
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
                  <div className="flex-1 flex flex-col items-center md:items-start">
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
                      {explanations.feasibility ||
                        "Calculated based on current inputs."}
                    </p>
                    {performanceRecommendation && (
                      <div className="mt-2 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-500 w-full text-left">
                        <span className="font-bold text-gray-700 block mb-1">Recommendation:</span>
                        {performanceRecommendation}
                      </div>
                    )}
                    {improvementTips.feasibility && (
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
                          {improvementTips.feasibility}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Guide: 3-Tier Defense System */}
              {feasibilityStatus === "FEASIBLE" ? (
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border-2 border-emerald-200 p-6 md:p-8 shadow-sm mb-8">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                    <div className="text-4xl sm:text-5xl">🎉</div>
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Defense Ready
                        </span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-950">
                          Excellent News! Ready for Defense
                        </h3>
                      </div>
                      <p className="text-emerald-800 font-medium mb-4 text-sm sm:text-base">
                        Your feasibility study demonstrates sound business fundamentals and realistic financial projections:
                      </p>
                      <ul className="space-y-2.5 text-emerald-900 text-sm text-left">
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
                          <span><strong>Defensible Profit Margins:</strong> Net profit is positive and within normal commercial standards.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
                          <span><strong>Cash Safety Buffer:</strong> Cash reserves cover recurring monthly bills without risk of immediate deficit.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
                          <span><strong>Realistic Capital Payback:</strong> Initial capital investments are projected to recover within 3 years.</span>
                        </li>
                      </ul>
                      <div className="mt-5 p-4 bg-white/80 rounded-xl border border-emerald-200 text-left">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                          Recommended Defense Next Steps:
                        </p>
                        <ul className="text-sm text-emerald-900 space-y-1.5">
                          <li className="flex gap-2"><span className="text-emerald-600 font-bold">✓</span> <span>Export your final feasibility report for your defense presentation slides.</span></li>
                          <li className="flex gap-2"><span className="text-emerald-600 font-bold">✓</span> <span>Prepare supplier quotations to defend your raw material costs during Q&A.</span></li>
                          <li className="flex gap-2"><span className="text-emerald-600 font-bold">✓</span> <span>Highlight your break-even sales target to show panelists your sales plan is achievable.</span></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : feasibilityStatus === "CONDITIONALLY_FEASIBLE" ? (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-300 p-6 md:p-8 shadow-sm mb-8">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                    <div className="text-4xl sm:text-5xl">⚠️</div>
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-200 text-amber-900 border border-amber-300">
                          Action Required Before Defense
                        </span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-amber-950">
                          Defense Revision Checklist
                        </h3>
                      </div>
                      <p className="text-amber-900 font-medium mb-4 text-sm sm:text-base">
                        Your project is conditionally viable, but defense panelists will challenge these specific numbers. Adjust them in <strong>Financial Input</strong> before your final defense:
                      </p>

                      {/* Dynamic List of Specific Severe Flags */}
                      <div className="space-y-3 mb-5">
                        {severeFlags && severeFlags.length > 0 ? (
                          severeFlags.map((flag, idx) => (
                            <div
                              key={flag.id || idx}
                              className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs text-left"
                            >
                              <div className="flex items-center justify-between mb-1.5 gap-2">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                  <h4 className="font-bold text-[#122244] text-sm">
                                    {flag.title}
                                  </h4>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                                  Fix Needed
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 leading-relaxed mb-2">
                                {flag.description}
                              </p>
                              <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900 font-medium flex items-start gap-2">
                                <span className="font-extrabold text-amber-700 shrink-0">Action:</span>
                                <span>{flag.tip}</span>
                              </div>
                            </div>
                          ))
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
                          <li className="flex gap-2"><span className="font-bold text-amber-700">1.</span> <span>Click <strong>Revise Financial Data</strong> below to update selling prices, overhead, or cash reserves.</span></li>
                          <li className="flex gap-2"><span className="font-bold text-amber-700">2.</span> <span>Click <strong>Run Feasibility Analysis</strong> again to re-audit your revised numbers.</span></li>
                          <li className="flex gap-2"><span className="font-bold text-amber-700">3.</span> <span>Once flags are cleared, your verdict will elevate to <strong>FEASIBLE</strong>.</span></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-rose-50 to-red-50 rounded-2xl border-2 border-rose-300 p-6 md:p-8 shadow-sm mb-8">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                    <div className="text-4xl sm:text-5xl">🛑</div>
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
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
                        {fatalFlaws && fatalFlaws.length > 0 ? (
                          fatalFlaws.map((flaw, idx) => (
                            <div
                              key={idx}
                              className="bg-white rounded-xl border border-rose-200 p-3.5 shadow-2xs text-left flex items-start gap-2.5"
                            >
                              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-rose-900 font-medium">{flaw}</span>
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
                          <li className="flex gap-2"><span className="font-bold text-rose-700">1.</span> <span>Ensure your unit selling price is higher than the unit cost of production.</span></li>
                          <li className="flex gap-2"><span className="font-bold text-rose-700">2.</span> <span>Increase declared startup capital so it fully covers all initial equipment.</span></li>
                          <li className="flex gap-2"><span className="font-bold text-rose-700">3.</span> <span>Adjust monthly sales volume or reduce fixed monthly bills to stop operating at a loss.</span></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Market Environment & Competitive Landscape */}
              {((financials.directCompetitors && financials.directCompetitors.length > 0) ||
                (financials.otherCompetitors && financials.otherCompetitors.length > 0) ||
                (financials.nearbyEstablishments && financials.nearbyEstablishments.length > 0) ||
                financials.footTrafficPeak ||
                financials.marketDemandNotes) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 shadow-sm mb-8 space-y-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#c9a654]/15 border border-[#c9a654]/30 flex items-center justify-center text-[#c9a654] shrink-0">
                          <Target className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-extrabold text-[#122244]">
                            Market Indicators & Competitive Landscape
                          </h3>
                          <p className="text-xs text-gray-500">
                            Audited competitor density, nearby establishment foot traffic & business ROI drivers
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black rounded-lg shrink-0">
                        {financials.marketDemand || "Medium"} Demand Profile
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Direct Competitors */}
                      <div className="p-4 bg-gray-50/70 border border-gray-200/80 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1.5">
                            <Store size={14} className="text-[#c9a654]" /> Direct Competitors
                          </span>
                          <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                            {financials.directCompetitors?.length || 0} Listed
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {financials.directCompetitors && financials.directCompetitors.length > 0 ? (
                            financials.directCompetitors.map((comp, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-white border border-amber-200 text-amber-900 text-xs font-bold rounded-lg shadow-2xs"
                              >
                                {comp}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">None specified in financial input.</span>
                          )}
                        </div>
                      </div>

                      {/* Other Competitors (Indirect & Substitutes) */}
                      <div className="p-4 bg-gray-50/70 border border-gray-200/80 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={14} className="text-sky-600" /> Other / Indirect Competitors
                          </span>
                          <span className="text-[10px] font-black text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                            {financials.otherCompetitors?.length || 0} Listed
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {financials.otherCompetitors && financials.otherCompetitors.length > 0 ? (
                            financials.otherCompetitors.map((comp, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-white border border-sky-200 text-sky-900 text-xs font-bold rounded-lg shadow-2xs"
                              >
                                {comp}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">None specified in financial input.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Nearby Establishments Driving ROI */}
                    <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 size={14} className="text-emerald-600" /> Nearby Establishments Affecting ROI (Foot Traffic Drivers)
                        </span>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          {financials.nearbyEstablishments?.length || 0} Establishments
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {financials.nearbyEstablishments && financials.nearbyEstablishments.length > 0 ? (
                          financials.nearbyEstablishments.map((est, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-950 text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1"
                            >
                              <MapPin size={11} className="text-emerald-600" /> {est}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">No nearby establishments listed.</span>
                        )}
                      </div>
                      {financials.footTrafficPeak && (
                        <p className="text-xs text-emerald-800 pt-1">
                          <strong>Foot Traffic Pattern:</strong> {financials.footTrafficPeak}
                        </p>
                      )}
                      {financials.marketDemandNotes && (
                        <p className="text-xs text-gray-600 italic bg-white/70 p-2.5 rounded-lg border border-emerald-100 mt-2">
                          "{financials.marketDemandNotes}"
                        </p>
                      )}
                    </div>

                    {/* AI Market Indicators & Viability Evaluation */}
                    <div className="pt-4 border-t border-gray-100 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1.5">
                          <Zap size={14} className="text-[#c9a654]" /> AI Market Viability & Competitive Intelligence
                        </span>
                        {marketAnalysis?.competitorInsight?.badge && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Market Feasibility Audited
                          </span>
                        )}
                      </div>

                      {marketAnalysis?.summary ? (
                        <div className="space-y-3">
                          {/* High-Level Narrative Summary */}
                          <div className="p-3.5 bg-amber-50/60 border border-amber-200/70 rounded-xl text-xs sm:text-sm text-[#122244] leading-relaxed">
                            <span className="font-bold text-amber-900">Market Assessment: </span>
                            {marketAnalysis.summary}
                          </div>

                          {/* 3 Structured Pillars */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Pillar 1: Competitors */}
                            {marketAnalysis.competitorInsight && (
                              <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1">
                                    <Store size={12} className="text-amber-600" /> Competitor Density
                                  </span>
                                  <span
                                    className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${marketAnalysis.competitorInsight.status === "positive"
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : "bg-amber-100 text-amber-800 border border-amber-200"
                                      }`}
                                  >
                                    {marketAnalysis.competitorInsight.badge}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 leading-normal">
                                  {marketAnalysis.competitorInsight.text}
                                </p>
                              </div>
                            )}

                            {/* Pillar 2: Foot Traffic & Anchors */}
                            {marketAnalysis.footTrafficInsight && (
                              <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1">
                                    <Building2 size={12} className="text-emerald-600" /> Foot Traffic & Anchors
                                  </span>
                                  <span
                                    className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${marketAnalysis.footTrafficInsight.status === "positive"
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : "bg-rose-100 text-rose-800 border border-rose-200"
                                      }`}
                                  >
                                    {marketAnalysis.footTrafficInsight.badge}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 leading-normal">
                                  {marketAnalysis.footTrafficInsight.text}
                                </p>
                              </div>
                            )}

                            {/* Pillar 3: Demographics & Pricing */}
                            {marketAnalysis.demographicInsight && (
                              <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1">
                                    <Lightbulb size={12} className="text-sky-600" /> Demographic Strategy
                                  </span>
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-sky-100 text-sky-800 border border-sky-200">
                                    {marketAnalysis.demographicInsight.badge}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 leading-normal">
                                  {marketAnalysis.demographicInsight.text}
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

              {/* 5-Year Pro Forma Financial Statement */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 md:p-8 shadow-sm mb-8 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                  <h3 className="text-lg font-extrabold text-[#122244] flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#c9a654] flex-shrink-0" /> 5-Year Pro
                    Forma Financial Projection
                  </h3>
                  <button
                    onClick={() => setShowProFormaInputs(!showProFormaInputs)}
                    className="w-full sm:w-auto text-[11px] font-bold uppercase text-[#c9a654] hover:text-[#a87d3a] transition-colors px-3 py-2 sm:py-1.5 border border-[#c9a654]/30 rounded-lg hover:bg-[#c9a654]/5 flex-shrink-0"
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
                          onChange={(e) =>
                            setRevenueGrowthRate(Number(e.target.value))
                          }
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#c9a654]"
                        />
                        <div className="w-12 px-2 py-1.5 text-center bg-white border border-gray-300 rounded font-bold text-[#122244] text-sm">
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
                          onChange={(e) =>
                            setCostGrowthRate(Number(e.target.value))
                          }
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#c9a654]"
                        />
                        <div className="w-12 px-2 py-1.5 text-center bg-white border border-gray-300 rounded font-bold text-[#122244] text-sm">
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
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                      Metrics:
                    </span>
                    {(() => {
                      const cData = getChartData();
                      const yr5 = cData[cData.length - 1];
                      return proFormaSeriesConfig.map((series) => {
                        const isVisible = visibleSeries[series.key];
                        const yr5Val = yr5 ? yr5[series.key as keyof typeof yr5] : null;

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
                            <span className={isVisible ? "font-bold text-[11px]" : "line-through text-gray-400 text-[11px]"}>
                              {series.shortLabel}
                            </span>
                            {typeof yr5Val === "number" && (
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
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

                  <div className="flex items-center gap-2 self-start lg:self-auto">
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
                <div
                  className="mb-6 w-full relative"
                  style={{
                    height: "430px",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={getChartData()}
                      margin={{ top: 18, right: 30, left: 10, bottom: 20 }}
                      barGap={chartMode === "grouped" ? 4 : 0}
                      barCategoryGap="22%"
                    >
                      <defs>
                        {/* Revenue Bar Gradient */}
                        <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#047857" stopOpacity={0.85} />
                        </linearGradient>
                        {/* COGS Bar Gradient */}
                        <linearGradient id="cogsBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#be123c" stopOpacity={0.8} />
                        </linearGradient>
                        {/* Fixed Costs Bar Gradient */}
                        <linearGradient id="fixedCostsBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#b45309" stopOpacity={0.8} />
                        </linearGradient>
                        {/* Net Profit Flow Aura */}
                        <linearGradient id="netProfitAura" x1="0" y1="0" x2="0" y2="1">
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
                        padding={{ left: 24, right: 24 }}
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
                          fill="url(#revenueBarGrad)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={34}
                        />
                      )}
                      {visibleSeries["COGS"] && (
                        <Bar
                          dataKey="COGS"
                          name="COGS"
                          stackId={chartMode === "stacked" ? "expenses" : undefined}
                          fill="url(#cogsBarGrad)"
                          radius={
                            chartMode === "grouped" || !visibleSeries["Fixed Costs"] || !getChartData().some((d) => (d["Fixed Costs"] || 0) > 0)
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
                          fill="url(#fixedCostsBarGrad)"
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
                          fill="url(#netProfitAura)"
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
                        <th className="text-left px-4 py-3 font-bold text-gray-700">
                          Metric
                        </th>
                        {getChartData().map((row, idx) => (
                          <th
                            key={idx}
                            className="text-right px-4 py-3 font-bold text-gray-700"
                          >
                            {row.year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          Revenue
                        </td>
                        {getChartData().map((row, idx) => (
                          <td
                            key={idx}
                            className="text-right px-4 py-3 text-emerald-600 font-bold"
                          >
                            ₱{row.Revenue.toLocaleString("en-PH")}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          COGS
                        </td>
                        {getChartData().map((row, idx) => (
                          <td
                            key={idx}
                            className="text-right px-4 py-3 text-rose-600 font-bold"
                          >
                            ₱{row.COGS.toLocaleString("en-PH")}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          Fixed Costs
                        </td>
                        {getChartData().map((row, idx) => (
                          <td
                            key={idx}
                            className="text-right px-4 py-3 text-amber-600 font-bold"
                          >
                            ₱{row["Fixed Costs"].toLocaleString("en-PH")}
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-blue-50 border-t-2 border-blue-200">
                        <td className="px-4 py-3 font-extrabold text-blue-900">
                          Net Profit
                        </td>
                        {getChartData().map((row, idx) => (
                          <td
                            key={idx}
                            className={`text-right px-4 py-3 font-extrabold ${row["Net Profit"] >= 0
                              ? "text-blue-600"
                              : "text-rose-600"
                              }`}
                          >
                            ₱{row["Net Profit"].toLocaleString("en-PH")}
                          </td>
                        ))}
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
                    <li>
                      • Revenue is projected to grow at{" "}
                      <strong>{revenueGrowthRate}% annually</strong>, reaching{" "}
                      <strong>
                        ₱
                        {(
                          getChartData()[4].Revenue -
                          getChartData()[0].Revenue
                        ).toLocaleString("en-PH")}
                      </strong>
                      ,{" "}
                      {getChartData()[4]["Net Profit"] >
                        getChartData()[0]["Net Profit"]
                        ? "showing strong growth"
                        : "indicating need for cost optimization"}
                    </li>
                  </ul>
                </div>
              </div>

              {/* Strategic Insights */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-gray-100 gap-2 mb-6">
                  <div>
                    <h3 className="text-lg font-extrabold text-[#122244] flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-[#c9a654]" /> Strategic Insights & Financial Health
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
                    {insights.map((insight) => {
                      const isPos = insight.type === "positive";
                      const isWarn = insight.type === "warning";
                      return (
                        <div
                          key={insight.id}
                          className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between transition-all shadow-2xs hover:shadow-xs bg-white ${
                            isPos
                              ? "border-emerald-200/90"
                              : isWarn
                              ? "border-amber-300"
                              : "border-sky-200"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-2.5">
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
                                  {insight.title}
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
                              {insight.description}
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

              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
                <button
                  onClick={() =>
                    navigate("/financial-input", {
                      state: { projectId: selectedProjectId },
                    })
                  }
                  className="w-full sm:w-auto flex justify-center items-center gap-2 px-6 py-3 sm:py-2.5 bg-white border border-gray-200 rounded-xl sm:rounded-lg font-bold text-sm text-[#122244] hover:bg-gray-50 transition-all shadow-sm"
                >
                  <FileEdit className="w-4 h-4" /> Revise Financial Data
                </button>
                <button
                  onClick={() =>
                    navigate("/reports", {
                      state: { projectId: selectedProjectId },
                    })
                  }
                  className="w-full sm:w-auto flex justify-center items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-3 sm:py-2.5 rounded-xl sm:rounded-lg font-bold text-sm transition-all shadow-md"
                >
                  <BarChart3 className="w-4 h-4" /> View Full Report
                </button>
              </div>
            </div>
            )}
          </div>
        )}

        {/* Floating Back to Top Button */}
        <ScrollToTopButton />
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="bg-white rounded-2xl p-6 z-10 w-full max-w-sm shadow-xl text-center relative">
            <h3 className="text-lg font-bold text-[#122244] mb-6">
              Sign out of FeasiFy?
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold shadow-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AI_Analysis;
