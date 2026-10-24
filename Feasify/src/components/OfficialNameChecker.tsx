import React, { useState } from "react";
import {
  ExternalLink,
  RotateCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Building2,
  FileCheck2,
  Loader2,
  ShieldAlert
} from "lucide-react";
import {
  checkDTI,
  checkSEC,
  type NameCheckResult,
  OFFICIAL_SOURCES
} from "../services/nameCheckerService";
import { checkBusinessName } from "../services/copyrightService";

interface OfficialNameCheckerProps {
  currentName: string;
  onNameChange?: (name: string) => void;
  showInput?: boolean;
  inputPlaceholder?: string;
  className?: string;
  compact?: boolean;
  onCheckComplete?: (provider: "DTI" | "SEC", result: NameCheckResult) => void;
}

export const OfficialNameChecker: React.FC<OfficialNameCheckerProps> = ({
  currentName,
  onNameChange,
  showInput = false,
  inputPlaceholder = "Enter business or company name...",
  className = "",
  compact = false,
  onCheckComplete
}) => {
  const [dtiResult, setDtiResult] = useState<NameCheckResult | null>(null);
  const [secResult, setSecResult] = useState<NameCheckResult | null>(null);
  const [isCheckingDTI, setIsCheckingDTI] = useState(false);
  const [isCheckingSEC, setIsCheckingSEC] = useState(false);

  const handleCheckDTI = async (forceRefresh = false) => {
    const trimmed = (currentName || "").trim();
    if (!trimmed) return;
    setIsCheckingDTI(true);
    try {
      const res = await checkDTI(trimmed, forceRefresh);
      setDtiResult(res);
      onCheckComplete?.("DTI", res);
    } finally {
      setIsCheckingDTI(false);
    }
  };

  const handleCheckSEC = async (forceRefresh = false) => {
    const trimmed = (currentName || "").trim();
    if (!trimmed) return;
    setIsCheckingSEC(true);
    try {
      const res = await checkSEC(trimmed, forceRefresh);
      setSecResult(res);
      onCheckComplete?.("SEC", res);
    } finally {
      setIsCheckingSEC(false);
    }
  };

  const handleCheckBoth = async (forceRefresh = false) => {
    await Promise.all([handleCheckDTI(forceRefresh), handleCheckSEC(forceRefresh)]);
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return "Just now";
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: NameCheckResult["status"], matchType: string) => {
    switch (status) {
      case "FOUND":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-neutral-900 text-white border border-neutral-800">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>FOUND {matchType === "exact" ? "(EXACT MATCH)" : "(SIMILAR)"}</span>
          </span>
        );
      case "NOT_FOUND":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-neutral-100 text-neutral-800 border border-neutral-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>NOT FOUND</span>
          </span>
        );
      case "UNAVAILABLE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-neutral-100 text-neutral-800 border border-neutral-300">
            <Info className="w-3 h-3 text-blue-600" />
            <span>SERVICE UNAVAILABLE</span>
          </span>
        );
      case "ERROR":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-neutral-100 text-neutral-800 border border-neutral-300">
            <XCircle className="w-3 h-3 text-red-600" />
            <span>ERROR</span>
          </span>
        );
    }
  };

  const isQueryEmpty = !currentName || !currentName.trim();

  const localTrademark = checkBusinessName(currentName);
  const trademarkAlert =
    dtiResult?.trademarkAlert ||
    secResult?.trademarkAlert ||
    (localTrademark.isCopyrighted
      ? {
          isProtected: true,
          type: localTrademark.source || "Well-Known Brand / Trademark",
          matchedBrand: localTrademark.matchedName || currentName,
          message:
            localTrademark.errorMessage ||
            `"${currentName}" is a recognized trademark/well-known brand.`
        }
      : null);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Optional Direct Input */}
      {showInput && (
        <div className="relative">
          <input
            type="text"
            value={currentName}
            onChange={(e) => onNameChange?.(e.target.value)}
            placeholder={inputPlaceholder}
            className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#122244]/20 focus:border-[#122244] transition-all"
          />
        </div>
      )}

      {/* Control Buttons Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleCheckDTI(false)}
          disabled={isCheckingDTI || isCheckingSEC || isQueryEmpty}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#122244] hover:bg-[#0a142e] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all shadow-xs"
          title="Query official DTI Business Name Registration System"
        >
          {isCheckingDTI ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileCheck2 className="w-3.5 h-3.5 text-[#c9a654]" />
          )}
          <span>Check DTI</span>
        </button>

        <button
          type="button"
          onClick={() => handleCheckSEC(false)}
          disabled={isCheckingDTI || isCheckingSEC || isQueryEmpty}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#122244] hover:bg-[#0a142e] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all shadow-xs"
          title="Query official SEC Philippines records"
        >
          {isCheckingSEC ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Building2 className="w-3.5 h-3.5 text-[#c9a654]" />
          )}
          <span>Check SEC</span>
        </button>

        <button
          type="button"
          onClick={() => handleCheckBoth(false)}
          disabled={isCheckingDTI || isCheckingSEC || isQueryEmpty}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 disabled:text-neutral-400 disabled:bg-neutral-50 disabled:cursor-not-allowed border border-neutral-300 text-xs font-bold rounded-lg transition-all"
          title="Check both official government registries"
        >
          {isCheckingDTI && isCheckingSEC ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5 text-neutral-600" />
          )}
          <span>Check Both</span>
        </button>

        <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-neutral-500 font-medium">
          <span>Official Government Sources:</span>
          <a
            href={OFFICIAL_SOURCES.DTI_BNRS_SEARCH}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-700 hover:underline font-semibold"
          >
            DTI BNRS
          </a>
          <span>•</span>
          <a
            href={OFFICIAL_SOURCES.SEC_ESPARC}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-700 hover:underline font-semibold"
          >
            SEC eSPARC
          </a>
        </div>
      </div>

      {/* Territorial Scope & Official Legal Coverage Guide */}
      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-neutral-800">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#c9a654]"></span>
            Philippine Territorial Coverage & Legal Scopes:
          </span>
          <span className="text-[10px] font-semibold text-neutral-500">
            Barangay • City/Municipality • Regional • National
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-neutral-600">
          <div className="p-2 bg-white rounded-lg border border-neutral-200">
            <strong className="text-neutral-900 block font-bold mb-0.5">1. DTI BNRS (Sole Proprietorships):</strong>
            <span>Covers 4 territorial scopes: <strong>Barangay</strong>, <strong>City/Municipality</strong>, <strong>Regional</strong>, or <strong>National</strong>.</span>
          </div>
          <div className="p-2 bg-white rounded-lg border border-neutral-200">
            <strong className="text-neutral-900 block font-bold mb-0.5">2. SEC (Corporations & OPCs):</strong>
            <span>Covers <strong>National</strong> legal registration for incorporated companies, franchises & holding firms.</span>
          </div>
          <div className="p-2 bg-white rounded-lg border border-neutral-200">
            <strong className="text-neutral-900 block font-bold mb-0.5">3. IPOPHL (Trademarks & Brands):</strong>
            <span>Protected across <strong>ALL 4 levels</strong>. Well-known marks cannot be registered even for a single barangay shop.</span>
          </div>
        </div>
      </div>

      {/* Results Display Grid */}
      {(dtiResult || secResult || trademarkAlert) && (
        <div className="space-y-3 pt-1">
          {/* Trademark & Intellectual Property Alert Card */}
          {trademarkAlert && (
            <div className="p-4 bg-amber-50/90 rounded-xl border-2 border-amber-400 text-amber-950 shadow-sm space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                    Intellectual Property & Trademark Alert
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-900 text-white shadow-2xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                    <span>WELL-KNOWN BRAND / TRADEMARK</span>
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded border border-amber-300">
                  RA 8293 • IPOPHL • DTI DAO 18-07
                </span>
              </div>

              <div className="text-xs font-bold leading-relaxed text-amber-950">
                {trademarkAlert.message}
              </div>

              <div className="p-3 bg-white/95 rounded-lg border border-amber-300 text-[11px] text-amber-950 space-y-2 shadow-2xs">
                <p className="font-extrabold text-[11px] text-amber-950 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  Why is this brand protected across Barangay, City, Regional, and National levels?
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-900 leading-relaxed">
                  <li>
                    <strong>Protected Across All 4 Scopes (Barangay to National):</strong> Under DTI DAO No. 18-07, Section 10(f), and IPOPHL RA 8293 Section 123, any proposed business name that is identical or confusingly similar to a registered trademark or well-known brand (such as <em>Cocopan, Goldilocks, Mega, Red Ribbon, 7-Eleven / 711, Uncle John's, KFC</em>) is <strong>strictly prohibited from registration at ANY level</strong> — even at the Barangay level.
                  </li>
                  <li>
                    <strong>DTI (BNRS) is for Sole Proprietorships only:</strong> DTI BNRS only registers businesses owned by single Filipino citizens. Famous retail chains and household brands do not register as individual sole proprietorships.
                  </li>
                  <li>
                    <strong>SEC registers Incorporated Entities:</strong> Brands such as <em>7-Eleven</em> (Philippine Seven Corporation), <em>Uncle John's</em> (Robinsons Convenience Stores, Inc.), <em>Mega Sardines</em> (Mega Prime Foods Inc. / Mega Global Corp), <em>Goldilocks</em> (Goldilocks Bakeshop, Inc.), and <em>Red Ribbon</em> (Red Ribbon Bakeshop, Inc. / Jollibee Foods Corp) are registered with the SEC under corporate legal holding companies.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* DTI & SEC Result Cards placed horizontally side-by-side */}
          {(dtiResult || secResult) && (
            <div className={`grid grid-cols-1 ${dtiResult && secResult ? "lg:grid-cols-2" : "grid-cols-1"} gap-3 items-stretch`}>
              {/* DTI Result Card */}
              {dtiResult && (
                <div className="p-4 bg-white rounded-xl border border-neutral-300 text-neutral-900 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold tracking-wider uppercase text-neutral-800">
                            DTI Business Name Search
                          </span>
                          {getStatusBadge(dtiResult.status, dtiResult.matchType)}
                        </div>
                        <p className="text-[11px] text-neutral-600 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>Query: <strong className="text-neutral-900">"{dtiResult.query}"</strong></span>
                          <span className="inline-block px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded-md text-[10px] font-semibold text-neutral-700">
                            Scope: Sole Proprietorships (4 Scopes)
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCheckDTI(true)}
                          disabled={isCheckingDTI}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-md transition-colors"
                          title="Force refresh check"
                        >
                          <RotateCw className={`w-3 h-3 ${isCheckingDTI ? "animate-spin" : ""}`} />
                          <span>Check Again</span>
                        </button>
                        <a
                          href={dtiResult.officialSource || OFFICIAL_SOURCES.DTI_BNRS_SEARCH}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#122244] hover:bg-[#0a142e] rounded-md transition-colors shadow-2xs"
                        >
                          <span>Open DTI</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="text-xs text-neutral-800">
                      <p className="font-semibold leading-relaxed">{dtiResult.message}</p>
                    </div>

                    {/* Matched Records */}
                    {dtiResult.status === "FOUND" && dtiResult.records && dtiResult.records.length > 0 && (
                      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2 text-xs">
                        <span className="text-[11px] font-extrabold uppercase text-neutral-700 tracking-wide block">
                          Official Record Information:
                        </span>
                        {dtiResult.records.map((rec, i) => (
                          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-neutral-500 font-medium">Business Name: </span>
                              <span className="font-bold text-neutral-900">
                                {rec.businessName || rec.name || dtiResult.query}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500 font-medium">Territory: </span>
                              <span className="font-semibold text-neutral-800">
                                {rec.territory || "Nationwide / Specified"}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500 font-medium">Status: </span>
                              <span className="font-semibold text-neutral-800">
                                {rec.status || "Registered"}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500 font-medium">Registration Date: </span>
                              <span className="font-semibold text-neutral-800">
                                {rec.registrationDate || "On file in DTI BNRS"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Source & Timestamp Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 mt-2">
                    <div>
                      <span className="font-semibold text-neutral-700">Source: </span>
                      <span>{dtiResult.sourceName || "Department of Trade and Industry - BNRS"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-700">Last checked: </span>
                      <span>{formatTimestamp(dtiResult.checkedAt)}</span>
                      {dtiResult.cached && <span className="ml-1 text-neutral-400">(cached)</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* SEC Result Card */}
              {secResult && (
                <div className="p-4 bg-white rounded-xl border border-neutral-300 text-neutral-900 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold tracking-wider uppercase text-neutral-800">
                            SEC Company Lookup
                          </span>
                          {getStatusBadge(secResult.status, secResult.matchType)}
                        </div>
                        <p className="text-[11px] text-neutral-600 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>Query: <strong className="text-neutral-900">"{secResult.query}"</strong></span>
                          <span className="inline-block px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded-md text-[10px] font-semibold text-neutral-700">
                            Scope: National (Corporations, Partnerships, OPCs)
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCheckSEC(true)}
                          disabled={isCheckingSEC}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-md transition-colors"
                          title="Force refresh check"
                        >
                          <RotateCw className={`w-3 h-3 ${isCheckingSEC ? "animate-spin" : ""}`} />
                          <span>Check Again</span>
                        </button>
                        <a
                          href={secResult.officialSource || OFFICIAL_SOURCES.SEC_ESPARC}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#122244] hover:bg-[#0a142e] rounded-md transition-colors shadow-2xs"
                        >
                          <span>Open SEC</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="text-xs text-neutral-800">
                      <p className="font-semibold leading-relaxed">{secResult.message}</p>
                    </div>

                    {/* Matched Records */}
                    {secResult.status === "FOUND" && secResult.records && secResult.records.length > 0 && (
                      <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2 text-xs">
                        <span className="text-[11px] font-extrabold uppercase text-neutral-700 tracking-wide block">
                          Official SEC Registered Entity Information:
                        </span>
                        {secResult.records.map((rec, i) => (
                          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-neutral-500 font-medium">Company Name: </span>
                              <span className="font-bold text-neutral-900">
                                {rec.companyName || rec.name || secResult.query}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500 font-medium">SEC Registration #: </span>
                              <span className="font-semibold text-neutral-800">
                                {rec.secNumber || "Available in SEC Records"}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500 font-medium">Entity Type: </span>
                              <span className="font-semibold text-neutral-800">
                                {rec.companyType || "Corporation / Partnership"}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500 font-medium">Status: </span>
                              <span className="font-semibold text-neutral-800">
                                {rec.status || "Registered"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Important Legal Distinction Note */}
                    <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-[10px] text-neutral-600 flex items-start gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                      <p>
                        <strong>SEC Distinction:</strong> SEC company lookup checks registered entities.
                        Official proposed corporate name approval is decided exclusively through the{" "}
                        <a
                          href={OFFICIAL_SOURCES.SEC_ESPARC}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-neutral-800 underline"
                        >
                          SEC eSPARC system
                        </a>
                        . "Not Found" does not mean guaranteed SEC approval.
                      </p>
                    </div>
                  </div>

                  {/* Source & Timestamp Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 mt-2">
                    <div>
                      <span className="font-semibold text-neutral-700">Source: </span>
                      <span>{secResult.sourceName || "Securities and Exchange Commission (SEC)"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-700">Last checked: </span>
                      <span>{formatTimestamp(secResult.checkedAt)}</span>
                      {secResult.cached && <span className="ml-1 text-neutral-400">(cached)</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Official Disclaimer */}
          <div className="px-3 py-2 bg-neutral-50 rounded-lg border border-neutral-200 text-[10px] text-neutral-600 italic leading-snug">
            Feasify is an academic assistance and checking tool. Name search results are based on
            the available official source. Feasify cannot make an official government determination
            of name availability. Please confirm availability and file registrations directly through
            the official government systems (DTI BNRS & SEC eSPARC).
          </div>
        </div>
      )}
    </div>
  );
};
