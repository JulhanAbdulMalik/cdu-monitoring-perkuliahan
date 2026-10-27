"use client";
// src/app/(dashboard)/laporan/rapor-dosen/BatchDownloadModal.tsx
// Modal Ekspor & Download PDF Lembar Rapor Dosen Terpadu (Presisi A4, Ukuran Ringkas ~350KB & HD)
// Format Modal Konfirmasi Simple & Clean sesuai Standar Presensi Masal CDU Portal

import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import { toJpeg } from "html-to-image";
import JSZip from "jszip";
import {
  FileDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Archive,
} from "lucide-react";
import RaporSheetA4 from "@/components/rapor/RaporSheetA4";
import { getBatchRaporDosenDetails, RaporDosenDetailData } from "@/actions/rapor";
import { formatRaporPdfFilename, formatRaporZipFilename } from "@/lib/rapor-calculator";

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  dosenIds: string[];
  semesterId: string;
  semesterLabel?: string;
  tahunAkademik?: string;
  periode?: string;
  onSuccess?: () => void;
}

export default function BatchDownloadModal({
  isOpen,
  onClose,
  dosenIds,
  semesterId,
  semesterLabel,
  tahunAkademik,
  periode,
  onSuccess,
}: BatchDownloadModalProps) {
  // Modal Stages:
  // - "CONFIRM": Modal Kecil Konfirmasi (Simple & Clean standar CDU)
  // - "FETCHING": Mengambil detail dari database
  // - "RENDERING": Membuat PDF HD Ringkas (~350KB)
  // - "ZIPPING": Mengompresi ke ZIP (> 3 dosen)
  // - "DONE": Berhasil selesai
  // - "ERROR": Terjadi error
  const [phase, setPhase] = useState<
    "CONFIRM" | "FETCHING" | "RENDERING" | "ZIPPING" | "DONE" | "ERROR"
  >("CONFIRM");

  const [progressPercent, setProgressPercent] = useState(0);
  const [currentDosenIndex, setCurrentDosenIndex] = useState(0);
  const [currentDosenName, setCurrentDosenName] = useState("");
  const [statusText, setStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<RaporDosenDetailData | null>(null);

  const renderContainerRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef<boolean>(false);

  const totalDosen = dosenIds.length;
  const isZipMode = totalDosen > 3;

  useEffect(() => {
    if (isOpen && dosenIds.length > 0) {
      isCancelledRef.current = false;
      setPhase("CONFIRM");
      setProgressPercent(0);
      setCurrentDosenIndex(0);
      setCurrentDosenName("");
      setStatusText("");
      setErrorMessage(null);
      setActiveItem(null);
    } else {
      setPhase("CONFIRM");
      setProgressPercent(0);
      setCurrentDosenIndex(0);
      setCurrentDosenName("");
      setStatusText("");
      setErrorMessage(null);
      setActiveItem(null);
    }
  }, [isOpen, dosenIds, semesterId]);

  // Helper pemicu download file di browser
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  };

  // Helper menunggu seluruh gambar (logo, watermark, ttd) selesai dimuat browser
  const waitForImagesToLoad = async (element: HTMLElement) => {
    const images = Array.from(element.querySelectorAll("img"));
    if (images.length === 0) return;

    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalHeight !== 0) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(resolve, 1500);
            }
          })
      )
    );
  };

  const startDownloadProcess = async () => {
    try {
      setPhase("FETCHING");
      setStatusText("Mengambil data evaluasi dosen...");
      setProgressPercent(10);
      setErrorMessage(null);

      const res = await getBatchRaporDosenDetails(dosenIds, semesterId);
      if (!res.success || !res.data || res.data.length === 0) {
        throw new Error(res.error || "Gagal memuat data rapor dosen terpilih.");
      }

      if (isCancelledRef.current) return;

      const items = res.data;
      const total = items.length;
      const zip = isZipMode ? new JSZip() : null;

      setPhase("RENDERING");
      setStatusText(`Menyiapkan lembar rapor (${total} dosen)...`);

      // Loop rendering setiap dosen ke Canvas HD Seimbang (~350KB per PDF)
      for (let i = 0; i < total; i++) {
        if (isCancelledRef.current) return;

        const item = items[i];
        setCurrentDosenIndex(i + 1);
        setCurrentDosenName(item.dosen.nama);
        setStatusText(`Membuat PDF HD: ${item.dosen.nama} (${i + 1} dari ${total})...`);

        // Update progress bar
        const currentProgress = 15 + Math.round(((i + 1) / total) * 70);
        setProgressPercent(currentProgress);

        // Mount item ke container rendering
        setActiveItem(item);

        // Tunggu reflow
        await new Promise((r) => setTimeout(r, 180));

        if (!renderContainerRef.current) {
          throw new Error("Container render A4 tidak ditemukan");
        }

        // Tunggu logo dan ttd selesai di-load
        await waitForImagesToLoad(renderContainerRef.current);
        await new Promise((r) => setTimeout(r, 80));

        // Render HTML A4 ke JPEG Base64 resolusi tajam seimbang (pixelRatio 2.2, quality 0.93)
        // Menghasilkan ukuran file ringkas ~300-380KB dengan visual teks dan logo yang sangat tajam
        const imgData = await toJpeg(renderContainerRef.current, {
          quality: 0.93,
          pixelRatio: 2.2,
          backgroundColor: "#ffffff",
          skipFonts: true, // Mencegah SecurityError pada stylesheet eksternal
          cacheBust: false,
        });

        // Buat PDF A4 portrait (210mm x 297mm)
        const pdf = new jsPDF({
          orientation: "p",
          unit: "mm",
          format: "a4",
          compress: true,
        });
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");

        // Format nama file resmi: 'Rapor Dosen - [NamaDosen] ([TahunAkademik] [Periode]).pdf'
        const filename = formatRaporPdfFilename(
          item.dosen.nama,
          item.semester.tahunAkademik,
          item.semester.periode,
          true
        );

        if (isZipMode && zip) {
          // Mode ZIP (> 3 Dosen): Masukkan ke arsip zip
          const arrayBuffer = pdf.output("arraybuffer");
          zip.file(filename, arrayBuffer);
        } else {
          // Mode Langsung (1 - 3 Dosen): Download file PDF terpisah
          const blob = pdf.output("blob");
          triggerDownload(blob, filename);

          // Jeda 500ms agar browser tidak memblokir download berturut-turut
          if (i < total - 1) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }

      // Jika mode ZIP, generate dan unduh file ZIP
      if (isZipMode && zip) {
        setPhase("ZIPPING");
        setStatusText("Membundel seluruh file PDF ke arsip ZIP...");
        setProgressPercent(95);

        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });

        const activeTahun = tahunAkademik || items[0].semester.tahunAkademik;
        const activePeriode = periode || items[0].semester.periode;
        const zipFilename = formatRaporZipFilename(activeTahun, activePeriode, true);

        triggerDownload(zipBlob, zipFilename);
      }

      // Selesai
      setPhase("DONE");
      setProgressPercent(100);
      setStatusText(
        isZipMode
          ? `Selesai! Arsip ZIP berhasil diunduh.`
          : `Selesai! ${total} file PDF berhasil diunduh.`
      );

      // Auto close setelah 1.8 detik
      setTimeout(() => {
        if (!isCancelledRef.current) {
          if (onSuccess) onSuccess();
          onClose();
        }
      }, 1800);
    } catch (err: any) {
      console.error("Error in startDownloadProcess:", err);
      setPhase("ERROR");
      setErrorMessage(err.message || "Terjadi kesalahan saat membuat file PDF.");
    } finally {
      setActiveItem(null);
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ── HIDDEN OFFSCREEN A4 RENDER CONTAINER ──────────────────────────────── */}
      <div
        ref={renderContainerRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "210mm",
          minHeight: "297mm",
          maxHeight: "297mm",
          backgroundColor: "#ffffff",
          zIndex: -9999,
          pointerEvents: "none",
          overflow: "hidden",
          margin: 0,
          padding: 0,
        }}
        aria-hidden="true"
      >
        {activeItem && <RaporSheetA4 data={activeItem} />}
      </div>

      {/* ── MODAL DIALOG POPUP (STANDAR PRESENSI MASAL CDU PORTAL) ──────────── */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget && (phase === "CONFIRM" || phase === "DONE" || phase === "ERROR")) {
            onClose();
          }
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-sm w-full p-5 space-y-4">
          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1: MODAL KECIL KONFIRMASI DOWNLOAD (SIMPLE & CLEAN)
          ═══════════════════════════════════════════════════════════════════ */}
          {phase === "CONFIRM" && (
            <>
              {/* Header: Icon Box + Title + Subtitle */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]">
                  {isZipMode ? <Archive size={20} /> : <FileDown size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Konfirmasi Unduh Rapor
                  </h3>
                  <p className="text-xs text-slate-500">
                    {semesterLabel || "Semester Aktif"} &bull; {totalDosen} Dosen
                  </p>
                </div>
              </div>

              {/* Deskripsi Pertanyaan Standar CDU Portal */}
              <p className="text-xs text-slate-600 leading-relaxed">
                {isZipMode ? (
                  <>
                    Apakah Anda yakin ingin mengunduh lembar evaluasi untuk{" "}
                    <strong className="text-slate-900 font-bold">{totalDosen} dosen</strong> terpilih dalam format{" "}
                    <span className="font-bold px-1.5 py-0.5 rounded text-[11px] bg-purple-100 text-purple-800">
                      Arsip ZIP ({totalDosen} PDF)
                    </span>
                    ?
                  </>
                ) : (
                  <>
                    Apakah Anda yakin ingin mengunduh lembar evaluasi untuk{" "}
                    <strong className="text-slate-900 font-bold">{totalDosen} dosen</strong> terpilih secara{" "}
                    <span className="font-bold px-1.5 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800">
                      Terpisah ({totalDosen} PDF)
                    </span>
                    ?
                  </>
                )}
              </p>

              {/* Action Buttons: Batal & Unduh */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  id="btn-confirm-start-download"
                  onClick={startDownloadProcess}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-xs cursor-pointer active:scale-95 bg-[#a80063] hover:bg-[#8c0052] shadow-[#a80063]/20"
                >
                  Unduh
                </button>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 2: PROGRESS MODAL & STATUS UNDUH (COMPACT & CLEAN)
          ═══════════════════════════════════════════════════════════════════ */}
          {phase !== "CONFIRM" && (
            <>
              {/* Header: Icon Box + Title + Subtitle */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    phase === "DONE"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : phase === "ERROR"
                      ? "bg-rose-50 text-rose-600 border border-rose-200"
                      : "bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]"
                  }`}
                >
                  {phase === "DONE" ? (
                    <CheckCircle2 size={22} />
                  ) : phase === "ERROR" ? (
                    <AlertCircle size={22} />
                  ) : (
                    <Loader2 size={22} className="animate-spin text-[#a80063]" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {phase === "DONE"
                      ? "Unduhan Selesai"
                      : phase === "ERROR"
                      ? "Gagal Mengunduh"
                      : "Mengunduh Rapor Dosen"}
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-[220px]">
                    {phase === "DONE"
                      ? `${totalDosen} file siap digunakan`
                      : phase === "ERROR"
                      ? "Terjadi kendala sistem"
                      : currentDosenName || `Dosen ${currentDosenIndex} dari ${totalDosen}`}
                  </p>
                </div>
              </div>

              {/* Progress Bar & Status */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium text-[11.5px] truncate max-w-[240px]">
                    {statusText}
                  </span>
                  <span className="font-mono font-bold text-[#a80063] text-[11px]">
                    {progressPercent}%
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      phase === "ERROR"
                        ? "bg-rose-500"
                        : phase === "DONE"
                        ? "bg-emerald-500"
                        : "bg-[#a80063]"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                  <p className="leading-snug">{errorMessage}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                {phase !== "DONE" && phase !== "ERROR" ? (
                  <button
                    id="btn-cancel-batch-modal"
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    Batal
                  </button>
                ) : (
                  <button
                    id="btn-close-batch-modal"
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-xs cursor-pointer active:scale-95 bg-[#a80063] hover:bg-[#8c0052] shadow-[#a80063]/20"
                  >
                    Tutup
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
