import React, { useState } from "react";
import { X, FileText, Calculator, Sparkles, Download, Loader2, AlertCircle } from "lucide-react";
import {
  type ExportSectionKey,
  isAiAnalysisAvailable,
  exportProposalSectionsPDF,
} from "../services/proposalSectionExportService.ts";

export interface ProposalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: any;
  group?: any;
  adviserName?: string;
}

export const ProposalExportModal: React.FC<ProposalExportModalProps> = ({
  isOpen,
  onClose,
  proposal,
  group,
  adviserName,
}) => {
  const [selectedSections, setSelectedSections] = useState<ExportSectionKey[]>([
    "overview",
    "financial",
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const aiAvailable = isAiAnalysisAvailable(proposal);

  const toggleSection = (section: ExportSectionKey) => {
    if (section === "ai" && !aiAvailable) return;
    setErrorMessage(null);
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handleExport = async () => {
    if (selectedSections.length === 0) return;
    setIsExporting(true);
    setErrorMessage(null);

    try {
      await exportProposalSectionsPDF({
        proposal,
        group,
        adviserName,
        selectedSections,
      });
      onClose();
    } catch (err: any) {
      console.error("PDF Export error:", err);
      setErrorMessage(err?.message || "Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-[#122244] text-white flex justify-between items-start border-b border-[#1a2f55]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#c9a654] border border-white/10">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 id="export-modal-title" className="text-lg font-extrabold tracking-tight">
                Export Business Proposal
              </h2>
              <p className="text-xs text-gray-300 mt-0.5">
                {proposal?.businessName || "Business Proposal Report"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-600 font-medium leading-relaxed">
            Select the section you want to export as a PDF. Multiple selected sections will be
            compiled into a single cohesive document.
          </p>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2.5">
            {/* 1. Project Overview */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                selectedSections.includes("overview")
                  ? "bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20"
                  : "bg-gray-50 border-gray-200 hover:bg-gray-100/70"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSections.includes("overview")}
                onChange={() => toggleSection("overview")}
                disabled={isExporting}
                className="mt-0.5 w-4 h-4 rounded text-[#122244] border-gray-300 focus:ring-[#122244] cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#122244]" />
                  <span className="text-xs font-bold text-[#122244]">Project Overview</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Proponents, objectives, target demographic, proposal status, and submission dates.
                </p>
              </div>
            </label>

            {/* 2. Financial Input */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                selectedSections.includes("financial")
                  ? "bg-amber-50/70 border-[#c9a654] ring-2 ring-[#c9a654]/20"
                  : "bg-gray-50 border-gray-200 hover:bg-gray-100/70"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSections.includes("financial")}
                onChange={() => toggleSection("financial")}
                disabled={isExporting}
                className="mt-0.5 w-4 h-4 rounded text-[#c9a654] border-gray-300 focus:ring-[#c9a654] cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#c9a654]" />
                  <span className="text-xs font-bold text-[#122244]">Financial Input</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Startup capital, unit product costing, monthly expenses, profit margins, and BMBE tax rules.
                </p>
              </div>
            </label>

            {/* 3. AI Feasibility Analysis */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all select-none ${
                !aiAvailable
                  ? "bg-gray-50/50 border-gray-200 opacity-60 cursor-not-allowed"
                  : selectedSections.includes("ai")
                  ? "bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20 cursor-pointer"
                  : "bg-gray-50 border-gray-200 hover:bg-gray-100/70 cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSections.includes("ai")}
                onChange={() => toggleSection("ai")}
                disabled={!aiAvailable || isExporting}
                className="mt-0.5 w-4 h-4 rounded text-purple-700 border-gray-300 focus:ring-purple-700 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-[#122244]">
                    AI Feasibility Analysis
                    {!aiAvailable && (
                      <span className="ml-2 text-[10px] text-red-600 font-semibold bg-red-50 border border-red-200 px-1.5 py-0.2 rounded-full">
                        Unavailable – Not yet analyzed
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {aiAvailable
                    ? "Active Month evaluation, 5-Year Pro-Forma Projection, and Strategic Insights & Financial Health (4 Core Feasibility Pillars)."
                    : "This business proposal has not completed an AI feasibility evaluation yet. Please wait for an evaluation before exporting."}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl shadow-xs hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedSections.length === 0 || isExporting}
            className="px-5 py-2 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c9a654]" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-[#c9a654]" />
                Export Selected PDF ({selectedSections.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProposalExportModal;
