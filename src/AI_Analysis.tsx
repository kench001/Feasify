import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
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
  Sidebar as SidebarIcon,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Bell,
} from "lucide-react";

interface InsightItem {
  id: string;
  title: string;
  description: string;
  type: "positive" | "warning" | "info" | "suggestion";
}

const AI_Analysis: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [financials, setFinancials] = useState({
    sellingPrice: 0,
    monthlySales: 0,
    variableCost: 0,
    fixedCosts: 0,
    startupCapital: 0,
    competitorCount: 0,
    marketDemand: "Medium",
  });

  const [explanations, setExplanations] = useState<any>({});
  const [improvementTips, setImprovementTips] = useState<any>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feasibilityScore, setFeasibilityScore] = useState(0);
  const [feasibilityStatus, setFeasibilityStatus] = useState<
    "FEASIBLE" | "MODERATE" | "NOT_FEASIBLE" | "PENDING"
  >("PENDING");
  const [metrics, setMetrics] = useState({
    feasibility: 0,
    financial: 0,
    risk: 0,
    market: 0,
  });
  const [insights, setInsights] = useState<InsightItem[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setUserName(
            [data.firstName, data.lastName].filter(Boolean).join(" ") ||
              u.displayName ||
              "",
          );
          if (data.section) loadUserGroup(u.uid, data.section);
        }
      } else navigate("/");
    });
    return () => unsub();
  }, [navigate]);

  const loadUserGroup = async (uid: string, section: string) => {
    try {
      const groupQ = query(
        collection(db, "groups"),
        where("section", "==", section),
      );
      const groupSnap = await getDocs(groupQ);
      let userGroupId = "";
      groupSnap.forEach((doc) => {
        const gData = doc.data();
        if (
          gData.leaderId === uid ||
          (gData.memberIds && gData.memberIds.includes(uid))
        ) {
          userGroupId = doc.id;
        }
      });

      if (userGroupId) {
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
            financialData: doc.data().financialData || null,
            aiAnalysis: doc.data().aiAnalysis || null,
          }));
        setProjects(approvedProjects);
      }
    } catch (error) {
      console.error("Load failed:", error);
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
      const data = proj.financialData;
      setFinancials({
        sellingPrice: Number(data?.sellingPrice) || 0,
        monthlySales: Number(data?.monthlySales) || 0,
        variableCost: Number(data?.variableCost) || 0,
        fixedCosts: Number(data?.fixedCosts) || 0,
        startupCapital: Number(data?.startupCapital) || 0,
        competitorCount: Number(data?.competitorCount) || 0,
        marketDemand: data?.marketDemand || "Medium",
      });

      // --- CRITICAL FIX: Properly loading INSIGHTS from database ---
      if (proj.aiAnalysis && !location.state?.runAnalysis) {
        setFeasibilityScore(proj.aiAnalysis.score || 0);
        setFeasibilityStatus(proj.aiAnalysis.status || "PENDING");
        setMetrics(
          proj.aiAnalysis.metrics || {
            feasibility: 0,
            financial: 0,
            risk: 0,
            market: 0,
          },
        );
        setExplanations(proj.aiAnalysis.explanations || {});
        setImprovementTips(proj.aiAnalysis.improvementTips || {});
        // Restore the insights array here
        setInsights(proj.aiAnalysis.insights || []);
      } else if (!location.state?.runAnalysis) {
        setFeasibilityScore(0);
        setFeasibilityStatus("PENDING");
        setInsights([]);
        setExplanations({});
        setImprovementTips({});
      }
    }
  }, [location.state, projects]);

  useEffect(() => {
    if (
      projects.length > 0 &&
      selectedProjectId &&
      location.state?.runAnalysis
    ) {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj) {
        executeAnalysis(proj.financialData, selectedProjectId);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, projects, selectedProjectId, navigate]);

  const executeAnalysis = async (data: any, pId: string) => {
    if (!pId) return;
    setIsAnalyzing(true);

    const revenue =
      (Number(data.sellingPrice) || 0) * (Number(data.monthlySales) || 0);
    const vCosts =
      (Number(data.variableCost) || 0) * (Number(data.monthlySales) || 0);
    const fCosts = Number(data.fixedCosts) || 0;
    const netProfit = revenue - vCosts - fCosts;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    const financialHealth = Math.min(
      100,
      Math.max(0, Math.floor(margin * 2 + 30)),
    );
    const marketScore =
      data.marketDemand === "High"
        ? 90
        : data.marketDemand === "Medium"
          ? 60
          : 30;
    const riskScore = Math.max(
      0,
      100 -
        ((Number(data.competitorCount) || 0) * 10 + (netProfit < 0 ? 30 : 0)),
    );
    const finalScore = Math.floor(
      (financialHealth + marketScore + (100 - riskScore)) / 3,
    );
    const status =
      finalScore >= 70
        ? "FEASIBLE"
        : finalScore >= 45
          ? "MODERATE"
          : "NOT_FEASIBLE";

    const calculatedMetrics = {
      feasibility: finalScore,
      financial: financialHealth,
      risk: riskScore,
      market: marketScore,
    };

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    try {
      const prompt = `Act as a Senior Business Consultant. Project: Score ${finalScore}%, Margin ${margin.toFixed(1)}%, Risk ${riskScore}%.
      Provide analysis in JSON. Return exactly 3 professional "insights". 
      Use professional terms like 'Operating Leverage', 'Competitive Moat', and 'Capital Allocation'.
      
      Return JSON ONLY: 
      {
        "explanations": {
          "feasibility": "Summary of viability.",
          "financial": "Analysis of liquidity/margins.",
          "risk": "Assessment of vulnerability.",
          "market": "Evaluation of demand dynamics."
        },
        "tips": {
          "feasibility": "Strategic advice.",
          "financial": "EBITDA improvement advice.",
          "risk": "Mitigation strategy.",
          "market": "Positioning advice."
        },
        "insights": [
          {"title": "Operational Strategy", "description": "str", "type": "positive"},
          {"title": "Market Positioning", "description": "str", "type": "warning"},
          {"title": "Financial Sustainability", "description": "str", "type": "info"}
        ]
      }`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );

      const resData = await response.json();
      const rawText = resData.candidates[0].content.parts[0].text;
      const cleanJson = rawText.substring(
        rawText.indexOf("{"),
        rawText.lastIndexOf("}") + 1,
      );
      const aiResult = JSON.parse(cleanJson);

      const generatedInsights = aiResult.insights.map(
        (i: any, idx: number) => ({ ...i, id: `ai-${idx}` }),
      );

      const finalData = {
        score: finalScore,
        status,
        metrics: calculatedMetrics,
        explanations: aiResult.explanations,
        improvementTips: aiResult.tips,
        insights: generatedInsights,
        lastRun: new Date().toISOString(),
      };

      await updateDoc(doc(db, "proposals", pId), { aiAnalysis: finalData });

      setFeasibilityScore(finalScore);
      setFeasibilityStatus(status);
      setMetrics(calculatedMetrics);
      setExplanations(aiResult.explanations);
      setImprovementTips(aiResult.tips);
      setInsights(generatedInsights);
    } catch (e) {
      // Professional Fallback with Insights included for persistence
      const fallbackExplanations = {
        feasibility: `Viability evaluated at ${finalScore}% based on fiscal projections.`,
        financial: `Potential is linked to a ${margin.toFixed(1)}% net margin.`,
        risk: `Risk exposure is moderate, influenced by current market participant density.`,
        market: `Demand-side dynamics are rated at a '${data.marketDemand}' level.`,
      };
      const fallbackTips = {
        feasibility:
          "Optimize operating leverage to stabilize long-term cash flows.",
        financial:
          "Review variable cost structures to widen net profit margins.",
        risk: "Establish a defensive position against market incumbents.",
        market:
          "Analyze customer acquisition costs to ensure sustainable penetration.",
      };
      const fallbackInsights: InsightItem[] = [
        {
          id: "f-1",
          title: "Margin Management",
          description: `Business maintains an estimated ${margin.toFixed(1)}% operational margin.`,
          type: "positive",
        },
        {
          id: "f-2",
          title: "Market Rivalry",
          description: `Competition level of ${data.competitorCount} requires high differentiation.`,
          type: "warning",
        },
        {
          id: "f-3",
          title: "Strategic Demand",
          description: `Model utilizes a ${data.marketDemand} demand forecast for scaling.`,
          type: "info",
        },
      ];

      const fallbackAnalysis = {
        score: finalScore,
        status,
        metrics: calculatedMetrics,
        explanations: fallbackExplanations,
        improvementTips: fallbackTips,
        insights: fallbackInsights,
        lastRun: new Date().toISOString(),
      };

      await updateDoc(doc(db, "proposals", pId), {
        aiAnalysis: fallbackAnalysis,
      });

      setFeasibilityScore(finalScore);
      setFeasibilityStatus(status);
      setMetrics(calculatedMetrics);
      setExplanations(fallbackExplanations);
      setImprovementTips(fallbackTips);
      setInsights(fallbackInsights);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "positive":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "warning":
        return <TrendingUp className="w-5 h-5 text-orange-500" />;
      case "info":
        return <Lightbulb className="w-5 h-5 text-blue-500" />;
      case "suggestion":
        return <Lightbulb className="w-5 h-5 text-purple-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getInsightBgColor = (type: string) => {
    switch (type) {
      case "positive":
        return "bg-green-50 border-green-200";
      case "warning":
        return "bg-orange-50 border-orange-200";
      case "info":
        return "bg-blue-50 border-blue-200";
      case "suggestion":
        return "bg-purple-50 border-purple-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
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
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
      <aside
        className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img
            src="/dashboard logo.png"
            alt="FeasiFy"
            className="w-70 h-20 object-contain"
          />
        </div>
        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">
              Main Menu
            </p>
            <div className="space-y-1">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button
                onClick={() => navigate("/projects")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Folder className="w-4 h-4" /> Business Proposal
              </button>
              <button
                onClick={() => navigate("/financial-input")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                <Zap className="w-4 h-4" /> AI Feasibility Analysis
              </button>
              <button
                onClick={() => navigate("/reports")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <BarChart3 className="w-4 h-4" /> Reports
              </button>
              <button
                onClick={() => navigate("/messages")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">
              Account
            </p>
            <div className="space-y-1">
              <button
                onClick={() => navigate("/profile")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <User className="w-4 h-4" /> Profile
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <ShieldAlert className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </nav>
        <div className="p-4 border-t border-white/10 bg-black/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
            {getInitials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-white">
              {userName || "User"}
            </p>
            <p className="text-[10px] text-gray-400 truncate">Student</p>
          </div>
        </div>
      </aside>

      <main
        className={`flex-1 transition-all duration-300 ease-in-out bg-gray-50/50 min-h-screen ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
      >
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-2">|</span>
          <span
            className="cursor-pointer hover:text-[#c9a654]"
            onClick={() => navigate("/dashboard")}
          >
            FeasiFy
          </span>
          <span>›</span>
          <span className="font-semibold text-gray-900">AI Analysis</span>
        </div>

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-[#c9a654] border-t-transparent animate-spin"></div>
              <Zap className="absolute inset-0 m-auto w-8 h-8 text-[#c9a654] animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-[#122244] mb-2">
              Analyzing Model...
            </h2>
            <p className="text-gray-500 italic">
              Processing professional insights for {selectedProject?.name}...
            </p>
          </div>
        ) : (
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-[#3d2c23]">
                  AI Analysis
                </h1>
                <p className="text-sm text-gray-500 mt-1 italic font-medium">
                  Evaluation for{" "}
                  <span className="text-[#122244] font-bold">
                    {selectedProject?.name || "Selected Project"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => executeAnalysis(financials, selectedProjectId)}
                disabled={!selectedProjectId}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
              >
                <RotateCcw className="w-4 h-4" /> Re-analyze
              </button>
            </div>

            <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                Active Project
              </label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-lg border border-blue-100">
                  P#
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-[#122244] tracking-tight">
                    {selectedProject?.name || "No Project Selected"}
                  </h2>
                  <span className="inline-block mt-1 text-[10px] font-black uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    Verified Approved Business
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`transition-opacity duration-300 ${!selectedProjectId || feasibilityStatus === "PENDING" ? "opacity-40 pointer-events-none" : "opacity-100"}`}
            >
              {/* Verdict Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm mb-8">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div
                      className={`flex items-center justify-center w-20 h-20 rounded-xl shadow-inner ${feasibilityStatus === "FEASIBLE" ? "bg-green-500" : feasibilityStatus === "NOT_FEASIBLE" ? "bg-red-500" : "bg-orange-500"}`}
                    >
                      <Zap className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-extrabold text-[#122244]">
                        Feasibility Verdict
                      </h2>
                      <span
                        className={`inline-block px-3 py-1 text-white text-xs font-bold rounded-full ${feasibilityStatus === "FEASIBLE" ? "bg-green-500" : feasibilityStatus === "NOT_FEASIBLE" ? "bg-red-500" : "bg-orange-500"}`}
                      >
                        {feasibilityStatus?.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {explanations.feasibility ||
                        "Calculated based on current inputs."}
                    </p>
                    {improvementTips.feasibility && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-[#c9a654]/10 rounded-full text-[11px] font-bold text-[#c9a654] border border-[#c9a654]/20">
                        <Lightbulb size={12} /> Strategic Tip:{" "}
                        {improvementTips.feasibility}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div
                      className={`text-5xl font-extrabold ${feasibilityStatus === "FEASIBLE" ? "text-green-500" : feasibilityStatus === "NOT_FEASIBLE" ? "text-red-500" : "text-orange-500"}`}
                    >
                      {feasibilityScore}
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase">
                      out of 100
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Feasibility Score
                  </p>
                  <div className="text-3xl font-extrabold text-[#122244] mb-2">
                    {metrics.feasibility}%
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                    <div
                      className="bg-[#122244] h-1.5 rounded-full"
                      style={{ width: `${metrics.feasibility}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-tight flex-1">
                    {explanations.feasibility}
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Financial Health
                  </p>
                  <div className="text-3xl font-extrabold text-[#122244] mb-2">
                    {metrics.financial}%
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                    <div
                      className={`${metrics.financial > 70 ? "bg-green-500" : "bg-red-500"} h-1.5 rounded-full`}
                      style={{ width: `${metrics.financial}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-tight mb-3 flex-1">
                    {explanations.financial}
                  </p>
                  {improvementTips.financial && (
                    <div className="mt-auto p-2 bg-blue-50 rounded text-[9px] text-blue-700 font-bold border border-blue-100 italic">
                      Tip: {improvementTips.financial}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Risk assessment
                  </p>
                  <div className="text-3xl font-extrabold text-[#122244] mb-2">
                    {metrics.risk}%
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                    <div
                      className={`${metrics.risk < 40 ? "bg-green-500" : "bg-orange-500"} h-1.5 rounded-full`}
                      style={{ width: `${metrics.risk}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-tight mb-3 flex-1">
                    {explanations.risk}
                  </p>
                  {improvementTips.risk && (
                    <div className="mt-auto p-2 bg-orange-50 rounded text-[9px] text-orange-700 font-bold border border-orange-100 italic">
                      Tip: {improvementTips.risk}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Market viability
                  </p>
                  <div className="text-3xl font-extrabold text-[#122244] mb-2">
                    {metrics.market}%
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                    <div
                      className="bg-[#c9a654] h-1.5 rounded-full"
                      style={{ width: `${metrics.market}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-tight mb-3 flex-1">
                    {explanations.market}
                  </p>
                  {improvementTips.market && (
                    <div className="mt-auto p-2 bg-purple-50 rounded text-[9px] text-purple-700 font-bold border border-purple-100 italic">
                      Tip: {improvementTips.market}
                    </div>
                  )}
                </div>
              </div>

              {/* Strategic Insights */}
              <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                <h3 className="text-lg font-extrabold text-[#122244] mb-6 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-[#c9a654]" /> Strategic
                  Insights
                </h3>
                {insights.length > 0 ? (
                  <div className="space-y-4">
                    {insights.map((insight) => (
                      <div
                        key={insight.id}
                        className="rounded-xl border p-5 flex gap-4 bg-gray-50/50 shadow-sm transition-all hover:bg-white"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {insight.type === "positive" ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-orange-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[#122244] mb-1">
                            {insight.title}
                          </h4>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    <Lightbulb className="w-8 h-8 text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm font-medium">
                      Re-analyze to refresh insights.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() =>
                    navigate("/financial-input", {
                      state: { projectId: selectedProjectId },
                    })
                  }
                  className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-lg font-bold text-sm text-[#122244] hover:bg-gray-50 transition-all shadow-sm"
                >
                  <FileEdit className="w-4 h-4" /> Revise Financial Data
                </button>
                <button
                  onClick={() =>
                    navigate("/reports", {
                      state: { projectId: selectedProjectId },
                    })
                  }
                  className="flex items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md"
                >
                  <BarChart3 className="w-4 h-4" /> View Full Report
                </button>
              </div>
            </div>
          </div>
        )}
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
