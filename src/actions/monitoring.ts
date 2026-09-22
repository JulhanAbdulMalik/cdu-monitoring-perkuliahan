"use server";
// src/actions/monitoring.ts
// Server Actions untuk Grid Monitoring 16 Sesi & Import Excel Edlink

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseEdlinkExcel, ParsedSesiData } from "@/lib/excel-parser";
import { calculateClassSummary, ClassSummaryResult } from "@/lib/score-calculator";
import {
  formatTerakhirUpdateParts,
  getCurrentActiveSessionNumber,
  DEFAULT_SEMESTER_START_DATE,
} from "@/lib/utils";
import { auth } from "@/lib/auth";
import { invalidateLaporanCache } from "@/actions/laporan";

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
      include: {
        semester: {
          include: {
            hariLibur: {
              orderBy: { tanggalMulai: "asc" },
            },
          },
        },
        mataKuliah: { include: { prodi: true } },
        dosen: true,
        monitoringSesi: {
          include: {
            dosenPengajar: true,
          },
          orderBy: { nomorSesi: "asc" },
        },
      },
      orderBy: [{ mataKuliah: { prodi: { nama: "asc" } } }, { kodeKelas: "asc" }],
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
          },
        },
        dosen: {
          select: {
            nama: true,
          },
        },
      },
      orderBy: [{ mataKuliah: { prodi: { nama: "asc" } } }, { kodeKelas: "asc" }],
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
        where: effectiveAllowedProdiIds && effectiveAllowedProdiIds.length > 0 ? { id: { in: effectiveAllowedProdiIds } } : {},
        orderBy: { nama: "asc" },
      }),
    ]);

    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];

    return {
      success: true,
      data: {
        semesters: allSemesters,
        prodiList: allProdi,
        activeSemesterId: activeSemester?.id || allSemesters[0]?.id || "",
      },
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
  monitoringTab?: "ALL" | "BELUM" | "SUDAH";
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
  summary: ClassSummaryResult;
  targetSesiData?: any;
  isMonitored: boolean;
  targetSesiKehadiranLabel: string;
  targetSesiKehadiranColor: string;
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
  const parts = jam.split(/[-–]|(?:s\.d)/i);
  return parts[0]?.trim() || jam.trim();
}

function mapClassToProcessedItem(
  cls: any,
  currentSesi: number,
  defaultActiveSesi: number
): MonitoringKelasProcessedItem {
  const summary = calculateClassSummary(cls.monitoringSesi as any, cls.modePembelajaran, defaultActiveSesi);

  const targetSesiData = cls.monitoringSesi.find((s: any) => s.nomorSesi === currentSesi);
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
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));

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

    const finalWhere: any = { ...baseWhere };
    if (params.monitoringTab === "BELUM") {
      finalWhere.monitoringSesi = {
        some: {
          nomorSesi: currentSesi,
          kehadiran: "BELUM_DIISI",
        },
      };
    } else if (params.monitoringTab === "SUDAH") {
      finalWhere.monitoringSesi = {
        some: {
          nomorSesi: currentSesi,
          kehadiran: { not: "BELUM_DIISI" },
        },
      };
    }

    const sort = params.sortBy || "TERBARU";
    const isCustomSortOrFilter =
      Boolean(params.filterStatus && params.filterStatus !== "ALL") ||
      sort === "KEHADIRAN_DESC" ||
      sort === "KEHADIRAN_ASC" ||
      sort === "PILAR_DESC" ||
      sort === "PILAR_ASC" ||
      sort === "JADWAL_ASC" ||
      sort === "JADWAL_DESC";

    if (isCustomSortOrFilter) {
      const [totalInBase, belumDimonitorCount, sudahDimonitorCount, allMatchingClasses] = await Promise.all([
        prisma.kelas.count({ where: baseWhere }),
        prisma.kelas.count({
          where: {
            ...baseWhere,
            monitoringSesi: { some: { nomorSesi: currentSesi, kehadiran: "BELUM_DIISI" } },
          },
        }),
        prisma.kelas.count({
          where: {
            ...baseWhere,
            monitoringSesi: { some: { nomorSesi: currentSesi, kehadiran: { not: "BELUM_DIISI" } } },
          },
        }),
        prisma.kelas.findMany({
          where: finalWhere,
          include: {
            semester: true,
            mataKuliah: { include: { prodi: true } },
            dosen: true,
            monitoringSesi: {
              include: { dosenPengajar: true },
              orderBy: { nomorSesi: "asc" },
            },
          },
        }),
      ]);

      let processed = allMatchingClasses.map((cls) => mapClassToProcessedItem(cls, currentSesi, defaultActiveSesi));

      if (params.filterStatus && params.filterStatus !== "ALL") {
        processed = processed.filter((c) => c.summary.statusEvaluasi === params.filterStatus);
      }

      if (sort === "KEHADIRAN_DESC") {
        processed.sort((a, b) => b.summary.persenKehadiran - a.summary.persenKehadiran);
      } else if (sort === "KEHADIRAN_ASC") {
        processed.sort((a, b) => a.summary.persenKehadiran - b.summary.persenKehadiran);
      } else if (sort === "PILAR_DESC") {
        processed.sort((a, b) => b.summary.totalSkor3Pilar - a.summary.totalSkor3Pilar);
      } else if (sort === "PILAR_ASC") {
        processed.sort((a, b) => a.summary.totalSkor3Pilar - b.summary.totalSkor3Pilar);
      } else if (sort === "JADWAL_ASC") {
        processed.sort((a, b) => {
          const dayDiff = getDayWeight(a.jadwalHari) - getDayWeight(b.jadwalHari);
          if (dayDiff !== 0) return dayDiff;
          return getJamStart(a.jadwalJam).localeCompare(getJamStart(b.jadwalJam));
        });
      } else if (sort === "JADWAL_DESC") {
        processed.sort((a, b) => {
          const dayDiff = getDayWeight(b.jadwalHari) - getDayWeight(a.jadwalHari);
          if (dayDiff !== 0) return dayDiff;
          return getJamStart(b.jadwalJam).localeCompare(getJamStart(a.jadwalJam));
        });
      }

      const totalFiltered = processed.length;
      const paginated = processed.slice((page - 1) * pageSize, page * pageSize);

      return {
        success: true,
        data: {
          items: paginated,
          totalCount: totalFiltered,
          tabCounts: {
            total: totalInBase,
            belum: belumDimonitorCount,
            sudah: sudahDimonitorCount,
          },
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(totalFiltered / pageSize)),
          defaultActiveSesi,
        },
      };
    }

    // Direct 100% Database Pagination
    let orderBy: any = [{ updatedAt: "desc" }];
    if (sort === "TERBARU") {
      orderBy = [{ updatedAt: "desc" }];
    } else if (sort === "TERLAMA") {
      orderBy = [{ updatedAt: "asc" }];
    } else if (sort === "KODE_ASC") {
      orderBy = [{ kodeKelas: "asc" }];
    } else if (sort === "KODE_DESC") {
      orderBy = [{ kodeKelas: "desc" }];
    } else if (sort === "MK_ASC") {
      orderBy = [{ mataKuliah: { nama: "asc" } }];
    } else if (sort === "MK_DESC") {
      orderBy = [{ mataKuliah: { nama: "desc" } }];
    } else if (sort === "DOSEN_ASC") {
      orderBy = [{ dosen: { nama: "asc" } }];
    } else if (sort === "DOSEN_DESC") {
      orderBy = [{ dosen: { nama: "desc" } }];
    } else if (sort === "RUANG_ASC") {
      orderBy = [{ ruangan: "asc" }];
    } else if (sort === "RUANG_DESC") {
      orderBy = [{ ruangan: "desc" }];
    }

    const [totalInBase, belumDimonitorCount, sudahDimonitorCount, rawClasses] = await Promise.all([
      prisma.kelas.count({ where: baseWhere }),
      prisma.kelas.count({
        where: {
          ...baseWhere,
          monitoringSesi: { some: { nomorSesi: currentSesi, kehadiran: "BELUM_DIISI" } },
        },
      }),
      prisma.kelas.count({
        where: {
          ...baseWhere,
          monitoringSesi: { some: { nomorSesi: currentSesi, kehadiran: { not: "BELUM_DIISI" } } },
        },
      }),
      prisma.kelas.findMany({
        where: finalWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          semester: true,
          mataKuliah: { include: { prodi: true } },
          dosen: true,
          monitoringSesi: {
            include: { dosenPengajar: true },
            orderBy: { nomorSesi: "asc" },
          },
        },
        orderBy,
      }),
    ]);

    const finalTotalCount =
      params.monitoringTab === "BELUM"
        ? belumDimonitorCount
        : params.monitoringTab === "SUDAH"
        ? sudahDimonitorCount
        : totalInBase;

    const items = rawClasses.map((cls) => mapClassToProcessedItem(cls, currentSesi, defaultActiveSesi));

    return {
      success: true,
      data: {
        items,
        totalCount: finalTotalCount,
        tabCounts: {
          total: totalInBase,
          belum: belumDimonitorCount,
          sudah: sudahDimonitorCount,
        },
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(finalTotalCount / pageSize)),
        defaultActiveSesi,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat monitoring kelas paginasi" };
  }
}

export async function getMonitoringKelasDetail(kelasId: string) {
  try {
    // Optimasi Waterfall: Jalankan query detail kelas dan daftar seluruh dosen secara paralel
    const [kelas, allDosen] = await Promise.all([
      prisma.kelas.findUnique({
        where: { id: kelasId },
        include: {
          semester: {
            include: {
              hariLibur: {
                orderBy: { tanggalMulai: "asc" },
              },
            },
          },
          mataKuliah: { include: { prodi: true } },
          dosen: true,
          monitoringSesi: {
            include: {
              dosenPengajar: true,
            },
            orderBy: { nomorSesi: "asc" },
          },
        },
      }),
      prisma.dosen.findMany({
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
      }),
    ]);

    if (!kelas) {
      return { success: false, error: "Kelas tidak ditemukan" };
    }

    return {
      success: true,
      data: {
        ...kelas,
        dosenList: allDosen,
      },
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
    statusPengajar?: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
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

    revalidatePath(`/monitoring/${updated.kelasId}`);
    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    revalidatePath("/laporan/dosen");
    revalidatePath("/");
    await invalidateLaporanCache();
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
    statusPengajar?: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
    catatanGantiDosen?: string | null;
  }>
) {
  try {
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

    revalidatePath(`/monitoring/${kelasId}`);
    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    revalidatePath("/laporan/dosen");
    revalidatePath("/");
    await invalidateLaporanCache();
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
  statusPengajar: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
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

    revalidatePath(`/monitoring/${kelasId}`);
    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    revalidatePath("/laporan/dosen");
    revalidatePath("/");
    await invalidateLaporanCache();

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
      include: {
        monitoringSesi: { orderBy: { nomorSesi: "asc" } },
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

    revalidatePath(`/monitoring/${kelasId}`);
    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    revalidatePath("/master/kelas");
    revalidatePath("/");
    await invalidateLaporanCache();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menerapkan data Excel ke kelas" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK BATCH ACTIONS (Efisiensi Input Staf CDU)
// ─────────────────────────────────────────────────────────────────────────────

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

    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    await invalidateLaporanCache();
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

    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    await invalidateLaporanCache();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengatur 3 pilar massal" };
  }
}

