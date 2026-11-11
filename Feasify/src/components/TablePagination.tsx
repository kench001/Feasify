import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_PAGE_SIZE = 10;

export const buildPageNumbers = (
  currentPage: number,
  totalPages: number
): Array<number | "ellipsis"> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 3) {
    pages.push("ellipsis");
  } else if (windowStart === 3) {
    pages.push(2);
  }

  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push(p);
  }

  if (windowEnd < totalPages - 2) {
    pages.push("ellipsis");
  } else if (windowEnd === totalPages - 2) {
    pages.push(totalPages - 1);
  }

  pages.push(totalPages);
  return pages;
};

export interface PaginatedResult<T> {
  pageItems: T[];
  safePage: number;
  totalPages: number;
  showingStart: number;
  showingEnd: number;
  totalItems: number;
}

export const paginateItems = <T,>(
  items: T[],
  currentPage: number,
  pageSize: number = DEFAULT_PAGE_SIZE
): PaginatedResult<T> => {
  const safePageSize = Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(currentPage) || 1), totalPages);
  const startIdx = (safePage - 1) * safePageSize;

  return {
    pageItems: items.slice(startIdx, startIdx + safePageSize),
    safePage,
    totalPages,
    showingStart: totalItems === 0 ? 0 : startIdx + 1,
    showingEnd: Math.min(startIdx + safePageSize, totalItems),
    totalItems,
  };
};

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  itemLabel = "items",
  onPageChange,
}) => {
  if (totalItems <= 0) return null;

  const safePageSize = Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(currentPage) || 1), totalPages);
  const startIdx = (safePage - 1) * safePageSize;
  const showingStart = startIdx + 1;
  const showingEnd = Math.min(startIdx + safePageSize, totalItems);
  const pageNumbers = buildPageNumbers(safePage, totalPages);

  return (
    <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
      <p className="text-gray-500 font-medium">
        Showing{" "}
        <span className="font-bold text-[#122244]">
          {showingStart}–{showingEnd}
        </span>{" "}
        of{" "}
        <span className="font-bold text-[#122244]">
          {totalItems}
        </span>{" "}
        {itemLabel}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        {pageNumbers.map((pageItem, pIdx) =>
          pageItem === "ellipsis" ? (
            <span
              key={`ellipsis-${pIdx}`}
              className="px-2 py-1 text-gray-400 font-bold select-none"
            >
              …
            </span>
          ) : (
            <button
              key={pageItem}
              type="button"
              onClick={() => onPageChange(pageItem)}
              aria-current={safePage === pageItem ? "page" : undefined}
              className={`min-w-[32px] h-8 px-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                safePage === pageItem
                  ? "bg-[#122244] text-white shadow-xs"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {pageItem}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TablePagination;
