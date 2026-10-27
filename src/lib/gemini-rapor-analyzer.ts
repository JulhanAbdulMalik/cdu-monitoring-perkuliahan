// src/lib/gemini-rapor-analyzer.ts
// AI-Powered Evaluator using Google Gemini 3.8 Flash for Lecturer Tridharma Evaluation
// Generates:
// 1. Critical Student Comments (K1 - K5: Komentar kritik/saran terjelek mahasiswa)
// 2. Pedagogical Improvement Recommendations (P1 - P5: 5 butir pertanyaan kuesioner dengan STB/TB terbanyak)
// 3. Student Sentiment Analysis (Positif / Netral / Negatif %)
// 4. Concise Official QAU Evaluation Conclusion (Bagian E: 1-2 kalimat padat standar universitas)

export interface GeminiRaporAnalysisResult {
  komentarTerpilih: string[]; // 5 butir K1 - K5
  rekomendasiPerbaikan: string[]; // 5 butir P1 - P5
  analisisSentimen: {
    positifCount: number;
    positifPct: number;
    netralCount: number;
    netralPct: number;
    negatifCount: number;
    negatifPct: number;
    totalKomentar: number;
  };
  narasiKesimpulan: string;
  isAiGenerated: boolean;
  modelUsed: string;
}

export interface LecturerAnalysisContext {
  namaDosen: string;
  nip?: string | null;
  prodiNama?: string;
  semesterTahun?: string;
  semesterPeriode?: string;
  nilaiKuesioner?: number | null;
  totalResponden?: number | null;
  rerataSesiHadir?: number | null;
  persenKehadiran?: number | null;
  persenKonten?: number | null;
  jumlahPenelitian?: number;
  jumlahPengabdian?: number;
  nilaiAkhir?: number | null;
  predikat?: string | null;
  lowestQuestions?: Array<{ no: number; pertanyaan: string; rataRata: number }>;
  rekomendasiPerbaikanTexts?: string[]; // 5 butir pertanyaan dengan 'Sangat tidak baik (1)' & 'Tidak baik (2)' terbanyak
  rawComments: string[];
}

/**
 * Panggil Google Gemini API untuk menganalisis data evaluasi perkuliahan
 */
export async function analyzeRaporWithGemini(
  ctx: LecturerAnalysisContext
): Promise<GeminiRaporAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  if (!apiKey) {
    console.warn("GEMINI_API_KEY tidak ditemukan di .env, menggunakan fallback generator.");
    return generateFallbackAnalysis(ctx);
  }

  const cleanComments = ctx.rawComments
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length >= 5);

  if (cleanComments.length === 0) {
    return generateFallbackAnalysis(ctx);
  }

  // Siapkan 5 butir pertanyaan rekomendasi perbaikan (jika disediakan dari parser)
  const officialRecommendations = (ctx.rekomendasiPerbaikanTexts && ctx.rekomendasiPerbaikanTexts.length > 0)
    ? ctx.rekomendasiPerbaikanTexts.slice(0, 5).map((q, i) => `P${i + 1}: ${q}`)
    : [];

  const lowestQuestionsText = ctx.lowestQuestions && ctx.lowestQuestions.length > 0
    ? ctx.lowestQuestions.map((q, idx) => `${idx + 1}. ${q.pertanyaan} (Skor: ${q.rataRata.toFixed(2)})`).join("\n")
    : "- Tidak ada data butir pertanyaan terendah.";

  const prompt = `
Anda adalah Auditor Penjaminan Mutu Akademik (Quality Assurance Unit / LP3M) Universitas Nusa Putra.
Tugas Anda adalah menganalisis data evaluasi perkuliahan mahasiswa untuk menyusun Laporan Evaluasi Rapor Dosen resmi.

PROFIL DOSEN:
- Nama Dosen: ${ctx.namaDosen}
- NIP: ${ctx.nip || "-"}
- Program Studi: ${ctx.prodiNama || "-"}
- Nilai Rata-rata Kuesioner Mahasiswa: ${ctx.nilaiKuesioner != null ? ctx.nilaiKuesioner.toFixed(2) : "-"} / 5.00 (${ctx.totalResponden || 0} Responden)
- Kehadiran Mengajar: ${ctx.rerataSesiHadir != null ? ctx.rerataSesiHadir.toFixed(1) + " Sesi" : "-"}
- Kelengkapan Konten LMS (3 Pilar CDU): ${ctx.persenKonten != null ? ctx.persenKonten.toFixed(1) + "%" : "-"}
- Kinerja Penelitian: ${ctx.jumlahPenelitian || 0} Judul | Pengabdian: ${ctx.jumlahPengabdian || 0} Kegiatan

5 BUTIR PERTANYAAN KUESIONER DENGAN SKOR TERENDAH:
${lowestQuestionsText}

${officialRecommendations.length > 0 ? `5 BUTIR REKOMENDASI PERBAIKAN BERDASARKAN KUESIONER MAHASISWA:\n${officialRecommendations.join("\n")}\n` : ""}

DAFTAR KRITIK, SARAN & KOMENTAR MAHASISWA (${cleanComments.length} komentar mentah):
${cleanComments.map((c, i) => `[${i + 1}] "${c}"`).join("\n")}

INSTRUKSI EVALUASI:
1. Pilihlah tepat 5 komentar mahasiswa paling kritis, menyoroti kekurangan, atau kritik/saran perbaikan terjelek (K1 sampai K5). Jangan memilih komentar pujian kosong. Utamakan komentar yang menyoroti metode belajar, tempo penjelasan materi, kedisiplinan jadwal, atau transparansi nilai/ujian.
2. Analisis Sentimen: Klasifikasikan seluruh ${cleanComments.length} komentar ke dalam Positif, Netral, atau Negatif/Kritik. Hitung jumlah dan persentase masing-masing (total persentase wajib tepat 100.0%).
3. Tuliskan Narasi Kesimpulan Evaluasi (Bagian C) secara RINGKAS dan PADAT (cukup 1-2 kalimat, standar resmi QAU Universitas Nusa Putra), dengan format:
   - Jika Positif >= 80%: "Berdasarkan hasil kuesioner dan analisis sentimen, mayoritas mahasiswa memberikan respon Sangat Positif ({positifPct}%) terhadap proses pembelajaran dan pengajaran dosen. Dosen diharapkan mempertahankan kinerja yang baik serta menindaklanjuti rekomendasi perbaikan pada Bagian B untuk peningkatan mutu berkelanjutan."
   - Jika Positif 60% - 79.9%: "Berdasarkan hasil kuesioner dan analisis sentimen, respon mahasiswa didominasi penilaian Positif ({positifPct}%) dan Netral ({netralPct}%). Dosen disarankan untuk memperhatikan catatan mahasiswa dan rekomendasi perbaikan pada Bagian B guna meningkatkan efektivitas perkuliahan."
   - Jika Positif < 60%: "Berdasarkan hasil kuesioner dan analisis sentimen, evaluasi mahasiswa menunjukkan perlunya perhatian terhadap masukan kritis mahasiswa ({negatifPct}%). Dosen diharapkan proaktif menindaklanjuti rekomendasi perbaikan pada Bagian B guna meningkatkan efektivitas perkuliahan."
   PENTING: Jangan gunakan CapsLock/HURUF BESAR SEMUA. Gunakan huruf besar hanya pada awal kata saja (contoh: 'Sangat Positif', 'Positif', 'Netral', 'Negatif').

FORMAT KELUARAN WAJIB JSON VALID (tanpa markdown backtick):
{
  "komentarTerpilih": [
    "Komentar kritis 1...",
    "Komentar kritis 2...",
    "Komentar kritis 3...",
    "Komentar kritis 4...",
    "Komentar kritis 5..."
  ],
  "analisisSentimen": {
    "positifCount": 0,
    "positifPct": 0.0,
    "netralCount": 0,
    "netralPct": 0.0,
    "negatifCount": 0,
    "negatifPct": 0.0,
    "totalKomentar": ${cleanComments.length}
  },
  "narasiKesimpulan": "Berdasarkan hasil kuesioner..."
}
`;

  try {
    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const candidateModels = Array.from(new Set([primaryModel, "gemini-3.5-flash", "gemini-3-flash-preview"]));
    let lastUsedModel = primaryModel;
    let rawText = "";

  for (const currentModel of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      });

      if (res.ok) {
        const resJson = await res.json();
        rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawText) {
          lastUsedModel = currentModel;
          break;
        }
      } else {
        const errText = await res.text();
        console.warn(`Gemini API [${currentModel}] status ${res.status}: ${errText.slice(0, 120)}, beralih ke model berikutnya...`);
      }
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.warn(`Gemini API [${currentModel}] gagal (${msg}), beralih ke model berikutnya...`);
    }
  }

  if (!rawText) {
    console.warn("Semua kandidat model Gemini gagal, menggunakan fallback analisis deterministik.");
    return generateFallbackAnalysis(ctx);
  }

    const parsedData = JSON.parse(rawText);

    // Validasi & normalisasi komentar kritis terpilih K1 - K5
    const rawKomentar: string[] = Array.isArray(parsedData.komentarTerpilih)
      ? parsedData.komentarTerpilih.slice(0, 5)
      : [];

    const komentarTerpilih = rawKomentar.map((k) =>
      String(k || "")
        .replace(/^\[\d+\]\s*/, "") // Hapus nomor referensi kurung siku seperti [4], [17], [28]
        .replace(/^\d+[\.\)]\s*/, "") // Hapus nomor urut seperti 1., 1), 2.
        .replace(/^k\d+[\.\:\-]\s*/i, "") // Hapus awalan K1:, K1., dll
        .replace(/^kritik\s*:\s*/i, "")
        .replace(/^saran\s*:\s*/i, "")
        .trim()
    );

    // Rekomendasi Perbaikan P1 - P5:
    // Utamakan langsung dari butir pertanyaan kuesioner yang telah dihitung dari SIAKAD
    const rekomendasiPerbaikan = officialRecommendations.length >= 5
      ? officialRecommendations
      : (Array.isArray(parsedData.rekomendasiPerbaikan) && parsedData.rekomendasiPerbaikan.length >= 5)
      ? parsedData.rekomendasiPerbaikan.slice(0, 5)
      : generateDefaultRecommendations();

    const sentimen = parsedData.analisisSentimen || {};
    const total = cleanComments.length;
    const pos = Number(sentimen.positifCount) || 0;
    const net = Number(sentimen.netralCount) || 0;
    const neg = Number(sentimen.negatifCount) || 0;

    const positifPct = total > 0 ? Math.round((pos / total) * 1000) / 10 : 0;
    const netralPct = total > 0 ? Math.round((net / total) * 1000) / 10 : 0;
    const negatifPct = total > 0 ? Math.round((neg / total) * 1000) / 10 : 0;

    // Narasi kesimpulan standar ringkas
    let narasiKesimpulan = parsedData.narasiKesimpulan;
    if (!narasiKesimpulan || narasiKesimpulan.length < 20) {
      if (positifPct >= 80) {
        narasiKesimpulan = `Berdasarkan hasil kuesioner dan analisis sentimen, mayoritas mahasiswa memberikan respon Sangat Positif (${positifPct}%) terhadap proses pembelajaran dan pengajaran dosen. Dosen diharapkan mempertahankan kinerja yang baik serta menindaklanjuti rekomendasi perbaikan pada Bagian B untuk peningkatan mutu berkelanjutan.`;
      } else if (positifPct >= 60) {
        narasiKesimpulan = `Berdasarkan hasil kuesioner dan analisis sentimen, respon mahasiswa didominasi penilaian Positif (${positifPct}%) dan Netral (${netralPct}%). Dosen disarankan untuk memperhatikan catatan mahasiswa dan rekomendasi perbaikan pada Bagian B guna meningkatkan efektivitas perkuliahan.`;
      } else {
        narasiKesimpulan = `Berdasarkan hasil kuesioner dan analisis sentimen, evaluasi mahasiswa menunjukkan perlunya perhatian terhadap masukan kritis mahasiswa (${negatifPct}%). Dosen diharapkan proaktif menindaklanjuti rekomendasi perbaikan pada Bagian B guna meningkatkan efektivitas perkuliahan.`;
      }
    }

    // Pastikan referensi ke rekomendasi perbaikan adalah Bagian B, bukan Bagian C
    narasiKesimpulan = narasiKesimpulan
      .replace(/pada Bagian C/gi, "pada Bagian B")
      .replace(/\bBagian C\b/g, "Bagian B")
      .replace(/SANGAT POSITIF/g, "Sangat Positif")
      .replace(/POSITIF/g, "Positif")
      .replace(/SANGAT NEGATIF/g, "Sangat Negatif")
      .replace(/NEGATIF/g, "Negatif")
      .replace(/NETRAL/g, "Netral")
      .replace(/SANGAT BAIK/g, "Sangat Baik")
      .replace(/KURANG BAIK/g, "Kurang Baik");

    return {
      komentarTerpilih,
      rekomendasiPerbaikan,
      analisisSentimen: {
        positifCount: pos,
        positifPct,
        netralCount: net,
        netralPct,
        negatifCount: neg,
        negatifPct,
        totalKomentar: total,
      },
      narasiKesimpulan,
      isAiGenerated: true,
      modelUsed: lastUsedModel,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Exception saat memanggil Gemini API:", msg);
    return generateFallbackAnalysis(ctx);
  }
}

function generateDefaultRecommendations(): string[] {
  return [
    "P1: Mengenal dengan baik mahasiswa yang mengikuti kuliahnya",
    "P2: Mudah bergaul di kalangan mahasiswa",
    "P3: Kemampuan menerima kritik, saran dan pendapat mahasiswa",
    "P4: Pemberian umpan balik terhadap tugas",
    "P5: Kesesuaian materi ujian dan/atau tugas dengan tujuan mata kuliah",
  ];
}

/**
 * Fallback generator berbasis aturan heuristik jika API Gemini tidak dapat diakses
 */
function generateFallbackAnalysis(ctx: LecturerAnalysisContext): GeminiRaporAnalysisResult {
  const cleanComments = ctx.rawComments
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length >= 5);

  // Cari komentar yang mengandung kata kritik / negatif / perbaikan
  const negWords = ["cepat", "tegang", "sulit", "kurang", "membosankan", "ketinggalan", "susah", "tugas", "pelit", "tambah", "jarang", "kecewa", "standar", "ketat", "jadwal", "tingkatkan"];
  const criticalComments = cleanComments.filter((c) => {
    const lower = c.toLowerCase();
    return negWords.some((w) => lower.includes(w));
  });

  const sortedCritical = criticalComments.length >= 5 ? criticalComments : cleanComments;
  const komentarTerpilih = [...sortedCritical].slice(0, 5);

  while (komentarTerpilih.length < 5) {
    komentarTerpilih.push("Tidak ada catatan kritik atau saran tambahan dari responden.");
  }

  // Rekomendasi perbaikan dari butir pertanyaan kuesioner
  const rekomendasiPerbaikan = (ctx.rekomendasiPerbaikanTexts && ctx.rekomendasiPerbaikanTexts.length >= 5)
    ? ctx.rekomendasiPerbaikanTexts.slice(0, 5).map((q, i) => `P${i + 1}: ${q}`)
    : generateDefaultRecommendations();

  // Estimasi sentimen heuristik
  let pos = 0;
  let neg = 0;
  let net = 0;

  const posWords = ["baik", "bagus", "jelas", "enak", "mantap", "ramah", "terbaik", "seru", "semangat", "keren", "terimakasih", "makasih", "paham", "sukses"];

  for (const c of cleanComments) {
    const lower = c.toLowerCase();
    const hasPos = posWords.some((w) => lower.includes(w));
    const hasNeg = negWords.some((w) => lower.includes(w));

    if (hasPos && !hasNeg) pos++;
    else if (hasNeg) neg++;
    else net++;
  }

  const total = cleanComments.length || 1;
  const positifPct = Math.round((pos / total) * 1000) / 10;
  const netralPct = Math.round((net / total) * 1000) / 10;
  const negatifPct = Math.round((neg / total) * 1000) / 10;

  let narasiKesimpulan = "";
  if (positifPct >= 80) {
    narasiKesimpulan = `Berdasarkan hasil kuesioner dan analisis sentimen, mayoritas mahasiswa memberikan respon Sangat Positif (${positifPct}%) terhadap proses pembelajaran dan pengajaran dosen. Dosen diharapkan mempertahankan kinerja yang baik serta menindaklanjuti rekomendasi perbaikan pada Bagian B untuk peningkatan mutu berkelanjutan.`;
  } else if (positifPct >= 60) {
    narasiKesimpulan = `Berdasarkan hasil kuesioner dan analisis sentimen, respon mahasiswa didominasi penilaian Positif (${positifPct}%) dan Netral (${netralPct}%). Dosen disarankan untuk memperhatikan catatan mahasiswa dan rekomendasi perbaikan pada Bagian B guna meningkatkan efektivitas perkuliahan.`;
  } else {
    narasiKesimpulan = `Berdasarkan hasil kuesioner dan analisis sentimen, evaluasi mahasiswa menunjukkan perlunya perhatian terhadap masukan kritis mahasiswa (${negatifPct}%). Dosen diharapkan proaktif menindaklanjuti rekomendasi perbaikan pada Bagian B guna meningkatkan efektivitas perkuliahan.`;
  }

  return {
    komentarTerpilih,
    rekomendasiPerbaikan,
    analisisSentimen: {
      positifCount: pos,
      positifPct,
      netralCount: net,
      netralPct,
      negatifCount: neg,
      negatifPct,
      totalKomentar: cleanComments.length,
    },
    narasiKesimpulan,
    isAiGenerated: false,
    modelUsed: "heuristic-fallback",
  };
}

export const analyzeLecturerFeedbackWithGemini = analyzeRaporWithGemini;

