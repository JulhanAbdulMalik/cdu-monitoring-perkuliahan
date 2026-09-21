"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export default function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100, 250, 500],
  className = "",
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis windowing
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    if (safeCurrentPage >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "...",
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
      "...",
      totalPages,
    ];
  };

  const pages = getPageNumbers();

  const handlePageClick = (p: number) => {
    if (p !== safeCurrentPage && p >= 1 && p <= totalPages) {
      onPageChange(p);
    }
  };

  return (
    <div
      className={`px-4 py-3 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none print:hidden ${className}`}
    >
      {/* ── Left Side: Page Size Selector & Record Counter ────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 text-slate-600">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                if (onPageSizeChange) {
                  onPageSizeChange(newSize);
                }
                // Reset to page 1 on page size change
                onPageChange(1);
              }}
              className="bg-white border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg px-2 py-1 outline-none hover:border-slate-300 focus:border-[#fbcfe8] focus:ring-2 focus:ring-[#fdf2f8] transition-all cursor-pointer shadow-2xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} baris
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
          <span>Menampilkan</span>
          <strong className="text-slate-800 font-bold">
            {totalItems === 0 ? "0" : `${startIndex}–${endIndex}`}
          </strong>
          <span>dari</span>
          <strong className="text-slate-800 font-bold">{totalItems}</strong>
          <span>data</span>
        </div>
      </div>

      {/* ── Right Side: Navigation Buttons ─────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* First Page Button */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={safeCurrentPage <= 1}
          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-[#fdf2f8] hover:text-[#a80063] hover:border-[#fbcfe8] disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-400 disabled:hover:border-slate-200 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          title="Halaman Pertama"
        >
          <ChevronsLeft size={13} />
        </button>

        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => handlePageClick(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-[#fdf2f8] hover:text-[#a80063] hover:border-[#fbcfe8] disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-400 disabled:hover:border-slate-200 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          title="Halaman Sebelumnya"
        >
          <ChevronLeft size={13} />
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1 mx-0.5">
          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-6 text-center text-slate-400 font-bold text-[11px] select-none"
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === safeCurrentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => handlePageClick(pageNum)}
                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer shadow-2xs flex items-center justify-center ${
                  isActive
                    ? "bg-[#a80063] text-white border-[#a80063] shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-[#fdf2f8] hover:text-[#a80063] hover:border-[#fbcfe8]"
                }`}
                title={`Halaman ${pageNum}`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => handlePageClick(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-[#fdf2f8] hover:text-[#a80063] hover:border-[#fbcfe8] disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-400 disabled:hover:border-slate-200 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          title="Halaman Selanjutnya"
        >
          <ChevronRight size={13} />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          onClick={() => handlePageClick(totalPages)}
          disabled={safeCurrentPage >= totalPages}
          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-[#fdf2f8] hover:text-[#a80063] hover:border-[#fbcfe8] disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-400 disabled:hover:border-slate-200 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          title="Halaman Terakhir"
        >
          <ChevronsRight size={13} />
        </button>
      </div>
    </div>
  );
}
