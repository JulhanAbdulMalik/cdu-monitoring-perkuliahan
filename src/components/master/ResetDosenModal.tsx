"use client";
// src/components/master/ResetDosenModal.tsx
// Modal Konfirmasi Cerdas untuk Reset / Pembersihan Data Master Dosen
// Sesuai tema Duralux modern (#a80063 magenta, font Plus Jakarta Sans)

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Trash2,
  Loader2,
  X,
  School,
  Layers,
  CheckSquare,
  Square,
  ShieldAlert,
  GraduationCap,
} from "lucide-react";
import { getResetDosenStats, resetDosenData, ResetDosenStats } from "@/actions/dosen";

interface ProdiOption {
  id: string;
  nama: string;
  kode: string;
}

interface ResetDosenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prodiList: ProdiOption[];
  defaultProdiId?: string;
}

export default function ResetDosenModal({
  isOpen,
  onClose,
  onSuccess,
  prodiList,
  defaultProdiId = "ALL",
}: ResetDosenModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedProdi, setSelectedProdi] = useState<string>(defaultProdiId);
  const [onlyZeroClasses, setOnlyZeroClasses] = useState<boolean>(true);

  const [confirmationInput, setConfirmationInput] = useState("");
  const [stats, setStats] = useState<ResetDosenStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set default prodi saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setSelectedProdi(defaultProdiId || "ALL");
      setConfirmationInput("");
      setOnlyZeroClasses(true);
    }
  }, [isOpen, defaultProdiId]);

  // Fetch live statistics setiap kali filter prodi berubah
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    setStatsLoading(true);

    getResetDosenStats({
      prodiId: selectedProdi,
    })
      .then((res) => {
        if (isSubscribed && res.success && res.data) {
          setStats(res.data);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat statistik reset dosen:", err);
      })
      .finally(() => {
        if (isSubscribed) setStatsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, selectedProdi]);

  if (!mounted || !isOpen) return null;

  const isConfirmed = confirmationInput.trim().toUpperCase() === "HAPUS";
  const targetDeleteCount = stats ? (onlyZeroClasses ? stats.zeroClassCount : stats.totalCount) : 0;
  const hasDataToDelete = targetDeleteCount > 0;

  async function handleExecuteReset() {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await resetDosenData({
        prodiId: selectedProdi,
        onlyZeroClasses,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal membersihkan data dosen");
      } else {
        toast.success(`Berhasil membersihkan ${res.countDosen} data dosen!`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat mengeksekusi reset");
    } finally {
      setIsDeleting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-rose-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
              <Trash2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Bersihkan Data Master Dosen</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-full">
                  Tindakan Permanen
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kosongkan data dosen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-all cursor-pointer disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Filter Scope Controls */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-[#a80063]" />
              <span>Pilih Lingkup Pembersihan Dosen</span>
            </div>

            {/* Prodi Selector */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center gap-1">
                <School size={12} className="text-slate-400" />
                <span>Program Studi</span>
              </label>
              <select
                value={selectedProdi}
                onChange={(e) => setSelectedProdi(e.target.value)}
                disabled={isDeleting}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800 outline-none focus:border-[#fbcfe8] focus:ring-1 focus:ring-[#fbcfe8]"
              >
                <option value="ALL">Semua Program Studi</option>
                {prodiList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.kode} - {p.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkbox Hanya Hapus Dosen 0 Kelas */}
            <div className="pt-1">
              <label
                onClick={() => !isDeleting && setOnlyZeroClasses(!onlyZeroClasses)}
                className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer select-none hover:text-slate-900"
              >
                {onlyZeroClasses ? (
                  <CheckSquare size={16} className="text-rose-600 shrink-0" />
                ) : (
                  <Square size={16} className="text-slate-400 shrink-0" />
                )}
                <span className="text-[11px]">
                  Hanya hapus dosen yang tidak mengampu kelas aktif (0 kelas)
                </span>
              </label>
            </div>
          </div>

          {/* Live Impact Preview Box */}
          <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                <ShieldAlert size={14} />
                <span>Rincian Data Dosen</span>
              </div>
              {statsLoading && (
                <div className="flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Menghitung...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/90 p-2 rounded-lg border border-rose-100 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-medium">Total Dosen</div>
                <div className="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5">
                  {statsLoading ? "-" : stats?.totalCount.toLocaleString("id-ID") || 0}
                </div>
              </div>
              <div className="bg-white/90 p-2 rounded-lg border border-rose-100 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-medium">Siap Dihapus (0 Kelas)</div>
                <div className="text-sm sm:text-base font-extrabold text-rose-600 mt-0.5">
                  {statsLoading ? "-" : stats?.zeroClassCount.toLocaleString("id-ID") || 0}
                </div>
              </div>
              <div className="bg-white/90 p-2 rounded-lg border border-rose-100 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-medium">Mengampu Kelas</div>
                <div className="text-sm sm:text-base font-extrabold text-amber-600 mt-0.5">
                  {statsLoading ? "-" : stats?.hasClassCount.toLocaleString("id-ID") || 0}
                </div>
              </div>
            </div>

            {stats && stats.hasClassCount > 0 && !onlyZeroClasses && (
              <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 leading-relaxed font-medium">
                Perhatian: Terdapat {stats.hasClassCount} dosen yang masih memiliki kelas aktif. Anda disarankan
                membersihkan Data Perkuliahan terlebih dahulu sebelum menghapus dosen ini.
              </div>
            )}

            <div className="text-[11px] text-rose-700 leading-relaxed">
              Peringatan: Data dosen yang dihapus tidak dapat dipulihkan kembali. Data program studi dan master lainnya tetap aman.
            </div>
          </div>

          {/* Safety Gate: Type 'HAPUS' */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-[11px] font-semibold text-slate-700">
              Ketik kata <span className="font-bold text-rose-600">HAPUS</span> di bawah ini untuk
              membuka kunci konfirmasi:
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="Ketik HAPUS di sini..."
              disabled={isDeleting || !hasDataToDelete}
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-semibold transition-all ${
                isConfirmed
                  ? "bg-rose-50 border-rose-300 text-rose-700 placeholder:text-rose-300"
                  : "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-rose-300 focus:bg-white"
              }`}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExecuteReset}
            disabled={!isConfirmed || isDeleting || !hasDataToDelete || statsLoading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isConfirmed && hasDataToDelete && !isDeleting && !statsLoading
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isDeleting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Sedang Membersihkan...</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>
                  Hapus Permanen ({targetDeleteCount} Dosen)
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
