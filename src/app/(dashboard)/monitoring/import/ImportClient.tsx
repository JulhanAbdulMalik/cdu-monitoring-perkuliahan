"use client";
// src/app/(dashboard)/monitoring/import/ImportClient.tsx
// Excel Edlink Import & Interactive Preview UI (Plus Jakarta Sans & #a80063 Theme)

import { useState, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ArrowRight,
  Loader2,
  Sparkles,
  School,
  FileText,
  Video,
  Presentation,
  CheckSquare,
  HelpCircle as QuizIcon,
  X,
} from "lucide-react";
import { parseExcelAction, applyExcelImportToKelas } from "@/actions/monitoring";
import { ParsedExcelResult, ParsedSesiData } from "@/lib/excel-parser";

interface KelasOption {
  id: string;
  kodeKelas: string;
  mataKuliah: { nama: string; kode: string };
  dosen: { nama: string };
}

interface ImportClientProps {
  kelasList: KelasOption[];
  preselectedKelasId?: string;
}

export default function ImportClient({
  kelasList,
  preselectedKelasId,
}: ImportClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedExcelResult | null>(null);
  const [selectedKelasId, setSelectedKelasId] = useState<string>(
    preselectedKelasId || kelasList[0]?.id || ""
  );
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file select
  async function handleFileSelect(selectedFile: File) {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Format file harus .xlsx atau .xls");
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setParsedResult(null);
    setApplySuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await parseExcelAction(formData);
      if (!res.success) {
        toast.error(res.error || "Gagal memproses file Excel");
      } else {
        toast.success("File Excel Edlink berhasil diparse!");
        setParsedResult(res.data!);

        // Smart auto-match kelas if possible
        if (res.data?.kelas) {
          const match = kelasList.find(
            (k) =>
              k.kodeKelas.toLowerCase().includes(res.data!.kelas.toLowerCase()) ||
              res.data!.kelas.toLowerCase().includes(k.kodeKelas.toLowerCase())
          );
          if (match) {
            setSelectedKelasId(match.id);
          }
        }
      }
    } catch {
      toast.error("Terjadi kesalahan saat memparse Excel");
    } finally {
      setParsing(false);
    }
  }

  // Handle drag & drop
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  // Handle Commit to DB
  async function handleApply() {
    if (!selectedKelasId || !parsedResult) {
      toast.error("Pilih kelas target terlebih dahulu");
      return;
    }

    setApplying(true);
    try {
      const res = await applyExcelImportToKelas(
        selectedKelasId,
        parsedResult.sesiData
      );

      if (!res.success) {
        toast.error(res.error || "Gagal menerapkan data ke kelas");
      } else {
        toast.success("Data monitoring berhasil diperbarui dari Excel Edlink!");
        setApplySuccess(true);
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setApplying(false);
    }
  }

  const selectedKelasObj = kelasList.find((k) => k.id === selectedKelasId);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-[#a80063]" />
            <span>Import Laporan Aktivitas Edlink</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Upload file Excel ekspor Edlink (.xlsx) untuk otomatisasi deteksi 6 komponen materi sesi 1–16
          </p>
        </div>

        <Link
          href="/monitoring"
          className="px-3.5 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all self-start sm:self-auto"
        >
          Kembali ke Grid Monitoring
        </Link>
      </div>

      {/* ── Step 1: Upload Zone ──────────────────────────────────────────────── */}
      <div className="duralux-card p-6 bg-white">
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          Langkah 1: Upload File Excel Edlink (.xlsx)
        </h3>
        <p className="text-xs text-slate-400 font-normal mb-4">
          File "Laporan Aktivitas" yang diexport dari platform Edlink.id
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            file
              ? "border-emerald-300 bg-emerald-50/20"
              : "border-slate-200 hover:border-[#a80063]/40 hover:bg-slate-50/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
            }}
          />

          {parsing ? (
            <div className="flex flex-col items-center justify-center py-4">
              <Loader2 size={36} className="text-[#a80063] animate-spin mb-3" />
              <p className="text-xs font-semibold text-slate-800">
                Memproses & memvalidasi struktur Excel Edlink...
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Mendeteksi 16 sesi dan 6 tipe komponen pembelajaran
              </p>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5">
                <FileCheck size={24} />
              </div>
              <p className="text-xs font-bold text-slate-900">{file.name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {(file.size / 1024).toFixed(1)} KB • Klik untuk mengganti file
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-[#fdf2f8] text-[#a80063] flex items-center justify-center mb-2.5">
                <UploadCloud size={24} />
              </div>
              <p className="text-xs font-bold text-slate-800">
                Tarik & Lepaskan file Excel Edlink ke sini, atau klik untuk memilih
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Mendukung format .xlsx dan .xls (Sample: sample_laporan_aktivitas.xlsx)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Step 2 & 3: Preview & Target Class Selector ──────────────────────── */}
      {parsedResult && (
        <div className="space-y-4 animate-fade-in">
          {/* Target Class Selection Box */}
          <div className="duralux-card p-5 bg-white">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Langkah 2: Pilih Kelas Target di Sistem CDU
            </h3>
            <p className="text-xs text-slate-400 font-normal mb-3">
              Tentukan kelas yang akan diperbarui datanya dari file ini
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200/70">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Terdeteksi dari File Excel:
                </p>
                <p className="text-xs font-bold text-slate-800">
                  Mata Kuliah: <span className="text-[#a80063]">{parsedResult.mataKuliah || "—"}</span>
                </p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">
                  Kelas: <span className="text-[#a80063]">{parsedResult.kelas || "—"}</span>
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Kelas Tujuan:
                </label>
                <select
                  value={selectedKelasId}
                  onChange={(e) => setSelectedKelasId(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-xs font-bold text-slate-800 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none shadow-xs"
                >
                  <option value="">-- Pilih Kelas Target --</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      [{k.kodeKelas}] {k.mataKuliah.nama} ({k.dosen.nama})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Warnings if any */}
          {parsedResult.warningMessages.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle size={14} className="text-amber-600" />
                <span>Catatan Hasil Parsing:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1">
                {parsedResult.warningMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 16-Session Parse Preview Matrix */}
          <div className="duralux-card bg-white p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Langkah 3: Preview Hasil Deteksi ({parsedResult.sesiData.length} Sesi Terbaca)
                </h3>
                <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                  Verifikasi komponen yang berhasil dideteksi oleh sistem sebelum disimpan
                </p>
              </div>

              {/* Note regarding attendance */}
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                <Sparkles size={11} />
                <span>Kehadiran Dosen tetap diisi manual oleh CDU</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                    <th className="py-2.5 px-3 font-bold">Sesi</th>
                    <th className="py-2.5 px-2 text-center font-bold">Lecture Note</th>
                    <th className="py-2.5 px-2 text-center font-bold">Slide / PPT</th>
                    <th className="py-2.5 px-2 text-center font-bold">Tugas</th>
                    <th className="py-2.5 px-2 text-center font-bold">Quiz</th>
                    <th className="py-2.5 px-2 text-center font-bold">Video</th>
                    <th className="py-2.5 px-2 text-center font-bold">Conference</th>
                    <th className="py-2.5 px-3 font-bold">Detail Kolom Terdeteksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {parsedResult.sesiData.map((s) => {
                    const isExam = s.nomorSesi === 8 || s.nomorSesi === 16;

                    return (
                      <tr
                        key={s.nomorSesi}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          isExam ? "bg-[#fdf2f8]/30 font-medium" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 font-bold">
                          <div className="flex items-center gap-1.5">
                            <span>Sesi {s.nomorSesi}</span>
                            {s.nomorSesi === 8 && (
                              <span className="px-1 py-0.2 rounded bg-purple-100 text-purple-800 text-[9px] font-bold">
                                UTS
                              </span>
                            )}
                            {s.nomorSesi === 16 && (
                              <span className="px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold">
                                UAS
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Lecture Note */}
                        <td className="py-2.5 px-2 text-center">
                          {isExam ? (
                            <span className="text-slate-300">—</span>
                          ) : s.lectureNote ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xs">
                              ✓
                            </span>
                          ) : (
                            <span className="text-slate-300">✗</span>
                          )}
                        </td>

                        {/* Slide */}
                        <td className="py-2.5 px-2 text-center">
                          {isExam ? (
                            <span className="text-slate-300">—</span>
                          ) : s.slide ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xs">
                              ✓
                            </span>
                          ) : (
                            <span className="text-slate-300">✗</span>
                          )}
                        </td>

                        {/* Tugas */}
                        <td className="py-2.5 px-2 text-center">
                          {isExam ? (
                            <span className="text-slate-300">—</span>
                          ) : s.tugas ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xs">
                              ✓
                            </span>
                          ) : (
                            <span className="text-slate-300">✗</span>
                          )}
                        </td>

                        {/* Quiz */}
                        <td className="py-2.5 px-2 text-center">
                          {isExam ? (
                            <span className="text-slate-300">—</span>
                          ) : s.kuis ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xs">
                              ✓
                            </span>
                          ) : (
                            <span className="text-slate-300">✗</span>
                          )}
                        </td>

                        {/* Video */}
                        <td className="py-2.5 px-2 text-center">
                          {isExam ? (
                            <span className="text-slate-300">—</span>
                          ) : s.video ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xs">
                              ✓
                            </span>
                          ) : (
                            <span className="text-slate-300">✗</span>
                          )}
                        </td>

                        {/* Conference */}
                        <td className="py-2.5 px-2 text-center">
                          {isExam ? (
                            <span className="text-slate-300">—</span>
                          ) : s.conference ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xs">
                              ✓
                            </span>
                          ) : (
                            <span className="text-slate-300">✗</span>
                          )}
                        </td>

                        {/* Details */}
                        <td className="py-2.5 px-3 text-[11px] text-slate-500 truncate max-w-[240px]">
                          {s.kolomTerdeteksi.length > 0 ? (
                            <span>{s.kolomTerdeteksi.join(", ")}</span>
                          ) : isExam ? (
                            <span className="italic text-slate-400">Sesi Ujian (Hanya Kehadiran Dosen)</span>
                          ) : (
                            <span className="text-slate-400 italic">Tidak ada konten terdeteksi</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action Commit Button */}
            <div className="pt-5 mt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-slate-500 font-medium">
                {applySuccess ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
                    <CheckCircle2 size={15} />
                    Data berhasil diterapkan ke kelas [{selectedKelasObj?.kodeKelas}]!
                  </span>
                ) : (
                  <span>
                    Target: <strong>[{selectedKelasObj?.kodeKelas}] {selectedKelasObj?.mataKuliah.nama}</strong>
                  </span>
                )}
              </p>

              <div className="flex items-center gap-2">
                {applySuccess ? (
                  <Link
                    href={`/monitoring?kelasId=${selectedKelasId}`}
                    className="btn-brand inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold shadow-xs"
                  >
                    <span>Buka Grid Monitoring</span>
                    <ArrowRight size={14} />
                  </Link>
                ) : (
                  <button
                    onClick={handleApply}
                    disabled={applying || !selectedKelasId}
                    className="btn-brand inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    {applying ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    <span>Terapkan Hasil Parse ke Database</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
