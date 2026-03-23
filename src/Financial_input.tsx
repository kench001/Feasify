import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Plus,
  Sidebar as SidebarIcon,
  X,
  Trash2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Zap as ZapIcon,
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
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Financial data states
  const [initialCapital, setInitialCapital] = useState(0);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);

  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);

  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newIncomeName, setNewIncomeName] = useState("");
  const [newIncomeAmount, setNewIncomeAmount] = useState("");

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

  const handleLogout = async () => {
    try { await fbSignOut(auth); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  // Calculate totals
  const totalMonthlyExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDailyIncome = incomeSources.reduce((sum, i) => sum + i.amount, 0);
  const totalMonthlyIncome = totalDailyIncome * 30;
  const netMonthlyIncome = totalMonthlyIncome - totalMonthlyExpenses;

  // Calculate metrics
  const estimatedAnnualROI = initialCapital > 0 ? ((netMonthlyIncome * 12) / initialCapital * 100) : 0;
  const paybackPeriod = netMonthlyIncome > 0 ? initialCapital / netMonthlyIncome : 0;
  const breakEvenDays = totalDailyIncome > 0 ? Math.ceil(initialCapital / totalDailyIncome) : 0;
  const dailyRevenueNeeded = totalMonthlyExpenses / 30;
  const expenseToIncomeRatio = totalDailyIncome > 0 ? (totalMonthlyExpenses / totalMonthlyIncome * 100) : 0;

  const addExpense = () => {
    if (newExpenseName.trim() && newExpenseAmount.trim()) {
      setExpenses([...expenses, {
        id: Math.random().toString(),
        name: newExpenseName,
        amount: parseFloat(newExpenseAmount),
      }]);
      setNewExpenseName("");
      setNewExpenseAmount("");
    }
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const addIncomeSource = () => {
    if (newIncomeName.trim() && newIncomeAmount.trim()) {
      setIncomeSources([...incomeSources, {
        id: Math.random().toString(),
        name: newIncomeName,
        amount: parseFloat(newIncomeAmount),
      }]);
      setNewIncomeName("");
      setNewIncomeAmount("");
    }
  };

  const deleteIncomeSource = (id: string) => {
    setIncomeSources(incomeSources.filter(i => i.id !== id));
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
              <button onClick={() => navigate('/financial-input')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-[#249c74] text-white transition-all">
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button onClick={() => navigate('/ai-analysis')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
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
          <span className="font-semibold text-gray-900">Financial Input</span>
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Financial Data Input</h1>
              <p className="text-sm text-gray-500 mt-1">Enter your financial data below</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-all">
                <DollarSign className="w-4 h-4" /> Save Draft
              </button>
              <button 
                onClick={() => navigate('/ai-analysis', { 
                  state: { 
                    initialCapital, 
                    expenses, 
                    incomeSources 
                  } 
                })}
                className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10"
              >
                <ZapIcon className="w-4 h-4" /> Run Analysis
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase">Initial Capital</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">₱{initialCapital.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase">Monthly Expenses</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">₱{totalMonthlyExpenses.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase">Monthly Income (est.)</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">₱{totalMonthlyIncome.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase">Net Income/mo</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">₱{netMonthlyIncome.toLocaleString()}</p>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Initial Capital Section - Left Column */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <DollarSign className="w-5 h-5 text-[#249c74]" />
                  <h3 className="font-bold text-gray-900">Initial Capital</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-900 block mb-2">Amount (PHP)</label>
                    <input 
                      type="number"
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74]"
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Est. Annual ROI</span>
                      <span className="text-sm font-bold text-[#249c74]">{estimatedAnnualROI.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Payback Period</span>
                      <span className="text-sm font-bold text-gray-900">{paybackPeriod.toFixed(1)} months</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Metrics Section - Right Columns */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="w-5 h-5 text-[#249c74]" />
                  <h3 className="font-bold text-gray-900">Quick Metrics</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Break-even Point</span>
                    <span className="text-sm font-bold text-gray-900">{breakEvenDays} days/mo</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Daily Revenue Needed</span>
                    <span className="text-sm font-bold text-gray-900">₱{dailyRevenueNeeded.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Expense-to-Income Ratio</span>
                    <span className="text-sm font-bold text-gray-900">{expenseToIncomeRatio.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Operating Expenses Section */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-gray-900">Operating Expenses (Monthly)</h3>
              </div>
              <button 
                onClick={addExpense}
                className="flex items-center gap-2 text-[#249c74] hover:text-[#1e8563] text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold text-gray-500 uppercase mb-3 px-1">
                <span>Expense Name</span>
                <span>Amount (PHP)</span>
                <span></span>
              </div>

              {expenses.map(expense => (
                <div key={expense.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <input 
                    type="text"
                    value={expense.name}
                    onChange={(e) => {
                      setExpenses(expenses.map(ex => 
                        ex.id === expense.id ? { ...ex, name: e.target.value } : ex
                      ));
                    }}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] text-sm"
                  />
                  <input 
                    type="number"
                    value={expense.amount}
                    onChange={(e) => {
                      setExpenses(expenses.map(ex => 
                        ex.id === expense.id ? { ...ex, amount: parseFloat(e.target.value) || 0 } : ex
                      ));
                    }}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] text-sm"
                  />
                  <button 
                    onClick={() => deleteExpense(expense.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center border-t border-gray-100 pt-3">
                <input 
                  type="text"
                  placeholder="New expense..."
                  value={newExpenseName}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] text-sm"
                />
                <input 
                  type="number"
                  placeholder="0"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] text-sm"
                />
                <div></div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-gray-900">₱{totalMonthlyExpenses.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Projected Daily Income Section */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900">Projected Daily Income</h3>
              </div>
              <button 
                onClick={addIncomeSource}
                className="flex items-center gap-2 text-[#249c74] hover:text-[#1e8563] text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Source
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold text-gray-500 uppercase mb-3 px-1">
                <span>Income Source</span>
                <span>Daily Amount (PHP)</span>
                <span></span>
              </div>

              {incomeSources.map(income => (
                <div key={income.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <input 
                    type="text"
                    value={income.name}
                    onChange={(e) => {
                      setIncomeSources(incomeSources.map(inc => 
                        inc.id === income.id ? { ...inc, name: e.target.value } : inc
                      ));
                    }}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] text-sm"
                  />
                  <input 
                    type="number"
                    value={income.amount}
                    onChange={(e) => {
                      setIncomeSources(incomeSources.map(inc => 
                        inc.id === income.id ? { ...inc, amount: parseFloat(e.target.value) || 0 } : inc
                      ));
                    }}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] text-sm"
                  />
                  <button 
                    onClick={() => deleteIncomeSource(income.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center border-t border-gray-100 pt-3">
                <input 
                  type="text"
                  placeholder="New income source..."
                  value={newIncomeName}
                  onChange={(e) => setNewIncomeName(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] text-sm"
                />
                <input 
                  type="number"
                  placeholder="0"
                  value={newIncomeAmount}
                  onChange={(e) => setNewIncomeAmount(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] text-sm"
                />
                <div></div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex justify-end">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-900">Daily Total</span>
                  <span className="text-xl font-bold text-gray-900">₱{totalDailyIncome.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-end text-sm text-gray-500">
                <span>Projected Monthly (x30)</span>
                <span className="ml-4 font-bold text-[#249c74]">₱{totalMonthlyIncome.toLocaleString()}</span>
              </div>
            </div>
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

export default Financial_input;
