"use server";
// src/actions/dashboard.ts
// High-Performance Aggregated Dashboard Server Actions with Single-Flight In-Memory Cache
// Replaces heavy 24,000-session memory loads with native PostgreSQL GROUP BY queries (< 50ms)

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  roundPct,
  getCurrentActiveSessionNumber,
  DEFAULT_SEMESTER_START_DATE,
} from "@/lib/utils";
import type { TrendItem, TrendDataByMode } from "@/components/dashboard/MonitoringTrendChart";
import type {
  DonutStatusItem,
  DonutClassMode,
  ModeDistributionData,
} from "@/components/dashboard/StatusDonutChart";

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE-FLIGHT IN-MEMORY CACHE
// ─────────────────────────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DASHBOARD_CACHE_TTL_MS = 60 * 1000; // 60 detik
const dashboardCacheStore = new Map<string, CacheEntry<any>>();
const inFlightDashboardRequests = new Map<string, Promise<any>>();

export async function invalidateDashboardCache(): Promise<void> {
  dashboardCacheStore.clear();
}

export interface DashboardClassItem {
  id: string;
  kodeKelas: string;
  mataKuliah: string;
  sks: number;
  dosen: string;
  dosen2?: string | null;
  prodi: string;
  progress: number;
  status: "LENGKAP" | "SEBAGIAN" | "BELUM";
}

export interface DashboardDataResult {
  activeSemester: {
    id: string;
    tahunAkademik: string;
    periode: string;
    aktif: boolean;
    tanggalMulai: Date | null;
  } | null;
  currentActiveSesi: number;
  totalKelas: number;
  totalProdi: number;
  totalDosen: number;
  kelasOffline: number;
  kelasOnline: number;
  kelasBimbingan: number;
  kelasPerluPerhatianCount: number;
  totalAlpha: number;
  totalHadir: number;
  totalSesiTerlaksana: number;
  targetSesiBerjalan: number;
  totalSesiBerjalan: number;
  totalJadwalSesi: number;
  totalKelasNonBimbingan: number;
  avgKehadiranBerjalan: number;
  avgKontenBerjalan: number;
  persenProgresMonitoringBerjalan: number;
  belumDimonitorSesiBerjalan: number;
  avgKehadiranSemester: number;
  avgKontenSemester: number;
  persenProgresMonitoringSemester: number;
  belumDimonitorSemester: number;
  trendData: TrendItem[];
  trendDataByMode: TrendDataByMode;
  donutData: DonutStatusItem[];
  distributionByMode: Record<DonutClassMode, ModeDistributionData>;
  recentClassesList: DashboardClassItem[];
}

export async function getDashboardData(params?: {
  semesterId?: string;
  isDosen?: boolean;
  userProdiIds?: string[];
}): Promise<DashboardDataResult> {
  const isDosen = Boolean(params?.isDosen);
  const userProdiIds = params?.userProdiIds || [];

  const [allSemesters, dosenCount, prodiCount] = await Promise.all([
    prisma.semester.findMany({
      orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
      include: { hariLibur: true },
    }),
    isDosen
      ? prisma.dosen.count({ where: { prodiId: { in: userProdiIds } } })
      : prisma.dosen.count(),
    isDosen
      ? Promise.resolve(userProdiIds.length)
      : prisma.prodi.count({ where: { isActive: true } }),
  ]);

  const activeSemester =
    allSemesters.find((s) => (params?.semesterId ? s.id === params.semesterId : s.aktif)) ||
    allSemesters[0] ||
    null;

  if (!activeSemester) {
    return {
      activeSemester: null,
      currentActiveSesi: 1,
      totalKelas: 0,
      totalProdi: 0,
      totalDosen: 0,
      kelasOffline: 0,
      kelasOnline: 0,
      kelasBimbingan: 0,
      kelasPerluPerhatianCount: 0,
      totalAlpha: 0,
      totalHadir: 0,
      totalSesiTerlaksana: 0,
      targetSesiBerjalan: 0,
      totalSesiBerjalan: 0,
      totalJadwalSesi: 0,
      totalKelasNonBimbingan: 0,
      avgKehadiranBerjalan: 0,
      avgKontenBerjalan: 0,
      persenProgresMonitoringBerjalan: 0,
      belumDimonitorSesiBerjalan: 0,
      avgKehadiranSemester: 0,
      avgKontenSemester: 0,
      persenProgresMonitoringSemester: 0,
      belumDimonitorSemester: 0,
      trendData: [],
      trendDataByMode: { ALL: [], OFFLINE: [], ONLINE: [], BIMBINGAN: [] },
      donutData: [],
      distributionByMode: {
        ALL: { data: [], totalSesi: 0, totalKelas: 0 },
        OFFLINE: { data: [], totalSesi: 0, totalKelas: 0 },
        ONLINE: { data: [], totalSesi: 0, totalKelas: 0 },
        BIMBINGAN: { data: [], totalSesi: 0, totalKelas: 0 },
      },
      recentClassesList: [],
    };
  }

  const semId = activeSemester.id;
  const sortedProdis = [...userProdiIds].sort().join(",");
  const cacheKey = `dash_${semId}_${isDosen ? "DOSEN_" + sortedProdis : "ADMIN"}`;

  // 1. Cek memory cache
  const cached = dashboardCacheStore.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. Cek in-flight request (Single-Flight Pattern / Promise Coalescing)
  if (inFlightDashboardRequests.has(cacheKey)) {
    return inFlightDashboardRequests.get(cacheKey) as Promise<DashboardDataResult>;
  }

  // 3. Eksekusi query teragregasi
  const fetchTask = (async (): Promise<DashboardDataResult> => {
    const semStartStr = activeSemester.tanggalMulai
      ? new Date(activeSemester.tanggalMulai).toISOString().split("T")[0]
      : DEFAULT_SEMESTER_START_DATE;
    const currentActiveSesi = getCurrentActiveSessionNumber(
      semStartStr,
      activeSemester.hariLibur
    );

    const prodiCondition =
      isDosen && userProdiIds.length > 0
        ? Prisma.sql`AND p.id IN (${Prisma.join(userProdiIds)})`
        : Prisma.empty;

    const [
      classCounts,
      sessionStats,
      maxSesiStats,
      perhatianResult,
      recentClassesRaw,
    ] = await Promise.all([
      // A. Jumlah kelas per mode pembelajaran
      prisma.$queryRaw<Array<{ modePembelajaran: string; count: number }>>`
        SELECT 
          k."modePembelajaran",
          COUNT(*)::int as count
        FROM "Kelas" k
        JOIN "MataKuliah" mk ON k."mataKuliahId" = mk.id
        JOIN "Prodi" p ON mk."prodiId" = p.id
        WHERE k."semesterId" = ${semId} AND p."isActive" = true
        ${prodiCondition}
        GROUP BY k."modePembelajaran";
      `,

      // B. Agregasi statistik sesi perkuliahan & 3 pilar per sesi dan mode
      prisma.$queryRaw<
        Array<{
          nomorSesi: number;
          kehadiran: string;
          modePembelajaran: string;
          count: number;
          count_sl: number;
          count_qt: number;
          count_tv: number;
          count_ganti: number;
        }>
      >`
        SELECT 
          ms."nomorSesi",
          ms."kehadiran",
          k."modePembelajaran",
          COUNT(*)::int as count,
          COUNT(CASE WHEN (ms.slide = true OR ms."lectureNote" = true) THEN 1 END)::int as count_sl,
          COUNT(CASE WHEN (ms.tugas = true OR ms.kuis = true) THEN 1 END)::int as count_qt,
          COUNT(CASE WHEN (ms.video = true OR ms.conference = true) THEN 1 END)::int as count_tv,
          COUNT(CASE WHEN ms."catatanCdu" ~* 'ganti|reschedule|tunda' THEN 1 END)::int as count_ganti
        FROM "MonitoringSesi" ms
        JOIN "Kelas" k ON ms."kelasId" = k.id
        JOIN "MataKuliah" mk ON k."mataKuliahId" = mk.id
        JOIN "Prodi" p ON mk."prodiId" = p.id
        WHERE k."semesterId" = ${semId} AND p."isActive" = true
        ${prodiCondition}
        GROUP BY ms."nomorSesi", ms."kehadiran", k."modePembelajaran"
        ORDER BY ms."nomorSesi" ASC;
      `,

      // C. Agregasi Sesi Berjalan (Opsi B - Max sesi terisi per kelas)
      prisma.$queryRaw<
        Array<{
          modePembelajaran: string;
          total_in_range: number;
          regular_in_range: number;
          sl_in_range: number;
          qt_in_range: number;
          tv_in_range: number;
        }>
      >`
        WITH ClassMaxSesi AS (
          SELECT 
            ms."kelasId",
            k."modePembelajaran",
            COALESCE(
              MAX(CASE WHEN ms."kehadiran" != 'BELUM_DIISI' OR (ms."catatanCdu" IS NOT NULL AND TRIM(ms."catatanCdu") != '') THEN ms."nomorSesi" END),
              1
            ) as max_sesi
          FROM "MonitoringSesi" ms
          JOIN "Kelas" k ON ms."kelasId" = k.id
          JOIN "MataKuliah" mk ON k."mataKuliahId" = mk.id
          JOIN "Prodi" p ON mk."prodiId" = p.id
          WHERE k."semesterId" = ${semId} AND p."isActive" = true
          ${prodiCondition}
          GROUP BY ms."kelasId", k."modePembelajaran"
        )
        SELECT 
          cms."modePembelajaran",
          COUNT(*)::int as total_in_range,
          COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND cms."modePembelajaran" != 'BIMBINGAN' THEN 1 END)::int as regular_in_range,
          COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND cms."modePembelajaran" != 'BIMBINGAN' AND (ms.slide = true OR ms."lectureNote" = true) THEN 1 END)::int as sl_in_range,
          COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND cms."modePembelajaran" != 'BIMBINGAN' AND (ms.tugas = true OR ms.kuis = true) THEN 1 END)::int as qt_in_range,
          COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND cms."modePembelajaran" = 'DARING' AND (ms.video = true OR ms.conference = true) THEN 1 END)::int as tv_in_range
        FROM ClassMaxSesi cms
        JOIN "MonitoringSesi" ms ON cms."kelasId" = ms."kelasId"
        WHERE NOT (ms."kehadiran" = 'BELUM_DIISI' AND (ms."catatanCdu" IS NULL OR TRIM(ms."catatanCdu") = '') AND ms."nomorSesi" > cms.max_sesi)
        GROUP BY cms."modePembelajaran";
      `,

      // D. Jumlah kelas perlu perhatian (Alpha >= 2)
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int as count FROM (
          SELECT ms."kelasId"
          FROM "MonitoringSesi" ms
          JOIN "Kelas" k ON ms."kelasId" = k.id
          JOIN "MataKuliah" mk ON k."mataKuliahId" = mk.id
          JOIN "Prodi" p ON mk."prodiId" = p.id
          WHERE k."semesterId" = ${semId} AND p."isActive" = true
          ${prodiCondition}
          AND ms."kehadiran" = 'TIDAK_HADIR'::"Kehadiran"
          GROUP BY ms."kelasId"
          HAVING COUNT(*) >= 2
        ) as sub;
      `,

      // E. 6 Kelas Termonitor Terkini
      prisma.kelas.findMany({
        where: {
          semesterId: semId,
          mataKuliah: {
            prodi: { isActive: true },
            ...(isDosen && userProdiIds.length > 0 ? { prodiId: { in: userProdiIds } } : {}),
          },
        },
        select: {
          id: true,
          kodeKelas: true,
          mataKuliah: { select: { nama: true, sks: true, prodi: { select: { nama: true } } } },
          dosen: { select: { nama: true } },
          dosen2: { select: { nama: true } },
          monitoringSesi: {
            where: { kehadiran: { not: "BELUM_DIISI" } },
            select: { id: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
    ]);

    // Kalkulasi Rekap Kelas
    let totalKelas = 0;
    let kelasOffline = 0;
    let kelasOnline = 0;
    let kelasBimbingan = 0;
    for (const row of classCounts) {
      totalKelas += row.count;
      if (row.modePembelajaran === "LURING") kelasOffline += row.count;
      else if (row.modePembelajaran === "DARING") kelasOnline += row.count;
      else if (row.modePembelajaran === "BIMBINGAN") kelasBimbingan += row.count;
    }
    const totalKelasNonBimbingan = totalKelas - kelasBimbingan;

    // Kalkulasi Presensi & Konten Semester Penuh
    let totalHadir = 0;
    let totalAlpha = 0;
    let totalSesiTerlaksana = 0;
    let totalSemesterKontenScore = 0;
    for (const row of sessionStats) {
      if (row.kehadiran === "HADIR" || row.kehadiran === "HADIR_TIDAK_LENGKAP") {
        totalHadir += row.count;
        totalSesiTerlaksana += row.count;
      } else if (row.kehadiran === "TIDAK_HADIR" || row.kehadiran === "ALPHA") {
        totalAlpha += row.count;
        totalSesiTerlaksana += row.count;
      }
      if (row.nomorSesi !== 8 && row.nomorSesi !== 16 && row.modePembelajaran !== "BIMBINGAN") {
        totalSemesterKontenScore += row.count_sl + row.count_qt;
        if (row.modePembelajaran === "DARING") {
          totalSemesterKontenScore += row.count_tv;
        }
      }
    }

    // Kalkulasi Sesi Berjalan (Opsi B)
    let totalSesiBerjalan = 0;
    let totalSkor3PilarBerjalan = 0;
    let maxSkor3PilarBerjalan = 0;
    for (const row of maxSesiStats) {
      totalSesiBerjalan += row.total_in_range;
      if (row.modePembelajaran !== "BIMBINGAN") {
        const maxPerSesi = row.modePembelajaran === "LURING" ? 2 : 3;
        maxSkor3PilarBerjalan += row.regular_in_range * maxPerSesi;
        totalSkor3PilarBerjalan += row.sl_in_range + row.qt_in_range;
        if (row.modePembelajaran === "DARING") {
          totalSkor3PilarBerjalan += row.tv_in_range;
        }
      }
    }

    const targetSesiBerjalan = totalKelas * currentActiveSesi;
    const avgKehadiranBerjalan = totalSesiBerjalan > 0 ? roundPct(totalHadir, totalSesiBerjalan) : 0;
    const avgKontenBerjalan =
      maxSkor3PilarBerjalan > 0
        ? Math.round((totalSkor3PilarBerjalan / maxSkor3PilarBerjalan) * 1000) / 10
        : 0;
    const persenProgresMonitoringBerjalan =
      targetSesiBerjalan > 0 ? roundPct(totalSesiBerjalan, targetSesiBerjalan) : 0;
    const belumDimonitorSesiBerjalan = Math.max(0, targetSesiBerjalan - totalSesiBerjalan);

    const totalJadwalSesi = totalKelas * 16;
    const avgKehadiranSemester = roundPct(totalHadir, totalJadwalSesi);
    const totalSemesterMaxKontenScore = kelasOffline * 28 + kelasOnline * 42;
    const avgKontenSemester =
      totalSemesterMaxKontenScore > 0
        ? Math.round((totalSemesterKontenScore / totalSemesterMaxKontenScore) * 1000) / 10
        : 0;
    const persenProgresMonitoringSemester = roundPct(totalSesiBerjalan, totalJadwalSesi);
    const belumDimonitorSemester = Math.max(0, totalJadwalSesi - totalSesiBerjalan);

    const kelasPerluPerhatianCount = perhatianResult[0]?.count || 0;

    const countsByMode = {
      ALL: totalKelas,
      LURING: kelasOffline,
      DARING: kelasOnline,
      BIMBINGAN: kelasBimbingan,
    };

    // Kalkulasi Tren Sesi (S1–S16) per Jenis Kelas
    function calculateTrend(mode: "ALL" | "LURING" | "DARING" | "BIMBINGAN"): TrendItem[] {
      const totalKelasInMode = mode === "ALL" ? countsByMode.ALL : countsByMode[mode];
      const nonBimbinganCount =
        mode === "ALL"
          ? countsByMode.LURING + countsByMode.DARING
          : mode === "BIMBINGAN"
          ? 0
          : countsByMode[mode];
      const targetPilarSesi =
        mode === "ALL"
          ? countsByMode.LURING * 2 + countsByMode.DARING * 3
          : mode === "LURING"
          ? countsByMode.LURING * 2
          : mode === "DARING"
          ? countsByMode.DARING * 3
          : 0;

      const filteredRows =
        mode === "ALL"
          ? sessionStats
          : sessionStats.filter((r) => r.modePembelajaran === mode);

      const sesiAgg = Array.from({ length: 16 }, (_, i) => ({
        nomorSesi: i + 1,
        totalHadir: 0,
        totalAlpha: 0,
        totalGantiHari: 0,
        totalBelumDiisi: 0,
        totalSkorPilar: 0,
        totalTerisi: 0,
        totalRegular: 0,
      }));

      for (const r of filteredRows) {
        const idx = r.nomorSesi - 1;
        if (idx < 0 || idx >= 16) continue;
        const isExam = r.nomorSesi === 8 || r.nomorSesi === 16;

        if (r.kehadiran === "HADIR" || r.kehadiran === "HADIR_TIDAK_LENGKAP") {
          sesiAgg[idx].totalHadir += r.count;
          sesiAgg[idx].totalTerisi += r.count;
        } else if (r.kehadiran === "TIDAK_HADIR" || r.kehadiran === "ALPHA") {
          sesiAgg[idx].totalAlpha += r.count;
          sesiAgg[idx].totalTerisi += r.count;
        } else {
          sesiAgg[idx].totalGantiHari += r.count_ganti;
          sesiAgg[idx].totalBelumDiisi += r.count - r.count_ganti;
        }

        if (!isExam && r.modePembelajaran !== "BIMBINGAN") {
          sesiAgg[idx].totalRegular += r.count;
          sesiAgg[idx].totalSkorPilar += r.count_sl + r.count_qt;
          if (r.modePembelajaran === "DARING") {
            sesiAgg[idx].totalSkorPilar += r.count_tv;
          }
        }
      }

      return sesiAgg.map((agg) => {
        const isExam = agg.nomorSesi === 8 || agg.nomorSesi === 16;
        const kehadiran =
          totalKelasInMode > 0 ? roundPct(agg.totalHadir, totalKelasInMode) : 0;
        let konten = 0;
        if (nonBimbinganCount === 0) {
          konten = 0;
        } else if (isExam) {
          konten = kehadiran;
        } else {
          konten =
            targetPilarSesi > 0 ? roundPct(agg.totalSkorPilar, targetPilarSesi) : 0;
        }
        return {
          sesi: agg.nomorSesi === 8 ? "UTS" : agg.nomorSesi === 16 ? "UAS" : `S${agg.nomorSesi}`,
          full:
            agg.nomorSesi === 8
              ? "Sesi 8 (UTS)"
              : agg.nomorSesi === 16
              ? "Sesi 16 (UAS)"
              : `Sesi ${agg.nomorSesi}`,
          kehadiran,
          konten,
          totalKelas: totalKelasInMode,
          totalHadir: agg.totalHadir,
          totalAlpha: agg.totalAlpha,
          totalGantiHari: agg.totalGantiHari,
          totalBelumDiisi: agg.totalBelumDiisi,
          totalNonBimbingan: nonBimbinganCount,
          totalTerisi: agg.totalTerisi,
          totalRegular: agg.totalRegular,
          totalSkorPilar: agg.totalSkorPilar,
        };
      });
    }

    const trendDataByMode: TrendDataByMode = {
      ALL: calculateTrend("ALL"),
      OFFLINE: calculateTrend("LURING"),
      ONLINE: calculateTrend("DARING"),
      BIMBINGAN: calculateTrend("BIMBINGAN"),
    };

    // Kalkulasi Distribusi Donut Chart per Jenis Kelas
    function calculateDistribution(
      mode: "ALL" | "LURING" | "DARING" | "BIMBINGAN"
    ): ModeDistributionData {
      const filtered =
        mode === "ALL"
          ? sessionStats
          : sessionStats.filter((r) => r.modePembelajaran === mode);
      let hLengkap = 0;
      let hTdkLengkap = 0;
      let alphaCount = 0;
      let terlaksana = 0;

      for (const r of filtered) {
        if (r.kehadiran === "HADIR") {
          hLengkap += r.count;
          terlaksana += r.count;
        } else if (r.kehadiran === "HADIR_TIDAK_LENGKAP") {
          hTdkLengkap += r.count;
          terlaksana += r.count;
        } else if (r.kehadiran === "TIDAK_HADIR" || r.kehadiran === "ALPHA") {
          alphaCount += r.count;
          terlaksana += r.count;
        }
      }

      const totalK = mode === "ALL" ? countsByMode.ALL : countsByMode[mode];
      return {
        totalSesi: terlaksana,
        totalKelas: totalK,
        data: [
          {
            name: "Hadir Lengkap",
            value: terlaksana > 0 ? roundPct(hLengkap, terlaksana) : 0,
            count: hLengkap,
            color: "#10b981",
          },
          {
            name: "Hadir Tidak Lengkap",
            value: terlaksana > 0 ? roundPct(hTdkLengkap, terlaksana) : 0,
            count: hTdkLengkap,
            color: "#f59e0b",
          },
          {
            name: "Alpha / Tidak Hadir",
            value: terlaksana > 0 ? roundPct(alphaCount, terlaksana) : 0,
            count: alphaCount,
            color: "#ef4444",
          },
        ],
      };
    }

    const distributionByMode: Record<DonutClassMode, ModeDistributionData> = {
      ALL: calculateDistribution("ALL"),
      OFFLINE: calculateDistribution("LURING"),
      ONLINE: calculateDistribution("DARING"),
      BIMBINGAN: calculateDistribution("BIMBINGAN"),
    };

    const recentClassesList: DashboardClassItem[] = recentClassesRaw.map((cls) => {
      const filledSessions = cls.monitoringSesi.length;
      let status: "LENGKAP" | "SEBAGIAN" | "BELUM" = "BELUM";
      if (filledSessions === 16) status = "LENGKAP";
      else if (filledSessions > 0) status = "SEBAGIAN";

      return {
        id: cls.id,
        kodeKelas: cls.kodeKelas,
        mataKuliah: cls.mataKuliah.nama,
        sks: cls.mataKuliah.sks,
        dosen: cls.dosen.nama,
        dosen2: cls.dosen2?.nama ?? null,
        prodi: cls.mataKuliah.prodi?.nama || "Umum",
        progress: filledSessions,
        status,
      };
    });

    return {
      activeSemester: {
        id: activeSemester.id,
        tahunAkademik: activeSemester.tahunAkademik,
        periode: activeSemester.periode,
        aktif: activeSemester.aktif,
        tanggalMulai: activeSemester.tanggalMulai,
      },
      currentActiveSesi,
      totalKelas,
      totalProdi: prodiCount,
      totalDosen: dosenCount,
      kelasOffline,
      kelasOnline,
      kelasBimbingan,
      kelasPerluPerhatianCount,
      totalAlpha,
      totalHadir,
      totalSesiTerlaksana,
      targetSesiBerjalan,
      totalSesiBerjalan,
      totalJadwalSesi,
      totalKelasNonBimbingan,
      avgKehadiranBerjalan,
      avgKontenBerjalan,
      persenProgresMonitoringBerjalan,
      belumDimonitorSesiBerjalan,
      avgKehadiranSemester,
      avgKontenSemester,
      persenProgresMonitoringSemester,
      belumDimonitorSemester,
      trendData: trendDataByMode.ALL,
      trendDataByMode,
      donutData: distributionByMode.ALL.data,
      distributionByMode,
      recentClassesList,
    };
  })();

  inFlightDashboardRequests.set(cacheKey, fetchTask);
  try {
    const result = await fetchTask;
    dashboardCacheStore.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } finally {
    inFlightDashboardRequests.delete(cacheKey);
  }
}

