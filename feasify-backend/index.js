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

// Robust helper to strip potential markdown code backticks returned by LLMs and handle trailing commas
const cleanAndParseJSON = (rawText) => {
  let cleaned = rawText.trim();
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "");
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("Standard parse failed, attempting regex repair...");
    try {
      // 1. Fix unquoted keys (common AI mistake)
      let fixed = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      // 2. Remove trailing commas
      fixed = fixed.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(fixed);
    } catch (repairError) {
      console.error("Critical Parse Error. Raw AI Output was:", rawText);
      throw new Error("The AI provided an invalid data format. Please try again.");
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

      const result = await model.generateContent(prompt);
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
  "score": 85,
  "metrics": {
    "financial": 85,
    "risk": 80,
    "market": 75
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

IMPORTANT: The response MUST be strictly valid JSON. Do not include comments, typescript annotations, or trailing commas in the JSON response. For the 'type' field in the 'insights' array, you must select one of: 'positive', 'warning', 'info', or 'suggestion'.
`;

      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest", // Standard stable Flash model with 1,500 requests/day quota
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
      try {
        fs.appendFileSync(
          path.join(__dirname, "error.log"),
          `[${new Date().toISOString()}] AI Evaluation Error:\nRequest: ${JSON.stringify(req.body, null, 2)}\nError: ${error.stack || error.message || error}\n\n`,
          "utf-8"
        );
      } catch (logErr) {
        console.error("Failed writing to error.log:", logErr);
      }
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