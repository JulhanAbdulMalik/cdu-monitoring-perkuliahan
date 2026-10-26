"use client";
// src/app/(dashboard)/laporan/rapor-dosen/print-batch/PrintBatchClient.tsx
// Halaman Cetak Massal (Batch Print) Lembar Rapor Dosen A4

import React from "react";
import Link from "next/link";
import { ArrowLeft, Printer, AlertCircle, Layers } from "lucide-react";
import RaporSheetA4 from "@/components/rapor/RaporSheetA4";
import { RaporDosenDetailData } from "@/actions/rapor";

interface PrintBatchClientProps {
  items: RaporDosenDetailData[];
  semesterId: string;
}

export default function PrintBatchClient({
  items,
  semesterId,
}: PrintBatchClientProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20">
      {/* ── TOP ACTION TOOLBAR (HIDDEN IN PRINT) ──────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 print:hidden shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/laporan/rapor-dosen?semesterId=${semesterId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Link>
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#a80063]" />
                Cetak Massal Lembar Evaluasi ({items.length} Dosen)
              </h2>
              <p className="text-[11px] text-slate-500">
                Setiap lembar dosen akan otomatis dicetak pada halaman baru (Page Break)
              </p>
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#a80063] hover:bg-[#8c0052] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak Semua Lembar ({items.length} Dosen)
          </button>
        </div>
      </div>

      {/* ── BATCH PRINT CANVAS ──────────────────────────────────────────────── */}
      <div className="py-8 px-4 print:py-0 print:px-0">
        <div className="max-w-[210mm] mx-auto space-y-10 print:space-y-0 print:max-w-none print:w-full">
          {items.map((item, index) => (
            <div
              key={item.dosen.id}
              className="batch-item-wrapper print:page-break-after-always print:break-after-page"
            >
              <RaporSheetA4 data={item} />
            </div>
          ))}
        </div>
      </div>

      {/* Print Specific CSS */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 8mm 8mm;
        }
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          nav,
          header,
          aside,
          footer,
          .no-print {
            display: none !important;
          }
          .batch-item-wrapper {
            page-break-after: always !important;
            break-after: page !important;
          }
          .batch-item-wrapper:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .a4-sheet {
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
