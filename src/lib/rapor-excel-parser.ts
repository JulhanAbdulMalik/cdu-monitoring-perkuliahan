// src/lib/rapor-excel-parser.ts
// Parser & Normalizer Berkas Excel untuk Rapor Dosen (Tridharma LPPM & Rekap Semester Lampau)
// Mengikuti standar resmi QAU & CDU Universitas Nusa Putra

import * as XLSX from "xlsx";
import { calculateScoreTridharma, determinePredikat } from "./rapor-calculator";

// ─────────────────────────────────────────────────────────────────────────────
// 1. DATA TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TridharmaParsedRow {
  rowNumber: number;
  nipNidn?: string | null;
  namaDosen: string;
  prodi?: string | null;
  jumlahPenelitian: number;
  jumlahPengabdian: number;
}

export interface TridharmaPreviewItem {
  rowNumber: number;
  dosenId: string | null;
  dosenNama: string;
  nipNidn: string | null;
  prodiNama: string;
  isMatched: boolean;
  penelitianLama: number;
  penelitianBaru: number;
  pengabdianLama: number;
  pengabdianBaru: number;
  skorPenelitianBaru: number;
  skorPengabdianBaru: number;
}

export interface RekapLampauParsedRow {
  rowNumber: number;
  nipNidn?: string | null;
  namaDosen: string;
  prodi?: string | null;
  jumlahMatkul: number;
  jumlahKelas: number;
  totalResponden: number | null;
  nilaiKuesioner: number | null;
  jumlahKehadiranSesi: number | null; // Sesi rata-rata (misal: 14 atau 16)
  kontenSkalaLama: number | null;     // Skala lama (misal: 4.0, 5.6, 6.0)
  jumlahPenelitian: number;
  jumlahPengabdian: number;
}

export interface RekapLampauPreviewItem {
  rowNumber: number;
  dosenId: string | null;
  dosenNama: string;
  nipNidn: string | null;
  prodiNama: string;
  isMatched: boolean;
  jumlahMatkul: number;
  jumlahKelas: number;
  totalResponden: number | null;
  nilaiKuesioner: number | null;
  // Normalisasi Kehadiran (Format: X / Y Sesi (Z%))
  totalSesiHadir: number | null;
  totalSesiBeban: number | null;
  persenKehadiran: number | null;
  skorKehadiran: number | null;
  // Normalisasi Konten (Format: X / Y Poin (Z%))
  totalSkorKonten: number | null;
  maxSkorKonten: number | null;
  persenKonten: number | null;
  skorKonten: number | null;
  // Tridharma
  jumlahPenelitian: number;
  jumlahPengabdian: number;
  // Estimasi Nilai Akhir
  estimasiNilaiAkhir: number | null;
  predikatKode: string | null;
  predikatLabel: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HELPER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Membersihkan nama kolom untuk pencocokan header yang fleksibel
 */
function normalizeHeader(key: string): string {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Parsing angka dari cell Excel (mendukung string koma/titik, bilangan negatif/kosong)
 */
function parseCellNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : val;
  const str = String(val).trim().replace(",", ".");
  if (str === "-" || str === "–") return fallback;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Ekstraksi cerdas jumlah responden:
 * Jika cell berisi "191 dari 274" atau "191/274", sistem mengambil angka 191
 */
function extractRespondenCount(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Math.round(val);
  const str = String(val).trim();
  if (str === "-" || str === "–") return null;

  // Pola "191 dari 274" atau "191 / 274" atau "191"
  const match = str.match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PARSER EXCEL: TRIDHARMA LPPM (PENELITIAN & PKM)
// ─────────────────────────────────────────────────────────────────────────────

export function parseTridharmaExcelBuffer(buffer: Buffer | ArrayBuffer): TridharmaParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("File Excel tidak memiliki lembar kerja (sheet).");

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("File Excel kosong atau tidak memiliki baris data.");
  }

  const results: TridharmaParsedRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    // Petakan kolom berdasarkan variasi nama header
    let namaDosen = "";
    let nipNidn: string | null = null;
    let prodi: string | null = null;
    let penelitianVal: any = 0;
    let pengabdianVal: any = 0;
    let noVal: any = i + 1;

    for (const [rawKey, rawVal] of Object.entries(row)) {
      const norm = normalizeHeader(rawKey);

      if (norm === "no" || norm === "nomor") {
        noVal = rawVal;
      } else if (norm.includes("nip") || norm.includes("nidn")) {
        const strVal = String(rawVal).trim();
        if (strVal && strVal !== "-") nipNidn = strVal;
      } else if (norm.includes("nama") || norm === "dosen") {
        const strVal = String(rawVal).trim();
        if (strVal) namaDosen = strVal;
      } else if (norm.includes("prodi") || norm.includes("programstudi") || norm.includes("jurusan") || norm.includes("homebase")) {
        const strVal = String(rawVal).trim();
        if (strVal && strVal !== "-") prodi = strVal;
      } else if (norm.includes("penelitian") || norm.includes("publikasi")) {
        penelitianVal = rawVal;
      } else if (norm.includes("pengabdian") || norm.includes("pkm")) {
        pengabdianVal = rawVal;
      }
    }

    if (!namaDosen) {
      // Lewati baris tanpa nama dosen
      continue;
    }

    const jumlahPenelitian = Math.max(0, Math.round(parseCellNumber(penelitianVal, 0)));
    const jumlahPengabdian = Math.max(0, Math.round(parseCellNumber(pengabdianVal, 0)));

    results.push({
      rowNumber: i + 2, // Baris pada spreadsheet Excel (1-based + 1 baris header)
      nipNidn,
      namaDosen,
      prodi,
      jumlahPenelitian,
      jumlahPengabdian,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PARSER EXCEL: REKAP SEMESTER LAMPAU (2025/2026)
// ─────────────────────────────────────────────────────────────────────────────

export function parseRekapLampauExcelBuffer(buffer: Buffer | ArrayBuffer): RekapLampauParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("File Excel tidak memiliki lembar kerja (sheet).");

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("File Excel kosong atau tidak memiliki baris data.");
  }

  const results: RekapLampauParsedRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    let namaDosen = "";
    let nipNidn: string | null = null;
    let prodi: string | null = null;
    let matkulVal: any = 0;
    let kelasVal: any = 0;
    let respondenVal: any = null;
    let kuesionerVal: any = null;
    let kehadiranVal: any = null;
    let kontenVal: any = null;
    let penelitianVal: any = 0;
    let pengabdianVal: any = 0;

    for (const [rawKey, rawVal] of Object.entries(row)) {
      const norm = normalizeHeader(rawKey);

      if (norm.includes("nip") || norm.includes("nidn")) {
        const strVal = String(rawVal).trim();
        if (strVal && strVal !== "-") nipNidn = strVal;
      } else if (norm.includes("nama") || norm === "dosen") {
        const strVal = String(rawVal).trim();
        if (strVal) namaDosen = strVal;
      } else if (norm.includes("prodi") || norm.includes("programstudi") || norm.includes("jurusan") || norm.includes("homebase")) {
        const strVal = String(rawVal).trim();
        if (strVal && strVal !== "-") prodi = strVal;
      } else if (norm.includes("matkul") || norm.includes("matakuliah")) {
        matkulVal = rawVal;
      } else if (norm.includes("kelas") || norm.includes("rombel")) {
        kelasVal = rawVal;
      } else if (norm.includes("responden") || norm.includes("mhs")) {
        respondenVal = rawVal;
      } else if (norm.includes("kuesioner") || norm.includes("angket")) {
        kuesionerVal = rawVal;
      } else if (norm.includes("kehadiran") || norm.includes("hadir") || norm.includes("presensi")) {
        kehadiranVal = rawVal;
      } else if (norm.includes("konten") || norm.includes("lms") || norm.includes("3pilar")) {
        kontenVal = rawVal;
      } else if (norm.includes("penelitian") || norm.includes("publikasi")) {
        penelitianVal = rawVal;
      } else if (norm.includes("pengabdian") || norm.includes("pkm")) {
        pengabdianVal = rawVal;
      }
    }

    if (!namaDosen) {
      continue;
    }

    const jumlahMatkul = Math.max(0, Math.round(parseCellNumber(matkulVal, 0)));
    const jumlahKelas = Math.max(0, Math.round(parseCellNumber(kelasVal, 0)));
    const totalResponden = extractRespondenCount(respondenVal);
    
    // Kuesioner: skala 1.00 - 5.00 (bisa kosong)
    const rawKues = parseCellNumber(kuesionerVal, -1);
    const nilaiKuesioner = rawKues > 0 ? Math.round(rawKues * 100) / 100 : null;

    // Kehadiran Sesi: skala sesi (misal: 14 atau 16)
    const rawHadir = parseCellNumber(kehadiranVal, -1);
    const jumlahKehadiranSesi = rawHadir >= 0 ? Math.round(rawHadir * 10) / 10 : null;

    // Konten LMS: skala lama (misal: 4.0, 5.6, 6.0)
    const rawKonten = parseCellNumber(kontenVal, -1);
    const kontenSkalaLama = rawKonten >= 0 ? Math.round(rawKonten * 100) / 100 : null;

    const jumlahPenelitian = Math.max(0, Math.round(parseCellNumber(penelitianVal, 0)));
    const jumlahPengabdian = Math.max(0, Math.round(parseCellNumber(pengabdianVal, 0)));

    results.push({
      rowNumber: i + 2,
      nipNidn,
      namaDosen,
      prodi,
      jumlahMatkul,
      jumlahKelas,
      totalResponden,
      nilaiKuesioner,
      jumlahKehadiranSesi,
      kontenSkalaLama,
      jumlahPenelitian,
      jumlahPengabdian,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. NORMALIZER FORMULA: HITUNG SESI, POIN & NILAI AKHIR LENGKAP
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedRekapLampauData {
  jumlahMatkul: number;
  jumlahKelas: number;
  totalResponden: number | null;
  nilaiKuesioner: number | null;
  rerataSesiHadir: number | null;
  persenKehadiran: number | null;
  skorKehadiran: number | null;
  totalSesiHadir: number | null;
  totalSesiBeban: number | null;
  persenKonten: number | null;
  skorKonten: number | null;
  totalSkorKonten: number | null;
  maxSkorKonten: number | null;
  jumlahPenelitian: number;
  skorPenelitian: number;
  jumlahPengabdian: number;
  skorPengabdian: number;
  nilaiAkhir: number | null;
  predikatKode: string | null;
  predikatLabel: string | null;
}

/**
 * Melakukan normalisasi matematis data lampau ke formula standar CDU Portal
 */
export function normalizeRekapLampauRow(
  row: RekapLampauParsedRow,
  targetSesiPerKelas: number = 16
): NormalizedRekapLampauData {
  const K = row.jumlahKelas;

  // 1. Normalisasi Kehadiran
  let totalSesiBeban: number | null = null;
  let totalSesiHadir: number | null = null;
  let persenKehadiran: number | null = null;
  let skorKehadiran: number | null = null;
  let rerataSesiHadir: number | null = row.jumlahKehadiranSesi;

  if (row.jumlahKehadiranSesi != null && K > 0) {
    totalSesiBeban = K * targetSesiPerKelas;
    totalSesiHadir = Math.round(row.jumlahKehadiranSesi * K);
    persenKehadiran = Math.round((row.jumlahKehadiranSesi / targetSesiPerKelas) * 1000) / 10;
    skorKehadiran = Math.round((row.jumlahKehadiranSesi / targetSesiPerKelas) * 5.0 * 100) / 100;
  }

  // 2. Normalisasi Konten (Skala 1 - 6 ke Persen & Skala 5)
  let maxSkorKonten: number | null = null;
  let totalSkorKonten: number | null = null;
  let persenKonten: number | null = null;
  let skorKonten: number | null = null;

  if (row.kontenSkalaLama != null && K > 0) {
    maxSkorKonten = K * 28; // 28 poin standar per kelas reguler
    persenKonten = Math.min(100, Math.round((row.kontenSkalaLama / 6.0) * 1000) / 10);
    skorKonten = Math.min(5.0, Math.round((row.kontenSkalaLama / 6.0) * 5.0 * 100) / 100);
    totalSkorKonten = Math.round((persenKonten / 100) * maxSkorKonten);
  }

  // 3. Tridharma
  const skorPenelitian = calculateScoreTridharma(row.jumlahPenelitian);
  const skorPengabdian = calculateScoreTridharma(row.jumlahPengabdian);

  // 4. Hitung Nilai Akhir jika indikator tersedia
  let nilaiAkhir: number | null = null;
  let predikatKode: string | null = null;
  let predikatLabel: string | null = null;

  const skorKues = row.nilaiKuesioner != null ? row.nilaiKuesioner : null;

  if (skorKues !== null && skorKehadiran !== null && skorKonten !== null) {
    // Bobot default: 40% Kuesioner, 20% Kehadiran, 20% Konten, 10% Penelitian, 10% Pengabdian
    const weightedSum =
      skorKues * 40.0 +
      skorKehadiran * 20.0 +
      skorKonten * 20.0 +
      skorPenelitian * 10.0 +
      skorPengabdian * 10.0;
    nilaiAkhir = Math.round((weightedSum / 100.0) * 100) / 100;
    const pred = determinePredikat(nilaiAkhir);
    predikatKode = pred.kode;
    predikatLabel = pred.label;
  }

  return {
    jumlahMatkul: row.jumlahMatkul,
    jumlahKelas: row.jumlahKelas,
    totalResponden: row.totalResponden,
    nilaiKuesioner: row.nilaiKuesioner,
    rerataSesiHadir,
    persenKehadiran,
    skorKehadiran,
    totalSesiHadir,
    totalSesiBeban,
    persenKonten,
    skorKonten,
    totalSkorKonten,
    maxSkorKonten,
    jumlahPenelitian: row.jumlahPenelitian,
    skorPenelitian,
    jumlahPengabdian: row.jumlahPengabdian,
    skorPengabdian,
    nilaiAkhir,
    predikatKode,
    predikatLabel,
  };
}

