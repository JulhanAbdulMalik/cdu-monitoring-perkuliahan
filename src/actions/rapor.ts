"use server";
// src/actions/rapor.ts
// Server Actions untuk Rapor Dosen (Laporan Evaluasi Tridharma Dosen)
// Nusa Putra University - QAU (Quality Assurance Unit) & CDU

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Abaikan jika dipanggil di luar konteks request Next.js (misal test script atau worker)
  }
}
import {
  RaporConfigData,
  DEFAULT_RAPOR_CONFIG,
  calculateRaporFull,
  RaporCalculatedResult,
  determinePredikat,
} from "@/lib/rapor-calculator";
import { parseSiakadAngket, SiakadAngketParsedData } from "@/lib/siakad-angket-parser";
import { calculateClassSummary } from "@/lib/score-calculator";
import {
  analyzeRaporWithGemini,
  GeminiRaporAnalysisResult,
} from "@/lib/gemini-rapor-analyzer";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONFIGURATION (BOBOT & TARGET SESI)
// ─────────────────────────────────────────────────────────────────────────────

export async function getRaporConfig(semesterId: string): Promise<RaporConfigData> {
  try {
    const config = await prisma.raporDosenConfig.findUnique({
      where: { semesterId },
    });

    if (!config) {
      return DEFAULT_RAPOR_CONFIG;
    }

    return {
      bobotKuesioner: config.bobotKuesioner,
      bobotKehadiran: config.bobotKehadiran,
      bobotKonten: config.bobotKonten,
      bobotPenelitian: config.bobotPenelitian,
      bobotPengabdian: config.bobotPengabdian,
      targetSesi: config.targetSesi,
      namaPejabat: config.namaPejabat ?? DEFAULT_RAPOR_CONFIG.namaPejabat,
      nidnPejabat: config.nidnPejabat ?? DEFAULT_RAPOR_CONFIG.nidnPejabat,
      jabatanPejabat: config.jabatanPejabat ?? DEFAULT_RAPOR_CONFIG.jabatanPejabat,
      kotaTerbit: config.kotaTerbit ?? DEFAULT_RAPOR_CONFIG.kotaTerbit,
      ttdImageUrl: config.ttdImageUrl ?? DEFAULT_RAPOR_CONFIG.ttdImageUrl,
      showTtdDigital: config.showTtdDigital ?? DEFAULT_RAPOR_CONFIG.showTtdDigital,
    };
  } catch (error) {
    console.error("Error getRaporConfig:", error);
    return DEFAULT_RAPOR_CONFIG;
  }
}

export async function saveRaporConfig(
  semesterId: string,
  payload: Partial<RaporConfigData>
): Promise<{ success: boolean; data?: RaporConfigData; error?: string }> {
  try {
    const configData = {
      bobotKuesioner: payload.bobotKuesioner ?? DEFAULT_RAPOR_CONFIG.bobotKuesioner,
      bobotKehadiran: payload.bobotKehadiran ?? DEFAULT_RAPOR_CONFIG.bobotKehadiran,
      bobotKonten: payload.bobotKonten ?? DEFAULT_RAPOR_CONFIG.bobotKonten,
      bobotPenelitian: payload.bobotPenelitian ?? DEFAULT_RAPOR_CONFIG.bobotPenelitian,
      bobotPengabdian: payload.bobotPengabdian ?? DEFAULT_RAPOR_CONFIG.bobotPengabdian,
      targetSesi: payload.targetSesi ?? DEFAULT_RAPOR_CONFIG.targetSesi,
      namaPejabat: payload.namaPejabat !== undefined ? payload.namaPejabat : DEFAULT_RAPOR_CONFIG.namaPejabat,
      nidnPejabat: payload.nidnPejabat !== undefined ? payload.nidnPejabat : DEFAULT_RAPOR_CONFIG.nidnPejabat,
      jabatanPejabat: payload.jabatanPejabat !== undefined ? payload.jabatanPejabat : DEFAULT_RAPOR_CONFIG.jabatanPejabat,
      kotaTerbit: payload.kotaTerbit !== undefined ? payload.kotaTerbit : DEFAULT_RAPOR_CONFIG.kotaTerbit,
      ttdImageUrl: payload.ttdImageUrl !== undefined ? payload.ttdImageUrl : DEFAULT_RAPOR_CONFIG.ttdImageUrl,
      showTtdDigital: payload.showTtdDigital !== undefined ? payload.showTtdDigital : DEFAULT_RAPOR_CONFIG.showTtdDigital,
    };

    const currentConfig = await prisma.raporDosenConfig.findUnique({
      where: { semesterId },
    });

    const isWeightChanged =
      !currentConfig ||
      currentConfig.bobotKuesioner !== configData.bobotKuesioner ||
      currentConfig.bobotKehadiran !== configData.bobotKehadiran ||
      currentConfig.bobotKonten !== configData.bobotKonten ||
      currentConfig.bobotPenelitian !== configData.bobotPenelitian ||
      currentConfig.bobotPengabdian !== configData.bobotPengabdian ||
      currentConfig.targetSesi !== configData.targetSesi;

    const saved = await prisma.raporDosenConfig.upsert({
      where: { semesterId },
      create: {
        semesterId,
        ...configData,
      },
      update: configData,
    });

    // Otomatis kalkulasi ulang seluruh Rapor Dosen HANYA jika bobot atau target sesi berubah
    if (isWeightChanged) {
      const existingRapors = await prisma.raporDosen.findMany({
        where: { semesterId },
      });

      for (const r of existingRapors) {
        const calc = calculateRaporFull(
          {
            nilaiKuesioner: r.nilaiKuesioner,
            totalResponden: r.totalResponden,
            targetResponden: r.targetResponden,
            rerataSesiHadir: r.rerataSesiHadir,
            persenKehadiran: r.persenKehadiran,
            persenKonten: r.persenKonten,
            jumlahPenelitian: r.jumlahPenelitian,
            jumlahPengabdian: r.jumlahPengabdian,
          },
          configData
        );

        await prisma.raporDosen.update({
          where: { id: r.id },
          data: {
            skorKuesioner: calc.skorKuesioner,
            skorKehadiran: calc.skorKehadiran,
            skorKonten: calc.skorKonten,
            skorPenelitian: calc.skorPenelitian,
            skorPengabdian: calc.skorPengabdian,
            nilaiAkhir: calc.nilaiAkhir,
            predikat: calc.predikat.kode,
          },
        });
      }
    }

    safeRevalidatePath("/laporan/rapor-dosen");
    return { success: true, data: saved };
  } catch (error: any) {
    console.error("Error saveRaporConfig:", error);
    return { success: false, error: error.message || "Gagal menyimpan konfigurasi bobot" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AGREGATOR STATISTIK MONITORING PERKULIAHAN (CDU PORTAL)
// ─────────────────────────────────────────────────────────────────────────────

export interface LecturerClassMonitoringStat {
  kelasId: string;
  kodeKelas: string;
  mataKuliahNama: string;
  mataKuliahKode: string;
  sks: number;
  modePembelajaran: "DARING" | "LURING" | "HYBRID" | "BIMBINGAN";
  totalSesiHadir: number; // sesi hadir (HADIR + HADIR_TIDAK_LENGKAP)
  persenKehadiran: number;
  persenKonten: number;
  totalSkor3Pilar: number;
  maxSkor3Pilar: number;
}

export interface LecturerMonitoringStats {
  totalKelas: number;
  totalSesiHadirSemua: number;
  rerataSesiHadir: number; // e.g. 14.5
  persenKehadiran: number; // e.g. 90.6%
  persenKonten: number; // e.g. 85.0%
  kelasList: LecturerClassMonitoringStat[];
}

export async function getLecturerMonitoringStats(
  dosenId: string,
  semesterId: string
): Promise<LecturerMonitoringStats> {
  const dosen = await prisma.dosen.findUnique({
    where: { id: dosenId },
    select: { id: true, nama: true },
  });

  if (!dosen) {
    return {
      totalKelas: 0,
      totalSesiHadirSemua: 0,
      rerataSesiHadir: 0,
      persenKehadiran: 0,
      persenKonten: 0,
      kelasList: [],
    };
  }

  // Dapatkan seluruh ID dosen yang terkait (termasuk jika nama dosen digabung dalam kelas tandem)
  const relatedDosens = await prisma.dosen.findMany({
    where: {
      OR: [
        { id: dosenId },
        { nama: { contains: dosen.nama.trim(), mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  const allDosenIds = Array.from(new Set([dosenId, ...relatedDosens.map((d) => d.id)]));

  // Cari kelas di mana dosen adalah dosen utama atau dosen tandem
  const rawClasses = await prisma.kelas.findMany({
    where: {
      semesterId,
      OR: [
        { dosenId: { in: allDosenIds } },
        { dosen2Id: { in: allDosenIds } },
      ],
    },
    include: {
      mataKuliah: true,
      monitoringSesi: {
        orderBy: { nomorSesi: "asc" },
      },
    },
  });

  const kelasList: LecturerClassMonitoringStat[] = [];
  let totalHadirSemua = 0;
  let totalPersenKonten = 0;
  let regularClassCount = 0;

  for (const k of rawClasses) {
    const summary = calculateClassSummary(
      k.monitoringSesi.map((s) => ({
        nomorSesi: s.nomorSesi,
        kehadiran: s.kehadiran,
        lectureNote: s.lectureNote,
        slide: s.slide,
        video: s.video,
        conference: s.conference,
        tugas: s.tugas,
        kuis: s.kuis,
      })),
      k.modePembelajaran as any
    );

    kelasList.push({
      kelasId: k.id,
      kodeKelas: k.kodeKelas,
      mataKuliahNama: k.mataKuliah.nama,
      mataKuliahKode: k.mataKuliah.kode,
      sks: k.mataKuliah.sks,
      modePembelajaran: k.modePembelajaran as any,
      totalSesiHadir: summary.totalHadir,
      persenKehadiran: summary.persenKehadiran,
      persenKonten: summary.persenKonten,
      totalSkor3Pilar: summary.totalSkor3Pilar,
      maxSkor3Pilar: k.modePembelajaran === "LURING" ? 28 : 42,
    });

    totalHadirSemua += summary.totalHadir;
    if (k.modePembelajaran !== "BIMBINGAN") {
      totalPersenKonten += summary.persenKonten;
      regularClassCount++;
    }
  }

  const totalKelas = kelasList.length;
  const rerataSesiHadir = totalKelas > 0 ? Math.round((totalHadirSemua / totalKelas) * 10) / 10 : 0;
  const persenKehadiran = totalKelas > 0 ? Math.round((rerataSesiHadir / 16) * 1000) / 10 : 0;
  const persenKonten =
    regularClassCount > 0
      ? Math.round((totalPersenKonten / regularClassCount) * 10) / 10
      : totalKelas > 0
      ? 100
      : 0;

  return {
    totalKelas,
    totalSesiHadirSemua: totalHadirSemua,
    rerataSesiHadir,
    persenKehadiran,
    persenKonten,
    kelasList,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RAPOR DOSEN CRUD & LISTING
// ─────────────────────────────────────────────────────────────────────────────

export interface RaporDosenListItem {
  id: string | null; // null jika belum pernah digenerate di DB
  dosenId: string;
  dosenNama: string;
  nip: string | null;
  nidn: string | null;
  prodiNama: string;
  prodiKode: string;
  totalKelas: number;
  totalSks: number;
  mataKuliahList: string[];
  kelasList: string[];
  totalSesiHadir: number | null;
  totalSesiBeban: number | null;
  totalSkorKonten: number | null;
  maxSkorKonten: number | null;
  nilaiKuesioner: number | null;
  totalResponden: number | null;
  targetResponden: number | null;
  rerataSesiHadir: number | null;
  persenKehadiran: number | null;
  persenKonten: number | null;
  jumlahPenelitian: number;
  jumlahPengabdian: number;
  nilaiAkhir: number | null;
  predikat: string | null;
  predikatLabel: string;
  predikatColor: string;
  statusRapor: "DRAFT" | "FINAL" | "BELUM_DIBUAT";
  isLengkap: boolean;
  catatanQau?: string | null;
  updatedAt?: Date | null;
}

export type RaporConfigPayload = Partial<RaporConfigData>;

export interface RaporDosenSummary {
  totalDosen: number;
  totalFinal: number;
  totalDraft: number;
  totalBelumDibuat: number;
  avgNilaiAkhir: number | null;
}

export async function getRaporDosenList(filters?: {
  semesterId?: string;
  prodiId?: string;
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  data?: {
    items: RaporDosenListItem[];
    summary: RaporDosenSummary;
    config: RaporConfigData;
    activeSemester: { id: string; tahunAkademik: string; periode: string; aktif: boolean };
    currentSemester: { id: string; tahunAkademik: string; periode: string; aktif: boolean };
    semesters: Array<{ id: string; tahunAkademik: string; periode: string; aktif: boolean }>;
    prodiList: Array<{ id: string; nama: string; kode: string }>;
    totalDosen: number;
    totalFinal: number;
    totalDraft: number;
    totalBelumDibuat: number;
    avgNilaiAkhir: number | null;
  };
  error?: string;
}> {
  try {
    // 1. Dapatkan semester aktif jika tidak difilter
    const allSemesters = await prisma.semester.findMany({
      orderBy: [{ tahunAkademik: "desc" }, { periode: "desc" }],
      select: { id: true, tahunAkademik: true, periode: true, aktif: true },
    });

    let targetSemesterId = filters?.semesterId;
    if (!targetSemesterId) {
      const activeSem = allSemesters.find((s) => s.aktif) || allSemesters[0];
      targetSemesterId = activeSem?.id;
    }

    if (!targetSemesterId) {
      return { success: false, error: "Tidak ada semester yang terdaftar di sistem" };
    }

    const currentSemester = allSemesters.find((s) => s.id === targetSemesterId)!;
    const config = await getRaporConfig(targetSemesterId);

    // 2. Ambil daftar prodi untuk filter dropdown
    const prodiList = await prisma.prodi.findMany({
      where: { isActive: true },
      select: { id: true, nama: true, kode: true },
      orderBy: { nama: "asc" },
    });

    // 3. Query dosen yang mengajar di semester ini atau seluruh dosen prodi
    const dosenWhere: any = {};
    if (filters?.prodiId && filters.prodiId !== "ALL") {
      dosenWhere.prodiId = filters.prodiId;
    }
    if (filters?.search) {
      dosenWhere.OR = [
        { nama: { contains: filters.search, mode: "insensitive" } },
        { nip: { contains: filters.search, mode: "insensitive" } },
        { nidn: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const dosens = await prisma.dosen.findMany({
      where: dosenWhere,
      include: {
        prodi: true,
        kelas: {
          where: { semesterId: targetSemesterId },
          select: {
            id: true,
            kodeKelas: true,
            modePembelajaran: true,
            mataKuliah: { select: { id: true, kode: true, nama: true, sks: true } },
          },
        },
        kelasTandem: {
          where: { semesterId: targetSemesterId },
          select: {
            id: true,
            kodeKelas: true,
            modePembelajaran: true,
            mataKuliah: { select: { id: true, kode: true, nama: true, sks: true } },
          },
        },
        raporDosen: {
          where: { semesterId: targetSemesterId },
        },
      },
      orderBy: { nama: "asc" },
    });

    const items: RaporDosenListItem[] = [];
    let totalFinal = 0;
    let totalDraft = 0;
    let totalBelumDibuat = 0;

    for (const d of dosens) {
      const existingRapor = d.raporDosen[0] || null;

      let statusRapor: "DRAFT" | "FINAL" | "BELUM_DIBUAT" = "BELUM_DIBUAT";
      if (existingRapor) {
        statusRapor = existingRapor.statusRapor as any;
      }

      // Hitung akumulasi status sebelum filter
      if (statusRapor === "FINAL") totalFinal++;
      else if (statusRapor === "DRAFT") totalDraft++;
      else totalBelumDibuat++;

      // Filter status jika ada
      if (filters?.status && filters.status !== "ALL" && statusRapor !== filters.status) {
        continue;
      }

      const pred = determinePredikat(existingRapor?.nilaiAkhir);

      const isLengkap = Boolean(
        existingRapor?.nilaiKuesioner != null &&
        existingRapor?.rerataSesiHadir != null &&
        existingRapor?.persenKonten != null
      );

      const allClasses = [...(d.kelas || []), ...(d.kelasTandem || [])];
      const totalKelas = allClasses.length;

      // Kumpulkan Mata Kuliah unik, Kelas unik & Total SKS
      const mkMap = new Map<string, { nama: string; sks: number }>();
      const kelasSet = new Set<string>();
      let totalSks = 0;

      for (const cls of allClasses) {
        if (cls.kodeKelas) kelasSet.add(cls.kodeKelas);
        if (cls.mataKuliah) {
          if (!mkMap.has(cls.mataKuliah.id)) {
            mkMap.set(cls.mataKuliah.id, {
              nama: cls.mataKuliah.nama,
              sks: cls.mataKuliah.sks || 0,
            });
            totalSks += cls.mataKuliah.sks || 0;
          }
        }
      }

      const mataKuliahList = Array.from(mkMap.values()).map((m) => m.nama);
      const kelasList = Array.from(kelasSet);

      // Hitung Sesi Hadir & Sesi Beban
      const targetSesiPerKelas = config?.targetSesi || 16;
      const totalSesiBeban = totalKelas * targetSesiPerKelas;
      const totalSesiHadir =
        existingRapor?.rerataSesiHadir != null
          ? Math.round(existingRapor.rerataSesiHadir * totalKelas)
          : null;

      // Hitung Poin Konten 3 Pilar
      const regularClasses = allClasses.filter((c) => c.modePembelajaran !== "BIMBINGAN");
      const maxSkorKonten = regularClasses.reduce(
        (sum, c) => sum + (c.modePembelajaran === "LURING" ? 28 : 42),
        0
      );
      const totalSkorKonten =
        existingRapor?.persenKonten != null && maxSkorKonten > 0
          ? Math.round((existingRapor.persenKonten / 100) * maxSkorKonten)
          : null;

      items.push({
        id: existingRapor?.id || null,
        dosenId: d.id,
        dosenNama: d.nama,
        nip: d.nip,
        nidn: d.nidn,
        prodiNama: d.prodi.nama,
        prodiKode: d.prodi.kode,
        totalKelas,
        totalSks,
        mataKuliahList,
        kelasList,
        totalSesiHadir,
        totalSesiBeban,
        totalSkorKonten,
        maxSkorKonten,
        nilaiKuesioner: existingRapor?.nilaiKuesioner ?? null,
        totalResponden: existingRapor?.totalResponden ?? null,
        targetResponden: existingRapor?.targetResponden ?? null,
        rerataSesiHadir: existingRapor?.rerataSesiHadir ?? null,
        persenKehadiran: existingRapor?.persenKehadiran ?? null,
        persenKonten: existingRapor?.persenKonten ?? null,
        jumlahPenelitian: existingRapor?.jumlahPenelitian ?? 0,
        jumlahPengabdian: existingRapor?.jumlahPengabdian ?? 0,
        nilaiAkhir: existingRapor?.nilaiAkhir ?? null,
        predikat: existingRapor?.predikat ?? null,
        predikatLabel: pred.label,
        predikatColor: pred.color,
        statusRapor,
        isLengkap,
        catatanQau: existingRapor?.catatanQau ?? null,
        updatedAt: existingRapor?.updatedAt || null,
      });
    }

    const ratedItems = items.filter((i) => i.nilaiAkhir != null);
    const avgNilaiAkhir =
      ratedItems.length > 0
        ? Math.round(
            (ratedItems.reduce((acc, i) => acc + (i.nilaiAkhir || 0), 0) / ratedItems.length) * 100
          ) / 100
        : null;

    const summary: RaporDosenSummary = {
      totalDosen: items.length,
      totalFinal,
      totalDraft,
      totalBelumDibuat,
      avgNilaiAkhir,
    };

    return {
      success: true,
      data: {
        items,
        summary,
        config,
        activeSemester: currentSemester,
        currentSemester,
        semesters: allSemesters,
        prodiList,
        totalDosen: items.length,
        totalFinal,
        totalDraft,
        totalBelumDibuat,
        avgNilaiAkhir,
      },
    };
  } catch (error: any) {
    console.error("Error getRaporDosenList:", error);
    return { success: false, error: error.message || "Gagal memuat daftar rapor dosen" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DETAIL RAPOR DOSEN (UNTUK MODAL EDIT & PRINT VIEW)
// ─────────────────────────────────────────────────────────────────────────────

export interface RaporDosenDetailData {
  dosen: {
    id: string;
    nama: string;
    nip: string | null;
    nidn: string | null;
    email: string | null;
    prodi: { id: string; nama: string; kode: string };
  };
  semester: {
    id: string;
    tahunAkademik: string;
    periode: string;
  };
  config: RaporConfigData;
  rapor: {
    id?: string;
    nilaiKuesioner: number | null;
    totalResponden: number | null;
    targetResponden: number | null;
    rerataSesiHadir: number | null;
    persenKehadiran: number | null;
    persenKonten: number | null;
    jumlahPenelitian: number;
    jumlahPengabdian: number;
    rekomendasiPerbaikan: string[];
    komentarMahasiswa: string[];
    rawKomentarMahasiswa?: string[];
    responPositifCount: number | null;
    responNetralCount: number | null;
    responNegatifCount: number | null;
    responPositifPct: number | null;
    responNetralPct: number | null;
    responNegatifPct: number | null;
    narasiKesimpulan: string | null;
    statusRapor: "DRAFT" | "FINAL";
    sumberImport: string | null;
    catatanQau: string | null;
    updatedAt?: Date | null;
  };
  monitoringStats: LecturerMonitoringStats;
  calculation: RaporCalculatedResult;
}

export async function getRaporDosenDetail(
  dosenId: string,
  semesterId?: string
): Promise<{ success: boolean; data?: RaporDosenDetailData; error?: string }> {
  try {
    const dosen = await prisma.dosen.findUnique({
      where: { id: dosenId },
      include: { prodi: true },
    });

    if (!dosen) {
      return { success: false, error: "Dosen tidak ditemukan" };
    }

    let targetSemesterId = semesterId;
    if (!targetSemesterId) {
      const activeSem =
        (await prisma.semester.findFirst({ where: { aktif: true } })) ||
        (await prisma.semester.findFirst({
          orderBy: [{ tahunAkademik: "desc" }, { periode: "desc" }],
        }));
      targetSemesterId = activeSem?.id;
    }

    if (!targetSemesterId) {
      return { success: false, error: "Semester tidak ditemukan" };
    }

    const semester = await prisma.semester.findUnique({
      where: { id: targetSemesterId },
    });

    if (!semester) {
      return { success: false, error: "Semester tidak ditemukan" };
    }

    const config = await getRaporConfig(targetSemesterId);
    const existingRapor = await prisma.raporDosen.findUnique({
      where: {
        dosenId_semesterId: {
          dosenId,
          semesterId: targetSemesterId,
        },
      },
    });

    const monitoringStats = await getLecturerMonitoringStats(dosenId, targetSemesterId);

    // Prioritaskan nilai tersimpan, jika belum ada ambil dari monitoring real-time
    const rerataSesiHadir = existingRapor?.rerataSesiHadir ?? monitoringStats.rerataSesiHadir;
    const persenKehadiran = existingRapor?.persenKehadiran ?? monitoringStats.persenKehadiran;
    const persenKonten = existingRapor?.persenKonten ?? monitoringStats.persenKonten;

    const rawInput = {
      nilaiKuesioner: existingRapor?.nilaiKuesioner ?? null,
      totalResponden: existingRapor?.totalResponden ?? null,
      targetResponden: existingRapor?.targetResponden ?? null,
      rerataSesiHadir,
      persenKehadiran,
      persenKonten,
      jumlahPenelitian: existingRapor?.jumlahPenelitian ?? 0,
      jumlahPengabdian: existingRapor?.jumlahPengabdian ?? 0,
    };

    const calculation = calculateRaporFull(rawInput, config);

    // Parsing JSON arrays
    let rekomendasiPerbaikan: string[] = [];
    if (existingRapor?.rekomendasiPerbaikan) {
      rekomendasiPerbaikan = Array.isArray(existingRapor.rekomendasiPerbaikan)
        ? (existingRapor.rekomendasiPerbaikan as string[])
        : [];
    }

    let komentarMahasiswa: string[] = [];
    if (existingRapor?.komentarMahasiswa) {
      komentarMahasiswa = Array.isArray(existingRapor.komentarMahasiswa)
        ? (existingRapor.komentarMahasiswa as string[])
        : [];
    }

    let rawKomentarMahasiswa: string[] = [];
    if (existingRapor?.rawKomentarMahasiswa) {
      rawKomentarMahasiswa = Array.isArray(existingRapor.rawKomentarMahasiswa)
        ? (existingRapor.rawKomentarMahasiswa as string[])
        : [];
    }

    return {
      success: true,
      data: {
        dosen: {
          id: dosen.id,
          nama: dosen.nama,
          nip: dosen.nip,
          nidn: dosen.nidn,
          email: dosen.email,
          prodi: {
            id: dosen.prodi.id,
            nama: dosen.prodi.nama,
            kode: dosen.prodi.kode,
          },
        },
        semester: {
          id: semester.id,
          tahunAkademik: semester.tahunAkademik,
          periode: semester.periode,
        },
        config,
        rapor: {
          id: existingRapor?.id,
          nilaiKuesioner: existingRapor?.nilaiKuesioner ?? null,
          totalResponden: existingRapor?.totalResponden ?? null,
          targetResponden: existingRapor?.targetResponden ?? null,
          rerataSesiHadir,
          persenKehadiran,
          persenKonten,
          jumlahPenelitian: existingRapor?.jumlahPenelitian ?? 0,
          jumlahPengabdian: existingRapor?.jumlahPengabdian ?? 0,
          rekomendasiPerbaikan,
          komentarMahasiswa,
          rawKomentarMahasiswa,
          responPositifCount: existingRapor?.responPositifCount ?? null,
          responNetralCount: existingRapor?.responNetralCount ?? null,
          responNegatifCount: existingRapor?.responNegatifCount ?? null,
          responPositifPct: existingRapor?.responPositifPct ?? null,
          responNetralPct: existingRapor?.responNetralPct ?? null,
          responNegatifPct: existingRapor?.responNegatifPct ?? null,
          narasiKesimpulan: existingRapor?.narasiKesimpulan ?? null,
          statusRapor: (existingRapor?.statusRapor as any) || "DRAFT",
          sumberImport: existingRapor?.sumberImport ?? null,
          catatanQau: existingRapor?.catatanQau ?? null,
          updatedAt: existingRapor?.updatedAt ?? null,
        },
        monitoringStats,
        calculation,
      },
    };
  } catch (error: any) {
    console.error("Error getRaporDosenDetail:", error);
    return { success: false, error: error.message || "Gagal memuat detail rapor dosen" };
  }
}

export async function getBatchRaporDosenDetails(
  dosenIds: string[],
  semesterId?: string
): Promise<{ success: boolean; data?: RaporDosenDetailData[]; error?: string }> {
  try {
    const results: RaporDosenDetailData[] = [];
    for (const id of dosenIds) {
      const res = await getRaporDosenDetail(id, semesterId);
      if (res.success && res.data) {
        results.push(res.data);
      }
    }
    return { success: true, data: results };
  } catch (error: any) {
    console.error("Error getBatchRaporDosenDetails:", error);
    return { success: false, error: error.message || "Gagal memuat data rapor massal" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SAVE / UPDATE RAPOR DOSEN
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveRaporDosenPayload {
  dosenId: string;
  semesterId: string;
  nilaiKuesioner?: number | null;
  totalResponden?: number | null;
  targetResponden?: number | null;
  rerataSesiHadir?: number | null;
  persenKehadiran?: number | null;
  persenKonten?: number | null;
  jumlahPenelitian?: number;
  jumlahPengabdian?: number;
  rekomendasiPerbaikan?: string[];
  komentarMahasiswa?: string[];
  rawKomentarMahasiswa?: string[];
  responPositifCount?: number | null;
  responNetralCount?: number | null;
  responNegatifCount?: number | null;
  responPositifPct?: number | null;
  responNetralPct?: number | null;
  responNegatifPct?: number | null;
  narasiKesimpulan?: string | null;
  statusRapor?: "DRAFT" | "FINAL";
  catatanQau?: string | null;
  sumberImport?: string | null;
}

export async function saveRaporDosen(
  payload: SaveRaporDosenPayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const config = await getRaporConfig(payload.semesterId);

    // Hitung persenKehadiran otomatis jika rerataSesiHadir diubah namun persenKehadiran tidak diisi eksplisit
    const targetSesi = config.targetSesi || 16;
    let resolvedPersenKehadiran = payload.persenKehadiran;
    if (resolvedPersenKehadiran === undefined && payload.rerataSesiHadir !== undefined) {
      resolvedPersenKehadiran = payload.rerataSesiHadir != null
        ? Math.round((payload.rerataSesiHadir / targetSesi) * 1000) / 10
        : null;
    }

    const calc = calculateRaporFull(
      {
        nilaiKuesioner: payload.nilaiKuesioner,
        totalResponden: payload.totalResponden,
        targetResponden: payload.targetResponden,
        rerataSesiHadir: payload.rerataSesiHadir,
        persenKehadiran: resolvedPersenKehadiran,
        persenKonten: payload.persenKonten,
        jumlahPenelitian: payload.jumlahPenelitian,
        jumlahPengabdian: payload.jumlahPengabdian,
      },
      config
    );

    const existing = await prisma.raporDosen.findUnique({
      where: {
        dosenId_semesterId: {
          dosenId: payload.dosenId,
          semesterId: payload.semesterId,
        },
      },
    });

    const dataToSave = {
      nilaiKuesioner: payload.nilaiKuesioner !== undefined ? payload.nilaiKuesioner : (existing?.nilaiKuesioner ?? null),
      totalResponden: payload.totalResponden !== undefined ? payload.totalResponden : (existing?.totalResponden ?? null),
      targetResponden: payload.targetResponden !== undefined ? payload.targetResponden : (existing?.targetResponden ?? null),
      skorKuesioner: calc.skorKuesioner,
      rerataSesiHadir: payload.rerataSesiHadir !== undefined ? payload.rerataSesiHadir : (existing?.rerataSesiHadir ?? null),
      persenKehadiran: resolvedPersenKehadiran !== undefined ? resolvedPersenKehadiran : (existing?.persenKehadiran ?? null),
      skorKehadiran: calc.skorKehadiran,
      persenKonten: payload.persenKonten !== undefined ? payload.persenKonten : (existing?.persenKonten ?? null),
      skorKonten: calc.skorKonten,
      jumlahPenelitian: payload.jumlahPenelitian !== undefined ? payload.jumlahPenelitian : (existing?.jumlahPenelitian ?? 0),
      skorPenelitian: calc.skorPenelitian,
      jumlahPengabdian: payload.jumlahPengabdian !== undefined ? payload.jumlahPengabdian : (existing?.jumlahPengabdian ?? 0),
      skorPengabdian: calc.skorPengabdian,
      nilaiAkhir: calc.nilaiAkhir,
      predikat: calc.predikat.kode,
      rekomendasiPerbaikan: payload.rekomendasiPerbaikan !== undefined
        ? payload.rekomendasiPerbaikan
        : ((existing?.rekomendasiPerbaikan as any) || []),
      komentarMahasiswa: payload.komentarMahasiswa !== undefined
        ? payload.komentarMahasiswa
        : ((existing?.komentarMahasiswa as any) || []),
      rawKomentarMahasiswa: payload.rawKomentarMahasiswa !== undefined
        ? payload.rawKomentarMahasiswa
        : ((existing?.rawKomentarMahasiswa as any) || undefined),
      responPositifCount: payload.responPositifCount !== undefined ? payload.responPositifCount : (existing?.responPositifCount ?? null),
      responNetralCount: payload.responNetralCount !== undefined ? payload.responNetralCount : (existing?.responNetralCount ?? null),
      responNegatifCount: payload.responNegatifCount !== undefined ? payload.responNegatifCount : (existing?.responNegatifCount ?? null),
      responPositifPct: payload.responPositifPct !== undefined ? payload.responPositifPct : (existing?.responPositifPct ?? null),
      responNetralPct: payload.responNetralPct !== undefined ? payload.responNetralPct : (existing?.responNetralPct ?? null),
      responNegatifPct: payload.responNegatifPct !== undefined ? payload.responNegatifPct : (existing?.responNegatifPct ?? null),
      narasiKesimpulan: payload.narasiKesimpulan !== undefined ? payload.narasiKesimpulan : (existing?.narasiKesimpulan ?? null),
      statusRapor: payload.statusRapor || existing?.statusRapor || "DRAFT",
      catatanQau: payload.catatanQau !== undefined ? payload.catatanQau : (existing?.catatanQau ?? null),
      sumberImport: payload.sumberImport !== undefined ? payload.sumberImport : (existing?.sumberImport ?? null),
    };

    const saved = await prisma.raporDosen.upsert({
      where: {
        dosenId_semesterId: {
          dosenId: payload.dosenId,
          semesterId: payload.semesterId,
        },
      },
      create: {
        dosenId: payload.dosenId,
        semesterId: payload.semesterId,
        ...dataToSave,
      },
      update: dataToSave,
    });

    safeRevalidatePath("/laporan/rapor-dosen");
    return { success: true, data: saved };
  } catch (error: any) {
    console.error("Error saveRaporDosen:", error);
    return { success: false, error: error.message || "Gagal menyimpan rapor dosen" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SINKRONISASI OTOMATIS DARI MONITORING CDU KE RAPOR DOSEN
// ─────────────────────────────────────────────────────────────────────────────

export async function syncLecturerFromMonitoring(
  dosenId: string,
  semesterId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const stats = await getLecturerMonitoringStats(dosenId, semesterId);
    const existing = await prisma.raporDosen.findUnique({
      where: {
        dosenId_semesterId: { dosenId, semesterId },
      },
    });

    const savedRes = await saveRaporDosen({
      dosenId,
      semesterId,
      nilaiKuesioner: existing?.nilaiKuesioner ?? null,
      totalResponden: existing?.totalResponden ?? null,
      targetResponden: existing?.targetResponden ?? null,
      rerataSesiHadir: stats.rerataSesiHadir,
      persenKehadiran: stats.persenKehadiran,
      persenKonten: stats.persenKonten,
      jumlahPenelitian: existing?.jumlahPenelitian ?? 0,
      jumlahPengabdian: existing?.jumlahPengabdian ?? 0,
      rekomendasiPerbaikan: (existing?.rekomendasiPerbaikan as string[]) || [],
      komentarMahasiswa: (existing?.komentarMahasiswa as string[]) || [],
      responPositifCount: existing?.responPositifCount,
      responNetralCount: existing?.responNetralCount,
      responNegatifCount: existing?.responNegatifCount,
      responPositifPct: existing?.responPositifPct,
      responNetralPct: existing?.responNetralPct,
      responNegatifPct: existing?.responNegatifPct,
      narasiKesimpulan: existing?.narasiKesimpulan,
      statusRapor: existing?.statusRapor as any || "DRAFT",
      catatanQau: existing?.catatanQau,
      sumberImport: existing?.sumberImport,
    });

    if (!savedRes.success) return savedRes;

    return {
      success: true,
      data: {
        ...savedRes.data,
        stats,
      },
    };
  } catch (error: any) {
    console.error("Error syncLecturerFromMonitoring:", error);
    return { success: false, error: error.message || "Gagal sinkronisasi data monitoring" };
  }
}

export async function syncAllLecturersFromMonitoring(
  semesterId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Ambil semua dosen yang memiliki kelas di semester ini
    const classes = await prisma.kelas.findMany({
      where: { semesterId },
      select: { dosenId: true, dosen2Id: true },
    });

    const dosenIdSet = new Set<string>();
    classes.forEach((c) => {
      if (c.dosenId) dosenIdSet.add(c.dosenId);
      if (c.dosen2Id) dosenIdSet.add(c.dosen2Id);
    });

    let count = 0;
    for (const dId of dosenIdSet) {
      await syncLecturerFromMonitoring(dId, semesterId);
      count++;
    }

    safeRevalidatePath("/laporan/rapor-dosen");
    return { success: true, count };
  } catch (error: any) {
    console.error("Error syncAllLecturersFromMonitoring:", error);
    return { success: false, error: error.message || "Gagal sinkronisasi seluruh dosen" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. IMPORT FILE SIAKAD ANGKET (.XLS / HTML / XLSX)
// ─────────────────────────────────────────────────────────────────────────────

export interface SiakadPreviewData {
  dosen: {
    id: string;
    nama: string;
    nip: string | null;
    prodi: string;
  };
  semesterInfo: {
    id: string;
    label: string;
    tahunAkademik: string;
    periode: string;
  };
  filePeriode: string;
  isSemesterMismatch: boolean;
  semesterMismatchMessage?: string;
  parsedData: SiakadAngketParsedData;
  cduStats: {
    rerataSesiHadir: number;
    persenKehadiran: number;
    persenKonten: number;
    totalKelas: number;
  };
  nilaiKuesioner: number;
  totalResponden: number;
  rekomendasiPerbaikan: string[];
  komentarMahasiswa: string[];
  rawKomentarMahasiswa: string[];
  aiAnalysis?: GeminiRaporAnalysisResult;
  narasiKesimpulan: string;
  fileName: string;
}

export interface SaveSiakadImportPayload {
  dosenId: string;
  semesterId: string;
  nipFromSiakad?: string;
  nilaiKuesioner: number;
  totalResponden: number;
  komentarMahasiswa: string[];
  rawKomentarMahasiswa: string[];
  rekomendasiPerbaikan: string[];
  narasiKesimpulan?: string;
  aiAnalysis?: GeminiRaporAnalysisResult;
  sumberImport?: string;
}

/**
 * LANGKAH 1: PREVIEW (In-Memory Parsing & Analisis AI tanpa simpan ke database)
 */
export async function previewSiakadAngketAction(
  formData: FormData,
  semesterId: string,
  autoRunGemini: boolean = true
): Promise<{ success: boolean; data?: SiakadPreviewData; error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "File SIAKAD tidak ditemukan pada form upload" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseSiakadAngket(buffer);

    if (!parsed.namaDosen && !parsed.nip) {
      return {
        success: false,
        error: "Format file tidak valid. Header Nama Dosen atau NIP tidak dapat ditemukan dalam file.",
      };
    }

    // 1. Cari Dosen di Database Master
    let matchedDosen: any = null;

    // Prioritas 1: Pencarian Berdasarkan NIP
    if (parsed.nip && parsed.nip.trim().length > 0) {
      const cleanNip = parsed.nip.trim();
      matchedDosen = await prisma.dosen.findFirst({
        where: { nip: cleanNip },
        include: { prodi: true },
      });
    }

    // Prioritas 2: Pencarian Berdasarkan Nama (Fuzzy Match / Case Insensitive)
    if (!matchedDosen && parsed.namaDosen) {
      const cleanParsedName = parsed.namaDosen.replace(/[^a-zA-Z\s]/g, "").trim().toLowerCase();

      matchedDosen = await prisma.dosen.findFirst({
        where: {
          nama: { contains: parsed.namaDosen.trim(), mode: "insensitive" },
        },
        include: { prodi: true },
      });

      if (!matchedDosen) {
        const allDosens = await prisma.dosen.findMany({ include: { prodi: true } });
        matchedDosen = allDosens.find((d) => {
          const dClean = d.nama.replace(/[^a-zA-Z\s]/g, "").trim().toLowerCase();
          return dClean.includes(cleanParsedName) || cleanParsedName.includes(dClean);
        });
      }
    }

    if (!matchedDosen) {
      return {
        success: false,
        error: `Dosen '${parsed.namaDosen}' (NIP: ${parsed.nip || "-"}) belum terdaftar di Master Dosen. Silakan daftarkan NIP dosen terlebih dahulu di menu Master Dosen.`,
      };
    }

    // 2. Dapatkan informasi Semester aktif/tujuan
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });

    if (!semester) {
      return { success: false, error: "Semester tujuan tidak ditemukan di sistem." };
    }

    const portalSemesterLabel = `${semester.tahunAkademik} ${semester.periode}`;
    const filePeriode = parsed.periode?.trim() || "";

    // Deteksi Ketidakcocokan Semester
    const normFile = filePeriode.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normPortal = portalSemesterLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
    const isSemesterMismatch = Boolean(
      normFile && normPortal && !normFile.includes(normPortal) && !normPortal.includes(normFile)
    );
    const semesterMismatchMessage = isSemesterMismatch
      ? `Berkas SIAKAD terdata untuk periode "${filePeriode}", sedangkan semester pelaporan yang aktif di portal adalah "${portalSemesterLabel}".`
      : undefined;

    // 3. Ambil statistik CDU monitoring
    const stats = await getLecturerMonitoringStats(matchedDosen.id, semesterId);
    const existingRapor = await prisma.raporDosen.findUnique({
      where: {
        dosenId_semesterId: {
          dosenId: matchedDosen.id,
          semesterId,
        },
      },
    });

    // 4. Susun masukan kritik & saran mahasiswa (Tabel 12 diprioritaskan)
    const kritikSaranTexts = parsed.komentarList
      .filter((k) => k.tipe === "KRITIK_SARAN")
      .map((k) => k.teks);
    const otherComments = parsed.komentarList
      .filter((k) => k.tipe !== "KRITIK_SARAN")
      .map((k) => k.teks);

    const initialKomentar = [...kritikSaranTexts, ...otherComments].slice(0, 5);
    const meaningfulComments = [...kritikSaranTexts, ...otherComments];

    const rekomendasiPerbaikan = parsed.rekomendasiPerbaikanTexts && parsed.rekomendasiPerbaikanTexts.length > 0
      ? parsed.rekomendasiPerbaikanTexts.map((q, i) => `P${i + 1}: ${q}`)
      : ((existingRapor?.rekomendasiPerbaikan as string[]) || []);

    // 5. Jalankan AI Gemini jika diaktifkan (In-Memory Preview tanpa simpan ke DB)
    let aiResult: GeminiRaporAnalysisResult | undefined;
    let finalKomentar = initialKomentar;
    let narasiKesimpulan = existingRapor?.narasiKesimpulan || "Belum ada narasi evaluasi.";

    if (autoRunGemini && meaningfulComments.length > 0) {
      try {
        aiResult = await analyzeRaporWithGemini({
          namaDosen: matchedDosen.nama,
          nip: matchedDosen.nip || parsed.nip,
          prodiNama: matchedDosen.prodi.nama,
          semesterTahun: semester.tahunAkademik,
          semesterPeriode: semester.periode,
          nilaiKuesioner: parsed.nilaiRataRata,
          totalResponden: parsed.totalResponden,
          rerataSesiHadir: stats.totalKelas > 0 ? stats.rerataSesiHadir : (existingRapor?.rerataSesiHadir ?? null),
          persenKehadiran: stats.totalKelas > 0 ? stats.persenKehadiran : (existingRapor?.persenKehadiran ?? null),
          persenKonten: stats.totalKelas > 0 ? stats.persenKonten : (existingRapor?.persenKonten ?? null),
          jumlahPenelitian: existingRapor?.jumlahPenelitian || 0,
          jumlahPengabdian: existingRapor?.jumlahPengabdian || 0,
          lowestQuestions: parsed.lowestQuestions,
          rekomendasiPerbaikanTexts: parsed.rekomendasiPerbaikanTexts,
          rawComments: meaningfulComments,
        });

        if (aiResult?.komentarTerpilih && aiResult.komentarTerpilih.length > 0) {
          finalKomentar = aiResult.komentarTerpilih;
        }
        if (aiResult?.narasiKesimpulan) {
          narasiKesimpulan = aiResult.narasiKesimpulan;
        }
      } catch (aiErr) {
        console.warn("Gagal menjalankan preview Gemini:", aiErr);
      }
    }

    return {
      success: true,
      data: {
        dosen: {
          id: matchedDosen.id,
          nama: matchedDosen.nama,
          nip: matchedDosen.nip || parsed.nip || null,
          prodi: matchedDosen.prodi.nama,
        },
        semesterInfo: {
          id: semester.id,
          label: portalSemesterLabel,
          tahunAkademik: semester.tahunAkademik,
          periode: semester.periode,
        },
        filePeriode,
        isSemesterMismatch,
        semesterMismatchMessage,
        parsedData: parsed,
        cduStats: {
          rerataSesiHadir: stats.rerataSesiHadir,
          persenKehadiran: stats.persenKehadiran,
          persenKonten: stats.persenKonten,
          totalKelas: stats.totalKelas,
        },
        nilaiKuesioner: parsed.nilaiRataRata,
        totalResponden: parsed.totalResponden,
        rekomendasiPerbaikan,
        komentarMahasiswa: finalKomentar,
        rawKomentarMahasiswa: meaningfulComments,
        aiAnalysis: aiResult,
        narasiKesimpulan,
        fileName: file.name,
      },
    };
  } catch (error: any) {
    console.error("Error previewSiakadAngketAction:", error);
    return { success: false, error: error.message || "Gagal memproses file angket SIAKAD" };
  }
}

/**
 * LANGKAH 2: SIMPAN DATA KE DATABASE (Setelah User meninjau dan klik Simpan)
 */
export async function saveSiakadImportAction(
  payload: SaveSiakadImportPayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!payload.dosenId || !payload.semesterId) {
      return { success: false, error: "Dosen ID dan Semester ID wajib disertakan" };
    }

    // 1. Simpan NIP dosen ke master dosen jika di master masih kosong
    if (payload.nipFromSiakad && payload.nipFromSiakad.trim().length > 0) {
      try {
        const d = await prisma.dosen.findUnique({
          where: { id: payload.dosenId },
          select: { nip: true },
        });
        if (!d?.nip) {
          await prisma.dosen.update({
            where: { id: payload.dosenId },
            data: { nip: payload.nipFromSiakad.trim() },
          });
        }
      } catch (nipErr) {
        console.warn("Gagal update NIP dosen saat save:", nipErr);
      }
    }

    // 2. Ambil data monitoring & rapor yang sudah ada
    const stats = await getLecturerMonitoringStats(payload.dosenId, payload.semesterId);
    const existingRapor = await prisma.raporDosen.findUnique({
      where: {
        dosenId_semesterId: {
          dosenId: payload.dosenId,
          semesterId: payload.semesterId,
        },
      },
    });

    const sentimen = payload.aiAnalysis?.analisisSentimen;

    // 3. Simpan rapor via saveRaporDosen
    const saveRes = await saveRaporDosen({
      dosenId: payload.dosenId,
      semesterId: payload.semesterId,
      nilaiKuesioner: payload.nilaiKuesioner,
      totalResponden: payload.totalResponden,
      targetResponden: null,
      rerataSesiHadir: stats.totalKelas > 0 ? stats.rerataSesiHadir : (existingRapor?.rerataSesiHadir ?? null),
      persenKehadiran: stats.totalKelas > 0 ? stats.persenKehadiran : (existingRapor?.persenKehadiran ?? null),
      persenKonten: stats.totalKelas > 0 ? stats.persenKonten : (existingRapor?.persenKonten ?? null),
      jumlahPenelitian: existingRapor?.jumlahPenelitian || 0,
      jumlahPengabdian: existingRapor?.jumlahPengabdian || 0,
      rawKomentarMahasiswa: payload.rawKomentarMahasiswa,
      komentarMahasiswa: payload.komentarMahasiswa,
      rekomendasiPerbaikan: payload.rekomendasiPerbaikan,
      responPositifCount: sentimen?.positifCount ?? existingRapor?.responPositifCount ?? null,
      responNetralCount: sentimen?.netralCount ?? existingRapor?.responNetralCount ?? null,
      responNegatifCount: sentimen?.negatifCount ?? existingRapor?.responNegatifCount ?? null,
      responPositifPct: sentimen?.positifPct ?? existingRapor?.responPositifPct ?? null,
      responNetralPct: sentimen?.netralPct ?? existingRapor?.responNetralPct ?? null,
      responNegatifPct: sentimen?.negatifPct ?? existingRapor?.responNegatifPct ?? null,
      narasiKesimpulan: payload.narasiKesimpulan || existingRapor?.narasiKesimpulan || null,
      sumberImport: payload.sumberImport || "Import SIAKAD",
      statusRapor: (existingRapor?.statusRapor as any) || "DRAFT",
    });

    if (!saveRes.success) {
      return { success: false, error: saveRes.error || "Gagal menyimpan rapor ke database" };
    }

    safeRevalidatePath("/laporan/rapor-dosen");
    safeRevalidatePath(`/laporan/rapor-dosen/${payload.dosenId}`);

    return {
      success: true,
      data: saveRes.data,
    };
  } catch (error: any) {
    console.error("Error saveSiakadImportAction:", error);
    return { success: false, error: error.message || "Gagal menyimpan rapor kuesioner SIAKAD" };
  }
}

export interface ImportSiakadAngketResult {
  matched: boolean;
  dosen?: {
    id: string;
    nama: string;
    nip: string | null;
    prodi: string;
  };
  parsedData: SiakadAngketParsedData;
  rapor?: any;
  aiAnalysis?: GeminiRaporAnalysisResult;
  message: string;
}

export async function importSiakadAngketAction(
  formData: FormData,
  semesterId: string,
  autoRunGemini: boolean = false
): Promise<{ success: boolean; data?: ImportSiakadAngketResult; error?: string }> {
  try {
    const previewRes = await previewSiakadAngketAction(formData, semesterId, autoRunGemini);
    if (!previewRes.success || !previewRes.data) {
      return { success: false, error: previewRes.error || "Gagal memproses file angket SIAKAD" };
    }

    const prev = previewRes.data;
    const saveRes = await saveSiakadImportAction({
      dosenId: prev.dosen.id,
      semesterId,
      nipFromSiakad: prev.parsedData.nip,
      nilaiKuesioner: prev.nilaiKuesioner,
      totalResponden: prev.totalResponden,
      komentarMahasiswa: prev.komentarMahasiswa,
      rawKomentarMahasiswa: prev.rawKomentarMahasiswa,
      rekomendasiPerbaikan: prev.rekomendasiPerbaikan,
      narasiKesimpulan: prev.narasiKesimpulan,
      aiAnalysis: prev.aiAnalysis,
      sumberImport: prev.fileName,
    });

    if (!saveRes.success) {
      return { success: false, error: saveRes.error || "Gagal menyimpan data rapor ke database" };
    }

    return {
      success: true,
      data: {
        matched: true,
        dosen: prev.dosen,
        parsedData: prev.parsedData,
        rapor: saveRes.data,
        aiAnalysis: prev.aiAnalysis,
        message: `Kuesioner SIAKAD berhasil diimpor untuk ${prev.dosen.nama}. Nilai Rata-rata: ${prev.nilaiKuesioner}, Total Responden: ${prev.totalResponden}, Komentar Mahasiswa: ${prev.rawKomentarMahasiswa.length}.${prev.aiAnalysis ? " Analisis AI Gemini selesai." : ""}`,
      },
    };
  } catch (error: any) {
    console.error("Error importSiakadAngketAction:", error);
    return { success: false, error: error.message || "Gagal mengimpor file angket SIAKAD" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. ANALISIS AI GEMINI (K1-K5, P1-P5, SENTIMEN & KESIMPULAN)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeRaporWithGeminiAction(
  dosenId: string,
  semesterId: string,
  lowestQuestions?: Array<{ no: number; pertanyaan: string; rataRata: number }>,
  rekomendasiPerbaikanTexts?: string[]
): Promise<{ success: boolean; data?: GeminiRaporAnalysisResult; error?: string }> {
  try {
    const dosen = await prisma.dosen.findUnique({
      where: { id: dosenId },
      include: { prodi: true },
    });

    if (!dosen) {
      return { success: false, error: "Dosen tidak ditemukan" };
    }

    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });

    if (!semester) {
      return { success: false, error: "Semester tidak ditemukan" };
    }

    const rapor = await prisma.raporDosen.findUnique({
      where: {
        dosenId_semesterId: { dosenId, semesterId },
      },
    });

    if (!rapor) {
      return {
        success: false,
        error: "Data rapor dosen belum dibuat. Silakan impor kuesioner SIAKAD terlebih dahulu.",
      };
    }

    // Prioritaskan arsip komentar mentah lengkap jika ada, fallback ke komentar tersimpan
    const rawComments: string[] = (
      Array.isArray(rapor.rawKomentarMahasiswa) && (rapor.rawKomentarMahasiswa as string[]).length > 0
        ? (rapor.rawKomentarMahasiswa as string[])
        : Array.isArray(rapor.komentarMahasiswa)
        ? (rapor.komentarMahasiswa as string[])
        : []
    );

    if (rawComments.length === 0) {
      return {
        success: false,
        error: "Tidak ada komentar mahasiswa yang dapat dianalisis pada rapor ini.",
      };
    }

    const existingRecs: string[] = Array.isArray(rapor.rekomendasiPerbaikan)
      ? (rapor.rekomendasiPerbaikan as string[])
      : [];
    const resolvedRecs = (rekomendasiPerbaikanTexts && rekomendasiPerbaikanTexts.length > 0)
      ? rekomendasiPerbaikanTexts
      : existingRecs.map((r) => r.replace(/^P\d+:\s*/i, "").trim());

    const analysis = await analyzeRaporWithGemini({
      namaDosen: dosen.nama,
      nip: dosen.nip,
      prodiNama: dosen.prodi.nama,
      semesterTahun: semester.tahunAkademik,
      semesterPeriode: semester.periode,
      nilaiKuesioner: rapor.nilaiKuesioner,
      totalResponden: rapor.totalResponden,
      rerataSesiHadir: rapor.rerataSesiHadir,
      persenKehadiran: rapor.persenKehadiran,
      persenKonten: rapor.persenKonten,
      jumlahPenelitian: rapor.jumlahPenelitian,
      jumlahPengabdian: rapor.jumlahPengabdian,
      nilaiAkhir: rapor.nilaiAkhir,
      predikat: rapor.predikat,
      lowestQuestions,
      rekomendasiPerbaikanTexts: resolvedRecs,
      rawComments,
    });

    // Simpan hasil analisis Gemini ke database
    await prisma.raporDosen.update({
      where: { id: rapor.id },
      data: {
        komentarMahasiswa: analysis.komentarTerpilih,
        rekomendasiPerbaikan: analysis.rekomendasiPerbaikan,
        responPositifCount: analysis.analisisSentimen.positifCount,
        responNetralCount: analysis.analisisSentimen.netralCount,
        responNegatifCount: analysis.analisisSentimen.negatifCount,
        responPositifPct: analysis.analisisSentimen.positifPct,
        responNetralPct: analysis.analisisSentimen.netralPct,
        responNegatifPct: analysis.analisisSentimen.negatifPct,
        narasiKesimpulan: analysis.narasiKesimpulan,
      },
    });

    safeRevalidatePath("/laporan/rapor-dosen");
    return { success: true, data: analysis };
  } catch (error: any) {
    console.error("Error analyzeRaporWithGeminiAction:", error);
    return { success: false, error: error.message || "Gagal menganalisis rapor dengan Gemini" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. DELETE RAPOR DOSEN
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteRaporDosen(
  dosenId: string,
  semesterId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.raporDosen.delete({
      where: {
        dosenId_semesterId: { dosenId, semesterId },
      },
    });
    safeRevalidatePath("/laporan/rapor-dosen");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleteRaporDosen:", error);
    return { success: false, error: error.message || "Gagal menghapus rapor dosen" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. BATCH UPDATE STATUS RAPOR
// ─────────────────────────────────────────────────────────────────────────────

export async function batchUpdateStatusRapor(
  dosenIds: string[],
  semesterId: string,
  status: "DRAFT" | "FINAL"
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const updated = await prisma.raporDosen.updateMany({
      where: {
        semesterId,
        dosenId: { in: dosenIds },
      },
      data: {
        statusRapor: status,
      },
    });

    safeRevalidatePath("/laporan/rapor-dosen");
    return { success: true, count: updated.count };
  } catch (error: any) {
    console.error("Error batchUpdateStatusRapor:", error);
    return { success: false, error: error.message || "Gagal mengubah status batch" };
  }
}

