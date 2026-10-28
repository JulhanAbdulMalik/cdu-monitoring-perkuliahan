"use client";
// src/app/(dashboard)/laporan/rapor-dosen/EditRaporModal.tsx
// Modal Kelola & Edit Nilai Tridharma Rapor Dosen
// Format Standar /master/kelas: Bagus, Simple, dan Clean

import React, { useState, useEffect } from "react";
import {
  X,
  Edit3,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Loader2,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import {
  saveRaporDosen,
  syncLecturerFromMonitoring,
  analyzeRaporWithGeminiAction,
  RaporDosenListItem,
} from "@/actions/rapor";

interface EditRaporModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: RaporDosenListItem | null;
  semesterId: string;
  semesterLabel?: string;
  onSuccess: () => void;
}

export default function EditRaporModal({
  isOpen,
  onClose,
  item,
  semesterId,
  semesterLabel,
  onSuccess,
}: EditRaporModalProps) {
  const totalKelas = item?.totalKelas && item.totalKelas > 0 ? item.totalKelas : 1;
  const totalSesiBeban = item?.totalSesiBeban || totalKelas * 16;
  const maxSkorKonten = item?.maxSkorKonten || totalKelas * 28;

  // 1. Kuesioner & Responden SIAKAD
  const [nilaiKuesioner, setNilaiKuesioner] = useState<string>("");
  const [totalResponden, setTotalResponden] = useState<string>("");

  // 2. Kehadiran Mengajar (Total Sesi Hadir sesuai Tabel Utama)
  const [totalSesiHadir, setTotalSesiHadir] = useState<string>("");
  const [rerataSesiHadir, setRerataSesiHadir] = useState<string>("");

  // 3. Konten 3 Pilar (Total Poin sesuai Tabel Utama & Persen)
  const [totalSkorKonten, setTotalSkorKonten] = useState<string>("");
  const [persenKonten, setPersenKonten] = useState<string>("");

  // 4. Kinerja Tridharma
  const [jumlahPenelitian, setJumlahPenelitian] = useState<string>("0");
  const [jumlahPengabdian, setJumlahPengabdian] = useState<string>("0");

  // 5. Validasi Rapor
  const [statusRapor, setStatusRapor] = useState<"DRAFT" | "FINAL">("DRAFT");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      const tKelas = item.totalKelas && item.totalKelas > 0 ? item.totalKelas : 1;
      const mKonten = item.maxSkorKonten || tKelas * 28;

      setNilaiKuesioner(
        item.nilaiKuesioner != null ? Number(item.nilaiKuesioner).toFixed(2) : ""
      );
      setTotalResponden(item.totalResponden != null ? String(item.totalResponden) : "");

      // Inisialisasi Kehadiran (Sesuai Persis dengan Data Kolom Tabel Utama: e.g. 24 / 96 Sesi)
      const initialTotalSesi =
        item.totalSesiHadir != null
          ? String(item.totalSesiHadir)
          : item.rerataSesiHadir != null
          ? String(Math.round(item.rerataSesiHadir * tKelas))
          : "";
      const initialRerataSesi =
        item.rerataSesiHadir != null
          ? String(item.rerataSesiHadir)
          : item.totalSesiHadir != null
          ? String(Math.round((item.totalSesiHadir / tKelas) * 10) / 10)
          : "";
      setTotalSesiHadir(initialTotalSesi);
      setRerataSesiHadir(initialRerataSesi);

      // Inisialisasi Konten 3P (Sesuai Persis dengan Data Kolom Tabel Utama: e.g. 39 / 140 Poin)
      const initialPersenKonten = item.persenKonten != null ? String(item.persenKonten) : "";
      const initialTotalPoin =
        item.totalSkorKonten != null
          ? String(item.totalSkorKonten)
          : item.persenKonten != null && mKonten > 0
          ? String(Math.round((item.persenKonten / 100) * mKonten))
          : "";
      setPersenKonten(initialPersenKonten);
      setTotalSkorKonten(initialTotalPoin);

      setJumlahPenelitian(String(item.jumlahPenelitian || 0));
      setJumlahPengabdian(String(item.jumlahPengabdian || 0));
      setStatusRapor(item.statusRapor === "FINAL" ? "FINAL" : "DRAFT");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  // Handlers Sinkronisasi 2-Arah Kehadiran
  const handleTotalSesiChange = (val: string) => {
    setTotalSesiHadir(val);
    if (val === "") {
      setRerataSesiHadir("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const rerata = Math.round((num / totalKelas) * 10) / 10;
        setRerataSesiHadir(String(Math.min(16, Math.max(0, rerata))));
      }
    }
  };

  // Handlers Sinkronisasi 2-Arah Konten 3 Pilar
  const handleTotalPoinChange = (val: string) => {
    setTotalSkorKonten(val);
    if (val === "") {
      setPersenKonten("");
    } else {
      const num = parseFloat(val);
      if (!isNaN(num) && maxSkorKonten > 0) {
        const pct = Math.round((num / maxSkorKonten) * 1000) / 10;
        setPersenKonten(String(Math.min(100, Math.max(0, pct))));
      }
    }
  };

  // Sinkronisasi Data Monitoring CDU Live
  const handleSyncMonitoring = async () => {
    try {
      setIsSyncing(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await syncLecturerFromMonitoring(item.dosenId, semesterId);
      if (!res.success) {
        setErrorMsg(res.error || "Gagal sinkronisasi data monitoring");
        return;
      }

      if (res.data) {
        const stats = res.data.stats;
        if (stats) {
          setTotalSesiHadir(String(stats.totalSesiHadirSemua ?? ""));
          setRerataSesiHadir(String(stats.rerataSesiHadir ?? ""));
          setPersenKonten(String(stats.persenKonten ?? ""));

          const totalPoinSemua = stats.kelasList
            ? stats.kelasList
                .filter((c: any) => c.modePembelajaran !== "BIMBINGAN")
                .reduce((sum: number, c: any) => sum + (c.totalSkor3Pilar || 0), 0)
            : null;

          if (totalPoinSemua != null) {
            setTotalSkorKonten(String(totalPoinSemua));
          } else if (maxSkorKonten > 0 && stats.persenKonten != null) {
            setTotalSkorKonten(String(Math.round((stats.persenKonten / 100) * maxSkorKonten)));
          }
        } else {
          setRerataSesiHadir(res.data.rerataSesiHadir != null ? String(res.data.rerataSesiHadir) : "");
          setPersenKonten(res.data.persenKonten != null ? String(res.data.persenKonten) : "");
          if (res.data.rerataSesiHadir != null) {
            setTotalSesiHadir(String(Math.round(res.data.rerataSesiHadir * totalKelas)));
          }
          if (res.data.persenKonten != null && maxSkorKonten > 0) {
            setTotalSkorKonten(String(Math.round((res.data.persenKonten / 100) * maxSkorKonten)));
          }
        }
        setSuccessMsg("Data Kehadiran & Konten LMS berhasil disinkronkan dari kelas perkuliahan.");
      }
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat sinkronisasi");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    try {
      setIsAiRunning(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await analyzeRaporWithGeminiAction(item.dosenId, semesterId);
      if (!res.success) {
        setErrorMsg(res.error || "Gagal menjalankan analisis AI");
        return;
      }

      setSuccessMsg("Analisis AI Gemini berhasil! Sentimen dan narasi kesimpulan telah diperbarui.");
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses analisis AI");
    } finally {
      setIsAiRunning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const parsedRerata = rerataSesiHadir ? parseFloat(rerataSesiHadir) : null;
      const parsedPersenKonten = persenKonten ? parseFloat(persenKonten) : null;
      const parsedPersenKehadiran =
        totalSesiHadir && totalSesiBeban > 0
          ? Math.round((parseFloat(totalSesiHadir) / totalSesiBeban) * 1000) / 10
          : parsedRerata != null
          ? Math.round((parsedRerata / 16) * 1000) / 10
          : null;

      const res = await saveRaporDosen({
        dosenId: item.dosenId,
        semesterId,
        nilaiKuesioner: nilaiKuesioner ? parseFloat(nilaiKuesioner) : null,
        totalResponden: totalResponden ? parseInt(totalResponden, 10) : null,
        targetResponden: null,
        rerataSesiHadir: parsedRerata,
        persenKehadiran: parsedPersenKehadiran,
        persenKonten: parsedPersenKonten,
        jumlahPenelitian: Number(jumlahPenelitian || 0),
        jumlahPengabdian: Number(jumlahPengabdian || 0),
        statusRapor,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Gagal menyimpan perubahan rapor");
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Perhitungan Nilai Live untuk Helper
  const livePersenKehadiran =
    totalSesiHadir && totalSesiBeban > 0
      ? Math.min(100, Math.round((parseFloat(totalSesiHadir) / totalSesiBeban) * 1000) / 10)
      : rerataSesiHadir
      ? Math.min(100, Math.round((parseFloat(rerataSesiHadir) / 16) * 1000) / 10)
      : 0;



  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting && !isSyncing && !isAiRunning) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl p-6 md:p-8 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting || isSyncing || isAiRunning}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30"
          title="Tutup (ESC)"
        >
          <X size={18} />
        </button>

        {/* Header Standar /master/kelas */}
        <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Edit3 size={16} className="text-[#a80063]" />
          <span>Kelola & Edit Rapor Dosen</span>
        </h3>
        <p className="text-xs text-slate-500 font-normal mb-3">
          {item.dosenNama} • {item.prodiNama} • {semesterLabel || "Semester Aktif"}
        </p>

        {/* Alert Messages */}
        {errorMsg && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2.5">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Quick Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 mb-4">
          <button
            type="button"
            onClick={handleSyncMonitoring}
            disabled={isSyncing || Boolean(semesterLabel?.includes("2025"))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold shadow-2xs transition-colors ${
              semesterLabel?.includes("2025")
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 cursor-pointer disabled:opacity-50"
            }`}
            title={
              semesterLabel?.includes("2025")
                ? "Data semester lampau bersifat arsip tetap dari rekap Excel dan tidak dapat disinkronkan dari kelas monitoring"
                : "Tarik data sesi dan konten LMS langsung dari kelas monitoring"
            }
          >
            {isSyncing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RotateCcw size={12} className={semesterLabel?.includes("2025") ? "text-slate-400" : "text-blue-600"} />
            )}
            <span>Sinkronkan CDU</span>
          </button>

          <button
            type="button"
            onClick={handleRunAiAnalysis}
            disabled={isAiRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fdf2f8] hover:bg-[#fce7f3] border border-[#fbcfe8] rounded-lg text-xs font-semibold text-[#a80063] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Analisis ulang komentar mahasiswa dengan AI Gemini"
          >
            {isAiRunning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            <span>Analisis Ulang AI Gemini</span>
          </button>

          <a
            href={`/laporan/rapor-dosen/${item.dosenId}?semesterId=${semesterId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors ml-auto cursor-pointer"
            title="Buka pratinjau cetak A4 di tab baru"
          >
            <span>Cetak A4</span>
            <ExternalLink size={11} className="text-slate-400" />
          </a>
        </div>

        {/* Form Body Standar */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section: Komponen Penilaian Tridharma */}
          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen size={13} className="text-[#a80063]" />
              <span>Komponen Penilaian Tridharma</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Nilai Kuesioner SIAKAD (Keterangan / 5.00 ditaruh di header label agar panah atas/bawah bebas halangan) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Nilai Kuesioner SIAKAD
                  </label>
                  <span className="text-[11px] font-bold text-slate-500">
                    / 5.00
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="5"
                  value={nilaiKuesioner}
                  onChange={(e) => setNilaiKuesioner(e.target.value)}
                  placeholder="5.00"
                  className="w-full px-3 py-1.5 bg-white text-xs font-bold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                />
              </div>

              {/* 2. Total Responden Mahasiswa */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Total Responden
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Mahasiswa
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={totalResponden}
                  onChange={(e) => setTotalResponden(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 bg-white text-xs font-bold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                />
              </div>

              {/* 3. Kehadiran Mengajar (Sesuai Kolom Tabel Utama: e.g. 24 / 96 Sesi) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Kehadiran Mengajar
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    {livePersenKehadiran.toFixed(1)}% Hadir
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={totalSesiBeban}
                    value={totalSesiHadir}
                    onChange={(e) => handleTotalSesiChange(e.target.value)}
                    placeholder="24"
                    className="w-full px-3 py-1.5 bg-white text-xs font-bold text-emerald-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  />
                  <span className="text-slate-400 font-bold text-xs select-none">/</span>
                  <div className="w-full px-3 py-1.5 bg-slate-100 text-xs font-bold text-slate-600 rounded-lg border border-slate-200 select-none text-center">
                    {totalSesiBeban} Sesi
                  </div>
                </div>
              </div>

              {/* 4. Kelengkapan Konten LMS - 3 Pilar (Sesuai Kolom Tabel Utama: e.g. 39 / 140 Poin) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Kelengkapan LMS (3 Pilar)
                  </label>
                  <span className="text-[10px] text-[#a80063] font-bold">
                    {persenKonten ? `${parseFloat(persenKonten).toFixed(1)}%` : "0%"} Konten
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={maxSkorKonten}
                    value={totalSkorKonten}
                    onChange={(e) => handleTotalPoinChange(e.target.value)}
                    placeholder="39"
                    className="w-full px-3 py-1.5 bg-white text-xs font-bold text-[#a80063] rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  />
                  <span className="text-slate-400 font-bold text-xs select-none">/</span>
                  <div className="w-full px-3 py-1.5 bg-slate-100 text-xs font-bold text-slate-600 rounded-lg border border-slate-200 select-none text-center">
                    {maxSkorKonten} Poin
                  </div>
                </div>
              </div>

              {/* 5. Kinerja Penelitian */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Kinerja Penelitian
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">Judul</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={jumlahPenelitian}
                  onChange={(e) => setJumlahPenelitian(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 bg-white text-xs font-bold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                />
              </div>

              {/* 6. Pengabdian Masyarakat (PkM) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Pengabdian Masyarakat (PkM)
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">Kegiatan</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={jumlahPengabdian}
                  onChange={(e) => setJumlahPengabdian(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 bg-white text-xs font-bold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Status Validasi Rapor Standar */}
          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
              Status Validasi Rapor
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatusRapor("DRAFT")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  statusRapor === "DRAFT"
                    ? "bg-amber-50/80 border-amber-300 text-amber-900 ring-1 ring-amber-400/40"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">DRAFT</span>
                  {statusRapor === "DRAFT" && <CheckCircle2 size={14} className="text-amber-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Sedang dalam peninjauan QAU</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusRapor("FINAL")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  statusRapor === "FINAL"
                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 ring-1 ring-emerald-400/40"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">FINAL (Terverifikasi)</span>
                  {statusRapor === "FINAL" && <CheckCircle2 size={14} className="text-emerald-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Siap dicetak & dipublikasikan</p>
              </button>
            </div>
          </div>

          {/* Action Buttons Standar /master/kelas */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
