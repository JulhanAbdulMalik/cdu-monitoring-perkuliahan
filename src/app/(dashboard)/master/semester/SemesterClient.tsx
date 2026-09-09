"use client";
// src/app/(dashboard)/master/semester/SemesterClient.tsx
// Compact & Clean Semester Management UI (Plus Jakarta Sans & #a80063 Theme)

import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Plus,
  CheckCircle2,
  Edit2,
  Trash2,
  School,
  Sparkles,
  Loader2,
  X,
  FileSpreadsheet,
  Palmtree,
  CalendarDays,
  Info,
} from "lucide-react";
import {
  createSemester,
  updateSemester,
  toggleSemesterAktif,
  deleteSemester,
  getSemesters,
  createLiburSemester,
  deleteLiburSemester,
} from "@/actions/semester";
import MasterImportModal from "@/components/master/MasterImportModal";
import { parseSemesterExcel, commitSemesterImport } from "@/actions/master-import";

export interface LiburSemesterData {
  id: string;
  semesterId: string;
  nama: string;
  tanggalMulai: Date | string;
  tanggalSelesai: Date | string;
  keterangan?: string | null;
}

interface SemesterData {
  id: string;
  tahunAkademik: string;
  periode: "GANJIL" | "GENAP";
  aktif: boolean;
  tanggalMulai?: Date | string | null;
  createdAt: Date;
  hariLibur?: LiburSemesterData[];
  _count: {
    kelas: number;
  };
}

interface SemesterClientProps {
  initialData: SemesterData[];
}

export default function SemesterClient({ initialData }: SemesterClientProps) {
  const [semesters, setSemesters] = useState<SemesterData[]>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<SemesterData | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal Hari Libur Perkuliahan states
  const [isLiburModalOpen, setIsLiburModalOpen] = useState(false);
  const [selectedSemesterForLibur, setSelectedSemesterForLibur] = useState<SemesterData | null>(null);
  const [namaLibur, setNamaLibur] = useState("");
  const [isRentang, setIsRentang] = useState(false);
  const [tanggalMulaiLibur, setTanggalMulaiLibur] = useState("");
  const [tanggalSelesaiLibur, setTanggalSelesaiLibur] = useState("");
  const [keteranganLibur, setKeteranganLibur] = useState("");
  const [loadingLibur, setLoadingLibur] = useState(false);
  const [confirmDeleteLiburId, setConfirmDeleteLiburId] = useState<string | null>(null);
  const [isDeletingLibur, setIsDeletingLibur] = useState(false);

  // Form states
  const [tahunAkademik, setTahunAkademik] = useState("2025/2026");
  const [periode, setPeriode] = useState<"GANJIL" | "GENAP">("GANJIL");
  const [aktif, setAktif] = useState(false);
  const [tanggalMulai, setTanggalMulai] = useState("2026-09-21");

  function openCreateModal() {
    setEditingSemester(null);
    setTahunAkademik("2025/2026");
    setPeriode("GANJIL");
    setAktif(false);
    setTanggalMulai("2026-09-21");
    setIsModalOpen(true);
  }

  function openEditModal(semester: SemesterData) {
    setEditingSemester(semester);
    setTahunAkademik(semester.tahunAkademik);
    setPeriode(semester.periode);
    setAktif(semester.aktif);
    const initialTgl = semester.tanggalMulai
      ? new Date(semester.tanggalMulai).toISOString().split("T")[0]
      : "2026-09-21";
    setTanggalMulai(initialTgl);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingSemester(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingSemester) {
        // Update
        const res = await updateSemester(editingSemester.id, {
          tahunAkademik,
          periode,
          aktif,
          tanggalMulai,
        });

        if (!res.success) {
          toast.error(res.error || "Gagal memperbarui semester");
        } else {
          toast.success("Semester berhasil diperbarui");
          closeModal();
          // Update local state
          setSemesters((prev) =>
            prev.map((s) => {
              if (s.id === editingSemester.id) {
                return { ...s, tahunAkademik, periode, aktif, tanggalMulai: new Date(tanggalMulai) };
              }
              if (aktif && s.id !== editingSemester.id) {
                return { ...s, aktif: false };
              }
              return s;
            })
          );
        }
      } else {
        // Create
        const res = await createSemester({
          tahunAkademik,
          periode,
          aktif,
          tanggalMulai,
        });

        if (!res.success) {
          toast.error(res.error || "Gagal menambahkan semester baru");
        } else {
          toast.success("Semester baru berhasil ditambahkan");
          closeModal();
          const newSem = {
            ...(res.data as any),
            createdAt: new Date(),
            _count: { kelas: 0 },
          };
          setSemesters((prev) => {
            if (aktif) {
              return [newSem, ...prev.map((s) => ({ ...s, aktif: false }))];
            }
            return [newSem, ...prev];
          });
        }
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAktif(id: string) {
    const sem = semesters.find((s) => s.id === id);
    if (sem?.aktif) return; // sudah aktif

    const res = await toggleSemesterAktif(id);
    if (!res.success) {
      toast.error(res.error || "Gagal mengaktifkan semester");
    } else {
      toast.success(`Semester ${sem?.tahunAkademik} (${sem?.periode}) sekarang aktif`);
      setSemesters((prev) =>
        prev.map((s) => ({
          ...s,
          aktif: s.id === id,
        }))
      );
    }
  }

  async function handleDelete(id: string) {
    const sem = semesters.find((s) => s.id === id);
    if (!confirm(`Hapus semester ${sem?.tahunAkademik} (${sem?.periode})?`)) return;

    const res = await deleteSemester(id);
    if (!res.success) {
      toast.error(res.error || "Gagal menghapus semester");
    } else {
      toast.success("Semester berhasil dihapus");
      setSemesters((prev) => prev.filter((s) => s.id !== id));
    }
  }

  function formatTglDisplay(dateInput?: Date | string | null) {
    if (!dateInput) return "21 Sep 2026 (Default)";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "21 Sep 2026 (Default)";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  function openLiburModal(semester: SemesterData) {
    setSelectedSemesterForLibur(semester);
    setNamaLibur("");
    setIsRentang(false);
    const defTgl = semester.tanggalMulai
      ? new Date(semester.tanggalMulai).toISOString().split("T")[0]
      : "2026-09-21";
    setTanggalMulaiLibur(defTgl);
    setTanggalSelesaiLibur(defTgl);
    setKeteranganLibur("");
    setIsLiburModalOpen(true);
  }

  function closeLiburModal() {
    setIsLiburModalOpen(false);
    setSelectedSemesterForLibur(null);
    setConfirmDeleteLiburId(null);
  }

  async function handleAddLibur(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSemesterForLibur) return;
    if (!namaLibur.trim()) {
      toast.error("Nama hari libur wajib diisi");
      return;
    }

    const tglSelesai = isRentang ? tanggalSelesaiLibur : tanggalMulaiLibur;
    if (new Date(tglSelesai) < new Date(tanggalMulaiLibur)) {
      toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai");
      return;
    }

    setLoadingLibur(true);
    try {
      const res = await createLiburSemester({
        semesterId: selectedSemesterForLibur.id,
        nama: namaLibur.trim(),
        tanggalMulai: tanggalMulaiLibur,
        tanggalSelesai: tglSelesai,
        keterangan: keteranganLibur.trim() || null,
      });

      if (!res.success || !res.data) {
        toast.error(res.error || "Gagal menambahkan hari libur");
      } else {
        toast.success(`Hari libur "${namaLibur}" berhasil ditambahkan`);
        const newLibur = res.data as LiburSemesterData;
        const currentLibur = selectedSemesterForLibur.hariLibur || [];
        const updatedList = [...currentLibur, newLibur].sort(
          (a, b) => new Date(a.tanggalMulai).getTime() - new Date(b.tanggalMulai).getTime()
        );

        setSelectedSemesterForLibur({
          ...selectedSemesterForLibur,
          hariLibur: updatedList,
        });

        setSemesters((prev) =>
          prev.map((s) =>
            s.id === selectedSemesterForLibur.id ? { ...s, hariLibur: updatedList } : s
          )
        );

        setNamaLibur("");
        setKeteranganLibur("");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setLoadingLibur(false);
    }
  }

  async function handleDeleteLibur(liburId: string, liburNama: string) {
    if (!selectedSemesterForLibur) return;

    setIsDeletingLibur(true);
    try {
      const res = await deleteLiburSemester(liburId);
      if (!res.success) {
        toast.error(res.error || "Gagal menghapus hari libur");
      } else {
        toast.success(`Hari libur "${liburNama}" berhasil dihapus`);
        const updatedList = (selectedSemesterForLibur.hariLibur || []).filter(
          (l) => l.id !== liburId
        );

        setSelectedSemesterForLibur({
          ...selectedSemesterForLibur,
          hariLibur: updatedList,
        });

        setSemesters((prev) =>
          prev.map((s) =>
            s.id === selectedSemesterForLibur.id ? { ...s, hariLibur: updatedList } : s
          )
        );
        setConfirmDeleteLiburId(null);
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsDeletingLibur(false);
    }
  }

  function formatRentangLibur(startInput: Date | string, endInput: Date | string) {
    const dStart = new Date(startInput);
    const dEnd = new Date(endInput);
    const sStr = dStart.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    const eStr = dEnd.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

    const diffDays = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const durasiStr = diffDays > 1 ? `${diffDays} hari` : `1 hari`;

    if (sStr === eStr) {
      return { tanggal: sStr, durasi: durasiStr };
    }
    return { tanggal: `${sStr} - ${eStr}`, durasi: durasiStr };
  }

  return (
    <div className="space-y-4">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <Calendar size={18} className="text-[#a80063]" />
            <span>Kelola Data Semester</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Atur tahun akademik dan tentukan semester aktif untuk acuan monitoring perkuliahan
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            <span>Import Excel</span>
          </button>

          <button
            onClick={openCreateModal}
            className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Tambah Semester</span>
          </button>
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div className="duralux-card bg-white p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-2.5 font-bold">Tahun Akademik</th>
                <th className="pb-2.5 font-bold">Periode</th>
                <th className="pb-2.5 font-bold">Mulai Kuliah (Sesi 1)</th>
                <th className="pb-2.5 font-bold">Libur Perkuliahan</th>
                <th className="pb-2.5 font-bold">Total Kelas Terdaftar</th>
                <th className="pb-2.5 font-bold">Status Sistem</th>
                <th className="pb-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {semesters.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                    Belum ada data semester. Silakan klik tombol "Tambah Semester" di atas.
                  </td>
                </tr>
              ) : (
                semesters.map((sem) => {
                  const jumlahLibur = sem.hariLibur?.length || 0;
                  return (
                  <tr key={sem.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Tahun Akademik */}
                    <td className="py-3 pr-3 font-semibold text-slate-900">
                      <span className="text-xs">{sem.tahunAkademik}</span>
                    </td>

                    {/* Periode */}
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          sem.periode === "GANJIL"
                            ? "bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]"
                            : "bg-blue-50 text-blue-600 border border-blue-200"
                        }`}
                      >
                        {sem.periode}
                      </span>
                    </td>

                    {/* Mulai Kuliah Sesi 1 */}
                    <td className="py-3 pr-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200">
                        <Calendar size={12} className="text-[#a80063]" />
                        <span>{formatTglDisplay(sem.tanggalMulai)}</span>
                      </div>
                    </td>

                    {/* Libur Perkuliahan */}
                    <td className="py-3 pr-3">
                      <button
                        onClick={() => openLiburModal(sem)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          jumlahLibur > 0
                            ? "bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 hover:border-amber-300 font-semibold shadow-xs"
                            : "bg-slate-50 text-slate-500 border border-dashed border-slate-300 hover:text-[#a80063] hover:border-[#a80063]/40 hover:bg-[#fdf2f8]"
                        }`}
                        title="Klik untuk melihat dan mengatur hari libur perkuliahan"
                      >
                        <span>{jumlahLibur > 0 ? `${jumlahLibur} Hari/Periode Libur` : "+ Atur Libur (0)"}</span>
                      </button>
                    </td>

                    {/* Total Kelas */}
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                        <School size={13} className="text-slate-400" />
                        <span>{sem._count.kelas} Kelas</span>
                      </div>
                    </td>

                    {/* Status Aktif */}
                    <td className="py-3 pr-3">
                      {sem.aktif ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                          <CheckCircle2 size={11} />
                          <span>Semester Aktif</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleAktif(sem.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 hover:text-[#a80063] hover:bg-[#fdf2f8] border border-slate-200/80 hover:border-[#fbcfe8] transition-all cursor-pointer"
                        >
                          <Sparkles size={10} />
                          <span>Jadikan Aktif</span>
                        </button>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(sem)}
                          className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                          title="Edit Semester"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(sem.id)}
                          disabled={sem.aktif || sem._count.kelas > 0}
                          className="w-7 h-7 rounded-md bg-slate-50 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                          title={
                            sem.aktif
                              ? "Tidak dapat menghapus semester aktif"
                              : sem._count.kelas > 0
                              ? "Ada kelas terdaftar di semester ini"
                              : "Hapus Semester"
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200 relative">
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {editingSemester ? "Edit Data Semester" : "Tambah Semester Baru"}
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Isi tahun akademik, periode, dan tanggal mulai perkuliahan
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Tahun Akademik */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tahun Akademik
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 2025/2026"
                  value={tahunAkademik}
                  onChange={(e) => setTahunAkademik(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                />
                <span className="text-[10px] text-slate-400">Format: YYYY/YYYY (contoh: 2025/2026)</span>
              </div>

              {/* Periode */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Periode Semester
                </label>
                <select
                  value={periode}
                  onChange={(e) => setPeriode(e.target.value as "GANJIL" | "GENAP")}
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                >
                  <option value="GANJIL">GANJIL</option>
                  <option value="GENAP">GENAP</option>
                </select>
              </div>

              {/* Tanggal Mulai Perkuliahan Sesi 1 */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tanggal Mulai Kuliah (Sesi 1)
                </label>
                <input
                  type="date"
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                />
                <span className="text-[10px] text-slate-400">
                  Acuan resmi awal Sesi 1 (default: 21 September 2026)
                </span>
              </div>

              {/* Checkbox Jadikan Aktif */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="aktif-checkbox"
                  checked={aktif}
                  onChange={(e) => setAktif(e.target.checked)}
                  className="w-4 h-4 rounded text-[#a80063] focus:ring-[#a80063] border-slate-300"
                />
                <label htmlFor="aktif-checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Jadikan sebagai semester aktif saat ini
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {loading && <Loader2 size={12} className="animate-spin" />}
                  <span>{editingSemester ? "Simpan Perubahan" : "Tambah Semester"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Kelola Hari Libur Perkuliahan ─────────────────────────────────── */}
      {isLiburModalOpen && selectedSemesterForLibur && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] flex flex-col">
            {/* Close Button */}
            <button
              onClick={closeLiburModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="mb-4 pr-6">
              <div className="flex items-center gap-2 mb-1">
                {/* <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                  <Palmtree size={16} />
                </span> */}
                <h3 className="text-base font-bold text-slate-900">
                  Libur Perkuliahan — {selectedSemesterForLibur.tahunAkademik} ({selectedSemesterForLibur.periode})
                </h3>
              </div>
              {/* <p className="text-xs text-slate-500 leading-relaxed">
                Atur tanggal merah, minggu tenang, dan masa libur. Tanggal sesi perkuliahan pada lembar monitoring yang masuk ke hari libur ini akan <strong>otomatis dilewatkan ke minggu berikutnya</strong>.
              </p> */}
            </div>

            {/* Modal Body - Scrollable */}
            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {/* ── Form Tambah Hari Libur ─────────────────────────────── */}
              <form
                onSubmit={handleAddLibur}
                className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Plus size={13} className="text-[#a80063]" />
                    <span>Tambah Hari / Periode Libur Baru</span>
                  </span>

                  {/* Toggle Jenis: 1 Hari vs Rentang */}
                  <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setIsRentang(false)}
                      className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                        !isRentang
                          ? "bg-white text-slate-900 font-bold shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      1 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRentang(true);
                        if (!tanggalSelesaiLibur) setTanggalSelesaiLibur(tanggalMulaiLibur);
                      }}
                      className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                        isRentang
                          ? "bg-white text-slate-900 font-bold shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Rentang Periode
                    </button>
                  </div>
                </div>

                {/* Nama Libur */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Nama / Keterangan Libur <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Minggu Tenang UTS, Tahun Baru Masehi, Libur Remedial"
                    value={namaLibur}
                    onChange={(e) => setNamaLibur(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                  />
                </div>

                {/* Input Tanggal */}
                {!isRentang ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Tanggal Libur <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tanggalMulaiLibur}
                      onChange={(e) => {
                        setTanggalMulaiLibur(e.target.value);
                        setTanggalSelesaiLibur(e.target.value);
                      }}
                      required
                      className="w-full px-3 py-1.5 bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Tanggal Mulai <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={tanggalMulaiLibur}
                        onChange={(e) => setTanggalMulaiLibur(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Tanggal Selesai <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={tanggalSelesaiLibur}
                        onChange={(e) => setTanggalSelesaiLibur(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Keterangan Opsional */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Sesi perkuliahan reguler digeser ke pekan depan"
                    value={keteranganLibur}
                    onChange={(e) => setKeteranganLibur(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                  />
                </div>

                {/* Tombol Simpan Libur */}
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={loadingLibur}
                    className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    {loadingLibur ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />}
                    <span>Tambahkan Hari Libur</span>
                  </button>
                </div>
              </form>

              {/* ── Daftar Hari Libur Terdaftar ─────────────────────────── */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays size={13} className="text-slate-500" />
                    <span>Daftar Hari Libur Terdaftar ({selectedSemesterForLibur.hariLibur?.length || 0})</span>
                  </h4>
                </div>

                {!selectedSemesterForLibur.hariLibur || selectedSemesterForLibur.hariLibur.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                    <Palmtree size={24} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-600">
                      Belum ada tanggal libur perkuliahan terdaftar
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Gunakan formulir di atas untuk menginput tanggal merah atau minggu tenang
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedSemesterForLibur.hariLibur.map((item) => {
                      const rentang = formatRentangLibur(item.tanggalMulai, item.tanggalSelesai);
                      return (
                        <div
                          key={item.id}
                          className="flex items-start justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/20 transition-all group shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{item.nama}</span>
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                {rentang.durasi}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                              <Calendar size={12} className="text-[#a80063]" />
                              <span>{rentang.tanggal}</span>
                            </div>
                            {item.keterangan && (
                              <p className="text-[11px] text-slate-400 italic">
                                {item.keterangan}
                              </p>
                            )}
                          </div>

                          {confirmDeleteLiburId === item.id ? (
                            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1 text-xs animate-fade-in shrink-0">
                              <span className="text-[11px] font-bold text-rose-700">Hapus?</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteLibur(item.id, item.nama)}
                                disabled={isDeletingLibur}
                                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                              >
                                {isDeletingLibur ? <Loader2 size={11} className="animate-spin" /> : "Ya"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteLiburId(null)}
                                disabled={isDeletingLibur}
                                className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 font-medium text-[11px] border border-slate-200 cursor-pointer transition-all"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteLiburId(item.id)}
                              disabled={isDeletingLibur}
                              className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 flex items-center justify-center transition-all cursor-pointer shrink-0"
                              title={`Hapus libur ${item.nama}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={closeLiburModal}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer border border-slate-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Import Modal ─────────────────────────────────────────────────── */}
      <MasterImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Data Semester dari Excel"
        type="semester"
        parseAction={parseSemesterExcel}
        commitAction={commitSemesterImport}
        onSuccess={async () => {
          const res = await getSemesters();
          if (res.success && res.data) {
            setSemesters(res.data as any);
          }
        }}
      />
    </div>
  );
}
