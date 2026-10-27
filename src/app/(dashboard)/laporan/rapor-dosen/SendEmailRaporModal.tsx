"use client";
// src/app/(dashboard)/laporan/rapor-dosen/SendEmailRaporModal.tsx
// Modal Konfirmasi Pengiriman Lembar Evaluasi & Rapor Mutu Tridharma Dosen via Email
// Resmi Quality Assurance Unit (QAU) Universitas Nusa Putra

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

interface SendEmailRaporModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: RaporDosenListItem | null;
  semesterId: string;
}

export default function SendEmailRaporModal({
  isOpen,
  onClose,
  item,
  semesterId,
}: SendEmailRaporModalProps) {
  const [detailData, setDetailData] = useState<RaporDosenDetailData | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusStep, setStatusStep] = useState<string>("");

  const hiddenRenderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && item) {
      setIsLoadingDetail(true);
      getRaporDosenDetail(item.dosenId, semesterId)
        .then((res) => {
          if (res.success && res.data) {
            setDetailData(res.data);
          } else {
            toast.error(res.error || "Gagal memuat detail rapor dosen.");
          }
        })
        .catch((err) => {
          console.error("Gagal getRaporDosenDetail:", err);
          toast.error("Terjadi kesalahan memuat detail rapor.");
        })
        .finally(() => {
          setIsLoadingDetail(false);
        });
    } else {
      setDetailData(null);
      setIsSending(false);
      setStatusStep("");
    }
  }, [isOpen, item, semesterId]);

  if (!isOpen || !item) return null;

  // Nama file PDF lampiran resmi
  const pdfFilename = formatRaporPdfFilename(
    item.dosenNama,
    detailData?.semester.tahunAkademik || "2026/2027",
    detailData?.semester.periode || "Ganjil",
    true
  );

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
            }
          })
      )
    );
  };

  const handleSendEmail = async () => {
    if (!item.email) {
      toast.error("Email dosen belum diisi pada Data Dosen.");
      return;
    }

    if (!hiddenRenderRef.current) {
      toast.error("Lembar rapor belum siap di-generate. Silakan coba sesaat lagi.");
      return;
    }

    try {
      setIsSending(true);
      setStatusStep("Menyiapkan berkas PDF Ultra HD...");

      // Tunggu reflow browser agar layout stabil
      await new Promise((r) => setTimeout(r, 200));

      // Tunggu seluruh logo, watermark, dan ttd selesai di-load sempurna
      await waitForImagesToLoad(hiddenRenderRef.current);
      await new Promise((r) => setTimeout(r, 100));

      // Render HTML A4 ke JPEG Base64 resolusi Ultra HD (identik 100% dengan Alur Download Masal)
      const imgData = await toJpeg(hiddenRenderRef.current, {
        quality: 0.95,
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
        skipFonts: true,
        cacheBust: false,
      });

      setStatusStep("Mengompresi PDF A4 Ultra HD...");

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");

      const dataUri = pdf.output("datauristring");
      const pdfBase64 = dataUri.split(",")[1];

      setStatusStep(`Mengirim email ke ${item.email}...`);

      const res = await sendRaporDosenEmailAction({
        dosenId: item.dosenId,
        semesterId,
        pdfBase64,
        pdfFilename,
      });

      if (res.success) {
        toast.success(res.message || `Email berhasil dikirim ke ${item.email}!`);
        onClose();
      } else {
        toast.error(res.error || "Gagal mengirim email.");
      }
    } catch (err: any) {
      console.error("Error handleSendEmail:", err);
      toast.error(err?.message || "Terjadi kesalahan sistem saat mengirim email.");
    } finally {
      setIsSending(false);
      setStatusStep("");
    }
  };

  return (
    <>
      {/* ── HIDDEN ZERO-SIZE RENDER CONTAINER (100% INVISIBLE TO USER, TETAP ULTRA HD) ── */}
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
          {detailData && <RaporSheetA4 data={detailData} />}
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
            onClick={onClose}
            disabled={isSending}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30"
            title="Tutup (ESC)"
          >
            <X size={18} />
          </button>

          {/* Header Standar CDU Portal */}
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Mail size={16} className="text-[#a80063]" />
            <span>Kirim Rapor Dosen via Email</span>
          </h3>
          <p className="text-xs text-slate-500 font-normal mb-4">
            Semester {detailData?.semester.tahunAkademik || "2026/2027"} ({detailData?.semester.periode || "Ganjil"})
          </p>

          {/* Card Informasi Penerima & Lampiran */}
          <div className="space-y-3">
            {/* Info Dosen Penerima */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Dosen Penerima
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {item.nip ? `NIP. ${item.nip}` : item.nidn ? `NIDN. ${item.nidn}` : "-"}
                </span>
              </div>
              <p className="font-semibold text-slate-900 text-md leading-tight">{item.dosenNama}</p>
              <p className="text-[11px] text-slate-500">Program Studi {item.prodiNama} &bull; Universitas Nusa Putra</p>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Alamat Email Tujuan:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900">{item.email}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 size={10} />
                    <span>Terdaftar</span>
                  </span>
                </div>
              </div>
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
                  {pdfFilename}
                </p>
              </div>
            </div>

            {/* Keterangan Singkat */}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Email ini akan dikirimkan secara resmi dari <strong>Quality Assurance Unit (QAU)</strong> dengan template resmi dan profesional.
            </p>
          </div>

          {/* Footer Actions Standar CDU */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Batal
            </button>

            <button
              type="button"
              id="btn-confirm-send-email"
              onClick={handleSendEmail}
              disabled={isSending || isLoadingDetail || !detailData}
              className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>{statusStep || "Mengirim Email..."}</span>
                </>
              ) : isLoadingDetail ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Menyiapkan Dokumen...</span>
                </>
              ) : (
                <>
                  <Mail size={13} />
                  <span>Kirim Email Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
