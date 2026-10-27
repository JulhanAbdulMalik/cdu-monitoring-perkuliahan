"use server";
// src/actions/laporan.ts
// Server Actions untuk Rekapitulasi Monitoring, Laporan Dosen & Laporan Prodi (3-Pillar & Mode-Aware)

import { prisma } from "@/lib/prisma";
import { calculateSessionPillars, calculateClassSummary } from "@/lib/score-calculator";
import {
  getWeekDates,
  getEstimatedSessionDate,
  getCurrentActiveSessionNumber,
  DEFAULT_SEMESTER_START_DATE,
} from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// SMART IN-MEMORY CACHE STORE UNTUK MODUL LAPORAN (REKAP, DOSEN, PRODI)
// ─────────────────────────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const LAPORAN_CACHE_TTL_MS = 30 * 1000; // 30 detik (sebelumnya 10 menit) agar sinkronisasi master data responsif
const laporanCacheStore = new Map<string, CacheEntry<any>>();

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
  // Jaga ukuran cache maksimal 30 entries agar memori RAM tetap sangat hemat
  if (laporanCacheStore.size >= 30) {
    const oldestKey = laporanCacheStore.keys().next().value;
    if (oldestKey) laporanCacheStore.delete(oldestKey);
  }
  laporanCacheStore.set(key, { data, timestamp: Date.now() });
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

    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];
    const targetSemesterId = semesterId || activeSemester?.id || "NONE";

    const isRestricted = Boolean(allowedProdiIds && allowedProdiIds.length > 0);
    const sortedAllowed = allowedProdiIds ? [...allowedProdiIds].sort().join(",") : "";
    const cacheKey = `rekap_${targetSemesterId}_${prodiId || "ALL"}_${sortedAllowed}`;

    const cached = getLaporanFromCache<RekapLaporanResultData>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

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

    const responseData = {
      rekapList: summaries,
      semesters: allSemesters,
      prodiList: allProdi,
      activeSemesterId: activeSemester?.id || allSemesters[0]?.id,
      currentActiveSesi,
    };

    setLaporanToCache(cacheKey, responseData);

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

    const cached = getLaporanFromCache<LaporanDosenResultData>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    const rekapRes = await getRekapLaporan(semesterId, prodiId, allowedProdiIds);
    if (!rekapRes.success || !rekapRes.data) {
      return { success: false, error: "Gagal memuat data laporan dosen" };
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

    const responseData = {
      dosenReportList,
      semesters,
      prodiList,
      activeSemesterId,
    };

    setLaporanToCache(cacheKey, responseData);

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
          dosen: true,
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

    const cached = getLaporanFromCache<any>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

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
        totalDosen: p.dosen.length,

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

    setLaporanToCache(cacheKey, responseData);

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
            include: {
              dosen: true,
            },
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

    const cached = getLaporanFromCache<any>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;

    if (!isSesiMode && !isAllTime && targetStartDate && targetEndDate) {
      startDateTime = new Date(`${targetStartDate}T00:00:00.000Z`);
      endDateTime = new Date(`${targetEndDate}T23:59:59.999Z`);
    }

    // Ambil data perkuliahan pada semester target
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
            prodi: {
              select: {
                id: true,
                nama: true,
                kode: true,
                fakultasId: true,
              },
            },
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

    // Inisialisasi Map Fakultas dan Sub-map Prodi
    const fakultasMap = new Map<string, any>();
    const prodiToFakultasIdMap = new Map<string, string>();

    for (const f of allFakultas) {
      const prodiMap = new Map<string, any>();
      const facultyDosenSet = new Set<string>();

      for (const p of f.prodi) {
        prodiToFakultasIdMap.set(p.id, f.id);
        p.dosen.forEach((d) => facultyDosenSet.add(d.id));

        prodiMap.set(p.id, {
          id: p.id,
          kode: p.kode,
          nama: p.nama,
          totalKelas: 0,
          totalKelasNonBimbingan: 0,
          totalDosen: p.dosen.length,
          dosenSemesterIds: new Set<string>(),

          totalSesiRentang: 0,
          totalHadirRentang: 0,
          totalHadirTdkLengkapRentang: 0,
          totalAlphaRentang: 0,
          totalBelumDiisiRentang: 0,
          totalGantiHariRentang: 0,
          totalRegularSesiRentang: 0,
          totalSkor3PilarRentang: 0,
          maxSkor3PilarRentang: 0,
          totalPilar1Rentang: 0,
          totalPilar2Rentang: 0,
          totalPilar3Rentang: 0,
          totalConfRentang: 0,
          dosenIdsRentang: new Set<string>(),
          kelasIdsRentang: new Set<string>(),
          kendalaCount: 0,
        });
      }

      fakultasMap.set(f.id, {
        id: f.id,
        nama: f.nama,
        singkatan: getFakultasAbbr(f.nama),
        totalProdi: f.prodi.length,
        prodiMap,
        facultyDosenSet,
        dosenSemesterIds: new Set<string>(),

        totalKelas: 0,
        totalKelasNonBimbingan: 0,

        totalSesiRentang: 0,
        totalHadirRentang: 0,
        totalHadirTdkLengkapRentang: 0,
        totalAlphaRentang: 0,
        totalBelumDiisiRentang: 0,
        totalGantiHariRentang: 0,
        totalRegularSesiRentang: 0,
        totalSkor3PilarRentang: 0,
        maxSkor3PilarRentang: 0,
        totalPilar1Rentang: 0,
        totalPilar2Rentang: 0,
        totalPilar3Rentang: 0,
        totalConfRentang: 0,
        dosenIdsRentang: new Set<string>(),
        kelasIdsRentang: new Set<string>(),
        kendalaList: [] as KendalaKehadiranItem[],

        totalHadirSemester: 0,
        totalAlphaSemester: 0,
        totalSkor3PilarSemester: 0,
        maxSkor3PilarSemester: 0,
      });
    }

    // Iterasi setiap kelas
    for (const cls of rawClasses) {
      const prodiId = cls.mataKuliah.prodiId;
      const fakultasId = cls.mataKuliah.prodi?.fakultasId || prodiToFakultasIdMap.get(prodiId);
      if (!fakultasId || !fakultasMap.has(fakultasId)) continue;

      const fEntry = fakultasMap.get(fakultasId);
      const pEntry = fEntry.prodiMap.get(prodiId);

      const isBimbingan = (cls.modePembelajaran as any) === "BIMBINGAN";

      // Akumulasi kelas & dosen di tingkat Fakultas
      fEntry.totalKelas++;
      fEntry.dosenSemesterIds.add(cls.dosen.id);
      if (cls.dosen2?.id) fEntry.dosenSemesterIds.add(cls.dosen2.id);

      if (!isBimbingan) {
        fEntry.totalKelasNonBimbingan++;
      }

      // Akumulasi kelas & dosen di tingkat Prodi dalam Fakultas
      if (pEntry) {
        pEntry.totalKelas++;
        pEntry.dosenSemesterIds.add(cls.dosen.id);
        if (cls.dosen2?.id) pEntry.dosenSemesterIds.add(cls.dosen2.id);
        if (!isBimbingan) {
          pEntry.totalKelasNonBimbingan++;
        }
      }

      // Hitung ringkasan kelas semester
      const classSummary = calculateClassSummary(cls.monitoringSesi as any, cls.modePembelajaran as any);
      fEntry.totalHadirSemester += classSummary.totalHadir;
      fEntry.totalAlphaSemester += classSummary.totalAlpha;
      if (!isBimbingan) {
        fEntry.totalSkor3PilarSemester += classSummary.totalSkor3Pilar;
        fEntry.maxSkor3PilarSemester += cls.modePembelajaran === "LURING" ? 28 : 42;
      }

      // Sesi berjalan tertinggi
      const filledOrNotedSessions = cls.monitoringSesi.filter(
        (s) => s.kehadiran !== "BELUM_DIISI" || (s.catatanCdu !== null && s.catatanCdu.trim() !== "")
      );
      const maxSesiBerjalan =
        filledOrNotedSessions.length > 0
          ? Math.max(...filledOrNotedSessions.map((s) => s.nomorSesi))
          : 1;

      // Iterasi sesi perkuliahan
      for (const s of cls.monitoringSesi) {
        let isInRange = true;
        let effectiveDate: Date | null = s.tanggal ? new Date(s.tanggal) : null;

        if (isSesiMode) {
          isInRange = s.nomorSesi === targetSesi;
        } else {
          const semStartStr = cls.semester?.tanggalMulai
            ? new Date(cls.semester.tanggalMulai).toISOString().split("T")[0]
            : DEFAULT_SEMESTER_START_DATE;

          const estimatedDate = getEstimatedSessionDate(
            s.nomorSesi,
            cls.jadwalHari,
            semStartStr,
            (cls.semester as any)?.hariLibur
          );

          if (!effectiveDate) {
            effectiveDate = estimatedDate;
          }

          if (startDateTime && endDateTime) {
            isInRange = effectiveDate >= startDateTime && effectiveDate <= endDateTime;
          } else {
            const isFuture = s.kehadiran === "BELUM_DIISI" && !s.catatanCdu && s.nomorSesi > maxSesiBerjalan;
            isInRange = !isFuture;
          }
        }

        // Cek Ganti Hari
        const semStartStr = cls.semester?.tanggalMulai
          ? new Date(cls.semester.tanggalMulai).toISOString().split("T")[0]
          : DEFAULT_SEMESTER_START_DATE;
        const estimatedDate = getEstimatedSessionDate(
          s.nomorSesi,
          cls.jadwalHari,
          semStartStr,
          (cls.semester as any)?.hariLibur
        );
        const defDateStr = estimatedDate ? estimatedDate.toISOString().split("T")[0] : null;
        const sessionDateStr = s.tanggal ? new Date(s.tanggal).toISOString().split("T")[0] : null;
        const isDateDifferent = Boolean(sessionDateStr && defDateStr && sessionDateStr !== defDateStr);
        const isGantiHari = isDateDifferent || (s.catatanCdu ? /ganti|reschedule|tunda/i.test(s.catatanCdu) : false);

        if (isSesiMode) {
          if (isInRange && isGantiHari) {
            fEntry.totalGantiHariRentang++;
            if (pEntry) pEntry.totalGantiHariRentang++;
          }
        } else {
          const isOrigScheduleInRange = estimatedDate
            ? startDateTime && endDateTime
              ? estimatedDate >= startDateTime && estimatedDate <= endDateTime
              : true
            : false;

          if (isGantiHari && (isInRange || isOrigScheduleInRange)) {
            fEntry.totalGantiHariRentang++;
            if (pEntry) pEntry.totalGantiHariRentang++;
          }
        }

        if (isInRange) {
          fEntry.totalSesiRentang++;
          fEntry.kelasIdsRentang.add(cls.id);
          if (pEntry) {
            pEntry.totalSesiRentang++;
            pEntry.kelasIdsRentang.add(cls.id);
          }

          const isSub = s.dosenPengajar && s.statusPengajar && s.statusPengajar !== "UTAMA";
          const pengajarId = isSub ? s.dosenPengajar!.id : cls.dosen.id;
          const pengajarNama = isSub ? s.dosenPengajar!.nama : cls.dosen.nama;
          const pengajarNidn = isSub ? s.dosenPengajar!.nidn ?? null : cls.dosen.nidn ?? null;

          fEntry.dosenIdsRentang.add(pengajarId);
          if (pEntry) pEntry.dosenIdsRentang.add(pengajarId);

          const isHadir = s.kehadiran === "HADIR";
          const isHadirTdkLengkap = s.kehadiran === "HADIR_TIDAK_LENGKAP";
          const isAlpha = s.kehadiran === "TIDAK_HADIR";
          const hasCatatan = Boolean(s.catatanCdu && s.catatanCdu.trim() !== "");

          if (isHadir) {
            fEntry.totalHadirRentang++;
            if (pEntry) pEntry.totalHadirRentang++;
          } else if (isHadirTdkLengkap) {
            fEntry.totalHadirTdkLengkapRentang++;
            if (pEntry) {
              pEntry.totalHadirTdkLengkapRentang++;
              pEntry.kendalaCount++;
            }

            fEntry.kendalaList.push({
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
              tanggal: s.tanggal ? new Date(s.tanggal).toISOString() : effectiveDate ? effectiveDate.toISOString() : null,
              prodiNama: cls.mataKuliah.prodi?.nama || (pEntry ? pEntry.nama : undefined),
              prodiKode: cls.mataKuliah.prodi?.kode || (pEntry ? pEntry.kode : undefined),
            });
          } else if (isAlpha) {
            fEntry.totalAlphaRentang++;
            if (pEntry) {
              pEntry.totalAlphaRentang++;
              pEntry.kendalaCount++;
            }

            fEntry.kendalaList.push({
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
              prodiNama: cls.mataKuliah.prodi?.nama || (pEntry ? pEntry.nama : undefined),
              prodiKode: cls.mataKuliah.prodi?.kode || (pEntry ? pEntry.kode : undefined),
            });
          } else {
            fEntry.totalBelumDiisiRentang++;
            if (pEntry) pEntry.totalBelumDiisiRentang++;

            const isKendalaBelumDiisi = isSesiMode
              ? true
              : startDateTime && endDateTime
              ? true
              : hasCatatan || s.nomorSesi <= maxSesiBerjalan;

            if (isKendalaBelumDiisi) {
              if (pEntry) pEntry.kendalaCount++;
              fEntry.kendalaList.push({
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
                tanggal: s.tanggal ? new Date(s.tanggal).toISOString() : effectiveDate ? effectiveDate.toISOString() : null,
                prodiNama: cls.mataKuliah.prodi?.nama || (pEntry ? pEntry.nama : undefined),
                prodiKode: cls.mataKuliah.prodi?.kode || (pEntry ? pEntry.kode : undefined),
              });
            }
          }

          // 3 Pilar Kepatuhan
          const pilar = calculateSessionPillars(s, cls.modePembelajaran as any);
          if (!isBimbingan && !pilar.isExam) {
            fEntry.totalRegularSesiRentang++;
            if (pEntry) pEntry.totalRegularSesiRentang++;

            if (pilar.score !== null) {
              fEntry.totalSkor3PilarRentang += pilar.score;
              fEntry.maxSkor3PilarRentang += pilar.maxScore;
              if (pEntry) {
                pEntry.totalSkor3PilarRentang += pilar.score;
                pEntry.maxSkor3PilarRentang += pilar.maxScore;
              }
            }

            if (pilar.hasSL) {
              fEntry.totalPilar1Rentang++;
              if (pEntry) pEntry.totalPilar1Rentang++;
            }
            if (pilar.hasQT) {
              fEntry.totalPilar2Rentang++;
              if (pEntry) pEntry.totalPilar2Rentang++;
            }
            if (pilar.hasTV) {
              fEntry.totalPilar3Rentang++;
              if (pEntry) pEntry.totalPilar3Rentang++;
            }
          }

          if (s.conference) {
            fEntry.totalConfRentang++;
            if (pEntry) pEntry.totalConfRentang++;
          }
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
    let globalTotalProdi = 0;

    const fakultasReportList: FakultasReportItem[] = Array.from(fakultasMap.values()).map((f) => {
      const hasKelas = f.totalKelas > 0;
      const hasSesi = f.totalSesiRentang > 0;

      let prodiSehatCount = 0;
      let prodiPerhatianCount = 0;
      let prodiBelumAdaKelasCount = 0;

      // Hitung breakdown untuk tiap prodi di dalam fakultas ini
      const prodiBreakdownList: FakultasProdiBreakdownItem[] = Array.from(f.prodiMap.values()).map((p: any) => {
        const pHasKelas = p.totalKelas > 0;
        const pHasSesi = p.totalSesiRentang > 0;

        const avgKehadiranRentang = pHasSesi
          ? Math.round(((p.totalHadirRentang + p.totalHadirTdkLengkapRentang) / p.totalSesiRentang) * 1000) / 10
          : pHasKelas
          ? 0
          : null;

        const avgKontenRentang =
          p.maxSkor3PilarRentang > 0
            ? Math.round((p.totalSkor3PilarRentang / p.maxSkor3PilarRentang) * 1000) / 10
            : pHasKelas
            ? p.totalKelasNonBimbingan === 0
              ? 100
              : 0
            : null;

        let statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" | "BELUM_ADA_KELAS" = "SANGAT_BAIK";
        if (!pHasKelas) {
          statusKinerjaRentang = "BELUM_ADA_KELAS";
          prodiBelumAdaKelasCount++;
        } else if (p.totalSesiRentang === 0) {
          statusKinerjaRentang = "BAIK";
          prodiSehatCount++;
        } else if (
          (avgKehadiranRentang ?? 0) < 75 ||
          (p.totalKelasNonBimbingan > 0 && (avgKontenRentang ?? 0) < 60) ||
          p.totalAlphaRentang >= 2 ||
          p.totalHadirTdkLengkapRentang >= 5
        ) {
          statusKinerjaRentang = "PERLU_PEMBINAAN";
          prodiPerhatianCount++;
        } else if (
          (avgKehadiranRentang ?? 0) < 90 ||
          (p.totalKelasNonBimbingan > 0 && (avgKontenRentang ?? 0) < 80) ||
          p.totalHadirTdkLengkapRentang >= 2
        ) {
          statusKinerjaRentang = "BAIK";
          prodiSehatCount++;
        } else {
          prodiSehatCount++;
        }

        const finalTotalDosen = normalizedJenisKelas ? p.dosenSemesterIds.size : p.totalDosen;

        return {
          id: p.id,
          kode: p.kode,
          nama: p.nama,
          totalKelas: p.totalKelas,
          totalKelasAktifRentang: p.kelasIdsRentang.size,
          totalDosen: finalTotalDosen,
          totalDosenAktifRentang: p.dosenIdsRentang.size,
          totalSesiRentang: p.totalSesiRentang,
          totalHadirRentang: p.totalHadirRentang,
          totalAlphaRentang: p.totalAlphaRentang,
          totalHadirTdkLengkapRentang: p.totalHadirTdkLengkapRentang,
          totalGantiHariRentang: p.totalGantiHariRentang,
          avgKehadiranRentang,
          avgKontenRentang,
          statusKinerjaRentang,
          kendalaCount: p.kendalaCount,
        };
      });

      const avgKehadiranRentang = hasSesi
        ? Math.round(((f.totalHadirRentang + f.totalHadirTdkLengkapRentang) / f.totalSesiRentang) * 1000) / 10
        : hasKelas
        ? 0
        : null;

      const avgKontenRentang =
        f.maxSkor3PilarRentang > 0
          ? Math.round((f.totalSkor3PilarRentang / f.maxSkor3PilarRentang) * 1000) / 10
          : hasKelas
          ? f.totalKelasNonBimbingan === 0
            ? 100
            : 0
          : null;

      const avgKehadiranSemester =
        hasKelas ? Math.round((f.totalHadirSemester / (f.totalKelas * 16)) * 1000) / 10 : null;
      const avgKontenSemester =
        hasKelas
          ? f.maxSkor3PilarSemester > 0
            ? Math.round((f.totalSkor3PilarSemester / f.maxSkor3PilarSemester) * 1000) / 10
            : 100
          : null;

      // Status Kinerja Fakultas (Best Practice Eksekutif):
      // Berbasis persentase dan rasio kesehatan prodi di dalamnya
      let statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" | "BELUM_ADA_KELAS" = "SANGAT_BAIK";
      if (!hasKelas) {
        statusKinerjaRentang = "BELUM_ADA_KELAS";
      } else if (f.totalSesiRentang === 0) {
        statusKinerjaRentang = "BAIK";
      } else if (
        (avgKehadiranRentang ?? 0) < 75 ||
        (f.totalKelasNonBimbingan > 0 && (avgKontenRentang ?? 0) < 60) ||
        (prodiPerhatianCount > 0 && prodiPerhatianCount >= f.totalProdi / 2)
      ) {
        statusKinerjaRentang = "PERLU_PEMBINAAN";
      } else if (
        (avgKehadiranRentang ?? 0) < 90 ||
        (f.totalKelasNonBimbingan > 0 && (avgKontenRentang ?? 0) < 80) ||
        prodiPerhatianCount > 0
      ) {
        statusKinerjaRentang = "BAIK";
      }

      const finalTotalDosen = normalizedJenisKelas ? f.dosenSemesterIds.size : f.facultyDosenSet.size;

      globalTotalSesiRentang += f.totalSesiRentang;
      globalTotalHadirRentang += f.totalHadirRentang + f.totalHadirTdkLengkapRentang;
      globalTotalRegularSesiRentang += f.totalRegularSesiRentang;
      globalTotalSkor3PilarRentang += f.totalSkor3PilarRentang;
      globalMaxSkor3PilarRentang += f.maxSkor3PilarRentang;
      globalTotalConfRentang += f.totalConfRentang;
      globalTotalKelas += f.totalKelas;
      globalTotalDosen += finalTotalDosen;
      globalTotalGantiHariRentang += f.totalGantiHariRentang;
      globalTotalProdi += f.totalProdi;

      return {
        id: f.id,
        nama: f.nama,
        singkatan: f.singkatan,
        totalProdi: f.totalProdi,
        prodiSehatCount,
        prodiPerhatianCount,
        prodiBelumAdaKelasCount,

        totalSesiRentang: f.totalSesiRentang,
        totalHadirRentang: f.totalHadirRentang,
        totalHadirTdkLengkapRentang: f.totalHadirTdkLengkapRentang,
        totalAlphaRentang: f.totalAlphaRentang,
        totalBelumDiisiRentang: f.totalBelumDiisiRentang,
        totalGantiHariRentang: f.totalGantiHariRentang,
        avgKehadiranRentang,
        totalRegularSesiRentang: f.totalRegularSesiRentang,
        totalSkor3PilarRentang: f.totalSkor3PilarRentang,
        maxSkor3PilarRentang: f.maxSkor3PilarRentang,
        avgKontenRentang,
        totalPilar1Rentang: f.totalPilar1Rentang,
        totalPilar2Rentang: f.totalPilar2Rentang,
        totalPilar3Rentang: f.totalPilar3Rentang,
        totalConfRentang: f.totalConfRentang,
        totalDosenAktifRentang: f.dosenIdsRentang.size,
        totalKelasAktifRentang: f.kelasIdsRentang.size,
        statusKinerjaRentang,
        prodiBreakdownList,
        kendalaList: f.kendalaList,

        totalKelas: f.totalKelas,
        totalKelasNonBimbingan: f.totalKelasNonBimbingan,
        totalDosen: finalTotalDosen,
        avgKehadiranSemester,
        avgKontenSemester,
      };
    });

    const avgKehadiranRentangSemua =
      globalTotalSesiRentang > 0
        ? Math.round((globalTotalHadirRentang / globalTotalSesiRentang) * 1000) / 10
        : 0;

    const activeFakultasList = fakultasReportList.filter((f) => f.totalKelas > 0);
    const isAllBimbingan =
      normalizedJenisKelas === "BIMBINGAN" ||
      (activeFakultasList.length > 0 && activeFakultasList.every((f) => f.totalKelasNonBimbingan === 0));

    const avgKontenRentangSemua =
      globalMaxSkor3PilarRentang > 0
        ? Math.round((globalTotalSkor3PilarRentang / globalMaxSkor3PilarRentang) * 1000) / 10
        : isAllBimbingan
        ? 100
        : 0;

    const responseData = {
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

    setLaporanToCache(cacheKey, responseData);

    return {
      success: true,
      data: responseData,
    };
  } catch (error: any) {
    console.error("getLaporanFakultas error:", error);
    return { success: false, error: error.message || "Gagal memproses laporan fakultas" };
  }
}


