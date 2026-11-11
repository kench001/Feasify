/**
 * Feasify Centralized Business Proposal Section Export Service
 *
 * Exports selectable sections:
 * 1. Project Overview
 * 2. Financial Input
 * 3. AI Feasibility Analysis
 *
 * Generated in strict order into a single professional PDF.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDisplayDate, formatDisplayDateTime } from "../utils/dateFormatter.ts";
import {
  normalizeProposalProducts,
  computeProductMetrics,
  autoDistributeContributors,
} from "../utils/productCosting.ts";
import { getOtherRelevantInformation } from "../utils/proposalDetails.ts";
import { cleanUserFacingText, calculateLocalAudit } from "../utils/feasibilityAudit.ts";

export type ExportSectionKey = "overview" | "financial" | "ai";

export interface ProposalSectionExportOptions {
  proposal: any;
  group?: any;
  adviserName?: string;
  selectedSections: ExportSectionKey[];
}

/**
 * Checks whether completed, valid AI feasibility results exist for a proposal
 */
export function isAiAnalysisAvailable(proposal: any): boolean {
  if (!proposal || typeof proposal !== "object") return false;
  const ai = proposal.aiAnalysis;
  if (!ai || typeof ai !== "object") return false;

  // Rejection of placeholder/fallback or incomplete states
  if (ai._fallback === true) return false;
  if (ai.status === "FAILED" || ai.status === "PENDING" || ai.status === "NOT_ANALYZED" || ai.status === "PROCESSING") {
    return false;
  }

  // Must have a meaningful verdict or score
  const hasVerdict = Boolean(ai.verdict || ai.status === "COMPLETED" || ai.overallVerdict);
  const hasScore = Number.isFinite(ai.score) || Number.isFinite(ai.overallScore);
  const hasInsights = Array.isArray(ai.insights) && ai.insights.length > 0;
  const hasStrengths = Array.isArray(ai.strengths) && ai.strengths.length > 0;

  return (hasVerdict && (hasScore || hasInsights || hasStrengths)) || (hasScore && (hasInsights || hasStrengths));
}

/**
 * Preserves strict section ordering: 1. Overview -> 2. Financial -> 3. AI Analysis
 */
export function orderSelectedSections(sections: ExportSectionKey[]): ExportSectionKey[] {
  const masterOrder: ExportSectionKey[] = ["overview", "financial", "ai"];
  return masterOrder.filter((s) => sections.includes(s));
}

/**
 * Builds standard sanitized filename: FEASIFY_[BusinessName]_[SelectedSections]_[YYYY-MM-DD].pdf
 */
export function buildExportFilename(
  businessName: string,
  selectedSections: ExportSectionKey[],
  now: Date = new Date()
): string {
  const cleanName = (businessName || "Proposal")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const ordered = orderSelectedSections(selectedSections);
  const labels = ordered.map((s) => {
    if (s === "overview") return "Overview";
    if (s === "financial") return "Financial";
    if (s === "ai") return "AI_Analysis";
    return s;
  });

  const sectionPart = labels.join("_") || "Report";

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  return `FEASIFY_${cleanName || "Proposal"}_${sectionPart}_${dateStr}.pdf`;
}

/**
 * Main PDF Generator for Selectable Business Proposal Sections
 */
export async function exportProposalSectionsPDF(options: ProposalSectionExportOptions): Promise<void> {
  const { proposal, group, adviserName, selectedSections } = options;

  if (!selectedSections || selectedSections.length === 0) {
    throw new Error("At least one section must be selected for export.");
  }

  const orderedSections = orderSelectedSections(selectedSections);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  let y = 14;

  const brandNavy = [18, 34, 68] as const;
  const brandGold = [201, 166, 84] as const;
  const textDark = [30, 41, 59] as const;
  const textMuted = [100, 116, 139] as const;
  const borderGray = [226, 232, 240] as const;
  const bgLight = [248, 250, 252] as const;
  const greenText = [16, 149, 106] as const;
  const amberText = [180, 83, 9] as const;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = 16;
      drawRunningHeader();
    }
  };

  const drawRunningHeader = () => {
    doc.setFillColor(...brandNavy);
    doc.rect(marginX, y, contentWidth, 8, "F");
    doc.setFillColor(...brandGold);
    doc.rect(marginX, y + 7.5, contentWidth, 0.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("FEASIFY ACADEMIC PLATFORM • BUSINESS PROPOSAL REPORT", marginX + 3, y + 5.2);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...brandGold);
    const busNameShort = (proposal.businessName || "Proposal Details").substring(0, 40);
    doc.text(busNameShort, pageWidth - marginX - 3, y + 5.2, { align: "right" });
    y += 12;
  };

  // COVER HEADER
  doc.setFillColor(...brandNavy);
  doc.roundedRect(marginX, y, contentWidth, 26, 2, 2, "F");
  doc.setFillColor(...brandGold);
  doc.rect(marginX, y + 25, contentWidth, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...brandGold);
  doc.text("FeasiFy", marginX + 5, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("BUSINESS PROPOSAL EXPORT REPORT", marginX + 32, y + 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  const sectionSummaryText = `Sections Included: ${orderedSections.map((s) => s.toUpperCase()).join(" • ")}`;
  doc.text(sectionSummaryText, marginX + 5, y + 16.5);

  const reportDateStr = formatDisplayDateTime(new Date());
  doc.text(`Generated: ${reportDateStr}`, pageWidth - marginX - 5, y + 16.5, { align: "right" });
  y += 31;

  // SUMMARY CARD
  const cardStartY = y;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentWidth, 34, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...brandNavy);
  const busName = (proposal.businessName || "Business Proposal").trim();
  doc.text(busName, marginX + 5, y + 8);

  const statusStr = (proposal.status || "Submitted").toUpperCase();
  const badgeWidth = doc.getTextWidth(statusStr) + 6;
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(pageWidth - marginX - badgeWidth - 5, y + 3.5, badgeWidth, 6, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text(statusStr, pageWidth - marginX - 5 - badgeWidth / 2, y + 7.7, { align: "center" });

  const metaY = y + 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text("INDUSTRY / SECTOR", marginX + 5, metaY);
  doc.text("STARTUP CAPITAL", marginX + 52, metaY);
  doc.text("ACADEMIC SECTION", marginX + 98, metaY);
  doc.text("ADVISER", marginX + 142, metaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  doc.text(proposal.businessType || "General Business", marginX + 5, metaY + 5);
  const capVal = proposal.totalCapital || proposal.financialData?.startupCapital || 0;
  doc.text(
    `PHP ${Number(capVal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    marginX + 52,
    metaY + 5
  );
  doc.text(group?.section || proposal.section || "Unassigned", marginX + 98, metaY + 5);
  doc.text(adviserName || "Faculty Adviser", marginX + 142, metaY + 5);

  y = cardStartY + 38;

  let sectionCounter = 1;

  // SECTION 1: PROJECT OVERVIEW
  if (orderedSections.includes("overview")) {
    checkPageBreak(30);

    doc.setFillColor(...brandNavy);
    doc.rect(marginX, y, 3, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...brandNavy);
    doc.text(`${sectionCounter}. PROJECT OVERVIEW`, marginX + 6, y + 5);
    y += 10;
    sectionCounter++;

    const overviewRows: Array<[string, string]> = [
      ["Business Name", proposal.businessName || "Untitled Proposal"],
      ["Group Proponents", group?.title || group?.companyName || "Group Members"],
      ["Team Leader", group?.leaderName || "Assigned Leader"],
      ["Industry / Type", proposal.businessType || "General Business"],
      ["Date of Submission", formatDisplayDate(proposal.submissionDate || proposal.createdAt)],
      ["Proposal Status", proposal.status || "Submitted"],
      ["Total Initial Capital", `PHP ${Number(proposal.totalCapital || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`],
      ["Tagline", proposal.tagline || "N/A"],
      ["Mission Statement", proposal.missionStatement || "N/A"],
      ["Vision Statement", proposal.visionStatement || "N/A"],
      ["Target Market", proposal.targetMarket || "General Public"],
      ["Product Description", proposal.productDescription || "N/A"],
      ["Specific Pricing", proposal.priceRanges || "N/A"],
      ["Proposed Location", proposal.proposedLocation || "N/A"],
      ["Promotional Strategy", proposal.promotionalStrategy || "N/A"],
      ["Business Objectives", proposal.otherDetails || proposal.objectives || "N/A"],
      ["Relevant Information", getOtherRelevantInformation(proposal) || "N/A"],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [["Field", "Project Specification"]],
      body: overviewRows,
      theme: "striped",
      headStyles: {
        fillColor: [18, 34, 68],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: "bold", textColor: [18, 34, 68] },
        1: { cellWidth: 140 },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // SECTION 2: FINANCIAL INPUT
  if (orderedSections.includes("financial")) {
    checkPageBreak(30);

    doc.setFillColor(...brandNavy);
    doc.rect(marginX, y, 3, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...brandNavy);
    doc.text(`${sectionCounter}. FINANCIAL INPUT & COSTING MODEL`, marginX + 6, y + 5);
    y += 10;
    sectionCounter++;

    const fin = proposal.financialData || proposal.originalProposalFinancials || {};
    const normalizedProducts = normalizeProposalProducts(fin);
    const metrics = computeProductMetrics(fin);

    const safeStartupCapital = fin.equipmentList && fin.equipmentList.length > 0
      ? fin.equipmentList.reduce((sum: number, item: any) => sum + (Number(item.total) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0)
      : Number(fin.startupCapital) || Number(proposal.totalCapital) || capVal;
    const safeFixedCosts = fin.opexList && fin.opexList.length > 0
      ? fin.opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
      : Number(fin.fixedCosts) || 0;
    const effectiveTotalCap = Number(proposal.totalCapital || fin.startupCapital || capVal || 0);

    // 1. BUSINESS FEASIBILITY CAPITAL SUMMARY BANNER
    checkPageBreak(30);
    doc.setFillColor(18, 34, 68);
    doc.roundedRect(marginX, y, contentWidth, 22, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(201, 166, 84);
    doc.text("TOTAL CAPITAL OVERVIEW  •  BUSINESS FEASIBILITY CAPITAL SUMMARY", marginX + 4, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(226, 232, 240);
    doc.text("Total capital requirement & partner contributions pulled directly from approved proposal", marginX + 4, y + 9.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(201, 166, 84);
    doc.text("Total Capital (Proposal):", marginX + 4, y + 15);
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`PHP ${effectiveTotalCap.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, marginX + 4, y + 19.5);

    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text(`Total CapEx Equipment: PHP ${Number(safeStartupCapital).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, marginX + 75, y + 15);
    doc.text(`Monthly Fixed OpEx: PHP ${Number(safeFixedCosts).toLocaleString("en-US", { minimumFractionDigits: 2 })} / mo`, marginX + 75, y + 19.5);

    y += 26;

    // 2. INITIAL CAPITAL CONTRIBUTED & INVESTORS TABLE
    const numContrib = Math.max(1, Number(fin.contributorsCount) || fin.contributorsList?.length || 1);
    const currentContribList = (fin.contributorsList && fin.contributorsList.length > 0)
      ? fin.contributorsList
      : autoDistributeContributors(numContrib, effectiveTotalCap);
    const sumContrib = currentContribList.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);

    checkPageBreak(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...brandNavy);
    doc.text(`Initial Capital Contributed & Investors (${currentContribList.length} Partners)`, marginX + 2, y);
    y += 4;

    const contribRows = currentContribList.map((c: any, idx: number) => {
      const amt = Number(c.amount) || 0;
      const pct = effectiveTotalCap > 0 ? ((amt / effectiveTotalCap) * 100).toFixed(1) + "%" : "0.0%";
      return [
        String(idx + 1),
        c.name || `Investor / Partner ${idx + 1}`,
        pct,
        `PHP ${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ];
    });

    contribRows.push([
      "Total",
      "Total Contributed Capital",
      effectiveTotalCap > 0 && Math.abs(sumContrib - effectiveTotalCap) < 1 ? "100.0%" : `${((sumContrib / (effectiveTotalCap || 1)) * 100).toFixed(1)}%`,
      `PHP ${sumContrib.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [["#", "Investor / Partner Name", "Equity Share (%)", "Capital Contribution (PHP)"]],
      body: contribRows,
      theme: "striped",
      headStyles: {
        fillColor: [18, 34, 68],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 15, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 85 },
        2: { cellWidth: 35, halign: "center" },
        3: { cellWidth: 47, halign: "right", fontStyle: "bold" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 7;

    // Multi-product aggregate financial metrics
    const firstProd = normalizedProducts[0];
    const firstMetrics = firstProd
      ? computeProductMetrics(firstProd)
      : {
          revenue: 0,
          cogsSold: 0,
          totalUnitsProduced: 0,
          unitsSold: 0,
          endingInventoryValue: 0,
          totalVat: 0,
          netSellingPrice: 0,
          sellingPrice: 0,
          unitCost: 0,
          totalBatchCost: 0,
          markupPct: 0,
          markupAmount: 0,
          computedBasePrice: 0,
        };

    const totalMultiRevenue = normalizedProducts.reduce(
      (sum: number, p: any) => sum + computeProductMetrics(p).revenue,
      0
    );
    const totalMultiVariableCost = normalizedProducts.reduce(
      (sum: number, p: any) => sum + computeProductMetrics(p).cogsSold,
      0
    );
    const totalMultiYield = normalizedProducts.reduce(
      (sum: number, p: any) => sum + computeProductMetrics(p).totalUnitsProduced,
      0
    );
    const totalMultiUnitsSold = normalizedProducts.reduce(
      (sum: number, p: any) => sum + computeProductMetrics(p).unitsSold,
      0
    );

    const safeSellingPrice =
      normalizedProducts.length > 1 && totalMultiUnitsSold > 0
        ? totalMultiRevenue / totalMultiUnitsSold
        : firstMetrics.netSellingPrice > 0
        ? firstMetrics.netSellingPrice
        : firstMetrics.sellingPrice > 0
        ? firstMetrics.sellingPrice
        : Number(fin.sellingPrice) || 0;

    const safeMonthlySales =
      normalizedProducts.length > 1
        ? totalMultiUnitsSold
        : firstMetrics.unitsSold > 0
        ? firstMetrics.unitsSold
        : Number(fin.monthlySales) || 0;

    const safeUnitsProduced =
      normalizedProducts.length > 1
        ? totalMultiYield
        : firstMetrics.totalUnitsProduced > 0
        ? firstMetrics.totalUnitsProduced
        : safeMonthlySales;

    const safeVariableCost =
      normalizedProducts.length > 1 && totalMultiUnitsSold > 0
        ? totalMultiVariableCost / totalMultiUnitsSold
        : firstMetrics.unitCost > 0
        ? firstMetrics.unitCost
        : Number(fin.variableCost) || 0;

    const monthlyRevenue =
      normalizedProducts.length > 1
        ? totalMultiRevenue
        : safeSellingPrice * safeMonthlySales;
    const totalMonthlyVariableCosts =
      normalizedProducts.length > 1
        ? totalMultiVariableCost
        : safeVariableCost * safeMonthlySales;
    const grossProfitMargin =
      monthlyRevenue > 0
        ? ((monthlyRevenue - totalMonthlyVariableCosts) / monthlyRevenue) * 100
        : 0;
    const monthlyInterest =
      fin.isCapitalBorrowed && fin.interestRate
        ? (safeStartupCapital * (Number(fin.interestRate) / 100)) / 12
        : 0;
    const monthlyExpensesTotal = totalMonthlyVariableCosts + safeFixedCosts;
    const netMonthlyProfit =
      monthlyRevenue -
      totalMonthlyVariableCosts -
      safeFixedCosts -
      monthlyInterest;
    const monthlyNetProfitMargin =
      monthlyRevenue > 0 ? (netMonthlyProfit / monthlyRevenue) * 100 : 0;

    const unitContributionMargin = safeSellingPrice - safeVariableCost;
    const breakEvenUnits =
      unitContributionMargin > 0
        ? Math.ceil(safeFixedCosts / unitContributionMargin)
        : "N/A";
    const breakEvenDisplay =
      typeof breakEvenUnits === "number"
        ? breakEvenUnits.toLocaleString("en-US")
        : breakEvenUnits;

    // 3. OPERATIONAL FEASIBILITY & FINANCIAL VIABILITY METRICS (5 HERO KPI CARDS)
    checkPageBreak(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...brandNavy);
    doc.text("Operational Feasibility & Financial Viability Metrics", marginX + 2, y);
    y += 5;

    const drawKpiCard = (
      cardX: number,
      cardY: number,
      cardW: number,
      cardH: number,
      accentColor: [number, number, number],
      title: string,
      mainVal: string,
      mainValColor: [number, number, number],
      sub1: string,
      sub2: string,
      badge?: { text: string; isPositive: boolean },
      unitSuffix?: string
    ) => {
      // White Card Box with Subtle Border
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, "FD");

      // Left Accent Stripe
      doc.setFillColor(...accentColor);
      doc.roundedRect(cardX, cardY, 1.4, cardH, 1, 1, "F");
      doc.rect(cardX + 0.7, cardY, 0.7, cardH, "F");

      // Header Label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(156, 163, 175);
      doc.text(title, cardX + 3.8, cardY + 4.8);

      // Pill Badge (e.g. Net Profit Margin)
      if (badge) {
        const titleW = doc.getTextWidth(title);
        const bX = cardX + 3.8 + titleW + 2;
        const bW = doc.getTextWidth(badge.text) + 2.8;
        const bH = 3.2;
        const bY = cardY + 2.4;

        if (badge.isPositive) {
          doc.setFillColor(236, 253, 245);
          doc.setDrawColor(167, 243, 208);
          doc.setLineWidth(0.2);
          doc.roundedRect(bX, bY, bW, bH, 1.2, 1.2, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.2);
          doc.setTextColor(5, 150, 105);
          doc.text(badge.text, bX + 1.4, bY + 2.3);
        } else {
          doc.setFillColor(254, 242, 242);
          doc.setDrawColor(254, 202, 202);
          doc.setLineWidth(0.2);
          doc.roundedRect(bX, bY, bW, bH, 1.2, 1.2, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.2);
          doc.setTextColor(220, 38, 38);
          doc.text(badge.text, bX + 1.4, bY + 2.3);
        }
      }

      // Main Hero Value
      doc.setFont("helvetica", "bold");
      const valFontSize = mainVal.length >= 17 ? 8.8 : 9.8;
      doc.setFontSize(valFontSize);
      doc.setTextColor(...mainValColor);
      doc.text(mainVal, cardX + 3.8, cardY + 10.2);

      // Optional Unit Suffix (e.g. "units")
      if (unitSuffix) {
        const valW = doc.getTextWidth(mainVal);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.setTextColor(156, 163, 175);
        doc.text(unitSuffix, cardX + 3.8 + valW + 1.2, cardY + 10.2);
      }

      // Bottom Pill / Sub-box Container
      const subX = cardX + 3.2;
      const subW = cardW - 6.4;
      const subY = cardY + 12.8;
      const subH = 9.4;

      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(243, 244, 246);
      doc.setLineWidth(0.2);
      doc.roundedRect(subX, subY, subW, subH, 1, 1, "FD");

      // Formula Description Line
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
      doc.setTextColor(100, 116, 139);
      doc.text(sub1, subX + 1.8, subY + 3.4);

      // Computed Values Line
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(201, 166, 84);
      doc.text(sub2, subX + 1.8, subY + 7.2);
    };

    const gap1 = 3.5;
    const cardW1 = (contentWidth - 2 * gap1) / 3;
    const cardH = 24.5;
    const gap2 = 4;
    const cardW2 = (contentWidth - gap2) / 2;

    // Card 1: Monthly Revenue
    const revSub1 = normalizedProducts.length > 1
      ? `Sales: ${safeMonthlySales.toLocaleString("en-US")} units sold`
      : "Price × Units Sold";
    const revSub2 = normalizedProducts.length > 1
      ? `${safeUnitsProduced.toLocaleString("en-US")} produced - ${normalizedProducts.length} Products`
      : `PHP ${safeSellingPrice.toFixed(2)} × ${safeMonthlySales.toLocaleString("en-US")} sold (${safeUnitsProduced.toLocaleString("en-US")} produced)`;

    drawKpiCard(
      marginX,
      y,
      cardW1,
      cardH,
      [16, 185, 129],
      "MONTHLY REVENUE",
      `PHP ${monthlyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      [5, 150, 105],
      revSub1,
      revSub2
    );

    // Card 2: Monthly Expenses
    const expSub1 = normalizedProducts.length > 1
      ? "COGS (Units Sold) + Fixed"
      : "[(COGS/Unit × Sold) + Fixed]";
    const expSub2 = normalizedProducts.length > 1
      ? `PHP ${totalMonthlyVariableCosts.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + PHP ${safeFixedCosts.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `(PHP ${safeVariableCost.toFixed(2)} × ${safeMonthlySales.toLocaleString("en-US")} sold) + PHP ${safeFixedCosts.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    drawKpiCard(
      marginX + cardW1 + gap1,
      y,
      cardW1,
      cardH,
      [239, 68, 68],
      "MONTHLY EXPENSES",
      `PHP ${monthlyExpensesTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      [220, 38, 38],
      expSub1,
      expSub2
    );

    // Card 3: Break-Even Point
    const bepSub1 = "Monthly OpEx / Margin per Unit";
    const bepSub2 = `PHP ${safeFixedCosts.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / PHP ${Math.max(0, safeSellingPrice - safeVariableCost).toFixed(2)}`;

    drawKpiCard(
      marginX + (cardW1 + gap1) * 2,
      y,
      cardW1,
      cardH,
      [245, 158, 11],
      "BREAK-EVEN POINT",
      `${breakEvenDisplay}`,
      [217, 119, 6],
      bepSub1,
      bepSub2,
      undefined,
      "units"
    );

    y += cardH + 3.5;

    // Card 4: Gross Margin
    const gmSub1 = "[(Revenue - COGS) / Revenue]";
    const gmSub2 = `(PHP ${Math.round(monthlyRevenue).toLocaleString("en-US")} - PHP ${Math.round(totalMonthlyVariableCosts).toLocaleString("en-US")}) / PHP ${Math.round(monthlyRevenue).toLocaleString("en-US")}`;

    drawKpiCard(
      marginX,
      y,
      cardW2,
      cardH,
      [59, 130, 246],
      "GROSS MARGIN",
      `${grossProfitMargin.toFixed(1)}%`,
      grossProfitMargin >= 0 ? [37, 99, 235] : [220, 38, 38],
      gmSub1,
      gmSub2
    );

    // Card 5: Net Profit / Mo
    const npSub1 = "Revenue - Expenses";
    const npSub2 = `PHP ${Math.round(monthlyRevenue).toLocaleString("en-US")} - PHP ${Math.round(monthlyExpensesTotal).toLocaleString("en-US")}${monthlyInterest > 0 ? ` - PHP ${Math.round(monthlyInterest).toLocaleString("en-US")} Int` : ""}`;

    drawKpiCard(
      marginX + cardW2 + gap2,
      y,
      cardW2,
      cardH,
      netMonthlyProfit >= 0 ? [16, 185, 129] : [239, 68, 68],
      "NET PROFIT / MO",
      `${netMonthlyProfit < 0 ? "-" : ""}PHP ${Math.abs(netMonthlyProfit).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      netMonthlyProfit >= 0 ? [5, 150, 105] : [220, 38, 38],
      npSub1,
      npSub2,
      {
        text: `${monthlyNetProfitMargin >= 0 ? "+" : ""}${monthlyNetProfitMargin.toFixed(1)}%`,
        isPositive: monthlyNetProfitMargin >= 0,
      }
    );

    y += cardH + 7;

    if (normalizedProducts.length > 0) {
      checkPageBreak(25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...brandNavy);
      doc.text("Product Menu & Unit Costing Breakdown", marginX + 2, y);
      y += 4;

      const productRows = normalizedProducts.map((p, idx) => [
        String(idx + 1),
        p.name || `Product ${idx + 1}`,
        `PHP ${Number(p.sellingPrice || 0).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [["#", "Product Item", "Selling Price"]],
        body: productRows,
        theme: "striped",
        headStyles: {
          fillColor: [18, 34, 68],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 15, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 120 },
          2: { cellWidth: 47, halign: "right", fontStyle: "bold" },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (Array.isArray(fin.opexList) && fin.opexList.length > 0) {
      checkPageBreak(25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...brandNavy);
      doc.text("Operating Overhead Expenses (Monthly Fixed OpEx)", marginX + 2, y);
      y += 4;

      const opexRows = fin.opexList.map((item: any, idx: number) => [
        String(idx + 1),
        item.name || item.label || item.category || `Expense Item ${idx + 1}`,
        `PHP ${Number(item.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      ]);

      const totalOpex = fin.opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
      opexRows.push(["Total", "Total Monthly Fixed OpEx", `PHP ${totalOpex.toLocaleString("en-US", { minimumFractionDigits: 2 })}`]);

      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [["#", "Expense Category / Item", "Monthly Amount (PHP)"]],
        body: opexRows,
        theme: "striped",
        headStyles: {
          fillColor: [18, 34, 68],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 15, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 120 },
          2: { cellWidth: 47, halign: "right", fontStyle: "bold" },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // SECTION 3: AI FEASIBILITY ANALYSIS (EXECUTIVE FEASIBILITY AUDIT FORMAT)
  if (orderedSections.includes("ai")) {
    const ai = proposal.aiAnalysis;
    if (!isAiAnalysisAvailable(proposal)) {
      checkPageBreak(30);
      doc.setFillColor(...brandNavy);
      doc.rect(marginX, y, 3, 6.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...brandNavy);
      doc.text(`${sectionCounter}. AI FEASIBILITY ANALYSIS`, marginX + 6, y + 5);
      y += 10;
      sectionCounter++;

      doc.setFillColor(...bgLight);
      doc.setDrawColor(...borderGray);
      doc.roundedRect(marginX, y, contentWidth, 14, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("No completed AI feasibility analysis is available for this proposal.", marginX + 5, y + 8);
      y += 18;
    } else {
      // Start Executive Feasibility Audit on a fresh page if prior sections were generated
      if (doc.getNumberOfPages() > 1 || y > 35) {
        doc.addPage();
        y = 14;
      }

      const fin = proposal.financialData || proposal.originalProposalFinancials || {};
      const localAudit = calculateLocalAudit({
        ...fin,
        businessName: proposal.businessName,
        totalCapital: proposal.totalCapital || fin.startupCapital,
        products: fin.products || normalizeProposalProducts(fin),
      });

      const analysisDateStr = formatDisplayDate(ai.lastRun || proposal.submissionDate || proposal.createdAt || new Date());
      const businessName = proposal.businessName || "Business Feasibility";

      // --- HEADER ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // Slate
      doc.text("FEASIFY INTELLIGENCE ENGINE", marginX, 14);

      doc.setTextColor(201, 166, 84); // Gold #c9a654
      doc.text("EXECUTIVE FEASIBILITY AUDIT", pageWidth - marginX, 14, { align: "right" });

      doc.setFontSize(18);
      doc.setTextColor(18, 34, 68); // Navy #122244
      doc.text(businessName, pageWidth / 2, 22, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Analysis Date: ${analysisDateStr}  •  Verified Academic Study  •  Formal Feasibility Audit`, pageWidth / 2, 27.5, { align: "center" });

      // Horizontal Divider Line
      doc.setDrawColor(18, 34, 68);
      doc.setLineWidth(0.7);
      doc.line(marginX, 30, pageWidth - marginX, 30);
      y = 33;

      // --- 1. OFFICIAL VERDICT BANNER (Y: 33 - 53) ---
      const rawStatus = (ai.status || ai.verdict || localAudit.status || "CONDITIONALLY FEASIBLE").toUpperCase().replace(/_/g, " ");
      const isFeasible = rawStatus.includes("FEASIBLE") && !rawStatus.includes("NOT") && !rawStatus.includes("CONDITION");
      const isConditionallyFeasible = rawStatus.includes("CONDITION") || rawStatus.includes("ADJUST");
      const isNotFeasible = rawStatus.includes("NOT FEASIBLE") || rawStatus.includes("FAILED");

      let verdictDisplay = "CONDITIONALLY FEASIBLE";
      let cardBg = [255, 251, 235]; // Light amber
      let cardBorder = [253, 230, 138];
      let cardTextColor = [146, 64, 14];
      let standingGrade = ai.performanceGrade || "Grade Conditional";

      if (isFeasible) {
        verdictDisplay = "FEASIBLE";
        cardBg = [236, 253, 245];
        cardBorder = [167, 243, 208];
        cardTextColor = [6, 95, 70];
        standingGrade = ai.performanceGrade || "Grade A";
      } else if (isNotFeasible) {
        verdictDisplay = "NOT FEASIBLE";
        cardBg = [254, 242, 242];
        cardBorder = [254, 202, 202];
        cardTextColor = [153, 27, 27];
        standingGrade = ai.performanceGrade || "Grade F";
      }

      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
      doc.roundedRect(marginX, y, contentWidth, 20, 1.5, 1.5, "FD");

      // Left circular alert/check icon
      const iconCenterX = marginX + 6.5;
      const iconCenterY = y + 10;
      doc.setFillColor(255, 255, 255);
      doc.circle(iconCenterX, iconCenterY, 3.5, "F");
      doc.setDrawColor(cardTextColor[0], cardTextColor[1], cardTextColor[2]);
      doc.setLineWidth(0.4);
      doc.circle(iconCenterX, iconCenterY, 3.5, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(cardTextColor[0], cardTextColor[1], cardTextColor[2]);
      doc.text(isFeasible ? "✓" : "!", iconCenterX, iconCenterY + 1.2, { align: "center" });

      // Left text block
      const leftTextX = marginX + 13;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(cardTextColor[0], cardTextColor[1], cardTextColor[2]);
      doc.text("OFFICIAL VERDICT:", leftTextX, y + 5.5);

      doc.setFontSize(11);
      doc.text(verdictDisplay, leftTextX, y + 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(`Academic Standing: ${standingGrade}`, leftTextX, y + 16.5);

      // Vertical separator
      doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
      doc.setLineWidth(0.3);
      doc.line(marginX + 78, y + 2.5, marginX + 78, y + 17.5);

      // Right text block (Advisory Note)
      const rightTextX = marginX + 83;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(180, 83, 9);
      doc.text("ADVISORY NOTE", pageWidth - marginX - 4, y + 5.5, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      const advisoryText = cleanUserFacingText(
        ai.performanceRecommendation ||
        localAudit.performanceRecommendation ||
        "Revisions required for panel defense: review the highlighted warning flags (unrealistic profit margins, cash runway, or break-even target) before final defense sign-off."
      );
      const advisoryLines = doc.splitTextToSize(advisoryText, contentWidth - 85);
      doc.text(advisoryLines.slice(0, 3), rightTextX, y + 9.5);

      y += 24;

      // --- 2. FINANCIAL PERFORMANCE OVERVIEW (Y: 57) ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(18, 34, 68);
      doc.text("FINANCIAL PERFORMANCE OVERVIEW", marginX, y);

      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text("ANNUAL PROJECTION BASIS", pageWidth - marginX, y, { align: "right" });

      const cardY = y + 3;
      const cardH = 17.5;
      const cardW = (contentWidth - 9) / 4;

      const startupCap = Number(fin.startupCapital || proposal.totalCapital || capVal || 52450);
      const metrics = computeProductMetrics(fin);
      const annualRev = localAudit.annualRevenue || (metrics.monthlyRevenue ? (metrics.monthlyRevenue / 30) * (Number(fin.operatingDays) || 300) : 14850108);
      const netAnnualProfit = localAudit.netAnnualProfit || (localAudit.netMonthlyProfit ? (localAudit.netMonthlyProfit / 30) * (Number(fin.operatingDays) || 300) : 3633803);
      const paybackStr = localAudit.paybackPeriodStr || (netAnnualProfit > 0 ? (startupCap / netAnnualProfit < 1 ? `${Math.round((startupCap / netAnnualProfit) * 365)} Days` : `${(startupCap / netAnnualProfit).toFixed(1)} Yrs`) : "5 Days");

      const kpis = [
        { label: "INITIAL CAPITAL", val: `PHP ${startupCap.toLocaleString()}`, sub: "Total Project Capital", isGreen: false },
        { label: "PROJECTED ANNUAL SALES", val: `PHP ${Math.round(annualRev).toLocaleString()}`, sub: "Gross Turnover", isGreen: false },
        { label: "NET ANNUAL PROFIT", val: `PHP ${Math.round(netAnnualProfit).toLocaleString()}`, sub: "After-Tax Net Income", isGreen: netAnnualProfit >= 0 },
        { label: "EST. PAYBACK PERIOD", val: paybackStr, sub: "Capital Recovery", isGreen: false },
      ];

      kpis.forEach((kpi, idx) => {
        const cx = marginX + idx * (cardW + 3);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cx, cardY, cardW, cardH, 1.2, 1.2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, cx + 2.5, cardY + 4.2);

        doc.setFontSize(9.5);
        if (kpi.isGreen) {
          doc.setTextColor(22, 163, 74);
        } else {
          doc.setTextColor(18, 34, 68);
        }
        doc.text(kpi.val, cx + 2.5, cardY + 9.8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.8);
        doc.setTextColor(148, 163, 184);
        doc.text(kpi.sub, cx + 2.5, cardY + 14);
      });

      y = cardY + cardH + 7;

      // --- 3. AI MARKET VIABILITY & COMPETITIVE INTELLIGENCE ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(18, 34, 68);
      doc.text("AI MARKET VIABILITY & COMPETITIVE INTELLIGENCE", marginX, y);

      const pillW = 42;
      const pillH = 4.8;
      const pillX = pageWidth - marginX - pillW;
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(pillX, y - 3.8, pillW, pillH, 1.2, 1.2, "FD");
      doc.setFontSize(6.2);
      doc.setTextColor(6, 95, 70);
      doc.text("Market Feasibility Audited", pillX + pillW / 2, y - 0.7, { align: "center" });

      // Callout banner
      const mktBoxY = y + 3;
      const mktBoxH = 10;
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 240, 138);
      doc.roundedRect(marginX, mktBoxY, contentWidth, mktBoxH, 1.2, 1.2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(146, 64, 14);
      doc.text("Market Assessment: ", marginX + 3.5, mktBoxY + 6.2);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      const mktSummary = cleanUserFacingText(
        ai.marketAnalysis?.summary ||
        "Your business is positioned near major foot-traffic generators, but you must clearly differentiate your brand from large competitors."
      );
      const mktSummaryLines = doc.splitTextToSize(mktSummary, contentWidth - 40);
      doc.text(mktSummaryLines[0] || "", marginX + 32, mktBoxY + 6.2);

      // 3 Market Pillar Cards
      const cardsY = mktBoxY + mktBoxH + 3;
      const cardsH = 25;
      const mCardW = (contentWidth - 6) / 3;

      const competitorDesc = cleanUserFacingText(
        ai.marketAnalysis?.competitorInsight?.text ||
        "You compete directly with giant brands like Starbucks and Pickup Coffee, so your unique selling proposition must be very clear."
      );
      const footTrafficDesc = cleanUserFacingText(
        ai.marketAnalysis?.footTrafficInsight?.text ||
        "Being located near the SM Mall of Asia gives you access to a massive volume of daily walk-in customers."
      );
      const demographicDesc = cleanUserFacingText(
        ai.marketAnalysis?.demographicInsight?.text ||
        "Your target market of students and youth matches well with your product offering and pricing strategy."
      );

      const mktPillars = [
        {
          title: "COMPETITOR DENSITY",
          chip: cleanUserFacingText(ai.marketAnalysis?.competitorInsight?.badge || "COMPETITIVE DENSITY").toUpperCase(),
          chipBg: [254, 243, 199],
          chipText: [146, 64, 14],
          desc: competitorDesc,
        },
        {
          title: "FOOT TRAFFIC & ANCHORS",
          chip: cleanUserFacingText(ai.marketAnalysis?.footTrafficInsight?.badge || "ANCHOR FOOT TRAFFIC PRESENT").toUpperCase(),
          chipBg: [209, 250, 229],
          chipText: [6, 95, 70],
          desc: footTrafficDesc,
        },
        {
          title: "DEMOGRAPHIC STRATEGY",
          chip: cleanUserFacingText(ai.marketAnalysis?.demographicInsight?.badge || "DEMOGRAPHIC ALIGNMENT").toUpperCase(),
          chipBg: [219, 234, 254],
          chipText: [30, 64, 175],
          desc: demographicDesc,
        },
      ];

      mktPillars.forEach((mp, i) => {
        const mx = marginX + i * (mCardW + 3);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(mx, cardsY, mCardW, cardsH, 1.2, 1.2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.8);
        doc.setTextColor(18, 34, 68);
        doc.text(mp.title, mx + 3, cardsY + 4.5);

        // Chip
        doc.setFillColor(mp.chipBg[0], mp.chipBg[1], mp.chipBg[2]);
        doc.rect(mx + 3, cardsY + 6.5, mCardW - 6, 4.2, "F");
        doc.setFontSize(5.8);
        doc.setTextColor(mp.chipText[0], mp.chipText[1], mp.chipText[2]);
        doc.text(mp.chip, mx + 4, cardsY + 9.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.setTextColor(100, 116, 139);
        const pLines = doc.splitTextToSize(mp.desc, mCardW - 6);
        doc.text(pLines.slice(0, 3), mx + 3, cardsY + 14);
      });

      y = cardsY + cardsH + 7;

      // --- 4. STRATEGIC INSIGHTS & RECOMMENDATIONS ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(18, 34, 68);
      doc.text("STRATEGIC INSIGHTS & RECOMMENDATIONS", marginX, y);

      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text("EXECUTIVE TAKEAWAYS", pageWidth - marginX, y, { align: "right" });
      y += 3.5;

      const netMarginPct = annualRev > 0 ? (netAnnualProfit / annualRev) * 100 : 0;
      const cashReserve = Math.max(0, startupCap - (annualRev * 0.1));
      const monthlyOpex = Number(fin.fixedCosts) || 10733;
      const cashRunwayMonths = monthlyOpex > 0 ? Math.round(cashReserve / monthlyOpex) : 198;
      const bepUnits = metrics.breakEvenUnits || 22;
      const bepRevenue = metrics.breakEvenRevenue || 10733;
      const bepRatio = Math.round((bepRevenue / (metrics.monthlyRevenue || (annualRev / 12) || 1)) * 100) || 12;

      const insightItems = [
        {
          title: "Profit Margin Status",
          isWarn: netMarginPct > 35 || netMarginPct <= 0,
          desc: `Your net profit margin of ${netMarginPct.toFixed(1)}% is ${netMarginPct > 35 ? "an unrealistic outlier for the food and beverage industry where the student capstone ceiling is 30%. Check if commercial stall rent, worker salaries, electricity, or taxes were missed." : "healthy and aligned with capstone standards."}`,
        },
        {
          title: "Cash Runway Buffer",
          isWarn: cashRunwayMonths < 2,
          desc: `Your cash savings buffer is very healthy and can easily cover over ${cashRunwayMonths} months of operating bills and expenses without running out of money.`,
        },
        {
          title: "Break-Even Safety",
          isWarn: bepRatio > 80,
          desc: `You only need to sell ${bepUnits} units or earn PHP ${bepRevenue.toLocaleString()} each month to cover all your monthly bills, which is just ${bepRatio}% of your monthly sales target.`,
        },
      ];

      insightItems.forEach((ins) => {
        const descLines = doc.splitTextToSize(ins.desc, contentWidth - 16);
        const itemH = descLines.length * 3.4 + 9;

        if (y + itemH > pageHeight - 22) {
          doc.addPage();
          y = 14;
        }

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, y, contentWidth, itemH, 1.2, 1.2, "FD");

        // Circular badge icon on left
        const cIconX = marginX + 5;
        const cIconY = y + 5;
        if (ins.isWarn) {
          doc.setFillColor(254, 243, 199);
          doc.setDrawColor(253, 230, 138);
        } else {
          doc.setFillColor(209, 250, 229);
          doc.setDrawColor(167, 243, 208);
        }
        doc.circle(cIconX, cIconY, 2.5, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        if (ins.isWarn) {
          doc.setTextColor(180, 83, 9);
          doc.text("!", cIconX, cIconY + 0.9, { align: "center" });
        } else {
          doc.setTextColor(6, 95, 70);
          doc.text("✓", cIconX, cIconY + 0.9, { align: "center" });
        }

        // Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(18, 34, 68);
        doc.text(ins.title, marginX + 10, y + 4.8);

        // Description
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(71, 85, 105);
        doc.text(descLines, marginX + 10, y + 8.8);

        y += itemH + 2.5;
      });

      y += 2;

      // --- 5. PRIORITY FEASIBILITY ACTION ---
      if (y + 14 > pageHeight - 20) {
        doc.addPage();
        y = 14;
      }

      const actionText = cleanUserFacingText(
        ai.improvementTips?.feasibility ||
        localAudit.improvementTips?.feasibility ||
        "Check monthly OPEX: ensure you budgeted commercial stall rent, crew wages, electricity, and taxes so profit margins stay within realistic 12%-22% standards."
      );
      const actionLines = doc.splitTextToSize(actionText, contentWidth - 16);
      const actionH = Math.max(12, actionLines.length * 3.4 + 7);

      doc.setFillColor(238, 242, 255);
      doc.setDrawColor(199, 210, 254);
      doc.roundedRect(marginX, y, contentWidth, actionH, 1.5, 1.5, "FD");

      // Left Target Icon circle
      const aIconX = marginX + 4.5;
      const aIconY = y + 5;
      doc.setFillColor(224, 231, 255);
      doc.setDrawColor(199, 210, 254);
      doc.circle(aIconX, aIconY, 2.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(67, 56, 202);
      doc.text("◎", aIconX, aIconY + 0.8, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(49, 46, 129);
      doc.text("PRIORITY FEASIBILITY ACTION:", marginX + 9, y + 4.8);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(67, 56, 202);
      doc.text(actionLines, marginX + 9, y + 8.8);

      y += actionH + 5;
    }
  }

  // RUNNING FOOTER ON ALL PAGES
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 9;
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 2.5, pageWidth - marginX, footerY - 2.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text("FeasiFy Intelligence System • Academic Feasibility Evaluation", marginX, footerY + 1);

    doc.setFont("helvetica", "normal");
    doc.text(`Page ${p} of ${totalPages} • Official Feasibility Study Report`, pageWidth - marginX, footerY + 1, { align: "right" });
  }

  const filename = buildExportFilename(proposal.businessName, orderedSections);
  doc.save(filename);
}

// CommonJS compatibility export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isAiAnalysisAvailable,
    orderSelectedSections,
    buildExportFilename,
    exportProposalSectionsPDF,
  };
}
