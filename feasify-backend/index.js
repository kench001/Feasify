const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Process-level resilience against crashes
process.on("uncaughtException", (err) => {
  console.error("🚨 [Uncaught Exception]:", err.message, err.stack);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 [Unhandled Rejection]:", reason);
});

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
    dynamicExemplars.syncFromFirestore(adminFirestore).catch((e) =>
      console.warn("[Dynamic Exemplars] Initial sync warning:", e.message)
    );
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

// Rate limiting configurations (60 req/min keyed by user Auth header or IP)
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // allow up to 60 requests per minute
  keyGenerator: (req) => req.headers["authorization"] || req.ip,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many requests, please try again after a minute." }
});

const proposalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // allow up to 60 requests per minute
  keyGenerator: (req) => req.headers["authorization"] || req.ip,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many requests, please try again after a minute." }
});

// Middlewares
app.use(cors());
app.use(express.json()); // Allows parsing of incoming JSON payloads

// Health check endpoint for connectivity tests
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    backend: "Feasify Backend Engine",
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

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

// Official Government Registration Authority Checker Service (DTI + SEC)
const nameCheckerService = require("./services/nameChecker");

// Dynamic Academic Benchmarks & Exemplars Engine (Anti-Outlier Hybrid Store)
const dynamicExemplars = require("./services/dynamicExemplars");

// In-memory cache/store for team proposal counts (guarantees backend 3-limit enforcement)
const teamProposalsStore = new Map();

// Helper to get group proposal count (checks Firestore if available, falls back to store)
const getGroupProposalCount = async (groupId) => {
  if (adminFirestore) {
    try {
      const snap = await adminFirestore.collection("proposals").where("groupId", "==", groupId).get();
      const count = snap.size;
      teamProposalsStore.set(groupId, count);
      return count;
    } catch (e) {
      console.warn("[Backend proposal count] Firestore query failed, falling back to local store:", e.message);
    }
  }
  return teamProposalsStore.get(groupId) || 0;
};


// Reliable Multi-Model Cascade for Gemini
const GEMINI_MODELS_CASCADE = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
];

// Multi-model cascade: attempts primary model, failing over seamlessly to secondary candidates if quota or rate-limit is encountered
async function callGeminiCascade(prompt, generationConfig = {}) {
  let lastError = null;

  for (const modelName of GEMINI_MODELS_CASCADE) {
    try {
      console.log(`🤖 [Live AI] Requesting analysis via ${modelName}...`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0,
          ...generationConfig,
        },
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);

      const result = await model.generateContent(prompt, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const candidate = result.response.candidates?.[0];
      if (!candidate || !candidate.content) {
        const reason = candidate?.finishReason || "UNKNOWN";
        throw new Error(`Gemini blocked response. Reason: ${reason}`);
      }

      console.log(`✅ [Live AI] Successfully received response from ${modelName}`);
      return { result, modelName };
    } catch (err) {
      console.warn(`⚠️ [Live AI] Model ${modelName} unavailable (${err.message?.substring(0, 100)}). Failing over to next candidate...`);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini cascade models failed.");
}

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

// Sanitizer to guarantee user-friendly language without internal criteria codes like "DF-02", "DF-01", etc.
const sanitizeUserFacingText = (data) => {
  if (typeof data === "string") {
    return data
      .replace(/(?:Overall\s+)?Feasibility\s+Score:\s*\d+(?:\.\d+)?\/100\s*(?:\([^)]*\))?\.?\s*/gi, "")
      .replace(/\bScore:\s*\d+(?:\.\d+)?\/100\.?\s*/gi, "")
      .replace(/\b\d+\/100\s*\((?:NOT_)?FEASIBLE\)\.?\s*/gi, "")
      .replace(/\s*\(PLV\s*[\d\.\s-]+\)/gi, "")
      .replace(/\s*-\s*PLV\s*[\d\.\s-]+/gi, "")
      .replace(/\bPLV\s*[\d\.\s-]+\b/gi, "")
      .replace(/\bthe\s+DF-\d+\s+gross\s+margin\s+test\b/gi, "the gross profit margin test")
      .replace(/\bDF-\d+\s+gross\s+margin\s+test\b/gi, "gross profit margin test")
      .replace(/\bthe\s+DF-\d+\s+margin\s+test\b/gi, "the gross margin test")
      .replace(/\bDF-\d+\s+margin\s+test\b/gi, "gross margin test")
      .replace(/\bpasses\s+(?:the\s+)?DF-\d+\s+test\b/gi, "maintains a positive gross profit margin")
      .replace(/\bfails\s+(?:the\s+)?DF-\d+\s+test\b/gi, "has a negative or zero gross profit margin")
      .replace(/\bpasses\s+DF-\d+\b/gi, "maintains positive gross profit")
      .replace(/\bfails\s+DF-\d+\b/gi, "has negative gross profit")
      .replace(/\bRule\s+DF-\d+[:\s]*/gi, "Gross Margin Rule: ")
      .replace(/\bcapital reconciliation \(DF-\d+ balance\)/gi, "capital reconciliation balance")
      .replace(/\(DF-\d+\)/gi, "")
      .replace(/\bDF-\d+[:\s-]*/gi, "")
      .replace(/[—–-]\s*(?:similar to|based on|like|aligned with)?\s*(?:proven\s+|local\s+)?benchmarks?(?:\s+(?:such as|like))?\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy)(?:\s*(?:and|,|or)\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy))*\s*[—–-]/gi, " ")
      .replace(/(?:,\s*)?(?:similar to|based on|like|aligned with)\s*(?:proven\s+|local\s+)?benchmarks?(?:\s+(?:such as|like))?\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy)(?:\s*(?:and|,|or)\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy))*/gi, "")
      .replace(/(?:proven\s+|local\s+)?benchmarks?\s*(?:such as|like)\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy)(?:\s*(?:and|,|or)\s*(?:Mr\.?\s*Cabbage|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy))*/gi, "proven market standards")
      .replace(/\b(?:Mr\.?\s*Cabbage(?:\s*\(Brassica Foods\))?|The\s+Dory\s+House(?:\s+Co\.?)?|Dory\s+House|Empinoy)\b/gi, "market standards")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.])/g, "$1")
      .trim();
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeUserFacingText);
  }
  if (data && typeof data === "object") {
    const cleaned = {};
    for (const key of Object.keys(data)) {
      cleaned[key] = sanitizeUserFacingText(data[key]);
    }
    return cleaned;
  }
  return data;
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
// OFFICIAL DTI + SEC NAME CHECKER ENDPOINTS (PROVIDER ARCHITECTURE)
// ==========================================

/**
 * Primary Name-Check API
 * Request Body:
 * {
 *   "name": "Sample Business Name",
 *   "type": "business" | "company" | "all",
 *   "provider": "DTI" | "SEC" (optional override),
 *   "forceRefresh": boolean (optional, bypasses short-TTL cache)
 * }
 */
app.post("/api/name-check", async (req, res) => {
  try {
    const { name, type = "business", provider, forceRefresh = false } = req.body || {};
    const inputName = (name || "").trim();

    if (!inputName) {
      return res.status(400).json({
        status: "ERROR",
        message: "Please enter a business or company name to check.",
        query: "",
        checkedAt: new Date().toISOString()
      });
    }

    const userId = req.user?.uid || req.body?.userId || "anonymous";
    const result = await nameCheckerService.checkName({
      name: inputName,
      type,
      provider,
      forceRefresh: Boolean(forceRefresh),
      userId,
      firestoreInstance: adminFirestore
    });

    return res.json(result);
  } catch (error) {
    console.error("❌ [/api/name-check] Unexpected error:", error);
    return res.status(500).json({
      status: "UNAVAILABLE",
      message: "The name verification service encountered an unexpected error. Please verify directly via official government portals.",
      officialSource: "https://bnrs.dti.gov.ph/search",
      checkedAt: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Name-Check Service Status & Diagnostics
 */
app.get("/api/name-check/status", (req, res) => {
  res.json(nameCheckerService.getStatus());
});

/**
 * Official Registration Sources Information
 */
app.get(["/api/company-names", "/api/registration-sources"], (req, res) => {
  res.json({
    registrationSources: [
      {
        type: "DTI",
        name: "Department of Trade and Industry - Business Name Registration System (BNRS)",
        officialPortal: "https://bnrs.dti.gov.ph/",
        officialSearch: "https://bnrs.dti.gov.ph/search",
        searchType: "Exact Business Name Search",
        coverage: "Sole Proprietorships and Business Names"
      },
      {
        type: "SEC",
        name: "Securities and Exchange Commission (SEC) Philippines",
        officialPortal: "https://esparc.sec.gov.ph/",
        apiMarketplace: "https://dev-api.sec.gov.ph/",
        searchType: "Company Information Lookup & eSPARC Registration",
        coverage: "Corporations, Partnerships, and One Person Corporations (OPC)"
      }
    ],
    architecture: "Provider-based dynamic query against official government sources (no static local name database)"
  });
});

/**
 * Backward compatibility route for legacy /api/check-company-name callers
 */
app.post(["/api/check-company-name", "/api/company-name/check"], async (req, res) => {
  try {
    const { name, companyName, provider, type = "company", forceRefresh } = req.body || {};
    const inputName = (name || companyName || "").trim();

    if (!inputName) {
      return res.json({
        status: "empty",
        resultText: "Please enter a company name to check.",
        isAvailable: false,
        matches: [],
        sourcesChecked: ["DTI", "SEC"],
        disclaimer:
          "Preliminary name check only. Final registration availability must be verified through the official DTI/SEC system."
      });
    }

    const result = await nameCheckerService.checkName({
      name: inputName,
      type,
      provider,
      forceRefresh: Boolean(forceRefresh),
      userId: req.user?.uid || "anonymous",
      firestoreInstance: adminFirestore
    });

    const isFound = result.status === "FOUND";
    const matches = (result.records || []).map((r) => ({
      name: r.businessName || r.companyName || inputName,
      registrationSource: result.provider || "SEC"
    }));

    return res.json({
      status: isFound ? (result.matchType === "exact" ? "exact" : "similar") : "none",
      resultText: isFound ? "Name Already Exists" : "No Match Found",
      isAvailable: !isFound,
      message: result.message,
      matches,
      sourcesChecked: [result.provider || "SEC"],
      officialSource: result.officialSource,
      checkedAt: result.checkedAt,
      disclaimer: result.disclaimer
    });
  } catch (err) {
    console.error("❌ [/api/check-company-name] Error:", err);
    return res.status(500).json({
      status: "error",
      resultText: "Verification Unavailable",
      isAvailable: false,
      message: "External government verification unavailable. Please verify directly via official DTI BNRS or SEC eSPARC.",
      matches: [],
      sourcesChecked: ["DTI", "SEC"],
      disclaimer: "Verification error. Please check official portals."
    });
  }
});

// ==========================================
// PROPOSALS MANAGEMENT & 3-PROPOSAL LIMIT ENDPOINTS
// ==========================================

// Endpoint to validate/check team proposal limit
app.all(["/api/teams/:groupId/proposals/count", "/api/proposals/validate-limit"], async (req, res) => {
  const groupId = req.params.groupId || req.body?.groupId || req.query?.groupId;
  if (!groupId) {
    return res.status(400).json({ error: "groupId is required." });
  }

  const count = await getGroupProposalCount(groupId);
  const maxProposals = 3;
  const allowed = count < maxProposals;

  res.json({
    groupId,
    count,
    max: maxProposals,
    allowed,
    message: allowed
      ? `Proposals: ${count} / ${maxProposals}`
      : "Maximum of 3 proposals reached."
  });
});

// Endpoint to create a proposal with STRICT server-side enforcement of maximum 3 proposals per team
app.post(["/api/teams/:groupId/proposals", "/api/proposals"], async (req, res) => {
  const groupId = req.params.groupId || req.body?.groupId;
  if (!groupId) {
    return res.status(400).json({ error: "groupId is required." });
  }

  const existingCount = await getGroupProposalCount(groupId);
  const maxProposals = 3;

  if (existingCount >= maxProposals) {
    return res.status(400).json({
      error: "Maximum of 3 proposals reached.",
      message: "Maximum of 3 proposals reached per team. Further submissions are blocked.",
      proposalLimitReached: true,
      currentCount: existingCount,
      maxProposals
    });
  }

  const proposalNumber = existingCount + 1;
  const now = new Date().toISOString();
  const proposalData = {
    ...req.body,
    groupId,
    proposalNumber,
    status: req.body.status || "Draft",
    submissionDate: req.body.submissionDate || now,
    adviserRemarks: req.body.adviserRemarks || "",
    createdAt: now,
    updatedAt: now
  };

  let createdId = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (adminFirestore) {
    try {
      const docRef = await adminFirestore.collection("proposals").add(proposalData);
      createdId = docRef.id;
    } catch (e) {
      console.warn("[Backend proposal creation] Firestore add failed, proceeding with generated ID:", e.message);
    }
  }

  teamProposalsStore.set(groupId, existingCount + 1);

  return res.status(201).json({
    success: true,
    message: `Proposal ${proposalNumber} created successfully.`,
    proposalId: createdId,
    proposalNumber,
    currentCount: existingCount + 1,
    proposal: {
      id: createdId,
      ...proposalData
    }
  });
});

// Endpoint to update individual proposal status and adviser remarks
app.put("/api/proposals/:proposalId/status", async (req, res) => {
  const { proposalId } = req.params;
  const { status, adviserRemarks } = req.body || {};

  const validStatuses = [
    "Draft",
    "Submitted",
    "Under Review",
    "Revision Required",
    "Approved",
    "Rejected",
    "Pending",
    "Revision"
  ];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status "${status}". Supported statuses: Draft, Submitted, Under Review, Revision Required, Approved, Rejected.`
    });
  }

  if (adminFirestore) {
    try {
      const updatePayload = {
        updatedAt: new Date().toISOString()
      };
      if (status) updatePayload.status = status;
      if (adviserRemarks !== undefined) updatePayload.adviserRemarks = adviserRemarks;

      await adminFirestore.collection("proposals").doc(proposalId).update(updatePayload);
    } catch (e) {
      console.error("[Backend update proposal status] Error:", e.message);
      return res.status(500).json({ error: "Failed to update proposal in Firestore: " + e.message });
    }
  }

  if (status === "Approved") {
    // Attempt automatic background ingestion evaluation for academic benchmarks
    const candidateProposal = req.body.proposalData || { id: proposalId, status, adviserRemarks };
    dynamicExemplars
      .ingestCandidateProposal(
        candidateProposal,
        req.body.financialData || candidateProposal.financialData || {},
        req.body.aiAnalysis || candidateProposal.aiAnalysis || {},
        adminFirestore
      )
      .catch((err) =>
        console.warn("[Dynamic Exemplar Background Ingest Warning]:", err.message)
      );
  }

  res.json({
    success: true,
    proposalId,
    status,
    adviserRemarks,
    updatedAt: new Date().toISOString()
  });
});

// ==========================================
// DYNAMIC EXEMPLAR BENCHMARKS (HYBRID ENGINE)
// ==========================================

// Endpoint to inspect all current dynamic exemplars
app.get("/api/exemplars/dynamic", (req, res) => {
  const exemplars = dynamicExemplars.loadDynamicExemplars();
  res.json({
    success: true,
    count: exemplars.length,
    exemplars
  });
});

// Endpoint to evaluate and automatically ingest an approved candidate proposal
app.post("/api/exemplars/evaluate-candidate", async (req, res) => {
  const { proposal, financialData, aiAnalysis } = req.body || {};

  if (!proposal) {
    return res.status(400).json({ error: "Missing candidate proposal object." });
  }

  try {
    const result = await dynamicExemplars.ingestCandidateProposal(
      proposal,
      financialData || proposal.financialData || {},
      aiAnalysis || proposal.aiAnalysis || {},
      adminFirestore
    );

    res.json({
      success: true,
      ingested: result.ingested,
      reason: result.reason || null,
      exemplar: result.exemplar || null
    });
  } catch (err) {
    console.error("❌ [Evaluate Candidate Exemplar Error]:", err.message);
    res.status(500).json({ error: "Candidate evaluation failed: " + err.message });
  }
});

// ==========================================
// AI REST API ENDPOINTS
// ==========================================

// Helper to calculate multi-product or single-product financial aggregates
function calculateAggregatedFinancials(financials) {
  const prods = Array.isArray(financials.products) && financials.products.length > 0
    ? financials.products
    : null;

  if (prods && prods.length > 0) {
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalUnitsSold = 0;
    let totalUnitsProduced = 0;

    prods.forEach((p) => {
      const ingredients = Array.isArray(p.ingredients) ? p.ingredients : [];
      const totalIngredientCost = ingredients.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      const totalBatchCost = totalIngredientCost > 0
        ? totalIngredientCost
        : (Number(p.productionCost) || 0);

      const batchYield = Number(p.quantityYield) || 0;
      const batchesPerMonth = (p.batchesPerMonth !== undefined && p.batchesPerMonth !== "" && !isNaN(Number(p.batchesPerMonth)) && Number(p.batchesPerMonth) > 0)
        ? Number(p.batchesPerMonth)
        : 1;

      const produced = batchYield * batchesPerMonth;
      totalUnitsProduced += produced;

      const sold = (p.unitsSold !== undefined && p.unitsSold !== "" && !isNaN(Number(p.unitsSold)))
        ? Math.min(produced > 0 ? produced : Infinity, Math.max(0, Number(p.unitsSold)))
        : produced;
      totalUnitsSold += sold;

      const unitCost = batchYield > 0 ? totalBatchCost / batchYield : (Number(p.unitCost) || 0);
      const cogs = unitCost * sold;
      totalCOGS += cogs;

      const markupPct = Number(p.markupPercentage) || 0;
      const computedBasePrice = unitCost + (unitCost * (markupPct / 100));
      const applyVat = p.applyVat !== false;
      const vatRate = p.vatRate !== undefined ? Number(p.vatRate) : 12;
      const vatMultiplier = applyVat ? (vatRate / 100) : 0;
      const computedVatInclusivePrice = computedBasePrice * (1 + vatMultiplier);
      const suggestedSellingPrice = applyVat ? computedVatInclusivePrice : computedBasePrice;

      const rawSellingPrice = (p.sellingPrice !== undefined && p.sellingPrice !== "" && !isNaN(Number(p.sellingPrice)))
        ? Number(p.sellingPrice)
        : (suggestedSellingPrice > 0 ? Number(suggestedSellingPrice.toFixed(2)) : 0);

      const netSellingPrice = applyVat && vatMultiplier > 0
        ? rawSellingPrice / (1 + vatMultiplier)
        : rawSellingPrice;

      totalRevenue += netSellingPrice * sold;
    });

    const monthlySales = totalUnitsSold;
    const monthlyRevenue = totalRevenue;
    const totalMonthlyVariableCosts = totalCOGS;
    const sellingPrice = monthlySales > 0 ? totalRevenue / monthlySales : 0;
    const variableCost = monthlySales > 0 ? totalCOGS / monthlySales : 0;

    return {
      monthlySales,
      monthlyRevenue,
      totalMonthlyVariableCosts,
      sellingPrice,
      variableCost,
      isMultiProduct: true,
      productCount: prods.length
    };
  }

  // Single-product fallback
  const sellingPrice = Number(financials.sellingPrice) || 0;
  const variableCost = Number(financials.variableCost) || 0;
  const monthlySales = Number(financials.monthlySales) || 0;
  const monthlyRevenue = sellingPrice * monthlySales;
  const totalMonthlyVariableCosts = variableCost * monthlySales;

  return {
    monthlySales,
    monthlyRevenue,
    totalMonthlyVariableCosts,
    sellingPrice,
    variableCost,
    isMultiProduct: false,
    productCount: 1
  };
}

// Helper to generate deterministic marketAnalysis fallback grounded in local benchmarks
function generateFallbackMarketAnalysis(financials) {
  const directCount = Array.isArray(financials.directCompetitors) ? financials.directCompetitors.length : 0;
  const indirectCount = Array.isArray(financials.otherCompetitors) ? financials.otherCompetitors.length : 0;
  const nearbyCount = Array.isArray(financials.nearbyEstablishments) ? financials.nearbyEstablishments.length : 0;
  const demos = Array.isArray(financials.targetDemographics) && financials.targetDemographics.length > 0
    ? financials.targetDemographics.join(", ")
    : "local residents and commuters";

  let summary = "";
  if (directCount <= 2 && nearbyCount > 0) {
    summary = "The location demonstrates positive market viability with low direct competition and strong nearby foot traffic anchors.";
  } else if (nearbyCount === 0) {
    summary = "Direct competitor count is manageable, but the location lacks anchor establishments, meaning customer walk-ins will depend heavily on local promotions.";
  } else {
    summary = "The area has an active commercial presence with established competitors; sustainable sales will require distinct product value or competitive pricing.";
  }

  return {
    summary,
    competitorInsight: {
      status: directCount <= 2 ? "positive" : "warning",
      badge: directCount === 0 ? "Zero Direct Competition" : (directCount <= 2 ? "Manageable Competition" : "Competitive Density"),
      text: directCount <= 2
        ? `${directCount} direct competitor(s) and ${indirectCount} indirect competitor(s) listed. Low saturation gives your business ample room to capture local market share.`
        : `${directCount} direct competitor(s) listed in the immediate vicinity. You will need clear menu differentiation or pricing advantage to prevent customer loss.`
    },
    footTrafficInsight: {
      status: nearbyCount > 0 ? "positive" : "warning",
      badge: nearbyCount > 0 ? "Anchor Foot Traffic Present" : "Customer Acquisition Risk",
      text: nearbyCount > 0
        ? `${nearbyCount} nearby establishment(s) listed. These anchors generate consistent daily foot traffic, reducing reliance on expensive marketing.`
        : "No nearby anchor establishments listed. Without natural walk-in foot traffic, expect higher customer acquisition costs through social media or flyers."
    },
    demographicInsight: {
      status: "positive",
      badge: "Demographic Strategy",
      text: `Focus your promotions on ${demos}. Keeping entry-level prices accessible and offering value combos encourages steady repeat purchases.`
    }
  };
}

// ==========================================
// DEFENSE-GRADE FINANCIAL FEASIBILITY EVALUATION ENGINE
// Aligned with PLV BA8 Capstone Grading Standards
// ==========================================
function evaluateDefenseFeasibility(financials, kb, businessType = "") {
  const category = dynamicExemplars.normalizeCategory(businessType || financials.businessType || financials.category || "");

  const agg = calculateAggregatedFinancials(financials);
  const sellingPrice = agg.sellingPrice;
  const variableCost = agg.variableCost;
  const monthlySales = agg.monthlySales;
  const monthlyRevenue = agg.monthlyRevenue;
  const totalMonthlyVariableCosts = agg.totalMonthlyVariableCosts;
  const operatingDays = Number(financials.operatingDays) || 300;
  const isCapitalBorrowed = Boolean(financials.isCapitalBorrowed);
  const interestRate = Number(financials.interestRate) || 0;

  const equipmentList = financials.equipmentList || [];
  const equipmentTotal = equipmentList.reduce(
    (sum, item) => sum + (Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0),
    0
  );

  const contribSum = Array.isArray(financials.contributorsList) && financials.contributorsList.length > 0
    ? financials.contributorsList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
    : 0;

  const declaredCapital = contribSum > 0
    ? contribSum
    : (Number(financials.cashInvested) || Number(financials.startupCapital) || Number(financials.totalCapital) || Number(financials.proposalCapital) || 0);

  const safeStartupCapital = equipmentTotal > 0 ? equipmentTotal : declaredCapital;

  const cashReserve = declaredCapital > 0
    ? Math.max(0, declaredCapital - equipmentTotal)
    : (equipmentList.length > 0 ? 0 : declaredCapital);

  const capitalDeficit = equipmentList.length > 0 && declaredCapital > 0 && equipmentTotal > declaredCapital;

  const opexList = financials.opexList || [];
  const monthlyOpex = opexList.length > 0
    ? opexList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : (Number(financials.fixedCosts) || 0);

  const monthlyInterest = isCapitalBorrowed ? (safeStartupCapital * (interestRate / 100)) / 12 : 0;
  const netMonthlyProfit = monthlyRevenue - totalMonthlyVariableCosts - monthlyOpex - monthlyInterest;

  const annualRevenue = (monthlyRevenue / 30) * operatingDays;
  const annualExpenses = ((totalMonthlyVariableCosts + monthlyOpex + monthlyInterest) / 30) * operatingDays;
  const annualNetProfitPreTax = annualRevenue - annualExpenses;

  // Philippine Smart Taxation: BMBE (RA 9178) vs Regular MSME (CREATE Act)
  const isBmbeQualified = annualRevenue <= 3000000 && safeStartupCapital <= 3000000;
  const applicableTax = isBmbeQualified
    ? (annualRevenue > 0 ? annualRevenue * 0.03 : 0) // 3% Philippine Percentage Tax (BMBE RA 9178)
    : (annualNetProfitPreTax > 0 ? annualNetProfitPreTax * 0.20 : 0); // 20% Corporate Tax under CREATE Act
  const taxTypeLabel = isBmbeQualified ? "3% BMBE Percentage Tax" : "20% Corporate Income Tax (CREATE Act)";
  const annualNetProfitAfterTax = (annualNetProfitPreTax > 0 ? annualNetProfitPreTax : 0) - applicableTax;

  const paybackBase = declaredCapital > 0 ? declaredCapital : safeStartupCapital;
  const paybackPeriodMonths = annualNetProfitAfterTax > 0
    ? (paybackBase / (annualNetProfitAfterTax / 12))
    : Infinity;
  const paybackPeriodStr = paybackPeriodMonths === Infinity ? "Infinity (Never)" : `${paybackPeriodMonths.toFixed(1)} months`;

  const unitGrossMargin = sellingPrice - variableCost;
  const grossMarginPct = sellingPrice > 0 ? (unitGrossMargin / sellingPrice) * 100 : 0;
  const netMarginPct = monthlyRevenue > 0 ? (netMonthlyProfit / monthlyRevenue) * 100 : 0;
  const cashRunwayMonths = monthlyOpex > 0 ? (cashReserve / monthlyOpex) : (cashReserve > 0 ? 12 : 0);

  // Dual Break-Even: Units + Break-Even Revenue in Pesos (BEP_PHP = Fixed Costs / CMR)
  const unitContribution = Math.max(0, unitGrossMargin);
  const bepUnits = unitContribution > 0 ? Math.ceil((monthlyOpex + monthlyInterest) / unitContribution) : Infinity;
  const bepRatio = monthlySales > 0 && bepUnits !== Infinity ? (bepUnits / monthlySales) * 100 : Infinity;

  const totalGrossProfit = monthlyRevenue - totalMonthlyVariableCosts;
  const cmr = monthlyRevenue > 0 ? totalGrossProfit / monthlyRevenue : 0;
  const bepRevenue = cmr > 0 ? Math.ceil((monthlyOpex + monthlyInterest) / cmr) : Infinity;
  const bepRevenueStr = bepRevenue === Infinity ? "N/A" : `PHP ${Math.round(bepRevenue).toLocaleString()}`;
  const bepRevenueRatio = monthlyRevenue > 0 && bepRevenue !== Infinity ? (bepRevenue / monthlyRevenue) * 100 : Infinity;

  // Sector margin bounds
  let bounds = { primeMin: 12, primeMax: 28, fantasyCap: 38, vulnerableFloor: 8, label: "General Enterprise" };
  if (category.includes("Food")) {
    bounds = { primeMin: 12, primeMax: 22, fantasyCap: 30, vulnerableFloor: 10, label: "Food & Beverage / Food Service" };
  } else if (category.includes("Retail")) {
    bounds = { primeMin: 8, primeMax: 16, fantasyCap: 25, vulnerableFloor: 6, label: "Retail & Consumer Goods" };
  } else if (category.includes("Manufacturing")) {
    bounds = { primeMin: 15, primeMax: 25, fantasyCap: 35, vulnerableFloor: 10, label: "Manufacturing & Production" };
  } else if (category.includes("Service") || category.includes("Tech") || category.includes("Digital")) {
    bounds = { primeMin: 20, primeMax: 32, fantasyCap: 40, vulnerableFloor: 12, label: "Services & Tech" };
  }

  // Fatal flaws (Immediate NOT_FEASIBLE)
  const fatalFlaws = [];
  if (unitGrossMargin <= 0) {
    fatalFlaws.push("Selling price is less than or equal to unit production cost (negative unit margin).");
  }
  if (netMonthlyProfit <= 0 || annualNetProfitAfterTax <= 0) {
    fatalFlaws.push("Business operates at a net cash loss per month after operating expenses.");
  }
  if (capitalDeficit) {
    fatalFlaws.push(`Equipment costs (PHP ${Math.round(equipmentTotal).toLocaleString()}) exceed declared capital (PHP ${Math.round(declaredCapital).toLocaleString()}), creating an immediate startup deficit.`);
  }
  if (paybackPeriodMonths > 48 || paybackPeriodMonths === Infinity) {
    fatalFlaws.push("Capital recovery period exceeds 4 years or is never recovered with current earnings.");
  }

  // Severe warning flags (Downgrade to CONDITIONALLY_FEASIBLE)
  const severeFlags = [];
  if (netMarginPct > bounds.fantasyCap) {
    severeFlags.push({
      id: "fantasy-margin",
      title: "Unrealistic High Net Profit Margin",
      description: `Your net profit margin of ${netMarginPct.toFixed(1)}% is an unrealistic outlier for ${category} (standard student capstone ceiling is ${bounds.fantasyCap}%). Please check if monthly rent, worker salaries, electricity, or taxes were missed.`,
      tip: `Check monthly OPEX: ensure you budgeted commercial stall rent, crew wages, electricity, and taxes so profit margins stay within realistic ${bounds.primeMin}%-${bounds.primeMax}% standards.`
    });
  } else if (netMarginPct > 0 && netMarginPct < bounds.vulnerableFloor) {
    severeFlags.push({
      id: "vulnerable-margin",
      title: "Fragile Profit Margin",
      description: `Your net profit margin of ${netMarginPct.toFixed(1)}% is below the ${bounds.vulnerableFloor}% safe cushion for ${category}. A minor rise in ingredient or supply costs will wipe out your profits.`,
      tip: "Increase selling price slightly or negotiate lower supplier costs to build a safer profit buffer."
    });
  }

  if (cashRunwayMonths < 1.0 && !capitalDeficit) {
    severeFlags.push({
      id: "low-runway",
      title: "Low Cash Buffer for Bills",
      description: `Your cash savings (PHP ${Math.round(cashReserve).toLocaleString()}) only cover ${cashRunwayMonths.toFixed(1)} months of monthly bills and rent. Allocate at least 1.5 to 2.0 months of cash reserve so you do not run out of money before sales stabilize.`,
      tip: "Increase declared startup capital to ensure at least 1.5 to 2.0 months of fixed operating overhead is kept as a cash buffer."
    });
  }

  if (bepRatio > 75 && bepUnits !== Infinity) {
    severeFlags.push({
      id: "high-bep",
      title: "High Break-Even Sales Pressure",
      description: `You must sell ${bepUnits.toLocaleString()} units (${bepRatio.toFixed(0)}% of your monthly goal) just to pay your bills. A slight 15% drop in sales will push the business into a loss.`,
      tip: "Lower fixed monthly bills or improve unit profit margin to reduce the number of sales needed to break even."
    });
  }

  if (paybackPeriodMonths > 0 && paybackPeriodMonths < 3.0) {
    severeFlags.push({
      id: "unrealistic-fast-payback",
      title: "Unrealistically Fast Payback Period",
      description: `An estimated payback period of ${paybackPeriodMonths.toFixed(1)} months is unusually fast for capital investments. Verify that startup equipment and pre-operating costs are fully budgeted.`,
      tip: "Double-check your equipment list and pre-operating costs to make sure all startup assets were budgeted."
    });
  } else if (paybackPeriodMonths > 36.0 && paybackPeriodMonths <= 48.0) {
    severeFlags.push({
      id: "slow-payback",
      title: "Slow Capital Payback",
      description: `Earning back your initial capital takes ${paybackPeriodMonths.toFixed(1)} months (over 3 years), which poses a high risk of tying up money for too long.`,
      tip: "Increase monthly sales volume or trim operating expenses to accelerate capital payback time."
    });
  }

  // Determine status and score
  let status = "FEASIBLE";
  let score = 85;

  if (fatalFlaws.length > 0) {
    status = "NOT_FEASIBLE";
    if (unitGrossMargin <= 0) score = 15;
    else if (capitalDeficit) score = 35;
    else if (paybackPeriodMonths > 48) score = 50;
    else score = 30;
  } else if (severeFlags.length > 0) {
    status = "CONDITIONALLY_FEASIBLE";
    score = Math.min(78, Math.max(70, Math.round(76 - (severeFlags.length - 1) * 2)));
  } else {
    status = "FEASIBLE";
    let base = 84;
    if (netMarginPct >= bounds.primeMin && netMarginPct <= bounds.primeMax) base += 4;
    if (cashRunwayMonths >= 1.5) base += 3;
    if (bepRatio <= 60) base += 3;
    if (paybackPeriodMonths <= 24) base += 3;
    score = Math.min(98, Math.max(80, base));
  }

  // Component scores
  let financialScore = 88;
  let riskScore = 90;
  let marketScore = 80;

  if (status === "NOT_FEASIBLE") {
    financialScore = Math.min(45, score + 10);
    riskScore = 30;
    marketScore = monthlySales > 0 ? 60 : 40;
  } else if (status === "CONDITIONALLY_FEASIBLE") {
    financialScore = 75;
    riskScore = cashRunwayMonths < 1.0 ? 68 : 74;
    marketScore = 76;
  } else {
    financialScore = score >= 90 ? 94 : 88;
    riskScore = cashRunwayMonths >= 2.0 ? 94 : 88;
    marketScore = 85;
  }

  const performanceGrade = status === "NOT_FEASIBLE"
    ? "Unsatisfactory"
    : (status === "CONDITIONALLY_FEASIBLE" ? "Conditional" : (score >= 90 ? "Outstanding" : "Satisfactory"));

  const performanceStatus = status === "NOT_FEASIBLE"
    ? "Fail (Major Revisions Required)"
    : (status === "CONDITIONALLY_FEASIBLE" ? "Conditional Pass (Revision Required)" : (score >= 90 ? "Pass (Highly Feasible)" : "Pass (Feasible with Minor Risks)"));

  const performanceRecommendation = status === "NOT_FEASIBLE"
    ? "Major structural or financial defects detected. Review production costs, capital adequacy, and monthly expenses before defense."
    : (status === "CONDITIONALLY_FEASIBLE"
      ? "Revisions required for panel defense: review the highlighted warning flags (unrealistic profit margins, cash runway, or break-even target) before final defense sign-off."
      : "Strong, defensible study with healthy margins and realistic financial buffers. Ready for implementation.");

  return {
    category,
    agg,
    sellingPrice,
    variableCost,
    unitGrossMargin,
    grossMarginPct,
    monthlySales,
    monthlyRevenue,
    totalMonthlyVariableCosts,
    monthlyOpex,
    monthlyInterest,
    declaredCapital,
    equipmentTotal,
    cashReserve,
    capitalDeficit,
    cashRunwayMonths,
    netMonthlyProfit,
    netMarginPct,
    annualRevenue,
    annualExpenses,
    annualNetProfitAfterTax,
    paybackPeriodMonths,
    paybackPeriodStr,
    bepUnits,
    bepRatio,
    bepRevenue,
    bepRevenueStr,
    bepRevenueRatio,
    cmr,
    isBmbeQualified,
    taxTypeLabel,
    applicableTax,
    bounds,
    fatalFlaws,
    severeFlags,
    status,
    score,
    performanceGrade,
    performanceStatus,
    performanceRecommendation,
    metrics: { financial: financialScore, risk: riskScore, market: marketScore },
    aiScores: { financial: financialScore, operational: riskScore, market: marketScore }
  };
}

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

      // Run defense evaluation engine
      const evalResult = evaluateDefenseFeasibility(financials, kb, req.body.businessType || financials.businessType || financials.category);
      const {
        category,
        agg,
        sellingPrice,
        variableCost,
        unitGrossMargin,
        grossMarginPct,
        monthlySales,
        monthlyRevenue,
        totalMonthlyVariableCosts,
        monthlyOpex,
        monthlyInterest,
        declaredCapital,
        equipmentTotal,
        cashReserve,
        cashRunwayMonths,
        netMonthlyProfit,
        netMarginPct,
        annualRevenue,
        annualNetProfitAfterTax,
        paybackPeriodMonths,
        paybackPeriodStr,
        bepUnits,
        bepRatio,
        bepRevenue,
        bepRevenueStr,
        bepRevenueRatio,
        cmr,
        isBmbeQualified,
        taxTypeLabel,
        applicableTax,
        bounds,
        fatalFlaws,
        severeFlags,
        status,
        score,
        performanceGrade,
        performanceStatus,
        performanceRecommendation,
        metrics,
        aiScores
      } = evalResult;

      // Strict prompt with plain-English instructions and exact defense feedback
      const prompt = `
You are an academic business feasibility defense auditing assistant for college students.
Your job is to evaluate the student's business FINANCIAL DATA using clear, simple, and direct English.

LOCAL KNOWLEDGE BASE CONTEXT (FOR REALISM & GRADING STANDARDS):
${JSON.stringify(kb.evaluation_framework, null, 2)}

FEW-SHOT SUCCESSFUL BUSINESS EXEMPLARS FOR REFERENCE:
${JSON.stringify(dynamicExemplars.getCategoryMatchedExemplars(req.body.businessType || req.body.category || 'General', kb.exemplars), null, 2)}

AUDITED BUSINESS SECTOR: "${category}"
AUDITED FEASIBILITY STATUS: "${status}" (Score: ${score}/100, Grade: "${performanceGrade} - ${performanceStatus}")

AUDITED DEFENSE WARNING FLAGS DETECTED:
${severeFlags.length > 0 ? severeFlags.map(f => `- ${f.title}: ${f.description}`).join('\n') : 'None. All indicators fall within healthy benchmark bounds.'}

${fatalFlaws.length > 0 ? `FATAL DEFECTS:\n${fatalFlaws.map(f => `- ${f}`).join('\n')}` : ''}

SUBMITTED FINANCIAL METRICS:
- Average Selling Price: PHP ${sellingPrice.toFixed(2)}
- Average COGS / Unit: PHP ${variableCost.toFixed(2)}
- Unit Contribution Margin: PHP ${unitGrossMargin.toFixed(2)} (${grossMarginPct.toFixed(1)}%)
- Monthly Sales Volume: ${monthlySales} units
- Monthly Gross Revenue: PHP ${Math.round(monthlyRevenue).toLocaleString()}
- Total Monthly Production Cost (COGS): PHP ${Math.round(totalMonthlyVariableCosts).toLocaleString()}
- Total Declared Startup Capital: PHP ${Math.round(declaredCapital).toLocaleString()}
- Equipment Cost (CapEx): PHP ${Math.round(equipmentTotal).toLocaleString()}
- Cash Buffer / Reserve: PHP ${Math.round(cashReserve).toLocaleString()} (Covers ${cashRunwayMonths.toFixed(1)} months of expenses)
- Monthly Operating Expenses (OPEX): PHP ${Math.round(monthlyOpex).toLocaleString()}
- Net Monthly Profit: PHP ${Math.round(netMonthlyProfit).toLocaleString()} (Net Margin: ${netMarginPct.toFixed(1)}%, Industry Healthy Range: ${bounds.primeMin}%-${bounds.primeMax}%, Fantasy Cap: ${bounds.fantasyCap}%)
- Break-Even Point: ${bepUnits === Infinity ? 'N/A' : `${bepUnits.toLocaleString()} units (${bepRatio.toFixed(0)}% of monthly target)`} | Break-Even Revenue: ${bepRevenueStr} (CMR ${(cmr * 100).toFixed(1)}%)
- Philippine Tax Framework: ${taxTypeLabel} (Annual Tax: PHP ${Math.round(applicableTax).toLocaleString()})
- Capital Payback Time: ${paybackPeriodStr}
- Direct Competitors: ${Array.isArray(financials.directCompetitors) && financials.directCompetitors.length > 0 ? financials.directCompetitors.join(', ') : 'None specified'}
- Nearby Demand Drivers / Foot Traffic Anchors: ${Array.isArray(financials.nearbyEstablishments) && financials.nearbyEstablishments.length > 0 ? financials.nearbyEstablishments.join(', ') : 'None specified'}
- Target Demographics: ${Array.isArray(financials.targetDemographics) && financials.targetDemographics.length > 0 ? financials.targetDemographics.join(', ') : 'General public'}

MANDATORY OUTPUT CONSTRAINTS & TONE:
1. WRITE IN SIMPLE, DIRECT PLAIN ENGLISH:
   Use short, direct sentences that students easily understand without financial jargon.
   - Do NOT write internal codes like "DF-01", "DF-02", or arbitrary score fractions like "85/100" in narrative text.
   - Speak directly to the student (e.g. write "Your food stall earns PHP 20,000 profit each month, which is healthy" or "Your cash buffer only covers 2 weeks of rent and bills").
2. DIRECT DEFENSE REVISION CHECKLIST:
   When status is "CONDITIONALLY_FEASIBLE", explicitly tell the student what numbers to review in "improvementTips.feasibility" and "explanations.feasibility":
   - If profit margin is an unrealistic outlier, say: "Check if commercial stall rent, worker salaries, electricity, or taxes were missed."
   - If cash buffer is low, say: "Add more cash savings to cover at least 2 months of bills so you don't run out of money."
   - If break-even is high, say: "Lower monthly operating costs or adjust pricing so you don't need to sell so many units just to pay bills."
3. MANDATORY 4 STRUCTURED INSIGHTS (Plain English):
   Your "insights" array MUST contain exactly these 4 cards:
   - Card 1: title "Profit Margin Status" (explaining in plain words if margin is realistic or an unrealistic outlier).
   - Card 2: title "Cash Runway Buffer" (explaining in plain words how many months of rent and operating bills the startup cash buffer can survive).
   - Card 3: title "Break-Even Safety" (explaining how many items they must sell each month just to pay monthly bills).
   - Card 4: title "Capital Payback Time" (explaining how long it takes to recover their capital).

MANDATORY OUTPUT VALUES:
- "score": ${score}
- "status": "${status}"
- "performanceGrade": "${performanceGrade}"
- "performanceStatus": "${performanceStatus}"
- "performanceRecommendation": "${performanceRecommendation}"
- "metrics": ${JSON.stringify(metrics)}
- "aiScores": ${JSON.stringify(aiScores)}

Your response must be a single stringified JSON object matching this structure:
{
  "score": ${score},
  "status": "${status}",
  "performanceGrade": "${performanceGrade}",
  "performanceStatus": "${performanceStatus}",
  "performanceRecommendation": "${performanceRecommendation}",
  "metrics": ${JSON.stringify(metrics)},
  "aiScores": ${JSON.stringify(aiScores)},
  "explanations": {
    "feasibility": "Short 2-3 sentence plain English overview of whether the business is feasible, conditionally feasible, or not feasible, and why.",
    "financial": "Short plain English explanation of selling price, monthly net profit, and profit margin.",
    "risk": "Short plain English explanation of cash runway buffer, bills coverage, and capital payback.",
    "market": "Short plain English explanation of sales volume target and competition."
  },
  "insights": [
    { "type": "${status === 'CONDITIONALLY_FEASIBLE' && netMarginPct > bounds.fantasyCap ? 'warning' : (netMarginPct <= 0 ? 'warning' : 'positive')}", "title": "Profit Margin Status", "description": "Short plain English explanation of profit margin." },
    { "type": "${cashRunwayMonths >= 1.5 ? 'positive' : (cashRunwayMonths >= 1.0 ? 'info' : 'warning')}", "title": "Cash Runway Buffer", "description": "Short plain English explanation of cash buffer covering months of expenses." },
    { "type": "${bepRatio <= 65 ? 'positive' : (bepRatio <= 80 ? 'info' : 'warning')}", "title": "Break-Even Target (Units & Pesos)", "description": "Short plain English explanation of ${bepUnits.toLocaleString()} units or ${bepRevenueStr} in gross revenue needed to break even." },
    { "type": "${paybackPeriodMonths <= 30 && paybackPeriodMonths >= 3 ? 'positive' : (paybackPeriodMonths <= 36 ? 'info' : 'warning')}", "title": "Capital Payback Time", "description": "Short plain English explanation of payback duration." }
  ],
  "improvementTips": {
    "feasibility": "${status === 'CONDITIONALLY_FEASIBLE' ? severeFlags.map(f => f.tip).join(' ') : (status === 'FEASIBLE' ? 'Keep pricing steady and monitor supply costs to maintain your healthy net profit.' : 'Review product pricing, eliminate capital deficit, and lower monthly expenses.')}",
    "financial": ["Specific plain English tip on pricing or overhead expenses"],
    "operations": ["Specific plain English tip on equipment budget, rent, or cash reserve"],
    "marketing": ["Specific plain English tip on promotion or reaching target customers"]
  },
  "aiScoreExplanations": {
    "financial": "Brief plain English summary of margins and net profit.",
    "operational": "Brief plain English summary of equipment and cash runway.",
    "market": "Brief plain English summary of volume and competition."
  },
  "marketAnalysis": {
    "summary": "Short 1-2 sentence straight-to-the-point evaluation of market indicators in simple English.",
    "competitorInsight": {
      "status": "positive or warning",
      "badge": "e.g. Low Competition or Competitive Density",
      "text": "Short concise takeaway on competitors in simple English."
    },
    "footTrafficInsight": {
      "status": "positive or warning",
      "badge": "e.g. Anchor Foot Traffic Present or Walk-in Customer Risk",
      "text": "Short concise takeaway on foot traffic and nearby anchors in simple English."
    },
    "demographicInsight": {
      "status": "positive",
      "badge": "e.g. Demographic Alignment",
      "text": "Short concise takeaway on target customers and pricing in simple English."
    }
  }
}

IMPORTANT: The response MUST be strictly valid JSON without markdown wrapping or comments. For the 'type' field in the 'insights' array, choose one of: 'positive', 'warning', 'info', or 'suggestion'.
`;

      const { result, modelName } = await callGeminiCascade(prompt, {
        responseMimeType: "application/json"
      });
      const textResponse = result.response.text();
      let parsedResponse = cleanAndParseJSON(textResponse);

      // Enforce the exact programmatic metrics
      parsedResponse.score = score;
      parsedResponse.status = status;
      parsedResponse.performanceGrade = performanceGrade;
      parsedResponse.performanceStatus = performanceStatus;
      parsedResponse.performanceRecommendation = performanceRecommendation;
      parsedResponse.metrics = metrics;
      parsedResponse.aiScores = aiScores;
      parsedResponse.severeFlags = severeFlags;
      parsedResponse.fatalFlaws = fatalFlaws;

      // Ensure marketAnalysis is always populated with valid structure
      if (!parsedResponse.marketAnalysis || typeof parsedResponse.marketAnalysis !== "object") {
        parsedResponse.marketAnalysis = generateFallbackMarketAnalysis(financials);
      }

      // Sanitize user-facing text
      parsedResponse = sanitizeUserFacingText(parsedResponse);
      parsedResponse._fallback = false;
      parsedResponse._model = modelName;

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

      // Robust fallback defense calculation
      const financials = req.body.financialData || req.body.financials || req.body;
      const kb = getKnowledgeBase();
      const evalResult = evaluateDefenseFeasibility(financials, kb, req.body.businessType || financials.businessType || financials.category);

      const defaultInsights = [
        {
          type: evalResult.status === "CONDITIONALLY_FEASIBLE" && evalResult.netMarginPct > evalResult.bounds.fantasyCap ? "warning" : (evalResult.netMarginPct <= 0 ? "warning" : "positive"),
          title: "Profit Margin Status",
          description: evalResult.netMarginPct > evalResult.bounds.fantasyCap
            ? `Your net profit margin is ${evalResult.netMarginPct.toFixed(1)}%. This is unusually high for ${evalResult.category}. Check if commercial rent, employee wages, or utility bills were omitted.`
            : (evalResult.netMarginPct <= 0
              ? `Your net margin is negative (${evalResult.netMarginPct.toFixed(1)}%). Ongoing operations run at a monthly loss.`
              : `Your net profit margin is ${evalResult.netMarginPct.toFixed(1)}%, which is healthy and realistic for a ${evalResult.category} business.`)
        },
        {
          type: evalResult.cashRunwayMonths >= 1.5 ? "positive" : (evalResult.cashRunwayMonths >= 1.0 ? "info" : "warning"),
          title: "Cash Runway Buffer",
          description: evalResult.cashRunwayMonths >= 1.5
            ? `Your cash reserve (PHP ${Math.round(evalResult.cashReserve).toLocaleString()}) covers ${evalResult.cashRunwayMonths.toFixed(1)} months of monthly expenses, providing a safe buffer.`
            : `Your cash reserve (PHP ${Math.round(evalResult.cashReserve).toLocaleString()}) covers only ${evalResult.cashRunwayMonths.toFixed(1)} months of expenses. Allocate a larger cash buffer.`
        },
        {
          type: evalResult.bepRatio <= 65 ? "positive" : (evalResult.bepRatio <= 80 ? "info" : "warning"),
          title: "Break-Even Target (Units & Pesos)",
          description: evalResult.bepUnits === Infinity
            ? "Break-even cannot be calculated due to zero or negative unit margins."
            : `Break-even requires ${evalResult.bepUnits.toLocaleString()} units or ${evalResult.bepRevenueStr} in gross revenue (${evalResult.bepRatio.toFixed(0)}% of monthly target) to cover monthly overhead (PHP ${Math.round(evalResult.monthlyOpex).toLocaleString()}). CMR: ${(evalResult.cmr * 100).toFixed(1)}%.`
        },
        {
          type: evalResult.paybackPeriodMonths <= 30 && evalResult.paybackPeriodMonths >= 3 ? "positive" : (evalResult.paybackPeriodMonths <= 36 ? "info" : "warning"),
          title: "Capital Payback Time",
          description: `Estimated investment payback takes ${evalResult.paybackPeriodStr} based on annual net earnings after tax.`
        }
      ];

      res.json({
        score: evalResult.score,
        status: evalResult.status,
        performanceGrade: evalResult.performanceGrade,
        performanceStatus: evalResult.performanceStatus,
        performanceRecommendation: evalResult.performanceRecommendation,
        bepRevenue: evalResult.bepRevenue,
        bepRevenueStr: evalResult.bepRevenueStr,
        bepRevenueRatio: evalResult.bepRevenueRatio,
        cmr: evalResult.cmr,
        isBmbeQualified: evalResult.isBmbeQualified,
        taxTypeLabel: evalResult.taxTypeLabel,
        metrics: evalResult.metrics,
        aiScores: evalResult.aiScores,
        explanations: {
          feasibility: `Feasibility Assessment: ${evalResult.status === "FEASIBLE" ? "Feasible" : (evalResult.status === "CONDITIONALLY_FEASIBLE" ? "Conditionally Feasible" : "Not Feasible")}. ${evalResult.status === "FEASIBLE" ? "Business shows healthy positive net margins and stable operating profit." : (evalResult.status === "CONDITIONALLY_FEASIBLE" ? "Business is profitable but has warning flags requiring revision before final presentation." : "Business shows negative margins or capital deficit - review costs.")}`,
          financial: `Average selling price of PHP ${evalResult.sellingPrice.toFixed(2)} produces PHP ${Math.round(evalResult.netMonthlyProfit).toLocaleString()} estimated monthly net profit (${evalResult.netMarginPct.toFixed(1)}% margin). Break-even revenue is ${evalResult.bepRevenueStr} (CMR ${(evalResult.cmr * 100).toFixed(1)}%). Tax applied: ${evalResult.taxTypeLabel}.`,
          risk: `Cash buffer covers ${evalResult.cashRunwayMonths.toFixed(1)} months of operating bills. Capital payback is estimated at ${evalResult.paybackPeriodStr}.`,
          market: `Projected monthly volume of ${evalResult.monthlySales.toLocaleString()} units produces PHP ${Math.round(evalResult.monthlyRevenue).toLocaleString()} gross monthly revenue.`
        },
        insights: defaultInsights,
        improvementTips: {
          feasibility: evalResult.status === "CONDITIONALLY_FEASIBLE"
            ? (evalResult.severeFlags.length > 0 ? evalResult.severeFlags.map(f => f.tip).join(" ") : "Refine cost projections and cash reserves.")
            : (evalResult.status === "FEASIBLE" ? "Maintain pricing and monitor supplier costs to preserve positive operating net margins." : "Re-evaluate selling price, negotiate supplier variable costs, or reduce monthly overhead to achieve positive cash flow."),
          financial: ["Audit recurring utility and overhead expenses to protect operating net margins."],
          operations: ["Validate equipment quotation list to avoid unexpected initial capital expansion."],
          marketing: ["Focus marketing on nearby anchor establishments to reliably meet sales volume."]
        },
        aiScoreExplanations: {
          financial: "Evaluates unit contribution margins, OPEX coverage, and net profit.",
          operational: "Evaluates startup capital requirements and fixed cost commitments.",
          market: "Evaluates monthly volume and sales revenue capacity."
        },
        marketAnalysis: generateFallbackMarketAnalysis(financials),
        severeFlags: evalResult.severeFlags,
        fatalFlaws: evalResult.fatalFlaws,
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

      // Sanitize customAIRules to prevent prompt injection attacks
      const sanitizeRuleInput = (val, maxLen = 300) => {
        if (!val || typeof val !== "string") return "";
        return val
          .slice(0, maxLen)
          .replace(/(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous\s+)?(?:instructions|rules|prompts)/gi, "[filtered]")
          .replace(/(?:system\s+prompt|developer\s+mode|jailbreak)/gi, "[filtered]")
          .trim();
      };

      const safeCustomRules = {
        tone: sanitizeRuleInput(payload.customAIRules?.tone) || 'Default academic and constructive tone.',
        dealbreakers: sanitizeRuleInput(payload.customAIRules?.dealbreakers) || 'None specific.',
        focusAreas: sanitizeRuleInput(payload.customAIRules?.focusAreas) || 'General feasibility and consistency.',
        formatting: sanitizeRuleInput(payload.customAIRules?.formatting) || 'Follow standard output structure.',
      };

      // Pass target criteria and exemplars as few-shot data structures
      const prompt = `
You are an expert academic feasibility study evaluator assessing a BUSINESS PROPOSAL with attached FINANCIAL PROJECTIONS.
Do not use general world-wide knowledge. Rely purely on the local data.

LOCAL GRADING MATRIX CONTEXT:
${JSON.stringify(kb.evaluation_framework, null, 2)}

FEW-SHOT PASSING EXEMPLARS FOR REFERENCE STYLE AND QUALITY:
${JSON.stringify(dynamicExemplars.getCategoryMatchedExemplars(businessType, kb.exemplars), null, 2)}

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
- Tone & Style: ${safeCustomRules.tone}
- Dealbreakers: ${safeCustomRules.dealbreakers}
- Focus Areas: ${safeCustomRules.focusAreas}
- Formatting: ${safeCustomRules.formatting}

WARNING: You MUST adopt the general tone specified in the custom rules above while maintaining strict academic grading integrity. Never alter the required JSON schema or ignore quantitative financial discrepancies.

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

      const { result, modelName } = await callGeminiCascade(prompt, {
        responseMimeType: "application/json"
      });
      const textResponse = result.response.text();
      const parsedProposal = cleanAndParseJSON(textResponse);
      parsedProposal._fallback = false;
      parsedProposal._model = modelName;
      res.json(sanitizeUserFacingText(parsedProposal));

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

// Global Express Error Handler for body-parser or route failures
app.use((err, req, res, next) => {
  console.error("❌ [Express Error Handler]:", err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    details: "An unexpected error occurred on the backend.",
  });
});

// Port handling
const PORT = process.env.PORT || 10000;
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use by another process. Please free port ${PORT} or check running Node processes.`);
  } else {
    console.error("❌ Server error:", err);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Feasify-Backend live on port ${PORT}`);
});