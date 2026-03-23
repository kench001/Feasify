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
  Printer,
  Download,
  CheckCircle2,
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

  // Financial data from Financial Input
  const [initialCapital, setInitialCapital] = useState(0);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);

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

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // PDF export functionality - can be implemented with a library like jsPDF or html2pdf
    alert("Export to PDF functionality - to be implemented with API");
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
              <button onClick={() => navigate('/ai-analysis')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <Zap className="w-4 h-4" /> AI Analysis
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-[#249c74] text-white transition-all">
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
          <span className="font-semibold text-gray-900">Reports</span>
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Financial Report</h1>
              <p className="text-sm text-gray-500 mt-1">Complete feasibility report</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-all"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10"
              >
                <Download className="w-4 h-4" /> Export PDF
              </button>
            </div>
          </div>

          {/* FeasiFy Report Card */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-[#249c74] rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">FeasiFy Report</h2>
                <p className="text-sm text-gray-500">Financial Feasibility Analysis</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block px-3 py-1 bg-[#249c74] text-white text-xs font-bold rounded-full">
                  FEASIBLE
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Project Name</p>
                <p className="text-gray-900 font-semibold">{hasData ? "Financial Analysis" : "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Prepared By</p>
                <p className="text-gray-900 font-semibold">{userName || "User"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Feasibility Score</p>
                <p className="text-2xl font-bold text-[#249c74]">{hasData ? "—" : "—"} / 100</p>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm mb-8">
            <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-[#249c74]" />
              Financial Summary
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 text-xs font-semibold uppercase">Item</th>
                    <th className="text-right py-3 px-4 text-gray-500 text-xs font-semibold uppercase">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-700">Initial Capital</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-semibold">₱{initialCapital.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-700">Monthly Operating Expenses</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-semibold">₱{totalMonthlyExpenses.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-700">Projected Monthly Income</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-semibold">₱{totalMonthlyIncome.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-700">Net Monthly Income</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-semibold">₱{netMonthlyIncome.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-700">Annual ROI</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-semibold">{estimatedAnnualROI.toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-gray-700">Payback Period</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-semibold">{paybackPeriod.toFixed(1)} months</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm mb-8">
            <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-[#249c74]" />
              Expense Breakdown
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 text-xs font-semibold uppercase">Expense Item</th>
                    <th className="text-right py-3 px-4 text-gray-500 text-xs font-semibold uppercase">Amount (PHP)</th>
                    <th className="text-right py-3 px-4 text-gray-500 text-xs font-semibold uppercase">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length > 0 ? (
                    <>
                      {expenses.map(expense => (
                        <tr key={expense.id} className="border-b border-gray-50">
                          <td className="py-3 px-4 text-gray-700">{expense.name}</td>
                          <td className="py-3 px-4 text-right text-gray-900">₱{expense.amount.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-gray-900">{totalMonthlyExpenses > 0 ? ((expense.amount / totalMonthlyExpenses) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-100">
                        <td className="py-3 px-4 text-gray-900 font-semibold">Total Monthly Expenses</td>
                        <td className="py-3 px-4 text-right text-gray-900 font-semibold">₱{totalMonthlyExpenses.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-gray-900 font-semibold">100%</td>
                      </tr>
                    </>
                  ) : (
                    <tr className="border-b border-gray-50">
                      <td colSpan={3} className="py-3 px-4 text-gray-500 text-center">No expenses added</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Income Breakdown */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm mb-8">
            <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-[#249c74]" />
              Income Breakdown
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-gray-500 text-xs font-semibold uppercase">Income Source</th>
                    <th className="text-right py-3 px-4 text-gray-500 text-xs font-semibold uppercase">Daily (PHP)</th>
                    <th className="text-right py-3 px-4 text-gray-500 text-xs font-semibold uppercase">Monthly (PHP)</th>
                    <th className="text-right py-3 px-4 text-gray-500 text-xs font-semibold uppercase">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeSources.length > 0 ? (
                    <>
                      {incomeSources.map(income => (
                        <tr key={income.id} className="border-b border-gray-50">
                          <td className="py-3 px-4 text-gray-700">{income.name}</td>
                          <td className="py-3 px-4 text-right text-gray-900">₱{income.amount.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-gray-900">₱{(income.amount * 30).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-gray-900">{totalDailyIncome > 0 ? ((income.amount / totalDailyIncome) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-100">
                        <td className="py-3 px-4 text-gray-900 font-semibold">Total Monthly Income</td>
                        <td className="py-3 px-4 text-right text-gray-900 font-semibold">₱{totalDailyIncome.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-gray-900 font-semibold">₱{totalMonthlyIncome.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-gray-900 font-semibold">100%</td>
                      </tr>
                    </>
                  ) : (
                    <tr className="border-b border-gray-50">
                      <td colSpan={4} className="py-3 px-4 text-gray-500 text-center">No income sources added</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Conclusion & Recommendations */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#249c74]" />
              Conclusion & Recommendations
            </h3>

            <div className="space-y-4 text-sm text-gray-700">
              <p>
                <span className="font-semibold text-gray-900">Conclusion:</span> {hasData ? `Based on the financial data entered, this project has a net monthly income of ₱${netMonthlyIncome.toLocaleString()} with a payback period of ${paybackPeriod.toFixed(1)} months. The annual ROI is estimated at ${estimatedAnnualROI.toFixed(1)}%.` : "No financial data has been entered yet. Please complete the Financial Input section to generate a comprehensive feasibility report."}
              </p>

              <div>
                <p className="font-semibold text-gray-900 mb-2">Key Strengths:</p>
                <p className="text-gray-600">
                  {hasData 
                    ? netMonthlyIncome > 0 
                      ? `Strong profitability with projected monthly surplus of ₱${netMonthlyIncome.toLocaleString()}.`
                      : "Review expense and income configuration for profitability."
                    : "Awaiting financial data analysis..."}
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-2">Recommendations:</p>
                <p className="text-gray-600">
                  {hasData 
                    ? "Monitor cash flow closely and review the expense breakdown regularly to ensure profitability targets are met. Consider expense optimization strategies if margins become tight."
                    : "Enter your financial data in the Financial Input section to receive personalized recommendations."}
                </p>
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

export default Reports;
