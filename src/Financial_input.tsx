import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { useTheme } from "./ThemeContext";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
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
  Save,
  ChevronDown,
  DollarSign,
  Package,
  TrendingUp,
  Target,
  Sidebar as SidebarIcon,
  CheckCircle2,
  Bell,
  Calendar,
  Info,
  Plus,
  Trash2,
} from "lucide-react";

const Financial_input: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("All changes saved");

  const [financials, setFinancials] = useState({
    sellingPrice: "",
    monthlySales: "",
    variableCost: "",
    fixedCosts: "",
    startupCapital: "",
    competitorCount: 0,
    marketDemand: "Medium",
    operatingDays: "300",
    equipmentList: [] as { id: string; name: string; quantity: number; unitPrice: number; total: number }[],
    opexList: [] as { id: string; name: string; amount: number }[],
    isCapitalBorrowed: false,
    interestRate: "",
  });

  // --- PHILIPPINE BMBE TAX CALCULATION (RA 9178) ---
  const calculateBMBETax = (annualRevenue: number) => {
    const percentageTax = annualRevenue * 0.03;
    return {
      amount: percentageTax,
      incomeTax: 0,
      percentageTax: percentageTax,
      rate: 3,
      note: "BMBE Exempt from Income Tax"
    };
  };

  // --- CALCULATION ENGINE ---
  const safeSellingPrice = Number(financials.sellingPrice) || 0;
  const safeMonthlySales = Number(financials.monthlySales) || 0;
  const safeVariableCost = Number(financials.variableCost) || 0;
  
  const calculatedOpex = financials.opexList && financials.opexList.length > 0
    ? financials.opexList.reduce((sum, item) => sum + item.amount, 0)
    : (Number(financials.fixedCosts) || 0);
  const safeFixedCosts = calculatedOpex;
  
  const calculatedStartupCapital = financials.equipmentList && financials.equipmentList.length > 0 
    ? financials.equipmentList.reduce((sum, item) => sum + item.total, 0)
    : (Number(financials.startupCapital) || 0);
  const safeStartupCapital = calculatedStartupCapital;
  
  const safeOperatingDays = Number(financials.operatingDays) || 300;

  const monthlyRevenue = safeSellingPrice * safeMonthlySales;
  const totalMonthlyVariableCosts = safeVariableCost * safeMonthlySales;
  const grossProfitMargin = monthlyRevenue > 0 ? ((monthlyRevenue - totalMonthlyVariableCosts) / monthlyRevenue) * 100 : 0;
  
  const monthlyInterest = financials.isCapitalBorrowed ? (safeStartupCapital * (Number(financials.interestRate) / 100)) / 12 : 0;

  const netMonthlyProfit =
    monthlyRevenue - totalMonthlyVariableCosts - safeFixedCosts - monthlyInterest;

  const annualRevenue = (monthlyRevenue / 30) * safeOperatingDays;
  const annualExpenses =
    ((totalMonthlyVariableCosts + safeFixedCosts + monthlyInterest) / 30) * safeOperatingDays;
  const annualNetProfitPreTax = annualRevenue - annualExpenses;

  const taxResult = calculateBMBETax(annualRevenue > 0 ? annualRevenue : 0);
  const annualNetProfitAfterTax =
    (annualNetProfitPreTax > 0 ? annualNetProfitPreTax : 0) - taxResult.amount;

  const paybackVal =
    annualNetProfitAfterTax > 0
      ? (safeStartupCapital / (annualNetProfitAfterTax / 12)).toFixed(1)
      : "∞";
  const estimatedAnnualROI =
    safeStartupCapital > 0
      ? ((annualNetProfitAfterTax / safeStartupCapital) * 100).toFixed(1)
      : "0.0";
  const breakEvenUnits =
    safeSellingPrice - safeVariableCost > 0
      ? Math.ceil(safeFixedCosts / (safeSellingPrice - safeVariableCost))
      : "N/A";

  useEffect(() => {
    const handleClickOutside = () => setIsProjectMenuOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

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
          where("status", "in", ["Approved", "APPROVED"]),
        );
        const propSnap = await getDocs(propQ);
        const approvedProposals = propSnap.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().businessName || "Untitled Proposal",
          proposalCapital: doc.data().totalCapital || "0",
          financialData: doc.data().financialData || null,
        }));
        setProjects(approvedProposals);
        if (approvedProposals.length > 0) {
          const targetId =
            sessionStorage.getItem("lastSelectedProjectId") ||
            approvedProposals[0].id;
          handleProjectSelect(targetId, approvedProposals);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleProjectSelect = (projectId: string, projectList = projects) => {
    const selectedProj = projectList.find((p) => p.id === projectId);
    if (!selectedProj) return;

    setSelectedProjectId(projectId);
    sessionStorage.setItem("lastSelectedProjectId", projectId);

    if (selectedProj.financialData) {
      let loadedOpex = selectedProj.financialData.opexList || [];
      if (loadedOpex.length === 0 && selectedProj.financialData.fixedCosts && Number(selectedProj.financialData.fixedCosts) > 0) {
        loadedOpex = [{
          id: Date.now().toString(),
          name: "General OpEx",
          amount: Number(selectedProj.financialData.fixedCosts)
        }];
      }

      const getVal = (val: any) => {
        if (val === undefined || val === null || String(val) === "0") return "";
        return String(val);
      };

      setFinancials({
        sellingPrice: getVal(selectedProj.financialData.sellingPrice),
        monthlySales: getVal(selectedProj.financialData.monthlySales),
        variableCost: getVal(selectedProj.financialData.variableCost),
        fixedCosts: getVal(selectedProj.financialData.fixedCosts),
        startupCapital: getVal(
          selectedProj.financialData.startupCapital ||
            selectedProj.proposalCapital
        ),
        competitorCount: selectedProj.financialData.competitorCount || 0,
        marketDemand: selectedProj.financialData.marketDemand || "Medium",
        operatingDays: String(
          selectedProj.financialData.operatingDays || "300",
        ),
        equipmentList: selectedProj.financialData.equipmentList || [],
        opexList: loadedOpex,
        isCapitalBorrowed: selectedProj.financialData.isCapitalBorrowed || false,
        interestRate: getVal(selectedProj.financialData.interestRate),
      });
    } else {
      const getVal = (val: any) => {
        if (val === undefined || val === null || String(val) === "0") return "";
        return String(val);
      };

      setFinancials({
        sellingPrice: "",
        monthlySales: "",
        variableCost: "",
        fixedCosts: "",
        startupCapital: getVal(selectedProj.proposalCapital),
        competitorCount: 0,
        marketDemand: "Medium",
        operatingDays: "300",
        equipmentList: [],
        opexList: [],
        isCapitalBorrowed: false,
        interestRate: "",
      });
    }
  };

  const handleAutoSave = async (dataToSave = financials) => {
    if (!selectedProjectId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "proposals", selectedProjectId), {
        financialData: { ...dataToSave, updatedAt: serverTimestamp() },
      });
      setSaveStatus("All changes saved");
    } catch (e) {
      setSaveStatus("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

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
    <div className="flex min-h-screen bg-gray-50/50 dark:bg-gray-900 overflow-hidden text-[#122244] dark:text-gray-100 transition-colors duration-300">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* SIDEBAR */}
      <aside
        className={`flex w-64 bg-[#122244] dark:bg-gray-950 text-white flex-col fixed inset-y-0 shadow-xl z-[60] transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="p-6 border-b border-white/10">
          <img
            src="/dashboard logo.png"
            className="w-70 h-20 object-contain"
            alt="FeasiFy"
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
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button
                onClick={() => navigate("/ai-analysis")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
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
        <div className="p-4 border-t border-white/10 bg-black/20 flex items-center gap-3 text-white">
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
        className={`flex-1 transition-all duration-300 min-h-screen ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
      >
        <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 transition-colors">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 dark:hover:text-white transition-colors"
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
          <span className="font-semibold text-gray-900 dark:text-white transition-colors">Financial Input</span>
        </div>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 dark:border-gray-700 pb-6 transition-colors">
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23] dark:text-white transition-colors">
                Financial Projections
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic font-medium transition-colors">
                Parameters auto-sync from proposal.
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <span
                className={`text-xs font-bold flex items-center gap-1 transition-colors ${isSaving ? "text-gray-400 animate-pulse" : "text-green-600 dark:text-green-400"}`}
              >
                {isSaving ? <Save size={14} /> : <CheckCircle2 size={14} />}{" "}
                {saveStatus}
              </span>
              <button
                onClick={() =>
                  navigate("/ai-analysis", {
                    state: { projectId: selectedProjectId, runAnalysis: true },
                  })
                }
                className="flex items-center gap-2 ml-4 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95"
              >
                <Zap size={16} fill="currentColor" /> Run Analysis
              </button>
            </div>
          </div>

          {/* PROJECT SELECTOR */}
          <div className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase block mb-3 transition-colors">
              Approved Project Workspace
            </label>
            <div className="relative w-full md:w-1/2 z-30">
              <div
                className={`w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg flex items-center justify-between text-sm font-bold text-[#122244] dark:text-white cursor-pointer transition-colors ${isProjectMenuOpen ? "border-[#c9a654] dark:border-[#c9a654] ring-2 ring-[#c9a654]/20 bg-white dark:bg-gray-800" : "hover:bg-gray-100 dark:hover:bg-gray-600"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProjectMenuOpen(!isProjectMenuOpen);
                }}
              >
                {selectedProjectId
                  ? projects.find((p) => p.id === selectedProjectId)?.name
                  : "Select Project..."}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${isProjectMenuOpen ? "rotate-180" : ""}`}
                />
              </div>
              {isProjectMenuOpen && (
                <div className="absolute left-0 top-full w-full bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-xl rounded-xl py-2 z-50 transition-colors">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleProjectSelect(p.id);
                        setIsProjectMenuOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3 text-sm transition-colors ${selectedProjectId === p.id ? "bg-blue-50 dark:bg-blue-900/30 font-extrabold text-[#122244] dark:text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* QUICK CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 text-[#122244] dark:text-white transition-colors">
            <div className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-y border-r border-y-gray-200 border-r-gray-200 dark:border-y-gray-700 dark:border-r-gray-700 border-l-green-500 p-6 shadow-sm text-center transition-colors">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">
                Monthly Revenue
              </span>
              <p className="text-2xl font-black">
                ₱{monthlyRevenue.toLocaleString()}
              </p>
              <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-400 font-semibold bg-gray-50/80 dark:bg-gray-700/80 py-1.5 px-2 rounded-lg border border-gray-100 dark:border-gray-600 transition-colors">
                Price × Sales
                <p className="text-[9px] text-[#c9a654] mt-0.5">
                  ₱{safeSellingPrice.toLocaleString()} ×{" "}
                  {safeMonthlySales.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-y border-r border-y-gray-200 border-r-gray-200 dark:border-y-gray-700 dark:border-r-gray-700 border-l-red-500 p-6 shadow-sm text-center transition-colors">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">
                Monthly Expenses
              </span>
              <p className="text-2xl font-black">
                ₱{(totalMonthlyVariableCosts + safeFixedCosts).toLocaleString()}
              </p>
              <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-400 font-semibold bg-gray-50/80 dark:bg-gray-700/80 py-1.5 px-2 rounded-lg border border-gray-100 dark:border-gray-600 transition-colors">
                (COGS per Unit × Sales) + Fixed
                <p className="text-[9px] text-[#c9a654] mt-0.5">
                  (₱{safeVariableCost.toLocaleString()} ×{" "}
                  {safeMonthlySales.toLocaleString()}) + ₱
                  {safeFixedCosts.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-y border-r border-y-gray-200 border-r-gray-200 dark:border-y-gray-700 dark:border-r-gray-700 border-l-blue-500 p-6 shadow-sm text-center transition-colors">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">
                Break-Even Point
              </span>
              <p className="text-2xl font-black">
                {breakEvenUnits}{" "}
                <span className="text-xs text-gray-400 dark:text-gray-500 font-bold transition-colors">units</span>
              </p>
              <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-400 font-semibold bg-gray-50/80 dark:bg-gray-700/80 py-1.5 px-2 rounded-lg border border-gray-100 dark:border-gray-600 transition-colors">
                Monthly OpEx / (Price - COGS per Unit)
                <p className="text-[9px] text-[#c9a654] mt-0.5">
                  ₱{safeFixedCosts.toLocaleString()} / (₱
                  {safeSellingPrice.toLocaleString()} - ₱
                  {safeVariableCost.toLocaleString()})
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-y border-r border-y-gray-200 border-r-gray-200 dark:border-y-gray-700 dark:border-r-gray-700 border-l-purple-500 p-6 shadow-sm text-center transition-colors">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">
                Gross Margin
              </span>
              <p className="text-2xl font-black">
                {grossProfitMargin.toFixed(1)}%
              </p>
              <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-400 font-semibold bg-gray-50/80 dark:bg-gray-700/80 py-1.5 px-2 rounded-lg border border-gray-100 dark:border-gray-600 transition-colors">
                (Rev - COGS) / Rev
                <p className="text-[9px] text-[#c9a654] mt-0.5">
                  (₱{monthlyRevenue.toLocaleString()} - ₱
                  {totalMonthlyVariableCosts.toLocaleString()}) / ₱
                  {monthlyRevenue.toLocaleString()}
                </p>
              </div>
            </div>

            <div
              className={`bg-white dark:bg-gray-800 rounded-xl border-y border-r border-y-gray-200 border-r-gray-200 dark:border-y-gray-700 dark:border-r-gray-700 border-l-4 p-6 shadow-sm text-center transition-colors ${netMonthlyProfit >= 0 ? "border-l-[#c9a654]" : "border-l-red-500"}`}
            >
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">
                Net Profit/mo
              </span>
              <p
                className={`text-2xl font-black ${netMonthlyProfit < 0 ? "text-red-500" : ""}`}
              >
                ₱{netMonthlyProfit.toLocaleString()}
              </p>
              <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-400 font-semibold bg-gray-50/80 dark:bg-gray-700/80 py-1.5 px-2 rounded-lg border border-gray-100 dark:border-gray-600 transition-colors">
                Revenue - Expenses
                <p className="text-[9px] text-[#c9a654] mt-0.5">
                  ₱{monthlyRevenue.toLocaleString()} - ₱
                  {(
                    totalMonthlyVariableCosts + safeFixedCosts
                  ).toLocaleString()}{monthlyInterest > 0 && ` - ₱${monthlyInterest.toLocaleString()} (Int)`}
                </p>
              </div>
            </div>
          </div>

          {/* MAIN INPUT GRID - FIXED LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-start">
            
            {/* LEFT COLUMN: Sales, Pricing & OpEx */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Sales & Pricing */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6 transition-colors text-[#122244] dark:text-white">
                <h3 className="font-bold flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-4 uppercase text-xs tracking-widest transition-colors">
                  <Package className="text-[#c9a654]" /> Sales & Pricing
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase transition-colors">
                      Selling Price
                    </label>
                    <input
                      type="number"
                      value={financials.sellingPrice}
                      placeholder="0"
                      onChange={(e) =>
                        setFinancials({
                          ...financials,
                          sellingPrice: e.target.value,
                        })
                      }
                      onBlur={() => handleAutoSave()}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-bold focus:ring-2 focus:ring-[#c9a654]/20 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 text-[#122244] dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase transition-colors">
                      Monthly Sales / UNIT
                    </label>
                    <input
                      type="number"
                      value={financials.monthlySales}
                      placeholder="0"
                      onChange={(e) =>
                        setFinancials({
                          ...financials,
                          monthlySales: e.target.value,
                        })
                      }
                      onBlur={() => handleAutoSave()}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-bold focus:ring-2 focus:ring-[#c9a654]/20 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 text-[#122244] dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase transition-colors">
                      Cost of Goods (COGS) / Unit
                    </label>
                    <input
                      type="number"
                      value={financials.variableCost}
                      placeholder="0"
                      onChange={(e) =>
                        setFinancials({
                          ...financials,
                          variableCost: e.target.value,
                        })
                      }
                      onBlur={() => handleAutoSave()}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-bold focus:ring-2 focus:ring-[#c9a654]/20 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 text-[#122244] dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Monthly Cost (OpEx) */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6 transition-colors text-[#122244] dark:text-white">
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4 transition-colors">
                  <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest">
                    <TrendingUp className="text-[#c9a654]" /> Monthly Cost (OpEx)
                  </h3>
                  <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-2 transition-colors">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase transition-colors">Total:</span>
                    <span className="text-sm font-black text-blue-800 dark:text-blue-300 transition-colors">₱{safeFixedCosts.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-600 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 transition-colors">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/50 z-10 shadow-sm transition-colors">
                        <tr className="border-b border-gray-200 dark:border-gray-600 text-[10px] uppercase text-gray-500 dark:text-gray-400 tracking-wider transition-colors">
                          <th className="p-3 font-bold">Expense Name</th>
                          <th className="p-3 font-bold w-28">Amount</th>
                          <th className="p-3 font-bold w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {financials.opexList && financials.opexList.map((item, index) => (
                          <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.name}
                                placeholder="e.g. Electricity, Rent"
                                onChange={(e) => {
                                  const newList = [...financials.opexList];
                                  newList[index].name = e.target.value;
                                  setFinancials({ ...financials, opexList: newList });
                                }}
                                onBlur={() => handleAutoSave()}
                                className="w-full px-2 py-1.5 bg-transparent border border-gray-200 dark:border-gray-600 rounded-md text-sm text-[#122244] dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:border-[#c9a654] outline-none transition-colors"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={item.amount === 0 ? "" : item.amount}
                                placeholder="0"
                                onChange={(e) => {
                                  const newList = [...financials.opexList];
                                  const amt = e.target.value === "" ? 0 : Number(e.target.value);
                                  newList[index].amount = amt;
                                  setFinancials({ ...financials, opexList: newList });
                                }}
                                onBlur={() => handleAutoSave()}
                                className="w-full px-2 py-1.5 bg-transparent border border-gray-200 dark:border-gray-600 rounded-md text-sm text-[#122244] dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:border-[#c9a654] outline-none transition-colors"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => {
                                  const newList = financials.opexList.filter(i => i.id !== item.id);
                                  const newState = { ...financials, opexList: newList };
                                  setFinancials(newState);
                                  handleAutoSave(newState);
                                }}
                                className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!financials.opexList || financials.opexList.length === 0) && (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-xs text-gray-400 dark:text-gray-500 italic transition-colors">
                              No expenses added yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => {
                      const currentList = financials.opexList || [];
                      const newItem = { id: Date.now().toString(), name: "", amount: 0 };
                      setFinancials({ ...financials, opexList: [...currentList, newItem] });
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#c9a654] hover:text-[#b59545] uppercase tracking-wider transition-colors"
                  >
                    <Plus size={14} /> Add Expense
                  </button>
                </div>
              </div>
            </div>

            {/* Capital & Operations - Now takes 8/12 of width */}
            <div className="lg:col-span-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6 text-[#122244] dark:text-white transition-colors">
              <h3 className="font-bold flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-4 uppercase text-xs tracking-widest transition-colors">
                <TrendingUp className="text-[#c9a654]" /> Capital & Operations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase transition-colors">
                    Operating Days / Year
                  </label>
                  <input
                    type="number"
                    value={financials.operatingDays}
                    onChange={(e) =>
                      setFinancials({
                        ...financials,
                        operatingDays: e.target.value,
                      })
                    }
                    onBlur={() => handleAutoSave()}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-bold focus:ring-2 focus:ring-[#c9a654]/20 outline-none transition-all text-[#122244] dark:text-white"
                  />
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700 transition-colors">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase transition-colors">
                    Startup Capital / Equipment List
                  </label>
                  <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-2 transition-colors">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase transition-colors">Total Capital:</span>
                    <span className="text-sm font-black text-blue-800 dark:text-blue-300 transition-colors">₱{calculatedStartupCapital.toLocaleString()}</span>
                  </div>
                </div>

                {calculatedStartupCapital > 3000000 && (
                  <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 text-xs transition-colors">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-500" />
                    <p>
                      <strong>Note:</strong> Total assets exceeding ₱3,000,000 may disqualify you from BMBE tax exemptions.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {/* SCROLLABLE TABLE CONTAINER */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-600 max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 transition-colors">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/50 z-10 shadow-sm transition-colors">
                        <tr className="border-b border-gray-200 dark:border-gray-600 text-[10px] uppercase text-gray-500 dark:text-gray-400 tracking-wider transition-colors">
                          <th className="p-3 font-bold">Item Name</th>
                          <th className="p-3 font-bold w-20">Qty</th>
                          <th className="p-3 font-bold w-28">Unit Price</th>
                          <th className="p-3 font-bold w-28">Total</th>
                          <th className="p-3 font-bold w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {financials.equipmentList.map((item, index) => (
                          <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.name}
                                placeholder="e.g. Machine"
                                onChange={(e) => {
                                  const newList = [...financials.equipmentList];
                                  newList[index].name = e.target.value;
                                  setFinancials({ ...financials, equipmentList: newList });
                                }}
                                onBlur={() => handleAutoSave()}
                                className="w-full px-2 py-1.5 bg-transparent border border-gray-200 dark:border-gray-600 rounded-md text-sm text-[#122244] dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:border-[#c9a654] outline-none transition-colors"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newList = [...financials.equipmentList];
                                  const qty = Number(e.target.value) || 0;
                                  newList[index].quantity = qty;
                                  newList[index].total = qty * newList[index].unitPrice;
                                  setFinancials({ ...financials, equipmentList: newList });
                                }}
                                onBlur={() => handleAutoSave()}
                                className="w-full px-2 py-1.5 bg-transparent border border-gray-200 dark:border-gray-600 rounded-md text-sm text-[#122244] dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:border-[#c9a654] outline-none transition-colors"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={item.unitPrice === 0 ? "" : item.unitPrice}
                                placeholder="0"
                                onChange={(e) => {
                                  const newList = [...financials.equipmentList];
                                  const price = e.target.value === "" ? 0 : Number(e.target.value);
                                  newList[index].unitPrice = price;
                                  newList[index].total = newList[index].quantity * price;
                                  setFinancials({ ...financials, equipmentList: newList });
                                }}
                                onBlur={() => handleAutoSave()}
                                className="w-full px-2 py-1.5 bg-transparent border border-gray-200 dark:border-gray-600 rounded-md text-sm text-[#122244] dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:border-[#c9a654] outline-none transition-colors"
                              />
                            </td>
                            <td className="p-2 text-sm font-bold text-gray-700 dark:text-gray-200 transition-colors">
                              ₱{item.total.toLocaleString()}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => {
                                  const newList = financials.equipmentList.filter(i => i.id !== item.id);
                                  const newState = { ...financials, equipmentList: newList };
                                  setFinancials(newState);
                                  handleAutoSave(newState);
                                }}
                                className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => {
                      const newItem = { id: Date.now().toString(), name: "", quantity: 1, unitPrice: 0, total: 0 };
                      setFinancials({ ...financials, equipmentList: [...financials.equipmentList, newItem] });
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#c9a654] hover:text-[#b59545] uppercase tracking-wider transition-colors"
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700 transition-colors">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-colors">Financing Options</h4>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const newState = { ...financials, isCapitalBorrowed: !financials.isCapitalBorrowed };
                      setFinancials(newState);
                      handleAutoSave(newState);
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${financials.isCapitalBorrowed ? 'bg-[#c9a654]' : 'bg-gray-200 dark:bg-gray-600'}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${financials.isCapitalBorrowed ? 'translate-x-4' : 'translate-x-1'}`}
                    />
                  </button>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">Is this capital borrowed?</span>
                </div>
                
                {financials.isCapitalBorrowed && (
                  <div className="space-y-1 mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase transition-colors">
                      Annual Interest Rate (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={financials.interestRate}
                        placeholder="0"
                        onChange={(e) =>
                          setFinancials({
                            ...financials,
                            interestRate: e.target.value,
                          })
                        }
                        onBlur={() => handleAutoSave()}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-bold pr-8 focus:ring-2 focus:ring-[#c9a654]/20 outline-none transition-all text-[#122244] dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-bold transition-colors">%</span>
                    </div>
                    {monthlyInterest > 0 && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 italic mt-1 transition-colors">
                        Subtracting ₱{monthlyInterest.toLocaleString()} monthly from Net Profit.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FISCAL SUMMARY CARD */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm space-y-6 mb-8 transition-colors">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4 transition-colors">
              <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244] dark:text-white transition-colors">
                <BarChart3 className="text-[#c9a654]" /> Fiscal Summary (BMBE Tax Framework)
              </h3>
              <button
                onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}
                className="text-[10px] font-black uppercase text-[#c9a654] border border-[#c9a654]/30 px-3 py-1 rounded-lg hover:bg-[#c9a654]/5 transition-all"
              >
                {showTaxBreakdown ? "Hide Details" : "View Computation"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4 text-[#122244] dark:text-white transition-colors">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block transition-colors">
                    Annual Net Profit (Before Tax)
                  </label>
                  <p className="text-2xl font-bold text-[#3d2c23] dark:text-white transition-colors">
                    ₱{annualNetProfitPreTax.toLocaleString()}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block transition-colors">
                    Estimated Annual Business Tax
                  </label>
                  <p className="text-4xl font-black">
                    ₱{taxResult.amount.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg w-fit border border-green-100 dark:border-green-800 transition-colors">
                    <Info size={14} className="text-green-600 dark:text-green-500" />
                    <span className="text-[11px] font-bold text-green-700 dark:text-green-400 transition-colors">
                      {taxResult.note}
                    </span>
                  </div>
                </div>
              </div>

              {showTaxBreakdown ? (
                <div className="bg-[#122244] dark:bg-gray-950 p-5 rounded-xl text-white shadow-inner animate-in fade-in slide-in-from-top-2 duration-300 transition-colors">
                  <p className="text-[10px] font-black text-[#c9a654] uppercase mb-4 tracking-widest text-center border-b border-white/10 pb-2">
                    BMBE Tax Computation Log
                  </p>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-400 font-bold uppercase tracking-tighter">
                          Income Tax (RA 9178)
                        </span>
                        <span className="text-green-400 font-bold text-sm">
                          ₱0
                        </span>
                      </div>
                      <div className="bg-black/20 p-2 rounded border-l-2 border-green-500">
                        <p className="text-[10px] text-gray-300 leading-tight">
                          BMBEs are explicitly exempt from income tax arising from their operations.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-400 font-bold uppercase tracking-tighter">
                          Percentage Tax
                        </span>
                        <span className="text-white font-bold text-sm">
                          ₱{taxResult.percentageTax.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-black/20 p-2 rounded border-l-2 border-blue-400">
                        <p className="text-[10px] text-gray-300 leading-tight">
                          Formula: <span className="text-blue-400">₱{annualRevenue.toLocaleString()} (Gross Sales)</span> × {taxResult.rate}%
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between pt-2 border-t-2 border-[#c9a654]/40 font-black text-[#c9a654] text-xs uppercase tracking-tight">
                      <span>Total Annual Tax Liability:</span>
                      <span>₱{taxResult.amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-dashed border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center text-center text-[#122244] dark:text-gray-300 transition-colors">
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic transition-colors">
                    Click "View Computation" to see the bucket-by-bucket
                    summation logic behind your tax amount.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Market Indicators */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm space-y-6 text-[#122244] dark:text-white mb-8 transition-colors">
            <h3 className="font-bold flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-4 uppercase text-xs tracking-widest transition-colors">
              <Target className="text-[#c9a654]" /> Market Indicators
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4 px-2">
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block transition-colors">
                  Competitor Count:{" "}
                  <span className="text-[#122244] dark:text-white font-black text-sm ml-1 transition-colors">
                    {financials.competitorCount}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={financials.competitorCount}
                  onChange={(e) =>
                    setFinancials({
                      ...financials,
                      competitorCount: Number(e.target.value),
                    })
                  }
                  onMouseUp={() => handleAutoSave()}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-[#c9a654]"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase transition-colors">
                  Market Demand
                </label>
                <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl transition-colors">
                  {["Low", "Medium", "High"].map((level) => (
                    <button
                      key={level}
                      onClick={() => {
                        const newState = {
                          ...financials,
                          marketDemand: level,
                        };
                        setFinancials(newState);
                        handleAutoSave(newState);
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        financials.marketDemand === level
                          ? "bg-white dark:bg-gray-600 shadow-sm text-[#122244] dark:text-white"
                          : "text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#122244] dark:bg-gray-950 rounded-xl p-8 shadow-md text-white transition-colors">
            <h3 className="font-bold text-white text-lg flex items-center gap-2 mb-8 border-b border-white/10 pb-4">
              <BarChart3 className="text-[#c9a654]" /> Adjusted Annual Metrics
            </h3>
            <div className="space-y-6 px-2">
              <div className="flex justify-between items-center pb-4 border-b border-white/5 text-white">
                <span className="text-sm text-gray-400 italic">
                  Est. Annual Revenue (at {safeOperatingDays} days)
                </span>
                <span className="text-xl font-bold text-white">
                  ₱{annualRevenue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/5 text-white">
                <span className="text-sm text-gray-400 italic text-white">
                  Net Annual Profit (After Tax)
                </span>
                <span className="text-xl font-bold text-[#c9a654]">
                  ₱{annualNetProfitAfterTax.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/5 text-white">
                <span className="text-sm text-gray-400 italic text-white">
                  Payback Period
                </span>
                <span className="text-xl font-bold text-white">
                  {paybackVal} months
                </span>
              </div>
              <div className="flex justify-between items-center text-white">
                <span className="text-sm text-gray-400 italic text-white text-white">
                  Adjusted Annual ROI
                </span>
                <span className="text-xl font-bold text-white text-white">
                  {estimatedAnnualROI}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-colors"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 z-10 w-11/12 max-w-sm shadow-xl text-center relative text-[#122244] dark:text-white transition-colors">
            <h3 className="text-lg font-bold mb-2">Sign Out?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 italic text-center transition-colors">
              Are you sure you want to log out?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={handleLogout}
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

export default Financial_input;