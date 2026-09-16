"use client";
// src/app/(dashboard)/lapor-cdu/LaporCduClient.tsx
// Antarmuka Pusat "Lapor CDU" — Sanggahan & Pengaduan Kendala Perkuliahan
// Format Terstandarisasi CDU: Plus Jakarta Sans, #a80063 Brand, Full-Bleed Card, Zebra Rows, Modal Terintegrasi

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  Filter,
  ExternalLink,
  MessageSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
  Loader2,
  Trash2,
  ShieldCheck,
  GraduationCap,
  Calendar,
  Building2,
  BookOpen,
  User,
  Radio,
  FileText,
  Video,
  Send,
  Check,
  Sparkles,
} from "lucide-react";
import {
  LaporCduItem,
  getLaporCduList,
  getClassesForLaporForm,
  getSesiStatusPreview,
  createLaporCdu,
  approveLaporCdu,
  rejectLaporCdu,
  deleteLaporCdu,
} from "@/actions/lapor-cdu";
import { KategoriLapor, StatusLapor } from "@prisma/client";

interface LaporCduClientProps {
  initialItems: LaporCduItem[];
  initialStats: {
    totalAll: number;
    totalPending: number;
    totalDisetujui: number;
    totalDitolak: number;
  };
  semesters: { id: string; label: string; isAktif: boolean }[];
  accessibleProdis: { id: string; nama: string; kode: string }[];
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "ADMIN" | "DOSEN";
    prodiIds: string[];
  };
  defaultSemesterId: string;
}

type SortField = "tanggal" | "pelapor" | "prodi" | "matakuliah" | "sesi" | "status";
type SortOrder = "asc" | "desc";

export default function LaporCduClient({
  initialItems,
  initialStats,
  semesters,
  accessibleProdis,
  currentUser,
  defaultSemesterId,
}: LaporCduClientProps) {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<LaporCduItem[]>(initialItems);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);

  // Filter States
  const [selectedSemester, setSelectedSemester] = useState<string>(defaultSemesterId);
  const [selectedProdi, setSelectedProdi] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Sort State
  const [sortField, setSortField] = useState<SortField>("tanggal");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LaporCduItem | null>(null);

  // Form Create States
  const [formProdiId, setFormProdiId] = useState<string>(
    accessibleProdis.length === 1 ? accessibleProdis[0].id : ""
  );
  const [formKelasId, setFormKelasId] = useState<string>("");
  const [formNomorSesi, setFormNomorSesi] = useState<number>(1);
  const [formKategori, setFormKategori] = useState<KategoriLapor>("KEHADIRAN_ALPHA");
  const [formKeterangan, setFormKeterangan] = useState("");
  const [formTautanBukti, setFormTautanBukti] = useState("");
  const [classesLoading, setClassesLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [sesiPreview, setSesiPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Admin Response States
  const [responCatatan, setResponCatatan] = useState("");
  const [responUpdateMonitoring, setResponUpdateMonitoring] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);

  const isDosen = currentUser.role === "DOSEN";
  const isAdminOrSuper = currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reload data saat filter berubah
  async function reloadData(semester = selectedSemester, prodi = selectedProdi, status = selectedStatus, search = searchQuery) {
    setLoading(true);
    try {
      const res = await getLaporCduList({
        semesterId: semester === "ALL" ? undefined : semester,
        prodiId: prodi === "ALL" ? undefined : prodi,
        status: status === "ALL" ? undefined : status,
        search: search.trim() || undefined,
      });

      if (res.success && res.data) {
        setItems(res.data.items);
        setStats(res.data.stats);
      }
    } catch {
      toast.error("Gagal memperbarui data laporan");
    } finally {
      setLoading(false);
    }
  }

  // Load kelas saat prodi dipilih di form tambah
  useEffect(() => {
    if (!isCreateOpen || !formProdiId) return;

    let isMounted = true;
    setClassesLoading(true);
    setFormKelasId("");
    setSesiPreview(null);

    getClassesForLaporForm(formProdiId, selectedSemester !== "ALL" ? selectedSemester : defaultSemesterId)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setAvailableClasses(res.data);
          if (res.data.length > 0) {
            setFormKelasId(res.data[0].id);
          }
        }
      })
      .finally(() => {
        if (isMounted) setClassesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [formProdiId, isCreateOpen, selectedSemester, defaultSemesterId]);

  // Load status sesi preview saat kelas atau nomor sesi berubah
  useEffect(() => {
    if (!isCreateOpen || !formKelasId || !formNomorSesi) return;

    let isMounted = true;
    setPreviewLoading(true);

    getSesiStatusPreview(formKelasId, formNomorSesi)
      .then((res) => {
        if (isMounted && res.success) {
          setSesiPreview(res.data);
        }
      })
      .finally(() => {
        if (isMounted) setPreviewLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [formKelasId, formNomorSesi, isCreateOpen]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  function renderSortHeader(
    label: string,
    columnKey: SortField,
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isCurrent = sortField === columnKey;
    const isAsc = sortOrder === "asc";

    return (
      <th
        onClick={() => handleSort(columnKey)}
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

  // Filtered & Sorted Items
  const sortedItems = useMemo(() => {
    const list = [...items];

    return list.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortField) {
        case "tanggal":
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        case "pelapor":
          valA = a.pelapor.name.toLowerCase();
          valB = b.pelapor.name.toLowerCase();
          break;
        case "prodi":
          valA = a.prodi.nama.toLowerCase();
          valB = b.prodi.nama.toLowerCase();
          break;
        case "matakuliah":
          valA = a.kelas.mataKuliah.nama.toLowerCase();
          valB = b.kelas.mataKuliah.nama.toLowerCase();
          break;
        case "sesi":
          valA = a.nomorSesi;
          valB = b.nomorSesi;
          break;
        case "status":
          valA = a.status;
          valB = b.status;
          break;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, sortField, sortOrder]);

  function openCreateModal() {
    setFormProdiId(accessibleProdis.length === 1 ? accessibleProdis[0].id : accessibleProdis[0]?.id || "");
    setFormKelasId("");
    setFormNomorSesi(1);
    setFormKategori("KEHADIRAN_ALPHA");
    setFormKeterangan("");
    setFormTautanBukti("");
    setSesiPreview(null);
    setIsCreateOpen(true);
  }

  function openDetailModal(item: LaporCduItem) {
    setSelectedItem(item);
    setResponCatatan(item.catatanCdu || "");
    setResponUpdateMonitoring(true);
    setIsDetailOpen(true);
  }

  function openDeleteModal(item: LaporCduItem) {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  }

  // Handler Submit Laporan Baru
  async function handleSubmitCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!formKelasId) {
      toast.error("Silakan pilih kelas perkuliahan terlebih dahulu");
      return;
    }

    if (formKeterangan.trim().length < 10) {
      toast.error("Penjelasan kendala minimal 10 karakter agar tim CDU dapat memahami duduk perkara");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createLaporCdu({
        kelasId: formKelasId,
        nomorSesi: Number(formNomorSesi),
        kategori: formKategori,
        keterangan: formKeterangan,
        tautanBukti: formTautanBukti.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal membuat laporan");
      } else {
        toast.success("Laporan kendala berhasil dikirim ke tim CDU!");
        setIsCreateOpen(false);
        await reloadData();
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat mengirim laporan");
    } finally {
      setSubmitting(false);
    }
  }

  // Handler Setujui Laporan
  async function handleApprove() {
    if (!selectedItem) return;

    setProcessingAction(true);
    try {
      const res = await approveLaporCdu({
        id: selectedItem.id,
        catatanCdu: responCatatan.trim() || null,
        updateMonitoring: responUpdateMonitoring,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal menyetujui laporan");
      } else {
        toast.success(
          responUpdateMonitoring
            ? "Laporan disetujui & data sesi monitoring berhasil disinkronkan!"
            : "Laporan berhasil disetujui!"
        );
        setIsDetailOpen(false);
        await reloadData();
      }
    } catch {
      toast.error("Terjadi kesalahan saat memproses persetujuan");
    } finally {
      setProcessingAction(false);
    }
  }

  // Handler Tolak Laporan
  async function handleReject() {
    if (!selectedItem) return;

    if (!responCatatan.trim()) {
      toast.error("Wajib mengisi catatan alasan penolakan sebagai feedback untuk pelapor!");
      return;
    }

    setProcessingAction(true);
    try {
      const res = await rejectLaporCdu({
        id: selectedItem.id,
        catatanCdu: responCatatan.trim(),
      });

      if (!res.success) {
        toast.error(res.error || "Gagal menolak laporan");
      } else {
        toast.success("Laporan telah ditolak dengan catatan feedback.");
        setIsDetailOpen(false);
        await reloadData();
      }
    } catch {
      toast.error("Terjadi kesalahan saat memproses penolakan");
    } finally {
      setProcessingAction(false);
    }
  }

  // Handler Hapus Laporan
  async function handleDelete() {
    if (!selectedItem) return;

    setProcessingAction(true);
    try {
      const res = await deleteLaporCdu(selectedItem.id);
      if (!res.success) {
        toast.error(res.error || "Gagal menghapus laporan");
      } else {
        toast.success("Laporan berhasil dihapus.");
        setIsDeleteOpen(false);
        await reloadData();
      }
    } catch {
      toast.error("Terjadi kesalahan saat menghapus laporan");
    } finally {
      setProcessingAction(false);
    }
  }

  function getStatusBadge(status: StatusLapor) {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={11} className="text-amber-500 animate-pulse" />
            <span>Menunggu Review</span>
          </span>
        );
      case "DISETUJUI":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={11} className="text-emerald-600" />
            <span>Disetujui CDU</span>
          </span>
        );
      case "DITOLAK":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={11} className="text-rose-600" />
            <span>Ditolak</span>
          </span>
        );
    }
  }

  function getKategoriLabel(kat: KategoriLapor) {
    switch (kat) {
      case "KEHADIRAN_ALPHA":
        return { label: "Kehadiran (Salah Alpha)", color: "text-rose-600 bg-rose-50 border-rose-200" };
      case "LIVE_CONFERENCE":
        return { label: "Live Conference", color: "text-blue-600 bg-blue-50 border-blue-200" };
      case "KONTEN_MATERI":
        return { label: "Konten Materi / Modul", color: "text-purple-600 bg-purple-50 border-purple-200" };
      case "DOSEN_PENGGANTI":
        return { label: "Dosen Pengganti", color: "text-amber-600 bg-amber-50 border-amber-200" };
      case "LAINNYA":
      default:
        return { label: "Lainnya / Teknis", color: "text-slate-600 bg-slate-100 border-slate-200" };
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <AlertCircle size={18} className="text-[#a80063]" />
            <span>Lapor CDU</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            {isDosen
              ? "Menu Lapor CDU untuk menyampaikan kendala atau sanggahan perkuliahan kepada tim CDU"
              : "Menu Lapor CDU untuk meninjau dan menindaklanjuti laporan kendala perkuliahan yang masuk"}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus size={14} />
          <span>Buat Laporan Baru</span>
        </button>
      </div>

      {/* ── Summary Stats Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total */}
        <div
          onClick={() => {
            setSelectedStatus("ALL");
            reloadData(selectedSemester, selectedProdi, "ALL", searchQuery);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === "ALL"
              ? "bg-slate-50 border-slate-400 shadow-xs"
              : "bg-white border-slate-200/70 hover:bg-slate-50/50"
          } flex items-center gap-3`}
        >
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <FileText size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Laporan</p>
            <p className="text-base font-extrabold text-slate-900 leading-tight">{stats.totalAll}</p>
          </div>
        </div>

        {/* Pending */}
        <div
          onClick={() => {
            setSelectedStatus("PENDING");
            reloadData(selectedSemester, selectedProdi, "PENDING", searchQuery);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === "PENDING"
              ? "bg-amber-50 border-amber-400 shadow-xs"
              : "bg-white border-amber-200/70 hover:bg-amber-50/30"
          } flex items-center gap-3`}
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Menunggu Review</p>
            <p className="text-base font-extrabold text-amber-700 leading-tight">{stats.totalPending}</p>
          </div>
        </div>

        {/* Disetujui */}
        <div
          onClick={() => {
            setSelectedStatus("DISETUJUI");
            reloadData(selectedSemester, selectedProdi, "DISETUJUI", searchQuery);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === "DISETUJUI"
              ? "bg-emerald-50 border-emerald-400 shadow-xs"
              : "bg-white border-emerald-200/70 hover:bg-emerald-50/30"
          } flex items-center gap-3`}
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Disetujui CDU</p>
            <p className="text-base font-extrabold text-emerald-700 leading-tight">{stats.totalDisetujui}</p>
          </div>
        </div>

        {/* Ditolak */}
        <div
          onClick={() => {
            setSelectedStatus("DITOLAK");
            reloadData(selectedSemester, selectedProdi, "DITOLAK", searchQuery);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === "DITOLAK"
              ? "bg-rose-50 border-rose-400 shadow-xs"
              : "bg-white border-rose-200/70 hover:bg-rose-50/30"
          } flex items-center gap-3`}
        >
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
            <XCircle size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Ditolak</p>
            <p className="text-base font-extrabold text-rose-700 leading-tight">{stats.totalDitolak}</p>
          </div>
        </div>
      </div>

      {/* ── Standardized Single-Row Filter Toolbar ─────────────────────────── */}
      <div className="bg-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200/70 print:hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Controls: Search */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative w-full sm:w-48 lg:w-64">
              <Search
                size={13}
                className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
                  searchQuery ? "text-[#a80063]" : "text-slate-400"
                }`}
              />
              <input
                type="text"
                placeholder="Cari kelas, mata kuliah, pelapor..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  reloadData(selectedSemester, selectedProdi, selectedStatus, e.target.value);
                }}
                className={`w-full pl-7 pr-7 py-1 text-xs rounded-lg border outline-none transition-all ${
                  searchQuery
                    ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-[#fbcfe8]"
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    reloadData(selectedSemester, selectedProdi, selectedStatus, "");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Right Controls: Filters & Reset */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Prodi */}
            <select
              value={selectedProdi}
              onChange={(e) => {
                setSelectedProdi(e.target.value);
                reloadData(selectedSemester, e.target.value, selectedStatus, searchQuery);
              }}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all max-w-[170px] truncate ${
                selectedProdi !== "ALL"
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Filter Program Studi"
            >
              <option value="ALL">Semua Prodi ({accessibleProdis.length})</option>
              {accessibleProdis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.kode})
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                reloadData(selectedSemester, selectedProdi, e.target.value, searchQuery);
              }}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                selectedStatus !== "ALL"
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Filter Status"
            >
              <option value="ALL">Semua Status</option>
              <option value="PENDING">Menunggu Review</option>
              <option value="DISETUJUI">Disetujui CDU</option>
              <option value="DITOLAK">Ditolak</option>
            </select>

            {/* Reset All Filters Button */}
            {(searchQuery || selectedProdi !== "ALL" || selectedStatus !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedProdi("ALL");
                  setSelectedStatus("ALL");
                  reloadData(selectedSemester, "ALL", "ALL", "");
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#a80063] bg-[#fdf2f8] border border-[#fbcfe8] hover:bg-[#fce7f3] transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="Reset semua filter ke default"
              >
                <RotateCcw size={10} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs print:shadow-none print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[920px]">
            <thead>
              <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                <th className="py-2.5 px-2.5 w-10 text-center text-slate-700 font-bold">No</th>
                {renderSortHeader("Tanggal Lapor", "tanggal", "left", "w-36")}
                {renderSortHeader("Pelapor", "pelapor", "left", "min-w-[180px]")}
                {renderSortHeader("Program Studi", "prodi", "left", "w-32")}
                {renderSortHeader("Mata Kuliah & Kelas", "matakuliah", "left", "min-w-[180px]")}
                {renderSortHeader("Sesi", "sesi", "center", "w-16")}
                <th className="py-2.5 px-3 text-slate-700 font-bold min-w-[175px]">Kategori Masalah</th>
                {renderSortHeader("Status", "status", "center", "w-32")}
                <th className="py-2.5 px-3 text-center text-slate-700 font-bold w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 size={20} className="animate-spin mx-auto text-[#a80063] mb-2" />
                    <p>Memuat data laporan...</p>
                  </td>
                </tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Tidak ada laporan kendala yang ditemukan untuk filter ini.
                  </td>
                </tr>
              ) : (
                sortedItems.map((item, idx) => {
                  const formattedDate = new Date(item.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const katBadge = getKategoriLabel(item.kategori);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors duration-150 ${
                        idx % 2 === 1 ? "bg-slate-50" : "bg-white"
                      } hover:bg-[#fdf2f8]/80`}
                    >
                      {/* No */}
                      <td className="py-2.5 px-2.5 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Tanggal */}
                      <td className="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Pelapor */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span>{item.pelapor.name}</span>
                        </div>
                      </td>

                      {/* Prodi */}
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>{item.prodi.nama}</span>
                          <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-bold">
                            {item.prodi.kode}
                          </span>
                        </div>
                      </td>

                      {/* Mata Kuliah & Kelas */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 text-xs">
                            {item.kelas.mataKuliah.nama}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]">
                            {item.kelas.kodeKelas}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                          Dosen: {item.kelas.dosen.nama}
                        </p>
                      </td>

                      {/* Sesi */}
                      <td className="py-2.5 px-2.5 text-center">
                        <span className="inline-block w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-extrabold text-[11px] leading-6">
                          {item.nomorSesi}
                        </span>
                      </td>

                      {/* Kategori */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${katBadge.color}`}
                        >
                          {katBadge.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Aksi */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          <button
                            onClick={() => openDetailModal(item)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isAdminOrSuper && item.status === "PENDING"
                                ? "bg-[#a80063] text-white hover:bg-[#8e0054] shadow-xs"
                                : "bg-slate-100 hover:bg-[#fdf2f8] hover:text-[#a80063] text-slate-700 border border-slate-200"
                            }`}
                          >
                            {isAdminOrSuper && item.status === "PENDING" ? "Tinjau" : "Detail"}
                          </button>

                          {(currentUser.role === "SUPER_ADMIN" ||
                            (item.pelaporId === currentUser.id && item.status === "PENDING")) && (
                            <button
                              onClick={() => openDeleteModal(item)}
                              className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-400 border border-slate-200 flex items-center justify-center transition-all cursor-pointer"
                              title="Hapus Laporan"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
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

      {/* ── Modal 1: Buat Laporan Baru (Dosen / Kaprodi / Pelapor) ───────────── */}
      {mounted && isCreateOpen && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-4xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto space-y-4">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#fdf2f8] text-[#a80063] flex items-center justify-center">
                  <Send size={14} />
                </div>
                <span>Buat Laporan Kendala Perkuliahan</span>
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-1">
                Ajukan laporan jika ada ketidaksesuaian data perkuliahan ke tim CDU.
              </p>
            </div>

            <form onSubmit={handleSubmitCreate} className="space-y-4">
              {/* Baris 1: Prodi, Kelas, Sesi */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Pilihan Prodi */}
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Program Studi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formProdiId}
                    onChange={(e) => setFormProdiId(e.target.value)}
                    required
                    disabled={accessibleProdis.length === 1}
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none font-medium"
                  >
                    {accessibleProdis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} ({p.kode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pilihan Kelas */}
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Mata Kuliah & Kelas <span className="text-rose-500">*</span>
                  </label>
                  {classesLoading ? (
                    <div className="py-2 text-xs text-slate-400 flex items-center gap-1.5">
                      <Loader2 size={13} className="animate-spin text-[#a80063]" />
                      <span>Memuat daftar kelas prodi...</span>
                    </div>
                  ) : availableClasses.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      Tidak ada kelas aktif di prodi ini pada semester terpilih.
                    </p>
                  ) : (
                    <select
                      value={formKelasId}
                      onChange={(e) => setFormKelasId(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none font-semibold"
                    >
                      {availableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.kodeKelas}] {c.mataKuliah.nama} - {c.dosen.nama}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Sesi Ke- */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Sesi Ke- <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formNomorSesi}
                    onChange={(e) => setFormNomorSesi(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none font-bold"
                  >
                    {Array.from({ length: 16 }, (_, i) => i + 1).map((s) => (
                      <option key={s} value={s}>
                        Sesi {s} {s === 8 ? "(UTS)" : s === 16 ? "(UAS)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Monitoring Sesi Saat Ini (Format persis sama dengan Detail Modal) */}
              <div className="p-2.5 rounded-xl bg-[#fdf2f8]/60 border border-[#fbcfe8] text-xs">
                <span className="text-[10px] font-bold text-[#a80063] uppercase tracking-wider block mb-1">
                  Data Monitoring Sesi {formNomorSesi} saat ini:
                </span>
                {previewLoading ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 py-0.5">
                    <Loader2 size={13} className="animate-spin text-[#a80063]" />
                    <span>Memuat data monitoring sesi...</span>
                  </div>
                ) : sesiPreview ? (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-slate-700 text-[11px] whitespace-nowrap overflow-x-auto py-0.5">
                    <span>
                      Kehadiran:{" "}
                      <strong
                        className={
                          sesiPreview.kehadiran === "HADIR"
                            ? "text-emerald-600 font-bold"
                            : sesiPreview.kehadiran === "TIDAK_HADIR"
                            ? "text-rose-600 font-bold"
                            : "text-slate-600 font-bold"
                        }
                      >
                        {sesiPreview.kehadiran === "HADIR"
                          ? "Hadir"
                          : sesiPreview.kehadiran === "TIDAK_HADIR"
                          ? "Tidak Hadir"
                          : sesiPreview.kehadiran}
                      </strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      LN:{" "}
                      <strong
                        className={
                          sesiPreview.lectureNote ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                        }
                      >
                        {sesiPreview.lectureNote ? "Ada" : "Tidak Ada"}
                      </strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      Slide:{" "}
                      <strong
                        className={
                          sesiPreview.slide ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                        }
                      >
                        {sesiPreview.slide ? "Ada" : "Tidak Ada"}
                      </strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      Tugas:{" "}
                      <strong
                        className={
                          sesiPreview.tugas ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                        }
                      >
                        {sesiPreview.tugas ? "Ada" : "Tidak Ada"}
                      </strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      Kuis:{" "}
                      <strong
                        className={
                          sesiPreview.kuis ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                        }
                      >
                        {sesiPreview.kuis ? "Ada" : "Tidak Ada"}
                      </strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      Video:{" "}
                      <strong
                        className={
                          sesiPreview.video ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                        }
                      >
                        {sesiPreview.video ? "Ada" : "Tidak Ada"}
                      </strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      Live Conf:{" "}
                      <strong
                        className={
                          sesiPreview.conference ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                        }
                      >
                        {sesiPreview.conference ? "Ada" : "Tidak Ada"}
                      </strong>
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-[11px] py-0.5 block">
                    Belum ada data monitoring untuk sesi ini
                  </span>
                )}
              </div>

              {/* Kategori Kendala (5 tombol sebaris) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Kategori Kendala <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[
                    { val: "KEHADIRAN_ALPHA", label: "Salah Alpha / Hadir", desc: "Dosen hadir tapi tercatat Alpha" },
                    { val: "LIVE_CONFERENCE", label: "Live Conference", desc: "Sudah live tapi belum tercentang" },
                    { val: "KONTEN_MATERI", label: "Konten Materi", desc: "Modul/PPT/Tugas belum tercatat" },
                    { val: "DOSEN_PENGGANTI", label: "Dosen Pengganti", desc: "Ada pergantian Dosen" },
                    { val: "LAINNYA", label: "Lainnya", desc: "Kendala teknis sistem" },
                  ].map((k) => (
                    <button
                      key={k.val}
                      type="button"
                      onClick={() => setFormKategori(k.val as any)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        formKategori === k.val
                          ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-xs font-bold leading-tight">{k.label}</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5 leading-snug">{k.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Penjelasan Kendala */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Penjelasan & Kronologi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Penjelasan detail..."
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none leading-relaxed"
                />
              </div>

              {/* Tautan URL Bukti (Opsional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Tautan URL Bukti (Opsional)</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">(link drive/zoom/rekaman)</span>
                </label>
                <input
                  type="url"
                  value={formTautanBukti}
                  onChange={(e) => setFormTautanBukti(e.target.value)}
                  placeholder="Link..."
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || availableClasses.length === 0}
                  className="btn-brand inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  <span>Kirim Laporan ke CDU</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal 2: Detail Laporan & Penanganan CDU ───────────────────────── */}
      {mounted && isDetailOpen && selectedItem && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDetailOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-4xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto space-y-4">
            <button
              onClick={() => setIsDetailOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Header Modal */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tiket Laporan</span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-mono">#{selectedItem.id.slice(-6).toUpperCase()}</span>
                {getStatusBadge(selectedItem.status)}
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                [{selectedItem.kelas.kodeKelas}] {selectedItem.kelas.mataKuliah.nama} — Sesi {selectedItem.nomorSesi}
              </h3>
            </div>

            {/* Ringkasan Informasi Sesi */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pelapor</span>
                <p className="font-semibold text-slate-900 mt-0.5">{selectedItem.pelapor.name}</p>
                <p className="text-[10px] text-slate-400">{selectedItem.pelapor.email}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Program Studi</span>
                <p className="font-semibold text-slate-900 mt-0.5">{selectedItem.prodi.nama}</p>
                <p className="text-[10px] text-slate-400">Kode: {selectedItem.prodi.kode}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dosen Pengampu</span>
                <p className="font-semibold text-slate-900 mt-0.5">{selectedItem.kelas.dosen.nama}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Masalah</span>
                <p className="font-bold text-[#a80063] mt-0.5">
                  {getKategoriLabel(selectedItem.kategori).label}
                </p>
              </div>
            </div>

            {/* Keterangan Pelapor */}
            <div>
              <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                Keterangan & Kronologi dari Pelapor:
              </span>
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap shadow-2xs">
                {selectedItem.keterangan}
              </div>
            </div>

            {/* Tautan Bukti jika ada */}
            {selectedItem.tautanBukti && (
              <div>
                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Tautan Bukti Terlampir:
                </span>
                <a
                  href={selectedItem.tautanBukti}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink size={13} />
                  <span>Buka Tautan Bukti (Google Drive / Rekaman)</span>
                </a>
              </div>
            )}

            {/* Status Monitoring Sesi Saat Ini */}
            {selectedItem.monitoringSesi && (
              <div className="p-2.5 rounded-xl bg-[#fdf2f8]/60 border border-[#fbcfe8] text-xs">
                <span className="text-[10px] font-bold text-[#a80063] uppercase tracking-wider block mb-1">
                  Data Monitoring Sesi {selectedItem.nomorSesi} saat ini:
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2 text-slate-700 text-[11px] whitespace-nowrap overflow-x-auto py-0.5">
                  <span>
                    Kehadiran:{" "}
                    <strong
                      className={
                        selectedItem.monitoringSesi.kehadiran === "HADIR"
                          ? "text-emerald-600 font-bold"
                          : selectedItem.monitoringSesi.kehadiran === "TIDAK_HADIR"
                          ? "text-rose-600 font-bold"
                          : "text-slate-600 font-bold"
                      }
                    >
                      {selectedItem.monitoringSesi.kehadiran === "HADIR"
                        ? "Hadir"
                        : selectedItem.monitoringSesi.kehadiran === "TIDAK_HADIR"
                        ? "Tidak Hadir"
                        : selectedItem.monitoringSesi.kehadiran}
                    </strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    LN:{" "}
                    <strong className={selectedItem.monitoringSesi.lectureNote ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"}>
                      {selectedItem.monitoringSesi.lectureNote ? "Ada" : "Tidak Ada"}
                    </strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Slide:{" "}
                    <strong className={selectedItem.monitoringSesi.slide ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"}>
                      {selectedItem.monitoringSesi.slide ? "Ada" : "Tidak Ada"}
                    </strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Tugas:{" "}
                    <strong className={selectedItem.monitoringSesi.tugas ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"}>
                      {selectedItem.monitoringSesi.tugas ? "Ada" : "Tidak Ada"}
                    </strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Kuis:{" "}
                    <strong className={selectedItem.monitoringSesi.kuis ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"}>
                      {selectedItem.monitoringSesi.kuis ? "Ada" : "Tidak Ada"}
                    </strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Video:{" "}
                    <strong className={selectedItem.monitoringSesi.video ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"}>
                      {selectedItem.monitoringSesi.video ? "Ada" : "Tidak Ada"}
                    </strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Live Conf:{" "}
                    <strong className={selectedItem.monitoringSesi.conference ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"}>
                      {selectedItem.monitoringSesi.conference ? "Ada" : "Tidak Ada"}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            {/* Riwayat Penanganan (Jika sudah diproses) */}
            {selectedItem.status !== "PENDING" && selectedItem.diprosesOleh && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Hasil Penanganan oleh Tim CDU:
                </span>
                <p className="text-slate-800">
                  Diproses oleh: <strong>{selectedItem.diprosesOleh.name}</strong>
                  {selectedItem.tanggalDiproses && (
                    <span className="text-slate-400 text-[11px]">
                      {" "}
                      pada{" "}
                      {new Date(selectedItem.tanggalDiproses).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </p>
                {selectedItem.catatanCdu && (
                  <p className="text-slate-700 bg-white p-2 rounded border border-slate-200/80 mt-1 italic">
                    "{selectedItem.catatanCdu}"
                  </p>
                )}
              </div>
            )}

            {/* Panel Tindakan CDU (Hanya untuk Admin / Super Admin) */}
            {isAdminOrSuper && selectedItem.status === "PENDING" && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#a80063]" />
                  <span>Keputusan & Tindakan Tim CDU</span>
                </span>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Catatan Respon / Feedback ke Pelapor:
                  </label>
                  <textarea
                    rows={2}
                    value={responCatatan}
                    onChange={(e) => setResponCatatan(e.target.value)}
                    placeholder="Tulis catatan balasan (wajib diisi jika menolak laporan)..."
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={responUpdateMonitoring}
                    onChange={(e) => setResponUpdateMonitoring(e.target.checked)}
                    className="rounded border-slate-300 text-[#a80063] focus:ring-[#a80063] accent-[#a80063] w-4 h-4"
                  />
                  <span>
                    <strong>Otomatis sinkronkan perubahan ke data Monitoring</strong> (Ubah kehadiran menjadi HADIR / centang Live Conference secara otomatis)
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={processingAction}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                  >
                    Tolak Laporan
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={processingAction}
                    className="btn-brand inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    {processingAction && <Loader2 size={13} className="animate-spin" />}
                    <span>Setujui & Selesaikan</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tombol Tutup jika Dosen atau sudah selesai */}
            {(!isAdminOrSuper || selectedItem.status !== "PENDING") && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal 3: Konfirmasi Hapus Laporan ───────────────────────────────── */}
      {mounted && isDeleteOpen && selectedItem && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDeleteOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Hapus Laporan Kendala?</h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Laporan untuk [{selectedItem.kelas.kodeKelas}] {selectedItem.kelas.mataKuliah.nama} Sesi {selectedItem.nomorSesi} akan dihapus secara permanen.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                disabled={processingAction}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={processingAction}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
              >
                {processingAction ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
