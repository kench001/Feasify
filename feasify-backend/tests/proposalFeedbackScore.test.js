const assert = require("assert");

async function testFeedbackLogic() {
  console.log("Testing proposal feedback endpoint logic...");

  let updatedProposal = null;
  let updatedGroup = null;

  // Mock firestore
  const mockExistingProposal = {
    id: "prop_123",
    groupId: "group_456",
    feedbackHistory: []
  };

  const mockAdminFirestore = {
    collection: (col) => {
      if (col === "proposals") {
        return {
          doc: (id) => ({
            get: async () => ({
              exists: true,
              data: () => ({ ...mockExistingProposal })
            }),
            update: async (payload) => {
              updatedProposal = payload;
            }
          })
        };
      }
      if (col === "groups") {
        return {
          doc: (id) => ({
            get: async () => ({
              exists: true,
              data: () => ({ id: "group_456" })
            }),
            update: async (payload) => {
              updatedGroup = payload;
            }
          })
        };
      }
      throw new Error("Unknown collection: " + col);
    }
  };

  const mockAdmin = {
    firestore: {
      FieldValue: {
        arrayUnion: (item) => [item]
      }
    }
  };

  // Simulate endpoint handler logic
  async function handleFeedback({ proposalId, body, adminFirestore, admin }) {
    const { text, authorName, role, idempotencyKey, score } = body || {};

    if (!text || !text.trim()) {
      return { status: 400, body: { error: "Feedback text is required." } };
    }

    const cleanText = text.trim();
    const cleanAuthor = (authorName || "Faculty Adviser").trim();
    const cleanRole = (role || "Adviser").trim();
    const feedbackId = idempotencyKey || `fb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    let parsedScore;
    if (score !== undefined && score !== null && typeof score !== "boolean" && String(score).trim() !== "") {
      const candidateScore = Number(score);
      if (!Number.isNaN(candidateScore) && candidateScore >= 0 && candidateScore <= 100) {
        parsedScore = candidateScore;
      }
    }
    const hasValidScore = typeof parsedScore === "number";

    if (adminFirestore) {
      const propRef = adminFirestore.collection("proposals").doc(proposalId);
      const propDoc = await propRef.get();
      if (!propDoc.exists) {
        return { status: 404, body: { error: "Proposal not found." } };
      }

      const existingData = propDoc.data() || {};
      const history = Array.isArray(existingData.feedbackHistory) ? existingData.feedbackHistory : [];

      const now = Date.now();
      const duplicate = history.find(item => {
        if (idempotencyKey && item.id === idempotencyKey) return true;
        if (item.text === cleanText && item.authorName === cleanAuthor) {
          const itemTime = new Date(item.date).getTime();
          if (Number.isFinite(itemTime) && Math.abs(now - itemTime) < 15000) {
            return true;
          }
        }
        return false;
      });

      if (duplicate) {
        return {
          status: 200,
          body: {
            success: true,
            duplicateDetected: true,
            feedback: duplicate,
            message: "Duplicate feedback suppressed."
          }
        };
      }

      const newFeedback = {
        id: feedbackId,
        text: cleanText,
        authorName: cleanAuthor,
        role: cleanRole,
        date: new Date().toISOString(),
        ...(hasValidScore ? { score: parsedScore } : {})
      };

      const propUpdates = {
        feedbackHistory: admin.firestore.FieldValue.arrayUnion(newFeedback),
        adviserFeedback: cleanText,
        adviserRemarks: cleanText,
        updatedAt: new Date().toISOString()
      };
      if (hasValidScore) {
        propUpdates.adviserScore = parsedScore;
      }

      await propRef.update(propUpdates);

      if (existingData.groupId) {
        try {
          const groupRef = adminFirestore.collection("groups").doc(existingData.groupId);
          const groupDoc = await groupRef.get();
          if (groupDoc.exists) {
            const groupUpdate = {
              adviserRemarks: cleanText,
              updatedAt: new Date().toISOString()
            };
            if (hasValidScore) {
              groupUpdate.adviserScore = parsedScore;
            }
            await groupRef.update(groupUpdate);
          }
        } catch (groupErr) {
          console.warn(`[Backend post feedback] Group ${existingData.groupId} update warning:`, groupErr.message);
        }
      }

      return {
        status: 200,
        body: {
          success: true,
          feedback: newFeedback
        }
      };
    }

    const newFeedback = {
      id: feedbackId,
      text: cleanText,
      authorName: cleanAuthor,
      role: cleanRole,
      date: new Date().toISOString(),
      ...(hasValidScore ? { score: parsedScore } : {})
    };
    return { status: 200, body: { success: true, feedback: newFeedback } };
  }

  // Case 1: valid score 92
  let res = await handleFeedback({
    proposalId: "prop_123",
    body: { text: "Great market analysis!", authorName: "Prof. Smith", score: 92 },
    adminFirestore: mockAdminFirestore,
    admin: mockAdmin
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.feedback.score, 92);
  assert.strictEqual(updatedProposal.adviserScore, 92);
  assert.strictEqual(updatedProposal.adviserRemarks, "Great market analysis!");
  assert.strictEqual(updatedGroup.adviserScore, 92);
  assert.strictEqual(updatedGroup.adviserRemarks, "Great market analysis!");
  console.log("✓ Valid score 92 correctly updated proposal and group.");

  // Case 2: string score "85.5"
  res = await handleFeedback({
    proposalId: "prop_123",
    body: { text: "Solid financials", score: "85.5" },
    adminFirestore: mockAdminFirestore,
    admin: mockAdmin
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.feedback.score, 85.5);
  assert.strictEqual(updatedProposal.adviserScore, 85.5);
  assert.strictEqual(updatedGroup.adviserScore, 85.5);
  console.log("✓ String score '85.5' parsed as number and updated.");

  // Case 3: score 0 (boundary)
  res = await handleFeedback({
    proposalId: "prop_123",
    body: { text: "Incomplete", score: 0 },
    adminFirestore: mockAdminFirestore,
    admin: mockAdmin
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.feedback.score, 0);
  assert.strictEqual(updatedProposal.adviserScore, 0);
  assert.strictEqual(updatedGroup.adviserScore, 0);
  console.log("✓ Score 0 handled correctly.");

  // Case 4: No score provided
  updatedProposal = null;
  updatedGroup = null;
  res = await handleFeedback({
    proposalId: "prop_123",
    body: { text: "General remark" },
    adminFirestore: mockAdminFirestore,
    admin: mockAdmin
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.feedback.score, undefined);
  assert.strictEqual(updatedProposal.adviserScore, undefined);
  assert.strictEqual(updatedProposal.adviserRemarks, "General remark");
  assert.strictEqual(updatedGroup.adviserScore, undefined);
  assert.strictEqual(updatedGroup.adviserRemarks, "General remark");
  console.log("✓ Feedback without score updates remarks without setting undefined adviserScore.");

  // Case 5: Offline fallback (no adminFirestore)
  res = await handleFeedback({
    proposalId: "prop_123",
    body: { text: "Offline mode", score: 88 },
    adminFirestore: null,
    admin: null
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.feedback.score, 88);
  console.log("✓ Offline fallback returns score in feedback item.");

  console.log("\nAll feedback score tests passed!");
}

testFeedbackLogic().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
