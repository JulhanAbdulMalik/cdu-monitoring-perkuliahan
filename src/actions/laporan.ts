"use server";
// src/actions/laporan.ts
// Server Actions untuk Rekapitulasi Monitoring, Laporan Dosen & Laporan Prodi (3-Pillar & Mode-Aware)

import { prisma } from "@/lib/prisma";
import { calculateSessionPillars, calculateClassSummary } from "@/lib/score-calculator";
import { getWeekDates, getEstimatedSessionDate, DEFAULT_SEMESTER_START_DATE } from "@/lib/utils";

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
  modePembelajaran: "DARING" | "LURING";
  sesi: Array<{
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
  }>;
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

  statusEvaluasi: "MEMENUHI" | "CUKUP" | "PERLU_PERHATIAN";
  evaluasiNote: string;
}

export async function getRekapLaporan(semesterId?: string, prodiId?: string) {
  try {
    const activeSemester = await prisma.semester.findFirst({
      where: { aktif: true },
    });

    const targetSemesterId = semesterId || activeSemester?.id;

    const rawClasses = await prisma.kelas.findMany({
      where: {
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
        ...(prodiId && prodiId !== "ALL" ? { mataKuliah: { prodiId } } : {}),
      },
      include: {
        semester: {
          include: {
            hariLibur: true,
          },
        },
        mataKuliah: { include: { prodi: true } },
        dosen: true,
        monitoringSesi: {
          orderBy: { nomorSesi: "asc" },
        },
      },
      orderBy: [{ mataKuliah: { prodi: { nama: "asc" } } }, { kodeKelas: "asc" }],
    });

    const summaries: ClassRekapSummary[] = rawClasses.map((cls) => {
      const summary = calculateClassSummary(
        cls.monitoringSesi as any,
        cls.modePembelajaran as any
      );

      const processedSesi = cls.monitoringSesi.map((s) => {
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

    const allSemesters = await prisma.semester.findMany({
      orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
    });

    const allProdi = await prisma.prodi.findMany({
      orderBy: { nama: "asc" },
    });

    return {
      success: true,
      data: {
        rekapList: summaries,
        semesters: allSemesters,
        prodiList: allProdi,
        activeSemesterId: activeSemester?.id || allSemesters[0]?.id,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat data rekapitulasi" };
  }
}

export async function getLaporanDosen(semesterId?: string) {
  try {
    const rekapRes = await getRekapLaporan(semesterId);
    if (!rekapRes.success || !rekapRes.data) {
      return { success: false, error: "Gagal memuat data laporan dosen" };
    }

    const { rekapList, semesters, prodiList, activeSemesterId } = rekapRes.data;

    const dosenMap = new Map<string, any>();

    for (const item of rekapList) {
      const dosenId = item.dosen.id;
      if (!dosenMap.has(dosenId)) {
        dosenMap.set(dosenId, {
          id: dosenId,
          nama: item.dosen.nama,
          nidn: item.dosen.nidn,
          prodi: item.mataKuliah.prodi,
          kelasList: [],
          totalKelas: 0,
          totalHadirSemua: 0,
          totalAlphaSemua: 0,
          totalSkor3PilarSemua: 0,
          totalConfSemua: 0,
        });
      }

      const entry = dosenMap.get(dosenId);
      entry.kelasList.push(item);
      entry.totalKelas++;
      entry.totalHadirSemua += item.totalHadir;
      entry.totalAlphaSemua += item.totalAlpha;
      entry.totalSkor3PilarSemua += item.totalSkor3Pilar;
      entry.totalConfSemua += item.confTotal;
    }

    const dosenReportList = Array.from(dosenMap.values()).map((d) => {
      const avgKehadiran = Math.round((d.totalHadirSemua / (d.totalKelas * 16)) * 100);
      const avgKonten = Math.round((d.totalSkor3PilarSemua / (d.totalKelas * 42)) * 100); // 42 max per class

      let status: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN" = "SANGAT_BAIK";
      if (avgKehadiran < 75 || avgKonten < 60 || d.totalAlphaSemua >= 4) {
        status = "PERLU_PEMBINAAN";
      } else if (avgKehadiran < 90 || avgKonten < 80) {
        status = "BAIK";
      }

      return {
        ...d,
        avgKehadiran,
        avgKonten,
        status,
      };
    });

    return {
      success: true,
      data: {
        dosenReportList,
        semesters,
        prodiList,
        activeSemesterId,
      },
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
  endDate?: string
): Promise<LaporanProdiResponse> {
  try {
    const isAllTime = !startDate && !endDate;
    const targetStartDate = startDate || "";
    const targetEndDate = endDate || "";

    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;

    if (!isAllTime && targetStartDate && targetEndDate) {
      startDateTime = new Date(`${targetStartDate}T00:00:00.000Z`);
      endDateTime = new Date(`${targetEndDate}T23:59:59.999Z`);
    }

    const activeSemester = await prisma.semester.findFirst({
      where: { aktif: true },
    });
    const targetSemesterId = semesterId || activeSemester?.id;

    // Get all prodis
    const allProdi = await prisma.prodi.findMany({
      include: {
        fakultas: true,
        dosen: true,
      },
      orderBy: { nama: "asc" },
    });

    // Get all classes for the semester with their monitoring sessions
    const rawClasses = await prisma.kelas.findMany({
      where: {
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
      },
      include: {
        semester: {
          include: {
            hariLibur: true,
          },
        },
        mataKuliah: { include: { prodi: true } },
        dosen: true,
        monitoringSesi: {
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
          entry.dosenIdsRentang.add(cls.dosenId);

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
              dosenId: cls.dosen.id,
              dosenNama: cls.dosen.nama,
              dosenNidn: cls.dosen.nidn ?? null,
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

            // Sesi BELUM_DIISI MASUK KENDALA JIKA:
            // 1. Filter rentang tanggal aktif (startDateTime & endDateTime):
            //    Semua sesi yang terjadwal di rentang evaluasi ini tetapi BELUM_DIISI merupakan kendala evaluasi!
            // 2. Filter All Time:
            //    Hanya sesi bolong (nomorSesi <= maxSesiBerjalan) atau sesi yang memiliki catatan khusus CDU
            const isKendalaBelumDiisi = (startDateTime && endDateTime)
              ? true
              : (hasCatatan || s.nomorSesi <= maxSesiBerjalan);

            if (isKendalaBelumDiisi) {
              entry.kendalaList.push({
                sesiId: s.id,
                nomorSesi: s.nomorSesi,
                status: "BELUM_DIISI",
                catatan: s.catatanCdu ?? null,
                dosenId: cls.dosen.id,
                dosenNama: cls.dosen.nama,
                dosenNidn: cls.dosen.nidn ?? null,
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
          ? Math.round(((p.totalHadirRentang + p.totalHadirTdkLengkapRentang) / p.totalSesiRentang) * 100)
          : 0;

      const avgKontenRentang =
        p.totalRegularSesiRentang > 0
          ? Math.round((p.totalSkor3PilarRentang / (p.totalRegularSesiRentang * 3)) * 100)
          : 0;

      const avgKehadiranSemester =
        p.totalKelas > 0 ? Math.round((p.totalHadirSemester / (p.totalKelas * 16)) * 100) : 0;
      const avgKontenSemester =
        p.totalKelas > 0 ? Math.round((p.totalSkor3PilarSemester / (p.totalKelas * 42)) * 100) : 0;

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

    const allSemesters = await prisma.semester.findMany({
      orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
    });

    const avgKehadiranRentangSemua =
      globalTotalSesiRentang > 0
        ? Math.round((globalTotalHadirRentang / globalTotalSesiRentang) * 100)
        : 0;

    const avgKontenRentangSemua =
      globalTotalRegularSesiRentang > 0
        ? Math.round((globalTotalSkor3PilarRentang / (globalTotalRegularSesiRentang * 3)) * 100)
        : 0;

    return {
      success: true,
      data: {
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
      },
    };
  } catch (error: any) {
    console.error("getLaporanProdi error:", error);
    return { success: false, error: error.message || "Gagal memproses laporan prodi" };
  }
}

