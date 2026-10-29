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

// 1. Proses & Pratinjau Data Otomatis (In-Memory, dengan auto-analisis AI aktif)
  const processFile = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMsg("Format berkas harus berupa Excel (.xls atau .xlsx) dari SIAKAD.");
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setIsLoadingPreview(true);
    setStatusText("Membaca berkas dan mengekstrak data SIAKAD...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      // AI Gemini otomatis aktif untuk hasil ekstraksi terbaik
      const res = await previewSiakadAngketAction(formData, semesterId, true);

      if (!res.success || !res.data) {
        setErrorMsg(res.error || "Gagal memproses berkas kuesioner SIAKAD");
        setPreviewData(null);
      } else {
        setPreviewData(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memproses berkas");
      setPreviewData(null);
    } finally {
      setIsLoadingPreview(false);
      setStatusText("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
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
      <div
        className={`w-full bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[94vh] flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          previewData ? "max-w-5xl lg:max-w-6xl xl:max-w-7xl" : "max-w-xl"
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            handleReset();
            onClose();
          }}
          disabled={isBusy}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30 transition-colors"
          title="Tutup (ESC)"
        >
          <X size={18} />
        </button>

        {/* Modal Header Standar CDU Portal */}
        <div className="mb-4 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-[#a80063]" />
            <span>Import Kuesioner Mahasiswa (SIAKAD)</span>
          </h3>
          <p className="text-xs text-slate-500 font-normal">
            Rekapitulasi Angket Evaluasi Dosen &bull; Semester {semesterLabel || "Aktif"}
          </p>
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
            <div className="space-y-3.5 animate-fade-in">
              {/* Baris Status Periode & Nama Berkas */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={15} className="text-[#a80063] shrink-0" />
                  <span className="text-xs text-slate-700 truncate">
                    Berkas: <strong className="text-slate-900 font-semibold">{previewData.fileName}</strong>
                  </span>
                  {previewData.isSemesterMismatch ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300 shrink-0">
                      <AlertTriangle size={11} />
                      <span>Periode SIAKAD ({previewData.filePeriode}) Berbeda dari Aktif ({previewData.semesterInfo.label})</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-300 shrink-0">
                      <CheckCircle2 size={11} />
                      <span>Periode Sesuai ({previewData.filePeriode})</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-md">
                    Pratinjau (Belum Disimpan)
                  </span>
                </div>
              </div>

              {/* Kartu Profil Dosen & Metrik Kuesioner (Side by Side Grid) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* Info Dosen */}
                <div className="lg:col-span-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Dosen Teridentifikasi
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                        Cocok (Master Dosen)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#fdf2f8] text-[#a80063] font-bold flex items-center justify-center text-sm border border-[#a80063]/20 shrink-0">
                        {previewData.dosen.nama.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {previewData.dosen.nama}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          NIP: <span className="font-mono font-medium text-slate-700">{previewData.dosen.nip || "-"}</span> • {previewData.dosen.prodi}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span>NIP SIAKAD: <strong className="text-slate-700 font-mono">{previewData.parsedData.nip || "-"}</strong></span>
                    <span>Status: <strong className="text-emerald-700">Terverifikasi</strong></span>
                  </div>
                </div>

                {/* 3 Box Metrik Kuesioner */}
                <div className="lg:col-span-7 grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
                      Nilai Kuesioner
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                      {previewData.nilaiKuesioner.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">skala 5.00</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
                      Total Responden
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                      {previewData.totalResponden}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Mahasiswa</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
                      Komentar Angket
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                      {previewData.rawKomentarMahasiswa.length}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Tabel 12 SIAKAD</span>
                  </div>
                </div>
              </div>

              {/* Grid 2 Kolom Sejajar: 5 Rekomendasi (P1-P5) & 5 Masukan (K1-K5) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {/* 5 Rekomendasi Area Perbaikan (P1 - P5) */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      5 Rekomendasi Area Perbaikan (P1 – P5)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Suara terbanyak &ldquo;Kurang&rdquo;
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {previewData.rekomendasiPerbaikan.length > 0 ? (
                      previewData.rekomendasiPerbaikan.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100/60 transition-colors">
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono font-bold text-[10px] shrink-0 border border-rose-200">
                            P{idx + 1}
                          </span>
                          <span className="text-[11px] leading-relaxed text-slate-700">
                            {item.replace(/^P\d+:\s*/, "")}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic py-3 text-center">Tidak ada catatan perbaikan khusus.</p>
                    )}
                  </div>
                </div>

                {/* 5 Kritik Konstruktif Mahasiswa (K1 - K5) */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      5 Kritik & Masukan Mahasiswa (K1 – K5)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Prioritas dari Tabel 12
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {previewData.komentarMahasiswa.length > 0 ? (
                      previewData.komentarMahasiswa.slice(0, 5).map((comment, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100/60 transition-colors">
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-bold text-[10px] shrink-0 border border-amber-200">
                            K{idx + 1}
                          </span>
                          <span className="text-[11px] leading-relaxed text-slate-700 italic">
                            &ldquo;{comment}&rdquo;
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic py-3 text-center">Tidak ada masukan komentar mahasiswa.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Analisis Sentimen & Kesimpulan AI */}
              {previewData.aiAnalysis && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#a80063]" />
                      <span className="text-xs font-bold text-slate-900">
                        Analisis Sentimen & Kesimpulan AI
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                        Positif {previewData.aiAnalysis.analisisSentimen?.positifPct}%
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
                        Netral {previewData.aiAnalysis.analisisSentimen?.netralPct}%
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-semibold">
                        Negatif {previewData.aiAnalysis.analisisSentimen?.negatifPct}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 italic bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                    &ldquo;{previewData.narasiKesimpulan}&rdquo;
                  </p>
                </div>
              )}

              {/* Catatan Kaki Standar */}
              <p className="text-[11px] text-amber-700 italic pt-1">
                * Catatan: Data kuesioner ini akan disimpan dan memperbarui indikator survei mahasiswa pada Rapor Dosen semester {semesterLabel || "terkait"}.
              </p>
            </div>
          ) : (
            /* TAMPILAN FORM UPLOAD (CLEAN & DIRECT) */
            <div className="space-y-3">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => !isLoadingPreview && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isLoadingPreview
                    ? "border-slate-300 bg-slate-50 cursor-wait"
                    : "border-slate-300 hover:border-[#a80063]/50 hover:bg-slate-50/60 cursor-pointer"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xls,.xlsx"
                  className="hidden"
                  disabled={isLoadingPreview}
                />

                {isLoadingPreview ? (
                  <div className="py-4 flex flex-col items-center justify-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-[#a80063]" />
                    <p className="text-xs font-bold text-slate-800">
                      {statusText || "Membaca berkas dan mengekstrak data SIAKAD..."}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Mohon tunggu, proses ekstraksi dan analisis AI sedang berlangsung.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-xl bg-[#fdf2f8] text-[#a80063] flex items-center justify-center mx-auto mb-3">
                      <Upload size={22} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        Pilih atau Seret Berkas Rekap Angket SIAKAD ke Sini
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Format berkas <strong>.xls (HTML Table SIAKAD)</strong> atau <strong>.xlsx</strong>
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Info Ekstraksi Ringkas */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500">
                <Sparkles size={13} className="text-[#a80063] shrink-0" />
                <span>
                  Dilengkapi auto-analisis AI: mengekstrak skor angket, kritik K1–K5, rekomendasi P1–P5, dan kesimpulan evaluasi.
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
            /* State: Belum Diproses */
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
          )}
        </div>
      </div>
    </div>
  );
}
