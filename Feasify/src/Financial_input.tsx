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
  Download,
  FileSpreadsheet,
  FileText,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

const Financial_input: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [taxTab, setTaxTab] = useState<"log" | "math">("math");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [showExportModal, setShowExportModal] = useState(false);
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

  // --- EXPORT TO PDF FUNCTION ---
  const exportToPDF = () => {
    try {
      const selectedProject = projects.find((p) => p.id === selectedProjectId);
      const projectName = selectedProject?.name || "Financial_Projections";
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header Banner
      doc.setFillColor(18, 34, 68);
      doc.rect(0, 0, pageWidth, 75, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("FEASIFY FINANCIAL PROJECTIONS", 30, 42);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Official Financial Feasibility Audit Report", 30, 60);

      doc.setFontSize(9);
      doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, pageWidth - 140, 42);
      doc.text(`Project: ${projectName}`, pageWidth - 200, 60);

      let y = 95;

      // Section 1: Executive Summary KPIs
      doc.setFillColor(245, 247, 250);
      doc.rect(30, y, pageWidth - 60, 115, "F");
      doc.setDrawColor(220, 225, 230);
      doc.rect(30, y, pageWidth - 60, 115, "S");

      doc.setTextColor(18, 34, 68);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("1. EXECUTIVE FINANCIAL SUMMARY", 42, y + 20);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      const col1X = 42;
      const col2X = 220;
      const col3X = 400;

      // Row 1
      doc.text(`Declared Capital: PHP ${safeStartupCapital.toLocaleString()}`, col1X, y + 40);
      doc.text(`Monthly Revenue: PHP ${monthlyRevenue.toLocaleString()}`, col2X, y + 40);
      doc.text(`Monthly Expenses: PHP ${(totalMonthlyVariableCosts + safeFixedCosts).toLocaleString()}`, col3X, y + 40);

      // Row 2
      doc.text(`Selling Price / Unit: PHP ${safeSellingPrice.toLocaleString()}`, col1X, y + 58);
      doc.text(`Monthly Volume: ${safeMonthlySales.toLocaleString()} units`, col2X, y + 58);
      doc.text(`Net Profit / Month: PHP ${netMonthlyProfit.toLocaleString()}`, col3X, y + 58);

      // Row 3
      doc.text(`Gross Profit Margin: ${grossProfitMargin.toFixed(1)}%`, col1X, y + 76);
      doc.text(`Payback Period: ${paybackVal} months`, col2X, y + 76);
      doc.text(`Estimated Annual ROI: ${estimatedAnnualROI}%`, col3X, y + 76);

      // Row 4
      doc.text(`Break-even Volume: ${breakEvenUnits} units/mo`, col1X, y + 94);
      doc.text(`Operating Days / Year: ${safeOperatingDays} days`, col2X, y + 94);

      y += 135;

      // Section 2: Equipment List (CapEx)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(18, 34, 68);
      doc.text("2. EQUIPMENT & CAPITAL EXPENDITURES (CapEx)", 30, y);
      y += 12;

      // Table Headers
      doc.setFillColor(201, 166, 84);
      doc.rect(30, y, pageWidth - 60, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text("Item Name", 40, y + 14);
      doc.text("Qty", 260, y + 14);
      doc.text("Unit Price (PHP)", 340, y + 14);
      doc.text("Total Cost (PHP)", 460, y + 14);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);

      if (financials.equipmentList && financials.equipmentList.length > 0) {
        financials.equipmentList.forEach((eq, idx) => {
          if (idx % 2 === 1) {
            doc.setFillColor(248, 249, 250);
            doc.rect(30, y, pageWidth - 60, 18, "F");
          }
          doc.text(String(eq.name || "Equipment Item"), 40, y + 13);
          doc.text(String(eq.quantity || 1), 260, y + 13);
          doc.text(Number(eq.unitPrice || 0).toLocaleString(), 340, y + 13);
          doc.text(Number(eq.total || 0).toLocaleString(), 460, y + 13);
          y += 18;
        });
      } else {
        doc.text("No itemized equipment declared.", 40, y + 13);
        y += 18;
      }

      // CapEx Total Row
      doc.setFont("helvetica", "bold");
      doc.setFillColor(235, 238, 242);
      doc.rect(30, y, pageWidth - 60, 20, "F");
      doc.setTextColor(18, 34, 68);
      doc.text("Total CapEx Equipment Budget:", 40, y + 14);
      doc.text(`PHP ${calculatedStartupCapital.toLocaleString()}`, 460, y + 14);
      y += 35;

      // Section 3: Operating Expenses (OpEx)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(18, 34, 68);
      doc.text("3. MONTHLY OPERATING EXPENSES (OpEx)", 30, y);
      y += 12;

      doc.setFillColor(66, 133, 244);
      doc.rect(30, y, pageWidth - 60, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text("Expense Description", 40, y + 14);
      doc.text("Monthly Cost (PHP)", 300, y + 14);
      doc.text("Annualized (PHP)", 440, y + 14);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);

      if (financials.opexList && financials.opexList.length > 0) {
        financials.opexList.forEach((op, idx) => {
          if (idx % 2 === 1) {
            doc.setFillColor(248, 249, 250);
            doc.rect(30, y, pageWidth - 60, 18, "F");
          }
          doc.text(String(op.name || "OpEx Item"), 40, y + 13);
          doc.text(Number(op.amount || 0).toLocaleString(), 300, y + 13);
          doc.text((Number(op.amount || 0) * 12).toLocaleString(), 440, y + 13);
          y += 18;
        });
      } else {
        doc.text("General Fixed Costs", 40, y + 13);
        doc.text(safeFixedCosts.toLocaleString(), 300, y + 13);
        doc.text((safeFixedCosts * 12).toLocaleString(), 440, y + 13);
        y += 18;
      }

      // OpEx Total Row
      doc.setFont("helvetica", "bold");
      doc.setFillColor(235, 238, 242);
      doc.rect(30, y, pageWidth - 60, 20, "F");
      doc.setTextColor(18, 34, 68);
      doc.text("Total Monthly OpEx:", 40, y + 14);
      doc.text(`PHP ${calculatedOpex.toLocaleString()}`, 300, y + 14);
      doc.text(`PHP ${(calculatedOpex * 12).toLocaleString()}`, 440, y + 14);
      y += 35;

      // Section 4: Annual Statement & Tax Audit
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(18, 34, 68);
      doc.text("4. ANNUAL INCOME & PHILIPPINE BMBE TAX AUDIT", 30, y);
      y += 12;

      doc.setFillColor(245, 247, 250);
      doc.rect(30, y, pageWidth - 60, 75, "F");
      doc.setDrawColor(220, 225, 230);
      doc.rect(30, y, pageWidth - 60, 75, "S");

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);

      doc.text(`Estimated Annual Revenue: PHP ${annualRevenue.toLocaleString()}`, 42, y + 20);
      doc.text(`Estimated Annual Operating Expenses: PHP ${annualExpenses.toLocaleString()}`, 300, y + 20);

      doc.text(`Annual Pre-Tax Net Income: PHP ${annualNetProfitPreTax.toLocaleString()}`, 42, y + 40);
      doc.text(`Income Tax Status: EXEMPT (RA 9178 BMBE Exemption)`, 300, y + 40);

      doc.text(`Philippine 3% Percentage Tax: PHP ${taxResult.amount.toLocaleString()}`, 42, y + 60);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 139, 34);
      doc.text(`Annual Net Profit (After Tax): PHP ${annualNetProfitAfterTax.toLocaleString()}`, 300, y + 60);

      doc.save(`${projectName.replace(/[^a-z0-9_-]/gi, "_")}_Financial_Projections.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error("PDF Export Error:", err);
    }
  };

  // --- EXPORT TO EXCEL FUNCTION ---
  const exportToExcel = () => {
    try {
      const selectedProject = projects.find((p) => p.id === selectedProjectId);
      const projectName = selectedProject?.name || "Financial_Projections";

      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary KPIs
      const summaryData = [
        ["FEASIFY FINANCIAL PROJECTIONS REPORT"],
        ["Project Name", projectName],
        ["Generated Date", new Date().toLocaleDateString("en-GB")],
        [""],
        ["METRIC", "VALUE", "UNIT / NOTES"],
        ["Declared Startup Capital", safeStartupCapital, "PHP"],
        ["Selling Price per Unit", safeSellingPrice, "PHP"],
        ["Monthly Sales Volume", safeMonthlySales, "Units"],
        ["Variable Cost (COGS) / Unit", safeVariableCost, "PHP"],
        ["Monthly Revenue", monthlyRevenue, "PHP"],
        ["Total Monthly Variable Costs", totalMonthlyVariableCosts, "PHP"],
        ["Total Monthly Operating Costs (OpEx)", safeFixedCosts, "PHP"],
        ["Monthly Financing Interest", monthlyInterest, "PHP"],
        ["Net Monthly Profit", netMonthlyProfit, "PHP"],
        ["Gross Profit Margin", `${grossProfitMargin.toFixed(1)}%`, "Percentage"],
        ["Payback Period", paybackVal, "Months"],
        ["Estimated Annual ROI", `${estimatedAnnualROI}%`, "Percentage"],
        ["Break-even Volume", breakEvenUnits, "Units/Month"],
        ["Operating Days / Year", safeOperatingDays, "Days"]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

      // Sheet 2: Equipment CapEx
      const capexData = [
        ["EQUIPMENT & CAPITAL EXPENDITURES (CapEx)"],
        [""],
        ["Item Name", "Quantity", "Unit Price (PHP)", "Total Cost (PHP)"]
      ];
      if (financials.equipmentList && financials.equipmentList.length > 0) {
        financials.equipmentList.forEach((eq) => {
          capexData.push([eq.name, eq.quantity, eq.unitPrice, eq.total]);
        });
      } else {
        capexData.push(["General Capital Equipment", 1, safeStartupCapital, safeStartupCapital]);
      }
      capexData.push(["TOTAL CAPEX", "", "", calculatedStartupCapital]);
      const wsCapEx = XLSX.utils.aoa_to_sheet(capexData);

      // Sheet 3: Operating Expenses OpEx
      const opexData = [
        ["MONTHLY OPERATING EXPENSES (OpEx)"],
        [""],
        ["Expense Description", "Monthly Amount (PHP)", "Annualized Amount (PHP)"]
      ];
      if (financials.opexList && financials.opexList.length > 0) {
        financials.opexList.forEach((op) => {
          opexData.push([op.name, op.amount, op.amount * 12]);
        });
      } else {
        opexData.push(["General Fixed Operating Costs", safeFixedCosts, safeFixedCosts * 12]);
      }
      opexData.push(["TOTAL OPEX", calculatedOpex, calculatedOpex * 12]);
      const wsOpEx = XLSX.utils.aoa_to_sheet(opexData);

      // Sheet 4: Annual Statement & BMBE Tax
      const taxData = [
        ["ANNUAL STATEMENT & PHILIPPINE BMBE TAX AUDIT"],
        [""],
        ["Financial Line Item", "Amount (PHP)", "Notes"],
        ["Annual Gross Revenue", annualRevenue, "Based on operating days"],
        ["Annual Operating Costs", annualExpenses, "COGS + OpEx + Interest"],
        ["Annual Net Profit Pre-Tax", annualNetProfitPreTax, ""],
        ["Income Tax (RA 9178 BMBE Exemption)", 0, "BMBE Income Tax Exempt"],
        ["Philippine Percentage Tax (3%)", taxResult.amount, "3% BMBE Revenue Tax"],
        ["ANNUAL NET PROFIT AFTER TAX", annualNetProfitAfterTax, "Final Net Income"]
      ];
      const wsTax = XLSX.utils.aoa_to_sheet(taxData);

      // Append worksheets to workbook
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
      XLSX.utils.book_append_sheet(wb, wsCapEx, "Equipment CapEx");
      XLSX.utils.book_append_sheet(wb, wsOpEx, "Operating Expenses");
      XLSX.utils.book_append_sheet(wb, wsTax, "Annual & Tax Audit");

      // Save XLSX file
      XLSX.writeFile(wb, `${projectName.replace(/[^a-z0-9_-]/gi, "_")}_Financial_Projections.xlsx`);
      setShowExportModal(false);
    } catch (err) {
      console.error("Excel Export Error:", err);
    }
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
      console.error(error);
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
        className={`flex-1 w-full max-w-full transition-all duration-300 ease-in-out bg-gray-50/50 min-h-screen ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
      >
        <div className="bg-white border-b border-gray-100 p-4 flex items-center flex-wrap gap-2 text-sm text-gray-500">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors flex-shrink-0"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-1 sm:mx-2 text-gray-300">|</span>
          <span
            className="cursor-pointer hover:text-[#c9a654] truncate"
            onClick={() => navigate("/dashboard")}
          >
            FeasiFy
          </span>
          <span className="text-gray-400">›</span>
          <span className="font-semibold text-gray-900 truncate">Financial Input</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-[#122244] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 font-medium text-sm">Loading financial parameters...</p>
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
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-2 ml-2 bg-[#122244] hover:bg-[#1a2f55] text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95"
                  >
                    <Download size={16} /> Export
                  </button>
                </div>
              </div>

              {/* PROJECT SELECTOR */}
              <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-3">
                  Active Project Workspace
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsProjectMenuOpen(!isProjectMenuOpen);
                    }}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#122244] text-white flex items-center justify-center font-bold">
                        P#
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-[#122244] text-base">
                          {projects.find((p) => p.id === selectedProjectId)?.name ||
                            "Select Active Business"}
                        </h3>
                        <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded">
                          Active Business Workspace
                        </span>
                      </div>
                    </div>
                    {projects.length > 1 && (
                      <ChevronDown
                        className={`text-gray-400 transition-transform ${isProjectMenuOpen ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>

                  {isProjectMenuOpen && projects.length > 1 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden"
                    >
                      {projects.map((proj) => (
                        <div
                          key={proj.id}
                          onClick={() => {
                            handleProjectSelect(proj.id);
                            setIsProjectMenuOpen(false);
                          }}
                          className={`p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 ${selectedProjectId === proj.id ? "bg-amber-50/50" : ""}`}
                        >
                          <div>
                            <h4 className="font-bold text-[#122244] text-sm">
                              {proj.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              Capital: ₱
                              {Number(proj.proposalCapital).toLocaleString()}
                            </p>
                          </div>
                          {selectedProjectId === proj.id && (
                            <span className="text-xs font-bold text-[#c9a654]">
                              Active
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* TABS & DASHBOARD FORMS */}
              <div className="flex gap-4 border-b border-gray-200 mb-8">
                <button
                  onClick={() => setShowTaxBreakdown(false)}
                  className={`pb-4 px-2 font-bold text-sm transition-colors relative ${!showTaxBreakdown ? "text-[#122244] border-b-2 border-[#122244]" : "text-gray-400 hover:text-gray-600"}`}
                >
                  Financial Parameters & Unit Economics
                </button>
                <button
                  onClick={() => setShowTaxBreakdown(true)}
                  className={`pb-4 px-2 font-bold text-sm transition-colors relative flex items-center gap-2 ${showTaxBreakdown ? "text-[#122244] border-b-2 border-[#122244]" : "text-gray-400 hover:text-gray-600"}`}
                >
                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                  Philippine Tax Audit (BMBE RA 9178)
                </button>
              </div>

              {!showTaxBreakdown ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Financial Inputs */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Revenue & Unit Pricing */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 text-[#122244]">
                      <h3 className="font-bold text-lg text-[#122244] flex items-center gap-2">
                        <DollarSign className="text-emerald-500" />
                        Revenue & Unit Economics
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">
                            Selling Price / Unit (₱)
                          </label>
                          <input
                            type="number"
                            name="sellingPrice"
                            value={financials.sellingPrice}
                            onChange={handleInputChange}
                            placeholder="0.00"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#c9a654] outline-none font-bold text-gray-800"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">
                            Monthly Sales Volume (Units)
                          </label>
                          <input
                            type="number"
                            name="monthlySales"
                            value={financials.monthlySales}
                            onChange={handleInputChange}
                            placeholder="0"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#c9a654] outline-none font-bold text-gray-800"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">
                            Variable Cost / Unit (COGS) (₱)
                          </label>
                          <input
                            type="number"
                            name="variableCost"
                            value={financials.variableCost}
                            onChange={handleInputChange}
                            placeholder="0.00"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#c9a654] outline-none font-bold text-gray-800"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">
                            Annual Operating Days
                          </label>
                          <input
                            type="number"
                            name="operatingDays"
                            value={financials.operatingDays}
                            onChange={handleInputChange}
                            placeholder="300"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#c9a654] outline-none font-bold text-gray-800"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CapEx Equipment List */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 text-[#122244]">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-[#122244] flex items-center gap-2">
                          <Package className="text-blue-500" />
                          Equipment & Capital Expenditures (CapEx)
                        </h3>
                        <button
                          onClick={handleAddEquipment}
                          className="flex items-center gap-1 text-xs font-bold text-[#c9a654] hover:text-[#b59545] bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/50"
                        >
                          <Plus size={14} /> Add Item
                        </button>
                      </div>

                      <div className="space-y-3">
                        {financials.equipmentList && financials.equipmentList.length > 0 ? (
                          financials.equipmentList.map((eq) => (
                            <div
                              key={eq.id}
                              className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-100"
                            >
                              <div className="col-span-5">
                                <input
                                  type="text"
                                  placeholder="Item Name"
                                  value={eq.name}
                                  onChange={(e) =>
                                    handleEquipmentChange(eq.id, "name", e.target.value)
                                  }
                                  className="w-full bg-transparent border-0 font-medium text-sm text-gray-800 focus:outline-none"
                                />
                              </div>
                              <div className="col-span-2">
                                <input
                                  type="number"
                                  placeholder="Qty"
                                  value={eq.quantity || ""}
                                  onChange={(e) =>
                                    handleEquipmentChange(eq.id, "quantity", e.target.value)
                                  }
                                  className="w-full bg-white p-1.5 rounded border border-gray-200 text-xs font-bold text-center"
                                />
                              </div>
                              <div className="col-span-3">
                                <input
                                  type="number"
                                  placeholder="Price"
                                  value={eq.unitPrice || ""}
                                  onChange={(e) =>
                                    handleEquipmentChange(eq.id, "unitPrice", e.target.value)
                                  }
                                  className="w-full bg-white p-1.5 rounded border border-gray-200 text-xs font-bold"
                                />
                              </div>
                              <div className="col-span-1 text-xs font-black text-gray-600">
                                ₱{(eq.total || 0).toLocaleString()}
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button
                                  onClick={() => handleRemoveEquipment(eq.id)}
                                  className="text-red-400 hover:text-red-600 p-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl text-gray-400 text-xs italic">
                            No itemized equipment added yet.
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 px-2">
                          <span className="text-xs font-bold text-gray-500">
                            Total Itemized CapEx:
                          </span>
                          <span className="text-sm font-extrabold text-[#122244]">
                            ₱{calculatedStartupCapital.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Operating Expenses (OpEx) */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 text-[#122244]">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-[#122244] flex items-center gap-2">
                          <TrendingUp className="text-purple-500" />
                          Monthly Operating Expenses (OpEx)
                        </h3>
                        <button
                          onClick={handleAddOpex}
                          className="flex items-center gap-1 text-xs font-bold text-[#c9a654] hover:text-[#b59545] bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/50"
                        >
                          <Plus size={14} /> Add OpEx
                        </button>
                      </div>

                      <div className="space-y-3">
                        {financials.opexList && financials.opexList.length > 0 ? (
                          financials.opexList.map((op) => (
                            <div
                              key={op.id}
                              className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-100"
                            >
                              <div className="col-span-7">
                                <input
                                  type="text"
                                  placeholder="Expense description"
                                  value={op.name}
                                  onChange={(e) =>
                                    handleOpexChange(op.id, "name", e.target.value)
                                  }
                                  className="w-full bg-transparent border-0 font-medium text-sm text-gray-800 focus:outline-none"
                                />
                              </div>
                              <div className="col-span-4">
                                <input
                                  type="number"
                                  placeholder="Monthly ₱"
                                  value={op.amount || ""}
                                  onChange={(e) =>
                                    handleOpexChange(op.id, "amount", e.target.value)
                                  }
                                  className="w-full bg-white p-1.5 rounded border border-gray-200 text-xs font-bold"
                                />
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button
                                  onClick={() => handleRemoveOpex(op.id)}
                                  className="text-red-400 hover:text-red-600 p-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl text-gray-400 text-xs italic">
                            No itemized OpEx added yet.
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 px-2">
                          <span className="text-xs font-bold text-gray-500">
                            Total Monthly Fixed OpEx:
                          </span>
                          <span className="text-sm font-extrabold text-[#122244]">
                            ₱{calculatedOpex.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Live Summary Cards */}
                  <div className="space-y-6">
                    <div className="bg-[#122244] text-white p-6 rounded-2xl shadow-xl space-y-6">
                      <h3 className="font-bold text-lg border-b border-white/10 pb-3 flex items-center justify-between">
                        <span>Financial Summary</span>
                        <Target className="w-5 h-5 text-[#c9a654]" />
                      </h3>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                          <span className="text-xs text-gray-300">Monthly Revenue</span>
                          <span className="text-sm font-black text-emerald-400">
                            ₱{monthlyRevenue.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                          <span className="text-xs text-gray-300">Monthly Variable Costs</span>
                          <span className="text-sm font-black text-gray-200">
                            ₱{totalMonthlyVariableCosts.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                          <span className="text-xs text-gray-300">Monthly Fixed OpEx</span>
                          <span className="text-sm font-black text-gray-200">
                            ₱{safeFixedCosts.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                          <span className="text-xs text-gray-300">Net Monthly Profit</span>
                          <span className={`text-base font-black ${netMonthlyProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            ₱{netMonthlyProfit.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                          <span className="text-xs text-gray-300">Gross Margin</span>
                          <span className="text-sm font-bold text-[#c9a654]">
                            {grossProfitMargin.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                          <span className="text-xs text-gray-300">Break-even Volume</span>
                          <span className="text-sm font-bold text-white">
                            {breakEvenUnits} units/mo
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                          <span className="text-xs text-gray-300">Payback Period</span>
                          <span className="text-sm font-bold text-white">
                            {paybackVal} months
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-300">Estimated Annual ROI</span>
                          <span className="text-sm font-black text-emerald-400">
                            {estimatedAnnualROI}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Philippine Tax Audit Breakdown View */
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6 text-[#122244]">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-xl font-extrabold text-[#122244]">
                        Barangay Micro Business Enterprise (BMBE) Tax Status
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Pursuant to Republic Act No. 9178 (BMBE Act of 2002)
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                      Eligible (Assets ≤ ₱3M)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase">Annual Gross Revenue</p>
                      <p className="text-2xl font-black text-[#122244] mt-1">
                        ₱{annualRevenue.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase">Income Tax (RA 9178)</p>
                      <p className="text-2xl font-black text-emerald-600 mt-1">
                        EXEMPT (₱0.00)
                      </p>
                    </div>
                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-xs font-bold text-gray-400 uppercase">3% Percentage Tax</p>
                      <p className="text-2xl font-black text-amber-600 mt-1">
                        ₱{taxResult.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                    <h4 className="font-bold text-emerald-900 text-sm">Tax Computation Summary</h4>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Under Philippine tax law, registered BMBE enterprises are fully exempt from Income Tax arising from operations. However, they remain subject to local taxes and the standard 3% Percentage Tax on gross sales under the National Internal Revenue Code (NIRC).
                    </p>
                    <div className="flex justify-between items-center pt-2 border-t border-emerald-200 text-xs font-bold text-emerald-900">
                      <span>Annual Net Profit (After 3% Tax):</span>
                      <span className="text-base font-black">
                        ₱{annualNetProfitAfterTax.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}
      </main>

      {/* EXPORT FORMAT CHOICE MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative text-[#122244]">
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[#122244]">Export Financial Projections</h3>
                <p className="text-xs text-gray-500 font-medium">Select your preferred format for download</p>
              </div>
            </div>

            <div className="my-6 space-y-4">
              {/* PDF Option */}
              <div
                onClick={exportToPDF}
                className="p-5 border-2 border-gray-100 hover:border-red-500/40 hover:bg-red-50/20 rounded-xl cursor-pointer transition-all flex items-start gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-red-100/80 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-[#122244] text-base group-hover:text-red-600 transition-colors">
                      PDF File (.pdf)
                    </h4>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-red-100 text-red-700 rounded">
                      Formatted Document
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Download clean formatted PDF document with summary KPIs, CapEx equipment tables, OpEx breakdowns, and BMBE tax audit.
                  </p>
                </div>
              </div>

              {/* Excel Option */}
              <div
                onClick={exportToExcel}
                className="p-5 border-2 border-gray-100 hover:border-green-500/40 hover:bg-green-50/20 rounded-xl cursor-pointer transition-all flex items-start gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-green-100/80 text-green-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-[#122244] text-base group-hover:text-green-700 transition-colors">
                      Excel File (.xlsx)
                    </h4>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-green-100 text-green-700 rounded">
                      Multi-Sheet Workbook
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Download multi-tab Excel spreadsheet workbook with separate sheets for Summary, Equipment CapEx, OpEx, and Tax.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
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