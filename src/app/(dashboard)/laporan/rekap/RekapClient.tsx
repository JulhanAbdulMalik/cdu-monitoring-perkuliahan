"use client";
// src/app/(dashboard)/laporan/rekap/RekapClient.tsx
// Master Rekapitulasi Monitoring Sesi 1-16 (3-Pillar & Conference Quota Model)

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Filter,
  Calendar,
  School,
  Sparkles,
  Users,
  Building,
  Laptop,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { ClassRekapSummary } from "@/actions/laporan";
import { formatPct } from "@/lib/utils";

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

interface RekapClientProps {
  initialRekap: ClassRekapSummary[];
  semesters: SemesterOption[];
  prodiList: ProdiOption[];
  defaultSemesterId: string;
}

export type RekapSortKey =
  | "PRODI_ASC"
  | "PRODI_DESC"
  | "KODE_ASC"
  | "KODE_DESC"
  | "MK_ASC"
  | "MK_DESC"
  | "DOSEN_ASC"
  | "DOSEN_DESC";

export default function RekapClient({
  initialRekap,
  semesters,
  prodiList,
  defaultSemesterId,
}: RekapClientProps) {
  const [selectedSemester, setSelectedSemester] = useState<string>(defaultSemesterId);
  const [filterProdi, setFilterProdi] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<RekapSortKey>("PRODI_ASC");

  // Filter rekap list
  const filteredRekap = initialRekap.filter((item) => {
    const matchProdi = filterProdi === "ALL" || item.mataKuliah.prodi.id === filterProdi;
    const matchStatus = filterStatus === "ALL" || item.statusEvaluasi === filterStatus;
    const matchMode = filterMode === "ALL" || item.modePembelajaran === filterMode;
    const q = searchQuery.toLowerCase();
    const matchPengajar = item.dosenPengajarList?.some((p) =>
      p.nama.toLowerCase().includes(q)
    );
    const matchSearch =
      item.kodeKelas.toLowerCase().includes(q) ||
      item.mataKuliah.nama.toLowerCase().includes(q) ||
      item.mataKuliah.kode.toLowerCase().includes(q) ||
      item.dosen.nama.toLowerCase().includes(q) ||
      Boolean(matchPengajar);

    return matchProdi && matchStatus && matchMode && matchSearch;
  });

  // Sort rekap list
  const sortedRekap = [...filteredRekap].sort((a, b) => {
    switch (sortBy) {
      case "PRODI_ASC": {
        const pDiff = a.mataKuliah.prodi.nama.localeCompare(b.mataKuliah.prodi.nama, "id", { sensitivity: "base" });
        if (pDiff !== 0) return pDiff;
        const kDiff = a.kodeKelas.localeCompare(b.kodeKelas, "id", { sensitivity: "base" });
        if (kDiff !== 0) return kDiff;
        return a.mataKuliah.nama.localeCompare(b.mataKuliah.nama, "id", { sensitivity: "base" });
      }
      case "PRODI_DESC": {
        const pDiff = b.mataKuliah.prodi.nama.localeCompare(a.mataKuliah.prodi.nama, "id", { sensitivity: "base" });
        if (pDiff !== 0) return pDiff;
        const kDiff = a.kodeKelas.localeCompare(b.kodeKelas, "id", { sensitivity: "base" });
        if (kDiff !== 0) return kDiff;
        return a.mataKuliah.nama.localeCompare(b.mataKuliah.nama, "id", { sensitivity: "base" });
      }
      case "KODE_ASC": {
        const kDiff = a.kodeKelas.localeCompare(b.kodeKelas, "id", { sensitivity: "base" });
        if (kDiff !== 0) return kDiff;
        return a.mataKuliah.nama.localeCompare(b.mataKuliah.nama, "id", { sensitivity: "base" });
      }
      case "KODE_DESC": {
        const kDiff = b.kodeKelas.localeCompare(a.kodeKelas, "id", { sensitivity: "base" });
        if (kDiff !== 0) return kDiff;
        return a.mataKuliah.nama.localeCompare(b.mataKuliah.nama, "id", { sensitivity: "base" });
      }
      case "MK_ASC": {
        const mDiff = a.mataKuliah.nama.localeCompare(b.mataKuliah.nama, "id", { sensitivity: "base" });
        if (mDiff !== 0) return mDiff;
        return a.kodeKelas.localeCompare(b.kodeKelas, "id", { sensitivity: "base" });
      }
      case "MK_DESC": {
        const mDiff = b.mataKuliah.nama.localeCompare(a.mataKuliah.nama, "id", { sensitivity: "base" });
        if (mDiff !== 0) return mDiff;
        return a.kodeKelas.localeCompare(b.kodeKelas, "id", { sensitivity: "base" });
      }
      case "DOSEN_ASC": {
        const dDiff = a.dosen.nama.localeCompare(b.dosen.nama, "id", { sensitivity: "base" });
        if (dDiff !== 0) return dDiff;
        return a.mataKuliah.nama.localeCompare(b.mataKuliah.nama, "id", { sensitivity: "base" });
      }
      case "DOSEN_DESC": {
        const dDiff = b.dosen.nama.localeCompare(a.dosen.nama, "id", { sensitivity: "base" });
        if (dDiff !== 0) return dDiff;
        return a.mataKuliah.nama.localeCompare(b.mataKuliah.nama, "id", { sensitivity: "base" });
      }
      default:
        return 0;
    }
  });

  // Toggle column sort
  function handleColumnSort(column: "PRODI" | "KODE" | "MK" | "DOSEN") {
    switch (column) {
      case "PRODI":
        setSortBy(sortBy === "PRODI_ASC" ? "PRODI_DESC" : "PRODI_ASC");
        break;
      case "KODE":
        setSortBy(sortBy === "KODE_ASC" ? "KODE_DESC" : "KODE_ASC");
        break;
      case "MK":
        setSortBy(sortBy === "MK_ASC" ? "MK_DESC" : "MK_ASC");
        break;
      case "DOSEN":
        setSortBy(sortBy === "DOSEN_ASC" ? "DOSEN_DESC" : "DOSEN_ASC");
        break;
    }
  }

  // Render clickable header column with sort icon
  function renderSortHeader(
    label: string,
    columnKey: "PRODI" | "KODE" | "MK" | "DOSEN",
    align: "left" | "center" = "left",
    extraClass: string = ""
  ) {
    const isCurrent =
      (columnKey === "PRODI" && (sortBy === "PRODI_ASC" || sortBy === "PRODI_DESC")) ||
      (columnKey === "KODE" && (sortBy === "KODE_ASC" || sortBy === "KODE_DESC")) ||
      (columnKey === "MK" && (sortBy === "MK_ASC" || sortBy === "MK_DESC")) ||
      (columnKey === "DOSEN" && (sortBy === "DOSEN_ASC" || sortBy === "DOSEN_DESC"));

    const isAsc =
      sortBy === "PRODI_ASC" ||
      sortBy === "KODE_ASC" ||
      sortBy === "MK_ASC" ||
      sortBy === "DOSEN_ASC";

    return (
      <th
        onClick={() => handleColumnSort(columnKey)}
        className={`py-2.5 px-2.5 cursor-pointer select-none transition-colors group hover:bg-slate-100/90 ${
          align === "center" ? "text-center" : "text-left"
        } ${extraClass}`}
        title={`Klik untuk mengurutkan berdasarkan ${label}`}
      >
        <div
          className={`inline-flex items-center gap-1.5 font-bold ${
            isCurrent ? "text-[#a80063]" : "text-slate-500 group-hover:text-slate-700"
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

  const currentSem =
    semesters.find((s) => s.id === selectedSemester) || semesters[0];

  function handlePrint() {
    window.print();
  }

  function handleExportExcel() {
    window.location.href = `/api/export/rekap-excel?semesterId=${selectedSemester}&prodiId=${filterProdi}`;
  }

  return (
    <div className="space-y-4">
      {/* ── Top Header Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)] print:hidden">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <BarChart3 size={18} className="text-[#a80063]" />
            <span>Rekapitulasi Monitoring Perkuliahan (3 Pilar)</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Matriks evaluasi kehadiran dosen, keterpenuhan 3 pilar materi (L/S, Q/T, T/V), dan kuota Live Conf
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
          Laporan Rekapitulasi Monitoring Perkuliahan Semester{" "}
          {currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : ""}
        </h3>
        <p className="text-[10px] text-slate-500 mt-1">
          Dicetak pada: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>


      {/* ── Search & Filter Controls ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/70 print:hidden">
        {/* Search */}
        <div className="relative w-full lg:max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kelas, mata kuliah, dosen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-slate-50 text-xs rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Semester */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Semester:</span>
            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                window.location.href = `/laporan/rekap?semesterId=${e.target.value}&prodiId=${filterProdi}`;
              }}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[150px] truncate"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tahunAkademik} ({s.periode}) {s.aktif ? "★ Aktif" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Prodi */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Prodi:</span>
            <select
              value={filterProdi}
              onChange={(e) => setFilterProdi(e.target.value)}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[140px] truncate"
            >
              <option value="ALL">Semua Prodi</option>
              {prodiList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode} - {p.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Mode */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Mode:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
            >
              <option value="ALL">Semua Mode</option>
              <option value="DARING">Online</option>
              <option value="LURING">Offline</option>
              <option value="BIMBINGAN">Bimbingan</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="MEMENUHI">Memenuhi Syarat</option>
              <option value="CUKUP">Cukup</option>
              <option value="PERLU_PERHATIAN">Perlu Perhatian</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Master Recap Table Card ─────────────────────────────────────────── */}
      <div className="duralux-card bg-white p-5 print:shadow-none print:border-none print:p-0">
        {/* Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 text-[10px] text-slate-500 font-medium print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700">Skor 3 Pilar:</span>
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded text-[9px] font-bold text-center leading-4 bg-emerald-100 text-emerald-700">3</span>
              <span>Lengkap (3/3)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded text-[9px] font-bold text-center leading-4 bg-blue-100 text-blue-700">2</span>
              <span>Baik (2/3)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded text-[9px] font-bold text-center leading-4 bg-amber-100 text-amber-800">1</span>
              <span>Sebagian (1/3)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded text-[9px] font-bold text-center leading-4 bg-rose-100 text-rose-700">0</span>
              <span>Kosong</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700">Pengajar:</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-600 ring-1 ring-purple-200" />
              <span>Dosen Baru</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 ring-1 ring-amber-200" />
              <span>Dosen Pengganti</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/70">
                {renderSortHeader("Program Studi", "PRODI", "left", "min-w-[130px]")}
                {renderSortHeader("Kode / Kelas", "KODE", "left", "min-w-[90px]")}
                {renderSortHeader("Mata Kuliah", "MK", "left", "min-w-[150px]")}
                {renderSortHeader("Dosen", "DOSEN", "left", "min-w-[135px]")}
                {/* 16 Session Headers */}
                {Array.from({ length: 16 }, (_, i) => i + 1).map((sesiNum) => (
                  <th
                    key={sesiNum}
                    className={`py-2 px-1 text-center font-bold text-[9px] min-w-[28px] ${
                      sesiNum === 8 || sesiNum === 16 ? "bg-purple-50 text-purple-800" : ""
                    }`}
                  >
                    {sesiNum === 8 ? "UTS" : sesiNum === 16 ? "UAS" : `S${sesiNum}`}
                  </th>
                ))}
                <th className="py-2.5 px-2 text-center font-bold">Hadir</th>
                <th className="py-2.5 px-2 text-center font-bold">Konten (3P)</th>
                <th className="py-2.5 px-2 text-center font-bold min-w-[90px]">Live Conf</th>
                <th className="py-2.5 px-2.5 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedRekap.length === 0 ? (
                <tr>
                  <td colSpan={24} className="py-8 text-center text-xs text-slate-400">
                    Tidak ada data rekapitulasi yang sesuai.
                  </td>
                </tr>
              ) : (
                sortedRekap.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Program Studi */}
                    <td className="py-2.5 px-2.5 font-medium">
                      <p className="font-semibold text-xs text-slate-800 leading-tight">
                        {cls.mataKuliah.prodi.nama}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {cls.mataKuliah.prodi.kode}
                      </span>
                    </td>

                    {/* Kode / Kelas & Mode */}
                    <td className="py-2.5 px-2.5 font-bold">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-[#a80063]">
                          {cls.kodeKelas}
                        </span>
                        <span className="text-[9px] text-slate-500 font-semibold">
                          {cls.modePembelajaran === "BIMBINGAN" ? "Bimbingan" : cls.modePembelajaran === "LURING" ? "Offline" : "Online"}
                        </span>
                      </div>
                    </td>

                    {/* Mata Kuliah */}
                    <td className="py-2.5 px-2.5">
                      <p className="font-semibold text-xs text-slate-900 leading-tight">
                        {cls.mataKuliah.nama}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {cls.mataKuliah.kode} • {cls.mataKuliah.sks} SKS
                      </p>
                    </td>

                    {/* Dosen & Split Lecturer Info */}
                    <td className="py-2.5 px-2.5 font-medium text-slate-700">
                      <div>
                        <p className="truncate max-w-[135px] font-bold text-slate-900 leading-tight" title={cls.dosen.nama}>
                          {cls.dosen.nama}
                        </p>
                        {cls.isSplitPengajar && cls.dosenPengajarList && cls.dosenPengajarList.length > 1 ? (
                          <div className="mt-1 space-y-0.5">
                            {cls.dosenPengajarList
                              .filter((p) => p.id !== cls.dosen.id)
                              .map((p, pIdx) => (
                                <div key={pIdx} className="flex items-center gap-1 text-[9px] leading-tight">
                                  <span
                                    className={`px-1 py-0.2 rounded font-bold shrink-0 border ${
                                      p.statusPengajar === "PERGANTIAN_TETAP"
                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                  >
                                    {p.statusPengajar === "PERGANTIAN_TETAP" ? "Baru" : "Ganti"}: S{Math.min(...p.sesiList)}–{Math.max(...p.sesiList)}
                                  </span>
                                  <span className="truncate max-w-[85px] text-slate-600 font-medium" title={p.nama}>
                                    {p.nama}
                                  </span>
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Sesi 1 s/d 16 Matrix Pills (3-Pillar Scores) */}
                    {cls.sesi.map((s) => {
                      const isExam = s.nomorSesi === 8 || s.nomorSesi === 16;
                      const isHadir = s.kehadiran === "HADIR";
                      const isHTL = s.kehadiran === "HADIR_TIDAK_LENGKAP" || s.kehadiran === "HADIR_TDK_LENGKAP";
                      const isAlpha = s.kehadiran === "TIDAK_HADIR" || s.kehadiran === "ALPHA";
                      const isSub = s.dosenPengajar && s.statusPengajar && s.statusPengajar !== "UTAMA";
                      const pengajarNama = isSub ? s.dosenPengajar!.nama : cls.dosen.nama;
                      const statusLabel = s.statusPengajar === "PERGANTIAN_TETAP"
                        ? "Dosen Baru"
                        : s.statusPengajar === "PENGGANTI_INSIDENTAL"
                        ? "Dosen Pengganti"
                        : "Dosen Utama";

                      const tooltipText = `Sesi ${s.nomorSesi}: ${
                        isHadir ? `Hadir (Skor 3 Pilar: ${s.contentScore ?? "Ujian"})` : isHTL ? `HTL (Skor: ${s.contentScore ?? "—"})` : isAlpha ? "Alpha / Tidak Hadir" : "Belum Diisi"
                      } • Pengajar: ${pengajarNama}${isSub ? ` [${statusLabel}${s.catatanGantiDosen ? `: ${s.catatanGantiDosen}` : ""}]` : ""}`;

                      return (
                        <td
                          key={s.nomorSesi}
                          className={`py-2 px-1 text-center text-[10px] ${
                            isExam ? "bg-purple-50/30" : ""
                          }`}
                        >
                          <div className="relative inline-block">
                            {isHadir ? (
                              <span
                                className={`inline-block w-5 h-5 leading-5 rounded text-center font-bold transition-all ${
                                  isExam
                                    ? "bg-purple-100 text-purple-800"
                                    : s.contentScore === 3
                                    ? "bg-emerald-100 text-emerald-700"
                                    : s.contentScore === 2
                                    ? "bg-blue-100 text-blue-700"
                                    : s.contentScore === 1
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-700"
                                } ${
                                  isSub
                                    ? s.statusPengajar === "PERGANTIAN_TETAP"
                                      ? "ring-1.5 ring-purple-400"
                                      : "ring-1.5 ring-amber-400"
                                    : ""
                                }`}
                                title={tooltipText}
                              >
                                {s.contentScore !== null ? s.contentScore : "H"}
                              </span>
                            ) : isHTL ? (
                              <span
                                className={`inline-block w-5 h-5 leading-5 rounded text-center font-bold bg-amber-100 text-amber-800 ${
                                  isSub
                                    ? s.statusPengajar === "PERGANTIAN_TETAP"
                                      ? "ring-1.5 ring-purple-400"
                                      : "ring-1.5 ring-amber-400"
                                    : ""
                                }`}
                                title={tooltipText}
                              >
                                {s.contentScore !== null ? s.contentScore : "T"}
                              </span>
                            ) : isAlpha ? (
                              <span
                                className={`inline-block w-5 h-5 leading-5 rounded text-center font-bold bg-rose-100 text-rose-700 ${
                                  isSub
                                    ? s.statusPengajar === "PERGANTIAN_TETAP"
                                      ? "ring-1.5 ring-purple-400"
                                      : "ring-1.5 ring-amber-400"
                                    : ""
                                }`}
                                title={tooltipText}
                              >
                                A
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold" title={tooltipText}>—</span>
                            )}

                            {/* Indicator dot jika sesi diajar oleh dosen pengganti / dosen baru */}
                            {isSub && (
                              <span
                                className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-white ${
                                  s.statusPengajar === "PERGANTIAN_TETAP" ? "bg-purple-600" : "bg-amber-500"
                                }`}
                                title={tooltipText}
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Hadir */}
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-bold text-slate-800">
                        {cls.totalHadir}/16
                      </span>
                      <span className="block text-[9px] text-slate-400 font-medium">
                        {formatPct(cls.persenKehadiran)}
                      </span>
                    </td>

                    {/* Skor 3 Pilar (Max 42) */}
                    <td className="py-2.5 px-2 text-center">
                      {cls.modePembelajaran === "BIMBINGAN" ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200" title="Bebas kewajiban 3 pilar materi">
                          Bebas
                        </span>
                      ) : (
                        <>
                          <span className="font-bold text-[#a80063]">
                            {cls.totalSkor3Pilar}/42
                          </span>
                          <span className="block text-[9px] text-slate-400 font-medium">
                            {formatPct(cls.persenKonten)}
                          </span>
                        </>
                      )}
                    </td>

                    {/* Live Conference Quota Compliance */}
                    <td className="py-2.5 px-2 text-center">
                      {cls.modePembelajaran === "LURING" ? (
                        <span className="text-[9.5px] font-bold text-slate-400">
                          Bebas Conf
                        </span>
                      ) : cls.modePembelajaran === "BIMBINGAN" ? (
                        <div className="inline-flex flex-col items-center text-[9px] font-bold">
                          <span className={cls.confPraUTS >= 8 ? "text-emerald-700" : "text-amber-700"}>
                            UTS: {cls.confPraUTS}/8
                          </span>
                          <span className={cls.confPraUAS >= 8 ? "text-emerald-700" : "text-amber-700"}>
                            UAS: {cls.confPraUAS}/8
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center text-[9px] font-bold">
                          <span className={cls.confPraUTS >= 3 ? "text-emerald-700" : "text-amber-700"}>
                            UTS: {cls.confPraUTS}/3
                          </span>
                          <span className={cls.confPraUAS >= 3 ? "text-emerald-700" : "text-amber-700"}>
                            UAS: {cls.confPraUAS}/3
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status Evaluasi */}
                    <td className="py-2.5 px-2.5 text-center">
                      {cls.statusEvaluasi === "MEMENUHI" && (
                        <span
                          className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                          title={cls.evaluasiNote}
                        >
                          Memenuhi
                        </span>
                      )}
                      {cls.statusEvaluasi === "CUKUP" && (
                        <span
                          className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                          title={cls.evaluasiNote}
                        >
                          Cukup
                        </span>
                      )}
                      {cls.statusEvaluasi === "PERLU_PERHATIAN" && (
                        <span
                          className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                          title={cls.evaluasiNote}
                        >
                          Perhatian
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Signature Line for PDF Print ────────────────────────────────────── */}
        <div className="hidden print:grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-300 text-center text-xs">
          <div>
            <p className="text-slate-500">Mengetahui,</p>
            <p className="font-bold text-slate-800">Ketua Program Studi</p>
            <div className="h-16" />
            <p className="font-bold underline text-slate-900">( .................................................... )</p>
            <p className="text-[10px] text-slate-500">NIDN / NIP.</p>
          </div>
          <div>
            <p className="text-slate-500">Sukabumi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="font-bold text-slate-800">Curriculum Development Unit (CDU)</p>
            <div className="h-16" />
            <p className="font-bold underline text-slate-900">Julhan Abdul Malik</p>
            <p className="text-[10px] text-slate-500">Staff Monitoring CDU</p>
          </div>
        </div>
      </div>
    </div>
  );
}
