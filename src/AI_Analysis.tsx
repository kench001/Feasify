import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
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
  ChevronDown,
  Bell
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Project Data (Fetched from Groups)
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
    market: 0, 
  });

  const [insights, setInsights] = useState<InsightItem[]>([]);

  useEffect(() => {
    const handleClickOutside = () => setIsProjectMenuOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Check if we should show loading immediately from navigation state
  useEffect(() => {
    const state = location.state as any;
    if (state && state.runAnalysis) {
      setIsAnalyzing(true);
    }
  }, [location.state]);

  const loadUserGroup = async (uid: string, section: string) => {
    try {
      const q = query(collection(db, "groups"), where("section", "==", section));
      const snap = await getDocs(q);
      
      let myGroup: any = null;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.leaderId === uid || (data.memberIds && data.memberIds.includes(uid))) {
          myGroup = { id: doc.id, ...data };
        }
      });

      if (myGroup && myGroup.isSetup) {
        const projData = [{
          id: myGroup.id,
          name: myGroup.title || "Untitled Business",
          status: myGroup.status || "Pending",
          financialData: myGroup.financialData || {},
          aiAnalysis: myGroup.aiAnalysis || null
        }];
        setProjects(projData);

        const savedProjectId = sessionStorage.getItem("lastSelectedProjectId");
        const state = location.state as any;

        if (state && state.projectId) {
          handleProjectSelect(state.projectId, projData);
        } else if (savedProjectId && projData.some(p => p.id === savedProjectId)) {
          handleProjectSelect(savedProjectId, projData);
        } else {
          handleProjectSelect(projData[0].id, projData);
        }
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Failed to load group:", error);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserName([data.firstName, data.lastName].filter(Boolean).join(" ") || u.displayName || "");
            
            if (data.section) {
              loadUserGroup(u.uid, data.section);
            }
          }
        } catch (e) {}
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  // Fetch unread notifications count
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const q = query(collection(db, "notifications"), where("userId", "==", u.uid), where("isRead", "==", false));
          const snap = await getDocs(q);
          setUnreadNotificationCount(snap.size);
        } catch (error) {
          console.error("Error fetching unread notifications:", error);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleProjectSelect = async (projectId: string, projectList = projects) => {
    setSelectedProjectId(projectId);
    sessionStorage.setItem("lastSelectedProjectId", projectId); 
    setIsProjectMenuOpen(false);
    
    const selectedProj = projectList.find(p => p.id === projectId);
    if (!selectedProj) return;

    const finData = selectedProj.financialData || {};
    
    // Check navigation state for fresh data
    const state = location.state as any;
    const freshData = state ? {
      initialCapital: state.initialCapital || 0,
      expenses: state.expenses || [],
      incomeSources: state.incomeSources || []
    } : null;
    
    // Use fresh data if available, otherwise use stored data
    const dataToUse = freshData || {
      initialCapital: finData.initialCapital || 0,
      expenses: finData.expenses || [],
      incomeSources: finData.incomeSources || []
    };
    
    setInitialCapital(dataToUse.initialCapital);
    setExpenses(dataToUse.expenses);
    setIncomeSources(dataToUse.incomeSources);

    // Check if we should run analysis (either from navigation state or no existing analysis)
    const shouldRunAnalysis = (state && state.runAnalysis) || !selectedProj.aiAnalysis;

    if (selectedProj.aiAnalysis && !shouldRunAnalysis) {
      setFeasibilityScore(selectedProj.aiAnalysis.score);
      setFeasibilityStatus(selectedProj.aiAnalysis.status);
      setMetrics(selectedProj.aiAnalysis.metrics);
      setInsights(selectedProj.aiAnalysis.insights);
    } else {
      setFeasibilityScore(0);
      setFeasibilityStatus("PENDING");
      setInsights([]);
      setMetrics({ feasibility: 0, financial: 0, risk: 0, market: 0 });
      
      // Auto-run if data exists or explicitly requested
      if (shouldRunAnalysis && (dataToUse.initialCapital || dataToUse.expenses?.length > 0 || dataToUse.incomeSources?.length > 0)) {
        runAnalysis(dataToUse.initialCapital, dataToUse.expenses, dataToUse.incomeSources, projectId);
      }
    }
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const runAnalysis = async (cap: number, exp: ExpenseItem[], inc: IncomeSource[], pId: string = selectedProjectId) => {
    if (!pId) return;
    setIsAnalyzing(true);

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
      market: 78 
    };

    setFeasibilityScore(calcScore);
    setFeasibilityStatus(calcStatus);
    setMetrics(calculatedMetrics);
    setInsights(newInsights);

    try {
      await updateDoc(doc(db, "groups", pId), {
        status: calcStatus === "FEASIBLE" ? "Feasible" : calcStatus === "MODERATE" ? "Needs Review" : "Not Feasible",
        aiAnalysis: {
          score: calcScore,
          status: calcStatus,
          metrics: calculatedMetrics,
          insights: newInsights,
          lastRun: new Date().toISOString()
        }
      });
      setProjects(projects.map(p => p.id === pId ? { ...p, status: calcStatus === "FEASIBLE" ? "Feasible" : calcStatus === "MODERATE" ? "Needs Review" : "Not Feasible", aiAnalysis: { score: calcScore, status: calcStatus, metrics: calculatedMetrics, insights: newInsights } } : p));
    } catch (err) {
      console.error("Failed to save AI analysis", err);
    }

    setIsAnalyzing(false);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "positive": return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "warning": return <TrendingUp className="w-5 h-5 text-orange-500" />;
      case "info": return <Lightbulb className="w-5 h-5 text-blue-500" />;
      case "suggestion": return <Lightbulb className="w-5 h-5 text-purple-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getInsightBgColor = (type: string) => {
    switch (type) {
      case "positive": return "bg-green-50 border-green-200";
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

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
      {/* NEW SIDEBAR */}
      <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="bg-white p-1.5 rounded-md">
            <BarChart3 className="w-6 h-6 text-[#122244]" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight block leading-none">FeasiFy</span>
            <span className="text-[8px] text-gray-400">An AI-Assisted Financial Feasibility System</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-1">
              <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button onClick={() => navigate('/projects')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <Folder className="w-4 h-4" /> Business Proposal
              </button>
              <button onClick={() => navigate('/financial-input')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                <Zap className="w-4 h-4" /> AI Feasibility Analysis
              </button>
              <button onClick={() => navigate('/reports')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <BarChart3 className="w-4 h-4" /> Reports
              </button>
              <button onClick={() => navigate('/messages')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <User className="w-4 h-4" /> Profile
              </button>
              <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <ShieldAlert className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
              {getInitials(userName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{userName || "User"}</p>
              <p className="text-[10px] text-gray-400 truncate">Student</p>
            </div>
            <button
              onClick={() => navigate('/notifications')}
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all relative flex-shrink-0"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out bg-gray-50/50 min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span>
          <span className="cursor-pointer hover:text-[#c9a654] transition-colors" onClick={() => navigate('/dashboard')}>FeasiFy</span>
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
            <h2 className="text-2xl font-bold text-[#122244] mb-2">Analyzing Financial Data...</h2>
            <p className="text-gray-500">Our AI is crunching the numbers for {getSelectedProjectName()}.</p>
          </div>
        ) : (
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-[#3d2c23]">AI Analysis</h1>
                <p className="text-sm text-gray-500 mt-1 italic">AI-powered feasibility insights for <span className="font-bold text-[#122244]">{getSelectedProjectName()}</span></p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => runAnalysis(initialCapital, expenses, incomeSources)}
                  disabled={!selectedProjectId}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" /> Re-analyze
                </button>
              </div>
            </div>

            {/* Project Selector Widget */}
            <div className="mb-8 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <label className="text-sm font-bold text-[#122244] uppercase tracking-widest block mb-2">Select Project to View Analysis</label>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                
                <div className="relative w-full md:w-1/2 z-30">
                  <div 
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-lg cursor-pointer flex items-center justify-between text-sm font-bold transition-all ${isProjectMenuOpen ? 'border-[#c9a654] ring-2 ring-[#c9a654]/20 bg-white' : 'border-gray-200 hover:bg-gray-100'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (projects.length > 0) setIsProjectMenuOpen(!isProjectMenuOpen);
                    }}
                  >
                    <span className={selectedProjectId ? 'text-[#122244]' : 'text-gray-400'}>
                      {projects.find(p => p.id === selectedProjectId) ? `${projects.find(p => p.id === selectedProjectId)?.name} (${projects.find(p => p.id === selectedProjectId)?.status})` : "Select a project..."}
                    </span>
                    {projects.length > 0 && (
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isProjectMenuOpen ? 'rotate-180 text-[#c9a654]' : ''}`} />
                    )}
                  </div>
                  
                  {isProjectMenuOpen && projects.length > 0 && (
                    <div className="absolute left-0 top-[calc(100%+0.5rem)] w-full bg-white border border-gray-100 shadow-xl rounded-xl py-2 animate-in fade-in zoom-in-95 duration-100 origin-top overflow-hidden">
                      {projects.map(p => (
                        <button 
                          key={p.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProjectSelect(p.id);
                          }} 
                          className={`w-full text-left px-5 py-3 text-sm flex items-center justify-between gap-3 transition-colors ${selectedProjectId === p.id ? 'bg-blue-50 text-[#122244] font-extrabold' : 'text-gray-700 font-medium hover:bg-gray-50'}`}
                        >
                          {p.name} <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">({p.status})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {projects.length === 0 && (
                  <button onClick={() => navigate('/projects')} className="text-sm text-[#c9a654] font-bold hover:underline">
                    + Open Workspace
                  </button>
                )}
              </div>
            </div>

            <div className={`transition-opacity duration-300 ${!selectedProjectId || feasibilityStatus === "PENDING" ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              {/* Feasibility Verdict Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm mb-8">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className={`flex items-center justify-center w-20 h-20 rounded-xl shadow-inner ${feasibilityStatus === 'FEASIBLE' ? 'bg-green-500' : feasibilityStatus === 'NOT_FEASIBLE' ? 'bg-red-500' : 'bg-orange-500'}`}>
                      <Zap className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-extrabold text-[#122244]">Feasibility Verdict</h2>
                      {feasibilityStatus !== "PENDING" && (
                        <span className={`inline-block px-3 py-1 text-white text-xs font-bold rounded-full shadow-sm ${feasibilityStatus === 'FEASIBLE' ? 'bg-green-500' : feasibilityStatus === 'NOT_FEASIBLE' ? 'bg-red-500' : 'bg-orange-500'}`}>
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
                        <div className={`text-5xl font-extrabold mb-1 ${feasibilityStatus === 'FEASIBLE' ? 'text-green-500' : feasibilityStatus === 'NOT_FEASIBLE' ? 'text-red-500' : 'text-orange-500'}`}>
                          {feasibilityScore}
                        </div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">out of 100</div>
                      </>
                    ) : (
                      <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">Awaiting analysis</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Feasibility Score</p>
                  <div className="space-y-3">
                    <div className="text-3xl font-extrabold text-[#122244]">{metrics.feasibility}%</div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-[#122244] h-2 rounded-full transition-all duration-1000" style={{ width: `${metrics.feasibility}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Financial Health</p>
                  <div className="space-y-3">
                    <div className="text-3xl font-extrabold text-[#122244]">{metrics.financial}%</div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`${metrics.financial > 70 ? 'bg-green-500' : metrics.financial > 40 ? 'bg-orange-500' : 'bg-red-500'} h-2 rounded-full transition-all duration-1000`} style={{ width: `${metrics.financial}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Risk Level</p>
                  <div className="space-y-3">
                    <div className="text-3xl font-extrabold text-[#122244]">{metrics.risk}%</div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`${metrics.risk < 30 ? 'bg-green-500' : metrics.risk < 70 ? 'bg-orange-500' : 'bg-red-500'} h-2 rounded-full transition-all duration-1000`} style={{ width: `${metrics.risk}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Market Viability</p>
                  <div className="space-y-3">
                    <div className="text-3xl font-extrabold text-[#122244]">{metrics.market}%</div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-[#c9a654] h-2 rounded-full transition-all duration-1000" style={{ width: `${metrics.market}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI-Generated Insights */}
              <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                <h3 className="text-lg font-extrabold text-[#122244] mb-6 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-[#c9a654]" />
                  AI-Generated Insights
                </h3>

                {insights.length > 0 ? (
                  <div className="space-y-4">
                    {insights.map(insight => (
                      <div key={insight.id} className={`rounded-xl border p-5 flex gap-4 shadow-sm ${getInsightBgColor(insight.type)}`}>
                        <div className="flex-shrink-0 mt-0.5">
                          {getInsightIcon(insight.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[#122244] mb-1">{insight.title}</h4>
                          <p className="text-sm text-gray-700 leading-relaxed">{insight.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    <Lightbulb className="w-8 h-8 text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm font-medium">No insights available yet. Run analysis to view recommendations.</p>
                  </div>
                )}
              </div>

              {/* Bottom Action Buttons */}
              <div className="flex justify-end gap-3 mt-8">
                <button 
                  onClick={() => navigate('/financial-input', { state: { projectId: selectedProjectId } })}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                >
                  <FileEdit className="w-4 h-4" /> Revise Financial Data
                </button>
                <button 
                  onClick={() => navigate('/reports', { state: { projectId: selectedProjectId } })}
                  className="flex items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md"
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
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#122244] mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
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