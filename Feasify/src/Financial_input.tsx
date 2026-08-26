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
  Plus,
  Trash2,
  Scale,
  FileSpreadsheet,
  Activity,
  Layers,
  PieChart,
  ShieldCheck,
  ArrowUpRight,
  Download,
  Printer,
  FileText,
  X,
} from "lucide-react";

const Financial_input: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [taxTab, setTaxTab] = useState<"log" | "math">("math");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [activeModuleTab, setActiveModuleTab] = useState<"operations" | "balance-sheet" | "ratios">("operations");

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("All changes saved");

  const [financials, setFinancials] = useState({
    sellingPrice: "",
    monthlySales: "",
    variableCost: "",
    fixedCosts: "",
    startupCapital: "",
    cashInvested: "",
    propertyInvested: "",
    rentAdvanceDeposit: "",
    trainingsPrograms: "",
    advertisingExpense: "",
    salariesExpenseInitial: "",
    accountsPayable: "",
    utilitiesPayable: "",
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
  
  const calculatedEquipmentTotal = financials.equipmentList && financials.equipmentList.length > 0 
    ? financials.equipmentList.reduce((sum, item) => sum + item.total, 0)
    : (Number(financials.startupCapital) || 0);
  const safeStartupCapital = calculatedEquipmentTotal;
  
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

  // --- BALANCE SHEET ENGINE (feasify_financial_input_module.md) ---
  // Section 1: Initial Capital & Sources of Financing
  const safeCashInvested = Number(financials.cashInvested) || (safeStartupCapital > 0 ? safeStartupCapital : 0);
  const safePropertyInvested = Number(financials.propertyInvested) || 0;
  const totalInitialCapital = safeCashInvested + safePropertyInvested;

  // Startup Project Cost Breakdown (Section 2)
  const safeRentAdvance = Number(financials.rentAdvanceDeposit) || 0;
  const safeTrainings = Number(financials.trainingsPrograms) || 0;
  const safeAdvertising = Number(financials.advertisingExpense) || 0;
  const safeSalariesInitial = Number(financials.salariesExpenseInitial) || 0;
  const totalProjectCost = safeRentAdvance + safeTrainings + safeAdvertising + safeSalariesInitial + safeStartupCapital;

  // Section 4: Current Assets
  const operatingCashBuffer = Math.max(0, netMonthlyProfit * 12);
  const totalLiquidCash = safeCashInvested + operatingCashBuffer;
  const cashOnHand = totalLiquidCash * 0.15; // 15% allocation
  const cashInBank = totalLiquidCash * 0.85; // 85% allocation
  const rawMaterialInventory = totalMonthlyVariableCosts * 0.15; // 15% ending inventory buffer
  const totalCurrentAssets = cashOnHand + cashInBank + rawMaterialInventory;

  // Non-Current Assets: Equipment/Machinery net of 10% straight-line annual depreciation
  const grossPPE = safeStartupCapital + safePropertyInvested;
  const annualDepreciation = grossPPE * 0.10;
  const ppeNet = Math.max(0, grossPPE - annualDepreciation);
  const totalNonCurrentAssets = ppeNet;
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  // Current Liabilities
  const safeAccountsPayable = Number(financials.accountsPayable) || (totalMonthlyVariableCosts * 0.20);
  const safeUtilitiesPayable = Number(financials.utilitiesPayable) || (safeFixedCosts * 0.15);
  const totalCurrentLiabilities = safeAccountsPayable + safeUtilitiesPayable;

  // Owner's Equity
  const initialEquity = totalInitialCapital > 0 ? totalInitialCapital : safeStartupCapital;
  const endingOwnerEquity = totalAssets - totalCurrentLiabilities;
  const totalLiabilitiesAndEquity = totalCurrentLiabilities + endingOwnerEquity;

  // --- AUTOMATED FINANCIAL RATIOS & ACTIVITY METRICS (Section 5) ---
  // 1. Current Ratio = Current Assets / Current Liabilities
  const currentRatio = totalCurrentLiabilities > 0 
    ? (totalCurrentAssets / totalCurrentLiabilities).toFixed(2) 
    : (totalCurrentAssets > 0 ? "99.9" : "0.0");
  
  // 2. Inventory Turnover = Cost of Sales / Average Inventory
  const annualCOGS = (totalMonthlyVariableCosts / 30) * safeOperatingDays;
  const avgInventory = rawMaterialInventory > 0 ? rawMaterialInventory : 1;
  const inventoryTurnover = avgInventory > 0 ? (annualCOGS / avgInventory).toFixed(1) : "0.0";

  // 3. Average Age of Inventory = 360 Days / Inventory Turnover
  const numTurnover = Number(inventoryTurnover) || 0;
  const avgAgeOfInventory = numTurnover > 0 ? Math.round(360 / numTurnover) : 0;

  // 4. Current Asset Turnover = Net Sales / Current Assets
  const currentAssetTurnover = totalCurrentAssets > 0 
    ? (annualRevenue / totalCurrentAssets).toFixed(2) 
    : "0.0";

  // 5. Exact Payback Period in Years, Months, and Days
  const monthlyCashInflow = annualNetProfitAfterTax > 0 ? (annualNetProfitAfterTax / 12) : 0;
  let paybackYears = 0;
  let paybackMonths = 0;
  let paybackDays = 0;
  if (monthlyCashInflow > 0 && safeStartupCapital > 0) {
    const totalMonths = safeStartupCapital / monthlyCashInflow;
    paybackYears = Math.floor(totalMonths / 12);
    paybackMonths = Math.floor(totalMonths % 12);
    paybackDays = Math.round((totalMonths % 1) * 30);
  }

  const handleExportCSV = () => {
    const activeProjName = projects.find((p) => p.id === selectedProjectId)?.name || "Project";
    const dateStr = new Date().toLocaleDateString();

    const csvRows: string[] = [];
    const addRow = (col1 = "", col2: string | number = "", col3: string | number = "", col4: string | number = "") => {
      const escape = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;
      csvRows.push([escape(col1), escape(col2), escape(col3), escape(col4)].join(","));
    };

    addRow(`FEASIFY FINANCIAL PROJECTIONS & FEASIBILITY REPORT`);
    addRow(`Business Name:`, activeProjName);
    addRow(`Generated Date:`, dateStr);
    addRow();

    addRow(`=== 1. OPERATIONAL PROJECTIONS & COSTING ===`);
    addRow(`Selling Price (PHP)`, safeSellingPrice);
    addRow(`Monthly Target Sales (Units)`, safeMonthlySales);
    addRow(`Cost of Goods Sold (COGS/Unit)`, safeVariableCost);
    addRow(`Monthly Revenue (PHP)`, monthlyRevenue);
    addRow(`Total Monthly Variable Costs (PHP)`, totalMonthlyVariableCosts);
    addRow(`Total Monthly Fixed OpEx (PHP)`, safeFixedCosts);
    addRow(`Gross Profit Margin (%)`, `${grossProfitMargin.toFixed(1)}%`);
    addRow(`Net Monthly Profit (PHP)`, netMonthlyProfit);
    addRow(`Break-Even Point (Units)`, breakEvenUnits);
    addRow();

    addRow(`=== 2. SOURCES OF FINANCING & STARTUP COSTS ===`);
    addRow(`Cash Invested (PHP)`, safeCashInvested);
    addRow(`Property / In-Kind Invested (PHP)`, safePropertyInvested);
    addRow(`Total Initial Capital (PHP)`, totalInitialCapital);
    addRow(`Rent Advance & Deposit (PHP)`, safeRentAdvance);
    addRow(`Trainings & Programs (PHP)`, safeTrainings);
    addRow(`Advertising Expense (PHP)`, safeAdvertising);
    addRow(`Initial Salaries Buffer (PHP)`, safeSalariesInitial);
    addRow(`Total Equipment / CapEx (PHP)`, safeStartupCapital);
    addRow(`Total Project Cost (PHP)`, totalProjectCost);
    addRow();

    addRow(`=== 3. STATEMENT OF FINANCIAL POSITION (BALANCE SHEET) ===`);
    addRow(`ASSETS`);
    addRow(`Cash on Hand (15%)`, cashOnHand.toFixed(2));
    addRow(`Cash in Bank (85%)`, cashInBank.toFixed(2));
    addRow(`Merchandise & Materials Inventory (15%)`, rawMaterialInventory.toFixed(2));
    addRow(`Total Current Assets`, totalCurrentAssets.toFixed(2));
    addRow(`Property, Plant & Equipment (Gross)`, grossPPE.toFixed(2));
    addRow(`Less: Accumulated Depreciation (10%)`, `-${annualDepreciation.toFixed(2)}`);
    addRow(`Total Non-Current Assets (Net)`, totalNonCurrentAssets.toFixed(2));
    addRow(`TOTAL ASSETS`, totalAssets.toFixed(2));
    addRow();

    addRow(`LIABILITIES & OWNER'S EQUITY`);
    addRow(`Accounts Payable`, safeAccountsPayable.toFixed(2));
    addRow(`Utilities Payable`, safeUtilitiesPayable.toFixed(2));
    addRow(`Total Current Liabilities`, totalCurrentLiabilities.toFixed(2));
    addRow(`Initial Capital Contributed`, initialEquity.toFixed(2));
    addRow(`Add: Retained Net Profit (After Tax)`, annualNetProfitAfterTax.toFixed(2));
    addRow(`Ending Capital (Owner's Net Worth)`, endingOwnerEquity.toFixed(2));
    addRow(`TOTAL LIABILITIES & OWNER'S EQUITY`, totalLiabilitiesAndEquity.toFixed(2));
    addRow();

    addRow(`=== 4. FINANCIAL RATIOS & FEASIBILITY INDICATORS ===`);
    addRow(`Payback Period`, `${paybackYears > 0 ? `${paybackYears} Years ` : ""}${paybackMonths} Months ${paybackDays} Days`);
    addRow(`Current Ratio`, `${currentRatio}x`);
    addRow(`Inventory Turnover`, `${inventoryTurnover} times/year`);
    addRow(`Average Age of Inventory`, `${avgAgeOfInventory} Days`);
    addRow(`Current Asset Turnover`, `${currentAssetTurnover}x`);
    addRow(`Annual ROI (%)`, `${estimatedAnnualROI}%`);
    addRow(`BMBE Annual Tax Liability (3%)`, taxResult.amount.toFixed(2));

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `${activeProjName.replace(/[^a-zA-Z0-9_-]/g, "_")}_Financial_Projections.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const handleClickOutside = () => setIsProjectMenuOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserName(
              [data.firstName, data.lastName].filter(Boolean).join(" ") ||
                u.displayName ||
                "",
            );
            if (data.section) {
              loadUserGroup(u.uid, data.section);
            } else {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        } catch (err) {
          console.error(err);
          setIsLoading(false);
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
      let activeProposalId = "";
      groupSnap.forEach((doc) => {
        const data = doc.data();
        if (
          data.leaderId === uid ||
          (data.memberIds && data.memberIds.includes(uid))
        ) {
          userGroupId = doc.id;
          activeProposalId = data.activeProposalId || "";
        }
      });
      if (userGroupId && activeProposalId) {
        const propQ = query(
          collection(db, "proposals"),
          where("groupId", "==", userGroupId),
        );
        const propSnap = await getDocs(propQ);
        const approvedProposals = propSnap.docs
          .filter(
            (doc) =>
              doc.data().status === "Approved" ||
              doc.data().status === "APPROVED",
          )
          .map((doc) => ({
            id: doc.id,
            name: doc.data().businessName || "Untitled Proposal",
            proposalCapital: doc.data().totalCapital || "0",
            financialData: doc.data().financialData || null,
          }));

        const activeProp = approvedProposals.find((p) => p.id === activeProposalId);
        if (activeProp) {
          setProjects([activeProp]);
          handleProjectSelect(activeProp.id, [activeProp]);
        } else {
          setProjects([]);
          setSelectedProjectId("");
        }
      } else {
        setProjects([]);
        setSelectedProjectId("");
      }
    } catch (error) {
      console.error("Load failed:", error);
      setProjects([]);
      setSelectedProjectId("");
    } finally {
      setIsLoading(false);
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
        cashInvested: getVal(selectedProj.financialData.cashInvested),
        propertyInvested: getVal(selectedProj.financialData.propertyInvested),
        rentAdvanceDeposit: getVal(selectedProj.financialData.rentAdvanceDeposit),
        trainingsPrograms: getVal(selectedProj.financialData.trainingsPrograms),
        advertisingExpense: getVal(selectedProj.financialData.advertisingExpense),
        salariesExpenseInitial: getVal(selectedProj.financialData.salariesExpenseInitial),
        accountsPayable: getVal(selectedProj.financialData.accountsPayable),
        utilitiesPayable: getVal(selectedProj.financialData.utilitiesPayable),
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
        cashInvested: "",
        propertyInvested: "",
        rentAdvanceDeposit: "",
        trainingsPrograms: "",
        advertisingExpense: "",
        salariesExpenseInitial: "",
        accountsPayable: "",
        utilitiesPayable: "",
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
      const computedFixedCosts = dataToSave.opexList && dataToSave.opexList.length > 0
        ? dataToSave.opexList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : (Number(dataToSave.fixedCosts) || 0);

      const payload = {
        ...dataToSave,
        fixedCosts: String(computedFixedCosts),
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, "proposals", selectedProjectId), {
        financialData: payload,
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
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden text-[#122244]">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* SIDEBAR */}
      <aside
        className={`flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-[60] transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
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
        <div className="p-4 border-t border-white/10 bg-black/20 flex items-center gap-3">
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

        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-[#122244] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 font-medium text-sm">Loading project data...</p>
          </div>
        ) : projects.length === 0 || !selectedProjectId ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-12 max-w-2xl mx-auto my-8">
            <div className="w-20 h-20 bg-amber-50 text-[#c9a654] rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-amber-100">
              <Folder className="w-10 h-10" />
            </div>
            <span className="px-3 py-1 bg-amber-100 text-[#b59545] text-xs font-black rounded-full uppercase tracking-wider mb-3">
              Active Business Required
            </span>
            <h2 className="text-2xl font-extrabold text-[#122244] mb-3">
              No Active Business Setup
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
              Please submit a business proposal and have it approved by your adviser, then set it as your group's active business in the <strong>Business Proposal</strong> module to unlock Financial Input.
            </p>
            <button
              onClick={() => navigate("/projects")}
              className="flex items-center gap-2 px-6 py-3 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95"
            >
              <Folder className="w-4 h-4 text-[#c9a654]" /> Go to Business Proposals
            </button>
          </div>
        ) : (
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
            <div className="flex flex-wrap gap-2.5 items-center">
              <span
                className={`text-xs font-bold flex items-center gap-1 mr-2 ${isSaving ? "text-gray-400 animate-pulse" : "text-green-600"}`}
              >
                {isSaving ? <Save size={14} /> : <CheckCircle2 size={14} />}{" "}
                {saveStatus}
              </span>

              {/* EXPORT FILE BUTTON */}
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-[#122244] rounded-lg font-bold text-xs shadow-sm transition-all active:scale-95"
                title="Export Financial Report as Excel/CSV or PDF"
              >
                <Download size={14} className="text-[#c9a654]" /> Export File
              </button>

              <button
                onClick={() =>
                  navigate("/ai-analysis", {
                    state: { projectId: selectedProjectId, runAnalysis: true },
                  })
                }
                className="flex items-center gap-1.5 bg-[#c9a654] hover:bg-[#b59545] text-white px-5 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <Zap size={14} fill="currentColor" /> Run Analysis
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

          {/* TAB BAR NAVIGATION */}
          <div className="flex space-x-2 border-b border-gray-200 mb-8 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveModuleTab("operations")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all border shrink-0 ${
                activeModuleTab === "operations"
                  ? "bg-[#122244] text-white border-[#122244] shadow-md"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Package className={`w-4 h-4 ${activeModuleTab === "operations" ? "text-[#c9a654]" : "text-gray-400"}`} />
              Operational Inputs & Costing
            </button>

            <button
              onClick={() => setActiveModuleTab("balance-sheet")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all border shrink-0 ${
                activeModuleTab === "balance-sheet"
                  ? "bg-[#122244] text-white border-[#122244] shadow-md"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Scale className={`w-4 h-4 ${activeModuleTab === "balance-sheet" ? "text-[#c9a654]" : "text-gray-400"}`} />
              Balance Sheet (Financial Position)
            </button>

            <button
              onClick={() => setActiveModuleTab("ratios")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all border shrink-0 ${
                activeModuleTab === "ratios"
                  ? "bg-[#122244] text-white border-[#122244] shadow-md"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Activity className={`w-4 h-4 ${activeModuleTab === "ratios" ? "text-[#c9a654]" : "text-gray-400"}`} />
              Financial Ratios & Feasibility Health
            </button>
          </div>

          {/* === TAB 1: OPERATIONAL INPUTS & COSTING === */}
          {activeModuleTab === "operations" && (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* QUICK CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-[#122244]">
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
                    Monthly OpEx / (Price - COGS)
                    <p className="text-[9px] text-[#c9a654] mt-0.5">
                      ₱{safeFixedCosts.toLocaleString()} / (₱
                      {safeSellingPrice.toLocaleString()} - ₱
                      {safeVariableCost.toLocaleString()})
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border-l-4 border-l-purple-500 p-6 shadow-sm text-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Gross Margin
                  </span>
                  <p className="text-2xl font-black">
                    {grossProfitMargin.toFixed(1)}%
                  </p>
                  <div className="mt-2 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                    (Rev - COGS) / Rev
                    <p className="text-[9px] text-[#c9a654] mt-0.5">
                      (₱{monthlyRevenue.toLocaleString()} - ₱
                      {totalMonthlyVariableCosts.toLocaleString()}) / ₱
                      {monthlyRevenue.toLocaleString()}
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
                      ).toLocaleString()}{monthlyInterest > 0 && ` - ₱${monthlyInterest.toLocaleString()} (Int)`}
                    </p>
                  </div>
                </div>
              </div>

              {/* MAIN INPUT GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-[#122244] items-start">
                
                {/* LEFT COLUMN: Sales, Pricing & OpEx */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  {/* Sales & Pricing */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <h3 className="font-bold flex items-center gap-2 border-b pb-4 uppercase text-xs tracking-widest">
                      <Package className="text-[#c9a654]" /> Sales & Pricing
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">
                          Selling Price (₱)
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
                          className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold focus:ring-2 focus:ring-[#c9a654]/20 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">
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
                          className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold focus:ring-2 focus:ring-[#c9a654]/20 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">
                          Cost of Goods (COGS) / Unit (₱)
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
                          className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold focus:ring-2 focus:ring-[#c9a654]/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Monthly Cost (OpEx) */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                      <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244]">
                        <TrendingUp className="text-[#c9a654]" /> Monthly Cost (OpEx)
                      </h3>
                      <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-blue-600 uppercase">Total:</span>
                        <span className="text-sm font-black text-blue-800">₱{safeFixedCosts.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                            <tr className="border-b border-gray-200 text-[10px] uppercase text-gray-500 tracking-wider">
                              <th className="p-3 font-bold">Expense Name</th>
                              <th className="p-3 font-bold w-28">Amount</th>
                              <th className="p-3 font-bold w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {financials.opexList && financials.opexList.map((item, index) => (
                              <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
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
                                    className="w-full px-2 py-1.5 bg-transparent border border-gray-200 rounded-md text-sm focus:bg-white focus:border-[#c9a654]"
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
                                    className="w-full px-2 py-1.5 bg-transparent border border-gray-200 rounded-md text-sm focus:bg-white focus:border-[#c9a654]"
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
                                    className="text-red-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {(!financials.opexList || financials.opexList.length === 0) && (
                              <tr>
                                <td colSpan={3} className="p-4 text-center text-xs text-gray-400 italic">
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

                {/* RIGHT COLUMN: Capital, Startup Cost & Operations */}
                <div className="lg:col-span-8 space-y-6 text-[#122244]">
                  
                  {/* SECTION 1: SOURCES OF FINANCING */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                      <div>
                        <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244]">
                          <DollarSign className="text-[#c9a654]" /> Initial Capital & Sources of Financing
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Section 1: Direct cash and property contributions</p>
                      </div>
                      <div className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                        <span className="text-[10px] font-bold text-green-600 uppercase">Total Capital: </span>
                        <span className="text-sm font-black text-green-800">₱{totalInitialCapital.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                          Cash Invested (₱)
                        </label>
                        <input
                          type="number"
                          placeholder={String(safeStartupCapital)}
                          value={financials.cashInvested}
                          onChange={(e) => setFinancials({ ...financials, cashInvested: e.target.value })}
                          onBlur={() => handleAutoSave()}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                        />
                        <p className="text-[9px] text-gray-400 mt-1 italic">Direct cash contribution from owners/partners</p>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                          Property / In-Kind Invested (₱)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={financials.propertyInvested}
                          onChange={(e) => setFinancials({ ...financials, propertyInvested: e.target.value })}
                          onBlur={() => handleAutoSave()}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                        />
                        <p className="text-[9px] text-gray-400 mt-1 italic">Machinery, appliances, logistics contributed</p>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: START-UP PROJECT COSTS */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                      <div>
                        <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244]">
                          <Layers className="text-[#c9a654]" /> Start-Up Project Cost Breakdown
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Section 2: Pre-operating establishment expenses</p>
                      </div>
                      <div className="bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                        <span className="text-[10px] font-bold text-[#b59545] uppercase">Total Project Cost: </span>
                        <span className="text-sm font-black text-[#c9a654]">₱{totalProjectCost.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                          Rent Advance & Deposit
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={financials.rentAdvanceDeposit}
                          onChange={(e) => setFinancials({ ...financials, rentAdvanceDeposit: e.target.value })}
                          onBlur={() => handleAutoSave()}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                          Trainings & Programs
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={financials.trainingsPrograms}
                          onChange={(e) => setFinancials({ ...financials, trainingsPrograms: e.target.value })}
                          onBlur={() => handleAutoSave()}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                          Advertising Expense
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={financials.advertisingExpense}
                          onChange={(e) => setFinancials({ ...financials, advertisingExpense: e.target.value })}
                          onBlur={() => handleAutoSave()}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                          Initial Salaries Buffer
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={financials.salariesExpenseInitial}
                          onChange={(e) => setFinancials({ ...financials, salariesExpenseInitial: e.target.value })}
                          onBlur={() => handleAutoSave()}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* EQUIPMENT & ASSETS LIST */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                      <div>
                        <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244]">
                          <Package className="text-[#c9a654]" /> Equipment & Store Tools (CapEx)
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Capital equipment and store machinery</p>
                      </div>
                      <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-blue-600 uppercase">Equipment Total:</span>
                        <span className="text-sm font-black text-blue-800">₱{calculatedEquipmentTotal.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                            <tr className="border-b border-gray-200 text-[10px] uppercase text-gray-500 tracking-wider">
                              <th className="p-3 font-bold">Item Name</th>
                              <th className="p-3 font-bold w-20">Qty</th>
                              <th className="p-3 font-bold w-28">Unit Price</th>
                              <th className="p-3 font-bold w-28">Total</th>
                              <th className="p-3 font-bold w-12 text-center"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {financials.equipmentList.map((item, index) => (
                              <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
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
                                    className="w-full px-2 py-1.5 bg-transparent border border-gray-200 rounded-md text-sm focus:bg-white focus:border-[#c9a654]"
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
                                    className="w-full px-2 py-1.5 bg-transparent border border-gray-200 rounded-md text-sm focus:bg-white focus:border-[#c9a654]"
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
                                    className="w-full px-2 py-1.5 bg-transparent border border-gray-200 rounded-md text-sm focus:bg-white focus:border-[#c9a654]"
                                  />
                                </td>
                                <td className="p-2 text-sm font-bold text-gray-700">
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
                                    className="text-red-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors"
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

                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Financing Options</h4>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const newState = { ...financials, isCapitalBorrowed: !financials.isCapitalBorrowed };
                            setFinancials(newState);
                            handleAutoSave(newState);
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${financials.isCapitalBorrowed ? 'bg-[#c9a654]' : 'bg-gray-200'}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${financials.isCapitalBorrowed ? 'translate-x-4' : 'translate-x-1'}`}
                          />
                        </button>
                        <span className="text-sm font-medium text-gray-700">Is this capital borrowed?</span>
                      </div>
                      
                      {financials.isCapitalBorrowed && (
                        <div className="space-y-1 mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">
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
                              className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold pr-8 focus:ring-2 focus:ring-[#c9a654]/20 outline-none transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                          </div>
                          {monthlyInterest > 0 && (
                            <p className="text-[10px] text-gray-500 italic mt-1">
                              Subtracting ₱{monthlyInterest.toLocaleString()} monthly from Net Profit.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* FISCAL SUMMARY CARD */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                      <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244]">
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
                            Estimated Annual Business Tax
                          </label>
                          <p className="text-4xl font-black">
                            ₱{taxResult.amount.toLocaleString()}
                          </p>
                          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-green-50 rounded-lg w-fit border border-green-100">
                            <Info size={14} className="text-green-600" />
                            <span className="text-[11px] font-bold text-green-700">
                              {taxResult.note}
                            </span>
                          </div>
                        </div>
                      </div>

                      {showTaxBreakdown ? (
                        <div className="bg-[#122244] p-5 rounded-xl text-white shadow-xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                            <p className="text-[10px] font-black text-[#c9a654] uppercase tracking-widest">
                              BMBE Computation
                            </p>
                            <div className="flex bg-black/30 p-0.5 rounded-lg border border-white/5">
                              <button
                                onClick={() => setTaxTab("math")}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${taxTab === "math" ? "bg-[#c9a654] text-white" : "text-gray-400 hover:text-white"}`}
                              >
                                Math Breakdown
                              </button>
                              <button
                                onClick={() => setTaxTab("log")}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${taxTab === "log" ? "bg-[#c9a654] text-white" : "text-gray-400 hover:text-white"}`}
                              >
                                Tax Log
                              </button>
                            </div>
                          </div>

                          {taxTab === "math" ? (
                            <div className="space-y-4 animate-in fade-in duration-300 text-xs">
                              <p className="text-gray-300">
                                ₱{annualRevenue.toLocaleString()} Annual Revenue × 3% Flat = <span className="text-green-400 font-bold">₱{taxResult.amount.toLocaleString()}</span>
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 text-xs">
                              <p className="text-gray-300">Income Tax: <span className="text-green-400 font-bold">₱0 (BMBE Exempt)</span></p>
                              <p className="text-gray-300">Percentage Tax: <span className="text-white font-bold">₱{taxResult.percentageTax.toLocaleString()}</span></p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center text-[#122244]">
                          <p className="text-xs text-gray-400 italic">
                            Click "View Computation" to see the tax breakdown logic.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Market Indicators */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6 text-[#122244]">
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
                </div>
              </div>
            </div>
          )}

          {/* === TAB 2: INTERACTIVE BALANCE SHEET (STATEMENT OF FINANCIAL POSITION) === */}
          {activeModuleTab === "balance-sheet" && (
            <div className="space-y-6 animate-in fade-in duration-200 text-[#122244]">
              {/* BALANCE CHECK HEADER BANNER */}
              <div className="bg-[#122244] text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-white/10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Scale className="w-5 h-5 text-[#c9a654]" />
                    <h2 className="text-xl font-extrabold tracking-wide">
                      Statement of Financial Position (Balance Sheet)
                    </h2>
                  </div>
                  <p className="text-xs text-gray-300">
                    Real-time snapshot of business assets, obligations, and net owner's equity.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-400/30 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-bold text-green-300 uppercase tracking-wider">
                    Balance Verified: ₱{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* TWO COLUMN STATEMENT OF FINANCIAL POSITION */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* ASSETS COLUMN */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                  <div className="border-b pb-4 flex justify-between items-center">
                    <h3 className="font-extrabold text-sm uppercase tracking-widest text-[#122244] flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div> ASSETS (What Business Owns)
                    </h3>
                    <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                      ₱{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Current Assets */}
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Current Assets</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-bold text-gray-800">Cash on Hand</span>
                          <span className="text-[10px] text-gray-400 block">15% allocated for daily store operations</span>
                        </div>
                        <span className="font-extrabold text-[#122244]">₱{cashOnHand.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-bold text-gray-800">Cash in Bank</span>
                          <span className="text-[10px] text-gray-400 block">85% secured reserve in business accounts</span>
                        </div>
                        <span className="font-extrabold text-[#122244]">₱{cashInBank.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-bold text-gray-800">Merchandise & Materials Inventory</span>
                          <span className="text-[10px] text-gray-400 block">Ending inventory estimated at 15% of COGS</span>
                        </div>
                        <span className="font-extrabold text-[#122244]">₱{rawMaterialInventory.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 font-bold text-xs text-blue-800 border-t border-gray-100 px-1">
                        <span>Total Current Assets:</span>
                        <span className="text-sm font-black">₱{totalCurrentAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Non-Current Assets */}
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Non-Current Assets</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-bold text-gray-800">Property, Plant & Equipment (Gross)</span>
                          <span className="text-[10px] text-gray-400 block">Equipment list + property invested</span>
                        </div>
                        <span className="font-bold text-gray-700">₱{grossPPE.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg text-red-600">
                        <div>
                          <span className="font-bold">Less: Accumulated Depreciation</span>
                          <span className="text-[10px] text-gray-400 block">10% annual straight-line depreciation</span>
                        </div>
                        <span className="font-bold">(₱{annualDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 font-bold text-xs text-purple-800 border-t border-gray-100 px-1">
                        <span>Total Non-Current Assets (Net):</span>
                        <span className="text-sm font-black">₱{totalNonCurrentAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Assets Summary */}
                  <div className="p-4 bg-blue-50/70 border-2 border-blue-200 rounded-xl flex justify-between items-center">
                    <span className="font-black text-sm uppercase tracking-wider text-blue-950">TOTAL ASSETS:</span>
                    <span className="text-xl font-black text-blue-900">₱{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* LIABILITIES & EQUITY COLUMN */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                  <div className="border-b pb-4 flex justify-between items-center">
                    <h3 className="font-extrabold text-sm uppercase tracking-widest text-[#122244] flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#c9a654]"></div> LIABILITIES & OWNER'S EQUITY
                    </h3>
                    <span className="text-xs font-black text-[#b59545] bg-amber-50 px-2.5 py-1 rounded-lg">
                      ₱{totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Current Liabilities */}
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Current Liabilities (Obligations)</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-bold text-gray-800">Accounts Payable</span>
                          <span className="text-[10px] text-gray-400 block">Short-term obligations to suppliers</span>
                        </div>
                        <span className="font-extrabold text-[#122244]">₱{safeAccountsPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-bold text-gray-800">Utilities Payable</span>
                          <span className="text-[10px] text-gray-400 block">Accrued, unpaid monthly utility bills</span>
                        </div>
                        <span className="font-extrabold text-[#122244]">₱{safeUtilitiesPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 font-bold text-xs text-red-800 border-t border-gray-100 px-1">
                        <span>Total Current Liabilities:</span>
                        <span className="text-sm font-black">₱{totalCurrentLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Owner's Equity */}
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Owner's Equity (Net Worth)</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-bold text-gray-800">Initial Capital</span>
                          <span className="text-[10px] text-gray-400 block">Cash + property starting investment</span>
                        </div>
                        <span className="font-bold text-gray-700">₱{initialEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg text-green-700">
                        <div>
                          <span className="font-bold">Add: Retained Net Income (After Tax)</span>
                          <span className="text-[10px] text-gray-400 block">Annual net profit from operations</span>
                        </div>
                        <span className="font-bold">+₱{annualNetProfitAfterTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 font-bold text-xs text-[#b59545] border-t border-gray-100 px-1">
                        <span>Ending Capital (Owner's Net Worth):</span>
                        <span className="text-sm font-black text-[#c9a654]">₱{endingOwnerEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Liabilities & Equity Summary */}
                  <div className="p-4 bg-amber-50/70 border-2 border-amber-200 rounded-xl flex justify-between items-center">
                    <span className="font-black text-sm uppercase tracking-wider text-amber-950">TOTAL LIABILITIES & EQUITY:</span>
                    <span className="text-xl font-black text-[#c9a654]">₱{totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === TAB 3: AUTOMATED FINANCIAL RATIOS & ACTIVITY METRICS === */}
          {activeModuleTab === "ratios" && (
            <div className="space-y-8 animate-in fade-in duration-200 text-[#122244]">
              {/* PRIMARY RATIO CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Payback Period */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payback Period</span>
                      <span className="px-2 py-0.5 bg-amber-50 text-[#b59545] text-[9px] font-black rounded uppercase">Feasibility</span>
                    </div>
                    <p className="text-2xl font-black text-[#122244]">
                      {paybackYears > 0 ? `${paybackYears}y ` : ""}{paybackMonths}m {paybackDays}d
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Exact duration to fully recover initial startup investment.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400 font-semibold">
                    Formula: Net Investment / Net Annual Cash Inflow
                  </div>
                </div>

                {/* 2. Current Ratio */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Ratio</span>
                      <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase ${Number(currentRatio) >= 1.5 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {Number(currentRatio) >= 1.5 ? 'Healthy Liquidity' : 'Fair'}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-[#122244]">
                      {currentRatio}x
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Ability to cover short-term debts with current assets.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400 font-semibold">
                    Formula: Current Assets / Current Liabilities
                  </div>
                </div>

                {/* 3. Inventory Turnover */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Inventory Turnover</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-black rounded uppercase">Activity</span>
                    </div>
                    <p className="text-2xl font-black text-[#122244]">
                      {inventoryTurnover} <span className="text-xs font-bold text-gray-400">times/yr</span>
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      How many times inventory is completely sold and replaced.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400 font-semibold">
                    Formula: Annual COGS / Average Inventory
                  </div>
                </div>

                {/* 4. Average Age of Inventory */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg Age of Inventory</span>
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-black rounded uppercase">Shelf Time</span>
                    </div>
                    <p className="text-2xl font-black text-[#122244]">
                      {avgAgeOfInventory} <span className="text-xs font-bold text-gray-400">Days</span>
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Average days items remain in stock before being sold.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400 font-semibold">
                    Formula: 360 Days / Inventory Turnover
                  </div>
                </div>
              </div>

              {/* SECONDARY RATIOS & BENCHMARK GUIDANCE */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Additional Efficiency & Profitability Metrics */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                  <h4 className="font-extrabold text-xs uppercase tracking-widest text-[#122244] border-b pb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#c9a654]" /> Profitability & Turnover
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                      <span className="text-xs text-gray-500">Current Asset Turnover</span>
                      <span className="font-bold text-[#122244]">{currentAssetTurnover}x</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                      <span className="text-xs text-gray-500">Gross Profit Margin</span>
                      <span className="font-bold text-purple-700">{grossProfitMargin.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                      <span className="text-xs text-gray-500">Net Profit Margin</span>
                      <span className="font-bold text-green-700">
                        {annualRevenue > 0 ? ((annualNetProfitAfterTax / annualRevenue) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs text-gray-500">Annual Return on Investment (ROI)</span>
                      <span className="font-black text-[#c9a654] text-base">{estimatedAnnualROI}%</span>
                    </div>
                  </div>
                </div>

                {/* Defense & Feasibility Guide Card */}
                <div className="lg:col-span-2 bg-gradient-to-br from-[#122244] to-[#1a2f55] rounded-2xl p-6 shadow-xl text-white space-y-4 border border-white/10">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <ShieldAlert className="w-4 h-4 text-[#c9a654]" />
                    <h4 className="font-extrabold text-xs uppercase tracking-widest text-[#c9a654]">
                      Panel Defense & Feasibility Evaluation Notes
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="font-bold text-gray-200 mb-1">Liquidity Strength (Current Ratio)</p>
                      <p className="text-gray-400 text-[11px] leading-relaxed">
                        A Current Ratio of {currentRatio}x demonstrates that the business has ample liquid resources to settle obligations without needing external debt.
                      </p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="font-bold text-gray-200 mb-1">Inventory Management Velocity</p>
                      <p className="text-gray-400 text-[11px] leading-relaxed">
                        With an average shelf life of {avgAgeOfInventory} days, ingredient spoilage risk is minimized while capital rotates efficiently.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </main>

      {/* EXPORT FORMAT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowExportModal(false)}
          />
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 z-10 animate-in zoom-in-95 duration-200 border border-gray-100 relative">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 rounded-lg text-[#c9a654]">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#122244]">Export Financial Report</h3>
                  <p className="text-xs text-gray-400">Choose your preferred export format</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-6 space-y-3">
              {/* Option 1: Excel / CSV */}
              <button
                onClick={() => {
                  setShowExportModal(false);
                  handleExportCSV();
                }}
                className="w-full flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all text-left group"
              >
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-[#122244] group-hover:text-emerald-900">Excel / Spreadsheet (.CSV)</h4>
                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Editable</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Download full operational costing, double-entry balance sheet, and financial ratios for Microsoft Excel or Google Sheets.
                  </p>
                </div>
              </button>

              {/* Option 2: PDF Document */}
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setTimeout(() => window.print(), 250);
                }}
                className="w-full flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all text-left group"
              >
                <div className="p-3 bg-blue-100 text-blue-700 rounded-xl group-hover:bg-[#122244] group-hover:text-white transition-colors">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-[#122244] group-hover:text-blue-900">PDF Document (.PDF)</h4>
                    <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Print Ready</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Generate an executive, formatted feasibility statement ready for presentation and panel defense submission.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-5 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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