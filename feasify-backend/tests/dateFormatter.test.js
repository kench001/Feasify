const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

test("Standardized Business Proposal Date Formatter", async (t) => {
  const tsPath = path.resolve(__dirname, "../../Feasify/src/utils/dateFormatter.ts");
  const moduleUrl = pathToFileURL(tsPath).href;
  const { formatDisplayDate, formatDisplayDateTime, formatProposalDate } = await import(moduleUrl);

  await t.test("DT-001: Formats date-only correctly to 'Month Day, Year' (November 11, 2026)", () => {
    // 2026-11-11 UTC should stay November 11, 2026 without shifting
    const formatted = formatDisplayDate("2026-11-11");
    assert.equal(formatted, "November 11, 2026");
  });

  await t.test("DT-001b: Formats ISO timestamp with time to 'November 11, 2026, 2:30 PM' in Asia/Manila", () => {
    // 06:30 UTC is 14:30 (2:30 PM) in Asia/Manila (UTC+8)
    const formatted = formatDisplayDateTime("2026-11-11T06:30:00Z");
    assert.equal(formatted, "November 11, 2026, 2:30 PM");
  });

  await t.test("DT-001c: Formats Firestore Timestamp with toDate() or toMillis()", () => {
    const mockTimestamp = {
      toMillis: () => new Date("2026-11-11T06:30:00Z").getTime(),
      toDate: () => new Date("2026-11-11T06:30:00Z")
    };
    const formattedDate = formatDisplayDate(mockTimestamp);
    assert.equal(formattedDate, "November 11, 2026");

    const formattedTime = formatDisplayDateTime(mockTimestamp);
    assert.equal(formattedTime, "November 11, 2026, 2:30 PM");
  });

  await t.test("DT-001d: formatProposalDate handles proposal objects", () => {
    const proposal = {
      submissionDate: "2026-11-11T06:30:00Z",
      status: "Submitted"
    };
    assert.equal(formatProposalDate(proposal), "November 11, 2026");
    assert.equal(formatProposalDate(proposal, true), "November 11, 2026, 2:30 PM");

    const draft = { status: "Draft" };
    assert.equal(formatProposalDate(draft), "Draft (Not submitted)");
  });

  await t.test("DT-001e: Handles null, undefined, and invalid inputs gracefully", () => {
    assert.equal(formatDisplayDate(null), "N/A");
    assert.equal(formatDisplayDate(undefined), "N/A");
    assert.equal(formatDisplayDate("invalid-date-string"), "N/A");
  });
});
