"use client";
// src/app/(dashboard)/monitoring/MonitoringListClient.tsx
// Comprehensive List of All Monitored Classes with Last Updated Timestamp & 3-Pillar Progress

import { useState } from "react";
import Link from "next/link";
import {
  Layers,
  Search,
  BarChart3,
  Calendar,
  Building,
  Laptop,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  User,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { calculateClassSummary } from "@/lib/score-calculator";
import { formatTerakhirUpdateParts } from "@/lib/utils";

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

export interface MonitoringKelasItem {
  id: string;
  kodeKelas: string;
  jadwalHari: string | null;
  jadwalJam: string | null;
  modePembelajaran: "DARING" | "LURING";
  updatedAt: Date | string;
  semester: {
    id: string;
    tahunAkademik: string;
    periode: string;
    aktif: boolean;
  };
  mataKuliah: {
    id: string;
    kode: string;
    nama: string;
    sks: number;
    prodi: {
      id: string;
      nama: string;
      kode: string;
    };
  };
  dosen: {
    id: string;
    nama: string;
    nidn: string | null;
  };
  monitoringSesi: Array<{
    id: string;
    nomorSesi: number;
    jenisSesi: "REGULER" | "UTS" | "UAS";
    kehadiran: string;
    lectureNote: boolean | null;
    slide: boolean | null;
    video: boolean | null;
    conference: boolean | null;
    tugas: boolean | null;
    kuis: boolean | null;
    updatedAt: Date | string;
  }>;
}

interface MonitoringListClientProps {
  kelasList: MonitoringKelasItem[];
  semesters: SemesterOption[];
  prodiList: ProdiOption[];
  defaultSemesterId: string;
}

const HARI_ORDER: Record<string, number> = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
  minggu: 7,
};

function getDayWeight(hari?: string | null): number {
  if (!hari) return 99;
  const h = hari.trim().toLowerCase();
  return HARI_ORDER[h] ?? 99;
}

function getJamStart(jam?: string | null): string {
  if (!jam) return "99:99";
  const parts = jam.split(/[-–]|(?:s\.d)/i);
  return parts[0]?.trim() || jam.trim();
}

export type SortKey =
  | "TERBARU"
  | "TERLAMA"
  | "MK_ASC"
  | "MK_DESC"
  | "KODE_ASC"
  | "KODE_DESC"
  | "DOSEN_ASC"
  | "DOSEN_DESC"
  | "JADWAL_ASC"
  | "JADWAL_DESC"
  | "KEHADIRAN_DESC"
  | "KEHADIRAN_ASC"
  | "PILAR_DESC"
  | "PILAR_ASC";

export default function MonitoringListClient({
  kelasList,
  semesters,
  prodiList,
  defaultSemesterId,
}: MonitoringListClientProps) {
  const [selectedSemester, setSelectedSemester] = useState<string>(defaultSemesterId);
  const [filterProdi, setFilterProdi] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("TERBARU");
  const [searchQuery, setSearchQuery] = useState("");

  // Process and compute stats for every class
  const processedClasses = kelasList.map((cls) => {
    const summary = calculateClassSummary(cls.monitoringSesi as any, cls.modePembelajaran);

    // Compute true latest update timestamp across class and its sessions
    let latestTime = new Date(cls.updatedAt).getTime();
    cls.monitoringSesi.forEach((s) => {
      const sTime = new Date(s.updatedAt).getTime();
      if (sTime > latestTime) latestTime = sTime;
    });

    const updateParts = formatTerakhirUpdateParts(new Date(latestTime));

    return {
      ...cls,
      summary,
      latestTime,
      updateParts,
    };
  });

  // Filter list
  const filteredList = processedClasses.filter((item) => {
    const matchProdi = filterProdi === "ALL" || item.mataKuliah.prodi.id === filterProdi;
    const matchMode = filterMode === "ALL" || item.modePembelajaran === filterMode;
    const matchStatus = filterStatus === "ALL" || item.summary.statusEvaluasi === filterStatus;
    const matchSearch =
      item.kodeKelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.mataKuliah.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.mataKuliah.kode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dosen.nama.toLowerCase().includes(searchQuery.toLowerCase());

    return matchProdi && matchMode && matchStatus && matchSearch;
  });

  // Sort list
  const sortedList = [...filteredList].sort((a, b) => {
    switch (sortBy) {
      case "TERBARU":
        return b.latestTime - a.latestTime;
      case "TERLAMA":
        return a.latestTime - b.latestTime;
      case "MK_ASC":
        return a.mataKuliah.nama.localeCompare(b.mataKuliah.nama, "id", { sensitivity: "base" });
      case "MK_DESC":
        return b.mataKuliah.nama.localeCompare(a.mataKuliah.nama, "id", { sensitivity: "base" });
      case "KODE_ASC":
        return a.kodeKelas.localeCompare(b.kodeKelas, "id", { sensitivity: "base" });
      case "KODE_DESC":
        return b.kodeKelas.localeCompare(a.kodeKelas, "id", { sensitivity: "base" });
      case "DOSEN_ASC":
        return a.dosen.nama.localeCompare(b.dosen.nama, "id", { sensitivity: "base" });
      case "DOSEN_DESC":
        return b.dosen.nama.localeCompare(a.dosen.nama, "id", { sensitivity: "base" });
      case "JADWAL_ASC": {
        const dayDiff = getDayWeight(a.jadwalHari) - getDayWeight(b.jadwalHari);
        if (dayDiff !== 0) return dayDiff;
        return getJamStart(a.jadwalJam).localeCompare(getJamStart(b.jadwalJam));
      }
      case "JADWAL_DESC": {
        const dayDiff = getDayWeight(b.jadwalHari) - getDayWeight(a.jadwalHari);
        if (dayDiff !== 0) return dayDiff;
        return getJamStart(b.jadwalJam).localeCompare(getJamStart(a.jadwalJam));
      }
      case "KEHADIRAN_DESC":
        return b.summary.persenKehadiran - a.summary.persenKehadiran;
      case "KEHADIRAN_ASC":
        return a.summary.persenKehadiran - b.summary.persenKehadiran;
      case "PILAR_DESC":
        return b.summary.totalSkor3Pilar - a.summary.totalSkor3Pilar;
      case "PILAR_ASC":
        return a.summary.totalSkor3Pilar - b.summary.totalSkor3Pilar;
      default:
        return b.latestTime - a.latestTime;
    }
  });

  // Helper toggle column sort
  function handleColumnSort(column: "KODE" | "MK" | "DOSEN" | "JADWAL" | "KEHADIRAN" | "PILAR" | "UPDATE") {
    switch (column) {
      case "KODE":
        setSortBy(sortBy === "KODE_ASC" ? "KODE_DESC" : "KODE_ASC");
        break;
      case "MK":
        setSortBy(sortBy === "MK_ASC" ? "MK_DESC" : "MK_ASC");
        break;
      case "DOSEN":
        setSortBy(sortBy === "DOSEN_ASC" ? "DOSEN_DESC" : "DOSEN_ASC");
        break;
      case "JADWAL":
        setSortBy(sortBy === "JADWAL_ASC" ? "JADWAL_DESC" : "JADWAL_ASC");
        break;
      case "KEHADIRAN":
        setSortBy(sortBy === "KEHADIRAN_DESC" ? "KEHADIRAN_ASC" : "KEHADIRAN_DESC");
        break;
      case "PILAR":
        setSortBy(sortBy === "PILAR_DESC" ? "PILAR_ASC" : "PILAR_DESC");
        break;
      case "UPDATE":
        setSortBy(sortBy === "TERBARU" ? "TERLAMA" : "TERBARU");
        break;
    }
  }

  // Render clickable header column with sort icon
  function renderSortHeader(
    label: string,
    columnKey: "KODE" | "MK" | "DOSEN" | "JADWAL" | "KEHADIRAN" | "PILAR" | "UPDATE",
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isCurrent =
      (columnKey === "KODE" && (sortBy === "KODE_ASC" || sortBy === "KODE_DESC")) ||
      (columnKey === "MK" && (sortBy === "MK_ASC" || sortBy === "MK_DESC")) ||
      (columnKey === "DOSEN" && (sortBy === "DOSEN_ASC" || sortBy === "DOSEN_DESC")) ||
      (columnKey === "JADWAL" && (sortBy === "JADWAL_ASC" || sortBy === "JADWAL_DESC")) ||
      (columnKey === "KEHADIRAN" && (sortBy === "KEHADIRAN_ASC" || sortBy === "KEHADIRAN_DESC")) ||
      (columnKey === "PILAR" && (sortBy === "PILAR_ASC" || sortBy === "PILAR_DESC")) ||
      (columnKey === "UPDATE" && (sortBy === "TERBARU" || sortBy === "TERLAMA"));

    const isAsc =
      sortBy === "KODE_ASC" ||
      sortBy === "MK_ASC" ||
      sortBy === "DOSEN_ASC" ||
      sortBy === "JADWAL_ASC" ||
      sortBy === "KEHADIRAN_ASC" ||
      sortBy === "PILAR_ASC" ||
      sortBy === "TERLAMA";

    return (
      <th
        onClick={() => handleColumnSort(columnKey)}
        className={`py-3 px-3 cursor-pointer select-none transition-colors group hover:bg-slate-100/90 ${
          align === "center" ? "text-center" : "text-left"
        } ${extraClass}`}
        title={`Klik untuk mengurutkan berdasarkan ${label}`}
      >
        <div
          className={`inline-flex items-center gap-1.5 font-bold ${
            isCurrent ? "text-[#a80063]" : "text-slate-400 group-hover:text-slate-700"
          } ${align === "center" ? "justify-center" : ""}`}
        >
          <span>{label}</span>
          {isCurrent ? (
            isAsc ? (
              <ArrowUp size={12} className="text-[#a80063] stroke-[2.5]" />
            ) : (
              <ArrowDown size={12} className="text-[#a80063] stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown size={11} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
  }

  // Global KPI Calculations (Separate Online vs Offline)
  const totalClasses = filteredList.length;
  const onlineList = filteredList.filter((c) => c.modePembelajaran === "DARING");
  const offlineList = filteredList.filter((c) => c.modePembelajaran === "LURING");

  const avgKehadiran =
    totalClasses > 0
      ? Math.round(
          filteredList.reduce((acc, c) => acc + c.summary.persenKehadiran, 0) / totalClasses
        )
      : 0;

  const onlineAvgKonten =
    onlineList.length > 0
      ? Math.round(
          onlineList.reduce((acc, c) => acc + c.summary.persenKonten, 0) / onlineList.length
        )
      : 0;

  const onlineMemenuhi = onlineList.filter((c) => c.summary.statusEvaluasi === "MEMENUHI").length;
  const onlinePerhatian = onlineList.filter((c) => c.summary.statusEvaluasi === "PERLU_PERHATIAN").length;

  const offlineMemenuhi = offlineList.filter((c) => c.summary.statusEvaluasi === "MEMENUHI").length;
  const offlinePerhatian = offlineList.filter((c) => c.summary.statusEvaluasi === "PERLU_PERHATIAN").length;

  return (
    <div className="space-y-4">
      {/* ── Top Header Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <Layers size={18} className="text-[#a80063]" />
            <span>Daftar Kelas Monitoring Perkuliahan</span>
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

      {/* ── KPI Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Kelas */}
        <div className="duralux-card p-4 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Kelas Dimonitor
          </p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1 leading-none">
            {totalClasses}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            {onlineList.length} Online • {offlineList.length} Offline
          </p>
        </div>

        {/* Card 2: Rata Kehadiran */}
        <div className="duralux-card p-4 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Rata-rata Kehadiran
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-emerald-600 leading-none">
              {avgKehadiran}%
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Target CDU: ≥ 85%
          </p>
        </div>

        {/* Card 3: Rata-rata Konten 3 Pilar */}
        <div className="duralux-card p-4 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Rata-rata Konten 3 Pilar
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            {filterMode === "LURING" ? (
              <h3 className="text-xl font-bold text-slate-500 leading-none">
                Bebas Kewajiban
              </h3>
            ) : (
              <h3 className="text-2xl font-bold text-[#a80063] leading-none">
                {onlineAvgKonten}%
              </h3>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {filterMode === "LURING" ? "Opsional (Hanya untuk Online)" : "Rata-rata Kelas Online (Maks 42)"}
          </p>
        </div>

        {/* Card 4: Status (Dipisahkan Online & Offline dengan Keterangan Faktor) */}
        <div className="duralux-card p-4 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Status
          </p>
          
          {filterMode === "LURING" ? (
            <div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {offlineMemenuhi} Sesuai
                </span>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {offlinePerhatian} Perhatian
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 truncate" title="Faktor evaluasi kelas offline: Hanya Kehadiran Fisik Dosen di Kelas (≥85%, Bebas 3 Pilar & Live Conf)">
                Faktor: Hanya Kehadiran Fisik Dosen (≥85%)
              </p>
            </div>
          ) : filterMode === "DARING" ? (
            <div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {onlineMemenuhi} Sesuai
                </span>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {onlinePerhatian} Perhatian
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 truncate" title="Faktor evaluasi kelas online: Kehadiran Dosen ≥85%, 3 Pilar Lengkap, & Kuota Live Conference">
                Faktor: Kehadiran ≥85%, 3 Pilar & Live Conf
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 mt-1">
              {/* Baris Online */}
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 text-[9.5px] shrink-0">
                    Online
                  </span>
                  <span className="text-[9px] text-slate-400 font-normal truncate" title="Faktor evaluasi: Kehadiran Dosen ≥85%, 3 Pilar Lengkap, & Kuota Live Conference">
                    Hadir, 3 Pilar & Conf
                  </span>
                </div>
                <div className="flex items-center gap-1 font-bold text-slate-700 text-[11px] shrink-0 ml-1">
                  <span className="text-emerald-600">{onlineMemenuhi} Sesuai</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-rose-600">{onlinePerhatian} Perhatian</span>
                </div>
              </div>

              {/* Baris Offline */}
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[9.5px] shrink-0">
                    Offline
                  </span>
                  <span className="text-[9px] text-slate-400 font-normal truncate" title="Faktor evaluasi: Hanya Kehadiran Fisik Dosen di Kelas (≥85%, Bebas 3 Pilar & Live Conf)">
                    Hanya Kehadiran Fisik
                  </span>
                </div>
                <div className="flex items-center gap-1 font-bold text-slate-700 text-[11px] shrink-0 ml-1">
                  <span className="text-emerald-600">{offlineMemenuhi} Sesuai</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-rose-600">{offlinePerhatian} Perhatian</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/70">
        {/* Search */}
        <div className="relative w-full lg:max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode kelas, mata kuliah, dosen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#a80063]"
          />
        </div>

        {/* Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Semester Selector */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="text-[11px] font-medium hidden sm:inline">Semester:</span>
            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                window.location.href = `/monitoring?semesterId=${e.target.value}&prodiId=${filterProdi}`;
              }}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a80063] text-slate-700"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tahunAkademik} ({s.periode}) {s.aktif ? "• Aktif" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Prodi Filter */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="text-[11px] font-medium hidden sm:inline">Prodi:</span>
            <select
              value={filterProdi}
              onChange={(e) => setFilterProdi(e.target.value)}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a80063] text-slate-700"
            >
              <option value="ALL">Semua Prodi</option>
              {prodiList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Pembelajaran Filter */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="text-[11px] font-medium hidden sm:inline">Mode:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a80063] text-slate-700"
            >
              <option value="ALL">Semua Mode</option>
              <option value="DARING">Online</option>
              <option value="LURING">Offline</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="text-[11px] font-medium hidden sm:inline">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a80063] text-slate-700"
            >
              <option value="ALL">Semua Status</option>
              <option value="MEMENUHI">Sesuai</option>
              <option value="PERLU_PERHATIAN">Perlu Perhatian</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Monitored Class Table Card ───────────────────────────────────────── */}
      <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/60">
                <th className="py-3 px-3 text-center w-10">No</th>
                {renderSortHeader("Kode / Kelas", "KODE")}
                {renderSortHeader("Mata Kuliah", "MK")}
                {renderSortHeader("Dosen Pengampu", "DOSEN")}
                {renderSortHeader("Jadwal Kuliah", "JADWAL")}
                {renderSortHeader("Kehadiran", "KEHADIRAN", "center")}
                {renderSortHeader("Skor 3 Pilar", "PILAR", "center")}
                <th className="py-3 px-3 text-center">Live Conf</th>
                {renderSortHeader("Terakhir Update", "UPDATE", "center")}
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Tidak ada kelas yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                sortedList.map((cls, idx) => (
                  <tr key={cls.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* No */}
                    <td className="py-3 px-3 text-center font-medium text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Kode Kelas & Mode */}
                    <td className="py-3 px-3 font-bold">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-[11px] font-extrabold w-fit">
                          {cls.kodeKelas}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border w-fit ${
                            cls.modePembelajaran === "LURING"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {cls.modePembelajaran === "LURING" ? (
                            <>
                              <Building size={9} />
                              <span>Offline</span>
                            </>
                          ) : (
                            <>
                              <Laptop size={9} />
                              <span>Online</span>
                            </>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Mata Kuliah */}
                    <td className="py-3 px-3">
                      <p className="font-bold text-xs text-slate-900 leading-tight">
                        {cls.mataKuliah.nama}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span>{cls.mataKuliah.kode}</span>
                        <span>•</span>
                        <span>{cls.mataKuliah.sks} SKS</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-600">{cls.mataKuliah.prodi.nama}</span>
                      </div>
                    </td>

                    {/* Dosen */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <User size={13} className="text-[#a80063] shrink-0" />
                        <span className="font-semibold truncate max-w-[150px]" title={cls.dosen.nama}>
                          {cls.dosen.nama}
                        </span>
                      </div>
                      {cls.dosen.nidn && (
                        <p className="text-[10px] text-slate-400 mt-0.5 ml-4">
                          NIDN: {cls.dosen.nidn}
                        </p>
                      )}
                    </td>

                    {/* Jadwal Kuliah */}
                    <td className="py-3 px-3">
                      <p className="font-medium text-slate-700 text-xs">
                        {cls.jadwalHari || "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {cls.jadwalJam || "—"}
                      </p>
                    </td>

                    {/* Kehadiran */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-xs text-slate-800">
                          {cls.summary.totalHadir}/16 Sesi
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${cls.summary.persenKehadiran}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-emerald-600 font-bold">
                          {cls.summary.persenKehadiran}%
                        </span>
                      </div>
                    </td>

                    {/* Skor 3 Pilar */}
                    <td className="py-3 px-3 text-center">
                      {cls.modePembelajaran === "LURING" ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-xs text-slate-500">
                            {cls.summary.totalSkor3Pilar > 0 ? `${cls.summary.totalSkor3Pilar} Poin` : "—"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200">
                            Bebas Kewajiban
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-xs text-[#a80063]">
                            {cls.summary.totalSkor3Pilar} / 42 Poin
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-[#a80063] rounded-full"
                              style={{ width: `${cls.summary.persenKonten}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 font-semibold">
                            {cls.summary.persenKonten}% Lengkap
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Live Conference Quota */}
                    <td className="py-3 px-3 text-center">
                      {cls.modePembelajaran === "LURING" ? (
                        <div className="inline-flex flex-col items-center justify-center">
                          <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80" title="Kelas Tatap Muka (Offline) tidak memiliki kewajiban kuota Live Conference">
                            Bebas Conf
                          </span>
                          <span className="text-[8.5px] text-slate-400 mt-0.5">Tatap Muka</span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center text-[9.5px] font-bold">
                          <span className={cls.summary.confPraUTS >= 3 ? "text-emerald-700" : "text-amber-700"}>
                            UTS: {cls.summary.confPraUTS}/3 {cls.summary.confPraUTS >= 3 ? "✓" : "⚠️"}
                          </span>
                          <span className={cls.summary.confPraUAS >= 3 ? "text-emerald-700" : "text-amber-700"}>
                            UAS: {cls.summary.confPraUAS}/3 {cls.summary.confPraUAS >= 3 ? "✓" : "⚠️"}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Terakhir Update (2 Baris: Jam & Tanggal) */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex flex-col items-center justify-center px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/70">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800 leading-tight">
                          <Clock size={11} className="text-[#a80063] shrink-0" />
                          <span>{cls.updateParts.waktu}</span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 mt-0.5 leading-tight">
                          {cls.updateParts.tanggal}
                        </span>
                      </div>
                    </td>

                    {/* Aksi Button (Buka di Tab Baru) */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <Link
                        href={`/monitoring/${cls.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-brand inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs cursor-pointer hover:shadow-sm"
                        title={`Buka monitoring kelas [${cls.kodeKelas}] di tab baru`}
                      >
                        <span>Monitor</span>
                        <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
