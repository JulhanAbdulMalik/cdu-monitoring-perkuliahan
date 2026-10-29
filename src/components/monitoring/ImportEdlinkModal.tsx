"use client";
// src/components/monitoring/ImportEdlinkModal.tsx
// Modal Popup Import Laporan Aktivitas Edlink langsung ke kelas yang sedang aktif

import React, { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Loader2,
  X,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { parseExcelAction } from "@/actions/monitoring";
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

  function handleClose() {
    if (applying) return;
    setFile(null);
    setParsedResult(null);
    setApplying(false);
    onClose();
  }

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !applying) {
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, applying]);

  // Statistik ringkasan 3 pilar (dihitung aman sebelum if (!isOpen) return null)
  const sessionStats = useMemo(() => {
    if (!parsedResult?.sesiData) {
      return { total: 0, lengkap: 0, parsial: 0, kosong: 0, ujian: 0 };
    }
    let lengkap = 0;
    let parsial = 0;
    let kosong = 0;
    let ujian = 0;

    parsedResult.sesiData.forEach((sesi) => {
      if (sesi.nomorSesi === 8 || sesi.nomorSesi === 16) {
        ujian++;
      } else {
        const p1 = sesi.lectureNote || sesi.slide;
        const p2 = sesi.tugas || sesi.kuis;
        const p3 = sesi.video || sesi.conference;
        const count = (p1 ? 1 : 0) + (p2 ? 1 : 0) + (p3 ? 1 : 0);
        if (count === 3) lengkap++;
        else if (count > 0) parsial++;
        else kosong++;
      }
    });

    return {
      total: parsedResult.sesiData.length,
      lengkap,
      parsial,
      kosong,
      ujian,
    };
  }, [parsedResult]);

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
    handleClose();
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !applying) handleClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div
        className={`w-full bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[94vh] flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          parsedResult ? "max-w-5xl lg:max-w-6xl xl:max-w-7xl" : "max-w-xl"
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          disabled={applying}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30 transition-colors"
          title="Tutup (ESC)"
        >
          <X size={18} />
        </button>

        {/* Modal Header Standar CDU Portal */}
        <div className="mb-4 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-[#a80063]" />
            <span>Import Aktivitas Perkuliahan (Edlink)</span>
          </h3>
          <p className="text-xs text-slate-500 font-normal">
            Komponen 3 Pilar Pembelajaran &bull; [{targetKelas.kodeKelas}] {targetKelas.mataKuliah.nama} ({targetKelas.dosen.nama})
          </p>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {!parsedResult ? (
            /* TAMPILAN FORM UPLOAD (CLEAN & DIRECT) */
            <div className="space-y-3">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !parsing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  parsing
                    ? "border-slate-300 bg-slate-50 cursor-wait"
                    : isDragOver
                    ? "border-[#a80063] bg-[#fdf2f8]/60 cursor-pointer"
                    : "border-slate-300 hover:border-[#a80063]/50 hover:bg-slate-50/60 cursor-pointer"
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
                  disabled={parsing}
                />

                {parsing ? (
                  <div className="py-4 flex flex-col items-center justify-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-[#a80063]" />
                    <p className="text-xs font-bold text-slate-800">
                      Memproses berkas Excel Edlink...
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Menganalisis 16 sesi perkuliahan dan komponen 3 pilar pembelajaran.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-xl bg-[#fdf2f8] text-[#a80063] flex items-center justify-center mx-auto mb-3">
                      <UploadCloud size={22} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        Pilih atau Seret Berkas Rekap Edlink ke Sini
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Format berkas <strong>.xlsx</strong> atau <strong>.xls</strong> dari laporan aktivitas Edlink.id
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Info Ekstraksi Ringkas */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500">
                <Sparkles size={13} className="text-[#a80063] shrink-0" />
                <span>
                  Otomatis mengekstrak 3 pilar sesi 1–16: Bahan Ajar (Slide/LN), Penugasan (Tugas/Kuis), dan Interaksi (Video/Conference).
                </span>
              </div>
            </div>
          ) : (
            /* TAMPILAN PRATINJAU 16 SESI (LEGA & INFORMATIF) */
            <div className="space-y-3.5 animate-fade-in">
              {/* Baris Kontrol: Info Berkas & Badges Status Compact */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck size={16} className="text-[#a80063] shrink-0" />
                  <span className="text-xs text-slate-700 truncate">
                    Berkas: <strong className="text-slate-900 font-semibold">{file?.name}</strong>
                  </span>
                  {parsedResult.mataKuliah && (
                    <span className="hidden md:inline-block text-[11px] text-slate-500 truncate">
                      ({parsedResult.mataKuliah} - {parsedResult.kelas})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    <span>Total: <strong>{sessionStats.total} Sesi</strong></span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 shadow-2xs">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>Lengkap (3/3): <strong>{sessionStats.lengkap}</strong></span>
                  </div>
                  {sessionStats.parsial > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 shadow-2xs">
                      <span>Parsial: <strong>{sessionStats.parsial}</strong></span>
                    </div>
                  )}
                  {sessionStats.ujian > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 shadow-2xs">
                      <span>Ujian: <strong>{sessionStats.ujian}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Alert Peringatan Ketidakcocokan Kelas (Jika Ada) */}
              {parsedResult.mataKuliah &&
                !targetKelas.mataKuliah.nama
                  .toLowerCase()
                  .includes(parsedResult.mataKuliah.toLowerCase().trim()) && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-snug">
                      <strong>Informasi Kelas:</strong> Berkas Excel menyebutkan <strong>&quot;{parsedResult.mataKuliah}&quot; ({parsedResult.kelas})</strong>. Data ini akan langsung diterapkan ke kelas target aktif: <strong>[{targetKelas.kodeKelas}] {targetKelas.mataKuliah.nama}</strong>.
                    </p>
                  </div>
                )}

              {/* Tabel Matriks 16 Sesi */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="max-h-[55vh] lg:max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 z-10 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-16">Sesi</th>
                        <th className="py-2.5 px-4 text-center">Pilar 1: Bahan Ajar</th>
                        <th className="py-2.5 px-4 text-center">Pilar 2: Penugasan</th>
                        <th className="py-2.5 px-4 text-center">Pilar 3: Tatap Muka</th>
                        <th className="py-2.5 px-4 text-center w-36">Kelengkapan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
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
                              isExam ? "bg-amber-50/30" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                              {isExam ? (
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-amber-100 text-amber-900 font-extrabold border border-amber-300">
                                  {sesi.nomorSesi === 8 ? "UTS" : "UAS"}
                                </span>
                              ) : (
                                <span className="font-bold text-slate-700 text-xs">Sesi {sesi.nomorSesi}</span>
                              )}
                            </td>

                            {isExam ? (
                              <td colSpan={4} className="py-2.5 px-4 text-center text-slate-400 italic text-[11px]">
                                Evaluasi Ujian Semester &bull; Penilaian Kehadiran Mahasiswa
                              </td>
                            ) : (
                              <>
                                {/* Pilar 1: Bahan Ajar */}
                                <td className="py-2.5 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                        sesi.lectureNote
                                          ? "bg-purple-50 text-purple-700 border-purple-200"
                                          : "bg-slate-50 text-slate-400 border-slate-200"
                                      }`}
                                    >
                                      LN {sesi.lectureNote ? "✓" : "-"}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                        sesi.slide
                                          ? "bg-purple-50 text-purple-700 border-purple-200"
                                          : "bg-slate-50 text-slate-400 border-slate-200"
                                      }`}
                                    >
                                      Slide {sesi.slide ? "✓" : "-"}
                                    </span>
                                  </div>
                                </td>

                                {/* Pilar 2: Penugasan */}
                                <td className="py-2.5 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                        sesi.tugas
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : "bg-slate-50 text-slate-400 border-slate-200"
                                      }`}
                                    >
                                      Tugas {sesi.tugas ? "✓" : "-"}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                        sesi.kuis
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : "bg-slate-50 text-slate-400 border-slate-200"
                                      }`}
                                    >
                                      Kuis {sesi.kuis ? "✓" : "-"}
                                    </span>
                                  </div>
                                </td>

                                {/* Pilar 3: Tatap Muka */}
                                <td className="py-2.5 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                        sesi.video
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-slate-50 text-slate-400 border-slate-200"
                                      }`}
                                    >
                                      Video {sesi.video ? "✓" : "-"}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                        sesi.conference
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-slate-50 text-slate-400 border-slate-200"
                                      }`}
                                    >
                                      Conf {sesi.conference ? "✓" : "-"}
                                    </span>
                                  </div>
                                </td>

                                {/* Kelengkapan */}
                                <td className="py-2.5 px-4 text-center font-bold">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                      totalPilar === 3
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                        : totalPilar === 2
                                        ? "bg-blue-100 text-blue-800 border-blue-200"
                                        : totalPilar === 1
                                        ? "bg-amber-100 text-amber-800 border-amber-200"
                                        : "bg-slate-100 text-slate-500 border-slate-200"
                                    }`}
                                  >
                                    {totalPilar === 3 && <CheckCircle2 size={11} />}
                                    <span>{totalPilar}/3 Pilar</span>
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

              {/* Catatan Kaki Standar */}
              <p className="text-[11px] text-amber-700 italic pt-1">
                * Catatan: Data komponen 3 pilar di atas akan diterapkan ke matriks sesi kelas [{targetKelas.kodeKelas}]. Klik &ldquo;Simpan Perubahan&rdquo; pada lembar kerja untuk menyimpan permanen ke basis data.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4 shrink-0">
          {parsedResult ? (
            /* State: Sedang Preview (Belum Diterapkan) */
            <>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setParsedResult(null);
                }}
                disabled={applying}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                <RotateCcw size={12} />
                <span>Batal / Ganti Berkas</span>
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={13} />
                <span>Terapkan ke Matriks</span>
              </button>
            </>
          ) : (
            /* State: Belum Diproses */
            <button
              type="button"
              onClick={handleClose}
              disabled={parsing}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Batal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
