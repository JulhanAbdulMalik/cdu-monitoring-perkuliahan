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

  confPraUTS: number; // Sesi 1-7
  confPraUAS: number; // Sesi 9-15
  confTotal: number;
  isConfCompliant: boolean; // confPraUTS >= 3 && confPraUAS >= 3

  statusEvaluasi: "MEMENUHI" | "CUKUP" | "PERLU_PERHATIAN";
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
  modePembelajaran: "DARING" | "LURING" | "BIMBINGAN" = "DARING"
): ClassSummaryResult {
  let totalHadirLengkap = 0;
  let totalHadirTdkLengkap = 0;
  let totalAlpha = 0;
  let totalBelumDiisi = 0;
  let totalSkor3Pilar = 0;

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

  let statusEvaluasi: "MEMENUHI" | "CUKUP" | "PERLU_PERHATIAN" = "MEMENUHI";
  let evaluasiNote = "Memenuhi standar perkuliahan CDU.";

  if (modePembelajaran === "BIMBINGAN") {
    // Mode Bimbingan: Bebas 3 Pilar materi LMS, murni dievaluasi dari Kehadiran Sesi Pembimbingan (16 sesi)
    if (totalAlpha >= 3 || persenKehadiran < 75) {
      statusEvaluasi = "PERLU_PERHATIAN";
      evaluasiNote = "Kehadiran bimbingan kurang dari 75% atau Alpha ≥ 3 sesi.";
    } else if (persenKehadiran < 85) {
      statusEvaluasi = "CUKUP";
      evaluasiNote = "Kehadiran bimbingan memenuhi standar minimal (75%–84%).";
    } else {
      statusEvaluasi = "MEMENUHI";
      evaluasiNote = "Sangat memuaskan: Kehadiran bimbingan ≥ 85%.";
    }
  } else if (modePembelajaran === "LURING") {
    // Mode Offline: 3 Pilar dievaluasi, bebas kewajiban kuota Live Conference
    if (totalAlpha >= 3 || persenKehadiran < 75 || persenKonten < 60) {
      statusEvaluasi = "PERLU_PERHATIAN";
      if (persenKonten < 60 && persenKehadiran >= 75 && totalAlpha < 3) {
        evaluasiNote = "Kelengkapan 3 pilar materi di bawah standar (< 60%).";
      } else {
        evaluasiNote = "Kehadiran tatap muka di kelas kurang dari 75% atau Alpha ≥ 3 sesi.";
      }
    } else if (persenKehadiran < 85 || persenKonten < 75) {
      statusEvaluasi = "CUKUP";
      evaluasiNote = "Perkuliahan tatap muka & kelengkapan 3 pilar memenuhi standar minimal.";
    } else {
      statusEvaluasi = "MEMENUHI";
      evaluasiNote = "Sangat memuaskan: Kehadiran tatap muka ≥ 85% & 3 Pilar materi lengkap.";
    }
  } else {
    // Mode Online: Wajib 3 pilar & kuota Live Conference (3x pra-UTS & 3x pra-UAS)
    if (totalAlpha >= 3 || persenKonten < 60 || !isConfCompliant) {
      statusEvaluasi = "PERLU_PERHATIAN";
      if (!isConfCompliant) {
        evaluasiNote = `Kuota Live Conference belum terpenuhi (Pra-UTS: ${confPraUTS}/3, Pra-UAS: ${confPraUAS}/3).`;
      } else {
        evaluasiNote = "Kelengkapan 3 pilar materi atau kehadiran online di bawah standar.";
      }
    } else if (persenKehadiran < 85 || persenKonten < 75) {
      statusEvaluasi = "CUKUP";
      evaluasiNote = "Perkuliahan online memenuhi standar minimal.";
    } else {
      statusEvaluasi = "MEMENUHI";
      evaluasiNote = "Sangat memuaskan: 3 Pilar lengkap & kuota Live Conference terpenuhi.";
    }
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
    confPraUTS,
    confPraUAS,
    confTotal,
    isConfCompliant,
    statusEvaluasi,
    evaluasiNote,
  };
}
