"use client";
// src/app/(dashboard)/laporan/prodi/LaporanProdiClient.tsx
// Laporan Performa per Program Studi dengan Filter Rentang Tanggal (Senin - Minggu)

import { useState, useTransition, Fragment } from "react";
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
  Filter,
  X,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { ProdiReportItem } from "@/actions/laporan";
import { getWeekDates, formatTanggalRange } from "@/lib/utils";

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
}

interface LaporanProdiClientProps {
  prodiReports: ProdiReportItem[];
  semesters: SemesterOption[];
  defaultSemesterId: string;
  initialStartDate: string;
  initialEndDate: string;
  globalSummary: GlobalSummary;
}

export default function LaporanProdiClient({
  prodiReports,
  semesters,
  defaultSemesterId,
  initialStartDate,
  initialEndDate,
  globalSummary,
}: LaporanProdiClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Date Range States
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedSemester, setSelectedSemester] = useState(defaultSemesterId);

  // View & Filter States
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("GRID");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [sortBy, setSortBy] = useState<"kehadiran_desc" | "konten_desc" | "sesi_desc" | "nama_asc">("kehadiran_desc");
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

  function navigateToRange(start: string, end: string, semId = selectedSemester) {
    startTransition(() => {
      const params = new URLSearchParams();
      if (start) params.set("startDate", start);
      if (end) params.set("endDate", end);
      if (semId) params.set("semesterId", semId);
      const queryStr = params.toString();
      router.push(`/laporan/prodi${queryStr ? `?${queryStr}` : ""}`);
    });
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateToRange(startDate, endDate);
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
    if (sortBy === "kehadiran_desc") return b.avgKehadiranRentang - a.avgKehadiranRentang;
    if (sortBy === "konten_desc") return b.avgKontenRentang - a.avgKontenRentang;
    if (sortBy === "sesi_desc") return b.totalSesiRentang - a.totalSesiRentang;
    if (sortBy === "nama_asc") return a.nama.localeCompare(b.nama);
    return 0;
  });

  const currentSem =
    semesters.find((s) => s.id === selectedSemester) || semesters[0];

  function handlePrint() {
    window.print();
  }

  function handleExportExcel() {
    window.location.href = `/api/export/prodi-excel?startDate=${startDate}&endDate=${endDate}&semesterId=${selectedSemester}`;
  }

  // Active Filter Helpers
  const isAllTime = !startDate && !endDate;

  const thisWeek = getWeekDates(new Date());
  const isThisWeek = !isAllTime && startDate === thisWeek.mondayStr && endDate === thisWeek.sundayStr;

  const lastWeekBase = new Date();
  lastWeekBase.setDate(lastWeekBase.getDate() - 7);
  const lastWeek = getWeekDates(lastWeekBase);
  const isLastWeek = !isAllTime && startDate === lastWeek.mondayStr && endDate === lastWeek.sundayStr;

  const isCustomDate = !isAllTime && !isThisWeek && !isLastWeek;
  const hasActiveSearch = searchQuery.trim().length > 0;
  const hasActiveStatus = filterStatus !== "ALL";
  const hasActiveSort = sortBy !== "kehadiran_desc";
  const hasAnyFilterActive = hasActiveSearch || hasActiveStatus || hasActiveSort || !isAllTime;

  return (
    <div className="space-y-4">
      {/* ── Top Header Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)] print:hidden">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
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
          Universitas Nusa Putra — Curriculum Development Unit (CDU)
        </h2>
        <h3 className="text-sm font-semibold text-slate-700 mt-0.5">
          Laporan Performa Program Studi per Periode Tanggal
        </h3>
        <p className="text-xs font-medium text-slate-600 mt-0.5">
          Periode: {isAllTime ? "Semua Waktu (1 Semester)" : formatTanggalRange(startDate, endDate)} | Semester: {currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : "Aktif"}
        </p>
        <p className="text-[10px] text-slate-500 mt-1">
          Dicetak pada: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ── University-wide KPI Summary Cards ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 print:hidden">
        {/* Card 1: Total Prodi */}
        <div className="duralux-card p-4 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Program Studi
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-slate-900 leading-none">
              {globalSummary.totalProdi}
            </h3>
            <span className="text-[11px] text-slate-400">
              Prodi
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {globalSummary.totalKelasSemua} Kelas • {globalSummary.totalDosenSemua} Dosen
          </p>
        </div>

        {/* Card 2: Rata Kehadiran Univ */}
        <div className="duralux-card p-4 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isAllTime ? "Rata Kehadiran (Semua)" : "Rata Kehadiran (Rentang)"}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-emerald-600 leading-none">
              {globalSummary.avgKehadiranRentangSemua}%
            </h3>
            <span className="text-[11px] text-slate-500">
              Universitas
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total {globalSummary.totalSesiRentangSemua} sesi dimonitor
          </p>
        </div>

        {/* Card 3: Rata Konten 3 Pilar */}
        <div className="duralux-card p-4 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isAllTime ? "Kelengkapan 3 Pilar (Semua)" : "Kelengkapan 3 Pilar (Rentang)"}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-[#a80063] leading-none">
              {globalSummary.avgKontenRentangSemua}%
            </h3>
            <span className="text-[11px] text-slate-500">
              Universitas
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Pilar 1 (L/S), 2 (T/Q), 3 (V/C)
          </p>
        </div>
      </div>

      {/* ── Single-Row Compact Filter Toolbar ─────────────────────────────── */}
      <div className="bg-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200/70 print:hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Controls: Search, Presets & Custom Date Range */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input with Subtle Active State */}
            <div className="relative w-full sm:w-48 lg:w-56">
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

            <div className="h-4 w-px bg-slate-200 hidden lg:block" />

            {/* Quick Date Presets with Subtle Transparent Maroon Active Style */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyPreset("all_time")}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                  isAllTime
                    ? "bg-[#fdf2f8] border border-[#fbcfe8] text-[#a80063] font-semibold"
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => applyPreset("this_week")}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                  isThisWeek
                    ? "bg-[#fdf2f8] border border-[#fbcfe8] text-[#a80063] font-semibold"
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                }`}
              >
                Minggu Ini
              </button>
              <button
                type="button"
                onClick={() => applyPreset("last_week")}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                  isLastWeek
                    ? "bg-[#fdf2f8] border border-[#fbcfe8] text-[#a80063] font-semibold"
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                }`}
              >
                Minggu Lalu
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
                  isCustomDate
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
                  isCustomDate
                    ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-[#fbcfe8]"
                }`}
              />
              <button
                type="submit"
                disabled={isPending || (!startDate && !endDate)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#a80063] hover:bg-[#8c0052] text-white text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={10} className={isPending ? "animate-spin" : ""} />
                <span>{isPending ? "..." : "Terapkan"}</span>
              </button>
            </form>
          </div>

          {/* Right Controls: Semester, Status, Sort, Reset & View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Semester Selector */}
            <div className="flex items-center gap-1">
              <select
                value={selectedSemester}
                onChange={(e) => {
                  setSelectedSemester(e.target.value);
                  navigateToRange(startDate, endDate, e.target.value);
                }}
                className="px-2 py-1 bg-slate-50 text-[11px] text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[130px] truncate cursor-pointer font-medium"
                title="Pilih Semester"
              >
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tahunAkademik} ({s.periode}) {s.aktif ? "★" : ""}
                  </option>
                ))}
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
                <option value="PERLU_PEMBINAAN">Perlu Pembinaan</option>
              </select>
            </div>

            {/* Sort Dropdown with Subtle Transparent Maroon Active Style */}
            <div className="flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                  hasActiveSort
                    ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
                title="Urutan Tampilan"
              >
                <option value="kehadiran_desc">Kehadiran (Tertinggi)</option>
                <option value="konten_desc">Konten 3P (Tertinggi)</option>
                <option value="sesi_desc">Sesi Terbanyak</option>
                <option value="nama_asc">Nama Prodi (A-Z)</option>
              </select>
            </div>

            {/* Reset All Filters Button (in 1st row) */}
            {hasAnyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("ALL");
                  setSortBy("kehadiran_desc");
                  applyPreset("all_time");
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
                          <span>Perlu Pembinaan</span>
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
                        {isAllTime ? "Kehadiran Dosen:" : "Kehadiran Dosen (Rentang):"}
                      </span>
                      <span className="font-bold text-emerald-600">
                        {p.avgKehadiranRentang}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${p.avgKehadiranRentang}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>Hadir: {p.totalHadirRentang} | HTL: {p.totalHadirTdkLengkapRentang}</span>
                      <span>Alpha: {p.totalAlphaRentang}</span>
                    </div>
                  </div>

                  {/* Kelengkapan 3 Pilar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium text-[11px]">
                        {isAllTime ? "Konten 3 Pilar:" : "Konten 3 Pilar (Rentang):"}
                      </span>
                      <span className="font-bold text-[#a80063]">
                        {p.avgKontenRentang}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-[#a80063] rounded-full transition-all duration-300"
                        style={{ width: `${p.avgKontenRentang}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>Skor: {p.totalSkor3PilarRentang}/{p.totalRegularSesiRentang * 3}</span>
                      <span>L/S: {p.totalPilar1Rentang} • T/Q: {p.totalPilar2Rentang} • V/C: {p.totalPilar3Rentang}</span>
                    </div>
                  </div>

                  {/* Kendala Kehadiran Footer Button */}
                  {(p.kendalaList?.length || 0) > 0 ? (
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
                      <span>Semua sesi terisi Hadir / HTL</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ── TABLE VIEW ─────────────────────────────────────────────────────── */
        <div className="duralux-card bg-white p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/70">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-20">Kode</th>
                  <th className="py-2.5 px-3">Program Studi</th>
                  <th className="py-2.5 px-3 text-center">Dosen Aktif</th>
                  <th className="py-2.5 px-3 text-center">Kelas Aktif</th>
                  <th className="py-2.5 px-3 text-center">Sesi di Periode</th>
                  <th className="py-2.5 px-3 text-center">% Hadir (Periode)</th>
                  <th className="py-2.5 px-3 text-center">% Konten (Periode)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sortedList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Tidak ada data program studi yang sesuai.
                    </td>
                  </tr>
                ) : (
                  sortedList.map((p, idx) => {
                    const isExpanded = !!expandedProdiIds[p.id];
                    const kendalaCount = p.kendalaList?.length || 0;

                    return (
                      <Fragment key={p.id}>
                        <tr
                          className={`transition-colors cursor-pointer ${
                            isExpanded ? "bg-[#fdf2f8]/30 font-medium" : "hover:bg-slate-50/70"
                          }`}
                          onClick={() => toggleExpandProdi(p.id)}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold">
                            <span className="inline-flex px-2 py-0.5 rounded bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-[10px] font-extrabold">
                              {p.kode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-900 leading-tight">
                              {p.nama}
                            </p>
                            {p.fakultasNama && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {p.fakultasNama}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                            {p.totalDosenAktifRentang} / {p.totalDosen}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                            {p.totalKelasAktifRentang} / {p.totalKelas}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                            {p.totalSesiRentang} Sesi
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold text-emerald-600 text-xs">
                              {p.avgKehadiranRentang}%
                            </span>
                            <span className="block text-[9px] text-slate-400">
                              H:{p.totalHadirRentang} A:{p.totalAlphaRentang}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold text-[#a80063] text-xs">
                              {p.avgKontenRentang}%
                            </span>
                            <span className="block text-[9px] text-slate-400">
                              {p.totalSkor3PilarRentang}/{p.totalRegularSesiRentang * 3}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
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
                                <span>Perlu Pembinaan</span>
                              </span>
                            )}
                          </td>
                          {/* Tombol Kendala di Kolom Paling Kanan */}
                          <td className="py-2.5 px-3 text-center">
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
                                        Rincian Sesi Alpha & Belum Diisi — {p.nama}
                                      </h4>
                                      <p className="text-[10.5px] text-slate-500 font-normal">
                                        {isAllTime
                                          ? "Periode: Semua Waktu (1 Semester)"
                                          : `Periode: ${formatTanggalRange(startDate, endDate)}`}
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
                                                  — Belum ada catatan
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
