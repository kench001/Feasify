const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const rateLimit = require("express-rate-limit");

// ==========================================
// FIREBASE ADMIN SDK — Audit Trail Security
// ==========================================
let adminApp = null;
let adminFirestore = null;
let adminAuth = null;

try {
  const admin = require("firebase-admin");

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    // Preferred: base64-encoded JSON stored in env var
    const serviceAccount = JSON.parse(
      Buffer.from(serviceAccountEnv, "base64").toString("utf-8")
    );
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Fallback: file path via env var
    adminApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    console.warn(
      "⚠️ [Firebase Admin] No credentials found. Audit Trail API will operate in FRONTEND-ONLY mode (no server-side section enforcement).\n" +
      "   To enable backend enforcement, set FIREBASE_SERVICE_ACCOUNT env var (base64-encoded service account JSON)."
    );
  }

  if (adminApp) {
    adminFirestore = admin.firestore();
    adminAuth = admin.auth();
    console.log("✅ [Firebase Admin] Initialized — Audit Trail backend enforcement active.");
  }
} catch (err) {
  console.error("❌ [Firebase Admin] Initialization failed:", err.message);
}

/**
 * Middleware: Verify Firebase ID token from Authorization header.
 * Attaches { uid, role, sections[] } to req.user.
 * If Admin SDK not available, falls back to trust-but-log mode.
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing Authorization token." });
  }

  if (!adminAuth || !adminFirestore) {
    // Admin SDK not configured — reject to avoid unprotected access
    return res.status(503).json({
      error: "Backend auth not configured. Set FIREBASE_SERVICE_ACCOUNT env var.",
      hint: "See README or implementation plan for setup instructions."
    });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email || "";

    // Fetch user's role and sections from Firestore
    const userDoc = await adminFirestore.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: "User profile not found." });
    }

    const userData = userDoc.data();
    const role = userData.role || "Student";
    const isChairperson = email === "chairperson@gmail.com" || role === "Chairperson";

    // Parse sections from comma-separated string (matches AdviserDashboard.tsx logic)
    const rawSection = userData.section || "";
    const sections = typeof rawSection === "string"
      ? rawSection.split(",").map(s => s.trim()).filter(Boolean)
      : (Array.isArray(rawSection) ? rawSection : []);

    req.user = { uid, email, role, sections, isChairperson, displayName: `${userData.firstName || ""} ${userData.lastName || ""}`.trim() };
    next();
  } catch (err) {
    console.error("[verifyToken] Error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

const app = express();

// Rate limiting configurations
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: "Too many requests, please try again after a minute." }
});

const proposalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: "Too many requests, please try again after a minute." }
});

// Middlewares
app.use(cors());
app.use(express.json()); // Allows parsing of incoming JSON payloads

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.io with server instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize Gemini SDK safely
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Helper to safely load and verify the local Knowledge Base
const getKnowledgeBase = () => {
  try {
    const dataDir = path.join(__dirname, "data");
    const filePath = path.join(dataDir, "knowledge_base.json");

    // Auto-create directory if missing
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Auto-create blank template if file is missing
    if (!fs.existsSync(filePath)) {
      const template = {
        evaluation_framework: {
          gateway_phase: { rules: [] },
          graded_categories: [],
          performance_matrix: []
        },
        exemplars: []
      };
      fs.writeFileSync(filePath, JSON.stringify(template, null, 2), "utf-8");
    }

    const fileData = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileData);
  } catch (error) {
    console.error("Failed reading local knowledge base:", error);
    return null;
  }
};

// Helper to safely load local Copyright Database
const getCopyrightDB = () => {
  try {
    const dataDir = path.join(__dirname, "data");
    const filePath = path.join(dataDir, "copyright_db.json");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
      const template = {
        school_businesses: [
          "bibimburp", "glam n walk", "maria ada's", "maria ada’s",
          "agro integro insurance", "juan dream partnership", "mr. cabbage",
          "empinoy", "copying and printing express"
        ],
        well_known_businesses: ["mcdonald's", "jollibee", "kfc", "nike", "adidas", "apple", "google"],
        copyrighted_taglines: ["i'm lovin' it", "bida ang saya", "just do it"]
      };
      fs.writeFileSync(filePath, JSON.stringify(template, null, 2), "utf-8");
    }

    const fileData = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileData);
  } catch (error) {
    console.error("Failed reading local copyright database:", error);
    return { school_businesses: [], well_known_businesses: [], copyrighted_taglines: [] };
  }
};

// Retry wrapper with exponential backoff + jitter for Gemini API calls
async function callGeminiWithRetry(model, prompt, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000); // 45s hard timeout

      const result = await model.generateContent(prompt, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      // Guard against safety blocks
      const candidate = result.response.candidates?.[0];
      if (!candidate || !candidate.content) {
        const reason = candidate?.finishReason || "UNKNOWN";
        throw new Error(`Gemini blocked response. Reason: ${reason}`);
      }

      return result;
    } catch (error) {
      const isRetryable = error.message?.includes("429") ||
                          error.message?.includes("503") ||
                          error.message?.includes("Resource Exhausted") ||
                          error.name === "AbortError";

      if (isRetryable && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(`⚠️ Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}

// Robust helper to strip potential markdown code backticks returned by LLMs and handle trailing commas
const cleanAndParseJSON = (rawText) => {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  
  // Further cleanup: remove non-printable characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  try {
    return JSON.parse(cleaned);
  } catch (initialError) {
    console.warn("⚠️ JSON.parse failed initially, attempting to clean trailing commas:", initialError.message);
    try {
      // Remove trailing commas before closing braces/brackets
      let repaired = cleaned.replace(/,\s*([\]}])/g, '$1');
      // Sometimes models use single quotes
      repaired = repaired.replace(/'/g, '"');
      return JSON.parse(repaired);
    } catch (repairError) {
      // Last resort: extract JSON via regex if there's text surrounding it
      try {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
         // ignore
      }
      throw initialError;
    }
  }
};

// Helper to map numerical score to Performance Matrix entry from knowledge base
const mapScoreToPerformanceMatrix = (score, performanceMatrix) => {
  if (!performanceMatrix || !Array.isArray(performanceMatrix)) {
    return {
      performanceGrade: "N/A",
      performanceStatus: "N/A",
      performanceRecommendation: "N/A"
    };
  }

  for (const entry of performanceMatrix) {
    const range = entry.score_range;
    if (range === "Below 70") {
      if (score < 70) {
        return {
          performanceGrade: entry.grade,
          performanceStatus: entry.status,
          performanceRecommendation: entry.recommendation
        };
      }
    } else {
      const parts = range.split("-");
      if (parts.length === 2) {
        const min = parseInt(parts[0], 10);
        const max = parseInt(parts[1], 10);
        if (score >= min && score <= max) {
          return {
            performanceGrade: entry.grade,
            performanceStatus: entry.status,
            performanceRecommendation: entry.recommendation
          };
        }
      }
    }
  }

  return {
    performanceGrade: "Unsatisfactory",
    performanceStatus: "FAIL",
    performanceRecommendation: "Serious structural, operational, or financial issues requiring a complete rewrite or concept pivot."
  };
};

// ==========================================
// STARTUP DIAGNOSTICS LOGS
// ==========================================
console.log("\n=== ⚙️ FEASIFY BACKEND DIAGNOSTICS ===");
console.log("Current Working Directory:", process.cwd());
console.log("GEMINI_API_KEY detected:", process.env.GEMINI_API_KEY ? "✅ YES (Loaded)" : "❌ NO (Missing / check .env)");
const kbTest = getKnowledgeBase();
console.log("Knowledge Base loaded successfully:", kbTest ? "✅ YES" : "❌ NO");
if (kbTest && (!kbTest.evaluation_framework || kbTest.evaluation_framework.graded_categories.length === 0)) {
  console.log("⚠️ WARNING: Your knowledge_base.json is empty or formatted incorrectly. Ensure you populated it in Step 2.");
}
console.log("======================================\n");

// ==========================================
// COPYRIGHT DATABASE REST ENDPOINTS
// ==========================================

// Endpoint to fetch full copyright database
app.get(["/api/copyright-db", "/api/copyright/db"], (req, res) => {
  const db = getCopyrightDB();
  res.json(db);
});

// Endpoint to check business name or tagline against copyright DB
app.post(["/api/copyright-check", "/api/copyright/check"], (req, res) => {
  const { businessName, tagline } = req.body || {};
  const db = getCopyrightDB();

  const normalize = (str) =>
    (str || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const normName = normalize(businessName);
  const normTagline = normalize(tagline);

  let isNameCopyrighted = false;
  let nameSource = "";
  let matchedName = "";

  if (normName) {
    const schoolMatch = db.school_businesses.find(
      (b) => normalize(b) === normName
    );
    if (schoolMatch) {
      isNameCopyrighted = true;
      nameSource = "School Business";
      matchedName = schoolMatch;
    } else {
      const wellKnownMatch = db.well_known_businesses.find(
        (b) => normalize(b) === normName
      );
      if (wellKnownMatch) {
        isNameCopyrighted = true;
        nameSource = "Well-Known Brand";
        matchedName = wellKnownMatch;
      }
    }
  }

  let isTaglineCopyrighted = false;
  let matchedTagline = "";

  if (normTagline) {
    const taglineMatch = db.copyrighted_taglines.find(
      (t) => normalize(t) === normTagline
    );
    if (taglineMatch) {
      isTaglineCopyrighted = true;
      matchedTagline = taglineMatch;
    }
  }

  res.json({
    isNameCopyrighted,
    nameSource,
    matchedName,
    isTaglineCopyrighted,
    matchedTagline,
  });
});

// ==========================================
// AI REST API ENDPOINTS
// ==========================================

// ENDPOINT 1: Student-Facing Financial Audit
app.post(
  [
    "/api/analyze", // Aligns with the fetch URL in AI_Analysis.tsx
    "/api/analyze-financials",
    "/api/analyze-financial",
    "/api/financial-analysis",
    "/api/ai/analyze-financials"
  ],
  analyzeLimiter,
  async (req, res) => {
    try {
      // Support both nested object structure or top-level fields
      const financials = req.body.financialData || req.body.financials || req.body;
      const kb = getKnowledgeBase();

      if (!kb) {
        return res.status(500).json({ error: "Local knowledge base database missing." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Missing API authorization key." });
      }

      // ==========================================
      // PROGRAMMATIC FINANCIAL AUDIT CALCULATIONS
      // ==========================================
      const sellingPrice = Number(financials.sellingPrice) || 0;
      const variableCost = Number(financials.variableCost) || 0; // COGS/unit
      const monthlySales = Number(financials.monthlySales) || 0;
      const operatingDays = Number(financials.operatingDays) || 300;
      const isCapitalBorrowed = financials.isCapitalBorrowed || false;
      const interestRate = Number(financials.interestRate) || 0;

      // 1. Sum up Equipment Cost (CapEx)
      const equipmentList = financials.equipmentList || [];
      const equipmentTotal = equipmentList.reduce(
        (sum, item) => sum + (Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0),
        0
      );

      // 2. Startup Capital Determination
      const declaredCapital = Number(financials.startupCapital) || 0;
      const safeStartupCapital = equipmentList.length > 0 ? equipmentTotal : declaredCapital;

      // 3. Cash Reserve = Declared Capital - Equipment Cost
      const cashReserve = equipmentList.length > 0
        ? Math.max(0, declaredCapital - equipmentTotal)
        : declaredCapital;

      const capitalDeficit = equipmentList.length > 0 && equipmentTotal > declaredCapital;

      // 4. Sum up Monthly OPEX
      const opexList = financials.opexList || [];
      const monthlyOpex = opexList.length > 0
        ? opexList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : (Number(financials.fixedCosts) || 0);

      // 5. Calculate monthly financing interest
      const monthlyInterest = isCapitalBorrowed ? (safeStartupCapital * (interestRate / 100)) / 12 : 0;

      // 6. Basic Monthly Margin Metrics
      const monthlyRevenue = sellingPrice * monthlySales;
      const totalMonthlyVariableCosts = variableCost * monthlySales; // COGS
      const netMonthlyProfit = monthlyRevenue - totalMonthlyVariableCosts - monthlyOpex - monthlyInterest;

      // 7. Annualized calculations matching student panel
      const annualRevenue = (monthlyRevenue / 30) * operatingDays;
      const annualExpenses = ((totalMonthlyVariableCosts + monthlyOpex + monthlyInterest) / 30) * operatingDays;
      const annualNetProfitPreTax = annualRevenue - annualExpenses;
      const percentageTax = annualRevenue > 0 ? annualRevenue * 0.03 : 0; // 3% BMBE Tax
      const annualNetProfitAfterTax = (annualNetProfitPreTax > 0 ? annualNetProfitPreTax : 0) - percentageTax;

      // 8. Payback period in months
      const paybackPeriodMonths = annualNetProfitAfterTax > 0
        ? (safeStartupCapital / (annualNetProfitAfterTax / 12))
        : Infinity;
      const paybackPeriodStr = paybackPeriodMonths === Infinity ? "Infinity (Never)" : `${paybackPeriodMonths.toFixed(1)} months`;

      // 9. FEASIBILITY DECISION TREE
      let status = "FEASIBLE";
      let score = 85;

      if (sellingPrice - variableCost <= 0) {
        status = "NOT_FEASIBLE";
        score = 15;
      } else if (netMonthlyProfit <= 0 || annualNetProfitAfterTax <= 0) {
        status = "NOT_FEASIBLE";
        score = 30;
      } else {
        // High feasibility: scale based on how fast the business pays back its capital
        const marginRatio = netMonthlyProfit / (monthlyOpex || 1);
        status = "FEASIBLE";
        score = Math.min(100, Math.max(70, Math.round(75 + marginRatio * 10)));
      }

      // Calculate component scores
      const financialScore = status === "NOT_FEASIBLE" ? Math.min(45, score + 10) : 88;
      const riskScore = status === "NOT_FEASIBLE" ? 30 : 90;
      const marketScore = monthlySales > 0 ? 80 : 50;

      // Map score to Performance Matrix from knowledge base
      const performanceInfo = mapScoreToPerformanceMatrix(score, kb.evaluation_framework.performance_matrix);

      // Strict prompt forcing isolated data constraints, zero outside search, temperature 0
      const prompt = `
You are a closed-domain mathematical auditing assistant evaluating a student's business FINANCIAL DATA.
Do not use any outside general-world knowledge. Rely purely on the evaluation rules, numerical metrics, and the local knowledge base.

LOCAL KNOWLEDGE BASE CONTEXT (FOR REALISM & GRADING STANDARDS):
${JSON.stringify(kb.evaluation_framework, null, 2)}

FEW-SHOT SUCCESSFUL BUSINESS EXEMPLARS FOR REFERENCE (CAPITAL STABILITY, COST & PRICING STRUCTURE):
${JSON.stringify(kb.exemplars, null, 2)}

APPROVED UNIVERSITY BASES FOR FINANCIAL COMPARISONS (financial_input_examples):
${JSON.stringify(kb.financial_input_examples, null, 2)}

EVALUATION RULES:
1. Rule DF-02 (Gross Margin): Selling Price - COGS/Unit > 0. If fails, status must be NOT_FEASIBLE and score must be 15.
2. Profitability Check: A business must have positive Net Profit/Month and positive Annual Net Profit (After Tax) to be feasible. If Net Profit is less than or equal to 0, status must be NOT_FEASIBLE and score must be 30.
3. Realism Audit: Compare the submitted financial data (startup capital, unit selling price, COGS/unit, and monthly OPEX) against the approved university feasibility studies under APPROVED UNIVERSITY BASES FOR FINANCIAL COMPARISONS (financial_input_examples). Focus on comparing the startup capital scale and the COGS-to-price ratios. Warn if they are extremely unrealistic, but DO NOT check or criticize for capital reconciliation (DF-03 balance) or cash reserve buffer quantities since those are NOT evaluated in this phase.

ADVISER'S CUSTOM AI RULES (OVERRIDE DEFAULTS IF CONFLICTING):
- Tone & Style: ${req.body.customAIRules?.tone || 'Default academic and constructive tone.'}
- Dealbreakers: ${req.body.customAIRules?.dealbreakers || 'None specific.'}
- Focus Areas: ${req.body.customAIRules?.focusAreas || 'General financial feasibility.'}
- Formatting: ${req.body.customAIRules?.formatting || 'Follow standard output structure.'}

SUBMITTED FINANCIAL DATA:
- Selling Price per Unit: PHP ${sellingPrice}
- Cost of Goods Sold (COGS) per Unit: PHP ${variableCost}
- Monthly Sales Volume (Units): ${monthlySales}
- Declared Startup Capital: PHP ${declaredCapital}
- Sum of Equipment Startup Costs: PHP ${equipmentTotal}
- Monthly Operating Expenses (OPEX): PHP ${monthlyOpex}
- Monthly Financing Interest Cost: PHP ${monthlyInterest}
- Cash/Working Capital Reserve: PHP ${cashReserve}
- Net Profit/Month: PHP ${netMonthlyProfit}
- Annual Revenue: PHP ${annualRevenue}
- Annual Net Profit (After Tax): PHP ${annualNetProfitAfterTax}
- Payback Period: ${paybackPeriodStr}

MANDATORY OUTPUT VALUE ENFORCEMENT:
Your generated JSON object MUST contain exactly these calculated metrics:
- "score": ${score}
- "status": "${status}"
- "performanceGrade": "${performanceInfo.performanceGrade}"
- "performanceStatus": "${performanceInfo.performanceStatus}"
- "performanceRecommendation": "${performanceInfo.performanceRecommendation}"
- "metrics": {
    "financial": ${financialScore},
    "risk": ${riskScore},
    "market": ${marketScore}
  }
- "aiScores": {
    "financial": ${financialScore},
    "operational": ${riskScore},
    "market": ${marketScore}
  }

Please write the explanations, insights, and improvement tips based strictly on the metrics, values, and realism rules above.
CRITICALLY IMPORTANT: You MUST strictly apply the ADVISER'S CUSTOM AI RULES (Tone, Dealbreakers, Focus Areas, Formatting) when writing the text for 'explanations', 'insights', 'improvementTips', and 'aiScoreExplanations'. If the tone is goofy, write in a goofy tone. If formatting requires bullets, use bullets.

Your response must be a single stringified JSON object matching this structure:
{
  "score": 85,
  "status": "FEASIBLE",
  "performanceGrade": "${performanceInfo.performanceGrade}",
  "performanceStatus": "${performanceInfo.performanceStatus}",
  "performanceRecommendation": "${performanceInfo.performanceRecommendation}",
  "metrics": {
    "financial": 88,
    "risk": 90,
    "market": 80
  },
  "explanations": {
    "feasibility": "Overall numeric audit verdict explanation. Must explicitly mention unit gross margins, net profit, and whether it passes the DF-02 test. Assess whether the startup capital scale and pricing seem realistic based on the baseline university exemplars. Do not mention or audit capital reconciliation (DF-03) or cash reserves.",
    "financial": "Detailed analysis of unit margins, OPEX coverage, and net profit.",
    "risk": "Breakdown of cash flow risks, capital recovery duration (payback period), and general budget stability.",
    "market": "Assessment of volume adequacy, gross margins, and general price realism."
  },
  "insights": [
    { "type": "positive", "title": "Margin Status", "description": "Analysis of your unit gross margins" },
    { "type": "warning", "title": "Profitability Status", "description": "Analysis of your net profit margins and profitability" },
    { "type": "info", "title": "Payback Insight", "description": "Analysis of your estimated capital recovery time" }
  ],
  "improvementTips": {
    "financial": ["Specific tip on unit cost, rent, or operational expense adjustment"],
    "operations": ["Specific tip on equipment budget, location cost, or pricing realism adjustments"],
    "marketing": ["Specific tip on pricing strategy or volume adjustments"]
  },
  "aiScores": {
    "financial": 88,
    "operational": 90,
    "market": 80
  },
  "aiScoreExplanations": {
    "financial": "Brief summary explanation.",
    "operational": "Brief summary explanation.",
    "market": "Brief summary explanation."
  }
}

IMPORTANT: The response MUST be strictly valid JSON. Do not include comments, typescript annotations, or trailing commas in the JSON response. For the 'type' field in the 'insights' array, you must select one of: 'positive', 'warning', 'info', or 'suggestion'.
`;

      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest", // Standard stable Flash model with 1,500 requests/day quota
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      });

      const result = await callGeminiWithRetry(model, prompt);
      const textResponse = result.response.text();
      const parsedResponse = cleanAndParseJSON(textResponse);
      
      // Enforce the exact performance matrix fields programmatically
      parsedResponse.performanceGrade = performanceInfo.performanceGrade;
      parsedResponse.performanceStatus = performanceInfo.performanceStatus;
      parsedResponse.performanceRecommendation = performanceInfo.performanceRecommendation;

      res.json(parsedResponse);

    } catch (error) {
      console.error("AI Analysis Error:", error);
      try {
        fs.appendFileSync(
          path.join(__dirname, "error.log"),
          `[${new Date().toISOString()}] AI Analysis Error:\nRequest: ${JSON.stringify(req.body, null, 2)}\nError: ${error.stack || error.message || error}\n\n`,
          "utf-8"
        );
      } catch (logErr) {
        console.error("Failed writing to error.log:", logErr);
      }

      // Fallback mechanism to ensure no crash
      const financials = req.body.financialData || req.body.financials || req.body;
      const sellingPrice = Number(financials.sellingPrice) || 0;
      const variableCost = Number(financials.variableCost) || 0; 
      const monthlySales = Number(financials.monthlySales) || 0;
      const operatingDays = Number(financials.operatingDays) || 300;
      const isCapitalBorrowed = financials.isCapitalBorrowed || false;
      const interestRate = Number(financials.interestRate) || 0;
      const equipmentList = financials.equipmentList || [];
      const equipmentTotal = equipmentList.reduce(
        (sum, item) => sum + (Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0),
        0
      );
      const declaredCapital = Number(financials.startupCapital) || 0;
      const safeStartupCapital = equipmentList.length > 0 ? equipmentTotal : declaredCapital;
      const opexList = financials.opexList || [];
      const monthlyOpex = opexList.length > 0
        ? opexList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : (Number(financials.fixedCosts) || 0);
      const monthlyInterest = isCapitalBorrowed ? (safeStartupCapital * (interestRate / 100)) / 12 : 0;
      const monthlyRevenue = sellingPrice * monthlySales;
      const totalMonthlyVariableCosts = variableCost * monthlySales;
      const netMonthlyProfit = monthlyRevenue - totalMonthlyVariableCosts - monthlyOpex - monthlyInterest;
      const annualRevenue = (monthlyRevenue / 30) * operatingDays;
      const annualExpenses = ((totalMonthlyVariableCosts + monthlyOpex + monthlyInterest) / 30) * operatingDays;
      const annualNetProfitPreTax = annualRevenue - annualExpenses;
      const percentageTax = annualRevenue > 0 ? annualRevenue * 0.03 : 0;
      const annualNetProfitAfterTax = (annualNetProfitPreTax > 0 ? annualNetProfitPreTax : 0) - percentageTax;

      let status = "FEASIBLE";
      let score = 85;
      if (sellingPrice - variableCost <= 0) {
        status = "NOT_FEASIBLE";
        score = 15;
      } else if (netMonthlyProfit <= 0 || annualNetProfitAfterTax <= 0) {
        status = "NOT_FEASIBLE";
        score = 30;
      } else {
        const marginRatio = netMonthlyProfit / (monthlyOpex || 1);
        status = "FEASIBLE";
        score = Math.min(100, Math.max(70, Math.round(75 + marginRatio * 10)));
      }
      const financialScore = status === "NOT_FEASIBLE" ? Math.min(45, score + 10) : 88;
      const riskScore = status === "NOT_FEASIBLE" ? 30 : 90;
      const marketScore = monthlySales > 0 ? 80 : 50;

      const kb = getKnowledgeBase();
      const performanceInfo = kb ? mapScoreToPerformanceMatrix(score, kb.evaluation_framework.performance_matrix) : {
        performanceGrade: "N/A", performanceStatus: "N/A", performanceRecommendation: "N/A"
      };

      res.json({
        score,
        status,
        performanceGrade: performanceInfo.performanceGrade,
        performanceStatus: performanceInfo.performanceStatus,
        performanceRecommendation: performanceInfo.performanceRecommendation,
        metrics: { financial: financialScore, risk: riskScore, market: marketScore },
        explanations: {
          feasibility: `Score: ${score}/100. ${status === "FEASIBLE" ? "Business shows positive margins." : "Business shows negative margins — review costs."}`,
          financial: "AI narrative temporarily unavailable. Scores are computed from your financial data.",
          risk: "AI narrative temporarily unavailable.",
          market: "AI narrative temporarily unavailable."
        },
        insights: [
          { type: status === "FEASIBLE" ? "positive" : "warning", title: "Automated Verdict", description: `Feasibility score: ${score}/100 (${status}).` }
        ],
        improvementTips: {},
        aiScores: { financial: financialScore, operational: riskScore, market: marketScore },
        aiScoreExplanations: {},
        _fallback: true
      });
    }
  }
);

// ENDPOINT 2: Adviser-Facing Proposal Grading (Supports Free Tier)
app.post(
  [
    "/api/analyze-proposal", // Aligns with the fetch URL in AdviserDashboard.tsx
    "/api/evaluate-proposal",
    "/api/ai/evaluate-proposal",
    "/api/ai/analyze-proposal"
  ],
  proposalLimiter,
  async (req, res) => {
    try {
      const payload = req.body;
      const kb = getKnowledgeBase();

      if (!kb) {
        return res.status(500).json({ error: "Local knowledge base database missing." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Missing API authorization key." });
      }

      // Map keys directly from top-level payload parameters with fallback values
      const businessName = payload.businessName || payload.title || "Untitled";
      const businessType = payload.businessType || payload.category || "General";
      const proposedLocation = payload.proposedLocation || payload.location || "N/A";
      const missionStatement = payload.missionStatement || payload.mission || "N/A";
      const visionStatement = payload.visionStatement || payload.vision || "N/A";
      const targetMarket = payload.targetMarket || "N/A";
      const promotionalStrategy = payload.promotionalStrategy || "N/A";
      const totalCapital = payload.totalCapital || "0";
      const productDescription = payload.productDescription || payload.otherDetails || "N/A";
      const priceRanges = payload.priceRanges || "N/A";
      const financialDataString = payload.financialData && Object.keys(payload.financialData).length > 0 
        ? JSON.stringify(payload.financialData, null, 2) 
        : "No detailed financial data provided yet.";

      // Pass target criteria and exemplars as few-shot data structures
      const prompt = `
You are an expert academic feasibility study evaluator assessing a BUSINESS PROPOSAL with attached FINANCIAL PROJECTIONS.
Do not use general world-wide knowledge. Rely purely on the local data.

LOCAL GRADING MATRIX CONTEXT:
${JSON.stringify(kb.evaluation_framework, null, 2)}

FEW-SHOT PASSING EXEMPLARS FOR REFERENCE STYLE AND QUALITY:
${JSON.stringify(kb.exemplars, null, 2)}

SUBMITTED PROPOSAL TO EVALUATE:
- Business Name: "${businessName}"
- Business Type: "${businessType}"
- Total Declared Capital: PHP ${totalCapital}
- Mission Statement: "${missionStatement}"
- Vision Statement: "${visionStatement}"
- Product Description: "${productDescription}"
- Price Ranges: "${priceRanges}"
- Proposed Location: "${proposedLocation}"
- Promotional Strategy: "${promotionalStrategy}"
- Target Market: "${targetMarket}"

SUBMITTED FINANCIAL DATA (QUANTITATIVE INPUTS):
${financialDataString}

INSTRUCTIONS:
1. Evaluate Category 1 (Financial Viability & Risk) based on the realism of the total capital, price ranges, and the detailed FINANCIAL DATA provided (e.g., OPEX, COGS, equipment costs). If the detailed financial data contradicts the qualitative proposal or seems unrealistic for the business type and location, flag it as a weakness.
2. Evaluate Category 2 (Operational & Location Feasibility) on proposed location matching, operational setup, and whether the declared capital/equipment makes sense for this setup.
3. Evaluate Category 3 (Target Market & Marketing) on target demographic mapping and promotion, ensuring they align with the proposed price ranges and product description.
4. Evaluate Category 4 (Mission & Vision) on identity cohesion.
5. Scores must be integers.
6. Keep the 'draftFeedback' extremely short, concise, specific, and direct. Do not include greetings (like "Dear Students"), introductions, formal letter structures, or closing signatures (like "Sincerely, ..."). Just output the specific, actionable feedback directly.

ADVISER'S CUSTOM AI RULES (OVERRIDE DEFAULTS IF CONFLICTING):
- Tone & Style: ${payload.customAIRules?.tone || 'Default academic and constructive tone.'}
- Dealbreakers: ${payload.customAIRules?.dealbreakers || 'None specific.'}
- Focus Areas: ${payload.customAIRules?.focusAreas || 'General feasibility and consistency.'}
- Formatting: ${payload.customAIRules?.formatting || 'Follow standard output structure.'}

WARNING: You MUST strictly adopt the exact "Tone & Style" requested in the custom rules above (if provided). If it requests a goofy, informal, strict, or mocking tone, you MUST apply that exact tone to all your 'explanations', 'insights', and 'draftFeedback' strings. Ignore your standard academic tone if a custom tone is requested.

Your response must be a single stringified JSON object matching this structure:
{
  "score": 85,
  "metrics": {
    "financial": 85,
    "risk": 80,
    "market": 75
  },
  "explanations": {
    "feasibility": "Brief summary of overall feasibility alignment.",
    "financial": "Summary of capital adequacy, pricing logic, and provided financial data realism.",
    "risk": "Summary of strategic buffers.",
    "market": "Summary of marketing feasibility."
  },
  "insights": [
    { "type": "positive", "title": "Strength Title", "description": "Strength details matching Category 1-4 excellent descriptors" },
    { "type": "warning", "title": "Area of Concern", "description": "Concerns matching lower rubric descriptors (evaluate both qualitative concepts and quantitative financial logic)" },
    { "type": "info", "title": "Recommendation", "description": "Clear step-by-step instruction to improve the proposal and its financials" }
  ],
  "realityCheck": "A direct, realistic statement matching high-level capital of PHP ${totalCapital} and the detailed financial data with the described location and business type.",
  "draftFeedback": "A short, concise, and highly specific feedback statement focusing strictly on key issues and exact improvements needed. No letter format, no greetings, and no sign-offs."
}

IMPORTANT: The response MUST be strictly valid JSON. Do not include comments, typescript annotations, or trailing commas in the JSON response. For the 'type' field in the 'insights' array, you must select one of: 'positive', 'warning', 'info', or 'suggestion'.
`;

      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest", // Standard stable Flash model with 1,500 requests/day quota
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      });

      const result = await callGeminiWithRetry(model, prompt);
      const textResponse = result.response.text();
      res.json(cleanAndParseJSON(textResponse));

    } catch (error) {
      console.error("AI Evaluation Error:", error);
      try {
        fs.appendFileSync(
          path.join(__dirname, "error.log"),
          `[${new Date().toISOString()}] AI Evaluation Error:\nRequest: ${JSON.stringify(req.body, null, 2)}\nError: ${error.stack || error.message || error}\n\n`,
          "utf-8"
        );
      } catch (logErr) {
        console.error("Failed writing to error.log:", logErr);
      }
      // Fallback response for Adviser
      res.json({
        score: 75,
        metrics: { financial: 75, risk: 75, market: 75 },
        explanations: {
          feasibility: "AI temporarily unavailable. Manual review required.",
          financial: "AI temporarily unavailable.",
          risk: "AI temporarily unavailable.",
          market: "AI temporarily unavailable."
        },
        insights: [
          { type: "warning", title: "AI Unavailable", description: "The AI service is currently unavailable. Please review this proposal manually." }
        ],
        realityCheck: "N/A",
        draftFeedback: "The AI service is currently unavailable. Please provide manual feedback.",
        _fallback: true
      });
    }
  }
);

// ==========================================
// AUDIT TRAIL ENDPOINTS
// ==========================================

/**
 * GET /api/audit/logs
 * Returns audit trail records filtered by the caller's role:
 * - Chairperson: all records
 * - Adviser: only records where sectionCode is in their assigned sections
 * - Student / Others: 403
 *
 * Query params:
 *   section?    Filter by specific section (must be within adviser's allowed sections)
 *   action?     Filter by action type (CREATE, UPDATE, DELETE, APPROVE, REJECT, REVISION, SUBMIT)
 *   startDate?  ISO date string
 *   endDate?    ISO date string
 *   search?     Text search against description and userName
 *   limit?      Max results (default 100, max 500)
 */
app.get("/api/audit/logs", verifyToken, async (req, res) => {
  if (!adminFirestore) {
    return res.status(503).json({ error: "Firestore not available on backend." });
  }

  try {
    const { section, action, startDate, endDate, search, limit: limitParam } = req.query;
    const limitNum = Math.min(parseInt(limitParam || "100", 10), 500);
    const { isChairperson, sections: adviserSections, role } = req.user;

    // Only Adviser and Chairperson can access audit logs
    if (!isChairperson && role !== "Adviser") {
      return res.status(403).json({ error: "Access denied. Insufficient privileges." });
    }

    // Determine which sections this caller may see
    let allowedSections = isChairperson ? null : adviserSections; // null = all sections

    // If a specific section filter is requested, validate it
    if (section && section !== "all" && section !== "") {
      if (!isChairperson && !adviserSections.includes(section)) {
        return res.status(403).json({
          error: `Access denied to section '${section}'. Not in your assigned sections.`
        });
      }
      allowedSections = [section];
    }

    let queryRef = adminFirestore.collection("audit_logs");

    // Build WHERE clause for sections
    let sectionFilteredRef;
    if (allowedSections !== null && allowedSections.length > 0) {
      // Firestore 'in' supports up to 30 items
      sectionFilteredRef = queryRef.where("sectionCode", "in", allowedSections.slice(0, 30));
    } else if (allowedSections !== null && allowedSections.length === 0) {
      // Adviser with no sections assigned — return empty
      return res.json({ logs: [], total: 0, adviserSections: [] });
    } else {
      sectionFilteredRef = queryRef; // Chairperson — no section filter
    }

    // Action filter
    if (action && action !== "all") {
      sectionFilteredRef = sectionFilteredRef.where("action", "==", action.toUpperCase());
    }

    // Date filters
    if (startDate) {
      sectionFilteredRef = sectionFilteredRef.where("createdAt", ">=", new Date(startDate));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      sectionFilteredRef = sectionFilteredRef.where("createdAt", ">=", new Date(startDate || 0))
        .where("createdAt", "<=", end);
    }

    // Order and limit
    const snapshot = await sectionFilteredRef
      .orderBy("createdAt", "desc")
      .limit(limitNum)
      .get();

    let logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null,
    }));

    // Client-side text search (Firestore doesn't support full-text natively)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      logs = logs.filter(log =>
        (log.description || "").toLowerCase().includes(q) ||
        (log.userName || "").toLowerCase().includes(q) ||
        (log.sectionCode || "").toLowerCase().includes(q)
      );
    }

    return res.json({
      logs,
      total: logs.length,
      adviserSections: req.user.sections,
      isChairperson: req.user.isChairperson,
    });
  } catch (err) {
    console.error("[GET /api/audit/logs] Error:", err);
    return res.status(500).json({ error: "Failed to fetch audit logs." });
  }
});

// ==========================================
// SOCKET.IO REAL-TIME COMMUNICATION
// ==========================================

io.on("connection", (socket) => {
  console.log(`👤 User Connected: ${socket.id}`);

  socket.on("join_group", (groupId) => {
    if (groupId) {
      socket.join(groupId);
      console.log(`🏠 Socket ${socket.id} joined group: ${groupId}`);
    }
  });

  socket.on("send_message", (data) => {
    try {
      if (!data || !data.groupId) {
        console.error("⚠️ Rejected message: Missing groupId", data);
        return;
      }

      console.log(
        `📩 Message from [${data.senderName}] in group [${data.groupId}]: ${data.content}`
      );

      io.to(data.groupId).emit("receive_message", data);
    } catch (error) {
      console.error("❌ Backend socket error:", error);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔌 User Disconnected (${socket.id}): ${reason}`);
  });
});

// Port handling
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Feasify-Backend live on port ${PORT}`);
});