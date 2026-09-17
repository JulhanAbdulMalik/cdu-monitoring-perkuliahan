// src/lib/excel-parser.ts
// ⭐ Parser file Excel "Laporan Aktivitas" Edlink.id
// Berdasarkan analisis dua sample file nyata dari CDU Nusa Putra University

import * as XLSX from "xlsx";

// Sesi UTS & UAS - hanya kehadiran, konten = NULL (ditentukan by nomor sesi, BUKAN isi sheet)
const SESI_KEHADIRAN_ONLY = [8, 16];

// ─────────────────────────────────────────────────────────────────────────────
// Fungsi deteksi jenis konten dari nama kolom header (Row 4 di Excel)
// ─────────────────────────────────────────────────────────────────────────────

function detectLectureNote(headerName: string): boolean {
  const lower = headerName.toLowerCase();
  // Deteksi "Materi" yang mengandung keyword LN / Lecture Note
  if (!lower.includes("materi")) return false;
  return (
    lower.includes(" ln") ||
    lower.includes("(ln") ||
    lower.includes("lecture note") ||
    lower.includes("ln)") ||
    lower.includes("ln ") ||
    lower.includes("ppt dan ln") ||
    lower.includes("ln dan ppt")
  );
}

function detectSlide(headerName: string): boolean {
  const lower = headerName.toLowerCase();
  // Deteksi "Materi" yang mengandung keyword PPT / Slide / Presentasi
  if (!lower.includes("materi") && !lower.includes("slide") && !lower.includes("presentasi")) return false;
  return (
    lower.includes("ppt") ||
    lower.includes("slide") ||
    lower.includes("presentasi") ||
    lower.includes("powerpoint")
  );
}

function detectVideoFromSubHeader(subHeaderName: string): boolean {
  // Video dideteksi dari sub-header Row 5, bukan Row 4
  const lower = subHeaderName.toLowerCase();
  return lower.includes("video dilihat");
}

function detectConference(headerName: string): boolean {
  const lower = headerName.toLowerCase();
  return (
    lower.includes("video conference") ||
    lower.includes("conference") ||
    lower.includes("zoom") ||
    lower.includes("meet") ||
    lower.includes("webinar") ||
    lower.includes("live")
  );
}

function detectTugas(headerName: string): boolean {
  const lower = headerName.toLowerCase();
  return lower.includes("tugas") && !lower.includes("video");
}

function detectKuis(headerName: string): boolean {
  const lower = headerName.toLowerCase();
  return lower.includes("quiz") || lower.includes("kuis");
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedSesiData {
  nomorSesi: number;
  jenisSesi: "REGULER" | "UTS" | "UAS";
  isKhadiranOnly: boolean;

  // Konten: true = ada | false = tidak ada | null = tidak berlaku (UTS/UAS)
  lectureNote: boolean | null;
  slide: boolean | null;
  video: boolean | null;
  conference: boolean | null;
  tugas: boolean | null;
  kuis: boolean | null;

  // Info debug untuk review CDU
  kolomTerdeteksi: string[];
}

export interface ParsedExcelResult {
  mataKuliah: string;
  kelas: string;
  sesiData: ParsedSesiData[];
  warningMessages: string[];
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser function
// ─────────────────────────────────────────────────────────────────────────────

export function parseEdlinkExcel(buffer: Buffer): ParsedExcelResult {
  const warnings: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return {
      mataKuliah: "",
      kelas: "",
      sesiData: [],
      warningMessages: [],
      error: "File tidak dapat dibaca. Pastikan format file adalah .xlsx",
    };
  }

  // Ambil info kelas dari sheet pertama
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: "",
  }) as string[][];

  const mataKuliah = String(rawData[0]?.[1] ?? "Unknown").trim();
  const kelas = String(rawData[1]?.[1] ?? "Unknown").trim();

  const sesiData: ParsedSesiData[] = [];

  for (const sheetName of workbook.SheetNames) {
    // Hanya proses sheet bernama "Sesi X"
    const match = sheetName.match(/^sesi\s*(\d+)$/i);
    if (!match) continue;

    const nomorSesi = parseInt(match[1]);
    if (isNaN(nomorSesi) || nomorSesi < 1 || nomorSesi > 16) continue;

    const isKO = SESI_KEHADIRAN_ONLY.includes(nomorSesi);
    const jenisSesi: "REGULER" | "UTS" | "UAS" =
      nomorSesi === 8 ? "UTS" : nomorSesi === 16 ? "UAS" : "REGULER";

    // Sesi UTS & UAS → konten null, kehadiran manual
    if (isKO) {
      sesiData.push({
        nomorSesi,
        jenisSesi,
        isKhadiranOnly: true,
        lectureNote: null,
        slide: null,
        video: null,
        conference: null,
        tugas: null,
        kuis: null,
        kolomTerdeteksi: [],
      });
      continue;
    }

    // Sesi REGULER: scan header untuk deteksi konten
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
    }) as string[][];

    // Row 4 = header group (nama konten)
    // Row 5 = sub-header (Views, Komentar, Video Dilihat, Dokumen Didownload)
    const headerRow = (rows[4] ?? []) as string[];
    const subHeaderRow = (rows[5] ?? []) as string[];

    // Sesi reguler tanpa konten → semua false (dosen tidak upload)
    const hasAnyContent = headerRow.slice(2).some((h) => h && h !== "");

    if (!hasAnyContent) {
      warnings.push(
        `Sesi ${nomorSesi}: Tidak ada konten yang diupload dosen (sheet kosong)`
      );
      sesiData.push({
        nomorSesi,
        jenisSesi: "REGULER",
        isKhadiranOnly: false,
        lectureNote: false,
        slide: false,
        video: false,
        conference: false,
        tugas: false,
        kuis: false,
        kolomTerdeteksi: [],
      });
      continue;
    }

    let hasLectureNote = false;
    let hasSlide = false;
    let hasVideo = false;
    let hasConference = false;
    let hasTugas = false;
    let hasKuis = false;
    const kolomTerdeteksi: string[] = [];

    for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
      const headerCell = String(headerRow[colIdx] ?? "").trim();
      const subHeaderCell = String(subHeaderRow[colIdx] ?? "").trim();

      if (!headerCell) continue;

      // Deteksi Video dari sub-header "Video Dilihat" di bawah "Materi"
      if (
        headerCell.toLowerCase().includes("materi") &&
        detectVideoFromSubHeader(subHeaderCell) &&
        !hasVideo
      ) {
        hasVideo = true;
        kolomTerdeteksi.push(`Video: "${headerCell}" (sub: "${subHeaderCell}")`);
      }

      // Deteksi Lecture Note
      if (detectLectureNote(headerCell) && !hasLectureNote) {
        hasLectureNote = true;
        kolomTerdeteksi.push(`LectureNote: "${headerCell}"`);
      }

      // Deteksi Slide/PPT
      if (detectSlide(headerCell) && !hasSlide) {
        hasSlide = true;
        kolomTerdeteksi.push(`Slide: "${headerCell}"`);
      }

      // Kasus khusus: "Materi" tanpa label LN/PPT/Video
      // → Anggap sebagai Slide (materi umum = presentasi)
      if (
        headerCell.toLowerCase().startsWith("materi") &&
        !detectLectureNote(headerCell) &&
        !detectSlide(headerCell) &&
        !detectVideoFromSubHeader(subHeaderCell) &&
        !detectConference(headerCell)
      ) {
        if (!hasSlide) {
          hasSlide = true;
          kolomTerdeteksi.push(`Slide (unlabeled materi): "${headerCell}"`);
        }
      }

      // Deteksi Conference
      if (detectConference(headerCell) && !hasConference) {
        hasConference = true;
        kolomTerdeteksi.push(`Conference: "${headerCell}"`);
      }

      // Deteksi Tugas
      if (detectTugas(headerCell) && !hasTugas) {
        hasTugas = true;
        kolomTerdeteksi.push(`Tugas: "${headerCell}"`);
      }

      // Deteksi Quiz
      if (detectKuis(headerCell) && !hasKuis) {
        hasKuis = true;
        kolomTerdeteksi.push(`Quiz: "${headerCell}"`);
      }
    }

    sesiData.push({
      nomorSesi,
      jenisSesi: "REGULER",
      isKhadiranOnly: false,
      lectureNote: hasLectureNote,
      slide: hasSlide,
      video: hasVideo,
      conference: hasConference,
      tugas: hasTugas,
      kuis: hasKuis,
      kolomTerdeteksi,
    });
  }

  // Sort berdasarkan nomor sesi
  sesiData.sort((a, b) => a.nomorSesi - b.nomorSesi);

  // Warning jika tidak ada 16 sesi
  if (sesiData.length < 16) {
    warnings.push(
      `Hanya ditemukan ${sesiData.length} dari 16 sesi. Sesi yang hilang perlu diisi manual.`
    );
  }

  return { mataKuliah, kelas, sesiData, warningMessages: warnings };
}
