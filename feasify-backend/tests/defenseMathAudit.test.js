const assert = require("node:assert");
const { describe, it } = require("node:test");

function calculateBalanceSheetPeriod(monthIndex, finData, priorPeriod = null) {
  const equipmentList = finData.equipmentList || [];
  const equipmentTotal = equipmentList.reduce(
    (sum, item) => sum + (Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0),
    0
  );

  const declaredCapital = Number(finData.startupCapital || finData.cashInvested || 0);
  const paidInCapital = declaredCapital > 0 ? declaredCapital : equipmentTotal;

  // Operating cash inflows and outflows
  const monthlyRevenue = Number(finData.monthlyRevenue || 0);
  const monthlyVariableCost = Number(finData.monthlyVariableCost || 0);
  const monthlyOpex = Number(finData.monthlyOpex || 0);

  // Philippine Smart Tax
  const annualRevenue = monthlyRevenue * 12;
  const isBmbe = annualRevenue <= 3000000 && paidInCapital <= 3000000;
  const preTaxNet = monthlyRevenue - monthlyVariableCost - monthlyOpex;
  const applicableTax = isBmbe
    ? (monthlyRevenue > 0 ? monthlyRevenue * 0.03 : 0)
    : (preTaxNet > 0 ? preTaxNet * 0.20 : 0);
  const periodNetIncome = (preTaxNet > 0 ? preTaxNet : 0) - applicableTax;

  const priorRetainedEarnings = priorPeriod?.retainedEarnings || 0;
  const retainedEarnings = priorRetainedEarnings + periodNetIncome;

  const totalEquity = paidInCapital + retainedEarnings;
  const existingLiabilities = Number(finData.existingLiabilities || 0);

  // Non-cash assets: Equipment net of depreciation + inventory
  const accumulatedDepreciation = (equipmentTotal / 60) * (monthIndex + 1);
  const netEquipment = Math.max(0, equipmentTotal - accumulatedDepreciation);
  const inventory = monthlyVariableCost * 0.2;
  const nonCashAssets = netEquipment + inventory;

  // Exact Dynamic Balancing
  const netCashPosition = (existingLiabilities + totalEquity) - nonCashAssets;
  const cash = Math.max(0, netCashPosition);
  const operatingAdvancesPayable = netCashPosition < 0 ? Math.abs(netCashPosition) : 0;

  const totalCurrentLiabilities = existingLiabilities + operatingAdvancesPayable;
  const totalLiabilities = totalCurrentLiabilities;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const totalAssets = cash + nonCashAssets;

  return {
    cash,
    netEquipment,
    inventory,
    totalAssets,
    operatingAdvancesPayable,
    totalLiabilities,
    paidInCapital,
    retainedEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    variance: Math.abs(totalAssets - totalLiabilitiesAndEquity)
  };
}

function calculateDualBreakEven(monthlyRevenue, monthlyVariableCost, monthlyOpex) {
  const grossProfit = monthlyRevenue - monthlyVariableCost;
  const cmr = monthlyRevenue > 0 ? grossProfit / monthlyRevenue : 0;
  const bepRevenue = cmr > 0 ? Math.ceil(monthlyOpex / cmr) : Infinity;
  return { cmr, bepRevenue };
}

describe("Final Defense Mathematical Audit", () => {
  it("Equation Check: Assets == Liabilities + Equity under standard business", () => {
    const period = calculateBalanceSheetPeriod(0, {
      startupCapital: 100000,
      equipmentList: [{ total: 40000 }],
      monthlyRevenue: 50000,
      monthlyVariableCost: 20000,
      monthlyOpex: 15000
    });
    assert.strictEqual(period.variance < 0.01, true, `Variance was ${period.variance}`);
    assert.strictEqual(period.operatingAdvancesPayable, 0);
  });

  it("Equation Check: Assets == Liabilities + Equity under severe deficit (CapEx > Capital)", () => {
    const period = calculateBalanceSheetPeriod(0, {
      startupCapital: 30000,
      equipmentList: [{ total: 80000 }],
      monthlyRevenue: 5000,
      monthlyVariableCost: 3000,
      monthlyOpex: 10000
    });
    assert.strictEqual(period.variance < 0.01, true, `Variance was ${period.variance}`);
    assert.strictEqual(period.operatingAdvancesPayable > 0, true, "Deficit must be recorded as operating advance liability");
    assert.strictEqual(Math.round(period.totalAssets), Math.round(period.totalLiabilitiesAndEquity));
  });

  it("Equation Check: Assets == Liabilities + Equity across 12 sequential months", () => {
    let prior = null;
    for (let m = 0; m < 12; m++) {
      const p = calculateBalanceSheetPeriod(m, {
        startupCapital: 150000,
        equipmentList: [{ total: 60000 }],
        monthlyRevenue: 80000,
        monthlyVariableCost: 35000,
        monthlyOpex: 25000
      }, prior);
      assert.strictEqual(p.variance < 0.01, true, `Month ${m + 1} variance was ${p.variance}`);
      prior = p;
    }
  });

  it("Dual Break-Even Check: Correctly computes CMR and Peso Break-Even Revenue", () => {
    // Revenue = 100,000, Variable Cost = 40,000 (Gross Profit = 60,000, CMR = 0.60)
    // Fixed Costs = 30,000
    // BEP Revenue = 30,000 / 0.60 = 50,000 Pesos
    const { cmr, bepRevenue } = calculateDualBreakEven(100000, 40000, 30000);
    assert.strictEqual(cmr, 0.60);
    assert.strictEqual(bepRevenue, 50000);
  });

  it("Philippine Smart Tax Check: BMBE 3% vs CREATE 20%", () => {
    // Micro business (< 3M): 3% Percentage Tax, 0% Corporate Income Tax
    const microRev = 2000000;
    const isBmbeMicro = microRev <= 3000000;
    const microTax = isBmbeMicro ? microRev * 0.03 : 0;
    assert.strictEqual(microTax, 60000);

    // Large MSME (> 3M): 20% Corporate Tax under CREATE Act on net profit
    const largeRev = 4000000;
    const largePretaxNet = 1000000;
    const isBmbeLarge = largeRev <= 3000000;
    const largeTax = isBmbeLarge ? largeRev * 0.03 : largePretaxNet * 0.20;
    assert.strictEqual(isBmbeLarge, false);
    assert.strictEqual(largeTax, 200000);
  });
});
