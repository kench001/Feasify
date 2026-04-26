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
} from "lucide-react";

const Financial_input: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("All changes saved");

  const [financials, setFinancials] = useState({
    sellingPrice: "0",
    monthlySales: "0",
    variableCost: "0",
    fixedCosts: "0",
    startupCapital: "0",
    competitorCount: 0,
    marketDemand: "Medium",
    operatingDays: "300",
  });

  // --- PHILIPPINE GRADUATED TAX CALCULATION (TRAIN LAW) WITH PRECISE SIGNALS ---
  const calculateGraduatedTax = (annualProfit: number) => {
    const p = annualProfit;
    if (p <= 250000)
      return {
        amount: 0,
        bracket: "Exempt (below ₱250,000)",
        baseTax: 0,
        baseTaxFormula: "₱0 (Profit within Tier 1)",
        excessFormula: "None",
        rate: 0,
        threshold: 0,
        tier: "Tier 1",
      };

    if (p <= 400000)
      return {
        amount: (p - 250000) * 0.15,
        bracket: "15% of excess over ₱250,000",
        baseTax: 0,
        baseTaxFormula: "₱0 (Tier 1 is exempt)",
        excessFormula: `(₱${p.toLocaleString()} - ₱250,000)`,
        rate: 15,
        threshold: 250000,
        tier: "Tier 2",
      };

    if (p <= 800000)
      return {
        amount: 22500 + (p - 400000) * 0.2,
        bracket: "₱22,500 + 20% over ₱400,000",
        baseTax: 22500,
        baseTaxFormula: "₱0 (T1) + ₱22,500 (Tier 2: 15% of ₱150,000)",
        excessFormula: `(₱${p.toLocaleString()} - ₱400,000)`,
        rate: 20,
        threshold: 400000,
        tier: "Tier 3",
      };

    if (p <= 2000000)
      return {
        amount: 102500 + (p - 800000) * 0.25,
        bracket: "₱102,500 + 25% over ₱800,000",
        baseTax: 102500,
        baseTaxFormula: "₱22,500 (T1-2) + ₱80,000 (Tier 3: 20% of ₱400,000)",
        excessFormula: `(₱${p.toLocaleString()} - ₱80,0000)`,
        rate: 25,
        threshold: 800000,
        tier: "Tier 4",
      };

    if (p <= 8000000)
      return {
        amount: 402500 + (p - 2000000) * 0.3,
        bracket: "₱402,500 + 30% over ₱2,000,000",
        baseTax: 402500,
        baseTaxFormula:
          "₱102,500 (T1-3) + ₱300,000 (Tier 4: 25% of ₱1,200,000)",
        excessFormula: `(₱${p.toLocaleString()} - ₱2,000,000)`,
        rate: 30,
        threshold: 2000000,
        tier: "Tier 5",
      };

    return {
      amount: 2202500 + (p - 8000000) * 0.35,
      bracket: "₱2,202,500 + 35% over ₱8,000,000",
      baseTax: 2202500,
      baseTaxFormula:
        "₱402,500 (T1-4) + ₱1,800,000 (Tier 5: 30% of ₱6,000,000)",
      excessFormula: `(₱${p.toLocaleString()} - ₱8,000,000)`,
      rate: 35,
      threshold: 8000000,
      tier: "Tier 6",
    };
  };

  // --- CALCULATION ENGINE ---
  const safeSellingPrice = Number(financials.sellingPrice) || 0;
  const safeMonthlySales = Number(financials.monthlySales) || 0;
  const safeVariableCost = Number(financials.variableCost) || 0;
  const safeFixedCosts = Number(financials.fixedCosts) || 0;
  const safeStartupCapital = Number(financials.startupCapital) || 0;
  const safeOperatingDays = Number(financials.operatingDays) || 300;

  const monthlyRevenue = safeSellingPrice * safeMonthlySales;
  const totalMonthlyVariableCosts = safeVariableCost * safeMonthlySales;
  const netMonthlyProfit =
    monthlyRevenue - totalMonthlyVariableCosts - safeFixedCosts;

  const annualRevenue = (monthlyRevenue / 30) * safeOperatingDays;
  const annualExpenses =
    ((totalMonthlyVariableCosts + safeFixedCosts) / 30) * safeOperatingDays;
  const annualNetProfitPreTax = annualRevenue - annualExpenses;

  const taxResult = calculateGraduatedTax(
    annualNetProfitPreTax > 0 ? annualNetProfitPreTax : 0,
  );
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
          proposalCapital: doc.data().totalCapital || "0", // This must match the field name in Firestore
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

    // This section syncs the Total Capital from the Proposal to the Startup Capital field
    if (selectedProj.financialData) {
      setFinancials({
        sellingPrice: String(selectedProj.financialData.sellingPrice || "0"),
        monthlySales: String(selectedProj.financialData.monthlySales || "0"),
        variableCost: String(selectedProj.financialData.variableCost || "0"),
        fixedCosts: String(selectedProj.financialData.fixedCosts || "0"),
        // Prioritize saved financial data, fallback to the Proposal's Total Capital
        startupCapital: String(
          selectedProj.financialData.startupCapital ||
            selectedProj.proposalCapital ||
            "0",
        ),
        competitorCount: selectedProj.financialData.competitorCount || 0,
        marketDemand: selectedProj.financialData.marketDemand || "Medium",
        operatingDays: String(
          selectedProj.financialData.operatingDays || "300",
        ),
      });
    } else {
      // First-time selection: Auto-fills Startup Capital with the Proposal's Total Capital
      setFinancials({
        sellingPrice: "0",
        monthlySales: "0",
        variableCost: "0",
        fixedCosts: "0",
        startupCapital: String(selectedProj.proposalCapital || "0"),
        competitorCount: 0,
        marketDemand: "Medium",
        operatingDays: "300",
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

  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden text-[#122244]">
      {/* SIDEBAR */}
      <aside
        className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
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
      </aside>

      <main
        className={`flex-1 transition-all duration-300 min-h-screen ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
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
          <span className="font-semibold text-gray-900">Financial Input</span>
        </div>

        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23]">
                Financial Projections
              </h1>
              <p className="text-sm text-gray-500 mt-1 italic font-medium">
                Parameters auto-sync from proposal.
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <span
                className={`text-xs font-bold flex items-center gap-1 ${isSaving ? "text-gray-400 animate-pulse" : "text-green-600"}`}
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
          <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-3">
              Approved Project Workspace
            </label>
            <div className="relative w-full md:w-1/2 z-30">
              <div
                className={`w-full px-4 py-3.5 bg-gray-50 border rounded-lg flex items-center justify-between text-sm font-bold text-[#122244] cursor-pointer ${isProjectMenuOpen ? "border-[#c9a654] ring-2 ring-[#c9a654]/20 bg-white" : "hover:bg-gray-100"}`}
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
                <div className="absolute left-0 top-full w-full bg-white border shadow-xl rounded-xl py-2 z-50">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleProjectSelect(p.id);
                        setIsProjectMenuOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3 text-sm transition-colors ${selectedProjectId === p.id ? "bg-blue-50 font-extrabold text-[#122244]" : "hover:bg-gray-50"}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* QUICK CARDS WITH DYNAMIC FORMULAS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 text-[#122244]">
            <div className="bg-white rounded-xl border-l-4 border-l-green-500 p-6 shadow-sm text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Monthly Revenue
              </span>
              <p className="text-2xl font-black">
                ₱{monthlyRevenue.toLocaleString()}
              </p>
              <div className="mt-2 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                Price × Sales
                <p className="text-[9px] text-[#c9a654] mt-0.5">
                  ₱{safeSellingPrice.toLocaleString()} ×{" "}
                  {safeMonthlySales.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-l-red-500 p-6 shadow-sm text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Monthly Expenses
              </span>
              <p className="text-2xl font-black">
                ₱{(totalMonthlyVariableCosts + safeFixedCosts).toLocaleString()}
              </p>
              <div className="mt-2 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                (COGS per Unit × Sales) + Fixed
                <p className="text-[9px] text-[#c9a654] mt-0.5">
                  (₱{safeVariableCost.toLocaleString()} ×{" "}
                  {safeMonthlySales.toLocaleString()}) + ₱
                  {safeFixedCosts.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-l-blue-500 p-6 shadow-sm text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Break-Even Point
              </span>
              <p className="text-2xl font-black">
                {breakEvenUnits}{" "}
                <span className="text-xs text-gray-400 font-bold">units</span>
              </p>
              <div className="mt-2 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                Fixed Cost / (Price - COGS per Unit)
                <p className="text-[9px] text-[#c9a654] mt-0.5">
                  ₱{safeFixedCosts.toLocaleString()} / (₱
                  {safeSellingPrice.toLocaleString()} - ₱
                  {safeVariableCost.toLocaleString()})
                </p>
              </div>
            </div>

            <div
              className={`bg-white rounded-xl border-l-4 p-6 shadow-sm text-center ${netMonthlyProfit >= 0 ? "border-l-[#c9a654]" : "border-l-red-500"}`}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Net Profit/mo
              </span>
              <p
                className={`text-2xl font-black ${netMonthlyProfit < 0 ? "text-red-500" : ""}`}
              >
                ₱{netMonthlyProfit.toLocaleString()}
              </p>
              <div className="mt-2 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                Revenue - Expenses
                <p className="text-[9px] text-[#c9a654] mt-0.5">
                  ₱{monthlyRevenue.toLocaleString()} - ₱
                  {(
                    totalMonthlyVariableCosts + safeFixedCosts
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 text-[#122244]">
            {/* Sales & Pricing Inputs */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6">
              <h3 className="font-bold flex items-center gap-2 border-b pb-4 uppercase text-xs tracking-widest">
                <Package className="text-[#c9a654]" /> Sales & Pricing
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
                    Selling Price
                  </label>
                  <input
                    type="number"
                    value={financials.sellingPrice}
                    onChange={(e) =>
                      setFinancials({
                        ...financials,
                        sellingPrice: e.target.value,
                      })
                    }
                    onBlur={() => handleAutoSave()}
                    className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
                    Monthly Sales / UNIT
                  </label>
                  <input
                    type="number"
                    value={financials.monthlySales}
                    onChange={(e) =>
                      setFinancials({
                        ...financials,
                        monthlySales: e.target.value,
                      })
                    }
                    onBlur={() => handleAutoSave()}
                    className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">
                  Cost of Goods (COGS) / Unit
                </label>
                <input
                  type="number"
                  value={financials.variableCost}
                  onChange={(e) =>
                    setFinancials({
                      ...financials,
                      variableCost: e.target.value,
                    })
                  }
                  onBlur={() => handleAutoSave()}
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6 text-[#122244]">
              <h3 className="font-bold flex items-center gap-2 border-b pb-4 uppercase text-xs tracking-widest text-[#122244]">
                <TrendingUp className="text-[#c9a654]" /> Capital & Operations
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
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
                    className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
                    Fixed Cost (Monthly)
                  </label>
                  <input
                    type="number"
                    value={financials.fixedCosts}
                    onChange={(e) =>
                      setFinancials({
                        ...financials,
                        fixedCosts: e.target.value,
                      })
                    }
                    onBlur={() => handleAutoSave()}
                    className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">
                  Startup Capital
                </label>
                <input
                  type="number"
                  value={financials.startupCapital}
                  onChange={(e) =>
                    setFinancials({
                      ...financials,
                      startupCapital: e.target.value,
                    })
                  }
                  onBlur={() => handleAutoSave()}
                  className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg font-bold"
                />
              </div>
            </div>

            {/* FISCAL SUMMARY CARD */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244]">
                  <BarChart3 className="text-[#c9a654]" /> Fiscal Summary (TRAIN
                  Law)
                </h3>
                <button
                  onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}
                  className="text-[10px] font-black uppercase text-[#c9a654] border border-[#c9a654]/30 px-3 py-1 rounded-lg hover:bg-[#c9a654]/5 transition-all"
                >
                  {showTaxBreakdown ? "Hide Details" : "View Computation"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4 text-[#122244]">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Annual Net Profit (Before Tax)
                    </label>
                    <p className="text-2xl font-bold text-[#3d2c23]">
                      ₱{annualNetProfitPreTax.toLocaleString()}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Estimated Annual Income Tax
                    </label>
                    <p className="text-4xl font-black">
                      ₱{taxResult.amount.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-green-50 rounded-lg w-fit border border-green-100">
                      <Info size={14} className="text-green-600" />
                      <span className="text-[11px] font-bold text-green-700">
                        {taxResult.bracket}
                      </span>
                    </div>
                  </div>
                </div>

                {showTaxBreakdown ? (
                  <div className="bg-[#122244] p-5 rounded-xl text-white shadow-inner animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] font-black text-[#c9a654] uppercase mb-4 tracking-widest text-center border-b border-white/10 pb-2">
                      Official Tax Computation Log
                    </p>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-400 font-bold uppercase tracking-tighter">
                            Step 1: Accumulated Base Tax
                          </span>
                          <span className="text-white font-bold text-sm">
                            ₱{taxResult.baseTax.toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-black/20 p-2 rounded border-l-2 border-[#c9a654]">
                          <p className="text-[9px] text-gray-400 uppercase font-bold mb-1">
                            Previous Tiers Total Sum:
                          </p>
                          <p className="text-[10px] text-gray-300 leading-tight">
                            {taxResult.baseTaxFormula}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-400 font-bold uppercase tracking-tighter">
                            Step 2: {taxResult.tier} Excess Tax
                          </span>
                          <span className="text-white font-bold text-sm">
                            + ₱
                            {(
                              taxResult.amount - taxResult.baseTax
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-black/20 p-2 rounded border-l-2 border-blue-400">
                          <p className="text-[10px] text-gray-300 leading-tight">
                            Math:{" "}
                            <span className="text-blue-400">
                              {taxResult.excessFormula}
                            </span>{" "}
                            × {taxResult.rate}%
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
                  <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center text-[#122244]">
                    <p className="text-xs text-gray-400 italic">
                      Click "View Computation" to see the bucket-by-bucket
                      summation logic behind your tax amount.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Market Indicators */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6 text-[#122244]">
              <h3 className="font-bold flex items-center gap-2 border-b pb-4 uppercase text-xs tracking-widest">
                <Target className="text-[#c9a654]" /> Market Indicators
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4 px-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase block">
                    Competitor Count:{" "}
                    <span className="text-[#122244] font-black text-sm ml-1">
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
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#c9a654]"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">
                    Market Demand
                  </label>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
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
                            ? "bg-white shadow-sm text-[#122244]"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#122244] rounded-xl p-8 shadow-md text-white">
              <h3 className="font-bold text-white text-lg flex items-center gap-2 mb-8 border-b border-white/10 pb-4">
                <BarChart3 className="text-[#c9a654]" /> Adjusted Annual Metrics
              </h3>
              <div className="space-y-6 px-2">
                <div className="flex justify-between items-center pb-4 border-b border-white/5 text-white">
                  <span className="text-sm text-gray-500 italic">
                    Est. Annual Revenue (at {safeOperatingDays} days)
                  </span>
                  <span className="text-xl font-bold text-white">
                    ₱{annualRevenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-white/5 text-white">
                  <span className="text-sm text-gray-500 italic text-white">
                    Net Annual Profit (After Tax)
                  </span>
                  <span className="text-xl font-bold text-[#c9a654]">
                    ₱{annualNetProfitAfterTax.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-white/5 text-white">
                  <span className="text-sm text-gray-500 italic text-white">
                    Payback Period
                  </span>
                  <span className="text-xl font-bold text-white">
                    {paybackVal} months
                  </span>
                </div>
                <div className="flex justify-between items-center text-white">
                  <span className="text-sm text-gray-500 italic text-white text-white">
                    Adjusted Annual ROI
                  </span>
                  <span className="text-xl font-bold text-white text-white">
                    {estimatedAnnualROI}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-sm shadow-xl text-center relative text-[#122244]">
            <h3 className="text-lg font-bold mb-2">Sign Out?</h3>
            <p className="text-sm text-gray-600 mb-6 italic text-center text-[#122244]">
              Are you sure you want to log out?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 text-gray-600 text-gray-600"
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
