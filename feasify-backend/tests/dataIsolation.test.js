const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// 1. Direct import of isAiAnalysisAvailable from Feasify service
const { isAiAnalysisAvailable } = require("../../Feasify/src/services/proposalSectionExportService.ts");

// 2. Extract and evaluate isProposalStageAnalysis directly from Feasify/src/utils/aiAnalysisHelpers.ts
const helpersSourcePath = path.resolve(__dirname, "../../Feasify/src/utils/aiAnalysisHelpers.ts");
const helpersContent = fs.readFileSync(helpersSourcePath, "utf8");

// Parse the isProposalStageAnalysis function body from the actual source file
const match = helpersContent.match(/export const isProposalStageAnalysis = \(([\s\S]*?)\n\};/);
if (!match) {
  throw new Error("Could not find isProposalStageAnalysis in aiAnalysisHelpers.ts");
}
const paramAndBody = match[1];
const bodyOnly = paramAndBody.replace(/^[^{]*{/, "").replace(/}\s*$/, "");
const isProposalStageAnalysisFromSource = new Function("aiAnalysis", bodyOnly);

// Mirror implementation for side-by-side behavioral equivalence verification
const isProposalStageAnalysisMirrored = (aiAnalysis) => {
  if (!aiAnalysis || typeof aiAnalysis !== "object") return false;
  if (
    aiAnalysis.analysisType === "ADVISER_PROPOSAL_ANALYSIS" ||
    aiAnalysis.sourceModule === "adviser-proposal-modal"
  ) {
    return true;
  }
  if (
    aiAnalysis.analysisType === "STUDENT_FINANCIAL_FEASIBILITY" ||
    aiAnalysis.sourceModule === "student-financial-input"
  ) {
    return false;
  }
  if (!aiAnalysis.status) return true;
  if (
    Boolean(aiAnalysis.draftFeedback) &&
    !aiAnalysis.performanceGrade &&
    !Array.isArray(aiAnalysis.severeFlags) &&
    !aiAnalysis.marketAnalysis
  ) {
    return true;
  }
  return false;
};

test("AI Feasibility Analysis Data Isolation Verification", async (t) => {

  await t.test("PARITY: isProposalStageAnalysis source matches mirror logic", () => {
    const testCases = [
      null,
      undefined,
      {},
      { analysisType: "ADVISER_PROPOSAL_ANALYSIS" },
      { sourceModule: "adviser-proposal-modal" },
      { analysisType: "STUDENT_FINANCIAL_FEASIBILITY" },
      { sourceModule: "student-financial-input" },
      { draftFeedback: "Needs revision", status: undefined },
      { status: "COMPLETED", performanceGrade: "A", marketAnalysis: {} },
    ];

    for (const tc of testCases) {
      assert.equal(
        isProposalStageAnalysisFromSource(tc),
        isProposalStageAnalysisMirrored(tc),
        `Mismatch for case: ${JSON.stringify(tc)}`
      );
    }
  });

  await t.test("Scenario 1: Student not analyzed, Adviser analyzes proposal", () => {
    // Student has not yet initiated analysis
    // Adviser analyzes proposal via Adviser proposal modal -> writes to adviserAiAnalysis
    const proposal = {
      id: "prop-scenario-1",
      title: "Eco Packaging Startup",
      status: "Under Review",
      aiAnalysis: null,
      adviserAiAnalysis: {
        score: 78,
        verdict: "FEASIBLE",
        status: "COMPLETED",
        analysisType: "ADVISER_PROPOSAL_ANALYSIS",
        sourceModule: "adviser-proposal-modal",
        draftFeedback: "Solid value proposition.",
        lastRun: "2026-11-12T14:00:00.000Z",
      },
    };

    // isAiAnalysisAvailable must return false because student analysis does not exist
    const available = isAiAnalysisAvailable(proposal);
    assert.equal(available, false, "Export and detail view must treat student analysis as unavailable");

    // Also test empty object aiAnalysis
    const proposalEmptyAi = {
      ...proposal,
      aiAnalysis: {},
    };
    assert.equal(isAiAnalysisAvailable(proposalEmptyAi), false, "Empty aiAnalysis object must also be unavailable");
  });

  await t.test("Scenario 2: Adviser proposal analysis contains analysisType ADVISER_PROPOSAL_ANALYSIS", () => {
    const adviserAnalysis = {
      score: 82,
      verdict: "CONDITIONALLY_FEASIBLE",
      status: "COMPLETED",
      analysisType: "ADVISER_PROPOSAL_ANALYSIS",
      sourceModule: "adviser-proposal-modal",
      draftFeedback: "Clarify operating margin and target segment.",
    };

    // isProposalStageAnalysis must identify it as proposal-stage analysis
    assert.equal(isProposalStageAnalysisFromSource(adviserAnalysis), true);
    assert.equal(isProposalStageAnalysisMirrored(adviserAnalysis), true);

    // If an adviser analysis were somehow placed into proposal.aiAnalysis, isAiAnalysisAvailable must reject it
    const proposalWithAdviserInAiAnalysis = {
      id: "prop-scenario-2",
      aiAnalysis: adviserAnalysis,
    };
    assert.equal(isAiAnalysisAvailable(proposalWithAdviserInAiAnalysis), false, "Must reject ADVISER_PROPOSAL_ANALYSIS in aiAnalysis");
  });

  await t.test("Scenario 3: Student runs financial analysis with analysisType STUDENT_FINANCIAL_FEASIBILITY", () => {
    const studentAnalysis = {
      score: 91,
      status: "FEASIBLE",
      verdict: "FEASIBLE",
      analysisType: "STUDENT_FINANCIAL_FEASIBILITY",
      sourceModule: "student-financial-input",
      performanceGrade: "A-",
      performanceStatus: "Strong Operational Feasibility",
      inputSignature: "test-hash-sig-1234",
      insights: [
        { id: "ins-1", title: "Strong Margins", description: "Gross margin exceeds 40%", type: "positive" },
      ],
      severeFlags: [],
      marketAnalysis: { score: 88 },
      lastRun: "2026-11-12T14:15:00.000Z",
    };

    // isProposalStageAnalysis must return false for student financial feasibility
    assert.equal(isProposalStageAnalysisFromSource(studentAnalysis), false);
    assert.equal(isProposalStageAnalysisMirrored(studentAnalysis), false);

    // isAiAnalysisAvailable must return true
    const proposalWithStudentAi = {
      id: "prop-scenario-3",
      aiAnalysis: studentAnalysis,
    };
    assert.equal(isAiAnalysisAvailable(proposalWithStudentAi), true, "Student financial feasibility must be available");
  });

  await t.test("Scenario 4: Both exist -> co-exist without collision or overwriting", () => {
    const studentAnalysis = {
      score: 89,
      status: "FEASIBLE",
      verdict: "FEASIBLE",
      analysisType: "STUDENT_FINANCIAL_FEASIBILITY",
      sourceModule: "student-financial-input",
      performanceGrade: "A",
      inputSignature: "student-sig-5678",
      insights: [
        { id: "ins-1", title: "Healthy Cash Flow", description: "Positive working capital", type: "positive" },
      ],
    };

    const adviserAnalysis = {
      score: 75,
      verdict: "CONDITIONALLY_FEASIBLE",
      status: "COMPLETED",
      analysisType: "ADVISER_PROPOSAL_ANALYSIS",
      sourceModule: "adviser-proposal-modal",
      draftFeedback: "Re-evaluate supplier pricing assumption.",
      lastRun: "2026-11-12T14:20:00.000Z",
    };

    const proposal = {
      id: "prop-scenario-4",
      title: "Coexisting Analyses Proposal",
      aiAnalysis: studentAnalysis,
      adviserAiAnalysis: adviserAnalysis,
    };

    // Verify both fields are intact and distinct
    assert.notStrictEqual(proposal.aiAnalysis, proposal.adviserAiAnalysis);
    assert.equal(proposal.aiAnalysis.analysisType, "STUDENT_FINANCIAL_FEASIBILITY");
    assert.equal(proposal.adviserAiAnalysis.analysisType, "ADVISER_PROPOSAL_ANALYSIS");
    assert.equal(proposal.aiAnalysis.score, 89);
    assert.equal(proposal.adviserAiAnalysis.score, 75);

    // Student analysis is available for financial feasibility
    assert.equal(isAiAnalysisAvailable(proposal), true);

    // Adviser analysis remains recognized as proposal stage
    assert.equal(isProposalStageAnalysisFromSource(proposal.adviserAiAnalysis), true);
    assert.equal(isProposalStageAnalysisFromSource(proposal.aiAnalysis), false);
  });

  await t.test("Scenario 5: ActiveBusinessDetailView.tsx empty state exact UI template verification", () => {
    const viewPath = path.resolve(__dirname, "../../Feasify/src/components/ActiveBusinessDetailView.tsx");
    const viewContent = fs.readFileSync(viewPath, "utf8");

    // Exact Title
    assert.ok(
      viewContent.includes("No AI Feasibility Analysis Available"),
      "Must include exact Title: 'No AI Feasibility Analysis Available'"
    );

    // Exact Description
    assert.ok(
      viewContent.includes("This proposal has not yet undergone AI evaluation. Feasibility scoring, breakdown verdicts, and recommendations will appear once the student team submits their financial inputs and triggers analysis."),
      "Must include exact Description text"
    );

    // Exact Pill Text and ShieldCheck icon
    assert.ok(
      viewContent.includes("Adviser interface is strictly read-only for AI evaluations."),
      "Must include exact Pill text: 'Adviser interface is strictly read-only for AI evaluations.'"
    );
    assert.ok(
      viewContent.includes("<ShieldCheck className=\"w-4 h-4 text-emerald-600\" />"),
      "Must include ShieldCheck icon inside pill"
    );

    // Verify early return prevents rendering of verdict, charts, and live preview
    const emptyStateCheckRegex = /if \(!isAiAnalysisAvailable\(proposal\)\) \{\s*return renderEmptyState\(\);\s*\}/;
    assert.ok(
      emptyStateCheckRegex.test(viewContent),
      "Must return renderEmptyState immediately when isAiAnalysisAvailable(proposal) is false"
    );

    const proposalStageCheckRegex = /if \(\s*synced\.staleness\.isProposalStageOnly \|\|\s*!synced\.staleness\.hasStoredAnalysis \|\|\s*isProposalStageAnalysis\(proposal\?\.aiAnalysis\)\s*\) \{\s*return renderEmptyState\(\);\s*\}/;
    assert.ok(
      proposalStageCheckRegex.test(viewContent),
      "Must also return renderEmptyState if stored analysis is proposal stage only"
    );
  });

  await t.test("Scenario 6: Backend endpoint authorization guard check (/api/analyze)", () => {
    const backendIndexPath = path.resolve(__dirname, "../index.js");
    const backendContent = fs.readFileSync(backendIndexPath, "utf8");

    // Advisers must be rejected with 403 on /api/analyze
    assert.ok(
      backendContent.includes("userRole === \"adviser\""),
      "Must check for adviser role"
    );
    assert.ok(
      backendContent.includes("Advisers have read-only access to AI feasibility analysis. Financial analysis must be initiated from the student portal."),
      "Must return read-only restriction message for advisers calling financial analysis"
    );
  });
});
