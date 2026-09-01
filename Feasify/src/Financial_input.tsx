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
  Lock,
  Unlock,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import {
  normalizeProposalProducts,
  computeProductMetrics,
} from "./Projects";
import type {
  ProductCostingItem,
  IngredientItem,
} from "./Projects";

export interface MonthlyFinancialRecord {
  month: number;
  monthName?: string;
  isLocked: boolean;
  lockedAt?: string;
  financials: {
    products: ProductCostingItem[];
    sellingPrice: string;
    monthlySales: string;
    variableCost: string;
    fixedCosts: string;
    startupCapital: string;
    cashInvested: string;
    rentAdvanceDeposit: string;
    trainingsPrograms: string;
    advertisingExpense: string;
    salariesExpenseInitial: string;
    accountsPayable: string;
    utilitiesPayable: string;
    competitorCount: number;
    marketDemand: string;
    operatingDays: string;
    equipmentList: { id: string; name: string; quantity: number; unitPrice: number; total: number }[];
    opexList: { id: string; name: string; amount: number }[];
    isCapitalBorrowed: boolean;
    interestRate: string;
  };
}

const getOrdinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

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
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);
  const [taxTab, setTaxTab] = useState<"log" | "math">("math");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [activeModuleTab, setActiveModuleTab] = useState<"operations" | "balance-sheet">("operations");

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("All changes saved");

  // Multi-Month Financial State
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyFinancialRecord[]>([
    {
      month: 1,
      monthName: "Month 1 (1st Month)",
      isLocked: false,
      financials: {
        products: [] as ProductCostingItem[],
        sellingPrice: "",
        monthlySales: "",
        variableCost: "",
        fixedCosts: "",
        startupCapital: "",
        cashInvested: "",
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
      },
    },
  ]);
  const [activeMonthIndex, setActiveMonthIndex] = useState(0);

  const [financials, setFinancials] = useState({
    products: [] as ProductCostingItem[],
    sellingPrice: "",
    monthlySales: "",
    variableCost: "",
    fixedCosts: "",
    startupCapital: "",
    cashInvested: "",
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

  const isCurrentMonthLocked = monthlyRecords[activeMonthIndex]?.isLocked || false;
  const currentMonthRecord = monthlyRecords[activeMonthIndex];
  const currentMonthNumber = currentMonthRecord?.month || (activeMonthIndex + 1);

  const activeProjName = projects.find((p) => p.id === selectedProjectId)?.name || "Active Business Projections";

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

  // --- PRODUCT COSTING & NORMALIZATION ---
  const normalizedProducts = normalizeProposalProducts({
    products: financials.products,
    sellingPrice: financials.sellingPrice,
    monthlySales: financials.monthlySales,
    variableCost: financials.variableCost,
  }, activeProjName);

  const handleAddProduct = () => {
    if (isCurrentMonthLocked) return;
    const newProduct: ProductCostingItem = {
      id: "prod-" + Date.now(),
      name: "",
      quantityYield: "",
      ingredients: [],
      markupPercentage: "100",
      sellingPrice: "",
    };
    const updatedProducts = [...normalizedProducts, newProduct];
    const newState = { ...financials, products: updatedProducts };
    setFinancials(newState);
    const updatedRecords = [...monthlyRecords];
    if (updatedRecords[activeMonthIndex]) {
      updatedRecords[activeMonthIndex] = {
        ...updatedRecords[activeMonthIndex],
        financials: newState,
      };
      setMonthlyRecords(updatedRecords);
    }
    handleAutoSave(newState, updatedRecords);
  };

  const handleRemoveProduct = (index: number) => {
    if (isCurrentMonthLocked || normalizedProducts.length <= 1) return;
    const updatedProducts = normalizedProducts.filter((_, i) => i !== index);
    const newState = { ...financials, products: updatedProducts };
    setFinancials(newState);
    const updatedRecords = [...monthlyRecords];
    if (updatedRecords[activeMonthIndex]) {
      updatedRecords[activeMonthIndex] = {
        ...updatedRecords[activeMonthIndex],
        financials: newState,
      };
      setMonthlyRecords(updatedRecords);
    }
    handleAutoSave(newState, updatedRecords);
  };

  const handleUpdateProduct = (index: number, updates: Partial<ProductCostingItem>) => {
    if (isCurrentMonthLocked) return;
    const updatedProducts = [...normalizedProducts];
    updatedProducts[index] = { ...updatedProducts[index], ...updates };
    const newState = { ...financials, products: updatedProducts };
    setFinancials(newState);
    const updatedRecords = [...monthlyRecords];
    if (updatedRecords[activeMonthIndex]) {
      updatedRecords[activeMonthIndex] = {
        ...updatedRecords[activeMonthIndex],
        financials: newState,
      };
      setMonthlyRecords(updatedRecords);
    }
    handleAutoSave(newState, updatedRecords);
  };

  const handleAddIngredient = (productIndex: number) => {
    if (isCurrentMonthLocked) return;
    const updatedProducts = [...normalizedProducts];
    const currentProd = updatedProducts[productIndex];
    const newIng: IngredientItem = {
      id: "ing-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: "",
      price: "",
    };
    updatedProducts[productIndex] = {
      ...currentProd,
      ingredients: [...(currentProd.ingredients || []), newIng],
    };
    const newState = { ...financials, products: updatedProducts };
    setFinancials(newState);
    const updatedRecords = [...monthlyRecords];
    if (updatedRecords[activeMonthIndex]) {
      updatedRecords[activeMonthIndex] = {
        ...updatedRecords[activeMonthIndex],
        financials: newState,
      };
      setMonthlyRecords(updatedRecords);
    }
    handleAutoSave(newState, updatedRecords);
  };

  const handleUpdateIngredient = (productIndex: number, ingredientIndex: number, updates: Partial<IngredientItem>) => {
    if (isCurrentMonthLocked) return;
    const updatedProducts = [...normalizedProducts];
    const currentProd = updatedProducts[productIndex];
    const ings = [...(currentProd.ingredients || [])];
    ings[ingredientIndex] = { ...ings[ingredientIndex], ...updates };
    updatedProducts[productIndex] = {
      ...currentProd,
      ingredients: ings,
    };
    const newState = { ...financials, products: updatedProducts };
    setFinancials(newState);
    const updatedRecords = [...monthlyRecords];
    if (updatedRecords[activeMonthIndex]) {
      updatedRecords[activeMonthIndex] = {
        ...updatedRecords[activeMonthIndex],
        financials: newState,
      };
      setMonthlyRecords(updatedRecords);
    }
    handleAutoSave(newState, updatedRecords);
  };

  const handleRemoveIngredient = (productIndex: number, ingredientIndex: number) => {
    if (isCurrentMonthLocked) return;
    const updatedProducts = [...normalizedProducts];
    const currentProd = updatedProducts[productIndex];
    const ings = (currentProd.ingredients || []).filter((_, i) => i !== ingredientIndex);
    updatedProducts[productIndex] = {
      ...currentProd,
      ingredients: ings,
    };
    const newState = { ...financials, products: updatedProducts };
    setFinancials(newState);
    const updatedRecords = [...monthlyRecords];
    if (updatedRecords[activeMonthIndex]) {
      updatedRecords[activeMonthIndex] = {
        ...updatedRecords[activeMonthIndex],
        financials: newState,
      };
      setMonthlyRecords(updatedRecords);
    }
    handleAutoSave(newState, updatedRecords);
  };

  // --- CALCULATION ENGINE ---
  const firstProd = normalizedProducts[0] || {
    id: "prod-1",
    name: "",
    quantityYield: financials.monthlySales || "",
    ingredients: [],
    markupPercentage: "100",
    sellingPrice: financials.sellingPrice || "",
  };
  const firstMetrics = computeProductMetrics(firstProd);

  // Multi-product aggregate metrics
  const totalMultiRevenue = normalizedProducts.reduce((sum, p) => {
    const m = computeProductMetrics(p);
    return sum + m.revenue;
  }, 0);
  const totalMultiVariableCost = normalizedProducts.reduce((sum, p) => {
    const m = computeProductMetrics(p);
    return sum + (m.unitCost * m.batchYield);
  }, 0);
  const totalMultiYield = normalizedProducts.reduce((sum, p) => {
    const m = computeProductMetrics(p);
    return sum + m.batchYield;
  }, 0);

  const safeSellingPrice = normalizedProducts.length > 1 && totalMultiYield > 0
    ? totalMultiRevenue / totalMultiYield
    : (firstMetrics.sellingPrice > 0 ? firstMetrics.sellingPrice : (Number(financials.sellingPrice) || 0));

  const safeMonthlySales = normalizedProducts.length > 1
    ? totalMultiYield
    : (firstMetrics.batchYield > 0 ? firstMetrics.batchYield : (Number(financials.monthlySales) || 0));

  const safeVariableCost = normalizedProducts.length > 1 && totalMultiYield > 0
    ? totalMultiVariableCost / totalMultiYield
    : (firstMetrics.unitCost > 0 ? firstMetrics.unitCost : (Number(financials.variableCost) || 0));

  const calculatedOpex = financials.opexList && financials.opexList.length > 0
    ? financials.opexList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : (Number(financials.fixedCosts) || 0);
  const safeFixedCosts = calculatedOpex;

  const calculatedEquipmentTotal = financials.equipmentList && financials.equipmentList.length > 0
    ? financials.equipmentList.reduce((sum, item) => sum + item.total, 0)
    : (Number(financials.startupCapital) || 0);
  const safeStartupCapital = calculatedEquipmentTotal;

  const safeOperatingDays = Number(financials.operatingDays) || 300;

  const monthlyRevenue = normalizedProducts.length > 1 ? totalMultiRevenue : (safeSellingPrice * safeMonthlySales);
  const totalMonthlyVariableCosts = normalizedProducts.length > 1 ? totalMultiVariableCost : (safeVariableCost * safeMonthlySales);
  const grossProfitMargin = monthlyRevenue > 0 ? ((monthlyRevenue - totalMonthlyVariableCosts) / monthlyRevenue) * 100 : 0;

  const monthlyInterest = financials.isCapitalBorrowed ? (safeStartupCapital * (Number(financials.interestRate) / 100)) / 12 : 0;

  const netMonthlyProfit =
    monthlyRevenue - totalMonthlyVariableCosts - safeFixedCosts - monthlyInterest;

  const annualRevenue = (monthlyRevenue / 30) * safeOperatingDays;
  const annualExpenses =
    ((totalMonthlyVariableCosts + safeFixedCosts + monthlyInterest) / 30) * safeOperatingDays;
  const annualNetProfitPreTax = annualRevenue - annualExpenses;

  const taxResult = calculateBMBETax(annualRevenue > 0 ? annualRevenue : 0);
  const annualTax = taxResult.amount;
  const annualNetProfitAfterTax =
    (annualNetProfitPreTax > 0 ? annualNetProfitPreTax : 0) - annualTax;

  const paybackVal =
    annualNetProfitAfterTax > 0
      ? (safeStartupCapital / (annualNetProfitAfterTax / 12)).toFixed(1)
      : "∞";
  const estimatedAnnualROI =
    safeStartupCapital > 0
      ? ((annualNetProfitAfterTax / safeStartupCapital) * 100).toFixed(1)
      : "0.0";
  const unitContributionMargin = safeSellingPrice - safeVariableCost;
  const breakEvenUnits =
    unitContributionMargin > 0
      ? Math.ceil(safeFixedCosts / unitContributionMargin)
      : "N/A";
  const breakEvenRevenue =
    typeof breakEvenUnits === "number" && safeSellingPrice > 0
      ? breakEvenUnits * safeSellingPrice
      : (grossProfitMargin > 0 ? safeFixedCosts / (grossProfitMargin / 100) : 0);

  // --- BALANCE SHEET ENGINE (feasify_financial_input_module.md) ---
  // Section 1: Initial Capital & Sources of Financing
  const safeCashInvested = Number(financials.cashInvested) || (safeStartupCapital > 0 ? safeStartupCapital : 0);
  const totalInitialCapital = safeCashInvested;

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
  const grossPPE = safeStartupCapital;
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
    const dateStr = new Date().toLocaleDateString();

    const csvRows: string[] = [];
    const addRow = (col1 = "", col2: string | number = "", col3: string | number = "", col4: string | number = "") => {
      const escape = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;
      csvRows.push([escape(col1), escape(col2), escape(col3), escape(col4)].join(","));
    };

    addRow(`FEASIFY FINANCIAL PROJECTIONS & FEASIBILITY REPORT`);
    addRow(`Business Name:`, activeProjName);
    addRow(`Financial Period:`, currentMonthRecord?.monthName || `Month ${currentMonthNumber}`);
    addRow(`Status:`, isCurrentMonthLocked ? `Finalized & Locked (${currentMonthRecord?.lockedAt ? new Date(currentMonthRecord.lockedAt).toLocaleDateString() : 'Locked'})` : `Active / Editable`);
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
    link.setAttribute("download", `${activeProjName.replace(/[^a-zA-Z0-9_-]/g, "_")}_Month_${currentMonthNumber}_Financial_Projections.csv`);
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
          .map((doc) => {
            const data = doc.data();
            if (!data.originalProposalFinancials && data.financialData) {
              updateDoc(doc.ref, {
                originalProposalFinancials: data.financialData
              }).catch(console.error);
            }
            return {
              id: doc.id,
              name: data.businessName || "Untitled Proposal",
              proposalCapital: data.totalCapital || "0",
              financialData: data.financialData || null,
            };
          });

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

    const getVal = (val: any) => {
      if (val === undefined || val === null || String(val) === "0") return "";
      return String(val);
    };

    if (selectedProj.financialData) {
      const finData = selectedProj.financialData;

      // Check if multi-month records already exist
      if (finData.monthlyRecords && Array.isArray(finData.monthlyRecords) && finData.monthlyRecords.length > 0) {
        const loadedRecords: MonthlyFinancialRecord[] = finData.monthlyRecords.map((rec: any, idx: number) => {
          const fin = rec.financials || {};
          let loadedOpex = fin.opexList || [];
          if (loadedOpex.length === 0 && fin.fixedCosts && Number(fin.fixedCosts) > 0) {
            loadedOpex = [{
              id: Date.now().toString() + "-" + idx,
              name: "General OpEx",
              amount: Number(fin.fixedCosts)
            }];
          }
          const loadedProducts = normalizeProposalProducts(fin, selectedProj.name);

          return {
            month: rec.month || (idx + 1),
            monthName: rec.monthName || `Month ${rec.month || idx + 1} (${getOrdinal(rec.month || idx + 1)} Month)`,
            isLocked: !!rec.isLocked,
            lockedAt: rec.lockedAt,
            financials: {
              products: loadedProducts,
              sellingPrice: getVal(fin.sellingPrice),
              monthlySales: getVal(fin.monthlySales),
              variableCost: getVal(fin.variableCost),
              fixedCosts: getVal(fin.fixedCosts),
              startupCapital: getVal(fin.startupCapital || selectedProj.proposalCapital),
              cashInvested: getVal(fin.cashInvested),
              rentAdvanceDeposit: getVal(fin.rentAdvanceDeposit),
              trainingsPrograms: getVal(fin.trainingsPrograms),
              advertisingExpense: getVal(fin.advertisingExpense),
              salariesExpenseInitial: getVal(fin.salariesExpenseInitial),
              accountsPayable: getVal(fin.accountsPayable),
              utilitiesPayable: getVal(fin.utilitiesPayable),
              competitorCount: fin.competitorCount || 0,
              marketDemand: fin.marketDemand || "Medium",
              operatingDays: String(fin.operatingDays || "300"),
              equipmentList: fin.equipmentList || [],
              opexList: loadedOpex,
              isCapitalBorrowed: fin.isCapitalBorrowed || false,
              interestRate: getVal(fin.interestRate),
            },
          };
        });

        setMonthlyRecords(loadedRecords);
        // Default to the last month (the active editable month or latest added)
        const targetIdx = Math.max(0, loadedRecords.length - 1);
        setActiveMonthIndex(targetIdx);
        setFinancials(loadedRecords[targetIdx].financials);
      } else {
        // Single-month legacy migration: Create Month 1 from existing financialData
        let loadedOpex = finData.opexList || [];
        if (loadedOpex.length === 0 && finData.fixedCosts && Number(finData.fixedCosts) > 0) {
          loadedOpex = [{
            id: Date.now().toString(),
            name: "General OpEx",
            amount: Number(finData.fixedCosts)
          }];
        }
        const loadedProducts = normalizeProposalProducts(finData, selectedProj.name);

        const initialFinState = {
          products: loadedProducts,
          sellingPrice: getVal(finData.sellingPrice),
          monthlySales: getVal(finData.monthlySales),
          variableCost: getVal(finData.variableCost),
          fixedCosts: getVal(finData.fixedCosts),
          startupCapital: getVal(finData.startupCapital || selectedProj.proposalCapital),
          cashInvested: getVal(finData.cashInvested),
          rentAdvanceDeposit: getVal(finData.rentAdvanceDeposit),
          trainingsPrograms: getVal(finData.trainingsPrograms),
          advertisingExpense: getVal(finData.advertisingExpense),
          salariesExpenseInitial: getVal(finData.salariesExpenseInitial),
          accountsPayable: getVal(finData.accountsPayable),
          utilitiesPayable: getVal(finData.utilitiesPayable),
          competitorCount: finData.competitorCount || 0,
          marketDemand: finData.marketDemand || "Medium",
          operatingDays: String(finData.operatingDays || "300"),
          equipmentList: finData.equipmentList || [],
          opexList: loadedOpex,
          isCapitalBorrowed: finData.isCapitalBorrowed || false,
          interestRate: getVal(finData.interestRate),
        };

        const initialRecords: MonthlyFinancialRecord[] = [
          {
            month: 1,
            monthName: "Month 1 (1st Month)",
            isLocked: false,
            financials: initialFinState,
          },
        ];

        setMonthlyRecords(initialRecords);
        setActiveMonthIndex(0);
        setFinancials(initialFinState);
      }
    } else {
      const initialFinState = {
        products: normalizeProposalProducts(undefined, selectedProj.name),
        sellingPrice: "",
        monthlySales: "",
        variableCost: "",
        fixedCosts: "",
        startupCapital: getVal(selectedProj.proposalCapital),
        cashInvested: "",
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
      };

      const initialRecords: MonthlyFinancialRecord[] = [
        {
          month: 1,
          monthName: "Month 1 (1st Month)",
          isLocked: false,
          financials: initialFinState,
        },
      ];

      setMonthlyRecords(initialRecords);
      setActiveMonthIndex(0);
      setFinancials(initialFinState);
    }
  };

  const handleAutoSave = async (dataToSave = financials, recordsToSave = monthlyRecords) => {
    if (!selectedProjectId) return;
    setIsSaving(true);
    try {
      const computedFixedCosts = dataToSave.opexList && dataToSave.opexList.length > 0
        ? dataToSave.opexList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : (Number(dataToSave.fixedCosts) || 0);

      const prods = dataToSave.products && dataToSave.products.length > 0
        ? dataToSave.products
        : normalizeProposalProducts(dataToSave, activeProjName);

      let syncSellingPrice = dataToSave.sellingPrice;
      let syncMonthlySales = dataToSave.monthlySales;
      let syncVariableCost = dataToSave.variableCost;
      let syncProductionCost = "";
      let syncMarkupPct = "";
      let syncMarkupAmt = "";
      let syncComputedBasePrice = "";

      if (prods.length > 0) {
        const firstP = prods[0];
        const firstM = computeProductMetrics(firstP);
        syncSellingPrice = String(firstP.sellingPrice || (firstM.computedBasePrice > 0 ? Number(firstM.computedBasePrice.toFixed(2)) : ""));
        syncMonthlySales = String(firstP.quantityYield || "");
        syncVariableCost = firstM.unitCost > 0 ? String(Number(firstM.unitCost.toFixed(2))) : "";
        syncProductionCost = String(firstM.totalBatchCost);
        syncMarkupPct = String(firstP.markupPercentage || "100");
        syncMarkupAmt = firstM.markupAmount > 0 ? String(Number(firstM.markupAmount.toFixed(2))) : "";
        syncComputedBasePrice = firstM.computedBasePrice > 0 ? String(Number(firstM.computedBasePrice.toFixed(2))) : "";
      }

      // Sync active month's financials in monthlyRecords
      const cleanRecords = recordsToSave.map((rec, idx) => {
        if (idx === activeMonthIndex) {
          return {
            ...rec,
            financials: dataToSave,
          };
        }
        return rec;
      });

      const payload = {
        ...dataToSave,
        products: prods,
        sellingPrice: syncSellingPrice,
        monthlySales: syncMonthlySales,
        variableCost: syncVariableCost,
        productionCost: syncProductionCost,
        quantityYield: syncMonthlySales,
        unitCost: syncVariableCost,
        markupPercentage: syncMarkupPct,
        markupAmount: syncMarkupAmt,
        computedSellingPrice: syncComputedBasePrice,
        fixedCosts: String(computedFixedCosts),
        monthlyRecords: cleanRecords,
        activeMonthIndex: activeMonthIndex,
        totalMonths: cleanRecords.length,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, "proposals", selectedProjectId), {
        financialData: payload,
      });
      setSaveStatus("All changes saved");
    } catch (e) {
      console.error("Save failed:", e);
      setSaveStatus("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchMonthTab = (targetIndex: number) => {
    if (targetIndex === activeMonthIndex || !monthlyRecords[targetIndex]) return;

    // Sync current unsaved changes into current record before switching
    const updatedRecords = [...monthlyRecords];
    if (updatedRecords[activeMonthIndex]) {
      updatedRecords[activeMonthIndex] = {
        ...updatedRecords[activeMonthIndex],
        financials: financials,
      };
    }
    setMonthlyRecords(updatedRecords);
    setActiveMonthIndex(targetIndex);
    setFinancials(updatedRecords[targetIndex].financials);
  };

  const handleConfirmLockAndProceed = async () => {
    if (isCurrentMonthLocked) return;

    const currentRec = monthlyRecords[activeMonthIndex] || {
      month: activeMonthIndex + 1,
      monthName: `Month ${activeMonthIndex + 1}`,
      isLocked: false,
      financials: financials,
    };

    const lockedRecord: MonthlyFinancialRecord = {
      ...currentRec,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      financials: JSON.parse(JSON.stringify(financials)),
    };

    const nextMonthNum = monthlyRecords.length + 1;
    // Deep clone current month's financials to serve as the baseline for the next month
    const clonedFinancials = JSON.parse(JSON.stringify(financials));

    const nextRecord: MonthlyFinancialRecord = {
      month: nextMonthNum,
      monthName: `Month ${nextMonthNum} (${getOrdinal(nextMonthNum)} Month)`,
      isLocked: false,
      financials: clonedFinancials,
    };

    const updatedRecords = [
      ...monthlyRecords.slice(0, activeMonthIndex),
      lockedRecord,
      ...monthlyRecords.slice(activeMonthIndex + 1),
      nextRecord,
    ];

    const nextActiveIndex = updatedRecords.length - 1;
    setMonthlyRecords(updatedRecords);
    setActiveMonthIndex(nextActiveIndex);
    setFinancials(clonedFinancials);
    setShowLockConfirmModal(false);

    await handleAutoSave(clonedFinancials, updatedRecords);
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
    } catch (e) { }
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
    <>
      <div className="flex min-h-screen bg-gray-50/50 overflow-hidden text-[#122244] print:hidden">
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
          <nav className="flex-1 p-4 space-y-4 mt-2">
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

            <div className="pt-4 border-t border-white/10 space-y-1">
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
              {/* BUSINESS WORKSPACE HERO BANNER */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#122244] text-[#c9a654] rounded-2xl flex items-center justify-center font-extrabold text-2xl shadow-inner border border-gray-100 flex-shrink-0">
                    {getInitials(activeProjName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-extrabold rounded-md uppercase tracking-wider border border-green-200 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-green-600" /> Active Business Workspace
                      </span>
                      <span className="text-xs text-gray-400 font-medium">•</span>
                      <span className="text-xs text-gray-500 font-bold">
                        Initial Capital: <span className="text-green-700 font-extrabold">₱{Number(projects.find(p => p.id === selectedProjectId)?.proposalCapital || 0).toLocaleString()}</span>
                      </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#122244] tracking-tight">
                      {activeProjName}
                    </h1>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      Live operational financial inputs & dynamic statement simulations
                    </p>
                  </div>
                </div>

                {/* ACTION BUTTONS & AUTOSAVE STATUS */}
                <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto justify-end pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
                  <span
                    className={`text-xs font-bold flex items-center gap-1.5 mr-2 ${isSaving ? "text-amber-600 animate-pulse" : "text-green-600"}`}
                  >
                    {isSaving ? <Save size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {saveStatus}
                  </span>

                  {/* EXPORT FILE BUTTON */}
                  <button
                    type="button"
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-[#122244] rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95"
                    title="Export Financial Report as Excel/CSV or PDF"
                  >
                    <Download size={14} className="text-[#c9a654]" /> Export File
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/ai-analysis", {
                        state: { projectId: selectedProjectId, runAnalysis: true },
                      })
                    }
                    className="flex items-center gap-1.5 bg-[#c9a654] hover:bg-[#b59545] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    <Zap size={14} fill="currentColor" /> Run Analysis
                  </button>
                </div>
              </div>

              {/* FILE FOLDER TAB SYSTEM */}
              <div className="mb-6">
                {/* File Tabs Top Rail */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b-2 border-slate-200 px-3 pt-3 bg-slate-100/70 rounded-t-2xl">
                  {/* File Tabs Strip - Compact Staggered Overlapping Tabs */}
                  <div
                    className="flex items-end overflow-x-auto overflow-y-hidden pb-0 max-w-full pl-1 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 mr-2 uppercase tracking-wider pb-3 shrink-0">
                      <Folder size={14} className="text-[#c9a654]" />
                      <span>Periods:</span>
                    </div>

                    <div className="flex items-end shrink-0 pl-1">
                      {monthlyRecords.map((rec, idx) => {
                        const isSelected = idx === activeMonthIndex;
                        const isLocked = rec.isLocked;
                        // Dynamic stacking z-index so the active tab is in front, and surrounding tabs tuck neatly behind
                        const tabZIndex = isSelected ? 30 : idx < activeMonthIndex ? 10 + idx : 25 - idx;

                        return (
                          <button
                            key={`month-tab-${rec.month || idx + 1}`}
                            type="button"
                            onClick={() => handleSwitchMonthTab(idx)}
                            style={{ zIndex: tabZIndex }}
                            className={`group relative flex items-center gap-2 px-4 sm:px-5 pt-2.5 pb-3 rounded-t-2xl text-xs font-bold transition-colors shrink-0 select-none border-t-[3px] border-x -mb-[2px] ${
                              idx > 0 ? "-ml-6 sm:-ml-8" : ""
                            } ${
                              isSelected
                                ? "bg-white text-[#122244] border-t-[#c9a654] border-x-slate-300 shadow-[-5px_0_12px_rgba(0,0,0,0.1),5px_0_12px_rgba(0,0,0,0.06)]"
                                : "bg-[#dbe3ed] hover:bg-[#cfd9e6] text-slate-700 border-t-slate-300 border-x-slate-300/90 shadow-[-3px_0_6px_rgba(0,0,0,0.04)] hover:text-[#122244]"
                            }`}
                          >
                            {/* Tab Folder / File Icon */}
                            <div
                              className={`p-1 rounded-md transition-colors ${
                                isSelected
                                  ? "bg-amber-50 text-[#c9a654]"
                                  : "bg-slate-300/80 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-300"
                              }`}
                            >
                              <FileSpreadsheet size={13} />
                            </div>

                            {/* Tab Title - Constant stable width */}
                            <span className="tracking-tight font-extrabold whitespace-nowrap">
                              Month {rec.month}
                            </span>

                            {/* Status Pill on File Tab - Constant stable width */}
                            {isLocked ? (
                              <span
                                className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase whitespace-nowrap ${
                                  isSelected
                                    ? "bg-amber-100 text-amber-900 border border-amber-300/60"
                                    : "bg-slate-300/90 text-slate-700 border border-slate-400/50"
                                }`}
                                title="This month is finalized and locked (read-only)"
                              >
                                <Lock size={9} />
                                <span>Locked</span>
                              </span>
                            ) : (
                              <span
                                className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase whitespace-nowrap ${
                                  isSelected
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300/60"
                                    : "bg-slate-300/90 text-slate-700 border border-slate-400/50"
                                }`}
                                title="Active editing month"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>Active</span>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top-Right File Actions */}
                  <div className="flex items-center gap-2 pb-2 self-end">
                    {!isCurrentMonthLocked && activeMonthIndex === monthlyRecords.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setShowLockConfirmModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#122244] hover:bg-[#1a2f55] text-white rounded-xl font-extrabold text-xs shadow-md transition-all active:scale-95 border border-[#122244]"
                      >
                        <Lock size={13} className="text-[#c9a654]" />
                        <span>Lock & Proceed to Month {currentMonthNumber + 1}</span>
                        <ArrowRight size={14} className="text-[#c9a654]" />
                      </button>
                    ) : isCurrentMonthLocked && activeMonthIndex < monthlyRecords.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => handleSwitchMonthTab(monthlyRecords.length - 1)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-[#122244] rounded-xl font-bold text-xs shadow-sm transition-all border border-slate-200"
                      >
                        <span>Open Month {monthlyRecords.length} (Active File)</span>
                        <ArrowRight size={13} className="text-[#c9a654]" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Locked Banner inside File Folder */}
                {isCurrentMonthLocked && (
                  <div className="p-3.5 bg-amber-50/90 border-x border-b border-amber-200/80 rounded-b-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm animate-in fade-in duration-200">
                    <div className="flex items-start sm:items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-inner">
                        <Lock size={14} />
                      </div>
                      <div>
                        <span className="font-extrabold text-xs">
                          {currentMonthRecord?.monthName || `Month ${currentMonthNumber}`} Archive File (Finalized & Locked)
                        </span>
                        <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                          This month's records are permanently locked and saved as read-only.
                        </p>
                      </div>
                    </div>
                    {activeMonthIndex < monthlyRecords.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleSwitchMonthTab(monthlyRecords.length - 1)}
                        className="px-3.5 py-1.5 bg-[#122244] text-white rounded-lg font-bold text-[11px] hover:bg-[#1a2f55] transition-all shrink-0 self-end sm:self-auto shadow-sm"
                      >
                        Switch to Month {monthlyRecords.length} →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* TAB BAR NAVIGATION */}
              <div className="flex space-x-2 border-b border-gray-200 mb-8 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveModuleTab("operations")}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all border shrink-0 ${activeModuleTab === "operations"
                    ? "bg-[#122244] text-white border-[#122244] shadow-md"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                >
                  <Package className={`w-4 h-4 ${activeModuleTab === "operations" ? "text-[#c9a654]" : "text-gray-400"}`} />
                  Operational Inputs & Costing
                </button>

                <button
                  onClick={() => setActiveModuleTab("balance-sheet")}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all border shrink-0 ${activeModuleTab === "balance-sheet"
                    ? "bg-[#122244] text-white border-[#122244] shadow-md"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                >
                  <Scale className={`w-4 h-4 ${activeModuleTab === "balance-sheet" ? "text-[#c9a654]" : "text-gray-400"}`} />
                  Balance Sheet (Financial Position)
                </button>
              </div>

              {/* === TAB 1: OPERATIONAL INPUTS & COSTING === */}
              {activeModuleTab === "operations" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                  {/* HERO METRIC CARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-[#122244]">
                    {/* 1. Monthly Revenue */}
                    <div className="bg-white rounded-xl border-l-4 border-l-green-500 p-5 shadow-sm text-center flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Monthly Revenue
                        </span>
                        <p className="text-2xl font-black text-green-700 mt-1">
                          ₱{monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="mt-3 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                        {normalizedProducts.length > 1 ? (
                          <>
                            <span>Total Yield: {safeMonthlySales.toLocaleString()} units</span>
                            <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold">
                              {normalizedProducts.length} Products Combined
                            </p>
                          </>
                        ) : (
                          <>
                            <span>Price × Monthly Sales</span>
                            <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold truncate">
                              ₱{safeSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {safeMonthlySales.toLocaleString()}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 2. Monthly Expenses */}
                    <div className="bg-white rounded-xl border-l-4 border-l-red-500 p-5 shadow-sm text-center flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Monthly Expenses
                        </span>
                        <p className="text-2xl font-black text-red-600 mt-1">
                          ₱{(totalMonthlyVariableCosts + safeFixedCosts).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="mt-3 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                        {normalizedProducts.length > 1 ? (
                          <>
                            <span>Total Variable (COGS) + Fixed</span>
                            <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold truncate">
                              ₱{totalMonthlyVariableCosts.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} + ₱{safeFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </p>
                          </>
                        ) : (
                          <>
                            <span>(COGS/Unit × Sales) + Fixed</span>
                            <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold truncate">
                              (₱{safeVariableCost.toFixed(2)} × {safeMonthlySales.toLocaleString()}) + ₱{safeFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 3. Break-Even Point */}
                    <div className="bg-white rounded-xl border-l-4 border-l-blue-500 p-5 shadow-sm text-center flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Break-Even Point
                        </span>
                        <p className="text-2xl font-black text-blue-700 mt-1">
                          {typeof breakEvenUnits === "number" ? breakEvenUnits.toLocaleString() : breakEvenUnits}{" "}
                          <span className="text-xs text-gray-400 font-bold">units</span>
                        </p>
                      </div>
                      <div className="mt-3 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                        <span>Monthly OpEx / Margin per Unit</span>
                        <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold truncate">
                          ₱{safeFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} / ₱{Math.max(0, safeSellingPrice - safeVariableCost).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* 4. Gross Margin */}
                    <div className="bg-white rounded-xl border-l-4 border-l-purple-500 p-5 shadow-sm text-center flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Gross Margin
                        </span>
                        <p className={`text-2xl font-black mt-1 ${grossProfitMargin >= 0 ? "text-purple-700" : "text-red-500"}`}>
                          {grossProfitMargin.toFixed(1)}%
                        </p>
                      </div>
                      <div className="mt-3 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                        <span>(Revenue - COGS) / Revenue</span>
                        <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold truncate">
                          (₱{monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} - ₱{totalMonthlyVariableCosts.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}) / ₱{monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>

                    {/* 5. Net Profit / Month */}
                    <div
                      className={`bg-white rounded-xl border-l-4 p-5 shadow-sm text-center flex flex-col justify-between ${
                        netMonthlyProfit >= 0 ? "border-l-emerald-500" : "border-l-red-500"
                      }`}
                    >
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Net Profit / mo
                        </span>
                        <p
                          className={`text-2xl font-black mt-1 ${
                            netMonthlyProfit < 0 ? "text-red-600" : "text-emerald-700"
                          }`}
                        >
                          {netMonthlyProfit < 0 ? "-" : ""}₱{Math.abs(netMonthlyProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="mt-3 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                        <span>Revenue - Expenses</span>
                        <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold truncate">
                          ₱{monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} - ₱{(totalMonthlyVariableCosts + safeFixedCosts).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{monthlyInterest > 0 ? ` - ₱${monthlyInterest.toLocaleString()} Int` : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* === SECTION 1: PRODUCT COSTING & YIELD (SALES & PRICING ENGINE) === */}
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#122244] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          <Package size={16} className="text-[#c9a654]" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm uppercase tracking-wider text-[#122244]">
                            Product Costing, Sales & Pricing
                          </h4>
                          <p className="text-[11px] text-gray-400">
                            Batch yield, raw material ingredients, mark-up percentage, and target selling price
                          </p>
                        </div>
                      </div>
                      {!isCurrentMonthLocked && (
                        <button
                          type="button"
                          onClick={handleAddProduct}
                          className="self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold text-[#c9a654] hover:text-[#b59545] bg-amber-50 px-3.5 py-1.5 rounded-xl border border-amber-200/80 hover:bg-amber-100 transition-all shadow-sm"
                        >
                          <Plus size={14} /> Add Product
                        </button>
                      )}
                    </div>

                    {/* PRODUCTS LIST */}
                    <div className="space-y-6">
                      {normalizedProducts.map((product, prodIdx) => {
                        const metrics = computeProductMetrics(product);
                        const ingredients = product.ingredients || [];

                        return (
                          <div
                            key={product.id || prodIdx}
                            className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 space-y-6 shadow-sm relative"
                          >
                            {/* Product Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                              <div className="flex items-center gap-3 flex-1">
                                <span className="px-3 py-1 bg-[#122244] text-white text-[11px] font-black rounded-lg uppercase tracking-wider">
                                  Product #{prodIdx + 1}
                                </span>
                                <div className="flex-1 max-w-md">
                                  <input
                                    type="text"
                                    disabled={isCurrentMonthLocked}
                                    placeholder={`Product ${prodIdx + 1} Name`}
                                    value={product.name || ""}
                                    onChange={(e) => handleUpdateProduct(prodIdx, { name: e.target.value })}
                                    onBlur={() => handleAutoSave()}
                                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-extrabold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </div>
                              {normalizedProducts.length > 1 && !isCurrentMonthLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProduct(prodIdx)}
                                  className="self-end sm:self-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors font-semibold"
                                >
                                  <Trash2 size={13} /> Remove Product
                                </button>
                              )}
                            </div>

                            {/* Product Yield & Ingredients Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                              {/* Yield Input & Calculation */}
                              <div className="lg:col-span-4 space-y-4">
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                    Monthly Target Sales / Batch Yield (Units) <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    disabled={isCurrentMonthLocked}
                                    placeholder="e.g. 300"
                                    value={product.quantityYield}
                                    onChange={(e) => handleUpdateProduct(prodIdx, { quantityYield: e.target.value })}
                                    onBlur={() => handleAutoSave()}
                                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                  />
                                  <p className="text-[9px] text-gray-400 mt-1 italic">
                                    Total finished units produced or sold per month
                                  </p>
                                </div>

                                {/* Total Batch Cost & Unit Cost Preview */}
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2.5">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 font-medium">Total Batch Cost:</span>
                                    <span className="font-extrabold text-[#122244]">
                                      ₱{metrics.totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-200/60">
                                    <span className="text-gray-500 font-medium">Yield:</span>
                                    <span className="font-bold text-gray-800">{metrics.batchYield || 0} units</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-200/60">
                                    <span className="text-[#122244] font-bold">Computed Unit Cost (COGS):</span>
                                    <span className="font-black text-[#122244] text-sm">
                                      ₱{metrics.unitCost.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Ingredient List */}
                              <div className="lg:col-span-8 space-y-3">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    Direct Production Costs / Ingredients
                                  </label>
                                  {!isCurrentMonthLocked && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddIngredient(prodIdx)}
                                      className="flex items-center gap-1 text-[11px] font-bold text-[#c9a654] hover:text-[#b59545] bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200/70 hover:bg-amber-100 transition-colors"
                                    >
                                      <Plus size={12} /> Add Ingredient
                                    </button>
                                  )}
                                </div>

                                {ingredients.length === 0 ? (
                                  <div className="p-5 bg-gray-50/70 rounded-xl border border-dashed border-gray-200 text-center space-y-1.5">
                                    <p className="text-xs text-gray-400 italic">No ingredients listed yet for this product.</p>
                                    {!isCurrentMonthLocked && (
                                      <button
                                        type="button"
                                        onClick={() => handleAddIngredient(prodIdx)}
                                        className="text-xs font-bold text-[#c9a654] hover:underline"
                                      >
                                        + Add direct production materials / ingredients
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300">
                                    {ingredients.map((ing, ingIdx) => (
                                      <div
                                        key={ing.id || ingIdx}
                                        className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100 text-xs"
                                      >
                                        <input
                                          type="text"
                                          disabled={isCurrentMonthLocked}
                                          placeholder="Ingredient / Direct Material Name"
                                          value={ing.name}
                                          onChange={(e) => handleUpdateIngredient(prodIdx, ingIdx, { name: e.target.value })}
                                          onBlur={() => handleAutoSave()}
                                          className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs font-medium text-gray-800 focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                        />
                                        <div className="w-32 relative">
                                          <span className="absolute left-2.5 top-1.5 text-xs text-gray-400 font-bold">₱</span>
                                          <input
                                            type="number"
                                            disabled={isCurrentMonthLocked}
                                            placeholder="0.00"
                                            value={ing.price !== undefined ? ing.price : ""}
                                            onChange={(e) => handleUpdateIngredient(prodIdx, ingIdx, { price: e.target.value === "" ? "" : Number(e.target.value) })}
                                            onBlur={() => handleAutoSave()}
                                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-800 focus:border-[#c9a654] outline-none text-right disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                          />
                                        </div>
                                        {!isCurrentMonthLocked && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveIngredient(prodIdx, ingIdx)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                                            title="Remove ingredient"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Mark-up Strategy & Target Selling Price */}
                            <div className="pt-4 border-t border-gray-100 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-[#c9a654] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                                  <h5 className="font-bold text-xs uppercase tracking-wider text-[#122244]">
                                    Mark-up Strategy & Target Selling Price
                                  </h5>
                                </div>
                                {!isCurrentMonthLocked && (
                                  <div className="flex gap-1.5 items-center">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Presets:</span>
                                    {["50", "100", "120"].map((pct) => (
                                      <button
                                        key={pct}
                                        type="button"
                                        onClick={() => {
                                          const mPct = Number(pct);
                                          const compBase = metrics.unitCost + (metrics.unitCost * (mPct / 100));
                                          handleUpdateProduct(prodIdx, {
                                            markupPercentage: pct,
                                            sellingPrice: compBase > 0 ? String(Math.round(compBase)) : ""
                                          });
                                        }}
                                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${String(product.markupPercentage) === pct
                                          ? "bg-[#c9a654] text-white border-[#c9a654]"
                                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                          }`}
                                      >
                                        {pct}%
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                    Mark-up Percentage (%)
                                  </label>
                                  <input
                                    type="number"
                                    disabled={isCurrentMonthLocked}
                                    placeholder="e.g. 100"
                                    value={product.markupPercentage}
                                    onChange={(e) => {
                                      const newPct = e.target.value;
                                      const mPct = Number(newPct) || 0;
                                      const compBase = metrics.unitCost + (metrics.unitCost * (mPct / 100));
                                      handleUpdateProduct(prodIdx, {
                                        markupPercentage: newPct,
                                        sellingPrice: compBase > 0 ? String(Math.round(compBase)) : (product.sellingPrice || "")
                                      });
                                    }}
                                    onBlur={() => handleAutoSave()}
                                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                  />
                                  <div className="mt-1.5 px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-200/80 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-[#b59545] uppercase tracking-wider">Markup Amount</span>
                                    <span className="text-xs font-black text-[#122244]">+₱{metrics.markupAmount.toFixed(2)}</span>
                                  </div>
                                </div>

                                <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/80 flex flex-col justify-center">
                                  <span className="text-[10px] font-bold text-[#b59545] uppercase">Computed Base Price</span>
                                  <p className="text-xl font-black text-[#c9a654] mt-0.5">₱{metrics.computedBasePrice.toFixed(2)}</p>
                                  <span className="text-[9px] text-gray-500">Unit Cost (₱{metrics.unitCost.toFixed(2)}) + Mark-up</span>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                    Final / Target Selling Price (₱) <span className="text-[#c9a654] font-black">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    disabled={isCurrentMonthLocked}
                                    placeholder={metrics.computedBasePrice > 0 ? String(Math.round(metrics.computedBasePrice)) : "0"}
                                    value={product.sellingPrice !== undefined ? product.sellingPrice : ""}
                                    onChange={(e) => handleUpdateProduct(prodIdx, { sellingPrice: e.target.value })}
                                    onBlur={() => handleAutoSave()}
                                    className="w-full px-3.5 py-2 bg-white border-2 border-[#c9a654] rounded-lg text-xs font-black text-[#122244] focus:ring-2 focus:ring-[#c9a654]/20 outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                  />
                                  <p className="text-[9px] text-gray-400 mt-1 italic">
                                    Psychological rounding allowed (e.g. ₱89.06 → ₱89.00)
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* DYNAMIC SUMMARY CARDS (PER PRODUCT) */}
                            <div className="pt-3 border-t border-gray-100">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                                Product Economics Summary ({product.name || `Product #${prodIdx + 1}`})
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[#122244]">
                                {/* Unit Cost (COGS) */}
                                <div className="bg-gray-50/90 p-3.5 rounded-xl border border-gray-200">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Unit Cost (COGS)</span>
                                  <p className="text-base font-black text-[#122244] mt-0.5">₱{metrics.unitCost.toFixed(2)}</p>
                                  <p className="text-[9px] text-gray-400 font-medium mt-0.5 truncate">Total Cost / Yield</p>
                                </div>

                                {/* Target Price */}
                                <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-200">
                                  <span className="text-[10px] font-bold text-[#b59545] uppercase tracking-wider block">Target Price</span>
                                  <p className="text-base font-black text-[#c9a654] mt-0.5">₱{metrics.sellingPrice.toFixed(2)}</p>
                                  <p className="text-[9px] text-gray-500 font-semibold mt-0.5">+{metrics.markupPct}% Mark-up</p>
                                </div>

                                {/* Revenue */}
                                <div className="bg-green-50/40 p-3.5 rounded-xl border border-green-200">
                                  <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider block">Revenue</span>
                                  <p className="text-base font-black text-green-700 mt-0.5">
                                    ₱{metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-[9px] text-green-600 font-medium mt-0.5">Selling Price × Yield</p>
                                </div>

                                {/* Gross Profit */}
                                <div className="bg-purple-50/40 p-3.5 rounded-xl border border-purple-200">
                                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Gross Profit</span>
                                  <p className={`text-base font-black mt-0.5 ${metrics.grossProfit >= 0 ? "text-purple-700" : "text-red-500"}`}>
                                    ₱{metrics.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-[9px] text-purple-600 font-medium mt-0.5">Revenue - Batch Cost</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* === SECTION 2: MONTHLY OPERATING COSTS (OPEX) - ENLARGED === */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-sm space-y-6 text-[#122244]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-sm">
                          <TrendingUp className="text-[#c9a654]" size={18} />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#122244]">
                            Monthly Operating Expenses (OpEx)
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Fixed monthly overhead costs (Rent, Utilities, Marketing, Salaries buffer, Supplies)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50/80 px-4 py-2 rounded-xl border border-blue-100 flex items-center gap-2 shadow-sm">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Monthly OpEx:</span>
                          <span className="text-base font-black text-blue-900">₱{safeFixedCosts.toLocaleString()}</span>
                        </div>
                        {!isCurrentMonthLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              const currentList = financials.opexList || [];
                              const newItem = { id: Date.now().toString(), name: "", amount: 0 };
                              const updatedList = [...currentList, newItem];
                              const newState = { ...financials, opexList: updatedList };
                              setFinancials(newState);
                              const updatedRecords = [...monthlyRecords];
                              if (updatedRecords[activeMonthIndex]) {
                                updatedRecords[activeMonthIndex] = {
                                  ...updatedRecords[activeMonthIndex],
                                  financials: newState,
                                };
                                setMonthlyRecords(updatedRecords);
                              }
                              handleAutoSave(newState, updatedRecords);
                            }}
                            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#122244] hover:bg-[#1a3060] px-4 py-2.5 rounded-xl shadow-sm transition-all"
                          >
                            <Plus size={14} className="text-[#c9a654]" /> Add Expense
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase font-bold text-gray-500 tracking-wider">
                          <tr>
                            <th className="p-3.5 pl-5">Expense Description / Name</th>
                            <th className="p-3.5 w-48 text-right">Monthly Amount (₱)</th>
                            {!isCurrentMonthLocked && <th className="p-3.5 w-16 text-center">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {financials.opexList && financials.opexList.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-gray-50/50 transition-colors">
                              <td className="p-3 pl-5">
                                <input
                                  type="text"
                                  disabled={isCurrentMonthLocked}
                                  value={item.name}
                                  placeholder="e.g. Rent, Electricity, Internet, Supplies"
                                  onChange={(e) => {
                                    const newList = [...financials.opexList];
                                    newList[index].name = e.target.value;
                                    const newState = { ...financials, opexList: newList };
                                    setFinancials(newState);
                                    const updatedRecords = [...monthlyRecords];
                                    if (updatedRecords[activeMonthIndex]) {
                                      updatedRecords[activeMonthIndex] = {
                                        ...updatedRecords[activeMonthIndex],
                                        financials: newState,
                                      };
                                      setMonthlyRecords(updatedRecords);
                                    }
                                  }}
                                  onBlur={() => handleAutoSave()}
                                  className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="p-3">
                                <div className="relative">
                                  <span className="absolute left-3 top-2 text-xs text-gray-400 font-bold">₱</span>
                                  <input
                                    type="number"
                                    disabled={isCurrentMonthLocked}
                                    min="0"
                                    value={item.amount === 0 ? "" : item.amount}
                                    placeholder="0.00"
                                    onChange={(e) => {
                                      const newList = [...financials.opexList];
                                      const amt = e.target.value === "" ? 0 : Number(e.target.value);
                                      newList[index].amount = amt;
                                      const newState = { ...financials, opexList: newList };
                                      setFinancials(newState);
                                      const updatedRecords = [...monthlyRecords];
                                      if (updatedRecords[activeMonthIndex]) {
                                        updatedRecords[activeMonthIndex] = {
                                          ...updatedRecords[activeMonthIndex],
                                          financials: newState,
                                        };
                                        setMonthlyRecords(updatedRecords);
                                      }
                                    }}
                                    onBlur={() => handleAutoSave()}
                                    className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-black text-[#122244] text-right focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </td>
                              {!isCurrentMonthLocked && (
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newList = financials.opexList.filter(i => i.id !== item.id);
                                      const newState = { ...financials, opexList: newList };
                                      setFinancials(newState);
                                      const updatedRecords = [...monthlyRecords];
                                      if (updatedRecords[activeMonthIndex]) {
                                        updatedRecords[activeMonthIndex] = {
                                          ...updatedRecords[activeMonthIndex],
                                          financials: newState,
                                        };
                                        setMonthlyRecords(updatedRecords);
                                      }
                                      handleAutoSave(newState, updatedRecords);
                                    }}
                                    className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                    title="Delete Expense"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                          {(!financials.opexList || financials.opexList.length === 0) && (
                            <tr>
                              <td colSpan={isCurrentMonthLocked ? 2 : 3} className="p-8 text-center text-xs text-gray-400 italic">
                                No monthly operating expenses added yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {!isCurrentMonthLocked && (
                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const currentList = financials.opexList || [];
                            const newItem = { id: Date.now().toString(), name: "", amount: 0 };
                            const updatedList = [...currentList, newItem];
                            const newState = { ...financials, opexList: updatedList };
                            setFinancials(newState);
                            const updatedRecords = [...monthlyRecords];
                            if (updatedRecords[activeMonthIndex]) {
                              updatedRecords[activeMonthIndex] = {
                                ...updatedRecords[activeMonthIndex],
                                financials: newState,
                              };
                              setMonthlyRecords(updatedRecords);
                            }
                            handleAutoSave(newState, updatedRecords);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#c9a654] hover:text-[#b59545] uppercase tracking-wider transition-colors"
                        >
                          <Plus size={14} /> + Add Another Expense Item
                        </button>
                        <span className="text-xs text-gray-400 font-medium">
                          Total Fixed OpEx: <strong className="text-[#122244]">₱{safeFixedCosts.toLocaleString()}/mo</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* === SECTION 3: FINANCING, FISCAL SUMMARY & MARKET INDICATORS === */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-[#122244]">
                    {/* LEFT: Initial Capital & Market Indicators */}
                    <div className="lg:col-span-5 space-y-6">
                      {/* Initial Capital */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                          <div>
                            <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244]">
                              <DollarSign className="text-[#c9a654]" /> Initial Capital Contributed
                            </h3>
                            <p className="text-[11px] text-gray-400 mt-0.5">Direct cash contribution from owners/partners</p>
                          </div>
                          <div className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                            <span className="text-xs font-black text-green-800">₱{totalInitialCapital.toLocaleString()}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                            Cash Invested (₱)
                          </label>
                          <input
                            type="number"
                            disabled={isCurrentMonthLocked}
                            placeholder="0"
                            value={financials.cashInvested}
                            onChange={(e) => {
                              const newState = { ...financials, cashInvested: e.target.value };
                              setFinancials(newState);
                              const updatedRecords = [...monthlyRecords];
                              if (updatedRecords[activeMonthIndex]) {
                                updatedRecords[activeMonthIndex] = {
                                  ...updatedRecords[activeMonthIndex],
                                  financials: newState,
                                };
                                setMonthlyRecords(updatedRecords);
                              }
                            }}
                            onBlur={() => handleAutoSave()}
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                          />
                          <p className="text-[9px] text-gray-400 mt-1 italic">Recorded under Owner's Equity in the Balance Sheet</p>
                        </div>
                      </div>

                      {/* Market Indicators */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5 text-[#122244]">
                        <h3 className="font-bold flex items-center gap-2 border-b border-gray-100 pb-4 uppercase text-xs tracking-widest">
                          <Target className="text-[#c9a654]" /> Market Indicators
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                              Competitor Count:{" "}
                              <span className="text-[#122244] font-black text-sm ml-1">
                                {financials.competitorCount}
                              </span>
                            </label>
                            <input
                              type="range"
                              disabled={isCurrentMonthLocked}
                              min="0"
                              max="20"
                              value={financials.competitorCount}
                              onChange={(e) => {
                                const newState = {
                                  ...financials,
                                  competitorCount: Number(e.target.value),
                                };
                                setFinancials(newState);
                                const updatedRecords = [...monthlyRecords];
                                if (updatedRecords[activeMonthIndex]) {
                                  updatedRecords[activeMonthIndex] = {
                                    ...updatedRecords[activeMonthIndex],
                                    financials: newState,
                                  };
                                  setMonthlyRecords(updatedRecords);
                                }
                              }}
                              onMouseUp={() => handleAutoSave()}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#c9a654] disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">
                              Market Demand Level
                            </label>
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                              {["Low", "Medium", "High"].map((level) => (
                                <button
                                  key={level}
                                  type="button"
                                  disabled={isCurrentMonthLocked}
                                  onClick={() => {
                                    const newState = {
                                      ...financials,
                                      marketDemand: level,
                                    };
                                    setFinancials(newState);
                                    const updatedRecords = [...monthlyRecords];
                                    if (updatedRecords[activeMonthIndex]) {
                                      updatedRecords[activeMonthIndex] = {
                                        ...updatedRecords[activeMonthIndex],
                                        financials: newState,
                                      };
                                      setMonthlyRecords(updatedRecords);
                                    }
                                    handleAutoSave(newState, updatedRecords);
                                  }}
                                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${financials.marketDemand === level
                                    ? "bg-white shadow-sm text-[#122244]"
                                    : "text-gray-400 hover:text-gray-600"
                                    } ${isCurrentMonthLocked ? "cursor-not-allowed" : ""}`}
                                >
                                  {level}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Fiscal Summary (BMBE Tax Framework) */}
                    <div className="lg:col-span-7">
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-sm space-y-6 h-full flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div>
                              <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244]">
                                <BarChart3 className="text-[#c9a654]" /> Fiscal Summary (BMBE Tax Framework)
                              </h3>
                              <p className="text-[11px] text-gray-400 mt-0.5">Republic Act No. 9178 BMBE Tax Exemptions</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}
                              className="text-[10px] font-black uppercase text-[#c9a654] border border-[#c9a654]/30 px-3 py-1.5 rounded-lg hover:bg-[#c9a654]/5 transition-all"
                            >
                              {showTaxBreakdown ? "Hide Details" : "View Computation"}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center mt-5">
                            <div className="space-y-4 text-[#122244]">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                  Annual Net Profit (Before Tax)
                                </label>
                                <p className="text-2xl font-black text-[#122244]">
                                  ₱{annualNetProfitPreTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                  Estimated Annual Business Tax (3%)
                                </label>
                                <p className="text-3xl font-black text-[#c9a654]">
                                  ₱{taxResult.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                      type="button"
                                      onClick={() => setTaxTab("math")}
                                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${taxTab === "math" ? "bg-[#c9a654] text-white" : "text-gray-400 hover:text-white"}`}
                                    >
                                      Math Breakdown
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setTaxTab("log")}
                                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${taxTab === "log" ? "bg-[#c9a654] text-white" : "text-gray-400 hover:text-white"}`}
                                    >
                                      Tax Log
                                    </button>
                                  </div>
                                </div>

                                {taxTab === "math" ? (
                                  <div className="space-y-3 animate-in fade-in duration-300 text-xs">
                                    <p className="text-gray-300">
                                      ₱{annualRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} Annual Revenue × 3% Flat Percentage Tax = <span className="text-green-400 font-bold">₱{taxResult.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-2 text-xs">
                                    <p className="text-gray-300">Income Tax: <span className="text-green-400 font-bold">₱0 (BMBE Exempt)</span></p>
                                    <p className="text-gray-300">Percentage Tax: <span className="text-white font-bold">₱{taxResult.percentageTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center text-[#122244]">
                                <p className="text-xs text-gray-400 italic">
                                  Click "View Computation" to see the BMBE tax exemption logic.
                                </p>
                              </div>
                            )}
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
                              <span className="text-[10px] text-gray-400 block">Machinery & store equipment list</span>
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
                              <span className="text-[10px] text-gray-400 block">Short-term supplier obligations (20% of COGS)</span>
                            </div>
                            <span className="font-extrabold text-[#122244]">₱{safeAccountsPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
                            <div>
                              <span className="font-bold text-gray-800">Utilities Payable</span>
                              <span className="text-[10px] text-gray-400 block">Accrued operating expenses (15% of OpEx)</span>
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
                              <span className="text-[10px] text-gray-400 block">Cash starting investment</span>
                            </div>
                            <span className="font-bold text-gray-700">₱{initialEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>

                          <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg text-green-700">
                            <div>
                              <span className="font-bold">Add: Retained Net Income (After Tax)</span>
                              <span className="text-[10px] text-gray-400 block">Annual net profit from operations (net of 3% BMBE tax)</span>
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
            </div>
          )}
        </main>

        {/* LOCK & PROCEED CONFIRMATION MODAL */}
        {showLockConfirmModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setShowLockConfirmModal(false)}
            />
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 z-10 animate-in zoom-in-95 duration-200 border border-gray-100 relative text-[#122244]">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-11 h-11 bg-amber-50 border border-amber-200 text-[#c9a654] rounded-xl flex items-center justify-center font-black shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#122244]">
                    Finalize Month {currentMonthNumber}?
                  </h3>
                  <p className="text-xs text-gray-400">Lock current inputs and proceed to next month</p>
                </div>
              </div>

              <div className="py-5 space-y-3">
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2 leading-relaxed">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    Important: Month {currentMonthNumber} will be permanently locked
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Once confirmed, this month's product costing, operating expenses, and balance sheet inputs will be saved and <strong>cannot be edited again</strong>.
                  </p>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  <strong>Month {currentMonthNumber + 1}</strong> will be created with your current configuration carried forward as a starting point. You will be able to edit and customize financials for Month {currentMonthNumber + 1}.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowLockConfirmModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Keep Editing Month {currentMonthNumber}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLockAndProceed}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#122244] hover:bg-[#1a2f55] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  <Lock size={13} className="text-[#c9a654]" />
                  <span>Confirm & Proceed to Month {currentMonthNumber + 1}</span>
                </button>
              </div>
            </div>
          </div>
        )}

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

      {/* ========================================================= */}
      {/* DEDICATED PRINTABLE EXECUTIVE FINANCIAL FEASIBILITY REPORT */}
      {/* ========================================================= */}
      <div className="hidden print:block w-full bg-white text-black p-4 font-sans text-xs">
        {/* REPORT HEADER */}
        <div className="border-b-2 border-[#122244] pb-4 mb-5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-black tracking-wider text-[#122244]">FeasiFy</span>
              <span className="text-[10px] bg-[#c9a654] text-white px-2 py-0.5 rounded font-bold uppercase">Official Statement</span>
            </div>
            <h1 className="text-xl font-extrabold text-[#122244]">{activeProjName} - {currentMonthRecord?.monthName || `Month ${currentMonthNumber}`}</h1>
            <p className="text-[11px] text-gray-600">Financial Feasibility Study & Statement of Financial Position ({isCurrentMonthLocked ? 'Finalized Baseline' : 'Active Projection'})</p>
          </div>
          <div className="text-right text-[11px] text-gray-600 space-y-0.5">
            <p><strong className="text-gray-900">Date Generated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong className="text-gray-900">Proponent:</strong> {userName || "Student Proponent"}</p>
            <p><strong className="text-gray-900">Currency:</strong> Philippine Peso (PHP ₱)</p>
          </div>
        </div>

        {/* SECTION 1: OPERATIONAL COSTING & PROJECTIONS */}
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#122244] border-b border-gray-300 pb-1 mb-2">
            1. Operational Projections & Unit Costing Summary
          </h2>
          <div className="grid grid-cols-4 gap-2 mb-3 text-[11px]">
            <div className="border border-gray-300 p-2 rounded">
              <span className="text-gray-500 block text-[9px] uppercase font-bold">Selling Price</span>
              <span className="text-xs font-bold">₱{safeSellingPrice.toFixed(2)}</span>
            </div>
            <div className="border border-gray-300 p-2 rounded">
              <span className="text-gray-500 block text-[9px] uppercase font-bold">Unit Cost (COGS)</span>
              <span className="text-xs font-bold">₱{safeVariableCost.toFixed(2)}</span>
            </div>
            <div className="border border-gray-300 p-2 rounded">
              <span className="text-gray-500 block text-[9px] uppercase font-bold">Monthly Target Volume</span>
              <span className="text-xs font-bold">{safeMonthlySales.toLocaleString()} units</span>
            </div>
            <div className="border border-gray-300 p-2 rounded">
              <span className="text-gray-500 block text-[9px] uppercase font-bold">Gross Profit Margin</span>
              <span className="text-xs font-bold text-green-800">{grossProfitMargin.toFixed(1)}%</span>
            </div>
          </div>

          <table className="w-full text-[11px] border-collapse border border-gray-300 mb-3">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                <th className="p-1.5 text-left border-r border-gray-300">Financial Metric</th>
                <th className="p-1.5 text-right border-r border-gray-300">Monthly Value</th>
                <th className="p-1.5 text-right">Annual Projection ({safeOperatingDays} Days)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="p-1.5 border-r border-gray-300 font-medium">Gross Sales Revenue</td>
                <td className="p-1.5 text-right border-r border-gray-300">₱{monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-1.5 text-right font-bold">₱{annualRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="p-1.5 border-r border-gray-300 font-medium">Cost of Goods Sold (COGS)</td>
                <td className="p-1.5 text-right border-r border-gray-300">₱{totalMonthlyVariableCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-1.5 text-right">₱{annualCOGS.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="p-1.5 border-r border-gray-300 font-medium">Monthly Fixed Overhead (OpEx)</td>
                <td className="p-1.5 text-right border-r border-gray-300">₱{safeFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-1.5 text-right">₱{((safeFixedCosts / 30) * safeOperatingDays).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-gray-50 font-bold">
                <td className="p-1.5 border-r border-gray-300">Net Profit Pre-Tax</td>
                <td className="p-1.5 text-right border-r border-gray-300">₱{netMonthlyProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-1.5 text-right">₱{annualNetProfitPreTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="p-1.5 border-r border-gray-300 font-medium text-blue-900">Philippine BMBE Tax (3% Flat on Gross Sales)</td>
                <td className="p-1.5 text-right border-r border-gray-300">₱{(monthlyRevenue * 0.03).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-1.5 text-right text-blue-900">₱{annualTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-emerald-50 font-black text-emerald-950 border-t-2 border-emerald-600">
                <td className="p-2 border-r border-gray-300">NET ANNUAL PROFIT (AFTER TAX)</td>
                <td className="p-2 text-right border-r border-gray-300">₱{(annualNetProfitAfterTax / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-2 text-right text-xs">₱{annualNetProfitAfterTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION 2: ITEMIZED OPEX & EQUIPMENT (CAPEX) */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* OpEx */}
          <div className="border border-gray-300 rounded p-2.5 text-[11px]">
            <h3 className="font-bold text-[#122244] uppercase mb-1.5 border-b pb-1">Itemized Operating Expenses</h3>
            {financials.opexList && financials.opexList.length > 0 ? (
              <table className="w-full text-left">
                <tbody className="divide-y divide-gray-100">
                  {financials.opexList.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-0.5 text-gray-700">{item.name || "Expense"}</td>
                      <td className="py-0.5 text-right font-bold">₱{Number(item.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="font-black border-t border-gray-300">
                    <td className="py-1">Total Monthly OpEx:</td>
                    <td className="py-1 text-right text-red-700">₱{safeFixedCosts.toLocaleString()}/mo</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 italic">General OpEx: ₱{safeFixedCosts.toLocaleString()}/mo</p>
            )}
          </div>

          {/* CapEx Equipment */}
          <div className="border border-gray-300 rounded p-2.5 text-[11px]">
            <h3 className="font-bold text-[#122244] uppercase mb-1.5 border-b pb-1">Machinery & Equipment (CapEx)</h3>
            {financials.equipmentList && financials.equipmentList.length > 0 ? (
              <table className="w-full text-left">
                <tbody className="divide-y divide-gray-100">
                  {financials.equipmentList.map((eq: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-0.5 text-gray-700">{eq.name} ({eq.quantity || 1}x)</td>
                      <td className="py-0.5 text-right font-bold">₱{Number(eq.total || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="font-black border-t border-gray-300">
                    <td className="py-1">Total Equipment CapEx:</td>
                    <td className="py-1 text-right text-[#122244]">₱{safeStartupCapital.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 italic">Equipment Capital: ₱{safeStartupCapital.toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* SECTION 3: STATEMENT OF FINANCIAL POSITION (BALANCE SHEET) */}
        <div className="mb-5">
          <div className="flex justify-between items-center border-b-2 border-[#122244] pb-1 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#122244]">
              2. Statement of Financial Position (Balance Sheet)
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[11px] font-serif">
            {/* ASSETS */}
            <div className="space-y-1.5 pr-4">
              <h3 className="font-bold text-[#122244] border-b border-gray-800 pb-1 mb-3 uppercase tracking-wide">
                ASSETS
              </h3>

              <div className="space-y-1.5">
                <p className="font-bold text-gray-800 text-[10px] uppercase tracking-wide">Current Assets</p>
                <div className="flex justify-between pl-3">
                  <span>Cash on Hand (15%)</span>
                  <span>₱{cashOnHand.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pl-3">
                  <span>Cash in Bank (85%)</span>
                  <span>₱{cashInBank.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pl-3">
                  <span>Merchandise & Materials Inventory</span>
                  <span>₱{rawMaterialInventory.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 mt-1 border-t border-gray-400 pl-3">
                  <span>Total Current Assets</span>
                  <span>₱{totalCurrentAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <p className="font-bold text-gray-800 text-[10px] uppercase tracking-wide pt-3">Non-Current Assets</p>
                <div className="flex justify-between pl-3">
                  <span>Property, Plant & Equipment (Gross)</span>
                  <span>₱{grossPPE.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pl-3">
                  <span>Less: Accumulated Depreciation (10%)</span>
                  <span>(₱{annualDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                </div>
                <div className="flex justify-between font-bold pt-1 mt-1 border-t border-gray-400 pl-3">
                  <span>Total Non-Current Assets (Net PPE)</span>
                  <span>₱{totalNonCurrentAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between font-bold pt-2 mt-5 border-t border-b-4 border-double border-gray-900 text-[12px] uppercase tracking-wide pl-1">
                  <span>TOTAL ASSETS</span>
                  <span>₱{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* LIABILITIES & OWNER'S EQUITY */}
            <div className="space-y-1.5 pl-4 border-l border-gray-200">
              <h3 className="font-bold text-[#122244] border-b border-gray-800 pb-1 mb-3 uppercase tracking-wide">
                LIABILITIES & EQUITY
              </h3>

              <div className="space-y-1.5">
                <p className="font-bold text-gray-800 text-[10px] uppercase tracking-wide">Current Liabilities</p>
                <div className="flex justify-between pl-3">
                  <span>Accounts Payable (20% of COGS)</span>
                  <span>₱{safeAccountsPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pl-3">
                  <span>Utilities & OpEx Payable (15% of OpEx)</span>
                  <span>₱{safeUtilitiesPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 mt-1 border-t border-gray-400 pl-3">
                  <span>Total Current Liabilities</span>
                  <span>₱{totalCurrentLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <p className="font-bold text-gray-800 text-[10px] uppercase tracking-wide pt-3">Owner's Equity</p>
                <div className="flex justify-between pl-3">
                  <span>Initial Cash Capital</span>
                  <span>₱{initialEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pl-3">
                  <span>Add: Retained Net Profit (After Tax)</span>
                  <span>₱{annualNetProfitAfterTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 mt-1 border-t border-gray-400 pl-3">
                  <span>Ending Owner's Capital</span>
                  <span>₱{endingOwnerEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between font-bold pt-2 mt-5 border-t border-b-4 border-double border-gray-900 text-[12px] uppercase tracking-wide pl-1">
                  <span>TOTAL LIABILITIES & EQUITY</span>
                  <span>₱{totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIGN-OFF BLOCK */}
        <div className="pt-4 border-t border-gray-300 grid grid-cols-2 gap-8 text-[11px]">
          <div>
            <p className="text-gray-500 mb-6">Prepared and certified by Proponent:</p>
            <div className="border-b border-gray-400 w-44 mb-1"></div>
            <p className="font-bold text-gray-900">{userName || "Student Proponent"}</p>
            <p className="text-[9px] text-gray-500">Business Proponent / Team Leader</p>
          </div>
          <div>
            <p className="text-gray-500 mb-6">Reviewed & Approved by Adviser:</p>
            <div className="border-b border-gray-400 w-44 mb-1"></div>
            <p className="font-bold text-gray-900">Faculty Research Adviser</p>
            <p className="text-[9px] text-gray-500">Feasibility Evaluation Committee</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Financial_input;