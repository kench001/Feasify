/**
 * Official Government Name Checker Service
 * Connects the Feasify React frontend to the Feasify backend provider-based name checker.
 * 
 * Never queries or relies on local JSON databases.
 * Always resolves against official DTI BNRS and SEC Philippines services or official search fallbacks.
 */

export interface NameCheckRecord {
  businessName?: string;
  companyName?: string;
  name?: string;
  territory?: string;
  status?: string;
  scope?: string;
  registrationDate?: string;
  secNumber?: string;
  companyType?: string;
}

export interface TrademarkAlert {
  isProtected: boolean;
  type: string;
  matchedBrand: string;
  message: string;
}

export interface NameCheckResult {
  provider: "DTI" | "SEC";
  sourceName: string;
  query: string;
  matchType: "exact" | "similar" | "none";
  status: "FOUND" | "NOT_FOUND" | "UNAVAILABLE" | "ERROR";
  message: string;
  records?: NameCheckRecord[];
  officialSource: string;
  checkedAt: string;
  cached?: boolean;
  disclaimer: string;
  trademarkAlert?: TrademarkAlert | null;
}

export interface DualNameCheckResult {
  query: string;
  checkedAt: string;
  trademarkAlert?: TrademarkAlert | null;
  dti: NameCheckResult;
  sec: NameCheckResult;
}

export const OFFICIAL_SOURCES = {
  DTI_BNRS_PORTAL: "https://bnrs.dti.gov.ph/",
  DTI_BNRS_SEARCH: "https://bnrs.dti.gov.ph/search",
  SEC_ESPARC: "https://esparc.sec.gov.ph/",
  SEC_API_MARKETPLACE: "https://dev-api.sec.gov.ph/"
};

/**
 * Returns backend API base URL with fallback.
 */
const getBackendUrl = (): string => {
  return (import.meta as any).env?.VITE_API_URL || "http://localhost:10000";
};

/**
 * Checks a business or company name through Feasify Backend API.
 * 
 * @param name - The proposed name to check
 * @param type - "business" (for DTI BNRS) or "company" (for SEC)
 * @param forceRefresh - If true, bypasses backend in-memory cache
 */
export async function checkName(
  name: string,
  type: "business" | "company",
  forceRefresh = false
): Promise<NameCheckResult> {
  const trimmed = (name || "").trim();
  const defaultSource =
    type === "business" ? OFFICIAL_SOURCES.DTI_BNRS_SEARCH : OFFICIAL_SOURCES.SEC_ESPARC;
  const defaultSourceName =
    type === "business"
      ? "Department of Trade and Industry - Business Name Registration System"
      : "Securities and Exchange Commission";

  if (!trimmed) {
    return {
      provider: type === "business" ? "DTI" : "SEC",
      sourceName: defaultSourceName,
      query: "",
      matchType: "none",
      status: "ERROR",
      message: `Please enter a ${type === "business" ? "business" : "company"} name first.`,
      records: [],
      officialSource: defaultSource,
      checkedAt: new Date().toISOString(),
      disclaimer: "Please provide a valid name to check."
    };
  }

  try {
    const backendUrl = getBackendUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${backendUrl}/api/name-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        name: trimmed,
        type,
        forceRefresh: Boolean(forceRefresh)
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      return {
        provider: type === "business" ? "DTI" : "SEC",
        sourceName: defaultSourceName,
        query: trimmed,
        matchType: "none",
        status: "UNAVAILABLE",
        message:
          errData?.message ||
          `${type === "business" ? "DTI" : "SEC"} verification is currently unavailable. Please verify directly via official government website.`,
        records: [],
        officialSource: errData?.officialSource || defaultSource,
        checkedAt: new Date().toISOString(),
        disclaimer:
          "Feasify cannot make an official government determination of name availability. Please verify through the official government portal."
      };
    }

    const data = await response.json();
    return data as NameCheckResult;
  } catch (error: any) {
    const isTimeout = error.name === "AbortError";
    return {
      provider: type === "business" ? "DTI" : "SEC",
      sourceName: defaultSourceName,
      query: trimmed,
      matchType: "none",
      status: "UNAVAILABLE",
      message: isTimeout
        ? `${type === "business" ? "DTI" : "SEC"} verification request timed out. Please try again or verify directly through the official website.`
        : `${type === "business" ? "DTI" : "SEC"} verification is currently unreachable. Please try again or check directly on the official portal.`,
      records: [],
      officialSource: defaultSource,
      checkedAt: new Date().toISOString(),
      disclaimer:
        "Feasify cannot make an official government determination of name availability. Please confirm the result through the official government registration system."
    };
  }
}

/**
 * Checks a business name specifically against DTI BNRS.
 */
export async function checkDTI(name: string, forceRefresh = false): Promise<NameCheckResult> {
  return checkName(name, "business", forceRefresh);
}

/**
 * Checks a company name specifically against SEC records.
 */
export async function checkSEC(name: string, forceRefresh = false): Promise<NameCheckResult> {
  return checkName(name, "company", forceRefresh);
}

/**
 * Checks both DTI and SEC simultaneously.
 */
export async function checkBoth(name: string, forceRefresh = false): Promise<{
  dti: NameCheckResult;
  sec: NameCheckResult;
}> {
  const [dtiResult, secResult] = await Promise.all([
    checkDTI(name, forceRefresh),
    checkSEC(name, forceRefresh)
  ]);
  return { dti: dtiResult, sec: secResult };
}
