import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, getUserProjects } from "./firebase";
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
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown
} from "lucide-react";

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

const Reports: React.FC = () => {
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

  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState("Select a Project");
  
  // Financial data
  const [initialCapital, setInitialCapital] = useState(0);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  
  // AI Data
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiStatus, setAiStatus] = useState<string>("PENDING");

  // Close custom dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsProjectMenuOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Authenticate user & load projects
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
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectSelect = (projectId: string, projectList = projects) => {
    setSelectedProjectId(projectId);
    sessionStorage.setItem("lastSelectedProjectId", projectId); // Save to memory!
    setIsProjectMenuOpen(false);
    
    const selectedProj = projectList.find(p => p.id === projectId);
    if (!selectedProj) return;

    setProjectName(selectedProj.name || "Untitled Project");
    
    const finData = selectedProj.financialData || {};
    setInitialCapital(finData.initialCapital || 0);
    setExpenses(finData.expenses || []);
    setIncomeSources(finData.incomeSources || []);

    if (selectedProj.aiAnalysis) {
      setAiScore(selectedProj.aiAnalysis.score);
      setAiStatus(selectedProj.aiAnalysis.status);
    } else {
      setAiScore(null);
      setAiStatus("PENDING");
    }
  };

  // Extra listener: In case the projects are already loaded but the user navigated here via a click
  useEffect(() => {
    const state = location.state as any;
    if (state && state.projectId && projects.length > 0) {
      if (selectedProjectId !== state.projectId) {
        handleProjectSelect(state.projectId, projects);
      }
    }
  }, [location.state, projects]);

  const handleLogout = async () => {
    try { await fbSignOut(auth); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    window.print(); // Quick workaround: standard browsers allow saving as PDF via the Print dialog!
  };

  // Calculate totals
  const totalMonthlyExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDailyIncome = incomeSources.reduce((sum, i) => sum + i.amount, 0);
  const totalMonthlyIncome = totalDailyIncome * 30;
  const netMonthlyIncome = totalMonthlyIncome - totalMonthlyExpenses;
  const estimatedAnnualROI = initialCapital > 0 ? ((netMonthlyIncome * 12) / initialCapital * 100) : 0;
  const paybackPeriod = netMonthlyIncome > 0 ? initialCapital / netMonthlyIncome : 0;

  const hasData = initialCapital > 0 || expenses.length > 0 || incomeSources.length > 0;

  return (
    <div className="flex min-h-screen bg-white overflow-hidden">
      {/* SIDEBAR (Hidden when printing!) */}
      <aside className={`print:hidden hidden lg:flex w-64 bg-[#0f171e] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
              <button onClick={() => navigate('/ai-analysis')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <Zap className="w-4 h-4" /> AI Analysis
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-[#249c74] text-white transition-all">
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
      <main className={`flex-1 transition-all duration-300 ease-in-out bg-gray-50/30 min-h-screen print:bg-white print:m-0 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="print:hidden bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
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
          <span className="font-semibold text-gray-900">Reports</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-[#249c74] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-gray-500">Generating report...</p>
          </div>
        ) : (
          <div className="p-6 md:p-8 max-w-4xl mx-auto print:p-0">
            {/* Header */}
            <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Financial Report</h1>
                <p className="text-sm text-gray-500 mt-1">Complete feasibility report for <span className="font-semibold text-gray-900">{projectName}</span></p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handlePrint}
                  disabled={!selectedProjectId}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button 
                  onClick={handleExportPDF}
                  disabled={!selectedProjectId}
                  className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" /> Export PDF
                </button>
              </div>
            </div>

            {/* Project Selector Widget (Custom Dropdown) - Hidden when printing */}
            <div className="mb-8 bg-white p-5 rounded-xl border border-[#249c74]/20 shadow-sm shadow-[#249c74]/5 print:hidden">
              <label className="text-sm font-bold text-gray-900 block mb-2">Select Project to View Report</label>
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

            <div className={`transition-opacity duration-300 ${!selectedProjectId ? 'opacity-40 pointer-events-none print:hidden' : 'opacity-100'}`}>
              {/* Print Header (Only visible when printing) */}
              <div className="hidden print:flex justify-between items-center mb-8 border-b-2 border-[#249c74] pb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-[#249c74] p-1.5 rounded-md">
                    <Zap className="w-6 h-6 text-white fill-current" />
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-gray-900">FeasiFy</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">Official Feasibility Report</p>
                  <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* FeasiFy Report Card */}
              <div className="bg-white rounded-lg border border-gray-100 print:border-gray-300 p-6 shadow-sm print:shadow-none mb-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className={`p-3 rounded-lg ${aiStatus === 'FEASIBLE' ? 'bg-[#249c74]' : aiStatus === 'NOT_FEASIBLE' ? 'bg-red-500' : aiStatus === 'MODERATE' ? 'bg-orange-500' : 'bg-gray-300'}`}>
                    {aiStatus === 'FEASIBLE' ? <CheckCircle2 className="w-6 h-6 text-white" /> : aiStatus === 'NOT_FEASIBLE' ? <AlertTriangle className="w-6 h-6 text-white" /> : <Info className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-900">Project Overview</h2>
                    <p className="text-sm text-gray-500">Financial Feasibility Analysis</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-3 py-1 text-white text-xs font-bold rounded-full print:border print:border-gray-400 print:text-black print:bg-transparent ${aiStatus === 'FEASIBLE' ? 'bg-[#249c74]' : aiStatus === 'NOT_FEASIBLE' ? 'bg-red-500' : aiStatus === 'MODERATE' ? 'bg-orange-500' : 'bg-gray-400'}`}>
                      {aiStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Project Name</p>
                    <p className="text-gray-900 font-semibold">{projectName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Prepared By</p>
                    <p className="text-gray-900 font-semibold">{userName || "User"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase font-semibold mb-1">AI Feasibility Score</p>
                    <p className={`text-2xl font-bold ${aiStatus === 'FEASIBLE' ? 'text-[#249c74]' : aiStatus === 'NOT_FEASIBLE' ? 'text-red-500' : aiStatus === 'MODERATE' ? 'text-orange-500' : 'text-gray-900'} print:text-black`}>
                      {aiScore !== null ? aiScore : "—"} / 100
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-white rounded-lg border border-gray-100 print:border-gray-300 p-6 shadow-sm print:shadow-none mb-8">
                <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-[#249c74] print:text-black" />
                  Financial Summary
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 print:border-gray-300">
                        <th className="text-left py-3 px-4 text-gray-500 text-xs font-semibold uppercase">Item</th>
                        <th className="text-right py-3 px-4 text-gray-500 text-xs font-semibold uppercase">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 print:border-gray-200">
                        <td className="py-3 px-4 text-gray-700">Initial Capital</td>
                        <td className="py-3 px-4 text-right text-gray-900 font-semibold">₱{initialCapital.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-gray-100 print:border-gray-200">
                        <td className="py-3 px-4 text-gray-700">Monthly Operating Expenses</td>
                        <td className="py-3 px-4 text-right text-red-600 print:text-black font-semibold">- ₱{totalMonthlyExpenses.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-gray-100 print:border-gray-200">
                        <td className="py-3 px-4 text-gray-700">Projected Monthly Income</td>
                        <td className="py-3 px-4 text-right text-blue-600 print:text-black font-semibold">+ ₱{totalMonthlyIncome.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-gray-100 print:border-gray-200 bg-gray-50/50 print:bg-transparent">
                        <td className="py-3 px-4 text-gray-900 font-bold">Net Monthly Income</td>
                        <td className={`py-3 px-4 text-right font-bold ${netMonthlyIncome >= 0 ? 'text-[#249c74]' : 'text-red-600'} print:text-black`}>
                          ₱{netMonthlyIncome.toLocaleString()}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 print:border-gray-200">
                        <td className="py-3 px-4 text-gray-700">Annual Return on Investment (ROI)</td>
                        <td className="py-3 px-4 text-right text-gray-900 font-semibold">{estimatedAnnualROI.toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-gray-700">Estimated Payback Period</td>
                        <td className="py-3 px-4 text-right text-gray-900 font-semibold">{paybackPeriod > 0 ? `${paybackPeriod.toFixed(1)} months` : "N/A"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 print:block">
                {/* Expense Breakdown */}
                <div className="bg-white rounded-lg border border-gray-100 print:border-gray-300 p-6 shadow-sm print:shadow-none print:mb-8">
                  <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <FileEdit className="w-4 h-4 text-red-500 print:text-black" />
                    Expense Breakdown
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 print:border-gray-300">
                          <th className="text-left py-2 px-2 text-gray-500 text-xs font-semibold uppercase">Item</th>
                          <th className="text-right py-2 px-2 text-gray-500 text-xs font-semibold uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.length > 0 ? (
                          <>
                            {expenses.map(expense => (
                              <tr key={expense.id} className="border-b border-gray-50 print:border-gray-200">
                                <td className="py-2 px-2 text-gray-700">{expense.name}</td>
                                <td className="py-2 px-2 text-right text-gray-900">₱{expense.amount.toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-gray-200 print:border-gray-400">
                              <td className="py-3 px-2 text-gray-900 font-bold">Total</td>
                              <td className="py-3 px-2 text-right text-red-600 print:text-black font-bold">₱{totalMonthlyExpenses.toLocaleString()}</td>
                            </tr>
                          </>
                        ) : (
                          <tr><td colSpan={2} className="py-4 text-center text-gray-500">No expenses recorded.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Income Breakdown */}
                <div className="bg-white rounded-lg border border-gray-100 print:border-gray-300 p-6 shadow-sm print:shadow-none print:mb-8">
                  <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <FileEdit className="w-4 h-4 text-blue-500 print:text-black" />
                    Income Breakdown (Daily)
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 print:border-gray-300">
                          <th className="text-left py-2 px-2 text-gray-500 text-xs font-semibold uppercase">Source</th>
                          <th className="text-right py-2 px-2 text-gray-500 text-xs font-semibold uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeSources.length > 0 ? (
                          <>
                            {incomeSources.map(income => (
                              <tr key={income.id} className="border-b border-gray-50 print:border-gray-200">
                                <td className="py-2 px-2 text-gray-700">{income.name}</td>
                                <td className="py-2 px-2 text-right text-gray-900">₱{income.amount.toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-gray-200 print:border-gray-400">
                              <td className="py-3 px-2 text-gray-900 font-bold">Total Daily</td>
                              <td className="py-3 px-2 text-right text-blue-600 print:text-black font-bold">₱{totalDailyIncome.toLocaleString()}</td>
                            </tr>
                          </>
                        ) : (
                          <tr><td colSpan={2} className="py-4 text-center text-gray-500">No income sources recorded.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Conclusion & Recommendations */}
              <div className="bg-white rounded-lg border border-gray-100 print:border-gray-300 p-6 shadow-sm print:shadow-none print:break-inside-avoid">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#249c74] print:text-black" />
                  Conclusion & Recommendations
                </h3>

                <div className="space-y-4 text-sm text-gray-700">
                  <p>
                    <span className="font-semibold text-gray-900">Conclusion:</span> {hasData ? `Based on the financial data analyzed, "${projectName}" is projected to yield a net monthly income of ₱${netMonthlyIncome.toLocaleString()} with an estimated payback period of ${paybackPeriod > 0 ? paybackPeriod.toFixed(1) + ' months' : 'N/A'}. The overall AI assessment categorizes this project as ${aiStatus.replace('_', ' ')}.` : "Insufficient financial data to form a conclusion."}
                  </p>

                  <div>
                    <p className="font-semibold text-gray-900 mb-2">Key Assessment:</p>
                    <p className="text-gray-600 print:text-gray-800">
                      {aiStatus === 'FEASIBLE' 
                        ? "The project demonstrates strong financial viability. The relationship between initial capital, operating expenses, and projected income suggests a sustainable and profitable business model."
                        : aiStatus === 'MODERATE'
                        ? "The project shows potential but carries notable risks. The margins between income and expenses may be too narrow, requiring strict financial discipline and market monitoring."
                        : aiStatus === 'NOT_FEASIBLE'
                        ? "The current financial structure is unsustainable. Operating expenses exceed projected revenues, or the initial capital cannot be recouped in a reasonable timeframe. A significant rework of the business model is strongly advised."
                        : "Awaiting complete data for full assessment."
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="hidden print:block text-center mt-12 text-xs text-gray-400">
                <p>Generated by FeasiFy • Make smarter business decisions with data.</p>
              </div>
              
            </div>
          </div>
        )}
      </main>

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center print:hidden">
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

export default Reports;