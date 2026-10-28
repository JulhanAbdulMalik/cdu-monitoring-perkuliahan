"use client";
// src/app/(dashboard)/laporan/rapor-dosen/BatchSendEmailModal.tsx
// Modal Pengiriman Lembar Evaluasi & Rapor Mutu Tridharma Dosen Masal via Email
// Tampilan Standar CDU Portal Simple & Clean (100% Identik dengan SendEmailRaporModal)
// Resmi Quality Assurance Unit (QAU) & CDU Universitas Nusa Putra

import React, { useState, useEffect, useRef } from "react";
import { Mail, Loader2, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import RaporSheetA4 from "@/components/rapor/RaporSheetA4";
import {
  RaporDosenListItem,
  RaporDosenDetailData,
  getRaporDosenDetail,
  sendRaporDosenEmailAction,
} from "@/actions/rapor";
import { formatRaporPdfFilename } from "@/lib/rapor-calculator";

interface BatchSendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: RaporDosenListItem[];
  semesterId: string;
  semesterLabel?: string;
  onSuccess?: () => void;
}

type ItemSendStatus = "WAITING" | "RENDERING" | "SENDING" | "SUCCESS" | "FAILED" | "SKIPPED_NO_EMAIL";

interface ItemProgress {
  dosenId: string;
  dosenNama: string;
  email: string | null;
  prodiNama: string;
  status: ItemSendStatus;
  errorMessage?: string;
}

export default function BatchSendEmailModal({
  isOpen,
  onClose,
  selectedItems,
  semesterId,
  semesterLabel,
  onSuccess,
}: BatchSendEmailModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [statusStep, setStatusStep] = useState<string>("");
  const [itemsProgress, setItemsProgress] = useState<ItemProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [activeRenderItem, setActiveRenderItem] = useState<RaporDosenDetailData | null>(null);

  const hiddenRenderRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSending(false);
      setIsDone(false);
      setStatusStep("");
      setItemsProgress([]);
      setCurrentIndex(0);
      setActiveRenderItem(null);
      return;
    }

    // Jika sedang dalam proses pengiriman atau sudah selesai, jangan reset antrean
    if (isSending || isDone) return;

    if (selectedItems.length > 0) {
      isCancelledRef.current = false;
      setIsSending(false);
      setIsDone(false);
      setStatusStep("");
      setCurrentIndex(0);
      setActiveRenderItem(null);

      const initialList: ItemProgress[] = selectedItems.map((item) => ({
        dosenId: item.dosenId,
        dosenNama: item.dosenNama,
        email: item.email || null,
        prodiNama: item.prodiNama,
        status: !item.email ? "SKIPPED_NO_EMAIL" : "WAITING",
      }));
      setItemsProgress(initialList);
    }
  }, [isOpen, selectedItems, isSending, isDone]);

  if (!isOpen) return null;

  const validEmailCount = itemsProgress.filter((i) => i.email).length;
  const skippedCount = itemsProgress.filter((i) => !i.email).length;

  const processedCount = itemsProgress.filter((i) =>
    ["SUCCESS", "FAILED", "SKIPPED_NO_EMAIL"].includes(i.status)
  ).length;

  const progressPercent =
    itemsProgress.length > 0
      ? Math.round((processedCount / itemsProgress.length) * 100)
      : 0;

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

  const handleStartSending = async () => {
    if (validEmailCount === 0) {
      toast.error("Tidak ada dosen dengan email terdaftar pada pilihan ini.");
      return;
    }

    setIsSending(true);
    setIsDone(false);
    isCancelledRef.current = false;

    let processedValid = 0;

    for (let i = 0; i < itemsProgress.length; i++) {
      if (isCancelledRef.current) break;

      const current = itemsProgress[i];
      if (!current.email) {
        continue;
      }

      processedValid += 1;
      setCurrentIndex(processedValid);

      // Status: Render PDF
      setItemsProgress((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "RENDERING" } : item
        )
      );
      setStatusStep(`Menyiapkan lembar evaluasi: ${current.dosenNama}...`);

      try {
        // 1. Fetch detail data rapor dosen
        const detailRes = await getRaporDosenDetail(current.dosenId, semesterId);
        if (!detailRes.success || !detailRes.data) {
          throw new Error(detailRes.error || "Gagal memuat detail data rapor.");
        }

        const detailData = detailRes.data;
        setActiveRenderItem(detailData);

        // Tunggu reflow browser agar layout stabil
        await new Promise((r) => setTimeout(r, 200));

        // Tunggu seluruh logo, watermark, dan ttd selesai di-load sempurna
        if (hiddenRenderRef.current) {
          await waitForImagesToLoad(hiddenRenderRef.current);
          await new Promise((r) => setTimeout(r, 100));
        }

        if (isCancelledRef.current) break;

        if (!hiddenRenderRef.current) {
          throw new Error("Container render belum siap.");
        }

        // 2. Render HTML A4 ke JPEG Base64 resolusi Ultra HD
        const imgData = await toJpeg(hiddenRenderRef.current, {
          quality: 0.93,
          pixelRatio: 2.2,
          backgroundColor: "#ffffff",
          skipFonts: true,
          cacheBust: false,
        });

        // 3. Konversi ke PDF A4 Portrait
        const pdf = new jsPDF({
          orientation: "p",
          unit: "mm",
          format: "a4",
          compress: true,
        });
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");

        const dataUri = pdf.output("datauristring");
        const pdfBase64 = dataUri.split(",")[1];
        const pdfFilename = formatRaporPdfFilename(
          detailData.dosen.nama,
          detailData.semester.tahunAkademik,
          detailData.semester.periode,
          true
        );

        if (isCancelledRef.current) break;

        // Status: Mengirim email via SMTP
        setItemsProgress((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "SENDING" } : item
          )
        );
        setStatusStep(`Mengirimkan email ke ${current.email}...`);

        // 4. Panggil server action pengiriman email
        const sendRes = await sendRaporDosenEmailAction({
          dosenId: current.dosenId,
          semesterId,
          pdfBase64,
          pdfFilename,
        });

        if (sendRes.success) {
          setItemsProgress((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: "SUCCESS" } : item
            )
          );
        } else {
          setItemsProgress((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    status: "FAILED",
                    errorMessage: sendRes.error || "Gagal mengirim email.",
                  }
                : item
            )
          );
        }

        // Jeda 350ms antar pengiriman agar koneksi SMTP lancar
        await new Promise((r) => setTimeout(r, 350));
      } catch (err: any) {
        console.error(`Error pengiriman email untuk ${current.dosenNama}:`, err);
        setItemsProgress((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "FAILED",
                  errorMessage: err?.message || "Terjadi kesalahan sistem.",
                }
              : item
          )
        );
      }
    }

    setIsSending(false);
    setIsDone(true);
    setStatusStep("Pengiriman email selesai.");
    toast.success("Proses pengiriman email selesai diproses.");

    // Tutup modal secara otomatis setelah selesai
    setTimeout(() => {
      if (!isCancelledRef.current) {
        onClose();
        if (onSuccess) onSuccess();
      }
    }, 1000);
  };

  const handleCancelOrClose = () => {
    if (isSending) {
      if (confirm("Batalkan sisa antrean pengiriman email?")) {
        isCancelledRef.current = true;
        setIsSending(false);
        setIsDone(true);
        setStatusStep("Pengiriman email dibatalkan oleh pengguna.");
      }
    } else {
      onClose();
    }
  };

  return (
    <>
      {/* ── HIDDEN ZERO-SIZE RENDER CONTAINER (OFF-SCREEN ULTRA HD) ── */}
      <div
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -9999,
        }}
        aria-hidden="true"
      >
        <div
          ref={hiddenRenderRef}
          style={{
            width: "210mm",
            minHeight: "297mm",
            maxHeight: "297mm",
            backgroundColor: "#ffffff",
            margin: 0,
            padding: 0,
            boxSizing: "border-box",
          }}
        >
          {activeRenderItem && <RaporSheetA4 data={activeRenderItem} />}
        </div>
      </div>

      {/* ── MODAL DIALOG POPUP STANDAR CDU PORTAL ────────────────────────────── */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSending) {
            onClose();
          }
        }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
      >
        <div className="w-full max-w-xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
          {/* Close Button */}
          <button
            type="button"
            onClick={handleCancelOrClose}
            disabled={isSending && isCancelledRef.current}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30"
            title="Tutup (ESC)"
          >
            <X size={18} />
          </button>

          {/* Header Standar CDU Portal */}
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Mail size={16} className="text-[#a80063]" />
            <span>Kirim Rapor Dosen via Email (Masal)</span>
          </h3>
          <p className="text-xs text-slate-500 font-normal mb-4">
            Semester {semesterLabel || "2026/2027 (Ganjil)"} &bull; {selectedItems.length} Dosen Terpilih
          </p>

          {/* Card Informasi Penerima & Lampiran */}
          <div className="space-y-3">
            {/* Info Dosen Penerima (Masal) */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Daftar Dosen Penerima ({validEmailCount} Siap Dikirim)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {selectedItems.length} Dosen Terpilih
                </span>
              </div>

              {/* Scrollable List of Lecturers */}
              <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
                {itemsProgress.map((item) => (
                  <div
                    key={item.dosenId}
                    className="p-2.5 bg-white rounded-lg border border-slate-200/60 flex items-center justify-between gap-2 text-xs shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 truncate">
                          {item.dosenNama}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {item.prodiNama}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                        {item.email ? (
                          <span className="text-slate-600">{item.email}</span>
                        ) : (
                          <span className="text-rose-500 italic">Email belum diisi</span>
                        )}
                      </div>
                      {item.errorMessage && (
                        <div className="text-[10px] text-rose-600 mt-1 font-semibold flex items-center gap-1">
                          <AlertCircle size={10} className="shrink-0" />
                          <span>{item.errorMessage}</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {item.status === "WAITING" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 size={10} />
                          <span>Siap</span>
                        </span>
                      )}
                      {item.status === "RENDERING" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          <Loader2 size={10} className="animate-spin" />
                          <span>Render PDF</span>
                        </span>
                      )}
                      {item.status === "SENDING" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#a80063] bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                          <Loader2 size={10} className="animate-spin" />
                          <span>Mengirim...</span>
                        </span>
                      )}
                      {item.status === "SUCCESS" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 size={10} />
                          <span>Terkirim</span>
                        </span>
                      )}
                      {item.status === "FAILED" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <AlertCircle size={10} />
                          <span>Gagal</span>
                        </span>
                      )}
                      {item.status === "SKIPPED_NO_EMAIL" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          <span>Dilewati</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {skippedCount > 0 && (
                <p className="text-[10px] text-amber-600 pt-1">
                  * {skippedCount} dosen tanpa email akan dilewati otomatis saat pengiriman.
                </p>
              )}
            </div>

            {/* Dokumen Lampiran PDF */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center gap-3 text-xs">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Lampiran Dokumen PDF Resmi
                </span>
                <p className="font-mono text-[11px] text-slate-800 truncate font-semibold mt-0.5">
                  Lembar Evaluasi &amp; Rapor Mutu Tridharma Dosen (Format Resmi A4)
                </p>
              </div>
            </div>

            {/* Keterangan Singkat */}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Email ini akan dikirimkan secara resmi dari <strong>Quality Assurance Unit (QAU)</strong> dengan template resmi dan profesional.
            </p>

            {/* Progress Bar saat Mengirim / Selesai */}
            {(isSending || isDone) && (
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    {isSending ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-[#a80063]" />
                        <span className="text-[#a80063] font-medium">{statusStep || "Sedang mengirim..."}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">{statusStep || "Pengiriman Selesai"}</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono font-bold text-slate-600">{progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isDone ? "bg-emerald-600" : "bg-[#a80063]"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions Standar CDU */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
            {isDone ? (
              <button
                type="button"
                onClick={onClose}
                className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
              >
                Selesai &amp; Tutup
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCancelOrClose}
                  disabled={isSending && isCancelledRef.current}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isSending ? "Batalkan" : "Batal"}
                </button>

                <button
                  type="button"
                  id="btn-confirm-batch-send-email"
                  onClick={handleStartSending}
                  disabled={isSending || validEmailCount === 0}
                  className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Mengirim ({currentIndex}/{validEmailCount})...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={13} />
                      <span>Kirim Email Sekarang ({validEmailCount})</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
