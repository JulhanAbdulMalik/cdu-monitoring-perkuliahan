"use client";
// src/app/(dashboard)/monitoring/MonitoringListClient.tsx
// Comprehensive List of All Monitored Classes with Last Updated Timestamp, 3-Pillar Progress & Silent Background Prefetching

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Layers,
  Search,
  BarChart3,
  Building,
  Laptop,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GraduationCap,
  RotateCcw,
  DoorClosed,
  X,
  Loader2,
  Calendar,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMonitoringKelasPaginated,
  MonitoringPaginatedResponse,
  MonitoringSortKey,
  bulkSetAttendanceAction,
} from "@/actions/monitoring";
import {
  getCurrentActiveSessionNumber,
  DEFAULT_SEMESTER_START_DATE,
  formatPct,
} from "@/lib/utils";
import TablePagination from "@/components/common/TablePagination";

interface SemesterOption {
  id: string;
  tahunAkademik: string;
  periode: string;
  aktif: boolean;
  tanggalMulai?: Date | string | null;
  hariLibur?: any[];
}

interface ProdiOption {
  id: string;
  nama: string;
  kode: string;
}

export interface InitialUrlParams {
  prodiId?: string;
  semesterId?: string;
  tab?: "ALL" | "BELUM" | "SUDAH";
  sesi?: number;
  mode?: string;
  hari?: string;
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: MonitoringSortKey;
}

interface MonitoringListClientProps {
  initialData: MonitoringPaginatedResponse;
  semesters: SemesterOption[];
  prodiList: ProdiOption[];
  defaultSemesterId: string;
  initialProdiId?: string;
  initialUrlParams?: InitialUrlParams;
}

export default function MonitoringListClient({
  initialData,
  semesters,
  prodiList,
  defaultSemesterId,
  initialProdiId,
  initialUrlParams,
}: MonitoringListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSem = useMemo(
    () =>
      semesters.find((s) => s.aktif) ||
      semesters.find((s) => s.id === (initialUrlParams?.semesterId || defaultSemesterId)) ||
      semesters[0],
    [semesters, initialUrlParams?.semesterId, defaultSemesterId]
  );

  const defaultActiveSesi = useMemo(() => {
    const semStartStr = activeSem?.tanggalMulai
      ? new Date(activeSem.tanggalMulai).toISOString().split("T")[0]
      : DEFAULT_SEMESTER_START_DATE;
    return getCurrentActiveSessionNumber(semStartStr, activeSem?.hariLibur);
  }, [activeSem]);

  // Inisialisasi state dari initialUrlParams atau URL searchParams (Persistence)
  const [filterProdi, setFilterProdi] = useState<string>(
    initialUrlParams?.prodiId || searchParams.get("prodiId") || initialProdiId || "ALL"
  );
  const [filterMode, setFilterMode] = useState<string>(
    initialUrlParams?.mode || searchParams.get("mode") || "ALL"
  );
  const [filterStatus, setFilterStatus] = useState<string>(
    initialUrlParams?.status || searchParams.get("status") || "ALL"
  );
  const [filterHari, setFilterHari] = useState<string>(
    initialUrlParams?.hari || searchParams.get("hari") || "ALL"
  );
  const [monitoringTab, setMonitoringTab] = useState<"ALL" | "BELUM" | "SUDAH">(
    initialUrlParams?.tab || (searchParams.get("tab") as "ALL" | "BELUM" | "SUDAH") || "ALL"
  );
  const [sortBy, setSortBy] = useState<MonitoringSortKey>(
    initialUrlParams?.sortBy || (searchParams.get("sortBy") as MonitoringSortKey) || "TERBARU"
  );
  const [searchQuery, setSearchQuery] = useState(
    initialUrlParams?.q || searchParams.get("q") || ""
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    initialUrlParams?.q || searchParams.get("q") || ""
  );
  const [selectedSesi, setSelectedSesi] = useState<number>(
    initialUrlParams?.sesi || (searchParams.get("sesi") ? parseInt(searchParams.get("sesi")!, 10) : (initialData.defaultActiveSesi || defaultActiveSesi))
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(
    initialUrlParams?.page || (searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1)
  );
  const [pageSize, setPageSize] = useState(
    initialUrlParams?.pageSize || (searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : 20)
  );

  // ── Bulk Selection & Action States ──────────────────────────────────────────
  const [selectedKelasIds, setSelectedKelasIds] = useState<Set<string>>(new Set());
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [bulkConfirmDialog, setBulkConfirmDialog] = useState<{
    isOpen: boolean;
    targetKehadiran: "HADIR" | "ALPHA";
    count: number;
  }>({
    isOpen: false,
    targetKehadiran: "HADIR",
    count: 0,
  });

  // Bersihkan pilihan kelas saat filter, tab, sesi, atau halaman berubah
  useEffect(() => {
    setSelectedKelasIds(new Set());
  }, [currentPage, selectedSesi, monitoringTab, filterProdi, filterMode, filterHari, filterStatus, defaultSemesterId]);

  // Helper untuk sinkronisasi filter ke URL tanpa reload halaman (URL-driven state)
  const updateUrlParams = useCallback(
    (newParams: Record<string, string | number | null | undefined>) => {
      const current = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([key, val]) => {
        if (
          val === null ||
          val === undefined ||
          val === "" ||
          val === "ALL" ||
          (key === "page" && Number(val) === 1) ||
          (key === "pageSize" && Number(val) === 20) ||
          (key === "sortBy" && val === "TERBARU")
        ) {
          current.delete(key);
        } else {
          current.set(key, String(val));
        }
      });
      const searchStr = current.toString();
      const query = searchStr ? `?${searchStr}` : "";
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Debounce search query agar tidak spam network request saat mengetik cepat
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery !== (initialUrlParams?.q || searchParams.get("q") || "")) {
        setCurrentPage(1);
        updateUrlParams({ q: searchQuery || null, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, updateUrlParams, initialUrlParams?.q, searchParams]);

  // Sinkronisasi selectedSesi bila default sesi berubah karena ganti semester
  useEffect(() => {
    if (!initialUrlParams?.sesi && !searchParams.get("sesi")) {
      setSelectedSesi(defaultActiveSesi);
    }
  }, [defaultActiveSesi, initialUrlParams?.sesi, searchParams]);

  // Object filter aktif untuk TanStack Query key
  const activeFilters = useMemo(
    () => ({
      semesterId: activeSem?.id,
      prodiId: filterProdi,
      filterMode,
      filterHari,
      filterStatus,
      monitoringTab,
      selectedSesi,
      searchQuery: debouncedSearchQuery,
      sortBy,
      pageSize,
    }),
    [
      activeSem?.id,
      filterProdi,
      filterMode,
      filterHari,
      filterStatus,
      monitoringTab,
      selectedSesi,
      debouncedSearchQuery,
      sortBy,
      pageSize,
    ]
  );

  // Cek apakah kondisi saat ini adalah kondisi awal default
  const isInitialParams =
    currentPage === (initialUrlParams?.page || 1) &&
    filterProdi === (initialUrlParams?.prodiId || initialProdiId || "ALL") &&
    filterMode === (initialUrlParams?.mode || "ALL") &&
    filterStatus === (initialUrlParams?.status || "ALL") &&
    filterHari === (initialUrlParams?.hari || "ALL") &&
    monitoringTab === (initialUrlParams?.tab || "ALL") &&
    sortBy === (initialUrlParams?.sortBy || "TERBARU") &&
    debouncedSearchQuery === (initialUrlParams?.q || "") &&
    selectedSesi === (initialUrlParams?.sesi || initialData.defaultActiveSesi || defaultActiveSesi) &&
    pageSize === (initialUrlParams?.pageSize || 20);

  // TanStack Query dengan Server-Side Pagination & Auto Re-fetch
  const { data, isFetching } = useQuery<MonitoringPaginatedResponse>({
    queryKey: ["monitoring-kelas-paginated", { ...activeFilters, page: currentPage }],
    queryFn: async () => {
      const res = await getMonitoringKelasPaginated({
        ...activeFilters,
        page: currentPage,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error || "Gagal memuat data monitoring kelas");
      }
      return res.data;
    },
    initialData: isInitialParams ? initialData : undefined,
    placeholderData: (previousData) => previousData,
    staleTime: 60 * 1000, // Data valid selama 1 menit, tidak perlu spam query
    refetchOnWindowFocus: false, // JANGAN query ulang hanya karena user Alt-Tab / ganti jendela
    refetchOnMount: false,
  });

  const queryClient = useQueryClient();

  // ── REAL-TIME CROSS-TAB & CROSS-WINDOW SYNC ────────────────────────────────
  // Ketika user memonitor & menyimpan data kelas di tab detail / bulk action,
  // tab ini otomatis melakukan invalidate & refetch berbasis EVENT!
  useEffect(() => {
    const handleSync = () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-kelas-paginated"] });
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("cdu_monitoring_sync");
      channel.onmessage = (event) => {
        if (event.data?.type === "MONITORING_UPDATED") {
          handleSync();
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "cdu_monitoring_last_sync") {
        handleSync();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [queryClient]);

  // Ekstrak data hasil query
  const paginatedList = data?.items || [];
  const totalInBase = data?.tabCounts.total ?? 0;
  const belumDimonitorCount = data?.tabCounts.belum ?? 0;
  const sudahDimonitorCount = data?.tabCounts.sudah ?? 0;
  const totalFilteredCount = data?.totalCount ?? 0;

  // Helper untuk membuat link detail monitoring dengan mempertahankan konteks filter
  function getMonitoringDetailUrl(kelasId: string): string {
    const params = new URLSearchParams();
    if (activeSem?.id) params.set("semesterId", activeSem.id);
    if (filterProdi && filterProdi !== "ALL") params.set("prodiId", filterProdi);
    if (monitoringTab && monitoringTab !== "ALL") params.set("tab", monitoringTab);
    if (selectedSesi) params.set("sesi", selectedSesi.toString());
    if (filterMode && filterMode !== "ALL") params.set("mode", filterMode);
    if (filterHari && filterHari !== "ALL") params.set("hari", filterHari);
    if (filterStatus && filterStatus !== "ALL") params.set("status", filterStatus);
    if (debouncedSearchQuery && debouncedSearchQuery.trim()) params.set("q", debouncedSearchQuery.trim());
    if (sortBy && sortBy !== "TERBARU") params.set("sortBy", sortBy);
    const qStr = params.toString();
    return `/monitoring/${kelasId}${qStr ? `?${qStr}` : ""}`;
  }

  // ── Bulk Selection Helpers ──────────────────────────────────────────────────
  const isAllCurrentPageSelected = useMemo(() => {
    return paginatedList.length > 0 && paginatedList.every((cls) => selectedKelasIds.has(cls.id));
  }, [paginatedList, selectedKelasIds]);

  function toggleSelectClass(id: string) {
    setSelectedKelasIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllCurrentPage() {
    if (isAllCurrentPageSelected) {
      setSelectedKelasIds((prev) => {
        const next = new Set(prev);
        paginatedList.forEach((cls) => next.delete(cls.id));
        return next;
      });
    } else {
      setSelectedKelasIds((prev) => {
        const next = new Set(prev);
        paginatedList.forEach((cls) => next.add(cls.id));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedKelasIds(new Set());
  }

  // ── Bulk Attendance Execution Handler ───────────────────────────────────────
  async function handleExecuteBulkAttendance(kehadiran: "HADIR" | "ALPHA") {
    if (selectedKelasIds.size === 0) return;
    setIsBulkExecuting(true);
    setBulkConfirmDialog((prev) => ({ ...prev, isOpen: false }));

    try {
      const ids = Array.from(selectedKelasIds);
      const res = await bulkSetAttendanceAction({
        kelasIds: ids,
        nomorSesi: selectedSesi,
        kehadiran,
      });

      if (res.success) {
        toast.success(
          `Berhasil mengubah presensi ${res.updatedCount || ids.length} kelas menjadi ${
            kehadiran === "HADIR" ? "Hadir" : "Alpha"
          } pada Sesi ${selectedSesi}!`
        );
        clearSelection();
        queryClient.invalidateQueries({ queryKey: ["monitoring-kelas-paginated"] });
      } else {
        toast.error(res.error || "Gagal mengubah presensi masal");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat memproses presensi masal");
    } finally {
      setIsBulkExecuting(false);
    }
  }

  // Helper toggle column sort
  function handleColumnSort(
    column: "KODE" | "MK" | "DOSEN" | "JADWAL" | "RUANG" | "KEHADIRAN" | "PILAR" | "UPDATE"
  ) {
    let nextSort: MonitoringSortKey = "TERBARU";
    switch (column) {
      case "KODE":
        nextSort = sortBy === "KODE_ASC" ? "KODE_DESC" : "KODE_ASC";
        break;
      case "MK":
        nextSort = sortBy === "MK_ASC" ? "MK_DESC" : "MK_ASC";
        break;
      case "DOSEN":
        nextSort = sortBy === "DOSEN_ASC" ? "DOSEN_DESC" : "DOSEN_ASC";
        break;
      case "JADWAL":
        nextSort = sortBy === "JADWAL_ASC" ? "JADWAL_DESC" : "JADWAL_ASC";
        break;
      case "RUANG":
        nextSort = sortBy === "RUANG_ASC" ? "RUANG_DESC" : "RUANG_ASC";
        break;
      case "KEHADIRAN":
        nextSort = sortBy === "KEHADIRAN_DESC" ? "KEHADIRAN_ASC" : "KEHADIRAN_DESC";
        break;
      case "PILAR":
        nextSort = sortBy === "PILAR_DESC" ? "PILAR_ASC" : "PILAR_DESC";
        break;
      case "UPDATE":
        nextSort = sortBy === "TERBARU" ? "TERLAMA" : "TERBARU";
        break;
    }
    setSortBy(nextSort);
    setCurrentPage(1);
    updateUrlParams({ sortBy: nextSort, page: 1 });
  }

  // Render clickable header column with sort icon
  function renderSortHeader(
    label: string,
    columnKey: "KODE" | "MK" | "DOSEN" | "JADWAL" | "RUANG" | "KEHADIRAN" | "PILAR" | "UPDATE",
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isCurrent =
      (columnKey === "KODE" && (sortBy === "KODE_ASC" || sortBy === "KODE_DESC")) ||
      (columnKey === "MK" && (sortBy === "MK_ASC" || sortBy === "MK_DESC")) ||
      (columnKey === "DOSEN" && (sortBy === "DOSEN_ASC" || sortBy === "DOSEN_DESC")) ||
      (columnKey === "JADWAL" && (sortBy === "JADWAL_ASC" || sortBy === "JADWAL_DESC")) ||
      (columnKey === "RUANG" && (sortBy === "RUANG_ASC" || sortBy === "RUANG_DESC")) ||
      (columnKey === "KEHADIRAN" && (sortBy === "KEHADIRAN_ASC" || sortBy === "KEHADIRAN_DESC")) ||
      (columnKey === "PILAR" && (sortBy === "PILAR_ASC" || sortBy === "PILAR_DESC")) ||
      (columnKey === "UPDATE" && (sortBy === "TERBARU" || sortBy === "TERLAMA"));

    const isAsc =
      sortBy === "KODE_ASC" ||
      sortBy === "MK_ASC" ||
      sortBy === "DOSEN_ASC" ||
      sortBy === "JADWAL_ASC" ||
      sortBy === "RUANG_ASC" ||
      sortBy === "KEHADIRAN_ASC" ||
      sortBy === "PILAR_ASC" ||
      sortBy === "TERLAMA";

    return (
      <th
        onClick={() => handleColumnSort(columnKey)}
        className={`py-2.5 px-2.5 cursor-pointer select-none transition-colors group hover:bg-slate-200/60 ${
          align === "center" ? "text-center" : "text-left"
        } ${extraClass}`}
        title={`Klik untuk mengurutkan berdasarkan ${label}`}
      >
        <div
          className={`inline-flex items-center gap-1 font-bold text-[11px] ${
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
      {/* ── Top Header Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex flex-wrap items-center gap-2">
            <Layers size={18} className="text-[#a80063]" />
            <span>Daftar Kelas Monitoring Perkuliahan</span>
            {activeSem && (
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {activeSem.tahunAkademik} ({activeSem.periode})
              </span>
            )}
            {isFetching && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#a80063] bg-[#fdf2f8] border border-[#fbcfe8] px-2 py-0.5 rounded-full">
                <Loader2 size={10} className="animate-spin" />
                <span>Memuat data...</span>
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Pilih kelas untuk melakukan monitoring sesi 1–16, evaluasi 3 pilar materi, dan kuota Live Conference
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Rekapitulasi Laporan */}
          <Link
            href="/laporan/rekap"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-all shadow-xs"
          >
            <BarChart3 size={14} />
            <span>Rekapitulasi Laporan</span>
          </Link>
        </div>
      </div>

      {/* ── Standardized Single-Row Filter Toolbar ─────────────────────────── */}
      <div className="bg-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200/70 print:hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Controls: Search & Segmented Status Filter */}
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
                placeholder="Cari kode kelas, mata kuliah, dosen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-7 pr-7 py-1 text-xs rounded-lg border outline-none transition-all ${
                  searchQuery
                    ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-[#fbcfe8]"
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Segmented Filter Status Monitoring */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/70">
              <button
                type="button"
                onClick={() => {
                  setMonitoringTab("ALL");
                  setCurrentPage(1);
                  updateUrlParams({ tab: "ALL", page: 1 });
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  monitoringTab === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Semua Kelas</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/70 text-slate-700 font-bold">
                  {totalInBase}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMonitoringTab("BELUM");
                  setCurrentPage(1);
                  updateUrlParams({ tab: "BELUM", page: 1 });
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  monitoringTab === "BELUM"
                    ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                    : "text-slate-600 hover:text-rose-600 hover:bg-rose-50/50"
                }`}
              >
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Belum Dimonitor</span>
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-extrabold">
                  {belumDimonitorCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMonitoringTab("SUDAH");
                  setCurrentPage(1);
                  updateUrlParams({ tab: "SUDAH", page: 1 });
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  monitoringTab === "SUDAH"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                    : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/50"
                }`}
              >
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Sudah Dimonitor</span>
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-extrabold">
                  {sudahDimonitorCount}
                </span>
              </button>
            </div>
          </div>

          {/* Right Controls: Filters & Reset */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sesi Selector (1-16) */}
            <select
              value={selectedSesi}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSelectedSesi(val);
                setCurrentPage(1);
                updateUrlParams({ sesi: val, page: 1 });
              }}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                selectedSesi !== defaultActiveSesi
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Pilih Sesi Monitoring"
            >
              {Array.from({ length: 16 }, (_, i) => i + 1).map((sNum) => (
                <option key={sNum} value={sNum}>
                  Sesi {sNum} {sNum === defaultActiveSesi ? "(Aktif)" : sNum === 8 ? "(UTS)" : sNum === 16 ? "(UAS)" : ""}
                </option>
              ))}
            </select>

            {/* Hari Filter */}
            <select
              value={filterHari}
              onChange={(e) => {
                const val = e.target.value;
                setFilterHari(val);
                setCurrentPage(1);
                updateUrlParams({ hari: val, page: 1 });
              }}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                filterHari !== "ALL"
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Filter Hari Perkuliahan"
            >
              <option value="ALL">Semua Hari</option>
              <option value="Senin">Senin</option>
              <option value="Selasa">Selasa</option>
              <option value="Rabu">Rabu</option>
              <option value="Kamis">Kamis</option>
              <option value="Jumat">Jumat</option>
              <option value="Sabtu">Sabtu</option>
              <option value="Minggu">Minggu</option>
            </select>

            {/* Prodi Filter */}
            <select
              value={filterProdi}
              onChange={(e) => {
                const val = e.target.value;
                setFilterProdi(val);
                setCurrentPage(1);
                updateUrlParams({ prodiId: val, page: 1 });
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

            {/* Mode Pembelajaran Filter */}
            <select
              value={filterMode}
              onChange={(e) => {
                const val = e.target.value;
                setFilterMode(val);
                setCurrentPage(1);
                updateUrlParams({ mode: val, page: 1 });
              }}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                filterMode !== "ALL"
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Filter Mode Pembelajaran"
            >
              <option value="ALL">Semua Mode</option>
              <option value="DARING">Online</option>
              <option value="LURING">Offline</option>
              <option value="BIMBINGAN">Bimbingan</option>
            </select>

            {/* Status Evaluasi Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                const val = e.target.value;
                setFilterStatus(val);
                setCurrentPage(1);
                updateUrlParams({ status: val, page: 1 });
              }}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                filterStatus !== "ALL"
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Filter Status Evaluasi"
            >
              <option value="ALL">Semua Status</option>
              <option value="TERLAKSANA">Terlaksana</option>
              <option value="PERHATIAN">Perhatian</option>
            </select>

            {/* Reset All Filters Button */}
            {(searchQuery ||
              monitoringTab !== "ALL" ||
              selectedSesi !== defaultActiveSesi ||
              filterHari !== "ALL" ||
              filterProdi !== (initialProdiId || "ALL") ||
              filterMode !== "ALL" ||
              filterStatus !== "ALL" ||
              sortBy !== "TERBARU") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedSearchQuery("");
                  setMonitoringTab("ALL");
                  setSelectedSesi(defaultActiveSesi);
                  setFilterHari("ALL");
                  setFilterProdi(initialProdiId || "ALL");
                  setFilterMode("ALL");
                  setFilterStatus("ALL");
                  setSortBy("TERBARU");
                  setCurrentPage(1);
                  router.replace(initialProdiId ? `${pathname}?prodiId=${initialProdiId}` : pathname, { scroll: false });
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

      {/* ── Monitored Class Table Card ───────────────────────────────────────── */}
      <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs relative">
        {/* Subtle Background Loading Line */}
        {isFetching && (
          <div className="h-0.5 w-full bg-slate-100 overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-[#a80063]/40 via-[#a80063] to-[#a80063]/40 animate-pulse w-full" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                <th className="py-2.5 px-2 text-center w-8">
                  <input
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
                {renderSortHeader("Kelas", "KODE", "left", "w-28 min-w-[110px]")}
                {renderSortHeader("Mata Kuliah", "MK")}
                {renderSortHeader("Dosen Pengampu", "DOSEN", "left", "min-w-[250px]")}
                {renderSortHeader("Jadwal Kuliah", "JADWAL")}
                {renderSortHeader("Ruang Kelas", "RUANG")}
                {renderSortHeader("Kehadiran", "KEHADIRAN", "center")}
                {renderSortHeader("Skor 3 Pilar", "PILAR", "center")}
                <th className="py-2.5 px-2.5 text-center text-slate-700 font-bold">Live Conf</th>
                <th className="py-2.5 px-2.5 text-center text-slate-700 font-bold w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-xs">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    {monitoringTab === "BELUM" ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-emerald-600">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                        <p className="font-bold text-sm">Semua kelas sudah selesai dimonitor!</p>
                        <p className="text-xs text-slate-400">
                          Tidak ada antrean kelas yang belum dicek pada kriteria filter ini.
                        </p>
                      </div>
                    ) : monitoringTab === "SUDAH" ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-slate-400">
                        <AlertCircle size={32} className="text-slate-300" />
                        <p className="font-bold text-sm">Belum ada kelas yang selesai dimonitor</p>
                        <p className="text-xs text-slate-400">
                          Silakan lakukan pengecekan kelas pada tab &quot;Belum Dimonitor&quot;.
                        </p>
                      </div>
                    ) : (
                      "Tidak ada kelas yang sesuai dengan kriteria filter."
                    )}
                  </td>
                </tr>
              ) : (
                paginatedList.map((cls, idx) => {
                  const isOdd = idx % 2 === 1;
                  const isSelected = selectedKelasIds.has(cls.id);

                  return (
                    <tr
                      key={cls.id}
                      className={`transition-colors border-b border-slate-100/80 ${
                        isSelected
                          ? "bg-[#fdf2f8]/50"
                          : isOdd
                          ? "bg-slate-50"
                          : "bg-white"
                      } hover:bg-[#fdf2f8]/80`}
                    >
                      {/* Checkbox Individual */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectClass(cls.id)}
                          className={`w-3.5 h-3.5 rounded cursor-pointer transition-all ${
                            isSelected
                              ? "opacity-100 accent-[#a80063]"
                              : "border-slate-200 opacity-35 hover:opacity-80"
                          }`}
                        />
                      </td>

                      {/* No */}
                      <td className="py-2 px-2 text-center font-medium text-slate-400 text-xs">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Kode Kelas & Mode (Diperkecil & Compact) */}
                      <td className="py-3 px-2.5 font-bold w-28 min-w-[110px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-[10.5px] font-extrabold w-fit">
                            {cls.kodeKelas}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8.5px] font-bold border w-fit ${
                              cls.modePembelajaran === "BIMBINGAN"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : cls.modePembelajaran === "LURING"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {cls.modePembelajaran === "BIMBINGAN" ? (
                              <>
                                <GraduationCap size={8.5} />
                                <span>Bimbingan</span>
                              </>
                            ) : cls.modePembelajaran === "LURING" ? (
                              <>
                                <Building size={8.5} />
                                <span>Offline</span>
                              </>
                            ) : (
                              <>
                                <Laptop size={8.5} />
                                <span>Online</span>
                              </>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Mata Kuliah */}
                      <td className="py-3 px-2.5">
                        <p className="font-bold text-xs text-slate-900 leading-tight">
                          {cls.mataKuliah.nama}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span>{cls.mataKuliah.kode}</span>
                          <span>•</span>
                          <span>{cls.mataKuliah.sks} SKS</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-600">{cls.mataKuliah.prodi.nama}</span>
                        </div>
                      </td>

                      {/* Dosen */}
                      <td className="py-3 px-2.5">
                        <div>
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <User size={12} className="text-[#a80063] shrink-0" />
                            <span
                              className="font-semibold truncate max-w-[250px] text-xs leading-tight"
                              title={cls.dosen.nama}
                            >
                              {cls.dosen.nama}
                            </span>
                          </div>
                          {cls.dosen.nidn && (
                            <p className="text-[9.5px] text-slate-400 mt-0.5 ml-3.5">
                              NIDN: {cls.dosen.nidn}
                            </p>
                          )}
                          {cls.isSplitPengajar && cls.dosenPengajarList && cls.dosenPengajarList.length > 0 && (
                            <div className="mt-0.5 ml-3.5 space-y-0.5">
                              {cls.dosenPengajarList.map((p, pIdx) => (
                                <div key={pIdx} className="flex items-center gap-1 text-[9px]">
                                  <span
                                    className={`px-1 py-0.2 rounded font-bold shrink-0 border ${
                                      p.status === "PERGANTIAN_TETAP"
                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                  >
                                    {p.status === "PERGANTIAN_TETAP" ? "Baru" : "Ganti"}: S
                                    {Math.min(...p.sesiList)}–{Math.max(...p.sesiList)}
                                  </span>
                                  <span className="truncate max-w-[110px] text-slate-600 font-medium" title={p.nama}>
                                    {p.nama}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Jadwal Kuliah */}
                      <td className="py-3 px-2.5">
                        <p className="font-medium text-slate-700 text-xs leading-tight">
                          {cls.jadwalHari || "-"}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          {cls.jadwalJam || "-"}
                        </p>
                      </td>

                      {/* Ruang Kelas */}
                      <td className="py-3 px-2.5">
                        {cls.ruangan ? (
                          <span className="inline-flex gap-1.5 text-xs font-medium leading-tight text-slate-700">
                            <DoorClosed size={12} className="text-[#a80063] shrink-0" />
                            <span>{cls.ruangan}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Kehadiran */}
                      <td className="py-3 px-2.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-xs text-slate-800 leading-tight">
                            {cls.summary.totalHadir}/16 Sesi
                          </span>
                          <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${cls.summary.persenKehadiran}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-emerald-600 font-bold leading-tight">
                            {formatPct(cls.summary.persenKehadiran)}
                          </span>

                          {/* Status Monitoring Sesi Terpilih */}
                          <div className="mt-0.5">
                            {cls.isMonitored ? (
                              cls.targetSesiIsCatatan ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded border ${cls.targetSesiKehadiranColor} shadow-2xs`}
                                  title={`Status Sesi ${selectedSesi}: ${cls.targetSesiKehadiranLabel}`}
                                >
                                  <Calendar size={8.5} className="shrink-0 text-amber-700" />
                                  <span className="truncate max-w-[120px]">
                                    S{selectedSesi}: {cls.targetSesiKehadiranLabel}
                                  </span>
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.2 rounded border ${cls.targetSesiKehadiranColor}`}
                                  title={`Presensi Sesi ${selectedSesi} sudah diisi: ${cls.targetSesiKehadiranLabel}`}
                                >
                                  <CheckCircle2 size={8.5} className="shrink-0" />
                                  <span>
                                    S{selectedSesi}: {cls.targetSesiKehadiranLabel}
                                  </span>
                                </span>
                              )
                            ) : (
                              <span
                                className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.2 rounded border bg-rose-50 text-rose-700 border-rose-200"
                                title={`Presensi Sesi ${selectedSesi} belum diisi oleh staf CDU`}
                              >
                                <AlertCircle size={8.5} className="shrink-0 text-rose-500" />
                                <span>S{selectedSesi}: Belum Dicek</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Skor 3 Pilar */}
                      <td className="py-3 px-2.5 text-center">
                        {cls.modePembelajaran === "BIMBINGAN" ? (
                          <div className="inline-flex flex-col items-center justify-center">
                            <span
                              className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-purple-200"
                              title="Kelas Bimbingan bebas dari kewajiban 3 pilar konten LMS"
                            >
                              Bebas Konten
                            </span>
                            <span className="text-[8px] text-slate-400 mt-0.5">SCP / Skripsi</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-xs text-[#a80063] leading-tight">
                              {cls.summary.totalSkor3Pilar} / 42 Poin
                            </span>
                            <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-[#a80063] rounded-full transition-all"
                                style={{ width: `${cls.summary.persenKonten}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-semibold leading-tight">
                              {formatPct(cls.summary.persenKonten)} Lengkap
                            </span>

                            {/* Smart Warning: Presensi Hadir tapi Konten Sesi Kosong */}
                            {cls.targetSesiNeedsContentCheck && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.2 rounded border border-amber-300 bg-amber-50 text-amber-800 mt-0.5"
                                title={`Presensi Sesi ${selectedSesi} sudah diisi, namun konten 3 pilar pada sesi ini masih kosong (perlu diverifikasi di LMS)`}
                              >
                                <span>⚠️ S{selectedSesi}: Kosong</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Live Conference Quota */}
                      <td className="py-3 px-2.5 text-center">
                        {cls.modePembelajaran === "LURING" ? (
                          <div className="inline-flex flex-col items-center justify-center">
                            <span
                              className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80"
                              title="Kelas Tatap Muka (Offline) tidak memiliki kewajiban kuota Live Conference"
                            >
                              Bebas Conf
                            </span>
                            <span className="text-[8px] text-slate-400 mt-0.5">Tatap Muka</span>
                          </div>
                        ) : cls.modePembelajaran === "BIMBINGAN" ? (
                          <div className="inline-flex flex-col items-center text-[9px] font-bold leading-tight">
                            <span className={cls.summary.confPraUTS >= 8 ? "text-emerald-700" : "text-amber-700"}>
                              UTS: {cls.summary.confPraUTS}/8 {cls.summary.confPraUTS >= 8 ? "✓" : "⚠️"}
                            </span>
                            <span className={cls.summary.confPraUAS >= 8 ? "text-emerald-700" : "text-amber-700"}>
                              UAS: {cls.summary.confPraUAS}/8 {cls.summary.confPraUAS >= 8 ? "✓" : "⚠️"}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center text-[9px] font-bold leading-tight">
                            <span className={cls.summary.confPraUTS >= 3 ? "text-emerald-700" : "text-amber-700"}>
                              UTS: {cls.summary.confPraUTS}/3 {cls.summary.confPraUTS >= 3 ? "✓" : "⚠️"}
                            </span>
                            <span className={cls.summary.confPraUAS >= 3 ? "text-emerald-700" : "text-amber-700"}>
                              UAS: {cls.summary.confPraUAS}/3 {cls.summary.confPraUAS >= 3 ? "✓" : "⚠️"}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Aksi Button (Buka di Tab Baru) */}
                      <td className="py-3 px-2.5 text-right whitespace-nowrap">
                        <Link
                          href={getMonitoringDetailUrl(cls.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-brand inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md shadow-xs cursor-pointer hover:shadow-sm"
                          title={`Buka monitoring kelas [${cls.kodeKelas}] di tab baru`}
                        >
                          <span>Monitor</span>
                          <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Pagination Bar ────────────────────────────────────────── */}
        <TablePagination
          currentPage={currentPage}
          totalItems={totalFilteredCount}
          pageSize={pageSize}
          onPageChange={(p) => {
            setCurrentPage(p);
            updateUrlParams({ page: p });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
            updateUrlParams({ pageSize: newSize, page: 1 });
          }}
        />
      </div>

      {/* ── Floating Bulk Action Dock ───────────────────────────────────────── */}
      {selectedKelasIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/60 ring-1 ring-white/10">
            <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold whitespace-nowrap">
                {selectedKelasIds.size} Kelas Terpilih
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setBulkConfirmDialog({
                  isOpen: true,
                  targetKehadiran: "HADIR",
                  count: selectedKelasIds.size,
                })
              }
              disabled={isBulkExecuting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title={`Set status Hadir untuk ${selectedKelasIds.size} kelas pada Sesi ${selectedSesi}`}
            >
              {isBulkExecuting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCircle2 size={13} />
              )}
              <span>Hadirkan (Sesi {selectedSesi})</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setBulkConfirmDialog({
                  isOpen: true,
                  targetKehadiran: "ALPHA",
                  count: selectedKelasIds.size,
                })
              }
              disabled={isBulkExecuting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title={`Set status Alpha untuk ${selectedKelasIds.size} kelas pada Sesi ${selectedSesi}`}
            >
              <span>Alpha</span>
            </button>

            <button
              type="button"
              onClick={clearSelection}
              disabled={isBulkExecuting}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              title="Batalkan pilihan"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk Confirmation Dialog Modal ──────────────────────────────────── */}
      {bulkConfirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  bulkConfirmDialog.targetKehadiran === "HADIR"
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-rose-50 text-rose-600 border border-rose-200"
                }`}
              >
                {bulkConfirmDialog.targetKehadiran === "HADIR" ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <AlertCircle size={22} />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Konfirmasi Presensi Masal
                </h3>
                <p className="text-xs text-slate-500">
                  Sesi {selectedSesi} • {bulkConfirmDialog.count} Kelas
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin mengatur status presensi untuk{" "}
              <strong className="text-slate-900 font-bold">{bulkConfirmDialog.count} kelas</strong> terpilih menjadi{" "}
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  bulkConfirmDialog.targetKehadiran === "HADIR"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {bulkConfirmDialog.targetKehadiran === "HADIR" ? "Hadir" : "Alpha"}
              </span>{" "}
              pada <strong className="text-slate-900 font-bold">Sesi {selectedSesi}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBulkConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleExecuteBulkAttendance(bulkConfirmDialog.targetKehadiran)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-xs cursor-pointer active:scale-95 ${
                  bulkConfirmDialog.targetKehadiran === "HADIR"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                }`}
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
