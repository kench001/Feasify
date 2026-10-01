/**
 * VerificationLogger
 * Records lightweight audit trails of name checks without storing bulk government data.
 * Adheres strictly to privacy and minimal storage principles.
 */

const crypto = require("crypto");

class VerificationLogger {
  constructor() {
    this.memoryLogs = [];
    this.maxMemoryLogs = 100;
  }

  /**
   * Logs a verification event.
   * @param {Object} params
   * @param {Object} [firestoreInstance] - Optional Firestore DB instance
   */
  async logVerification(
    {
      userId = "anonymous",
      name,
      type,
      provider,
      resultStatus,
      sourceUrl,
      responseReference = null,
      matchType = "none"
    },
    firestoreInstance = null
  ) {
    const logEntry = {
      id: crypto.randomUUID(),
      user_id: userId || "anonymous",
      name: (name || "").slice(0, 150),
      type: type || "business",
      provider: provider || "UNKNOWN",
      result_status: resultStatus || "UNKNOWN",
      match_type: matchType || "none",
      source_url: sourceUrl || "",
      response_reference: responseReference || null,
      checked_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // Keep recent logs in memory for debugging and inspection
    this.memoryLogs.unshift(logEntry);
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs.pop();
    }

    // Persist to Firestore if available
    if (firestoreInstance) {
      try {
        await firestoreInstance.collection("name_verification_logs").add(logEntry);
      } catch (err) {
        console.warn("⚠️ [VerificationLogger] Failed to write log to Firestore:", err.message);
      }
    }

    return logEntry;
  }

  /**
   * Returns recent verification logs from memory buffer.
   * @param {number} limit
   * @returns {Array}
   */
  getRecentLogs(limit = 20) {
    return this.memoryLogs.slice(0, limit);
  }
}

module.exports = new VerificationLogger();
