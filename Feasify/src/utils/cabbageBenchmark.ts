import type { ProductCostingItem, ContributorItem, OpexItem, EquipmentItem } from "./productCosting";

export interface MrCabbageBenchmark {
  title: string;
  institution: string;
  location: string;
  baseYear: number;
  projectionYears: number[];
  initialCapital: number;
  cashInvested: number;
  propertyInvested: number;
  propertyInvestedNote: string;
  projectCost: number;
  cashReserve: number;
  contributors: ContributorItem[];
  products: ProductCostingItem[];
  equipmentList: EquipmentItem[];
  opexList: OpexItem[];
  rentAdvanceDeposit: number;
  trainingsPrograms: number;
  advertisingExpense: number;
  salariesExpenseInitial: number;
  renovationCosts: number;
  permitsLicensesInitial: number;
  operatingDays: number;
  directCompetitors: string[];
  otherCompetitors: string[];
  nearbyEstablishments: string[];
  targetDemographics: string[];
}

export const MR_CABBAGE_BENCHMARK: MrCabbageBenchmark = {
  title: "Mr. Cabbage (Brassica Foods)",
  institution: "Pamantasan ng Lungsod ng Valenzuela (PLV) - College of Business Administration",
  location: "C&B Mall, Maysan Road, Malinta, Valenzuela City",
  baseYear: 2025,
  projectionYears: [2026, 2027, 2028, 2029, 2030],
  initialCapital: 900000,
  cashInvested: 700000,
  propertyInvested: 200000,
  propertyInvestedNote: "Cooking Machineries (₱100,000) & Logistics Services (₱100,000)",
  projectCost: 860603,
  cashReserve: 39397,
  operatingDays: 360,

  contributors: [
    { id: "contrib-1", name: "Jester Handel Gamol", role: "Managing Partner / Store Manager", amount: 100000 },
    { id: "contrib-2", name: "Jomae-Ann Artacho", role: "Accounting Specialist", amount: 100000 },
    { id: "contrib-3", name: "Rizel Grace Camingawan", role: "Cashier Staff", amount: 100000 },
    { id: "contrib-4", name: "Maui Ann De Galicia", role: "Logistics Manager", amount: 100000 },
    { id: "contrib-5", name: "Adrian Ralph Gonzales", role: "Marketing Specialist", amount: 100000 },
    { id: "contrib-6", name: "Mary Jane Padilla", role: "Capitalist Partner", amount: 100000 },
    { id: "contrib-7", name: "Cristina Paula Sy", role: "Capitalist Partner", amount: 100000 },
    { id: "contrib-8", name: "Sheena Laurice Quitoles", role: "Industrial Partner (Machineries)", amount: 100000 },
    { id: "contrib-9", name: "Gerald Valenzuela", role: "Industrial Partner (Logistics)", amount: 100000 },
  ],

  products: [
    {
      id: "cabbage-chicken-snack",
      name: "Cabbage Chicken Snack",
      quantityYield: "1",
      batchesPerMonth: "13545",
      unitsSold: "13545",
      ingredients: [
        { id: "ing-1", name: "Napa Cabbage (0.4g)", price: 2.00, category: "ingredient" },
        { id: "ing-2", name: "Chicken Breast (0.25kg)", price: 3.67, category: "ingredient" },
        { id: "ing-3", name: "Carrot & Aromatics (Onion, Garlic, Celery)", price: 1.50, category: "ingredient" },
        { id: "ing-4", name: "Seasonings & Spices", price: 2.00, category: "ingredient" },
      ],
      markupPercentage: "118",
      sellingPrice: "20.00",
      productionCost: "9.17",
      unitCost: "9.17",
      applyVat: false,
    },
    {
      id: "cabbage-pork-snack",
      name: "Cabbage Pork Snack",
      quantityYield: "1",
      batchesPerMonth: "9850",
      unitsSold: "9850",
      ingredients: [
        { id: "ing-p1", name: "Napa Cabbage (0.4g)", price: 2.00, category: "ingredient" },
        { id: "ing-p2", name: "Pork Kasim (0.25kg)", price: 5.33, category: "ingredient" },
        { id: "ing-p3", name: "Carrots, Onion, Garlic & Celery", price: 1.50, category: "ingredient" },
        { id: "ing-p4", name: "Seasonings & Spices", price: 3.17, category: "ingredient" },
      ],
      markupPercentage: "67",
      sellingPrice: "20.00",
      productionCost: "12.00",
      unitCost: "12.00",
      applyVat: false,
    },
    {
      id: "cabbage-tofu-snack",
      name: "Cabbage Tofu Snack",
      quantityYield: "1",
      batchesPerMonth: "4200",
      unitsSold: "4200",
      ingredients: [
        { id: "ing-t1", name: "Napa Cabbage", price: 2.00, category: "ingredient" },
        { id: "ing-t2", name: "Fresh Tofu Cubes", price: 4.50, category: "ingredient" },
        { id: "ing-t3", name: "Vegetable Fillers & Aromatics", price: 1.50, category: "ingredient" },
        { id: "ing-t4", name: "Seasonings", price: 2.83, category: "ingredient" },
      ],
      markupPercentage: "85",
      sellingPrice: "20.00",
      productionCost: "10.83",
      unitCost: "10.83",
      applyVat: false,
    },
    {
      id: "chao-chicken-alacarte",
      name: "Chao Chicken Ala Carte",
      quantityYield: "1",
      batchesPerMonth: "3280",
      unitsSold: "3280",
      ingredients: [
        { id: "ing-cc1", name: "2 pcs Cabbage Chicken Rolls", price: 18.34, category: "ingredient" },
        { id: "ing-cc2", name: "1 Cup Chao Egg Fried Rice", price: 13.41, category: "ingredient" },
      ],
      markupPercentage: "86",
      sellingPrice: "59.00",
      productionCost: "31.75",
      unitCost: "31.75",
      applyVat: false,
    },
    {
      id: "chao-pork-alacarte",
      name: "Chao Pork Ala Carte",
      quantityYield: "1",
      batchesPerMonth: "2500",
      unitsSold: "2500",
      ingredients: [
        { id: "ing-cp1", name: "2 pcs Cabbage Pork Rolls", price: 24.00, category: "ingredient" },
        { id: "ing-cp2", name: "1 Cup Chao Egg Fried Rice", price: 13.41, category: "ingredient" },
      ],
      markupPercentage: "58",
      sellingPrice: "59.00",
      productionCost: "37.41",
      unitCost: "37.41",
      applyVat: false,
    },
    {
      id: "chao-chicken-bundle",
      name: "Chao Chicken Bundle (Meal + 16oz Drink)",
      quantityYield: "1",
      batchesPerMonth: "2174",
      unitsSold: "2174",
      ingredients: [
        { id: "ing-cb1", name: "2 pcs Cabbage Chicken Rolls", price: 18.34, category: "ingredient" },
        { id: "ing-cb2", name: "1 Cup Chao Egg Fried Rice", price: 13.41, category: "ingredient" },
        { id: "ing-cb3", name: "16oz Refreshing Drink", price: 16.80, category: "ingredient" },
        { id: "ing-cb4", name: "Packaging & Condiments", price: 13.41, category: "miscellaneous" },
      ],
      markupPercentage: "44",
      sellingPrice: "89.00",
      productionCost: "61.96",
      unitCost: "61.96",
      applyVat: false,
    },
    {
      id: "friendship-combo",
      name: "Mr. Cabbage Friendship Combo (Good for 2)",
      quantityYield: "1",
      batchesPerMonth: "687",
      unitsSold: "687",
      ingredients: [
        { id: "ing-fc1", name: "4 pcs Cabbage Rolls Assorted", price: 42.67, category: "ingredient" },
        { id: "ing-fc2", name: "2 Cups Chao Egg Fried Rice", price: 26.82, category: "ingredient" },
        { id: "ing-fc3", name: "2 Glasses 16oz Beverage", price: 33.60, category: "ingredient" },
      ],
      markupPercentage: "64",
      sellingPrice: "169.00",
      productionCost: "103.09",
      unitCost: "103.09",
      applyVat: false,
    },
    {
      id: "lemon-cucumber-beverage",
      name: "Lemon Cucumber Juice (16oz)",
      quantityYield: "1",
      batchesPerMonth: "1400",
      unitsSold: "1400",
      ingredients: [
        { id: "ing-dr1", name: "Fresh Cucumber & Lemon Juice Powder", price: 16.50, category: "ingredient" },
        { id: "ing-dr2", name: "Mineral Water & Ice Cubes", price: 1.00, category: "ingredient" },
      ],
      markupPercentage: "49",
      sellingPrice: "25.00",
      productionCost: "17.50",
      unitCost: "17.50",
      applyVat: false,
    },
  ],

  equipmentList: [
    { id: "eq-1", name: "Single Gas Grill (Commercial)", quantity: 1, unitPrice: 1049, total: 1049 },
    { id: "eq-2", name: "Electric Commercial Rice Cooker (Large)", quantity: 1, unitPrice: 6000, total: 6000 },
    { id: "eq-3", name: "Chest Freezer 9 cu. ft.", quantity: 1, unitPrice: 14995, total: 14995 },
    { id: "eq-4", name: "POS Terminal System with Thermal Printer", quantity: 1, unitPrice: 10000, total: 10000 },
    { id: "eq-5", name: "Hikvision CCTV Security Dome Cameras", quantity: 2, unitPrice: 1352, total: 2704 },
    { id: "eq-6", name: "14-inch Gas Food Steamer (3-Layer)", quantity: 1, unitPrice: 1500, total: 1500 },
    { id: "eq-7", name: "Kyowa Water Dispenser (Hot & Cold)", quantity: 1, unitPrice: 5530, total: 5530 },
    { id: "eq-8", name: "Wooden Dining Round Tables", quantity: 4, unitPrice: 874, total: 3496 },
    { id: "eq-9", name: "Ergonomic Dining PP Chairs", quantity: 8, unitPrice: 375, total: 3000 },
    { id: "eq-10", name: "High Bar Counter Stools", quantity: 4, unitPrice: 489, total: 1956 },
    { id: "eq-11", name: "Kitchen Utensils & Food Safety Gear", quantity: 1, unitPrice: 2220, total: 2220 },
  ],

  opexList: [
    { id: "opex-rent", name: "Rent Expense (C&B Mall Stall)", category: "Facility & Lease", amount: 30000, isPreset: true },
    { id: "opex-salaries", name: "Salaries & Wages (2 Crew + 1 Cashier)", category: "Payroll & Labor", amount: 32869.50, isPreset: true },
    { id: "opex-allowance", name: "Partner & Staff Monthly Allowance", category: "Payroll & Labor", amount: 25396, isPreset: true },
    { id: "opex-electricity", name: "Electricity & Power (MERALCO)", category: "Utilities", amount: 5000, isPreset: true },
    { id: "opex-water", name: "Water & Sanitation (Maynilad)", category: "Utilities", amount: 2000, isPreset: true },
    { id: "opex-internet", name: "Internet & Telecommunication (Globe)", category: "Utilities & Tech", amount: 1500, isPreset: true },
    { id: "opex-marketing", name: "Marketing, Social Media Boost & Flyers", category: "Marketing & Growth", amount: 1200, isPreset: true },
    { id: "opex-supplies", name: "Packaging, Cleaning & Store Supplies", category: "Consumables", amount: 15676.83, isPreset: true },
    { id: "opex-maintenance", name: "Equipment Maintenance & Sanitation", category: "Facility Upkeep", amount: 1500, isPreset: true },
    { id: "opex-misc", name: "Mandatory Benefits Reserve (SSS/PHIC/HDMF)", category: "Admin & Misc", amount: 28262.96, isPreset: true },
  ],

  rentAdvanceDeposit: 150000,
  trainingsPrograms: 32400,
  advertisingExpense: 2442,
  salariesExpenseInitial: 116531,
  renovationCosts: 335400,
  permitsLicensesInitial: 3925,

  directCompetitors: ["Master Siomai", "Rice in a Box (RBX)", "Turks", "Shawarma Shack", "Paotsin"],
  otherCompetitors: ["Chowking", "Siomai House", "Dunkin Donuts", "Local Street Kariton"],
  nearbyEstablishments: ["C&B Mall Valenzuela", "South Supermarket", "PLV CPAG Campus", "PLV Annex", "Child of Mary Immaculate College (CMIC)", "Mercury Drug Malinta"],
  targetDemographics: ["Students (15-24)", "Employed Individuals (20-45)", "Self-employed Workers (25-50)", "Low to Lower-Middle Income Class (₱10,957 - ₱43,828/mo)"],
};
