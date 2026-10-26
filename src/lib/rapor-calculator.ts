// src/lib/rapor-calculator.ts
// Standardized Scoring Calculator for Rapor Dosen (Laporan Evaluasi Tridharma Dosen)
// Nusa Putra University - Quality Assurance Unit (QAU) & CDU

export interface PredikatItem {
  kode: "SANGAT_BAIK" | "BAIK" | "CUKUP" | "KURANG_BAIK" | "KURANG" | "BELUM_LENGKAP";
  label: string;
  color: "emerald" | "blue" | "amber" | "orange" | "rose" | "gray";
  minScore: number;
  maxScore: number;
}

export const PREDIKAT_RULES: Record<string, PredikatItem> = {
  SANGAT_BAIK: {
    kode: "SANGAT_BAIK",
    label: "Sangat Baik",
    color: "emerald",
    minScore: 4.58,
    maxScore: 5.0,
  },
  BAIK: {
    kode: "BAIK",
    label: "Baik",
    color: "blue",
    minScore: 4.12,
    maxScore: 4.57,
  },
  CUKUP: {
    kode: "CUKUP",
    label: "Cukup",
    color: "amber",
    minScore: 3.66,
    maxScore: 4.11,
  },
  KURANG_BAIK: {
    kode: "KURANG_BAIK",
    label: "Kurang Baik",
    color: "orange",
    minScore: 3.2,
    maxScore: 3.65,
  },
  KURANG: {
    kode: "KURANG_BAIK",
    label: "Kurang Baik",
    color: "orange",
    minScore: 1.0,
    maxScore: 3.65,
  },
  BELUM_LENGKAP: {
    kode: "BELUM_LENGKAP",
    label: "Belum Lengkap",
    color: "gray",
    minScore: 0,
    maxScore: 0,
  },
};

export interface RaporConfigData {
  bobotKuesioner: number; // default: 40.0%
  bobotKehadiran: number; // default: 20.0%
  bobotKonten: number; // default: 20.0%
  bobotPenelitian: number; // default: 10.0%
  bobotPengabdian: number; // default: 10.0%
  targetSesi: number; // default: 16
}

export const DEFAULT_RAPOR_CONFIG: RaporConfigData = {
  bobotKuesioner: 40.0,
  bobotKehadiran: 20.0,
  bobotKonten: 20.0,
  bobotPenelitian: 10.0,
  bobotPengabdian: 10.0,
  targetSesi: 16,
};

export interface IndikatorPenilaianDetail {
  id: "kuesioner" | "kehadiran" | "konten" | "penelitian" | "pengabdian";
  nama: string;
  satuan: string; // Tampilan Data Riil, e.g. "4.10 / 5.00 (191 Responden)", "14.0 Sesi (87.5%)"
  capaianRiil: number | null;
  skorStandar: number | null; // Skala 1.00 - 5.00
  bobot: number; // Persentase bobot, misal 40%
  skorTerbobot: number | null; // (skorStandar * bobot) / 100
  predikat: PredikatItem;
  keterangan: string;
}

export interface RaporRawInput {
  nilaiKuesioner?: number | null;
  totalResponden?: number | null;
  targetResponden?: number | null;
  rerataSesiHadir?: number | null;
  persenKehadiran?: number | null;
  persenKonten?: number | null;
  jumlahPenelitian?: number | null;
  jumlahPengabdian?: number | null;
}

export interface RaporCalculatedResult {
  skorKuesioner: number | null;
  skorKehadiran: number | null;
  skorKonten: number | null;
  skorPenelitian: number;
  skorPengabdian: number;
  nilaiAkhir: number | null; // Skala 1.00 - 5.00
  predikat: PredikatItem;
  isLengkap: boolean;
  indikatorList: IndikatorPenilaianDetail[];
}

/**
 * 1. PENSKORAN KUESIONER MAHASISWA (SIAKAD)
 * Nilai dari SIAKAD sudah berskala 1.00 - 5.00
 */
export function calculateScoreKuesioner(val?: number | null): number | null {
  if (val == null || isNaN(val) || val <= 0) return null;
  const clamped = Math.max(1.0, Math.min(5.0, val));
  return Math.round(clamped * 100) / 100;
}

/**
 * 2. PENSKORAN KEHADIRAN MENGAJAR (CDU)
 * Berdasarkan rata-rata sesi hadir per kelas terhadap targetSesi (default 16).
 * Rumus: (rerataSesi / targetSesi) * 5.00, minimal 1.00 jika ada sesi, maksimal 5.00
 */
export function calculateScoreKehadiran(
  rerataSesi?: number | null,
  targetSesi: number = 16
): number | null {
  if (rerataSesi == null || isNaN(rerataSesi)) return null;
  if (rerataSesi <= 0) return 1.0;
  const rawScore = (rerataSesi / (targetSesi || 16)) * 5.0;
  const clamped = Math.max(1.0, Math.min(5.0, rawScore));
  return Math.round(clamped * 100) / 100;
}

/**
 * 3. PENSKORAN KELENGKAPAN KONTEN LMS (CDU 3 PILAR)
 * Konversi persentase pemenuhan konten (0% - 100%) ke skala 1.00 - 5.00.
 * Rumus: 1.00 + (persenKonten / 100) * 4.00
 * Contoh: 100% -> 5.00, 75% -> 4.00, 50% -> 3.00, 0% -> 1.00
 */
export function calculateScoreKonten(persenKonten?: number | null): number | null {
  if (persenKonten == null || isNaN(persenKonten)) return null;
  const clampedPct = Math.max(0, Math.min(100, persenKonten));
  const score = 1.0 + (clampedPct / 100) * 4.0;
  return Math.round(score * 100) / 100;
}

/**
 * 4 & 5. PENSKORAN TRIDHARMA (PENELITIAN & PENGABDIAN MASYARAKAT)
 * Standar QAU Nusa Putra (Permintaan User Poin 7.3):
 * - 0 = Kurang Baik (3.20)
 * - 1 = Cukup (3.88)
 * - 2 = Baik (4.35)
 * - >= 3 = Sangat Baik (5.00)
 */
export function calculateScoreTridharma(count?: number | null): number {
  const c = Math.max(0, Math.floor(count || 0));
  if (c === 0) return 3.2;
  if (c === 1) return 3.88;
  if (c === 2) return 4.35;
  return 5.0;
}

/**
 * MENGHITUNG PREDIKAT DARI SKOR STANDAR (1.00 - 5.00)
 * Kriteria Penskoran:
 * >= 4.58       : Sangat Baik
 * 4.12 - 4.57   : Baik
 * 3.66 - 4.11   : Cukup
 * 3.20 - 3.65   : Kurang Baik
 * < 3.20        : Kurang
 */
export function determinePredikat(score?: number | null): PredikatItem {
  if (score == null || isNaN(score) || score <= 0) {
    return PREDIKAT_RULES.BELUM_LENGKAP;
  }
  const s = Math.round(score * 100) / 100;
  if (s >= 4.58) return PREDIKAT_RULES.SANGAT_BAIK;
  if (s >= 4.12) return PREDIKAT_RULES.BAIK;
  if (s >= 3.66) return PREDIKAT_RULES.CUKUP;
  return PREDIKAT_RULES.KURANG_BAIK;
}

/**
 * KALKULASI LENGKAP RAPOR DOSEN (5 INDIKATOR + BOBOT + PREDIKAT)
 */
export function calculateRaporFull(
  raw: RaporRawInput,
  config: RaporConfigData = DEFAULT_RAPOR_CONFIG
): RaporCalculatedResult {
  const skorKuesioner = calculateScoreKuesioner(raw.nilaiKuesioner);
  const skorKehadiran = calculateScoreKehadiran(raw.rerataSesiHadir, config.targetSesi);
  const skorKonten = calculateScoreKonten(raw.persenKonten);
  const skorPenelitian = calculateScoreTridharma(raw.jumlahPenelitian);
  const skorPengabdian = calculateScoreTridharma(raw.jumlahPengabdian);

  const bobotKues = config.bobotKuesioner ?? 40.0;
  const bobotHadir = config.bobotKehadiran ?? 20.0;
  const bobotKont = config.bobotKonten ?? 20.0;
  const bobotPen = config.bobotPenelitian ?? 10.0;
  const bobotPeng = config.bobotPengabdian ?? 10.0;

  // Cek kelengkapan (apakah kuesioner, kehadiran, dan konten sudah terisi)
  const isLengkap = skorKuesioner !== null && skorKehadiran !== null && skorKonten !== null;

  // Hitung Nilai Akhir Terbobot jika semua indikator ada
  let nilaiAkhir: number | null = null;
  if (isLengkap) {
    const totalBobot = bobotKues + bobotHadir + bobotKont + bobotPen + bobotPeng;
    const divisor = totalBobot > 0 ? totalBobot : 100.0;

    const weightedSum =
      (skorKuesioner! * bobotKues) +
      (skorKehadiran! * bobotHadir) +
      (skorKonten! * bobotKont) +
      (skorPenelitian * bobotPen) +
      (skorPengabdian * bobotPeng);

    nilaiAkhir = Math.round((weightedSum / divisor) * 100) / 100;
  }

  const predikat = determinePredikat(nilaiAkhir);

  // Satuan & Capaian Riil
  const kuesionerSatuan = raw.nilaiKuesioner != null
    ? `${raw.nilaiKuesioner.toFixed(2)} / 5.00` + (raw.totalResponden ? ` (${raw.totalResponden} Responden)` : "")
    : "Belum Diimpor";

  const kehadiranSatuan = raw.rerataSesiHadir != null
    ? `${raw.rerataSesiHadir.toFixed(1)} Sesi` + (raw.persenKehadiran != null ? ` (${raw.persenKehadiran.toFixed(1)}%)` : "")
    : "Belum Ada Data";

  const kontenSatuan = raw.persenKonten != null
    ? `${raw.persenKonten.toFixed(1)}% Standar CDU`
    : "Belum Ada Data";

  const penelitianSatuan = `${raw.jumlahPenelitian || 0} Judul / Publikasi`;
  const pengabdianSatuan = `${raw.jumlahPengabdian || 0} Kegiatan PkM`;

  // Indikator List Detail
  const indikatorList: IndikatorPenilaianDetail[] = [
    {
      id: "kuesioner",
      nama: "Kuesioner Mahasiswa",
      satuan: kuesionerSatuan,
      capaianRiil: raw.nilaiKuesioner ?? null,
      skorStandar: skorKuesioner,
      bobot: bobotKues,
      skorTerbobot: skorKuesioner !== null ? Math.round(((skorKuesioner * bobotKues) / 100) * 100) / 100 : null,
      predikat: determinePredikat(skorKuesioner),
      keterangan: skorKuesioner !== null ? determinePredikat(skorKuesioner).label : "Belum Ada Data",
    },
    {
      id: "kehadiran",
      nama: "Kehadiran Mengajar",
      satuan: kehadiranSatuan,
      capaianRiil: raw.rerataSesiHadir ?? null,
      skorStandar: skorKehadiran,
      bobot: bobotHadir,
      skorTerbobot: skorKehadiran !== null ? Math.round(((skorKehadiran * bobotHadir) / 100) * 100) / 100 : null,
      predikat: determinePredikat(skorKehadiran),
      keterangan: skorKehadiran !== null ? determinePredikat(skorKehadiran).label : "Belum Ada Data",
    },
    {
      id: "konten",
      nama: "Kelengkapan Konten Perkuliahan",
      satuan: kontenSatuan,
      capaianRiil: raw.persenKonten ?? null,
      skorStandar: skorKonten,
      bobot: bobotKont,
      skorTerbobot: skorKonten !== null ? Math.round(((skorKonten * bobotKont) / 100) * 100) / 100 : null,
      predikat: determinePredikat(skorKonten),
      keterangan: skorKonten !== null ? determinePredikat(skorKonten).label : "Belum Ada Data",
    },
    {
      id: "penelitian",
      nama: "Penelitian",
      satuan: penelitianSatuan,
      capaianRiil: raw.jumlahPenelitian ?? 0,
      skorStandar: skorPenelitian,
      bobot: bobotPen,
      skorTerbobot: Math.round(((skorPenelitian * bobotPen) / 100) * 100) / 100,
      predikat: determinePredikat(skorPenelitian),
      keterangan: determinePredikat(skorPenelitian).label,
    },
    {
      id: "pengabdian",
      nama: "Pengabdian Masyarakat",
      satuan: pengabdianSatuan,
      capaianRiil: raw.jumlahPengabdian ?? 0,
      skorStandar: skorPengabdian,
      bobot: bobotPeng,
      skorTerbobot: Math.round(((skorPengabdian * bobotPeng) / 100) * 100) / 100,
      predikat: determinePredikat(skorPengabdian),
      keterangan: determinePredikat(skorPengabdian).label,
    },
  ];

  return {
    skorKuesioner,
    skorKehadiran,
    skorKonten,
    skorPenelitian,
    skorPengabdian,
    nilaiAkhir,
    predikat,
    isLengkap,
    indikatorList,
  };
}

export const calculateRaporDosen = calculateRaporFull;

