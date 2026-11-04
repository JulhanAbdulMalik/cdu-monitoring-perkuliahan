"use server";
// src/actions/monitoring.ts
// Server Actions untuk Grid Monitoring 16 Sesi & Import Excel Edlink

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseEdlinkExcel, ParsedSesiData } from "@/lib/excel-parser";
import {
  calculateClassSummary,
  ClassSummaryResult,
  calculateSessionPillars,
  SessionPillarResult,
} from "@/lib/score-calculator";
import {
  formatTerakhirUpdateParts,
  getCurrentActiveSessionNumber,
  DEFAULT_SEMESTER_START_DATE,
} from "@/lib/utils";
import { auth } from "@/lib/auth";
// PERF: invalidateLaporanCache tidak dipanggil dari aksi monitoring.
// Cache laporan dibiarkan kedaluwarsa secara alami (TTL 30 detik).
// Memanggil invalidateLaporanCache() setiap klik Simpan memaksa server
// menghitung ulang seluruh laporan dari nol — penyebab utama Simpan lambat.

export async function getMonitoringKelasList(semesterId?: string, prodiId?: string) {
  try {
    // Optimasi Waterfall: Ambil allSemesters & allProdi secara paralel
    const [allSemesters, allProdi] = await Promise.all([
      prisma.semester.findMany({
        include: {
          hariLibur: {
            orderBy: { tanggalMulai: "asc" },
          },
        },
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
      }),
      prisma.prodi.findMany({
        where: { isActive: true },
        orderBy: { nama: "asc" },
      }),
    ]);

    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];
    const targetSemesterId = semesterId || activeSemester?.id;

    const kelasList = await prisma.kelas.findMany({
      where: {
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
        ...(prodiId && prodiId !== "ALL" ? { mataKuliah: { prodiId } } : {}),
      },
      select: {
        id: true,
        kodeKelas: true,
        jadwalHari: true,
        jadwalJam: true,
        ruangan: true,
        modePembelajaran: true,
        updatedAt: true,
        semester: {
          select: {
            id: true,
            tahunAkademik: true,
            periode: true,
            tanggalMulai: true,
            hariLibur: {
              select: {
                id: true,
                nama: true,
                tanggalMulai: true,
                tanggalSelesai: true,
                keterangan: true,
              },
              orderBy: { tanggalMulai: "asc" },
            },
          },
        },
        mataKuliah: {
          select: {
            id: true,
            nama: true,
            kode: true,
            sks: true,
            prodi: { select: { id: true, nama: true, kode: true } },
          },
        },
        dosen: {
          select: { id: true, nama: true, nidn: true },
        },
        dosen2: {
          select: { id: true, nama: true, nidn: true },
        },
        monitoringSesi: {
          select: {
            id: true,
            nomorSesi: true,
            kehadiran: true,
            conference: true,
            slide: true,
            tugas: true,
            video: true,
            lectureNote: true,
            kuis: true,
            catatanCdu: true,
            catatanGantiDosen: true,
            statusPengajar: true,
            updatedAt: true,
            dosenPengajar: {
              select: { id: true, nama: true },
            },
          },
          orderBy: { nomorSesi: "asc" },
        },
      },
      orderBy: [{ mataKuliah: { prodi: { nama: "asc" } } }, { kodeKelas: "asc" }, { id: "asc" }],
    });

    return {
      success: true,
      data: {
        kelasList,
        semesters: allSemesters,
        prodiList: allProdi,
        activeSemesterId: activeSemester?.id || allSemesters[0]?.id,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat data monitoring kelas" };
  }
}

export async function getSimpleKelasList(semesterId?: string, prodiId?: string) {
  try {
    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSem = await prisma.semester.findFirst({
        where: { aktif: true },
        select: { id: true },
      });
      targetSemesterId = activeSem?.id;
    }

    const kelasList = await prisma.kelas.findMany({
      where: {
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
        ...(prodiId && prodiId !== "ALL" ? { mataKuliah: { prodiId } } : {}),
      },
      select: {
        id: true,
        kodeKelas: true,
        mataKuliah: {
          select: {
            nama: true,
            kode: true,
            prodi: {
              select: {
                id: true,
                nama: true,
              },
            },
          },
        },
        dosen: {
          select: {
            nama: true,
          },
        },
        dosen2: {
          select: {
            nama: true,
          },
        },
      },
      orderBy: [{ mataKuliah: { prodi: { nama: "asc" } } }, { kodeKelas: "asc" }, { id: "asc" }],
    });

    return {
      success: true,
      data: kelasList,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat daftar kelas" };
  }
}

export interface MonitoringFilterOptions {
  semesters: Array<{
    id: string;
    tahunAkademik: string;
    periode: string;
    aktif: boolean;
    tanggalMulai?: Date | string | null;
    hariLibur?: any[];
  }>;
  prodiList: Array<{
    id: string;
    nama: string;
    kode: string;
  }>;
  activeSemesterId: string;
}

const filterOptionsCacheStore = new Map<string, { data: any; timestamp: number }>();
const FILTER_OPTIONS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 menit

export async function invalidateMonitoringFilterOptionsCache() {
  filterOptionsCacheStore.clear();
}

export async function getMonitoringFilterOptions(allowedProdiIds?: string[]) {
  try {
    let effectiveAllowedProdiIds = allowedProdiIds;
    if (!effectiveAllowedProdiIds) {
      try {
        const session = await auth();
        const userRole = (session?.user as any)?.role;
        const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
        if (userRole === "DOSEN") {
          effectiveAllowedProdiIds = userProdiIds;
        }
      } catch {
        // non-blocking
      }
    }

    const cacheKey = effectiveAllowedProdiIds ? effectiveAllowedProdiIds.slice().sort().join(",") : "ALL";
    const cached = filterOptionsCacheStore.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FILTER_OPTIONS_CACHE_TTL_MS) {
      return { success: true, data: cached.data };
    }

    const [allSemesters, allProdi] = await Promise.all([
      prisma.semester.findMany({
        include: {
          hariLibur: {
            orderBy: { tanggalMulai: "asc" },
          },
        },
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
      }),
      prisma.prodi.findMany({
        where: {
          isActive: true,
          ...(effectiveAllowedProdiIds && effectiveAllowedProdiIds.length > 0 ? { id: { in: effectiveAllowedProdiIds } } : {}),
        },
        orderBy: { nama: "asc" },
      }),
    ]);

    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];

    const resultData = {
      semesters: allSemesters,
      prodiList: allProdi,
      activeSemesterId: activeSemester?.id || allSemesters[0]?.id || "",
    };

    filterOptionsCacheStore.set(cacheKey, { data: resultData, timestamp: Date.now() });

    return {
      success: true,
      data: resultData,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat filter options" };
  }
}

export type MonitoringSortKey =
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
  | "RUANG_ASC"
  | "RUANG_DESC"
  | "KEHADIRAN_DESC"
  | "KEHADIRAN_ASC"
  | "PILAR_DESC"
  | "PILAR_ASC";

export interface MonitoringPaginatedParams {
  semesterId?: string;
  prodiId?: string;
  filterMode?: string;
  filterHari?: string;
  filterStatus?: string;
  monitoringTab?: "ALL" | "BELUM" | "KONTEN" | "SELESAI" | "SUDAH";
  selectedSesi?: number;
  searchQuery?: string;
  sortBy?: MonitoringSortKey;
  page?: number;
  pageSize?: number;
  allowedProdiIds?: string[];
}

export interface MonitoringKelasProcessedItem {
  id: string;
  kodeKelas: string;
  jadwalHari: string | null;
  jadwalJam: string | null;
  ruangan?: string | null;
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
  dosen2?: {
    id: string;
    nama: string;
    nidn: string | null;
  } | null;
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
    statusPengajar?: "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
    catatanGantiDosen?: string | null;
    dosenPengajar?: {
      id: string;
      nama: string;
      nidn?: string | null;
    } | null;
    updatedAt: Date | string;
  }>;
  summary: ClassSummaryResult;
  targetSesiData?: any;
  targetSesiPillars?: SessionPillarResult | null;
  targetSesiNeedsContentCheck?: boolean;
  isMonitored: boolean;
  targetSesiKehadiranLabel: string;
  targetSesiKehadiranColor: string;
  targetSesiIsCatatan?: boolean;
  latestTime: number;
  updateParts: { waktu: string; tanggal: string };
  dosenPengajarList: Array<{ id: string; nama: string; status: string; sesiList: number[] }>;
  isSplitPengajar: boolean;
}

export interface MonitoringPaginatedResponse {
  items: MonitoringKelasProcessedItem[];
  totalCount: number;
  tabCounts: {
    total: number;
    belum: number;
    konten: number;
    selesai: number;
    sudah: number;
  };
  page: number;
  pageSize: number;
  totalPages: number;
  defaultActiveSesi: number;
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
  const parts = jam.split(/[-–—]|(?:s\.d)/i);
  return parts[0]?.trim() || jam.trim();
}

// Proyeksi kolom ramping untuk menghemat kuota transfer jaringan (Network Egress) hingga 80%+
const LEAN_KELAS_SELECT = {
  id: true,
  kodeKelas: true,
  semesterId: true,
  mataKuliahId: true,
  dosenId: true,
  dosen2Id: true,
  jadwalHari: true,
  jadwalJam: true,
  ruangan: true,
  modePembelajaran: true,
  updatedAt: true,
  createdAt: true,
  semester: {
    select: { id: true, tahunAkademik: true, periode: true },
  },
  mataKuliah: {
    select: {
      id: true,
      kode: true,
      nama: true,
      sks: true,
      prodi: { select: { id: true, nama: true, kode: true } },
    },
  },
  dosen: {
    select: { id: true, nama: true, nidn: true },
  },
  dosen2: {
    select: { id: true, nama: true, nidn: true },
  },
  monitoringSesi: {
    select: {
      id: true,
      nomorSesi: true,
      kehadiran: true,
      conference: true,
      slide: true,
      tugas: true,
      video: true,
      lectureNote: true,
      kuis: true,
      catatanCdu: true,
      catatanGantiDosen: true,
      statusPengajar: true,
      updatedAt: true,
      dosenPengajar: {
        select: { id: true, nama: true },
      },
    },
    orderBy: { nomorSesi: "asc" as const },
  },
};

/**
 * Helper terpusat untuk menentukan apakah suatu sesi perkuliahan memerlukan pemeriksaan konten (Tab "Perlu Cek Konten"):
 * - Sesi bukan UTS (8) atau UAS (16)
 * - Mode pembelajaran bukan BIMBINGAN
 * - Presensi dosen sudah diisi HADIR
 * - Belum ada catatan dari admin / CDU (catatanCdu / catatan)
 * - Skor 3 pilar pada sesi tersebut adalah 0 (konten kosong sesuai aturan mode pembelajaran)
 */
function isSessionNeedsContentCheck(
  sesi: {
    nomorSesi: number;
    kehadiran?: string | null;
    catatanCdu?: string | null;
    catatan?: string | null;
    lectureNote?: boolean | null;
    slide?: boolean | null;
    video?: boolean | null;
    conference?: boolean | null;
    tugas?: boolean | null;
    kuis?: boolean | null;
  } | null | undefined,
  modePembelajaran: string
): boolean {
  if (!sesi) return false;
  const isExam = sesi.nomorSesi === 8 || sesi.nomorSesi === 16;
  if (isExam || modePembelajaran === "BIMBINGAN") return false;

  const rawCatatan = (sesi.catatanCdu ?? sesi.catatan ?? "").trim();
  if (rawCatatan.length > 0) return false;

  if (sesi.kehadiran !== "HADIR") return false;

  const pillars = calculateSessionPillars(sesi, modePembelajaran as any);
  return pillars.score === 0;
}

/**
 * Membangun kondisi WHERE Prisma untuk filter Tab Antrean Kerja (Workflow Pipeline):
 * - BELUM: Presensi BELUM_DIISI dan belum ada catatan CDU
 * - KONTEN: Bukan bimbingan & bukan UTS/UAS, presensi HADIR, catatan CDU kosong, dan seluruh 3 pilar bernilai false (0 skor)
 * - SELESAI / SUDAH: Kelas yang sudah dimonitor dan tidak masuk antrean pemeriksaan konten
 */
function buildMonitoringTabWhere(
  monitoringTab: string | undefined,
  currentSesi: number
): any {
  const isExam = currentSesi === 8 || currentSesi === 16;
  if (!monitoringTab || monitoringTab === "ALL") return null;

  if (monitoringTab === "BELUM") {
    return {
      monitoringSesi: {
        some: {
          nomorSesi: currentSesi,
          kehadiran: "BELUM_DIISI" as any,
          AND: [{ OR: [{ catatanCdu: null }, { catatanCdu: "" }] }],
        },
      },
    };
  }

  if (monitoringTab === "KONTEN") {
    if (isExam) {
      return { id: "__NO_MATCH__" };
    }
    return {
      modePembelajaran: { not: "BIMBINGAN" as any },
      OR: [
        {
          modePembelajaran: "LURING" as any,
          monitoringSesi: {
            some: {
              nomorSesi: currentSesi,
              kehadiran: "HADIR" as any,
              AND: [{ OR: [{ catatanCdu: null }, { catatanCdu: "" }] }],
              slide: { not: true },
              lectureNote: { not: true },
              tugas: { not: true },
              kuis: { not: true },
            },
          },
        },
        {
          modePembelajaran: "DARING" as any,
          monitoringSesi: {
            some: {
              nomorSesi: currentSesi,
              kehadiran: "HADIR" as any,
              AND: [{ OR: [{ catatanCdu: null }, { catatanCdu: "" }] }],
              slide: { not: true },
              lectureNote: { not: true },
              tugas: { not: true },
              kuis: { not: true },
              video: { not: true },
              conference: { not: true },
            },
          },
        },
      ],
    };
  }

  if (monitoringTab === "SELESAI" || monitoringTab === "SUDAH") {
    return {
      OR: [
        {
          monitoringSesi: {
            some: {
              nomorSesi: currentSesi,
              catatanCdu: { not: null },
              NOT: [{ catatanCdu: "" }],
            },
          },
        },
        {
          monitoringSesi: {
            some: {
              nomorSesi: currentSesi,
              kehadiran: { in: ["TIDAK_HADIR" as any, "HADIR_TIDAK_LENGKAP" as any] },
            },
          },
        },
        {
          modePembelajaran: "BIMBINGAN" as any,
          monitoringSesi: {
            some: {
              nomorSesi: currentSesi,
              kehadiran: { not: "BELUM_DIISI" as any },
            },
          },
        },
        {
          modePembelajaran: "LURING" as any,
          monitoringSesi: {
            some: {
              nomorSesi: currentSesi,
              kehadiran: "HADIR" as any,
              OR: [
                { slide: true },
                { lectureNote: true },
                { tugas: true },
                { kuis: true },
              ],
            },
          },
        },
        {
          modePembelajaran: "DARING" as any,
          monitoringSesi: {
            some: {
              nomorSesi: currentSesi,
              kehadiran: "HADIR" as any,
              OR: [
                { slide: true },
                { lectureNote: true },
                { tugas: true },
                { kuis: true },
                { video: true },
                { conference: true },
              ],
            },
          },
        },
      ],
    };
  }

  return null;
}

function buildStatusWhere(filterStatus: string | undefined, currentSesi: number): any {
  if (!filterStatus || filterStatus === "ALL") return null;
  if (filterStatus === "HADIR") {
    return { monitoringSesi: { some: { nomorSesi: currentSesi, kehadiran: "HADIR" as any } } };
  }
  if (filterStatus === "HTL") {
    return { monitoringSesi: { some: { nomorSesi: currentSesi, kehadiran: "HADIR_TIDAK_LENGKAP" as any } } };
  }
  if (filterStatus === "ALPHA") {
    return { monitoringSesi: { some: { nomorSesi: currentSesi, kehadiran: "TIDAK_HADIR" as any } } };
  }
  if (filterStatus === "BELUM_DIISI") {
    return { monitoringSesi: { some: { nomorSesi: currentSesi, kehadiran: "BELUM_DIISI" as any } } };
  }
  return null;
}

function mapClassToProcessedItem(
  cls: any,
  currentSesi: number,
  defaultActiveSesi: number
): MonitoringKelasProcessedItem {
  const summary = calculateClassSummary(cls.monitoringSesi as any, cls.modePembelajaran, defaultActiveSesi);

  const targetSesiData = cls.monitoringSesi.find((s: any) => s.nomorSesi === currentSesi);
  const rawCatatan = (targetSesiData?.catatanCdu ?? targetSesiData?.catatan ?? "").trim();
  const hasCatatan = rawCatatan !== "";
  const isMonitored = targetSesiData ? (targetSesiData.kehadiran !== "BELUM_DIISI" || hasCatatan) : false;
  let targetSesiKehadiranLabel = "Belum Dicek";
  let targetSesiKehadiranColor = "bg-rose-50 text-rose-700 border-rose-200";
  let targetSesiIsCatatan = false;

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
    } else if (hasCatatan) {
      targetSesiKehadiranLabel = rawCatatan;
      // Warna kuning seperti status ganti hari pada halaman /monitoring/[id]
      targetSesiKehadiranColor = "border-amber-400 bg-amber-50 text-amber-900 font-bold";
      targetSesiIsCatatan = true;
    }
  }

  let latestTime = new Date(cls.updatedAt).getTime();
  cls.monitoringSesi.forEach((s: any) => {
    const sTime = new Date(s.updatedAt).getTime();
    if (sTime > latestTime) latestTime = sTime;
  });

  const updateParts = formatTerakhirUpdateParts(new Date(latestTime));

  const peranMap = new Map<string, { id: string; nama: string; status: string; sesiList: number[] }>();
  cls.monitoringSesi.forEach((s: any) => {
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
  const targetSesiPillars = targetSesiData ? calculateSessionPillars(targetSesiData, cls.modePembelajaran) : null;
  const isExam = currentSesi === 8 || currentSesi === 16;
  const isBimbingan = cls.modePembelajaran === "BIMBINGAN";
  // Menandai kelas yang sudah diisi presensi HADIR tetapi bukti konten 3 pilar pada sesi tersebut masih 0 dan belum ada catatan admin
  const targetSesiNeedsContentCheck = isSessionNeedsContentCheck(targetSesiData, cls.modePembelajaran);

  return {
    ...cls,
    summary,
    targetSesiData,
    targetSesiPillars,
    targetSesiNeedsContentCheck,
    isMonitored,
    targetSesiKehadiranLabel,
    targetSesiKehadiranColor,
    targetSesiIsCatatan,
    latestTime,
    updateParts,
    dosenPengajarList,
    isSplitPengajar,
  };
}

export async function getMonitoringKelasPaginated(params: MonitoringPaginatedParams = {}) {
  try {
    let effectiveAllowedProdiIds = params.allowedProdiIds;
    if (!effectiveAllowedProdiIds) {
      try {
        const session = await auth();
        const userRole = (session?.user as any)?.role;
        const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
        if (userRole === "DOSEN") {
          effectiveAllowedProdiIds = userProdiIds;
        }
      } catch {
        // non-blocking
      }
    }

    let targetSemester: any = null;
    if (params.semesterId) {
      targetSemester = await prisma.semester.findUnique({
        where: { id: params.semesterId },
        include: {
          hariLibur: { orderBy: { tanggalMulai: "asc" } },
        },
      });
    }

    if (!targetSemester) {
      targetSemester = await prisma.semester.findFirst({
        where: { aktif: true },
        include: {
          hariLibur: { orderBy: { tanggalMulai: "asc" } },
        },
      });
    }

    if (!targetSemester) {
      targetSemester = await prisma.semester.findFirst({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
        include: {
          hariLibur: { orderBy: { tanggalMulai: "asc" } },
        },
      });
    }

    const targetSemesterId = targetSemester?.id;
    const semStartStr = targetSemester?.tanggalMulai
      ? new Date(targetSemester.tanggalMulai).toISOString().split("T")[0]
      : DEFAULT_SEMESTER_START_DATE;
    const defaultActiveSesi = getCurrentActiveSessionNumber(semStartStr, targetSemester?.hariLibur);
    const currentSesi =
      params.selectedSesi && params.selectedSesi >= 1 && params.selectedSesi <= 16
        ? params.selectedSesi
        : defaultActiveSesi;

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(1000, params.pageSize || 20));

    const baseWhere: any = {};
    if (targetSemesterId) {
      baseWhere.semesterId = targetSemesterId;
    }

    if (effectiveAllowedProdiIds && effectiveAllowedProdiIds.length > 0) {
      if (params.prodiId && params.prodiId !== "ALL" && effectiveAllowedProdiIds.includes(params.prodiId)) {
        baseWhere.mataKuliah = { prodiId: params.prodiId };
      } else {
        baseWhere.mataKuliah = { prodiId: { in: effectiveAllowedProdiIds } };
      }
    } else if (params.prodiId && params.prodiId !== "ALL") {
      baseWhere.mataKuliah = { prodiId: params.prodiId };
    }

    if (params.filterMode && params.filterMode !== "ALL") {
      baseWhere.modePembelajaran = params.filterMode;
    }

    if (params.filterHari && params.filterHari !== "ALL") {
      baseWhere.jadwalHari = { equals: params.filterHari, mode: "insensitive" };
    }

    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.trim();
      baseWhere.OR = [
        { kodeKelas: { contains: q, mode: "insensitive" } },
        { mataKuliah: { nama: { contains: q, mode: "insensitive" } } },
        { mataKuliah: { kode: { contains: q, mode: "insensitive" } } },
        { dosen: { nama: { contains: q, mode: "insensitive" } } },
        { dosen2: { nama: { contains: q, mode: "insensitive" } } },
        {
          monitoringSesi: {
            some: {
              dosenPengajar: {
                nama: { contains: q, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    const isExam = currentSesi === 8 || currentSesi === 16;
    const isBimbinganOnly = params.filterMode === "BIMBINGAN";

    const sort = params.sortBy || "TERBARU";
    // 1. Hitung seluruh tab counts langsung di database (Single Source of Truth, paralel cepat)
    const [totalInBase, belumDimonitorCount, perluCekKontenCount] = await Promise.all([
      prisma.kelas.count({ where: baseWhere }),
      prisma.kelas.count({
        where: {
          ...baseWhere,
          monitoringSesi: {
            some: {
              nomorSesi: currentSesi,
              kehadiran: "BELUM_DIISI",
              AND: [{ OR: [{ catatanCdu: null }, { catatanCdu: "" }] }],
            },
          },
        },
      }),
      (isExam || isBimbinganOnly)
        ? Promise.resolve(0)
        : prisma.kelas.count({
            where: {
              ...baseWhere,
              modePembelajaran: { not: "BIMBINGAN" },
              OR: [
                {
                  modePembelajaran: "LURING",
                  monitoringSesi: {
                    some: {
                      nomorSesi: currentSesi,
                      kehadiran: "HADIR",
                      AND: [{ OR: [{ catatanCdu: null }, { catatanCdu: "" }] }],
                      slide: { not: true },
                      lectureNote: { not: true },
                      tugas: { not: true },
                      kuis: { not: true },
                    },
                  },
                },
                {
                  modePembelajaran: "DARING",
                  monitoringSesi: {
                    some: {
                      nomorSesi: currentSesi,
                      kehadiran: "HADIR",
                      AND: [{ OR: [{ catatanCdu: null }, { catatanCdu: "" }] }],
                      slide: { not: true },
                      lectureNote: { not: true },
                      tugas: { not: true },
                      kuis: { not: true },
                      video: { not: true },
                      conference: { not: true },
                    },
                  },
                },
              ],
            },
          }),
    ]);

    const selesaiDimonitorCount = Math.max(0, totalInBase - belumDimonitorCount - perluCekKontenCount);

    // 2. Bangun targetWhere di database untuk tab dan status
    const tabWhere = buildMonitoringTabWhere(params.monitoringTab, currentSesi);
    const statusWhere = buildStatusWhere(params.filterStatus, currentSesi);

    const conditions: any[] = [];
    if (tabWhere) conditions.push(tabWhere);
    if (statusWhere) conditions.push(statusWhere);

    const targetWhere = conditions.length > 0 ? { AND: [baseWhere, ...conditions] } : baseWhere;

    // Tentukan totalFiltered untuk paginasi (instan tanpa query tambahan jika hanya ganti tab)
    let totalFiltered = totalInBase;
    if (params.monitoringTab === "BELUM" && (!params.filterStatus || params.filterStatus === "ALL")) {
      totalFiltered = belumDimonitorCount;
    } else if (params.monitoringTab === "KONTEN" && (!params.filterStatus || params.filterStatus === "ALL")) {
      totalFiltered = perluCekKontenCount;
    } else if ((params.monitoringTab === "SELESAI" || params.monitoringTab === "SUDAH") && (!params.filterStatus || params.filterStatus === "ALL")) {
      totalFiltered = selesaiDimonitorCount;
    } else if (conditions.length > 0) {
      totalFiltered = await prisma.kelas.count({ where: targetWhere });
    }

    let rawClasses: any[] = [];

    // 3. Paginasi & Pengurutan Cepat
    if (sort === "JADWAL_ASC" || sort === "JADWAL_DESC") {
      const lightweightRows = await prisma.kelas.findMany({
        where: targetWhere,
        select: { id: true, jadwalHari: true, jadwalJam: true },
      });

      lightweightRows.sort((a, b) => {
        const dayDiff = getDayWeight(a.jadwalHari) - getDayWeight(b.jadwalHari);
        if (dayDiff !== 0) return sort === "JADWAL_ASC" ? dayDiff : -dayDiff;
        const ja = getJamStart(a.jadwalJam);
        const jb = getJamStart(b.jadwalJam);
        const jamDiff = sort === "JADWAL_ASC" ? ja.localeCompare(jb) : jb.localeCompare(ja);
        if (jamDiff !== 0) return jamDiff;
        return a.id.localeCompare(b.id);
      });

      const pageIds = lightweightRows.slice((page - 1) * pageSize, page * pageSize).map((r) => r.id);
      if (pageIds.length > 0) {
        const fetched = await prisma.kelas.findMany({
          where: { id: { in: pageIds } },
          select: LEAN_KELAS_SELECT,
        });
        const map = new Map(fetched.map((f) => [f.id, f]));
        rawClasses = pageIds.map((id) => map.get(id)).filter(Boolean) as any[];
      }
    } else if (sort === "KEHADIRAN_DESC" || sort === "KEHADIRAN_ASC" || sort === "PILAR_DESC" || sort === "PILAR_ASC") {
      // Optimasi Two-Pass: Hanya ambil data minimal untuk skor, hitung urutan, dan ambil baris lengkap halaman ini
      const lightweightRows = await prisma.kelas.findMany({
        where: targetWhere,
        select: {
          id: true,
          modePembelajaran: true,
          monitoringSesi: {
            select: {
              nomorSesi: true,
              kehadiran: true,
              slide: true,
              lectureNote: true,
              tugas: true,
              kuis: true,
              video: true,
              conference: true,
            },
          },
        },
      });

      const scored = lightweightRows.map((cls) => {
        const summary = calculateClassSummary(cls.monitoringSesi as any, cls.modePembelajaran as any);
        return {
          id: cls.id,
          persenKehadiran: summary.persenKehadiran,
          totalSkor3Pilar: summary.totalSkor3Pilar,
        };
      });

      if (sort === "KEHADIRAN_DESC") {
        scored.sort((a, b) => (b.persenKehadiran - a.persenKehadiran) || a.id.localeCompare(b.id));
      } else if (sort === "KEHADIRAN_ASC") {
        scored.sort((a, b) => (a.persenKehadiran - b.persenKehadiran) || a.id.localeCompare(b.id));
      } else if (sort === "PILAR_DESC") {
        scored.sort((a, b) => (b.totalSkor3Pilar - a.totalSkor3Pilar) || a.id.localeCompare(b.id));
      } else if (sort === "PILAR_ASC") {
        scored.sort((a, b) => (a.totalSkor3Pilar - b.totalSkor3Pilar) || a.id.localeCompare(b.id));
      }

      const pageIds = scored.slice((page - 1) * pageSize, page * pageSize).map((r) => r.id);
      if (pageIds.length > 0) {
        const fetched = await prisma.kelas.findMany({
          where: { id: { in: pageIds } },
          select: LEAN_KELAS_SELECT,
        });
        const map = new Map(fetched.map((f) => [f.id, f]));
        rawClasses = pageIds.map((id) => map.get(id)).filter(Boolean) as any[];
      }
    } else {
      let orderBy: any = [{ updatedAt: "desc" }, { id: "asc" }];
      if (sort === "TERBARU") orderBy = [{ updatedAt: "desc" }, { id: "asc" }];
      else if (sort === "TERLAMA") orderBy = [{ updatedAt: "asc" }, { id: "asc" }];
      else if (sort === "KODE_ASC") orderBy = [{ kodeKelas: "asc" }, { id: "asc" }];
      else if (sort === "KODE_DESC") orderBy = [{ kodeKelas: "desc" }, { id: "asc" }];
      else if (sort === "MK_ASC") orderBy = [{ mataKuliah: { nama: "asc" } }, { id: "asc" }];
      else if (sort === "MK_DESC") orderBy = [{ mataKuliah: { nama: "desc" } }, { id: "asc" }];
      else if (sort === "DOSEN_ASC") orderBy = [{ dosen: { nama: "asc" } }, { id: "asc" }];
      else if (sort === "DOSEN_DESC") orderBy = [{ dosen: { nama: "desc" } }, { id: "asc" }];
      else if (sort === "RUANG_ASC") orderBy = [{ ruangan: "asc" }, { id: "asc" }];
      else if (sort === "RUANG_DESC") orderBy = [{ ruangan: "desc" }, { id: "asc" }];

      // NATIVE DATABASE PAGINATION: Hanya ambil baris yang dibutuhkan halaman ini
      rawClasses = await prisma.kelas.findMany({
        where: targetWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        select: LEAN_KELAS_SELECT,
      });
    }

    const paginated = rawClasses.map((cls) => mapClassToProcessedItem(cls, currentSesi, defaultActiveSesi));

    return {
      success: true,
      data: {
        items: paginated,
        totalCount: totalFiltered,
        tabCounts: {
          total: totalInBase,
          belum: belumDimonitorCount,
          konten: perluCekKontenCount,
          selesai: selesaiDimonitorCount,
          sudah: selesaiDimonitorCount,
        },
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalFiltered / pageSize)),
        defaultActiveSesi,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat monitoring kelas paginasi" };
  }
}

export interface SequentialKelasFilterParams {
  semesterId?: string;
  prodiId?: string;
  filterMode?: string;
  filterHari?: string;
  filterStatus?: string;
  monitoringTab?: "ALL" | "BELUM" | "KONTEN" | "SELESAI" | "SUDAH";
  selectedSesi?: number;
  searchQuery?: string;
  sortBy?: MonitoringSortKey;
  allowedProdiIds?: string[];
  currentKelasId?: string;
}

// In-memory cache untuk antrean sequential kelas agar transisi "Simpan & Lanjut" instan (0.1 ms)
const sequentialListCacheStore = new Map<string, { data: any[]; timestamp: number }>();
const SEQUENTIAL_CACHE_TTL_MS = 60 * 1000; // 60 detik

export async function invalidateSequentialListCache() {
  sequentialListCacheStore.clear();
}

export async function getFilteredSequentialKelasList(params: SequentialKelasFilterParams = {}) {
  try {
    let effectiveAllowedProdiIds = params.allowedProdiIds;
    if (!effectiveAllowedProdiIds) {
      try {
        const session = await auth();
        const userRole = (session?.user as any)?.role;
        const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
        if (userRole === "DOSEN") {
          effectiveAllowedProdiIds = userProdiIds;
        }
      } catch {
        // non-blocking
      }
    }

    const cacheKey = [
      params.semesterId || "def",
      params.prodiId || "ALL",
      params.filterMode || "ALL",
      params.filterHari || "ALL",
      params.filterStatus || "ALL",
      params.monitoringTab || "ALL",
      params.selectedSesi || 0,
      params.searchQuery || "",
      params.sortBy || "TERBARU",
      effectiveAllowedProdiIds ? effectiveAllowedProdiIds.slice().sort().join(",") : "ALL",
    ].join("::");

    const cached = sequentialListCacheStore.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEQUENTIAL_CACHE_TTL_MS) {
      const list = cached.data;
      if (!params.currentKelasId || list.some((k) => k.id === params.currentKelasId)) {
        return { success: true, data: list };
      }
    }

    let targetSemester: any = null;
    if (params.semesterId) {
      targetSemester = await prisma.semester.findUnique({
        where: { id: params.semesterId },
        include: {
          hariLibur: { orderBy: { tanggalMulai: "asc" } },
        },
      });
    }

    if (!targetSemester) {
      targetSemester = await prisma.semester.findFirst({
        where: { aktif: true },
        include: {
          hariLibur: { orderBy: { tanggalMulai: "asc" } },
        },
      });
    }

    if (!targetSemester) {
      targetSemester = await prisma.semester.findFirst({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
        include: {
          hariLibur: { orderBy: { tanggalMulai: "asc" } },
        },
      });
    }

    const targetSemesterId = targetSemester?.id;
    const semStartStr = targetSemester?.tanggalMulai
      ? new Date(targetSemester.tanggalMulai).toISOString().split("T")[0]
      : DEFAULT_SEMESTER_START_DATE;
    const defaultActiveSesi = getCurrentActiveSessionNumber(semStartStr, targetSemester?.hariLibur);
    const currentSesi =
      params.selectedSesi && params.selectedSesi >= 1 && params.selectedSesi <= 16
        ? params.selectedSesi
        : defaultActiveSesi;

    const baseWhere: any = {};
    if (targetSemesterId) {
      baseWhere.semesterId = targetSemesterId;
    }

    if (effectiveAllowedProdiIds && effectiveAllowedProdiIds.length > 0) {
      if (params.prodiId && params.prodiId !== "ALL" && effectiveAllowedProdiIds.includes(params.prodiId)) {
        baseWhere.mataKuliah = { prodiId: params.prodiId };
      } else {
        baseWhere.mataKuliah = { prodiId: { in: effectiveAllowedProdiIds } };
      }
    } else if (params.prodiId && params.prodiId !== "ALL") {
      baseWhere.mataKuliah = { prodiId: params.prodiId };
    }

    if (params.filterMode && params.filterMode !== "ALL") {
      baseWhere.modePembelajaran = params.filterMode;
    }

    if (params.filterHari && params.filterHari !== "ALL") {
      baseWhere.jadwalHari = { equals: params.filterHari, mode: "insensitive" };
    }

    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.trim();
      baseWhere.OR = [
        { kodeKelas: { contains: q, mode: "insensitive" } },
        { mataKuliah: { nama: { contains: q, mode: "insensitive" } } },
        { mataKuliah: { kode: { contains: q, mode: "insensitive" } } },
        { dosen: { nama: { contains: q, mode: "insensitive" } } },
        { dosen2: { nama: { contains: q, mode: "insensitive" } } },
        {
          monitoringSesi: {
            some: {
              dosenPengajar: {
                nama: { contains: q, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    const sort = params.sortBy || "TERBARU";
    const isCustomSortOrFilter =
      params.monitoringTab !== "ALL" ||
      Boolean(params.filterStatus && params.filterStatus !== "ALL") ||
      sort === "KEHADIRAN_DESC" ||
      sort === "KEHADIRAN_ASC" ||
      sort === "PILAR_DESC" ||
      sort === "PILAR_ASC" ||
      sort === "JADWAL_ASC" ||
      sort === "JADWAL_DESC";

    let resultList: Array<{
      id: string;
      kodeKelas: string;
      mataKuliah: { nama: string; kode: string; prodi?: { id: string; nama: string } };
      dosen: { nama: string };
      dosen2?: { nama: string } | null;
      jadwalHari?: string | null;
      jadwalJam?: string | null;
    }> = [];

    // Bangun kondisi tab & status di database
    const tabWhere = buildMonitoringTabWhere(params.monitoringTab, currentSesi);
    const statusWhere = buildStatusWhere(params.filterStatus, currentSesi);

    const conditions: any[] = [];
    if (tabWhere) conditions.push(tabWhere);
    if (statusWhere) conditions.push(statusWhere);

    let seqTargetWhere = baseWhere;
    if (conditions.length > 0) {
      seqTargetWhere = params.currentKelasId
        ? { AND: [baseWhere, { OR: [{ id: params.currentKelasId }, { AND: conditions }] }] }
        : { AND: [baseWhere, ...conditions] };
    }

    const SIMPLE_KELAS_SELECT = {
      id: true,
      kodeKelas: true,
      jadwalHari: true,
      jadwalJam: true,
      mataKuliah: {
        select: {
          nama: true,
          kode: true,
          prodi: { select: { id: true, nama: true } },
        },
      },
      dosen: { select: { nama: true } },
      dosen2: { select: { nama: true } },
    };

    if (sort === "KEHADIRAN_DESC" || sort === "KEHADIRAN_ASC" || sort === "PILAR_DESC" || sort === "PILAR_ASC") {
      const allMatching = await prisma.kelas.findMany({
        where: seqTargetWhere,
        select: {
          ...SIMPLE_KELAS_SELECT,
          modePembelajaran: true,
          monitoringSesi: {
            select: {
              nomorSesi: true,
              kehadiran: true,
              slide: true,
              lectureNote: true,
              tugas: true,
              kuis: true,
              video: true,
              conference: true,
            },
          },
        },
      });
      const processed = allMatching.map((cls) => {
        const summary = calculateClassSummary(cls.monitoringSesi as any, cls.modePembelajaran as any);
        return {
          cls,
          persenKehadiran: summary.persenKehadiran,
          totalSkor3Pilar: summary.totalSkor3Pilar,
        };
      });
      if (sort === "KEHADIRAN_DESC") processed.sort((a, b) => (b.persenKehadiran - a.persenKehadiran) || a.cls.id.localeCompare(b.cls.id));
      else if (sort === "KEHADIRAN_ASC") processed.sort((a, b) => (a.persenKehadiran - b.persenKehadiran) || a.cls.id.localeCompare(b.cls.id));
      else if (sort === "PILAR_DESC") processed.sort((a, b) => (b.totalSkor3Pilar - a.totalSkor3Pilar) || a.cls.id.localeCompare(b.cls.id));
      else if (sort === "PILAR_ASC") processed.sort((a, b) => (a.totalSkor3Pilar - b.totalSkor3Pilar) || a.cls.id.localeCompare(b.cls.id));
      resultList = processed.map(({ cls: c }) => ({
        id: c.id,
        kodeKelas: c.kodeKelas,
        mataKuliah: {
          nama: c.mataKuliah.nama,
          kode: c.mataKuliah.kode,
          prodi: c.mataKuliah.prodi ? { id: c.mataKuliah.prodi.id, nama: c.mataKuliah.prodi.nama } : undefined,
        },
        dosen: { nama: c.dosen.nama },
        dosen2: c.dosen2 ? { nama: c.dosen2.nama } : null,
        jadwalHari: c.jadwalHari,
        jadwalJam: c.jadwalJam,
      }));
    } else if (sort === "JADWAL_ASC" || sort === "JADWAL_DESC") {
      const rawClasses = await prisma.kelas.findMany({
        where: seqTargetWhere,
        select: SIMPLE_KELAS_SELECT,
      });
      rawClasses.sort((a, b) => {
        const dayDiff = getDayWeight(a.jadwalHari) - getDayWeight(b.jadwalHari);
        if (dayDiff !== 0) return sort === "JADWAL_ASC" ? dayDiff : -dayDiff;
        const ja = getJamStart(a.jadwalJam);
        const jb = getJamStart(b.jadwalJam);
        const jamDiff = sort === "JADWAL_ASC" ? ja.localeCompare(jb) : jb.localeCompare(ja);
        if (jamDiff !== 0) return jamDiff;
        return a.id.localeCompare(b.id);
      });
      resultList = rawClasses.map((c) => ({
        id: c.id,
        kodeKelas: c.kodeKelas,
        mataKuliah: {
          nama: c.mataKuliah.nama,
          kode: c.mataKuliah.kode,
          prodi: c.mataKuliah.prodi ? { id: c.mataKuliah.prodi.id, nama: c.mataKuliah.prodi.nama } : undefined,
        },
        dosen: { nama: c.dosen.nama },
        dosen2: c.dosen2 ? { nama: c.dosen2.nama } : null,
        jadwalHari: c.jadwalHari,
        jadwalJam: c.jadwalJam,
      }));
    } else {
      let orderBy: any = [{ updatedAt: "desc" }, { id: "asc" }];
      if (sort === "TERBARU") orderBy = [{ updatedAt: "desc" }, { id: "asc" }];
      else if (sort === "TERLAMA") orderBy = [{ updatedAt: "asc" }, { id: "asc" }];
      else if (sort === "KODE_ASC") orderBy = [{ kodeKelas: "asc" }, { id: "asc" }];
      else if (sort === "KODE_DESC") orderBy = [{ kodeKelas: "desc" }, { id: "asc" }];
      else if (sort === "MK_ASC") orderBy = [{ mataKuliah: { nama: "asc" } }, { id: "asc" }];
      else if (sort === "MK_DESC") orderBy = [{ mataKuliah: { nama: "desc" } }, { id: "asc" }];
      else if (sort === "DOSEN_ASC") orderBy = [{ dosen: { nama: "asc" } }, { id: "asc" }];
      else if (sort === "DOSEN_DESC") orderBy = [{ dosen: { nama: "desc" } }, { id: "asc" }];
      else if (sort === "RUANG_ASC") orderBy = [{ ruangan: "asc" }, { id: "asc" }];
      else if (sort === "RUANG_DESC") orderBy = [{ ruangan: "desc" }, { id: "asc" }];

      const rawClasses = await prisma.kelas.findMany({
        where: seqTargetWhere,
        orderBy,
        select: SIMPLE_KELAS_SELECT,
      });

      resultList = rawClasses.map((c) => ({
        id: c.id,
        kodeKelas: c.kodeKelas,
        mataKuliah: {
          nama: c.mataKuliah.nama,
          kode: c.mataKuliah.kode,
          prodi: c.mataKuliah.prodi ? { id: c.mataKuliah.prodi.id, nama: c.mataKuliah.prodi.nama } : undefined,
        },
        dosen: { nama: c.dosen.nama },
        dosen2: c.dosen2 ? { nama: c.dosen2.nama } : null,
        jadwalHari: c.jadwalHari,
        jadwalJam: c.jadwalJam,
      }));
    }

    // Safety fallback: pastikan currentKelasId tetap ada di daftar jika disediakan
    if (params.currentKelasId && !resultList.some((k) => k.id === params.currentKelasId)) {
      const currentK = await prisma.kelas.findUnique({
        where: { id: params.currentKelasId },
        select: {
          id: true,
          kodeKelas: true,
          jadwalHari: true,
          jadwalJam: true,
          mataKuliah: {
            select: {
              nama: true,
              kode: true,
              prodi: { select: { id: true, nama: true } },
            },
          },
          dosen: { select: { nama: true } },
          dosen2: { select: { nama: true } },
        },
      });
      if (currentK) {
        resultList.push({
          id: currentK.id,
          kodeKelas: currentK.kodeKelas,
          jadwalHari: currentK.jadwalHari,
          jadwalJam: currentK.jadwalJam,
          mataKuliah: currentK.mataKuliah,
          dosen: currentK.dosen,
          dosen2: currentK.dosen2 ? { nama: currentK.dosen2.nama } : null,
        });
      }
    }

    sequentialListCacheStore.set(cacheKey, { data: resultList, timestamp: Date.now() });

    return {
      success: true,
      data: resultList,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal memuat daftar kelas sekuensial",
      data: [],
    };
  }
}

let cachedDosenList: any[] | null = null;
let cachedDosenTimestamp = 0;
const DOSEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

async function getCachedDosenList() {
  if (cachedDosenList && Date.now() - cachedDosenTimestamp < DOSEN_CACHE_TTL_MS) {
    return cachedDosenList;
  }
  const allDosen = await prisma.dosen.findMany({
    select: {
      id: true,
      nama: true,
      nidn: true,
      prodi: {
        select: {
          id: true,
          nama: true,
          kode: true,
        },
      },
    },
    orderBy: { nama: "asc" },
  });
  cachedDosenList = allDosen;
  cachedDosenTimestamp = Date.now();
  return allDosen;
}

/**
 * Server Action khusus untuk memuat daftar seluruh dosen secara on-demand / lazy.
 * Hanya dipanggil saat admin membuka modal "Ganti Dosen", sehingga halaman kelas tidak perlu memuat ratusan dosen di awal.
 */
export async function getDosenOptionsAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const allDosen = await getCachedDosenList();
    return { success: true, data: allDosen };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat daftar dosen" };
  }
}

export async function getMonitoringKelasDetail(kelasId: string) {
  try {
    // Lean Payload: Hanya ambil data kelas, dosen pengampu, dan 16 sesi monitoring (tanpa mengirim seluruh dosen universitas)
    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      select: {
        id: true,
        kodeKelas: true,
        semesterId: true,
        mataKuliahId: true,
        dosenId: true,
        dosen2Id: true,
        jadwalHari: true,
        jadwalJam: true,
        ruangan: true,
        modePembelajaran: true,
        edlinkGroupId: true,
        edlinkSyncedAt: true,
        sumberLms: true,
        externalUrl: true,
        externalSyncedAt: true,
        updatedAt: true,
        semester: {
          select: {
            id: true,
            tahunAkademik: true,
            periode: true,
            tanggalMulai: true,
            hariLibur: {
              select: {
                id: true,
                nama: true,
                tanggalMulai: true,
                tanggalSelesai: true,
                keterangan: true,
              },
              orderBy: { tanggalMulai: "asc" },
            },
          },
        },
        mataKuliah: {
          select: {
            id: true,
            nama: true,
            kode: true,
            sks: true,
            prodi: { select: { id: true, nama: true, kode: true } },
          },
        },
        dosen: {
          select: { id: true, nama: true, nidn: true },
        },
        dosen2: {
          select: { id: true, nama: true, nidn: true },
        },
        monitoringSesi: {
          select: {
            id: true,
            nomorSesi: true,
            kehadiran: true,
            conference: true,
            slide: true,
            tugas: true,
            video: true,
            lectureNote: true,
            kuis: true,
            catatanCdu: true,
            catatanGantiDosen: true,
            statusPengajar: true,
            updatedAt: true,
            dosenPengajar: {
              select: { id: true, nama: true },
            },
          },
          orderBy: { nomorSesi: "asc" },
        },
      },
    });

    if (!kelas) {
      return { success: false, error: "Kelas tidak ditemukan" };
    }

    return {
      success: true,
      data: kelas,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat detail monitoring kelas" };
  }
}

function normalizeKehadiran(val?: string | null): "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | undefined {
  if (!val) return undefined;
  if (val === "ALPHA" || val === "TIDAK_HADIR") return "TIDAK_HADIR";
  if (val === "HADIR_TDK_LENGKAP" || val === "HADIR_TIDAK_LENGKAP") return "HADIR_TIDAK_LENGKAP";
  if (val === "HADIR") return "HADIR";
  return "BELUM_DIISI";
}

export async function updateSingleMonitoringSesi(
  sesiId: string,
  data: {
    kehadiran?: "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | "ALPHA" | "HADIR_TDK_LENGKAP";
    lectureNote?: boolean | null;
    slide?: boolean | null;
    video?: boolean | null;
    conference?: boolean | null;
    tugas?: boolean | null;
    kuis?: boolean | null;
    catatanCdu?: string | null;
    catatan?: string | null;
    tanggal?: string | Date | null;
    dosenPengajarId?: string | null;
    statusPengajar?: "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
    catatanGantiDosen?: string | null;
  }
) {
  try {
    const updatePayload: any = {};
    if (data.kehadiran !== undefined) {
      updatePayload.kehadiran = normalizeKehadiran(data.kehadiran);
    }
    if (data.lectureNote !== undefined) updatePayload.lectureNote = data.lectureNote;
    if (data.slide !== undefined) updatePayload.slide = data.slide;
    if (data.video !== undefined) updatePayload.video = data.video;
    if (data.conference !== undefined) updatePayload.conference = data.conference;
    if (data.tugas !== undefined) updatePayload.tugas = data.tugas;
    if (data.kuis !== undefined) updatePayload.kuis = data.kuis;
    if (data.catatanCdu !== undefined || data.catatan !== undefined) {
      updatePayload.catatanCdu = data.catatanCdu ?? data.catatan ?? null;
    }
    if (data.tanggal !== undefined) {
      updatePayload.tanggal = data.tanggal ? new Date(data.tanggal) : null;
    }
    if (data.dosenPengajarId !== undefined) {
      updatePayload.dosenPengajarId = data.dosenPengajarId || null;
    }
    if (data.statusPengajar !== undefined) {
      updatePayload.statusPengajar = data.statusPengajar;
    }
    if (data.catatanGantiDosen !== undefined) {
      updatePayload.catatanGantiDosen = data.catatanGantiDosen || null;
    }

    const updated = await prisma.monitoringSesi.update({
      where: { id: sesiId },
      data: updatePayload,
      select: { id: true, kelasId: true },
    });

    // PERF: Hanya revalidate halaman monitoring kelas saja — tidak semua laporan.
    // Laporan biarkan kedaluwarsa lewat TTL cache (30 detik).
    revalidatePath("/monitoring");
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyimpan perubahan sesi" };
  }
}

export async function updateBatchMonitoringSesi(
  kelasId: string,
  sesiList: Array<{
    id: string;
    kehadiran: "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | "ALPHA" | "HADIR_TDK_LENGKAP";
    lectureNote: boolean | null;
    slide: boolean | null;
    video: boolean | null;
    conference: boolean | null;
    tugas: boolean | null;
    kuis: boolean | null;
    catatanCdu?: string | null;
    catatan?: string | null;
    tanggal?: string | Date | null;
    dosenPengajarId?: string | null;
    statusPengajar?: "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
    catatanGantiDosen?: string | null;
  }>
) {
  try {
    if (!sesiList || sesiList.length === 0) {
      return { success: true };
    }

    await prisma.$transaction(
      sesiList.map((sesi) => {
        const updateData: any = {
          kehadiran: normalizeKehadiran(sesi.kehadiran) || "BELUM_DIISI",
          lectureNote: sesi.lectureNote,
          slide: sesi.slide,
          video: sesi.video,
          conference: sesi.conference,
          tugas: sesi.tugas,
          kuis: sesi.kuis,
          catatanCdu: sesi.catatanCdu ?? sesi.catatan ?? null,
        };
        if (sesi.tanggal !== undefined) {
          updateData.tanggal = sesi.tanggal ? new Date(sesi.tanggal) : null;
        }
        if (sesi.dosenPengajarId !== undefined) {
          updateData.dosenPengajarId = sesi.dosenPengajarId || null;
        }
        if (sesi.statusPengajar !== undefined) {
          updateData.statusPengajar = sesi.statusPengajar;
        }
        if (sesi.catatanGantiDosen !== undefined) {
          updateData.catatanGantiDosen = sesi.catatanGantiDosen || null;
        }
        return prisma.monitoringSesi.update({
          where: { id: sesi.id },
          data: updateData,
        });
      })
    );

    // PERF: Hanya revalidate monitoring — laporan kedaluwarsa via TTL cache.
    revalidatePath("/monitoring");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyimpan perubahan batch sesi" };
  }
}

export interface GantiDosenParams {
  kelasId: string;
  nomorSesiMulai: number;
  nomorSesiSampai: number;
  dosenPengajarId: string | null; // null jika reset ke dosen utama
  statusPengajar: "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
  catatanGantiDosen?: string | null;
}

export async function gantiDosenSesiAction(params: GantiDosenParams) {
  try {
    const { kelasId, nomorSesiMulai, nomorSesiSampai, dosenPengajarId, statusPengajar, catatanGantiDosen } = params;

    await prisma.monitoringSesi.updateMany({
      where: {
        kelasId,
        nomorSesi: {
          gte: nomorSesiMulai,
          lte: nomorSesiSampai,
        },
      },
      data: {
        dosenPengajarId: dosenPengajarId || null,
        statusPengajar: statusPengajar,
        catatanGantiDosen: catatanGantiDosen || null,
      },
    });

    // PERF: Hanya revalidate monitoring — laporan kedaluwarsa via TTL cache.
    revalidatePath("/monitoring");

    return {
      success: true,
      message: `Berhasil memperbarui pengajar untuk Sesi ${nomorSesiMulai}–${nomorSesiSampai}`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memperbarui dosen pengajar sesi" };
  }
}

export async function parseExcelAction(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "File Excel tidak ditemukan" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parseResult = parseEdlinkExcel(buffer);
    if (parseResult.error) {
      return { success: false, error: parseResult.error };
    }

    return {
      success: true,
      data: parseResult,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memproses file Excel" };
  }
}

export async function applyExcelImportToKelas(
  kelasId: string,
  parsedSesiData: ParsedSesiData[]
) {
  try {
    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      select: {
        id: true,
        monitoringSesi: {
          select: {
            id: true,
            nomorSesi: true,
          },
          orderBy: { nomorSesi: "asc" },
        },
      },
    });

    if (!kelas) {
      return { success: false, error: "Kelas target tidak ditemukan" };
    }

    // Update setiap sesi yang sesuai dengan nomor sesi parsed
    await prisma.$transaction(async (tx) => {
      for (const parsed of parsedSesiData) {
        const targetSesi = kelas.monitoringSesi.find(
          (s) => s.nomorSesi === parsed.nomorSesi
        );

        if (targetSesi) {
          const isExam = parsed.nomorSesi === 8 || parsed.nomorSesi === 16;

          await tx.monitoringSesi.update({
            where: { id: targetSesi.id },
            data: {
              // Kehadiran TIDAK ditimpa jika sudah ada atau tetap dipertahankan
              lectureNote: isExam ? null : parsed.lectureNote,
              slide: isExam ? null : parsed.slide,
              video: isExam ? null : parsed.video,
              conference: isExam ? null : parsed.conference,
              tugas: isExam ? null : parsed.tugas,
              kuis: isExam ? null : parsed.kuis,
            },
          });
        }
      }
    });

    // PERF: Hanya revalidate monitoring & master/kelas.
    revalidatePath("/monitoring");
    revalidatePath("/master/kelas");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menerapkan data Excel ke kelas" };
  }
}

// -----------------------------------------------------------------------------
// QUICK BATCH ACTIONS (Efisiensi Input Staf CDU)
// -----------------------------------------------------------------------------

export async function quickSetAllAttendance(
  kelasId: string,
  kehadiran: "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | "ALPHA" | "HADIR_TDK_LENGKAP"
) {
  try {
    const norm = normalizeKehadiran(kehadiran) || "BELUM_DIISI";
    await prisma.monitoringSesi.updateMany({
      where: { kelasId },
      data: { kehadiran: norm },
    });

    // PERF: Hanya revalidate monitoring.
    revalidatePath("/monitoring");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengubah kehadiran massal" };
  }
}

export async function quickSetAllPillars(kelasId: string, setComplete: boolean = true) {
  try {
    // Sesi reguler saja (1-7 & 9-15)
    await prisma.monitoringSesi.updateMany({
      where: {
        kelasId,
        nomorSesi: { notIn: [8, 16] },
      },
      data: {
        slide: setComplete,
        tugas: setComplete,
        video: setComplete,
      },
    });

    // PERF: Hanya revalidate monitoring.
    revalidatePath("/monitoring");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengatur 3 pilar massal" };
  }
}

export async function bulkSetAttendanceAction(params: {
  kelasIds: string[];
  nomorSesi: number;
  kehadiran: "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | "ALPHA" | "HADIR_TDK_LENGKAP";
}) {
  try {
    const { kelasIds, nomorSesi, kehadiran } = params;
    if (!kelasIds || kelasIds.length === 0) {
      return { success: false, error: "Tidak ada kelas yang dipilih" };
    }
    const norm = normalizeKehadiran(kehadiran) || "BELUM_DIISI";

    const updateRes = await prisma.monitoringSesi.updateMany({
      where: {
        kelasId: { in: kelasIds },
        nomorSesi,
      },
      data: {
        kehadiran: norm,
      },
    });

    // PERF: Hanya revalidate monitoring — laporan kedaluwarsa via TTL cache.
    revalidatePath("/monitoring");

    return {
      success: true,
      updatedCount: updateRes.count,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memperbarui presensi masal" };
  }
}

