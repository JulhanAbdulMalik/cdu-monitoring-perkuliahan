"use client";
// src/app/(dashboard)/master/mata-kuliah/MataKuliahClient.tsx
// Compact & Clean Mata Kuliah Management UI (Plus Jakarta Sans & #a80063 Theme)

import { useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Search,
  School,
  Loader2,
  X,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";
import {
  createMataKuliah,
  updateMataKuliah,
  deleteMataKuliah,
  getMataKuliahList,
} from "@/actions/mata-kuliah";
import MasterImportModal from "@/components/master/MasterImportModal";
import { parseMataKuliahExcel, commitMataKuliahImport } from "@/actions/master-import";

interface MataKuliahItem {
  id: string;
  kode: string;
  nama: string;
  sks: number;
  prodiId: string;
  prodi: {
    id: string;
    nama: string;
    kode: string;
  };
  _count: {
    kelas: number;
  };
}

interface ProdiOption {
  id: string;
  nama: string;
  kode: string;
}

interface MataKuliahClientProps {
  initialMataKuliah: MataKuliahItem[];
  prodiList: ProdiOption[];
}

export default function MataKuliahClient({
  initialMataKuliah,
  prodiList,
}: MataKuliahClientProps) {
  const [mkList, setMkList] = useState<MataKuliahItem[]>(initialMataKuliah);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProdi, setFilterProdi] = useState<string>("ALL");
  const [filterSks, setFilterSks] = useState<string>("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingMk, setEditingMk] = useState<MataKuliahItem | null>(null);
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [sks, setSks] = useState<number>(3);
  const [prodiId, setProdiId] = useState("");

  const [loading, setLoading] = useState(false);

  function openCreateModal() {
    setEditingMk(null);
    setKode("");
    setNama("");
    setSks(3);
    setProdiId(prodiList[0]?.id || "");
    setIsModalOpen(true);
  }

  function openEditModal(mk: MataKuliahItem) {
    setEditingMk(mk);
    setKode(mk.kode);
    setNama(mk.nama);
    setSks(mk.sks);
    setProdiId(mk.prodiId);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingMk(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingMk) {
        const res = await updateMataKuliah(editingMk.id, {
          kode,
          nama,
          sks,
          prodiId,
        });

        if (!res.success) {
          toast.error(res.error || "Gagal memperbarui mata kuliah");
        } else {
          toast.success("Mata kuliah berhasil diperbarui");
          closeModal();
          const targetProdi = prodiList.find((p) => p.id === prodiId);
          setMkList((prev) =>
            prev.map((m) =>
              m.id === editingMk.id
                ? {
                    ...m,
                    kode: kode.trim().toUpperCase(),
                    nama: nama.trim(),
                    sks,
                    prodiId,
                    prodi: targetProdi ? { id: targetProdi.id, nama: targetProdi.nama, kode: targetProdi.kode } : m.prodi,
                  }
                : m
            )
          );
        }
      } else {
        const res = await createMataKuliah({
          kode,
          nama,
          sks,
          prodiId,
        });

        if (!res.success) {
          toast.error(res.error || "Gagal menambah mata kuliah");
        } else {
          toast.success("Mata kuliah baru berhasil ditambahkan");
          closeModal();
          const targetProdi = prodiList.find((p) => p.id === prodiId);
          const newMkItem: MataKuliahItem = {
            ...res.data!,
            prodi: targetProdi ? { id: targetProdi.id, nama: targetProdi.nama, kode: targetProdi.kode } : (res.data as any).prodi,
            _count: { kelas: 0 },
          };
          setMkList((prev) => [newMkItem, ...prev]);
        }
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, nama: string) {
    if (!confirm(`Hapus mata kuliah "${nama}"?`)) return;

    const res = await deleteMataKuliah(id);
    if (!res.success) {
      toast.error(res.error || "Gagal menghapus mata kuliah");
    } else {
      toast.success("Mata kuliah berhasil dihapus");
      setMkList((prev) => prev.filter((m) => m.id !== id));
    }
  }

  // Filter list
  const filteredMk = mkList.filter((m) => {
    const matchSearch =
      m.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.kode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchProdi = filterProdi === "ALL" || m.prodiId === filterProdi;
    const matchSks = filterSks === "ALL" || m.sks.toString() === filterSks;
    return matchSearch && matchProdi && matchSks;
  });

  return (
    <div className="space-y-4">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <BookOpen size={18} className="text-[#a80063]" />
            <span>Data Master Mata Kuliah</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Daftar kurikulum mata kuliah dan bobot SKS per program studi di Nusa Putra University
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
            <span>Tambah Mata Kuliah</span>
          </button>
        </div>
      </div>

      {/* ── Search & Filter Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/70">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode atau nama mata kuliah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-slate-50 text-xs rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Filter Prodi */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Prodi:</span>
            <select
              value={filterProdi}
              onChange={(e) => setFilterProdi(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[180px] truncate"
            >
              <option value="ALL">Semua Prodi</option>
              {prodiList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode} - {p.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Filter SKS */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">SKS:</span>
            <select
              value={filterSks}
              onChange={(e) => setFilterSks(e.target.value)}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
            >
              <option value="ALL">Semua</option>
              <option value="1">1 SKS</option>
              <option value="2">2 SKS</option>
              <option value="3">3 SKS</option>
              <option value="4">4 SKS</option>
              <option value="6">6 SKS</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div className="duralux-card bg-white p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-2.5 font-bold">Kode MK</th>
                <th className="pb-2.5 font-bold">Nama Mata Kuliah</th>
                <th className="pb-2.5 font-bold">Bobot SKS</th>
                <th className="pb-2.5 font-bold">Program Studi</th>
                <th className="pb-2.5 font-bold">Total Kelas Terbuka</th>
                <th className="pb-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredMk.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    Tidak ada data mata kuliah yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredMk.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Kode MK */}
                    <td className="py-3 pr-3 font-bold">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-xs font-extrabold">
                        {m.kode}
                      </span>
                    </td>

                    {/* Nama MK */}
                    <td className="py-3 pr-3 font-semibold text-slate-900">
                      {m.nama}
                    </td>

                    {/* SKS */}
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {/* <Sparkles size={10} /> */}
                        <span>{m.sks} SKS</span>
                      </span>
                    </td>

                    {/* Prodi */}
                    <td className="py-3 pr-3">
                      <span className="text-slate-600 font-medium text-xs">
                        {m.prodi.nama} ({m.prodi.kode})
                      </span>
                    </td>

                    {/* Total Kelas */}
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1 text-slate-600 text-xs font-medium">
                        <School size={13} className="text-slate-400" />
                        <span>{m._count.kelas} Kelas</span>
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(m)}
                          className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                          title="Edit Mata Kuliah"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.nama)}
                          disabled={m._count.kelas > 0}
                          className="w-7 h-7 rounded-md bg-slate-50 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                          title={
                            m._count.kelas > 0
                              ? "Tidak dapat menghapus mata kuliah yang memiliki kelas aktif"
                              : "Hapus Mata Kuliah"
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {editingMk ? "Edit Mata Kuliah" : "Tambah Mata Kuliah Baru"}
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Lengkapi informasi mata kuliah sesuai kurikulum program studi
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Kode Mata Kuliah
                </label>
                <input
                  type="text"
                  placeholder="Contoh: IF2101 / MN101"
                  value={kode}
                  onChange={(e) => setKode(e.target.value.toUpperCase())}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 outline-none uppercase font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Mata Kuliah
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pemrograman Web Lanjut"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Bobot SKS
                  </label>
                  <select
                    value={sks}
                    onChange={(e) => setSks(parseInt(e.target.value))}
                    required
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  >
                    <option value={1}>1 SKS</option>
                    <option value={2}>2 SKS</option>
                    <option value={3}>3 SKS</option>
                    <option value={4}>4 SKS</option>
                    <option value={6}>6 SKS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Program Studi
                  </label>
                  <select
                    value={prodiId}
                    onChange={(e) => setProdiId(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  >
                    <option value="">-- Pilih Prodi --</option>
                    {prodiList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.kode} - {p.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {loading && <Loader2 size={12} className="animate-spin" />}
                  <span>{editingMk ? "Simpan Perubahan" : "Tambah Mata Kuliah"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Import Modal ─────────────────────────────────────────────────── */}
      <MasterImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Data Mata Kuliah dari Excel"
        type="mata-kuliah"
        parseAction={parseMataKuliahExcel}
        commitAction={commitMataKuliahImport}
        onSuccess={async () => {
          const res = await getMataKuliahList();
          if (res.success && res.data) {
            setMkList(res.data.mataKuliah as any);
          }
        }}
      />
    </div>
  );
}
