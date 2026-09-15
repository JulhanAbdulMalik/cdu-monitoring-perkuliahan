// src/lib/utils.ts
// Helper functions umum — CDU Monitoring

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

// shadcn/ui cn utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format persentase dengan 1 angka desimal: "12.5%", "100.0%", "0.0%"
export function formatPct(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "" || isNaN(Number(value))) return "0.0%";
  return Number(value).toFixed(1) + "%";
}

// Hitung persentase dengan 1 desimal (float, bukan integer)
export function roundPct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // 1 desimal
}

export function formatDate(date: Date | string | null, fmt = "dd MMM yyyy") {
  if (!date) return "—";
  return format(new Date(date), fmt, { locale: idLocale });
}

export function formatDateShort(date: Date | string | null) {
  return formatDate(date, "dd/MM");
}

// Format waktu 2 baris '14:45 WIB' & '2 September 2026'
export function formatTerakhirUpdateParts(date: Date | string | null | undefined): {
  waktu: string;
  tanggal: string;
} {
  if (!date) return { waktu: "—", tanggal: "—" };
  const d = new Date(date);
  if (isNaN(d.getTime())) return { waktu: "—", tanggal: "—" };

  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");

  const bulanIndo = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const tgl = d.getDate();
  const bln = bulanIndo[d.getMonth()];
  const thn = d.getFullYear();

  return {
    waktu: `${jam}:${menit} WIB`,
    tanggal: `${tgl} ${bln} ${thn}`,
  };
}

// Format waktu 1 baris '13:00 WIB, 9 September 2026'
export function formatTerakhirUpdate(date: Date | string | null | undefined): string {
  const parts = formatTerakhirUpdateParts(date);
  if (parts.waktu === "—") return "—";
  return `${parts.waktu}, ${parts.tanggal}`;
}

// Hitung persentase kehadiran dari data monitoring sesi
export function hitungPersentaseKehadiran(
  sesiList: { kehadiran: string }[]
): number {
  if (sesiList.length === 0) return 0;
  const hadir = sesiList.filter((s) => s.kehadiran === "HADIR").length;
  return Math.round((hadir / sesiList.length) * 100);
}

// Cek apakah sesi adalah UTS atau UAS (konten null)
export function isKhadiranOnly(nomorSesi: number): boolean {
  return nomorSesi === 8 || nomorSesi === 16;
}

// Hitung jumlah konten yang ada (true) dari satu sesi
export function hitungKontenAda(sesi: {
  lectureNote: boolean | null;
  slide: boolean | null;
  video: boolean | null;
  conference: boolean | null;
  tugas: boolean | null;
  kuis: boolean | null;
}): number {
  return [
    sesi.lectureNote,
    sesi.slide,
    sesi.video,
    sesi.conference,
    sesi.tugas,
    sesi.kuis,
  ].filter(Boolean).length;
}

// Label status kehadiran
export const LABEL_KEHADIRAN: Record<string, string> = {
  HADIR: "Hadir",
  TIDAK_HADIR: "Tidak Hadir",
  HADIR_TIDAK_LENGKAP: "Hadir Tidak Lengkap",
  BELUM_DIISI: "Belum Diisi",
};

export const WARNA_KEHADIRAN: Record<string, string> = {
  HADIR: "text-emerald-600 bg-emerald-50 border-emerald-200",
  TIDAK_HADIR: "text-red-600 bg-red-50 border-red-200",
  HADIR_TIDAK_LENGKAP: "text-amber-600 bg-amber-50 border-amber-200",
  BELUM_DIISI: "text-slate-500 bg-slate-50 border-slate-200",
};

// Hitung tanggal Senin sampai Minggu (1 minggu penuh) untuk default filter tanggal
export function getWeekDates(baseDate: Date = new Date()) {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const diffToMonday = (day === 0 ? -6 : 1) - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const formatYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const dayStr = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${dayStr}`;
  };

  return {
    monday,
    sunday,
    mondayStr: formatYMD(monday),
    sundayStr: formatYMD(sunday),
  };
}

// Format range tanggal Indonesia (misal: "31 Agustus - 6 September 2026")
export function formatTanggalRange(startDateStr: string, endDateStr: string): string {
  if (!startDateStr || !endDateStr) return "—";
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return `${startDateStr} s/d ${endDateStr}`;

  const bulanIndo = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const tglStart = start.getDate();
  const blnStart = bulanIndo[start.getMonth()];
  const thnStart = start.getFullYear();

  const tglEnd = end.getDate();
  const blnEnd = bulanIndo[end.getMonth()];
  const thnEnd = end.getFullYear();

  if (thnStart === thnEnd) {
    if (blnStart === blnEnd) {
      return `${tglStart} - ${tglEnd} ${blnStart} ${thnStart}`;
    }
    return `${tglStart} ${blnStart} - ${tglEnd} ${blnEnd} ${thnStart}`;
  }
  return `${tglStart} ${blnStart} ${thnStart} - ${tglEnd} ${blnEnd} ${thnEnd}`;
}

// Tanggal mulai perkuliahan resmi semester aktif (Curriculum Nusa Putra): 21 September 2026
export const DEFAULT_SEMESTER_START_DATE = "2026-09-21";

const HARI_MAP: Record<string, number> = {
  SENIN: 0,
  SELASA: 1,
  RABU: 2,
  KAMIS: 3,
  JUMAT: 4,
  SABTU: 5,
  MINGGU: 6,
};

// Interface Hari Libur Semester
export interface HariLiburItem {
  id?: string;
  nama: string;
  tanggalMulai: Date | string;
  tanggalSelesai: Date | string;
  keterangan?: string | null;
}

function toDateStr(d: Date | string): string {
  if (typeof d === "string") {
    return d.split("T")[0];
  }
  return d.toISOString().split("T")[0];
}

export function isDateInLibur(dateStr: string, hariLiburList: HariLiburItem[] = []): boolean {
  if (!hariLiburList || hariLiburList.length === 0) return false;
  for (const item of hariLiburList) {
    const startStr = toDateStr(item.tanggalMulai);
    const endStr = toDateStr(item.tanggalSelesai);
    if (dateStr >= startStr && dateStr <= endStr) {
      return true;
    }
  }
  return false;
}

// Menghitung seluruh tanggal kalender perkuliahan sesi 1 s/d totalSesi dengan memperhitungkan hari libur
export function getAllEstimatedSessionDates(
  totalSesi: number = 16,
  jadwalHari?: string | null,
  semesterStartDateStr: string = DEFAULT_SEMESTER_START_DATE,
  hariLiburList: HariLiburItem[] = []
): Date[] {
  const start = new Date(`${semesterStartDateStr}T00:00:00.000Z`);
  const dayName = (jadwalHari || "Senin").toUpperCase().trim();
  const dayOffset = HARI_MAP[dayName] !== undefined ? HARI_MAP[dayName] : 0;

  // Tanggal awal perkuliahan untuk hari yang dipilih pada minggu sesi 1
  const candidate = new Date(start);
  candidate.setUTCDate(start.getUTCDate() + dayOffset);

  const results: Date[] = [];

  for (let sesi = 1; sesi <= totalSesi; sesi++) {
    if (sesi > 1) {
      // Maju 7 hari dari sesi sebelumnya
      candidate.setUTCDate(candidate.getUTCDate() + 7);
    }

    // Jika kandidat tanggal jatuh pada hari libur / tanggal merah, lewati ke minggu berikutnya (+7 hari)
    let safetyCounter = 0;
    while (isDateInLibur(candidate.toISOString().split("T")[0], hariLiburList) && safetyCounter < 52) {
      candidate.setUTCDate(candidate.getUTCDate() + 7);
      safetyCounter++;
    }

    results.push(new Date(candidate));
  }

  return results;
}

// Menghitung tanggal kalender perkuliahan sesi ke-N berdasarkan jadwal hari, tanggal mulai semester, dan hari libur
export function getEstimatedSessionDate(
  nomorSesi: number,
  jadwalHari?: string | null,
  semesterStartDateStr: string = DEFAULT_SEMESTER_START_DATE,
  hariLiburList: HariLiburItem[] = []
): Date {
  if (nomorSesi < 1) nomorSesi = 1;
  const dates = getAllEstimatedSessionDates(nomorSesi, jadwalHari, semesterStartDateStr, hariLiburList);
  return dates[nomorSesi - 1] || dates[dates.length - 1];
}

// Menghitung nomor sesi perkuliahan aktif saat ini (1–16) berdasarkan tanggal hari ini dan kalender libur semester
export function getCurrentActiveSessionNumber(
  semesterStartDateStr: string = DEFAULT_SEMESTER_START_DATE,
  hariLiburList: HariLiburItem[] = []
): number {
  const dates = getAllEstimatedSessionDates(16, "Senin", semesterStartDateStr, hariLiburList);
  if (!dates || dates.length === 0) return 1;

  const todayStr = new Date().toISOString().split("T")[0];
  const firstSesiStr = toDateStr(dates[0]);

  // Jika hari ini masih sebelum sesi 1 dimulai
  if (todayStr < firstSesiStr) return 1;

  for (let i = 0; i < dates.length; i++) {
    const startSesi = toDateStr(dates[i]);
    const endSesi = i < dates.length - 1 ? toDateStr(dates[i + 1]) : "9999-12-31";
    if (todayStr >= startSesi && todayStr < endSesi) {
      return i + 1;
    }
  }

  return 16;
}




