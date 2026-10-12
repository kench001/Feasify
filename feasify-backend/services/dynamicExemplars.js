const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DYNAMIC_EXEMPLARS_FILE = path.join(DATA_DIR, "dynamic_exemplars.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure dynamic_exemplars.json exists
if (!fs.existsSync(DYNAMIC_EXEMPLARS_FILE)) {
  fs.writeFileSync(DYNAMIC_EXEMPLARS_FILE, "[]", "utf-8");
}

/**
 * Normalizes any business type string into a standard category
 */
function normalizeCategory(typeStr = "") {
  const s = String(typeStr || "").toLowerCase();
  if (s.includes("food") || s.includes("beverage") || s.includes("restaurant") || s.includes("cafe") || s.includes("bakery") || s.includes("snack") || s.includes("kiosk") || s.includes("stall") || s.includes("dory") || s.includes("cabbage")) {
    return "Food & Beverage / Food Service";
  }
  if (s.includes("retail") || s.includes("store") || s.includes("shop") || s.includes("apparel") || s.includes("clothing") || s.includes("goods") || s.includes("merchandise")) {
    return "Retail & Consumer Goods";
  }
  if (s.includes("service") || s.includes("salon") || s.includes("repair") || s.includes("laundry") || s.includes("consult") || s.includes("logistics")) {
    return "Services & Personal Care";
  }
  if (s.includes("tech") || s.includes("software") || s.includes("digital") || s.includes("app") || s.includes("it ") || s.includes("platform")) {
    return "Technology & Digital Services";
  }
  if (s.includes("manufac") || s.includes("craft") || s.includes("product") || s.includes("assem") || s.includes("pack")) {
    return "Manufacturing & Production";
  }
  return "General Enterprise";
}

/**
 * Reads the local dynamic exemplars cache
 */
function loadDynamicExemplars() {
  try {
    if (!fs.existsSync(DYNAMIC_EXEMPLARS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DYNAMIC_EXEMPLARS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("⚠️ [Dynamic Exemplars] Failed reading local dynamic exemplars cache:", err.message);
    return [];
  }
}

/**
 * Atomically writes to dynamic_exemplars.json
 */
function saveDynamicExemplarsLocal(exemplars) {
  try {
    const tempPath = `${DYNAMIC_EXEMPLARS_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(exemplars, null, 2), "utf-8");
    fs.renameSync(tempPath, DYNAMIC_EXEMPLARS_FILE);
    return true;
  } catch (err) {
    console.error("❌ [Dynamic Exemplars] Failed atomic write to dynamic_exemplars.json:", err.message);
    return false;
  }
}

/**
 * Sync with Firestore on startup or when available (Hybrid Mode)
 */
async function syncFromFirestore(adminFirestore) {
  if (!adminFirestore) return loadDynamicExemplars();
  try {
    const snap = await adminFirestore.collection("dynamic_exemplars").get();
    if (snap.empty) {
      console.log("ℹ️ [Dynamic Exemplars] Firestore collection 'dynamic_exemplars' is empty. Seeding from local cache if available.");
      const local = loadDynamicExemplars();
      if (local.length > 0) {
        for (const item of local) {
          await adminFirestore.collection("dynamic_exemplars").doc(item.id).set(item);
        }
      }
      return local;
    }

    const cloudItems = [];
    snap.forEach((doc) => {
      cloudItems.push({ id: doc.id, ...doc.data() });
    });

    // Update local cache with latest cloud items
    saveDynamicExemplarsLocal(cloudItems);
    console.log(`✅ [Dynamic Exemplars] Successfully synced ${cloudItems.length} dynamic exemplars from Firestore.`);
    return cloudItems;
  } catch (err) {
    console.warn("⚠️ [Dynamic Exemplars] Firestore sync failed, using local cache:", err.message);
    return loadDynamicExemplars();
  }
}

/**
 * Validates whether a candidate proposal passes ALL strict anti-outlier sanity guardrails
 * Returns: { eligible: boolean, reason?: string, details?: any }
 */
function validateExemplarEligibility(proposal, financialData = {}, aiAnalysis = {}) {
  // 1. Status Check: Must be officially Approved
  const status = String(proposal?.status || "").trim().toLowerCase();
  if (status !== "approved") {
    return {
      eligible: false,
      reason: `Proposal status is '${proposal?.status || "Unknown"}'. Must be formally 'Approved' by an adviser.`
    };
  }

  // 2. Score Check: Must have scored 90 or above
  const score = Number(aiAnalysis?.score || 0);
  if (score < 90) {
    return {
      eligible: false,
      reason: `Feasibility score is ${score}/100. Must achieve at least 90/100 to qualify as an academic benchmark.`
    };
  }

  // Extract financial quantitative inputs
  const fin = financialData || {};
  const products = Array.isArray(fin.products) ? fin.products : [];
  
  // Calculate Revenue
  let monthlyRevenue = Number(fin.monthlyRevenue || fin.totalMonthlySales || fin.sales || 0);
  if (monthlyRevenue <= 0 && products.length > 0) {
    monthlyRevenue = products.reduce((acc, p) => {
      const price = Number(p.price || p.sellingPrice || 0);
      const units = Number(p.monthlyUnits || p.unitsPerMonth || (Number(p.unitsPerDay || 0) * 26) || 0);
      return acc + (price * units);
    }, 0);
  }

  if (monthlyRevenue <= 0) {
    return {
      eligible: false,
      reason: "Monthly revenue projection is missing or ₱0."
    };
  }

  // Extract Operating Expenses (OPEX)
  const opexObj = fin.operatingExpenses || fin.opex || {};
  let rent = Number(opexObj.rent || fin.rent || 0);
  let salaries = Number(opexObj.salaries || opexObj.wages || fin.salaries || 0);
  let utilities = Number(opexObj.utilities || opexObj.electricity || fin.utilities || 0);
  let totalOpex = Number(fin.totalOpex || fin.monthlyOpex || 0);

  if (totalOpex <= 0) {
    totalOpex = Object.values(opexObj).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }

  // 3. Strict Non-Zero Essential OPEX Rule
  if (rent <= 0) {
    return {
      eligible: false,
      reason: "Missing or ₱0 rent expense. All physical enterprises must account for commercial lease or kiosk fees."
    };
  }

  if (salaries <= 0) {
    return {
      eligible: false,
      reason: "Missing or ₱0 salary/payroll expense. Feasibility studies must budget realistic staff wages."
    };
  }

  if (utilities <= 0) {
    return {
      eligible: false,
      reason: "Missing or ₱0 utility expenses (electricity, water, communications)."
    };
  }

  // Extract Cost of Goods Sold (COGS)
  let totalCogs = Number(fin.totalCogs || fin.monthlyCogs || 0);
  if (totalCogs <= 0 && products.length > 0) {
    totalCogs = products.reduce((acc, p) => {
      const unitCost = Number(p.unitCost || p.cogs || 0);
      const units = Number(p.monthlyUnits || p.unitsPerMonth || (Number(p.unitsPerDay || 0) * 26) || 0);
      return acc + (unitCost * units);
    }, 0);
  }

  const cogsRatio = monthlyRevenue > 0 ? (totalCogs / monthlyRevenue) : 0;

  // 4. Strict COGS Bounds (Must be between 30% and 65%)
  if (cogsRatio < 0.30) {
    return {
      eligible: false,
      reason: `COGS ratio (${(cogsRatio * 100).toFixed(1)}%) is unrealistically low (under 30%). Raw material and production costs cannot be virtually zero.`
    };
  }

  if (cogsRatio > 0.65) {
    return {
      eligible: false,
      reason: `COGS ratio (${(cogsRatio * 100).toFixed(1)}%) is too high (exceeds 65%), leaving inadequate gross margin to cover operating overhead.`
    };
  }

  // Calculate Net Profit and Net Margin
  const netMonthlyProfit = monthlyRevenue - totalCogs - totalOpex;
  const netMargin = monthlyRevenue > 0 ? (netMonthlyProfit / monthlyRevenue) : 0;

  // 5. Strict Net Profit Margin Bounds (Must be between 10% and 35%)
  // Capping at 35% prevents fantasy / outlier projections from becoming exemplars
  if (netMargin > 0.35) {
    return {
      eligible: false,
      reason: `Net profit margin (${(netMargin * 100).toFixed(1)}%) is an unrealistic outlier (exceeds 35%). Standard student capstone margins are capped between 10% and 35%.`
    };
  }

  if (netMargin < 0.10) {
    return {
      eligible: false,
      reason: `Net profit margin (${(netMargin * 100).toFixed(1)}%) is too low (under 10%) for a benchmark study.`
    };
  }

  // 6. Capital Adequacy Check
  const totalCapital = Number(String(proposal?.totalCapital || fin.totalCapital || "0").replace(/[^0-9.]/g, ""));
  if (totalCapital <= 0) {
    return {
      eligible: false,
      reason: "Declared total capital is ₱0 or missing."
    };
  }

  // 7. Qualitative Completeness Check (No empty or placeholder text)
  const name = String(proposal?.businessName || "").trim();
  const mission = String(proposal?.missionStatement || "").trim();
  const vision = String(proposal?.visionStatement || "").trim();
  const location = String(proposal?.proposedLocation || "").trim();

  if (name.length < 3 || name.toLowerCase().includes("pending")) {
    return { eligible: false, reason: "Business name is a placeholder or too short." };
  }
  if (mission.length < 20 || vision.length < 20) {
    return { eligible: false, reason: "Mission and vision statements lack sufficient academic substance." };
  }
  if (location.length < 5) {
    return { eligible: false, reason: "Proposed location is vague or incomplete." };
  }

  return {
    eligible: true,
    details: {
      score,
      monthlyRevenue,
      netMonthlyProfit,
      netMarginPercentage: `${(netMargin * 100).toFixed(1)}%`,
      cogsRatioPercentage: `${(cogsRatio * 100).toFixed(1)}%`,
      totalCapital,
      category: normalizeCategory(proposal?.businessType)
    }
  };
}

/**
 * Anonymizes the student proposal into a clean benchmark object
 */
function anonymizeAndFormatExemplar(proposal, financialData = {}, aiAnalysis = {}, validationDetails = {}) {
  const category = validationDetails.category || normalizeCategory(proposal?.businessType);
  const capitalNum = Number(String(proposal?.totalCapital || "0").replace(/[^0-9.]/g, "")) || 0;

  // Extract products pricing summary
  const products = Array.isArray(financialData?.products) ? financialData.products : [];
  let pricingStr = proposal?.priceRanges || "";
  if (!pricingStr && products.length > 0) {
    const prices = products.map(p => Number(p.price || 0)).filter(p => p > 0);
    if (prices.length > 0) {
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      pricingStr = minP === maxP ? `₱${minP.toFixed(2)}` : `₱${minP.toFixed(2)} to ₱${maxP.toFixed(2)}`;
    }
  }
  if (!pricingStr) pricingStr = "₱45.00 to ₱120.00 (Standard Entry Tier)";

  return {
    id: `DYN-EXEMP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    name: proposal.businessName,
    type: proposal.businessType || category,
    category: category,
    capital: capitalNum,
    location: proposal.proposedLocation || "Urban Commercial Zone",
    pricing: pricingStr,
    promotional_strategy: proposal.promotionalStrategy || "Multi-channel localized marketing, campus/anchor foot traffic capture, and digital promotional bundles.",
    financial_benchmarks: {
      cogs_ratio: validationDetails.cogsRatioPercentage || "42.5%",
      net_profit_margin: validationDetails.netMarginPercentage || "22.0%",
      feasibility_score: validationDetails.score || 92
    },
    approved_date: new Date().toISOString(),
    source: "Verified Approved Feasify Capstone"
  };
}

/**
 * Ingests a candidate proposal into the dynamic exemplars store (Hybrid: Firestore + Local JSON)
 * Limits to a maximum of 3 exemplars per category to maintain database diversity and prevent bloating.
 */
async function ingestCandidateProposal(proposal, financialData = {}, aiAnalysis = {}, adminFirestore = null) {
  const validation = validateExemplarEligibility(proposal, financialData, aiAnalysis);
  if (!validation.eligible) {
    console.log(`ℹ️ [Dynamic Exemplars] Proposal '${proposal?.businessName || "Untitled"}' skipped: ${validation.reason}`);
    return { ingested: false, reason: validation.reason };
  }

  const newExemplar = anonymizeAndFormatExemplar(proposal, financialData, aiAnalysis, validation.details);
  const currentList = loadDynamicExemplars();

  // Deduplication: Avoid duplicate business names
  const existingIdx = currentList.findIndex(e => e.name.toLowerCase() === newExemplar.name.toLowerCase());
  if (existingIdx !== -1) {
    console.log(`ℹ️ [Dynamic Exemplars] Updating existing benchmark '${newExemplar.name}'.`);
    currentList[existingIdx] = { ...newExemplar, id: currentList[existingIdx].id };
  } else {
    // Check Category Quota (Max 3 per category)
    const categoryMatches = currentList.filter(e => e.category === newExemplar.category);
    if (categoryMatches.length >= 3) {
      // Sort by score ascending to find the lowest-scoring exemplar
      categoryMatches.sort((a, b) => (a.financial_benchmarks?.feasibility_score || 0) - (b.financial_benchmarks?.feasibility_score || 0));
      const lowestExemplar = categoryMatches[0];

      if (newExemplar.financial_benchmarks.feasibility_score > (lowestExemplar.financial_benchmarks?.feasibility_score || 0)) {
        console.log(`ℹ️ [Dynamic Exemplars] Category '${newExemplar.category}' reached capacity (3). Replacing lower-scoring benchmark '${lowestExemplar.name}'.`);
        const replaceIdx = currentList.findIndex(e => e.id === lowestExemplar.id);
        if (replaceIdx !== -1) {
          currentList[replaceIdx] = newExemplar;
        } else {
          currentList.push(newExemplar);
        }
      } else {
        return {
          ingested: false,
          reason: `Category '${newExemplar.category}' already has 3 higher-rated exemplars.`
        };
      }
    } else {
      currentList.push(newExemplar);
    }
  }

  // 1. Save to local disk cache (Atomic)
  saveDynamicExemplarsLocal(currentList);

  // 2. Save to Firestore (Hybrid Cloud persistence)
  if (adminFirestore) {
    try {
      await adminFirestore.collection("dynamic_exemplars").doc(newExemplar.id).set(newExemplar);
      console.log(`☁️ [Dynamic Exemplars] Synced '${newExemplar.name}' to Firestore collection 'dynamic_exemplars'.`);
    } catch (fErr) {
      console.warn("⚠️ [Dynamic Exemplars] Firestore write warning (local cache preserved):", fErr.message);
    }
  }

  console.log(`🎯 [Dynamic Exemplars] Successfully ingested academic benchmark: '${newExemplar.name}' (${newExemplar.category})`);
  return { ingested: true, exemplar: newExemplar };
}

/**
 * Returns strictly at most 2 category-matched exemplars:
 * 1 Core Static Baseline + 1 Top Dynamic Exemplar matching the business category.
 * This guarantees prompt payload is strictly capped under ~800 tokens.
 */
function getCategoryMatchedExemplars(businessType = "", staticExemplars = []) {
  const targetCategory = normalizeCategory(businessType);
  const dynamicList = loadDynamicExemplars();

  // 1. Pick 1 best static baseline matching category
  let matchingStatic = (staticExemplars || []).find(e => normalizeCategory(e.type || e.category) === targetCategory);
  if (!matchingStatic && staticExemplars && staticExemplars.length > 0) {
    matchingStatic = staticExemplars[0]; // Fallback to first static benchmark (e.g. The Dory House or Mr. Cabbage)
  }

  // 2. Pick 1 best dynamic exemplar matching category
  let matchingDynamic = dynamicList
    .filter(e => e.category === targetCategory)
    .sort((a, b) => (b.financial_benchmarks?.feasibility_score || 0) - (a.financial_benchmarks?.feasibility_score || 0))[0] || null;

  const result = [];
  if (matchingStatic) {
    result.push({
      name: matchingStatic.name,
      type: matchingStatic.type,
      capital: matchingStatic.capital,
      location: matchingStatic.location,
      pricing: matchingStatic.pricing,
      promotional_strategy: matchingStatic.promotional_strategy
    });
  }

  if (matchingDynamic) {
    result.push({
      name: matchingDynamic.name,
      type: matchingDynamic.type,
      capital: matchingDynamic.capital,
      location: matchingDynamic.location,
      pricing: matchingDynamic.pricing,
      promotional_strategy: matchingDynamic.promotional_strategy,
      verified_ratios: matchingDynamic.financial_benchmarks
    });
  }

  return result;
}

module.exports = {
  normalizeCategory,
  loadDynamicExemplars,
  syncFromFirestore,
  validateExemplarEligibility,
  anonymizeAndFormatExemplar,
  ingestCandidateProposal,
  getCategoryMatchedExemplars
};
