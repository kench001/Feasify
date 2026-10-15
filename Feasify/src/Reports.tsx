import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import ScrollToTopButton from "./components/ScrollToTopButton";
import MobileBurgerButton from "./components/MobileBurgerButton";
import SidebarCloseButton from "./components/SidebarCloseButton";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
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
  Sidebar as SidebarIcon,
  Download,
  FileText,
  Printer,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Bell,
  ChevronUp,
  Store,
  Building2,
} from "lucide-react";

import domtoimage from "dom-to-image";
import { jsPDF } from "jspdf";
import { normalizeProposalProducts, computeProductMetrics } from "./utils/productCosting";
import { cleanUserFacingText, calculateLocalAudit, generateProFormaData, type MarketAnalysisData } from "./utils/feasibilityAudit";

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const loadUserGroup = async (uid: string, section: string) => {
    try {
      const groupQ = query(collection(db, "groups"), where("section", "==", section));
      const groupSnap = await getDocs(groupQ);

      let userGroupId = "";
      let activeProposalId = "";
      groupSnap.forEach((doc) => {
        const data = doc.data();
        if (data.leaderId === uid || (data.memberIds && data.memberIds.includes(uid))) {
          userGroupId = doc.id;
          activeProposalId = data.activeProposalId || "";
        }
      });

      if (userGroupId && activeProposalId) {
        const propQ = query(collection(db, "proposals"), where("groupId", "==", userGroupId));
        const propSnap = await getDocs(propQ);

        const approvedProjects = propSnap.docs
          .filter((doc) => doc.data().status === "Approved" || doc.data().status === "APPROVED")
          .map((doc) => {
            const pData = doc.data();
            return {
              id: doc.id,
              name: pData.businessName || pData.title || "Untitled Proposal",
              financialData: pData.financialData || null,
              aiAnalysis: pData.aiAnalysis || null,
              totalCapital: pData.totalCapital || null,
              proposalCapital: pData.totalCapital || null,
              products: pData.products || pData.financialData?.products || [],
              rawProposalData: pData,
              parentGroupId: userGroupId,
            };
          });

        const activeProp = approvedProjects.find((p) => p.id === activeProposalId);
        if (activeProp) {
          setProjects([activeProp]);
          handleProjectSelect(activeProp.id);
        } else {
          setProjects([]);
          setSelectedProjectId("");
        }
      } else {
        setProjects([]);
        setSelectedProjectId("");
      }
    } catch (error) {
      console.error("Failed to load group:", error);
      setProjects([]);
      setSelectedProjectId("");
    } finally {
      setIsLoading(false);
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
            } else {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        } catch (e) {
          setIsLoading(false);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

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

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    sessionStorage.setItem("lastSelectedProjectId", projectId);
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) { }
    navigate("/");
  };

  const handleDownloadPDF = async () => {
    if (!selectedProject) return;
    setIsDownloading(true);
    try {
      const finData = selectedProject.financialData || {};
      const activeFin =
        finData.monthlyRecords &&
        Array.isArray(finData.monthlyRecords) &&
        finData.monthlyRecords.length > 0
          ? finData.monthlyRecords[finData.monthlyRecords.length - 1]?.financials || finData
          : finData;

      const localAudit = calculateLocalAudit({
        ...activeFin,
        businessName: selectedProject.name,
        totalCapital: selectedProject.totalCapital,
        products: selectedProject.products,
      });

      const proForma = generateProFormaData(activeFin);

      const status = (selectedProject.aiAnalysis?.status || localAudit.status || "FEASIBLE").replace(/_/g, " ");
      const score = selectedProject.aiAnalysis?.score ?? localAudit.score ?? 85;
      const grade = selectedProject.aiAnalysis?.performanceGrade || localAudit.performanceGrade || "Satisfactory";
      const recommendation = cleanUserFacingText(
        selectedProject.aiAnalysis?.performanceRecommendation ||
        localAudit.performanceRecommendation ||
        "Study is mathematically sound. Ready for implementation."
      );

      const pdf = new jsPDF("p", "mm", "a4");
      const margin = 12;
      const contentWidth = 186; // 210 - 24

      // --- HEADER ---
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(201, 166, 84); // Gold #c9a654
      pdf.text("FEASIFY INTELLIGENCE ENGINE  •  EXECUTIVE FEASIBILITY AUDIT", margin, 14);

      pdf.setFontSize(16);
      pdf.setTextColor(18, 34, 68); // Navy #122244
      const titleLines = pdf.splitTextToSize(selectedProject.name, contentWidth - 45);
      pdf.text(titleLines.slice(0, 2), margin, 21);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139); // Slate
      const dateStr = selectedProject.aiAnalysis?.lastRun
        ? new Date(selectedProject.aiAnalysis.lastRun).toLocaleDateString()
        : new Date().toLocaleDateString();
      pdf.text(
        `Analysis Date: ${dateStr}  •  Academic Feasibility Evaluation  •  PLV BA8 Capstone Standards`,
        margin,
        27
      );

      // Gold Accent Line
      pdf.setDrawColor(201, 166, 84);
      pdf.setLineWidth(0.6);
      pdf.line(margin, 29, margin + contentWidth, 29);

      // --- VERDICT BANNER (Y: 32 - 47) ---
      const verdictY = 32;
      const isFeasible = status === "FEASIBLE";
      const isNotFeasible = status === "NOT FEASIBLE";

      if (isFeasible) {
        pdf.setFillColor(236, 253, 245);
        pdf.setDrawColor(167, 243, 208);
      } else if (isNotFeasible) {
        pdf.setFillColor(254, 242, 242);
        pdf.setDrawColor(254, 202, 202);
      } else {
        pdf.setFillColor(255, 251, 235);
        pdf.setDrawColor(253, 230, 138);
      }
      pdf.roundedRect(margin, verdictY, contentWidth, 16, 2, 2, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      if (isFeasible) pdf.setTextColor(6, 95, 70);
      else if (isNotFeasible) pdf.setTextColor(153, 27, 27);
      else pdf.setTextColor(146, 64, 14);

      pdf.text(`OFFICIAL VERDICT: ${status}`, margin + 4, verdictY + 6);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.text(`Academic Standing: Grade ${grade} (Composite Rating: ${score}/100)`, margin + 4, verdictY + 11.5);

      // Right-side Advisory Note
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      pdf.text("ADVISORY NOTE:", 112, verdictY + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      const recLines = pdf.splitTextToSize(recommendation, 80);
      pdf.text(recLines.slice(0, 2), 112, verdictY + 9);

      // --- SECTION I: FINANCIAL PERFORMANCE OVERVIEW (Y: 51 - 74) ---
      const sec1Y = 51;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(18, 34, 68);
      pdf.text("I. FINANCIAL VIABILITY & CAPITAL RECOVERY", margin, sec1Y);

      const cardW = (contentWidth - 9) / 4; // ~44.25mm
      const cardH = 17;
      const cardY = sec1Y + 3;

      const finCards = [
        {
          label: "INITIAL CAPITAL",
          val: `₱${financialOverview.startupCapital.toLocaleString()}`,
          sub: "Total Project CapEx",
          color: [15, 23, 42]
        },
        {
          label: "ANNUAL SALES",
          val: `₱${financialOverview.annualRevenue.toLocaleString()}`,
          sub: "Gross Turnover",
          color: [15, 23, 42]
        },
        {
          label: "NET ANNUAL PROFIT",
          val: `₱${financialOverview.netAnnualProfit.toLocaleString()}`,
          sub: "After-Tax Net Income",
          color: financialOverview.netAnnualProfit >= 0 ? [16, 120, 60] : [220, 38, 38]
        },
        {
          label: "BREAK-EVEN & PAYBACK",
          val: localAudit.bepRevenueStr || "N/A",
          sub: `Recovery: ${financialOverview.paybackPeriodFormatted}`,
          color: [15, 23, 42]
        }
      ];

      finCards.forEach((c, idx) => {
        const cx = margin + idx * (cardW + 3);
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(cx, cardY, cardW, cardH, 1.5, 1.5, "FD");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(c.label, cx + 3, cardY + 4.5);

        pdf.setFontSize(9.5);
        pdf.setTextColor(c.color[0], c.color[1], c.color[2]);
        pdf.text(c.val, cx + 3, cardY + 10.5);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6);
        pdf.setTextColor(148, 163, 184);
        pdf.text(c.sub, cx + 3, cardY + 14.5);
      });

      // --- SECTION II: 5-YEAR PRO-FORMA FINANCIAL SUMMARY TABLE (Y: 76 - 120) ---
      const sec2Y = 74;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(18, 34, 68);
      pdf.text("II. FIVE-YEAR PRO-FORMA FINANCIAL SUMMARY (PHP)", margin, sec2Y);

      const tableY = sec2Y + 3;
      const colW0 = 51;
      const colWRest = (contentWidth - colW0) / 5; // 27mm each
      const rowH = 6.8;

      // Table Header Row
      pdf.setFillColor(18, 34, 68);
      pdf.rect(margin, tableY, contentWidth, rowH, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Financial Indicator", margin + 3, tableY + 4.5);
      proForma.yearLabels.forEach((yr, i) => {
        const xPos = margin + colW0 + i * colWRest + colWRest / 2;
        pdf.text(yr, xPos, tableY + 4.5, { align: "center" });
      });

      const tableRows = [
        { label: "Gross Sales Revenue", data: proForma.yearlyRevenue },
        { label: "Cost of Goods Sold (COGS)", data: proForma.yearlyCOGS },
        { label: "Operating Overhead (OPEX)", data: proForma.yearlyFixedCosts },
        {
          label: `Applicable Tax (${localAudit.isBmbeQualified ? "3% BMBE" : "20% CREATE"})`,
          data: proForma.yearlyRevenue.map((rev, i) => {
            const cogs = proForma.yearlyCOGS[i] || 0;
            const opex = proForma.yearlyFixedCosts[i] || 0;
            const pretax = rev - cogs - opex;
            return localAudit.isBmbeQualified
              ? Math.round(rev * 0.03)
              : Math.round(pretax > 0 ? pretax * 0.20 : 0);
          })
        },
        { label: "Projected Net Profit After Tax", data: proForma.yearlyNetProfit, isBold: true }
      ];

      tableRows.forEach((row, rIdx) => {
        const ry = tableY + (rIdx + 1) * rowH;
        pdf.setFillColor(rIdx % 2 === 0 ? 255 : 248, rIdx % 2 === 0 ? 255 : 250, rIdx % 2 === 0 ? 255 : 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(margin, ry, contentWidth, rowH, "FD");

        pdf.setFont("helvetica", row.isBold ? "bold" : "normal");
        pdf.setFontSize(6.8);
        pdf.setTextColor(row.isBold ? 18 : 51, row.isBold ? 34 : 65, row.isBold ? 68 : 85);
        pdf.text(row.label, margin + 3, ry + 4.5);

        row.data.forEach((val, i) => {
          const xPos = margin + colW0 + i * colWRest + colWRest / 2;
          const valStr = `₱${val.toLocaleString()}`;
          if (row.isBold) {
            if (val >= 0) pdf.setTextColor(16, 120, 60);
            else pdf.setTextColor(220, 38, 38);
          }
          pdf.text(valStr, xPos, ry + 4.5, { align: "center" });
        });
      });

      // --- SECTION III: MARKET VIABILITY & COMPETITIVE POSITION (Y: 122 - 164) ---
      const sec3Y = 120;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(18, 34, 68);
      pdf.text("III. MARKET VIABILITY & DEMAND ANCHORS", margin, sec3Y);

      // Market Assessment summary callout
      const mktY = sec3Y + 3;
      pdf.setFillColor(255, 251, 235);
      pdf.setDrawColor(253, 230, 138);
      pdf.roundedRect(margin, mktY, contentWidth, 9, 1.5, 1.5, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.8);
      pdf.setTextColor(146, 64, 14);
      pdf.text("Market Viability Finding: ", margin + 3, mktY + 5.5);
      pdf.setFont("helvetica", "normal");
      const summaryClean = cleanUserFacingText(marketAnalysis?.summary || "Location demonstrates viable demand anchors with manageable competitor density.");
      const summaryCut = summaryClean.length > 120 ? summaryClean.slice(0, 117) + "..." : summaryClean;
      pdf.text(summaryCut, margin + 36, mktY + 5.5);

      // 3 Market Pillar Cards
      const pColW = (contentWidth - 6) / 3; // ~60mm
      const pColH = 24;
      const pColY = mktY + 11;

      const pillars = [
        {
          title: "COMPETITOR DENSITY",
          badge: marketAnalysis?.competitorInsight?.badge || "Manageable Saturation",
          desc: cleanUserFacingText(marketAnalysis?.competitorInsight?.text || "Direct competitor count is within standard commercial tolerance.")
        },
        {
          title: "FOOT TRAFFIC & ANCHORS",
          badge: marketAnalysis?.footTrafficInsight?.badge || "Anchor Drivers Active",
          desc: cleanUserFacingText(marketAnalysis?.footTrafficInsight?.text || "Nearby commercial establishments provide steady pedestrian traffic.")
        },
        {
          title: "DEMOGRAPHIC STRATEGY",
          badge: marketAnalysis?.demographicInsight?.badge || "Target Audience Aligned",
          desc: cleanUserFacingText(marketAnalysis?.demographicInsight?.text || "Value pricing aligns well with local demographic willingness to pay.")
        }
      ];

      pillars.forEach((p, i) => {
        const px = margin + i * (pColW + 3);
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(px, pColY, pColW, pColH, 1.5, 1.5, "FD");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.setTextColor(18, 34, 68);
        pdf.text(p.title, px + 3, pColY + 4.5);

        pdf.setFillColor(241, 245, 249);
        pdf.rect(px + 3, pColY + 6.5, pColW - 6, 4.5, "F");
        pdf.setFontSize(6);
        pdf.setTextColor(71, 85, 105);
        pdf.text(p.badge.toUpperCase(), px + 4, pColY + 9.8);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.2);
        pdf.setTextColor(100, 116, 139);
        const pLines = pdf.splitTextToSize(p.desc, pColW - 6);
        pdf.text(pLines.slice(0, 3), px + 3, pColY + 14);
      });

      // --- SECTION IV: STRATEGIC DEFENSE INSIGHTS & ACTION PLAN (Y: 168 - 238) ---
      const sec4Y = 168;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(18, 34, 68);
      pdf.text("IV. STRATEGIC DEFENSE AUDIT & ACTION RECOMMENDATIONS", margin, sec4Y);

      const insightsList = (selectedProject.aiAnalysis?.insights || localAudit.insights || []).slice(0, 3);
      const insY = sec4Y + 3;

      insightsList.forEach((ins: any, i: number) => {
        const iy = insY + i * 13;
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, iy, contentWidth, 11, 1.5, 1.5, "FD");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.2);
        pdf.setTextColor(18, 34, 68);
        pdf.text(`•  ${ins.title}`, margin + 3, iy + 4.2);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.3);
        pdf.setTextColor(71, 85, 105);
        const insLines = pdf.splitTextToSize(cleanUserFacingText(ins.description || ""), contentWidth - 8);
        pdf.text(insLines.slice(0, 2), margin + 5, iy + 8.2);
      });

      // Priority Feasibility Action Banner
      const actionY = insY + 3 * 13 + 1;
      const actionText = cleanUserFacingText(
        selectedProject.aiAnalysis?.improvementTips?.feasibility ||
        localAudit.improvementTips?.feasibility ||
        "Maintain current pricing structure and verify supplier quotes prior to panel defense."
      );
      pdf.setFillColor(238, 242, 255);
      pdf.setDrawColor(199, 210, 254);
      pdf.roundedRect(margin, actionY, contentWidth, 12, 1.5, 1.5, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.8);
      pdf.setTextColor(49, 46, 129);
      pdf.text("PRIORITY DEFENSE ADVISORY ACTION:", margin + 3, actionY + 4.2);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.3);
      pdf.setTextColor(67, 56, 202);
      const actionLines = pdf.splitTextToSize(actionText, contentWidth - 8);
      pdf.text(actionLines.slice(0, 2), margin + 3, actionY + 8.2);

      // --- FOOTER (Y: 242 - 252) ---
      const footerY = 242;
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.4);
      pdf.line(margin, footerY, margin + contentWidth, footerY);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        "Feasify Intelligence Engine  •  Official Academic Feasibility Study  •  Pamantasan ng Lungsod ng Valenzuela",
        margin,
        footerY + 4.5
      );
      pdf.text(
        "Page 1 of 1  •  Strict 1-Page Defense Executive Summary  •  Confidential",
        margin + contentWidth,
        footerY + 4.5,
        { align: "right" }
      );

      const safeName = selectedProject.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      pdf.save(`${safeName}_Executive_Feasibility_Report.pdf`);
    } catch (error) {
      console.error("Vector PDF Error, attempting fallback:", error);
      try {
        if (!reportRef.current) throw error;
        const dataUrl = await domtoimage.toPng(reportRef.current, { quality: 1, bgcolor: "#ffffff" });
        const fallbackPdf = new jsPDF("p", "mm", "a4");
        fallbackPdf.addImage(dataUrl, "PNG", 8, 8, 194, 281, undefined, "FAST");
        const safeName = selectedProject.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
        fallbackPdf.save(`${safeName}_Feasibility_Report.pdf`);
      } catch (err2) {
        alert("Failed to generate PDF. Please try again.");
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const financialOverview = useMemo(() => {
    if (!selectedProject) {
      return {
        startupCapital: 0,
        annualRevenue: 0,
        netAnnualProfit: 0,
        paybackPeriodFormatted: "N/A",
      };
    }

    const finData = selectedProject.financialData || {};
    const activeFin =
      finData.monthlyRecords &&
      Array.isArray(finData.monthlyRecords) &&
      finData.monthlyRecords.length > 0
        ? finData.monthlyRecords[finData.monthlyRecords.length - 1]?.financials || finData
        : finData;

    const proposalProducts =
      selectedProject.products && selectedProject.products.length > 0
        ? selectedProject.products
        : activeFin.products && activeFin.products.length > 0
        ? activeFin.products
        : selectedProject.rawProposalData?.products || [];

    const prods = normalizeProposalProducts(activeFin, selectedProject.name, proposalProducts);

    let monthlyRevenue = 0;
    let totalMonthlyVariableCosts = 0;
    let safeMonthlySales = 0;
    let safeSellingPrice = 0;
    let safeVariableCost = 0;

    if (prods.length > 1) {
      monthlyRevenue = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).revenue, 0);
      totalMonthlyVariableCosts = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).cogsSold, 0);
      safeMonthlySales = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).unitsSold, 0);
      safeSellingPrice = safeMonthlySales > 0 ? monthlyRevenue / safeMonthlySales : 0;
      safeVariableCost = safeMonthlySales > 0 ? totalMonthlyVariableCosts / safeMonthlySales : 0;
    } else if (prods.length === 1) {
      const m = computeProductMetrics(prods[0]);
      monthlyRevenue = m.revenue;
      totalMonthlyVariableCosts = m.cogsSold;
      safeMonthlySales = m.unitsSold;
      safeSellingPrice = m.netSellingPrice > 0 ? m.netSellingPrice : (m.sellingPrice > 0 ? m.sellingPrice : (Number(activeFin?.sellingPrice) || 0));
      safeVariableCost = m.unitCost > 0 ? m.unitCost : (Number(activeFin?.variableCost) || 0);
    } else {
      safeSellingPrice = Number(activeFin?.sellingPrice) || 0;
      safeVariableCost = Number(activeFin?.variableCost) || 0;
      safeMonthlySales = Number(activeFin?.monthlySales) || 0;
      monthlyRevenue = safeSellingPrice * safeMonthlySales;
      totalMonthlyVariableCosts = safeVariableCost * safeMonthlySales;
    }

    const safeOperatingDays = Number(activeFin?.operatingDays) || 300;
    const isCapitalBorrowed = Boolean(activeFin?.isCapitalBorrowed);
    const interestRate = Number(activeFin?.interestRate) || 0;

    const equipmentList = activeFin?.equipmentList || [];
    const equipmentTotal = equipmentList.reduce(
      (sum: number, item: any) => sum + (Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0),
      0
    );

    const declaredCapital =
      Number(activeFin?.startupCapital) ||
      Number(activeFin?.cashInvested) ||
      Number(selectedProject?.totalCapital) ||
      Number(selectedProject?.proposalCapital) ||
      0;
    const safeStartupCapital = equipmentList.length > 0 && equipmentTotal > 0 ? equipmentTotal : declaredCapital;

    const opexList = activeFin?.opexList || [];
    const monthlyOpex = opexList.length > 0
      ? opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
      : (Number(activeFin?.fixedCosts) || 0);

    const monthlyInterest = isCapitalBorrowed ? (safeStartupCapital * (interestRate / 100)) / 12 : 0;
    const annualRevenue = (monthlyRevenue / 30) * safeOperatingDays;
    const annualExpenses = ((totalMonthlyVariableCosts + monthlyOpex + monthlyInterest) / 30) * safeOperatingDays;
    const annualNetProfitPreTax = annualRevenue - annualExpenses;
    const isBmbe = annualRevenue <= 3000000 && safeStartupCapital <= 3000000;
    const applicableTax = isBmbe
      ? (annualRevenue > 0 ? annualRevenue * 0.03 : 0)
      : (annualNetProfitPreTax > 0 ? annualNetProfitPreTax * 0.20 : 0);
    const annualNetProfitAfterTax = (annualNetProfitPreTax > 0 ? annualNetProfitPreTax : 0) - applicableTax;

    let paybackPeriodFormatted = "N/A";
    if (annualNetProfitAfterTax > 0 && safeStartupCapital > 0) {
      const monthlyCashInflow = annualNetProfitAfterTax / 12;
      const totalMonths = safeStartupCapital / monthlyCashInflow;
      const years = Math.floor(totalMonths / 12);
      const months = Math.floor(totalMonths % 12);
      const days = Math.round((totalMonths % 1) * 30);

      if (years > 0) {
        paybackPeriodFormatted = `${years} Year${years > 1 ? "s" : ""}${months > 0 ? ` ${months} Mo${months > 1 ? "s" : ""}` : ""}`;
      } else if (months > 0) {
        paybackPeriodFormatted = `${months} Month${months > 1 ? "s" : ""}${days > 0 ? ` ${days}d` : ""}`;
      } else {
        paybackPeriodFormatted = `${days} Days`;
      }
    } else if (annualNetProfitAfterTax <= 0) {
      paybackPeriodFormatted = "N/A (Net Deficit)";
    }

    return {
      startupCapital: safeStartupCapital,
      annualRevenue: Math.round(annualRevenue),
      netAnnualProfit: Math.round(annualNetProfitAfterTax),
      paybackPeriodFormatted,
    };
  }, [selectedProject]);

  const marketAnalysis = useMemo<MarketAnalysisData | null>(() => {
    if (!selectedProject) return null;
    const rawAi = selectedProject.aiAnalysis;
    if (rawAi?.marketAnalysis) {
      return cleanUserFacingText(rawAi.marketAnalysis);
    }
    if (selectedProject.financialData) {
      const fallback = calculateLocalAudit({
        ...selectedProject.financialData,
        businessName: selectedProject.name,
        totalCapital: selectedProject.totalCapital,
        products: selectedProject.products,
      });
      return fallback.marketAnalysis || null;
    }
    return null;
  }, [selectedProject]);

  const getInitials = (name: string) =>
    name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="flex min-h-screen bg-gray-50/50 print:overflow-visible print:block">
      {/* Inject Print-Specific Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .print\\:hidden { display: none !important; }
          main {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            position: relative !important;
            left: 0 !important;
          }
          /* Hide decorative background wave on print */
          main::after {
            display: none !important;
          }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:m-0 { margin: 0 !important; }
          .report-page-container {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-height: 280mm !important;
            box-sizing: border-box !important;
          }
          /* Ensure exact background colors and borders print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-[50] lg:hidden print:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar - Marked as print:hidden */}
      <aside
        className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 w-64 lg:w-16 lg:hover:w-64 print:hidden`}
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
            className="h-10.5 w-auto max-h-[42px] max-w-[200px] object-contain select-none pointer-events-none block lg:hidden lg:group-hover:block shrink-0"
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
            onClick={() => { setIsSidebarOpen(false); navigate("/financial-input"); }}
            title="Financial Input"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <FileEdit className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Financial Input
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/ai-analysis"); }}
            title="AI Feasibility Analysis"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Zap className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              AI Feasibility Analysis
            </span>
          </button>
          <button
            title="Reports"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold bg-[#c9a654] text-[#122244] transition-all shadow-md"
          >
            <BarChart3 className="w-5 h-5 shrink-0 text-[#122244]" />
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

      <main className="flex-1 transition-all duration-300 ease-in-out min-h-screen lg:ml-16 ml-0 print:ml-0 print:p-0">
        <div className="bg-white border-b border-gray-200/80 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <MobileBurgerButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span
              className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors shrink-0"
              onClick={() => navigate("/dashboard")}
            >
              FeasiFy
            </span>
            <span className="text-gray-400 shrink-0">›</span>
            <span className="font-semibold text-gray-900 truncate">Reports</span>
            <span className="text-gray-300 hidden sm:inline shrink-0">|</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#122244] text-white shadow-xs tracking-wide whitespace-nowrap hidden sm:inline-block shrink-0">
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

        <div className="p-6 md:p-8 max-w-5xl mx-auto print:p-0 print:max-w-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6 print:hidden">
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23]">Executive Reports</h1>
              <p className="text-sm text-gray-500 mt-1 italic">Download and print your official AI-generated feasibility study documentation.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => window.print()} disabled={!selectedProject?.aiAnalysis} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"><Printer className="w-4 h-4" /> Print Document</button>
              <button onClick={handleDownloadPDF} disabled={!selectedProject?.aiAnalysis || isDownloading} className="flex items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md disabled:opacity-50"><Download className="w-4 h-4" /> {isDownloading ? "Generating..." : "Download PDF"}</button>
            </div>
          </div>

          <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm print:hidden">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Project Document Under Evaluation</label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-lg border border-blue-100">P#</div>
              <div>
                <h2 className="text-2xl font-extrabold text-[#122244] tracking-tight">{selectedProjectId && projects.length > 0 ? projects.find((p) => p.id === selectedProjectId)?.name : "No active project"}</h2>
                {selectedProjectId && <span className="inline-block mt-1 text-[10px] font-black uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded">Verified Approved Business</span>}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh]">
              <div className="w-8 h-8 border-4 border-[#122244] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-medium text-sm">Loading reports...</p>
            </div>
          ) : !selectedProject || projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-12 max-w-2xl mx-auto my-8 print:hidden">
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
                Please submit a business proposal and have it approved by your adviser, then set it as your group's active business in the <strong>Business Proposal</strong> module to unlock Feasibility Reports.
              </p>
              <button
                onClick={() => navigate("/projects")}
                className="flex items-center gap-2 px-6 py-3 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95"
              >
                <Folder className="w-4 h-4 text-[#c9a654]" /> Go to Business Proposals
              </button>
            </div>
          ) : !selectedProject.aiAnalysis ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 py-20 flex flex-col items-center justify-center text-center print:hidden">
              <FileText className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-[#122244]">No Report Available</h3>
              <p className="text-gray-500 mt-2 mb-6">You need to run an AI Feasibility Analysis first.</p>
              <button onClick={() => navigate("/ai-analysis")} className="bg-[#122244] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#1a3263] transition-colors">Go to Analysis Module</button>
            </div>
          ) : (
            <div
              ref={reportRef}
              className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 sm:p-10 md:p-12 mb-8 max-w-5xl mx-auto print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none report-page-container flex flex-col justify-between"
            >
              {/* Report Header */}
              <div className="border-b-2 border-[#122244] pb-4 mb-5 text-center print:pb-3 print:mb-4">
                <div className="flex items-center justify-between mb-1 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <span>FeasiFy Intelligence Engine</span>
                  <span className="text-[#c9a654]">Executive Feasibility Audit</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-[#122244] tracking-tight">{selectedProject.name}</h1>
                <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-gray-500 mt-1.5 font-medium">
                  <span>
                    Analysis Date: {selectedProject.aiAnalysis.lastRun ? new Date(selectedProject.aiAnalysis.lastRun).toLocaleDateString() : "Current"}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold">Verified Academic Study</span>
                  <span>•</span>
                  <span className="text-gray-400">Formal Feasibility Audit</span>
                </div>
              </div>

              {/* Official Verdict Banner */}
              <div
                className={`p-4 sm:p-5 rounded-2xl mb-5 flex items-center justify-between gap-4 border-2 print:p-3.5 print:mb-4 ${
                  selectedProject.aiAnalysis.status === "FEASIBLE"
                    ? "bg-green-50/90 border-green-200 text-green-900"
                    : selectedProject.aiAnalysis.status === "NOT_FEASIBLE"
                    ? "bg-red-50/90 border-red-200 text-red-900"
                    : "bg-amber-50/90 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 sm:p-3 rounded-full bg-white shadow-xs">
                    {selectedProject.aiAnalysis.status === "FEASIBLE" ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg tracking-wide uppercase">
                      Official Verdict: {(selectedProject.aiAnalysis.status || "PENDING").replace(/_/g, " ")}
                    </h3>
                    <p className="text-xs sm:text-sm font-semibold opacity-90 mt-0.5">
                      Academic Standing: Grade {selectedProject.aiAnalysis.performanceGrade || "Satisfactory"}
                    </p>
                  </div>
                </div>
                {selectedProject.aiAnalysis.performanceRecommendation && (
                  <div className="hidden sm:block text-right max-w-sm pl-4 border-l border-current/20">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider block opacity-75">Advisory Note</span>
                    <span className="text-xs sm:text-sm font-semibold leading-snug">{selectedProject.aiAnalysis.performanceRecommendation}</span>
                  </div>
                )}
              </div>

              {/* Financial Overview */}
              <div className="mb-5 print:mb-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5 mb-3">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#122244] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#c9a654]" /> Financial Performance Overview
                  </h3>
                  <span className="text-xs text-gray-400 font-semibold uppercase">Annual Projection Basis</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4 print:gap-3">
                  <div className="bg-gray-50/80 p-3.5 sm:p-4 rounded-xl border border-gray-200/80 print:p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Initial Capital</p>
                    <p className="text-lg sm:text-xl font-black text-gray-900">₱ {financialOverview.startupCapital.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">Total Project Capital</p>
                  </div>
                  <div className="bg-gray-50/80 p-3.5 sm:p-4 rounded-xl border border-gray-200/80 print:p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Projected Annual Sales</p>
                    <p className="text-lg sm:text-xl font-black text-gray-900">₱ {financialOverview.annualRevenue.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">Gross Turnover</p>
                  </div>
                  <div className="bg-gray-50/80 p-3.5 sm:p-4 rounded-xl border border-gray-200/80 print:p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Net Annual Profit</p>
                    <p className={`text-lg sm:text-xl font-black ${financialOverview.netAnnualProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {financialOverview.netAnnualProfit < 0 ? "-₱ " : "₱ "}
                      {Math.abs(financialOverview.netAnnualProfit).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">After-Tax Net Income</p>
                  </div>
                  <div className="bg-gray-50/80 p-3.5 sm:p-4 rounded-xl border border-gray-200/80 print:p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Est. Payback Period</p>
                    <p className="text-lg sm:text-xl font-black text-gray-900">{financialOverview.paybackPeriodFormatted}</p>
                    <p className="text-xs text-gray-400 mt-1">Capital Recovery</p>
                  </div>
                </div>
              </div>

              {/* AI Market Viability & Competitive Intelligence */}
              {marketAnalysis && (
                <div className="mb-5 print:mb-4">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-1.5 mb-3">
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#122244] flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#c9a654]" /> AI Market Viability & Competitive Intelligence
                    </h3>
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                      Market Feasibility Audited
                    </span>
                  </div>

                  {marketAnalysis.summary && (
                    <div className="p-3.5 sm:p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs sm:text-sm text-[#122244] leading-relaxed mb-3.5 print:p-3 print:mb-3">
                      <span className="font-extrabold text-amber-950">Market Assessment: </span>
                      <span>{marketAnalysis.summary}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 print:grid-cols-3 print:gap-3">
                    {marketAnalysis.competitorInsight && (
                      <div className="p-3.5 sm:p-4 bg-white border border-gray-200 rounded-xl shadow-2xs flex flex-col justify-between print:p-3">
                        <div>
                          <div className="pb-2 mb-2 border-b border-gray-100 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#122244] uppercase tracking-wider">
                              <Store size={14} className="text-amber-600 shrink-0" />
                              <span>Competitor Density</span>
                            </div>
                            <div>
                              <span
                                className={`inline-block text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide ${
                                  marketAnalysis.competitorInsight.status === "positive"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : "bg-amber-100 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {marketAnalysis.competitorInsight.badge}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {marketAnalysis.competitorInsight.text}
                          </p>
                        </div>
                      </div>
                    )}

                    {marketAnalysis.footTrafficInsight && (
                      <div className="p-3.5 sm:p-4 bg-white border border-gray-200 rounded-xl shadow-2xs flex flex-col justify-between print:p-3">
                        <div>
                          <div className="pb-2 mb-2 border-b border-gray-100 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#122244] uppercase tracking-wider">
                              <Building2 size={14} className="text-emerald-600 shrink-0" />
                              <span>Foot Traffic & Anchors</span>
                            </div>
                            <div>
                              <span
                                className={`inline-block text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide ${
                                  marketAnalysis.footTrafficInsight.status === "positive"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : "bg-rose-100 text-rose-800 border border-rose-200"
                                }`}
                              >
                                {marketAnalysis.footTrafficInsight.badge}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {marketAnalysis.footTrafficInsight.text}
                          </p>
                        </div>
                      </div>
                    )}

                    {marketAnalysis.demographicInsight && (
                      <div className="p-3.5 sm:p-4 bg-white border border-gray-200 rounded-xl shadow-2xs flex flex-col justify-between print:p-3">
                        <div>
                          <div className="pb-2 mb-2 border-b border-gray-100 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#122244] uppercase tracking-wider">
                              <Lightbulb size={14} className="text-sky-600 shrink-0" />
                              <span>Demographic Strategy</span>
                            </div>
                            <div>
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide bg-sky-100 text-sky-800 border border-sky-200">
                                {marketAnalysis.demographicInsight.badge}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {marketAnalysis.demographicInsight.text}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Strategic Insights & Recommendations */}
              <div className="mb-4 print:mb-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5 mb-3">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#122244] flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[#c9a654]" /> Strategic Insights & Recommendations
                  </h3>
                  <span className="text-xs text-gray-400 font-semibold uppercase">Executive Takeaways</span>
                </div>
                <div className="space-y-2.5 sm:space-y-3">
                  {(selectedProject.aiAnalysis.insights || []).slice(0, 3).map((insight: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 sm:p-3.5 bg-gray-50/80 rounded-xl border border-gray-200/70">
                      <div className="mt-0.5 shrink-0 p-1 rounded-md bg-white shadow-2xs">
                        {insight.type === "positive" ? (
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                        ) : insight.type === "warning" ? (
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                        ) : (
                          <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">{insight.title}</h4>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{insight.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Priority Strategic Guidance Banner */}
                {selectedProject.aiAnalysis.improvementTips?.feasibility && (
                  <div className="mt-3 p-3 sm:p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-start gap-3">
                    <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 block mb-0.5">
                        Priority Feasibility Action:
                      </span>
                      <p className="text-xs text-indigo-800 leading-relaxed">
                        {selectedProject.aiAnalysis.improvementTips.feasibility}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Report Footer */}
              <div className="pt-3 mt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400 print:pt-2 print:mt-3">
                <span>FeasiFy Intelligence System • Academic Feasibility Evaluation</span>
                <span>Page 1 of 1 • Official Feasibility Study Report</span>
              </div>
            </div>
          )}
        </div>

        {/* Floating Back to Top Button */}
        <ScrollToTopButton />
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#122244] mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;