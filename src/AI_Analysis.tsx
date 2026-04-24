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
          console.error(error);
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
      groupSnap.forEach((doc) => {
        const data = doc.data();
        if (
          data.leaderId === uid ||
          (data.memberIds && data.memberIds.includes(uid))
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

        // Filter approved projects
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
            parentGroupId: userGroupId,
          }));

        setProjects(approvedProjects);
      }
    } catch (error) {
      console.error("Load failed:", error);
    }
  };

  // --- FIX 1: Listener that synchronizes the selected project accurately ---
  useEffect(() => {
    if (projects.length === 0) return;

    const routeProjectId = location.state?.projectId;
    const sessionProjectId = sessionStorage.getItem("lastSelectedProjectId");
    const targetId = routeProjectId || sessionProjectId || projects[0].id;

    const proj = projects.find((p) => p.id === targetId) || projects[0];

    if (proj && proj.id !== selectedProjectId) {
      setSelectedProjectId(proj.id);
      sessionStorage.setItem("lastSelectedProjectId", proj.id);

      const data = proj.financialData || {
        sellingPrice: 0,
        monthlySales: 0,
        variableCost: 0,
        fixedCosts: 0,
        startupCapital: 0,
        competitorCount: 0,
        marketDemand: "Medium",
      };

      setFinancials({
        sellingPrice: Number(data.sellingPrice) || 0,
        monthlySales: Number(data.monthlySales) || 0,
        variableCost: Number(data.variableCost) || 0,
        fixedCosts: Number(data.fixedCosts) || 0,
        startupCapital: Number(data.startupCapital) || 0,
        competitorCount: Number(data.competitorCount) || 0,
        marketDemand: data.marketDemand || "Medium",
      });

      // Load existing analysis if we are NOT about to run a new one
      if (!location.state?.runAnalysis) {
        if (proj.aiAnalysis) {
          setFeasibilityScore(proj.aiAnalysis.score);
          setFeasibilityStatus(proj.aiAnalysis.status);
          setMetrics(proj.aiAnalysis.metrics);
          setInsights(proj.aiAnalysis.insights);
        } else {
          setFeasibilityScore(0);
          setFeasibilityStatus("PENDING");
          setInsights([]);
          setMetrics({ feasibility: 0, financial: 0, risk: 0, market: 0 });
        }
      }
    }
  }, [location.state?.projectId, projects, selectedProjectId]);

  // --- FIX 2: Listener that catches the "Run Analysis" button click specifically ---
  useEffect(() => {
    if (projects.length === 0 || !selectedProjectId) return;

    if (location.state?.runAnalysis) {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj) {
        const data = proj.financialData || {
          sellingPrice: 0,
          monthlySales: 0,
          variableCost: 0,
          fixedCosts: 0,
          startupCapital: 0,
          competitorCount: 0,
          marketDemand: "Medium",
        };

        const sanitized = {
          sellingPrice: Number(data.sellingPrice) || 0,
          monthlySales: Number(data.monthlySales) || 0,
          variableCost: Number(data.variableCost) || 0,
          fixedCosts: Number(data.fixedCosts) || 0,
          startupCapital: Number(data.startupCapital) || 0,
          competitorCount: Number(data.competitorCount) || 0,
          marketDemand: data.marketDemand || "Medium",
        };

        executeAnalysis(sanitized, selectedProjectId);

        // Clear the state so it doesn't infinitely loop
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state?.runAnalysis, projects, selectedProjectId, navigate]);

  const executeAnalysis = async (data: any, pId: string) => {
    if (!pId) return;
    setIsAnalyzing(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const monthlyRevenue = data.sellingPrice * data.monthlySales;
    const monthlyVariableCosts = data.variableCost * data.monthlySales;
    const netMonthlyProfit =
      monthlyRevenue - monthlyVariableCosts - data.fixedCosts;
    const margin =
      monthlyRevenue > 0 ? (netMonthlyProfit / monthlyRevenue) * 100 : 0;
    const paybackMonths =
      netMonthlyProfit > 0 ? data.startupCapital / netMonthlyProfit : 999;

    let score = 0;
    let status: "FEASIBLE" | "MODERATE" | "NOT_FEASIBLE" = "NOT_FEASIBLE";
    let generatedInsights: InsightItem[] = [];
    let calculatedMetrics = {
      feasibility: 0,
      financial: 0,
      risk: 0,
      market: 0,
    };
    let useFallbackEngine = false;

    try {
      if (apiKey && apiKey.length > 10 && !apiKey.includes("your_api_key")) {
        try {
          const prompt = `Analyze this business model: Selling Price: ₱${data.sellingPrice}, Monthly Sales: ${data.monthlySales}, Variable Cost: ₱${data.variableCost}, Fixed Costs: ₱${data.fixedCosts}, Startup Capital: ₱${data.startupCapital}, Competitors: ${data.competitorCount}, Demand: ${data.marketDemand}. Provide JSON: {"score": 0-100, "status": "FEASIBLE"|"MODERATE"|"NOT_FEASIBLE", "financialHealth": 0-100, "riskLevel": 0-100, "marketViability": 0-100, "insights": [{"title": "str", "description": "str", "type": "positive"|"warning"|"info"|"suggestion"}]}`;

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
              }),
            },
          );

          const resData = await response.json();
          if (!response.ok) throw new Error("API Error");

          let textResponse = resData.candidates[0].content.parts[0].text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
          const aiResult = JSON.parse(textResponse);

          score = aiResult.score;
          status = aiResult.status;
          generatedInsights = aiResult.insights.map((i: any, idx: number) => ({
            ...i,
            id: `ai-${idx}`,
          }));
          calculatedMetrics = {
            feasibility: score,
            financial: aiResult.financialHealth,
            risk: aiResult.riskLevel,
            market: aiResult.marketViability,
          };
        } catch (e) {
          useFallbackEngine = true;
        }
      } else {
        useFallbackEngine = true;
      }

      if (useFallbackEngine) {
        await new Promise((r) => setTimeout(r, 2000));
        score = Math.floor(40 + margin * 0.5);
        if (paybackMonths <= 12) score += 20;
        score = Math.max(10, Math.min(100, score));
        status =
          score >= 70 ? "FEASIBLE" : score >= 45 ? "MODERATE" : "NOT_FEASIBLE";
        generatedInsights.push({
          id: "1",
          type: "info",
          title: "Quick Analysis",
          description: `Business shows a ${margin.toFixed(1)}% margin.`,
        });
        calculatedMetrics = {
          feasibility: score,
          financial: score,
          risk: 50,
          market: 50,
        };
      }

      await updateDoc(doc(db, "proposals", pId), {
        aiAnalysis: {
          score,
          status,
          metrics: calculatedMetrics,
          insights: generatedInsights,
          lastRun: new Date().toISOString(),
        },
      });

      const selected = projects.find((p) => p.id === pId);
      if (selected && selected.parentGroupId) {
        await updateDoc(doc(db, "groups", selected.parentGroupId), {
          status:
            status === "FEASIBLE"
              ? "Feasible"
              : status === "MODERATE"
                ? "Needs Review"
                : "Not Feasible",
        });
      }

      setFeasibilityScore(score);
      setFeasibilityStatus(status);
      setMetrics(calculatedMetrics);
      setInsights(generatedInsights);

      // Update projects array locally
      setProjects((prev) =>
        prev.map((p) =>
          p.id === pId
            ? {
                ...p,
                aiAnalysis: {
                  score,
                  status,
                  metrics: calculatedMetrics,
                  insights: generatedInsights,
                },
              }
            : p,
        ),
      );
    } catch (err) {
      alert("Analysis failed to save.");
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

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    navigate("/");
  };

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
          <button
            onClick={() => navigate("/notifications")}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all relative flex-shrink-0"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
            )}
          </button>
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
            className="cursor-pointer hover:text-[#c9a654] transition-colors"
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
              Analyzing Financial Data...
            </h2>
            <p className="text-gray-500">
              Our AI is crunching the numbers for{" "}
              {selectedProject?.name || "the project"}.
            </p>
          </div>
        ) : (
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-[#3d2c23]">
                  AI Analysis
                </h1>
                <p className="text-sm text-gray-500 mt-1 italic">
                  AI-powered feasibility insights for{" "}
                  <span className="font-bold text-[#122244]">
                    {selectedProject?.name || "No Project Selected"}
                  </span>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => executeAnalysis(financials, selectedProjectId)}
                  disabled={!selectedProjectId}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" /> Re-analyze
                </button>
              </div>
            </div>

            {/* --- STATIC PROJECT TITLE (REPLACED DROPDOWN) --- */}
            <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                Project Under Evaluation
              </label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-lg border border-blue-100">
                  P#
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-[#122244] tracking-tight">
                    {selectedProject?.name || "No active project"}
                  </h2>
                  {selectedProjectId && (
                    <span className="inline-block mt-1 text-[10px] font-black uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      Verified Approved Business
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* --- END OF CHANGE --- */}

            <div
              className={`transition-opacity duration-300 ${!selectedProjectId || feasibilityStatus === "PENDING" ? "opacity-40 pointer-events-none" : "opacity-100"}`}
            >
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
                      {feasibilityStatus !== "PENDING" && (
                        <span
                          className={`inline-block px-3 py-1 text-white text-xs font-bold rounded-full shadow-sm ${feasibilityStatus === "FEASIBLE" ? "bg-green-500" : feasibilityStatus === "NOT_FEASIBLE" ? "bg-red-500" : "bg-orange-500"}`}
                        >
                          {feasibilityStatus.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {feasibilityStatus === "PENDING"
                        ? "Run analysis to see your project's feasibility verdict."
                        : feasibilityStatus === "FEASIBLE"
                          ? "This project shows strong viability based on provided numbers."
                          : feasibilityStatus === "MODERATE"
                            ? "Project is moderately feasible but carries risk."
                            : "This project is currently NOT feasible based on the provided data."}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {feasibilityStatus !== "PENDING" ? (
                      <>
                        <div
                          className={`text-5xl font-extrabold mb-1 ${feasibilityStatus === "FEASIBLE" ? "text-green-500" : feasibilityStatus === "NOT_FEASIBLE" ? "text-red-500" : "text-orange-500"}`}
                        >
                          {feasibilityScore}
                        </div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                          out of 100
                        </div>
                      </>
                    ) : (
                      <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                        Awaiting analysis
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Feasibility Score
                  </p>
                  <div className="space-y-3">
                    <div className="text-3xl font-extrabold text-[#122244]">
                      {metrics.feasibility}%
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-[#122244] h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${metrics.feasibility}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Financial Health
                  </p>
                  <div className="space-y-3">
                    <div className="text-3xl font-extrabold text-[#122244]">
                      {metrics.financial}%
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`${metrics.financial > 70 ? "bg-green-500" : metrics.financial > 40 ? "bg-orange-500" : "bg-red-500"} h-2 rounded-full transition-all duration-1000`}
                        style={{ width: `${metrics.financial}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Risk Level
                  </p>
                  <div className="space-y-3">
                    <div className="text-3xl font-extrabold text-[#122244]">
                      {metrics.risk}%
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`${metrics.risk < 30 ? "bg-green-500" : metrics.risk < 70 ? "bg-orange-500" : "bg-red-500"} h-2 rounded-full transition-all duration-1000`}
                        style={{ width: `${metrics.risk}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Market Viability
                  </p>
                  <div className="space-y-3">
                    <div className="text-3xl font-extrabold text-[#122244]">
                      {metrics.market}%
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-[#c9a654] h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${metrics.market}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                <h3 className="text-lg font-extrabold text-[#122244] mb-6 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-[#c9a654]" /> AI-Generated
                  Insights
                </h3>
                {insights.length > 0 ? (
                  <div className="space-y-4">
                    {insights.map((insight) => (
                      <div
                        key={insight.id}
                        className={`rounded-xl border p-5 flex gap-4 shadow-sm ${getInsightBgColor(insight.type)}`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getInsightIcon(insight.type)}
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
                      No insights available yet. Run analysis to view
                      recommendations.
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
                  className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
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
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200 relative">
            <h3 className="text-lg font-bold text-[#122244] mb-2 text-center">
              Sign Out?
            </h3>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="flex-1 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-900/10 transition-colors"
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
