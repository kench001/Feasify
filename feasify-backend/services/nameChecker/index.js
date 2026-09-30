/**
 * NameCheckerService
 * Provider-based orchestration service for DTI Business Name and SEC Company Name verification.
 * 
 * Flow:
 * Request -> Cache Check -> Provider (DTI/SEC) -> Cache Store -> Verification Audit Log -> Response
 */

const path = require("path");
const fs = require("fs");
const DTIProvider = require("./dti/DTIProvider");
const SECProvider = require("./sec/SECProvider");
const cache = require("./cache/NameCheckCache");
const logger = require("./logger/VerificationLogger");

function getTrademarkAlert(name) {
  try {
    const filePath = path.join(__dirname, "..", "..", "data", "copyright_db.json");
    if (!fs.existsSync(filePath)) return null;
    const db = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const raw = (name || "").trim();
    if (!raw) return null;

    const qClean = raw.toLowerCase().replace(/['’]/g, "").trim();
    const qNorm = qClean.replace(/[^a-z0-9]/g, "");
    if (!qNorm) return null;

    const qWords = qClean.split(/[^a-z0-9]+/).filter(Boolean);

    // 1. Check well-known brands and registered trademarks
    const wellKnown = db.well_known_businesses || [];
    let matchedBrand = null;

    // Direct normalized equality
    for (const b of wellKnown) {
      const bClean = b.toLowerCase().replace(/['’]/g, "").trim();
      const bNorm = bClean.replace(/[^a-z0-9]/g, "");
      if (bNorm && bNorm === qNorm) {
        matchedBrand = b;
        break;
      }
    }

    // Phrase containment or distinct token match
    if (!matchedBrand) {
      for (const b of wellKnown) {
        const bClean = b.toLowerCase().replace(/['’]/g, "").trim();
        const bWords = bClean.split(/[^a-z0-9]+/).filter(Boolean);
        const bNorm = bClean.replace(/[^a-z0-9]/g, "");
        if (!bNorm) continue;

        if (bWords.length > 1) {
          if (qClean.includes(bClean) || qNorm.includes(bNorm)) {
            matchedBrand = b;
            break;
          }
        } else if (bClean.length >= 3 || /^\d+$/.test(bClean)) {
          if (qWords.includes(bClean)) {
            matchedBrand = b;
            break;
          }
        }
      }
    }

    if (matchedBrand) {
      return {
        isProtected: true,
        type: "Well-Known Brand / Registered Trademark",
        matchedBrand,
        message: `"${raw}" conflicts with recognized well-known brand / registered trademark "${matchedBrand}". Under the Intellectual Property Code of the Philippines (RA 8293 / IPOPHL), DTI DAO 18-07, and SEC MC 13-2019, names identical or confusingly similar to recognized trademarks cannot be registered at ANY territorial level (Barangay, City/Municipality, Regional, or National).`,
        territorialImpact: "Disqualified across all 4 levels: Barangay, City/Municipality, Regional, and National"
      };
    }

    // 2. Check school businesses
    const schoolBusinesses = db.school_businesses || [];
    let matchedSchool = null;

    for (const s of schoolBusinesses) {
      const sClean = s.toLowerCase().replace(/['’]/g, "").trim();
      const sNorm = sClean.replace(/[^a-z0-9]/g, "");
      if (sNorm && (sNorm === qNorm || qClean.includes(sClean))) {
        matchedSchool = s;
        break;
      }
    }

    if (matchedSchool) {
      return {
        isProtected: true,
        type: "Registered School Business",
        matchedBrand: matchedSchool,
        message: `"${raw}" matches an existing student/school business project ("${matchedSchool}"). Please select an original name.`,
        territorialImpact: "Conflicting with existing academic business proposal"
      };
    }
  } catch (e) {
    // Non-blocking
  }
  return null;
}

class NameCheckerService {
  constructor() {
    this.dtiProvider = new DTIProvider();
    this.secProvider = new SECProvider();
  }

  /**
   * Main verification entry point.
   * 
   * @param {Object} params
   * @param {string} params.name - The business or company name
   * @param {"business"|"company"|"all"} [params.type] - "business" => DTI, "company" => SEC
   * @param {"DTI"|"SEC"} [params.provider] - Explicit provider selection
   * @param {boolean} [params.forceRefresh] - If true, bypasses in-memory cache
   * @param {string} [params.userId] - Optional user ID for audit trail
   * @param {Object} [params.firestoreInstance] - Optional Firestore DB instance
   * @returns {Promise<Object>}
   */
  async checkName({
    name,
    type = "business",
    provider,
    forceRefresh = false,
    userId = "anonymous",
    firestoreInstance = null
  }) {
    const rawName = (name || "").trim();

    if (!rawName) {
      return {
        status: "ERROR",
        message: "Please enter a name to verify.",
        query: "",
        checkedAt: new Date().toISOString()
      };
    }

    if (rawName.length > 150) {
      return {
        status: "ERROR",
        message: "The name exceeds the maximum length of 150 characters.",
        query: rawName,
        checkedAt: new Date().toISOString()
      };
    }

    // Determine target provider(s)
    let selectedProvider = provider ? provider.toUpperCase() : null;
    if (!selectedProvider) {
      if (type === "business") {
        selectedProvider = "DTI";
      } else if (type === "company") {
        selectedProvider = "SEC";
      } else if (type === "all") {
        selectedProvider = "ALL";
      } else {
        selectedProvider = "DTI";
      }
    }

    // If both providers requested
    if (selectedProvider === "ALL") {
      const [dtiResult, secResult] = await Promise.allSettled([
        this._executeSingleCheck(this.dtiProvider, rawName, "business", forceRefresh, userId, firestoreInstance),
        this._executeSingleCheck(this.secProvider, rawName, "company", forceRefresh, userId, firestoreInstance)
      ]);

      return {
        query: rawName,
        checkedAt: new Date().toISOString(),
        trademarkAlert: getTrademarkAlert(rawName),
        dti: dtiResult.status === "fulfilled" ? dtiResult.value : this.dtiProvider.buildResult({
          query: rawName,
          status: "UNAVAILABLE",
          message: "DTI verification failed to complete."
        }),
        sec: secResult.status === "fulfilled" ? secResult.value : this.secProvider.buildResult({
          query: rawName,
          status: "UNAVAILABLE",
          message: "SEC verification failed to complete."
        })
      };
    }

    // Single provider flow
    const providerInstance = selectedProvider === "SEC" ? this.secProvider : this.dtiProvider;
    const targetType = selectedProvider === "SEC" ? "company" : "business";

    const singleResult = await this._executeSingleCheck(
      providerInstance,
      rawName,
      targetType,
      forceRefresh,
      userId,
      firestoreInstance
    );

    return {
      ...singleResult,
      trademarkAlert: getTrademarkAlert(rawName)
    };
  }

  /**
   * Internal execution handler for a single provider with cache and audit logging.
   * @private
   */
  async _executeSingleCheck(
    providerInstance,
    query,
    type,
    forceRefresh,
    userId,
    firestoreInstance
  ) {
    const providerName = providerInstance.name;

    // 1. Check cache (unless forceRefresh is requested)
    if (!forceRefresh) {
      const cachedResult = cache.get(providerName, query);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // 2. Query the official provider
    let result;
    try {
      result = await providerInstance.check(query);
    } catch (err) {
      console.error(`❌ [NameCheckerService] Error querying ${providerName}:`, err);
      result = providerInstance.buildResult({
        query,
        status: "UNAVAILABLE",
        message: `${providerName} verification service is currently unavailable. Please check official site.`
      });
    }

    // 3. Cache the result (only cache valid non-error responses)
    if (result.status && result.status !== "ERROR") {
      cache.set(providerName, query, result);
    }

    // 4. Record lightweight audit log (fire-and-forget)
    logger
      .logVerification(
        {
          userId,
          name: query,
          type,
          provider: providerName,
          resultStatus: result.status,
          sourceUrl: result.officialSource,
          matchType: result.matchType
        },
        firestoreInstance
      )
      .catch((logErr) => {
        console.warn("⚠️ [NameCheckerService] Logger error:", logErr.message);
      });

    return result;
  }

  /**
   * Returns current service diagnostics and configuration status.
   */
  getStatus() {
    return {
      service: "Feasify Name Checker Service",
      timestamp: new Date().toISOString(),
      providers: {
        DTI: {
          name: "Department of Trade and Industry - BNRS",
          officialPortal: "https://bnrs.dti.gov.ph/",
          officialSearch: "https://bnrs.dti.gov.ph/search",
          mode: this.dtiProvider.apiBaseUrl ? "Official API Gateway" : "Official Portal Fallback",
          apiConfigured: Boolean(this.dtiProvider.apiBaseUrl)
        },
        SEC: {
          name: "Securities and Exchange Commission",
          officialPortal: "https://esparc.sec.gov.ph/",
          apiMarketplace: "https://dev-api.sec.gov.ph/",
          mode: this.secProvider.apiBaseUrl ? "Official SEC API" : "Official eSPARC Fallback",
          apiConfigured: Boolean(this.secProvider.apiBaseUrl && (this.secProvider.apiKey || this.secProvider.clientId))
        }
      },
      cache: {
        activeEntries: cache.store.size,
        ttlMs: cache.ttlMs
      },
      recentLogs: logger.getRecentLogs(10)
    };
  }
}

module.exports = new NameCheckerService();
