"use client";
// src/app/(dashboard)/laporan/rapor-dosen/RaporDosenClient.tsx
// Antarmuka Web Dashboard Rapor Tridharma Dosen (Standar UI CDU Portal: /monitoring)
// Format Terstandarisasi CDU: Plus Jakarta Sans, #a80063 Brand, Duralux-Card, Zebra Rows, Modal Terintegrasi

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  Search,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Sliders,
  Printer,
  RotateCcw,
  Edit3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Loader2,
  AlertCircle,
  Edit2,
  FileDown,
  Mail,
} from "lucide-react";
import TablePagination from "@/components/common/TablePagination";
import RaporConfigModal from "./RaporConfigModal";
import ImportSiakadModal from "./ImportSiakadModal";
import EditRaporModal from "./EditRaporModal";
import SendEmailRaporModal from "./SendEmailRaporModal";
import BatchSendEmailModal from "./BatchSendEmailModal";
import {
  RaporDosenListItem,
  RaporDosenSummary,
  RaporConfigPayload,
  batchUpdateStatusRapor,
  syncAllLecturersFromMonitoring,
} from "@/actions/rapor";

interface SemesterOption {
  id: string;
  tahunAkademik: string;
  periode: string;
  aktif: boolean;
}

interface ProdiOption {
  id: string;
  nama: string;
  kode: string;
}

interface RaporDosenClientProps {
  items: RaporDosenListItem[];
  summary: RaporDosenSummary;
  config: RaporConfigPayload;
  semesters: SemesterOption[];
  currentSemester: SemesterOption;
  prodiList: ProdiOption[];
  initialFilters: {
    semesterId: string;
    prodiId: string;
    status: string;
    search: string;
  };
}

type SortField =
  | "nama"
  | "prodi"
  | "matakuliah"
  | "kelas"
  | "kuesioner"
  | "kehadiran"
  | "konten"
  | "tridharma"
  | "nilaiAkhir"
  | "status";
type SortOrder = "asc" | "desc";

function getPredikatBadge(predikat?: string | null, color?: string | null) {
  const p = predikat?.toUpperCase() || "";
  const c = color?.toLowerCase() || "";

  if (p === "SANGAT_BAIK" || c === "emerald" || c === "green") {
    return {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
      label: "Sangat Baik",
    };
  }
  if (p === "BAIK" || c === "blue") {
    return {
      bg: "bg-blue-50 text-blue-700 border-blue-200",
      dot: "bg-blue-500",
      label: "Baik",
    };
  }
  if (p === "CUKUP" || c === "amber" || c === "yellow") {
    return {
      bg: "bg-amber-50 text-amber-800 border-amber-300",
      dot: "bg-amber-500",
      label: "Cukup",
    };
  }
  if (p === "KURANG_BAIK" || p === "KURANG" || c === "orange" || c === "rose" || c === "red") {
    return {
      bg: "bg-orange-50 text-orange-700 border-orange-200",
      dot: "bg-orange-500",
      label: "Kurang Baik",
    };
  }
  return {
    bg: "bg-slate-100 text-slate-500 border-slate-200/80",
    dot: "bg-slate-400",
    label: "Belum Lengkap",
  };
}

export default function RaporDosenClient({
  items,
  summary: _summary,
  config,
  semesters,
  currentSemester,
  prodiList,
  initialFilters,
}: RaporDosenClientProps) {
  const router = useRouter();

  // Filter States
  const [selectedSemester, setSelectedSemester] = useState(initialFilters.semesterId);
  const [filterProdi, setFilterProdi] = useState(initialFilters.prodiId || "ALL");
  const [filterStatus, setFilterStatus] = useState(initialFilters.status || "ALL");
  const [searchQuery, setSearchQuery] = useState(initialFilters.search || "");

  // Pagination & Sorting States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<SortField>("nama");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Selection & Modal States
  const [selectedDosenIds, setSelectedDosenIds] = useState<Set<string>>(new Set());
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RaporDosenListItem | null>(null);
  const [emailTargetItem, setEmailTargetItem] = useState<RaporDosenListItem | null>(null);
  const [isBatchEmailModalOpen, setIsBatchEmailModalOpen] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [bulkStatusConfirm, setBulkStatusConfirm] = useState<{
    isOpen: boolean;
    targetStatus: "FINAL" | "DRAFT";
    count: number;
  }>({
    isOpen: false,
    targetStatus: "FINAL",
    count: 0,
  });

  // Track last sync time
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`rapor_last_sync_${selectedSemester}`);
      if (stored) {
        setLastSyncTime(new Date(stored));
        return;
      }
    } catch {}

    // Fallback: cari updatedAt terbaru dari items
    let maxTime = 0;
    for (const item of items) {
      if (item.updatedAt) {
        const t = new Date(item.updatedAt).getTime();
        if (t > maxTime) maxTime = t;
      }
    }
    if (maxTime > 0) {
      setLastSyncTime(new Date(maxTime));
    } else {
      setLastSyncTime(null);
    }
  }, [selectedSemester, items]);

  const lastSyncLabel = useMemo(() => {
    if (!lastSyncTime) return null;
    const now = new Date();
    const isToday = lastSyncTime.toDateString() === now.toDateString();
    const timeStr = lastSyncTime.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (isToday) {
      return `Hari ini, ${timeStr}`;
    }
    const dateStr = lastSyncTime.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
    return `${dateStr}, ${timeStr}`;
  }, [lastSyncTime]);

  // Handle Semester Switch
  const handleSemesterChange = (newSemId: string) => {
    setSelectedSemester(newSemId);
    setSelectedDosenIds(new Set());
    setCurrentPage(1);
    router.push(`/laporan/rapor-dosen?semesterId=${newSemId}`);
  };

  // Status Filter Counts (based on current prodi selection)
  const countBase = useMemo(() => {
    return items.filter((item) => {
      if (filterProdi !== "ALL") {
        const pMatch = prodiList.find((p) => p.id === filterProdi);
        if (pMatch && item.prodiNama !== pMatch.nama) return false;
      }
      return true;
    });
  }, [items, filterProdi, prodiList]);

  const countFinal = useMemo(() => countBase.filter((i) => i.statusRapor === "FINAL").length, [countBase]);
  const countDraft = useMemo(() => countBase.filter((i) => i.statusRapor === "DRAFT").length, [countBase]);
  const countBelumDibuat = useMemo(() => countBase.filter((i) => i.statusRapor === "BELUM_DIBUAT").length, [countBase]);

  // Daftar Dosen Terpilih untuk Batch Action (Email, Print, dll)
  const selectedItemsList = useMemo(() => {
    return items.filter((it) => selectedDosenIds.has(it.dosenId));
  }, [items, selectedDosenIds]);

  // Filter Data
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Prodi Filter
      if (filterProdi !== "ALL") {
        const pMatch = prodiList.find((p) => p.id === filterProdi);
        if (pMatch && item.prodiNama !== pMatch.nama) return false;
      }

      // Status Filter
      if (filterStatus !== "ALL" && item.statusRapor !== filterStatus) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const namaMatch = item.dosenNama.toLowerCase().includes(q);
        const nipMatch = item.nip ? item.nip.toLowerCase().includes(q) : false;
        const nidnMatch = item.nidn ? item.nidn.toLowerCase().includes(q) : false;
        if (!namaMatch && !nipMatch && !nidnMatch) return false;
      }

      return true;
    });
  }, [items, filterProdi, filterStatus, searchQuery, prodiList]);

  // Sort Data
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    return list.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortField) {
        case "nama":
          valA = a.dosenNama.toLowerCase();
          valB = b.dosenNama.toLowerCase();
          break;
        case "prodi":
          valA = a.prodiNama.toLowerCase();
          valB = b.prodiNama.toLowerCase();
          break;
        case "matakuliah":
          valA = a.mataKuliahList?.length || 0;
          valB = b.mataKuliahList?.length || 0;
          break;
        case "kelas":
          valA = a.totalKelas;
          valB = b.totalKelas;
          break;
        case "kuesioner":
          valA = a.nilaiKuesioner ?? -1;
          valB = b.nilaiKuesioner ?? -1;
          break;
        case "kehadiran":
          valA = a.rerataSesiHadir ?? -1;
          valB = b.rerataSesiHadir ?? -1;
          break;
        case "konten":
          valA = a.persenKonten ?? -1;
          valB = b.persenKonten ?? -1;
          break;
        case "tridharma":
          valA = (a.jumlahPenelitian || 0) + (a.jumlahPengabdian || 0);
          valB = (b.jumlahPenelitian || 0) + (b.jumlahPengabdian || 0);
          break;
        case "nilaiAkhir":
          valA = a.nilaiAkhir ?? -1;
          valB = b.nilaiAkhir ?? -1;
          break;
        case "status":
          valA = a.statusRapor;
          valB = b.statusRapor;
          break;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortOrder]);

  // Paginated Items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedItems.slice(startIndex, startIndex + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  // Checkbox Selection (Per Page & Individual, matching /monitoring)
  const isAllCurrentPageSelected =
    paginatedItems.length > 0 &&
    paginatedItems.every((item) => selectedDosenIds.has(item.dosenId));

  const toggleSelectAllCurrentPage = () => {
    setSelectedDosenIds((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        paginatedItems.forEach((item) => next.delete(item.dosenId));
      } else {
        paginatedItems.forEach((item) => next.add(item.dosenId));
      }
      return next;
    });
  };

  const toggleSelectDosen = (dosenId: string) => {
    setSelectedDosenIds((prev) => {
      const next = new Set(prev);
      if (next.has(dosenId)) {
        next.delete(dosenId);
      } else {
        next.add(dosenId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedDosenIds(new Set());
  };

  // Batch Update Status
  const handleBatchUpdate = async (newStatus: "DRAFT" | "FINAL") => {
    if (selectedDosenIds.size === 0) return;
    try {
      setIsBatchUpdating(true);
      const res = await batchUpdateStatusRapor(
        Array.from(selectedDosenIds),
        selectedSemester,
        newStatus
      );
      if (res.success) {
        toast.success(`Berhasil mengubah status ${res.count} rapor menjadi ${newStatus}.`);
        clearSelection();
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengubah status batch.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem");
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Sync All from Monitoring CDU
  const handleSyncAll = async () => {
    try {
      setIsSyncingAll(true);
      const res = await syncAllLecturersFromMonitoring(selectedSemester);
      if (res.success) {
        const now = new Date();
        setLastSyncTime(now);
        try {
          localStorage.setItem(`rapor_last_sync_${selectedSemester}`, now.toISOString());
        } catch {}
        toast.success(`Berhasil menyinkronkan data monitoring untuk ${res.count} dosen.`);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal sinkronisasi data.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem");
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Render clickable header column with sort icon (matching /monitoring exact styling)
  function renderSortHeader(
    label: React.ReactNode,
    field: SortField,
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isActive = sortField === field;
    const isAsc = sortOrder === "asc";

    return (
      <th
        onClick={() => {
          if (isActive) {
            setSortOrder(isAsc ? "desc" : "asc");
          } else {
            setSortField(field);
            setSortOrder(field === "nama" || field === "status" || field === "prodi" ? "asc" : "desc");
          }
        }}
        className={`py-2.5 px-2.5 cursor-pointer select-none transition-colors group hover:bg-slate-200/60 ${
          align === "center" ? "text-center" : "text-left"
        } ${extraClass}`}
        title={`Klik untuk mengurutkan berdasarkan ${typeof label === "string" ? label : field}`}
      >
        <div
          className={`inline-flex items-center gap-1 font-bold text-[11px] ${
            isActive ? "text-[#a80063]" : "text-slate-700 group-hover:text-slate-900"
          } ${align === "center" ? "justify-center" : ""}`}
        >
          <span>{label}</span>
          {isActive ? (
            isAsc ? (
              <ArrowUp size={11} className="text-[#a80063] stroke-[2.5]" />
            ) : (
              <ArrowDown size={11} className="text-[#a80063] stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown
              size={10}
              className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>
      </th>
    );
  }

  // Construct dynamic export URL with all active filters
  const exportParams = new URLSearchParams();
  if (selectedSemester) exportParams.set("semesterId", selectedSemester);
  if (filterProdi && filterProdi !== "ALL") exportParams.set("prodiId", filterProdi);
  if (filterStatus && filterStatus !== "ALL") exportParams.set("status", filterStatus);
  if (searchQuery.trim()) exportParams.set("q", searchQuery.trim());
  if (sortField) exportParams.set("sortField", sortField);
  if (sortOrder) exportParams.set("sortOrder", sortOrder);
  const exportUrl = `/api/export/rapor-dosen-excel?${exportParams.toString()}`;

  return (
    <div className="space-y-4">
      {/* ── Top Header Bar (Format Standar /monitoring) ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex flex-wrap items-center gap-2">
            <Award size={18} className="text-[#a80063]" />
            <span>Rapor Tridharma Dosen</span>
            {currentSemester && (
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {currentSemester.tahunAkademik} ({currentSemester.periode})
              </span>
            )}
            {isSyncingAll && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#a80063] bg-[#fdf2f8] border border-[#fbcfe8] px-2 py-0.5 rounded-full">
                <Loader2 size={10} className="animate-spin" />
                <span>Sinkronisasi...</span>
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Evaluasi Kinerja Pembelajaran, Kehadiran, Konten LMS Edlink, Penelitian & Pengabdian Masyarakat
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Export Excel Button (Identik dengan /laporan/rekap & /laporan/dosen) */}
          <a
            id="btn-export-excel-rapor"
            href={exportUrl}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            title="Export Rekapitulasi Rapor Dosen ke Format Excel (.xlsx) sesuai filter aktif"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Export Excel</span>
          </a>

          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-all shadow-xs cursor-pointer"
            title="Konfigurasi Bobot Penilaian, Target Sesi & Pengesahan TTD QAU"
          >
            <Sliders size={13} className="text-[#a80063]" />
            <span>Bobot & Pengesahan</span>
          </button>

          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title={`Sinkronkan data sesi & konten LMS dari kelas monitoring${lastSyncLabel ? ` (Terakhir: ${lastSyncLabel})` : ""}`}
          >
            {isSyncingAll ? (
              <Loader2 size={13} className="animate-spin text-blue-600 shrink-0" />
            ) : (
              <RotateCcw size={13} className="text-blue-600 shrink-0" />
            )}
            <div className="flex flex-col text-left">
              <span className="font-semibold text-xs text-slate-700 leading-tight">Sinkron CDU</span>
              <span className="text-[9px] font-normal text-slate-400 leading-none mt-0.5">
                {lastSyncLabel ? `Terakhir: ${lastSyncLabel}` : "Belum pernah"}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="btn-brand inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs cursor-pointer hover:shadow-sm"
            title="Impor Nilai Angket & Kuesioner Mahasiswa dari SIAKAD"
          >
            <FileSpreadsheet size={13} />
            <span>Import Kuesioner SIAKAD</span>
          </button>
        </div>
      </div>

      {/* ── Standardized Single-Row Filter Toolbar (Identik dengan /monitoring) ── */}
      <div className="bg-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200/70 print:hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Controls: Search & Segmented Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-48 lg:w-56">
              <Search
                size={13}
                className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
                  searchQuery ? "text-[#a80063]" : "text-slate-400"
                }`}
              />
              <input
                type="text"
                placeholder="Cari dosen, NIP, atau NIDN..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
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
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Segmented Filter Status Tabs: Semua Dosen -> Belum Dibuat -> Draft -> Final */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/70">
              <button
                type="button"
                onClick={() => {
                  setFilterStatus("ALL");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Semua Dosen</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/70 text-slate-700 font-bold">
                  {countBase.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterStatus("BELUM_DIBUAT");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === "BELUM_DIBUAT"
                    ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                    : "text-slate-600 hover:text-rose-600 hover:bg-rose-50/50"
                }`}
              >
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Belum Dibuat</span>
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-extrabold">
                  {countBelumDibuat}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterStatus("DRAFT");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === "DRAFT"
                    ? "bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs font-extrabold"
                    : "text-slate-600 hover:text-amber-700 hover:bg-amber-50/50"
                }`}
              >
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Draft</span>
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-extrabold">
                  {countDraft}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterStatus("FINAL");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === "FINAL"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                    : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/50"
                }`}
              >
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Final</span>
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-extrabold">
                  {countFinal}
                </span>
              </button>
            </div>
          </div>

          {/* Right Controls: Filters & Reset */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Semester */}
            <select
              value={selectedSemester}
              onChange={(e) => handleSemesterChange(e.target.value)}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                selectedSemester !== (currentSemester?.id)
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Pilih Semester"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tahunAkademik} ({s.periode}) {s.aktif ? "• Aktif" : ""}
                </option>
              ))}
            </select>

            {/* Filter Prodi */}
            <select
              value={filterProdi}
              onChange={(e) => {
                setFilterProdi(e.target.value);
                setCurrentPage(1);
              }}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all max-w-[150px] truncate ${
                filterProdi !== "ALL"
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Filter Program Studi"
            >
              <option value="ALL">Semua Prodi</option>
              {prodiList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </select>

            {/* Reset All Filters Button */}
            {(searchQuery ||
              filterProdi !== "ALL" ||
              filterStatus !== "ALL" ||
              sortField !== "nama" ||
              sortOrder !== "asc") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterProdi("ALL");
                  setFilterStatus("ALL");
                  setSortField("nama");
                  setSortOrder("asc");
                  setCurrentPage(1);
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

      {/* ── Table Card (Duralux-Card Format Standar /monitoring) ─────────────── */}
      <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs print:shadow-none print:border-none relative">
        {/* Subtle Background Loading Line */}
        {isSyncingAll && (
          <div className="h-0.5 w-full bg-slate-100 overflow-hidden relative">
            <div className="h-full bg-[#a80063] animate-pulse w-full" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1300px]">
            <thead>
              <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                {/* Select All Checkbox */}
                <th className="py-2.5 px-2 text-center w-8">
                  <input
                    id="checkbox-select-all"
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={toggleSelectAllCurrentPage}
                    className={`w-3.5 h-3.5 rounded cursor-pointer transition-all ${
                      isAllCurrentPageSelected
                        ? "opacity-100 accent-[#a80063]"
                        : "border-slate-200 opacity-40 hover:opacity-100"
                    }`}
                    title={isAllCurrentPageSelected ? "Batalkan pilih semua di halaman ini" : "Pilih semua di halaman ini"}
                  />
                </th>
                <th className="py-2.5 px-2.5 text-center w-10">No</th>
                {renderSortHeader("Nama Dosen", "nama", "left", "w-80 min-w-[280px] max-w-[340px] whitespace-nowrap")}
                {renderSortHeader("Program Studi", "prodi", "left", "w-48 min-w-[170px] whitespace-nowrap")}
                {renderSortHeader(
                  <span className="inline-block leading-tight text-center" title="Mata Kuliah Diampu">
                    Matkul<br />
                    Diampu
                  </span>,
                  "matakuliah",
                  "center",
                  "w-16 min-w-[62px] px-1 whitespace-nowrap"
                )}
                {renderSortHeader(
                  <span className="inline-block leading-tight text-center" title="Kelas Diampu">
                    Kelas<br />
                    Diampu
                  </span>,
                  "kelas",
                  "center",
                  "w-14 min-w-[56px] px-1 whitespace-nowrap"
                )}
                {renderSortHeader("Kuesioner", "kuesioner", "center", "w-32 min-w-[115px] whitespace-nowrap")}
                {renderSortHeader("Kehadiran", "kehadiran", "center", "w-32 min-w-[115px] whitespace-nowrap")}
                {renderSortHeader("Konten (3P)", "konten", "center", "w-32 min-w-[115px] whitespace-nowrap")}
                {renderSortHeader("Tridharma", "tridharma", "center", "w-28 min-w-[105px] whitespace-nowrap")}
                {renderSortHeader(
                  <span className="inline-block leading-tight text-center">
                    Nilai &amp;<br />
                    Predikat
                  </span>,
                  "nilaiAkhir",
                  "center",
                  "w-32 min-w-[115px] px-1.5 whitespace-nowrap"
                )}
                <th className="py-2.5 px-3 text-center text-slate-700 font-bold w-28 min-w-[105px] whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-xs">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    {filterStatus === "FINAL" ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-emerald-600">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                        <p className="font-bold text-sm">Semua rapor dosen sudah berstatus Final!</p>
                        <p className="text-xs text-slate-400">
                          Tidak ada antrean rapor draft atau belum dibuat pada kriteria filter ini.
                        </p>
                      </div>
                    ) : filterStatus === "DRAFT" ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-amber-600">
                        <AlertCircle size={32} className="text-amber-500" />
                        <p className="font-bold text-sm">Tidak ada rapor berstatus Draft</p>
                        <p className="text-xs text-slate-400">
                          Semua rapor telah difinalisasi atau belum diinisialisasi.
                        </p>
                      </div>
                    ) : filterStatus === "BELUM_DIBUAT" ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-emerald-600">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                        <p className="font-bold text-sm">Seluruh dosen telah memiliki rapor!</p>
                        <p className="text-xs text-slate-400">
                          Tidak ada dosen yang belum dibuatkan rapor pada kriteria filter ini.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-slate-400">
                        <Award size={32} className="text-slate-300" />
                        <p className="font-bold text-sm text-slate-600">Tidak ada data dosen yang sesuai filter</p>
                        <p className="text-xs text-slate-400">
                          Silakan sesuaikan kata kunci pencarian atau ganti filter program studi.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  const isSelected = selectedDosenIds.has(item.dosenId);
                  const isOdd = idx % 2 === 1;

                  return (
                    <tr
                      key={item.dosenId}
                      className={`transition-colors border-b border-slate-100/80 ${
                        isSelected
                          ? "bg-[#fdf2f8]/50"
                          : isOdd
                          ? "bg-slate-50"
                          : "bg-white"
                      } hover:bg-[#fdf2f8]/80`}
                    >
                      {/* Checkbox (Standar /monitoring) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          id={`checkbox-dosen-${idx}`}
                          data-testid={`checkbox-dosen-${idx}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectDosen(item.dosenId)}
                          className={`w-3.5 h-3.5 rounded cursor-pointer transition-all ${
                            isSelected
                              ? "opacity-100 accent-[#a80063]"
                              : "border-slate-200 opacity-35 hover:opacity-80"
                          }`}
                        />
                      </td>

                      {/* No */}
                      <td className="py-2 px-2 text-center font-medium text-slate-400 text-xs">
                        {rowNumber}
                      </td>

                      {/* Nama Dosen (Standar UI /laporan/dosen) */}
                      <td className="py-3 px-2.5 w-80 min-w-[280px] max-w-[340px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-[#fdf2f8] border border-[#fbcfe8] text-[#a80063] font-semibold text-xs flex items-center justify-center shrink-0">
                            {item.dosenNama[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span
                              className="font-semibold text-xs text-slate-900 leading-tight block truncate max-w-[280px]"
                              title={item.dosenNama}
                            >
                              {item.dosenNama}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block truncate">
                              {item.nip ? `NIP: ${item.nip}` : item.nidn ? `NIDN: ${item.nidn}` : "-"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Program Studi (Standar UI /laporan/dosen) */}
                      <td className="py-3 px-2.5 font-medium text-slate-600 w-48 min-w-[170px]">
                        <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10.5px] font-semibold truncate max-w-[175px]" title={`${item.prodiKode} - ${item.prodiNama}`}>
                          {item.prodiKode} - {item.prodiNama}
                        </span>
                      </td>

                      {/* Mata Kuliah Diampu (Total Saja - Compact) */}
                      <td className="py-3 px-1 text-center whitespace-nowrap w-16">
                        {item.mataKuliahList && item.mataKuliahList.length > 0 ? (
                          <span
                            className="font-semibold text-slate-800 text-xs"
                            title={item.mataKuliahList.join(", ")}
                          >
                            {item.mataKuliahList.length} Matkul
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Kelas Diampu (Total Saja - Compact) */}
                      <td className="py-3 px-1 text-center whitespace-nowrap w-14">
                        {item.totalKelas > 0 ? (
                          <span
                            className="font-semibold text-slate-800 text-xs"
                            title={item.kelasList?.join(", ")}
                          >
                            {item.totalKelas} Kelas
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Kuesioner Mahasiswa */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        {item.nilaiKuesioner != null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-xs text-slate-900 leading-tight">
                              {item.nilaiKuesioner.toFixed(2)}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold leading-tight">
                              {item.totalResponden != null
                                ? `${item.totalResponden} Responden`
                                : "0 Responden"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-semibold text-xs">-</span>
                        )}
                      </td>

                      {/* Kehadiran Mengajar (Total Riil Sesi & Persen) */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        {item.totalSesiHadir != null && item.totalSesiBeban && item.totalSesiBeban > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-xs text-emerald-600 leading-tight whitespace-nowrap">
                              {item.totalSesiHadir} / {item.totalSesiBeban} Sesi
                            </span>
                            <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, item.persenKehadiran || 0))}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold leading-tight">
                              {item.persenKehadiran != null ? `${item.persenKehadiran.toFixed(1)}%` : "0%"}
                            </span>
                          </div>
                        ) : item.rerataSesiHadir != null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-xs text-emerald-600 leading-tight whitespace-nowrap">
                              {item.rerataSesiHadir.toFixed(1)} / {config.targetSesi || 16} Sesi
                            </span>
                            <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, item.persenKehadiran || 0))}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold leading-tight">
                              {item.persenKehadiran != null ? `${item.persenKehadiran.toFixed(1)}%` : "0%"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-semibold text-xs">-</span>
                        )}
                      </td>

                      {/* Konten LMS (Total Riil Poin & Persen) */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        {item.persenKonten != null && item.maxSkorKonten && item.maxSkorKonten > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-xs text-[#a80063] leading-tight whitespace-nowrap">
                              {item.totalSkorKonten ?? Math.round((item.persenKonten / 100) * item.maxSkorKonten)} / {item.maxSkorKonten} Poin
                            </span>
                            <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-[#a80063] rounded-full transition-all"
                                style={{ width: `${Math.min(100, Math.max(0, item.persenKonten))}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold leading-tight">
                              {item.persenKonten.toFixed(1)}%
                            </span>
                          </div>
                        ) : item.persenKonten != null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-xs text-[#a80063] leading-tight whitespace-nowrap">
                              {item.persenKonten.toFixed(1)}%
                            </span>
                            <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-[#a80063] rounded-full transition-all"
                                style={{ width: `${Math.min(100, Math.max(0, item.persenKonten))}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold leading-tight">
                              {item.persenKonten.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-semibold text-xs">-</span>
                        )}
                      </td>

                      {/* Tridharma */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/70 text-slate-700 text-[10px] font-semibold"
                            title={`${item.jumlahPenelitian || 0} Penelitian`}
                          >
                            <strong className="text-slate-900 mr-1">{item.jumlahPenelitian || 0}</strong> Penel.
                          </span>
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/70 text-slate-700 text-[10px] font-semibold"
                            title={`${item.jumlahPengabdian || 0} Pengabdian (PkM)`}
                          >
                            <strong className="text-slate-900 mr-1">{item.jumlahPengabdian || 0}</strong> PkM
                          </span>
                        </div>
                      </td>

                      {/* Nilai Akhir & Predikat */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        {item.nilaiAkhir != null ? (
                          (() => {
                            const badge = getPredikatBadge(item.predikat, item.predikatColor);
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-xs text-slate-900 leading-tight">
                                  {item.nilaiAkhir.toFixed(2)}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold border shadow-2xs ${badge.bg}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                  <span>{item.predikatLabel || badge.label}</span>
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-xs text-slate-300 leading-tight">-</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-slate-100 text-slate-500 border border-slate-200/80 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>Belum Lengkap</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Aksi (Format Standar /master/semester: Rapih & Simple) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingItem(item)}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title="Edit Nilai & Analisis AI"
                          >
                            <Edit2 size={13} />
                          </button>
                          <Link
                            href={`/laporan/rapor-dosen/${item.dosenId}?semesterId=${selectedSemester}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] hover:border-[#fbcfe8] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title={`Preview`}
                          >
                            <Printer size={13} />
                          </Link>

                          {/* Tombol Send Email Rapor */}
                          <button
                            type="button"
                            disabled={!item.email}
                            onClick={() => {
                              if (item.email) {
                                setEmailTargetItem(item);
                              }
                            }}
                            className={`w-7 h-7 rounded-md border flex items-center justify-center transition-all ${
                              item.email
                                ? "bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] hover:border-[#fbcfe8] border-slate-200/80 text-slate-400 hover:text-[#a80063] cursor-pointer active:scale-95 shadow-2xs"
                                : "bg-slate-100/70 border-slate-200/60 text-slate-300 cursor-not-allowed opacity-50"
                            }`}
                            title={item.email ? `Kirim Email Rapor ke ${item.email}` : "Email belum diisi."}
                          >
                            <Mail size={13} />
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

        {/* ── Table Pagination Bar (Identik dengan /monitoring) ─────────────── */}
        <TablePagination
          currentPage={currentPage}
          totalItems={filteredItems.length}
          pageSize={pageSize}
          onPageChange={(p) => {
            setCurrentPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* ── Floating Bulk Action Dock (Identik dengan /monitoring) ─────────── */}
      {selectedDosenIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/60 ring-1 ring-white/10">
            <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold whitespace-nowrap">
                {selectedDosenIds.size} Dosen Terpilih
              </span>
            </div>

            <Link
              id="btn-batch-preview-print"
              href={`/laporan/rapor-dosen/print-batch?ids=${Array.from(selectedDosenIds).join(",")}&semesterId=${selectedSemester}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              title={`Buka Preview & Cetak Lembar Rapor untuk ${selectedDosenIds.size} Dosen Terpilih di Tab Baru`}
            >
              <Printer size={13} />
              <span>Preview ({selectedDosenIds.size})</span>
            </Link>

            {/* Tombol Batch Kirim Email (Aktif jika <= 10 Dosen) */}
            <button
              type="button"
              id="btn-trigger-batch-email"
              disabled={selectedDosenIds.size > 10 || isBatchUpdating}
              onClick={() => setIsBatchEmailModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                selectedDosenIds.size <= 10
                  ? "bg-[#a80063] hover:bg-[#8b0052] text-white cursor-pointer active:scale-95"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
              }`}
              title={
                selectedDosenIds.size <= 10
                  ? `Kirim Email Rapor ke ${selectedDosenIds.size} Dosen Terpilih`
                  : "Maksimal 10 dosen per pengiriman email"
              }
            >
              <Mail size={13} />
              <span>Kirim Email ({selectedDosenIds.size})</span>
            </button>

            <button
              type="button"
              id="btn-trigger-set-final"
              onClick={() =>
                setBulkStatusConfirm({
                  isOpen: true,
                  targetStatus: "FINAL",
                  count: selectedDosenIds.size,
                })
              }
              disabled={isBatchUpdating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title={`Ubah status menjadi FINAL untuk ${selectedDosenIds.size} dosen`}
            >
              {isBatchUpdating ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              <span>Set Final</span>
            </button>

            <button
              type="button"
              id="btn-trigger-set-draft"
              onClick={() =>
                setBulkStatusConfirm({
                  isOpen: true,
                  targetStatus: "DRAFT",
                  count: selectedDosenIds.size,
                })
              }
              disabled={isBatchUpdating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title={`Ubah status menjadi DRAFT untuk ${selectedDosenIds.size} dosen`}
            >
              <Clock size={13} />
              <span>Set Draft</span>
            </button>

            <button
              type="button"
              onClick={clearSelection}
              disabled={isBatchUpdating}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              title="Batalkan pilihan"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <RaporConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        semesterId={selectedSemester}
        semesterLabel={`${currentSemester?.tahunAkademik} ${currentSemester?.periode}`}
        initialConfig={config}
        onSuccess={() => {
          toast.success("Konfigurasi bobot berhasil disimpan.");
          router.refresh();
        }}
      />

      <ImportSiakadModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        semesterId={selectedSemester}
        semesterLabel={`${currentSemester?.tahunAkademik} ${currentSemester?.periode}`}
        onSuccess={() => {
          toast.success("File kuesioner SIAKAD berhasil diimpor.");
          router.refresh();
        }}
      />

      <EditRaporModal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        semesterId={selectedSemester}
        semesterLabel={`${currentSemester?.tahunAkademik} ${currentSemester?.periode}`}
        onSuccess={() => {
          toast.success("Data rapor dosen berhasil diperbarui.");
          router.refresh();
        }}
      />

      {/* ── Modal Konfirmasi Status Masal (Set Final & Set Draft) Standar CDU Portal ── */}
      {bulkStatusConfirm.isOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isBatchUpdating) {
              setBulkStatusConfirm((prev) => ({ ...prev, isOpen: false }));
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  bulkStatusConfirm.targetStatus === "FINAL"
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-amber-50 text-amber-600 border border-amber-200"
                }`}
              >
                {bulkStatusConfirm.targetStatus === "FINAL" ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <Clock size={22} />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {bulkStatusConfirm.targetStatus === "FINAL"
                    ? "Konfirmasi Status Final"
                    : "Konfirmasi Status Draft"}
                </h3>
                <p className="text-xs text-slate-500">
                  {currentSemester?.tahunAkademik} {currentSemester?.periode} &bull; {bulkStatusConfirm.count} Dosen
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin mengatur status rapor untuk{" "}
              <strong className="text-slate-900 font-bold">{bulkStatusConfirm.count} dosen</strong> terpilih menjadi{" "}
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  bulkStatusConfirm.targetStatus === "FINAL"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {bulkStatusConfirm.targetStatus === "FINAL" ? "Final" : "Draft"}
              </span>
              ?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBulkStatusConfirm((prev) => ({ ...prev, isOpen: false }))}
                disabled={isBatchUpdating}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-apply-status"
                onClick={() => {
                  const target = bulkStatusConfirm.targetStatus;
                  setBulkStatusConfirm((prev) => ({ ...prev, isOpen: false }));
                  handleBatchUpdate(target);
                }}
                disabled={isBatchUpdating}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 ${
                  bulkStatusConfirm.targetStatus === "FINAL"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                }`}
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Kirim Rapor Dosen via Email (Individual) ──────────────────── */}
      <SendEmailRaporModal
        isOpen={Boolean(emailTargetItem)}
        onClose={() => setEmailTargetItem(null)}
        item={emailTargetItem}
        semesterId={selectedSemester}
      />

      {/* ── Modal Kirim Rapor Dosen via Email (Masal / Checkbox Maks. 10) ──────── */}
      <BatchSendEmailModal
        isOpen={isBatchEmailModalOpen}
        onClose={() => setIsBatchEmailModalOpen(false)}
        selectedItems={selectedItemsList}
        semesterId={selectedSemester}
        semesterLabel={`${currentSemester?.tahunAkademik || "2026/2027"} (${currentSemester?.periode || "Ganjil"})`}
        onSuccess={() => {
          setIsBatchEmailModalOpen(false);
          clearSelection();
          router.refresh();
        }}
      />

    </div>
  );
}
