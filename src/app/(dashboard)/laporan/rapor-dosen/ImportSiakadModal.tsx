"use client";
// src/app/(dashboard)/laporan/rapor-dosen/ImportSiakadModal.tsx
// Modal Upload & Import Rekap Angket SIAKAD (.xls / .xlsx)
// Alur Simple & Clean:
// 1. Pilih Berkas -> Klik "Proses & Pratinjau Data"
// 2. Tinjau Data & Peringatan Periode (in-memory) -> Klik "Simpan ke Database" -> Langsung Simpan & Tutup

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Loader2,
  FileText,
  Save,
  RotateCcw, 
  CheckCircle2,
} from "lucide-react";
import {
  previewSiakadAngketAction,
  saveSiakadImportAction,
  SiakadPreviewData,
} from "@/actions/rapor";

interface ImportSiakadModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string;
  semesterLabel?: string;
  onSuccess: () => void;
}

export default function ImportSiakadModal({
  isOpen,
  onClose,
  semesterId,
  semesterLabel,
  onSuccess,
}: ImportSiakadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Preview data (in-memory, belum masuk database)
  const [previewData, setPreviewData] = useState<SiakadPreviewData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setErrorMsg(null);
      setPreviewData(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      setErrorMsg(null);
      setPreviewData(null);
    }
  };

  const handleReset = () => {
    setFile(null);
    setErrorMsg(null);
    setPreviewData(null);
    setIsLoadingPreview(false);
    setIsSaving(false);
    setStatusText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 1. Proses & Pratinjau Data (In-Memory, dengan auto-analisis AI aktif)
  const handlePreview = async () => {
    if (!file) {
      setErrorMsg("Pilih berkas laporan rekap angket (.xls atau .xlsx) terlebih dahulu.");
      return;
    }

    try {
      setIsLoadingPreview(true);
      setErrorMsg(null);
      setStatusText("Membaca berkas SIAKAD ...");

      const formData = new FormData();
      formData.append("file", file);

      // AI Gemini otomatis aktif untuk hasil ekstraksi terbaik
      const res = await previewSiakadAngketAction(formData, semesterId, true);

      if (!res.success || !res.data) {
        setErrorMsg(res.error || "Gagal memproses berkas kuesioner SIAKAD");
        return;
      }

      setPreviewData(res.data);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memproses berkas");
    } finally {
      setIsLoadingPreview(false);
      setStatusText("");
    }
  };

  // 2. Simpan Data Rapor ke Database -> Langsung tutup modal & refresh data
  const handleConfirmSave = async () => {
    if (!previewData) return;

    try {
      setIsSaving(true);
      setErrorMsg(null);
      setStatusText("Menyimpan ke database...");

      const res = await saveSiakadImportAction({
        dosenId: previewData.dosen.id,
        semesterId,
        nipFromSiakad: previewData.parsedData.nip,
        nilaiKuesioner: previewData.nilaiKuesioner,
        totalResponden: previewData.totalResponden,
        komentarMahasiswa: previewData.komentarMahasiswa,
        rawKomentarMahasiswa: previewData.rawKomentarMahasiswa,
        rekomendasiPerbaikan: previewData.rekomendasiPerbaikan,
        narasiKesimpulan: previewData.narasiKesimpulan,
        aiAnalysis: previewData.aiAnalysis,
        sumberImport: previewData.fileName,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Gagal menyimpan rapor ke basis data");
        return;
      }

      // Langsung tutup modal dan refresh tabel utama
      onSuccess();
      handleReset();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menyimpan data");
    } finally {
      setIsSaving(false);
      setStatusText("");
    }
  };

  const isBusy = isLoadingPreview || isSaving;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
          handleReset();
          onClose();
        }
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl p-6 md:p-7 shadow-2xl border border-slate-200 relative max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            handleReset();
            onClose();
          }}
          disabled={isBusy}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30"
          title="Tutup (ESC)"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#fdf2f8] text-[#a80063] flex items-center justify-center shrink-0">
              <FileSpreadsheet size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Import Kuesioner Mahasiswa (SIAKAD)
              </h3>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                {previewData
                  ? "Tinjau Hasil Ekstraksi Sebelum Disimpan"
                  : `Format .xls / .xlsx • ${semesterLabel || "Semester Aktif"}`}
              </p>
            </div>
          </div>
        </div>

        {/* Alert Error */}
        {errorMsg && (
          <div className="mb-3.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5 shrink-0">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {previewData ? (
            /* TAMPILAN PRATINJAU DATA */
            <div className="space-y-3 animate-fade-in">
              {/* Alert Peringatan Ketidakcocokan Semester (Ringkas & Jelas) */}
              {previewData.isSemesterMismatch ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center gap-2.5 text-xs">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                  <p className="leading-snug text-amber-900">
                    <strong className="text-amber-950">Periode Berbeda:</strong> Berkas SIAKAD untuk <strong>{previewData.filePeriode}</strong> (Semester aktif: <strong>{previewData.semesterInfo.label}</strong>).
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Periode berkas (<strong>{previewData.filePeriode}</strong>) sesuai dengan semester aktif.</span>
                </div>
              )}

              {/* Status File */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-600">
                <span className="font-medium flex items-center gap-1.5 truncate max-w-[70%]">
                  <FileText size={13} className="text-slate-500 shrink-0" />
                  <span className="truncate">Berkas: <strong className="text-slate-800">{previewData.fileName}</strong></span>
                </span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded shrink-0">
                  Data Belum Disimpan
                </span>
              </div>

              {/* Kartu Profil Dosen & Metrik Kuesioner */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Dosen Teridentifikasi
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    Cocok (NIP / Nama)
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#fdf2f8] text-[#a80063] font-bold flex items-center justify-center text-xs shrink-0">
                    {previewData.dosen.nama.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-bold text-slate-900 text-xs truncate">{previewData.dosen.nama}</h5>
                    <p className="text-[11px] text-slate-500 truncate">
                      NIP: <span className="font-mono font-medium text-slate-700">{previewData.dosen.nip || "-"}</span> • Prodi: {previewData.dosen.prodi}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Nilai Kuesioner</span>
                    <span className="text-sm font-black text-slate-900">{previewData.nilaiKuesioner.toFixed(2)}</span>
                    <span className="block text-[10px] text-slate-400">skala 5.00</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Total Responden</span>
                    <span className="text-sm font-black text-slate-900">{previewData.totalResponden}</span>
                    <span className="block text-[10px] text-slate-400">Mahasiswa</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Masukan Mahasiswa</span>
                    <span className="text-sm font-black text-slate-900">{previewData.rawKomentarMahasiswa.length}</span>
                    <span className="block text-[10px] text-slate-400">Tabel 12 SIAKAD</span>
                  </div>
                </div>
              </div>

              {/* 5 Rekomendasi Area Perbaikan (P1 - P5) */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    5 Rekomendasi Area Perbaikan (P1 – P5)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Suara terbanyak pada &ldquo;Sangat Tidak Baik&rdquo;
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  {previewData.rekomendasiPerbaikan.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono font-bold text-[10px] shrink-0">
                        P{idx + 1}
                      </span>
                      <span className="text-[11px] leading-relaxed text-slate-700">
                        {item.replace(/^P\d+:\s*/, "")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5 Kritik Konstruktif Mahasiswa (K1 - K5) */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    5 Masukan / Kritik Konstruktif Mahasiswa (K1 – K5)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Prioritas dari Tabel 12 (Kritik & Saran)
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  {previewData.komentarMahasiswa.slice(0, 5).map((comment, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-bold text-[10px] shrink-0">
                        K{idx + 1}
                      </span>
                      <span className="text-[11px] leading-relaxed text-slate-700 italic">
                        &ldquo;{comment}&rdquo;
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analisis Sentimen & Kesimpulan AI */}
              {previewData.aiAnalysis && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#a80063]" />
                      <span className="text-xs font-bold text-slate-800">
                        Analisis Sentimen & Kesimpulan
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                        Positif {previewData.aiAnalysis.analisisSentimen?.positifPct}%
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
                        Netral {previewData.aiAnalysis.analisisSentimen?.netralPct}%
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-semibold">
                        Negatif {previewData.aiAnalysis.analisisSentimen?.negatifPct}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                    &ldquo;{previewData.narasiKesimpulan}&rdquo;
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* TAMPILAN FORM UPLOAD (CLEAN & DIRECT) */
            <div className="space-y-3">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  file
                    ? "border-[#a80063] bg-[#fdf2f8]/40"
                    : "border-slate-300 hover:border-[#a80063]/50 hover:bg-slate-50/60"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xls,.xlsx"
                  className="hidden"
                />
                <div className="w-11 h-11 rounded-xl bg-[#fdf2f8] text-[#a80063] flex items-center justify-center mx-auto mb-3">
                  <Upload size={22} />
                </div>

                {file ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900">{file.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB • Klik untuk mengganti berkas
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">
                      Pilih atau Seret Berkas Rekap Angket SIAKAD ke Sini
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Format <strong>.xls (HTML Table SIAKAD)</strong> atau <strong>.xlsx</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Subtle AI Badge (Clean, tanpa checkbox membingungkan) */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500">
                <Sparkles size={13} className="text-[#a80063] shrink-0" />
                <span>
                  Dilengkapi auto-analisis AI: ekstraksi kritik K1–K5, rekomendasi P1–P5, dan evaluasi sentimen mahasiswa.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4 shrink-0">
          {previewData ? (
            /* State: Sedang Preview (Belum Disimpan) */
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                <RotateCcw size={12} />
                <span>Batal / Ganti Berkas</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isBusy}
                className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>{statusText || "Menyimpan..."}</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Simpan ke Database</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* State: Belum Diproses (Pilih Berkas) */
            <>
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                disabled={isBusy}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={isBusy || !file}
                className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>{statusText || "Memproses..."}</span>
                  </>
                ) : (
                  <>
                    <Upload size={13} />
                    <span>Proses & Pratinjau Data</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
