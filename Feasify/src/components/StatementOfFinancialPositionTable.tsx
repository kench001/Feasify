import React from "react";
import type { BalanceSheetPeriodData } from "../utils/balanceSheetProjections";
import { Printer } from "lucide-react";

interface StatementOfFinancialPositionTableProps {
  data: BalanceSheetPeriodData[];
  businessName?: string;
  isPrintView?: boolean;
  onPrint?: () => void;
}

export const StatementOfFinancialPositionTable: React.FC<StatementOfFinancialPositionTableProps> = ({
  data,
  businessName = "ROOT 'N BEANS",
  isPrintView = false,
  onPrint,
}) => {
  // Helper to format currency numbers to 2 decimal places with comma thousand separators
  const formatNumber = (val: number | undefined): string => {
    if (val === undefined || isNaN(val)) return "0.00";
    return val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Color constants tailored directly to match Image 1
  const THEME = {
    titleBannerBg: "#A93E1D", // Deep terracotta / rust banner
    columnHeaderBg: "#DB7B27", // Golden-orange headers
    subtotalRowBg: "#E38938", // Highlighted warm orange for subtotal rows
    majorTotalRowBg: "#B54722", // Rich darker terracotta for major totals
    borderColor: "#111111", // Solid crisp black borders
  };

  const cleanEntityName = (businessName || "ROOT 'N BEANS").trim().toUpperCase();
  const entityTitle = cleanEntityName.includes("PARTNERSHIP") || cleanEntityName.includes("CORP") || cleanEntityName.includes("CO.")
    ? cleanEntityName
    : `${cleanEntityName} PARTNERSHIP`;

  // Explicit cell border style that avoids browser subpixel clipping
  const cellBorder = {
    borderRight: `1.5px solid ${THEME.borderColor}`,
    borderBottom: `1.5px solid ${THEME.borderColor}`,
  };

  // Dynamic cell paddings for guaranteed 1-page fit in Print vs comfortable view on screen
  const pBanner = isPrintView ? "py-1.5 px-2" : "py-3 px-3";
  const pHeader = isPrintView ? "py-1 px-1.5 text-[10px]" : "py-2 px-2 text-xs sm:text-[13px]";
  const pCat = isPrintView ? "py-0.5 px-2 text-[9px]" : "py-1 px-3 text-xs";
  const pItem = isPrintView ? "py-0.5 px-1.5 pl-4 text-[9px] leading-tight" : "py-1.5 px-3 pl-6 text-xs";
  const pData = isPrintView ? "py-0.5 px-1 text-[9px] leading-tight" : "py-1.5 px-2 text-xs";
  const pSubtotal = isPrintView ? "py-0.5 px-1.5 text-[9.5px] leading-tight" : "py-1.5 px-2 text-xs sm:text-[13px]";
  const pMajor = isPrintView ? "py-1 px-1.5 text-[10px] leading-tight" : "py-2 px-2 text-xs sm:text-[13px]";

  return (
    <div className={`w-full ${isPrintView ? "bg-white p-0" : "bg-white rounded-2xl border border-gray-200 shadow-md p-4 sm:p-6"}`}>
      {/* Top Action Bar (hidden when printing) */}
      {!isPrintView && onPrint && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
          <div>
            <h3 className="font-extrabold text-base text-[#122244] tracking-tight">
              Statement of Financial Position (Balance Sheet)
            </h3>
            <p className="text-xs text-gray-500">
              Multi-Year Projection (Pre-Operations to 2030) formatted per Philippine Accounting & Feasibility Standards
            </p>
          </div>
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#A93E1D] hover:bg-[#8F3317] text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Export Balance Sheet (PDF)
          </button>
        </div>
      )}

      {/* Main Table Scroll Container */}
      <div className="w-full overflow-x-auto">
        <table
          className="w-full text-left font-sans select-text table-fixed"
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            borderTop: `1.5px solid ${THEME.borderColor}`,
            borderLeft: `1.5px solid ${THEME.borderColor}`,
          }}
        >
          {/* Explicit Column Sizing: 26% Item, and 12.33% for each of the 6 data columns */}
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "12.33%" }} />
            <col style={{ width: "12.33%" }} />
            <col style={{ width: "12.33%" }} />
            <col style={{ width: "12.33%" }} />
            <col style={{ width: "12.33%" }} />
            <col style={{ width: "12.33%" }} />
          </colgroup>

          {/* HEADER BANNER */}
          <thead>
            <tr>
              <th
                colSpan={7}
                className={`${pBanner} text-center text-white tracking-wide`}
                style={{
                  backgroundColor: THEME.titleBannerBg,
                  ...cellBorder,
                }}
              >
                <div className="font-extrabold text-xs sm:text-sm tracking-wider uppercase drop-shadow-xs">
                  {entityTitle}
                </div>
                <div className="font-bold text-[10.5px] sm:text-xs mt-0.5">
                  Projected Statement of Financial Position / Balance Sheet
                </div>
                <div className="italic text-[9.5px] sm:text-[10.5px] font-normal opacity-95">
                  For the Years Ended December 31, 2026 - 2030
                </div>
                <div className="italic text-[8.5px] sm:text-[9.5px] font-normal opacity-90">
                  (In Philippine Peso)
                </div>
              </th>
            </tr>

            {/* COLUMN HEADERS */}
            <tr
              className="text-black font-extrabold"
              style={{
                backgroundColor: THEME.columnHeaderBg,
              }}
            >
              <th
                className={`${pHeader} text-left font-bold`}
                style={cellBorder}
              >
                Item
              </th>
              {data.map((col) => (
                <th
                  key={col.periodKey}
                  className={`${pHeader} text-center font-bold`}
                  style={cellBorder}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="text-gray-900 font-sans">
            {/* ========================================================= */}
            {/* CURRENT ASSETS SECTION */}
            {/* ========================================================= */}
            <tr className="bg-amber-50/50 font-bold">
              <td
                colSpan={7}
                className={`${pCat} italic text-stone-900 font-bold`}
                style={cellBorder}
              >
                Current Assets:
              </td>
            </tr>

            {/* Cash */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Cash
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.cash)}
                </td>
              ))}
            </tr>

            {/* Inventory */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Inventory
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.inventory)}
                </td>
              ))}
            </tr>

            {/* Supplies */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Supplies
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.supplies)}
                </td>
              ))}
            </tr>

            {/* Prepaid Rent */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Prepaid Rent
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.prepaidRent)}
                </td>
              ))}
            </tr>

            {/* Prepaid Expenses - Others */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Prepaid Expenses - Others
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.prepaidOthers)}
                </td>
              ))}
            </tr>

            {/* Input VAT */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Input VAT
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.inputVat)}
                </td>
              ))}
            </tr>

            {/* Total Current Assets Subtotal Row */}
            <tr
              className="font-bold text-black"
              style={{
                backgroundColor: THEME.subtotalRowBg,
              }}
            >
              <td className={`${pSubtotal} font-bold`} style={cellBorder}>
                Total Current Assets
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pSubtotal} text-right font-bold tabular-nums`} style={cellBorder}>
                  {formatNumber(col.totalCurrentAssets)}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* NONCURRENT ASSETS SECTION */}
            {/* ========================================================= */}
            <tr className="bg-amber-50/50 font-bold">
              <td
                colSpan={7}
                className={`${pCat} italic text-stone-900 font-bold`}
                style={cellBorder}
              >
                Noncurrent Assets:
              </td>
            </tr>

            {/* Leasehold Improvements, net */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Leasehold Improvements, net
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.leaseholdImprovementsNet)}
                </td>
              ))}
            </tr>

            {/* Furniture & Fixtures, net */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Furniture & Fixtures, net
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.furnitureFixturesNet)}
                </td>
              ))}
            </tr>

            {/* Store Equipment, net */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Store Equipment, net
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.storeEquipmentNet)}
                </td>
              ))}
            </tr>

            {/* Fire Safety Equipment, net */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Fire Safety Equipment, net
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.fireSafetyNet)}
                </td>
              ))}
            </tr>

            {/* Cleaning Tools & Equipment, net */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Cleaning Tools & Equipment, net
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.cleaningToolsNet)}
                </td>
              ))}
            </tr>

            {/* Kitchen Tools & Equipment, net */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Kitchen Tools & Equipment, net
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.kitchenToolsNet)}
                </td>
              ))}
            </tr>

            {/* Total Noncurrent Assets Subtotal Row */}
            <tr
              className="font-bold text-black"
              style={{
                backgroundColor: THEME.subtotalRowBg,
              }}
            >
              <td className={`${pSubtotal} font-bold`} style={cellBorder}>
                Total Noncurrent Assets
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pSubtotal} text-right font-bold tabular-nums`} style={cellBorder}>
                  {formatNumber(col.totalNoncurrentAssets)}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* TOTAL ASSETS MAJOR ROW */}
            {/* ========================================================= */}
            <tr
              className="font-black text-white"
              style={{
                backgroundColor: THEME.majorTotalRowBg,
              }}
            >
              <td className={`${pMajor} font-black uppercase tracking-wider`} style={cellBorder}>
                Total Assets
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pMajor} text-right font-black tabular-nums`} style={cellBorder}>
                  {formatNumber(col.totalAssets)}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* CURRENT LIABILITIES SECTION */}
            {/* ========================================================= */}
            <tr className="bg-amber-50/50 font-bold">
              <td
                colSpan={7}
                className={`${pCat} italic text-stone-900 font-bold`}
                style={cellBorder}
              >
                Current Liabilities:
              </td>
            </tr>

            {/* Utilities Payable */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Utilities Payable
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.utilitiesPayable)}
                </td>
              ))}
            </tr>

            {/* SSS Premiums Payable */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                SSS Premiums Payable
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.sssPayable)}
                </td>
              ))}
            </tr>

            {/* PhilHealth Premiums Payable */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                PhilHealth Premiums Payable
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.philHealthPayable)}
                </td>
              ))}
            </tr>

            {/* HDMF Premiums Payable */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                HDMF Premiums Payable
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.hdmfPayable)}
                </td>
              ))}
            </tr>

            {/* Withholding Taxes Payable */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Withholding Taxes Payable
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.withholdingTaxPayable)}
                </td>
              ))}
            </tr>

            {/* Income Tax Payable */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Income Tax Payable
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.incomeTaxPayable)}
                </td>
              ))}
            </tr>

            {/* VAT Payable */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                VAT Payable
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.vatPayable)}
                </td>
              ))}
            </tr>

            {/* Total Current Liabilities Subtotal Row */}
            <tr
              className="font-bold text-black"
              style={{
                backgroundColor: THEME.subtotalRowBg,
              }}
            >
              <td className={`${pSubtotal} font-bold`} style={cellBorder}>
                Total Current Liabilities
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pSubtotal} text-right font-bold tabular-nums`} style={cellBorder}>
                  {formatNumber(col.totalCurrentLiabilities)}
                </td>
              ))}
            </tr>

            {/* Total Liabilities Major Row */}
            <tr
              className="font-black text-white"
              style={{
                backgroundColor: THEME.majorTotalRowBg,
              }}
            >
              <td className={`${pMajor} font-black uppercase tracking-wider`} style={cellBorder}>
                Total Liabilities
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pMajor} text-right font-black tabular-nums`} style={cellBorder}>
                  {formatNumber(col.totalLiabilities)}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* EQUITY SECTION */}
            {/* ========================================================= */}
            <tr className="bg-amber-50/50 font-bold">
              <td
                colSpan={7}
                className={`${pCat} italic text-stone-900 font-bold`}
                style={cellBorder}
              >
                Equity:
              </td>
            </tr>

            {/* Partner's Capital */}
            <tr className="hover:bg-amber-50/20">
              <td className={`${pItem} font-medium text-gray-800`} style={cellBorder}>
                Partner's Capital
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pData} text-right tabular-nums font-medium text-gray-900`} style={cellBorder}>
                  {formatNumber(col.partnersCapital)}
                </td>
              ))}
            </tr>

            {/* Total Equity Subtotal Row */}
            <tr
              className="font-bold text-black"
              style={{
                backgroundColor: THEME.subtotalRowBg,
              }}
            >
              <td className={`${pSubtotal} font-bold`} style={cellBorder}>
                Total Equity
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pSubtotal} text-right font-bold tabular-nums`} style={cellBorder}>
                  {formatNumber(col.totalEquity)}
                </td>
              ))}
            </tr>

            {/* ========================================================= */}
            {/* TOTAL LIABILITIES AND EQUITY (FINAL ROW) */}
            {/* ========================================================= */}
            <tr
              className="font-black text-white"
              style={{
                backgroundColor: THEME.majorTotalRowBg,
              }}
            >
              <td className={`${pMajor} font-black uppercase tracking-wider`} style={cellBorder}>
                Total Liabilities and Equity
              </td>
              {data.map((col) => (
                <td key={col.periodKey} className={`${pMajor} text-right font-black tabular-nums`} style={cellBorder}>
                  {formatNumber(col.totalLiabilitiesAndEquity)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
