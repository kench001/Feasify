const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

test("Auto Grouping Feasibility Check & Distribution", async (t) => {
  const tsPath = path.resolve(__dirname, "../../Feasify/src/utils/groupDistribution.ts");
  const moduleUrl = pathToFileURL(tsPath).href;
  const { calculateGroupDistribution } = await import(moduleUrl);

  await t.test("AG-001: 20 students, min 3, max 5 -> 4 groups of 5", () => {
    const result = calculateGroupDistribution(20, 3, 5);
    assert.equal(result.valid, true);
    assert.deepEqual(result.groupSizes, [5, 5, 5, 5]);
    assert.equal(result.groupSizes.reduce((a, b) => a + b, 0), 20);
    result.groupSizes.forEach(size => {
      assert.ok(size >= 3 && size <= 5, `Size ${size} must be between 3 and 5`);
    });
  });

  await t.test("AG-001b: 12 students, min 3, max 4 -> 3 groups of 4", () => {
    const result = calculateGroupDistribution(12, 3, 4);
    assert.equal(result.valid, true);
    assert.deepEqual(result.groupSizes, [4, 4, 4]);
    assert.equal(result.groupSizes.reduce((a, b) => a + b, 0), 12);
  });

  await t.test("AG-002: 10 students, min 3, max 4 -> Groups of 3, 3, and 4", () => {
    const result = calculateGroupDistribution(10, 3, 4);
    assert.equal(result.valid, true);
    assert.equal(result.groupSizes.length, 3);
    assert.equal(result.groupSizes.reduce((a, b) => a + b, 0), 10);
    const sorted = [...result.groupSizes].sort();
    assert.deepEqual(sorted, [3, 3, 4]);
  });

  await t.test("AG-002b: 7 students, min 3, max 4 -> Groups of 3 and 4", () => {
    const result = calculateGroupDistribution(7, 3, 4);
    assert.equal(result.valid, true);
    assert.equal(result.groupSizes.length, 2);
    assert.equal(result.groupSizes.reduce((a, b) => a + b, 0), 7);
    const sorted = [...result.groupSizes].sort();
    assert.deepEqual(sorted, [3, 4]);
  });

  await t.test("AG-003: 5 students, min 3, max 4 -> No valid grouping", () => {
    const result = calculateGroupDistribution(5, 3, 4);
    assert.equal(result.valid, false);
    assert.ok(result.error);
    assert.match(result.error, /cannot be divided into groups of 3 to 4 members/i);
  });

  await t.test("AG-003b: 2 students, min 3, max 5 -> No valid grouping", () => {
    const result = calculateGroupDistribution(2, 3, 5);
    assert.equal(result.valid, false);
    assert.ok(result.error);
    assert.match(result.error, /cannot be divided into groups of 3 to 5 members/i);
  });

  await t.test("Edge case: 0 or negative students or min > max", () => {
    assert.equal(calculateGroupDistribution(0, 3, 4).valid, false);
    assert.equal(calculateGroupDistribution(10, 5, 4).valid, false);
  });
});
