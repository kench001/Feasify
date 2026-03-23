import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  LayoutDashboard,
  Folder,
  FileEdit,
  Zap,
  BarChart3,
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
  AlertTriangle,
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

  // Financial data from Financial Input
  const [initialCapital, setInitialCapital] = useState(0);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);

  // AI Analysis data
  const [feasibilityScore, setFeasibilityScore] = useState(0);
  const [feasibilityStatus] = useState<"FEASIBLE" | "MODERATE" | "NOT_FEASIBLE" | "PENDING">("PENDING");
  
  const [metrics] = useState({
    feasibility: 0,
    financial: 0,
    risk: 0,
    market: 0,
  });

  const [insights] = useState<InsightItem[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
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

  // Load financial data from location state
  useEffect(() => {
    if (location.state) {
      const state = location.state as any;
      if (state.initialCapital !== undefined) {
        setInitialCapital(state.initialCapital);
      }
      if (state.expenses) {
        setExpenses(state.expenses);
      }
      if (state.incomeSources) {
        setIncomeSources(state.incomeSources);
      }
    }
  }, [location.state]);

  const handleLogout = async () => {
    try { await fbSignOut(auth); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "positive":
        return <CheckCircle2 className="w-5 h-5 text-[#249c74]" />;
      case "warning":
        return <TrendingUp className="w-5 h-5 text-[#249c74]" />;
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
        return "bg-[#f0f9f6] border-[#249c74]/20";
      case "warning":
        return "bg-[#f0f9f6] border-[#249c74]/20";
      case "info":
        return "bg-blue-50 border-blue-200";
      case "suggestion":
        return "bg-purple-50 border-purple-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
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
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowLogoutConfirm(true)}>
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

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Analysis</h1>
              <p className="text-sm text-gray-500 mt-1">AI-powered feasibility insights</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-all">
                <RotateCcw className="w-4 h-4" /> Re-analyze
              </button>
              <button className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10">
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          </div>

          {/* Feasibility Verdict Card */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm mb-8">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-20 h-20 bg-[#249c74] rounded-lg">
                  <Zap className="w-10 h-10 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">Feasibility Verdict</h2>
                  {feasibilityStatus !== "PENDING" && (
                    <span className="inline-block px-3 py-1 bg-[#249c74] text-white text-xs font-bold rounded-full">
                      {feasibilityStatus}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {feasibilityStatus === "PENDING" ? "Waiting for analysis..." : "Based on the financial data provided, this project shows strong viability. The projected revenue significantly exceeds operating costs, and the payback period is well within acceptable range. Review the warnings and suggestions below for risk mitigation."}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                {feasibilityScore > 0 ? (
                  <>
                    <div className="text-5xl font-bold text-[#249c74] mb-1">{feasibilityScore}</div>
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
                    className="bg-[#249c74] h-2 rounded-full" 
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
                    className="bg-[#249c74] h-2 rounded-full" 
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
                    className="bg-orange-500 h-2 rounded-full" 
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
                    className="bg-[#249c74] h-2 rounded-full" 
                    style={{ width: `${metrics.market}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Placeholder Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#249c74]" />
                Monthly Cash Flow
              </h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded text-gray-500">
                <span className="text-sm">Chart visualization - Monthly cash flow data</span>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#249c74]" />
                5-Year Revenue Projection
              </h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded text-gray-500">
                <span className="text-sm">Chart visualization - 3-year revenue data</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm mb-8">
            <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#249c74]" />
              Break-even Analysis (Monthly)
            </h3>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded text-gray-500">
              <span className="text-sm">Chart visualization - Break-even analysis data</span>
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
                <p className="text-gray-500 text-sm">No insights available yet. Complete the analysis to view recommendations.</p>
              </div>
            )}
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex justify-end gap-3 mt-8">
            <button 
              onClick={() => navigate('/financial-input')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-all"
            >
              <Download className="w-4 h-4" /> Revise Financial Data
            </button>
            <button 
              onClick={() => navigate('/reports', { 
                state: { 
                  initialCapital, 
                  expenses, 
                  incomeSources 
                } 
              })}
              className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10"
            >
              <BarChart3 className="w-4 h-4" /> View Full Report
            </button>
          </div>
        </div>
      </main>

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLogoutConfirm(false)} />
          <div className="bg-white rounded-lg p-6 z-10 w-11/12 max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border text-sm font-semibold" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-[#249c74] hover:bg-[#1e8563] text-white text-sm font-semibold" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
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
