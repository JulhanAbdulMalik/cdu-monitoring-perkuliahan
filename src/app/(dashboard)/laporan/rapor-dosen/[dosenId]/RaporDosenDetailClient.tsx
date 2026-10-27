"use client";
// src/app/(dashboard)/laporan/rapor-dosen/[dosenId]/RaporDosenDetailClient.tsx
// Tampilan Preview Lembar Rapor format A4 dengan Panel Aksi di Sebelah Kanan Surat

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  Clock,
} from "lucide-react";
import RaporSheetA4 from "@/components/rapor/RaporSheetA4";
import RaporConfigModal from "../RaporConfigModal";
import { RaporDosenDetailData } from "@/actions/rapor";
import { formatRaporPdfFilename } from "@/lib/rapor-calculator";

interface RaporDosenDetailClientProps {
  data: RaporDosenDetailData;
  semesterId: string;
}

export default function RaporDosenDetailClient({
  data,
  semesterId,
}: RaporDosenDetailClientProps) {
  const router = useRouter();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Format nama file resmi: Rapor Dosen - [NamaDosen] ([TahunAkademik] [Periode]).pdf
  const officialFilename = formatRaporPdfFilename(
    data.dosen.nama,
    data.semester.tahunAkademik,
    data.semester.periode,
    true
  );

  const officialTitle = formatRaporPdfFilename(
    data.dosen.nama,
    data.semester.tahunAkademik,
    data.semester.periode,
    false
  );

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = officialTitle;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  const isFinal = data.rapor?.statusRapor === "FINAL";

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 sm:p-5 print:p-0 print:bg-white">
      {/* ── CONTAINER FLEX: SURAT A4 DI KIRI & PANEL AKSI DI KANAN ──────────── */}
      <div className="max-w-[1300px] mx-auto flex flex-col lg:flex-row items-start justify-center gap-5 print:block">
        
        {/* ── SURAT A4 (Tampil langsung di posisi atas tanpa terdorong header) ─ */}
        <div className="print-canvas shrink-0 mx-auto lg:mx-0 print:p-0 print:m-0">
          <RaporSheetA4 data={data} />
        </div>

        {/* ── PANEL AKSI & INFORMASI DI SEBELAH KANAN SURAT (PRINT HIDDEN) ──── */}
        <div className="w-full lg:w-72 shrink-0 sticky top-[72px] z-10 print:hidden space-y-3">
          {/* Card Aksi Utama */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
            {/* Tombol Cetak / Simpan PDF (A4) */}
            <button
              onClick={handlePrint}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#a80063] hover:bg-[#8c0052] text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-[0.99]"
              title={`Cetak atau Simpan PDF: ${officialFilename}`}
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF (A4)</span>
            </button>

            {/* Tombol Kembali ke Daftar Rapor */}
            <Link
              href={`/laporan/rapor-dosen?semesterId=${semesterId}`}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Daftar Rapor</span>
            </Link>

            {/* Info Ringkas Dokumen */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5 text-left">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Nama Dosen
                </span>
                <p className="text-xs font-semibold text-slate-900 leading-snug">
                  {data.dosen.nama}
                </p>
                <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">
                  {data.dosen.nip ? `NIP: ${data.dosen.nip}` : data.dosen.nidn ? `NIDN: ${data.dosen.nidn}` : "NIP: -"}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Program Studi
                </span>
                <p className="text-xs font-semibold text-slate-700">
                  {data.dosen.prodi?.nama || "-"}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Semester
                </span>
                <p className="text-xs font-semibold text-slate-700">
                  {data.semester.tahunAkademik} ({data.semester.periode})
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                  Status Validasi
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold ${
                    isFinal
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {isFinal ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                  <span>{isFinal ? "FINAL (Terverifikasi)" : "DRAFT (Peninjauan)"}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Specific CSS - 100% Presisi A4 & Bebas Border Grey */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        @media print {
          /* Sembunyikan semua elemen UI dashboard di luar lembar rapor */
          nav,
          header,
          aside,
          footer,
          .no-print {
            display: none !important;
          }

          /* Reset html & body ke canvas A4 murni */
          html,
          body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Hilangkan padding, margin, border, dan bayangan dari pembungkus luar */
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
            width: 210mm !important;
            height: 297mm !important;
            max-width: 210mm !important;
            max-height: 297mm !important;
          }

          /* Lembar Rapor A4: Tepat 210mm x 297mm, margin 0, tanpa bayangan / border abu-abu */
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
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Modal Konfigurasi Bobot & Pengesahan TTD */}
      <RaporConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        semesterId={semesterId}
        semesterLabel={`${data.semester.tahunAkademik} ${data.semester.periode}`}
        initialConfig={data.config}
        onSuccess={() => {
          toast.success("Pengesahan & bobot penilaian berhasil diperbarui.");
          router.refresh();
        }}
      />
    </div>
  );
}
