/**
 * BaseProvider
 * Abstract base class for official registration authority name checkers.
 */

class BaseProvider {
  constructor(name, officialSource, sourceDisplayName) {
    if (new.target === BaseProvider) {
      throw new TypeError("Cannot construct BaseProvider instances directly");
    }
    this.name = name; // "DTI" or "SEC"
    this.officialSource = officialSource;
    this.sourceDisplayName = sourceDisplayName;
  }

  /**
   * Normalizes an input query for uniform string comparison.
   * Strips extraneous punctuation, normalizes spaces, converts to lowercase.
   * @param {string} str
   * @returns {string}
   */
  normalize(str) {
    if (!str || typeof str !== "string") return "";
    return str
      .toLowerCase()
      .replace(/[’'"`]/g, "")
      .replace(/[^a-z0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Strips common corporate and business entity suffixes.
   * Useful for similarity indicators without corrupting the exact search term.
   * @param {string} str
   * @returns {string}
   */
  stripSuffixes(str) {
    const norm = this.normalize(str);
    return norm
      .replace(
        /\b(inc|corp|corporation|incorporated|llc|co|company|enterprises|enterprise|trading|services|holdings|ventures|group|philippines|phil|opc)\b/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Builds a standardized result object matching the Feasify name-check contract.
   * @param {Object} params
   * @returns {Object}
   */
  buildResult({
    query,
    status, // "FOUND" | "NOT_FOUND" | "UNAVAILABLE" | "ERROR"
    matchType = "none", // "exact" | "similar" | "none"
    message,
    records = [],
    officialSource = this.officialSource,
    cached = false
  }) {
    return {
      provider: this.name,
      sourceName: this.sourceDisplayName,
      query: (query || "").trim(),
      matchType,
      status,
      message,
      records: Array.isArray(records) ? records : [],
      officialSource,
      checkedAt: new Date().toISOString(),
      cached: Boolean(cached),
      disclaimer:
        "Based on the available official source. Feasify cannot make an official government determination of name availability. Final registration availability must be verified through the official government registration system."
    };
  }

  /**
   * Abstract check method to be implemented by concrete providers.
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async check(query, options = {}) {
    throw new Error(`check() method not implemented in ${this.constructor.name}`);
  }
}

module.exports = BaseProvider;
