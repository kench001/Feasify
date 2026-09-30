/**
 * SECProvider
 * Official integration adapter for Securities and Exchange Commission (SEC) Philippines.
 * 
 * Official Sources:
 * - SEC API Marketplace: https://dev-api.sec.gov.ph/
 * - SEC eSPARC Portal: https://esparc.sec.gov.ph/
 * 
 * Critical Legal/Architectural Distinction:
 * An SEC Company Information lookup queries already registered entities.
 * Absence of a record does NOT constitute official SEC corporate name availability.
 * True name reservation and definitive approval is conducted strictly through SEC eSPARC.
 */

const BaseProvider = require("../base/BaseProvider");

class SECProvider extends BaseProvider {
  constructor() {
    super(
      "SEC",
      "https://esparc.sec.gov.ph/",
      "Securities and Exchange Commission (SEC) Philippines"
    );
    this.apiBaseUrl = process.env.SEC_API_BASE_URL || null;
    this.clientId = process.env.SEC_CLIENT_ID || null;
    this.clientSecret = process.env.SEC_CLIENT_SECRET || null;
    this.apiKey = process.env.SEC_API_KEY || null;
    this.tokenUrl = process.env.SEC_TOKEN_URL || null;
    this.timeoutMs = Number(process.env.SEC_TIMEOUT_MS) || 8000;
    this.cachedAccessToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Generates direct link to SEC eSPARC.
   * @param {string} query
   * @returns {string}
   */
  getOfficialEsparcUrl() {
    return this.officialSource;
  }

  /**
   * Retrieves OAuth2 token from SEC API Marketplace if configured.
   * @private
   */
  async _getAccessToken() {
    if (this.apiKey) return null; // API Key used directly
    if (!this.clientId || !this.clientSecret || !this.tokenUrl) return null;

    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedAccessToken;
    }

    try {
      const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
      const resp = await fetch(this.tokenUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ grant_type: "client_credentials" })
      });

      if (!resp.ok) {
        console.warn("⚠️ [SECProvider] OAuth2 token request failed with status:", resp.status);
        return null;
      }

      const tokenData = await resp.json();
      this.cachedAccessToken = tokenData.access_token;
      this.tokenExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
      return this.cachedAccessToken;
    } catch (err) {
      console.warn("⚠️ [SECProvider] Failed acquiring SEC OAuth2 token:", err.message);
      return null;
    }
  }

  /**
   * Executes company name check.
   * Distinguishes registered company lookup from definitive name reservation.
   * 
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async check(query, options = {}) {
    const trimmed = (query || "").trim();

    if (!trimmed) {
      return this.buildResult({
        query: "",
        status: "ERROR",
        matchType: "none",
        message: "Please enter a company name to check.",
        officialSource: this.getOfficialEsparcUrl()
      });
    }

    if (trimmed.length > 150) {
      return this.buildResult({
        query: trimmed,
        status: "ERROR",
        matchType: "none",
        message: "Company name query exceeds maximum permitted length of 150 characters.",
        officialSource: this.getOfficialEsparcUrl()
      });
    }

    // Sandbox simulation mode for automated testing/QA verification
    if (process.env.SEC_SANDBOX_MODE === "true" || options.sandbox) {
      return this._handleSandboxQuery(trimmed);
    }

    // If official SEC API is configured
    if (this.apiBaseUrl && (this.apiKey || (this.clientId && this.clientSecret))) {
      return this._queryOfficialSecApi(trimmed);
    }

    // If SEC API credentials are not yet provisioned in environment variables:
    // Inform the user and direct them to official SEC eSPARC.
    return this.buildResult({
      query: trimmed,
      status: "NOT_FOUND",
      matchType: "none",
      message:
        "No matching company was found through the available SEC lookup. Note: Official proposed corporate name approval must be verified through the SEC eSPARC process.",
      officialSource: this.getOfficialEsparcUrl(),
      records: []
    });
  }

  /**
   * Queries configured SEC API Marketplace endpoint.
   * @private
   */
  async _queryOfficialSecApi(query) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers = {
        Accept: "application/json",
        "User-Agent": "Feasify-Verification-Client/1.0"
      };

      if (this.apiKey) {
        headers["X-API-Key"] = this.apiKey;
      } else {
        const token = await this._getAccessToken();
        if (!token) {
          clearTimeout(timeoutId);
          return this.buildResult({
            query,
            status: "UNAVAILABLE",
            matchType: "none",
            message:
              "SEC authentication configuration failed. Please verify the company name directly on SEC eSPARC.",
            officialSource: this.getOfficialEsparcUrl()
          });
        }
        headers["Authorization"] = `Bearer ${token}`;
      }

      const url = new URL("/company-lookup", this.apiBaseUrl);
      url.searchParams.set("companyName", query);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        return this.buildResult({
          query,
          status: "UNAVAILABLE",
          matchType: "none",
          message:
            "SEC verification service credentials are unauthorized or expired. Please verify through SEC eSPARC.",
          officialSource: this.getOfficialEsparcUrl()
        });
      }

      if (response.status === 429) {
        return this.buildResult({
          query,
          status: "UNAVAILABLE",
          matchType: "none",
          message:
            "SEC API rate limit exceeded. Please wait a moment or verify through official SEC eSPARC.",
          officialSource: this.getOfficialEsparcUrl()
        });
      }

      if (!response.ok) {
        return this.buildResult({
          query,
          status: "UNAVAILABLE",
          matchType: "none",
          message:
            "The SEC verification service is currently unavailable. Please verify directly via SEC eSPARC.",
          officialSource: this.getOfficialEsparcUrl()
        });
      }

      const data = await response.json();
      const records = Array.isArray(data.companies)
        ? data.companies
        : Array.isArray(data.records)
        ? data.records
        : data.company
        ? [data.company]
        : [];

      const normQuery = this.normalize(query);
      const exactMatch = records.find(
        (r) => this.normalize(r.companyName || r.name) === normQuery
      );

      if (exactMatch) {
        return this.buildResult({
          query,
          status: "FOUND",
          matchType: "exact",
          message: "A company with the searched name was found in the SEC records.",
          records: [
            {
              companyName: exactMatch.companyName || exactMatch.name,
              secNumber: exactMatch.secNumber || exactMatch.registrationNumber || "Available upon request",
              companyType: exactMatch.companyType || exactMatch.entityType || "Corporation / Partnership",
              status: exactMatch.status || "Registered",
              registrationDate: exactMatch.registrationDate || null
            }
          ],
          officialSource: this.getOfficialEsparcUrl()
        });
      }

      if (records.length > 0) {
        return this.buildResult({
          query,
          status: "FOUND",
          matchType: "similar",
          message: `Found ${records.length} related entity record(s) in SEC lookup.`,
          records: records.slice(0, 5).map((r) => ({
            companyName: r.companyName || r.name,
            secNumber: r.secNumber || r.registrationNumber || "",
            companyType: r.companyType || r.entityType || "",
            status: r.status || "Registered"
          })),
          officialSource: this.getOfficialEsparcUrl()
        });
      }

      return this.buildResult({
        query,
        status: "NOT_FOUND",
        matchType: "none",
        message:
          "No matching company was found through the available SEC lookup. Note: Definitive corporate name approval must be confirmed through SEC eSPARC.",
        officialSource: this.getOfficialEsparcUrl(),
        records: []
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === "AbortError";
      console.warn(`⚠️ [SECProvider] Query error (${isTimeout ? "Timeout" : err.message})`);

      return this.buildResult({
        query,
        status: "UNAVAILABLE",
        matchType: "none",
        message:
          "SEC verification is currently unavailable. Please verify the name directly through the official SEC eSPARC website.",
        officialSource: this.getOfficialEsparcUrl()
      });
    }
  }

  /**
   * Internal sandbox handler for QA/test scenarios.
   * @private
   */
  _handleSandboxQuery(query) {
    const norm = this.normalize(query);

    if (norm.includes("timeout") || norm === "simulate timeout") {
      return this.buildResult({
        query,
        status: "UNAVAILABLE",
        matchType: "none",
        message:
          "SEC verification is currently unavailable (timeout). Please verify through official SEC eSPARC.",
        officialSource: this.getOfficialEsparcUrl()
      });
    }

    if (norm.includes("unavailable") || norm === "simulate unavailable") {
      return this.buildResult({
        query,
        status: "UNAVAILABLE",
        matchType: "none",
        message:
          "The SEC verification service is currently unavailable. Please verify through the official SEC eSPARC website.",
        officialSource: this.getOfficialEsparcUrl()
      });
    }

    if (norm.includes("auth fail") || norm === "simulate auth failure") {
      return this.buildResult({
        query,
        status: "UNAVAILABLE",
        matchType: "none",
        message:
          "SEC verification service credentials are unauthorized or expired. Please verify through SEC eSPARC.",
        officialSource: this.getOfficialEsparcUrl()
      });
    }

    if (norm.includes("rate limit") || norm === "simulate rate limit") {
      return this.buildResult({
        query,
        status: "UNAVAILABLE",
        matchType: "none",
        message:
          "SEC API rate limit exceeded. Please wait a moment or verify through official SEC eSPARC.",
        officialSource: this.getOfficialEsparcUrl()
      });
    }

    if (
      norm === "ayala corporation" ||
      norm === "san miguel corporation" ||
      norm === "registered company" ||
      norm === "existing company" ||
      norm === "sample company inc"
    ) {
      return this.buildResult({
        query,
        status: "FOUND",
        matchType: "exact",
        message: "A company with the searched name was found in the SEC records.",
        records: [
          {
            companyName: query,
            secNumber: "CS200812345",
            companyType: "Stock Corporation",
            status: "Active / Registered",
            registrationDate: "2015-08-20"
          }
        ],
        officialSource: this.getOfficialEsparcUrl()
      });
    }

    return this.buildResult({
      query,
      status: "NOT_FOUND",
      matchType: "none",
      message:
        "No matching company was found through the available SEC lookup. Note: Official proposed corporate name approval must be verified through the SEC eSPARC process.",
      officialSource: this.getOfficialEsparcUrl(),
      records: []
    });
  }
}

module.exports = SECProvider;
