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
  Plus,
  Sidebar as SidebarIcon,
  Trash2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Zap as ZapIcon,
  Save,
  ChevronDown,
  Bell
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

const Financial_input: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [initialCapital, setInitialCapital] = useState("1000000");
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);

  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newIncomeName, setNewIncomeName] = useState("");
  const [newIncomeAmount, setNewIncomeAmount] = useState("");

  useEffect(() => {
    const handleClickOutside = () => setIsProjectMenuOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const loadUserGroup = async (uid: string, section: string) => {
    try {
      const q = query(collection(db, "groups"), where("section", "==", section));
      const snap = await getDocs(q);
      
      // FIX: Explicitly type myGroup as 'any' to resolve TypeScript errors
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
          status: myGroup.status || "In Progress",
          financialData: myGroup.financialData || {}
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

  useEffect(() => {
    const state = location.state as any;
    if (state && state.projectId && projects.length > 0) {
      if (selectedProjectId !== state.projectId) {
        handleProjectSelect(state.projectId, projects);
      }
    }
  }, [location.state, projects]);

  const handleProjectSelect = (projectId: string, projectList = projects) => {
    setSelectedProjectId(projectId);
    sessionStorage.setItem("lastSelectedProjectId", projectId);
    
    const selectedProj = projectList.find(p => p.id === projectId);
    if (selectedProj && selectedProj.financialData) {
      setInitialCapital(selectedProj.financialData.initialCapital?.toString() || "1000000");
      setExpenses(selectedProj.financialData.expenses || []);
      setIncomeSources(selectedProj.financialData.incomeSources || []);
    } else {
      setInitialCapital("1000000");
      setExpenses([]);
      setIncomeSources([]);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedProjectId) {
      alert("Please select a project first!");
      return false;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "groups", selectedProjectId), {
        financialData: {
          initialCapital: parseFloat(initialCapital) || 0,
          expenses,
          incomeSources
        }
      });
      setProjects(projects.map(p => p.id === selectedProjectId ? { ...p, financialData: { initialCapital: parseFloat(initialCapital) || 0, expenses, incomeSources } } : p));
      return true;
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Failed to save data. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedProjectId) {
      alert("Please select a project before running analysis!");
      return;
    }
    const saved = await handleSaveDraft();
    if (saved) {
      navigate('/ai-analysis', { 
        state: { 
          projectId: selectedProjectId,
          runAnalysis: true,
          initialCapital: parseFloat(initialCapital) || 0, 
          expenses, 
          incomeSources 
        } 
      });
    }
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const totalMonthlyExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDailyIncome = incomeSources.reduce((sum, i) => sum + i.amount, 0);
  const newExpenseValue = parseFloat(newExpenseAmount) || 0;
  const newIncomeValue = parseFloat(newIncomeAmount) || 0;
  const effectiveMonthlyExpenses = totalMonthlyExpenses + newExpenseValue;
  const effectiveDailyIncome = totalDailyIncome + newIncomeValue;
  const effectiveMonthlyIncome = effectiveDailyIncome * 30;
  const effectiveNetMonthlyIncome = effectiveMonthlyIncome - effectiveMonthlyExpenses;

  const estimatedAnnualROI = parseFloat(initialCapital) > 0 ? ((effectiveNetMonthlyIncome * 12) / parseFloat(initialCapital) * 100) : 0;
  const paybackPeriod = effectiveNetMonthlyIncome > 0 ? parseFloat(initialCapital) / effectiveNetMonthlyIncome : 0;
  const breakEvenDays = effectiveDailyIncome > 0 ? Math.ceil(parseFloat(initialCapital) / effectiveDailyIncome) : 0;
  const dailyRevenueNeeded = effectiveMonthlyExpenses / 30;
  const expenseToIncomeRatio = effectiveDailyIncome > 0 ? (effectiveMonthlyExpenses / effectiveMonthlyIncome * 100) : 0;

  const addExpense = () => {
    if (newExpenseName.trim() && newExpenseAmount.trim()) {
      setExpenses([...expenses, { id: Math.random().toString(), name: newExpenseName, amount: parseFloat(newExpenseAmount) }]);
      setNewExpenseName("");
      setNewExpenseAmount("");
    }
  };

  const deleteExpense = (id: string) => setExpenses(expenses.filter(e => e.id !== id));

  const addIncomeSource = () => {
    if (newIncomeName.trim() && newIncomeAmount.trim()) {
      setIncomeSources([...incomeSources, { id: Math.random().toString(), name: newIncomeName, amount: parseFloat(newIncomeAmount) }]);
      setNewIncomeName("");
      setNewIncomeAmount("");
    }
  };

  const deleteIncomeSource = (id: string) => setIncomeSources(incomeSources.filter(i => i.id !== id));

  const getSelectedProjectLabel = () => {
    const proj = projects.find(p => p.id === selectedProjectId);
    if (proj) return `${proj.name}`;
    if (projects.length === 0) return "No projects found. Create one first!";
    return "Select a project...";
  };

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
      <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
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
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button onClick={() => navigate('/ai-analysis')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
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

      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span>
          <span className="cursor-pointer hover:text-[#c9a654] transition-colors" onClick={() => navigate('/dashboard')}>FeasiFy</span>
          <span>›</span>
          <span className="font-semibold text-gray-900">Financial Input</span>
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23]">Financial Data Input</h1>
              <p className="text-sm text-gray-500 mt-1 italic">Enter your project's financial projections and starting capital.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={async () => {
                  const saved = await handleSaveDraft();
                  if (saved) alert("Draft saved successfully to Firestore!");
                }}
                disabled={isSaving || !selectedProjectId}
                className={`flex items-center gap-2 px-6 py-2.5 border border-gray-200 rounded-lg font-bold text-sm transition-all shadow-sm ${isSaving ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                {isSaving ? <span className="animate-pulse">Saving...</span> : <><Save className="w-4 h-4" /> Save Draft</>}
              </button>
              <button 
                onClick={handleRunAnalysis}
                disabled={isSaving || !selectedProjectId}
                className="flex items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md disabled:opacity-70"
              >
                <ZapIcon className="w-4 h-4 fill-current" /> {isSaving ? "Saving..." : "Run Analysis"}
              </button>
            </div>
          </div>

          <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <label className="text-sm font-bold text-[#122244] uppercase tracking-widest block mb-3">Select Project to Configure</label>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative w-full md:w-1/2 z-30">
                <div 
                  className={`w-full px-4 py-3.5 bg-gray-50 border rounded-lg cursor-pointer flex items-center justify-between text-sm font-bold transition-all ${isProjectMenuOpen ? 'border-[#c9a654] ring-2 ring-[#c9a654]/20 bg-white' : 'border-gray-200 hover:bg-gray-100'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (projects.length > 0) setIsProjectMenuOpen(!isProjectMenuOpen);
                  }}
                >
                  <span className={selectedProjectId ? 'text-[#122244]' : 'text-gray-400'}>
                    {getSelectedProjectLabel()}
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
                          setIsProjectMenuOpen(false);
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

          <div className={`transition-opacity duration-300 ${!selectedProjectId ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-green-500">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-green-50 rounded-lg"><DollarSign className="w-5 h-5 text-green-600" /></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Initial Capital</span>
                </div>
                <p className="text-3xl font-extrabold text-[#122244]">₱{(parseFloat(initialCapital) || 0).toLocaleString()}</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-red-500">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-red-50 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monthly Expenses</span>
                </div>
                <p className="text-3xl font-extrabold text-[#122244]">₱{effectiveMonthlyExpenses.toLocaleString()}</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-blue-500">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monthly Income</span>
                </div>
                <p className="text-3xl font-extrabold text-[#122244]">₱{effectiveMonthlyIncome.toLocaleString()}</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-[#c9a654]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-yellow-50 rounded-lg"><BarChart3 className="w-5 h-5 text-[#c9a654]" /></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Net Income/mo</span>
                </div>
                <p className={`text-3xl font-extrabold ${effectiveNetMonthlyIncome >= 0 ? 'text-[#122244]' : 'text-red-500'}`}>
                  ₱{effectiveNetMonthlyIncome.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gray-50 rounded-lg"><DollarSign className="w-5 h-5 text-[#c9a654]" /></div>
                    <h3 className="font-bold text-[#122244] text-lg">Initial Capital</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Amount (PHP)</label>
                      <input 
                        type="number"
                        placeholder="0"
                        value={initialCapital}
                        onChange={(e) => setInitialCapital(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] font-bold text-lg text-[#122244] transition-all"
                      />
                    </div>

                    <div className="pt-6 mt-6 border-t border-gray-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-600">Est. Annual ROI</span>
                        <span className="text-sm font-extrabold text-[#c9a654] bg-yellow-50 px-3 py-1 rounded-md">{estimatedAnnualROI.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-600">Payback Period</span>
                        <span className="text-sm font-bold text-[#122244]">{paybackPeriod.toFixed(1)} months</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-[#122244] rounded-xl border border-[#1a2f55] p-8 shadow-md h-full text-white">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-white/10 rounded-lg"><BarChart3 className="w-5 h-5 text-[#c9a654]" /></div>
                    <h3 className="font-bold text-white text-lg">Quick Financial Metrics</h3>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center pb-6 border-b border-white/10">
                      <span className="text-sm font-medium text-gray-300">Break-even Point (Days)</span>
                      <span className="text-xl font-extrabold text-white">{breakEvenDays} <span className="text-sm text-gray-400 font-normal">days/mo</span></span>
                    </div>
                    <div className="flex justify-between items-center pb-6 border-b border-white/10">
                      <span className="text-sm font-medium text-gray-300">Daily Revenue Needed</span>
                      <span className="text-xl font-extrabold text-white">₱{dailyRevenueNeeded.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-300">Expense-to-Income Ratio</span>
                      <span className="text-xl font-extrabold text-[#c9a654]">{expenseToIncomeRatio.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg"><TrendingDown className="w-5 h-5 text-red-500" /></div>
                  <h3 className="font-bold text-[#122244] text-lg">Operating Expenses (Monthly)</h3>
                </div>
                <button onClick={addExpense} className="flex items-center gap-2 text-[#c9a654] hover:text-[#b59545] text-sm font-bold transition-colors">
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                  <span>Expense Name</span>
                  <span>Amount (PHP)</span>
                  <span></span>
                </div>

                {expenses.map(expense => (
                  <div key={expense.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center group">
                    <input 
                      type="text" value={expense.name}
                      onChange={(e) => setExpenses(expenses.map(ex => ex.id === expense.id ? { ...ex, name: e.target.value } : ex))}
                      className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] text-sm font-medium transition-all"
                    />
                    <input 
                      type="number" value={expense.amount}
                      onChange={(e) => setExpenses(expenses.map(ex => ex.id === expense.id ? { ...ex, amount: parseFloat(e.target.value) || 0 } : ex))}
                      className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] text-sm font-bold transition-all"
                    />
                    <button onClick={() => deleteExpense(expense.id)} className="text-gray-300 hover:text-red-500 transition-colors justify-self-end mr-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-4 mt-2 border-t border-gray-100">
                  <input 
                    type="text" placeholder="New expense..." value={newExpenseName} onChange={(e) => setNewExpenseName(e.target.value)}
                    className="px-4 py-2.5 border border-dashed border-gray-300 rounded-lg focus:outline-none focus:border-[#c9a654] text-sm transition-colors"
                  />
                  <input 
                    type="number" placeholder="0" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)}
                    className="px-4 py-2.5 border border-dashed border-gray-300 rounded-lg focus:outline-none focus:border-[#c9a654] text-sm font-bold transition-colors"
                  />
                  <div></div>
                </div>
              </div>

              <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                <div className="flex items-center gap-6">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Expenses</span>
                  <span className="text-2xl font-extrabold text-[#122244]">₱{effectiveMonthlyExpenses.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Projected Daily Income */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-500" /></div>
                  <h3 className="font-bold text-[#122244] text-lg">Projected Daily Income</h3>
                </div>
                <button onClick={addIncomeSource} className="flex items-center gap-2 text-[#c9a654] hover:text-[#b59545] text-sm font-bold transition-colors">
                  <Plus className="w-4 h-4" /> Add Source
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                  <span>Income Source</span>
                  <span>Daily Amount (PHP)</span>
                  <span></span>
                </div>

                {incomeSources.map(income => (
                  <div key={income.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <input 
                      type="text" value={income.name}
                      onChange={(e) => setIncomeSources(incomeSources.map(inc => inc.id === income.id ? { ...inc, name: e.target.value } : inc))}
                      className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] text-sm font-medium transition-all"
                    />
                    <input 
                      type="number" value={income.amount}
                      onChange={(e) => setIncomeSources(incomeSources.map(inc => inc.id === income.id ? { ...inc, amount: parseFloat(e.target.value) || 0 } : inc))}
                      className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] text-sm font-bold transition-all"
                    />
                    <button onClick={() => deleteIncomeSource(income.id)} className="text-gray-300 hover:text-red-500 transition-colors justify-self-end mr-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-4 mt-2 border-t border-gray-100">
                  <input 
                    type="text" placeholder="New income source..." value={newIncomeName} onChange={(e) => setNewIncomeName(e.target.value)}
                    className="px-4 py-2.5 border border-dashed border-gray-300 rounded-lg focus:outline-none focus:border-[#c9a654] text-sm transition-colors"
                  />
                  <input 
                    type="number" placeholder="0" value={newIncomeAmount} onChange={(e) => setNewIncomeAmount(e.target.value)}
                    className="px-4 py-2.5 border border-dashed border-gray-300 rounded-lg focus:outline-none focus:border-[#c9a654] text-sm font-bold transition-colors"
                  />
                  <div></div>
                </div>
              </div>

              <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex flex-col items-end gap-2">
                <div className="flex items-center gap-6">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Daily Total</span>
                  <span className="text-2xl font-extrabold text-[#122244]">₱{effectiveDailyIncome.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-[10px] font-bold text-[#c9a654] uppercase tracking-widest">Projected Monthly (x30)</span>
                  <span className="text-lg font-extrabold text-[#c9a654]">₱{effectiveMonthlyIncome.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
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

export default Financial_input;