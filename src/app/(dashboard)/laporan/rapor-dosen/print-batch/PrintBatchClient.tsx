"use client";
// src/app/(dashboard)/laporan/rapor-dosen/print-batch/PrintBatchClient.tsx
// Tampilan Preview Massal Lembar Rapor format A4 dengan Panel Aksi di Sebelah Kanan
// Menyelaraskan 100% Standar UI dengan halaman /laporan/rapor-dosen/[id]
// Dilengkapi Fitur "Download Semua (.ZIP)" - Kualitas Ultra HD 300 DPI Lossless PNG

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import JSZip from "jszip";
import { toast } from "sonner";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  Clock,
  Archive,
  Loader2,
} from "lucide-react";
import RaporSheetA4 from "@/components/rapor/RaporSheetA4";
import { RaporDosenDetailData } from "@/actions/rapor";
import {
  formatRaporPdfFilename,
  formatRaporZipFilename,
} from "@/lib/rapor-calculator";

interface PrintBatchClientProps {
  items: RaporDosenDetailData[];
  semesterId: string;
}

export default function PrintBatchClient({
  items,
  semesterId,
}: PrintBatchClientProps) {
  // State untuk melacak apakah sedang mencetak satu lembar spesifik atau semua lembar
  const [printingSingleId, setPrintingSingleId] = useState<string | null>(null);

  // State untuk proses Download Semua (.ZIP) Ultra HD
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgressPercent, setZipProgressPercent] = useState(0);
  const [zipCurrentIndex, setZipCurrentIndex] = useState(0);
  const [zipCurrentDosenName, setZipCurrentDosenName] = useState("");
  const [zipStatusText, setZipStatusText] = useState("");
  const isCancelledRef = useRef<boolean>(false);

  const semesterInfo = items[0]?.semester;
  const cleanTahun = (semesterInfo?.tahunAkademik || "").replace(/\//g, "_").trim();
  const cleanPeriode = (semesterInfo?.periode || "").trim();

  const countFinal = items.filter((i) => i.rapor?.statusRapor === "FINAL").length;
  const countDraft = items.length - countFinal;

  const defaultPageTitle = `Rapor Dosen - Gabungan (${items.length} Dosen - ${cleanTahun} ${cleanPeriode})`.trim();

  // Bersihkan state & restore document.title setelah event cetak browser selesai
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingSingleId(null);
      document.title = defaultPageTitle;
    };

    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [defaultPageTitle]);

  // Cetak Semua Lembar Disatukan (1 file PDF multi-halaman berurutan Vektor Asli)
  const handlePrintAll = () => {
    setPrintingSingleId(null);
    document.title = defaultPageTitle;

    setTimeout(() => {
      window.print();
    }, 80);
  };

  // Cetak Lembar Ini Secara Terpisah (1 file PDF khusus dosen ini Vektor Asli)
  const handlePrintSingle = (item: RaporDosenDetailData) => {
    const singleTitle = formatRaporPdfFilename(
      item.dosen.nama,
      item.semester.tahunAkademik,
      item.semester.periode,
      false
    );

    setPrintingSingleId(item.dosen.id);
    document.title = singleTitle;

    setTimeout(() => {
      window.print();
    }, 120);
  };

  // Download Semua Lembar Evaluasi Terpisah dalam 1 file .ZIP (Ultra HD 300 DPI Lossless PNG)
  const handleDownloadZip = async () => {
    if (items.length === 0) return;

    try {
      setIsZipping(true);
      isCancelledRef.current = false;
      setZipProgressPercent(0);
      setZipCurrentIndex(0);
      setZipCurrentDosenName("");
      setZipStatusText(`Menyiapkan ${items.length} file PDF...`);

      const zip = new JSZip();
      const total = items.length;

      for (let i = 0; i < total; i++) {
        if (isCancelledRef.current) return;

        const item = items[i];
        setZipCurrentIndex(i + 1);
        setZipCurrentDosenName(item.dosen.nama);
        setZipStatusText(`Membuat PDF Ultra HD (${i + 1} dari ${total})...`);
        setZipProgressPercent(Math.round((i / total) * 90));

        // Ambil elemen A4 yang sudah dirender di halaman
        const wrapperEl = document.getElementById(`sheet-${item.dosen.id}`);
        const sheetEl = (wrapperEl?.querySelector(".a4-sheet") || wrapperEl) as HTMLElement;

        if (!sheetEl) {
          console.warn(`Elemen lembar dosen ${item.dosen.nama} tidak ditemukan`);
          continue;
        }

        // Tunggu sesaat agar reflow stabil
        await new Promise((r) => setTimeout(r, 60));

        // Render ke PNG Lossless pada standar percetakan 300 DPI (pixelRatio 3.125)
        const imgData = await toPng(sheetEl, {
          quality: 1,
          pixelRatio: 3.125,
          backgroundColor: "#ffffff",
          skipFonts: true, // Mencegah SecurityError cross-origin font stylesheet
          cacheBust: false,
        });

        // Masukkan ke jsPDF A4 (210mm x 297mm)
        const pdf = new jsPDF({
          orientation: "p",
          unit: "mm",
          format: "a4",
          compress: true,
        });

        pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");

        // Format nama file resmi: 'Rapor Dosen - [NamaDosen] ([TahunAkademik] [Periode]).pdf'
        const filename = formatRaporPdfFilename(
          item.dosen.nama,
          item.semester.tahunAkademik,
          item.semester.periode,
          true
        );

        const pdfBlob = pdf.output("blob");
        zip.file(filename, pdfBlob);
      }

      if (isCancelledRef.current) return;

      setZipStatusText("Mengompresi ke file .ZIP...");
      setZipProgressPercent(94);

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const zipFilename = `Rapor Dosen - Batch (${total} Dosen - ${cleanTahun} ${cleanPeriode}).zip`;

      // Trigger download file di browser
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

      setZipProgressPercent(100);
      toast.success(`Berhasil mengunduh ${total} file PDF dalam format ZIP!`);
      setTimeout(() => {
        setIsZipping(false);
      }, 500);
    } catch (err: any) {
      console.error("Gagal membuat batch ZIP:", err);
      toast.error(err?.message || "Gagal mengunduh file ZIP.");
      setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 sm:p-5 print:p-0 print:bg-white">
      {/* ── CONTAINER FLEX: SURAT A4 DI KIRI & PANEL AKSI DI KANAN (IDENTIK DENGAN [ID]) ── */}
      <div className="max-w-[1300px] mx-auto flex flex-col lg:flex-row items-start justify-center gap-5 print:block">
        
        {/* ── SURAT A4 STACK DI SEBELAH KIRI ─────────────────────────────────── */}
        <div
          className={`print-canvas shrink-0 mx-auto lg:mx-0 print:p-0 print:m-0 space-y-8 print:space-y-0 ${
            printingSingleId ? "is-printing-single" : ""
          }`}
        >
          {items.map((item) => {
            const isSingleHidden =
              printingSingleId !== null && printingSingleId !== item.dosen.id;

            return (
              <div
                key={item.dosen.id}
                id={`sheet-${item.dosen.id}`}
                className={`batch-item-wrapper ${isSingleHidden ? "print-hide-sheet" : ""}`}
              >
                {/* ── LEMBAR EVALUASI A4 VEKTOR ASLI ──────────────────────── */}
                <RaporSheetA4 data={item} />
              </div>
            );
          })}
        </div>

        {/* ── PANEL AKSI & INFORMASI DI SEBELAH KANAN (PRINT HIDDEN, IDENTIK DENGAN [ID]) ──── */}
        <div className="w-full lg:w-72 shrink-0 sticky top-[72px] z-10 print:hidden space-y-3">
          
          {/* Card Aksi Utama (Sama persis dengan [id]) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-2.5">
            {/* Tombol Cetak Semua (Disatukan) */}
            <button
              id="btn-print-all-combined"
              onClick={handlePrintAll}
              disabled={isZipping}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#a80063] hover:bg-[#8c0052] text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
              title={`Cetak semua ${items.length} lembar dosen disatukan dalam satu file PDF`}
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Semua (Disatukan)</span>
            </button>

            {/* Tombol Download Semua (.ZIP) - Ultra HD 300 DPI */}
            <button
              id="btn-download-all-zip"
              type="button"
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#a80063] hover:bg-[#8c0052] text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
              title={`Download ${items.length} file PDF terpisah dalam format .ZIP (Ultra HD 300 DPI)`}
            >
              <Archive className="w-4 h-4 text-white" />
              <span>Download PDF Terpisah (.ZIP)</span>
            </button>

            {/* Tombol Kembali ke Daftar Rapor */}
            <Link
              href={`/laporan/rapor-dosen?semesterId=${semesterId}`}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Daftar Rapor</span>
            </Link>

            {/* Info Ringkas Dokumen Batch */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5 text-left">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Jumlah Dosen Terpilih
                </span>
                <p className="text-xs font-semibold text-slate-900 leading-snug">
                  {items.length} Dosen
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Semester
                </span>
                <p className="text-xs font-semibold text-slate-700">
                  {semesterInfo?.tahunAkademik} ({semesterInfo?.periode})
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                  Status Validasi
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} />
                    <span>Final ({countFinal})</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock size={12} />
                    <span>Draft ({countDraft})</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Daftar Dosen & Cetak PDF Terpisah */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-2.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
              Cetak PDF Terpisah ({items.length})
            </span>
            <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
              {items.map((item, idx) => {
                const isFinal = item.rapor?.statusRapor === "FINAL";
                const nipOrNidn = item.dosen.nip
                  ? `${item.dosen.nip}`
                  : item.dosen.nidn
                  ? `${item.dosen.nidn}`
                  : " -";
                const prodiNama = item.dosen.prodi?.nama || "-";

                return (
                  <div
                    key={item.dosen.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/60 transition-colors gap-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`sheet-${item.dosen.id}`);
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer group"
                      title={`Lompat ke lembar ${item.dosen.nama}`}
                    >
                      <p className="text-[11px] font-bold text-slate-800 truncate group-hover:text-[#a80063]">
                        {item.dosen.nama}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                        {nipOrNidn} &bull; {prodiNama}
                      </p>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isFinal
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "bg-amber-50 text-amber-600 border border-amber-200"
                        }`}
                        title={isFinal ? "Status: Final (Terverifikasi)" : "Status: Draft (Peninjauan)"}
                      >
                        {isFinal ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                      </span>

                      <button
                        type="button"
                        id={`btn-print-single-${item.dosen.id}`}
                        onClick={() => handlePrintSingle(item)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-[#fdf2f8] hover:text-[#a80063] hover:border-[#fbcfe8] border border-slate-200/80 text-slate-500 flex items-center justify-center transition-all shadow-2xs cursor-pointer active:scale-95"
                        title={`Cetak PDF Lembar ${item.dosen.nama}`}
                      >
                        <Printer size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── MODAL INDIKATOR PROGRESS DOWNLOAD ZIP (CDU PORTAL STANDARD) ──────── */}
      {isZipping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#a80063]/10 text-[#a80063] border border-[#a80063]/20 flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  Menyiapkan File ZIP
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {zipStatusText || `Memproses ${zipCurrentIndex} dari ${items.length} dosen...`}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                <div
                  className="bg-[#a80063] h-full transition-all duration-200 rounded-full"
                  style={{ width: `${zipProgressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10.5px] text-slate-500 font-mono">
                <span className="truncate max-w-[200px]">
                  {zipCurrentDosenName || "Inisialisasi..."}
                </span>
                <span className="font-bold text-slate-700">{zipProgressPercent}%</span>
              </div>
            </div>

            {/* Tombol Batal */}
            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  isCancelledRef.current = true;
                  setIsZipping(false);
                  toast.info("Download ZIP dibatalkan.");
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT SPECIFIC CSS - 100% PRESISI A4 & BEBAS BORDER GREY ──────────── */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }

        @media print {
          /* Sembunyikan elemen UI dashboard di luar lembar */
          nav,
          header,
          aside,
          footer,
          .no-print,
          .print\\:hidden {
            display: none !important;
          }

          /* Reset canvas ke A4 murni */
          html,
          body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Hilangkan padding, margin, border dari pembungkus luar */
          main,
          main > div,
          .min-h-screen,
          .print-canvas {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            outline: none !important;
            background: transparent !important;
            background-color: transparent !important;
          }

          /* Mode Cetak Terpisah (Single Print): Matikan page-break-after agar TIDAK ADA halaman kedua yang kosong */
          .is-printing-single .batch-item-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
          }

          /* Mode Cetak Massal (Combined): Page-break setelah setiap lembar kecuali yang terakhir */
          .print-canvas:not(.is-printing-single) > .batch-item-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .print-canvas:not(.is-printing-single) > .batch-item-wrapper:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Sembunyikan lembar lain saat mode Cetak Terpisah (Single Print) aktif */
          .print-hide-sheet {
            display: none !important;
          }

          /* Pastikan lembar A4 berukuran presisi 210mm x 297mm */
          .a4-sheet {
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 7mm 20mm 2mm 20mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
