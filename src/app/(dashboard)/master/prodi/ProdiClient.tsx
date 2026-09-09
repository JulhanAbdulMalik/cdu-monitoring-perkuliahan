"use client";
// src/app/(dashboard)/master/prodi/ProdiClient.tsx
// Compact & Clean Fakultas & Program Studi UI (Plus Jakarta Sans & #a80063 Theme)

import { useState } from "react";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Building2,
  GraduationCap,
  BookOpen,
  Search,
  Loader2,
  X,
  FileSpreadsheet,
} from "lucide-react";
import {
  createFakultas,
  updateFakultas,
  deleteFakultas,
  createProdi,
  updateProdi,
  deleteProdi,
  getFakultasAndProdi,
} from "@/actions/prodi";
import MasterImportModal from "@/components/master/MasterImportModal";
import { parseProdiExcel, commitProdiImport } from "@/actions/master-import";

interface FakultasData {
  id: string;
  nama: string;
  _count: { prodi: number };
  prodi: ProdiData[];
}

interface ProdiData {
  id: string;
  nama: string;
  kode: string;
  fakultasId: string;
  fakultas?: { id: string; nama: string };
  _count?: { dosen: number; mataKuliah: number };
}

interface ProdiClientProps {
  initialFakultas: FakultasData[];
  initialProdi: ProdiData[];
}

export default function ProdiClient({
  initialFakultas,
  initialProdi,
}: ProdiClientProps) {
  const [fakultas, setFakultas] = useState<FakultasData[]>(initialFakultas);
  const [prodiList, setProdiList] = useState<ProdiData[]>(initialProdi);

  const [activeTab, setActiveTab] = useState<"prodi" | "fakultas">("prodi");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFakultas, setFilterFakultas] = useState<string>("ALL");

  // Modal states
  const [isProdiModalOpen, setIsProdiModalOpen] = useState(false);
  const [isFakultasModalOpen, setIsFakultasModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProdi, setEditingProdi] = useState<ProdiData | null>(null);
  const [prodiNama, setProdiNama] = useState("");
  const [prodiKode, setProdiKode] = useState("");
  const [prodiFakultasId, setProdiFakultasId] = useState("");

  const [editingFakultas, setEditingFakultas] = useState<FakultasData | null>(null);
  const [fakultasNama, setFakultasNama] = useState("");

  const [loading, setLoading] = useState(false);

  // ── Prodi Modal Handlers ──────────────────────────────────────────────────
  function openCreateProdi() {
    setEditingProdi(null);
    setProdiNama("");
    setProdiKode("");
    setProdiFakultasId(fakultas[0]?.id || "");
    setIsProdiModalOpen(true);
  }

  function openEditProdi(item: ProdiData) {
    setEditingProdi(item);
    setProdiNama(item.nama);
    setProdiKode(item.kode);
    setProdiFakultasId(item.fakultasId);
    setIsProdiModalOpen(true);
  }

  async function handleProdiSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingProdi) {
        const res = await updateProdi(editingProdi.id, {
          nama: prodiNama,
          kode: prodiKode,
          fakultasId: prodiFakultasId,
        });

        if (!res.success) {
          toast.error(res.error || "Gagal memperbarui prodi");
        } else {
          toast.success("Program Studi berhasil diperbarui");
          setIsProdiModalOpen(false);
          const targetFak = fakultas.find((f) => f.id === prodiFakultasId);
          setProdiList((prev) =>
            prev.map((p) =>
              p.id === editingProdi.id
                ? {
                    ...p,
                    nama: prodiNama,
                    kode: prodiKode,
                    fakultasId: prodiFakultasId,
                    fakultas: targetFak ? { id: targetFak.id, nama: targetFak.nama } : undefined,
                  }
                : p
            )
          );
        }
      } else {
        const res = await createProdi({
          nama: prodiNama,
          kode: prodiKode,
          fakultasId: prodiFakultasId,
        });

        if (!res.success) {
          toast.error(res.error || "Gagal menambah prodi");
        } else {
          toast.success("Program Studi baru berhasil ditambahkan");
          setIsProdiModalOpen(false);
          const targetFak = fakultas.find((f) => f.id === prodiFakultasId);
          const newProdiItem: ProdiData = {
            ...res.data!,
            fakultas: targetFak ? { id: targetFak.id, nama: targetFak.nama } : undefined,
            _count: { dosen: 0, mataKuliah: 0 },
          };
          setProdiList((prev) => [newProdiItem, ...prev]);
        }
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProdi(id: string, nama: string) {
    if (!confirm(`Hapus Program Studi "${nama}"?`)) return;

    const res = await deleteProdi(id);
    if (!res.success) {
      toast.error(res.error || "Gagal menghapus prodi");
    } else {
      toast.success("Program Studi berhasil dihapus");
      setProdiList((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // ── Fakultas Modal Handlers ───────────────────────────────────────────────
  function openCreateFakultas() {
    setEditingFakultas(null);
    setFakultasNama("");
    setIsFakultasModalOpen(true);
  }

  function openEditFakultas(item: FakultasData) {
    setEditingFakultas(item);
    setFakultasNama(item.nama);
    setIsFakultasModalOpen(true);
  }

  async function handleFakultasSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingFakultas) {
        const res = await updateFakultas(editingFakultas.id, fakultasNama);
        if (!res.success) {
          toast.error(res.error || "Gagal memperbarui fakultas");
        } else {
          toast.success("Fakultas berhasil diperbarui");
          setIsFakultasModalOpen(false);
          setFakultas((prev) =>
            prev.map((f) => (f.id === editingFakultas.id ? { ...f, nama: fakultasNama } : f))
          );
        }
      } else {
        const res = await createFakultas(fakultasNama);
        if (!res.success) {
          toast.error(res.error || "Gagal menambah fakultas");
        } else {
          toast.success("Fakultas baru berhasil ditambahkan");
          setIsFakultasModalOpen(false);
          setFakultas((prev) => [
            {
              ...res.data!,
              _count: { prodi: 0 },
              prodi: [],
            },
            ...prev,
          ]);
        }
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteFakultas(id: string, nama: string) {
    if (!confirm(`Hapus Fakultas "${nama}"?`)) return;

    const res = await deleteFakultas(id);
    if (!res.success) {
      toast.error(res.error || "Gagal menghapus fakultas");
    } else {
      toast.success("Fakultas berhasil dihapus");
      setFakultas((prev) => prev.filter((f) => f.id !== id));
    }
  }

  // Filter prodi
  const filteredProdi = prodiList.filter((p) => {
    const matchSearch =
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFak = filterFakultas === "ALL" || p.fakultasId === filterFakultas;
    return matchSearch && matchFak;
  });

  return (
    <div className="space-y-4">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <Layers size={18} className="text-[#a80063]" />
            <span>Fakultas & Program Studi</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Kelola struktur akademik fakultas dan program studi Nusa Putra University
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

          {activeTab === "prodi" ? (
            <button
              onClick={openCreateProdi}
              className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Tambah Prodi</span>
            </button>
          ) : (
            <button
              onClick={openCreateFakultas}
              className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Tambah Fakultas</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs & Filter Controls ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/70">
        {/* Tab Buttons */}
        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/60 text-xs font-medium text-slate-600 self-start">
          <button
            onClick={() => setActiveTab("prodi")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === "prodi"
                ? "bg-white text-[#a80063] font-bold shadow-xs"
                : "hover:text-slate-900"
            }`}
          >
            Program Studi ({prodiList.length})
          </button>
          <button
            onClick={() => setActiveTab("fakultas")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeTab === "fakultas"
                ? "bg-white text-[#a80063] font-bold shadow-xs"
                : "hover:text-slate-900"
            }`}
          >
            Fakultas ({fakultas.length})
          </button>
        </div>

        {/* Search & Fakultas Filter (on Prodi tab) */}
        {activeTab === "prodi" && (
          <div className="flex items-center gap-2.5 flex-1 max-w-md justify-end">
            <div className="relative w-full max-w-[200px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari prodi / kode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1 bg-slate-50 text-xs rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
              />
            </div>

            <select
              value={filterFakultas}
              onChange={(e) => setFilterFakultas(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[160px] truncate"
            >
              <option value="ALL">Semua Fakultas</option>
              {fakultas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nama}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Table Card: Program Studi ────────────────────────────────────────── */}
      {activeTab === "prodi" && (
        <div className="duralux-card bg-white p-5 animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-2.5 font-bold">Kode</th>
                  <th className="pb-2.5 font-bold">Nama Program Studi</th>
                  <th className="pb-2.5 font-bold">Fakultas</th>
                  <th className="pb-2.5 font-bold">Total Dosen</th>
                  <th className="pb-2.5 font-bold">Total Mata Kuliah</th>
                  <th className="pb-2.5 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProdi.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                      Tidak ada data program studi yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredProdi.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 pr-3 font-bold">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-xs font-extrabold">
                          {p.kode}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-900">
                        {p.nama}
                      </td>
                      <td className="py-3 pr-3 text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-slate-400" />
                          <span>{p.fakultas?.nama || "—"}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1 text-slate-600">
                          <GraduationCap size={13} className="text-slate-400" />
                          <span>{p._count?.dosen ?? 0} Dosen</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1 text-slate-600">
                          <BookOpen size={13} className="text-slate-400" />
                          <span>{p._count?.mataKuliah ?? 0} MK</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEditProdi(p)}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title="Edit Prodi"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteProdi(p.id, p.nama)}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title="Hapus Prodi"
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
      )}

      {/* ── Table Card: Fakultas ─────────────────────────────────────────────── */}
      {activeTab === "fakultas" && (
        <div className="duralux-card bg-white p-5 animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-2.5 font-bold">Nama Fakultas</th>
                  <th className="pb-2.5 font-bold">Total Program Studi</th>
                  <th className="pb-2.5 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {fakultas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs text-slate-400">
                      Belum ada data fakultas. Klik tombol "Tambah Fakultas" di atas.
                    </td>
                  </tr>
                ) : (
                  fakultas.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 pr-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-[#a80063]" />
                          <span>{f.nama}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                          {f._count?.prodi ?? f.prodi?.length ?? 0} Program Studi
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEditFakultas(f)}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title="Edit Fakultas"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteFakultas(f.id, f.nama)}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title="Hapus Fakultas"
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
      )}

      {/* ── Modal Prodi ──────────────────────────────────────────────────────── */}
      {isProdiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setIsProdiModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {editingProdi ? "Edit Program Studi" : "Tambah Program Studi Baru"}
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Lengkapi informasi program studi dan pilih fakultas terkait
            </p>

            <form onSubmit={handleProdiSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Program Studi
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Teknik Informatika"
                  value={prodiNama}
                  onChange={(e) => setProdiNama(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Kode Prodi (Singkatan)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: TI / MN / SI"
                  value={prodiKode}
                  onChange={(e) => setProdiKode(e.target.value.toUpperCase())}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 outline-none uppercase font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Fakultas
                </label>
                <select
                  value={prodiFakultasId}
                  onChange={(e) => setProdiFakultasId(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                >
                  <option value="">-- Pilih Fakultas --</option>
                  {fakultas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsProdiModalOpen(false)}
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
                  <span>{editingProdi ? "Simpan Perubahan" : "Tambah Prodi"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Fakultas ───────────────────────────────────────────────────── */}
      {isFakultasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setIsFakultasModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {editingFakultas ? "Edit Fakultas" : "Tambah Fakultas Baru"}
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Masukkan nama fakultas yang sah di Nusa Putra University
            </p>

            <form onSubmit={handleFakultasSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Fakultas
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Fakultas Teknologi dan Informatika"
                  value={fakultasNama}
                  onChange={(e) => setFakultasNama(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsFakultasModalOpen(false)}
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
                  <span>{editingFakultas ? "Simpan Perubahan" : "Tambah Fakultas"}</span>
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
        title="Import Fakultas & Program Studi dari Excel"
        type="prodi"
        parseAction={parseProdiExcel}
        commitAction={commitProdiImport}
        onSuccess={async () => {
          const res = await getFakultasAndProdi();
          if (res.success && res.data) {
            setFakultas(res.data.fakultas as any);
            setProdiList(res.data.prodi as any);
          }
        }}
      />
    </div>
  );
}
