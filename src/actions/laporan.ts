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

const LAPORAN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit
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
  statusPengajar: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
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
  } | null;
  statusPengajar?: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
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
  };
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

  totalSkor3Pilar: number; // Max 42 (14 regular sesi * 3)
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
    const isRestricted = Boolean(allowedProdiIds && allowedProdiIds.length > 0);
    const sortedAllowed = allowedProdiIds ? [...allowedProdiIds].sort().join(",") : "";
    const cacheKey = `rekap_${semesterId || "ACTIVE"}_${prodiId || "ALL"}_${sortedAllowed}`;

    const cached = getLaporanFromCache<RekapLaporanResultData>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    // Optimasi Waterfall: Ambil allSemesters dan allProdi secara paralel
    const [allSemesters, rawAllProdi] = await Promise.all([
      prisma.semester.findMany({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
      }),
      prisma.prodi.findMany({
        orderBy: { nama: "asc" },
      }),
    ]);

    const allProdi = isRestricted
      ? rawAllProdi.filter((p) => allowedProdiIds!.includes(p.id))
      : rawAllProdi;

    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];
    const targetSemesterId = semesterId || activeSemester?.id;

    let prodiWhere: any = {};
    if (isRestricted) {
      if (prodiId && prodiId !== "ALL" && allowedProdiIds!.includes(prodiId)) {
        prodiWhere = { prodiId };
      } else {
        prodiWhere = { prodiId: { in: allowedProdiIds! } };
      }
    } else {
      if (prodiId && prodiId !== "ALL") {
        prodiWhere = { prodiId };
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
        const pilar = calculateSessionPillars(s);

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
        dosen: cls.dosen,
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
    totalHadir: number;
    persenKehadiran: number;
    totalSkorKonten: number;
    maxSkorKonten: number;
    persenKonten: number;
    statusEvaluasi: string;
  }>;
  totalKelas: number;
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
    const sortedAllowed = allowedProdiIds ? [...allowedProdiIds].sort().join(",") : "";
    const cacheKey = `dosen_${semesterId || "ACTIVE"}_${prodiId || "ALL"}_${sortedAllowed}`;

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
          totalHadir: number;
          persenKehadiran: number;
          totalSkorKonten: number;
          maxSkorKonten: number;
          persenKonten: number;
          statusEvaluasi: string;
        }>;
        totalKelas: number;
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
          statusPengajar: "UTAMA" | "PENGGANTI_INSIDENTAL" | "PERGANTIAN_TETAP";
          sesiList: SesiRekapItem[];
        }
      >();

      // Inisialisasi Dosen Utama
      pengajarDiKelas.set(item.dosen.id, {
        dosenObj: {
          id: item.dosen.id,
          nama: item.dosen.nama,
          nidn: item.dosen.nidn ?? null,
          prodi: item.mataKuliah.prodi,
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
                prodi: item.mataKuliah.prodi,
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

      // Hitung kontribusi per dosen di kelas ini
      for (const [dosenId, data] of pengajarDiKelas.entries()) {
        if (data.sesiList.length === 0) continue; // Dosen tidak mengajar sesi apapun di kelas ini

        const totalSesiBeban = data.sesiList.length;
        const nomorSesiArr = data.sesiList.map((s) => s.nomorSesi).sort((a, b) => a - b);
        const minSesi = Math.min(...nomorSesiArr);
        const maxSesi = Math.max(...nomorSesiArr);

        // Format label status penugasan
        let statusPenugasan = "Penuh (Sesi 1–16)";
        if (totalSesiBeban < 16) {
          if (minSesi === 1 && maxSesi === 8 && totalSesiBeban === 8) {
            statusPenugasan = "Sesi 1–8 (Pra-UTS)";
          } else if (minSesi === 9 && maxSesi === 16 && totalSesiBeban === 8) {
            statusPenugasan = "Sesi 9–16 (Pasca-UTS)";
          } else if (data.statusPengajar === "PENGGANTI_INSIDENTAL") {
            statusPenugasan = `Pengganti (Sesi ${nomorSesiArr.join(", ")})`;
          } else {
            statusPenugasan = `Sesi ${nomorSesiArr.join(", ")}`;
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
        const maxSkorKonten = isBimbingan ? 0 : regularSesi.length * 3;
        const skorKonten = isBimbingan ? 0 : regularSesi.reduce(
          (acc, s) => acc + (s.contentScore || 0),
          0
        );
        const persenKonten = isBimbingan ? null :
          maxSkorKonten > 0 ? Math.round((skorKonten / maxSkorKonten) * 1000) / 10 : 0;

        const confCount = data.sesiList.filter((s) => s.conference).length;

        // Evaluasi kelas: Jika 1 dosen penuh, gunakan statusEvaluasi kelas yang sudah dihitung; jika pengajar terpisah, evaluasi sesi berjalan
        let classEvaluasi: "TERLAKSANA" | "PERHATIAN" = "TERLAKSANA";
        if (!item.isSplitPengajar) {
          classEvaluasi = item.statusEvaluasi;
        } else {
          const emptySesiCount = isBimbingan
            ? 0
            : regularSesi.filter(
                (s) => s.nomorSesi <= currentActiveSesi && (s.contentScore || 0) === 0
              ).length;
          if (alphaCount >= 2 || (!isBimbingan && emptySesiCount >= 2)) {
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
          totalHadir: hadirCount,
          persenKehadiran,
          totalSkorKonten: skorKonten,
          maxSkorKonten,
          persenKonten: persenKonten ?? 0,
          statusEvaluasi: classEvaluasi,
        });

        entry.totalKelas = entry.kelasList.length;
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
  avgKehadiranRentang: number;

  totalRegularSesiRentang: number;
  totalSkor3PilarRentang: number;
  avgKontenRentang: number;
  totalPilar1Rentang: number;
  totalPilar2Rentang: number;
  totalPilar3Rentang: number;
  totalConfRentang: number;

  totalDosenAktifRentang: number;
  totalKelasAktifRentang: number;
  statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN";

  // Sesi Kendala (Alpha & Belum Diisi)
  kendalaList: KendalaKehadiranItem[];

  // Semester Total (Referensi)
  totalKelas: number;
  totalDosen: number;
  avgKehadiranSemester: number;
  avgKontenSemester: number;
}

export interface KendalaKehadiranItem {
  sesiId: string;
  nomorSesi: number;
  status: "ALPHA" | "BELUM_DIISI";
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
    globalSummary: {
      totalProdi: number;
      totalKelasSemua: number;
      totalDosenSemua: number;
      totalSesiRentangSemua: number;
      avgKehadiranRentangSemua: number;
      avgKontenRentangSemua: number;
      totalConfRentangSemua: number;
    };
  };
}

export async function getLaporanProdi(
  semesterId?: string,
  startDate?: string,
  endDate?: string,
  allowedProdiIds?: string[]
): Promise<LaporanProdiResponse> {
  try {
    const isAllTime = !startDate && !endDate;
    const targetStartDate = startDate || "";
    const targetEndDate = endDate || "";

    const sortedAllowed = allowedProdiIds ? [...allowedProdiIds].sort().join(",") : "";
    const cacheKey = `prodi_${semesterId || "ACTIVE"}_${targetStartDate || "ALL"}_${targetEndDate || "ALL"}_${sortedAllowed}`;

    const cached = getLaporanFromCache<any>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;

    if (!isAllTime && targetStartDate && targetEndDate) {
      startDateTime = new Date(`${targetStartDate}T00:00:00.000Z`);
      endDateTime = new Date(`${targetEndDate}T23:59:59.999Z`);
    }

    const isRestricted = Boolean(allowedProdiIds && allowedProdiIds.length > 0);

    // Optimasi Waterfall: Ambil allSemesters & allProdi secara paralel
    const [allSemesters, rawAllProdi] = await Promise.all([
      prisma.semester.findMany({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
      }),
      prisma.prodi.findMany({
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
    const targetSemesterId = semesterId || activeSemester?.id;

    // Pruned Lean Query: Memangkas relasi nested yang tidak dipakai
    const rawClasses = await prisma.kelas.findMany({
      where: {
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
        ...(isRestricted ? { mataKuliah: { prodiId: { in: allowedProdiIds! } } } : {}),
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
        totalDosen: p.dosen.length,

        // Range stats
        totalSesiRentang: 0,
        totalHadirRentang: 0,
        totalHadirTdkLengkapRentang: 0,
        totalAlphaRentang: 0,
        totalBelumDiisiRentang: 0,
        totalRegularSesiRentang: 0,
        totalSkor3PilarRentang: 0,
        totalPilar1Rentang: 0,
        totalPilar2Rentang: 0,
        totalPilar3Rentang: 0,
        totalConfRentang: 0,
        dosenIdsRentang: new Set<string>(),
        kelasIdsRentang: new Set<string>(),
        kendalaList: [] as KendalaKehadiranItem[],

        // Semester stats
        totalHadirSemester: 0,
        totalAlphaSemester: 0,
        totalSkor3PilarSemester: 0,
      });
    }

    for (const cls of rawClasses) {
      const prodiId = cls.mataKuliah.prodiId;
      if (!prodiMap.has(prodiId)) continue;
      const entry = prodiMap.get(prodiId);
      entry.totalKelas++;

      const classSummary = calculateClassSummary(cls.monitoringSesi as any, cls.modePembelajaran as any);
      entry.totalHadirSemester += classSummary.totalHadir;
      entry.totalAlphaSemester += classSummary.totalAlpha;
      entry.totalSkor3PilarSemester += classSummary.totalSkor3Pilar;

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

        const semStartStr = cls.semester?.tanggalMulai
          ? new Date(cls.semester.tanggalMulai).toISOString().split("T")[0]
          : DEFAULT_SEMESTER_START_DATE;

        if (!effectiveDate) {
          effectiveDate = getEstimatedSessionDate(s.nomorSesi, cls.jadwalHari, semStartStr, (cls.semester as any)?.hariLibur);
        }

        if (startDateTime && endDateTime) {
          isInRange = effectiveDate >= startDateTime && effectiveDate <= endDateTime;
        } else {
          // Jika filter All Time: sesi masa depan yang belum tiba dan tanpa catatan tidak dihitung di rentang
          const isFuture = s.kehadiran === "BELUM_DIISI" && !s.catatanCdu && s.nomorSesi > maxSesiBerjalan;
          isInRange = !isFuture;
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

            const isKendalaBelumDiisi = (startDateTime && endDateTime)
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

          const pilar = calculateSessionPillars(s);
          if (!pilar.isExam) {
            entry.totalRegularSesiRentang++;
            if (pilar.score !== null) entry.totalSkor3PilarRentang += pilar.score;
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
    let globalTotalConfRentang = 0;
    let globalTotalKelas = 0;
    let globalTotalDosen = 0;

    const prodiReportList: ProdiReportItem[] = Array.from(prodiMap.values()).map((p) => {
      const avgKehadiranRentang =
        p.totalSesiRentang > 0
          ? Math.round(((p.totalHadirRentang + p.totalHadirTdkLengkapRentang) / p.totalSesiRentang) * 1000) / 10
          : 0;

      const avgKontenRentang =
        p.totalRegularSesiRentang > 0
          ? Math.round((p.totalSkor3PilarRentang / (p.totalRegularSesiRentang * 3)) * 1000) / 10
          : 0;

      const avgKehadiranSemester =
        p.totalKelas > 0 ? Math.round((p.totalHadirSemester / (p.totalKelas * 16)) * 1000) / 10 : 0;
      const avgKontenSemester =
        p.totalKelas > 0 ? Math.round((p.totalSkor3PilarSemester / (p.totalKelas * 42)) * 1000) / 10 : 0;

      let statusKinerjaRentang: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" = "SANGAT_BAIK";
      if (p.totalSesiRentang === 0) {
        statusKinerjaRentang = "BAIK";
      } else if (avgKehadiranRentang < 75 || avgKontenRentang < 60 || p.totalAlphaRentang >= 2) {
        statusKinerjaRentang = "PERLU_PEMBINAAN";
      } else if (avgKehadiranRentang < 90 || avgKontenRentang < 80) {
        statusKinerjaRentang = "BAIK";
      }

      globalTotalSesiRentang += p.totalSesiRentang;
      globalTotalHadirRentang += p.totalHadirRentang + p.totalHadirTdkLengkapRentang;
      globalTotalRegularSesiRentang += p.totalRegularSesiRentang;
      globalTotalSkor3PilarRentang += p.totalSkor3PilarRentang;
      globalTotalConfRentang += p.totalConfRentang;
      globalTotalKelas += p.totalKelas;
      globalTotalDosen += p.totalDosen;

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
        avgKehadiranRentang,
        totalRegularSesiRentang: p.totalRegularSesiRentang,
        totalSkor3PilarRentang: p.totalSkor3PilarRentang,
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
        totalDosen: p.totalDosen,
        avgKehadiranSemester,
        avgKontenSemester,
      };
    });

    const avgKehadiranRentangSemua =
      globalTotalSesiRentang > 0
        ? Math.round((globalTotalHadirRentang / globalTotalSesiRentang) * 1000) / 10
        : 0;

    const avgKontenRentangSemua =
      globalTotalRegularSesiRentang > 0
        ? Math.round((globalTotalSkor3PilarRentang / (globalTotalRegularSesiRentang * 3)) * 1000) / 10
        : 0;

    const responseData = {
      prodiReportList,
      semesters: allSemesters,
      activeSemesterId: targetSemesterId || allSemesters[0]?.id || "",
      startDate: targetStartDate,
      endDate: targetEndDate,
      globalSummary: {
        totalProdi: prodiReportList.length,
        totalKelasSemua: globalTotalKelas,
        totalDosenSemua: globalTotalDosen,
        totalSesiRentangSemua: globalTotalSesiRentang,
        avgKehadiranRentangSemua,
        avgKontenRentangSemua,
        totalConfRentangSemua: globalTotalConfRentang,
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

