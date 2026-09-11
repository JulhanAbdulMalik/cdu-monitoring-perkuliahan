"use client";
// src/components/monitoring/GantiDosenModal.tsx
// Modal Popup Cepat untuk Mengganti Dosen Sesi (Insidental 1 Sesi atau Estafet S1-8 / S9-16)

import { useState, useMemo, useEffect } from "react";
import {
  X,
  User,
  UserCheck,
  UserCog,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { gantiDosenSesiAction } from "@/actions/monitoring";

export interface DosenItemOption {
  id: string;
  nama: string;
  nidn?: string | null;
  prodi?: {
    id: string;
    nama: string;
    kode: string;
  } | null;
}

interface GantiDosenModalProps {
  isOpen: boolean;
  onClose: () => void;
  kelasId: string;
  kodeKelas: string;
  mataKuliahNama: string;
  dosenUtama: {
    id: string;
    nama: string;
    nidn?: string | null;
  };
  dosenList: DosenItemOption[];
  initialTargetMode?: "SINGLE" | "RANGE_S1_8" | "RANGE_S9_16" | "CUSTOM";
  initialSesiNomor?: number;
  initialDosenPengajarId?: string | null;
  initialStatusPengajar?: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
  initialCatatan?: string | null;
  onSuccess?: (result: {
    nomorSesiMulai: number;
    nomorSesiSampai: number;
    dosenPengajarId: string | null;
    statusPengajar: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
    catatanGantiDosen: string | null;
    dosenPengajarObj: DosenItemOption | null;
  }) => void;
}

const CATATAN_PRESETS = [
  "Sakit / Izin",
  "Dinas Luar",
  "Cuti",
  "Evaluasi CDU (Pergantian Dosen)",
  "Jadwal Bentrok",
] as const;

export default function GantiDosenModal({
  isOpen,
  onClose,
  kelasId,
  kodeKelas,
  mataKuliahNama,
  dosenUtama,
  dosenList,
  initialTargetMode = "SINGLE",
  initialSesiNomor = 1,
  initialDosenPengajarId = null,
  initialStatusPengajar = "UTAMA",
  initialCatatan = "",
  onSuccess,
}: GantiDosenModalProps) {
  // Mode Target Sesi
  const [targetMode, setTargetMode] = useState<"SINGLE" | "RANGE_S1_8" | "RANGE_S9_16" | "CUSTOM">(
    initialTargetMode
  );
  const [sesiNomor, setSesiNomor] = useState<number>(initialSesiNomor);
  const [customSesiMulai, setCustomSesiMulai] = useState<number>(initialSesiNomor);
  const [customSesiSampai, setCustomSesiSampai] = useState<number>(16);

  // Dosen Pengganti terpilih
  // Jika null / sama dengan dosenUtama.id -> kembali ke Dosen Utama
  const [selectedDosenId, setSelectedDosenId] = useState<string>(
    initialDosenPengajarId || dosenUtama.id
  );
  const [searchDosenQuery, setSearchDosenQuery] = useState<string>("");

  // Jenis Pergantian
  const [statusPengajar, setStatusPengajar] = useState<"UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP">(
    initialStatusPengajar || "PENGGANTI_INSIDENTAL"
  );
  const [catatan, setCatatan] = useState<string>(initialCatatan || "");
  const [saving, setSaving] = useState<boolean>(false);

  // Sinkronisasi state setiap kali modal dibuka atau sesi/props berubah
  useEffect(() => {
    if (isOpen) {
      setTargetMode(initialTargetMode);
      setSesiNomor(initialSesiNomor);
      setCustomSesiMulai(initialSesiNomor);
      setCustomSesiSampai(16);
      setSelectedDosenId(initialDosenPengajarId || dosenUtama.id);
      setStatusPengajar(initialStatusPengajar || "PENGGANTI_INSIDENTAL");
      setCatatan(initialCatatan || "");
      setSearchDosenQuery("");
    }
  }, [
    isOpen,
    initialTargetMode,
    initialSesiNomor,
    initialDosenPengajarId,
    initialStatusPengajar,
    initialCatatan,
    dosenUtama.id,
  ]);

  // Hitung rentang sesi efektif
  const { sesiMulai, sesiSampai } = useMemo(() => {
    switch (targetMode) {
      case "SINGLE":
        return { sesiMulai: sesiNomor, sesiSampai: sesiNomor };
      case "RANGE_S1_8":
        return { sesiMulai: 1, sesiSampai: 8 };
      case "RANGE_S9_16":
        return { sesiMulai: 9, sesiSampai: 16 };
      case "CUSTOM":
        return {
          sesiMulai: Math.min(customSesiMulai, customSesiSampai),
          sesiSampai: Math.max(customSesiMulai, customSesiSampai),
        };
    }
  }, [targetMode, sesiNomor, customSesiMulai, customSesiSampai]);

  // Filter Dosen List
  const filteredDosen = useMemo(() => {
    if (!searchDosenQuery.trim()) return dosenList;
    const q = searchDosenQuery.toLowerCase();
    return dosenList.filter(
      (d) =>
        d.nama.toLowerCase().includes(q) ||
        (d.nidn && d.nidn.includes(q)) ||
        (d.prodi?.nama && d.prodi.nama.toLowerCase().includes(q)) ||
        (d.prodi?.kode && d.prodi.kode.toLowerCase().includes(q))
    );
  }, [dosenList, searchDosenQuery]);

  const isKembaliKeUtama = selectedDosenId === dosenUtama.id;
  const selectedDosenObj = dosenList.find((d) => d.id === selectedDosenId) || (isKembaliKeUtama ? dosenUtama : null);

  if (!isOpen) return null;

  async function handleApply() {
    setSaving(true);
    try {
      const finalDosenId = isKembaliKeUtama ? null : selectedDosenId;
      const finalStatus = isKembaliKeUtama
        ? "UTAMA"
        : statusPengajar === "UTAMA"
        ? (targetMode === "SINGLE" ? "PENGGANTI_INSIDENTAL" : "PERGANTIAN_TETAP")
        : statusPengajar;

      const res = await gantiDosenSesiAction({
        kelasId,
        nomorSesiMulai: sesiMulai,
        nomorSesiSampai: sesiSampai,
        dosenPengajarId: finalDosenId,
        statusPengajar: finalStatus,
        catatanGantiDosen: isKembaliKeUtama ? null : catatan.trim() || null,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal menyimpan pergantian dosen");
        return;
      }

      toast.success(
        isKembaliKeUtama
          ? `Sesi ${sesiMulai === sesiSampai ? sesiMulai : `${sesiMulai}–${sesiSampai}`} dikembalikan ke Dosen Utama (${dosenUtama.nama})`
          : `Pengajar Sesi ${sesiMulai === sesiSampai ? sesiMulai : `${sesiMulai}–${sesiSampai}`} berhasil diatur ke ${selectedDosenObj?.nama}`
      );

      onSuccess?.({
        nomorSesiMulai: sesiMulai,
        nomorSesiSampai: sesiSampai,
        dosenPengajarId: finalDosenId,
        statusPengajar: finalStatus,
        catatanGantiDosen: isKembaliKeUtama ? null : catatan.trim() || null,
        dosenPengajarObj: isKembaliKeUtama ? null : (selectedDosenObj as DosenItemOption),
      });

      onClose();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* ── 1. Modal Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-[#fdf2f8] to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#a80063] text-white flex items-center justify-center shadow-xs">
              <UserCog size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Kelola Pengajar & Ganti Dosen
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                [{kodeKelas}] {mataKuliahNama}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup (ESC)"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── 2. Modal Body (Scrollable) ────────────────────────────────────── */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Info Dosen Utama Saat Ini */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 font-bold">
                <User size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                  Dosen Utama Kelas
                </p>
                <p className="text-xs font-bold text-slate-900 mt-1 truncate" title={dosenUtama.nama}>
                  {dosenUtama.nama}
                </p>
                {dosenUtama.nidn && (
                  <p className="text-[10px] text-slate-500 mt-0.5">NIDN: {dosenUtama.nidn}</p>
                )}
              </div>
            </div>

            {selectedDosenId !== dosenUtama.id && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDosenId(dosenUtama.id);
                  setStatusPengajar("UTAMA");
                  setCatatan("");
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#a80063] text-[11px] font-bold text-[#a80063] transition-all shadow-2xs shrink-0 cursor-pointer"
                title="Gunakan Dosen Utama"
              >
                <RefreshCw size={11} />
                <span>Reset ke Utama</span>
              </button>
            )}
          </div>

          {/* Cakupan Sesi (Target Mode) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Cakupan Sesi yang Diganti:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setTargetMode("SINGLE")}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  targetMode === "SINGLE"
                    ? "border-[#a80063] bg-[#fdf2f8] text-[#a80063] shadow-xs ring-1 ring-[#a80063]"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className="block text-xs">Sesi {sesiNomor}</span>
                <span className="block text-[9px] font-normal text-slate-500 mt-0.5">1 Sesi Saja</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetMode("RANGE_S1_8");
                  setStatusPengajar("PERGANTIAN_TETAP");
                }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  targetMode === "RANGE_S1_8"
                    ? "border-[#a80063] bg-[#fdf2f8] text-[#a80063] shadow-xs ring-1 ring-[#a80063]"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className="block text-xs">Sesi 1 – 8</span>
                <span className="block text-[9px] font-normal text-slate-500 mt-0.5">Pra-UTS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetMode("RANGE_S9_16");
                  setStatusPengajar("PERGANTIAN_TETAP");
                }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  targetMode === "RANGE_S9_16"
                    ? "border-[#a80063] bg-[#fdf2f8] text-[#a80063] shadow-xs ring-1 ring-[#a80063]"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className="block text-xs">Sesi 9 – 16</span>
                <span className="block text-[9px] font-normal text-slate-500 mt-0.5">Pasca-UTS</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetMode("CUSTOM")}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  targetMode === "CUSTOM"
                    ? "border-[#a80063] bg-[#fdf2f8] text-[#a80063] shadow-xs ring-1 ring-[#a80063]"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className="block text-xs">Rentang</span>
                <span className="block text-[9px] font-normal text-slate-500 mt-0.5">Kustom</span>
              </button>
            </div>

            {/* Custom Range Selector */}
            {targetMode === "CUSTOM" && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px] font-medium">Mulai:</span>
                  <select
                    value={customSesiMulai}
                    onChange={(e) => setCustomSesiMulai(Number(e.target.value))}
                    className="px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800 outline-none"
                  >
                    {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Sesi {n}
                      </option>
                    ))}
                  </select>
                </div>

                <ArrowRight size={14} className="text-slate-400" />

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px] font-medium">Sampai:</span>
                  <select
                    value={customSesiSampai}
                    onChange={(e) => setCustomSesiSampai(Number(e.target.value))}
                    className="px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800 outline-none"
                  >
                    {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Sesi {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Single Session Selector */}
            {targetMode === "SINGLE" && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">Pilih nomor sesi:</span>
                <select
                  value={sesiNomor}
                  onChange={(e) => setSesiNomor(Number(e.target.value))}
                  className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 outline-none"
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Sesi {n} {n === 8 ? "(UTS)" : n === 16 ? "(UAS)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Pilih Dosen Pengajar / Pengganti */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Pilih Dosen Pengajar:
              </label>
              <span className="text-[10px] text-slate-400">
                Total {dosenList.length} Dosen Terdaftar
              </span>
            </div>

            {/* Search Box Dosen */}
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchDosenQuery}
                onChange={(e) => setSearchDosenQuery(e.target.value)}
                placeholder="Ketik nama dosen, NIDN, atau prodi..."
                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:border-[#a80063] focus:bg-white"
              />
            </div>

            {/* Dosen Picker List (Scrollable Card) */}
            <div className="border border-slate-200 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100 bg-white">
              {/* Opsi 1: Dosen Utama */}
              <button
                type="button"
                onClick={() => {
                  setSelectedDosenId(dosenUtama.id);
                  setStatusPengajar("UTAMA");
                }}
                className={`w-full text-left p-2.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  selectedDosenId === dosenUtama.id
                    ? "bg-[#fdf2f8] font-bold text-[#a80063]"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{dosenUtama.nama}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-bold border border-slate-200 shrink-0">
                      Dosen Utama
                    </span>
                  </div>
                  {dosenUtama.nidn && (
                    <p className="text-[10px] text-slate-400 font-normal">NIDN: {dosenUtama.nidn}</p>
                  )}
                </div>
                {selectedDosenId === dosenUtama.id && (
                  <CheckCircle2 size={15} className="text-[#a80063] shrink-0" />
                )}
              </button>

              {/* Opsi Dosen Lainnya */}
              {filteredDosen
                .filter((d) => d.id !== dosenUtama.id)
                .map((d) => {
                  const isSelected = selectedDosenId === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelectedDosenId(d.id);
                        if (statusPengajar === "UTAMA") {
                          setStatusPengajar(
                            targetMode === "SINGLE" ? "PENGGANTI_INSIDENTAL" : "PERGANTIAN_TETAP"
                          );
                        }
                      }}
                      className={`w-full text-left p-2.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-[#fdf2f8] font-bold text-[#a80063]"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{d.nama}</p>
                        <p className="text-[10px] text-slate-400 font-normal truncate">
                          {d.nidn ? `NIDN: ${d.nidn}` : "Tanpa NIDN"}{" "}
                          {d.prodi?.nama ? `• ${d.prodi.nama}` : ""}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={15} className="text-[#a80063] shrink-0" />
                      )}
                    </button>
                  );
                })}

              {filteredDosen.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs">
                  Tidak ada dosen yang cocok dengan pencarian.
                </div>
              )}
            </div>
          </div>

          {/* Status & Jenis Pergantian */}
          {!isKembaliKeUtama && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Jenis Pergantian Dosen:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      statusPengajar === "PENGGANTI_INSIDENTAL"
                        ? "border-amber-400 bg-amber-50/60 ring-1 ring-amber-400"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusPengajar"
                      value="PENGGANTI_INSIDENTAL"
                      checked={statusPengajar === "PENGGANTI_INSIDENTAL"}
                      onChange={() => setStatusPengajar("PENGGANTI_INSIDENTAL")}
                      className="mt-0.5 accent-amber-600"
                    />
                    <div>
                      <span className="font-bold text-xs text-amber-900 block">
                        Dosen Pengganti Sementara
                      </span>
                      {/* <span className="text-[10px] text-slate-500 leading-snug block mt-0.5">
                        Dosen utama berhalangan (sakit, dinas luar, cuti) khusus sesi ini.
                      </span> */}
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      statusPengajar === "PERGANTIAN_TETAP"
                        ? "border-[#a80063] bg-[#fdf2f8] ring-1 ring-[#a80063]"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusPengajar"
                      value="PERGANTIAN_TETAP"
                      checked={statusPengajar === "PERGANTIAN_TETAP"}
                      onChange={() => setStatusPengajar("PERGANTIAN_TETAP")}
                      className="mt-0.5 accent-[#a80063]"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        Pergantian Resmi (Definitif)
                      </span>
                      {/* <span className="text-[10px] text-slate-500 leading-snug block mt-0.5">
                        Evaluasi CDU / SK Dekan: Resmi menggantikan sesi selanjutnya (misal S9–16).
                      </span> */}
                    </div>
                  </label>
                </div>
              </div>

              {/* Catatan Alasan Pergantian */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Alasan / Keterangan Pergantian (Opsional):
                </label>
                <input
                  type="text"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Alasan..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:border-[#a80063] focus:bg-white"
                />

                {/* Preset Chips */}
                {/* <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-400">Preset:</span>
                  {CATATAN_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCatatan(p)}
                      className="px-2 py-0.5 rounded text-[9.5px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 transition-colors cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div> */}

              </div>
            </div>
          )}

          {/* Preview Ringkasan Perubahan */}
          <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-[11px] space-y-1">
            <span className="font-bold text-slate-700 block">Ringkasan Konfigurasi:</span>
            <div className="flex items-center gap-2 text-slate-600">
              <span>Sesi Target:</span>
              <strong className="text-slate-900">
                Sesi {sesiMulai === sesiSampai ? sesiMulai : `${sesiMulai} s/d ${sesiSampai}`}
              </strong>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span>Pengajar:</span>
              <strong className="text-slate-900">
                {selectedDosenObj?.nama || dosenUtama.nama}
                {isKembaliKeUtama && " (Dosen Utama)"}
              </strong>
            </div>
            {!isKembaliKeUtama && (
              <div className="flex items-center gap-2 text-slate-600">
                <span>Status:</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                    statusPengajar === "PERGANTIAN_TETAP"
                      ? "bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {statusPengajar === "PERGANTIAN_TETAP"
                    ? "Pergantian Resmi (Definitif)"
                    : "Dosen Pengganti Sementara"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Modal Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#a80063] hover:bg-[#8e0054] text-white text-xs font-bold transition-all shadow-md shadow-[#a80063]/25 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>
                  {isKembaliKeUtama ? "Kembalikan ke Dosen Utama" : "Terapkan Pergantian Dosen"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
