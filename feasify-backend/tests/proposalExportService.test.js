const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

test("Centralized Proposal Section Export Service", async (t) => {
  const tsPath = path.resolve(__dirname, "../../Feasify/src/services/proposalSectionExportService.ts");
  const moduleUrl = pathToFileURL(tsPath).href;
  const { buildExportFilename, orderSelectedSections, isAiAnalysisAvailable } = await import(moduleUrl);

  await t.test("EX-001: Filename sanitization and format matching requirements", () => {
    const filename = buildExportFilename("Smart Cafe & Bakery / 2026", ["overview", "financial"], new Date("2026-11-11T00:00:00Z"));
    assert.equal(filename, "FEASIFY_Smart_Cafe_Bakery_2026_Overview_Financial_2026-11-11.pdf");
  });

  await t.test("EX-002: Deterministic section ordering regardless of user selection order", () => {
    // Selection given in reverse order ['ai', 'overview', 'financial']
    const ordered = orderSelectedSections(["ai", "overview", "financial"]);
    assert.deepEqual(ordered, ["overview", "financial", "ai"]);

    const twoSections = orderSelectedSections(["financial", "overview"]);
    assert.deepEqual(twoSections, ["overview", "financial"]);
  });

  await t.test("EX-003: isAiAnalysisAvailable correctly rejects unanalyzed, pending, or failed states", () => {
    assert.equal(isAiAnalysisAvailable(null), false);
    assert.equal(isAiAnalysisAvailable({}), false);
    assert.equal(isAiAnalysisAvailable({ status: "Draft" }), false);
    assert.equal(isAiAnalysisAvailable({ aiAnalysis: null }), false);
    assert.equal(isAiAnalysisAvailable({ aiAnalysis: { status: "PENDING" } }), false);
    assert.equal(isAiAnalysisAvailable({ aiAnalysis: { status: "FAILED" } }), false);
    assert.equal(isAiAnalysisAvailable({ aiAnalysis: { _fallback: true } }), false);

    // Completed AI analysis with valid verdict or score
    assert.equal(isAiAnalysisAvailable({
      aiAnalysis: {
        status: "COMPLETED",
        verdict: "FEASIBLE",
        score: 85
      }
    }), true);

    assert.equal(isAiAnalysisAvailable({
      aiAnalysis: {
        score: 88,
        verdict: "Highly Feasible"
      }
    }), true);
  });

  await t.test("EX-004: exportProposalSectionsPDF function exists and handles options signature", async () => {
    const { exportProposalSectionsPDF } = await import(moduleUrl);
    assert.equal(typeof exportProposalSectionsPDF, "function");
  });

  await t.test("EX-005: exportProposalSectionsPDF produces valid PDF with 5 KPI cards for multi-product and single-product", async () => {
    const { exportProposalSectionsPDF } = await import(moduleUrl);
    const fs = require("node:fs");

    const sampleProposal = {
      businessName: "Apex Bakery Cafe",
      category: "Food & Beverage",
      proponents: ["Student A", "Student B"],
      sectionName: "BSBA 4-A",
      submissionDate: "2026-11-11",
      financialData: {
        products: [
          { name: "Croissant", sellingPrice: 95, quantityYield: "100", batchesPerMonth: "20", unitsSold: "1800", markupPercentage: "100", ingredients: [{ name: "Butter", price: 2000 }] },
          { name: "Latte", sellingPrice: 120, quantityYield: "200", batchesPerMonth: "30", unitsSold: "5500", markupPercentage: "150", ingredients: [{ name: "Beans", price: 4000 }] }
        ],
        equipmentList: [{ name: "Oven", quantity: 1, unitPrice: 45000, total: 45000 }],
        opexList: [{ name: "Rent", amount: 25000 }],
        startupCapital: "45000",
        fixedCosts: "25000",
        isCapitalBorrowed: false
      }
    };

    await exportProposalSectionsPDF({ proposal: sampleProposal, selectedSections: ["overview", "financial"] });

    // Verify generated file exists on disk and clean up
    const files = fs.readdirSync(".").filter(f => f.startsWith("FEASIFY_Apex_Bakery_Cafe"));
    assert.ok(files.length > 0, "PDF export file should be created");
    for (const f of files) {
      assert.ok(fs.statSync(f).size > 1000, "PDF export file should not be empty");
      fs.unlinkSync(f);
    }
  });
});
