// src/lib/edlink-mapper.ts
// Menerjemahkan data mentah sesi Edlink (respons API internal Edlink
// `POST /api/v1.4/sections/all/{groupId}`) menjadi komponen monitoring CDU.
//
// Aturan klasifikasi disamakan dengan parser Excel Edlink (src/lib/excel-parser.ts):
//   Lecture Note : lecture note / LN / modul / bahan ajar / dokumen teks
//   Slide        : ppt / pptx / slide / presentasi
//   Video        : video pembelajaran (file video / link youtube / hasVideo)
//   Conference   : video conference / zoom / gmeet
//   Tugas        : tugas / assignment (tipe material "Q" = teacherQuestion)
//   Kuis         : quiz / kuis (tipe material "Z" = quiz)
//
// Sesi 8 (UTS) & 16 (UAS) → komponen konten = null (tidak berlaku).

export interface EdlinkMedia {
  id?: number;
  name?: string | null;
  mime?: string | null;
  url?: string | null;
  link?: string | null;
  type?: string | null;
}

export interface EdlinkMaterial {
  id?: number;
  title?: string | null;
  type?: string | null; // M = materi, Q = tugas, Z = kuis, (lainnya: conference/post)
  hasVideo?: boolean | null;
  hasDocument?: boolean | null;
  conferenceType?: string | null;
  zoomJoinUrl?: string | null;
  gmeetUrl?: string | null;
  medias?: EdlinkMedia[] | null;
}

export interface EdlinkSection {
  id: number;
  groupId?: number;
  meet: number; // nomor sesi 1–16
  startedAt?: string | null; // "YYYY-MM-DD HH:mm:ss" (WIB)
  endedAt?: string | null;
  realStartedAt?: string | null;
  realEndedAt?: string | null;
  progress?: string | null; // S = terjadwal, B = sudah dimulai, (lainnya: selesai)
  progressLabel?: string | null;
  room?: string | null;
  topic?: string | null;
  learningMethod?: string | null;
  materialCountByType?: {
    material?: number;
    interactivePost?: number;
    quiz?: number;
    teacherQuestion?: number;
    videoConference?: number;
    exam?: number;
  } | null;
  materials?: EdlinkMaterial[] | null;
}

export interface MappedSesi {
  nomorSesi: number;
  isExam: boolean;
  tanggal: Date | null;
  dimulai: boolean; // sesi sudah dibuka dosen di Edlink
  lectureNote: boolean | null;
  slide: boolean | null;
  video: boolean | null;
  conference: boolean | null;
  tugas: boolean | null;
  kuis: boolean | null;
  bukti: string[]; // nama file / judul aktivitas yang menjadi dasar
}

// Batas kata memperlakukan "_" sebagai pemisah (contoh: "Slide_Pertemuan_02.pdf")
const RE_SLIDE = /(?:^|[^a-z])(ppt|pptx|slide|slides|presentasi|presentation)(?![a-z])|\.(pptx?|key|odp)$/i;
const RE_LN = /(?:^|[^a-z])(lecture[\s_-]*note|ln|modul|module|bahan[\s_-]*ajar|handout|diktat|ringkasan)(?![a-z])/i;
const RE_VIDEO_FILE = /\.(mp4|mkv|mov|avi|webm|m4v)$/i;
const RE_VIDEO_LINK = /(youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com\/.*video)/i;
const RE_CONF = /\b(zoom|gmeet|google\s*meet|meet\.google|video\s*conference|vicon|teams)\b/i;
const RE_TUGAS = /\b(tugas|assignment|case\s*study|project|proyek)\b/i;
const RE_KUIS = /\b(quiz|kuis)\b/i;
const RE_DOC = /\.(pdf|docx?|odt|rtf|txt|md)$/i;

/** "2026-10-03 08:00:00" (WIB) → Date */
export function parseEdlinkDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2].length === 5 ? m[2] + ":00" : m[2]}+07:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function mapEdlinkSection(sec: EdlinkSection): MappedSesi {
  const nomorSesi = Number(sec.meet);
  const isExam = nomorSesi === 8 || nomorSesi === 16;
  const tanggal = parseEdlinkDate(sec.startedAt);
  const dimulai = Boolean(sec.realStartedAt) || (!!sec.progress && sec.progress !== "S");

  const bukti: string[] = [];
  let lectureNote = false;
  let slide = false;
  let video = false;
  let conference = false;
  let tugas = false;
  let kuis = false;

  const counts = sec.materialCountByType || {};
  if ((counts.quiz || 0) > 0) kuis = true;
  if ((counts.teacherQuestion || 0) > 0) tugas = true;
  if ((counts.videoConference || 0) > 0) conference = true;

  for (const mat of sec.materials || []) {
    const title = (mat.title || "").trim();
    const type = (mat.type || "").toUpperCase();

    if (type === "Q") {
      tugas = true;
      bukti.push(`Tugas: ${title}`);
      continue;
    }
    if (type === "Z") {
      kuis = true;
      bukti.push(`Kuis: ${title}`);
      continue;
    }
    if (type === "V" || type === "C") {
      conference = true;
      bukti.push(`Conference: ${title}`);
      continue;
    }

    // Materi umum: klasifikasi dari judul + nama file
    if (RE_KUIS.test(title)) kuis = true;
    else if (RE_TUGAS.test(title)) tugas = true;
    if (RE_CONF.test(title) || mat.zoomJoinUrl || mat.gmeetUrl) {
      if (type !== "M" || RE_CONF.test(title)) conference = true;
    }
    if (mat.hasVideo) video = true;

    const medias = mat.medias || [];
    for (const md of medias) {
      const name = (md.name || "").trim();
      const mime = (md.mime || "").toLowerCase();
      const link = md.url || md.link || "";
      let label = "";
      if (mime.startsWith("video/") || RE_VIDEO_FILE.test(name) || RE_VIDEO_LINK.test(link)) {
        video = true;
        label = "Video";
      } else if (RE_SLIDE.test(name) || mime.includes("presentation") || mime.includes("powerpoint")) {
        slide = true;
        label = "Slide";
      } else if (RE_LN.test(name)) {
        lectureNote = true;
        label = "Lecture Note";
      } else if (RE_DOC.test(name) || mime.includes("pdf") || mime.includes("word")) {
        // Dokumen tanpa kata kunci: PDF dianggap slide, dokumen teks dianggap lecture note
        if (/\.pdf$/i.test(name) || mime.includes("pdf")) slide = true;
        else lectureNote = true;
        label = "Dokumen";
      }
      if (label) bukti.push(`${label}: ${name}`);
    }

    // Materi tanpa file, tapi judul menyebut slide/LN
    if (medias.length === 0) {
      if (RE_SLIDE.test(title)) slide = true;
      if (RE_LN.test(title)) lectureNote = true;
    }
  }

  if (isExam) {
    return {
      nomorSesi,
      isExam,
      tanggal,
      dimulai,
      lectureNote: null,
      slide: null,
      video: null,
      conference: null,
      tugas: null,
      kuis: null,
      bukti,
    };
  }

  return { nomorSesi, isExam, tanggal, dimulai, lectureNote, slide, video, conference, tugas, kuis, bukti };
}

export const KOMPONEN_KONTEN = ["lectureNote", "slide", "video", "conference", "tugas", "kuis"] as const;
export type KomponenKonten = (typeof KOMPONEN_KONTEN)[number];
