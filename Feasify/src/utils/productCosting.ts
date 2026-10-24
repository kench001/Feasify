import React from "react";

export interface IngredientItem {
  id: string;
  name: string;
  price: number | string;
  category?: "ingredient" | "labor" | "miscellaneous";
}

export interface ProductCostingItem {
  id: string;
  name: string;
  quantityYield: string;
  batchesPerMonth?: string;
  unitsSold?: string;
  ingredients: IngredientItem[];
  markupPercentage: string;
  sellingPrice?: string;
  productionCost?: string;
  unitCost?: string;
  applyVat?: boolean;
  vatRate?: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  quantity: number | string;
  unitPrice: number | string;
  total: number;
}

export interface OpexItem {
  id: string;
  name: string;
  amount: number;
  category?: string;
  isPreset?: boolean;
}

export const PREDETERMINED_OPEX_ITEMS: OpexItem[] = [
  { id: "opex-rent", name: "Rent Expense (Space / Stall Rental)", category: "Facility & Lease", amount: 0, isPreset: true },
  { id: "opex-salaries", name: "Salaries & Wages (Operating Staff)", category: "Payroll & Labor", amount: 0, isPreset: true },
  { id: "opex-electricity", name: "Electricity & Power", category: "Utilities", amount: 0, isPreset: true },
  { id: "opex-water", name: "Water & Sanitation", category: "Utilities", amount: 0, isPreset: true },
  { id: "opex-internet", name: "Internet, Telecom & Communication", category: "Utilities & Tech", amount: 0, isPreset: true },
  { id: "opex-marketing", name: "Marketing, Signage & Promotions", category: "Marketing & Growth", amount: 0, isPreset: true },
  { id: "opex-transport", name: "Transportation, Delivery & Fuel", category: "Logistics", amount: 0, isPreset: true },
  { id: "opex-supplies", name: "Store, Office & Packaging Supplies", category: "Consumables", amount: 0, isPreset: true },
  { id: "opex-maintenance", name: "Equipment Maintenance & Repairs", category: "Facility Upkeep", amount: 0, isPreset: true },
  { id: "opex-misc", name: "Miscellaneous & Contingency Buffer", category: "Admin & Misc", amount: 0, isPreset: true },
];

export const normalizeOpexList = (rawOpex?: any[]): OpexItem[] => {
  if (!rawOpex || !Array.isArray(rawOpex) || rawOpex.length === 0) {
    return PREDETERMINED_OPEX_ITEMS.map((item) => ({ ...item }));
  }

  // If user only had legacy General OpEx
  if (rawOpex.length === 1 && rawOpex[0].name === "General OpEx") {
    const list = PREDETERMINED_OPEX_ITEMS.map((item) => ({ ...item }));
    if (Number(rawOpex[0].amount) > 0) {
      list[0].amount = Number(rawOpex[0].amount);
    }
    return list;
  }

  const existingMap = new Map<string, any>();
  const customItems: OpexItem[] = [];

  rawOpex.forEach((item, idx) => {
    const key = (item.id || item.name || "").toLowerCase().trim();
    if (key) {
      existingMap.set(key, item);
      if (item.name) {
        existingMap.set(item.name.toLowerCase().trim(), item);
      }
    }
    const isMatchingPreset = PREDETERMINED_OPEX_ITEMS.some(
      (p) =>
        p.id.toLowerCase() === (item.id || "").toLowerCase() ||
        p.name.toLowerCase() === (item.name || "").toLowerCase() ||
        (item.name && item.name.toLowerCase().includes(p.name.toLowerCase()))
    );
    if (!isMatchingPreset && item.name && item.name !== "General OpEx") {
      customItems.push({
        id: item.id || `custom-opex-${idx}-${Date.now()}`,
        name: item.name,
        amount: Number(item.amount) || 0,
        category: item.category || "Custom Expense",
        isPreset: false,
      });
    }
  });

  const result: OpexItem[] = PREDETERMINED_OPEX_ITEMS.map((preset) => {
    const found =
      existingMap.get(preset.id.toLowerCase()) ||
      existingMap.get(preset.name.toLowerCase()) ||
      rawOpex.find(
        (o) =>
          o.name &&
          (o.name.toLowerCase().includes(preset.id.replace("opex-", "")) ||
            preset.name.toLowerCase().includes(o.name.toLowerCase()))
      );
    return {
      ...preset,
      amount: found ? Number(found.amount) || 0 : 0,
      name: found && found.name ? found.name : preset.name,
    };
  });

  return [...result, ...customItems];
};

export interface ContributorItem {
  id: string;
  name: string;
  amount: number | string;
}

export const autoDistributeContributors = (
  count: number | string,
  totalCapital: number | string,
  existingList?: ContributorItem[]
): ContributorItem[] => {
  const numCount = Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));
  const totalCapNum = Number(totalCapital) || 0;
  const evenShare = totalCapNum > 0 ? Math.floor((totalCapNum / numCount) * 100) / 100 : 0;
  const remainder = Math.round((totalCapNum - (evenShare * numCount)) * 100) / 100;

  const result: ContributorItem[] = [];
  for (let i = 0; i < numCount; i++) {
    const prevName = existingList && existingList[i]?.name ? existingList[i].name : `Investor / Partner ${i + 1}`;
    const amount = i === numCount - 1 ? Math.round((evenShare + remainder) * 100) / 100 : evenShare;
    result.push({
      id: existingList && existingList[i]?.id ? existingList[i].id : `contrib-${i + 1}`,
      name: prevName,
      amount: amount > 0 ? amount : "",
    });
  }
  return result;
};

export const normalizeContributors = (
  rawContributors?: any[],
  targetCount?: number | string,
  totalCapital?: number | string
): ContributorItem[] => {
  const count = Math.max(1, Number(targetCount) || (rawContributors && rawContributors.length) || 1);
  const totalCapNum = Number(totalCapital) || 0;

  if (rawContributors && Array.isArray(rawContributors) && rawContributors.length > 0) {
    const list: ContributorItem[] = rawContributors.map((c, idx) => ({
      id: c.id || `contrib-${idx + 1}`,
      name: c.name || `Investor / Partner ${idx + 1}`,
      amount: c.amount !== undefined && c.amount !== "" ? c.amount : 0,
    }));

    // If all amounts are zero and we have a totalCapital, auto-distribute
    const totalCurrentAmount = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    if (totalCurrentAmount === 0 && totalCapNum > 0) {
      return autoDistributeContributors(count, totalCapNum, list);
    }

    while (list.length < count) {
      const idx = list.length;
      list.push({
        id: `contrib-${idx + 1}-${Date.now()}`,
        name: `Investor / Partner ${idx + 1}`,
        amount: 0,
      });
    }
    return list.slice(0, count);
  }

  return autoDistributeContributors(count, totalCapNum);
};

export interface FinancialProposalData {
  products?: ProductCostingItem[];
  equipmentList?: EquipmentItem[];
  contributorsList?: ContributorItem[];
  contributorsCount?: string | number;
  isCapitalBorrowed?: boolean;
  interestRate?: string;
  productionCost?: string;
  quantityYield?: string;
  unitCost?: string;
  markupPercentage?: string;
  markupAmount?: string;
  computedSellingPrice?: string;
  sellingPrice?: string;
  monthlySales?: string;
  variableCost?: string;
  fixedCosts?: string;
  startupCapital?: string;
  operatingDays?: string;
  competitorCount?: number;
  marketDemand?: string;
  directCompetitors?: string[];
  otherCompetitors?: string[];
  competitorNotes?: string;
  nearbyEstablishments?: string[];
  targetDemographics?: string[];
  footTrafficPeak?: string;
  marketDemandNotes?: string;
  opexList?: OpexItem[];
}

export const handlePreventNegative = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
    e.preventDefault();
  }
};

export const handlePasteNonNegative = (e: React.ClipboardEvent<HTMLInputElement>) => {
  const pasteData = e.clipboardData.getData("text");
  if (Number(pasteData) < 0 || pasteData.includes("-")) {
    e.preventDefault();
  }
};

export const normalizeProposalProducts = (
  fin?: FinancialProposalData,
  fallbackName?: string,
  proposalFallbackProducts?: ProductCostingItem[]
): ProductCostingItem[] => {
  const targetProducts =
    fin?.products && fin.products.length > 0
      ? fin.products
      : proposalFallbackProducts && proposalFallbackProducts.length > 0
      ? proposalFallbackProducts
      : undefined;

  if (targetProducts && targetProducts.length > 0) {
    return targetProducts.map((p, idx) => ({
      id: p.id || `prod-${idx + 1}`,
      name: p.name !== undefined ? p.name : "",
      quantityYield: p.quantityYield !== undefined ? String(p.quantityYield) : "",
      batchesPerMonth: p.batchesPerMonth !== undefined ? String(p.batchesPerMonth) : "",
      unitsSold: p.unitsSold !== undefined ? String(p.unitsSold) : "",
      ingredients: p.ingredients || [],
      markupPercentage: p.markupPercentage !== undefined ? String(p.markupPercentage) : "100",
      sellingPrice: p.sellingPrice !== undefined ? String(p.sellingPrice) : "",
      applyVat: p.applyVat !== undefined ? Boolean(p.applyVat) : true,
      vatRate: p.vatRate !== undefined ? Number(p.vatRate) : 12,
    }));
  }
  const pCost = Number(fin?.productionCost) || 0;
  const qYield = fin?.quantityYield !== undefined ? String(fin.quantityYield) : "";
  const sPrice = fin?.sellingPrice !== undefined ? String(fin.sellingPrice) : "";
  const mPct = fin?.markupPercentage !== undefined ? String(fin.markupPercentage) : "100";
  
  return [{
    id: "prod-1",
    name: (fallbackName && fallbackName !== "Product 1") ? fallbackName : "",
    quantityYield: qYield,
    batchesPerMonth: "1",
    unitsSold: "",
    ingredients: pCost > 0 ? [{
      id: "ing-1",
      name: "Direct Production / Materials",
      price: pCost,
    }] : [],
    markupPercentage: mPct,
    sellingPrice: sPrice,
    applyVat: true,
    vatRate: 12,
  }];
};

export const computeProductMetrics = (product: ProductCostingItem, isProposal: boolean = false) => {
  const ingredients = product.ingredients || [];
  const totalIngredientCost = ingredients.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const totalBatchCost = totalIngredientCost > 0 
    ? totalIngredientCost 
    : (Number(product.productionCost) || 0);
  
  const batchYield = Number(product.quantityYield) || 0;
  const batchesPerMonth = (product.batchesPerMonth !== undefined && product.batchesPerMonth !== "" && !isNaN(Number(product.batchesPerMonth)) && Number(product.batchesPerMonth) > 0)
    ? Number(product.batchesPerMonth)
    : 1;

  // Total items produced in the period (Ilan ang nagawa)
  const totalUnitsProduced = batchYield * batchesPerMonth;

  // In proposal mode, unitsSold = 100% batch yield. In actual financial input tracking, use actual unitsSold if entered.
  const unitsSold = isProposal
    ? totalUnitsProduced
    : (product.unitsSold !== undefined && product.unitsSold !== "" && !isNaN(Number(product.unitsSold)))
      ? Math.min(totalUnitsProduced > 0 ? totalUnitsProduced : Infinity, Math.max(0, Number(product.unitsSold)))
      : totalUnitsProduced;
  
  const unitCost = batchYield > 0 ? totalBatchCost / batchYield : 0;
  const totalMonthlyProductionCost = totalBatchCost * batchesPerMonth;
  const cogsSold = unitCost * unitsSold;

  const unsoldUnits = Math.max(0, totalUnitsProduced - unitsSold);
  const endingInventoryValue = unsoldUnits * unitCost;
  
  const markupPct = Number(product.markupPercentage) || 0;
  const markupAmount = unitCost * (markupPct / 100);
  const computedBasePrice = unitCost + markupAmount; // VAT-exclusive base price
  
  const applyVat = product.applyVat !== false;
  const vatRate = product.vatRate !== undefined ? Number(product.vatRate) : 12;
  const vatMultiplier = applyVat ? (vatRate / 100) : 0;
  
  const vatAmountPerUnit = computedBasePrice * vatMultiplier;
  const computedVatInclusivePrice = computedBasePrice + vatAmountPerUnit;
  
  const suggestedSellingPrice = applyVat ? computedVatInclusivePrice : computedBasePrice;
  
  const rawSellingPrice = (product.sellingPrice !== undefined && product.sellingPrice !== "" && !isNaN(Number(product.sellingPrice)))
    ? Number(product.sellingPrice)
    : (suggestedSellingPrice > 0 ? Number(suggestedSellingPrice.toFixed(2)) : 0);
  
  const sellingPrice = rawSellingPrice;
  
  // Consumer price is VAT-inclusive if VAT is applied (Philippine Price Tag Law / RA 7394)
  const netSellingPrice = applyVat && vatMultiplier > 0
    ? sellingPrice / (1 + vatMultiplier)
    : sellingPrice;
  
  const unitVatAmount = sellingPrice - netSellingPrice;
  const totalVat = unitVatAmount * unitsSold;
  
  // Total cash collected from customers (gross receipts)
  const grossReceipts = sellingPrice * unitsSold;
  
  // Philippine GAAP & BIR Financial Management: Revenue is Net Sales of units sold (excluding 12% Output VAT)
  const revenue = netSellingPrice * unitsSold;
  const grossProfit = revenue - cogsSold;
  
  return {
    totalBatchCost,
    batchYield,
    batchesPerMonth,
    totalUnitsProduced,
    unitsSold,
    unsoldUnits,
    endingInventoryValue,
    totalMonthlyProductionCost,
    cogsSold,
    unitCost,
    markupPct,
    markupAmount,
    computedBasePrice,
    applyVat,
    vatRate,
    vatAmountPerUnit,
    computedVatInclusivePrice,
    suggestedSellingPrice,
    sellingPrice,
    netSellingPrice,
    unitVatAmount,
    totalVat,
    grossReceipts,
    revenue,
    grossProfit,
  };
};
