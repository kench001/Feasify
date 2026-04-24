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
} from "lucide-react";

const Financial_input: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
  });

  // --- CALCULATION ENGINE ---
  const safeSellingPrice = Number(financials.sellingPrice) || 0;
  const safeMonthlySales = Number(financials.monthlySales) || 0;
  const safeVariableCost = Number(financials.variableCost) || 0;
  const safeFixedCosts = Number(financials.fixedCosts) || 0;
  const safeStartupCapital = Number(financials.startupCapital) || 0;

  const monthlyRevenue = safeSellingPrice * safeMonthlySales;
  const annualRevenue = monthlyRevenue * 12;

  const totalMonthlyVariableCosts = safeVariableCost * safeMonthlySales;
  const netMonthlyProfit =
    monthlyRevenue - totalMonthlyVariableCosts - safeFixedCosts;
  const annualNetProfit = netMonthlyProfit * 12;

  const paybackVal =
    netMonthlyProfit > 0
      ? (safeStartupCapital / netMonthlyProfit).toFixed(1)
      : "∞";
  const rawROI =
    safeStartupCapital > 0 ? (annualNetProfit / safeStartupCapital) * 100 : 0;
  const estimatedAnnualROI = isNaN(rawROI) ? "0.0" : rawROI.toFixed(1);

  const contributionMargin = safeSellingPrice - safeVariableCost;
  const breakEvenUnits =
    contributionMargin > 0
      ? Math.ceil(safeFixedCosts / contributionMargin)
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
          const state = location.state as any;
          const targetId =
            state?.projectId ||
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
      setFinancials({
        sellingPrice: String(selectedProj.financialData.sellingPrice || "0"),
        monthlySales: String(selectedProj.financialData.monthlySales || "0"),
        variableCost: String(selectedProj.financialData.variableCost || "0"),
        fixedCosts: String(selectedProj.financialData.fixedCosts || "0"),
        startupCapital: String(
          selectedProj.financialData.startupCapital ||
            selectedProj.proposalCapital ||
            "0",
        ),
        competitorCount: selectedProj.financialData.competitorCount || 0,
        marketDemand: selectedProj.financialData.marketDemand || "Medium",
      });
    } else {
      setFinancials({
        sellingPrice: "0",
        monthlySales: "0",
        variableCost: "0",
        fixedCosts: "0",
        startupCapital: String(selectedProj.proposalCapital || "0"),
        competitorCount: 0,
        marketDemand: "Medium",
      });
    }
  };

  const handleAutoSave = async (dataToSave = financials) => {
    if (!selectedProjectId) return;
    setIsSaving(true);
    setSaveStatus("Saving...");
    try {
      await updateDoc(doc(db, "proposals", selectedProjectId), {
        financialData: {
          sellingPrice: Number(dataToSave.sellingPrice) || 0,
          monthlySales: Number(dataToSave.monthlySales) || 0,
          variableCost: Number(dataToSave.variableCost) || 0,
          fixedCosts: Number(dataToSave.fixedCosts) || 0,
          startupCapital: Number(dataToSave.startupCapital) || 0,
          competitorCount: dataToSave.competitorCount,
          marketDemand: dataToSave.marketDemand,
        },
        updatedAt: serverTimestamp(),
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProjectId
            ? { ...p, financialData: { ...dataToSave } }
            : p,
        ),
      );
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

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23]">
                Financial Projections
              </h1>
              <p className="text-sm text-gray-500 mt-1 italic">
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

          <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-3 font-bold">
              Approved Project Workspace
            </label>
            <div className="relative w-full md:w-1/2 z-30">
              <div
                className={`w-full px-4 py-3.5 bg-gray-50 border rounded-lg flex items-center justify-between text-sm font-bold text-[#122244] cursor-pointer ${isProjectMenuOpen ? "border-[#c9a654] ring-2 ring-[#c9a654]/20 bg-white" : "hover:bg-gray-100"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (projects.length > 0)
                    setIsProjectMenuOpen(!isProjectMenuOpen);
                }}
              >
                {selectedProjectId && projects.length > 0
                  ? projects.find((p) => p.id === selectedProjectId)?.name
                  : "Select Project..."}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${isProjectMenuOpen ? "rotate-180 text-[#c9a654]" : ""}`}
                />
              </div>
              {isProjectMenuOpen && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] w-full bg-white border shadow-xl rounded-xl py-2 z-50">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProjectSelect(p.id);
                        setIsProjectMenuOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3 text-sm transition-colors ${selectedProjectId === p.id ? "bg-blue-50 text-[#122244] font-extrabold" : "text-gray-700 hover:bg-gray-50"}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border-l-4 border-l-green-500 p-6 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                Monthly Revenue
              </span>
              <p className="text-2xl font-black text-[#122244]">
                ₱{monthlyRevenue.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border-l-4 border-l-red-500 p-6 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                Monthly Expenses
              </span>
              <p className="text-2xl font-black text-[#122244]">
                ₱{(totalMonthlyVariableCosts + safeFixedCosts).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border-l-4 border-l-blue-500 p-6 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                Break-Even Point
              </span>
              <p className="text-2xl font-black text-[#122244]">
                {breakEvenUnits}{" "}
                <span className="text-xs text-gray-400 font-bold">units</span>
              </p>
            </div>
            <div
              className={`bg-white rounded-xl border-l-4 p-6 shadow-sm ${netMonthlyProfit >= 0 ? "border-l-[#c9a654]" : "border-l-red-500"}`}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                Net Profit/mo
              </span>
              <p
                className={`text-2xl font-black ${netMonthlyProfit < 0 ? "text-red-500" : "text-[#122244]"}`}
              >
                ₱{netMonthlyProfit.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6">
              <h3 className="font-bold text-[#122244] flex items-center gap-2 border-b pb-4 uppercase text-xs tracking-widest">
                <Package className="text-[#c9a654]" /> Sales & Pricing
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
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
                    className="w-full px-4 py-3 bg-gray-50 border rounded-lg outline-none font-bold text-[#122244]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Est. Monthly Sales
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
                    className="w-full px-4 py-3 bg-gray-50 border rounded-lg outline-none font-bold text-[#122244]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Variable Cost per Unit
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
                  className="w-full px-4 py-3 bg-gray-50 border rounded-lg outline-none font-bold text-[#122244]"
                />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6">
              <h3 className="font-bold text-[#122244] flex items-center gap-2 border-b pb-4 uppercase text-xs tracking-widest">
                <TrendingUp className="text-[#c9a654]" /> Capital & Operations
              </h3>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Startup Capital (Synced)
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
                  className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-bold text-[#122244]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Fixed Costs (Monthly)
                </label>
                <input
                  type="number"
                  value={financials.fixedCosts}
                  onChange={(e) =>
                    setFinancials({ ...financials, fixedCosts: e.target.value })
                  }
                  onBlur={() => handleAutoSave()}
                  className="w-full px-4 py-3 bg-gray-50 border rounded-lg font-bold text-[#122244]"
                />
              </div>
            </div>

            {/* --- RESTORED MARKET INDICATORS SECTION --- */}
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
                    onTouchEnd={() => handleAutoSave()}
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
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${financials.marketDemand === level ? "bg-white shadow-sm text-[#122244]" : "text-gray-400 hover:text-gray-600"}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#122244] rounded-xl p-8 shadow-md text-white mb-8">
            <h3 className="font-bold text-white text-lg flex items-center gap-2 mb-8 border-b border-white/10 pb-4">
              <BarChart3 className="text-[#c9a654]" /> Quick Financial Metrics
            </h3>
            <div className="space-y-6 px-2">
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <span className="text-sm text-gray-500 italic">
                  Est. Annual Revenue
                </span>
                <span className="text-xl font-bold">
                  ₱{annualRevenue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <span className="text-sm text-gray-500 italic">
                  Payback Period
                </span>
                <span className="text-xl font-bold text-[#c9a654]">
                  {paybackVal} {paybackVal !== "∞" ? "months" : ""}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <span className="text-sm text-gray-500 italic">
                  Est. Annual ROI
                </span>
                <span className="text-xl font-bold">{estimatedAnnualROI}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 italic">
                  Break-even Units
                </span>
                <span className="text-xl font-bold">
                  {breakEvenUnits} {breakEvenUnits !== "N/A" ? "units/mo" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Financial_input;
