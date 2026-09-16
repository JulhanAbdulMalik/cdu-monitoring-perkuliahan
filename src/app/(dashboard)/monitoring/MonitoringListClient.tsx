"use client";
// src/app/(dashboard)/monitoring/MonitoringListClient.tsx
// Comprehensive List of All Monitored Classes with Last Updated Timestamp & 3-Pillar Progress

import { useState, useMemo, useEffect } from "react";
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
  AlertCircle,
  CalendarCheck,
  User,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GraduationCap,
} from "lucide-react";
import { calculateClassSummary } from "@/lib/score-calculator";
import { formatTerakhirUpdateParts, getCurrentActiveSessionNumber, DEFAULT_SEMESTER_START_DATE, formatPct, roundPct } from "@/lib/utils";

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

export interface MonitoringKelasItem {
  id: string;
  kodeKelas: string;
  jadwalHari: string | null;
  jadwalJam: string | null;
  modePembelajaran: "DARING" | "LURING" | "BIMBINGAN";
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
    dosenPengajarId?: string | null;
    statusPengajar?: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
    catatanGantiDosen?: string | null;
    dosenPengajar?: {
      id: string;
      nama: string;
      nidn?: string | null;
    } | null;
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
  const [filterProdi, setFilterProdi] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterHari, setFilterHari] = useState<string>("ALL");
  const [monitoringTab, setMonitoringTab] = useState<"ALL" | "BELUM" | "SUDAH">("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("TERBARU");
  const [searchQuery, setSearchQuery] = useState("");

  const activeSem = useMemo(
    () => semesters.find((s) => s.aktif) || semesters.find((s) => s.id === defaultSemesterId) || semesters[0],
    [semesters, defaultSemesterId]
  );

  const defaultActiveSesi = useMemo(() => {
    const semStartStr = activeSem?.tanggalMulai
      ? new Date(activeSem.tanggalMulai).toISOString().split("T")[0]
      : DEFAULT_SEMESTER_START_DATE;
    return getCurrentActiveSessionNumber(semStartStr, activeSem?.hariLibur);
  }, [activeSem]);

  const [selectedSesi, setSelectedSesi] = useState<number>(defaultActiveSesi);

  // Sinkronisasi selectedSesi bila default sesi berubah karena ganti semester
  useEffect(() => {
    setSelectedSesi(defaultActiveSesi);
  }, [defaultActiveSesi]);

  // Process and compute stats for every class
  const processedClasses = kelasList.map((cls) => {
    const summary = calculateClassSummary(cls.monitoringSesi as any, cls.modePembelajaran);

    // Evaluasi status monitoring untuk sesi target (selectedSesi)
    const targetSesiData = cls.monitoringSesi.find((s) => s.nomorSesi === selectedSesi);
    const isMonitored = targetSesiData ? targetSesiData.kehadiran !== "BELUM_DIISI" : false;
    let targetSesiKehadiranLabel = "Belum Dicek";
    let targetSesiKehadiranColor = "bg-rose-50 text-rose-700 border-rose-200";

    if (targetSesiData) {
      if (targetSesiData.kehadiran === "HADIR") {
        targetSesiKehadiranLabel = "Hadir";
        targetSesiKehadiranColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
      } else if (targetSesiData.kehadiran === "HADIR_TIDAK_LENGKAP" || targetSesiData.kehadiran === "HTL") {
        targetSesiKehadiranLabel = "HTL";
        targetSesiKehadiranColor = "bg-amber-50 text-amber-700 border-amber-200";
      } else if (targetSesiData.kehadiran === "TIDAK_HADIR" || targetSesiData.kehadiran === "ALPHA") {
        targetSesiKehadiranLabel = "Alpha";
        targetSesiKehadiranColor = "bg-rose-50 text-rose-700 border-rose-200";
      }
    }

    // Compute true latest update timestamp across class and its sessions
    let latestTime = new Date(cls.updatedAt).getTime();
    cls.monitoringSesi.forEach((s) => {
      const sTime = new Date(s.updatedAt).getTime();
      if (sTime > latestTime) latestTime = sTime;
    });

    const updateParts = formatTerakhirUpdateParts(new Date(latestTime));

    // Kumpulkan dosen pengajar per sesi
    const peranMap = new Map<string, { id: string; nama: string; status: string; sesiList: number[] }>();
    cls.monitoringSesi.forEach((s) => {
      const isSub = s.dosenPengajar && s.statusPengajar && s.statusPengajar !== "UTAMA";
      if (isSub) {
        const sub = s.dosenPengajar!;
        if (!peranMap.has(sub.id)) {
          peranMap.set(sub.id, {
            id: sub.id,
            nama: sub.nama,
            status: s.statusPengajar!,
            sesiList: [s.nomorSesi],
          });
        } else {
          peranMap.get(sub.id)!.sesiList.push(s.nomorSesi);
        }
      }
    });

    const dosenPengajarList = Array.from(peranMap.values());
    const isSplitPengajar = dosenPengajarList.length > 0;

    return {
      ...cls,
      summary,
      targetSesiData,
      isMonitored,
      targetSesiKehadiranLabel,
      targetSesiKehadiranColor,
      latestTime,
      updateParts,
      dosenPengajarList,
      isSplitPengajar,
    };
  });

  // 1. Base list: disaring berdasarkan Prodi, Mode, Hari, dan Search Query
  const baseList = processedClasses.filter((item) => {
    const matchProdi = filterProdi === "ALL" || item.mataKuliah.prodi.id === filterProdi;
    const matchMode = filterMode === "ALL" || item.modePembelajaran === filterMode;
    const matchHari =
      filterHari === "ALL" ||
      (item.jadwalHari && item.jadwalHari.trim().toLowerCase() === filterHari.toLowerCase());
    const q = searchQuery.toLowerCase();
    const matchPengajar = item.dosenPengajarList?.some((p) =>
      p.nama.toLowerCase().includes(q)
    );
    const matchSearch =
      item.kodeKelas.toLowerCase().includes(q) ||
      item.mataKuliah.nama.toLowerCase().includes(q) ||
      item.mataKuliah.kode.toLowerCase().includes(q) ||
      item.dosen.nama.toLowerCase().includes(q) ||
      matchPengajar;

    return matchProdi && matchMode && matchHari && matchSearch;
  });

  // Metrik untuk Tab & Daily Progress Widget
  const totalInBase = baseList.length;
  const sudahDimonitorCount = baseList.filter((c) => c.isMonitored).length;
  const belumDimonitorCount = baseList.filter((c) => !c.isMonitored).length;
  const persenSelesai = totalInBase > 0 ? roundPct(sudahDimonitorCount, totalInBase) : 0;

  // 2. Final filtered list: menerapkan monitoringTab dan filterStatus
  const filteredList = baseList.filter((item) => {
    const matchStatus = filterStatus === "ALL" || item.summary.statusEvaluasi === filterStatus;
    const matchTab =
      monitoringTab === "ALL"
        ? true
        : monitoringTab === "BELUM"
        ? !item.isMonitored
        : item.isMonitored;

    return matchStatus && matchTab;
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

  const totalClasses = filteredList.length;

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


          {/* Sesi Selector (1-16) */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="text-[11px] font-medium hidden sm:inline">Sesi:</span>
            <select
              value={selectedSesi}
              onChange={(e) => setSelectedSesi(Number(e.target.value))}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a80063] text-slate-800 font-semibold"
            >
              {Array.from({ length: 16 }, (_, i) => i + 1).map((sNum) => (
                <option key={sNum} value={sNum}>
                  Sesi {sNum} {sNum === defaultActiveSesi ? "(Minggu Ini)" : sNum === 8 ? "(UTS)" : sNum === 16 ? "(UAS)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Hari Filter (Dropdown Bersih) */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="text-[11px] font-medium hidden sm:inline">Hari:</span>
            <select
              value={filterHari}
              onChange={(e) => setFilterHari(e.target.value)}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a80063] text-slate-700 font-medium"
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
              <option value="BIMBINGAN">Bimbingan</option>
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

      {/* ── Sub-Tab Segmented Control (Opsi A) ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setMonitoringTab("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              monitoringTab === "ALL"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
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
            onClick={() => setMonitoringTab("BELUM")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              monitoringTab === "BELUM"
                ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-xs"
                : "text-slate-600 hover:text-rose-600 hover:bg-rose-50/50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Belum Dimonitor</span>
            </span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-extrabold">
              {belumDimonitorCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMonitoringTab("SUDAH")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              monitoringTab === "SUDAH"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs"
                : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Sudah Dimonitor</span>
            </span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-extrabold">
              {sudahDimonitorCount}
            </span>
          </button>
        </div>

        {/* Info Keterangan Sesi Terpilih */}
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/70 shadow-2xs">
          <Clock size={12} className="text-[#a80063] shrink-0" />
          <span>
            Status monitoring diukur dari <strong>Kehadiran Sesi {selectedSesi}</strong>
          </span>
        </div>
      </div>

      {/* ── Monitored Class Table Card ───────────────────────────────────────── */}
      <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                <th className="py-2.5 px-2.5 text-center w-10">No</th>
                {renderSortHeader("Kelas", "KODE", "left", "w-28 min-w-[110px]")}
                {renderSortHeader("Mata Kuliah", "MK")}
                {renderSortHeader("Dosen Pengampu", "DOSEN", "left", "min-w-[250px]")}
                {renderSortHeader("Jadwal Kuliah", "JADWAL")}
                {renderSortHeader("Kehadiran", "KEHADIRAN", "center")}
                {renderSortHeader("Skor 3 Pilar", "PILAR", "center")}
                <th className="py-2.5 px-2.5 text-center text-slate-700 font-bold">Live Conf</th>
                {renderSortHeader("Terakhir Update", "UPDATE", "center")}
                <th className="py-2.5 px-2.5 text-center text-slate-700 font-bold w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-xs">
              {sortedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    {monitoringTab === "BELUM" ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-emerald-600">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                        <p className="font-bold text-sm">Semua kelas sudah selesai dimonitor!</p>
                        <p className="text-xs text-slate-400">Tidak ada antrean kelas yang belum dicek pada kriteria filter ini.</p>
                      </div>
                    ) : monitoringTab === "SUDAH" ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-slate-400">
                        <AlertCircle size={32} className="text-slate-300" />
                        <p className="font-bold text-sm">Belum ada kelas yang selesai dimonitor</p>
                        <p className="text-xs text-slate-400">Silakan lakukan pengecekan kelas pada tab "Belum Dimonitor".</p>
                      </div>
                    ) : (
                      "Tidak ada kelas yang sesuai dengan kriteria filter."
                    )}
                  </td>
                </tr>
              ) : (
                sortedList.map((cls, idx) => {
                  const isOdd = idx % 2 === 1;

                  return (
                    <tr
                      key={cls.id}
                      className={`transition-colors border-b border-slate-100/80 ${
                        isOdd ? "bg-slate-50" : "bg-white"
                      } hover:bg-[#fdf2f8]/80`}
                    >
                      {/* No */}
                      <td className="py-2 px-2 text-center font-medium text-slate-400 text-xs">
                        {idx + 1}
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
                            <span className="font-semibold truncate max-w-[250px] text-xs leading-tight" title={cls.dosen.nama}>
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
                                    {p.status === "PERGANTIAN_TETAP" ? "Baru" : "Ganti"}: S{Math.min(...p.sesiList)}–{Math.max(...p.sesiList)}
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
                          {cls.jadwalHari || "—"}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          {cls.jadwalJam || "—"}
                        </p>
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
                              <span
                                className={`inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.2 rounded border ${cls.targetSesiKehadiranColor}`}
                                title={`Presensi Sesi ${selectedSesi} sudah diisi: ${cls.targetSesiKehadiranLabel}`}
                              >
                                <CheckCircle2 size={8.5} className="shrink-0" />
                                <span>S{selectedSesi}: {cls.targetSesiKehadiranLabel}</span>
                              </span>
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
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-purple-200" title="Kelas Bimbingan bebas dari kewajiban 3 pilar konten LMS">
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
                          </div>
                        )}
                      </td>

                      {/* Live Conference Quota */}
                      <td className="py-3 px-2.5 text-center">
                        {cls.modePembelajaran === "LURING" ? (
                          <div className="inline-flex flex-col items-center justify-center">
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80" title="Kelas Tatap Muka (Offline) tidak memiliki kewajiban kuota Live Conference">
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

                      {/* Terakhir Update (2 Baris: Jam & Tanggal) */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-md bg-white border border-slate-200/80 shadow-2xs">
                          <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-800 leading-tight">
                            <Clock size={10} className="text-[#a80063] shrink-0" />
                            <span>{cls.updateParts.waktu}</span>
                          </div>
                          <span className="text-[9px] font-medium text-slate-500 mt-0.5 leading-tight">
                            {cls.updateParts.tanggal}
                          </span>
                        </div>
                      </td>

                      {/* Aksi Button (Buka di Tab Baru) */}
                      <td className="py-3 px-2.5 text-right whitespace-nowrap">
                        <Link
                          href={`/monitoring/${cls.id}`}
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
      </div>
    </div>
  );
}
