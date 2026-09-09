"use client";
// src/components/monitoring/ImportEdlinkModal.tsx
// Modal Popup Import Laporan Aktivitas Edlink langsung ke kelas yang sedang aktif

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Loader2,
  X,
  FileText,
  Video,
  CheckSquare,
  HelpCircle as QuizIcon,
  Presentation,
  Building,
  Laptop,
  Sparkles,
} from "lucide-react";
import { parseExcelAction, applyExcelImportToKelas } from "@/actions/monitoring";
import { ParsedExcelResult, ParsedSesiData } from "@/lib/excel-parser";

interface ImportEdlinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetKelas: {
    id: string;
    kodeKelas: string;
    modePembelajaran: "DARING" | "LURING";
    mataKuliah: {
      nama: string;
      kode: string;
      sks: number;
      prodi: { nama: string };
    };
    dosen: {
      nama: string;
      nidn: string | null;
    };
  };
  onSuccessApply: (parsedSesi: ParsedSesiData[]) => void;
}

export default function ImportEdlinkModal({
  isOpen,
  onClose,
  targetKelas,
  onSuccessApply,
}: ImportEdlinkModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedExcelResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setParsedResult(null);
      setApplying(false);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !applying) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, applying, onClose]);

  if (!isOpen) return null;

  async function handleFileSelect(selectedFile: File) {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Format file harus berupa Excel (.xlsx atau .xls)");
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setParsedResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await parseExcelAction(formData);
      if (!res.success) {
        toast.error(res.error || "Gagal memproses file Excel Edlink");
      } else {
        toast.success("File Excel Edlink berhasil dianalisis!");
        setParsedResult(res.data!);
      }
    } catch {
      toast.error("Terjadi kesalahan saat memproses file Excel");
    } finally {
      setParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  function handleApply() {
    if (!parsedResult || !targetKelas) {
      toast.error("Data hasil analisis Excel belum siap");
      return;
    }

    onSuccessApply(parsedResult.sesiData);
    toast.success(
      `Data komponen 3 pilar [${targetKelas.kodeKelas}] berhasil diterapkan ke matriks! Silakan periksa dan klik "Simpan Perubahan" di atas untuk menyimpan ke server.`
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl lg:max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#fdf2f8] border border-[#fbcfe8] flex items-center justify-center text-[#a80063] shadow-xs">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Import Laporan Aktivitas Edlink (.xlsx)
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <span className="inline-flex px-1.5 py-0.2 rounded bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-[10px] font-extrabold">
                  {targetKelas.kodeKelas}
                </span>
                <span className="text-xs text-slate-700 font-semibold">
                  {targetKelas.mataKuliah.nama}
                </span>
                <span className="text-[10px] text-slate-400">• {targetKelas.dosen.nama}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            title="Tutup (ESC)"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Modal Body (Scrollable) ────────────────────────────────────────── */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {/* Upload Zone */}
          {!parsedResult ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragOver
                  ? "border-[#a80063] bg-[#fdf2f8]/60 scale-[0.99]"
                  : "border-slate-300 hover:border-[#a80063] hover:bg-slate-50/80"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {parsing ? (
                <div className="flex flex-col items-center justify-center py-5">
                  <Loader2 size={32} className="text-[#a80063] animate-spin mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    Memproses file Excel Edlink...
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Menganalisis 16 sesi dan 6 komponen pilar pembelajaran
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-2.5 shadow-xs">
                    <UploadCloud size={22} />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Tarik & Lepaskan file Excel Edlink ke sini, atau <span className="text-[#a80063] underline">Pilih File</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-md">
                    Gunakan file ekspor <strong>Laporan Aktivitas</strong> dari Edlink.id (.xlsx / .xls)
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Parsed File Overview & 16-Session Matrix Preview */
            <div className="space-y-3">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck size={16} className="text-emerald-700 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-emerald-900 text-xs">{file?.name}</span>
                    <span className="text-[11px] text-emerald-700 ml-2 font-medium">
                      ({parsedResult.sesiData.length} sesi terdeteksi)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsedResult(null);
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:underline shrink-0 ml-2 cursor-pointer"
                >
                  Ganti File
                </button>
              </div>

              {/* Class matching notice if Excel title differs */}
              {parsedResult.mataKuliah &&
                !targetKelas.mataKuliah.nama
                  .toLowerCase()
                  .includes(parsedResult.mataKuliah.toLowerCase().trim()) && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Informasi Kecocokan Matakuliah:</p>
                      <p className="text-[10.5px] mt-0.5 leading-tight text-amber-800">
                        File Excel menyebutkan <strong>&quot;{parsedResult.mataKuliah}&quot; ({parsedResult.kelas})</strong>. Data ini akan langsung diterapkan ke kelas target aktif: <strong>[{targetKelas.kodeKelas}] {targetKelas.mataKuliah.nama}</strong>.
                      </p>
                    </div>
                  </div>
                )}

              {/* 16-Session Preview Matrix */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">
                    Hasil Deteksi 3 Pilar (Sesi 1–16)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Pilar 1 (L/S) • Pilar 2 (T/Q) • Pilar 3 (V/C)
                  </span>
                </div>

                <div className="max-h-[340px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400 z-10 shadow-xs">
                      <tr>
                        <th className="py-2 px-3 text-center w-14">Sesi</th>
                        <th className="py-2 px-3 text-center">Pilar 1: L/S</th>
                        <th className="py-2 px-3 text-center">Pilar 2: T/Q</th>
                        <th className="py-2 px-3 text-center">Pilar 3: V/C</th>
                        <th className="py-2 px-3 text-center w-24">Skor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {parsedResult.sesiData.map((sesi) => {
                        const isExam = sesi.nomorSesi === 8 || sesi.nomorSesi === 16;
                        const pilar1 = sesi.lectureNote || sesi.slide;
                        const pilar2 = sesi.tugas || sesi.kuis;
                        const pilar3 = sesi.video || sesi.conference;
                        const totalPilar = (pilar1 ? 1 : 0) + (pilar2 ? 1 : 0) + (pilar3 ? 1 : 0);

                        return (
                          <tr
                            key={sesi.nomorSesi}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isExam ? "bg-amber-50/40" : ""
                            }`}
                          >
                            <td className="py-1.5 px-3 text-center font-bold text-slate-700">
                              {isExam ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-900 font-extrabold border border-amber-200">
                                  {sesi.nomorSesi === 8 ? "UTS" : "UAS"}
                                </span>
                              ) : (
                                <span className="font-bold text-slate-700 text-[11px]">S{sesi.nomorSesi}</span>
                              )}
                            </td>

                            {isExam ? (
                              <td colSpan={4} className="py-1.5 px-3 text-center text-slate-400 italic text-[10px]">
                                Evaluasi Ujian (Kehadiran Saja)
                              </td>
                            ) : (
                              <>
                                {/* Pilar 1: L/S */}
                                <td className="py-1.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                        sesi.lectureNote
                                          ? "bg-purple-50 text-purple-700 border-purple-200 font-extrabold"
                                          : "bg-slate-50 text-slate-400 border-slate-200/60 font-normal"
                                      }`}
                                    >
                                      LN {sesi.lectureNote ? "✓" : ""}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                        sesi.slide
                                          ? "bg-purple-50 text-purple-700 border-purple-200 font-extrabold"
                                          : "bg-slate-50 text-slate-400 border-slate-200/60 font-normal"
                                      }`}
                                    >
                                      Slide {sesi.slide ? "✓" : ""}
                                    </span>
                                  </div>
                                </td>

                                {/* Pilar 2: T/Q */}
                                <td className="py-1.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                        sesi.tugas
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold"
                                          : "bg-slate-50 text-slate-400 border-slate-200/60 font-normal"
                                      }`}
                                    >
                                      Tugas {sesi.tugas ? "✓" : ""}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                        sesi.kuis
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold"
                                          : "bg-slate-50 text-slate-400 border-slate-200/60 font-normal"
                                      }`}
                                    >
                                      Kuis {sesi.kuis ? "✓" : ""}
                                    </span>
                                  </div>
                                </td>

                                {/* Pilar 3: V/C */}
                                <td className="py-1.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                        sesi.video
                                          ? "bg-blue-50 text-blue-700 border-blue-200 font-extrabold"
                                          : "bg-slate-50 text-slate-400 border-slate-200/60 font-normal"
                                      }`}
                                    >
                                      Video {sesi.video ? "✓" : ""}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                        sesi.conference
                                          ? "bg-blue-50 text-blue-700 border-blue-200 font-extrabold"
                                          : "bg-slate-50 text-slate-400 border-slate-200/60 font-normal"
                                      }`}
                                    >
                                      Conf {sesi.conference ? "✓" : ""}
                                    </span>
                                  </div>
                                </td>

                                {/* Skor */}
                                <td className="py-1.5 px-3 text-center font-bold">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      totalPilar === 3
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : totalPilar === 2
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : totalPilar === 1
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-slate-50 text-slate-400 border-slate-200/60"
                                    }`}
                                  >
                                    {totalPilar}/3 Poin
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!parsedResult}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg text-white transition-all shadow-xs cursor-pointer ${
              !parsedResult
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-[#a80063] hover:bg-[#8e0054] shadow-md shadow-[#a80063]/25 active:scale-95"
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Terapkan ke Matriks Monitoring</span>
          </button>
        </div>
      </div>
    </div>
  );
}
