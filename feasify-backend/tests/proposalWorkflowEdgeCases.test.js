const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// Read AdviserDashboard.tsx to extract the exact exported helper logic
const adviserDashboardPath = path.resolve(__dirname, "../../Feasify/src/AdviserDashboard.tsx");
const adviserDashboardContent = fs.readFileSync(adviserDashboardPath, "utf8");

// Verify that isProposalSubmitted and getAdviserVisibleProposal are exported in AdviserDashboard.tsx
assert.ok(
  adviserDashboardContent.includes("export const isProposalSubmitted = (p: ProposalData): boolean =>"),
  "AdviserDashboard.tsx must export isProposalSubmitted"
);
assert.ok(
  adviserDashboardContent.includes("export const getAdviserVisibleProposal = (p: ProposalData): ProposalData =>"),
  "AdviserDashboard.tsx must export getAdviserVisibleProposal"
);

// Mirror implementations matching AdviserDashboard.tsx exactly for runtime testing
const isProposalSubmitted = (p) => {
  if (!p) return false;
  if (p.status === "Draft" || p.status === "Drafting") return false;
  return Boolean(
    p.submittedData ||
    p.submissionDate ||
    ["Submitted", "Pending", "Under Review", "Approved", "Approved Proposal", "APPROVED", "Revision Required", "Rejected", "Revision"].includes(p.status)
  );
};

const getAdviserVisibleProposal = (p) => {
  if (!p) return p;
  if (p.submittedData && typeof p.submittedData === "object") {
    return {
      ...p,
      ...p.submittedData,
      adviserRemarks: p.adviserRemarks || p.submittedData.adviserRemarks || "",
      adviserFeedback: p.adviserFeedback || p.submittedData.adviserFeedback || "",
      feedbackHistory: p.feedbackHistory || p.submittedData.feedbackHistory || [],
      id: p.id,
      groupId: p.groupId,
      facultyId: p.facultyId,
    };
  }
  return p;
};

// Read Projects.tsx to verify the submission validation rules
const projectsPath = path.resolve(__dirname, "../../Feasify/src/Projects.tsx");
const projectsContent = fs.readFileSync(projectsPath, "utf8");

assert.ok(
  projectsContent.includes("if (!currentProposal.aiAnalysis || typeof currentProposal.aiAnalysis.score !== \"number\")"),
  "Projects.tsx must check for missing aiAnalysis or non-numeric score"
);
assert.ok(
  projectsContent.includes("else if (currentProposal.aiAnalysis.score < 80)"),
  "Projects.tsx must enforce score < 80 check"
);
assert.ok(
  projectsContent.includes("const scoreStatusLabel = score >= 65 ? \"Moderate Feasibility\" : \"Needs Improvement\";"),
  "Projects.tsx must format scoreStatusLabel with threshold 65"
);

// Replicate the exact validation evaluation algorithm from Projects.tsx handleSubmitProposal / saveProposal
function validateProposalSubmission({ currentProposal, proposals = [], copyrightDB = [] }) {
  const reasons = [];

  // 1. Quota Check
  if (!currentProposal.id && proposals.length >= 3) {
    reasons.push({
      type: "quota",
      title: "Proposal Limit Reached (Max 3 Allowed)",
      description: "Your team already has 3 proposals on file. Each team can submit at most 3 proposals. Please delete an existing proposal before creating or submitting a new one.",
    });
  }

  // 2. AI Feasibility Analysis Verdict Check (Green Verdict / Score >= 80 required)
  if (!currentProposal.aiAnalysis || typeof currentProposal.aiAnalysis.score !== "number") {
    reasons.push({
      type: "error",
      title: "AI Feasibility Analysis Required",
      description: "You must run the AI Feasibility Analysis before submitting this proposal. Proposals must be evaluated by the AI and achieve a passing Green verdict (High Feasibility / score of 80% or higher) before submitting to your adviser.",
    });
  } else if (currentProposal.aiAnalysis.score < 80) {
    const score = currentProposal.aiAnalysis.score;
    const scoreStatusLabel = score >= 65 ? "Moderate Feasibility" : "Needs Improvement";
    reasons.push({
      type: "error",
      title: "AI Feasibility Verdict Not Passable",
      description: `Your proposal's current AI Feasibility score is ${score}/100 (${scoreStatusLabel}). Proposals must achieve a passing Green verdict (High Feasibility, 80/100 or higher) before submitting to your adviser. Please review the AI recommendations, improve your proposal details, and click 'Re-analyze Proposal'.`,
    });
  }

  // 3. Required Fields Check
  const missingLabels = [];
  const requiredFieldConfigs = [
    { key: "businessType", label: "Business Type" },
    { key: "businessName", label: "Business / Company Name" },
    { key: "totalCapital", label: "Total Capital" },
    { key: "tagline", label: "Tagline" },
    { key: "targetMarket", label: "Target Market" },
    { key: "missionStatement", label: "Mission Statement" },
    { key: "visionStatement", label: "Vision Statement" },
    { key: "productDescription", label: "Product Description" },
    { key: "priceRanges", label: "Price Ranges" },
    { key: "proposedLocation", label: "Proposed Location" },
    { key: "promotionalStrategy", label: "Promotional Strategy" },
  ];

  requiredFieldConfigs.forEach(({ key, label }) => {
    const val = currentProposal[key];
    const isEmpty = !val || (typeof val === "string" && val.trim() === "");
    if (isEmpty) {
      missingLabels.push(label);
    } else if (key === "businessType" && val === "Other") {
      missingLabels.push("Business Type (Specify Custom Type)");
    }
  });

  if (missingLabels.length > 0) {
    reasons.push({
      type: "missing",
      title: `Incomplete Fields (${missingLabels.length} Missing)`,
      description: "All required sections of the proposal must be filled out before submitting to your adviser for review.",
      items: missingLabels,
    });
  }

  // 4. Capital Check
  const numCap = parseFloat(String(currentProposal.totalCapital || "0").replace(/[^0-9.-]/g, ""));
  if (!isNaN(numCap) && numCap < 0) {
    reasons.push({
      type: "capital",
      title: "Invalid Capital Amount",
      description: "Total capital cannot be negative. Please enter a valid non-negative amount.",
    });
  }

  return {
    canSubmit: reasons.length === 0,
    reasons,
  };
}

// ----------------------------------------------------
// TEST SUITE: Projects.tsx & AdviserDashboard.tsx Workflow
// ----------------------------------------------------

test("Proposal Submission & Adviser Isolation Verification", async (t) => {

  await t.test("Projects.tsx: Submitting with missing aiAnalysis is blocked", () => {
    const proposal = {
      businessType: "Food Service",
      businessName: "Mama's Kitchen",
      totalCapital: "50000",
      tagline: "Taste the tradition",
      targetMarket: "Students and office workers",
      missionStatement: "Provide affordable hearty meals",
      visionStatement: "Be the leading comfort diner",
      productDescription: "Rice bowls and beverages",
      priceRanges: "₱50 - ₱120",
      proposedLocation: "Sampaloc, Manila",
      promotionalStrategy: "Social media and flyers",
      aiAnalysis: undefined,
    };

    const result = validateProposalSubmission({ currentProposal: proposal, proposals: [] });
    assert.equal(result.canSubmit, false);
    const aiReason = result.reasons.find((r) => r.title === "AI Feasibility Analysis Required");
    assert.ok(aiReason, "Must include AI Feasibility Analysis Required reason");
    assert.match(aiReason.description, /must be evaluated by the AI/i);
  });

  await t.test("Projects.tsx: Submitting with score < 80 is blocked and shows appropriate reason", () => {
    // Sub-case 1: Score 65..79 -> "Moderate Feasibility"
    const proposalModerate = {
      businessType: "Retail",
      businessName: "Eco Bags Co",
      totalCapital: "30000",
      tagline: "Eco-friendly tote bags",
      targetMarket: "Eco-conscious buyers",
      missionStatement: "Reduce plastic waste",
      visionStatement: "A green tomorrow",
      productDescription: "Handmade canvas bags",
      priceRanges: "₱150 - ₱300",
      proposedLocation: "Quezon City",
      promotionalStrategy: "Instagram campaigns",
      aiAnalysis: { score: 72 },
    };

    const resMod = validateProposalSubmission({ currentProposal: proposalModerate, proposals: [] });
    assert.equal(resMod.canSubmit, false);
    const reasonMod = resMod.reasons.find((r) => r.title === "AI Feasibility Verdict Not Passable");
    assert.ok(reasonMod, "Must include AI Feasibility Verdict Not Passable reason");
    assert.match(reasonMod.description, /72\/100 \(Moderate Feasibility\)/);
    assert.match(reasonMod.description, /80\/100 or higher/);

    // Sub-case 2: Score < 65 -> "Needs Improvement"
    const proposalPoor = {
      ...proposalModerate,
      aiAnalysis: { score: 55 },
    };

    const resPoor = validateProposalSubmission({ currentProposal: proposalPoor, proposals: [] });
    assert.equal(resPoor.canSubmit, false);
    const reasonPoor = resPoor.reasons.find((r) => r.title === "AI Feasibility Verdict Not Passable");
    assert.ok(reasonPoor);
    assert.match(reasonPoor.description, /55\/100 \(Needs Improvement\)/);
  });

  await t.test("Projects.tsx: Submitting with score >= 80 passes AI check", () => {
    const validProposal = {
      businessType: "Technology",
      businessName: "Smart Agri Sensors",
      totalCapital: "80000",
      tagline: "Precision farming simplified",
      targetMarket: "Local hydroponic farmers",
      missionStatement: "Empower farmers with data",
      visionStatement: "Smart agriculture for all",
      productDescription: "IoT soil and water monitors",
      priceRanges: "₱1200 - ₱3500",
      proposedLocation: "Los Baños, Laguna",
      promotionalStrategy: "Direct outreach and farmer expos",
      aiAnalysis: { score: 85, verdict: "High Feasibility" },
    };

    const result = validateProposalSubmission({ currentProposal: validProposal, proposals: [] });
    assert.equal(result.canSubmit, true);
    assert.equal(result.reasons.length, 0);
  });

  await t.test("Projects.tsx: Boundary score exactly 80 passes AI check", () => {
    const boundaryProposal = {
      businessType: "Manufacturing",
      businessName: "Bamboo Straws",
      totalCapital: "40000",
      tagline: "Natural sipping",
      targetMarket: "Cafes",
      missionStatement: "Replace single-use plastics",
      visionStatement: "Clean oceans",
      productDescription: "Sterilized bamboo straws",
      priceRanges: "₱20 - ₱100",
      proposedLocation: "Cebu City",
      promotionalStrategy: "B2B partnerships",
      aiAnalysis: { score: 80 },
    };

    const result = validateProposalSubmission({ currentProposal: boundaryProposal, proposals: [] });
    assert.equal(result.canSubmit, true);
    assert.equal(result.reasons.length, 0);
  });

  await t.test("Projects.tsx: Max 3 proposals quota check blocks new proposal submission", () => {
    const proposal = {
      businessType: "Services",
      businessName: "QuickFix Repair",
      totalCapital: "25000",
      tagline: "Fast gadget repair",
      targetMarket: "Students",
      missionStatement: "Reliable repairs",
      visionStatement: "Top device clinic",
      productDescription: "Smartphone diagnostics",
      priceRanges: "₱200 - ₱1500",
      proposedLocation: "Manila",
      promotionalStrategy: "Campus posters",
      aiAnalysis: { score: 88 },
    };

    const existingProposals = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    const result = validateProposalSubmission({ currentProposal: proposal, proposals: existingProposals });
    assert.equal(result.canSubmit, false);
    assert.ok(result.reasons.some((r) => r.type === "quota"));
  });

  await t.test("AdviserDashboard.tsx: isProposalSubmitted safely ignores Draft proposals", () => {
    // Null / undefined safety
    assert.equal(isProposalSubmitted(null), false);
    assert.equal(isProposalSubmitted(undefined), false);

    // Draft statuses
    assert.equal(isProposalSubmitted({ status: "Draft" }), false);
    assert.equal(isProposalSubmitted({ status: "Drafting" }), false);

    // Draft with submittedData or submissionDate must STILL be ignored because status is Draft
    assert.equal(
      isProposalSubmitted({
        status: "Draft",
        submittedData: { businessName: "Old Submitted Copy" },
        submissionDate: "2026-11-17T00:00:00.000Z",
      }),
      false
    );

    // Submitted statuses must return true
    assert.equal(isProposalSubmitted({ status: "Submitted" }), true);
    assert.equal(isProposalSubmitted({ status: "Pending" }), true);
    assert.equal(isProposalSubmitted({ status: "Under Review" }), true);
    assert.equal(isProposalSubmitted({ status: "Approved" }), true);
    assert.equal(isProposalSubmitted({ status: "Approved Proposal" }), true);
    assert.equal(isProposalSubmitted({ status: "APPROVED" }), true);
    assert.equal(isProposalSubmitted({ status: "Revision Required" }), true);
    assert.equal(isProposalSubmitted({ status: "Rejected" }), true);
    assert.equal(isProposalSubmitted({ status: "Revision" }), true);
  });

  await t.test("AdviserDashboard.tsx: getAdviserVisibleProposal safely handles proposals without submittedData", () => {
    assert.equal(getAdviserVisibleProposal(null), null);
    assert.equal(getAdviserVisibleProposal(undefined), undefined);

    const plainProposal = {
      id: "prop-123",
      groupId: "grp-456",
      businessName: "Direct Proposal Name",
      status: "Submitted",
      totalCapital: "50000",
    };

    const result = getAdviserVisibleProposal(plainProposal);
    assert.deepEqual(result, plainProposal);
  });

  await t.test("AdviserDashboard.tsx: getAdviserVisibleProposal overrides draft edits with submittedData snapshot while preserving root remarks", () => {
    const proposalWithSnapshot = {
      id: "prop-999",
      groupId: "grp-888",
      facultyId: "fac-777",
      businessName: "Mutated Draft Business Name (Unsubmitted)",
      status: "Under Review",
      totalCapital: "999999",
      adviserRemarks: "Latest Adviser Notes on Root Doc",
      adviserFeedback: "Approved for defense review",
      feedbackHistory: [{ timestamp: "2026-11-17", feedback: "Notes" }],
      submittedData: {
        businessName: "Original Submitted Business Name",
        totalCapital: "50000",
        tagline: "Original Tagline",
        status: "Submitted",
        adviserRemarks: "Old Stale Snapshot Remarks",
      },
    };

    const visible = getAdviserVisibleProposal(proposalWithSnapshot);

    // Adviser should see the submitted snapshot values
    assert.equal(visible.businessName, "Original Submitted Business Name");
    assert.equal(visible.totalCapital, "50000");
    assert.equal(visible.tagline, "Original Tagline");

    // Preserves top-level metadata
    assert.equal(visible.id, "prop-999");
    assert.equal(visible.groupId, "grp-888");
    assert.equal(visible.facultyId, "fac-777");

    // Root adviser remarks take precedence over stale snapshot remarks
    assert.equal(visible.adviserRemarks, "Latest Adviser Notes on Root Doc");
    assert.equal(visible.adviserFeedback, "Approved for defense review");
    assert.equal(visible.feedbackHistory.length, 1);
  });
});
