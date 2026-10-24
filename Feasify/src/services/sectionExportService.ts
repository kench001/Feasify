import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export interface StudentExportItem {
  id: string;
  name: string;
  studentId: string;
  email: string;
  role: "Leader" | "Member";
}

export interface ProposalExportItem {
  id?: string;
  proposalNumber: number;
  businessName: string;
  businessType: string;
  status: string;
  totalCapital: string;
  submissionDate: string;
  adviserRemarks?: string;
}

export interface GroupExportItem {
  id: string;
  title: string;
  companyName?: string;
  businessName?: string;
  leaderId: string;
  leaderName: string;
  section: string;
  status: string;
  members: StudentExportItem[];
  proposals: ProposalExportItem[];
}

export interface SectionExportData {
  sectionName: string;
  adviserName: string;
  generatedDate: string;
  groups: GroupExportItem[];
  totalStudents: number;
  totalProposals: number;
}

/**
 * Fetch fresh data from Firestore for a specific section (or ALL sections).
 */
export const fetchSectionExportData = async (
  targetSection: string,
  adviserSections: string[],
  adviserName: string
): Promise<SectionExportData> => {
  const isAll = targetSection === "ALL";
  const sectionsToQuery = isAll
    ? adviserSections.length > 0
      ? adviserSections
      : [targetSection]
    : [targetSection];

  // 1. Fetch Students
  let studentDocs: any[] = [];
  if (sectionsToQuery.length > 0) {
    const studentQuery = isAll
      ? query(
          collection(db, "users"),
          where("role", "==", "Student"),
          where("section", "in", sectionsToQuery.slice(0, 30))
        )
      : query(
          collection(db, "users"),
          where("role", "==", "Student"),
          where("section", "==", targetSection)
        );
    const snap = await getDocs(studentQuery);
    studentDocs = snap.docs;
  }

  const studentsMap: Record<
    string,
    { id: string; firstName: string; lastName: string; studentId: string; email: string; section?: string }
  > = {};
  studentDocs.forEach((d) => {
    const data = d.data();
    studentsMap[d.id] = {
      id: d.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      studentId: data.studentId || "N/A",
      email: data.email || "N/A",
      section: data.section || "",
    };
  });

  // 2. Fetch Groups
  let groupDocs: any[] = [];
  if (sectionsToQuery.length > 0) {
    const groupsQuery = isAll
      ? query(
          collection(db, "groups"),
          where("section", "in", sectionsToQuery.slice(0, 30))
        )
      : query(
          collection(db, "groups"),
          where("section", "==", targetSection)
        );
    const gSnap = await getDocs(groupsQuery);
    groupDocs = gSnap.docs;
  }

  const rawGroups = groupDocs.map((d) => ({ id: d.id, ...d.data() }));
  const groupIds = rawGroups.map((g) => g.id);

  // 3. Fetch Proposals (chunked by 30)
  const proposalsByGroup: Record<string, any[]> = {};
  if (groupIds.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < groupIds.length; i += 30) {
      chunks.push(groupIds.slice(i, i + 30));
    }

    for (const chunk of chunks) {
      const propQuery = query(
        collection(db, "proposals"),
        where("groupId", "in", chunk)
      );
      const propSnap = await getDocs(propQuery);
      propSnap.docs.forEach((pd) => {
        const pData = { id: pd.id, ...pd.data() } as any;
        if (!proposalsByGroup[pData.groupId]) {
          proposalsByGroup[pData.groupId] = [];
        }
        proposalsByGroup[pData.groupId].push(pData);
      });
    }
  }

  // 4. Assemble clean GroupExportItem structures
  let totalProposalsCount = 0;
  const assembledGroups: GroupExportItem[] = rawGroups.map((g: any) => {
    const leaderStudent = studentsMap[g.leaderId];
    const leaderName = leaderStudent
      ? `${leaderStudent.firstName} ${leaderStudent.lastName}`.trim()
      : g.leaderName || "Unknown Leader";

    // Build members list: Leader first, then members
    const membersList: StudentExportItem[] = [];
    const seenIds = new Set<string>();

    // Add leader
    if (g.leaderId) {
      seenIds.add(g.leaderId);
      membersList.push({
        id: g.leaderId,
        name: leaderName,
        studentId: leaderStudent?.studentId || "N/A",
        email: leaderStudent?.email || "N/A",
        role: "Leader",
      });
    }

    // Add other members from memberIds & joinedMembers
    const rawMemberIds = [
      ...(Array.isArray(g.memberIds) ? g.memberIds : []),
      ...(Array.isArray(g.joinedMembers) ? g.joinedMembers : []),
    ];

    rawMemberIds.forEach((mId: string) => {
      if (mId && !seenIds.has(mId)) {
        seenIds.add(mId);
        const mStudent = studentsMap[mId];
        membersList.push({
          id: mId,
          name: mStudent
            ? `${mStudent.firstName} ${mStudent.lastName}`.trim()
            : "Unknown Student",
          studentId: mStudent?.studentId || "N/A",
          email: mStudent?.email || "N/A",
          role: "Member",
        });
      }
    });

    // Proposals list
    const rawProps = proposalsByGroup[g.id] || [];
    totalProposalsCount += rawProps.length;

    // Sort proposals by slot number
    rawProps.sort((a, b) => (a.proposalNumber || 1) - (b.proposalNumber || 1));

    const proposalsList: ProposalExportItem[] = rawProps.map((p, idx) => {
      let subDate = "Draft (Not submitted)";
      if (p.submissionDate) {
        subDate = p.submissionDate;
      } else if (p.createdAt?.toDate) {
        try {
          subDate = new Date(p.createdAt.toDate()).toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        } catch {}
      } else if (p.status !== "Draft") {
        subDate = "Submitted";
      }

      let capStr = "N/A";
      if (p.totalCapital) {
        const parsed = Number(String(p.totalCapital).replace(/[^0-9.]/g, ""));
        capStr = isNaN(parsed)
          ? String(p.totalCapital)
          : `PHP ${parsed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }

      return {
        id: p.id,
        proposalNumber: p.proposalNumber || idx + 1,
        businessName: p.businessName || `Business Proposal #${idx + 1}`,
        businessType: p.businessType || "N/A",
        status: p.status || "Draft",
        totalCapital: capStr,
        submissionDate: subDate,
        adviserRemarks: p.adviserRemarks || p.adviserFeedback || "",
      };
    });

    return {
      id: g.id,
      title: g.title || "Group",
      companyName: g.companyName || "",
      businessName: g.businessName || "",
      leaderId: g.leaderId || "",
      leaderName,
      section: g.section || targetSection,
      status: g.status || "Drafting",
      members: membersList,
      proposals: proposalsList,
    };
  });

  return {
    sectionName: isAll ? "All Assigned Sections" : targetSection,
    adviserName: adviserName || "Adviser",
    generatedDate: new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    groups: assembledGroups,
    totalStudents: studentDocs.length,
    totalProposals: totalProposalsCount,
  };
};

/**
 * Generate and download the professional PDF report.
 */
export const generateSectionPDF = (data: SectionExportData) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182

  // 1. Title & Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(18, 34, 68); // #122244 Deep Navy
  doc.text("FEASIFY", margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text("Feasibility Study & Academic Venture Management System", margin + 34, 18);

  // Decorative Gold Line
  doc.setDrawColor(201, 166, 84); // #c9a654
  doc.setLineWidth(1);
  doc.line(margin, 22, pageWidth - margin, 22);

  // Section Banner Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(18, 34, 68);
  doc.text(`SECTION REPORT: ${data.sectionName.toUpperCase()}`, margin, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Adviser: ${data.adviserName}   •   Generated: ${data.generatedDate}`, margin, 35);

  // Summary KPI Cards Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, 39, contentWidth, 14, 2, 2, "FD");

  const statCols = [
    { label: "SECTION", value: data.sectionName },
    { label: "TOTAL GROUPS", value: String(data.groups.length) },
    { label: "TOTAL STUDENTS", value: String(data.totalStudents) },
    { label: "TOTAL PROPOSALS", value: String(data.totalProposals) },
  ];

  const colWidth = contentWidth / 4;
  statCols.forEach((stat, idx) => {
    const xPos = margin + idx * colWidth + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(stat.label, xPos, 44);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(18, 34, 68);
    doc.text(stat.value, xPos, 50);
  });

  // Table 1: Master Table of Groups (Group Name, Status, Members, Proposals)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(18, 34, 68);
  doc.text("1. Groups Overview Table", margin, 60);

  const masterTableRows = data.groups.map((group, idx) => {
    const groupDisplayName =
      group.companyName || group.businessName || group.title || `Group ${idx + 1}`;
    const groupSub = group.title && group.title !== groupDisplayName ? ` (${group.title})` : "";

    const membersSummary = group.members
      .map((m) => `${m.role === "Leader" ? "★ " : "• "}${m.name} [${m.studentId}]`)
      .join("\n");

    const proposalsSummary =
      group.proposals.length > 0
        ? group.proposals
            .map(
              (p) =>
                `#${p.proposalNumber}: ${p.businessName} [${p.status}]`
            )
            .join("\n")
        : "No proposals submitted yet (Drafting)";

    return [
      String(idx + 1),
      `${groupDisplayName}${groupSub}\nSection: ${group.section}`,
      group.status,
      membersSummary || "No members assigned",
      proposalsSummary,
    ];
  });

  if (masterTableRows.length === 0) {
    masterTableRows.push([
      "—",
      "No groups created in this section yet.",
      "—",
      "—",
      "—",
    ]);
  }

  autoTable(doc, {
    startY: 64,
    head: [["#", "Group Name", "Status", "Members (Leader & Team)", "Business Proposals"]],
    body: masterTableRows,
    theme: "grid",
    headStyles: {
      fillColor: [18, 34, 68],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 3,
    },
    styles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.8,
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 42, fontStyle: "bold" },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 53 },
      4: { cellWidth: 53 },
    },
    margin: { left: margin, right: margin },
  });

  // Table 2: Detailed Group-by-Group Module (with nested Members and Proposals tables)
  let currentY = (doc as any).lastAutoTable?.finalY || 80;

  // Add Section Title for Detailed Breakdown
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  } else {
    currentY += 12;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(18, 34, 68);
  doc.text("2. Detailed Group Modules (Members & Proposals Breakdown)", margin, currentY);
  currentY += 6;

  data.groups.forEach((group, gIdx) => {
    const groupDisplayName =
      group.companyName || group.businessName || group.title || `Group ${gIdx + 1}`;

    // Ensure enough space for Group Header and at least part of the table
    if (currentY > 225) {
      doc.addPage();
      currentY = 20;
    }

    // Group Header Card Banner
    doc.setFillColor(18, 34, 68);
    doc.roundedRect(margin, currentY, contentWidth, 10, 1.5, 1.5, "F");

    // Left Accent Bar in Gold
    doc.setFillColor(201, 166, 84);
    doc.rect(margin, currentY, 3, 10, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`GROUP ${gIdx + 1}: ${groupDisplayName.toUpperCase()}`, margin + 6, currentY + 6.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    const subHeaderRight = `Section: ${group.section}  |  Status: ${group.status}  |  Leader: ${group.leaderName}`;
    doc.text(subHeaderRight, pageWidth - margin - 4, currentY + 6.5, { align: "right" });

    currentY += 13;

    // Sub-Table A: Group Members
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(18, 34, 68);
    doc.text("Team Members", margin, currentY);
    currentY += 2;

    const membersTableRows = group.members.map((m, mIdx) => [
      String(mIdx + 1),
      m.name,
      m.studentId,
      m.email,
      m.role,
    ]);

    if (membersTableRows.length === 0) {
      membersTableRows.push(["—", "No members assigned", "—", "—", "—"]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [["#", "Member Name", "Student ID", "Email Address", "Role"]],
      body: membersTableRows,
      theme: "striped",
      headStyles: {
        fillColor: [30, 58, 110],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        cellPadding: 2,
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 50, fontStyle: "bold" },
        2: { cellWidth: 32 },
        3: { cellWidth: 62 },
        4: { cellWidth: 30, halign: "center" },
      },
      margin: { left: margin, right: margin },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 6;

    // Sub-Table B: Group Proposals
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(18, 34, 68);
    doc.text("Business Proposals", margin, currentY);
    currentY += 2;

    const proposalsTableRows = group.proposals.map((p) => [
      `Proposal ${p.proposalNumber}`,
      p.businessName,
      p.businessType,
      p.status,
      p.totalCapital,
      p.submissionDate + (p.adviserRemarks ? `\nRemarks: ${p.adviserRemarks}` : ""),
    ]);

    if (proposalsTableRows.length === 0) {
      proposalsTableRows.push([
        "—",
        "No business proposals submitted yet (Drafting).",
        "—",
        "Draft",
        "—",
        "—",
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [["Slot", "Proposal Name", "Type", "Status", "Capital", "Submission / Remarks"]],
      body: proposalsTableRows,
      theme: "striped",
      headStyles: {
        fillColor: [201, 166, 84], // Gold
        textColor: [255, 255, 255],
        fontSize: 7.5,
        cellPadding: 2,
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        textColor: [51, 65, 85],
        overflow: "linebreak",
      },
      alternateRowStyles: {
        fillColor: [254, 252, 246],
      },
      columnStyles: {
        0: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 48, fontStyle: "bold" },
        2: { cellWidth: 26 },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 40 },
      },
      margin: { left: margin, right: margin },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 12;
  });

  // Global Page Headers and Footers
  const totalPages = doc.internal.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // Header on pages 2+
    if (pageNum > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`FEASIFY • SECTION REPORT: ${data.sectionName.toUpperCase()}`, margin, 10);
      doc.text(`Adviser: ${data.adviserName}`, pageWidth - margin, 10, { align: "right" });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, pageWidth - margin, 12);
    }

    // Footer on all pages
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 287, pageWidth - margin, 287);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Feasify Academic Management System • Confidential Educational Record",
      margin,
      292
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, 292, {
      align: "right",
    });
  }

  // Save PDF file
  const safeSection = data.sectionName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Feasify_${safeSection}_Report_${dateStr}.pdf`);
};
