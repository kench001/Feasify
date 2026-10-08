import { jsPDF } from "jspdf";

export interface ExportProposalAnalysisOptions {
  proposal: {
    id?: string;
    proposalNumber?: number;
    businessName?: string;
    businessType?: string;
    targetMarket?: string;
    tagline?: string;
    totalCapital?: string | number;
    status?: string;
    submittedAt?: any;
    adviserRemarks?: string;
    adviserFeedback?: string;
    feedbackHistory?: Array<{
      id: string;
      text: string;
      authorName: string;
      role: string;
      date: string;
    }>;
  };
  aiResult?: {
    overallScore?: number;
    verdict?: string;
    strengths?: any[];
    weaknesses?: any[];
    realityCheck?: string;
    recommendations?: any[];
    draftFeedback?: string;
    _fallback?: boolean;
  } | null;
  currentRemarks?: string;
  adviserName?: string;
  groupTitle?: string;
  sectionCode?: string;
}

/**
 * Generates and downloads a high-quality, professional FeasiFy-branded PDF report
 * containing the proposal overview, official adviser remarks, and the full AI Feasibility Analysis.
 */
export async function exportProposalAnalysisPDF(options: ExportProposalAnalysisOptions): Promise<void> {
  const { proposal, aiResult, currentRemarks, adviserName, groupTitle, sectionCode } = options;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  let y = 14;

  const brandNavy = [18, 34, 68] as const;       // #122244
  const brandGold = [201, 166, 84] as const;     // #c9a654
  const textDark = [30, 41, 59] as const;        // #1e293b
  const textMuted = [100, 116, 139] as const;    // #64748b
  const borderGray = [226, 232, 240] as const;   // #e2e8f0
  const bgLight = [248, 250, 252] as const;      // #f8fafc
  const greenText = [16, 149, 106] as const;     // #10956a
  const amberText = [180, 83, 9] as const;       // #b45309
  const redText = [185, 28, 28] as const;        // #b91c1c

  const formatTextItem = (item: any): string => {
    if (!item) return "";
    if (typeof item === "string") return item.trim();
    if (item.title && item.description) return `${item.title.trim()}: ${item.description.trim()}`;
    return (item.description || item.title || "").trim();
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
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
    doc.text("FEASIFY ACADEMIC PLATFORM", marginX + 3, y + 5.2);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...brandGold);
    doc.text(
      (proposal.businessName || "Feasibility Proposal").substring(0, 45),
      pageWidth - marginX - 3,
      y + 5.2,
      { align: "right" }
    );
    y += 12;
  };

  // =========================================================================
  // 1. MAIN COVER HEADER (First Page)
  // =========================================================================
  doc.setFillColor(...brandNavy);
  doc.roundedRect(marginX, y, contentWidth, 26, 2, 2, "F");

  // Gold accent bottom line
  doc.setFillColor(...brandGold);
  doc.rect(marginX, y + 25, contentWidth, 1, "F");

  // FeasiFy Brand Logo Text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...brandGold);
  doc.text("FeasiFy", marginX + 5, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("PROPOSAL EVALUATION & AI FEASIBILITY REPORT", marginX + 32, y + 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    "Automated Qualitative Feasibility Intelligence & Faculty Advisory Assessment",
    marginX + 5,
    y + 16.5
  );

  const reportDateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Generated: ${reportDateStr}`, pageWidth - marginX - 5, y + 16.5, { align: "right" });
  y += 31;

  // =========================================================================
  // 2. PROPOSAL SUMMARY INFO CARD
  // =========================================================================
  const cardStartY = y;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentWidth, 36, 2, 2, "FD");

  // Business Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...brandNavy);
  const busName = (proposal.businessName || `Business Proposal #${proposal.proposalNumber || 1}`).trim();
  doc.text(busName, marginX + 5, y + 8);

  // Status Badge
  const statusStr = (proposal.status || "Pending Review").toUpperCase();
  let badgeBg: readonly [number, number, number] = [219, 234, 254];
  let badgeText: readonly [number, number, number] = [30, 64, 175];
  if (statusStr.includes("APPROV")) {
    badgeBg = [220, 252, 231];
    badgeText = [22, 101, 52];
  } else if (statusStr.includes("REVIS")) {
    badgeBg = [254, 243, 199];
    badgeText = [146, 64, 14];
  } else if (statusStr.includes("REJECT")) {
    badgeBg = [254, 226, 226];
    badgeText = [153, 27, 27];
  }

  const badgeWidth = doc.getTextWidth(statusStr) + 6;
  doc.setFillColor(...badgeBg);
  doc.roundedRect(pageWidth - marginX - badgeWidth - 5, y + 3.5, badgeWidth, 6, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...badgeText);
  doc.text(statusStr, pageWidth - marginX - 5 - badgeWidth / 2, y + 7.7, { align: "center" });

  // Metadata Grid
  const metaY = y + 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text("INDUSTRY / SECTOR", marginX + 5, metaY);
  doc.text("CAPITAL REQUIREMENT", marginX + 50, metaY);
  doc.text("ACADEMIC SECTION", marginX + 100, metaY);
  doc.text("GROUP / PROPONENTS", marginX + 142, metaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  doc.text(proposal.businessType || "General Business", marginX + 5, metaY + 5);
  doc.text(
    proposal.totalCapital ? `PHP ${Number(proposal.totalCapital).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "PHP 0.00",
    marginX + 50,
    metaY + 5
  );
  doc.text(sectionCode || "Unassigned", marginX + 100, metaY + 5);
  doc.text(groupTitle || "Group Proponents", marginX + 142, metaY + 5);

  // Tagline or Target Market
  if (proposal.tagline || proposal.targetMarket) {
    const subtitle = proposal.tagline
      ? `"${proposal.tagline}"`
      : `Target Market: ${proposal.targetMarket}`;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    const subLines = doc.splitTextToSize(subtitle, contentWidth - 10);
    doc.text(subLines[0], marginX + 5, metaY + 12);
  }

  y = cardStartY + 41;

  // =========================================================================
  // 3. AI FEASIBILITY QUALITATIVE ANALYSIS
  // =========================================================================
  checkPageBreak(25);

  doc.setFillColor(...brandNavy);
  doc.rect(marginX, y, 3, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...brandNavy);
  doc.text("1. AI QUALITATIVE FEASIBILITY ASSESSMENT", marginX + 6, y + 5);
  y += 10;

  if (!aiResult) {
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderGray);
    doc.roundedRect(marginX, y, contentWidth, 14, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...textMuted);
    doc.text(
      "No AI Feasibility Analysis has been generated yet for this proposal.",
      marginX + 6,
      y + 8.5
    );
    y += 20;
  } else {
    // Key Strengths Box
    if (aiResult.strengths && aiResult.strengths.length > 0) {
      checkPageBreak(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...greenText);
      doc.text("KEY FEASIBILITY STRENGTHS & COMPETITIVE ADVANTAGES", marginX + 2, y);
      y += 4.5;

      for (let i = 0; i < aiResult.strengths.length; i++) {
        const textStr = formatTextItem(aiResult.strengths[i]);
        if (!textStr) continue;
        const lines = doc.splitTextToSize(textStr, contentWidth - 14);
        const itemHeight = lines.length * 4 + 4;
        checkPageBreak(itemHeight);

        doc.setFillColor(240, 253, 244); // green-50
        doc.setDrawColor(187, 247, 208); // green-200
        doc.roundedRect(marginX, y, contentWidth, itemHeight, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...greenText);
        doc.text("[+]", marginX + 3.5, y + 4.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(20, 83, 45); // green-900
        doc.text(lines, marginX + 10, y + 4.5);

        y += itemHeight + 2;
      }
      y += 4;
    }

    // Areas of Concern (Weaknesses)
    if (aiResult.weaknesses && aiResult.weaknesses.length > 0) {
      checkPageBreak(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...amberText);
      doc.text("AREAS OF CONCERN & OPERATIONAL / FINANCIAL RISKS", marginX + 2, y);
      y += 4.5;

      for (let i = 0; i < aiResult.weaknesses.length; i++) {
        const textStr = formatTextItem(aiResult.weaknesses[i]);
        if (!textStr) continue;
        const lines = doc.splitTextToSize(textStr, contentWidth - 14);
        const itemHeight = lines.length * 4 + 4;
        checkPageBreak(itemHeight);

        doc.setFillColor(254, 251, 235); // amber-50
        doc.setDrawColor(253, 230, 138); // amber-200
        doc.roundedRect(marginX, y, contentWidth, itemHeight, 1, 1, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...amberText);
        doc.text("[!]", marginX + 3.5, y + 4.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(120, 53, 15); // amber-900
        doc.text(lines, marginX + 10, y + 4.5);

        y += itemHeight + 2;
      }
      y += 4;
    }

    // Reality Check (Callout Box)
    if (aiResult.realityCheck) {
      checkPageBreak(22);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...redText);
      doc.text("MARKET REALITY CHECK", marginX + 2, y);
      y += 4.5;

      const rcLines = doc.splitTextToSize(`"${aiResult.realityCheck.trim()}"`, contentWidth - 14);
      const rcHeight = rcLines.length * 4 + 7;
      checkPageBreak(rcHeight);

      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(254, 202, 202); // red-200
      doc.roundedRect(marginX, y, contentWidth, rcHeight, 1.5, 1.5, "FD");

      // Left red accent strip
      doc.setFillColor(...redText);
      doc.rect(marginX, y, 2, rcHeight, "F");

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(127, 29, 29); // red-900
      doc.text(rcLines, marginX + 6, y + 5);

      y += rcHeight + 6;
    }

    // Actionable Recommendations
    if (aiResult.recommendations && aiResult.recommendations.length > 0) {
      checkPageBreak(25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...brandNavy);
      doc.text("ACTIONABLE RECOMMENDATIONS FOR THE NEXT ITERATION", marginX + 2, y);
      y += 4.5;

      for (let i = 0; i < aiResult.recommendations.length; i++) {
        const textStr = formatTextItem(aiResult.recommendations[i]);
        if (!textStr) continue;
        const lines = doc.splitTextToSize(textStr, contentWidth - 16);
        const itemHeight = lines.length * 4 + 5;
        checkPageBreak(itemHeight);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...borderGray);
        doc.roundedRect(marginX, y, contentWidth, itemHeight, 1, 1, "FD");

        // Number bullet
        doc.setFillColor(...brandNavy);
        doc.roundedRect(marginX + 3, y + 2.5, 5, 5, 0.8, 0.8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text(String(i + 1), marginX + 5.5, y + 6, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...textDark);
        doc.text(lines, marginX + 11, y + 5);

        y += itemHeight + 2.5;
      }
      y += 4;
    }
  }

  // =========================================================================
  // 4. OFFICIAL ADVISER REMARKS & DIRECTIVES
  // =========================================================================
  checkPageBreak(30);

  // Section Header
  doc.setFillColor(...brandNavy);
  doc.rect(marginX, y, 3, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...brandNavy);
  doc.text("2. OFFICIAL FACULTY ADVISER REMARKS & DIRECTIVES", marginX + 6, y + 5);
  y += 10;

  const activeRemarks = (currentRemarks || proposal.adviserRemarks || proposal.adviserFeedback || "").trim();

  if (activeRemarks) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const splitRemarks = doc.splitTextToSize(activeRemarks, contentWidth - 14);
    const boxHeight = splitRemarks.length * 4.5 + 14;

    checkPageBreak(boxHeight);

    doc.setFillColor(254, 252, 246); // warm gold-tinted box
    doc.setDrawColor(245, 230, 190);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, y, contentWidth, boxHeight, 1.5, 1.5, "FD");

    // Gold decorative left accent
    doc.setFillColor(...brandGold);
    doc.rect(marginX, y, 2, boxHeight, "F");

    doc.setFont("helvetica", "italic");
    doc.setTextColor(...textDark);
    doc.text(splitRemarks, marginX + 6, y + 6);

    const signoffY = y + boxHeight - 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...brandGold);
    doc.text(
      `— Prof. ${adviserName || "Faculty Adviser"} (Evaluator • Remarks Recorded)`,
      pageWidth - marginX - 5,
      signoffY,
      { align: "right" }
    );

    y += boxHeight + 6;
  } else {
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderGray);
    doc.roundedRect(marginX, y, contentWidth, 12, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text("No written remarks recorded for this proposal cycle.", marginX + 6, y + 7.5);
    y += 18;
  }

  // =========================================================================
  // 5. RUNNING FOOTER (Applied to all pages)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 9;

    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 2.5, pageWidth - marginX, footerY - 2.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text(
      "FeasiFy Platform • Generated via Automated Evaluation & Advisory Engine • Confidential Academic Document",
      marginX,
      footerY + 1
    );

    doc.setFont("helvetica", "bold");
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, footerY + 1, { align: "right" });
  }

  // Save the PDF
  const safeBusinessName = (proposal.businessName || "Proposal")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");
  doc.save(`${safeBusinessName}_Feasibility_Analysis_Report.pdf`);
}
