// src/lib/score-calculator.ts
// Single Source of Truth for CDU 3-Pillar Scoring & Conference Quota Logic

export interface SessionPillarResult {
  hasSL: boolean; // Pilar 1: Lecture Note ATAU Slide (L/S)
  hasQT: boolean; // Pilar 2: Quiz ATAU Tugas (Q/T)
  hasTV: boolean; // Pilar 3: Temu Virtual (Conference) ATAU Video (T/V)
  score: number | null; // 0, 1, 2, 3 (null for exam sessions)
  maxScore: number | null; // 3 for regular, null for exams
  isExam: boolean;
  statusText: string;
  statusColor: string;
}

export function calculateSessionPillars(sesi: {
  nomorSesi: number;
  lectureNote?: boolean | null;
  slide?: boolean | null;
  video?: boolean | null;
  conference?: boolean | null;
  tugas?: boolean | null;
  kuis?: boolean | null;
}): SessionPillarResult {
  const isExam = sesi.nomorSesi === 8 || sesi.nomorSesi === 16;

  if (isExam) {
    return {
      hasSL: false,
      hasQT: false,
      hasTV: false,
      score: null,
      maxScore: null,
      isExam: true,
      statusText: "Ujian",
      statusColor: "purple",
    };
  }

  // 3 Pilar Berpasangan
  const hasSL = Boolean(sesi.slide || sesi.lectureNote);
  const hasQT = Boolean(sesi.tugas || sesi.kuis);
  const hasTV = Boolean(sesi.video || sesi.conference);

  let score = 0;
  if (hasSL) score += 1;
  if (hasQT) score += 1;
  if (hasTV) score += 1;

  let statusText = "0/3 (Kosong)";
  let statusColor = "rose";

  if (score === 3) {
    statusText = "3/3 (Sempurna)";
    statusColor = "emerald";
  } else if (score === 2) {
    statusText = "2/3 (Baik)";
    statusColor = "blue";
  } else if (score === 1) {
    statusText = "1/3 (Sebagian)";
    statusColor = "amber";
  }

  return {
    hasSL,
    hasQT,
    hasTV,
    score,
    maxScore: 3,
    isExam: false,
    statusText,
    statusColor,
  };
}

export interface ClassSummaryResult {
  totalHadir: number; // HADIR + HADIR_TDK_LENGKAP
  totalHadirLengkap: number;
  totalHadirTdkLengkap: number;
  totalAlpha: number;
  totalBelumDiisi: number;
  persenKehadiran: number;

  totalSkor3Pilar: number; // Max 42 (14 regular sesi * 3)
  persenKonten: number;
  sesiMateriKosongCount: number; // Jumlah sesi reguler berjalan dengan materi 0/3

  confPraUTS: number; // Sesi 1-7
  confPraUAS: number; // Sesi 9-15
  confTotal: number;
  isConfCompliant: boolean; // confPraUTS >= 3 && confPraUAS >= 3

  statusEvaluasi: "TERLAKSANA" | "PERHATIAN";
  evaluasiNote: string;
}

export function calculateClassSummary(
  sesiList: Array<{
    nomorSesi: number;
    kehadiran: string;
    lectureNote?: boolean | null;
    slide?: boolean | null;
    video?: boolean | null;
    conference?: boolean | null;
    tugas?: boolean | null;
    kuis?: boolean | null;
  }>,
  modePembelajaran: "DARING" | "LURING" | "BIMBINGAN" = "DARING",
  activeSessionNumber: number = 16
): ClassSummaryResult {
  let totalHadirLengkap = 0;
  let totalHadirTdkLengkap = 0;
  let totalAlpha = 0;
  let totalBelumDiisi = 0;
  let totalSkor3Pilar = 0;
  let sesiMateriKosongCount = 0;

  let confPraUTS = 0;
  let confPraUAS = 0;

  sesiList.forEach((s) => {
    if (s.kehadiran === "HADIR") totalHadirLengkap++;
    else if (s.kehadiran === "HADIR_TIDAK_LENGKAP" || s.kehadiran === "HADIR_TDK_LENGKAP") totalHadirTdkLengkap++;
    else if (s.kehadiran === "TIDAK_HADIR" || s.kehadiran === "ALPHA") totalAlpha++;
    else totalBelumDiisi++;

    if (modePembelajaran === "BIMBINGAN") {
      if (s.conference) {
        if (s.nomorSesi >= 1 && s.nomorSesi <= 8) confPraUTS++;
        else if (s.nomorSesi >= 9 && s.nomorSesi <= 16) confPraUAS++;
      }
    } else {
      const isExam = s.nomorSesi === 8 || s.nomorSesi === 16;
      if (!isExam) {
        const pilar = calculateSessionPillars(s);
        if (pilar.score !== null) {
          totalSkor3Pilar += pilar.score;

          // Periksa sesi tanpa materi sama sekali (0/3) pada sesi yang sudah berjalan menurut kalender
          if (s.nomorSesi <= activeSessionNumber && pilar.score === 0) {
            sesiMateriKosongCount++;
          }
        }

        if (s.conference) {
          if (s.nomorSesi >= 1 && s.nomorSesi <= 7) confPraUTS++;
          if (s.nomorSesi >= 9 && s.nomorSesi <= 15) confPraUAS++;
        }
      }
    }
  });

  const totalHadir = totalHadirLengkap + totalHadirTdkLengkap;
  // Simpan sebagai float 1 desimal agar tampilan UI akurat (misal: 6.3%, bukan 6%)
  const persenKehadiran = Math.round((totalHadir / 16) * 1000) / 10;
  const persenKonten = modePembelajaran === "BIMBINGAN" ? 100 : Math.round((totalSkor3Pilar / 42) * 1000) / 10; // 14 regular sesi * 3 max = 42

  const confTotal = confPraUTS + confPraUAS;
  const isConfCompliant = modePembelajaran !== "DARING" ? true : confPraUTS >= 3 && confPraUAS >= 3;

  let statusEvaluasi: "TERLAKSANA" | "PERHATIAN" = "TERLAKSANA";
  let evaluasiNote = "Perkuliahan berjalan lancar dan memenuhi standar CDU.";

  // Aturan Evaluasi Baru:
  // 1. Alpa >= 2 sesi -> PERHATIAN
  // 2. Materi Kosong (0/3) >= 2 sesi pada sesi berjalan -> PERHATIAN (khusus Non-Bimbingan)
  // Di luar kondisi di atas -> TERLAKSANA
  const isAlphaExceeded = totalAlpha >= 2;
  const isKontenEmpty = modePembelajaran !== "BIMBINGAN" && sesiMateriKosongCount >= 2;

  if (isAlphaExceeded && isKontenEmpty) {
    statusEvaluasi = "PERHATIAN";
    evaluasiNote = `Perhatian: Terdapat ${totalAlpha} sesi Alpa dan ${sesiMateriKosongCount} sesi tanpa materi 3 pilar pada sesi berjalan.`;
  } else if (isAlphaExceeded) {
    statusEvaluasi = "PERHATIAN";
    evaluasiNote = `Perhatian: Terdapat ${totalAlpha} sesi Alpa (tidak hadir).`;
  } else if (isKontenEmpty) {
    statusEvaluasi = "PERHATIAN";
    evaluasiNote = `Perhatian: Terdapat ${sesiMateriKosongCount} sesi tanpa materi 3 pilar sama sekali pada sesi berjalan.`;
  } else {
    statusEvaluasi = "TERLAKSANA";
    evaluasiNote = "Perkuliahan berjalan lancar dan memenuhi standar CDU.";
  }

  return {
    totalHadir,
    totalHadirLengkap,
    totalHadirTdkLengkap,
    totalAlpha,
    totalBelumDiisi,
    persenKehadiran,
    totalSkor3Pilar,
    persenKonten,
    sesiMateriKosongCount,
    confPraUTS,
    confPraUAS,
    confTotal,
    isConfCompliant,
    statusEvaluasi,
    evaluasiNote,
  };
}
