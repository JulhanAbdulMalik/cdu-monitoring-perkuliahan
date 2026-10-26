"use client";
// src/app/(dashboard)/laporan/rapor-dosen/RaporConfigModal.tsx
// Modal Konfigurasi Bobot Penilaian Tridharma & Target Sesi Rapor Dosen

import React, { useState, useEffect } from "react";
import { X, Sliders, CheckCircle2, AlertCircle, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { RaporConfigPayload, saveRaporConfig } from "@/actions/rapor";

interface RaporConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string;
  semesterLabel?: string;
  initialConfig: RaporConfigPayload;
  onSuccess: () => void;
}

export default function RaporConfigModal({
  isOpen,
  onClose,
  semesterId,
  semesterLabel,
  initialConfig,
  onSuccess,
}: RaporConfigModalProps) {
  const [bobotKuesioner, setBobotKuesioner] = useState(initialConfig.bobotKuesioner);
  const [bobotKehadiran, setBobotKehadiran] = useState(initialConfig.bobotKehadiran);
  const [bobotKonten, setBobotKonten] = useState(initialConfig.bobotKonten);
  const [bobotPenelitian, setBobotPenelitian] = useState(initialConfig.bobotPenelitian);
  const [bobotPengabdian, setBobotPengabdian] = useState(initialConfig.bobotPengabdian);
  const [targetSesi, setTargetSesi] = useState(initialConfig.targetSesi || 16);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBobotKuesioner(initialConfig.bobotKuesioner);
      setBobotKehadiran(initialConfig.bobotKehadiran);
      setBobotKonten(initialConfig.bobotKonten);
      setBobotPenelitian(initialConfig.bobotPenelitian);
      setBobotPengabdian(initialConfig.bobotPengabdian);
      setTargetSesi(initialConfig.targetSesi || 16);
      setErrorMsg(null);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const totalBobot =
    Number(bobotKuesioner || 0) +
    Number(bobotKehadiran || 0) +
    Number(bobotKonten || 0) +
    Number(bobotPenelitian || 0) +
    Number(bobotPengabdian || 0);

  const isValidTotal = totalBobot === 100;

  const handleResetDefault = () => {
    setBobotKuesioner(40);
    setBobotKehadiran(20);
    setBobotKonten(20);
    setBobotPenelitian(10);
    setBobotPengabdian(10);
    setTargetSesi(16);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTotal) {
      setErrorMsg(`Total bobot saat ini ${totalBobot}%. Wajib tepat 100%.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const res = await saveRaporConfig(semesterId, {
        bobotKuesioner: Number(bobotKuesioner),
        bobotKehadiran: Number(bobotKehadiran),
        bobotKonten: Number(bobotKonten),
        bobotPenelitian: Number(bobotPenelitian),
        bobotPengabdian: Number(bobotPengabdian),
        targetSesi: Number(targetSesi),
      });

      if (!res.success) {
        setErrorMsg(res.error || "Gagal menyimpan konfigurasi bobot");
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

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl p-6 md:p-8 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30"
          title="Tutup (ESC)"
        >
          <X size={18} />
        </button>

        {/* Header (Clean & Direct) */}
        <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Sliders size={16} className="text-[#a80063]" />
          <span>Konfigurasi Bobot Penilaian Rapor Dosen</span>
        </h3>
        <p className="text-xs text-slate-500 font-normal mb-4">
          Standar Bobot Evaluasi SPMI & QAU Universitas Nusa Putra • {semesterLabel || "Semester Aktif"}
        </p>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Sesi Pertemuan (Compact Single Row) */}
          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-800 uppercase tracking-wider">
                Target Sesi Pertemuan Perkuliahan
              </label>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Standar baku jumlah sesi tatap muka semester per kelas (biasanya 16 sesi).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="number"
                min={1}
                max={30}
                value={targetSesi}
                onChange={(e) => setTargetSesi(Number(e.target.value))}
                required
                className="w-20 px-3 py-1.5 bg-white text-xs font-bold text-slate-900 text-center rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
              />
              <span className="text-xs font-semibold text-slate-600">Sesi per Kelas</span>
            </div>
          </div>

          {/* Distribusi Bobot Indikator (Clean Compact Section) */}
          <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={13} className="text-[#a80063]" />
                <span>Distribusi Bobot 5 Indikator</span>
              </span>
              <button
                type="button"
                onClick={handleResetDefault}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a80063] hover:underline cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Reset Standar</span>
              </button>
            </div>

            {/* List Indikator Compact */}
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {/* 1. Kuesioner Mahasiswa */}
              <div className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800">Kuesioner Mahasiswa</span>
                    <span className="ml-2 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      SIAKAD
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bobotKuesioner}
                    onChange={(e) => setBobotKuesioner(Number(e.target.value))}
                    className="w-16 px-2.5 py-1 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 text-center rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    required
                  />
                  <span className="text-xs font-bold text-slate-400 w-3">%</span>
                </div>
              </div>

              {/* 2. Kehadiran Dosen */}
              <div className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800">Kehadiran Mengajar</span>
                    <span className="ml-2 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Monitoring CDU
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bobotKehadiran}
                    onChange={(e) => setBobotKehadiran(Number(e.target.value))}
                    className="w-16 px-2.5 py-1 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 text-center rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    required
                  />
                  <span className="text-xs font-bold text-slate-400 w-3">%</span>
                </div>
              </div>

              {/* 3. Kelengkapan Konten LMS */}
              <div className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800">Kelengkapan Konten LMS</span>
                    <span className="ml-2 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      3 Pilar Edlink
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bobotKonten}
                    onChange={(e) => setBobotKonten(Number(e.target.value))}
                    className="w-16 px-2.5 py-1 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 text-center rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    required
                  />
                  <span className="text-xs font-bold text-slate-400 w-3">%</span>
                </div>
              </div>

              {/* 4. Kinerja Penelitian */}
              <div className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800">Kinerja Penelitian</span>
                    <span className="ml-2 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Tridharma
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bobotPenelitian}
                    onChange={(e) => setBobotPenelitian(Number(e.target.value))}
                    className="w-16 px-2.5 py-1 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 text-center rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    required
                  />
                  <span className="text-xs font-bold text-slate-400 w-3">%</span>
                </div>
              </div>

              {/* 5. Kinerja Pengabdian Masyarakat */}
              <div className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    5
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800">Pengabdian Masyarakat (PkM)</span>
                    <span className="ml-2 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Tridharma
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bobotPengabdian}
                    onChange={(e) => setBobotPengabdian(Number(e.target.value))}
                    className="w-16 px-2.5 py-1 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 text-center rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    required
                  />
                  <span className="text-xs font-bold text-slate-400 w-3">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Bobot Indicator */}
          <div
            className={`p-2.5 px-3.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
              isValidTotal
                ? "bg-emerald-50/60 border-emerald-200 text-emerald-800"
                : "bg-rose-50/60 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {isValidTotal ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={15} className="text-rose-500 shrink-0" />
              )}
              <span className="font-semibold text-xs">
                {isValidTotal
                  ? "Total akumulasi bobot tepat 100%"
                  : `Total akumulasi saat ini ${totalBobot}% (wajib tepat 100%)`}
              </span>
            </div>
            <span
              className={`font-bold px-2 py-0.5 rounded text-xs ${
                isValidTotal ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
              }`}
            >
              {totalBobot}%
            </span>
          </div>

          {/* Action Buttons (Standar /master/kelas) */}
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
              disabled={isSubmitting || !isValidTotal}
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
                  <span>Simpan Konfigurasi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
