require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

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

// Robust helper to strip potential markdown code backticks returned by LLMs
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
  return JSON.parse(cleaned.trim());
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

      // Strict prompt forcing isolated data constraints, zero outside search, temperature 0
      const prompt = `
You are a closed-domain mathematical auditing assistant evaluating a student's business FINANCIAL DATA.
Do not use any outside general-world knowledge. Rely purely on the evaluation rules and numerical metrics.

EVALUATION RULES:
1. Rule DF-02 (Gross Margin): Selling Price - COGS/Unit > 0. If fails, status must be NOT_FEASIBLE.
2. Rule DF-03 (Capital Reconciliation): Sum of Startup costs + Cash Reserve must equal Declared Capital.
3. Financial health metrics:
   - Feasible Status: Needs a realistic cash reserve (at least 1-2 months of monthly OPEX).
   - If cash reserve is low (less than 1 month of monthly OPEX), status is CONDITIONALLY_FEASIBLE with warning insights.

SUBMITTED FINANCIAL DATA:
- Selling Price per Unit: PHP ${financials.sellingPrice || 0}
- Cost of Goods Sold (COGS) per Unit: PHP ${financials.variableCost || 0}
- Monthly Sales Volume (Units): ${financials.monthlySales || 0}
- Declared Startup Capital: PHP ${financials.startupCapital || 0}
- Monthly Operating Expenses (OPEX): PHP ${financials.fixedCosts || 0}
- Cash/Working Capital Reserve: PHP ${financials.cashReserve || 0}

Your response must be a single stringified JSON object matching this structure:
{
  "score": number, // Overall feasibility score from 0 to 100 based on numeric viability
  "status": "FEASIBLE" | "NOT_FEASIBLE" | "CONDITIONALLY_FEASIBLE",
  "metrics": {
    "financial": number, // Score from 0 to 100 for financial health
    "risk": number, // Score from 0 to 100 (lower score means higher risk)
    "market": number // Score from 0 to 100 for volume realism
  },
  "explanations": {
    "feasibility": "Overall numeric audit verdict explanation.",
    "financial": "Detailed analysis of unit margins and OPEX coverage.",
    "risk": "Breakdown of cash flow risks and payback duration.",
    "market": "Assessment of volume adequacy."
  },
  "insights": [
    { "type": "positive", "title": "Margin Status", "description": "Analysis of your unit gross margins" },
    { "type": "warning", "title": "Buffer Status", "description": "Analysis of your cash/working capital reserve relative to monthly expenses" },
    { "type": "info", "title": "Payback Insight", "description": "Analysis of your estimated capital recovery time" }
  ],
  "improvementTips": {
    "financial": ["Specific tip on unit cost or operational expense adjustment"],
    "operations": ["Specific tip on cash reserves or equipment allocation"],
    "marketing": ["Specific tip on price points or volume projections"]
  },
  "aiScores": {
    "financial": number, // score out of 100
    "operational": number, // score out of 100
    "market": number // score out of 100
  },
  "aiScoreExplanations": {
    "financial": "Brief summary explanation.",
    "operational": "Brief summary explanation.",
    "market": "Brief summary explanation."
  }
}
`;

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash", // Flash matches standard free quotas
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      });

      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      res.json(cleanAndParseJSON(textResponse));

    } catch (error) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({ error: "Analysis process failed internally.", details: error.message });
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

      // Pass target criteria and exemplars as few-shot data structures
      const prompt = `
You are an expert academic feasibility study evaluator assessing a qualitative BUSINESS PROPOSAL.
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

⚠️ CRITICAL STAGE SEPARATION RULE (DO NOT PENALIZE FOR LACKING FINANCIAL INPUTS):
1. This is strictly the Qualitative BUSINESS PROPOSAL Phase. 
2. Detailed monthly expense lists (OPEX like rent bills, utilities, employee benefit tables) and programmatically calculated unit COGS are NOT entered at this stage. Those are handled in the subsequent "Financial Input" phase.
3. Therefore, DO NOT penalize or fail the proposal (e.g., do not give an "Unacceptable" or "Needs Improvement" grade) for lacking exact utility bills, itemized leasehold renovations, or programmatically generated ROI metrics.
4. Focus your Category 1 (Financial Viability & Risk) assessment purely on:
   - The logical adequacy of the high-level Total Capital (PHP ${totalCapital}) relative to the described business size (e.g. is PHP 150,000 realistic to set up a compact breakfast pandesal kiosk?).
   - The plausibility and realism of the high-level Price Ranges text ("${priceRanges}") relative to their target market demographic ("${targetMarket}").
5. Focus your Category 2 (Operational & Location Feasibility) assessment on the qualitative location matching ("${proposedLocation}") and described operational setup. Do not penalize for the absence of an itemized equipment catalog.

INSTRUCTIONS:
- Evaluate Category 1 based on qualitative financial logic and capital adequacy.
- Evaluate Category 2 on proposed location matching and described kiosk concept.
- Evaluate Category 3 on target demographic mapping and promotion.
- Evaluate Category 4 on Mission, Vision, and product identity cohesion.
- Scores must be integers. Ensure Category 1 scores represent the qualitative alignment rather than penalizing for missing numerical sheets.
- Keep the 'draftFeedback' extremely short, concise, specific, and direct. Do not include greetings (like "Dear Students"), introductions, formal letter structures, or closing signatures (like "Sincerely, ..."). Just output the specific, actionable feedback directly.

Your response must be a single stringified JSON object matching this structure:
{
  "score": number, // Overall feasibility score from 0 to 100 based on Categories 1-4 combined
  "metrics": {
    "financial": number, // Score from 0 to 100 for high-level financial alignment/adequacy
    "risk": number, // Score from 0 to 100 representing qualitative risk/buffer logic
    "market": number // Score from 0 to 100 for market visibility
  },
  "explanations": {
    "feasibility": "Brief summary of overall feasibility alignment.",
    "financial": "Summary of capital adequacy and pricing logic.",
    "risk": "Summary of strategic buffers.",
    "market": "Summary of marketing feasibility."
  },
  "insights": [
    { "type": "positive", "title": "Strength Title", "description": "Strength details matching Category 1-4 excellent descriptors" },
    { "type": "warning", "title": "Area of Concern", "description": "Concerns matching lower rubric descriptors (do not criticize lack of detailed spreadsheets, focus on ideas)" },
    { "type": "info", "title": "Recommendation", "description": "Clear step-by-step instruction to improve the qualitative concept" }
  ],
  "realityCheck": "A direct, realistic statement matching high-level capital of PHP ${totalCapital} with the described location type.",
  "draftFeedback": "A short, concise, and highly specific feedback statement focusing strictly on key issues and exact improvements needed. No letter format, no greetings, and no sign-offs."
}
`;

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash", // Use 2.5-flash to bypass the Pro model's zero-token free quota limit
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      });

      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      res.json(cleanAndParseJSON(textResponse));

    } catch (error) {
      console.error("AI Evaluation Error:", error);
      res.status(500).json({ error: "Evaluation process failed internally.", details: error.message });
    }
  }
);

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