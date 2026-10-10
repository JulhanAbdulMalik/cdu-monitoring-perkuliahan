"use client";
// src/app/(dashboard)/laporan/prodi/LaporanProdiClient.tsx
// Laporan Performa per Program Studi dengan Filter Rentang Tanggal (Senin - Minggu)

import { useState, useEffect, useTransition, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  School,
  Users,
  Printer,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Search,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Video,
  BookOpen,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  GraduationCap,
  Calendar,
} from "lucide-react";
import { ProdiReportItem } from "@/actions/laporan";
import SparklineCard from "@/components/dashboard/SparklineCard";
import { getWeekDates, formatTanggalRange, formatPct } from "@/lib/utils";

interface SemesterOption {
  id: string;
  tahunAkademik: string;
  periode: string;
  aktif: boolean;
}

interface GlobalSummary {
  totalProdi: number;
  totalKelasSemua: number;
  totalDosenSemua: number;
  totalSesiRentangSemua: number;
  avgKehadiranRentangSemua: number;
  avgKontenRentangSemua: number;
  totalConfRentangSemua: number;
  totalGantiHariRentangSemua?: number;
}

interface LaporanProdiClientProps {
  prodiReports: ProdiReportItem[];
  semesters: SemesterOption[];
  defaultSemesterId: string;
  initialStartDate: string;
  initialEndDate: string;
  initialSesi?: number | null;
  initialJenisKelas?: string;
  globalSummary: GlobalSummary;
}

export default function LaporanProdiClient({
  prodiReports,
  semesters,
  defaultSemesterId,
  initialStartDate,
  initialEndDate,
  initialSesi,
  initialJenisKelas,
  globalSummary,
}: LaporanProdiClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Mode Filter: SESI vs TANGGAL
  const [filterMode, setFilterMode] = useState<"TANGGAL" | "SESI">(initialSesi ? "SESI" : "TANGGAL");
  const [selectedSesi, setSelectedSesi] = useState<number>(initialSesi || 1);

  // Date Range States
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedSemester, setSelectedSemester] = useState(defaultSemesterId);
  const [jenisKelas, setJenisKelas] = useState<string>(initialJenisKelas || "ALL");

  useEffect(() => {
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
    if (initialSesi) {
      setFilterMode("SESI");
      setSelectedSesi(initialSesi);
    }
    if (initialJenisKelas) {
      setJenisKelas(initialJenisKelas);
    }
  }, [initialStartDate, initialEndDate, initialSesi, initialJenisKelas]);

  // View & Filter States (Default: TABLE Komparasi)
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("TABLE");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [sortBy, setSortBy] = useState<
    | "kehadiran_desc"
    | "kehadiran_asc"
    | "konten_desc"
    | "konten_asc"
    | "sesi_desc"
    | "sesi_asc"
    | "nama_asc"
    | "nama_desc"
    | "kode_asc"
    | "kode_desc"
    | "dosen_desc"
    | "dosen_asc"
    | "kelas_desc"
    | "kelas_asc"
    | "status_asc"
    | "status_desc"
  >("nama_asc");
  const [expandedProdiIds, setExpandedProdiIds] = useState<Record<string, boolean>>({});

  function toggleExpandProdi(prodiId: string) {
    setExpandedProdiIds((prev) => ({
      ...prev,
      [prodiId]: !prev[prodiId],
    }));
  }

  // Quick Preset Handlers
  function applyPreset(type: "all_time" | "this_week" | "last_week") {
    const today = new Date();

    if (type === "all_time") {
      setStartDate("");
      setEndDate("");
      navigateToRange("", "");
    } else if (type === "this_week") {
      const week = getWeekDates(today);
      setStartDate(week.mondayStr);
      setEndDate(week.sundayStr);
      navigateToRange(week.mondayStr, week.sundayStr);
    } else if (type === "last_week") {
      const lastWeekBase = new Date(today);
      lastWeekBase.setDate(today.getDate() - 7);
      const week = getWeekDates(lastWeekBase);
      setStartDate(week.mondayStr);
      setEndDate(week.sundayStr);
      navigateToRange(week.mondayStr, week.sundayStr);
    }
  }

  function navigateToRange(start: string, end: string, semId = selectedSemester, jenis = jenisKelas) {
    startTransition(() => {
      const params = new URLSearchParams();
      if (start === "ALL" || (!start && !end)) {
        params.set("allTime", "true");
      } else {
        if (start) params.set("startDate", start);
        if (end) params.set("endDate", end);
      }
      if (semId) params.set("semesterId", semId);
      if (jenis && jenis !== "ALL") params.set("jenisKelas", jenis);
      const queryStr = params.toString();
      router.push(`/laporan/prodi${queryStr ? `?${queryStr}` : ""}`);
    });
  }

  function navigateToSesi(sesiNum: number, semId = selectedSemester, jenis = jenisKelas) {
    setSelectedSesi(sesiNum);
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("sesi", sesiNum.toString());
      if (semId) params.set("semesterId", semId);
      if (jenis && jenis !== "ALL") params.set("jenisKelas", jenis);
      router.push(`/laporan/prodi?${params.toString()}`);
    });
  }

  function handleJenisKelasChange(newJenis: string) {
    setJenisKelas(newJenis);
    if (filterMode === "SESI") {
      navigateToSesi(selectedSesi || 1, selectedSemester, newJenis);
    } else {
      navigateToRange(startDate, endDate, selectedSemester, newJenis);
    }
  }

  function handleSwitchMode(mode: "TANGGAL" | "SESI") {
    setFilterMode(mode);
    if (mode === "SESI") {
      navigateToSesi(selectedSesi || 1);
    } else {
      if (startDate && endDate) {
        navigateToRange(startDate, endDate);
      } else {
        applyPreset("last_week");
      }
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateToRange(startDate, endDate);
  }

  function handleSesiSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateToSesi(selectedSesi);
  }

  // Client-side filtering & sorting
  const filteredList = prodiReports.filter((p) => {
    const matchSearch =
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.fakultasNama && p.fakultasNama.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = filterStatus === "ALL" || p.statusKinerjaRentang === filterStatus;
    return matchSearch && matchStatus;
  });

  const sortedList = [...filteredList].sort((a, b) => {
    switch (sortBy) {
      case "nama_asc":
        return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
      case "nama_desc":
        return b.nama.localeCompare(a.nama, "id", { sensitivity: "base" });
      case "kode_asc":
        return a.kode.localeCompare(b.kode, "id", { sensitivity: "base" });
      case "kode_desc":
        return b.kode.localeCompare(a.kode, "id", { sensitivity: "base" });
      case "dosen_desc":
        return b.totalDosenAktifRentang - a.totalDosenAktifRentang;
      case "dosen_asc":
        return a.totalDosenAktifRentang - b.totalDosenAktifRentang;
      case "kelas_desc":
        return b.totalKelasAktifRentang - a.totalKelasAktifRentang;
      case "kelas_asc":
        return a.totalKelasAktifRentang - b.totalKelasAktifRentang;
      case "sesi_desc":
        return b.totalSesiRentang - a.totalSesiRentang;
      case "sesi_asc":
        return a.totalSesiRentang - b.totalSesiRentang;
      case "kehadiran_desc":
        return (b.avgKehadiranRentang ?? -1) - (a.avgKehadiranRentang ?? -1);
      case "kehadiran_asc":
        return (a.avgKehadiranRentang ?? 999) - (b.avgKehadiranRentang ?? 999);
      case "konten_desc":
        return (b.avgKontenRentang ?? -1) - (a.avgKontenRentang ?? -1);
      case "konten_asc":
        return (a.avgKontenRentang ?? 999) - (b.avgKontenRentang ?? 999);
      case "status_asc": {
        const rank: Record<string, number> = {
          BELUM_ADA_KELAS: 0,
          PERLU_PEMBINAAN: 1,
          BAIK: 2,
          SANGAT_BAIK: 3,
        };
        return (rank[a.statusKinerjaRentang] || 0) - (rank[b.statusKinerjaRentang] || 0);
      }
      case "status_desc": {
        const rank: Record<string, number> = {
          BELUM_ADA_KELAS: 0,
          PERLU_PEMBINAAN: 1,
          BAIK: 2,
          SANGAT_BAIK: 3,
        };
        return (rank[b.statusKinerjaRentang] || 0) - (rank[a.statusKinerjaRentang] || 0);
      }
      default:
        return 0;
    }
  });

  type ProdiSortColumn =
    | "KODE"
    | "PRODI"
    | "DOSEN"
    | "KELAS"
    | "SESI"
    | "HADIR"
    | "KONTEN"
    | "STATUS";

  function handleColumnSort(column: ProdiSortColumn) {
    switch (column) {
      case "KODE":
        setSortBy(sortBy === "kode_asc" ? "kode_desc" : "kode_asc");
        break;
      case "PRODI":
        setSortBy(sortBy === "nama_asc" ? "nama_desc" : "nama_asc");
        break;
      case "DOSEN":
        setSortBy(sortBy === "dosen_desc" ? "dosen_asc" : "dosen_desc");
        break;
      case "KELAS":
        setSortBy(sortBy === "kelas_desc" ? "kelas_asc" : "kelas_desc");
        break;
      case "SESI":
        setSortBy(sortBy === "sesi_desc" ? "sesi_asc" : "sesi_desc");
        break;
      case "HADIR":
        setSortBy(sortBy === "kehadiran_desc" ? "kehadiran_asc" : "kehadiran_desc");
        break;
      case "KONTEN":
        setSortBy(sortBy === "konten_desc" ? "konten_asc" : "konten_desc");
        break;
      case "STATUS":
        setSortBy(sortBy === "status_asc" ? "status_desc" : "status_asc");
        break;
    }
  }

  function renderSortHeader(
    label: string,
    columnKey: ProdiSortColumn,
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isCurrent =
      (columnKey === "KODE" && (sortBy === "kode_asc" || sortBy === "kode_desc")) ||
      (columnKey === "PRODI" && (sortBy === "nama_asc" || sortBy === "nama_desc")) ||
      (columnKey === "DOSEN" && (sortBy === "dosen_desc" || sortBy === "dosen_asc")) ||
      (columnKey === "KELAS" && (sortBy === "kelas_desc" || sortBy === "kelas_asc")) ||
      (columnKey === "SESI" && (sortBy === "sesi_desc" || sortBy === "sesi_asc")) ||
      (columnKey === "HADIR" && (sortBy === "kehadiran_desc" || sortBy === "kehadiran_asc")) ||
      (columnKey === "KONTEN" && (sortBy === "konten_desc" || sortBy === "konten_asc")) ||
      (columnKey === "STATUS" && (sortBy === "status_asc" || sortBy === "status_desc"));

    const isAsc =
      sortBy === "kode_asc" ||
      sortBy === "nama_asc" ||
      sortBy === "dosen_asc" ||
      sortBy === "kelas_asc" ||
      sortBy === "sesi_asc" ||
      sortBy === "kehadiran_asc" ||
      sortBy === "konten_asc" ||
      sortBy === "status_asc";

    return (
      <th
        onClick={() => handleColumnSort(columnKey)}
        className={`py-2.5 px-2.5 cursor-pointer select-none transition-colors group hover:bg-slate-200/60 ${
          align === "center" ? "text-center" : "text-left"
        } ${extraClass}`}
        title={`Klik untuk mengurutkan berdasarkan ${label}`}
      >
        <div
          className={`inline-flex items-center gap-1 font-bold text-[11px] whitespace-nowrap ${
            isCurrent ? "text-[#a80063]" : "text-slate-700 group-hover:text-slate-900"
          } ${align === "center" ? "justify-center" : ""}`}
        >
          <span className="whitespace-nowrap">{label}</span>
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

  const currentSem =
    semesters.find((s) => s.id === selectedSemester) || semesters[0];

  function handlePrint() {
    window.print();
  }

  function handleExportExcel() {
    const params = new URLSearchParams();
    if (filterMode === "SESI") {
      params.set("sesi", (selectedSesi || 1).toString());
    } else {
      if (initialStartDate) params.set("startDate", initialStartDate);
      if (initialEndDate) params.set("endDate", initialEndDate);
    }
    if (selectedSemester) params.set("semesterId", selectedSemester);
    if (jenisKelas && jenisKelas !== "ALL") params.set("jenisKelas", jenisKelas);

    window.location.href = `/api/export/prodi-excel?${params.toString()}`;
  }

  // Active Filter Helpers
  const isSesiActive = filterMode === "SESI";
  const appliedSesi = initialSesi || 1;
  const isSesiDirty = isSesiActive && selectedSesi !== appliedSesi;
  const appliedStartDate = initialStartDate;
  const appliedEndDate = initialEndDate;
  const isAppliedAllTime = !isSesiActive && !appliedStartDate && !appliedEndDate;

  const thisWeek = getWeekDates(new Date());
  const isThisWeekApplied =
    !isSesiActive &&
    !isAppliedAllTime &&
    appliedStartDate === thisWeek.mondayStr &&
    appliedEndDate === thisWeek.sundayStr;

  const lastWeekBase = new Date();
  lastWeekBase.setDate(lastWeekBase.getDate() - 7);
  const lastWeek = getWeekDates(lastWeekBase);
  const isLastWeekApplied =
    !isSesiActive &&
    !isAppliedAllTime &&
    appliedStartDate === lastWeek.mondayStr &&
    appliedEndDate === lastWeek.sundayStr;

  const isCustomDateApplied =
    !isSesiActive && !isAppliedAllTime && !isThisWeekApplied && !isLastWeekApplied;

  const isDateDirty =
    startDate !== appliedStartDate || endDate !== appliedEndDate;
  const hasActiveSearch = searchQuery.trim().length > 0;
  const hasActiveStatus = filterStatus !== "ALL";
  const hasActiveJenisKelas = jenisKelas !== "ALL";
  const hasActiveSort = sortBy !== "nama_asc";
  const hasAnyFilterActive =
    hasActiveSearch ||
    hasActiveStatus ||
    hasActiveJenisKelas ||
    hasActiveSort ||
    isSesiActive ||
    !isLastWeekApplied ||
    isDateDirty ||
    isSesiDirty;

  // Metrik agregasi untuk 4 Card Info (Gaya Dashboard / SparklineCard)
  const sangatBaikCount = prodiReports.filter(
    (p) => p.statusKinerjaRentang === "SANGAT_BAIK"
  ).length;
  const baikCount = prodiReports.filter(
    (p) => p.statusKinerjaRentang === "BAIK"
  ).length;
  const perhatianCount = prodiReports.filter(
    (p) => p.statusKinerjaRentang === "PERLU_PEMBINAAN"
  ).length;
  const belumAdaKelasCount = prodiReports.filter(
    (p) => p.statusKinerjaRentang === "BELUM_ADA_KELAS"
  ).length;
  const prodiAktifCount = prodiReports.filter(
    (p) => p.totalKelas > 0
  ).length;

  const totalHadirUniv = prodiReports.reduce(
    (acc, p) => acc + (p.totalHadirRentang || 0) + (p.totalHadirTdkLengkapRentang || 0),
    0
  );
  const totalAlphaUniv = prodiReports.reduce(
    (acc, p) => acc + (p.totalAlphaRentang || 0),
    0
  );
  const totalGantiHariUniv =
    globalSummary.totalGantiHariRentangSemua ??
    prodiReports.reduce((acc, p) => acc + (p.totalGantiHariRentang || 0), 0);

  const totalRegularUniv = prodiReports.reduce(
    (acc, p) => acc + (p.totalRegularSesiRentang || 0),
    0
  );
  const totalPilar1Univ = prodiReports.reduce(
    (acc, p) => acc + (p.totalPilar1Rentang || 0),
    0
  );
  const totalPilar2Univ = prodiReports.reduce(
    (acc, p) => acc + (p.totalPilar2Rentang || 0),
    0
  );
  const totalPilar3Univ = prodiReports.reduce(
    (acc, p) => acc + (p.totalPilar3Rentang || 0),
    0
  );

  const p1Pct =
    totalRegularUniv > 0
      ? Math.round((totalPilar1Univ / totalRegularUniv) * 1000) / 10
      : 0;
  const p2Pct =
    totalRegularUniv > 0
      ? Math.round((totalPilar2Univ / totalRegularUniv) * 1000) / 10
      : 0;
  const p3Pct =
    totalRegularUniv > 0
      ? Math.round((totalPilar3Univ / totalRegularUniv) * 1000) / 10
      : 0;

  return (
    <div className="space-y-4">
      {/* ── Top Header Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)] print:hidden">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <Building2 size={19} className="text-[#a80063]" />
            <span>Laporan Performa per Program Studi</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Komparasi efektivitas perkuliahan, kehadiran dosen, dan kepatuhan 3 pilar materi per program studi per minggu/tanggal
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            <span>Export Excel</span>
          </button>

          {/* Print PDF Button */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
          >
            <Printer size={14} />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* ── Official Print Header (Visible Only When Printing) ────────────────── */}
      <div className="hidden print:block text-center pb-4 mb-4 border-b border-slate-300">
        <h2 className="text-base font-bold text-slate-900 uppercase">
          Universitas Nusa Putra - Curriculum Development Unit (CDU)
        </h2>
        <h3 className="text-sm font-semibold text-slate-700 mt-0.5">
          {isSesiActive
            ? `Laporan Performa Program Studi - Evaluasi Sesi ${selectedSesi}${selectedSesi === 8 ? " (UTS)" : selectedSesi === 16 ? " (UAS)" : ""}`
            : "Laporan Performa Program Studi per Periode Tanggal"}
          {hasActiveJenisKelas
            ? ` [Kelas ${jenisKelas === "LURING" ? "Offline" : jenisKelas === "DARING" ? "Online" : "Bimbingan"}]`
            : ""}
        </h3>
        <p className="text-xs font-medium text-slate-600 mt-0.5">
          Periode: {
            isSesiActive
              ? `Sesi Perkuliahan ke-${selectedSesi}${selectedSesi === 8 ? " (UTS)" : selectedSesi === 16 ? " (UAS)" : ""}`
              : isAppliedAllTime
              ? "Semua Waktu (1 Semester)"
              : formatTanggalRange(appliedStartDate, appliedEndDate)
          } | Semester: {currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : "Aktif"}
        </p>
        <p className="text-[10px] text-slate-500 mt-1">
          Dicetak pada: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ── University-wide KPI Summary Cards (SparklineCard Style) ──────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
        {/* Card 1: Total Program Studi */}
        <SparklineCard
          title="Total Program Studi"
          value={`${globalSummary.totalProdi} Prodi`}
          subtitle={`${globalSummary.totalKelasSemua.toLocaleString("id-ID")} Kelas${
            hasActiveJenisKelas
              ? ` (${jenisKelas === "LURING" ? "Offline" : jenisKelas === "DARING" ? "Online" : "Bimbingan"})`
              : ""
          } • ${globalSummary.totalDosenSemua.toLocaleString("id-ID")} Dosen terdaftar`}
          trendText={
            isSesiActive
              ? `Sesi ${selectedSesi}`
              : isAppliedAllTime
              ? "Semua Waktu"
              : "Rentang Aktif"
          }
          isPositive={true}
          segments={[
            { label: "Prodi Aktif", value: prodiAktifCount, color: "emerald" },
            ...(belumAdaKelasCount > 0
              ? [{ label: "Belum Ada Kelas", value: belumAdaKelasCount, color: "slate" as const }]
              : []),
          ]}
          details={[
            { label: "Prodi Aktif", value: `${prodiAktifCount}`, color: "emerald" },
            ...(belumAdaKelasCount > 0
              ? [{ label: "Tanpa Kelas", value: `${belumAdaKelasCount}`, color: "slate" as const }]
              : []),
            { label: "Total Kelas", value: `${globalSummary.totalKelasSemua}`, color: "blue" },
            { label: "Total Dosen", value: `${globalSummary.totalDosenSemua}`, color: "violet" },
          ]}
        />

        {/* Card 2: Prodi Perlu Perhatian */}
        <SparklineCard
          title="Prodi Perlu Perhatian"
          value={`${perhatianCount} Prodi`}
          subtitle={
            perhatianCount === 0
              ? "Seluruh prodi aktif memenuhi target performa"
              : `${perhatianCount} prodi di bawah target kinerja`
          }
          trendText={perhatianCount === 0 ? "Kondisi Baik" : `${perhatianCount} Perlu Dicek`}
          isPositive={perhatianCount === 0}
          segments={[
            ...(perhatianCount > 0
              ? [{ label: "Perhatian", value: perhatianCount, color: "rose" as const }]
              : []),
            { label: "Sangat Baik", value: sangatBaikCount, color: "emerald" },
            { label: "Baik", value: baikCount, color: "blue" },
            ...(belumAdaKelasCount > 0
              ? [{ label: "Belum Ada Kelas", value: belumAdaKelasCount, color: "slate" as const }]
              : []),
          ]}
          details={[
            { label: "Sangat Baik", value: `${sangatBaikCount}`, color: "emerald" },
            { label: "Baik", value: `${baikCount}`, color: "blue" },
            { label: "Perhatian", value: `${perhatianCount}`, color: "rose" },
            ...(belumAdaKelasCount > 0
              ? [{ label: "Belum Ada Kelas", value: `${belumAdaKelasCount}`, color: "slate" as const }]
              : []),
          ]}
        />

        {/* Card 3: Rata Kehadiran Univ */}
        <SparklineCard
          title={
            isSesiActive
              ? `Rata-rata Kehadiran (Sesi ${selectedSesi})`
              : isAppliedAllTime
              ? "Rata-rata Kehadiran (Semua)"
              : "Rata-rata Kehadiran (Rentang)"
          }
          value={formatPct(globalSummary.avgKehadiranRentangSemua)}
          valueColor="emerald"
          subtitle={
            isSesiActive
              ? `Total ${globalSummary.totalSesiRentangSemua.toLocaleString("id-ID")} kelas pada Sesi ${selectedSesi}`
              : `Total ${globalSummary.totalSesiRentangSemua.toLocaleString("id-ID")} sesi ${
                  isAppliedAllTime ? "semester ini" : "pada rentang aktif"
                }`
          }
          trendText={globalSummary.avgKehadiranRentangSemua >= 90 ? "Target Tercapai" : "Di Bawah Target"}
          isPositive={globalSummary.avgKehadiranRentangSemua >= 90}
          progress={globalSummary.avgKehadiranRentangSemua}
          progressColor="emerald"
          details={[
            { label: "Hadir", value: `${totalHadirUniv.toLocaleString("id-ID")}`, color: "emerald" },
            { label: "Alpha", value: `${totalAlphaUniv.toLocaleString("id-ID")}`, color: "rose" },
            ...(totalGantiHariUniv > 0
              ? [{ label: "Ganti Hari", value: `${totalGantiHariUniv.toLocaleString("id-ID")}`, color: "amber" as const }]
              : []),
            { label: "Target CDU", value: "≥90%", color: "slate" },
          ]}
        />

        {/* Card 4: Rata-rata Konten */}
        <SparklineCard
          title={
            isSesiActive
              ? `Rata-rata Konten (Sesi ${selectedSesi})`
              : isAppliedAllTime
              ? "Rata-rata Konten (Semua)"
              : "Rata-rata Konten (Rentang)"
          }
          value={formatPct(globalSummary.avgKontenRentangSemua)}
          valueColor="maroon"
          subtitle={
            isSesiActive
              ? `Rerata keterpenuhan 3 pilar seluruh kelas reguler pada Sesi ${selectedSesi}`
              : isAppliedAllTime
              ? "Rerata keterpenuhan 3 pilar seluruh kelas reguler"
              : "Rerata keterpenuhan 3 pilar pada rentang aktif"
          }
          trendText={globalSummary.avgKontenRentangSemua >= 75 ? "Sesuai Standar" : "Perlu Optimasi"}
          isPositive={globalSummary.avgKontenRentangSemua >= 75}
          progress={globalSummary.avgKontenRentangSemua}
          progressColor="maroon"
          details={[
            { label: "P1 (L/S)", value: formatPct(p1Pct), color: "maroon" },
            { label: "P2 (T/Q)", value: formatPct(p2Pct), color: "maroon" },
            { label: "P3 (V/C)", value: formatPct(p3Pct), color: "maroon" },
          ]}
        />
      </div>

      {/* ── Single-Row Compact Filter Toolbar ─────────────────────────────── */}
      <div className="bg-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200/70 print:hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Controls: Search, Mode Switcher, and Mode Inputs + Terapkan */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input with Subtle Active State */}
            <div className="relative w-full sm:w-44 lg:w-52 shrink-0">
              <Search
                size={13}
                className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
                  hasActiveSearch ? "text-[#a80063]" : "text-slate-400"
                }`}
              />
              <input
                type="text"
                placeholder="Cari prodi, kode, fakultas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-7 pr-7 py-1 text-xs rounded-lg border outline-none transition-all ${
                  hasActiveSearch
                    ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-[#fbcfe8]"
                }`}
              />
              {hasActiveSearch && (
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

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            {/* Mode Switcher Tabs (Per Sesi vs Rentang Tanggal) */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/70 text-[11px] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => handleSwitchMode("SESI")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filterMode === "SESI"
                    ? "bg-white text-[#a80063] font-bold shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Evaluasi kurikulum per Sesi Perkuliahan (1 s.d. 16)"
              >
                <GraduationCap size={12} className={filterMode === "SESI" ? "text-[#a80063]" : "text-slate-400"} />
                <span>Per Sesi</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("TANGGAL")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filterMode === "TANGGAL"
                    ? "bg-white text-[#a80063] font-bold shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Evaluasi operasional berdasarkan Rentang Tanggal Kalender"
              >
                <Calendar size={12} className={filterMode === "TANGGAL" ? "text-[#a80063]" : "text-slate-400"} />
                <span>Rentang Tanggal</span>
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden md:block" />

            {/* Controls Spesifik Mode Aktif */}
            {filterMode === "SESI" ? (
              /* Mode Sesi: Dropdown Sesi + Tombol Terapkan */
              <form onSubmit={handleSesiSubmit} className="flex items-center gap-1.5">
                <select
                  value={selectedSesi}
                  onChange={(e) => setSelectedSesi(Number(e.target.value))}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border outline-none cursor-pointer transition-all ${
                    isSesiDirty
                      ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063]"
                      : "bg-slate-50 border-slate-200 text-slate-800 focus:border-[#fbcfe8]"
                  }`}
                  title="Pilih nomor sesi perkuliahan (1 s.d. 16)"
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((sNum) => {
                    const isUTS = sNum === 8;
                    const isUAS = sNum === 16;
                    const label = isUTS
                      ? `Sesi ${sNum} (UTS)`
                      : isUAS
                      ? `Sesi ${sNum} (UAS)`
                      : `Sesi ${sNum}`;
                    return (
                      <option key={sNum} value={sNum}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="submit"
                  disabled={isPending}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    isSesiDirty
                      ? "bg-[#a80063] hover:bg-[#8c0052] text-white shadow-xs ring-2 ring-[#a80063]/30 animate-pulse"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                  }`}
                  title={isSesiDirty ? "Klik untuk menerapkan sesi ini" : "Terapkan sesi yang dipilih"}
                >
                  <RefreshCw size={10} className={isPending ? "animate-spin" : ""} />
                  <span>{isPending ? "Memuat..." : "Terapkan"}</span>
                </button>
              </form>
            ) : (
              /* Mode Tanggal: Preset Tanggal + Date Picker + Tombol Terapkan */
              <>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyPreset("last_week")}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                      isLastWeekApplied && !isDateDirty
                        ? "bg-[#fdf2f8] border border-[#fbcfe8] text-[#a80063] font-semibold"
                        : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    Minggu Lalu
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("this_week")}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                      isThisWeekApplied && !isDateDirty
                        ? "bg-[#fdf2f8] border border-[#fbcfe8] text-[#a80063] font-semibold"
                        : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    Minggu Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("all_time")}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                      isAppliedAllTime && !isDateDirty
                        ? "bg-[#fdf2f8] border border-[#fbcfe8] text-[#a80063] font-semibold"
                        : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    All Time
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden lg:block" />

                {/* Custom Date Range Picker */}
                <form onSubmit={handleFilterSubmit} className="flex items-center gap-1">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`px-1.5 py-0.5 text-[11px] font-medium rounded-md border outline-none cursor-pointer ${
                      (isCustomDateApplied || isDateDirty) && startDate
                        ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:border-[#fbcfe8]"
                    }`}
                  />
                  <span className="text-slate-300 text-xs">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`px-1.5 py-0.5 text-[11px] font-medium rounded-md border outline-none cursor-pointer ${
                      (isCustomDateApplied || isDateDirty) && endDate
                        ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:border-[#fbcfe8]"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isPending || (!startDate && !endDate)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      isDateDirty && (startDate || endDate)
                        ? "bg-[#a80063] hover:bg-[#8c0052] text-white shadow-xs ring-2 ring-[#a80063]/30 animate-pulse"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                    }`}
                    title={isDateDirty ? "Klik untuk menerapkan rentang tanggal ini" : "Terapkan rentang tanggal"}
                  >
                    <RefreshCw size={10} className={isPending ? "animate-spin" : ""} />
                    <span>{isPending ? "Memuat..." : "Terapkan"}</span>
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Right Controls: Jenis Kelas, Status, Reset & View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Jenis Kelas (Offline, Online, Bimbingan) */}
            <div className="flex items-center">
              <select
                value={jenisKelas}
                onChange={(e) => handleJenisKelasChange(e.target.value)}
                disabled={isPending}
                className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                  hasActiveJenisKelas
                    ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
                title="Filter Jenis Kelas"
              >
                <option value="ALL">Semua Jenis</option>
                <option value="LURING">Offline</option>
                <option value="DARING">Online</option>
                <option value="BIMBINGAN">Bimbingan</option>
              </select>
            </div>

            {/* Status Filter with Subtle Transparent Maroon Active Style */}
            <div className="flex items-center">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                  hasActiveStatus
                    ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
                title="Filter Status"
              >
                <option value="ALL">Semua Status</option>
                <option value="SANGAT_BAIK">Sangat Baik</option>
                <option value="BAIK">Baik</option>
                <option value="PERLU_PEMBINAAN">Perlu Perhatian</option>
                <option value="BELUM_ADA_KELAS">Belum Ada Kelas</option>
              </select>
            </div>

            {/* Reset All Filters Button (in 1st row) */}
            {hasAnyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("ALL");
                  setJenisKelas("ALL");
                  setSortBy("nama_asc");
                  if (filterMode === "SESI") {
                    setSelectedSesi(1);
                    navigateToSesi(1, selectedSemester, "ALL");
                  } else {
                    setStartDate(lastWeek.mondayStr);
                    setEndDate(lastWeek.sundayStr);
                    navigateToRange(lastWeek.mondayStr, lastWeek.sundayStr, selectedSemester, "ALL");
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#a80063] bg-[#fdf2f8] border border-[#fbcfe8] hover:bg-[#fce7f3] transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="Reset semua filter ke default"
              >
                <RotateCcw size={10} />
                <span>Reset Filter</span>
              </button>
            )}

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode("GRID")}
                className={`p-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === "GRID"
                    ? "bg-white text-[#a80063] shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Tampilan Kartu Grid"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode("TABLE")}
                className={`p-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === "TABLE"
                    ? "bg-white text-[#a80063] shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Tampilan Tabel Komparasi"
              >
                <TableIcon size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content View (Grid or Table) ─────────────────────────────────── */}
      {viewMode === "GRID" ? (
        /* ── GRID VIEW (4 Kotak per Baris) ───────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {sortedList.length === 0 ? (
            <div className="col-span-full bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400">
              <Building2 size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">Tidak ada program studi yang sesuai.</p>
              <p className="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau filter status.</p>
            </div>
          ) : (
            sortedList.map((p) => (
              <div
                key={p.id}
                className="duralux-card p-4 sm:p-4.5 bg-white flex flex-col justify-between group hover:border-[#fbcfe8] transition-all relative overflow-hidden"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-xs font-extrabold">
                        {p.kode}
                      </span>
                      {p.statusKinerjaRentang === "SANGAT_BAIK" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={10} />
                          <span>Sangat Baik</span>
                        </span>
                      )}
                      {p.statusKinerjaRentang === "BAIK" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <span>Baik</span>
                        </span>
                      )}
                      {p.statusKinerjaRentang === "PERLU_PEMBINAAN" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle size={10} />
                          <span>Perlu Perhatian</span>
                        </span>
                      )}
                      {p.statusKinerjaRentang === "BELUM_ADA_KELAS" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <span>Belum Ada Kelas</span>
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {p.totalSesiRentang} Sesi
                    </span>
                  </div>

                  {/* Prodi & Fakultas Title */}
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#a80063] transition-colors leading-tight">
                    {p.nama}
                  </h3>
                  {p.fakultasNama && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {p.fakultasNama}
                    </p>
                  )}

                  {/* Activity Pills for the Selected Date Range */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[11px]">
                      <Users size={12} className="text-slate-400" />
                      <span>{p.totalDosenAktifRentang} Dosen Aktif</span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-1 text-[11px]">
                      <School size={12} className="text-slate-400" />
                      <span>{p.totalKelasAktifRentang} Kelas Aktif</span>
                    </div>
                  </div>
                </div>

                {/* Performance Gauges for Date Range */}
                <div className="space-y-3 mt-4 pt-3 border-t border-slate-100">
                  {/* Kehadiran Dosen */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium text-[11px]">
                        {isSesiActive
                          ? `Kehadiran Dosen (Sesi ${selectedSesi}):`
                          : isAppliedAllTime
                          ? "Kehadiran Dosen:"
                          : "Kehadiran Dosen (Rentang):"}
                      </span>
                      {p.avgKehadiranRentang === null ? (
                        <span className="font-semibold text-slate-400 text-xs">N/A</span>
                      ) : (
                        <span className="font-bold text-emerald-600">
                          {formatPct(p.avgKehadiranRentang)}
                        </span>
                      )}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${p.avgKehadiranRentang ?? 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      {p.totalKelas === 0 ? (
                        <span>Belum ada kelas aktif</span>
                      ) : (
                        <>
                          <span>Hadir: {p.totalHadirRentang} | HTL: {p.totalHadirTdkLengkapRentang}</span>
                          <span>Alpha: {p.totalAlphaRentang}{p.totalGantiHariRentang ? ` | Ganti: ${p.totalGantiHariRentang}` : ""}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Kelengkapan 3 Pilar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium text-[11px]">
                        {isSesiActive
                          ? `Konten 3 Pilar (Sesi ${selectedSesi}):`
                          : isAppliedAllTime
                          ? "Konten 3 Pilar:"
                          : "Konten 3 Pilar (Rentang):"}
                      </span>
                      {p.avgKontenRentang === null ? (
                        <span className="font-semibold text-slate-400 text-xs">N/A</span>
                      ) : (
                        <span className="font-bold text-[#a80063]">
                          {formatPct(p.avgKontenRentang)}
                        </span>
                      )}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-[#a80063] rounded-full transition-all duration-300"
                        style={{ width: `${p.avgKontenRentang ?? 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      {p.totalKelas === 0 ? (
                        <span>Belum ada materi</span>
                      ) : (
                        <>
                          <span>Skor: {p.totalSkor3PilarRentang}/{p.totalRegularSesiRentang * 3}</span>
                          <span>L/S: {p.totalPilar1Rentang} • T/Q: {p.totalPilar2Rentang} • V/C: {p.totalPilar3Rentang}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Kendala Kehadiran Footer Button */}
                  {p.totalKelas === 0 ? (
                    <div className="w-full mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400">
                      <span>Belum ada kelas perkuliahan di semester ini</span>
                    </div>
                  ) : (p.kendalaList?.length || 0) > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode("TABLE");
                        setExpandedProdiIds({ [p.id]: true });
                      }}
                      className="w-full mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-amber-700 hover:text-amber-800 group/btn transition-colors cursor-pointer"
                      title="Lihat detail sesi berkendala di tabel"
                    >
                      <span className="flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-amber-500" />
                        <span>{p.kendalaList.length} Sesi Perlu Evaluasi</span>
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover/btn:text-[#a80063] flex items-center gap-0.5 font-medium">
                        Detail <ArrowRight size={10} />
                      </span>
                    </button>
                  ) : (
                    <div className="w-full mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[10.5px] font-medium text-emerald-600">
                      <CheckCircle2 size={11} />
                      <span>Semua sesi Hadir Lengkap</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ── TABLE VIEW ─────────────────────────────────────────────────────── */
        <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs print:shadow-none print:border-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[1050px]">
              <thead>
                <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                  <th className="py-2.5 px-2.5 w-10 text-center text-slate-700 font-bold">No</th>
                  {renderSortHeader("Kode", "KODE", "left", "w-20 min-w-[75px]")}
                  {renderSortHeader("Program Studi", "PRODI", "left", "min-w-[180px]")}
                  {renderSortHeader("Dosen Aktif", "DOSEN", "center", "w-36 min-w-[140px]")}
                  {renderSortHeader("Kelas Aktif", "KELAS", "center", "w-36 min-w-[140px]")}
                  {renderSortHeader(
                    isSesiActive ? `Kelas di Sesi ${selectedSesi}` : isAppliedAllTime ? "Total Sesi" : "Sesi di Rentang",
                    "SESI",
                    "center",
                    "w-36 min-w-[140px]"
                  )}
                  {renderSortHeader(
                    isSesiActive ? `% Hadir (Sesi ${selectedSesi})` : isAppliedAllTime ? "% Hadir" : "% Hadir (Rentang)",
                    "HADIR",
                    "center",
                    "min-w-[140px]"
                  )}
                  {renderSortHeader(
                    isSesiActive ? `% Konten (Sesi ${selectedSesi})` : isAppliedAllTime ? "% Konten" : "% Konten (Rentang)",
                    "KONTEN",
                    "center",
                    "min-w-[140px]"
                  )}
                  {renderSortHeader("Status", "STATUS", "center", "w-32")}
                  <th className="py-2.5 px-2.5 text-center text-slate-700 font-bold w-28 print:hidden">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 text-xs">
                {sortedList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs text-slate-400">
                      Tidak ada data program studi yang sesuai dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  sortedList.map((p, idx) => {
                    const isExpanded = !!expandedProdiIds[p.id];
                    const isOdd = idx % 2 === 1;
                    const kendalaCount = p.kendalaList?.length || 0;

                    return (
                      <Fragment key={p.id}>
                        <tr
                          className={`transition-colors cursor-pointer border-b border-slate-100/80 ${
                            isExpanded ? "bg-[#fdf2f8]/40 font-medium" : isOdd ? "bg-slate-50" : "bg-white"
                          } hover:bg-[#fdf2f8]/80`}
                          onClick={() => toggleExpandProdi(p.id)}
                        >
                          <td className="py-3 px-2.5 text-center text-slate-400 font-medium text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-2.5 font-bold w-20 min-w-[75px]">
                            <span className="inline-flex px-1.5 py-0.5 rounded bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-[10.5px] font-extrabold w-fit">
                              {p.kode}
                            </span>
                          </td>
                          <td className="py-3 px-2.5">
                            <p className="font-semibold text-slate-900 leading-tight text-xs">
                              {p.nama}
                            </p>
                            {p.fakultasNama && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {p.fakultasNama}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-2.5 text-center font-medium text-slate-700 text-xs w-36 min-w-[140px]">
                            {p.totalDosenAktifRentang} / {p.totalDosen}
                          </td>
                          <td className="py-3 px-2.5 text-center font-medium text-slate-700 text-xs w-36 min-w-[140px]">
                            {p.totalKelasAktifRentang} / {p.totalKelas}
                          </td>
                          <td className="py-3 px-2.5 text-center font-bold text-slate-800 text-xs w-36 min-w-[140px]">
                            {p.totalSesiRentang} {isSesiActive ? "Kelas" : "Sesi"}
                          </td>
                          <td className="py-3 px-2.5 text-center">
                            {p.avgKehadiranRentang === null ? (
                              <span className="font-semibold text-slate-400 text-xs">N/A</span>
                            ) : (
                              <>
                                <span className="font-bold text-emerald-600 text-xs">
                                  {formatPct(p.avgKehadiranRentang)}
                                </span>
                                <span className="block text-[9.5px] text-slate-400">
                                  H:{p.totalHadirRentang} A:{p.totalAlphaRentang}{p.totalGantiHariRentang ? ` G:${p.totalGantiHariRentang}` : ""}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="py-3 px-2.5 text-center">
                            {p.avgKontenRentang === null ? (
                              <span className="font-semibold text-slate-400 text-xs">N/A</span>
                            ) : (
                              <>
                                <span className="font-bold text-[#a80063] text-xs">
                                  {formatPct(p.avgKontenRentang)}
                                </span>
                                <span className="block text-[9.5px] text-slate-400">
                                  {p.totalSkor3PilarRentang}/{p.totalRegularSesiRentang * 3}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="py-3 px-2.5 text-center">
                            {p.statusKinerjaRentang === "SANGAT_BAIK" && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={10} />
                                <span>Sangat Baik</span>
                              </span>
                            )}
                            {p.statusKinerjaRentang === "BAIK" && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <span>Baik</span>
                              </span>
                            )}
                            {p.statusKinerjaRentang === "PERLU_PEMBINAAN" && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle size={10} />
                                <span>Perlu Perhatian</span>
                              </span>
                            )}
                            {p.statusKinerjaRentang === "BELUM_ADA_KELAS" && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <span>Belum Ada Kelas</span>
                              </span>
                            )}
                          </td>
                          {/* Tombol Kendala di Kolom Paling Kanan */}
                          <td className="py-3 px-2.5 text-center print:hidden">
                            {p.totalKelas === 0 ? (
                              <span className="text-slate-300 text-[11px] font-medium">-</span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandProdi(p.id);
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer shadow-2xs ${
                                  isExpanded
                                    ? "bg-[#a80063] text-white shadow-xs"
                                    : kendalaCount > 0
                                    ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/60"
                                }`}
                                title={isExpanded ? "Tutup rincian kendala" : "Lihat rincian kendala"}
                              >
                                <span>{kendalaCount > 0 ? `${kendalaCount} Kendala` : "0 Kendala"}</span>
                                <ChevronDown
                                  size={11}
                                  className={`transition-transform duration-200 ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expandable Sub-table Row for Kendala Kehadiran */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={10} className="p-3 sm:p-4">
                              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                                {/* Header of Sub-table */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:px-4 bg-slate-50/60 border-b border-slate-200/70">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-[#fdf2f8] text-[#a80063] flex items-center justify-center font-bold text-xs border border-[#fbcfe8]">
                                      <AlertCircle size={14} />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-900">
                                        Rincian Sesi Alpha & Belum Diisi - {p.nama}
                                      </h4>
                                      <p className="text-[10.5px] text-slate-500 font-normal">
                                        {isAppliedAllTime
                                          ? "Periode: Semua Waktu (1 Semester)"
                                          : `Periode: ${formatTanggalRange(appliedStartDate, appliedEndDate)}`}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 text-[11px]">
                                    <span className="px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 text-[10px]">
                                      {p.kendalaList.filter((k) => k.status === "ALPHA").length} Alpha
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                                      {p.kendalaList.filter((k) => k.status === "BELUM_DIISI").length} Belum Diisi
                                    </span>
                                  </div>
                                </div>

                                {/* Content: Empty or List */}
                                {!p.kendalaList || p.kendalaList.length === 0 ? (
                                  <div className="p-6 text-center text-slate-500 text-xs">
                                    <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                                    <p className="font-semibold text-slate-700">
                                      Semua Sesi Terlaksana & Terisi
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      Tidak ada sesi perkuliahan yang berstatus Alpha maupun Belum Diisi pada periode ini.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-[11px]">
                                      <thead>
                                        <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[10px] font-bold uppercase text-slate-400">
                                          <th className="py-2 px-3 w-8 text-center">No</th>
                                          <th className="py-2 px-3">Nama Dosen</th>
                                          <th className="py-2 px-3">Mata Kuliah & Kelas</th>
                                          <th className="py-2 px-3 text-center">Sesi</th>
                                          <th className="py-2 px-3 text-center">Status</th>
                                          <th className="py-2 px-3">Catatan CDU / Alasan</th>
                                          <th className="py-2 px-3 text-center">Aksi</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {p.kendalaList.map((k, kIdx) => (
                                          <tr key={k.sesiId} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-2 px-3 text-center text-slate-400 font-medium">
                                              {kIdx + 1}
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-slate-800">
                                              <div>{k.dosenNama}</div>
                                              {k.dosenNidn && (
                                                <div className="text-[9.5px] text-slate-400 font-normal">
                                                  NIDN: {k.dosenNidn}
                                                </div>
                                              )}
                                            </td>
                                            <td className="py-2 px-3">
                                              <div className="font-medium text-slate-900 leading-tight">
                                                {k.mataKuliahNama}
                                              </div>
                                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                <span className="font-bold text-[#a80063]">
                                                  [{k.kelasKode}]
                                                </span>
                                                {k.jadwalHari && (
                                                  <span>
                                                    • {k.jadwalHari}, {k.jadwalJam}
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-2 px-3 text-center font-bold text-slate-800 whitespace-nowrap">
                                              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                                Sesi {k.nomorSesi}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 text-center whitespace-nowrap">
                                              {k.status === "ALPHA" ? (
                                                <span className="inline-flex px-2 py-0.5 rounded font-bold text-[9.5px] bg-rose-50 text-rose-700 border border-rose-200">
                                                  Alpha / Tidak Hadir
                                                </span>
                                              ) : (
                                                <span className="inline-flex px-2 py-0.5 rounded font-semibold text-[9.5px] bg-slate-100 text-slate-600 border border-slate-200">
                                                  Belum Diisi
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3">
                                              {k.catatan ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]">
                                                  <MessageSquare size={10} />
                                                  <span>{k.catatan}</span>
                                                </span>
                                              ) : (
                                                <span className="text-slate-400 italic text-[10.5px]">
                                                  - Belum ada catatan
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              <Link
                                                href={`/monitoring/${k.kelasId}`}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-[#fdf2f8] text-slate-600 hover:text-[#a80063] border border-slate-200 hover:border-[#fbcfe8] text-[10px] font-bold transition-all shadow-2xs"
                                                title="Buka Grid Monitoring Kelas"
                                              >
                                                <span>Cek Kelas</span>
                                                <ExternalLink size={10} />
                                              </Link>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
