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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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

  // ── Sorting Logic: Program Studi ──────────────────────────────────────────
  type ProdiSortColumn = "KODE" | "NAMA" | "FAKULTAS" | "DOSEN" | "MK";
  type ProdiSortKey =
    | "KODE_ASC"
    | "KODE_DESC"
    | "NAMA_ASC"
    | "NAMA_DESC"
    | "FAKULTAS_ASC"
    | "FAKULTAS_DESC"
    | "DOSEN_DESC"
    | "DOSEN_ASC"
    | "MK_DESC"
    | "MK_ASC";

  const [prodiSortBy, setProdiSortBy] = useState<ProdiSortKey>("NAMA_ASC");

  const sortedProdi = [...filteredProdi].sort((a, b) => {
    switch (prodiSortBy) {
      case "NAMA_ASC":
        return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
      case "NAMA_DESC":
        return b.nama.localeCompare(a.nama, "id", { sensitivity: "base" });
      case "KODE_ASC":
        return a.kode.localeCompare(b.kode, "id", { sensitivity: "base" });
      case "KODE_DESC":
        return b.kode.localeCompare(a.kode, "id", { sensitivity: "base" });
      case "FAKULTAS_ASC":
        return (a.fakultas?.nama || "").localeCompare(b.fakultas?.nama || "", "id", { sensitivity: "base" });
      case "FAKULTAS_DESC":
        return (b.fakultas?.nama || "").localeCompare(a.fakultas?.nama || "", "id", { sensitivity: "base" });
      case "DOSEN_DESC":
        return (b._count?.dosen ?? 0) - (a._count?.dosen ?? 0);
      case "DOSEN_ASC":
        return (a._count?.dosen ?? 0) - (b._count?.dosen ?? 0);
      case "MK_DESC":
        return (b._count?.mataKuliah ?? 0) - (a._count?.mataKuliah ?? 0);
      case "MK_ASC":
        return (a._count?.mataKuliah ?? 0) - (b._count?.mataKuliah ?? 0);
      default:
        return 0;
    }
  });

  function handleProdiSort(column: ProdiSortColumn) {
    switch (column) {
      case "KODE":
        setProdiSortBy(prodiSortBy === "KODE_ASC" ? "KODE_DESC" : "KODE_ASC");
        break;
      case "NAMA":
        setProdiSortBy(prodiSortBy === "NAMA_ASC" ? "NAMA_DESC" : "NAMA_ASC");
        break;
      case "FAKULTAS":
        setProdiSortBy(prodiSortBy === "FAKULTAS_ASC" ? "FAKULTAS_DESC" : "FAKULTAS_ASC");
        break;
      case "DOSEN":
        setProdiSortBy(prodiSortBy === "DOSEN_DESC" ? "DOSEN_ASC" : "DOSEN_DESC");
        break;
      case "MK":
        setProdiSortBy(prodiSortBy === "MK_DESC" ? "MK_ASC" : "MK_DESC");
        break;
    }
  }

  function renderSortHeaderProdi(
    label: string,
    columnKey: ProdiSortColumn,
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isCurrent =
      (columnKey === "KODE" && (prodiSortBy === "KODE_ASC" || prodiSortBy === "KODE_DESC")) ||
      (columnKey === "NAMA" && (prodiSortBy === "NAMA_ASC" || prodiSortBy === "NAMA_DESC")) ||
      (columnKey === "FAKULTAS" && (prodiSortBy === "FAKULTAS_ASC" || prodiSortBy === "FAKULTAS_DESC")) ||
      (columnKey === "DOSEN" && (prodiSortBy === "DOSEN_DESC" || prodiSortBy === "DOSEN_ASC")) ||
      (columnKey === "MK" && (prodiSortBy === "MK_DESC" || prodiSortBy === "MK_ASC"));

    const isAsc =
      prodiSortBy === "KODE_ASC" ||
      prodiSortBy === "NAMA_ASC" ||
      prodiSortBy === "FAKULTAS_ASC" ||
      prodiSortBy === "DOSEN_ASC" ||
      prodiSortBy === "MK_ASC";

    return (
      <th
        onClick={() => handleProdiSort(columnKey)}
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

  // ── Sorting Logic: Fakultas ───────────────────────────────────────────────
  type FakultasSortColumn = "NAMA" | "TOTAL_PRODI";
  type FakultasSortKey = "NAMA_ASC" | "NAMA_DESC" | "PRODI_DESC" | "PRODI_ASC";

  const [fakultasSortBy, setFakultasSortBy] = useState<FakultasSortKey>("NAMA_ASC");

  const sortedFakultas = [...fakultas].sort((a, b) => {
    switch (fakultasSortBy) {
      case "NAMA_ASC":
        return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
      case "NAMA_DESC":
        return b.nama.localeCompare(a.nama, "id", { sensitivity: "base" });
      case "PRODI_DESC":
        return (b._count?.prodi ?? b.prodi?.length ?? 0) - (a._count?.prodi ?? a.prodi?.length ?? 0);
      case "PRODI_ASC":
        return (a._count?.prodi ?? a.prodi?.length ?? 0) - (b._count?.prodi ?? b.prodi?.length ?? 0);
      default:
        return 0;
    }
  });

  function handleFakultasSort(column: FakultasSortColumn) {
    switch (column) {
      case "NAMA":
        setFakultasSortBy(fakultasSortBy === "NAMA_ASC" ? "NAMA_DESC" : "NAMA_ASC");
        break;
      case "TOTAL_PRODI":
        setFakultasSortBy(fakultasSortBy === "PRODI_DESC" ? "PRODI_ASC" : "PRODI_DESC");
        break;
    }
  }

  function renderSortHeaderFakultas(
    label: string,
    columnKey: FakultasSortColumn,
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isCurrent =
      (columnKey === "NAMA" && (fakultasSortBy === "NAMA_ASC" || fakultasSortBy === "NAMA_DESC")) ||
      (columnKey === "TOTAL_PRODI" && (fakultasSortBy === "PRODI_DESC" || fakultasSortBy === "PRODI_ASC"));

    const isAsc = fakultasSortBy === "NAMA_ASC" || fakultasSortBy === "PRODI_ASC";

    return (
      <th
        onClick={() => handleFakultasSort(columnKey)}
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
              className="px-2.5 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[160px] truncate cursor-pointer"
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
        <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs print:shadow-none print:border-none animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[750px]">
              <thead>
                <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                  <th className="py-2.5 px-2.5 w-10 text-center text-slate-700 font-bold">No</th>
                  {renderSortHeaderProdi("Kode", "KODE", "left", "w-24 min-w-[85px]")}
                  {renderSortHeaderProdi("Nama Program Studi", "NAMA", "left", "min-w-[200px]")}
                  {renderSortHeaderProdi("Fakultas", "FAKULTAS", "left", "min-w-[180px]")}
                  {renderSortHeaderProdi("Total Dosen", "DOSEN", "center", "w-32")}
                  {renderSortHeaderProdi("Total Mata Kuliah", "MK", "center", "w-36")}
                  <th className="py-2.5 px-3 text-center text-slate-700 font-bold w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 text-xs">
                {sortedProdi.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      Tidak ada data program studi yang sesuai.
                    </td>
                  </tr>
                ) : (
                  sortedProdi.map((p, idx) => {
                    const isOdd = idx % 2 === 1;
                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors border-b border-slate-100/80 ${
                          isOdd ? "bg-slate-50" : "bg-white"
                        } hover:bg-[#fdf2f8]/80`}
                      >
                        {/* No */}
                        <td className="py-2.5 px-2.5 text-center font-medium text-slate-400 text-xs">
                          {idx + 1}
                        </td>

                        {/* Kode */}
                        <td className="py-2.5 px-3 font-bold w-24 min-w-[85px]">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-xs font-extrabold">
                            {p.kode}
                          </span>
                        </td>

                        {/* Nama Prodi */}
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {p.nama}
                        </td>

                        {/* Fakultas */}
                        <td className="py-2.5 px-3 text-slate-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-slate-400" />
                            <span>{p.fakultas?.nama || "—"}</span>
                          </div>
                        </td>

                        {/* Total Dosen */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1 text-slate-600 font-medium">
                            <GraduationCap size={13} className="text-slate-400" />
                            <span>{p._count?.dosen ?? 0} Dosen</span>
                          </div>
                        </td>

                        {/* Total MK */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1 text-slate-600 font-medium">
                            <BookOpen size={13} className="text-slate-400" />
                            <span>{p._count?.mataKuliah ?? 0} MK</span>
                          </div>
                        </td>

                        {/* Aksi */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Table Card: Fakultas ─────────────────────────────────────────────── */}
      {activeTab === "fakultas" && (
        <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs print:shadow-none print:border-none animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[600px]">
              <thead>
                <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                  <th className="py-2.5 px-2.5 w-10 text-center text-slate-700 font-bold">No</th>
                  {renderSortHeaderFakultas("Nama Fakultas", "NAMA", "left", "min-w-[240px]")}
                  {renderSortHeaderFakultas("Total Program Studi", "TOTAL_PRODI", "center", "w-44")}
                  <th className="py-2.5 px-3 text-center text-slate-700 font-bold w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 text-xs">
                {sortedFakultas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-xs text-slate-400">
                      Belum ada data fakultas. Klik tombol "Tambah Fakultas" di atas.
                    </td>
                  </tr>
                ) : (
                  sortedFakultas.map((f, idx) => {
                    const isOdd = idx % 2 === 1;
                    return (
                      <tr
                        key={f.id}
                        className={`transition-colors border-b border-slate-100/80 ${
                          isOdd ? "bg-slate-50" : "bg-white"
                        } hover:bg-[#fdf2f8]/80`}
                      >
                        {/* No */}
                        <td className="py-2.5 px-2.5 text-center font-medium text-slate-400 text-xs">
                          {idx + 1}
                        </td>

                        {/* Nama Fakultas */}
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-[#a80063]" />
                            <span>{f.nama}</span>
                          </div>
                        </td>

                        {/* Total Prodi */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                            {f._count?.prodi ?? f.prodi?.length ?? 0} Program Studi
                          </span>
                        </td>

                        {/* Aksi */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
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
                    );
                  })
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
