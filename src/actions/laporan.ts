"use server";
// src/actions/laporan.ts
// Server Actions untuk Rekapitulasi Monitoring, Laporan Dosen & Laporan Prodi (3-Pillar & Mode-Aware)

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { calculateSessionPillars, calculateClassSummary } from "@/lib/score-calculator";
import {
  getWeekDates,
  getEstimatedSessionDate,
  getCurrentActiveSessionNumber,
  DEFAULT_SEMESTER_START_DATE,
} from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// SMART IN-MEMORY CACHE STORE DENGAN SINGLE-FLIGHT PATTERN (PROMISE COALESCING)
// ─────────────────────────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// TTL 5 menit (300.000 ms) - hemat beban server CPU di jam sibuk & data rekap semester tetap konsisten
const LAPORAN_CACHE_TTL_MS = 5 * 60 * 1000;
const laporanCacheStore = new Map<string, CacheEntry<any>>();
const inFlightLaporanRequests = new Map<string, Promise<any>>();

export async function invalidateLaporanCache(): Promise<void> {
  laporanCacheStore.clear();
}

function getLaporanFromCache<T>(key: string): T | null {
  const entry = laporanCacheStore.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > LAPORAN_CACHE_TTL_MS) {
    laporanCacheStore.delete(key);
    return null;
  }
  return entry.data as T;
}

function setLaporanToCache<T>(key: string, data: T): void {
  // Jaga ukuran cache maksimal 50 entries agar memori RAM tetap hemat
  if (laporanCacheStore.size >= 50) {
    const oldestKey = laporanCacheStore.keys().next().value;
    if (oldestKey) laporanCacheStore.delete(oldestKey);
  }
  laporanCacheStore.set(key, { data, timestamp: Date.now() });
}

/**
 * Eksekusi dengan Single-Flight In-Memory Cache (Promise Coalescing):
 * Mencegah Thundering Herd / Dog-Piling di jam sibuk ketika banyak user membuka laporan bersamaan.
 */
async function fetchWithSingleFlightCache<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Cek memory cache yang masih berlaku
  const cached = getLaporanFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 2. Cek apakah ada query/kalkulasi untuk key yang sama sedang berjalan (Promise Coalescing)
  if (inFlightLaporanRequests.has(key)) {
    return inFlightLaporanRequests.get(key) as Promise<T>;
  }

  // 3. Daftarkan promise eksekusi baru
  const promise = (async () => {
    try {
      const data = await fetcher();
      setLaporanToCache(key, data);
      return data;
    } finally {
      inFlightLaporanRequests.delete(key);
    }
  })();

  inFlightLaporanRequests.set(key, promise);
  return promise;
}

export interface DosenPengajarPeran {
  id: string;
  nama: string;
  nidn: string | null;
  statusPengajar: "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
  sesiList: number[];
  catatan?: string | null;
}

export interface SesiRekapItem {
  nomorSesi: number;
  kehadiran: string;
  contentScore: number | null; // 0, 1, 2, 3 (null for exams)
  hasSL: boolean;
  hasQT: boolean;
  hasTV: boolean;
  lectureNote: boolean | null;
  slide: boolean | null;
  video: boolean | null;
  conference: boolean | null;
  tugas: boolean | null;
  kuis: boolean | null;
  dosenPengajarId?: string | null;
  dosenPengajar?: {
    id: string;
    nama: string;
    nidn: string | null;
    prodi?: { id: string; nama: string; kode: string } | null;
  } | null;
  statusPengajar?: "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
  catatanGantiDosen?: string | null;
}

export interface ClassRekapSummary {
  id: string;
  kodeKelas: string;
  mataKuliah: {
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
    prodi?: { id: string; nama: string; kode: string } | null;
  };
  dosen2?: {
    id: string;
    nama: string;
    nidn: string | null;
    prodi?: { id: string; nama: string; kode: string } | null;
  } | null;
  semester: {
    id: string;
    tahunAkademik: string;
    periode: string;
  };
  jadwalHari: string | null;
  jadwalJam: string | null;
  modePembelajaran: "DARING" | "LURING" | "BIMBINGAN";
  sesi: SesiRekapItem[];
  dosenPengajarList: DosenPengajarPeran[];
  isSplitPengajar: boolean;
  totalHadir: number;
  totalHadirLengkap: number;
  totalHadirTdkLengkap: number;
  totalAlpha: number;
  totalBelumDiisi: number;
  persenKehadiran: number;

  totalSkor3Pilar: number; // Max 42 (Daring) or 28 (Luring)
  persenKonten: number;

  confPraUTS: number;
  confPraUAS: number;
  confTotal: number;
  isConfCompliant: boolean;

  statusEvaluasi: "TERLAKSANA" | "PERHATIAN";
  evaluasiNote: string;
}

export interface RekapLaporanResultData {
  rekapList: ClassRekapSummary[];
  semesters: Array<{
    id: string;
    tahunAkademik: string;
    periode: string;
    aktif: boolean;
    tanggalMulai: Date | null;
  }>;
  prodiList: Array<{
    id: string;
    nama: string;
    kode: string;
    fakultasId: string;
  }>;
  activeSemesterId: string;
  currentActiveSesi: number;
}

export async function getRekapLaporan(
  semesterId?: string,
  prodiId?: string,
  allowedProdiIds?: string[]
): Promise<{ success: boolean; data?: RekapLaporanResultData; error?: string }> {
  try {
    let targetSemId = semesterId;
    if (!targetSemId) {
      const activeSem = await prisma.semester.findFirst({ where: { aktif: true }, select: { id: true } });
      targetSemId = activeSem?.id || "NONE";
    }

    const isRestricted = Boolean(allowedProdiIds && allowedProdiIds.length > 0);
    const sortedAllowed = allowedProdiIds ? [...allowedProdiIds].sort().join(",") : "";
    const cacheKey = `rekap_${targetSemId}_${prodiId || "ALL"}_${sortedAllowed}`;

    const responseData = await fetchWithSingleFlightCache<RekapLaporanResultData>(cacheKey, async () => {
      // Optimasi Waterfall: Ambil allSemesters dan allProdi secara paralel
      const [allSemesters, rawAllProdi] = await Promise.all([
        prisma.semester.findMany({
          orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
        }),
        prisma.prodi.findMany({
          where: { isActive: true },
          orderBy: { nama: "asc" },
        }),
      ]);

      const activeSemester =
        allSemesters.find((s) => s.id === targetSemId) ||
        allSemesters.find((s) => s.aktif) ||
        allSemesters[0];
      const targetSemesterId = targetSemId;

    const allProdi = isRestricted
      ? rawAllProdi.filter((p) => allowedProdiIds!.includes(p.id))
      : rawAllProdi;

    let prodiWhere: any = {};
    if (isRestricted) {
      if (prodiId && prodiId !== "ALL" && allowedProdiIds!.includes(prodiId)) {
        prodiWhere = { prodiId };
      } else {
        prodiWhere = { prodiId: { in: allowedProdiIds! }, prodi: { isActive: true } };
      }
    } else {
      if (prodiId && prodiId !== "ALL") {
        prodiWhere = { prodiId };
      } else {
        prodiWhere = { prodi: { isActive: true } };
      }
    }

    // Pruned Lean Query: Memangkas relasi nested yang mubazir (menurunkan payload dari 16.4 MB ke 6 MB)
    const rawClasses = await prisma.kelas.findMany({
      where: {
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
        ...(Object.keys(prodiWhere).length > 0 ? { mataKuliah: prodiWhere } : {}),
      },
      select: {
        id: true,
        kodeKelas: true,
        jadwalHari: true,
        jadwalJam: true,
        modePembelajaran: true,
        semester: {
          select: {
            id: true,
            tahunAkademik: true,
            periode: true,
          },
        },
        mataKuliah: {
          select: {
            id: true,
            kode: true,
            nama: true,
            sks: true,
            prodi: {
              select: { id: true, nama: true, kode: true },
            },
          },
        },
        dosen: {
          select: {
            id: true,
            nama: true,
            nidn: true,
            prodi: {
              select: { id: true, nama: true, kode: true },
            },
          },
        },
        dosen2: {
          select: {
            id: true,
            nama: true,
            nidn: true,
            prodi: {
              select: { id: true, nama: true, kode: true },
            },
          },
        },
        monitoringSesi: {
          select: {
            id: true,
            nomorSesi: true,
            kehadiran: true,
            lectureNote: true,
            slide: true,
            video: true,
            conference: true,
            tugas: true,
            kuis: true,
            dosenPengajarId: true,
            statusPengajar: true,
            catatanGantiDosen: true,
            dosenPengajar: {
              select: {
                id: true,
                nama: true,
                nidn: true,
                prodi: {
                  select: { id: true, nama: true, kode: true },
                },
              },
            },
          },
          orderBy: { nomorSesi: "asc" },
        },
      },
      orderBy: [{ mataKuliah: { prodi: { nama: "asc" } } }, { kodeKelas: "asc" }],
    });

    const semStartStr = activeSemester?.tanggalMulai
      ? new Date(activeSemester.tanggalMulai).toISOString().split("T")[0]
      : DEFAULT_SEMESTER_START_DATE;
    const currentActiveSesi = getCurrentActiveSessionNumber(
      semStartStr,
      (activeSemester as any)?.hariLibur
    );

    const summaries: ClassRekapSummary[] = rawClasses.map((cls) => {
      const summary = calculateClassSummary(
        cls.monitoringSesi as any,
        cls.modePembelajaran as any,
        currentActiveSesi
      );

      // Kumpulkan peran dosen pengajar di kelas ini
      const peranMap = new Map<string, DosenPengajarPeran>();
      peranMap.set(cls.dosen.id, {
        id: cls.dosen.id,
        nama: cls.dosen.nama,
        nidn: cls.dosen.nidn ?? null,
        statusPengajar: "UTAMA",
        sesiList: [],
      });

      cls.monitoringSesi.forEach((s) => {
        const isSub = s.dosenPengajar && s.statusPengajar && s.statusPengajar !== "UTAMA";
        if (isSub) {
          const subDosen = s.dosenPengajar!;
          if (!peranMap.has(subDosen.id)) {
            peranMap.set(subDosen.id, {
              id: subDosen.id,
              nama: subDosen.nama,
              nidn: subDosen.nidn ?? null,
              statusPengajar: s.statusPengajar as any,
              sesiList: [s.nomorSesi],
              catatan: s.catatanGantiDosen,
            });
          } else {
            peranMap.get(subDosen.id)!.sesiList.push(s.nomorSesi);
          }
        } else {
          peranMap.get(cls.dosen.id)!.sesiList.push(s.nomorSesi);
        }
      });

      const dosenPengajarList = Array.from(peranMap.values()).filter(
        (p) => p.sesiList.length > 0
      );
      const isSplitPengajar = dosenPengajarList.length > 1;

      const processedSesi: SesiRekapItem[] = cls.monitoringSesi.map((s) => {
        const pilar = calculateSessionPillars(s, cls.modePembelajaran as any);

        return {
          nomorSesi: s.nomorSesi,
          kehadiran: s.kehadiran,
          contentScore: pilar.score,
          hasSL: pilar.hasSL,
          hasQT: pilar.hasQT,
          hasTV: pilar.hasTV,
          lectureNote: s.lectureNote,
          slide: s.slide,
          video: s.video,
          conference: s.conference,
          tugas: s.tugas,
          kuis: s.kuis,
          dosenPengajarId: s.dosenPengajarId,
          dosenPengajar: s.dosenPengajar
            ? {
                id: s.dosenPengajar.id,
                nama: s.dosenPengajar.nama,
                nidn: s.dosenPengajar.nidn ?? null,
                prodi: s.dosenPengajar.prodi ?? null,
              }
            : null,
          statusPengajar: s.statusPengajar as any,
          catatanGantiDosen: s.catatanGantiDosen,
        };
      });

      return {
        id: cls.id,
        kodeKelas: cls.kodeKelas,
        mataKuliah: cls.mataKuliah,
        dosen: {
          id: cls.dosen.id,
          nama: cls.dosen.nama,
          nidn: cls.dosen.nidn,
          prodi: cls.dosen.prodi ?? null,
        },
        dosen2: cls.dosen2
          ? {
              id: cls.dosen2.id,
              nama: cls.dosen2.nama,
              nidn: cls.dosen2.nidn,
              prodi: cls.dosen2.prodi ?? null,
            }
          : null,
        semester: cls.semester,
        jadwalHari: cls.jadwalHari,
        jadwalJam: cls.jadwalJam,
        modePembelajaran: cls.modePembelajaran as any,
        sesi: processedSesi,
        dosenPengajarList,
        isSplitPengajar,
        totalHadir: summary.totalHadir,
        totalHadirLengkap: summary.totalHadirLengkap,
        totalHadirTdkLengkap: summary.totalHadirTdkLengkap,
        totalAlpha: summary.totalAlpha,
        totalBelumDiisi: summary.totalBelumDiisi,
        persenKehadiran: summary.persenKehadiran,
        totalSkor3Pilar: summary.totalSkor3Pilar,
        persenKonten: summary.persenKonten,
        confPraUTS: summary.confPraUTS,
        confPraUAS: summary.confPraUAS,
        confTotal: summary.confTotal,
        isConfCompliant: summary.isConfCompliant,
        statusEvaluasi: summary.statusEvaluasi,
        evaluasiNote: summary.evaluasiNote,
      };
    });

      return {
        rekapList: summaries,
        semesters: allSemesters,
        prodiList: allProdi,
        activeSemesterId: activeSemester?.id || allSemesters[0]?.id,
        currentActiveSesi,
      };
    });

    return {
      success: true,
      data: responseData,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat data rekapitulasi" };
  }
}

export interface DosenReportItem {
  id: string;
  nama: string;
  nidn: string | null;
  prodi: { id: string; nama: string; kode: string };
  kelasList: Array<{
    id: string;
    kodeKelas: string;
    mataKuliah: { nama: string; kode: string; sks: number };
    modePembelajaran: "DARING" | "LURING" | "BIMBINGAN";
    totalSesiBeban: number;
    sesiDiajar: number[];
    statusPenugasan: string;
    peranPengajar?: "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
    totalHadir: number;
    persenKehadiran: number;
    totalSkorKonten: number;
    maxSkorKonten: number;
    persenKonten: number;
    statusEvaluasi: string;
  }>;
  totalKelas: number;
  totalSks: number;
  totalSesiBebanSemua: number;
  totalHadirSemua: number;
  totalAlphaSemua: number;
  totalSkor3PilarSemua: number;
  maxSkor3PilarSemua: number;
  totalSkor3PilarDaring: number;
  maxSkor3PilarDaring: number;
  totalConfSemua: number;
  avgKehadiran: number;
  avgKonten: number | null;
  status: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN";
}

export interface LaporanDosenResultData {
  dosenReportList: DosenReportItem[];
  semesters: Array<{
    id: string;
    tahunAkademik: string;
    periode: string;
    aktif: boolean;
    tanggalMulai: Date | null;
  }>;
  prodiList: Array<{
    id: string;
    nama: string;
    kode: string;
    fakultasId: string;
  }>;
  activeSemesterId: string;
}

export async function getLaporanDosen(
  semesterId?: string,
  prodiId?: string,
  allowedProdiIds?: string[]
): Promise<{ success: boolean; data?: LaporanDosenResultData; error?: string }> {
  try {
    let targetSemId = semesterId;
    if (!targetSemId) {
      const activeSem = await prisma.semester.findFirst({ where: { aktif: true }, select: { id: true } });
      targetSemId = activeSem?.id || "NONE";
    }

    const sortedAllowed = allowedProdiIds ? [...allowedProdiIds].sort().join(",") : "";
    const cacheKey = `dosen_${targetSemId}_${prodiId || "ALL"}_${sortedAllowed}`;

    const responseData = await fetchWithSingleFlightCache<LaporanDosenResultData>(cacheKey, async () => {
      const rekapRes = await getRekapLaporan(semesterId, prodiId, allowedProdiIds);
      if (!rekapRes.success || !rekapRes.data) {
        throw new Error(rekapRes.error || "Gagal memuat data laporan dosen");
      }

    const { rekapList, semesters, prodiList, activeSemesterId, currentActiveSesi = 16 } = rekapRes.data;

    // Map dosen: key = dosenId
    const dosenMap = new Map<
      string,
      {
        id: string;
        nama: string;
        nidn: string | null;
        prodi: { id: string; nama: string; kode: string };
        kelasList: Array<{
          id: string;
          kodeKelas: string;
          mataKuliah: { nama: string; kode: string; sks: number };
          modePembelajaran: "DARING" | "LURING" | "BIMBINGAN";
          totalSesiBeban: number;
          sesiDiajar: number[];
          statusPenugasan: string;
          peranPengajar?: "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
          totalHadir: number;
          persenKehadiran: number;
          totalSkorKonten: number;
          maxSkorKonten: number;
          persenKonten: number;
          statusEvaluasi: string;
        }>;
        totalKelas: number;
        totalSks: number;
        totalSesiBebanSemua: number;
        totalHadirSemua: number;
        totalAlphaSemua: number;
        totalSkor3PilarSemua: number;
        maxSkor3PilarSemua: number;
        totalSkor3PilarDaring: number;
        maxSkor3PilarDaring: number;
        totalConfSemua: number;
      }
    >();

    for (const item of rekapList) {
      // Kelompokkan sesi pada kelas ini berdasarkan Dosen Pengajar riil
      const pengajarDiKelas = new Map<
        string,
        {
          dosenObj: {
            id: string;
            nama: string;
            nidn: string | null;
            prodi: { id: string; nama: string; kode: string };
          };
          statusPengajar: "UTAMA" | "TANDEM" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
          sesiList: SesiRekapItem[];
        }
      >();

      // Inisialisasi Dosen Utama dengan homebase aslinya
      pengajarDiKelas.set(item.dosen.id, {
        dosenObj: {
          id: item.dosen.id,
          nama: item.dosen.nama,
          nidn: item.dosen.nidn ?? null,
          prodi: item.dosen.prodi || item.mataKuliah.prodi,
        },
        statusPengajar: "UTAMA",
        sesiList: [],
      });

      item.sesi.forEach((s: SesiRekapItem) => {
        const isSub = s.dosenPengajar && s.statusPengajar && s.statusPengajar !== "UTAMA";
        if (isSub) {
          const subId = s.dosenPengajar!.id;
          if (!pengajarDiKelas.has(subId)) {
            pengajarDiKelas.set(subId, {
              dosenObj: {
                id: s.dosenPengajar!.id,
                nama: s.dosenPengajar!.nama,
                nidn: s.dosenPengajar!.nidn ?? null,
                prodi: s.dosenPengajar!.prodi || item.mataKuliah.prodi,
              },
              statusPengajar: s.statusPengajar as any,
              sesiList: [s],
            });
          } else {
            pengajarDiKelas.get(subId)!.sesiList.push(s);
          }
        } else {
          pengajarDiKelas.get(item.dosen.id)!.sesiList.push(s);
        }
      });

      // Hitung kontribusi per dosen di kelas ini (hanya jika mengampu minimal 1 sesi)
      for (const [dosenId, data] of pengajarDiKelas.entries()) {
        if (data.sesiList.length === 0) continue;

        const totalSesiBeban = data.sesiList.length;
        const nomorSesiArr = data.sesiList.map((s) => s.nomorSesi).sort((a, b) => a - b);
        const minSesi = Math.min(...nomorSesiArr);
        const maxSesi = Math.max(...nomorSesiArr);

        // Format label status penugasan yang jelas dan proporsional
        let statusPenugasan = "Penuh (Sesi 1–16)";
        if (totalSesiBeban < 16) {
          if (data.statusPengajar === "TANDEM") {
            if (minSesi === 1 && maxSesi === 8 && totalSesiBeban === 8) {
              statusPenugasan = "Tandem: Sesi 1–8 (Pra-UTS)";
            } else if (minSesi === 9 && maxSesi === 16 && totalSesiBeban === 8) {
              statusPenugasan = "Tandem: Sesi 9–16 (Pasca-UTS)";
            } else {
              statusPenugasan = `Tandem (Sesi ${minSesi === maxSesi ? minSesi : `${minSesi}–${maxSesi}`})`;
            }
          } else if (data.statusPengajar === "PERGANTIAN_TETAP") {
            if (minSesi === 9 && maxSesi === 16 && totalSesiBeban === 8) {
              statusPenugasan = "Pergantian Resmi: Sesi 9–16";
            } else {
              statusPenugasan = `Pergantian Resmi (Sesi ${minSesi === maxSesi ? minSesi : `${minSesi}–${maxSesi}`})`;
            }
          } else if (data.statusPengajar === "PENGGANTI_INSIDENTAL") {
            statusPenugasan = `Pengganti (Sesi ${nomorSesiArr.join(", ")})`;
          } else {
            // UTAMA yang berbagi sesi dengan tandem/pengganti
            if (minSesi === 1 && maxSesi === 8 && totalSesiBeban === 8) {
              statusPenugasan = "Utama: Sesi 1–8 (Pra-UTS)";
            } else {
              statusPenugasan = `Utama (Sesi ${minSesi === maxSesi ? minSesi : `${minSesi}–${maxSesi}`})`;
            }
          }
        }

        // Kehadiran dosen pada beban sesinya
        const hadirCount = data.sesiList.filter(
          (s) =>
            s.kehadiran === "HADIR" ||
            s.kehadiran === "HADIR_TIDAK_LENGKAP" ||
            (s.kehadiran as string) === "HADIR_TDK_LENGKAP"
        ).length;
        const alphaCount = data.sesiList.filter(
          (s) => s.kehadiran === "TIDAK_HADIR" || (s.kehadiran as string) === "ALPHA"
        ).length;
        const persenKehadiran = Math.round((hadirCount / totalSesiBeban) * 1000) / 10;

        // 3 Pilar pada beban sesinya (sesi reguler)
        const isBimbingan = (item.modePembelajaran as any) === "BIMBINGAN";
        const regularSesi = data.sesiList.filter(
          (s) => s.nomorSesi !== 8 && s.nomorSesi !== 16
        );
        const maxSkorKonten = isBimbingan ? 0 : regularSesi.length * (item.modePembelajaran === "LURING" ? 2 : 3);
        const skorKonten = isBimbingan ? 0 : regularSesi.reduce(
          (acc, s) => acc + (s.contentScore || 0),
          0
        );
        const persenKonten = isBimbingan ? null :
          maxSkorKonten > 0 ? Math.round((skorKonten / maxSkorKonten) * 1000) / 10 : 0;

        const confCount = data.sesiList.filter((s) => s.conference).length;

        // Evaluasi kelas: Jika 1 dosen penuh, gunakan statusEvaluasi kelas yang sudah dihitung; jika pengajar terpisah, evaluasi kehadiran alpa dosen
        let classEvaluasi: "TERLAKSANA" | "PERHATIAN" = "TERLAKSANA";
        if (!item.isSplitPengajar) {
          classEvaluasi = item.statusEvaluasi;
        } else {
          if (alphaCount >= 2) {
            classEvaluasi = "PERHATIAN";
          } else {
            classEvaluasi = "TERLAKSANA";
          }
        }

        // Masukkan ke dosenMap
        if (!dosenMap.has(dosenId)) {
          dosenMap.set(dosenId, {
            id: dosenId,
            nama: data.dosenObj.nama,
            nidn: data.dosenObj.nidn,
            prodi: data.dosenObj.prodi,
            kelasList: [],
            totalKelas: 0,
            totalSks: 0,
            totalSesiBebanSemua: 0,
            totalHadirSemua: 0,
            totalAlphaSemua: 0,
            totalSkor3PilarSemua: 0,
            maxSkor3PilarSemua: 0,
            totalSkor3PilarDaring: 0,
            maxSkor3PilarDaring: 0,
            totalConfSemua: 0,
          });
        }

        const entry = dosenMap.get(dosenId)!;
        entry.kelasList.push({
          id: item.id,
          kodeKelas: item.kodeKelas,
          mataKuliah: item.mataKuliah,
          modePembelajaran: item.modePembelajaran,
          totalSesiBeban,
          sesiDiajar: nomorSesiArr,
          statusPenugasan,
          peranPengajar: data.statusPengajar,
          totalHadir: hadirCount,
          persenKehadiran,
          totalSkorKonten: skorKonten,
          maxSkorKonten,
          persenKonten: persenKonten ?? 0,
          statusEvaluasi: classEvaluasi,
        });

        entry.totalKelas = entry.kelasList.length;
        entry.totalSks = entry.kelasList.reduce((sum, c) => sum + (c.mataKuliah?.sks || 0), 0);
        entry.totalSesiBebanSemua += totalSesiBeban;
        entry.totalHadirSemua += hadirCount;
        entry.totalAlphaSemua += alphaCount;
        entry.totalSkor3PilarSemua += skorKonten;
        entry.maxSkor3PilarSemua += maxSkorKonten;
        entry.totalConfSemua += confCount;

        if (item.modePembelajaran === "DARING") {
          entry.totalSkor3PilarDaring += skorKonten;
          entry.maxSkor3PilarDaring += maxSkorKonten;
        }
      }
    }

    const dosenReportList = Array.from(dosenMap.values()).map((d) => {
      // Rumus adil: pembagi adalah total sesi beban riil pengajar
      const avgKehadiran =
        d.totalSesiBebanSemua > 0
          ? Math.round((d.totalHadirSemua / d.totalSesiBebanSemua) * 1000) / 10
          : 0;
      const avgKonten =
        d.maxSkor3PilarSemua > 0
          ? Math.round((d.totalSkor3PilarSemua / d.maxSkor3PilarSemua) * 1000) / 10
          : null;

      // Status Evaluasi Dosen: Mengikuti agregasi status kelas yang diampu
      // Jika seluruh kelas berstatus TERLAKSANA -> SANGAT_BAIK
      // Status PERLU_PEMBINAAN hanya diberikan jika ada kelasnya yang berstatus PERHATIAN
      const totalPerhatian = d.kelasList.filter((c) => c.statusEvaluasi === "PERHATIAN").length;
      let status: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" = "SANGAT_BAIK";
      if (totalPerhatian > 0) {
        status = "PERLU_PEMBINAAN";
      } else {
        status = "SANGAT_BAIK";
      }

      return {
        ...d,
        totalSks: d.totalSks,
        avgKehadiran,
        avgKonten,
        status,
      };
    });

      return {
        dosenReportList,
        semesters,
        prodiList,
        activeSemesterId,
      };
    });

    return {
      success: true,
      data: responseData,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memproses laporan dosen" };
  }
}

export interface ProdiReportItem {
  id: string;
  nama: string;
  kode: string;
  fakultasNama?: string;

  // Rentang Tanggal (Mingguan)
  totalSesiRentang: number;
  totalHadirRentang: number;
  totalHadirTdkLengkapRentang: number;
  totalAlphaRentang: number;
  totalBelumDiisiRentang: number;
  totalGantiHariRentang: number;
  avgKehadiranRentang: number | null;

  totalRegularSesiRentang: number;
  totalSkor3PilarRentang: number;
  maxSkor3PilarRentang: number;
  avgKontenRentang: number | null;
  totalPilar1Rentang: number;
  totalPilar2Rentang: number;
  totalPilar3Rentang: number;
  totalConfRentang: number;

  totalDosenAktifRentang: number;
  totalKelasAktifRentang: number;
  statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" | "BELUM_ADA_KELAS";

  // Sesi Kendala (Alpha & Belum Diisi)
  kendalaList: KendalaKehadiranItem[];

  // Semester Total (Referensi)
  totalKelas: number;
  totalKelasNonBimbingan?: number;
  totalDosen: number;
  avgKehadiranSemester: number | null;
  avgKontenSemester: number | null;
}

export interface KendalaKehadiranItem {
  sesiId: string;
  nomorSesi: number;
  status: "ALPHA" | "BELUM_DIISI" | "HTL";
  catatan: string | null;
  dosenId: string;
  dosenNama: string;
  dosenNidn?: string | null;
  mataKuliahNama: string;
  mataKuliahKode: string;
  kelasKode: string;
  kelasId: string;
  jadwalHari?: string | null;
  jadwalJam?: string | null;
  tanggal?: string | null;
  prodiNama?: string;
  prodiKode?: string;
}

export interface LaporanProdiResponse {
  success: boolean;
  error?: string;
  data?: {
    prodiReportList: ProdiReportItem[];
    semesters: Array<{
      id: string;
      tahunAkademik: string;
      periode: string;
      aktif: boolean;
    }>;
    activeSemesterId: string;
    startDate: string;
    endDate: string;
    targetSesi?: number | null;
    targetJenisKelas?: string;
    globalSummary: {
      totalProdi: number;
      totalKelasSemua: number;
      totalDosenSemua: number;
      totalSesiRentangSemua: number;
      avgKehadiranRentangSemua: number;
      avgKontenRentangSemua: number;
      totalConfRentangSemua: number;
      totalGantiHariRentangSemua?: number;
    };
  };
}

export async function getLaporanProdi(
  semesterId?: string,
  startDate?: string,
  endDate?: string,
  allowedProdiIds?: string[],
  sesiNumber?: number,
  jenisKelas?: string
): Promise<LaporanProdiResponse> {
  try {
    const isSesiMode = Boolean(sesiNumber && sesiNumber >= 1 && sesiNumber <= 16);
    const targetSesi = isSesiMode ? (sesiNumber as number) : null;
    const isAllTime = !isSesiMode && !startDate && !endDate;
    const targetStartDate = !isSesiMode ? (startDate || "") : "";
    const targetEndDate = !isSesiMode ? (endDate || "") : "";

    const normalizedJenisKelas =
      jenisKelas && jenisKelas !== "ALL"
        ? jenisKelas === "OFFLINE" || jenisKelas === "LURING"
          ? "LURING"
          : jenisKelas === "ONLINE" || jenisKelas === "DARING"
          ? "DARING"
          : jenisKelas === "BIMBINGAN"
          ? "BIMBINGAN"
          : null
        : null;

    const isRestricted = Boolean(allowedProdiIds && allowedProdiIds.length > 0);

    // Optimasi Waterfall: Ambil allSemesters & allProdi secara paralel
    const [allSemesters, rawAllProdi] = await Promise.all([
      prisma.semester.findMany({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
      }),
      prisma.prodi.findMany({
        where: { isActive: true },
        include: {
          fakultas: true,
          _count: {
            select: { dosen: true },
          },
        },
        orderBy: { nama: "asc" },
      }),
    ]);

    const allProdi = isRestricted
      ? rawAllProdi.filter((p) => allowedProdiIds!.includes(p.id))
      : rawAllProdi;

    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];
    const targetSemesterId = semesterId || activeSemester?.id || "NONE";

    const sortedAllowed = allowedProdiIds ? [...allowedProdiIds].sort().join(",") : "";
    const cacheKey = `prodi_${targetSemesterId}_${targetStartDate || "ALL"}_${targetEndDate || "ALL"}_sesi${targetSesi || "NONE"}_${sortedAllowed}_mode${normalizedJenisKelas || "ALL"}`;

    const responseData = await fetchWithSingleFlightCache<any>(cacheKey, async () => {
      // ── FAST PATH: SQL GROUP BY Aggregation untuk All Time & Sesi Mode (95%+ traffic) ──
      if (isAllTime || isSesiMode) {
        const modeCondition = normalizedJenisKelas
          ? Prisma.sql`AND k."modePembelajaran" = ${normalizedJenisKelas}::"ModePembelajaran"`
          : Prisma.empty;
        const prodiCondition = isRestricted && allowedProdiIds!.length > 0
          ? Prisma.sql`AND p.id IN (${Prisma.join(allowedProdiIds!)})`
          : Prisma.empty;
        const sesiCondition = isSesiMode
          ? Prisma.sql`AND ms."nomorSesi" = ${targetSesi}`
          : Prisma.sql`AND NOT (ms."kehadiran" = 'BELUM_DIISI' AND (ms."catatanCdu" IS NULL OR TRIM(ms."catatanCdu") = '') AND ms."nomorSesi" > cms.max_sesi)`;

        const [prodiRows, maxScoreRows, semesterScoreRows, kendalaRows] = await Promise.all([
          // 1. Core aggregates per prodi
          prisma.$queryRaw<any[]>`
            WITH ClassMaxSesi AS (
              SELECT 
                ms."kelasId",
                k."modePembelajaran",
                mk."prodiId",
                COALESCE(
                  MAX(CASE WHEN ms."kehadiran" != 'BELUM_DIISI' OR (ms."catatanCdu" IS NOT NULL AND TRIM(ms."catatanCdu") != '') THEN ms."nomorSesi" END),
                  1
                ) as max_sesi
              FROM "MonitoringSesi" ms
              JOIN "Kelas" k ON ms."kelasId" = k.id
              JOIN "MataKuliah" mk ON k."mataKuliahId" = mk.id
              JOIN "Prodi" p ON mk."prodiId" = p.id
              WHERE k."semesterId" = ${targetSemesterId} AND p."isActive" = true
              ${modeCondition}
              ${prodiCondition}
              GROUP BY ms."kelasId", k."modePembelajaran", mk."prodiId"
            )
            SELECT 
              cms."prodiId",
              p."nama" as prodi_nama,
              p."kode" as prodi_kode,
              f."nama" as fakultas_nama,
              COUNT(DISTINCT cms."kelasId")::int as total_kelas,
              COUNT(DISTINCT CASE WHEN cms."modePembelajaran" != 'BIMBINGAN' THEN cms."kelasId" END)::int as total_kelas_non_bimbingan,
              COUNT(DISTINCT CASE WHEN cms."modePembelajaran" = 'LURING' THEN cms."kelasId" END)::int as total_kelas_luring,
              COUNT(DISTINCT CASE WHEN cms."modePembelajaran" = 'DARING' THEN cms."kelasId" END)::int as total_kelas_daring,
              COUNT(*)::int as total_sesi_rentang,
              COUNT(CASE WHEN ms."kehadiran" = 'HADIR' THEN 1 END)::int as total_hadir,
              COUNT(CASE WHEN ms."kehadiran" = 'HADIR_TIDAK_LENGKAP' THEN 1 END)::int as total_htl,
              COUNT(CASE WHEN ms."kehadiran" = 'TIDAK_HADIR'::"Kehadiran" THEN 1 END)::int as total_alpha,
              COUNT(CASE WHEN ms."kehadiran" = 'BELUM_DIISI' THEN 1 END)::int as total_belum_diisi,
              COUNT(CASE WHEN ms."catatanCdu" ~* 'ganti|reschedule|tunda' THEN 1 END)::int as total_ganti_hari,
              COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND cms."modePembelajaran" != 'BIMBINGAN' THEN 1 END)::int as total_regular,
              COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND cms."modePembelajaran" != 'BIMBINGAN' AND (ms.slide = true OR ms."lectureNote" = true) THEN 1 END)::int as pilar1,
              COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND cms."modePembelajaran" != 'BIMBINGAN' AND (ms.tugas = true OR ms.kuis = true) THEN 1 END)::int as pilar2,
              COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND cms."modePembelajaran" = 'DARING' AND (ms.video = true OR ms.conference = true) THEN 1 END)::int as pilar3,
              COUNT(CASE WHEN ms.conference = true AND ms."nomorSesi" NOT IN (8, 16) THEN 1 END)::int as total_conf,
              COUNT(DISTINCT CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND ms."kehadiran" != 'BELUM_DIISI' THEN k."dosenId" END)::int as total_dosen_aktif,
              COUNT(DISTINCT CASE WHEN ms."kehadiran" != 'BELUM_DIISI' THEN k.id END)::int as total_kelas_aktif
            FROM ClassMaxSesi cms
            JOIN "MonitoringSesi" ms ON cms."kelasId" = ms."kelasId"
            JOIN "Kelas" k ON ms."kelasId" = k.id
            JOIN "Prodi" p ON cms."prodiId" = p.id
            JOIN "Fakultas" f ON p."fakultasId" = f.id
            WHERE 1=1
            ${sesiCondition}
            GROUP BY cms."prodiId", p."nama", p."kode", f."nama"
            ORDER BY p."nama" ASC;
          `,
          // 2. Max 3-pillar score per prodi in range
          prisma.$queryRaw<any[]>`
            WITH ClassMaxSesi AS (
              SELECT 
                ms."kelasId",
                k."modePembelajaran",
                mk."prodiId",
                COALESCE(
                  MAX(CASE WHEN ms."kehadiran" != 'BELUM_DIISI' OR (ms."catatanCdu" IS NOT NULL AND TRIM(ms."catatanCdu") != '') THEN ms."nomorSesi" END),
                  1
                ) as max_sesi
              FROM "MonitoringSesi" ms
              JOIN "Kelas" k ON ms."kelasId" = k.id
              JOIN "MataKuliah" mk ON k."mataKuliahId" = mk.id
              JOIN "Prodi" p ON mk."prodiId" = p.id
              WHERE k."semesterId" = ${targetSemesterId} AND p."isActive" = true AND k."modePembelajaran" != 'BIMBINGAN'
              ${modeCondition}
              ${prodiCondition}
              GROUP BY ms."kelasId", k."modePembelajaran", mk."prodiId"
            )
            SELECT 
              cms."prodiId",
              SUM(
                CASE 
                  WHEN cms."modePembelajaran" = 'LURING' THEN 2 
                  WHEN cms."modePembelajaran" = 'DARING' THEN 3 
                  ELSE 0 
                END
              )::int as max_skor_rentang
            FROM ClassMaxSesi cms
            JOIN "MonitoringSesi" ms ON cms."kelasId" = ms."kelasId"
            WHERE ms."nomorSesi" NOT IN (8, 16)
              ${sesiCondition}
            GROUP BY cms."prodiId";
          `,
          // 3. Semester total stats (khusus Sesi Mode)
          isSesiMode
            ? prisma.$queryRaw<any[]>`
              SELECT 
                mk."prodiId",
                COUNT(CASE WHEN ms."kehadiran" IN ('HADIR', 'HADIR_TIDAK_LENGKAP') THEN 1 END)::int as total_hadir_semester,
                COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND k."modePembelajaran" != 'BIMBINGAN' AND (ms.slide = true OR ms."lectureNote" = true) THEN 1 END)::int as pilar1,
                COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND k."modePembelajaran" != 'BIMBINGAN' AND (ms.tugas = true OR ms.kuis = true) THEN 1 END)::int as pilar2,
                COUNT(CASE WHEN ms."nomorSesi" NOT IN (8, 16) AND k."modePembelajaran" = 'DARING' AND (ms.video = true OR ms.conference = true) THEN 1 END)::int as pilar3
              FROM "MonitoringSesi" ms
              JOIN "Kelas" k ON ms."kelasId" = k.id
              JOIN "MataKuliah" mk ON k."mataKuliahId" = mk.id
              JOIN "Prodi" p ON mk."prodiId" = p.id
              WHERE k."semesterId" = ${targetSemesterId} AND p."isActive" = true
              ${modeCondition}
              ${prodiCondition}
              GROUP BY mk."prodiId";
            `
            : Promise.resolve([]),
          // 4. Kendala rows
          prisma.$queryRaw<any[]>`
            WITH ClassMaxSesi AS (
              SELECT 
                ms."kelasId",
                COALESCE(
                  MAX(CASE WHEN ms."kehadiran" != 'BELUM_DIISI' OR (ms."catatanCdu" IS NOT NULL AND TRIM(ms."catatanCdu") != '') THEN ms."nomorSesi" END),
                  1
                ) as max_sesi
              FROM "MonitoringSesi" ms
              JOIN "Kelas" k ON ms."kelasId" = k.id
              JOIN "MataKuliah" mk ON k."mataKuliahId" = mk.id
              JOIN "Prodi" p ON mk."prodiId" = p.id
              WHERE k."semesterId" = ${targetSemesterId} AND p."isActive" = true
              ${modeCondition}
              ${prodiCondition}
              GROUP BY ms."kelasId"
            )
            SELECT 
              ms.id as "sesiId",
              ms."nomorSesi",
              CASE 
                WHEN ms."kehadiran" = 'TIDAK_HADIR'::"Kehadiran" THEN 'ALPHA'
                WHEN ms."kehadiran" = 'HADIR_TIDAK_LENGKAP'::"Kehadiran" THEN 'HTL'
                ELSE 'BELUM_DIISI'
              END as status,
              ms."catatanCdu" as catatan,
              ms."tanggal",
              k.id as "kelasId",
              k."kodeKelas" as "kelasKode",
              k."jadwalHari",
              k."jadwalJam",
              mk."nama" as "mataKuliahNama",
              mk."kode" as "mataKuliahKode",
              mk."prodiId",
              p."nama" as "prodiNama",
              p."kode" as "prodiKode",
              d.id as "dosenId",
              COALESCE(dp.nama, d.nama) as "dosenNama",
              COALESCE(dp.nidn, d.nidn) as "dosenNidn"
            FROM ClassMaxSesi cms
            JOIN "MonitoringSesi" ms ON cms."kelasId" = ms."kelasId"
            JOIN "Kelas" k ON ms."kelasId" = k.id
            JOIN "MataKuliah" mk ON k."mataKuliahId" = mk.id
            JOIN "Prodi" p ON mk."prodiId" = p.id
            JOIN "Dosen" d ON k."dosenId" = d.id
            LEFT JOIN "Dosen" dp ON ms."dosenPengajarId" = dp.id
            WHERE ms."kehadiran" IN ('TIDAK_HADIR'::"Kehadiran", 'HADIR_TIDAK_LENGKAP'::"Kehadiran", 'BELUM_DIISI'::"Kehadiran")
              ${sesiCondition}
            ORDER BY mk."prodiId", ms."nomorSesi";
          `,
        ]);

        const maxScoreMap = new Map<string, number>();
        for (const r of maxScoreRows) maxScoreMap.set(r.prodiId, r.max_skor_rentang);

        const semScoreMap = new Map<string, any>();
        for (const r of semesterScoreRows) {
          semScoreMap.set(r.prodiId, {
            totalHadir: r.total_hadir_semester,
            totalSkor: r.pilar1 + r.pilar2 + (r.pilar3 || 0),
          });
        }

        const kendalaByProdi = new Map<string, KendalaKehadiranItem[]>();
        for (const r of kendalaRows) {
          if (!kendalaByProdi.has(r.prodiId)) kendalaByProdi.set(r.prodiId, []);
          kendalaByProdi.get(r.prodiId)!.push({
            sesiId: r.sesiId,
            nomorSesi: r.nomorSesi,
            status: r.status,
            catatan: r.catatan,
            dosenId: r.dosenId,
            dosenNama: r.dosenNama,
            dosenNidn: r.dosenNidn,
            mataKuliahNama: r.mataKuliahNama,
            mataKuliahKode: r.mataKuliahKode,
            kelasKode: r.kelasKode,
            kelasId: r.kelasId,
            jadwalHari: r.jadwalHari,
            jadwalJam: r.jadwalJam,
            tanggal: r.tanggal ? new Date(r.tanggal).toISOString().split("T")[0] : null,
            prodiNama: r.prodiNama,
            prodiKode: r.prodiKode,
          });
        }

        const prodiRowMap = new Map<string, any>();
        for (const r of prodiRows) prodiRowMap.set(r.prodiId, r);

        let globalTotalSesiRentang = 0;
        let globalTotalHadirRentang = 0;
        let globalTotalRegularSesiRentang = 0;
        let globalTotalSkor3PilarRentang = 0;
        let globalMaxSkor3PilarRentang = 0;
        let globalTotalConfRentang = 0;
        let globalTotalKelas = 0;
        let globalTotalDosen = 0;
        let globalTotalGantiHariRentang = 0;

        const prodiReportList: ProdiReportItem[] = allProdi.map((p) => {
          const r = prodiRowMap.get(p.id);
          const totalKelas = r ? r.total_kelas : 0;
          const totalKelasNonBimbingan = r ? r.total_kelas_non_bimbingan : 0;
          const totalDosen = p._count.dosen;

          const totalSesiRentang = r ? r.total_sesi_rentang : 0;
          const totalHadirRentang = r ? r.total_hadir : 0;
          const totalHadirTdkLengkapRentang = r ? r.total_htl : 0;
          const totalAlphaRentang = r ? r.total_alpha : 0;
          const totalBelumDiisiRentang = r ? r.total_belum_diisi : 0;
          const totalGantiHariRentang = r ? r.total_ganti_hari : 0;

          const avgKehadiranRentang = totalSesiRentang > 0
            ? Math.round(((totalHadirRentang + totalHadirTdkLengkapRentang) / totalSesiRentang) * 1000) / 10
            : totalKelas > 0 ? 0 : null;

          const totalRegularSesiRentang = r ? r.total_regular : 0;
          const totalSkor3PilarRentang = r ? (r.pilar1 + r.pilar2 + r.pilar3) : 0;
          const maxSkor3PilarRentang = maxScoreMap.get(p.id) || 0;

          const isAllBimbingan = totalKelas > 0 && totalKelasNonBimbingan === 0;
          const avgKontenRentang = maxSkor3PilarRentang > 0
            ? Math.round((totalSkor3PilarRentang / maxSkor3PilarRentang) * 1000) / 10
            : totalKelas > 0 ? (isAllBimbingan ? 100 : 0) : null;

          const totalPilar1Rentang = r ? r.pilar1 : 0;
          const totalPilar2Rentang = r ? r.pilar2 : 0;
          const totalPilar3Rentang = r ? r.pilar3 : 0;
          const totalConfRentang = r ? r.total_conf : 0;

          const totalDosenAktifRentang = r ? r.total_dosen_aktif : 0;
          const totalKelasAktifRentang = r ? r.total_kelas_aktif : 0;

          let statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" | "BELUM_ADA_KELAS" = "BAIK";
          if (totalKelas === 0) {
            statusKinerjaRentang = "BELUM_ADA_KELAS";
          } else if (
            (avgKehadiranRentang !== null && avgKehadiranRentang < 75) ||
            (avgKontenRentang !== null && avgKontenRentang < 65) ||
            totalAlphaRentang >= 2
          ) {
            statusKinerjaRentang = "PERLU_PEMBINAAN";
          } else if (
            (avgKehadiranRentang !== null && avgKehadiranRentang >= 85) &&
            (avgKontenRentang !== null && avgKontenRentang >= 80) &&
            totalAlphaRentang === 0 &&
            totalHadirTdkLengkapRentang <= 1
          ) {
            statusKinerjaRentang = "SANGAT_BAIK";
          }

          const kendalaList = kendalaByProdi.get(p.id) || [];

          // Semester stats
          let totalHadirSemester = isSesiMode ? (semScoreMap.get(p.id)?.totalHadir || 0) : (totalHadirRentang + totalHadirTdkLengkapRentang);
          let totalSkorSemester = isSesiMode ? (semScoreMap.get(p.id)?.totalSkor || 0) : totalSkor3PilarRentang;
          let maxSkorSemester = r ? ((r.total_kelas_luring * 28) + (r.total_kelas_daring * 42)) : 0;

          const avgKehadiranSemester = totalKelas > 0 ? Math.round((totalHadirSemester / (totalKelas * 16)) * 1000) / 10 : null;
          const avgKontenSemester = totalKelas > 0 ? (maxSkorSemester > 0 ? Math.round((totalSkorSemester / maxSkorSemester) * 1000) / 10 : (isAllBimbingan ? 100 : 0)) : null;

          globalTotalSesiRentang += totalSesiRentang;
          globalTotalHadirRentang += (totalHadirRentang + totalHadirTdkLengkapRentang);
          globalTotalRegularSesiRentang += totalRegularSesiRentang;
          globalTotalSkor3PilarRentang += totalSkor3PilarRentang;
          globalMaxSkor3PilarRentang += maxSkor3PilarRentang;
          globalTotalConfRentang += totalConfRentang;
          globalTotalKelas += totalKelas;
          globalTotalDosen += totalDosen;
          globalTotalGantiHariRentang += totalGantiHariRentang;

          return {
            id: p.id,
            nama: p.nama,
            kode: p.kode,
            fakultasNama: p.fakultas?.nama,
            totalSesiRentang,
            totalHadirRentang,
            totalHadirTdkLengkapRentang,
            totalAlphaRentang,
            totalBelumDiisiRentang,
            totalGantiHariRentang,
            avgKehadiranRentang,
            totalRegularSesiRentang,
            totalSkor3PilarRentang,
            maxSkor3PilarRentang,
            avgKontenRentang,
            totalPilar1Rentang,
            totalPilar2Rentang,
            totalPilar3Rentang,
            totalConfRentang,
            totalDosenAktifRentang,
            totalKelasAktifRentang,
            statusKinerjaRentang,
            kendalaList,
            totalKelas,
            totalKelasNonBimbingan,
            totalDosen,
            avgKehadiranSemester,
            avgKontenSemester,
          };
        });

        const avgKehadiranRentangSemua = globalTotalSesiRentang > 0 ? Math.round((globalTotalHadirRentang / globalTotalSesiRentang) * 1000) / 10 : 0;
        const activeProdiList = prodiReportList.filter(p => p.totalKelas > 0);
        const isAllBimb = normalizedJenisKelas === "BIMBINGAN" || (activeProdiList.length > 0 && activeProdiList.every(p => p.totalKelasNonBimbingan === 0));
        const avgKontenRentangSemua = globalMaxSkor3PilarRentang > 0 ? Math.round((globalTotalSkor3PilarRentang / globalMaxSkor3PilarRentang) * 1000) / 10 : (isAllBimb ? 100 : 0);

        return {
          prodiReportList,
          semesters: allSemesters,
          activeSemesterId: targetSemesterId,
          startDate: targetStartDate,
          endDate: targetEndDate,
          targetSesi,
          targetJenisKelas: normalizedJenisKelas || "ALL",
          globalSummary: {
            totalProdi: allProdi.length,
            totalKelasSemua: globalTotalKelas,
            totalDosenSemua: globalTotalDosen,
            totalSesiRentangSemua: globalTotalSesiRentang,
            avgKehadiranRentangSemua,
            avgKontenRentangSemua,
            totalConfRentangSemua: globalTotalConfRentang,
            totalGantiHariRentangSemua: globalTotalGantiHariRentang,
          },
        };
      }

      // ── SLOW/FALLBACK PATH: Custom Date Range (Mingguan) ──
      let startDateTime: Date | null = null;
      let endDateTime: Date | null = null;

      if (!isSesiMode && !isAllTime && targetStartDate && targetEndDate) {
        startDateTime = new Date(`${targetStartDate}T00:00:00.000Z`);
        endDateTime = new Date(`${targetEndDate}T23:59:59.999Z`);
      }

      // Pruned Lean Query: Memangkas relasi nested yang tidak dipakai
      const rawClasses = await prisma.kelas.findMany({
      where: {
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
        ...(isRestricted ? { mataKuliah: { prodiId: { in: allowedProdiIds! } } } : {}),
        ...(normalizedJenisKelas ? { modePembelajaran: normalizedJenisKelas as any } : {}),
      },
      select: {
        id: true,
        kodeKelas: true,
        jadwalHari: true,
        jadwalJam: true,
        modePembelajaran: true,
        semester: {
          select: {
            tanggalMulai: true,
            hariLibur: true,
          },
        },
        mataKuliah: {
          select: {
            prodiId: true,
            nama: true,
            kode: true,
          },
        },
        dosen: {
          select: {
            id: true,
            nama: true,
            nidn: true,
          },
        },
        dosen2: {
          select: {
            id: true,
            nama: true,
            nidn: true,
          },
        },
        monitoringSesi: {
          select: {
            id: true,
            nomorSesi: true,
            kehadiran: true,
            slide: true,
            lectureNote: true,
            video: true,
            conference: true,
            tugas: true,
            kuis: true,
            catatanCdu: true,
            tanggal: true,
            statusPengajar: true,
            dosenPengajarId: true,
            dosenPengajar: {
              select: {
                id: true,
                nama: true,
                nidn: true,
              },
            },
          },
          orderBy: { nomorSesi: "asc" },
        },
      },
    });

    const prodiMap = new Map<string, any>();

    for (const p of allProdi) {
      prodiMap.set(p.id, {
        id: p.id,
        nama: p.nama,
        kode: p.kode,
        fakultasNama: p.fakultas?.nama,
        totalKelas: 0,
        totalKelasNonBimbingan: 0,
        totalDosen: p._count.dosen,

        // Range stats
        totalSesiRentang: 0,
        totalHadirRentang: 0,
        totalHadirTdkLengkapRentang: 0,
        totalAlphaRentang: 0,
        totalBelumDiisiRentang: 0,
        totalGantiHariRentang: 0,
        totalRegularSesiRentang: 0,
        totalSkor3PilarRentang: 0,
        totalPilar1Rentang: 0,
        totalPilar2Rentang: 0,
        totalPilar3Rentang: 0,
        totalConfRentang: 0,
        dosenIdsRentang: new Set<string>(),
        dosenSemesterIds: new Set<string>(),
        kelasIdsRentang: new Set<string>(),
        kendalaList: [] as KendalaKehadiranItem[],

        // Semester stats
        totalHadirSemester: 0,
        totalAlphaSemester: 0,
        totalSkor3PilarSemester: 0,
        maxSkor3PilarSemester: 0,
        maxSkor3PilarRentang: 0,
      });
    }

    for (const cls of rawClasses) {
      const prodiId = cls.mataKuliah.prodiId;
      if (!prodiMap.has(prodiId)) continue;
      const entry = prodiMap.get(prodiId);
      entry.totalKelas++;
      entry.dosenSemesterIds.add(cls.dosen.id);
      if (cls.dosen2?.id) {
        entry.dosenSemesterIds.add(cls.dosen2.id);
      }

      const isBimbingan = (cls.modePembelajaran as any) === "BIMBINGAN";
      if (!isBimbingan) {
        entry.totalKelasNonBimbingan++;
      }

      const classSummary = calculateClassSummary(cls.monitoringSesi as any, cls.modePembelajaran as any);
      entry.totalHadirSemester += classSummary.totalHadir;
      entry.totalAlphaSemester += classSummary.totalAlpha;
      if (!isBimbingan) {
        entry.totalSkor3PilarSemester += classSummary.totalSkor3Pilar;
        entry.maxSkor3PilarSemester += (cls.modePembelajaran === "LURING" ? 28 : 42);
      }

      // Cari sesi berjalan tertinggi di kelas ini (sesi terisi atau ada catatan khusus)
      const filledOrNotedSessions = cls.monitoringSesi.filter(
        (s) => s.kehadiran !== "BELUM_DIISI" || (s.catatanCdu !== null && s.catatanCdu.trim() !== "")
      );
      const maxSesiBerjalan =
        filledOrNotedSessions.length > 0
          ? Math.max(...filledOrNotedSessions.map((s) => s.nomorSesi))
          : 1;

      for (const s of cls.monitoringSesi) {
        let isInRange = true;
        let effectiveDate: Date | null = s.tanggal ? new Date(s.tanggal) : null;

        if (isSesiMode) {
          isInRange = s.nomorSesi === targetSesi;
        } else {
          const semStartStr = cls.semester?.tanggalMulai
            ? new Date(cls.semester.tanggalMulai).toISOString().split("T")[0]
            : DEFAULT_SEMESTER_START_DATE;

          const estimatedDate = getEstimatedSessionDate(s.nomorSesi, cls.jadwalHari, semStartStr, (cls.semester as any)?.hariLibur);

          if (!effectiveDate) {
            effectiveDate = estimatedDate;
          }

          if (startDateTime && endDateTime) {
            isInRange = effectiveDate >= startDateTime && effectiveDate <= endDateTime;
          } else {
            // Jika filter All Time: sesi masa depan yang belum tiba dan tanpa catatan tidak dihitung di rentang
            const isFuture = s.kehadiran === "BELUM_DIISI" && !s.catatanCdu && s.nomorSesi > maxSesiBerjalan;
            isInRange = !isFuture;
          }
        }

        // Cek apakah sesi ini berstatus Ganti Hari (tanggal bergeser atau memiliki catatan ganti hari)
        const semStartStr = cls.semester?.tanggalMulai
          ? new Date(cls.semester.tanggalMulai).toISOString().split("T")[0]
          : DEFAULT_SEMESTER_START_DATE;
        const estimatedDate = getEstimatedSessionDate(s.nomorSesi, cls.jadwalHari, semStartStr, (cls.semester as any)?.hariLibur);
        const defDateStr = estimatedDate ? estimatedDate.toISOString().split("T")[0] : null;
        const sessionDateStr = s.tanggal ? new Date(s.tanggal).toISOString().split("T")[0] : null;
        const isDateDifferent = Boolean(sessionDateStr && defDateStr && sessionDateStr !== defDateStr);

        const isGantiHari = isDateDifferent || (s.catatanCdu ? /ganti|reschedule|tunda/i.test(s.catatanCdu) : false);

        if (isSesiMode) {
          if (isInRange && isGantiHari) {
            entry.totalGantiHariRentang++;
          }
        } else {
          const isOrigScheduleInRange = estimatedDate
            ? (startDateTime && endDateTime ? (estimatedDate >= startDateTime && estimatedDate <= endDateTime) : true)
            : false;

          if (isGantiHari && (isInRange || isOrigScheduleInRange)) {
            entry.totalGantiHariRentang++;
          }
        }

        if (isInRange) {
          entry.totalSesiRentang++;
          entry.kelasIdsRentang.add(cls.id);

          const isSub = s.dosenPengajar && s.statusPengajar && s.statusPengajar !== "UTAMA";
          const pengajarId = isSub ? s.dosenPengajar!.id : cls.dosen.id;
          const pengajarNama = isSub ? s.dosenPengajar!.nama : cls.dosen.nama;
          const pengajarNidn = isSub ? s.dosenPengajar!.nidn ?? null : cls.dosen.nidn ?? null;

          entry.dosenIdsRentang.add(pengajarId);

          const isHadir = s.kehadiran === "HADIR";
          const isHadirTdkLengkap = s.kehadiran === "HADIR_TIDAK_LENGKAP";
          const isAlpha = s.kehadiran === "TIDAK_HADIR";
          const hasCatatan = Boolean(s.catatanCdu && s.catatanCdu.trim() !== "");

          if (isHadir) {
            entry.totalHadirRentang++;
          } else if (isHadirTdkLengkap) {
            entry.totalHadirTdkLengkapRentang++;
            // HTL MASUK KENDALA (Konten Perkuliahan Belum Lengkap)
            entry.kendalaList.push({
              sesiId: s.id,
              nomorSesi: s.nomorSesi,
              status: "HTL",
              catatan: s.catatanCdu ?? null,
              dosenId: pengajarId,
              dosenNama: pengajarNama,
              dosenNidn: pengajarNidn,
              mataKuliahNama: cls.mataKuliah.nama,
              mataKuliahKode: cls.mataKuliah.kode,
              kelasKode: cls.kodeKelas,
              kelasId: cls.id,
              jadwalHari: cls.jadwalHari,
              jadwalJam: cls.jadwalJam,
              tanggal: s.tanggal ? new Date(s.tanggal).toISOString() : (effectiveDate ? effectiveDate.toISOString() : null),
            });
          } else if (isAlpha) {
            entry.totalAlphaRentang++;
            // ALPHA SELALU MASUK KENDALA
            entry.kendalaList.push({
              sesiId: s.id,
              nomorSesi: s.nomorSesi,
              status: "ALPHA",
              catatan: s.catatanCdu ?? null,
              dosenId: pengajarId,
              dosenNama: pengajarNama,
              dosenNidn: pengajarNidn,
              mataKuliahNama: cls.mataKuliah.nama,
              mataKuliahKode: cls.mataKuliah.kode,
              kelasKode: cls.kodeKelas,
              kelasId: cls.id,
              jadwalHari: cls.jadwalHari,
              jadwalJam: cls.jadwalJam,
              tanggal: s.tanggal ? new Date(s.tanggal).toISOString() : null,
            });
          } else {
            entry.totalBelumDiisiRentang++;

            const isKendalaBelumDiisi = isSesiMode
              ? true
              : (startDateTime && endDateTime)
              ? true
              : (hasCatatan || s.nomorSesi <= maxSesiBerjalan);

            if (isKendalaBelumDiisi) {
              entry.kendalaList.push({
                sesiId: s.id,
                nomorSesi: s.nomorSesi,
                status: "BELUM_DIISI",
                catatan: s.catatanCdu ?? null,
                dosenId: pengajarId,
                dosenNama: pengajarNama,
                dosenNidn: pengajarNidn,
                mataKuliahNama: cls.mataKuliah.nama,
                mataKuliahKode: cls.mataKuliah.kode,
                kelasKode: cls.kodeKelas,
                kelasId: cls.id,
                jadwalHari: cls.jadwalHari,
                jadwalJam: cls.jadwalJam,
                tanggal: s.tanggal ? new Date(s.tanggal).toISOString() : (effectiveDate ? effectiveDate.toISOString() : null),
              });
            }
          }

          const pilar = calculateSessionPillars(s, cls.modePembelajaran as any);
          if (!isBimbingan && !pilar.isExam) {
            entry.totalRegularSesiRentang++;
            if (pilar.score !== null) {
              entry.totalSkor3PilarRentang += pilar.score;
              entry.maxSkor3PilarRentang += pilar.maxScore;
            }
            if (pilar.hasSL) entry.totalPilar1Rentang++;
            if (pilar.hasQT) entry.totalPilar2Rentang++;
            if (pilar.hasTV) entry.totalPilar3Rentang++;
          }

          if (s.conference) entry.totalConfRentang++;
        }
      }
    }

    let globalTotalSesiRentang = 0;
    let globalTotalHadirRentang = 0;
    let globalTotalRegularSesiRentang = 0;
    let globalTotalSkor3PilarRentang = 0;
    let globalMaxSkor3PilarRentang = 0;
    let globalTotalConfRentang = 0;
    let globalTotalKelas = 0;
    let globalTotalDosen = 0;
    let globalTotalGantiHariRentang = 0;

    const prodiReportList: ProdiReportItem[] = Array.from(prodiMap.values()).map((p) => {
      const hasKelas = p.totalKelas > 0;
      const hasSesi = p.totalSesiRentang > 0;

      const avgKehadiranRentang = hasSesi
        ? Math.round(((p.totalHadirRentang + p.totalHadirTdkLengkapRentang) / p.totalSesiRentang) * 1000) / 10
        : (hasKelas ? 0 : null);

      const avgKontenRentang =
        p.maxSkor3PilarRentang > 0
          ? Math.round((p.totalSkor3PilarRentang / p.maxSkor3PilarRentang) * 1000) / 10
          : (hasKelas ? (p.totalKelasNonBimbingan === 0 ? 100 : 0) : null);

      const avgKehadiranSemester =
        hasKelas ? Math.round((p.totalHadirSemester / (p.totalKelas * 16)) * 1000) / 10 : null;
      const avgKontenSemester =
        hasKelas
          ? (p.maxSkor3PilarSemester > 0
              ? Math.round((p.totalSkor3PilarSemester / p.maxSkor3PilarSemester) * 1000) / 10
              : 100)
          : null;

      let statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" | "BELUM_ADA_KELAS" = "SANGAT_BAIK";
      if (!hasKelas) {
        statusKinerjaRentang = "BELUM_ADA_KELAS";
      } else if (p.totalSesiRentang === 0) {
        statusKinerjaRentang = "BAIK";
      } else if (
        (avgKehadiranRentang ?? 0) < 75 ||
        (p.totalKelasNonBimbingan > 0 && (avgKontenRentang ?? 0) < 60) ||
        p.totalAlphaRentang >= 2 ||
        p.totalHadirTdkLengkapRentang >= 5
      ) {
        statusKinerjaRentang = "PERLU_PEMBINAAN";
      } else if (
        (avgKehadiranRentang ?? 0) < 90 ||
        (p.totalKelasNonBimbingan > 0 && (avgKontenRentang ?? 0) < 80) ||
        p.totalHadirTdkLengkapRentang >= 2
      ) {
        statusKinerjaRentang = "BAIK";
      }

      const finalTotalDosen = normalizedJenisKelas ? p.dosenSemesterIds.size : p.totalDosen;

      globalTotalSesiRentang += p.totalSesiRentang;
      globalTotalHadirRentang += p.totalHadirRentang + p.totalHadirTdkLengkapRentang;
      globalTotalRegularSesiRentang += p.totalRegularSesiRentang;
      globalTotalSkor3PilarRentang += p.totalSkor3PilarRentang;
      globalMaxSkor3PilarRentang += p.maxSkor3PilarRentang;
      globalTotalConfRentang += p.totalConfRentang;
      globalTotalKelas += p.totalKelas;
      globalTotalDosen += finalTotalDosen;
      globalTotalGantiHariRentang += p.totalGantiHariRentang;

      return {
        id: p.id,
        nama: p.nama,
        kode: p.kode,
        fakultasNama: p.fakultasNama,
        totalSesiRentang: p.totalSesiRentang,
        totalHadirRentang: p.totalHadirRentang,
        totalHadirTdkLengkapRentang: p.totalHadirTdkLengkapRentang,
        totalAlphaRentang: p.totalAlphaRentang,
        totalBelumDiisiRentang: p.totalBelumDiisiRentang,
        totalGantiHariRentang: p.totalGantiHariRentang,
        avgKehadiranRentang,
        totalRegularSesiRentang: p.totalRegularSesiRentang,
        totalSkor3PilarRentang: p.totalSkor3PilarRentang,
        maxSkor3PilarRentang: p.maxSkor3PilarRentang,
        avgKontenRentang,
        totalPilar1Rentang: p.totalPilar1Rentang,
        totalPilar2Rentang: p.totalPilar2Rentang,
        totalPilar3Rentang: p.totalPilar3Rentang,
        totalConfRentang: p.totalConfRentang,
        totalDosenAktifRentang: p.dosenIdsRentang.size,
        totalKelasAktifRentang: p.kelasIdsRentang.size,
        statusKinerjaRentang,
        kendalaList: p.kendalaList,

        totalKelas: p.totalKelas,
        totalKelasNonBimbingan: p.totalKelasNonBimbingan,
        totalDosen: finalTotalDosen,
        avgKehadiranSemester,
        avgKontenSemester,
      };
    });

    const avgKehadiranRentangSemua =
      globalTotalSesiRentang > 0
        ? Math.round((globalTotalHadirRentang / globalTotalSesiRentang) * 1000) / 10
        : 0;

    const activeProdiList = prodiReportList.filter((p) => p.totalKelas > 0);
    const isAllBimbingan =
      normalizedJenisKelas === "BIMBINGAN" ||
      (activeProdiList.length > 0 && activeProdiList.every((p) => p.totalKelasNonBimbingan === 0));

    const avgKontenRentangSemua =
      globalMaxSkor3PilarRentang > 0
        ? Math.round((globalTotalSkor3PilarRentang / globalMaxSkor3PilarRentang) * 1000) / 10
        : (isAllBimbingan ? 100 : 0);

    const responseData = {
      prodiReportList,
      semesters: allSemesters,
      activeSemesterId: targetSemesterId || allSemesters[0]?.id || "",
      startDate: targetStartDate,
      endDate: targetEndDate,
      targetSesi,
      targetJenisKelas: normalizedJenisKelas || "ALL",
      globalSummary: {
        totalProdi: prodiReportList.length,
        totalKelasSemua: globalTotalKelas,
        totalDosenSemua: globalTotalDosen,
        totalSesiRentangSemua: globalTotalSesiRentang,
        avgKehadiranRentangSemua,
        avgKontenRentangSemua,
        totalConfRentangSemua: globalTotalConfRentang,
        totalGantiHariRentangSemua: globalTotalGantiHariRentang,
      },
    };

      return responseData;
    });

    return {
      success: true,
      data: responseData,
    };
  } catch (error: any) {
    console.error("getLaporanProdi error:", error);
    return { success: false, error: error.message || "Gagal memproses laporan prodi" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODUL LAPORAN PER FAKULTAS (EXECUTIVE DASHBOARD VIEW)
// ─────────────────────────────────────────────────────────────────────────────

const FAKULTAS_ABBREVIATIONS: Record<string, string> = {
  "Fakultas Ekonomi dan bisnis": "FEB",
  "Fakultas Ekonomi dan Bisnis": "FEB",
  "Fakultas Teknik dan Teknologi Hayati": "FTTH",
  "Fakultas Komputer dan Desain": "FKD",
  "Fakultas Kedokteran dan Ilmu Kesehatan": "FKIK",
  "Fakultas Hukum": "FH",
  "Fakultas Keguruan dan Ilmu Pendidikan": "FKIP",
  "Fakultas Ilmu Sosial dan Ilmu Politik": "FISIP",
};

function getFakultasAbbr(nama: string): string {
  if (FAKULTAS_ABBREVIATIONS[nama]) return FAKULTAS_ABBREVIATIONS[nama];
  const cleaned = nama.replace(/Fakultas/i, "").replace(/dan|ilmu/gi, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const acronym = words.map((w) => w[0]?.toUpperCase() || "").join("");
  return acronym ? `F${acronym}` : "FAK";
}

export interface FakultasProdiBreakdownItem {
  id: string;
  kode: string;
  nama: string;
  totalKelas: number;
  totalKelasAktifRentang: number;
  totalDosen: number;
  totalDosenAktifRentang: number;
  totalSesiRentang: number;
  totalHadirRentang: number;
  totalAlphaRentang: number;
  totalHadirTdkLengkapRentang: number;
  totalGantiHariRentang: number;
  avgKehadiranRentang: number | null;
  avgKontenRentang: number | null;
  statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" | "BELUM_ADA_KELAS";
  kendalaCount: number;
}

export interface FakultasReportItem {
  id: string;
  nama: string;
  singkatan: string;
  totalProdi: number;
  prodiSehatCount: number;
  prodiPerhatianCount: number;
  prodiBelumAdaKelasCount: number;

  // Rentang Tanggal (Mingguan / Sesi)
  totalSesiRentang: number;
  totalHadirRentang: number;
  totalHadirTdkLengkapRentang: number;
  totalAlphaRentang: number;
  totalBelumDiisiRentang: number;
  totalGantiHariRentang: number;
  avgKehadiranRentang: number | null;

  totalRegularSesiRentang: number;
  totalSkor3PilarRentang: number;
  maxSkor3PilarRentang: number;
  avgKontenRentang: number | null;
  totalPilar1Rentang: number;
  totalPilar2Rentang: number;
  totalPilar3Rentang: number;
  totalConfRentang: number;

  totalDosenAktifRentang: number;
  totalKelasAktifRentang: number;
  statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" | "BELUM_ADA_KELAS";

  // Drilldown per Prodi di dalam Fakultas
  prodiBreakdownList: FakultasProdiBreakdownItem[];

  // Sesi Kendala (Alpha, HTL, Belum Diisi) di fakultas ini
  kendalaList: KendalaKehadiranItem[];

  // Semester Total (Referensi)
  totalKelas: number;
  totalKelasNonBimbingan: number;
  totalDosen: number;
  avgKehadiranSemester: number | null;
  avgKontenSemester: number | null;
}

export interface LaporanFakultasResponse {
  success: boolean;
  error?: string;
  data?: {
    fakultasReportList: FakultasReportItem[];
    semesters: Array<{
      id: string;
      tahunAkademik: string;
      periode: string;
      aktif: boolean;
    }>;
    activeSemesterId: string;
    startDate: string;
    endDate: string;
    targetSesi?: number | null;
    targetJenisKelas?: string;
    globalSummary: {
      totalFakultas: number;
      totalProdiSemua: number;
      totalKelasSemua: number;
      totalDosenSemua: number;
      totalSesiRentangSemua: number;
      avgKehadiranRentangSemua: number;
      avgKontenRentangSemua: number;
      totalConfRentangSemua: number;
      totalGantiHariRentangSemua?: number;
    };
  };
}

export async function getLaporanFakultas(
  semesterId?: string,
  startDate?: string,
  endDate?: string,
  allowedProdiIds?: string[],
  sesiNumber?: number,
  jenisKelas?: string
): Promise<LaporanFakultasResponse> {
  try {
    const session = await auth();
    if ((session?.user as any)?.role === "DOSEN") {
      return {
        success: false,
        error: "Akses ditolak. Laporan tingkat Fakultas hanya dapat diakses oleh Admin QAU atau Super Admin.",
      };
    }

    const isSesiMode = Boolean(sesiNumber && sesiNumber >= 1 && sesiNumber <= 16);
    const targetSesi = isSesiMode ? (sesiNumber as number) : null;
    const isAllTime = !isSesiMode && !startDate && !endDate;
    const targetStartDate = !isSesiMode ? (startDate || "") : "";
    const targetEndDate = !isSesiMode ? (endDate || "") : "";

    const normalizedJenisKelas =
      jenisKelas && jenisKelas !== "ALL"
        ? jenisKelas === "OFFLINE" || jenisKelas === "LURING"
          ? "LURING"
          : jenisKelas === "ONLINE" || jenisKelas === "DARING"
          ? "DARING"
          : jenisKelas === "BIMBINGAN"
          ? "BIMBINGAN"
          : null
        : null;

    const isRestricted = Boolean(allowedProdiIds && allowedProdiIds.length > 0);

    // Optimasi: Ambil allSemesters & allFakultas secara paralel
    const [allSemesters, rawAllFakultas] = await Promise.all([
      prisma.semester.findMany({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
      }),
      prisma.fakultas.findMany({
        include: {
          prodi: {
            where: { isActive: true },
            orderBy: { nama: "asc" },
          },
        },
        orderBy: { nama: "asc" },
      }),
    ]);

    // Jika dibatasi prodi tertentu, saring prodi di dalam fakultas
    const allFakultas = isRestricted
      ? rawAllFakultas
          .map((f) => ({
            ...f,
            prodi: f.prodi.filter((p) => allowedProdiIds!.includes(p.id)),
          }))
          .filter((f) => f.prodi.length > 0)
      : rawAllFakultas;

    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];
    const targetSemesterId = semesterId || activeSemester?.id || "NONE";

    const sortedAllowed = allowedProdiIds ? [...allowedProdiIds].sort().join(",") : "";
    const cacheKey = `fakultas_${targetSemesterId}_${targetStartDate || "ALL"}_${targetEndDate || "ALL"}_sesi${targetSesi || "NONE"}_${sortedAllowed}_mode${normalizedJenisKelas || "ALL"}`;

    const responseData = await fetchWithSingleFlightCache<any>(cacheKey, async () => {
      // Reuse getLaporanProdi result (memanfaatkan shared cache & SQL aggregation)
      const prodiRes = await getLaporanProdi(
        semesterId,
        startDate,
        endDate,
        allowedProdiIds,
        sesiNumber,
        jenisKelas
      );

      if (!prodiRes.success || !prodiRes.data) {
        throw new Error(prodiRes.error || "Gagal memuat data laporan prodi untuk agregasi fakultas");
      }

      const prodiList = prodiRes.data.prodiReportList;

      let globalTotalSesiRentang = 0;
      let globalTotalHadirRentang = 0;
      let globalTotalRegularSesiRentang = 0;
      let globalTotalSkor3PilarRentang = 0;
      let globalMaxSkor3PilarRentang = 0;
      let globalTotalConfRentang = 0;
      let globalTotalKelas = 0;
      let globalTotalDosen = 0;
      let globalTotalGantiHariRentang = 0;
      let globalTotalProdi = 0;

      const fakultasReportList = allFakultas.map((f) => {
        const prodisInF = prodiList.filter((p) => f.prodi.some((fp) => fp.id === p.id));
        const totalKelas = prodisInF.reduce((acc, p) => acc + p.totalKelas, 0);
        const totalKelasNonBimbingan = prodisInF.reduce((acc, p) => acc + (p.totalKelasNonBimbingan || 0), 0);
        const totalSesiRentang = prodisInF.reduce((acc, p) => acc + p.totalSesiRentang, 0);
        const totalHadirRentang = prodisInF.reduce((acc, p) => acc + p.totalHadirRentang, 0);
        const totalHadirTdkLengkapRentang = prodisInF.reduce((acc, p) => acc + p.totalHadirTdkLengkapRentang, 0);
        const totalAlphaRentang = prodisInF.reduce((acc, p) => acc + p.totalAlphaRentang, 0);
        const totalBelumDiisiRentang = prodisInF.reduce((acc, p) => acc + p.totalBelumDiisiRentang, 0);
        const totalGantiHariRentang = prodisInF.reduce((acc, p) => acc + p.totalGantiHariRentang, 0);
        const totalRegularSesiRentang = prodisInF.reduce((acc, p) => acc + p.totalRegularSesiRentang, 0);
        const totalSkor3PilarRentang = prodisInF.reduce((acc, p) => acc + p.totalSkor3PilarRentang, 0);
        const maxSkor3PilarRentang = prodisInF.reduce((acc, p) => acc + p.maxSkor3PilarRentang, 0);
        const totalPilar1Rentang = prodisInF.reduce((acc, p) => acc + p.totalPilar1Rentang, 0);
        const totalPilar2Rentang = prodisInF.reduce((acc, p) => acc + p.totalPilar2Rentang, 0);
        const totalPilar3Rentang = prodisInF.reduce((acc, p) => acc + p.totalPilar3Rentang, 0);
        const totalConfRentang = prodisInF.reduce((acc, p) => acc + p.totalConfRentang, 0);
        const totalDosen = prodisInF.reduce((acc, p) => acc + p.totalDosen, 0);

        const prodiPerhatianCount = prodisInF.filter((p) => p.statusKinerjaRentang === "PERLU_PEMBINAAN").length;
        const prodiSehatCount = prodisInF.filter((p) => p.statusKinerjaRentang === "SANGAT_BAIK" || p.statusKinerjaRentang === "BAIK").length;
        const prodiBelumAdaKelasCount = prodisInF.filter((p) => p.totalKelas === 0).length;

        const hasSesi = totalSesiRentang > 0;
        const hasKelas = totalKelas > 0;

        const avgKehadiranRentang = hasSesi
          ? Math.round(((totalHadirRentang + totalHadirTdkLengkapRentang) / totalSesiRentang) * 1000) / 10
          : hasKelas ? 0 : null;

        const avgKontenRentang = maxSkor3PilarRentang > 0
          ? Math.round((totalSkor3PilarRentang / maxSkor3PilarRentang) * 1000) / 10
          : hasKelas ? (totalKelasNonBimbingan === 0 ? 100 : 0) : null;

        let statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" | "BELUM_ADA_KELAS" = "SANGAT_BAIK";
        if (!hasKelas) {
          statusKinerjaRentang = "BELUM_ADA_KELAS";
        } else if (totalSesiRentang === 0) {
          statusKinerjaRentang = "BAIK";
        } else if (
          (avgKehadiranRentang ?? 0) < 75 ||
          (totalKelasNonBimbingan > 0 && (avgKontenRentang ?? 0) < 60) ||
          (prodiPerhatianCount > 0 && prodiPerhatianCount >= f.prodi.length / 2)
        ) {
          statusKinerjaRentang = "PERLU_PEMBINAAN";
        } else if (
          (avgKehadiranRentang ?? 0) < 90 ||
          (totalKelasNonBimbingan > 0 && (avgKontenRentang ?? 0) < 80) ||
          prodiPerhatianCount > 0
        ) {
          statusKinerjaRentang = "BAIK";
        }

        globalTotalSesiRentang += totalSesiRentang;
        globalTotalHadirRentang += (totalHadirRentang + totalHadirTdkLengkapRentang);
        globalTotalRegularSesiRentang += totalRegularSesiRentang;
        globalTotalSkor3PilarRentang += totalSkor3PilarRentang;
        globalMaxSkor3PilarRentang += maxSkor3PilarRentang;
        globalTotalConfRentang += totalConfRentang;
        globalTotalKelas += totalKelas;
        globalTotalDosen += totalDosen;
        globalTotalGantiHariRentang += totalGantiHariRentang;
        globalTotalProdi += f.prodi.length;

        const prodiListDetailed = prodisInF.map((p) => ({
          id: p.id,
          nama: p.nama,
          kode: p.kode,
          totalKelas: p.totalKelas,
          totalSesiRentang: p.totalSesiRentang,
          totalHadirRentang: p.totalHadirRentang,
          totalAlphaRentang: p.totalAlphaRentang,
          totalHadirTdkLengkapRentang: p.totalHadirTdkLengkapRentang,
          totalGantiHariRentang: p.totalGantiHariRentang,
          avgKehadiranRentang: p.avgKehadiranRentang,
          avgKontenRentang: p.avgKontenRentang,
          statusKinerjaRentang: p.statusKinerjaRentang,
          kendalaCount: p.kendalaList?.length || 0,
        }));

        return {
          id: f.id,
          nama: f.nama,
          singkatan: FAKULTAS_ABBREVIATIONS[f.nama] || f.nama.split(" ").filter((w) => w.length > 2 && w !== "dan").map((w) => w[0].toUpperCase()).join(""),
          totalProdi: f.prodi.length,
          prodiSehatCount,
          prodiPerhatianCount,
          prodiBelumAdaKelasCount,
          totalSesiRentang,
          totalHadirRentang,
          totalHadirTdkLengkapRentang,
          totalAlphaRentang,
          totalBelumDiisiRentang,
          totalGantiHariRentang,
          avgKehadiranRentang,
          totalRegularSesiRentang,
          totalSkor3PilarRentang,
          maxSkor3PilarRentang,
          avgKontenRentang,
          totalPilar1Rentang,
          totalPilar2Rentang,
          totalPilar3Rentang,
          totalConfRentang,
          totalDosen,
          totalKelas,
          totalKelasNonBimbingan,
          statusKinerjaRentang,
          prodiList: prodiListDetailed,
        };
      });

      const avgKehadiranRentangSemua = globalTotalSesiRentang > 0 ? Math.round((globalTotalHadirRentang / globalTotalSesiRentang) * 1000) / 10 : 0;
      const isAllBimbingan = normalizedJenisKelas === "BIMBINGAN";
      const avgKontenRentangSemua = globalMaxSkor3PilarRentang > 0 ? Math.round((globalTotalSkor3PilarRentang / globalMaxSkor3PilarRentang) * 1000) / 10 : (isAllBimbingan ? 100 : 0);

      return {
        fakultasReportList,
        semesters: allSemesters,
        activeSemesterId: targetSemesterId || allSemesters[0]?.id || "",
        startDate: targetStartDate,
        endDate: targetEndDate,
        targetSesi,
        targetJenisKelas: normalizedJenisKelas || "ALL",
        globalSummary: {
          totalFakultas: fakultasReportList.length,
          totalProdiSemua: globalTotalProdi,
          totalKelasSemua: globalTotalKelas,
          totalDosenSemua: globalTotalDosen,
          totalSesiRentangSemua: globalTotalSesiRentang,
          avgKehadiranRentangSemua,
          avgKontenRentangSemua,
          totalConfRentangSemua: globalTotalConfRentang,
          totalGantiHariRentangSemua: globalTotalGantiHariRentang,
        },
      };
    });

    return {
      success: true,
      data: responseData,
    };
  } catch (error: any) {
    console.error("getLaporanFakultas error:", error);
    return { success: false, error: error.message || "Gagal memproses laporan fakultas" };
  }
}


