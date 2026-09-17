"use client";
// src/app/(dashboard)/laporan/dosen/LaporanDosenClient.tsx
// Laporan Kinerja & Evaluasi Dosen (Standard Table Header, Sorting & Zebra Striping)

import React, { useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  School,
  IdCard,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  Printer,
  FileSpreadsheet,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  X,
} from "lucide-react";
import { formatPct } from "@/lib/utils";

interface DosenReportItem {
  id: string;
  nama: string;
  nidn: string | null;
  prodi: {
    id: string;
    nama: string;
    kode: string;
  };
  kelasList: Array<{
    id: string;
    kodeKelas: string;
    mataKuliah: { nama: string; kode: string; sks: number };
    modePembelajaran?: "DARING" | "LURING" | "BIMBINGAN";
    totalSesiBeban?: number;
    sesiDiajar?: number[];
    statusPenugasan?: string;
    totalHadir: number;
    persenKehadiran: number;
    totalSkorKonten: number;
    maxSkorKonten?: number;
    persenKonten: number;
    statusEvaluasi: string;
  }>;
  totalKelas: number;
  avgKehadiran: number;
  avgKonten: number | null;
  status: "SANGAT_BAIK" | "PERLU_PEMBINAAN";
}

interface SemesterOption {
  id: string;
  tahunAkademik: string;
  periode: string;
  aktif: boolean;
}

interface LaporanDosenClientProps {
  dosenReports: DosenReportItem[];
  semesters: SemesterOption[];
  defaultSemesterId: string;
}

export type DosenSortKey =
  | "DOSEN_ASC"
  | "DOSEN_DESC"
  | "PRODI_ASC"
  | "PRODI_DESC"
  | "KELAS_DESC"
  | "KELAS_ASC"
  | "KEHADIRAN_DESC"
  | "KEHADIRAN_ASC"
  | "KONTEN_DESC"
  | "KONTEN_ASC"
  | "STATUS_ASC"
  | "STATUS_DESC";

export type DosenSortColumn =
  | "DOSEN"
  | "PRODI"
  | "KELAS"
  | "KEHADIRAN"
  | "KONTEN"
  | "STATUS";

export default function LaporanDosenClient({
  dosenReports,
  semesters,
  defaultSemesterId,
}: LaporanDosenClientProps) {
  const [selectedSemester, setSelectedSemester] = useState(defaultSemesterId);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expandedDosenId, setExpandedDosenId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<DosenSortKey>("DOSEN_ASC");

  const filtered = dosenReports.filter((d) => {
    const matchSearch =
      d.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.nidn && d.nidn.includes(searchQuery));
    const matchStatus = filterStatus === "ALL" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const sortedDosen = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "DOSEN_ASC":
        return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
      case "DOSEN_DESC":
        return b.nama.localeCompare(a.nama, "id", { sensitivity: "base" });
      case "PRODI_ASC": {
        const pDiff = a.prodi.nama.localeCompare(b.prodi.nama, "id", { sensitivity: "base" });
        if (pDiff !== 0) return pDiff;
        return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
      }
      case "PRODI_DESC": {
        const pDiff = b.prodi.nama.localeCompare(a.prodi.nama, "id", { sensitivity: "base" });
        if (pDiff !== 0) return pDiff;
        return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
      }
      case "KELAS_DESC":
        return b.totalKelas - a.totalKelas;
      case "KELAS_ASC":
        return a.totalKelas - b.totalKelas;
      case "KEHADIRAN_DESC":
        return b.avgKehadiran - a.avgKehadiran;
      case "KEHADIRAN_ASC":
        return a.avgKehadiran - b.avgKehadiran;
      case "KONTEN_DESC": {
        const aK = a.avgKonten ?? -1;
        const bK = b.avgKonten ?? -1;
        return bK - aK;
      }
      case "KONTEN_ASC": {
        const aK = a.avgKonten ?? -1;
        const bK = b.avgKonten ?? -1;
        return aK - bK;
      }
      case "STATUS_ASC": {
        const rank: Record<string, number> = {
          PERLU_PEMBINAAN: 1,
          BAIK: 2,
          SANGAT_BAIK: 3,
        };
        return (rank[a.status] || 0) - (rank[b.status] || 0);
      }
      case "STATUS_DESC": {
        const rank: Record<string, number> = {
          PERLU_PEMBINAAN: 1,
          BAIK: 2,
          SANGAT_BAIK: 3,
        };
        return (rank[b.status] || 0) - (rank[a.status] || 0);
      }
      default:
        return 0;
    }
  });

  function handleColumnSort(column: DosenSortColumn) {
    switch (column) {
      case "DOSEN":
        setSortBy(sortBy === "DOSEN_ASC" ? "DOSEN_DESC" : "DOSEN_ASC");
        break;
      case "PRODI":
        setSortBy(sortBy === "PRODI_ASC" ? "PRODI_DESC" : "PRODI_ASC");
        break;
      case "KELAS":
        setSortBy(sortBy === "KELAS_DESC" ? "KELAS_ASC" : "KELAS_DESC");
        break;
      case "KEHADIRAN":
        setSortBy(sortBy === "KEHADIRAN_DESC" ? "KEHADIRAN_ASC" : "KEHADIRAN_DESC");
        break;
      case "KONTEN":
        setSortBy(sortBy === "KONTEN_DESC" ? "KONTEN_ASC" : "KONTEN_DESC");
        break;
      case "STATUS":
        setSortBy(sortBy === "STATUS_ASC" ? "STATUS_DESC" : "STATUS_ASC");
        break;
    }
  }

  // Render clickable header column with sort icon (Standard Table Header)
  function renderSortHeader(
    label: string,
    columnKey: DosenSortColumn,
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isCurrent =
      (columnKey === "DOSEN" && (sortBy === "DOSEN_ASC" || sortBy === "DOSEN_DESC")) ||
      (columnKey === "PRODI" && (sortBy === "PRODI_ASC" || sortBy === "PRODI_DESC")) ||
      (columnKey === "KELAS" && (sortBy === "KELAS_DESC" || sortBy === "KELAS_ASC")) ||
      (columnKey === "KEHADIRAN" && (sortBy === "KEHADIRAN_DESC" || sortBy === "KEHADIRAN_ASC")) ||
      (columnKey === "KONTEN" && (sortBy === "KONTEN_DESC" || sortBy === "KONTEN_ASC")) ||
      (columnKey === "STATUS" && (sortBy === "STATUS_ASC" || sortBy === "STATUS_DESC"));

    const isAsc =
      sortBy === "DOSEN_ASC" ||
      sortBy === "PRODI_ASC" ||
      sortBy === "KELAS_ASC" ||
      sortBy === "KEHADIRAN_ASC" ||
      sortBy === "KONTEN_ASC" ||
      sortBy === "STATUS_ASC";

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
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)] print:hidden">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <Users size={18} className="text-[#a80063]" />
            <span>Laporan Evaluasi Kinerja Dosen</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Agregasi performa kehadiran mengajar dan kelengkapan materi per dosen pengampu
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href={`/api/export/dosen-excel?semesterId=${selectedSemester}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            target="_blank"
            download
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Export Excel</span>
          </Link>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
          >
            <Printer size={14} />
            <span>Cetak Laporan</span>
          </button>
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
                placeholder="Cari dosen / NIDN..."
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
          </div>

          {/* Right Controls: Filter & Reset */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status / Kinerja Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                filterStatus !== "ALL"
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Filter Kinerja Dosen"
            >
              <option value="ALL">Semua Kinerja</option>
              <option value="SANGAT_BAIK">Sangat Baik</option>
              <option value="PERLU_PEMBINAAN">Perlu Pembinaan</option>
            </select>

            {/* Reset All Filters Button */}
            {(searchQuery || filterStatus !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("ALL");
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

      {/* ── Table Card (Standard Full-Bleed Card) ──────────────────────────────── */}
      <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs print:shadow-none print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[850px]">
            <thead>
              <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                <th className="py-2.5 px-2.5 text-center w-10 text-slate-700 font-bold">No</th>
                {renderSortHeader("Nama Dosen", "DOSEN", "left", "min-w-[220px]")}
                {renderSortHeader("Program Studi", "PRODI", "left", "min-w-[150px]")}
                {renderSortHeader("Kelas Diampu", "KELAS", "center", "w-32")}
                {renderSortHeader("Rata-rata Kehadiran", "KEHADIRAN", "center", "min-w-[140px]")}
                {renderSortHeader("Rata-rata Konten", "KONTEN", "center", "min-w-[140px]")}
                {renderSortHeader("Status Evaluasi", "STATUS", "center", "min-w-[130px]")}
                <th className="py-2.5 px-2.5 text-center font-bold text-slate-700 w-16 print:hidden">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-xs">
              {sortedDosen.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    Tidak ada data dosen yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                sortedDosen.map((d, idx) => {
                  const isExpanded = expandedDosenId === d.id;
                  const isOdd = idx % 2 === 1;

                  return (
                    <React.Fragment key={d.id}>
                      <tr
                        className={`transition-colors border-b border-slate-100/80 ${
                          isExpanded ? "bg-[#fdf2f8]/40" : isOdd ? "bg-slate-50" : "bg-white"
                        } hover:bg-[#fdf2f8]/80`}
                      >
                        {/* No */}
                        <td className="py-3 px-2.5 text-center font-medium text-slate-400 text-xs">
                          {idx + 1}
                        </td>

                        {/* Nama Dosen */}
                        <td className="py-3 px-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#a80063]/15 to-[#d946ef]/20 border border-[#fbcfe8] text-[#a80063] font-semibold text-xs flex items-center justify-center shrink-0">
                              {d.nama[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-xs text-slate-900 leading-tight">
                                {d.nama}
                              </p>
                              {d.nidn && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  NIDN: {d.nidn}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Program Studi */}
                        <td className="py-3 px-2.5 font-medium text-slate-600">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10.5px] font-semibold">
                            {d.prodi.kode} - {d.prodi.nama}
                          </span>
                        </td>

                        {/* Kelas Diampu */}
                        <td className="py-3 px-2.5 text-center">
                          <span className="font-semibold text-slate-800 text-xs">
                            {d.totalKelas} Kelas
                          </span>
                        </td>

                        {/* Rata-rata Kehadiran */}
                        <td className="py-3 px-2.5 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-bold text-emerald-600 text-xs">
                              {formatPct(d.avgKehadiran)}
                            </span>
                            <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${d.avgKehadiran}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Rata-rata Konten */}
                        <td className="py-3 px-2.5 text-center">
                          {d.avgKonten === null ? (
                            <span
                              className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200"
                              title="Bebas kewajiban konten 3 pilar (Hanya mengajar kelas bimbingan)"
                            >
                              Bebas
                            </span>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-[#a80063] text-xs">
                                {formatPct(d.avgKonten)}
                              </span>
                              <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                                <div
                                  className="h-full bg-[#a80063] rounded-full"
                                  style={{ width: `${Math.min(100, d.avgKonten)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status Evaluasi */}
                        <td className="py-3 px-2.5 text-center">
                          {d.status === "SANGAT_BAIK" ? (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Sangat Baik
                            </span>
                          ) : (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Perlu Pembinaan
                            </span>
                          )}
                        </td>

                        {/* Detail Accordion Toggle */}
                        <td className="py-3 px-2.5 text-center print:hidden">
                          <button
                            onClick={() =>
                              setExpandedDosenId(isExpanded ? null : d.id)
                            }
                            className={`w-7 h-7 rounded-md border text-slate-400 inline-flex items-center justify-center transition-all cursor-pointer ${
                              isExpanded
                                ? "bg-[#fdf2f8] text-[#a80063] border-[#fbcfe8]"
                                : "bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border-slate-200/80"
                            }`}
                            title="Rincian Kelas"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-table for Classes of this Lecturer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 animate-fade-in border-b border-slate-200/80">
                          <td colSpan={8} className="p-3 sm:p-4">
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                Rincian Kelas yang Diampu ({d.kelasList.length} Kelas):
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b-2 border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50/70">
                                      <th className="py-2 px-2">Kode Kelas</th>
                                      <th className="py-2 px-2">Mata Kuliah</th>
                                      <th className="py-2 px-2 text-center">Skor Kehadiran</th>
                                      <th className="py-2 px-2 text-center">Skor Konten</th>
                                      <th className="py-2 px-2 text-center">Status</th>
                                      <th className="py-2 px-2 text-right">Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100/80">
                                    {d.kelasList.map((cls, cIdx) => {
                                      const isSubOdd = cIdx % 2 === 1;
                                      return (
                                        <tr key={cls.id} className={isSubOdd ? "bg-slate-50/50" : "bg-white"}>
                                          <td className="py-2 px-2 font-bold text-[#a80063]">
                                            <div className="flex items-center gap-1.5">
                                              <span className="inline-flex px-1.5 py-0.5 rounded bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-[10.5px] font-extrabold w-fit">
                                                {cls.kodeKelas}
                                              </span>
                                              {cls.modePembelajaran && (
                                                <span
                                                  className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold border ${
                                                    cls.modePembelajaran === "BIMBINGAN"
                                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                                      : cls.modePembelajaran === "LURING"
                                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                      : "bg-blue-50 text-blue-700 border-blue-200"
                                                  }`}
                                                >
                                                  {cls.modePembelajaran === "BIMBINGAN"
                                                    ? "Bimbingan"
                                                    : cls.modePembelajaran === "LURING"
                                                    ? "Offline"
                                                    : "Online"}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-2">
                                            <p className="font-semibold text-slate-800">
                                              {cls.mataKuliah.nama} ({cls.mataKuliah.sks} SKS)
                                            </p>
                                            {cls.statusPenugasan && cls.statusPenugasan !== "Penuh (Sesi 1–16)" && (
                                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]">
                                                {cls.statusPenugasan}
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-center font-bold text-emerald-600">
                                            {cls.totalHadir}/{cls.totalSesiBeban ?? 16} ({formatPct(cls.persenKehadiran)})
                                          </td>
                                          <td className="py-2 px-2 text-center">
                                            {cls.modePembelajaran === "BIMBINGAN" ? (
                                              <span className="inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                                Bebas
                                              </span>
                                            ) : (
                                              <span className="font-bold text-[#a80063]">
                                                {cls.totalSkorKonten}/{cls.maxSkorKonten ?? 42} ({formatPct(cls.persenKonten)})
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-center">
                                            {cls.statusEvaluasi === "TERLAKSANA" ? (
                                              <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Terlaksana
                                              </span>
                                            ) : (
                                              <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                Perhatian
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-right">
                                            <Link
                                              href={`/monitoring/${cls.id}`}
                                              className="text-xs font-semibold text-[#a80063] hover:underline"
                                            >
                                              Monitoring →
                                            </Link>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
