"use client";
// src/app/(dashboard)/laporan/rapor-dosen/RaporConfigModal.tsx
// Modal Konfigurasi Terpadu: Bobot Penilaian Tridharma & Pengesahan / TTD QAU

import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Loader2,
  PenTool,
  FileCheck,
  Building,
  UserCheck,
  Check,
} from "lucide-react";
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
  // Tab State
  const [activeTab, setActiveTab] = useState<"bobot" | "pengesahan">("bobot");

  // Tab 1: Bobot & Target Sesi
  const [bobotKuesioner, setBobotKuesioner] = useState(initialConfig.bobotKuesioner ?? 40);
  const [bobotKehadiran, setBobotKehadiran] = useState(initialConfig.bobotKehadiran ?? 20);
  const [bobotKonten, setBobotKonten] = useState(initialConfig.bobotKonten ?? 20);
  const [bobotPenelitian, setBobotPenelitian] = useState(initialConfig.bobotPenelitian ?? 10);
  const [bobotPengabdian, setBobotPengabdian] = useState(initialConfig.bobotPengabdian ?? 10);
  const [targetSesi, setTargetSesi] = useState(initialConfig.targetSesi || 16);

  // Tab 2: Pengesahan & TTD QAU
  const [namaPejabat, setNamaPejabat] = useState(initialConfig.namaPejabat || "Dr. Samsul Pahmi, M.Pd.");
  const [nidnPejabat, setNidnPejabat] = useState(initialConfig.nidnPejabat || "0403048803");
  const [jabatanPejabat, setJabatanPejabat] = useState(
    initialConfig.jabatanPejabat || "Kepala Quality Assurance Unit (QAU)"
  );
  const [kotaTerbit, setKotaTerbit] = useState(initialConfig.kotaTerbit || "Sukabumi");
  const [showTtdDigital, setShowTtdDigital] = useState<boolean>(initialConfig.showTtdDigital ?? false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBobotKuesioner(initialConfig.bobotKuesioner ?? 40);
      setBobotKehadiran(initialConfig.bobotKehadiran ?? 20);
      setBobotKonten(initialConfig.bobotKonten ?? 20);
      setBobotPenelitian(initialConfig.bobotPenelitian ?? 10);
      setBobotPengabdian(initialConfig.bobotPengabdian ?? 10);
      setTargetSesi(initialConfig.targetSesi || 16);

      setNamaPejabat(initialConfig.namaPejabat || "Dr. Samsul Pahmi, M.Pd.");
      setNidnPejabat(initialConfig.nidnPejabat || "0403048803");
      setJabatanPejabat(initialConfig.jabatanPejabat || "Kepala Quality Assurance Unit (QAU)");
      setKotaTerbit(initialConfig.kotaTerbit || "Sukabumi");
      setShowTtdDigital(initialConfig.showTtdDigital ?? false);

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

  const handleResetBobotDefault = () => {
    setBobotKuesioner(40);
    setBobotKehadiran(20);
    setBobotKonten(20);
    setBobotPenelitian(10);
    setBobotPengabdian(10);
    setTargetSesi(16);
    setErrorMsg(null);
  };

  const handleResetPengesahanDefault = () => {
    setNamaPejabat("Dr. Samsul Pahmi, M.Pd.");
    setNidnPejabat("0403048803");
    setJabatanPejabat("Kepala Quality Assurance Unit (QAU)");
    setKotaTerbit("Sukabumi");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTotal) {
      setActiveTab("bobot");
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
        namaPejabat: namaPejabat.trim(),
        nidnPejabat: nidnPejabat.trim(),
        jabatanPejabat: jabatanPejabat.trim(),
        kotaTerbit: kotaTerbit.trim(),
        showTtdDigital: Boolean(showTtdDigital),
      });

      if (!res.success) {
        setErrorMsg(res.error || "Gagal menyimpan konfigurasi");
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

        {/* Header */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders size={16} className="text-[#a80063]" />
            <span>Konfigurasi Rapor Mutu Dosen</span>
          </h3>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Standar SPMI & QAU Universitas Nusa Putra • {semesterLabel || "Semester Aktif"}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl mb-4 border border-slate-200/60">
          <button
            type="button"
            onClick={() => setActiveTab("bobot")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "bobot"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <Sliders size={14} className={activeTab === "bobot" ? "text-[#a80063]" : "text-slate-400"} />
            <span>Bobot &amp; Target Sesi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pengesahan")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "pengesahan"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <PenTool size={14} className={activeTab === "pengesahan" ? "text-[#a80063]" : "text-slate-400"} />
            <span>Pengesahan &amp; TTD QAU</span>
            {showTtdDigital && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="TTD Digital Aktif" />
            )}
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: BOBOT PENILAIAN & TARGET SESI
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "bobot" && (
            <div className="space-y-4 animate-fade-in">
              {/* Target Sesi Pertemuan */}
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

              {/* Distribusi Bobot Indikator */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders size={13} className="text-[#a80063]" />
                    <span>Distribusi Bobot 5 Indikator</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetBobotDefault}
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
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: PENGESAHAN & TTD QAU
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "pengesahan" && (
            <div className="space-y-4 animate-fade-in">
              {/* Form Data Pejabat Pengesah */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck size={13} className="text-[#a80063]" />
                    <span>Data Pejabat Pengesah (QAU)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetPengesahanDefault}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a80063] hover:underline cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Data Default</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Nama Pejabat */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Pejabat (Lengkap Gelar)
                    </label>
                    <input
                      type="text"
                      value={namaPejabat}
                      onChange={(e) => setNamaPejabat(e.target.value)}
                      required
                      placeholder="Dr. Samsul Pahmi, M.Pd."
                      className="w-full px-3 py-1.5 bg-white text-xs font-semibold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    />
                  </div>

                  {/* NIDN Pejabat */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      NIDN Pejabat
                    </label>
                    <input
                      type="text"
                      value={nidnPejabat}
                      onChange={(e) => setNidnPejabat(e.target.value)}
                      required
                      placeholder="0403048803"
                      className="w-full px-3 py-1.5 bg-white text-xs font-semibold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    />
                  </div>

                  {/* Jabatan Pengesah */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jabatan Pengesah
                    </label>
                    <input
                      type="text"
                      value={jabatanPejabat}
                      onChange={(e) => setJabatanPejabat(e.target.value)}
                      required
                      placeholder="Kepala Quality Assurance Unit (QAU)"
                      className="w-full px-3 py-1.5 bg-white text-xs font-semibold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    />
                  </div>

                  {/* Kota Penerbitan */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kota Penerbitan Dokumen
                    </label>
                    <input
                      type="text"
                      value={kotaTerbit}
                      onChange={(e) => setKotaTerbit(e.target.value)}
                      required
                      placeholder="Sukabumi"
                      className="w-full px-3 py-1.5 bg-white text-xs font-semibold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Pengaturan Tanda Tangan & Cap Digital */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <PenTool size={13} className="text-[#a80063]" />
                    <span>Tanda Tangan &amp; Cap Digital</span>
                  </span>

                  {/* Toggle Saklar TTD Digital */}
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showTtdDigital}
                      onChange={(e) => setShowTtdDigital(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600 relative"></div>
                    <span className="text-xs font-semibold text-slate-700">
                      {showTtdDigital ? "Tampilkan TTD Digital" : "TTD Basah (Kosong)"}
                    </span>
                  </label>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Jika <strong>Tampilkan TTD Digital</strong> aktif, gambar tanda tangan dan cap stempel digital akan dicetak pada lembar rapor. Jika nonaktif, area tanda tangan dibiarkan kosong untuk tanda tangan basah &amp; cap fisik.
                </p>

                {/* Keterangan Aset Statis & Preview Lembar Cetak */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* File Info Card */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between space-y-2.5">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <FileCheck size={14} className="text-[#a80063]" />
                        <span>Aset Tanda Tangan Resmi</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Sistem memanggil file tanda tangan &amp; stempel resmi terpusat dari direktori:
                      </p>
                      <code className="text-[10px] font-mono text-[#a80063] bg-pink-50 border border-pink-100 px-2 py-1 rounded block mt-1.5 break-all select-all">
                        public/images/ttd-kepala-qau.png
                      </code>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 text-[10.5px] text-slate-500 space-y-1">
                      <p className="flex items-center gap-1 text-emerald-700 font-medium">
                        <Check size={12} /> Terhubung langsung dengan cache browser
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Cetak massal &amp; PDF selalu cepat, ringan, dan tajam.
                      </p>
                    </div>
                  </div>

                  {/* Live Signature Preview Card */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-white text-center font-rockwell space-y-0.5">
                    <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                      Preview Lembar Cetak
                    </span>
                    <p className="text-[9.5px] text-slate-600">
                      {kotaTerbit || "Sukabumi"}, 26 Oktober 2026
                    </p>
                    <p className="text-[10px] font-semibold text-slate-800 leading-tight">
                      Mengetahui,<br />
                      {jabatanPejabat || "Kepala QAU"}
                    </p>

                    {/* Area Gambar TTD Preview */}
                    <div className="h-12 flex items-center justify-center border border-dashed border-slate-200 rounded-md my-0.5 bg-slate-50/50 relative">
                      {showTtdDigital ? (
                        <img
                          src="/images/ttd-kepala-qau.png"
                          alt="Preview TTD"
                          className="max-h-12 w-auto object-contain mx-auto"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-[9px] font-sans text-slate-400 italic">
                          (Ruang tanda tangan basah &amp; cap fisik)
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] font-semibold text-slate-800 underline leading-snug">
                      {namaPejabat || "Dr. Samsul Pahmi, M.Pd."}
                    </p>
                    <p className="text-[9px] text-slate-600 leading-snug">
                      NIDN. {nidnPejabat || "0403048803"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4">
            <span className="text-[11px] text-slate-400">
              * Berlaku untuk lembar rapor semester {semesterLabel || "ini"}.
            </span>

            <div className="flex items-center gap-2">
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
          </div>
        </form>
      </div>
    </div>
  );
}
