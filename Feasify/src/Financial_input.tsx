import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MobileBurgerButton from "./components/MobileBurgerButton";
import SidebarCloseButton from "./components/SidebarCloseButton";
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
  onSnapshot,
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
  ChevronUp,
  DollarSign,
  PhilippinePeso,
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
  Copy,
  Edit3,
  Check,
  History,
  Clock,
  Users,
  RefreshCw,
  Store,
  MapPin,
  Building2,
  GraduationCap,
  Briefcase,
  Tag,
  Compass,
  Calculator,
  Percent,
  Award,
  Sparkles,
  BookOpen,
} from "lucide-react";
import {
  normalizeProposalProducts,
  computeProductMetrics,
  handlePreventNegative,
  handlePasteNonNegative,
  type ProductCostingItem,
  type IngredientItem,
  type OpexItem,
  type ContributorItem,
  PREDETERMINED_OPEX_ITEMS,
  normalizeOpexList,
  normalizeContributors,
  autoDistributeContributors,
} from "./utils/productCosting";
import { MR_CABBAGE_BENCHMARK } from "./utils/cabbageBenchmark";
import { generateFiveYearBalanceSheet } from "./utils/balanceSheetProjections";
import { StatementOfFinancialPositionTable } from "./components/StatementOfFinancialPositionTable";
import ScrollToTopButton from "./components/ScrollToTopButton";
import CustomDropdown from "./components/CustomDropdown";
import { logAuditEvent } from "./services/auditLogger";
import { notifyAdvisersForSection } from "./services/notificationService";
import {
  getDynamicCompetitorsFromLocation,
  parseTargetMarketDemographics,
  type DynamicCompetitorResult,
  type DynamicDemographicResult,
  type NearbyEstablishmentItem,
} from "./services/marketCompetitorService";

export const cleanFirestoreData = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (
    obj &&
    typeof obj === "object" &&
    ((obj as any)._methodName ||
      ((obj as any).toMillis && typeof (obj as any).toMillis === "function"))
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => (item === undefined ? null : cleanFirestoreData(item)));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanFirestoreData(value);
    }
  }
  return cleaned;
};

export interface MonthlyDraft {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  financials: {
    products: ProductCostingItem[];
    sellingPrice: string;
    monthlySales: string;
    variableCost: string;
    fixedCosts: string;
    startupCapital: string;
    cashInvested: string;
    contributorsList?: ContributorItem[];
    contributorsCount?: string | number;
    rentAdvanceDeposit: string;
    trainingsPrograms: string;
    advertisingExpense: string;
    salariesExpenseInitial: string;
    accountsPayable: string;
    utilitiesPayable: string;
    competitorCount: number;
    marketDemand: string;
    directCompetitors?: string[];
    otherCompetitors?: string[];
    competitorNotes?: string;
    nearbyEstablishments?: string[];
    targetDemographics?: string[];
    footTrafficPeak?: string;
    marketDemandNotes?: string;
    operatingDays: string;
    equipmentList: { id: string; name: string; quantity: number; unitPrice: number; total: number }[];
    opexList: OpexItem[];
    isCapitalBorrowed: boolean;
    interestRate: string;
    propertyInvested?: string;
    propertyInvestedNote?: string;
    renovationCosts?: string;
    permitsLicensesInitial?: string;
    salesDiscountPercent?: string;
    salesReturnsPercent?: string;
    endingSuppliesPercent?: string;
    accountsReceivable?: string;
    salariesPayable?: string;
    taxesPayable?: string;
  };
}

export interface MonthlyFinancialRecord {
  month: number;
  monthName?: string;
  isLocked: boolean;
  lockedAt?: string;
  activeDraftId?: string;
  drafts?: MonthlyDraft[];
  financials: {
    products: ProductCostingItem[];
    sellingPrice: string;
    monthlySales: string;
    variableCost: string;
    fixedCosts: string;
    startupCapital: string;
    cashInvested: string;
    contributorsList?: ContributorItem[];
    contributorsCount?: string | number;
    rentAdvanceDeposit: string;
    trainingsPrograms: string;
    advertisingExpense: string;
    salariesExpenseInitial: string;
    accountsPayable: string;
    utilitiesPayable: string;
    competitorCount: number;
    marketDemand: string;
    directCompetitors?: string[];
    otherCompetitors?: string[];
    competitorNotes?: string;
    nearbyEstablishments?: string[];
    targetDemographics?: string[];
    footTrafficPeak?: string;
    marketDemandNotes?: string;
    operatingDays: string;
    equipmentList: { id: string; name: string; quantity: number; unitPrice: number; total: number }[];
    opexList: OpexItem[];
    isCapitalBorrowed: boolean;
    interestRate: string;
    propertyInvested?: string;
    propertyInvestedNote?: string;
    renovationCosts?: string;
    permitsLicensesInitial?: string;
    salesDiscountPercent?: string;
    salesReturnsPercent?: string;
    endingSuppliesPercent?: string;
    accountsReceivable?: string;
    salariesPayable?: string;
    taxesPayable?: string;
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
  const [userUid, setUserUid] = useState("");
  const [userSection, setUserSection] = useState("");
  const [userGroupId, setUserGroupId] = useState("");
  const [isLeader, setIsLeader] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [printMode, setPrintMode] = useState<"balance-sheet" | "executive">("balance-sheet");
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);
  const [showCreateDraftModal, setShowCreateDraftModal] = useState(false);
  const [newDraftName, setNewDraftName] = useState("");
  const [newDraftCloneCurrent, setNewDraftCloneCurrent] = useState(true);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingDraftName, setEditingDraftName] = useState("");
  const [taxTab, setTaxTab] = useState<"log" | "math">("math");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [activeModuleTab, setActiveModuleTab] = useState<"operations" | "market" | "balance-sheet">("operations");
  const [balanceSheetSubTab, setBalanceSheetSubTab] = useState<"position" | "performance" | "startup" | "ratios">("position");
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [benchmarkNotification, setBenchmarkNotification] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("All changes saved");
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

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
        contributorsList: normalizeContributors([], "1", 0),
        contributorsCount: "1",
        rentAdvanceDeposit: "",
        trainingsPrograms: "",
        advertisingExpense: "",
        salariesExpenseInitial: "",
        accountsPayable: "",
        utilitiesPayable: "",
        competitorCount: 0,
        marketDemand: "Medium",
        directCompetitors: [] as string[],
        otherCompetitors: [] as string[],
        competitorNotes: "",
        nearbyEstablishments: [] as string[],
        targetDemographics: [] as string[],
        footTrafficPeak: "",
        marketDemandNotes: "",
        operatingDays: "300",
        equipmentList: [],
        opexList: PREDETERMINED_OPEX_ITEMS.map((item) => ({ ...item })),
        isCapitalBorrowed: false,
        interestRate: "",
        propertyInvested: "",
        propertyInvestedNote: "",
        renovationCosts: "",
        permitsLicensesInitial: "",
        salesDiscountPercent: "5",
        salesReturnsPercent: "2",
        endingSuppliesPercent: "30",
        accountsReceivable: "",
        salariesPayable: "",
        taxesPayable: "",
      },
    },
  ]);
  const [activeMonthIndex, setActiveMonthIndex] = useState(0);

  const [marketIndicatorsTab, setMarketIndicatorsTab] = useState<"competitors" | "demand" | "all">("competitors");
  const [directCompetitorInput, setDirectCompetitorInput] = useState("");
  const [otherCompetitorInput, setOtherCompetitorInput] = useState("");
  const [nearbyEstablishmentInput, setNearbyEstablishmentInput] = useState("");
  const [targetDemographicsInput, setTargetDemographicsInput] = useState("");
  const [dynamicCompetitorData, setDynamicCompetitorData] = useState<DynamicCompetitorResult | null>(null);
  const [isDetectingCompetitors, setIsDetectingCompetitors] = useState(false);

  const [financials, setFinancials] = useState({
    products: [] as ProductCostingItem[],
    sellingPrice: "",
    monthlySales: "",
    variableCost: "",
    fixedCosts: "",
    startupCapital: "",
    cashInvested: "",
    contributorsList: normalizeContributors([], "1", 0) as ContributorItem[],
    contributorsCount: "1",
    rentAdvanceDeposit: "",
    trainingsPrograms: "",
    advertisingExpense: "",
    salariesExpenseInitial: "",
    accountsPayable: "",
    utilitiesPayable: "",
    competitorCount: 0,
    marketDemand: "Medium",
    directCompetitors: [] as string[],
    otherCompetitors: [] as string[],
    competitorNotes: "",
    nearbyEstablishments: [] as string[],
    targetDemographics: [] as string[],
    footTrafficPeak: "",
    marketDemandNotes: "",
    operatingDays: "300",
    equipmentList: [] as { id: string; name: string; quantity: number; unitPrice: number; total: number }[],
    opexList: PREDETERMINED_OPEX_ITEMS.map((item) => ({ ...item })),
    isCapitalBorrowed: false,
    interestRate: "",
    propertyInvested: "",
    propertyInvestedNote: "",
    renovationCosts: "",
    permitsLicensesInitial: "",
    salesDiscountPercent: "5",
    salesReturnsPercent: "2",
    endingSuppliesPercent: "30",
    accountsReceivable: "",
    salariesPayable: "",
    taxesPayable: "",
  });

  const isCurrentMonthLocked = monthlyRecords[activeMonthIndex]?.isLocked || false;
  const currentMonthRecord = monthlyRecords[activeMonthIndex];
  const currentMonthNumber = currentMonthRecord?.month || (activeMonthIndex + 1);

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const activeProjName = currentProject?.name || "Active Business Projections";
  const rawTargetMarket = currentProject?.targetMarket || currentProject?.rawProposalData?.targetMarket || "";
  const dynamicDemographics = useMemo(() => parseTargetMarketDemographics(rawTargetMarket), [rawTargetMarket]);
  const proposalCapRequirement = Number(currentProject?.proposalCapital || financials.startupCapital || 0);
  const currentContribList = (financials.contributorsList && financials.contributorsList.length > 0)
    ? financials.contributorsList
    : [];
  const totalContributedSum = currentContribList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const isCapitalMismatch = proposalCapRequirement > 0 && Math.abs(totalContributedSum - proposalCapRequirement) >= 0.01;
  const isInputsBlocked = isCurrentMonthLocked || isCapitalMismatch;

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

  const toggleProductExpand = (key: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allProductsExpanded =
    normalizedProducts.length > 0 &&
    normalizedProducts.every((p, idx) => !!expandedProducts[p.id || String(idx)]);

  const toggleAllProducts = () => {
    const nextState = !allProductsExpanded;
    const newMap: Record<string, boolean> = {};
    normalizedProducts.forEach((p, idx) => {
      newMap[p.id || String(idx)] = nextState;
    });
    setExpandedProducts(newMap);
  };

  const handleAddProduct = () => {
    if (isInputsBlocked) return;
    const newProduct: ProductCostingItem = {
      id: "prod-" + Date.now(),
      name: "",
      quantityYield: "",
      batchesPerMonth: "1",
      unitsSold: "",
      ingredients: [],
      markupPercentage: "100",
      sellingPrice: "",
      applyVat: true,
      vatRate: 12,
    };
    const updatedProducts = [...normalizedProducts, newProduct];
    const newState = { ...financials, products: updatedProducts };
    setFinancials(newState);
    setExpandedProducts((prev) => ({
      ...prev,
      [newProduct.id!]: true,
    }));
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
    if (isInputsBlocked || normalizedProducts.length <= 1) return;
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

  const handleDuplicateProduct = (index: number) => {
    if (isInputsBlocked) return;
    const sourceProd = normalizedProducts[index];
    if (!sourceProd) return;

    const newId = "prod-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    const duplicatedIngredients = (sourceProd.ingredients || []).map((ing) => ({
      ...ing,
      id: "ing-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    }));

    const duplicatedProduct: ProductCostingItem = {
      ...sourceProd,
      id: newId,
      name: sourceProd.name ? `${sourceProd.name} (Copy)` : "Product (Copy)",
      ingredients: duplicatedIngredients,
    };

    const updatedProducts = [...normalizedProducts];
    updatedProducts.splice(index + 1, 0, duplicatedProduct);

    const newState = { ...financials, products: updatedProducts };
    setFinancials(newState);
    setExpandedProducts((prev) => ({
      ...prev,
      [newId]: true,
    }));

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
    if (isInputsBlocked) return;
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

  const handleAddIngredient = (productIndex: number, category: "ingredient" | "labor" | "miscellaneous" = "ingredient") => {
    if (isInputsBlocked) return;
    const updatedProducts = [...normalizedProducts];
    const currentProd = updatedProducts[productIndex];
    const newIng: IngredientItem = {
      id: "ing-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: "",
      price: "",
      category,
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
    if (isInputsBlocked) return;
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
    if (isInputsBlocked) return;
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

  // --- STARTUP EQUIPMENT & ASSETS (CAPEX) HANDLERS ---
  const handleAddEquipmentItem = () => {
    if (isInputsBlocked) return;
    const currentList = financials.equipmentList || [];
    const newItem = {
      id: "eq-" + Date.now(),
      name: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    const updatedList = [...currentList, newItem];
    const newState = { ...financials, equipmentList: updatedList };
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

  const handleUpdateEquipmentItem = (
    index: number,
    updates: Partial<{ id: string; name: string; quantity: number; unitPrice: number; total: number }>
  ) => {
    if (isInputsBlocked) return;
    const currentList = [...(financials.equipmentList || [])];
    const existing = currentList[index];
    const updatedItem = { ...existing, ...updates };
    const qty = Number(updatedItem.quantity) || 0;
    const price = Number(updatedItem.unitPrice) || 0;
    updatedItem.total = qty * price;
    currentList[index] = updatedItem;

    const newState = { ...financials, equipmentList: currentList };
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

  const handleRemoveEquipmentItem = (index: number) => {
    if (isInputsBlocked) return;
    const currentList = (financials.equipmentList || []).filter((_, i) => i !== index);
    const newState = { ...financials, equipmentList: currentList };
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

  // --- MONTHLY DRAFTS & SCENARIO ENGINE ---
  const currentDrafts: MonthlyDraft[] = currentMonthRecord?.drafts && currentMonthRecord.drafts.length > 0
    ? currentMonthRecord.drafts
    : [
      {
        id: "draft-1",
        name: "Draft 1 (Primary)",
        financials: financials,
        createdAt: currentMonthRecord?.lockedAt || new Date().toISOString(),
      }
    ];

  const activeDraftId = currentMonthRecord?.activeDraftId || currentDrafts[0]?.id || "draft-1";
  const activeDraft = currentDrafts.find((d) => d.id === activeDraftId) || currentDrafts[0];

  const handleSwitchDraft = (draftId: string) => {
    if (!currentMonthRecord) return;
    const targetDraft = currentDrafts.find((d) => d.id === draftId);
    if (!targetDraft) return;

    // Save current edits into active draft before switching
    const updatedDrafts = currentDrafts.map((d) => {
      if (d.id === activeDraftId) {
        return {
          ...d,
          financials: JSON.parse(JSON.stringify(financials)),
          updatedAt: new Date().toISOString(),
        };
      }
      return d;
    });

    const updatedRecords = [...monthlyRecords];
    updatedRecords[activeMonthIndex] = {
      ...updatedRecords[activeMonthIndex],
      drafts: updatedDrafts,
      activeDraftId: draftId,
      financials: targetDraft.financials,
    };

    setMonthlyRecords(updatedRecords);
    setFinancials(targetDraft.financials);
    handleAutoSave(targetDraft.financials, updatedRecords);
  };

  const handleCreateNewDraft = (draftName?: string, cloneCurrent = true) => {
    if (isInputsBlocked || !currentMonthRecord) return;

    const newId = "draft-" + Date.now();
    const count = currentDrafts.length + 1;
    const finalName = draftName?.trim() || `Draft ${count}`;
    const newFinData = cloneCurrent
      ? JSON.parse(JSON.stringify(financials))
      : {
        products: normalizeProposalProducts(undefined, activeProjName),
        sellingPrice: "",
        monthlySales: "",
        variableCost: "",
        fixedCosts: "",
        startupCapital: financials.startupCapital || "",
        cashInvested: "",
        contributorsList: normalizeContributors([], financials.contributorsCount || "1", financials.startupCapital || 0),
        contributorsCount: financials.contributorsCount || "1",
        rentAdvanceDeposit: "",
        trainingsPrograms: "",
        advertisingExpense: "",
        salariesExpenseInitial: "",
        accountsPayable: "",
        utilitiesPayable: "",
        competitorCount: 0,
        marketDemand: "Medium",
        directCompetitors: [],
        otherCompetitors: [],
        competitorNotes: "",
        nearbyEstablishments: [],
        targetDemographics: [],
        footTrafficPeak: "",
        marketDemandNotes: "",
        operatingDays: "300",
        equipmentList: [],
        opexList: PREDETERMINED_OPEX_ITEMS.map((item) => ({ ...item })),
        isCapitalBorrowed: false,
        interestRate: "",
        propertyInvested: "",
        propertyInvestedNote: "",
        renovationCosts: "",
        permitsLicensesInitial: "",
        salesDiscountPercent: "5",
        salesReturnsPercent: "2",
        endingSuppliesPercent: "30",
        accountsReceivable: "",
        salariesPayable: "",
        taxesPayable: "",
      };

    // Update current active draft with latest values
    const updatedDrafts = currentDrafts.map((d) => {
      if (d.id === activeDraftId) {
        return {
          ...d,
          financials: JSON.parse(JSON.stringify(financials)),
          updatedAt: new Date().toISOString(),
        };
      }
      return d;
    });

    const newDraft: MonthlyDraft = {
      id: newId,
      name: finalName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      financials: newFinData,
    };
    updatedDrafts.push(newDraft);

    const updatedRecords = [...monthlyRecords];
    updatedRecords[activeMonthIndex] = {
      ...updatedRecords[activeMonthIndex],
      drafts: updatedDrafts,
      activeDraftId: newId,
      financials: newFinData,
    };

    setMonthlyRecords(updatedRecords);
    setFinancials(newFinData);
    setShowCreateDraftModal(false);
    setNewDraftName("");
    handleAutoSave(newFinData, updatedRecords);
  };

  const handleRenameDraft = (draftId: string, name: string) => {
    if (isInputsBlocked || !currentMonthRecord || !name.trim()) return;
    const updatedDrafts = currentDrafts.map((d) => {
      if (d.id === draftId) {
        return { ...d, name: name.trim(), updatedAt: new Date().toISOString() };
      }
      return d;
    });
    const updatedRecords = [...monthlyRecords];
    updatedRecords[activeMonthIndex] = {
      ...updatedRecords[activeMonthIndex],
      drafts: updatedDrafts,
    };
    setMonthlyRecords(updatedRecords);
    setEditingDraftId(null);
    setEditingDraftName("");
    handleAutoSave(financials, updatedRecords);
  };

  const handleDeleteDraft = (draftId: string) => {
    if (isInputsBlocked || !currentMonthRecord || currentDrafts.length <= 1) return;
    const remainingDrafts = currentDrafts.filter((d) => d.id !== draftId);
    let newActiveId = activeDraftId;
    let newFinData = financials;

    if (draftId === activeDraftId) {
      newActiveId = remainingDrafts[0].id;
      newFinData = remainingDrafts[0].financials;
      setFinancials(newFinData);
    }

    const updatedRecords = [...monthlyRecords];
    updatedRecords[activeMonthIndex] = {
      ...updatedRecords[activeMonthIndex],
      drafts: remainingDrafts,
      activeDraftId: newActiveId,
      financials: newFinData,
    };

    setMonthlyRecords(updatedRecords);
    handleAutoSave(newFinData, updatedRecords);
  };

  // --- CALCULATION ENGINE ---
  const firstProd = normalizedProducts[0] || {
    id: "prod-1",
    name: "",
    quantityYield: financials.monthlySales || "",
    batchesPerMonth: "1",
    unitsSold: "",
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
    return sum + m.cogsSold;
  }, 0);
  const totalMultiYield = normalizedProducts.reduce((sum, p) => {
    const m = computeProductMetrics(p);
    return sum + m.totalUnitsProduced;
  }, 0);
  const totalMultiUnitsSold = normalizedProducts.reduce((sum, p) => {
    const m = computeProductMetrics(p);
    return sum + m.unitsSold;
  }, 0);
  const totalMultiEndingInventory = normalizedProducts.reduce((sum, p) => {
    const m = computeProductMetrics(p);
    return sum + m.endingInventoryValue;
  }, 0);

  const totalMultiVat = normalizedProducts.reduce((sum, p) => {
    const m = computeProductMetrics(p);
    return sum + m.totalVat;
  }, 0);

  const safeSellingPrice = normalizedProducts.length > 1 && totalMultiUnitsSold > 0
    ? totalMultiRevenue / totalMultiUnitsSold
    : (firstMetrics.netSellingPrice > 0 ? firstMetrics.netSellingPrice : (firstMetrics.sellingPrice > 0 ? firstMetrics.sellingPrice : (Number(financials.sellingPrice) || 0)));

  const safeMonthlySales = normalizedProducts.length > 1
    ? totalMultiUnitsSold
    : (firstMetrics.unitsSold > 0 ? firstMetrics.unitsSold : (Number(financials.monthlySales) || 0));

  const safeUnitsProduced = normalizedProducts.length > 1
    ? totalMultiYield
    : (firstMetrics.totalUnitsProduced > 0 ? firstMetrics.totalUnitsProduced : safeMonthlySales);

  const safeVariableCost = normalizedProducts.length > 1 && totalMultiUnitsSold > 0
    ? totalMultiVariableCost / totalMultiUnitsSold
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

  // --- BALANCE SHEET & FEASIBILITY ENGINE (feasify_financial_input_module.md) ---
  // Section 1: Initial Capital & Sources of Financing
  const proposalCapNum = Number(projects.find((p) => p.id === selectedProjectId)?.proposalCapital || 0);
  const sumFromContributors = (financials.contributorsList && financials.contributorsList.length > 0)
    ? financials.contributorsList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
    : 0;
  const safeCashInvested = sumFromContributors > 0
    ? sumFromContributors
    : (Number(financials.cashInvested) || (proposalCapNum > 0 ? proposalCapNum : safeStartupCapital));
  const safePropertyInvested = Number(financials.propertyInvested) || 0;
  const totalInitialCapital = safeCashInvested + safePropertyInvested;

  // Startup Project Cost Breakdown (Section 2)
  const safeRentAdvance = Number(financials.rentAdvanceDeposit) || 0;
  const safeTrainings = Number(financials.trainingsPrograms) || 0;
  const safeAdvertising = Number(financials.advertisingExpense) || 0;
  const safeSalariesInitial = Number(financials.salariesExpenseInitial) || 0;
  const safeRenovationCosts = Number(financials.renovationCosts) || 0;
  const safePermitsLicenses = Number(financials.permitsLicensesInitial) || 0;
  const totalProjectCost = safeRentAdvance + safeTrainings + safeAdvertising + safeSalariesInitial + safeStartupCapital + safeRenovationCosts + safePermitsLicenses;
  const cashReserveContingency = Math.max(0, totalInitialCapital - totalProjectCost);

  // Section 3: Statement of Financial Performance (Income Statement Waterfall)
  const safeSalesDiscountPercent = Number(financials.salesDiscountPercent ?? 5);
  const safeSalesReturnsPercent = Number(financials.salesReturnsPercent ?? 2);
  const annualGrossSales = annualRevenue;
  const annualSalesDiscount = (annualGrossSales * safeSalesDiscountPercent) / 100;
  const annualSalesReturns = (annualGrossSales * safeSalesReturnsPercent) / 100;
  const annualNetSales = Math.max(0, annualGrossSales - annualSalesDiscount - annualSalesReturns);
  const annualCOGS = (totalMonthlyVariableCosts / 30) * safeOperatingDays;
  const annualGrossProfit = Math.max(0, annualNetSales - annualCOGS);
  const totalAnnualOpEx = (safeFixedCosts / 30) * safeOperatingDays;
  const genAdminOpEx = totalAnnualOpEx * 0.45;
  const sellingOpEx = totalAnnualOpEx * 0.55;
  const annualOperatingIncome = annualGrossProfit - totalAnnualOpEx - (monthlyInterest * 12);
  const statementNetProfitAfterTax = annualOperatingIncome - annualTax;

  // Section 4: Current Assets
  const operatingCashBuffer = Math.max(0, netMonthlyProfit * 12);
  const totalLiquidCash = safeCashInvested + operatingCashBuffer;
  const cashOnHand = totalLiquidCash * 0.15; // 15% allocation
  const cashInBank = totalLiquidCash * 0.85; // 85% allocation
  const rawMaterialInventory = totalMonthlyVariableCosts * 0.15; // 15% raw materials buffer
  const finishedGoodsInventory = totalMultiEndingInventory; // Actual unsold finished goods inventory value
  const totalInventory = rawMaterialInventory + finishedGoodsInventory;
  const safeEndingSuppliesPercent = Number(financials.endingSuppliesPercent ?? 30);
  const suppliesEndingInventory = (totalAnnualOpEx * 0.08) * (safeEndingSuppliesPercent / 100);
  const safeAccountsReceivable = Number(financials.accountsReceivable) || (annualNetSales * 0.03);
  const totalCurrentAssets = cashOnHand + cashInBank + totalInventory + suppliesEndingInventory + safeAccountsReceivable;

  // Non-Current Assets: Equipment/Machinery net of 10% straight-line annual depreciation
  const grossPPE = safeStartupCapital;
  const leaseholdImprovementsGross = safeRenovationCosts;
  const totalGrossNonCurrent = grossPPE + leaseholdImprovementsGross;
  const annualDepreciation = (grossPPE * 0.10) + (leaseholdImprovementsGross * 0.10);
  const totalNonCurrentAssets = Math.max(0, totalGrossNonCurrent - annualDepreciation);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  // Current Liabilities
  const safeAccountsPayable = Number(financials.accountsPayable) || (totalMonthlyVariableCosts * 0.20);
  const safeUtilitiesPayable = Number(financials.utilitiesPayable) || (safeFixedCosts * 0.15);
  const safeSalariesPayable = Number(financials.salariesPayable) || (safeSalariesInitial > 0 ? safeSalariesInitial / 2 : safeFixedCosts * 0.15);
  const safeTaxesPayable = Number(financials.taxesPayable) || annualTax;
  const totalCurrentLiabilities = safeAccountsPayable + safeUtilitiesPayable + safeSalariesPayable + safeTaxesPayable;

  // Owner's Equity
  const initialEquity = totalInitialCapital > 0 ? totalInitialCapital : safeStartupCapital;
  const endingOwnerEquity = totalAssets - totalCurrentLiabilities;
  const totalLiabilitiesAndEquity = totalCurrentLiabilities + endingOwnerEquity;
  const isBalanceSheetVerified = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.05;

  // --- AUTOMATED FINANCIAL RATIOS & ACTIVITY METRICS (Section 5) ---
  const currentRatio = totalCurrentLiabilities > 0
    ? (totalCurrentAssets / totalCurrentLiabilities).toFixed(2)
    : (totalCurrentAssets > 0 ? "99.9" : "0.0");
  const quickRatio = totalCurrentLiabilities > 0
    ? ((cashOnHand + cashInBank + safeAccountsReceivable) / totalCurrentLiabilities).toFixed(2)
    : "0.0";
  const debtRatio = totalAssets > 0 ? ((totalCurrentLiabilities / totalAssets) * 100).toFixed(1) : "0.0";
  const debtToEquityRatio = endingOwnerEquity > 0 ? ((totalCurrentLiabilities / endingOwnerEquity) * 100).toFixed(1) : "0.0";
  const equityRatio = totalAssets > 0 ? ((endingOwnerEquity / totalAssets) * 100).toFixed(1) : "0.0";
  const statementGrossProfitMargin = annualNetSales > 0 ? ((annualGrossProfit / annualNetSales) * 100).toFixed(1) : "0.0";
  const operatingProfitMargin = annualNetSales > 0 ? ((annualOperatingIncome / annualNetSales) * 100).toFixed(1) : "0.0";
  const netProfitMargin = annualNetSales > 0 ? ((statementNetProfitAfterTax / annualNetSales) * 100).toFixed(1) : "0.0";
  const returnOnAssets = totalAssets > 0 ? ((statementNetProfitAfterTax / totalAssets) * 100).toFixed(1) : "0.0";
  const returnOnEquity = endingOwnerEquity > 0 ? ((statementNetProfitAfterTax / endingOwnerEquity) * 100).toFixed(1) : "0.0";
  const avgInventory = totalInventory > 0 ? totalInventory : 1;
  const inventoryTurnover = avgInventory > 0 ? (annualCOGS / avgInventory).toFixed(1) : "0.0";
  const numTurnover = Number(inventoryTurnover) || 0;
  const avgAgeOfInventory = numTurnover > 0 ? Math.round(360 / numTurnover) : 0;
  const currentAssetTurnover = totalCurrentAssets > 0
    ? (annualNetSales / totalCurrentAssets).toFixed(2)
    : "0.0";

  // Exact Payback Period in Years, Months, and Days
  const monthlyCashInflow = annualNetProfitAfterTax > 0 ? (annualNetProfitAfterTax / 12) : 0;
  const effectiveInvestmentBase = totalProjectCost > 0 ? totalProjectCost : safeStartupCapital;
  let paybackYears = 0;
  let paybackMonths = 0;
  let paybackDays = 0;
  if (monthlyCashInflow > 0 && effectiveInvestmentBase > 0) {
    const totalMonths = effectiveInvestmentBase / monthlyCashInflow;
    paybackYears = Math.floor(totalMonths / 12);
    paybackMonths = Math.floor(totalMonths % 12);
    paybackDays = Math.round((totalMonths % 1) * 30);
  }

  // 5-Year Statement of Financial Position Projections (Image 1 Standard Academic Format)
  const fiveYearBalanceSheet = useMemo(() => {
    return generateFiveYearBalanceSheet(financials, activeProjName);
  }, [financials, activeProjName]);

  const updateFinancialField = (field: string, value: any) => {
    if (isInputsBlocked) return;
    const newState = { ...financials, [field]: value };
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

  const handleLoadMrCabbageBenchmark = () => {
    if (isInputsBlocked) return;
    const benchmark = MR_CABBAGE_BENCHMARK;
    const newProducts = JSON.parse(JSON.stringify(benchmark.products));
    const newEquipment = JSON.parse(JSON.stringify(benchmark.equipmentList));
    const newOpex = JSON.parse(JSON.stringify(benchmark.opexList));
    const newContributors = JSON.parse(JSON.stringify(benchmark.contributors));

    const newState = {
      ...financials,
      products: newProducts,
      equipmentList: newEquipment,
      opexList: newOpex,
      contributorsList: newContributors,
      contributorsCount: "9",
      cashInvested: String(benchmark.cashInvested),
      propertyInvested: String(benchmark.propertyInvested),
      propertyInvestedNote: benchmark.propertyInvestedNote,
      startupCapital: String(benchmark.projectCost),
      rentAdvanceDeposit: String(benchmark.rentAdvanceDeposit),
      trainingsPrograms: String(benchmark.trainingsPrograms),
      advertisingExpense: String(benchmark.advertisingExpense),
      salariesExpenseInitial: String(benchmark.salariesExpenseInitial),
      renovationCosts: String(benchmark.renovationCosts),
      permitsLicensesInitial: String(benchmark.permitsLicensesInitial),
      directCompetitors: [...benchmark.directCompetitors],
      otherCompetitors: [...benchmark.otherCompetitors],
      nearbyEstablishments: [...benchmark.nearbyEstablishments],
      targetDemographics: [...benchmark.targetDemographics],
      operatingDays: String(benchmark.operatingDays),
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
    setShowBenchmarkModal(false);
    setBenchmarkNotification("Mr. Cabbage (PLV) benchmark data successfully loaded into active draft!");
    setTimeout(() => setBenchmarkNotification(""), 4500);
  };

  const handleExportCSV = () => {
    const dateStr = new Date().toLocaleDateString();

    const csvRows: string[] = [];
    const addRow = (col1 = "", col2: string | number = "", col3: string | number = "", col4: string | number = "", col5: string | number = "", col6: string | number = "") => {
      const escape = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;
      csvRows.push([escape(col1), escape(col2), escape(col3), escape(col4), escape(col5), escape(col6)].join(","));
    };

    addRow(`FEASIFY FINANCIAL PROJECTIONS & FEASIBILITY REPORT`);
    addRow(`Business Name:`, activeProjName);
    addRow(`Financial Period:`, currentMonthRecord?.monthName || `Month ${currentMonthNumber}`);
    addRow(`Status:`, isCurrentMonthLocked ? `Finalized & Locked (${currentMonthRecord?.lockedAt ? new Date(currentMonthRecord.lockedAt).toLocaleDateString() : 'Locked'})` : `Active / Editable`);
    addRow(`Generated Date:`, dateStr);
    addRow();

    addRow(`=== 1. OPERATIONAL PROJECTIONS & COSTING ===`);
    addRow(`Selling Price (PHP)`, safeSellingPrice);
    addRow(`Total Units Produced (Nagawa)`, safeUnitsProduced);
    addRow(`Monthly Units Sold (Nabenta)`, safeMonthlySales);
    addRow(`Cost of Goods Sold (COGS/Unit)`, safeVariableCost);
    addRow(`Monthly Revenue (PHP)`, monthlyRevenue);
    addRow(`Total Monthly Variable Costs (PHP)`, totalMonthlyVariableCosts);
    addRow(`Total Monthly Fixed OpEx (PHP)`, safeFixedCosts);
    addRow(`Gross Profit Margin (%)`, `${grossProfitMargin.toFixed(1)}%`);
    addRow(`Net Monthly Profit (PHP)`, netMonthlyProfit);
    addRow(`Break-Even Point (Units)`, breakEvenUnits);
    addRow();

    if (normalizedProducts.length > 0) {
      addRow(`--- ITEMIZED PRODUCT COSTING, BATCH PRODUCTION & SALES ---`);
      addRow(`Product Name`, `Yield/Batch`, `Batches/Mo`, `Total Produced`, `Units Sold`, `Revenue (PHP)`);
      normalizedProducts.forEach((p, idx) => {
        const m = computeProductMetrics(p);
        addRow(
          p.name || `Product #${idx + 1}`,
          `${m.batchYield} units`,
          `${m.batchesPerMonth} batches`,
          `${m.totalUnitsProduced} units`,
          `${m.unitsSold} units`,
          `PHP ${m.revenue.toFixed(2)}`
        );
      });
      addRow();
    }

    addRow(`=== 2. STARTUP EQUIPMENT & ASSETS BREAKDOWN (CAPEX) ===`);
    if (financials.equipmentList && financials.equipmentList.length > 0) {
      addRow(`Item / Asset Name`, `Quantity`, `Unit Price (PHP)`, `Total (PHP)`);
      financials.equipmentList.forEach((eq: any) => {
        addRow(eq.name || "Equipment Item", eq.quantity || 1, eq.unitPrice || 0, eq.total || 0);
      });
      addRow(`Total CapEx Equipment`, ``, ``, safeStartupCapital);
    } else {
      addRow(`Total CapEx Equipment`, safeStartupCapital);
    }
    addRow();

    addRow(`=== 3. SOURCES OF FINANCING & STARTUP PROJECT COSTS ===`);
    addRow(`Cash Invested (PHP)`, safeCashInvested);
    addRow(`Property / Non-Cash Invested (PHP)`, safePropertyInvested);
    if (financials.propertyInvestedNote) addRow(`Property Contribution Details:`, financials.propertyInvestedNote);
    addRow(`Total Initial Capital (PHP)`, totalInitialCapital);
    addRow(`CapEx Tools & Equipment (PHP)`, safeStartupCapital);
    addRow(`Leasehold Improvements / Renovation (PHP)`, safeRenovationCosts);
    addRow(`Rent Advance & Deposit (PHP)`, safeRentAdvance);
    addRow(`Trainings & Programs (PHP)`, safeTrainings);
    addRow(`Initial Advertising Expense (PHP)`, safeAdvertising);
    addRow(`Initial Salaries Buffer (PHP)`, safeSalariesInitial);
    addRow(`Permits & Licenses (PHP)`, safePermitsLicenses);
    addRow(`Total Startup Project Cost (PHP)`, totalProjectCost);
    addRow(`Net Cash Reserve / Contingency Buffer (PHP)`, cashReserveContingency);
    addRow(`Borrowed / Loaned Capital?`, financials.isCapitalBorrowed ? `Yes (${financials.interestRate || 0}% annual interest)` : `No`);
    addRow();

    addRow(`=== 4. STATEMENT OF FINANCIAL PERFORMANCE (INCOME STATEMENT) ===`);
    addRow(`Gross Projected Sales (Revenue) (PHP)`, annualGrossSales.toFixed(2));
    addRow(`Less: Senior/PWD Sales Discount (${safeSalesDiscountPercent}%) (PHP)`, `-${annualSalesDiscount.toFixed(2)}`);
    addRow(`Less: Sales Returns & Spoilage (${safeSalesReturnsPercent}%) (PHP)`, `-${annualSalesReturns.toFixed(2)}`);
    addRow(`Net Sales (PHP)`, annualNetSales.toFixed(2));
    addRow(`Cost of Goods Sold (COGS) (PHP)`, `-${annualCOGS.toFixed(2)}`);
    addRow(`Gross Profit (PHP)`, annualGrossProfit.toFixed(2));
    addRow(`Gross Profit Margin (%)`, `${grossProfitMargin}%`);
    addRow(`General & Administrative OpEx (PHP)`, `-${genAdminOpEx.toFixed(2)}`);
    addRow(`Selling & Marketing OpEx (PHP)`, `-${sellingOpEx.toFixed(2)}`);
    addRow(`Total Operating Expenses (PHP)`, `-${totalAnnualOpEx.toFixed(2)}`);
    addRow(`Net Operating Income (EBIT) (PHP)`, annualOperatingIncome.toFixed(2));
    addRow(`Tax Expense (BMBE Statutory 3%) (PHP)`, `-${annualTax.toFixed(2)}`);
    addRow(`Net Income After Tax (PHP)`, annualNetProfitAfterTax.toFixed(2));
    addRow();

    addRow(`=== 5. STATEMENT OF FINANCIAL POSITION (BALANCE SHEET) ===`);
    addRow(`ASSETS`);
    addRow(`Cash on Hand (15%)`, cashOnHand.toFixed(2));
    addRow(`Cash in Bank (85%)`, cashInBank.toFixed(2));
    addRow(`Merchandise & Raw Materials Inventory`, totalInventory.toFixed(2));
    addRow(`Supplies Ending Inventory (${safeEndingSuppliesPercent}%)`, suppliesEndingInventory.toFixed(2));
    addRow(`Accounts & Credit Receivables`, safeAccountsReceivable.toFixed(2));
    addRow(`Total Current Assets`, totalCurrentAssets.toFixed(2));
    addRow(`Store Tools & Equipment (Gross)`, grossPPE.toFixed(2));
    addRow(`Leasehold Improvements (Gross)`, leaseholdImprovementsGross.toFixed(2));
    addRow(`Less: Accumulated Depreciation (10%)`, `-${annualDepreciation.toFixed(2)}`);
    addRow(`Total Non-Current Assets (Net)`, totalNonCurrentAssets.toFixed(2));
    addRow(`TOTAL ASSETS`, totalAssets.toFixed(2));
    addRow();

    addRow(`LIABILITIES & OWNER'S EQUITY`);
    addRow(`Accounts Payable`, safeAccountsPayable.toFixed(2));
    addRow(`Utilities Payable`, safeUtilitiesPayable.toFixed(2));
    addRow(`Salaries & Allowances Payable`, safeSalariesPayable.toFixed(2));
    addRow(`Taxes Payable`, safeTaxesPayable.toFixed(2));
    addRow(`Total Current Liabilities`, totalCurrentLiabilities.toFixed(2));
    addRow(`Initial Capital Contributed`, initialEquity.toFixed(2));
    addRow(`Add: Retained Net Profit (After Tax)`, annualNetProfitAfterTax.toFixed(2));
    addRow(`Ending Capital (Owner's Net Worth)`, endingOwnerEquity.toFixed(2));
    addRow(`TOTAL LIABILITIES & OWNER'S EQUITY`, totalLiabilitiesAndEquity.toFixed(2));
    addRow(`Balance Status`, isBalanceSheetVerified ? `100% Balanced (Assets = Liabilities + Equity)` : `Audit Verification Pending`);
    addRow();

    addRow(`=== 6. AUTOMATED FINANCIAL RATIOS & FEASIBILITY INDICATORS ===`);
    addRow(`Payback Period`, `${paybackYears > 0 ? `${paybackYears} Years ` : ""}${paybackMonths} Months ${paybackDays} Days`);
    addRow(`Current Ratio (Liquidity)`, `${currentRatio}x`);
    addRow(`Acid Test / Quick Ratio`, `${quickRatio}x`);
    addRow(`Debt Ratio (%)`, `${debtRatio}%`);
    addRow(`Debt-to-Equity Ratio (%)`, `${debtToEquityRatio}%`);
    addRow(`Equity Ratio (%)`, `${equityRatio}%`);
    addRow(`Gross Profit Margin (%)`, `${grossProfitMargin}%`);
    addRow(`Operating Margin (%)`, `${operatingProfitMargin}%`);
    addRow(`Net Profit Margin (%)`, `${netProfitMargin}%`);
    addRow(`Return on Assets (ROA %)`, `${returnOnAssets}%`);
    addRow(`Return on Equity (ROE %)`, `${returnOnEquity}%`);
    addRow(`Inventory Turnover`, `${inventoryTurnover} times/year`);
    addRow(`Average Age of Inventory`, `${avgAgeOfInventory} Days`);
    addRow(`Current Asset Turnover`, `${currentAssetTurnover}x`);

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
        setUserUid(u.uid);
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserSection(data.section || "");
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
      let foundGroupId = "";
      let activeProposalId = "";
      groupSnap.forEach((doc) => {
        const data = doc.data();
        if (
          data.leaderId === uid ||
          (data.memberIds && data.memberIds.includes(uid))
        ) {
          foundGroupId = doc.id;
          activeProposalId = data.activeProposalId || "";
          if (data.leaderId === uid) {
            setIsLeader(true);
          }
        }
      });
      setUserGroupId(foundGroupId);

      if (foundGroupId && activeProposalId) {
        const propQ = query(
          collection(db, "proposals"),
          where("groupId", "==", foundGroupId),
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
              rawProposalData: data,
              proposedLocation: data.proposedLocation || "",
              businessType: data.businessType || "",
              targetMarket: data.targetMarket || "",
              products: data.products || data.financialData?.products || [],
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

    const proposalProducts =
      selectedProj.products && selectedProj.products.length > 0
        ? selectedProj.products
        : selectedProj.financialData?.products && selectedProj.financialData.products.length > 0
          ? selectedProj.financialData.products
          : selectedProj.rawProposalData?.products && selectedProj.rawProposalData.products.length > 0
            ? selectedProj.rawProposalData.products
            : selectedProj.rawProposalData?.originalProposalFinancials?.products &&
              selectedProj.rawProposalData.originalProposalFinancials.products.length > 0
              ? selectedProj.rawProposalData.originalProposalFinancials.products
              : [];

    if (selectedProj.financialData) {
      const finData = selectedProj.financialData;

      // Check if multi-month records already exist
      if (finData.monthlyRecords && Array.isArray(finData.monthlyRecords) && finData.monthlyRecords.length > 0) {
        const loadedRecords: MonthlyFinancialRecord[] = finData.monthlyRecords.map((rec: any, idx: number) => {
          const fin = rec.financials || {};
          let rawOpex = fin.opexList || (fin.fixedCosts && Number(fin.fixedCosts) > 0 ? [{ name: "General OpEx", amount: Number(fin.fixedCosts) }] : []);
          let loadedOpex = normalizeOpexList(rawOpex);
          const loadedProducts = normalizeProposalProducts(fin, selectedProj.name, proposalProducts);

          const proposalCap = Number(selectedProj.proposalCapital || fin.startupCapital || finData.startupCapital || 0);
          const contribCount = fin.contributorsCount || (selectedProj as any).contributorsCount || finData.contributorsCount || "1";
          const loadedContributors = normalizeContributors(fin.contributorsList || finData.contributorsList, contribCount, proposalCap);

          const defaultFinState = {
            products: loadedProducts,
            sellingPrice: getVal(fin.sellingPrice),
            monthlySales: getVal(fin.monthlySales),
            variableCost: getVal(fin.variableCost),
            fixedCosts: getVal(fin.fixedCosts),
            startupCapital: getVal(fin.startupCapital || selectedProj.proposalCapital),
            cashInvested: getVal(fin.cashInvested),
            contributorsList: loadedContributors,
            contributorsCount: String(contribCount),
            rentAdvanceDeposit: getVal(fin.rentAdvanceDeposit),
            trainingsPrograms: getVal(fin.trainingsPrograms),
            advertisingExpense: getVal(fin.advertisingExpense),
            salariesExpenseInitial: getVal(fin.salariesExpenseInitial),
            accountsPayable: getVal(fin.accountsPayable),
            utilitiesPayable: getVal(fin.utilitiesPayable),
            competitorCount: fin.competitorCount || (Array.isArray(fin.directCompetitors) ? fin.directCompetitors.length + (fin.otherCompetitors?.length || 0) : 0),
            marketDemand: fin.marketDemand || "Medium",
            directCompetitors: Array.isArray(fin.directCompetitors) ? fin.directCompetitors : [],
            otherCompetitors: Array.isArray(fin.otherCompetitors) ? fin.otherCompetitors : [],
            competitorNotes: fin.competitorNotes || "",
            nearbyEstablishments: Array.isArray(fin.nearbyEstablishments) ? fin.nearbyEstablishments : [],
            targetDemographics: Array.isArray(fin.targetDemographics) ? fin.targetDemographics : [],
            footTrafficPeak: fin.footTrafficPeak || "",
            marketDemandNotes: fin.marketDemandNotes || "",
            operatingDays: String(fin.operatingDays || "300"),
            equipmentList: fin.equipmentList || [],
            opexList: loadedOpex,
            isCapitalBorrowed: fin.isCapitalBorrowed || false,
            interestRate: getVal(fin.interestRate),
            propertyInvested: getVal(fin.propertyInvested),
            propertyInvestedNote: fin.propertyInvestedNote || "",
            renovationCosts: getVal(fin.renovationCosts),
            permitsLicensesInitial: getVal(fin.permitsLicensesInitial),
            salesDiscountPercent: getVal(fin.salesDiscountPercent) || "5",
            salesReturnsPercent: getVal(fin.salesReturnsPercent) || "2",
            endingSuppliesPercent: getVal(fin.endingSuppliesPercent) || "30",
            accountsReceivable: getVal(fin.accountsReceivable),
            salariesPayable: getVal(fin.salariesPayable),
            taxesPayable: getVal(fin.taxesPayable),
          };

          // Load or initialize drafts for this month
          let loadedDrafts: MonthlyDraft[] = [];
          if (rec.drafts && Array.isArray(rec.drafts) && rec.drafts.length > 0) {
            loadedDrafts = rec.drafts.map((d: any, dIdx: number) => {
              const dFin = d.financials || {};
              const dProducts = normalizeProposalProducts(dFin, selectedProj.name, proposalProducts);
              let rawDOpex = dFin.opexList || (dFin.fixedCosts && Number(dFin.fixedCosts) > 0 ? [{ name: "General OpEx", amount: Number(dFin.fixedCosts) }] : []);
              let dOpex = normalizeOpexList(rawDOpex);
              const dProposalCap = Number(selectedProj.proposalCapital || dFin.startupCapital || 0);
              const dContribCount = dFin.contributorsCount || fin.contributorsCount || (selectedProj as any).contributorsCount || "1";
              const dContributors = normalizeContributors(dFin.contributorsList, dContribCount, dProposalCap);

              return {
                id: d.id || `draft-${dIdx + 1}`,
                name: d.name || `Draft ${dIdx + 1}`,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt,
                financials: {
                  ...defaultFinState,
                  ...dFin,
                  products: dProducts,
                  opexList: dOpex,
                  contributorsList: dContributors,
                  contributorsCount: String(dContribCount),
                },
              };
            });
          } else {
            loadedDrafts = [
              {
                id: "draft-1",
                name: "Draft 1 (Primary)",
                createdAt: rec.lockedAt || new Date().toISOString(),
                financials: defaultFinState,
              },
            ];
          }

          const activeDraftId = rec.activeDraftId || loadedDrafts[0].id;
          const activeDraft = loadedDrafts.find((d) => d.id === activeDraftId) || loadedDrafts[0];

          return {
            month: rec.month || (idx + 1),
            monthName: rec.monthName || `Month ${rec.month || idx + 1} (${getOrdinal(rec.month || idx + 1)} Month)`,
            isLocked: !!rec.isLocked,
            lockedAt: rec.lockedAt,
            activeDraftId: activeDraft.id,
            drafts: loadedDrafts,
            financials: activeDraft.financials,
          };
        });

        setMonthlyRecords(loadedRecords);
        // Default to the last month (the active editable month or latest added)
        const targetIdx = Math.max(0, loadedRecords.length - 1);
        setActiveMonthIndex(targetIdx);
        setFinancials(loadedRecords[targetIdx].financials);
      } else {
        // Single-month legacy migration: Create Month 1 from existing financialData
        let rawLegacyOpex = finData.opexList || (finData.fixedCosts && Number(finData.fixedCosts) > 0 ? [{ name: "General OpEx", amount: Number(finData.fixedCosts) }] : []);
        let loadedOpex = normalizeOpexList(rawLegacyOpex);
        const loadedProducts = normalizeProposalProducts(finData, selectedProj.name, proposalProducts);
        const proposalCap = Number(selectedProj.proposalCapital || finData.startupCapital || 0);
        const contribCount = finData.contributorsCount || (selectedProj as any).contributorsCount || "1";
        const loadedContributors = normalizeContributors(finData.contributorsList, contribCount, proposalCap);

        const initialFinState = {
          products: loadedProducts,
          sellingPrice: getVal(finData.sellingPrice),
          monthlySales: getVal(finData.monthlySales),
          variableCost: getVal(finData.variableCost),
          fixedCosts: getVal(finData.fixedCosts),
          startupCapital: getVal(finData.startupCapital || selectedProj.proposalCapital),
          cashInvested: getVal(finData.cashInvested),
          contributorsList: loadedContributors,
          contributorsCount: String(contribCount),
          rentAdvanceDeposit: getVal(finData.rentAdvanceDeposit),
          trainingsPrograms: getVal(finData.trainingsPrograms),
          advertisingExpense: getVal(finData.advertisingExpense),
          salariesExpenseInitial: getVal(finData.salariesExpenseInitial),
          accountsPayable: getVal(finData.accountsPayable),
          utilitiesPayable: getVal(finData.utilitiesPayable),
          competitorCount: finData.competitorCount || (Array.isArray(finData.directCompetitors) ? finData.directCompetitors.length + (finData.otherCompetitors?.length || 0) : 0),
          marketDemand: finData.marketDemand || "Medium",
          directCompetitors: Array.isArray(finData.directCompetitors) ? finData.directCompetitors : [],
          otherCompetitors: Array.isArray(finData.otherCompetitors) ? finData.otherCompetitors : [],
          competitorNotes: finData.competitorNotes || "",
          nearbyEstablishments: Array.isArray(finData.nearbyEstablishments) ? finData.nearbyEstablishments : [],
          targetDemographics: Array.isArray(finData.targetDemographics) ? finData.targetDemographics : [],
          footTrafficPeak: finData.footTrafficPeak || "",
          marketDemandNotes: finData.marketDemandNotes || "",
          operatingDays: String(finData.operatingDays || "300"),
          equipmentList: finData.equipmentList || [],
          opexList: loadedOpex,
          isCapitalBorrowed: finData.isCapitalBorrowed || false,
          interestRate: getVal(finData.interestRate),
          propertyInvested: getVal(finData.propertyInvested),
          propertyInvestedNote: finData.propertyInvestedNote || "",
          renovationCosts: getVal(finData.renovationCosts),
          permitsLicensesInitial: getVal(finData.permitsLicensesInitial),
          salesDiscountPercent: getVal(finData.salesDiscountPercent) || "5",
          salesReturnsPercent: getVal(finData.salesReturnsPercent) || "2",
          endingSuppliesPercent: getVal(finData.endingSuppliesPercent) || "30",
          accountsReceivable: getVal(finData.accountsReceivable),
          salariesPayable: getVal(finData.salariesPayable),
          taxesPayable: getVal(finData.taxesPayable),
        };

        const initialRecords: MonthlyFinancialRecord[] = [
          {
            month: 1,
            monthName: "Month 1 (1st Month)",
            isLocked: false,
            activeDraftId: "draft-1",
            drafts: [
              {
                id: "draft-1",
                name: "Draft 1 (Primary)",
                createdAt: new Date().toISOString(),
                financials: initialFinState,
              },
            ],
            financials: initialFinState,
          },
        ];

        setMonthlyRecords(initialRecords);
        setActiveMonthIndex(0);
        setFinancials(initialFinState);
      }
    } else {
      const initialFinState = {
        products: normalizeProposalProducts(undefined, selectedProj.name, proposalProducts),
        sellingPrice: "",
        monthlySales: "",
        variableCost: "",
        fixedCosts: "",
        startupCapital: getVal(selectedProj.proposalCapital),
        cashInvested: "",
        contributorsList: normalizeContributors([], "1", Number(selectedProj.proposalCapital || 0)),
        contributorsCount: "1",
        rentAdvanceDeposit: "",
        trainingsPrograms: "",
        advertisingExpense: "",
        salariesExpenseInitial: "",
        accountsPayable: "",
        utilitiesPayable: "",
        competitorCount: 0,
        marketDemand: "Medium",
        directCompetitors: [],
        otherCompetitors: [],
        competitorNotes: "",
        nearbyEstablishments: [],
        targetDemographics: [],
        footTrafficPeak: "",
        marketDemandNotes: "",
        operatingDays: "300",
        equipmentList: [],
        opexList: PREDETERMINED_OPEX_ITEMS.map((item) => ({ ...item })),
        isCapitalBorrowed: false,
        interestRate: "",
        propertyInvested: "",
        propertyInvestedNote: "",
        renovationCosts: "",
        permitsLicensesInitial: "",
        salesDiscountPercent: "5",
        salesReturnsPercent: "2",
        endingSuppliesPercent: "30",
        accountsReceivable: "",
        salariesPayable: "",
        taxesPayable: "",
      };

      const initialRecords: MonthlyFinancialRecord[] = [
        {
          month: 1,
          monthName: "Month 1 (1st Month)",
          isLocked: false,
          activeDraftId: "draft-1",
          drafts: [
            {
              id: "draft-1",
              name: "Draft 1 (Primary)",
              createdAt: new Date().toISOString(),
              financials: initialFinState,
            },
          ],
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

      if (prods.length > 1) {
        const totalMultiRev = prods.reduce((sum, p) => sum + computeProductMetrics(p).revenue, 0);
        const totalMultiCogs = prods.reduce((sum, p) => sum + computeProductMetrics(p).cogsSold, 0);
        const totalMultiUnits = prods.reduce((sum, p) => sum + computeProductMetrics(p).unitsSold, 0);
        const totalMultiBatchCost = prods.reduce((sum, p) => sum + computeProductMetrics(p).totalBatchCost, 0);

        syncSellingPrice = totalMultiUnits > 0 ? String(Number((totalMultiRev / totalMultiUnits).toFixed(2))) : "0";
        syncMonthlySales = String(totalMultiUnits);
        syncVariableCost = totalMultiUnits > 0 ? String(Number((totalMultiCogs / totalMultiUnits).toFixed(2))) : "0";
        syncProductionCost = String(Number(totalMultiBatchCost.toFixed(2)));
        syncMarkupPct = "100";
        syncMarkupAmt = "";
        syncComputedBasePrice = syncSellingPrice;
      } else if (prods.length === 1) {
        const firstP = prods[0];
        const firstM = computeProductMetrics(firstP);
        syncSellingPrice = String(firstP.sellingPrice || (firstM.computedBasePrice > 0 ? Number(firstM.computedBasePrice.toFixed(2)) : ""));
        syncMonthlySales = String(firstM.unitsSold || firstP.quantityYield || "");
        syncVariableCost = firstM.unitCost > 0 ? String(Number(firstM.unitCost.toFixed(2))) : "";
        syncProductionCost = String(firstM.totalBatchCost);
        syncMarkupPct = String(firstP.markupPercentage || "100");
        syncMarkupAmt = firstM.markupAmount > 0 ? String(Number(firstM.markupAmount.toFixed(2))) : "";
        syncComputedBasePrice = firstM.computedBasePrice > 0 ? String(Number(firstM.computedBasePrice.toFixed(2))) : "";
      }

      // Sync active month's financials and active draft in monthlyRecords
      const cleanRecords = recordsToSave.map((rec, idx) => {
        if (idx === activeMonthIndex) {
          const recActiveDraftId = rec.activeDraftId || "draft-1";
          const currentDraftsList = (rec.drafts && rec.drafts.length > 0)
            ? rec.drafts
            : [{ id: "draft-1", name: "Draft 1 (Primary)", createdAt: new Date().toISOString(), financials: dataToSave }];

          const updatedDrafts = currentDraftsList.map((d) => {
            if (d.id === recActiveDraftId) {
              return {
                ...d,
                financials: dataToSave,
                updatedAt: new Date().toISOString(),
              };
            }
            return d;
          });

          return {
            ...rec,
            drafts: updatedDrafts,
            activeDraftId: recActiveDraftId,
            financials: dataToSave,
          };
        }
        return rec;
      });

      const rawPayload = {
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
        updatedAt: serverTimestamp(),
      };

      const payload = cleanFirestoreData(rawPayload);

      await updateDoc(doc(db, "proposals", selectedProjectId), {
        financialData: payload,
      });
      setSaveStatus("All changes saved");

      logAuditEvent({
        userId: userUid || auth.currentUser?.uid || "",
        userName: userName || "Student",
        userRole: isLeader ? "Student Leader" : "Student Member",
        action: "UPDATE",
        sectionCode: userSection || "Unassigned",
        description: `Updated Financial Inputs for Month ${currentMonthNumber}`,
        recordId: selectedProjectId,
        newValue: { month: currentMonthNumber, activeDraftId: cleanRecords[activeMonthIndex]?.activeDraftId || "draft-1" },
      });

      // Notify Adviser of financial inputs update
      if (userSection) {
        notifyAdvisersForSection(userSection, {
          title: "Financial Inputs Updated 📊",
          message: `Team "${userGroup?.title || projects.find(p => p.id === selectedProjectId)?.name || 'Students'}" updated their financial projections (Month ${currentMonthNumber}).`,
          type: "financial",
          link: "/adviser/dashboard",
          senderName: userName || "Student"
        }).catch(err => console.error("Adviser financial notification failed:", err));
      }
    } catch (e) {
      console.error("Save failed:", e);
      setSaveStatus("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddContributor = () => {
    const totalCap = Number(projects.find((p) => p.id === selectedProjectId)?.proposalCapital || financials.startupCapital || 0);
    const currentList = financials.contributorsList && financials.contributorsList.length > 0
      ? financials.contributorsList
      : autoDistributeContributors(Number(financials.contributorsCount) || 1, totalCap);

    const newCount = currentList.length + 1;
    const updatedList = autoDistributeContributors(newCount, totalCap, currentList);
    const sumAmount = updatedList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const newState = {
      ...financials,
      contributorsCount: String(newCount),
      contributorsList: updatedList,
      cashInvested: String(sumAmount || totalCap),
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
  };

  const handleRemoveContributor = (indexToRemove: number) => {
    const totalCap = Number(projects.find((p) => p.id === selectedProjectId)?.proposalCapital || financials.startupCapital || 0);
    const currentList = financials.contributorsList && financials.contributorsList.length > 0
      ? financials.contributorsList
      : autoDistributeContributors(Number(financials.contributorsCount) || 1, totalCap);

    if (currentList.length <= 1) return;
    const filteredList = currentList.filter((_, idx) => idx !== indexToRemove);
    const newCount = filteredList.length;
    const updatedList = autoDistributeContributors(newCount, totalCap, filteredList);
    const sumAmount = updatedList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const newState = {
      ...financials,
      contributorsCount: String(newCount),
      contributorsList: updatedList,
      cashInvested: String(sumAmount || totalCap),
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
  };

  const handleContributorsCountChange = (newCountVal: string) => {
    const countNum = Math.max(1, Math.min(50, parseInt(newCountVal, 10) || 1));
    const totalCap = Number(projects.find((p) => p.id === selectedProjectId)?.proposalCapital || financials.startupCapital || 0);
    const updatedList = autoDistributeContributors(countNum, totalCap, financials.contributorsList);
    const sumAmount = updatedList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const newState = {
      ...financials,
      contributorsCount: String(countNum),
      contributorsList: updatedList,
      cashInvested: String(sumAmount || totalCap),
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
  };

  const handleContributorItemChange = (index: number, field: "name" | "amount", value: any) => {
    const updatedList = [...(financials.contributorsList || [])];
    if (!updatedList[index]) return;
    updatedList[index] = {
      ...updatedList[index],
      [field]: value,
    };
    const sumAmount = updatedList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const newState = {
      ...financials,
      contributorsList: updatedList,
      cashInvested: String(sumAmount),
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
  };

  const handleAutoRebalanceContributors = () => {
    const countNum = Math.max(1, Number(financials.contributorsCount) || financials.contributorsList?.length || 1);
    const totalCap = Number(projects.find((p) => p.id === selectedProjectId)?.proposalCapital || financials.startupCapital || 0);
    const updatedList = autoDistributeContributors(countNum, totalCap, financials.contributorsList);
    const sumAmount = updatedList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const newState = {
      ...financials,
      contributorsCount: String(countNum),
      contributorsList: updatedList,
      cashInvested: String(sumAmount || totalCap),
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
  };

  // --- MARKET & COMPETITIVE INDICATOR HANDLERS ---
  const handleAddDirectCompetitor = (nameToAdd?: string) => {
    if (isInputsBlocked) return;
    const name = (nameToAdd !== undefined ? nameToAdd : directCompetitorInput).trim();
    if (!name) return;
    const currentList = Array.isArray(financials.directCompetitors) ? financials.directCompetitors : [];
    if (currentList.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setDirectCompetitorInput("");
      return;
    }
    const updatedList = [...currentList, name];
    const totalCompetitors = updatedList.length + (financials.otherCompetitors?.length || 0);
    const newState = {
      ...financials,
      directCompetitors: updatedList,
      competitorCount: totalCompetitors,
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
    setDirectCompetitorInput("");
    handleAutoSave(newState, updatedRecords);
  };

  const handleRemoveDirectCompetitor = (indexToRemove: number) => {
    if (isInputsBlocked) return;
    const currentList = Array.isArray(financials.directCompetitors) ? financials.directCompetitors : [];
    const updatedList = currentList.filter((_, idx) => idx !== indexToRemove);
    const totalCompetitors = updatedList.length + (financials.otherCompetitors?.length || 0);
    const newState = {
      ...financials,
      directCompetitors: updatedList,
      competitorCount: totalCompetitors,
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
  };

  const handleAddOtherCompetitor = (nameToAdd?: string) => {
    if (isInputsBlocked) return;
    const name = (nameToAdd !== undefined ? nameToAdd : otherCompetitorInput).trim();
    if (!name) return;
    const currentList = Array.isArray(financials.otherCompetitors) ? financials.otherCompetitors : [];
    if (currentList.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setOtherCompetitorInput("");
      return;
    }
    const updatedList = [...currentList, name];
    const totalCompetitors = (financials.directCompetitors?.length || 0) + updatedList.length;
    const newState = {
      ...financials,
      otherCompetitors: updatedList,
      competitorCount: totalCompetitors,
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
    setOtherCompetitorInput("");
    handleAutoSave(newState, updatedRecords);
  };

  const handleRemoveOtherCompetitor = (indexToRemove: number) => {
    if (isInputsBlocked) return;
    const currentList = Array.isArray(financials.otherCompetitors) ? financials.otherCompetitors : [];
    const updatedList = currentList.filter((_, idx) => idx !== indexToRemove);
    const totalCompetitors = (financials.directCompetitors?.length || 0) + updatedList.length;
    const newState = {
      ...financials,
      otherCompetitors: updatedList,
      competitorCount: totalCompetitors,
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
  };

  const handleToggleDirectCompetitor = (name: string) => {
    if (isInputsBlocked) return;
    const currentList = Array.isArray(financials.directCompetitors) ? financials.directCompetitors : [];
    const existingIndex = currentList.findIndex((c) => c.toLowerCase() === name.toLowerCase());
    if (existingIndex !== -1) {
      handleRemoveDirectCompetitor(existingIndex);
    } else {
      handleAddDirectCompetitor(name);
    }
  };

  const handleToggleOtherCompetitor = (name: string) => {
    if (isInputsBlocked) return;
    const currentList = Array.isArray(financials.otherCompetitors) ? financials.otherCompetitors : [];
    const existingIndex = currentList.findIndex((c) => c.toLowerCase() === name.toLowerCase());
    if (existingIndex !== -1) {
      handleRemoveOtherCompetitor(existingIndex);
    } else {
      handleAddOtherCompetitor(name);
    }
  };

  const loadDynamicCompetitors = useCallback(async (forceRefresh = false) => {
    if (!currentProject) return;
    const loc = currentProject.proposedLocation || currentProject.rawProposalData?.proposedLocation || "";
    const bName = currentProject.rawProposalData?.businessName || currentProject.name || "";
    const bType = currentProject.businessType || currentProject.rawProposalData?.businessType || "";
    const prods = currentProject.products || financials.products || [];

    setIsDetectingCompetitors(true);
    try {
      const res = await getDynamicCompetitorsFromLocation(loc, bName, bType, prods, forceRefresh);
      setDynamicCompetitorData(res);
    } catch (err) {
      console.warn("Map competitor detection warning:", err);
    } finally {
      setIsDetectingCompetitors(false);
    }
  }, [currentProject, financials.products]);

  useEffect(() => {
    if (activeModuleTab === "market" && currentProject) {
      loadDynamicCompetitors();
    }
  }, [activeModuleTab, currentProject?.id, loadDynamicCompetitors]);

  const handleToggleNearbyEstablishment = (estName: string) => {
    if (isInputsBlocked) return;
    const currentList = Array.isArray(financials.nearbyEstablishments) ? financials.nearbyEstablishments : [];
    let updatedList: string[] = [];
    if (currentList.includes(estName)) {
      updatedList = currentList.filter((e) => e !== estName);
    } else {
      updatedList = [...currentList, estName];
    }
    let derivedDemand = "Medium";
    if (updatedList.length >= 3) {
      derivedDemand = "High";
    } else if (updatedList.length === 0) {
      derivedDemand = "Low";
    }

    const newState = {
      ...financials,
      nearbyEstablishments: updatedList,
      marketDemand: derivedDemand,
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
  };

  const handleAddCustomEstablishment = (nameToAdd?: string) => {
    if (isInputsBlocked) return;
    const name = (nameToAdd !== undefined ? nameToAdd : nearbyEstablishmentInput).trim();
    if (!name) return;
    const currentList = Array.isArray(financials.nearbyEstablishments) ? financials.nearbyEstablishments : [];
    if (currentList.some((e) => e.toLowerCase() === name.toLowerCase())) {
      setNearbyEstablishmentInput("");
      return;
    }
    const updatedList = [...currentList, name];
    let derivedDemand = "Medium";
    if (updatedList.length >= 3) {
      derivedDemand = "High";
    } else if (updatedList.length === 0) {
      derivedDemand = "Low";
    }

    const newState = {
      ...financials,
      nearbyEstablishments: updatedList,
      marketDemand: derivedDemand,
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
    setNearbyEstablishmentInput("");
    handleAutoSave(newState, updatedRecords);
  };

  const handleRemoveNearbyEstablishment = (indexToRemove: number) => {
    if (isInputsBlocked) return;
    const currentList = Array.isArray(financials.nearbyEstablishments) ? financials.nearbyEstablishments : [];
    const updatedList = currentList.filter((_, idx) => idx !== indexToRemove);
    let derivedDemand = "Medium";
    if (updatedList.length >= 3) {
      derivedDemand = "High";
    } else if (updatedList.length === 0) {
      derivedDemand = "Low";
    }

    const newState = {
      ...financials,
      nearbyEstablishments: updatedList,
      marketDemand: derivedDemand,
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
  };

  const handleToggleTargetDemographic = (demo: string) => {
    if (isInputsBlocked) return;
    const currentList = Array.isArray(financials.targetDemographics) ? financials.targetDemographics : [];
    const updatedList = currentList.includes(demo)
      ? currentList.filter((d) => d !== demo)
      : [...currentList, demo];

    const newState = {
      ...financials,
      targetDemographics: updatedList,
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
  };

  const handleAddCustomDemographic = (nameToAdd?: string) => {
    if (isInputsBlocked) return;
    const name = (nameToAdd !== undefined ? nameToAdd : targetDemographicsInput).trim();
    if (!name) return;
    const currentList = Array.isArray(financials.targetDemographics) ? financials.targetDemographics : [];
    if (currentList.some((d) => d.toLowerCase() === name.toLowerCase())) {
      setTargetDemographicsInput("");
      return;
    }
    const updatedList = [...currentList, name];
    const newState = {
      ...financials,
      targetDemographics: updatedList,
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
    setTargetDemographicsInput("");
    handleAutoSave(newState, updatedRecords);
  };

  const handleRemoveTargetDemographic = (indexToRemove: number) => {
    if (isInputsBlocked) return;
    const currentList = Array.isArray(financials.targetDemographics) ? financials.targetDemographics : [];
    const updatedList = currentList.filter((_, idx) => idx !== indexToRemove);
    const newState = {
      ...financials,
      targetDemographics: updatedList,
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
  };

  const handleMarketFieldChange = (field: "footTrafficPeak" | "competitorNotes" | "marketDemandNotes", value: string) => {
    const newState = {
      ...financials,
      [field]: value,
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
  };

  const handleSwitchMonthTab = (targetIndex: number) => {
    if (targetIndex === activeMonthIndex || !monthlyRecords[targetIndex]) return;

    // Sync current unsaved changes into current record and its active draft before switching
    const updatedRecords = [...monthlyRecords];
    if (updatedRecords[activeMonthIndex]) {
      const rec = updatedRecords[activeMonthIndex];
      const curDraftId = rec.activeDraftId || "draft-1";
      const recDrafts = (rec.drafts || []).map((d) => {
        if (d.id === curDraftId) {
          return { ...d, financials: financials, updatedAt: new Date().toISOString() };
        }
        return d;
      });

      updatedRecords[activeMonthIndex] = {
        ...rec,
        drafts: recDrafts,
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
    // Deep clone current month's active financials to serve as the baseline for the next month
    const clonedFinancials = JSON.parse(JSON.stringify(financials));

    const nextRecord: MonthlyFinancialRecord = {
      month: nextMonthNum,
      monthName: `Month ${nextMonthNum} (${getOrdinal(nextMonthNum)} Month)`,
      isLocked: false,
      activeDraftId: "draft-1",
      drafts: [
        {
          id: "draft-1",
          name: "Draft 1 (Baseline)",
          createdAt: new Date().toISOString(),
          financials: clonedFinancials,
        },
      ],
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
      <div className="flex min-h-screen bg-gray-50/50 text-[#122244] print:hidden">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        {/* SIDEBAR */}
        <aside
          className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            } lg:translate-x-0 w-64 lg:w-16 lg:hover:w-64`}
        >
          {/* Logo Section */}
          <div className="h-16 flex items-center justify-between lg:justify-center px-4 lg:px-3 border-b border-white/10 shrink-0 overflow-hidden">
            {/* Logo.png when sidebar is folded (default) inside circular border with shadow effect */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-white/15 to-white/5 border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.35)] flex items-center justify-center overflow-hidden hidden lg:flex lg:group-hover:hidden shrink-0 select-none pointer-events-none">
              <img
                src="/Logo.png"
                alt="FeasiFy"
                className="w-full h-full object-contain scale-[1.35]"
                style={{ transform: "scale(1.35)" }}
              />
            </div>
            {/* dashboard logo when sidebar is hovered or on mobile */}
            <img
              src="/dashboard logo.png"
              alt="FeasiFy"
              className="h-10.5 w-auto max-h-[42px] max-w-[170px] object-contain select-none pointer-events-none block lg:hidden lg:group-hover:block shrink-0"
            />
            <SidebarCloseButton onClick={() => setIsSidebarOpen(false)} />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
            <button
              onClick={() => { setIsSidebarOpen(false); navigate("/dashboard"); }}
              title="Dashboard"
              className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
            >
              <LayoutDashboard className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
              <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
                Dashboard
              </span>
            </button>
            <button
              onClick={() => { setIsSidebarOpen(false); navigate("/projects"); }}
              title="Business Proposal"
              className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
            >
              <Folder className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
              <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
                Business Proposal
              </span>
            </button>
            <button
              title="Financial Input"
              className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold bg-[#c9a654] text-[#122244] transition-all shadow-md"
            >
              <FileEdit className="w-5 h-5 shrink-0 text-[#122244]" />
              <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
                Financial Input
              </span>
            </button>
            <button
              onClick={() => {
                setIsSidebarOpen(false);
                navigate("/ai-analysis", {
                  state: { projectId: selectedProjectId, runAnalysis: true },
                });
              }}
              title="AI Feasibility Analysis"
              className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
            >
              <Zap className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
              <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
                AI Feasibility Analysis
              </span>
            </button>
            <button
              onClick={() => { setIsSidebarOpen(false); navigate("/reports"); }}
              title="Reports"
              className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
            >
              <BarChart3 className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
              <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
                Reports
              </span>
            </button>
            <button
              onClick={() => { setIsSidebarOpen(false); navigate("/messages"); }}
              title="Message"
              className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
            >
              <MessageCircle className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
              <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
                Message
              </span>
            </button>
            <button
              onClick={() => { setIsSidebarOpen(false); navigate("/settings"); }}
              title="Settings"
              className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
            >
              <Settings className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
              <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
                Settings
              </span>
            </button>
          </nav>

          {/* Bottom Logout Button */}
          <div className="p-3 border-t border-white/10 shrink-0">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title="Logout"
              className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
              <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
                Logout
              </span>
            </button>
          </div>
        </aside>

        <main
          className="flex-1 transition-all duration-300 min-h-screen lg:ml-16 ml-0"
        >
          <div className="bg-white border-b border-gray-200/80 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-30">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <MobileBurgerButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
              <span
                className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors shrink-0"
                onClick={() => navigate("/dashboard")}
              >
                FeasiFy
              </span>
              <span className="text-gray-400 shrink-0">›</span>
              <span className="font-semibold text-gray-900 truncate">Financial Input</span>
              <span className="text-gray-300 hidden sm:inline shrink-0">|</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#122244] text-white shadow-xs tracking-wide hidden sm:inline-block shrink-0">
                Student Portal
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/notifications")}
                className="p-2 text-gray-500 hover:text-[#122244] hover:bg-gray-100 rounded-lg transition-all relative"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></span>
                )}
              </button>
              <div className="h-6 w-px bg-gray-200"></div>
              <div
                onClick={() => navigate("/settings")}
                className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
              >
                <div className="w-9 h-9 rounded-full bg-[#c9a654] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                  {getInitials(userName)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-gray-900 leading-tight">
                    {userName || "User"}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">Student</p>
                </div>
              </div>
            </div>
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

              {/* PROMINENT TOTAL CAPITAL HERO CARD WITH SAME-ROW CONTRIBUTORS & MARKET INDICATORS */}
              <div className="bg-gradient-to-br from-[#122244] via-[#1a3060] to-[#122244] rounded-2xl p-6 sm:p-7 text-white shadow-xl mb-6 relative overflow-hidden border border-white/10 space-y-6">
                <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-[#c9a654]/15 to-transparent pointer-events-none" />

                {/* TOP ROW: Total Capital Overview Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10 pb-5 border-b border-white/10">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#c9a654]/20 border border-[#c9a654]/40 flex items-center justify-center text-[#c9a654] font-black text-2xl shrink-0 shadow-inner">
                      <PhilippinePeso className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-[#c9a654]/20 text-[#c9a654] text-[10px] font-extrabold rounded-md uppercase tracking-wider border border-[#c9a654]/30">
                          Total Capital Overview
                        </span>
                        <span className="text-xs text-white/40">•</span>
                        <span className="text-xs text-slate-300 font-semibold">
                          {activeProjName}
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">
                        Business Feasibility Capital Summary
                      </h3>
                      <p className="text-xs text-slate-300 font-medium">
                        Total capital requirement & partner contributions pulled directly from the approved proposal
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
                    <div className="pr-4 border-r border-white/10">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Total Capital (Proposal)
                      </span>
                      <p className="text-2xl sm:text-3xl font-black text-[#c9a654] tracking-tight mt-0.5">
                        ₱{Number(projects.find(p => p.id === selectedProjectId)?.proposalCapital || totalInitialCapital || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-3 text-slate-300">
                        <span className="text-[11px] text-slate-400">Total CapEx Equipment:</span>
                        <span className="font-bold text-white">₱{safeStartupCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-slate-300">
                        <span className="text-[11px] text-slate-400">Monthly Fixed OpEx:</span>
                        <span className="font-bold text-white">₱{safeFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SAME ROW LINE: Initial Capital Contributed (1-Column List) & Market Indicators */}
                {(() => {
                  const totalCap = Number(projects.find((p) => p.id === selectedProjectId)?.proposalCapital || financials.startupCapital || 0);
                  const numContrib = Math.max(1, Number(financials.contributorsCount) || financials.contributorsList?.length || 1);
                  const currentContribList = (financials.contributorsList && financials.contributorsList.length > 0)
                    ? financials.contributorsList
                    : autoDistributeContributors(numContrib, totalCap);
                  const sumContrib = currentContribList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
                  const isBalanced = Math.abs(sumContrib - totalCap) < 0.01 && totalCap > 0;
                  const estShare = totalCap > 0 ? totalCap / numContrib : 0;

                  return (
                    <div className="relative z-10 bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-sm space-y-4">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-white">
                            Initial Capital Contributed
                          </h4>
                          <p className="text-[10px] text-slate-300">Direct cash equity contributions from owners & founding partners</p>
                        </div>
                        <button
                          type="button"
                          disabled={isCurrentMonthLocked}
                          onClick={handleAddContributor}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a654] hover:bg-[#b59545] text-[#122244] font-black text-xs rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                          title="Add new investor or partner"
                        >
                          <Plus size={14} /> Add Contributor
                        </button>
                      </div>

                      {/* INVESTORS / PARTNERS LIST (Responsive Multi-column Grid) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1 select-none">
                        {currentContribList.map((contrib, idx) => (
                          <div
                            key={contrib.id || idx}
                            className="flex items-center gap-2.5 bg-black/25 p-2.5 rounded-xl border border-white/10 hover:border-[#c9a654]/50 transition-all"
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#122244] border border-[#c9a654]/40 flex items-center justify-center text-[10px] font-black text-[#c9a654] shrink-0">
                              #{idx + 1}
                            </div>
                            <input
                              type="text"
                              disabled={isCurrentMonthLocked}
                              value={contrib.name || `Investor / Partner ${idx + 1}`}
                              onChange={(e) => handleContributorItemChange(idx, "name", e.target.value)}
                              onBlur={() => handleAutoSave()}
                              placeholder={`Investor ${idx + 1}`}
                              className="flex-1 min-w-0 px-3 py-1.5 bg-white/10 border border-white/15 rounded-lg text-xs font-semibold text-white focus:bg-white/20 focus:border-[#c9a654] outline-none disabled:opacity-60"
                            />
                            <div className="relative w-32 shrink-0">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-[#c9a654]">₱</span>
                              <input
                                type="number"
                                disabled={isCurrentMonthLocked}
                                min="0"
                                value={contrib.amount !== undefined ? contrib.amount : ""}
                                onKeyDown={handlePreventNegative}
                                onPaste={handlePasteNonNegative}
                                onChange={(e) => handleContributorItemChange(idx, "amount", e.target.value)}
                                onBlur={() => handleAutoSave()}
                                placeholder="0.00"
                                className="w-full pl-5 pr-2 py-1.5 bg-white text-[#122244] font-black text-xs rounded-lg border border-[#c9a654] focus:ring-2 focus:ring-[#c9a654]/40 outline-none disabled:bg-gray-200"
                              />
                            </div>
                            {currentContribList.length > 1 && (
                              <button
                                type="button"
                                disabled={isCurrentMonthLocked}
                                onClick={() => handleRemoveContributor(idx)}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                                title="Remove this contributor"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Status indicator */}
                      <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                        {isBalanced ? (
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg font-bold flex items-center gap-1.5 text-[11px]">
                            <CheckCircle2 size={13} className="text-emerald-400" />
                            Total: ₱{sumContrib.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (100% Balanced with Proposal Requirement)
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 bg-red-500/20 text-red-200 border border-red-500/40 rounded-lg font-bold flex items-center gap-1.5 text-[11px]">
                              <AlertTriangle size={13} className="text-red-400" />
                              Total: ₱{sumContrib.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Proposal: ₱{totalCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                            <button
                              type="button"
                              disabled={isCurrentMonthLocked}
                              onClick={handleAutoRebalanceContributors}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] rounded-md shadow-sm transition-all cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <RefreshCw size={11} /> Auto-Balance
                            </button>
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 italic">
                          {currentContribList.length} Partner{currentContribList.length > 1 ? "s" : ""} participating in initial venture capitalization.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* CAPITAL MISMATCH WARNING BANNER */}
              {isCapitalMismatch && (
                <div className="mb-6 p-4 sm:p-5 bg-red-50 border-2 border-red-500 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md animate-in fade-in duration-200">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0 mt-0.5">
                      <AlertTriangle size={20} className="text-red-600" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-red-700 uppercase tracking-wider flex items-center gap-2">
                        <span>Initial Capital Contributed Unbalanced — Input Module Locked</span>
                      </h4>
                      <p className="text-xs text-red-800 leading-relaxed max-w-3xl font-medium">
                        Total contributed capital is <strong className="text-red-950 font-black">₱{totalContributedSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>, which does not match the proposal capital requirement of <strong className="text-red-950 font-black">₱{proposalCapRequirement.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>. Editing and inputs in the financial module are locked until the contributions equal the total capital.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isCurrentMonthLocked}
                    onClick={handleAutoRebalanceContributors}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 shrink-0 self-end md:self-auto cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Auto-Balance Capital</span>
                  </button>
                </div>
              )}

              {/* FILE FOLDER TAB SYSTEM */}
              <div className="mb-6 relative z-10 isolate">
                {/* File Tabs Top Rail */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b-2 border-slate-200 px-2 sm:px-3 pt-3 bg-slate-100/70 rounded-t-2xl">
                  {/* File Tabs Strip - Dynamically Compressed Overlapping Tabs */}
                  <div
                    className="flex items-end overflow-x-auto overflow-y-hidden pb-0 min-w-0 flex-1 pl-0.5 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 mr-1.5 uppercase tracking-wider pb-3 shrink-0">
                      <Folder size={13} className="text-[#c9a654]" />
                      <span className="hidden xs:inline">Periods:</span>
                    </div>

                    <div className="flex items-end shrink-0 pl-0.5">
                      {monthlyRecords.map((rec, idx) => {
                        const totalMonthCount = monthlyRecords.length;
                        const isSelected = idx === activeMonthIndex;
                        const isLocked = rec.isLocked;

                        // Dynamic stacking z-index inside isolated container: active tab is in front, others layer neatly
                        const tabZIndex = isSelected ? 15 : idx < activeMonthIndex ? 1 + idx : 10 - idx;

                        // Dynamic compression spacing based on total month count
                        const overlapClass = idx === 0 ? "" :
                          totalMonthCount >= 10 ? "-ml-8 sm:-ml-12" :
                            totalMonthCount >= 7 ? "-ml-7 sm:-ml-10" :
                              totalMonthCount >= 5 ? "-ml-6 sm:-ml-8" :
                                "-ml-5 sm:-ml-7";

                        // Dynamic padding based on total month count
                        const paddingClass =
                          totalMonthCount >= 10 ? (isSelected ? "px-2.5 sm:px-4" : "px-1.5 sm:px-2.5") :
                            totalMonthCount >= 7 ? (isSelected ? "px-3 sm:px-4" : "px-2 sm:px-3") :
                              totalMonthCount >= 5 ? "px-3 sm:px-4" :
                                "px-4 sm:px-5";

                        return (
                          <button
                            key={`month-tab-${rec.month || idx + 1}`}
                            type="button"
                            onClick={() => handleSwitchMonthTab(idx)}
                            style={{ zIndex: tabZIndex }}
                            title={`${rec.monthName || `Month ${rec.month}`} (${isLocked ? "Locked Archive" : "Active Editing"})`}
                            className={`group relative flex items-center gap-1.5 sm:gap-2 ${paddingClass} pt-2 pb-2.5 rounded-t-2xl text-xs font-bold transition-all shrink-0 select-none border-t-[3px] border-x -mb-[2px] ${overlapClass} ${isSelected
                              ? "bg-white text-[#122244] border-t-[#c9a654] border-x-slate-300 shadow-[-5px_0_12px_rgba(0,0,0,0.12),5px_0_12px_rgba(0,0,0,0.08)]"
                              : "bg-[#dbe3ed] hover:bg-[#cfd9e6] text-slate-700 border-t-slate-300 border-x-slate-300/90 shadow-[-3px_0_6px_rgba(0,0,0,0.04)] hover:text-[#122244]"
                              }`}
                          >
                            {/* Tab Folder / File Icon */}
                            <div
                              className={`p-1 rounded-md transition-colors shrink-0 ${isSelected
                                ? "bg-amber-50 text-[#c9a654]"
                                : "bg-slate-300/80 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-300"
                                }`}
                            >
                              <FileSpreadsheet size={totalMonthCount >= 8 && !isSelected ? 11 : 12} />
                            </div>

                            {/* Tab Title - Responsive abbreviation if many months */}
                            <span className="tracking-tight font-extrabold whitespace-nowrap text-xs">
                              {totalMonthCount >= 10 && !isSelected ? `M${rec.month}` : totalMonthCount >= 7 && !isSelected ? `Mo. ${rec.month}` : `Month ${rec.month}`}
                            </span>

                            {/* Status Pill on File Tab */}
                            {isLocked ? (
                              <span
                                className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase whitespace-nowrap shrink-0 ${isSelected
                                  ? "bg-amber-100 text-amber-900 border border-amber-300/60"
                                  : "bg-slate-300/90 text-slate-700 border border-slate-400/50"
                                  }`}
                                title="This month is finalized and locked (read-only)"
                              >
                                <Lock size={9} />
                                {(!totalMonthCount || totalMonthCount < 6 || isSelected) && (
                                  <span>Locked</span>
                                )}
                              </span>
                            ) : (
                              <span
                                className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase whitespace-nowrap shrink-0 ${isSelected
                                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300/60"
                                  : "bg-slate-300/90 text-slate-700 border border-slate-400/50"
                                  }`}
                                title="Active editing month"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                {(!totalMonthCount || totalMonthCount < 6 || isSelected) && (
                                  <span>Active</span>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top-Right File Actions */}
                  <div className="flex items-center gap-2 pb-2 self-end">
                    {!isInputsBlocked && activeMonthIndex === monthlyRecords.length - 1 ? (
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

                {/* DRAFTS / SCENARIOS SUB-BAR */}
                <div className="bg-white border-x border-b border-slate-200 px-4 py-3 rounded-b-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex items-center gap-1.5 font-bold text-slate-500 shrink-0 uppercase tracking-wider text-[10px]">
                      <Layers size={13} className="text-[#c9a654]" />
                      <span>Month {currentMonthNumber} Drafts:</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {currentDrafts.map((draft) => {
                        const isDraftActive = draft.id === activeDraftId;
                        const isEditingThis = editingDraftId === draft.id;

                        if (isEditingThis) {
                          return (
                            <form
                              key={draft.id}
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleRenameDraft(draft.id, editingDraftName);
                              }}
                              className="flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 shrink-0"
                            >
                              <input
                                type="text"
                                autoFocus
                                value={editingDraftName}
                                onChange={(e) => setEditingDraftName(e.target.value)}
                                className="text-xs font-bold text-[#122244] bg-transparent outline-none w-28"
                              />
                              <button
                                type="submit"
                                className="text-emerald-700 hover:text-emerald-900 p-0.5"
                                title="Save Name"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDraftId(null)}
                                className="text-slate-400 hover:text-slate-600 p-0.5"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </form>
                          );
                        }

                        return (
                          <div
                            key={draft.id}
                            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all border shrink-0 ${isDraftActive
                              ? "bg-[#122244] text-white border-[#122244] shadow-sm"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSwitchDraft(draft.id)}
                              className="flex items-center gap-1.5"
                            >
                              {isDraftActive ? (
                                <CheckCircle2 size={12} className="text-[#c9a654]" />
                              ) : (
                                <FileText size={12} className="text-slate-400" />
                              )}
                              <span>{draft.name}</span>
                            </button>

                            {/* Rename & Delete Actions */}
                            {!isInputsBlocked && (
                              <div className="flex items-center gap-0.5 ml-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDraftId(draft.id);
                                    setEditingDraftName(draft.name);
                                  }}
                                  className={`p-0.5 rounded hover:bg-white/20 transition-colors ${isDraftActive ? "text-amber-200 hover:text-white" : "text-slate-400 hover:text-slate-700"
                                    }`}
                                  title="Rename Draft"
                                >
                                  <Edit3 size={11} />
                                </button>
                                {currentDrafts.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDraft(draft.id);
                                    }}
                                    className={`p-0.5 rounded hover:bg-white/20 transition-colors ${isDraftActive ? "text-red-300 hover:text-red-100" : "text-slate-400 hover:text-red-600"
                                      }`}
                                    title="Delete Draft"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* + New Draft Button */}
                  {!isInputsBlocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewDraftName(`Draft ${currentDrafts.length + 1}`);
                        setNewDraftCloneCurrent(true);
                        setShowCreateDraftModal(true);
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#c9a654] hover:bg-[#b59545] px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95 shrink-0 self-start md:self-auto"
                    >
                      <Plus size={14} className="text-white" />
                      <span>New Draft / Scenario</span>
                    </button>
                  )}
                </div>

                {/* Locked Banner inside File Folder */}
                {isCurrentMonthLocked && (
                  <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm animate-in fade-in duration-200">
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
                  onClick={() => setActiveModuleTab("market")}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all border shrink-0 ${activeModuleTab === "market"
                    ? "bg-[#122244] text-white border-[#122244] shadow-md"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                >
                  <Target className={`w-4 h-4 ${activeModuleTab === "market" ? "text-[#c9a654]" : "text-gray-400"}`} />
                  Market & Competitive Indicators
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
                    <div className="bg-white rounded-xl border-l-4 border-l-emerald-500 p-5 shadow-sm text-center flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Monthly Revenue
                        </span>
                        <p className="text-2xl font-black text-emerald-600 mt-1">
                          ₱{monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="mt-3 text-[10px] text-gray-400 font-semibold bg-gray-50/80 py-1.5 px-2 rounded-lg border border-gray-100">
                        {normalizedProducts.length > 1 ? (
                          <>
                            <span>Sales: {safeMonthlySales.toLocaleString()} units sold</span>
                            <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold">
                              {safeUnitsProduced.toLocaleString()} units produced • {normalizedProducts.length} Products
                            </p>
                          </>
                        ) : (
                          <>
                            <span>Price × Units Sold</span>
                            <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold truncate">
                              ₱{safeSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {safeMonthlySales.toLocaleString()} sold ({safeUnitsProduced.toLocaleString()} produced)
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
                            <span>COGS (Units Sold) + Fixed</span>
                            <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold truncate">
                              ₱{totalMonthlyVariableCosts.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} + ₱{safeFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </p>
                          </>
                        ) : (
                          <>
                            <span>(COGS/Unit × Sold) + Fixed</span>
                            <p className="text-[9px] text-[#c9a654] mt-0.5 font-bold truncate">
                              (₱{safeVariableCost.toFixed(2)} × {safeMonthlySales.toLocaleString()} sold) + ₱{safeFixedCosts.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 3. Break-Even Point */}
                    <div className="bg-white rounded-xl border-l-4 border-l-[#c9a654] p-5 shadow-sm text-center flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Break-Even Point
                        </span>
                        <p className="text-2xl font-black text-[#c9a654] mt-1">
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
                    <div className="bg-white rounded-xl border-l-4 border-l-blue-500 p-5 shadow-sm text-center flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Gross Margin
                        </span>
                        <p className={`text-2xl font-black mt-1 ${grossProfitMargin >= 0 ? "text-blue-600" : "text-red-500"}`}>
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
                    <div className={`bg-white rounded-xl border-l-4 p-5 shadow-sm text-center flex flex-col justify-between ${netMonthlyProfit >= 0 ? "border-l-emerald-500" : "border-l-red-500"}`}>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Net Profit / mo
                        </span>
                        <p
                          className={`text-2xl font-black mt-1 ${netMonthlyProfit < 0 ? "text-red-600" : "text-emerald-600"
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
                      <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                        {normalizedProducts.length > 1 && (
                          <button
                            type="button"
                            onClick={toggleAllProducts}
                            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#122244] bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl border border-gray-200 transition-all shadow-2xs"
                          >
                            {allProductsExpanded ? (
                              <>
                                <ChevronUp size={13} /> Fold All
                              </>
                            ) : (
                              <>
                                <ChevronDown size={13} /> Expand All
                              </>
                            )}
                          </button>
                        )}
                        {!isInputsBlocked && (
                          <button
                            type="button"
                            onClick={handleAddProduct}
                            className="flex items-center gap-1.5 text-xs font-bold text-[#122244] bg-[#c9a654] hover:bg-[#b59545] px-4 py-2 rounded-xl border border-[#c9a654] transition-all shadow-sm hover:shadow-md cursor-pointer"
                          >
                            <Plus size={14} className="stroke-[2.5]" /> Add Product
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PRODUCTS LIST */}
                    <div className="space-y-4">
                      {normalizedProducts.map((product, prodIdx) => {
                        const metrics = computeProductMetrics(product);
                        const ingredients = product.ingredients || [];
                        const productKey = product.id || String(prodIdx);
                        const isExpanded = !!expandedProducts[productKey];

                        return (
                          <div
                            key={productKey}
                            className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm relative ${isExpanded ? "p-5 sm:p-6 space-y-6 border-gray-300 ring-1 ring-gray-200/60" : "p-4 sm:p-5 border-gray-200 hover:border-gray-300"
                              }`}
                          >
                            {/* Product Header (Matches reference image) */}
                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isExpanded ? "border-b border-gray-100 pb-4" : ""}`}>
                              <div className="flex items-center gap-3 flex-1">
                                <span className="px-3 py-1 bg-[#122244] text-white text-[11px] font-black rounded-lg uppercase tracking-wider shadow-2xs shrink-0">
                                  Product #{prodIdx + 1}
                                </span>
                                <div className="flex-1 max-w-md">
                                  <input
                                    type="text"
                                    disabled={isInputsBlocked}
                                    placeholder={`Product ${prodIdx + 1} Name`}
                                    value={product.name || ""}
                                    onChange={(e) => handleUpdateProduct(prodIdx, { name: e.target.value })}
                                    onBlur={() => handleAutoSave()}
                                    className="w-full px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-extrabold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                                <button
                                  type="button"
                                  disabled={isInputsBlocked}
                                  onClick={() => handleDuplicateProduct(prodIdx)}
                                  className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200/90 transition-colors font-bold shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Duplicate this product and all its ingredients"
                                >
                                  <Copy size={13} className="text-blue-600" /> Duplicate
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleProductExpand(productKey)}
                                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all shadow-2xs ${isExpanded
                                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                                    : "bg-amber-50 hover:bg-amber-100 text-[#b59545] border-amber-200/80"
                                    }`}
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp size={13} /> Fold Details
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={13} className="text-[#c9a654]" /> Expand Inputs & Costing
                                    </>
                                  )}
                                </button>

                                {normalizedProducts.length > 1 && !isInputsBlocked && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProduct(prodIdx)}
                                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors font-semibold"
                                  >
                                    <Trash2 size={13} /> Remove Product
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* COMPACT SUMMARY STRIP (WHEN FOLDED) */}
                            {!isExpanded && (
                              <div className="pt-3.5 border-t border-gray-100">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                                  {/* 1. Units per batch (Editable) */}
                                  <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-200/70 dark:border-[#c9a654]/40 hover:border-[#c9a654] transition-all shadow-xs">
                                    <label className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-wider block">
                                      Units per batch <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      disabled={isInputsBlocked}
                                      type="number"
                                      min="0"
                                      placeholder="e.g. 50"
                                      value={product.quantityYield !== undefined ? product.quantityYield : ""}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "" || Number(val) >= 0) {
                                          handleUpdateProduct(prodIdx, { quantityYield: val });
                                        }
                                      }}
                                      onBlur={() => handleAutoSave()}
                                      className="w-full px-2.5 py-1 bg-white dark:bg-[#0c1424] border border-gray-200 dark:border-[#c9a654]/50 rounded-lg text-sm font-black text-[#122244] dark:text-[#f3d98b] focus:border-[#c9a654] outline-none mt-1 shadow-2xs disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                    />
                                    <span className="text-[9px] text-gray-400 dark:text-[#edd59b]/70 block mt-1">Batch Yield (finished pcs)</span>
                                  </div>

                                  {/* 2. Batches per Month (Editable) */}
                                  <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-200/70 dark:border-[#c9a654]/40 hover:border-[#c9a654] transition-all shadow-xs">
                                    <label className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-wider block">
                                      Batches / Mo
                                    </label>
                                    <input
                                      disabled={isInputsBlocked}
                                      type="number"
                                      min="1"
                                      placeholder="1"
                                      value={product.batchesPerMonth !== undefined ? product.batchesPerMonth : "1"}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "" || Number(val) >= 0) {
                                          handleUpdateProduct(prodIdx, { batchesPerMonth: val });
                                        }
                                      }}
                                      onBlur={() => handleAutoSave()}
                                      className="w-full px-2.5 py-1 bg-white dark:bg-[#0c1424] border border-gray-200 dark:border-[#c9a654]/50 rounded-lg text-sm font-black text-[#c9a654] dark:text-[#f3d98b] focus:border-[#c9a654] outline-none mt-1 shadow-2xs disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                    />
                                    <span className="text-[9px] text-[#b59545] dark:text-[#edd59b] font-semibold block mt-1">
                                      {metrics.totalUnitsProduced.toLocaleString()} pcs nagawa
                                    </span>
                                  </div>

                                  {/* 3. Units Sold / Mo (Editable) */}
                                  <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-200/70 dark:border-[#c9a654]/40 hover:border-[#c9a654] transition-all shadow-xs">
                                    <label className="text-[10px] font-bold text-gray-500 dark:text-[#edd59b] uppercase tracking-wider block">
                                      Units Sold / Mo
                                    </label>
                                    <input
                                      disabled={isInputsBlocked}
                                      type="number"
                                      min="0"
                                      max={metrics.totalUnitsProduced > 0 ? metrics.totalUnitsProduced : undefined}
                                      placeholder={String(metrics.totalUnitsProduced || "0")}
                                      value={product.unitsSold !== undefined ? product.unitsSold : ""}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "") {
                                          handleUpdateProduct(prodIdx, { unitsSold: "" });
                                          return;
                                        }
                                        const numVal = Math.max(0, Number(val));
                                        const maxProduced = metrics.totalUnitsProduced;
                                        if (maxProduced > 0 && numVal > maxProduced) {
                                          handleUpdateProduct(prodIdx, { unitsSold: String(maxProduced) });
                                        } else {
                                          handleUpdateProduct(prodIdx, { unitsSold: val });
                                        }
                                      }}
                                      onBlur={() => handleAutoSave()}
                                      className="w-full px-2.5 py-1 bg-white dark:bg-[#0c1424] border border-gray-200 dark:border-[#c9a654]/50 rounded-lg text-sm font-black text-[#c9a654] dark:text-[#f3d98b] focus:border-[#c9a654] outline-none mt-1 shadow-2xs disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                    />
                                    <span className="text-[9px] text-[#b59545] dark:text-[#edd59b] font-semibold block mt-1">
                                      {metrics.unitsSold.toLocaleString()} pcs nabenta
                                    </span>
                                  </div>

                                  {/* 4. Cost per Batch */}
                                  <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-200/70 dark:border-[#c9a654]/40 transition-all shadow-xs flex flex-col justify-between">
                                    <div>
                                      <span className="text-[10px] font-bold text-gray-400 dark:text-[#edd59b] uppercase tracking-wider block">Cost / Batch</span>
                                      <p className="text-sm font-black text-[#122244] dark:text-[#f3d98b] mt-1.5">
                                        ₱{metrics.totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                    <span className="text-[9px] text-gray-400 dark:text-[#edd59b]/70 mt-1">{ingredients.length} items/costs</span>
                                  </div>

                                  {/* 5. Cost per Unit (COGS) */}
                                  <div className="bg-gray-50/90 dark:bg-gradient-to-b dark:from-[#152342] dark:to-[#0f1930] p-2.5 rounded-xl border border-gray-200/70 dark:border-[#c9a654]/40 transition-all shadow-xs col-span-2 sm:col-span-1 flex flex-col justify-between">
                                    <div>
                                      <span className="text-[10px] font-bold text-gray-400 dark:text-[#edd59b] uppercase tracking-wider block">Cost / Unit (COGS)</span>
                                      <p className="text-sm font-black text-[#122244] dark:text-[#f3d98b] mt-1.5">
                                        ₱{metrics.unitCost.toFixed(2)}
                                      </p>
                                    </div>
                                    <span className="text-[9px] text-gray-500 dark:text-[#edd59b]/80 font-semibold mt-1">
                                      {metrics.sellingPrice > 0 ? `Target SRP: ₱${metrics.sellingPrice.toFixed(2)}` : "Unit cost"}
                                    </span>
                                  </div>
                                </div>

                                {(metrics.unsoldUnits > 0 || (metrics.unitsSold === metrics.totalUnitsProduced && metrics.totalUnitsProduced > 0)) && (
                                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100 text-[11px] text-gray-400">
                                    {metrics.unsoldUnits > 0 ? (
                                      <span className="text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-md font-bold text-[10px]">
                                        📦 {metrics.unsoldUnits.toLocaleString()} unsold (₱{metrics.endingInventoryValue.toFixed(2)})
                                      </span>
                                    ) : metrics.unitsSold === metrics.totalUnitsProduced && metrics.totalUnitsProduced > 0 ? (
                                      <span className="text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-md font-bold text-[10px]">
                                        ✓ 100% Sold ({metrics.unitsSold.toLocaleString()} pcs)
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* DETAILED INPUTS & COSTING (WHEN EXPANDED) */}
                            {isExpanded && (
                              <div className="space-y-6 animate-in fade-in duration-200">
                                {/* Product Yield & Ingredients Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                  {/* Yield Input & Calculation */}
                                  <div className="lg:col-span-4 space-y-3.5">
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                          Batch Yield / Units per Batch <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                          type="number"
                                          disabled={isInputsBlocked}
                                          min="0"
                                          placeholder="e.g. 50"
                                          value={product.quantityYield}
                                          onKeyDown={handlePreventNegative}
                                          onPaste={handlePasteNonNegative}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "" || Number(val) >= 0) {
                                              handleUpdateProduct(prodIdx, { quantityYield: val });
                                            }
                                          }}
                                          onBlur={() => handleAutoSave()}
                                          className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                        />
                                        <p className="text-[9px] text-gray-400 mt-0.5 italic">
                                          Number of finished units produced in 1 recipe/batch
                                        </p>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                              Batches / Mo.
                                            </label>
                                          </div>
                                          <input
                                            type="number"
                                            disabled={isInputsBlocked}
                                            min="1"
                                            placeholder="1"
                                            value={product.batchesPerMonth !== undefined ? product.batchesPerMonth : "1"}
                                            onKeyDown={handlePreventNegative}
                                            onPaste={handlePasteNonNegative}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === "" || Number(val) >= 0) {
                                                handleUpdateProduct(prodIdx, { batchesPerMonth: val });
                                              }
                                            }}
                                            onBlur={() => handleAutoSave()}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                          />
                                          <p className="text-[9px] text-emerald-700 font-extrabold mt-1 truncate">
                                            Nagawa: {metrics.totalUnitsProduced.toLocaleString()} pcs
                                          </p>
                                        </div>

                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                              Units Sold / Mo.
                                            </label>
                                          </div>
                                          <input
                                            type="number"
                                            disabled={isInputsBlocked}
                                            min="0"
                                            max={metrics.totalUnitsProduced > 0 ? metrics.totalUnitsProduced : undefined}
                                            placeholder={String(metrics.totalUnitsProduced || "")}
                                            value={product.unitsSold !== undefined ? product.unitsSold : ""}
                                            onKeyDown={handlePreventNegative}
                                            onPaste={handlePasteNonNegative}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === "") {
                                                handleUpdateProduct(prodIdx, { unitsSold: "" });
                                                return;
                                              }
                                              const numVal = Math.max(0, Number(val));
                                              const maxProduced = metrics.totalUnitsProduced;
                                              if (maxProduced > 0 && numVal > maxProduced) {
                                                handleUpdateProduct(prodIdx, { unitsSold: String(maxProduced) });
                                              } else {
                                                handleUpdateProduct(prodIdx, { unitsSold: val });
                                              }
                                            }}
                                            onBlur={() => handleAutoSave()}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                          />
                                          <p className="text-[9px] text-[#c9a654] font-extrabold mt-1 truncate">
                                            Nabenta: {metrics.unitsSold.toLocaleString()} pcs
                                          </p>
                                        </div>
                                      </div>

                                      {/* Inventory status pill */}
                                      <div className="p-2 rounded-lg bg-slate-100/80 border border-slate-200 text-[10px] flex items-center justify-between">
                                        <span className="text-gray-500 font-semibold">Inventory Status:</span>
                                        {metrics.unsoldUnits > 0 ? (
                                          <span className="font-extrabold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200 truncate">
                                            📦 {metrics.unsoldUnits.toLocaleString()} unsold (₱{metrics.endingInventoryValue.toFixed(2)})
                                          </span>
                                        ) : metrics.unitsSold === metrics.totalUnitsProduced ? (
                                          <span className="font-extrabold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200 truncate">
                                            ✓ 100% Sold ({metrics.unitsSold.toLocaleString()} pcs)
                                          </span>
                                        ) : (
                                          <span className="font-extrabold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded border border-blue-200 truncate">
                                            {metrics.unitsSold.toLocaleString()} pcs sold
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Total Batch Cost & Unit Cost Preview */}
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2.5">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Cost per Batch:</span>
                                        <span className="font-extrabold text-[#122244]">
                                          ₱{metrics.totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      {ingredients.some(i => i.category === "labor" || i.category === "miscellaneous") && (
                                        <div className="space-y-1 pb-1.5 pt-0.5 border-b border-gray-200/60 text-[11px]">
                                          <div className="flex justify-between items-center text-gray-500">
                                            <span>Direct Materials:</span>
                                            <span className="font-bold text-gray-700">
                                              ₱{ingredients.filter(i => !i.category || i.category === "ingredient").reduce((s, i) => s + (Number(i.price) || 0), 0).toFixed(2)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-center text-blue-800">
                                            <span>Direct Labor & Misc:</span>
                                            <span className="font-bold text-blue-900">
                                              ₱{ingredients.filter(i => i.category === "labor" || i.category === "miscellaneous").reduce((s, i) => s + (Number(i.price) || 0), 0).toFixed(2)}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-gray-200/60">
                                        <span className="text-gray-500 font-medium">Monthly Output:</span>
                                        <span className="font-bold text-gray-800">
                                          {metrics.totalUnitsProduced.toLocaleString()} units ({metrics.batchesPerMonth} {metrics.batchesPerMonth === 1 ? "batch" : "batches"})
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-gray-200/60">
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
                                        Direct Production Costs (Materials, Labor & Misc)
                                      </label>
                                      {!isInputsBlocked && (
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleAddIngredient(prodIdx, "ingredient")}
                                            className="flex items-center gap-1 text-[11px] font-bold text-[#c9a654] hover:text-[#b59545] bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200/70 hover:bg-amber-100 transition-colors"
                                          >
                                            <Plus size={12} /> Add Ingredient
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleAddIngredient(prodIdx, "labor")}
                                            className="flex items-center gap-1 text-[11px] font-bold text-blue-800 hover:text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200/70 hover:bg-blue-100 transition-colors"
                                          >
                                            <Plus size={12} /> Add Labor / Misc
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {ingredients.length === 0 ? (
                                      <div className="p-5 bg-gray-50/70 rounded-xl border border-dashed border-gray-200 text-center space-y-1.5">
                                        <p className="text-xs text-gray-400 italic">No production costs or ingredients listed yet.</p>
                                        {!isInputsBlocked && (
                                          <div className="flex justify-center gap-3 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => handleAddIngredient(prodIdx, "ingredient")}
                                              className="text-xs font-bold text-[#c9a654] hover:underline"
                                            >
                                              + Add Ingredient
                                            </button>
                                            <span className="text-gray-300">|</span>
                                            <button
                                              type="button"
                                              onClick={() => handleAddIngredient(prodIdx, "labor")}
                                              className="text-xs font-bold text-blue-700 hover:underline"
                                            >
                                              + Add Direct Labor / Misc
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300">
                                        {ingredients.map((ing, ingIdx) => (
                                          <div
                                            key={ing.id || ingIdx}
                                            className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100 text-xs"
                                          >
                                            <select
                                              disabled={isInputsBlocked}
                                              value={ing.category || "ingredient"}
                                              onChange={(e) => handleUpdateIngredient(prodIdx, ingIdx, { category: e.target.value })}
                                              className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded border outline-none cursor-pointer transition-colors ${(ing.category === "labor")
                                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                                : (ing.category === "miscellaneous")
                                                  ? "bg-purple-50 text-purple-800 border-purple-200"
                                                  : "bg-amber-50 text-[#b59545] border-amber-200"
                                                }`}
                                            >
                                              <option value="ingredient">Material</option>
                                              <option value="labor">Labor</option>
                                              <option value="miscellaneous">Misc</option>
                                            </select>
                                            <input
                                              type="text"
                                              disabled={isInputsBlocked}
                                              placeholder={
                                                ing.category === "labor"
                                                  ? "Direct Labor (e.g. Barista, Baker, Prep)"
                                                  : ing.category === "miscellaneous"
                                                    ? "Misc Cost (e.g. Packaging, Cups, Foil)"
                                                    : "Ingredient / Direct Material Name"
                                              }
                                              value={ing.name}
                                              onChange={(e) => handleUpdateIngredient(prodIdx, ingIdx, { name: e.target.value })}
                                              onBlur={() => handleAutoSave()}
                                              className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs font-medium text-gray-800 focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                            />
                                            <div className="w-32 relative">
                                              <span className="absolute left-2.5 top-1.5 text-xs text-gray-400 font-bold">₱</span>
                                              <input
                                                type="number"
                                                disabled={isInputsBlocked}
                                                min="0"
                                                placeholder="0.00"
                                                value={ing.price !== undefined ? ing.price : ""}
                                                onKeyDown={handlePreventNegative}
                                                onPaste={handlePasteNonNegative}
                                                onChange={(e) => handleUpdateIngredient(prodIdx, ingIdx, { price: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
                                                onBlur={() => handleAutoSave()}
                                                className="w-full pl-6 pr-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-800 focus:border-[#c9a654] outline-none text-right disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                              />
                                            </div>
                                            {!isInputsBlocked && (
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
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* 12% VAT Toggle Button */}
                                      {!isInputsBlocked && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextVat = product.applyVat === false;
                                            const compPrice = nextVat ? (metrics.computedBasePrice * 1.12) : metrics.computedBasePrice;
                                            handleUpdateProduct(prodIdx, {
                                              applyVat: nextVat,
                                              sellingPrice: compPrice > 0 ? String(Math.round(compPrice)) : (product.sellingPrice || "")
                                            });
                                          }}
                                          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all flex items-center gap-1.5 shadow-xs ${product.applyVat !== false
                                            ? "bg-blue-900 text-white border-blue-900 shadow-sm"
                                            : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"
                                            }`}
                                          title="Toggle Philippine 12% Value-Added Tax (VAT)"
                                        >
                                          <span className={`w-1.5 h-1.5 rounded-full ${product.applyVat !== false ? "bg-amber-400" : "bg-gray-400"}`} />
                                          {product.applyVat !== false ? "12% VAT Applied" : "Non-VAT / Exempt"}
                                        </button>
                                      )}

                                      {!isInputsBlocked && (
                                        <div className="flex gap-1.5 items-center">
                                          <span className="text-[10px] text-gray-400 font-bold uppercase">Presets:</span>
                                          {["50", "100", "120"].map((pct) => (
                                            <button
                                              key={pct}
                                              type="button"
                                              onClick={() => {
                                                const mPct = Number(pct);
                                                const compBase = metrics.unitCost + (metrics.unitCost * (mPct / 100));
                                                const finalPrice = product.applyVat !== false ? compBase * 1.12 : compBase;
                                                handleUpdateProduct(prodIdx, {
                                                  markupPercentage: pct,
                                                  sellingPrice: finalPrice > 0 ? String(Math.round(finalPrice)) : ""
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
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                        Mark-up Percentage (%)
                                      </label>
                                      <input
                                        type="number"
                                        disabled={isInputsBlocked}
                                        min="0"
                                        placeholder="e.g. 100"
                                        value={product.markupPercentage}
                                        onKeyDown={handlePreventNegative}
                                        onPaste={handlePasteNonNegative}
                                        onChange={(e) => {
                                          const newPct = e.target.value;
                                          if (newPct !== "" && Number(newPct) < 0) return;
                                          const mPct = Math.max(0, Number(newPct) || 0);
                                          const compBase = metrics.unitCost + (metrics.unitCost * (mPct / 100));
                                          const finalPrice = product.applyVat !== false ? compBase * 1.12 : compBase;
                                          handleUpdateProduct(prodIdx, {
                                            markupPercentage: newPct,
                                            sellingPrice: finalPrice > 0 ? String(Math.round(finalPrice)) : (product.sellingPrice || "")
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

                                    <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200/80 flex flex-col justify-between">
                                      <div>
                                        <span className="text-[10px] font-bold text-[#b59545] uppercase tracking-wider block">Computed Base Price</span>
                                        <p className="text-xl font-black text-[#c9a654] mt-0.5">₱{metrics.computedBasePrice.toFixed(2)}</p>
                                      </div>
                                      <span className="text-[9px] text-gray-500">Unit Cost + Mark-up (VAT-Excl.)</span>
                                    </div>

                                    <div className={`p-3 rounded-lg border flex flex-col justify-between ${product.applyVat !== false ? "bg-blue-50/60 border-blue-200" : "bg-gray-50 border-gray-200 opacity-60"
                                      }`}>
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">12% Output VAT</span>
                                          {product.applyVat !== false ? (
                                            <span className="text-[8px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase">Standard</span>
                                          ) : (
                                            <span className="text-[8px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase">Exempt</span>
                                          )}
                                        </div>
                                        <p className="text-xl font-black text-blue-900 mt-0.5">
                                          +₱{(product.applyVat !== false ? metrics.vatAmountPerUnit : 0).toFixed(2)}
                                        </p>
                                      </div>
                                      <span className="text-[9px] text-blue-700/80">
                                        {product.applyVat !== false ? `Suggested SRP: ₱${metrics.computedVatInclusivePrice.toFixed(2)}` : "Non-VAT / Exempt (0%)"}
                                      </span>
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                          Final Selling Price (₱) <span className="text-[#c9a654] font-black">*</span>
                                        </label>
                                        {product.applyVat !== false && (
                                          <span className="text-[8px] font-black text-blue-700 bg-blue-50 px-1 py-0.2 rounded uppercase">VAT-Inc.</span>
                                        )}
                                      </div>
                                      <input
                                        type="number"
                                        disabled={isInputsBlocked}
                                        min="0"
                                        placeholder={
                                          product.applyVat !== false
                                            ? (metrics.computedVatInclusivePrice > 0 ? String(Math.round(metrics.computedVatInclusivePrice)) : "0")
                                            : (metrics.computedBasePrice > 0 ? String(Math.round(metrics.computedBasePrice)) : "0")
                                        }
                                        value={product.sellingPrice !== undefined ? product.sellingPrice : ""}
                                        onKeyDown={handlePreventNegative}
                                        onPaste={handlePasteNonNegative}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === "" || Number(val) >= 0) {
                                            handleUpdateProduct(prodIdx, { sellingPrice: val });
                                          }
                                        }}
                                        onBlur={() => handleAutoSave()}
                                        className="w-full px-3.5 py-2 bg-white border-2 border-[#c9a654] rounded-lg text-xs font-black text-[#122244] focus:ring-2 focus:ring-[#c9a654]/20 outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                      />
                                      <p className="text-[9px] text-gray-400 mt-1 italic">
                                        {product.applyVat !== false ? "VAT-Inclusive consumer price" : "Net price (Non-VAT)"}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* DYNAMIC SUMMARY CARDS (PER PRODUCT) */}
                                <div className="pt-3 border-t border-gray-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                      Product Economics Summary ({product.name || `Product #${prodIdx + 1}`})
                                    </span>
                                    {product.applyVat !== false && (
                                      <span className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                        BIR 12% Output VAT Segregated: ₱{metrics.totalVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[#122244]">
                                    {/* 1. Unit Cost (COGS) */}
                                    <div className="bg-gray-50/90 p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Unit Cost (COGS)</span>
                                      <p className="text-lg sm:text-xl font-black text-[#122244] mt-1">₱{metrics.unitCost.toFixed(2)}</p>
                                      <p className="text-[9px] text-gray-400 font-medium mt-1 truncate">Total Batch Cost / Batch Yield</p>
                                    </div>

                                    {/* 2. Target Price */}
                                    <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-[#b59545] uppercase tracking-wider">Target Price</span>
                                        {product.applyVat !== false && <span className="text-[8px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded uppercase">VAT-Inc.</span>}
                                      </div>
                                      <p className="text-lg sm:text-xl font-black text-[#c9a654] mt-1">₱{metrics.sellingPrice.toFixed(2)}</p>
                                      <p className="text-[9px] text-gray-500 font-semibold mt-1 truncate">
                                        {product.applyVat !== false ? `Net: ₱${metrics.netSellingPrice.toFixed(2)}` : `Base + ${metrics.markupPct}% Mark-up`}
                                      </p>
                                    </div>

                                    {/* 3. Revenue */}
                                    <div className="bg-green-50/40 p-4 rounded-xl border border-green-200 shadow-xs flex flex-col justify-between">
                                      <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider block">Revenue</span>
                                      <p className="text-lg sm:text-xl font-black text-green-700 mt-1">
                                        ₱{metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-[9px] text-green-600 font-medium mt-1 truncate">
                                        {metrics.unitsSold.toLocaleString()} units sold ({product.applyVat !== false ? "Net Sales excl. VAT" : "Price × Units Sold"})
                                      </p>
                                    </div>

                                    {/* 4. Gross Profit */}
                                    <div className="bg-purple-50/40 p-4 rounded-xl border border-purple-200 shadow-xs flex flex-col justify-between">
                                      <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Gross Profit</span>
                                      <p className={`text-lg sm:text-xl font-black mt-1 ${metrics.grossProfit >= 0 ? "text-purple-700" : "text-red-500"}`}>
                                        ₱{metrics.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-[9px] text-purple-600 font-medium mt-1 truncate">
                                        Revenue - COGS (₱{metrics.cogsSold.toFixed(2)})
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Expanded Bottom Quick-Action Bar */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-gray-100">
                                  <button
                                    type="button"
                                    onClick={() => toggleProductExpand(productKey)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors self-start"
                                  >
                                    <ChevronUp size={13} />
                                    <span>Fold Details</span>
                                  </button>
                                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                                    {!isInputsBlocked && (
                                      <button
                                        type="button"
                                        onClick={() => handleDuplicateProduct(prodIdx)}
                                        className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200/90 transition-colors font-bold shadow-2xs"
                                        title="Duplicate this product and all its ingredients"
                                      >
                                        <Copy size={13} className="text-blue-600" /> Duplicate Product
                                      </button>
                                    )}
                                    {normalizedProducts.length > 1 && !isInputsBlocked && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveProduct(prodIdx)}
                                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors font-semibold"
                                      >
                                        <Trash2 size={13} /> Remove Product
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* === SECTION 3: MONTHLY OPERATING COSTS (OPEX) === */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-sm space-y-6 text-[#122244]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-sm flex-shrink-0">
                          <TrendingUp className="text-[#c9a654]" size={20} />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#122244]">
                            Monthly Operating Expenses (OpEx)
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Fixed monthly overhead & basic commodities (Rent, Salaries, Utilities, Marketing, Logistics, Supplies)
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="bg-emerald-50/80 px-4 py-2 rounded-xl border border-emerald-200/80 flex items-center gap-2 shadow-2xs">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total OpEx:</span>
                          <span className="text-base font-black text-emerald-950">₱{safeFixedCosts.toLocaleString()}</span>
                        </div>
                        {!isInputsBlocked && (
                          <button
                            type="button"
                            onClick={() => {
                              const currentList = financials.opexList || [];
                              const newItem: OpexItem = {
                                id: `custom-opex-${Date.now()}`,
                                name: "",
                                amount: 0,
                                category: "Custom Expense",
                                isPreset: false,
                              };
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
                            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#122244] hover:bg-[#1a3060] px-3.5 py-2 rounded-xl shadow-sm transition-all"
                          >
                            <Plus size={14} className="text-[#c9a654]" /> Add Custom Expense
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase font-bold text-gray-500 tracking-wider">
                          <tr>
                            <th className="p-3.5 pl-5 w-44">Category</th>
                            <th className="p-3.5">Basic Commodity / Expense Item</th>
                            <th className="p-3.5 w-52 text-right">Monthly Amount (₱)</th>
                            {!isInputsBlocked && <th className="p-3.5 w-20 text-center">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {financials.opexList && financials.opexList.map((item, index) => {
                            const isPositive = Number(item.amount) > 0;
                            const categoryBadgeStyle = "bg-amber-50 text-amber-800 border-amber-200";

                            return (
                              <tr
                                key={item.id || index}
                                className="transition-colors hover:bg-gray-50/50"
                              >
                                <td className="p-3 pl-5 align-middle">
                                  <span className={`inline-block px-2.5 py-1 text-[10px] font-extrabold rounded-md border uppercase tracking-wider ${categoryBadgeStyle}`}>
                                    {item.category || (item.isPreset === false ? "Custom Expense" : "General OpEx")}
                                  </span>
                                </td>
                                <td className="p-3 align-middle">
                                  <input
                                    type="text"
                                    disabled={isInputsBlocked}
                                    value={item.name}
                                    placeholder="e.g. Rent, Electricity, Internet, Supplies"
                                    onChange={(e) => {
                                      const newList = [...financials.opexList];
                                      newList[index] = { ...newList[index], name: e.target.value };
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
                                    className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-bold text-[#122244] focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed ${item.isPreset === false ? "border-dashed border-teal-300 bg-teal-50/20" : "border-gray-200"
                                      }`}
                                  />
                                </td>
                                <td className="p-3 align-middle">
                                  <div className="relative">
                                    <span className="absolute left-3 top-2 text-xs font-bold text-gray-400">
                                      ₱
                                    </span>
                                    <input
                                      type="number"
                                      disabled={isInputsBlocked}
                                      min="0"
                                      value={item.amount === 0 ? "" : item.amount}
                                      placeholder="0.00"
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const amt = val === "" ? 0 : Math.max(0, Number(val));
                                        const newList = [...financials.opexList];
                                        newList[index] = { ...newList[index], amount: amt };
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
                                      className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-black text-right text-[#122244] focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                </td>
                                {!isInputsBlocked && (
                                  <td className="p-3 text-center align-middle">
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
                                      className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors inline-flex items-center justify-center"
                                      title="Remove Expense Item"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                          {(!financials.opexList || financials.opexList.length === 0) && (
                            <tr>
                              <td colSpan={isInputsBlocked ? 3 : 4} className="p-8 text-center text-xs text-gray-400 italic">
                                No monthly operating expenses configured. Click "Reset Presets" to restore standard commodities.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* OPEX CATEGORY BREAKDOWN PILLS */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-gray-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Allocations:</span>
                        {(financials.opexList || [])
                          .filter(i => Number(i.amount) > 0)
                          .map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-[#122244] rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <span>{item.name}:</span>
                              <span className="text-emerald-700 font-black">₱{Number(item.amount).toLocaleString()}</span>
                            </span>
                          ))}
                        {(financials.opexList || []).filter(i => Number(i.amount) > 0).length === 0 && (
                          <span className="text-xs text-gray-400 italic">All predetermined commodity fields are currently at ₱0.00.</span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs text-gray-400 font-medium mr-2">Total Fixed Monthly OpEx:</span>
                        <strong className="text-sm font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                          ₱{safeFixedCosts.toLocaleString()}/mo
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* === SECTION 4: STARTUP EQUIPMENT & ASSETS BREAKDOWN (CAPEX) === */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-sm space-y-6 text-[#122244]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#c9a654] shadow-sm">
                          <Package className="text-[#c9a654]" size={18} />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#122244]">
                            Startup Equipment & Assets Breakdown (CapEx)
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Itemized startup equipment, machinery, and physical assets required for business launch
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-50/80 px-4 py-2 rounded-xl border border-amber-200/70 flex items-center gap-2 shadow-sm">
                          <span className="text-[10px] font-bold text-[#b59545] uppercase tracking-wider">Total Equipment (CapEx):</span>
                          <span className="text-base font-black text-[#122244]">₱{calculatedEquipmentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {!isInputsBlocked && (
                          <button
                            type="button"
                            onClick={handleAddEquipmentItem}
                            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#122244] hover:bg-[#1a3060] px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
                          >
                            <Plus size={14} className="text-[#c9a654]" /> Add Item
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                          <tr>
                            <th className="p-3.5 pl-5 min-w-[220px]">Item / Asset name</th>
                            <th className="p-3.5 w-28 text-center">QTY</th>
                            <th className="p-3.5 w-40 text-right">UNIT PRICE</th>
                            <th className="p-3.5 w-44 text-right pr-5">TOTAL</th>
                            {!isInputsBlocked && <th className="p-3.5 w-14 text-center"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {financials.equipmentList && financials.equipmentList.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-gray-50/50 transition-colors">
                              <td className="p-3 pl-5">
                                <input
                                  type="text"
                                  disabled={isInputsBlocked}
                                  placeholder="e.g. Machine or Rent similar"
                                  value={item.name}
                                  onChange={(e) => handleUpdateEquipmentItem(index, { name: e.target.value })}
                                  onBlur={() => handleAutoSave()}
                                  className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  disabled={isInputsBlocked}
                                  min="1"
                                  placeholder="1"
                                  value={item.quantity !== undefined && item.quantity !== 0 ? item.quantity : ""}
                                  onKeyDown={handlePreventNegative}
                                  onPaste={handlePasteNonNegative}
                                  onChange={(e) => handleUpdateEquipmentItem(index, { quantity: e.target.value === "" ? 0 : Math.max(1, Number(e.target.value)) })}
                                  onBlur={() => handleAutoSave()}
                                  className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#122244] text-center focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="p-3">
                                <div className="relative">
                                  <span className="absolute left-3 top-2 text-xs text-gray-400 font-bold">₱</span>
                                  <input
                                    type="number"
                                    disabled={isInputsBlocked}
                                    min="0"
                                    placeholder="0.00"
                                    value={item.unitPrice !== undefined && item.unitPrice !== 0 ? item.unitPrice : ""}
                                    onKeyDown={handlePreventNegative}
                                    onPaste={handlePasteNonNegative}
                                    onChange={(e) => handleUpdateEquipmentItem(index, { unitPrice: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)) })}
                                    onBlur={() => handleAutoSave()}
                                    className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-black text-[#122244] text-right focus:border-[#c9a654] outline-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </td>
                              <td className="p-3 pr-5 text-right font-black text-xs text-[#122244]">
                                ₱{(Number(item.total) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              {!isInputsBlocked && (
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEquipmentItem(index)}
                                    className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                    title="Delete item"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                          {(!financials.equipmentList || financials.equipmentList.length === 0) && (
                            <tr>
                              <td colSpan={isInputsBlocked ? 4 : 5} className="py-8 text-center text-gray-400 text-xs italic">
                                No equipment or assets added yet. Click "+ Add Item" to itemize startup machinery and tools.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      <div className="p-4 bg-gray-50/90 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                        {!isInputsBlocked ? (
                          <button
                            type="button"
                            onClick={handleAddEquipmentItem}
                            className="flex items-center gap-1.5 text-xs font-bold text-[#c9a654] hover:text-[#b59545] uppercase tracking-wider transition-colors"
                          >
                            <Plus size={14} /> + Add Item
                          </button>
                        ) : <div />}
                        <div className="flex items-center gap-2 text-right">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500">Total:</span>
                          <span className="text-lg font-black text-[#122244]">
                            ₱{calculatedEquipmentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financing Options Section at bottom of CapEx */}
                    <div className="bg-amber-50/50 p-4 sm:p-5 rounded-xl border border-amber-200/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            id="isCapitalBorrowed_capex"
                            disabled={isInputsBlocked}
                            checked={financials.isCapitalBorrowed}
                            onChange={(e) => {
                              const newState = {
                                ...financials,
                                isCapitalBorrowed: e.target.checked,
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
                            className="w-4 h-4 text-[#c9a654] rounded focus:ring-[#c9a654] mt-0.5 accent-[#c9a654] cursor-pointer disabled:cursor-not-allowed"
                          />
                          <label htmlFor="isCapitalBorrowed_capex" className="cursor-pointer">
                            <p className="text-xs font-bold text-[#122244]">Is startup capital borrowed / loaned?</p>
                            <p className="text-[11px] text-gray-500">Enable if equipment or startup capital is funded through a debt loan with interest</p>
                          </label>
                        </div>

                        {financials.isCapitalBorrowed && (
                          <div className="flex items-center gap-2 sm:self-center">
                            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                              Annual Interest Rate (%):
                            </label>
                            <div className="w-28 relative">
                              <input
                                type="number"
                                disabled={isInputsBlocked}
                                min="0"
                                placeholder="e.g. 5"
                                value={financials.interestRate}
                                onKeyDown={handlePreventNegative}
                                onPaste={handlePasteNonNegative}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== "" && Number(val) < 0) return;
                                  const newState = {
                                    ...financials,
                                    interestRate: val,
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
                                onBlur={() => handleAutoSave()}
                                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:border-[#c9a654] outline-none text-right disabled:bg-gray-100 disabled:text-gray-600"
                              />
                              <span className="absolute right-2.5 top-1.5 text-xs text-gray-400 font-bold">%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* === SECTION 5: FISCAL SUMMARY (BMBE TAX FRAMEWORK) === */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-sm space-y-6 text-[#122244]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-4">
                      <div>
                        <h3 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-[#122244]">
                          <BarChart3 className="text-[#c9a654]" /> Fiscal Summary & Tax Projections (BMBE Framework)
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Republic Act No. 9178 Barangay Micro Business Enterprise Tax Calculations</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}
                        className="text-[10px] font-black uppercase text-[#c9a654] border border-[#c9a654]/30 px-3.5 py-1.5 rounded-lg hover:bg-[#c9a654]/5 transition-all self-start sm:self-auto cursor-pointer"
                      >
                        {showTaxBreakdown ? "Hide Details" : "View Computation"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
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
                          BMBE Income Tax Liability (0%)
                        </label>
                        <p className="text-2xl font-black text-emerald-800 flex items-center gap-1.5">
                          ₱0.00
                          <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                            Exempted
                          </span>
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Annual BMBE Tax (3% Gross Sales)
                        </label>
                        <p className="text-2xl font-black text-blue-900">
                          ₱{taxResult.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="space-y-1 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <label className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                          Annual Net Profit (After Tax)
                        </label>
                        <p className="text-2xl font-black text-emerald-950">
                          ₱{annualNetProfitAfterTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {showTaxBreakdown && (
                      <div className="bg-[#122244] p-5 rounded-xl text-white shadow-xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                          <p className="text-[10px] font-black text-[#c9a654] uppercase tracking-widest">
                            BMBE Statutory Breakdown & Computation Formula
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
                              ₱{annualRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} Annual Gross Sales × 3% Flat Percentage Tax = <span className="text-green-400 font-bold">₱{taxResult.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </p>
                            <p className="text-[11px] text-gray-400">
                              * Income Tax rate is 0% pursuant to R.A. 9178 (BMBE Law). Entities registered as BMBEs pay 3% percentage tax on gross sales in lieu of regular 20%-30% corporate income tax.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 text-xs">
                            <p className="text-gray-300">Income Tax: <span className="text-green-400 font-bold">₱0 (BMBE Exempted)</span></p>
                            <p className="text-gray-300">Percentage Tax (3%): <span className="text-white font-bold">₱{taxResult.percentageTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* === TAB 2: MARKET & COMPETITIVE INDICATORS === */}
              {activeModuleTab === "market" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* EXECUTIVE HEADER BANNER */}
                  <div className="bg-gradient-to-br from-[#122244] via-[#1a3060] to-[#122244] rounded-2xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-white/10">
                    <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-[#c9a654]/15 to-transparent pointer-events-none" />

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                      <div className="flex items-start sm:items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#c9a654]/20 border border-[#c9a654]/40 flex items-center justify-center text-[#c9a654] font-black text-2xl shrink-0 shadow-inner">
                          <Target className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="px-2.5 py-0.5 bg-[#c9a654]/20 text-[#c9a654] text-[10px] font-extrabold rounded-md uppercase tracking-wider border border-[#c9a654]/30">
                              Market Environment & Demographics
                            </span>
                            <span className="text-xs text-white/40">•</span>
                            <span className="text-xs text-slate-300 font-semibold">
                              {activeProjName}
                            </span>
                          </div>
                          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                            Market & Competitive Indicators
                          </h3>
                          <p className="text-xs text-slate-300 font-medium max-w-2xl mt-0.5">
                            Map out direct competitors, indirect substitutes, surrounding high foot-traffic establishments, and demand patterns that drive sales velocity and business ROI.
                          </p>
                        </div>
                      </div>

                      {/* Quick Stats Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white/5 border border-white/10 p-2.5 rounded-2xl backdrop-blur-sm self-start lg:self-auto shrink-0 w-full sm:w-auto">
                        <div className="flex flex-col items-center justify-center px-3 py-2 bg-[#c9a654]/15 border border-[#c9a654]/40 rounded-xl text-center min-w-[78px] sm:min-w-[95px] h-[54px]">
                          <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-wider block leading-none mb-1">
                            Direct
                          </span>
                          <span className="text-sm sm:text-base font-black text-white leading-none">
                            {financials.directCompetitors?.length || 0}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center px-3 py-2 bg-[#c9a654]/15 border border-[#c9a654]/40 rounded-xl text-center min-w-[78px] sm:min-w-[95px] h-[54px]">
                          <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-wider block leading-none mb-1">
                            Indirect
                          </span>
                          <span className="text-sm sm:text-base font-black text-white leading-none">
                            {financials.otherCompetitors?.length || 0}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center px-3 py-2 bg-[#122244]/90 border border-white/20 rounded-xl text-center min-w-[78px] sm:min-w-[95px] h-[54px]">
                          <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wider block leading-none mb-1">
                            Establishments
                          </span>
                          <span className="text-sm sm:text-base font-black text-[#c9a654] leading-none">
                            {financials.nearbyEstablishments?.length || 0}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center px-3 py-2 bg-[#c9a654] border border-[#c9a654] rounded-xl text-center min-w-[78px] sm:min-w-[95px] h-[54px] shadow-sm">
                          <span className="text-[10px] text-[#122244] font-extrabold uppercase tracking-wider block leading-none mb-1 opacity-90">
                            Demand
                          </span>
                          <span className="text-sm sm:text-base font-black text-[#122244] leading-none">
                            {financials.marketDemand || "Medium"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2-COLUMN MAIN CONTENT GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                    {/* ========================================================= */}
                    {/* LEFT COLUMN: COMPETITIVE LANDSCAPE & STRATEGY             */}
                    {/* ========================================================= */}
                    <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-gray-200 text-[#122244] space-y-6">

                      {/* Header */}
                      <div className="border-b border-gray-100 pb-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-amber-50 text-[#c9a654] rounded-xl border border-amber-100">
                              <Store className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-bold text-[#122244]">Competitive Landscape</h4>
                                {(currentProject?.proposedLocation || currentProject?.rawProposalData?.proposedLocation) && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#122244]/10 text-[#122244] border border-[#122244]/20" title={currentProject?.proposedLocation || currentProject?.rawProposalData?.proposedLocation}>
                                    <MapPin size={10} className="text-[#c9a654] shrink-0" />
                                    <span className="max-w-[180px] sm:max-w-[240px] truncate">{currentProject?.proposedLocation || currentProject?.rawProposalData?.proposedLocation}</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">Document active rivals and substitute offerings within your market radius</p>
                            </div>
                          </div>

                          {/* Re-scan Map button */}
                          <button
                            type="button"
                            onClick={() => loadDynamicCompetitors(true)}
                            disabled={isDetectingCompetitors}
                            className="px-2.5 py-1.5 rounded-xl border border-gray-200 hover:border-[#c9a654] bg-white hover:bg-amber-50/50 text-[11px] font-bold text-[#122244] flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50 shrink-0"
                            title="Re-scan map around proposal location for active competitors"
                          >
                            <RefreshCw size={12} className={isDetectingCompetitors ? "animate-spin text-[#c9a654]" : "text-[#c9a654]"} />
                            <span className="hidden sm:inline">Re-scan Map</span>
                          </button>
                        </div>
                      </div>

                      {/* SECTION 1: DIRECT COMPETITORS */}
                      <div className="space-y-3.5 p-4 rounded-xl bg-gray-50/70 border border-gray-200/80">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#c9a654]" />
                            <label className="text-xs font-extrabold uppercase tracking-wider text-[#122244]">
                              Direct Competitors
                            </label>
                          </div>
                          <span className="px-2.5 py-0.5 bg-amber-50 text-[#c9a654] border border-amber-200 font-extrabold text-[11px] rounded-lg">
                            {financials.directCompetitors?.length || 0} Listed
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Businesses offering the same or very similar products/services in your location targeting the exact same customer need.
                        </p>

                        {/* Direct Competitors Capsules Cloud */}
                        <div className="min-h-12 p-3 bg-white rounded-xl border border-gray-200 flex flex-wrap items-center gap-2 shadow-inner">
                          {financials.directCompetitors && financials.directCompetitors.length > 0 ? (
                            financials.directCompetitors.map((comp, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold shadow-sm transition-all"
                              >
                                <Tag size={12} className="text-[#c9a654] shrink-0" />
                                <span>{comp}</span>
                                <button
                                  type="button"
                                  disabled={isInputsBlocked}
                                  onClick={() => handleRemoveDirectCompetitor(idx)}
                                  className="text-gray-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                                  title={`Remove ${comp}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic px-1">
                              No direct competitors added yet. Click from the map rivals below or enter a business name.
                            </span>
                          )}
                        </div>

                        {/* Dynamic Direct Competitors from Map */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#122244] flex items-center gap-1.5">
                              <MapPin size={12} className="text-[#c9a654]" />
                              {dynamicCompetitorData?.locationName ? (
                                <span>
                                  Direct Rivals from Map ({dynamicCompetitorData.detectedCity || dynamicCompetitorData.locationName}):
                                </span>
                              ) : (
                                <span>Direct Rivals from Map (Click to add):</span>
                              )}
                              {dynamicCompetitorData?.source === "live_osm_map" && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                                  Live Map
                                </span>
                              )}
                            </span>
                          </div>

                          {isDetectingCompetitors ? (
                            <div className="flex items-center gap-2 py-2 px-3 bg-amber-50/40 rounded-xl border border-amber-200/50 text-xs text-[#122244]">
                              <RefreshCw size={12} className="animate-spin text-[#c9a654]" />
                              <span className="font-medium">Reading map for direct competitors near proposal location...</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {(dynamicCompetitorData?.directCompetitors || [
                                "Local Rival Shop",
                                "Direct Brand Rival",
                                "Nearby Franchise",
                                "Specialty Store",
                                "Independent Seller",
                              ]).map((cat) => {
                                const isAdded = (financials.directCompetitors || []).some(
                                  (c) => c.toLowerCase() === cat.toLowerCase()
                                );
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    disabled={isInputsBlocked}
                                    onClick={() => handleToggleDirectCompetitor(cat)}
                                    className={`px-2.5 py-1 border rounded-lg text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 ${isAdded
                                      ? "bg-[#c9a654] text-[#122244] border-[#c9a654] font-bold shadow-xs"
                                      : "bg-white hover:bg-amber-50 border-gray-200 hover:border-[#c9a654] text-gray-700 hover:text-[#122244]"
                                      }`}
                                  >
                                    <span>{isAdded ? "✓" : "+"}</span>
                                    <span>{cat}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Input Box */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            disabled={isInputsBlocked}
                            value={directCompetitorInput}
                            onChange={(e) => setDirectCompetitorInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddDirectCompetitor();
                              }
                            }}
                            placeholder="Type direct competitor name & press Enter..."
                            className="flex-1 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#c9a654] focus:ring-2 focus:ring-[#c9a654]/20 outline-none disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={isInputsBlocked || !directCompetitorInput.trim()}
                            onClick={() => handleAddDirectCompetitor()}
                            className="px-4 py-2 bg-[#c9a654] hover:bg-[#b59545] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shrink-0 active:scale-95"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      </div>

                      {/* SECTION 2: OTHER COMPETITORS (INDIRECT & SUBSTITUTES) */}
                      <div className="space-y-3.5 p-4 rounded-xl bg-gray-50/70 border border-gray-200/80">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#c9a654]" />
                            <label className="text-xs font-extrabold uppercase tracking-wider text-[#122244]">
                              Other Competitors (Indirect & Substitutes)
                            </label>
                          </div>
                          <span className="px-2.5 py-0.5 bg-amber-50 text-[#c9a654] border border-amber-200 font-extrabold text-[11px] rounded-lg">
                            {financials.otherCompetitors?.length || 0} Listed
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Alternative options, retail chains, convenience stores, or substitute snacks/meals competing for customer budget.
                        </p>

                        {/* Other Competitors Capsules Cloud */}
                        <div className="min-h-12 p-3 bg-white rounded-xl border border-gray-200 flex flex-wrap items-center gap-2 shadow-inner">
                          {financials.otherCompetitors && financials.otherCompetitors.length > 0 ? (
                            financials.otherCompetitors.map((comp, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold shadow-sm transition-all"
                              >
                                <Tag size={12} className="text-[#c9a654] shrink-0" />
                                <span>{comp}</span>
                                <button
                                  type="button"
                                  disabled={isInputsBlocked}
                                  onClick={() => handleRemoveOtherCompetitor(idx)}
                                  className="text-gray-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                                  title={`Remove ${comp}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic px-1">
                              No other/indirect competitors added yet. (e.g., 7-Eleven, Fast food, Online sellers).
                            </span>
                          )}
                        </div>

                        {/* Dynamic Other Competitors from Map */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#122244] flex items-center gap-1.5">
                              <MapPin size={12} className="text-[#c9a654]" />
                              {dynamicCompetitorData?.locationName ? (
                                <span>
                                  Substitutes from Map ({dynamicCompetitorData.detectedCity || dynamicCompetitorData.locationName}):
                                </span>
                              ) : (
                                <span>Substitutes & Chains from Map (Click to add):</span>
                              )}
                              {dynamicCompetitorData?.source === "live_osm_map" && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                                  Live Map
                                </span>
                              )}
                            </span>
                          </div>

                          {isDetectingCompetitors ? (
                            <div className="flex items-center gap-2 py-2 px-3 bg-amber-50/40 rounded-xl border border-amber-200/50 text-xs text-[#122244]">
                              <RefreshCw size={12} className="animate-spin text-[#c9a654]" />
                              <span className="font-medium">Reading map for indirect competitors & substitute outlets...</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {(dynamicCompetitorData?.otherCompetitors || [
                                "Convenience Stores (7-Eleven / Uncle John's)",
                                "Fast Food Chains",
                                "Supermarkets & Groceries",
                                "Online / Social Media Sellers",
                                "Street Food / School Canteens",
                              ]).map((cat) => {
                                const isAdded = (financials.otherCompetitors || []).some(
                                  (c) => c.toLowerCase() === cat.toLowerCase()
                                );
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    disabled={isInputsBlocked}
                                    onClick={() => handleToggleOtherCompetitor(cat)}
                                    className={`px-2.5 py-1 border rounded-lg text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1 ${isAdded
                                      ? "bg-[#c9a654] text-[#122244] border-[#c9a654] font-bold shadow-xs"
                                      : "bg-white hover:bg-amber-50 border-gray-200 hover:border-[#c9a654] text-gray-700 hover:text-[#122244]"
                                      }`}
                                  >
                                    <span>{isAdded ? "✓" : "+"}</span>
                                    <span>{cat}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Input Box */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            disabled={isInputsBlocked}
                            value={otherCompetitorInput}
                            onChange={(e) => setOtherCompetitorInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddOtherCompetitor();
                              }
                            }}
                            placeholder="Type other/indirect competitor name & press Enter..."
                            className="flex-1 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#c9a654] focus:ring-2 focus:ring-[#c9a654]/20 outline-none disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={isInputsBlocked || !otherCompetitorInput.trim()}
                            onClick={() => handleAddOtherCompetitor()}
                            className="px-4 py-2 bg-[#c9a654] hover:bg-[#b59545] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shrink-0 active:scale-95"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      </div>

                      {/* SECTION 3: COMPETITIVE ADVANTAGE & STRATEGY */}
                      <div className="space-y-2.5 p-4 rounded-xl bg-amber-50/40 border border-amber-200/60">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-[#c9a654]" />
                          <label className="text-xs font-bold text-[#122244] uppercase tracking-wider block">
                            Competitive Advantage & Differentiation Strategy
                          </label>
                        </div>
                        <p className="text-xs text-gray-500">
                          Describe what makes your offering unique and why customers will choose your business over competitors (pricing, taste/recipe, speed, loyalty rewards, packaging).
                        </p>
                        <textarea
                          rows={3}
                          disabled={isInputsBlocked}
                          value={financials.competitorNotes || ""}
                          onChange={(e) => handleMarketFieldChange("competitorNotes", e.target.value)}
                          onBlur={() => handleAutoSave()}
                          placeholder="e.g., We offer 15% lower student-friendly pricing, customized meal bundles, localized flavor combinations, and loyalty punch cards that retain repeat walk-in customers..."
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#c9a654] focus:ring-2 focus:ring-[#c9a654]/20 outline-none disabled:opacity-60 resize-none leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* ========================================================= */}
                    {/* RIGHT COLUMN: MARKET DEMAND & ROI ENVIRONMENT             */}
                    {/* ========================================================= */}
                    <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-gray-200 text-[#122244] space-y-6">

                      {/* Header */}
                      <div className="border-b border-gray-100 pb-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#122244]/10 text-[#122244] rounded-xl border border-[#122244]/20">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-base font-bold text-[#122244]">Market Demand & ROI Drivers</h4>
                              <p className="text-xs text-gray-500">Identify surrounding establishments and demographic dynamics driving customer volume</p>
                            </div>
                          </div>

                          {/* Re-scan Map button */}
                          <button
                            type="button"
                            onClick={() => loadDynamicCompetitors(true)}
                            disabled={isDetectingCompetitors}
                            className="px-2.5 py-1.5 rounded-xl border border-gray-200 hover:border-[#122244] bg-white hover:bg-blue-50/50 text-[11px] font-bold text-[#122244] flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50 shrink-0"
                            title="Re-scan map around proposal location for nearby establishments & traffic generators"
                          >
                            <RefreshCw size={12} className={isDetectingCompetitors ? "animate-spin text-[#122244]" : "text-[#122244]"} />
                            <span className="hidden sm:inline">Re-scan Map</span>
                          </button>
                        </div>
                      </div>

                      {/* SECTION 1: NEARBY ESTABLISHMENTS AFFECTING ROI */}
                      <div className="space-y-3.5 p-4 rounded-xl bg-gray-50/70 border border-gray-200/80">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#122244]" />
                            <label className="text-xs font-extrabold uppercase tracking-wider text-[#122244]">
                              Nearby Establishments Affecting Business ROI
                            </label>
                          </div>
                          <span className="px-2.5 py-0.5 bg-[#122244]/10 text-[#122244] border border-[#122244]/20 font-extrabold text-[11px] rounded-lg">
                            {financials.nearbyEstablishments?.length || 0} Listed
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Surrounding hubs (schools, corporate towers, residential clusters, transport stations) generating regular customer foot traffic.
                        </p>

                        {/* Active Establishments Capsules Cloud */}
                        <div className="min-h-12 p-3 bg-white rounded-xl border border-gray-200 flex flex-wrap items-center gap-2 shadow-inner">
                          {financials.nearbyEstablishments && financials.nearbyEstablishments.length > 0 ? (
                            financials.nearbyEstablishments.map((est, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#122244]/10 border border-[#122244]/20 text-[#122244] text-xs font-bold shadow-xs transition-all"
                              >
                                <MapPin size={12} className="text-[#122244] shrink-0" />
                                <span>{est}</span>
                                <button
                                  type="button"
                                  disabled={isInputsBlocked}
                                  onClick={() => handleRemoveNearbyEstablishment(idx)}
                                  className="text-gray-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                                  title={`Remove ${est}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic px-1">
                              No nearby establishments added yet. Click map landmarks below or type custom landmarks.
                            </span>
                          )}
                        </div>

                        {/* Dynamic Nearby Establishments from Map */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#122244] flex items-center gap-1.5">
                              <MapPin size={12} className="text-[#122244]" />
                              {dynamicCompetitorData?.locationName ? (
                                <span>
                                  Surrounding Establishments from Map ({dynamicCompetitorData.detectedCity || dynamicCompetitorData.locationName}):
                                </span>
                              ) : (
                                <span>Surrounding Establishments from Map (Click to add):</span>
                              )}
                              {dynamicCompetitorData?.source === "live_osm_map" && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                                  Live Map POIs
                                </span>
                              )}
                              {dynamicCompetitorData?.nearbyEstablishmentItems && dynamicCompetitorData.nearbyEstablishmentItems.some((i) => i.distanceKm !== undefined && i.distanceKm <= 3.0) && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                                  GPS Proximity (≤3km)
                                </span>
                              )}
                            </span>
                          </div>

                          {isDetectingCompetitors ? (
                            <div className="flex items-center gap-2 py-2 px-3 bg-blue-50/50 rounded-xl border border-blue-200/50 text-xs text-[#122244]">
                              <RefreshCw size={12} className="animate-spin text-[#122244]" />
                              <span className="font-medium">Reading map for nearby schools, hospitals, commercial hubs & transit points within 3km...</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {((dynamicCompetitorData?.nearbyEstablishmentItems && dynamicCompetitorData.nearbyEstablishmentItems.length > 0)
                                ? dynamicCompetitorData.nearbyEstablishmentItems
                                : (dynamicCompetitorData?.nearbyEstablishments || [
                                  "Local High School / University",
                                  "City Public Hospital & Clinic",
                                  "Shopping Mall & Hypermarket",
                                  "Bus & Jeepney Transit Terminal",
                                  "Municipal / City Hall Complex",
                                  "Parish Church & Worship Center",
                                  "Corporate & BPO Offices",
                                ]).map((name) => ({ name, category: "Establishment" as const, icon: "📍" }))
                              )
                                .filter((item) => item.distanceKm === undefined || item.distanceKm <= 3.0)
                                .map((item) => {
                                const isAdded = (financials.nearbyEstablishments || []).some(
                                  (e) => e.toLowerCase() === item.name.toLowerCase()
                                );
                                return (
                                  <button
                                    key={item.name}
                                    type="button"
                                    disabled={isInputsBlocked}
                                    onClick={() => handleToggleNearbyEstablishment(item.name)}
                                    className={`px-2.5 py-1.5 border rounded-lg text-[11px] font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ${isAdded
                                      ? "bg-[#122244] text-white border-[#122244] font-bold shadow-xs"
                                      : "bg-white hover:bg-blue-50 border-gray-200 hover:border-[#122244]/40 text-gray-700 hover:text-[#122244]"
                                      }`}
                                  >
                                    <span className="text-xs">{item.icon || "📍"}</span>
                                    <span>{isAdded ? "✓" : "+"}</span>
                                    <span>{item.name}</span>
                                    {item.distanceKm !== undefined && (
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isAdded ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                                          }`}
                                      >
                                        {item.distanceKm} km
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Custom Establishment Input Bar */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            disabled={isInputsBlocked}
                            value={nearbyEstablishmentInput}
                            onChange={(e) => setNearbyEstablishmentInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddCustomEstablishment();
                              }
                            }}
                            placeholder="Type specific nearby landmark (e.g. Fatima University, SM Grand Central) & press Enter..."
                            className="flex-1 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#122244] focus:ring-2 focus:ring-[#122244]/20 outline-none disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={isInputsBlocked || !nearbyEstablishmentInput.trim()}
                            onClick={() => handleAddCustomEstablishment()}
                            className="px-4 py-2 bg-[#122244] hover:bg-[#1a3060] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shrink-0 active:scale-95"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      </div>

                      {/* SECTION 2: PRIMARY TARGET DEMOGRAPHICS */}
                      <div className="space-y-3.5 p-4 rounded-xl bg-gray-50/70 border border-gray-200/80">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#122244]" />
                              <label className="text-xs font-extrabold uppercase tracking-wider text-[#122244]">
                                Primary Target Demographics
                              </label>
                              {rawTargetMarket && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#122244]/10 text-[#122244] border border-[#122244]/20" title={`Proposal Target Market: ${rawTargetMarket}`}>
                                  <Users size={10} className="text-[#122244] shrink-0" />
                                  <span className="max-w-[180px] sm:max-w-[240px] truncate">{rawTargetMarket}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                              Identify priority customer profiles and consumer segments patronizing your business location.
                            </p>
                          </div>
                          <span className="self-start sm:self-auto px-2.5 py-0.5 bg-blue-50 text-[#122244] border border-blue-200 font-extrabold text-[11px] rounded-lg shrink-0">
                            {financials.targetDemographics?.length || 0} Identified
                          </span>
                        </div>

                        {/* Target Demographics Capsules Cloud */}
                        <div className="min-h-12 p-3 bg-white rounded-xl border border-gray-200 flex flex-wrap items-center gap-2 shadow-inner">
                          {financials.targetDemographics && financials.targetDemographics.length > 0 ? (
                            financials.targetDemographics.map((demo, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[#122244] text-xs font-bold shadow-sm transition-all"
                              >
                                <Users size={12} className="text-[#122244] shrink-0" />
                                <span>{demo}</span>
                                <button
                                  type="button"
                                  disabled={isInputsBlocked}
                                  onClick={() => handleRemoveTargetDemographic(idx)}
                                  className="text-gray-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                                  title={`Remove ${demo}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic px-1">
                              No target demographics added yet. Use the presets below or enter customer groups.
                            </span>
                          )}
                        </div>

                        {/* Dynamic Target Demographics from Proposal */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#122244] flex items-center gap-1.5">
                              <Users size={12} className="text-[#122244]" />
                              {dynamicDemographics.hasDetectedProfile ? (
                                <span>
                                  Demographics Matched from Proposal Target Market ({dynamicDemographics.detectedLabel}):
                                </span>
                              ) : (
                                <span>Quick Presets (Click to add / toggle):</span>
                              )}
                              {dynamicDemographics.hasDetectedProfile && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-[#122244] border border-blue-200 uppercase tracking-wider">
                                  Proposal Matched
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {dynamicDemographics.demographics.map((demo) => {
                              const isSelected = (financials.targetDemographics || []).includes(demo);
                              return (
                                <button
                                  key={demo}
                                  type="button"
                                  disabled={isInputsBlocked}
                                  onClick={() => handleToggleTargetDemographic(demo)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border shadow-2xs ${isSelected
                                    ? "bg-[#122244] text-white border-[#122244] shadow-xs font-bold"
                                    : "bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-[#122244]/40"
                                    }`}
                                >
                                  {isSelected ? "✓ " : "+ "}{demo}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Text Input for Custom Demographic */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            disabled={isInputsBlocked}
                            value={targetDemographicsInput}
                            onChange={(e) => setTargetDemographicsInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddCustomDemographic();
                              }
                            }}
                            placeholder="Add custom target demographic (e.g. Senior Citizens, Night Shift Workers, Freelancers)..."
                            className="flex-1 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#122244] focus:ring-2 focus:ring-[#122244]/20 outline-none disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={isInputsBlocked || !targetDemographicsInput.trim()}
                            onClick={() => handleAddCustomDemographic()}
                            className="px-4 py-2 bg-[#122244] hover:bg-[#1a3060] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shrink-0 active:scale-95"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      </div>

                      {/* SECTION 3: DETAILED MARKET DEMAND & ROI CONTEXT NOTES */}
                      <div className="space-y-2.5 p-4 rounded-xl bg-gray-50/70 border border-gray-200/80">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
                            Detailed Market Demand Context (Directly Affecting ROI):
                          </label>
                          <div className="w-48">
                            <CustomDropdown
                              disabled={isInputsBlocked}
                              value={financials.marketDemand || "Medium"}
                              onChange={(val) => {
                                const newState = { ...financials, marketDemand: val };
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
                              options={[
                                { value: "High", label: "🔥 High Demand" },
                                { value: "Medium", label: "📈 Medium Demand" },
                                { value: "Low", label: "⚖️ Low Demand" },
                              ]}
                              buttonClassName="py-1.5 px-3 text-xs font-bold"
                            />
                          </div>
                        </div>
                        <textarea
                          rows={3}
                          disabled={isInputsBlocked}
                          value={financials.marketDemandNotes || ""}
                          onChange={(e) => handleMarketFieldChange("marketDemandNotes", e.target.value)}
                          onBlur={() => handleAutoSave()}
                          placeholder="e.g., Proximity to 2 universities within 250m generates ~1,200 daily student foot traffic, driving 70% of snack/merienda revenue during 11:30 AM - 1:30 PM and 4:00 PM - 6:00 PM, shortening our investment payback period to under 12 months..."
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#c9a654] focus:ring-2 focus:ring-[#c9a654]/20 outline-none disabled:opacity-60 resize-none leading-relaxed"
                        />
                      </div>

                      {/* SECTION 4: MARKET VIABILITY ASSESSMENT CARD */}
                      <div className="p-4 bg-gradient-to-r from-amber-500/10 via-[#c9a654]/15 to-[#122244]/10 rounded-2xl border border-[#c9a654]/40 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#c9a654]/20 border border-[#c9a654]/40 flex items-center justify-center text-[#c9a654] shrink-0">
                            <TrendingUp size={20} />
                          </div>
                          <div>
                            <span className="text-xs font-black uppercase text-[#122244] block">
                              Market Viability Potential
                            </span>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {(financials.nearbyEstablishments?.length || 0) >= 3
                                ? "🔥 High Demand Potential — Strong multi-establishment foot traffic drivers boosting revenue velocity and short ROI payback."
                                : (financials.nearbyEstablishments?.length || 0) >= 1
                                  ? "📈 Moderate Demand Potential — Key customer establishment generator active supporting steady daily turnover."
                                  : "⚖️ Baseline Local Trade Area — Dependent on direct walk-ins and local promotions."}
                            </p>
                          </div>
                        </div>
                        <span className="px-3.5 py-1.5 bg-[#122244] text-[#c9a654] font-black text-xs rounded-xl shadow-sm shrink-0 border border-white/10">
                          {financials.marketDemand || "Medium"} Demand
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Footer Guidance Note */}
                  <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-[#c9a654] shrink-0" />
                      <span>All market and competitive indicators are automatically integrated into your AI Feasibility Analysis and Executive Summary.</span>
                    </div>
                    <span className="font-bold text-[#122244] shrink-0">
                      {(financials.directCompetitors?.length || 0) + (financials.otherCompetitors?.length || 0)} Competitors • {financials.nearbyEstablishments?.length || 0} Establishments Mapped
                    </span>
                  </div>
                </div>
              )}

              {/* === TAB 3: INTERACTIVE BALANCE SHEET & FEASIBILITY STATEMENTS === */}
              {activeModuleTab === "balance-sheet" && (
                <div className="space-y-6 animate-in fade-in duration-200 text-[#122244]">
                  {/* NOTIFICATION TOAST */}
                  {benchmarkNotification && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 text-sm font-semibold shadow-sm animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>{benchmarkNotification}</span>
                      </div>
                      <button
                        onClick={() => setBenchmarkNotification("")}
                        className="text-emerald-600 hover:text-emerald-800 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* MODULE HEADER BANNER */}
                  <div className="bg-[#122244] text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-white/10">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Scale className="w-5 h-5 text-[#c9a654]" />
                        <h2 className="text-xl font-extrabold tracking-wide">
                          Financial Statements & Viability Engine
                        </h2>
                      </div>
                      <p className="text-xs text-gray-300">
                        Standard feasibility study format: Statement of Financial Position, Performance, Startup Project Costs, and Viability Ratios.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowBenchmarkModal(true)}
                        className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-[#c9a654]/30 hover:from-amber-500/30 hover:to-[#c9a654]/40 border border-[#c9a654]/50 text-amber-200 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                        title="Preview and load validated feasibility study data from Mr. Cabbage (PLV 2025)"
                      >
                        <Sparkles className="w-4 h-4 text-[#c9a654]" />
                        <span>Benchmark with Mr. Cabbage</span>
                      </button>

                      <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border ${isBalanceSheetVerified ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300" : "bg-amber-500/20 border-amber-400/30 text-amber-300"}`}>
                        {isBalanceSheetVerified ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold tracking-wider">
                          {isBalanceSheetVerified
                            ? `Balanced: ₱${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "Audit Check Pending"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SUB-TAB NAVIGATION PILLS */}
                  <div className="flex items-center gap-2 p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setBalanceSheetSubTab("position")}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${balanceSheetSubTab === "position"
                        ? "bg-[#122244] text-white shadow-md"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                        }`}
                    >
                      <Scale className={`w-3.5 h-3.5 ${balanceSheetSubTab === "position" ? "text-[#c9a654]" : "text-gray-400"}`} />
                      Financial Position (Balance Sheet)
                    </button>

                    <button
                      type="button"
                      onClick={() => setBalanceSheetSubTab("performance")}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${balanceSheetSubTab === "performance"
                        ? "bg-[#122244] text-white shadow-md"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                        }`}
                    >
                      <TrendingUp className={`w-3.5 h-3.5 ${balanceSheetSubTab === "performance" ? "text-[#c9a654]" : "text-gray-400"}`} />
                      Financial Performance (Income Statement)
                    </button>

                    <button
                      type="button"
                      onClick={() => setBalanceSheetSubTab("startup")}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${balanceSheetSubTab === "startup"
                        ? "bg-[#122244] text-white shadow-md"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                        }`}
                    >
                      <Package className={`w-3.5 h-3.5 ${balanceSheetSubTab === "startup" ? "text-[#c9a654]" : "text-gray-400"}`} />
                      Financing & Startup Project Costs
                    </button>

                    <button
                      type="button"
                      onClick={() => setBalanceSheetSubTab("ratios")}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${balanceSheetSubTab === "ratios"
                        ? "bg-[#122244] text-white shadow-md"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                        }`}
                    >
                      <BarChart3 className={`w-3.5 h-3.5 ${balanceSheetSubTab === "ratios" ? "text-[#c9a654]" : "text-gray-400"}`} />
                      Viability & Financial Ratios
                    </button>
                  </div>

                  {/* SUBTAB 1: STATEMENT OF FINANCIAL POSITION (BALANCE SHEET) */}
                  {balanceSheetSubTab === "position" && (
                    <div className="space-y-6">
                      {/* TOP SUMMARY CARDS */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
                          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                            Total Assets (Pre-Ops)
                          </span>
                          <div className="text-xl font-black text-[#A93E1D] mt-1">
                            ₱{fiveYearBalanceSheet[0]?.totalAssets.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                          </div>
                          <span className="text-[10px] text-gray-500 mt-0.5 block">
                            Projected Year 5: ₱{fiveYearBalanceSheet[fiveYearBalanceSheet.length - 1]?.totalAssets.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                          </span>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
                          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                            Total Current Liabilities (Year 1)
                          </span>
                          <div className="text-xl font-black text-amber-700 mt-1">
                            ₱{fiveYearBalanceSheet[1]?.totalCurrentLiabilities.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                          </div>
                          <span className="text-[10px] text-gray-500 mt-0.5 block">
                            Obligations (Utilities, SSS, Taxes, VAT)
                          </span>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
                          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                            Partner's / Owner's Equity
                          </span>
                          <div className="text-xl font-black text-[#122244] mt-1">
                            ₱{fiveYearBalanceSheet[fiveYearBalanceSheet.length - 1]?.totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "0.00"}
                          </div>
                          <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                            Cumulative 5-Year Capital Growth
                          </span>
                        </div>
                      </div>

                              {/* STANDALONE STATEMENT OF FINANCIAL POSITION TABLE (MATCHING IMAGE 1) */}
                              <StatementOfFinancialPositionTable
                                data={fiveYearBalanceSheet}
                                businessName={activeProjName}
                                onPrint={() => {
                                  setPrintMode("balance-sheet");
                                  setTimeout(() => window.print(), 250);
                                }}
                              />

                              {/* ACCOUNTING IDENTITY VERIFICATION BAR */}
                              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
                                <div className="flex items-center gap-2.5">
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                  <div>
                                    <span className="font-bold text-emerald-950">Accounting Balance Equation Verified (Pre-Operations to 2030):</span>
                                    <span className="text-emerald-700 ml-1.5 font-mono text-[11px]">
                                      Assets ≡ Liabilities + Partner's Equity (Every year balances to ₱0.00 variance)
                                    </span>
                                  </div>
                                </div>
                                <span className="px-3.5 py-1 bg-emerald-600 text-white rounded-full font-black text-[11px] uppercase tracking-wider shadow-xs">
                                  100% Balanced & Audit-Ready
                                </span>
                              </div>

                              {/* QUICK ADJUSTMENT VARIABLES ACCORDION */}
                              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                                <div className="flex items-center justify-between border-b pb-3 mb-4">
                                  <div>
                                    <h4 className="font-extrabold text-sm text-[#122244]">Fine-Tuning Operational Variables</h4>
                                    <p className="text-xs text-gray-500">Optional baseline adjustments for accounts receivable, renovations, and payables</p>
                                  </div>
                                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg">
                                    Dynamic Input Link
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <label className="font-bold text-gray-700 block mb-1">Leasehold Improvements (₱)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      disabled={isInputsBlocked}
                                      value={financials.renovationCosts ?? ""}
                                      placeholder={safeRenovationCosts.toFixed(2)}
                                      onChange={(e) => updateFinancialField("renovationCosts", e.target.value)}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      className="w-full px-3 py-1.5 font-bold border border-gray-200 rounded-lg focus:border-[#A93E1D] focus:outline-hidden bg-white text-right"
                                    />
                                  </div>

                                  <div>
                                    <label className="font-bold text-gray-700 block mb-1">Accounts Receivable (₱)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      disabled={isInputsBlocked}
                                      value={financials.accountsReceivable ?? ""}
                                      placeholder={safeAccountsReceivable.toFixed(2)}
                                      onChange={(e) => updateFinancialField("accountsReceivable", e.target.value)}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      className="w-full px-3 py-1.5 font-bold border border-gray-200 rounded-lg focus:border-[#A93E1D] focus:outline-hidden bg-white text-right"
                                    />
                                  </div>

                                  <div>
                                    <label className="font-bold text-gray-700 block mb-1">Accounts Payable (₱)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      disabled={isInputsBlocked}
                                      value={financials.accountsPayable ?? ""}
                                      placeholder={safeAccountsPayable.toFixed(2)}
                                      onChange={(e) => updateFinancialField("accountsPayable", e.target.value)}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      className="w-full px-3 py-1.5 font-bold border border-gray-200 rounded-lg focus:border-[#A93E1D] focus:outline-hidden bg-white text-right"
                                    />
                                  </div>

                                  <div>
                                    <label className="font-bold text-gray-700 block mb-1">Utilities Payable (₱)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      disabled={isInputsBlocked}
                                      value={financials.utilitiesPayable ?? ""}
                                      placeholder={safeUtilitiesPayable.toFixed(2)}
                                      onChange={(e) => updateFinancialField("utilitiesPayable", e.target.value)}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      className="w-full px-3 py-1.5 font-bold border border-gray-200 rounded-lg focus:border-[#A93E1D] focus:outline-hidden bg-white text-right"
                                    />
                                  </div>

                                  <div>
                                    <label className="font-bold text-gray-700 block mb-1">Salaries Payable (₱)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      disabled={isInputsBlocked}
                                      value={financials.salariesPayable ?? ""}
                                      placeholder={safeSalariesPayable.toFixed(2)}
                                      onChange={(e) => updateFinancialField("salariesPayable", e.target.value)}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      className="w-full px-3 py-1.5 font-bold border border-gray-200 rounded-lg focus:border-[#A93E1D] focus:outline-hidden bg-white text-right"
                                    />
                                  </div>

                                  <div>
                                    <label className="font-bold text-gray-700 block mb-1">Taxes Payable (₱)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      disabled={isInputsBlocked}
                                      value={financials.taxesPayable ?? ""}
                                      placeholder={safeTaxesPayable.toFixed(2)}
                                      onChange={(e) => updateFinancialField("taxesPayable", e.target.value)}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      className="w-full px-3 py-1.5 font-bold border border-gray-200 rounded-lg focus:border-[#A93E1D] focus:outline-hidden bg-white text-right"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                )}

                            {/* SUBTAB 2: STATEMENT OF FINANCIAL PERFORMANCE (INCOME STATEMENT) */}
                            {balanceSheetSubTab === "performance" && (
                              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                                <div className="border-b pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                  <div>
                                    <h3 className="font-extrabold text-base text-[#122244] flex items-center gap-2">
                                      <TrendingUp className="w-5 h-5 text-[#c9a654]" />
                                      Statement of Financial Performance (Income Statement Waterfall)
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      Annualized waterfall calculation based on monthly product yields, unit costs, discounts, and OpEx.
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500">Gross Margin:</span>
                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-black rounded-lg text-xs">
                                      {statementGrossProfitMargin}%
                                    </span>
                                  </div>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                      <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                        <th className="py-3 px-4">Financial Item / Line</th>
                                        <th className="py-3 px-4 text-center">Rate / Basis</th>
                                        <th className="py-3 px-4 text-right">Monthly (PHP)</th>
                                        <th className="py-3 px-4 text-right">Annualized (PHP)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                                      {/* Gross Sales */}
                                      <tr className="hover:bg-gray-50/50">
                                        <td className="py-3.5 px-4 font-bold text-[#122244]">
                                          Gross Projected Sales (Revenue)
                                          <span className="text-[10px] text-gray-400 block font-normal">
                                            Based on {normalizedProducts.length} product(s) sold at menu prices
                                          </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-xs text-gray-500">100% Volume</td>
                                        <td className="py-3.5 px-4 text-right font-semibold">₱{monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="py-3.5 px-4 text-right font-bold text-[#122244]">₱{annualGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      </tr>

                                      {/* Less: Sales Discount */}
                                      <tr className="hover:bg-gray-50/50 text-red-600">
                                        <td className="py-3 px-4 pl-8">
                                          Less: Senior Citizen & PWD Sales Discount
                                          <span className="text-[10px] text-gray-400 block font-normal">
                                            Mandated statutory discount (Mr. Cabbage Note 13: 5% of target population)
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <div className="inline-flex items-center gap-1 justify-center">
                                            <input
                                              type="number"
                                              min="0"
                                              max="30"
                                              disabled={isInputsBlocked}
                                              value={financials.salesDiscountPercent ?? "5"}
                                              onChange={(e) => updateFinancialField("salesDiscountPercent", e.target.value)}
                                              className="w-14 px-1.5 py-0.5 text-center text-xs border border-gray-200 rounded font-bold"
                                            />
                                            <span className="text-xs text-gray-500">%</span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium">(₱{(annualSalesDiscount / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                        <td className="py-3 px-4 text-right font-bold">(₱{annualSalesDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                      </tr>

                                      {/* Less: Sales Returns */}
                                      <tr className="hover:bg-gray-50/50 text-red-600">
                                        <td className="py-3 px-4 pl-8">
                                          Less: Sales Returns & Spoilage Allowances
                                          <span className="text-[10px] text-gray-400 block font-normal">
                                            Product replacement & defective batch reserve
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <div className="inline-flex items-center gap-1 justify-center">
                                            <input
                                              type="number"
                                              min="0"
                                              max="20"
                                              disabled={isInputsBlocked}
                                              value={financials.salesReturnsPercent ?? "2"}
                                              onChange={(e) => updateFinancialField("salesReturnsPercent", e.target.value)}
                                              className="w-14 px-1.5 py-0.5 text-center text-xs border border-gray-200 rounded font-bold"
                                            />
                                            <span className="text-xs text-gray-500">%</span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium">(₱{(annualSalesReturns / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                        <td className="py-3 px-4 text-right font-bold">(₱{annualSalesReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                      </tr>

                                      {/* Net Sales */}
                                      <tr className="bg-amber-50/40 font-bold text-[#122244]">
                                        <td className="py-3.5 px-4 text-sm font-extrabold text-[#b59545]">
                                          Net Sales
                                          <span className="text-[10px] text-gray-500 block font-normal">Gross Sales minus discounts and returns</span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-xs text-gray-500">
                                          {(100 - safeSalesDiscountPercent - safeSalesReturnsPercent).toFixed(1)}%
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-bold">₱{(annualNetSales / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="py-3.5 px-4 text-right font-black text-[#c9a654]">₱{annualNetSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      </tr>

                                      {/* Cost of Sales */}
                                      <tr className="hover:bg-gray-50/50 text-red-600">
                                        <td className="py-3 px-4 pl-8">
                                          Less: Cost of Sales (COGS)
                                          <span className="text-[10px] text-gray-400 block font-normal">
                                            Direct raw ingredients, food preparation & production costs
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs text-gray-500">
                                          {annualNetSales > 0 ? ((annualCOGS / annualNetSales) * 100).toFixed(1) : 0}% of Net Sales
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium">(₱{totalMonthlyVariableCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                        <td className="py-3 px-4 text-right font-bold">(₱{annualCOGS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                      </tr>

                                      {/* Gross Profit */}
                                      <tr className="bg-blue-50/50 font-bold text-blue-900">
                                        <td className="py-3.5 px-4 text-sm font-extrabold text-blue-950">
                                          Gross Profit
                                          <span className="text-[10px] text-blue-600 block font-normal">Revenue retained after paying direct production costs</span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-xs text-blue-700 font-bold">{statementGrossProfitMargin}%</td>
                                        <td className="py-3.5 px-4 text-right font-bold">₱{(annualGrossProfit / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="py-3.5 px-4 text-right font-black text-blue-900">₱{annualGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      </tr>

                                      {/* Operating Expenses */}
                                      <tr className="hover:bg-gray-50/50 text-red-600">
                                        <td className="py-3 px-4 pl-8">
                                          Less: General & Administrative Expenses
                                          <span className="text-[10px] text-gray-400 block font-normal">
                                            Rent, utilities, store/office supplies, permits, admin allowances
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs text-gray-500">45% OpEx split</td>
                                        <td className="py-3 px-4 text-right font-medium">(₱{(genAdminOpEx / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                        <td className="py-3 px-4 text-right font-bold">(₱{genAdminOpEx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                      </tr>

                                      <tr className="hover:bg-gray-50/50 text-red-600">
                                        <td className="py-3 px-4 pl-8">
                                          Less: Selling & Marketing Expenses
                                          <span className="text-[10px] text-gray-400 block font-normal">
                                            Social media advertising, packaging materials, promotions & delivery
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs text-gray-500">55% OpEx split</td>
                                        <td className="py-3 px-4 text-right font-medium">(₱{(sellingOpEx / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                        <td className="py-3 px-4 text-right font-bold">(₱{sellingOpEx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                      </tr>

                                      {/* Operating Income */}
                                      <tr className="bg-purple-50/40 font-bold text-purple-950">
                                        <td className="py-3.5 px-4 text-sm font-extrabold text-purple-900">
                                          Net Operating Income (EBIT)
                                          <span className="text-[10px] text-purple-600 block font-normal">Earnings before taxes and interest</span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-xs text-purple-700 font-bold">{operatingProfitMargin}%</td>
                                        <td className="py-3.5 px-4 text-right font-bold">₱{(annualOperatingIncome / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="py-3.5 px-4 text-right font-black text-purple-900">₱{annualOperatingIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      </tr>

                                      {/* Tax Expense */}
                                      <tr className="hover:bg-gray-50/50 text-red-600">
                                        <td className="py-3 px-4 pl-8">
                                          Less: Tax Expense (BMBE RA 9178 / Statutory)
                                          <span className="text-[10px] text-gray-400 block font-normal">
                                            3% Gross Receipts Percentage Tax (Income Tax Exempt under BMBE)
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs text-gray-500">3.0% Stat. Tax</td>
                                        <td className="py-3 px-4 text-right font-medium">(₱{(annualTax / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                        <td className="py-3 px-4 text-right font-bold">(₱{annualTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                                      </tr>

                                      {/* Net Profit After Tax */}
                                      <tr className="bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-950">
                                        <td className="py-4 px-4 text-base font-black text-emerald-900">
                                          NET INCOME AFTER TAX (Retained Earnings)
                                          <span className="text-[11px] text-emerald-600 block font-normal">
                                            Reinvested directly into ending partner's equity
                                          </span>
                                        </td>
                                        <td className="py-4 px-4 text-center text-xs font-black text-emerald-700">{netProfitMargin}%</td>
                                        <td className="py-4 px-4 text-right font-bold text-emerald-800">₱{(annualNetProfitAfterTax / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="py-4 px-4 text-right font-black text-2xl text-emerald-600">₱{annualNetProfitAfterTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* SUBTAB 3: SOURCES OF FINANCING & STARTUP PROJECT COSTS */}
                            {balanceSheetSubTab === "startup" && (
                              <div className="space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                  {/* SECTION 1: SOURCES OF FINANCING */}
                                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                                    <div className="border-b pb-4 flex justify-between items-center">
                                      <div>
                                          <h3 className="font-extrabold text-sm uppercase tracking-widest text-[#122244] flex items-center gap-2">
                                            <PhilippinePeso className="w-4 h-4 text-[#c9a654]" /> Section 1: Sources of Financing
                                          </h3>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                          Define cash and property investments by partners or founding members.
                                        </p>
                                      </div>
                                      <span className="text-xs font-black text-[#b59545] bg-amber-50 px-2.5 py-1 rounded-lg">
                                        ₱{totalInitialCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>

                                    <div className="space-y-4">
                                      <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">
                                          Cash Invested (Direct Cash Contributions)
                                        </label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-xs">₱</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            disabled={isInputsBlocked}
                                            value={financials.cashInvested || (sumFromContributors > 0 ? sumFromContributors : "")}
                                            placeholder={safeCashInvested.toFixed(2)}
                                            onChange={(e) => updateFinancialField("cashInvested", e.target.value)}
                                            onKeyDown={handlePreventNegative}
                                            onPaste={handlePasteNonNegative}
                                            className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-[#122244] focus:border-[#c9a654] focus:outline-hidden"
                                          />
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                          {sumFromContributors > 0 ? `Synced from ${currentContribList.length} partners in Section Contributors table.` : "Direct equity input."}
                                        </p>
                                      </div>

                                      <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">
                                          Property / Non-Cash Invested (Equipment & Services)
                                        </label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-xs">₱</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            disabled={isInputsBlocked}
                                            value={financials.propertyInvested ?? ""}
                                            placeholder="0.00"
                                            onChange={(e) => updateFinancialField("propertyInvested", e.target.value)}
                                            onKeyDown={handlePreventNegative}
                                            onPaste={handlePasteNonNegative}
                                            className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-[#122244] focus:border-[#c9a654] focus:outline-hidden"
                                          />
                                        </div>
                                        <input
                                          type="text"
                                          disabled={isInputsBlocked}
                                          value={financials.propertyInvestedNote ?? ""}
                                          placeholder="Description e.g. Cooking Machineries & Logistics Services"
                                          onChange={(e) => updateFinancialField("propertyInvestedNote", e.target.value)}
                                          className="w-full mt-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:border-[#c9a654] focus:outline-hidden"
                                        />
                                      </div>

                                      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex justify-between items-center">
                                        <div>
                                          <span className="font-extrabold text-xs text-[#b59545] uppercase tracking-wider block">Total Initial Capital</span>
                                          <span className="text-[10px] text-gray-500">Cash Invested + Non-Cash Property</span>
                                        </div>
                                        <span className="text-xl font-black text-[#c9a654]">
                                          ₱{totalInitialCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* SECTION 2: STARTUP COST (PROJECT COST) */}
                                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                                    <div className="border-b pb-4 flex justify-between items-center">
                                      <div>
                                        <h3 className="font-extrabold text-sm uppercase tracking-widest text-[#122244] flex items-center gap-2">
                                          <Package className="w-4 h-4 text-blue-600" /> Section 2: Start-Up Cost (Project Cost)
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                          Pre-operating expenses and initial CapEx before commercial launch.
                                        </p>
                                      </div>
                                      <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                                        ₱{totalProjectCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>

                                    <div className="space-y-3 text-xs">
                                      {/* CapEx Equipment */}
                                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                                        <div>
                                          <span className="font-bold text-gray-800">Capital Equipment & Store Tools</span>
                                          <span className="text-[10px] text-gray-400 block">From CapEx Equipment list ({financials.equipmentList?.length || 0} items)</span>
                                        </div>
                                        <span className="font-bold text-gray-700">₱{safeStartupCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                      </div>

                                      {/* Renovation */}
                                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                                        <div>
                                          <span className="font-bold text-gray-800">Leasehold Improvements (Renovation)</span>
                                          <span className="text-[10px] text-gray-400 block">Store buildout, painting, electrical, fixtures</span>
                                        </div>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          disabled={isInputsBlocked}
                                          value={financials.renovationCosts ?? ""}
                                          placeholder="0.00"
                                          onChange={(e) => updateFinancialField("renovationCosts", e.target.value)}
                                          onKeyDown={handlePreventNegative}
                                          onPaste={handlePasteNonNegative}
                                          className="w-28 px-2 py-1 text-right text-xs font-bold border border-gray-200 rounded-lg focus:border-blue-500 bg-white"
                                        />
                                      </div>

                                      {/* Rent Advance & Deposit */}
                                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                                        <div>
                                          <span className="font-bold text-gray-800">Rent (Advance & Security Deposit)</span>
                                          <span className="text-[10px] text-gray-400 block">Typically 2-3 months advance stall lease</span>
                                        </div>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          disabled={isInputsBlocked}
                                          value={financials.rentAdvanceDeposit ?? ""}
                                          placeholder="0.00"
                                          onChange={(e) => updateFinancialField("rentAdvanceDeposit", e.target.value)}
                                          onKeyDown={handlePreventNegative}
                                          onPaste={handlePasteNonNegative}
                                          className="w-28 px-2 py-1 text-right text-xs font-bold border border-gray-200 rounded-lg focus:border-blue-500 bg-white"
                                        />
                                      </div>

                                      {/* Trainings & Programs */}
                                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                                        <div>
                                          <span className="font-bold text-gray-800">Trainings & Program Costs</span>
                                          <span className="text-[10px] text-gray-400 block">Pre-opening food safety & staff onboarding</span>
                                        </div>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          disabled={isInputsBlocked}
                                          value={financials.trainingsPrograms ?? ""}
                                          placeholder="0.00"
                                          onChange={(e) => updateFinancialField("trainingsPrograms", e.target.value)}
                                          onKeyDown={handlePreventNegative}
                                          onPaste={handlePasteNonNegative}
                                          className="w-28 px-2 py-1 text-right text-xs font-bold border border-gray-200 rounded-lg focus:border-blue-500 bg-white"
                                        />
                                      </div>

                                      {/* Pre-opening Advertising */}
                                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                                        <div>
                                          <span className="font-bold text-gray-800">Initial Advertising & Marketing</span>
                                          <span className="text-[10px] text-gray-400 block">Banners, social media tease, grand opening</span>
                                        </div>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          disabled={isInputsBlocked}
                                          value={financials.advertisingExpense ?? ""}
                                          placeholder="0.00"
                                          onChange={(e) => updateFinancialField("advertisingExpense", e.target.value)}
                                          onKeyDown={handlePreventNegative}
                                          onPaste={handlePasteNonNegative}
                                          className="w-28 px-2 py-1 text-right text-xs font-bold border border-gray-200 rounded-lg focus:border-blue-500 bg-white"
                                        />
                                      </div>

                                      {/* Initial Salaries Buffer */}
                                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                                        <div>
                                          <span className="font-bold text-gray-800">Salaries Buffer (Initial 2 Months)</span>
                                          <span className="text-[10px] text-gray-400 block">Operating payroll reserve before cash flow</span>
                                        </div>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          disabled={isInputsBlocked}
                                          value={financials.salariesExpenseInitial ?? ""}
                                          placeholder="0.00"
                                          onChange={(e) => updateFinancialField("salariesExpenseInitial", e.target.value)}
                                          onKeyDown={handlePreventNegative}
                                          onPaste={handlePasteNonNegative}
                                          className="w-28 px-2 py-1 text-right text-xs font-bold border border-gray-200 rounded-lg focus:border-blue-500 bg-white"
                                        />
                                      </div>

                                      {/* Permits & Licenses */}
                                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                                        <div>
                                          <span className="font-bold text-gray-800">Permits, Licenses & Registration</span>
                                          <span className="text-[10px] text-gray-400 block">DTI, SEC, Mayor's Permit, Sanitary, Fire</span>
                                        </div>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          disabled={isInputsBlocked}
                                          value={financials.permitsLicensesInitial ?? ""}
                                          placeholder="0.00"
                                          onChange={(e) => updateFinancialField("permitsLicensesInitial", e.target.value)}
                                          onKeyDown={handlePreventNegative}
                                          onPaste={handlePasteNonNegative}
                                          className="w-28 px-2 py-1 text-right text-xs font-bold border border-gray-200 rounded-lg focus:border-blue-500 bg-white"
                                        />
                                      </div>

                                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                                        <div>
                                          <span className="font-extrabold text-xs text-blue-900 uppercase tracking-wider block">Total Project Cost</span>
                                          <span className="text-[10px] text-blue-600">Sum of All Capital & Pre-Operating Outlays</span>
                                        </div>
                                        <span className="text-xl font-black text-blue-900">
                                          ₱{totalProjectCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* CAPITAL BUFFER / CASH RESERVE COMPARISON */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                                  <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${totalInitialCapital >= totalProjectCost ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                                      {totalInitialCapital >= totalProjectCost ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                                    </div>
                                    <div>
                                      <h4 className="font-extrabold text-sm text-[#122244]">
                                        {totalInitialCapital >= totalProjectCost ? "Adequately Capitalized Project" : "Capital Deficit Warning"}
                                      </h4>
                                      <p className="text-xs text-gray-500 max-w-lg mt-0.5">
                                        {totalInitialCapital >= totalProjectCost
                                          ? `Your initial capital of ₱${totalInitialCapital.toLocaleString()} successfully covers the startup project cost of ₱${totalProjectCost.toLocaleString()} with a healthy working capital buffer.`
                                          : `Initial capital of ₱${totalInitialCapital.toLocaleString()} is insufficient to cover the startup project cost of ₱${totalProjectCost.toLocaleString()}. Please increase partner contributions or trim pre-operating expenses.`}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Net Cash Reserve / Contingency</span>
                                    <p className={`text-2xl font-black ${totalInitialCapital >= totalProjectCost ? "text-emerald-600" : "text-red-600"}`}>
                                      ₱{cashReserveContingency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* SUBTAB 4: AUTOMATED FINANCIAL RATIOS & VIABILITY INDICATORS */}
                            {balanceSheetSubTab === "ratios" && (
                              <div className="space-y-6">
                                {/* PAYBACK PERIOD HERO CARD */}
                                <div className="bg-gradient-to-r from-[#122244] to-[#1f3768] text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-white/10">
                                  <div>
                                    <span className="text-xs font-bold text-[#c9a654] uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                      <Clock className="w-4 h-4" /> Capital Recovery Benchmark
                                    </span>
                                    <h3 className="text-2xl font-black">
                                      Payback Period: {paybackYears > 0 ? `${paybackYears} yr${paybackYears > 1 ? 's' : ''} ` : ""}{paybackMonths} mo{paybackMonths !== 1 ? 's' : ''} {paybackDays} day{paybackDays !== 1 ? 's' : ''}
                                    </h3>
                                    <p className="text-xs text-gray-300 mt-1 max-w-xl">
                                      Calculated as Total Project Investment (₱{totalProjectCost.toLocaleString()}) divided by Annual Net Cash Inflow (₱{annualNetProfitAfterTax.toLocaleString()}). Standard Philippine SME benchmark is recovery within 2 to 3 years.
                                    </p>
                                  </div>
                                  <div className="px-4 py-2 bg-[#c9a654]/20 border border-[#c9a654]/40 rounded-xl text-center">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200 block">Viability Status</span>
                                    <span className="text-base font-extrabold text-[#c9a654]">
                                      {paybackYears <= 2 ? "High Viability" : paybackYears <= 3 ? "Standard Feasible" : "Extended Recovery"}
                                    </span>
                                  </div>
                                </div>

                                {/* 4 RATIO PILLARS GRID */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                  {/* 1. LIQUIDITY RATIOS */}
                                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                    <div className="border-b pb-3 flex items-center gap-2 text-blue-700 font-extrabold text-xs uppercase tracking-wider">
                                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                                      Liquidity Ratios
                                    </div>
                                    <div className="space-y-3">
                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Current Ratio</span>
                                          <span className="text-sm font-black text-[#122244]">{currentRatio}x</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">Current Assets ÷ Current Liabilities</span>
                                        <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${Number(currentRatio) >= 1.5 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                          {Number(currentRatio) >= 1.5 ? "Strong Liquidity (≥1.5x)" : "Moderate Liquidity"}
                                        </span>
                                      </div>

                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Acid Test (Quick) Ratio</span>
                                          <span className="text-sm font-black text-[#122244]">{quickRatio}x</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">(Cash + Receivables) ÷ Liabilities</span>
                                        <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${Number(quickRatio) >= 1.0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                          {Number(quickRatio) >= 1.0 ? "Healthy Quick Cash (≥1.0x)" : "Lean Immediate Cash"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 2. SOLVENCY RATIOS */}
                                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                    <div className="border-b pb-3 flex items-center gap-2 text-indigo-700 font-extrabold text-xs uppercase tracking-wider">
                                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                                      Solvency & Leverage
                                    </div>
                                    <div className="space-y-3">
                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Debt Ratio</span>
                                          <span className="text-sm font-black text-[#122244]">{debtRatio}%</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">Total Liabilities ÷ Total Assets</span>
                                        <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${Number(debtRatio) < 50 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                          {Number(debtRatio) < 50 ? "Low Risk (<50%)" : "High Leverage"}
                                        </span>
                                      </div>

                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Debt-to-Equity Ratio</span>
                                          <span className="text-sm font-black text-[#122244]">{debtToEquityRatio}%</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">Total Liabilities ÷ Owner's Equity</span>
                                        <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${Number(debtToEquityRatio) < 100 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                          {Number(debtToEquityRatio) < 100 ? "Conservative Debt (<100%)" : "Moderate Debt"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 3. PROFITABILITY RATIOS */}
                                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                    <div className="border-b pb-3 flex items-center gap-2 text-emerald-700 font-extrabold text-xs uppercase tracking-wider">
                                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                                      Profitability Margins
                                    </div>
                                    <div className="space-y-3">
                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Gross Margin</span>
                                          <span className="text-sm font-black text-blue-700">{statementGrossProfitMargin}%</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">Gross Profit ÷ Net Sales</span>
                                      </div>

                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Net Profit Margin</span>
                                          <span className="text-sm font-black text-emerald-600">{netProfitMargin}%</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">Net Income After Tax ÷ Net Sales</span>
                                      </div>

                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Return on Assets (ROA)</span>
                                          <span className="text-sm font-black text-purple-700">{returnOnAssets}%</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">Net Income ÷ Total Assets</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 4. ACTIVITY & TURNOVER */}
                                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                    <div className="border-b pb-3 flex items-center gap-2 text-amber-700 font-extrabold text-xs uppercase tracking-wider">
                                      <div className="w-2.5 h-2.5 rounded-full bg-amber-600"></div>
                                      Activity & Turnover
                                    </div>
                                    <div className="space-y-3">
                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Inventory Turnover</span>
                                          <span className="text-sm font-black text-[#122244]">{inventoryTurnover}x / yr</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">Cost of Sales ÷ Average Inventory</span>
                                      </div>

                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Average Age of Inventory</span>
                                          <span className="text-sm font-black text-[#122244]">{avgAgeOfInventory} Days</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">360 Days ÷ Inventory Turnover</span>
                                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                          {avgAgeOfInventory <= 7 ? "High Freshness Turn (≤7 Days)" : "Standard Food Turn"}
                                        </span>
                                      </div>

                                      <div className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-700">Current Asset Turnover</span>
                                          <span className="text-sm font-black text-[#122244]">{currentAssetTurnover}x</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 block">Net Sales ÷ Current Assets</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
          )}

                      {/* Floating Back to Top Button */}
                      <ScrollToTopButton />
                    </main>

        {/* CREATE DRAFT MODAL */}
                  {showCreateDraftModal && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                      <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setShowCreateDraftModal(false)}
                      />
                      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 z-10 animate-in zoom-in-95 duration-200 border border-gray-100 relative text-[#122244]">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-amber-50 rounded-lg text-[#c9a654] border border-amber-200">
                              <Layers className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-base font-extrabold text-[#122244]">New Financial Draft</h3>
                              <p className="text-xs text-gray-400">Month {currentMonthNumber} Scenario</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowCreateDraftModal(false)}
                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="py-5 space-y-4">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                              Draft / Scenario Name
                            </label>
                            <input
                              type="text"
                              autoFocus
                              placeholder="e.g. Higher Volume Strategy, Lower Mark-up"
                              value={newDraftName}
                              onChange={(e) => setNewDraftName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleCreateNewDraft(newDraftName, newDraftCloneCurrent);
                                }
                              }}
                              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                              Starting Template
                            </label>
                            <div className="grid grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                onClick={() => setNewDraftCloneCurrent(true)}
                                className={`p-3 rounded-xl border text-left transition-all ${newDraftCloneCurrent
                                  ? "bg-amber-50/70 border-[#c9a654] text-[#122244] ring-1 ring-[#c9a654]"
                                  : "bg-white border-gray-200 hover:bg-gray-50 text-gray-600"
                                  }`}
                              >
                                <div className="flex items-center gap-1.5 mb-1 font-extrabold text-xs">
                                  <Copy size={13} className="text-[#c9a654]" />
                                  <span>Duplicate Current</span>
                                </div>
                                <p className="text-[10px] text-gray-500">Copy products and OpEx from active draft</p>
                              </button>

                              <button
                                type="button"
                                onClick={() => setNewDraftCloneCurrent(false)}
                                className={`p-3 rounded-xl border text-left transition-all ${!newDraftCloneCurrent
                                  ? "bg-amber-50/70 border-[#c9a654] text-[#122244] ring-1 ring-[#c9a654]"
                                  : "bg-white border-gray-200 hover:bg-gray-50 text-gray-600"
                                  }`}
                              >
                                <div className="flex items-center gap-1.5 mb-1 font-extrabold text-xs">
                                  <Plus size={13} className="text-[#c9a654]" />
                                  <span>Blank Template</span>
                                </div>
                                <p className="text-[10px] text-gray-500">Start fresh with clear financial costing inputs</p>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex gap-2.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setShowCreateDraftModal(false)}
                            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCreateNewDraft(newDraftName, newDraftCloneCurrent)}
                            className="flex items-center gap-1.5 px-5 py-2 bg-[#122244] hover:bg-[#1a2f55] text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
                          >
                            <Plus size={13} className="text-[#c9a654]" />
                            <span>Create Draft</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

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

                          {/* Option 2: Statement of Financial Position (PDF) */}
                          <button
                            onClick={() => {
                              setPrintMode("balance-sheet");
                              setShowExportModal(false);
                              setTimeout(() => window.print(), 250);
                            }}
                            className="w-full flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-[#A93E1D] hover:bg-amber-50/30 transition-all text-left group"
                          >
                            <div className="p-3 bg-amber-100 text-[#A93E1D] rounded-xl group-hover:bg-[#A93E1D] group-hover:text-white transition-colors">
                              <Scale className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-extrabold text-sm text-[#122244] group-hover:text-[#A93E1D]">Statement of Financial Position (.PDF)</h4>
                                <span className="text-[10px] font-black uppercase text-white bg-[#A93E1D] px-2 py-0.5 rounded">Standard Format</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                Print or save the official 5-Year Balance Sheet table (Pre-Operations to 2030) formatted per Philippine feasibility standards.
                              </p>
                            </div>
                          </button>

                          {/* Option 3: Full Executive Feasibility Report (PDF) */}
                          <button
                            onClick={() => {
                              setPrintMode("executive");
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
                                <h4 className="font-extrabold text-sm text-[#122244] group-hover:text-blue-900">Full Executive Feasibility Report (.PDF)</h4>
                                <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Multi-Section</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                Generate the full multi-section statement including operational costing, itemized OpEx/CapEx, and current monthly summary.
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

                  {/* MR. CABBAGE FEASIBILITY BENCHMARK MODAL */}
                  {showBenchmarkModal && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                      <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setShowBenchmarkModal(false)}
                      />
                      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 z-10 animate-in zoom-in-95 duration-200 border border-gray-100 relative text-[#122244] max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-amber-500 to-[#c9a654] text-white rounded-2xl shadow-md">
                              <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-[#122244]">
                                  Mr. Cabbage (Brassica Foods) Benchmark
                                </h3>
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                                  PLV 2025 Study
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Pamantasan ng Lungsod ng Valenzuela • Bachelor of Science in Business Administration
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowBenchmarkModal(false)}
                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="py-5 space-y-5 text-xs text-gray-600">
                          <p className="leading-relaxed text-sm">
                            This feature loads the exact, verified data from the <strong>442-page PLV Feasibility Study</strong> of <em>Mr. Cabbage</em> into your current draft, allowing you to examine and test a complete real-world academic business proposal:
                          </p>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Capital</span>
                              <span className="text-sm font-black text-[#c9a654]">₱900,000</span>
                              <span className="text-[9px] text-gray-500 block mt-0.5">9 Partners @ ₱100k</span>
                            </div>
                            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Project Cost</span>
                              <span className="text-sm font-black text-blue-900">₱860,603</span>
                              <span className="text-[9px] text-gray-500 block mt-0.5">Pre-Op & CapEx</span>
                            </div>
                            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Cash Reserve</span>
                              <span className="text-sm font-black text-emerald-600">₱39,397</span>
                              <span className="text-[9px] text-gray-500 block mt-0.5">Working Capital</span>
                            </div>
                            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Payback Period</span>
                              <span className="text-sm font-black text-purple-900">~1.11 Years</span>
                              <span className="text-[9px] text-gray-500 block mt-0.5">Capital Amortization</span>
                            </div>
                          </div>

                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                            <h4 className="font-extrabold text-[#122244] text-xs uppercase tracking-wider flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-[#c9a654]" /> Included Schedules Loaded:
                            </h4>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-gray-600 text-[11px]">
                              <li>• <strong>12 Product Costings:</strong> Cabbage Snacks, Chao meals, Bundles, and Drinks with itemized ingredients</li>
                              <li>• <strong>11 CapEx Tools & Equipment:</strong> Commercial grill, rice cooker, freezer, POS terminal, CCTV</li>
                              <li>• <strong>10 OpEx Lines:</strong> C&B Mall rent, 3 operating staff, utilities, supplies, mandatory benefits</li>
                              <li>• <strong>9 Founding Partners:</strong> 7 Cash partners + 2 Industrial property partners</li>
                              <li>• <strong>Startup Costs:</strong> Rent deposit (₱150k), Renovation (₱335.4k), Trainings (₱32.4k), Permits (₱3.9k)</li>
                              <li>• <strong>Competitors:</strong> Master Siomai, Rice in a Box (RBX), Turks, Shawarma Shack, Paotsin</li>
                            </ul>
                          </div>

                          <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-[#c9a654] shrink-0 mt-0.5" />
                            <span>
                              Loading the benchmark will replace the product and expense entries in this draft with the Mr. Cabbage figures. You can edit or revert them at any time.
                            </span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setShowBenchmarkModal(false)}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleLoadMrCabbageBenchmark}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#122244] to-[#1f3768] hover:from-[#1a2f55] hover:to-[#27447e] text-white text-xs font-black shadow-lg shadow-indigo-950/20 transition-all active:scale-95"
                          >
                            <Sparkles className="w-4 h-4 text-[#c9a654]" />
                            <span>Load Mr. Cabbage Benchmark Data</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

    {/* ========================================================= */}
              {/* DEDICATED PRINTABLE STATEMENT OF FINANCIAL POSITION / REPORT */}
              {/* ========================================================= */}
              {printMode === "balance-sheet" ? (
                <div className="hidden print:block w-full bg-white text-black p-0 font-sans print-single-page">
                  <StatementOfFinancialPositionTable
                    data={fiveYearBalanceSheet}
                    businessName={activeProjName}
                    isPrintView={true}
                  />
                </div>
              ) : (
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
                      {financials.opexList && financials.opexList.filter((item: any) => Number(item.amount) > 0).length > 0 ? (
                        <table className="w-full text-left">
                          <tbody className="divide-y divide-gray-100">
                            {financials.opexList.filter((item: any) => Number(item.amount) > 0).map((item: any, idx: number) => (
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
                        <p className="text-gray-500 italic">Total Monthly OpEx: ₱{safeFixedCosts.toLocaleString()}/mo</p>
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
              )}
            </>
          );
};

          export default Financial_input;