"use client";
// src/app/(dashboard)/master/dosen/DosenClient.tsx
// Compact & Clean Dosen Management UI (Plus Jakarta Sans & #a80063 Theme)

import { useState } from "react";
import { toast } from "sonner";
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Search,
  Mail,
  School,
  IdCard,
  Loader2,
  X,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { createDosen, updateDosen, deleteDosen, getDosenList } from "@/actions/dosen";
import MasterImportModal from "@/components/master/MasterImportModal";
import { parseDosenExcel, commitDosenImport } from "@/actions/master-import";

interface DosenItem {
  id: string;
  nama: string;
  nidn: string | null;
  email: string | null;
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

interface DosenClientProps {
  initialDosen: DosenItem[];
  prodiList: ProdiOption[];
}

export default function DosenClient({
  initialDosen,
  prodiList,
}: DosenClientProps) {
  const [dosenList, setDosenList] = useState<DosenItem[]>(initialDosen);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProdi, setFilterProdi] = useState<string>("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingDosen, setEditingDosen] = useState<DosenItem | null>(null);
  const [nama, setNama] = useState("");
  const [nidn, setNidn] = useState("");
  const [email, setEmail] = useState("");
  const [prodiId, setProdiId] = useState("");

  const [loading, setLoading] = useState(false);

  function openCreateModal() {
    setEditingDosen(null);
    setNama("");
    setNidn("");
    setEmail("");
    setProdiId(prodiList[0]?.id || "");
    setIsModalOpen(true);
  }

  function openEditModal(dosen: DosenItem) {
    setEditingDosen(dosen);
    setNama(dosen.nama);
    setNidn(dosen.nidn || "");
    setEmail(dosen.email || "");
    setProdiId(dosen.prodiId);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingDosen(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingDosen) {
        const res = await updateDosen(editingDosen.id, {
          nama,
          nidn: nidn.trim() ? nidn.trim() : undefined,
          email: email.trim() ? email.trim() : undefined,
          prodiId,
        });

        if (!res.success) {
          toast.error(res.error || "Gagal memperbarui dosen");
        } else {
          toast.success("Data dosen berhasil diperbarui");
          closeModal();
          const targetProdi = prodiList.find((p) => p.id === prodiId);
          setDosenList((prev) =>
            prev.map((d) =>
              d.id === editingDosen.id
                ? {
                    ...d,
                    nama,
                    nidn: nidn.trim() || null,
                    email: email.trim() || null,
                    prodiId,
                    prodi: targetProdi ? { id: targetProdi.id, nama: targetProdi.nama, kode: targetProdi.kode } : d.prodi,
                  }
                : d
            )
          );
        }
      } else {
        const res = await createDosen({
          nama,
          nidn: nidn.trim() ? nidn.trim() : undefined,
          email: email.trim() ? email.trim() : undefined,
          prodiId,
        });

        if (!res.success) {
          toast.error(res.error || "Gagal menambah dosen");
        } else {
          toast.success("Dosen baru berhasil ditambahkan");
          closeModal();
          const targetProdi = prodiList.find((p) => p.id === prodiId);
          const newDosenItem: DosenItem = {
            ...res.data!,
            prodi: targetProdi ? { id: targetProdi.id, nama: targetProdi.nama, kode: targetProdi.kode } : (res.data as any).prodi,
            _count: { kelas: 0 },
          };
          setDosenList((prev) => [newDosenItem, ...prev]);
        }
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, nama: string) {
    if (!confirm(`Hapus data dosen "${nama}"?`)) return;

    const res = await deleteDosen(id);
    if (!res.success) {
      toast.error(res.error || "Gagal menghapus dosen");
    } else {
      toast.success("Dosen berhasil dihapus");
      setDosenList((prev) => prev.filter((d) => d.id !== id));
    }
  }

  // Filter dosen list
  const filteredDosen = dosenList.filter((d) => {
    const matchSearch =
      d.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.nidn && d.nidn.includes(searchQuery)) ||
      (d.email && d.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchProdi = filterProdi === "ALL" || d.prodiId === filterProdi;
    return matchSearch && matchProdi;
  });

  // ── Sorting Logic & Header (Standard CDU Table) ───────────────────────────
  type DosenSortColumn = "NAMA" | "NIDN" | "EMAIL" | "PRODI" | "KELAS";
  type DosenSortKey =
    | "NAMA_ASC"
    | "NAMA_DESC"
    | "NIDN_ASC"
    | "NIDN_DESC"
    | "EMAIL_ASC"
    | "EMAIL_DESC"
    | "PRODI_ASC"
    | "PRODI_DESC"
    | "KELAS_DESC"
    | "KELAS_ASC";

  const [sortBy, setSortBy] = useState<DosenSortKey>("NAMA_ASC");

  const sortedDosen = [...filteredDosen].sort((a, b) => {
    switch (sortBy) {
      case "NAMA_ASC":
        return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
      case "NAMA_DESC":
        return b.nama.localeCompare(a.nama, "id", { sensitivity: "base" });
      case "NIDN_ASC":
        return (a.nidn || "").localeCompare(b.nidn || "", "id");
      case "NIDN_DESC":
        return (b.nidn || "").localeCompare(a.nidn || "", "id");
      case "EMAIL_ASC":
        return (a.email || "").localeCompare(b.email || "", "id");
      case "EMAIL_DESC":
        return (b.email || "").localeCompare(a.email || "", "id");
      case "PRODI_ASC":
        return a.prodi.nama.localeCompare(b.prodi.nama, "id", { sensitivity: "base" });
      case "PRODI_DESC":
        return b.prodi.nama.localeCompare(a.prodi.nama, "id", { sensitivity: "base" });
      case "KELAS_DESC":
        return b._count.kelas - a._count.kelas;
      case "KELAS_ASC":
        return a._count.kelas - b._count.kelas;
      default:
        return 0;
    }
  });

  function handleColumnSort(column: DosenSortColumn) {
    switch (column) {
      case "NAMA":
        setSortBy(sortBy === "NAMA_ASC" ? "NAMA_DESC" : "NAMA_ASC");
        break;
      case "NIDN":
        setSortBy(sortBy === "NIDN_ASC" ? "NIDN_DESC" : "NIDN_ASC");
        break;
      case "EMAIL":
        setSortBy(sortBy === "EMAIL_ASC" ? "EMAIL_DESC" : "EMAIL_ASC");
        break;
      case "PRODI":
        setSortBy(sortBy === "PRODI_ASC" ? "PRODI_DESC" : "PRODI_ASC");
        break;
      case "KELAS":
        setSortBy(sortBy === "KELAS_DESC" ? "KELAS_ASC" : "KELAS_DESC");
        break;
    }
  }

  function renderSortHeader(
    label: string,
    columnKey: DosenSortColumn,
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isCurrent =
      (columnKey === "NAMA" && (sortBy === "NAMA_ASC" || sortBy === "NAMA_DESC")) ||
      (columnKey === "NIDN" && (sortBy === "NIDN_ASC" || sortBy === "NIDN_DESC")) ||
      (columnKey === "EMAIL" && (sortBy === "EMAIL_ASC" || sortBy === "EMAIL_DESC")) ||
      (columnKey === "PRODI" && (sortBy === "PRODI_ASC" || sortBy === "PRODI_DESC")) ||
      (columnKey === "KELAS" && (sortBy === "KELAS_DESC" || sortBy === "KELAS_ASC"));

    const isAsc =
      sortBy === "NAMA_ASC" ||
      sortBy === "NIDN_ASC" ||
      sortBy === "EMAIL_ASC" ||
      sortBy === "PRODI_ASC" ||
      sortBy === "KELAS_ASC";

    return (
      <th
        onClick={() => handleColumnSort(columnKey)}
        className={`py-2.5 px-3 cursor-pointer select-none transition-colors group hover:bg-slate-200/60 ${
          align === "center" ? "text-center" : "text-left"
        } ${extraClass}`}
        title={`Klik untuk mengurutkan berdasarkan ${label}`}
      >
        <div
          className={`inline-flex items-center gap-1 font-bold text-[11px] whitespace-nowrap ${
            isCurrent ? "text-[#a80063]" : "text-slate-700 group-hover:text-slate-900"
          } ${align === "center" ? "justify-center" : ""}`}
        >
          <span>{label}</span>
          {isCurrent ? (
            isAsc ? (
              <ArrowUp size={11} className="text-[#a80063] stroke-[2.5]" />
            ) : (
              <ArrowDown size={11} className="text-[#a80063] stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <GraduationCap size={18} className="text-[#a80063]" />
            <span>Data Master Dosen</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Daftar seluruh dosen pengampu perkuliahan di lingkungan Universitas Nusa Putra
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
            <span>Tambah Dosen</span>
          </button>
        </div>
      </div>

      {/* ── Filter & Search Controls ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/70">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, NIDN, atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-slate-50 text-xs rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Filter Prodi:</span>
          <select
            value={filterProdi}
            onChange={(e) => setFilterProdi(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[200px] truncate cursor-pointer"
          >
            <option value="ALL">Semua Program Studi</option>
            {prodiList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.kode} - {p.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs print:shadow-none print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[780px]">
            <thead>
              <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                <th className="py-2.5 px-2.5 w-10 text-center text-slate-700 font-bold">No</th>
                {renderSortHeader("Nama Dosen", "NAMA", "left", "min-w-[200px]")}
                {renderSortHeader("NIDN", "NIDN", "left", "w-36 min-w-[120px]")}
                {renderSortHeader("Email", "EMAIL", "left", "min-w-[180px]")}
                {renderSortHeader("Homebase Prodi", "PRODI", "left", "min-w-[180px]")}
                {renderSortHeader("Kelas Diampu", "KELAS", "center", "w-36")}
                <th className="py-2.5 px-3 text-center text-slate-700 font-bold w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-xs">
              {sortedDosen.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Tidak ada data dosen yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                sortedDosen.map((d, idx) => {
                  const isOdd = idx % 2 === 1;
                  return (
                    <tr
                      key={d.id}
                      className={`transition-colors border-b border-slate-100/80 ${
                        isOdd ? "bg-slate-50" : "bg-white"
                      } hover:bg-[#fdf2f8]/80`}
                    >
                      {/* No */}
                      <td className="py-2.5 px-2.5 text-center font-medium text-slate-400 text-xs">
                        {idx + 1}
                      </td>

                      {/* Nama Dosen with Avatar */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#a80063]/15 to-[#d946ef]/20 border border-[#fbcfe8] text-[#a80063] font-bold text-xs flex items-center justify-center shrink-0">
                            {d.nama[0]}
                          </div>
                          <span className="font-semibold text-xs text-slate-900 leading-tight">
                            {d.nama}
                          </span>
                        </div>
                      </td>

                      {/* NIDN */}
                      <td className="py-2.5 px-3">
                        {d.nidn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium font-mono">
                            <IdCard size={11} className="text-slate-400" />
                            <span>{d.nidn}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="py-2.5 px-3 text-slate-600">
                        {d.email ? (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Mail size={11} className="text-slate-400" />
                            <span>{d.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Homebase Prodi */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-[11px] font-semibold">
                          {d.prodi.kode} - {d.prodi.nama}
                        </span>
                      </td>

                      {/* Kelas Diampu */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1 text-slate-600 text-xs font-medium">
                          <School size={13} className="text-slate-400" />
                          <span>{d._count.kelas} Kelas</span>
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(d)}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title="Edit Dosen"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(d.id, d.nama)}
                            disabled={d._count.kelas > 0}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title={
                              d._count.kelas > 0
                                ? "Tidak dapat menghapus dosen yang mengampu kelas"
                                : "Hapus Dosen"
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
              {editingDosen ? "Edit Data Dosen" : "Tambah Dosen Baru"}
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Lengkapi identitas dosen pengampu perkuliahan
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Lengkap & Gelar
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Dr. Nama Dosen, S.T., M.Kom."
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  NIDN (Nomor Induk Dosen Nasional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 0412345678 (opsional)"
                  value={nidn}
                  onChange={(e) => setNidn(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Alamat Email
                </label>
                <input
                  type="email"
                  placeholder="dosen@nusaputra.ac.id (opsional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Homebase Program Studi
                </label>
                <select
                  value={prodiId}
                  onChange={(e) => setProdiId(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                >
                  <option value="">-- Pilih Program Studi --</option>
                  {prodiList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.kode} - {p.nama}
                    </option>
                  ))}
                </select>
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
                  <span>{editingDosen ? "Simpan Perubahan" : "Tambah Dosen"}</span>
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
        title="Import Data Dosen dari Excel"
        type="dosen"
        parseAction={parseDosenExcel}
        commitAction={commitDosenImport}
        onSuccess={async () => {
          const res = await getDosenList();
          if (res.success && res.data) {
            setDosenList(res.data.dosen as any);
          }
        }}
      />
    </div>
  );
}
