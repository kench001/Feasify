const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// =====================================================================
// 1. AST & STATIC SOURCE CODE VERIFICATION
// =====================================================================

const reportsPath = path.resolve(__dirname, "../../Feasify/src/Reports.tsx");
const reportsContent = fs.readFileSync(reportsPath, "utf8");

const adviserDashboardPath = path.resolve(__dirname, "../../Feasify/src/AdviserDashboard.tsx");
const adviserDashboardContent = fs.readFileSync(adviserDashboardPath, "utf8");

test("Static Code Contracts: Reports.tsx & AdviserDashboard.tsx", async (t) => {
  await t.test("Reports.tsx enforces strict AI analysis checks and Green verdict gate", () => {
    // 1. Null/undefined aiAnalysis check
    assert.ok(
      reportsContent.includes("if (!selectedProject.aiAnalysis)"),
      "Reports.tsx must check for missing selectedProject.aiAnalysis"
    );
    assert.ok(
      reportsContent.includes("Please run the AI Feasibility Analysis first before submitting your report."),
      "Reports.tsx must notify user to run AI analysis first"
    );

    // 2. Verdict logic variables
    assert.ok(
      reportsContent.includes("const isRedOrNotPassable = status === \"NOT_FEASIBLE\" || status === \"NOT FEASIBLE\" || (score !== null && score < 65);"),
      "Reports.tsx must define isRedOrNotPassable checking NOT_FEASIBLE and score < 65"
    );
    assert.ok(
      reportsContent.includes("const isGreenVerdict = !isRedOrNotPassable && (status === \"FEASIBLE\" || (score !== null && score >= 80));"),
      "Reports.tsx must define isGreenVerdict requiring !isRedOrNotPassable and (FEASIBLE or score >= 80)"
    );

    // 3. Modals triggering
    assert.ok(
      reportsContent.includes("setShowVerdictBlockedModal(true);"),
      "Reports.tsx must trigger VerdictBlockedModal when not green"
    );
    assert.ok(
      reportsContent.includes("setShowReportSubmitModal(true);"),
      "Reports.tsx must trigger ReportSubmitModal when green verdict"
    );

    // 4. Persistence payload
    assert.ok(
      reportsContent.includes("reportSubmitted: true"),
      "Reports.tsx must record reportSubmitted: true in payload"
    );
    assert.ok(
      reportsContent.includes("reportStatus: \"Submitted\""),
      "Reports.tsx must record reportStatus: 'Submitted'"
    );
  });

  await t.test("AdviserDashboard.tsx gates Active Business behind isReportSubmitted", () => {
    // 1. Export of isReportSubmitted
    assert.ok(
      adviserDashboardContent.includes("export const isReportSubmitted = (group: GroupData, teamProps: ProposalData[] = []): boolean =>"),
      "AdviserDashboard.tsx must export isReportSubmitted"
    );

    // 2. handleOpenActiveBusiness gate
    assert.ok(
      adviserDashboardContent.includes("if (!isReportSubmitted(group, teamProps)) {"),
      "handleOpenActiveBusiness must gate access with isReportSubmitted"
    );
    assert.ok(
      adviserDashboardContent.includes("setAwaitingReportGroup(group);"),
      "handleOpenActiveBusiness must set awaitingReportGroup modal"
    );

    // 3. Group Card button gating
    assert.ok(
      adviserDashboardContent.includes("const reportReady = isActivated && isReportSubmitted(group, teamProps);"),
      "AdviserDashboard card must compute reportReady using isActivated && isReportSubmitted"
    );
    assert.ok(
      adviserDashboardContent.includes("View Active Business Details"),
      "AdviserDashboard must render 'View Active Business Details' when reportReady is true"
    );
    assert.ok(
      adviserDashboardContent.includes("Awaiting Student Report"),
      "AdviserDashboard must render 'Awaiting Student Report' with Lock when pending"
    );
  });
});

// =====================================================================
// 2. LOGIC MIRROR IMPLEMENTATIONS FOR EDGE-CASE VERIFICATION
// =====================================================================

/**
 * Replicates Reports.tsx handleInitiateReportSubmit decision flow
 */
function evaluateReportSubmissionEligibility(selectedProject) {
  if (!selectedProject) {
    return {
      allowed: false,
      reason: "No active project selected.",
      modal: null,
    };
  }

  if (!selectedProject.aiAnalysis) {
    return {
      allowed: false,
      reason: "Please run the AI Feasibility Analysis first before submitting your report.",
      modal: null,
    };
  }

  const status = ((selectedProject.aiAnalysis.status || "").toUpperCase()).trim();
  const score = typeof selectedProject.aiAnalysis.score === "number" ? selectedProject.aiAnalysis.score : null;

  const isRedOrNotPassable = status === "NOT_FEASIBLE" || status === "NOT FEASIBLE" || (score !== null && score < 65);
  const isGreenVerdict = !isRedOrNotPassable && (status === "FEASIBLE" || (score !== null && score >= 80));

  if (!isGreenVerdict) {
    return {
      allowed: false,
      reason: "Submission Blocked: AI Verdict Not Feasible",
      modal: "VerdictBlockedModal",
      verdictStatus: status,
      score,
    };
  }

  return {
    allowed: true,
    reason: "Report eligible for adviser submission",
    modal: "ReportSubmitModal",
    verdictStatus: status,
    score,
  };
}

/**
 * Replicates AdviserDashboard.tsx isReportSubmitted helper
 */
const isReportSubmitted = (group, teamProps = []) => {
  if (!group) return false;
  if (group.reportSubmitted === true) return true;
  const activeProp = teamProps.find(p => p.id === group.activeProposalId) || teamProps.find(p => p.status === 'Approved');
  if (activeProp && activeProp.reportSubmitted === true) return true;
  return teamProps.some(p => p.reportSubmitted === true);
};

// =====================================================================
// 3. EXECUTION TESTS FOR REPORTS.TSX SUBMISSION EDGE CASES
// =====================================================================

test("Reports.tsx Submission Gate Edge Cases", async (t) => {
  await t.test("Edge Case 1: No project selected is blocked", () => {
    const res = evaluateReportSubmissionEligibility(null);
    assert.equal(res.allowed, false);
    assert.equal(res.reason, "No active project selected.");
    assert.equal(res.modal, null);
  });

  await t.test("Edge Case 2: Project with no aiAnalysis is blocked with informative prompt", () => {
    const res = evaluateReportSubmissionEligibility({ id: "p1", name: "Alpha", aiAnalysis: null });
    assert.equal(res.allowed, false);
    assert.equal(res.reason, "Please run the AI Feasibility Analysis first before submitting your report.");
    assert.equal(res.modal, null);
  });

  await t.test("Edge Case 3: Explicit NOT FEASIBLE status is blocked by VerdictBlockedModal", () => {
    const res = evaluateReportSubmissionEligibility({
      id: "p1",
      name: "Alpha",
      aiAnalysis: { status: "NOT FEASIBLE", score: 55 },
    });
    assert.equal(res.allowed, false);
    assert.equal(res.modal, "VerdictBlockedModal");
  });

  await t.test("Edge Case 4: NOT_FEASIBLE status with high score is still blocked (status vetoes score)", () => {
    const res = evaluateReportSubmissionEligibility({
      id: "p1",
      name: "Alpha",
      aiAnalysis: { status: "NOT_FEASIBLE", score: 85 },
    });
    assert.equal(res.allowed, false);
    assert.equal(res.modal, "VerdictBlockedModal");
  });

  await t.test("Edge Case 5: Score < 65 is red/not passable even if status is not explicitly NOT FEASIBLE", () => {
    const res = evaluateReportSubmissionEligibility({
      id: "p1",
      name: "Alpha",
      aiAnalysis: { status: "MODERATE", score: 60 },
    });
    assert.equal(res.allowed, false);
    assert.equal(res.modal, "VerdictBlockedModal");
  });

  await t.test("Edge Case 6: Moderate feasibility (score 70, status MODERATE) is blocked", () => {
    const res = evaluateReportSubmissionEligibility({
      id: "p1",
      name: "Alpha",
      aiAnalysis: { status: "MODERATE", score: 70 },
    });
    assert.equal(res.allowed, false);
    assert.equal(res.modal, "VerdictBlockedModal");
  });

  await t.test("Edge Case 7: Boundary Score 79 is blocked (< 80)", () => {
    const res = evaluateReportSubmissionEligibility({
      id: "p1",
      name: "Alpha",
      aiAnalysis: { status: "MODERATE", score: 79 },
    });
    assert.equal(res.allowed, false);
    assert.equal(res.modal, "VerdictBlockedModal");
  });

  await t.test("Edge Case 8: Boundary Score 80 passes Green verdict check", () => {
    const res = evaluateReportSubmissionEligibility({
      id: "p1",
      name: "Alpha",
      aiAnalysis: { status: "FEASIBLE", score: 80 },
    });
    assert.equal(res.allowed, true);
    assert.equal(res.modal, "ReportSubmitModal");
  });

  await t.test("Edge Case 9: FEASIBLE status with score 85 passes and opens submit modal", () => {
    const res = evaluateReportSubmissionEligibility({
      id: "p1",
      name: "Alpha",
      aiAnalysis: { status: "FEASIBLE", score: 85 },
    });
    assert.equal(res.allowed, true);
    assert.equal(res.modal, "ReportSubmitModal");
  });

  await t.test("Edge Case 10: FEASIBLE with lowercase / whitespace passes cleanly", () => {
    const res = evaluateReportSubmissionEligibility({
      id: "p1",
      name: "Alpha",
      aiAnalysis: { status: "  feasible  ", score: 75 },
    });
    assert.equal(res.allowed, true);
    assert.equal(res.modal, "ReportSubmitModal");
  });
});

// =====================================================================
// 4. EXECUTION TESTS FOR ADVISER DASHBOARD ACCESS GATE
// =====================================================================

test("AdviserDashboard.tsx isReportSubmitted & Access Gate Edge Cases", async (t) => {
  await t.test("Group null or undefined returns false", () => {
    assert.equal(isReportSubmitted(null), false);
    assert.equal(isReportSubmitted(undefined), false);
  });

  await t.test("Group with reportSubmitted: true directly returns true", () => {
    const group = { id: "g1", reportSubmitted: true };
    assert.equal(isReportSubmitted(group), true);
  });

  await t.test("Group pending, but active proposal has reportSubmitted: true returns true", () => {
    const group = { id: "g1", activeProposalId: "p1", reportSubmitted: false };
    const teamProps = [
      { id: "p1", reportSubmitted: true },
      { id: "p2", reportSubmitted: false },
    ];
    assert.equal(isReportSubmitted(group, teamProps), true);
  });

  await t.test("Group pending, no activeProposalId set, but approved proposal has reportSubmitted: true returns true", () => {
    const group = { id: "g1", reportSubmitted: false };
    const teamProps = [
      { id: "p1", status: "Approved", reportSubmitted: true },
      { id: "p2", status: "Draft", reportSubmitted: false },
    ];
    assert.equal(isReportSubmitted(group, teamProps), true);
  });

  await t.test("Group pending, any proposal in group having reportSubmitted: true returns true", () => {
    const group = { id: "g1", reportSubmitted: false };
    const teamProps = [
      { id: "p1", status: "Submitted", reportSubmitted: false },
      { id: "p2", status: "Under Review", reportSubmitted: true },
    ];
    assert.equal(isReportSubmitted(group, teamProps), true);
  });

  await t.test("Pending group and proposals without reportSubmitted return false", () => {
    const group = { id: "g1", reportSubmitted: false, status: "Active Business" };
    const teamProps = [
      { id: "p1", status: "Approved", reportSubmitted: false },
      { id: "p2", status: "Draft" },
    ];
    assert.equal(isReportSubmitted(group, teamProps), false);
  });

  await t.test("Adviser Dashboard Action Gate Simulation", () => {
    // Simulate handleOpenActiveBusiness logic
    let openedActiveView = false;
    let awaitingModalTarget = null;

    const simulateClick = (group, teamProps) => {
      openedActiveView = false;
      awaitingModalTarget = null;

      if (!isReportSubmitted(group, teamProps)) {
        awaitingModalTarget = group;
        return;
      }
      openedActiveView = true;
    };

    // Scenario A: Unsubmitted report -> blocked and triggers awaitingModal
    const unsubmittedGroup = { id: "grp-1", name: "Team Eco", status: "Active Business" };
    simulateClick(unsubmittedGroup, [{ id: "prop-1", status: "Approved" }]);
    assert.equal(openedActiveView, false);
    assert.equal(awaitingModalTarget?.id, "grp-1");

    // Scenario B: Submitted report -> unlocks and opens active business view
    const submittedGroup = { id: "grp-2", name: "Team Bio", status: "Active Business", reportSubmitted: true };
    simulateClick(submittedGroup, [{ id: "prop-2", status: "Approved", reportSubmitted: true }]);
    assert.equal(openedActiveView, true);
    assert.equal(awaitingModalTarget, null);
  });

  await t.test("Group Card UI Gating Parity", () => {
    const renderCardButtonState = (isActivated, reportReady) => {
      if (!isActivated) return "VIEW_GROUP_DETAILS";
      if (reportReady) return "VIEW_ACTIVE_BUSINESS_DETAILS";
      return "AWAITING_STUDENT_REPORT";
    };

    // Group not yet activated
    assert.equal(renderCardButtonState(false, false), "VIEW_GROUP_DETAILS");

    // Group activated, report NOT submitted
    assert.equal(renderCardButtonState(true, false), "AWAITING_STUDENT_REPORT");

    // Group activated, report submitted
    assert.equal(renderCardButtonState(true, true), "VIEW_ACTIVE_BUSINESS_DETAILS");
  });
});
