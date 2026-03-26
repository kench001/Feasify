import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, updateProject, getUserProjects } from "./firebase";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  Download,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  ChevronDown
} from "lucide-react";

interface InsightItem {
  id: string;
  title: string;
  description: string;
  type: "positive" | "warning" | "info" | "suggestion";
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

interface IncomeSource {
  id: string;
  name: string;
  amount: number;
}

const AI_Analysis: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Project Data
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  
  const [initialCapital, setInitialCapital] = useState(0);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);

  // AI Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feasibilityScore, setFeasibilityScore] = useState(0);
  const [feasibilityStatus, setFeasibilityStatus] = useState<"FEASIBLE" | "MODERATE" | "NOT_FEASIBLE" | "PENDING">("PENDING");
  
  const [metrics, setMetrics] = useState({
    feasibility: 0,
    financial: 0,
    risk: 0,
    market: 75,
  });

  const [insights, setInsights] = useState<InsightItem[]>([]);

  // Close custom dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsProjectMenuOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Authenticate & load basic user details + projects
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        loadUserProjects(u.uid);
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserName([data.firstName, data.lastName].filter(Boolean).join(" ") || u.displayName || "");
            setUserEmail(data.email || u.email || "");
          } else {
            setUserName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
            setUserEmail(u.email || "");
          }
        } catch (e) {}
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  const loadUserProjects = async (uid: string) => {
    try {
      const userProjects = await getUserProjects(uid);
      setProjects(userProjects);
      
      const state = location.state as any;
      const savedProjectId = sessionStorage.getItem("lastSelectedProjectId");
      
      if (state && state.projectId) {
        handleProjectSelect(state.projectId, userProjects);
      } else if (savedProjectId && userProjects.some(p => p.id === savedProjectId)) {
        handleProjectSelect(savedProjectId, userProjects);
      } else if (userProjects.length > 0) {
        handleProjectSelect(userProjects[0].id, userProjects);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  const handleProjectSelect = async (projectId: string, projectList = projects) => {
    setSelectedProjectId(projectId);
    sessionStorage.setItem("lastSelectedProjectId", projectId); // Save to memory!
    setIsProjectMenuOpen(false);
    
    const selectedProj = projectList.find(p => p.id === projectId);
    if (!selectedProj) return;

    const finData = selectedProj.financialData || {};
    setInitialCapital(finData.initialCapital || 0);
    setExpenses(finData.expenses || []);
    setIncomeSources(finData.incomeSources || []);

    // Check if AI analysis is already saved
    if (selectedProj.aiAnalysis) {
      setFeasibilityScore(selectedProj.aiAnalysis.score);
      setFeasibilityStatus(selectedProj.aiAnalysis.status);
      setMetrics(selectedProj.aiAnalysis.metrics);
      setInsights(selectedProj.aiAnalysis.insights);
    } else {
      // Clear out old data if switching to an un-analyzed project
      setFeasibilityScore(0);
      setFeasibilityStatus("PENDING");
      setInsights([]);
      
      // Run analysis automatically if there's financial data to analyze
      if (finData.initialCapital || finData.expenses?.length > 0 || finData.incomeSources?.length > 0) {
        runAnalysis(finData.initialCapital || 0, finData.expenses || [], finData.incomeSources || [], projectId);
      }
    }
  };

  const handleLogout = async () => {
    try { await fbSignOut(auth); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  // Algorithm to calculate feasibility
  const runAnalysis = async (cap: number, exp: ExpenseItem[], inc: IncomeSource[], pId: string = selectedProjectId) => {
    if (!pId) return;
    setIsAnalyzing(true);

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    const totalMonthlyExp = exp.reduce((sum, e) => sum + e.amount, 0);
    const totalDailyInc = inc.reduce((sum, i) => sum + i.amount, 0);
    const totalMonthlyInc = totalDailyInc * 30;
    const netMonthly = totalMonthlyInc - totalMonthlyExp;

    let calcScore = 0;
    let calcStatus: "FEASIBLE" | "MODERATE" | "NOT_FEASIBLE" | "PENDING" = "PENDING";
    let calcRisk = 0;
    const newInsights: InsightItem[] = [];

    if (totalMonthlyInc === 0 && totalMonthlyExp === 0 && cap === 0) {
      calcScore = 0;
      calcStatus = "PENDING";
      calcRisk = 0;
    } else if (totalMonthlyInc === 0) {
      calcScore = 10;
      calcStatus = "NOT_FEASIBLE";
      calcRisk = 95;
      newInsights.push({ id: "1", type: "warning", title: "Zero Income Projected", description: "You must add income sources for the project to be viable." });
    } else if (netMonthly < 0) {
      calcScore = 25;
      calcStatus = "NOT_FEASIBLE";
      calcRisk = 85;
      newInsights.push({ id: "1", type: "warning", title: "Negative Cash Flow", description: "Your operating expenses exceed your projected income. Review costs or pricing." });
      newInsights.push({ id: "2", type: "suggestion", title: "Cost Reduction Needed", description: "Identify non-essential expenses to cut down your monthly burn rate." });
    } else {
      const profitMargin = (netMonthly / totalMonthlyInc) * 100;
      const paybackMonths = cap > 0 ? cap / netMonthly : 0;

      calcScore = Math.min(100, Math.floor(40 + (profitMargin * 0.8) + (cap > 0 && paybackMonths < 12 ? 20 : 0)));
      calcRisk = Math.max(5, 100 - calcScore);

      if (calcScore >= 70) {
        calcStatus = "FEASIBLE";
        newInsights.push({ id: "1", type: "positive", title: "Strong Profit Margins", description: `Your projected profit margin is a healthy ${profitMargin.toFixed(1)}%.` });
      } else {
        calcStatus = "MODERATE";
        newInsights.push({ id: "1", type: "info", title: "Tight Margins", description: "Project is profitable, but margins are tight. A small dip in sales could cause a loss." });
      }

      if (cap > 0) {
        if (paybackMonths <= 12) {
          newInsights.push({ id: "2", type: "positive", title: "Fast ROI", description: `You will recoup your initial investment in roughly ${paybackMonths.toFixed(1)} months.` });
        } else {
          newInsights.push({ id: "2", type: "warning", title: "Slow ROI", description: `It will take ${paybackMonths.toFixed(1)} months to get your capital back. Prepare for a long runway.` });
        }
      }
    }

    const calculatedMetrics = {
      feasibility: calcScore,
      financial: Math.min(100, calcScore + 5),
      risk: calcRisk,
      market: 78 // Mock market viablity
    };

    setFeasibilityScore(calcScore);
    setFeasibilityStatus(calcStatus);
    setMetrics(calculatedMetrics);
    setInsights(newInsights);

    // Save back to Firestore
    try {
      await updateProject(pId, {
        status: calcStatus === "FEASIBLE" ? "Feasible" : calcStatus === "MODERATE" ? "Needs Review" : "Not Feasible",
        aiAnalysis: {
          score: calcScore,
          status: calcStatus,
          metrics: calculatedMetrics,
          insights: newInsights,
          lastRun: new Date().toISOString()
        }
      });
      // Update local projects array silently so dropdown reflects the new status
      setProjects(projects.map(p => p.id === pId ? { ...p, status: calcStatus === "FEASIBLE" ? "Feasible" : calcStatus === "MODERATE" ? "Needs Review" : "Not Feasible", aiAnalysis: { score: calcScore, status: calcStatus, metrics: calculatedMetrics, insights: newInsights } } : p));
    } catch (err) {
      console.error("Failed to save AI analysis", err);
    }

    setIsAnalyzing(false);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "positive": return <CheckCircle2 className="w-5 h-5 text-[#249c74]" />;
      case "warning": return <TrendingUp className="w-5 h-5 text-[#249c74]" />;
      case "info": return <Lightbulb className="w-5 h-5 text-blue-500" />;
      case "suggestion": return <Lightbulb className="w-5 h-5 text-purple-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getInsightBgColor = (type: string) => {
    switch (type) {
      case "positive": return "bg-[#f0f9f6] border-[#249c74]/20";
      case "warning": return "bg-orange-50 border-orange-200";
      case "info": return "bg-blue-50 border-blue-200";
      case "suggestion": return "bg-purple-50 border-purple-200";
      default: return "bg-gray-50 border-gray-200";
    }
  };

  const getSelectedProjectName = () => {
    const proj = projects.find(p => p.id === selectedProjectId);
    return proj ? proj.name : "Select a Project";
  };

  return (
    <div className="flex min-h-screen bg-white overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`hidden lg:flex w-64 bg-[#0f171e] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-2 border-b border-gray-800">
          <div className="bg-[#249c74] p-1.5 rounded-md">
            <Zap className="w-5 h-5 text-white fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight">FeasiFy</span>
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-1">
              <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button onClick={() => navigate('/projects')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <Folder className="w-4 h-4" /> Projects
              </button>
              <button onClick={() => navigate('/financial-input')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-[#249c74] text-white transition-all">
                <Zap className="w-4 h-4" /> AI Analysis
              </button>
              <button onClick={() => navigate('/reports')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <BarChart3 className="w-4 h-4" /> Reports
              </button>
              <button onClick={() => navigate('/messages')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <User className="w-4 h-4" /> Profile
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <ShieldAlert className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-800 bg-[#0a1118]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#249c74] flex items-center justify-center font-bold">
              {userName ? userName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{userName || "User"}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out bg-gray-50/30 min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon 
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
          />
          <span className="mx-2">|</span>
          <span 
            className="cursor-pointer hover:text-[#249c74] transition-colors"
            onClick={() => navigate('/dashboard')}
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
              <div className="absolute inset-0 rounded-full border-4 border-[#249c74] border-t-transparent animate-spin"></div>
              <Zap className="absolute inset-0 m-auto w-8 h-8 text-[#249c74] animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Financial Data...</h2>
            <p className="text-gray-500">Our AI is crunching the numbers for {getSelectedProjectName()}.</p>
          </div>
        ) : (
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Analysis</h1>
                <p className="text-sm text-gray-500 mt-1">AI-powered feasibility insights for <span className="font-semibold text-gray-900">{getSelectedProjectName()}</span></p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => runAnalysis(initialCapital, expenses, incomeSources)}
                  disabled={!selectedProjectId}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" /> Re-analyze
                </button>
              </div>
            </div>

            {/* Project Selector Widget (Custom Dropdown) */}
            <div className="mb-8 bg-white p-5 rounded-xl border border-[#249c74]/20 shadow-sm shadow-[#249c74]/5">
              <label className="text-sm font-bold text-gray-900 block mb-2">Select Project to View Analysis</label>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                
                <div className="relative w-full md:w-1/2 z-30">
                  <div 
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-lg cursor-pointer flex items-center justify-between text-sm font-medium transition-all ${isProjectMenuOpen ? 'border-[#249c74] ring-2 ring-[#249c74]/20' : 'border-gray-200'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (projects.length > 0) setIsProjectMenuOpen(!isProjectMenuOpen);
                    }}
                  >
                    <span className={selectedProjectId ? 'text-gray-900' : 'text-gray-400'}>
                      {projects.find(p => p.id === selectedProjectId) ? `${projects.find(p => p.id === selectedProjectId)?.name} (${projects.find(p => p.id === selectedProjectId)?.status})` : "Select a project..."}
                    </span>
                    {projects.length > 0 && (
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isProjectMenuOpen ? 'rotate-180 text-[#249c74]' : ''}`} />
                    )}
                  </div>
                  
                  {isProjectMenuOpen && projects.length > 0 && (
                    <div className="absolute left-0 top-[calc(100%+0.5rem)] w-full bg-white border border-gray-100 shadow-lg rounded-xl py-1 animate-in fade-in zoom-in-95 duration-100 origin-top overflow-hidden">
                      {projects.map(p => (
                        <button 
                          key={p.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProjectSelect(p.id);
                          }} 
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${selectedProjectId === p.id ? 'bg-[#249c74]/10 text-[#249c74] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {p.name} <span className="text-xs text-gray-400 font-normal">({p.status})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {projects.length === 0 && (
                  <button onClick={() => navigate('/projects')} className="text-sm text-[#249c74] font-semibold hover:underline">
                    + Create a new project
                  </button>
                )}
              </div>
            </div>

            <div className={`transition-opacity duration-300 ${!selectedProjectId || feasibilityStatus === "PENDING" ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              {/* Feasibility Verdict Card */}
              <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm mb-8">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className={`flex items-center justify-center w-20 h-20 rounded-lg ${feasibilityStatus === 'FEASIBLE' ? 'bg-[#249c74]' : feasibilityStatus === 'NOT_FEASIBLE' ? 'bg-red-500' : 'bg-orange-500'}`}>
                      <Zap className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-gray-900">Feasibility Verdict</h2>
                      {feasibilityStatus !== "PENDING" && (
                        <span className={`inline-block px-3 py-1 text-white text-xs font-bold rounded-full ${feasibilityStatus === 'FEASIBLE' ? 'bg-[#249c74]' : feasibilityStatus === 'NOT_FEASIBLE' ? 'bg-red-500' : 'bg-orange-500'}`}>
                          {feasibilityStatus.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {feasibilityStatus === "PENDING" 
                        ? "Run analysis to see your project's feasibility verdict." 
                        : feasibilityStatus === "FEASIBLE"
                          ? "Based on the financial data provided, this project shows strong viability. The projected revenue significantly exceeds operating costs, and the payback period is well within acceptable range."
                          : feasibilityStatus === "MODERATE"
                            ? "This project is moderately feasible but carries some risk. Margins may be too tight, or the payback period is longer than ideal. Proceed with caution."
                            : "This project is currently NOT feasible based on the numbers provided. Operating expenses are likely exceeding income, or profitability is too low to sustain growth."}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {feasibilityStatus !== "PENDING" ? (
                      <>
                        <div className={`text-5xl font-bold mb-1 ${feasibilityStatus === 'FEASIBLE' ? 'text-[#249c74]' : feasibilityStatus === 'NOT_FEASIBLE' ? 'text-red-500' : 'text-orange-500'}`}>
                          {feasibilityScore}
                        </div>
                        <div className="text-xs text-gray-500">out of 100</div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">Awaiting analysis</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Feasibility Score</p>
                  <div className="space-y-3">
                    <div className="text-3xl font-bold text-gray-900">{metrics.feasibility}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#249c74] h-2 rounded-full transition-all duration-1000" 
                        style={{ width: `${metrics.feasibility}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Financial Health</p>
                  <div className="space-y-3">
                    <div className="text-3xl font-bold text-gray-900">{metrics.financial}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`${metrics.financial > 70 ? 'bg-[#249c74]' : metrics.financial > 40 ? 'bg-orange-500' : 'bg-red-500'} h-2 rounded-full transition-all duration-1000`} 
                        style={{ width: `${metrics.financial}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Risk Level</p>
                  <div className="space-y-3">
                    <div className="text-3xl font-bold text-gray-900">{metrics.risk}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`${metrics.risk < 30 ? 'bg-[#249c74]' : metrics.risk < 70 ? 'bg-orange-500' : 'bg-red-500'} h-2 rounded-full transition-all duration-1000`} 
                        style={{ width: `${metrics.risk}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Market Viability</p>
                  <div className="space-y-3">
                    <div className="text-3xl font-bold text-gray-900">{metrics.market}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#249c74] h-2 rounded-full transition-all duration-1000" 
                        style={{ width: `${metrics.market}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI-Generated Insights */}
              <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-[#249c74]" />
                  AI-Generated Insights
                </h3>

                {insights.length > 0 ? (
                  <div className="space-y-4">
                    {insights.map(insight => (
                      <div 
                        key={insight.id}
                        className={`rounded-lg border p-4 flex gap-4 ${getInsightBgColor(insight.type)}`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getInsightIcon(insight.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
                          <p className="text-sm text-gray-600">{insight.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">No insights available yet. Run analysis to view recommendations.</p>
                  </div>
                )}
              </div>

              {/* Bottom Action Buttons */}
              <div className="flex justify-end gap-3 mt-8">
                <button 
                  onClick={() => navigate('/financial-input', { state: { projectId: selectedProjectId } })}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-all"
                >
                  <FileEdit className="w-4 h-4" /> Revise Financial Data
                </button>
                <button 
                  onClick={() => navigate('/reports', { 
                    state: { projectId: selectedProjectId } 
                  })}
                  className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10"
                >
                  <BarChart3 className="w-4 h-4" /> View Full Report
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="bg-white rounded-lg p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border text-sm font-semibold" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-[#249c74] hover:bg-[#1e8563] text-white text-sm font-semibold shadow-md" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
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