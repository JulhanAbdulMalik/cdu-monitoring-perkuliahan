// src/lib/siakad-angket-parser.ts
// Parser file Rekap Kuesioner / Angket dari SIAKAD Nusa Putra (Format HTML .xls)

import * as XLSX from "xlsx";

export interface QuestionScoreItem {
  no: number;
  pertanyaan: string;
  totalRespon: number;
  totalSkor: number;
  rataRata: number; // skala 1.00 - 5.00
  distribusi: {
    sangatTidakBaik: number; // 1
    tidakBaik: number;       // 2
    biasa: number;           // 3
    baik: number;            // 4
    sangatBaik: number;      // 5
  };
}

export interface ClassSurveyItem {
  namaMataKuliah: string;
  kodeKelas: string;
  labelLengkap: string; // misal "Hidrologi (TS25A)"
  nilaiTotal: number;
  rataRata: number;
}

export interface StudentCommentItem {
  tipe: "KRITIK_SARAN" | "KESAN_PESAN";
  kelas?: string;
  teks: string;
}

export interface SiakadAngketParsedData {
  nip: string;
  namaDosen: string;
  homebase: string;
  periode: string;
  nilaiRataRata: number; // Rata-rata total kuesioner (misal: 4.10)
  nilaiTotal: number;
  predikatSiakad?: string;
  totalResponden: number;
  kelasList: ClassSurveyItem[];
  lowestQuestions: QuestionScoreItem[]; // 5 butir pertanyaan dengan skor terendah
  rekomendasiPerbaikanQuestions: QuestionScoreItem[]; // 5 butir pertanyaan dengan 'Sangat tidak baik (1)' & 'Tidak baik (2)' terbanyak
  rekomendasiPerbaikanTexts: string[]; // Teks pertanyaan untuk Rekomendasi P1 - P5
  allQuestions: QuestionScoreItem[];
  komentarList: StudentCommentItem[]; // Kritik & saran mahasiswa yang bermakna
}

const JUNK_COMMENT_PATTERNS = [
  /^[-_\.\s#*]+$/,
  /^tidak\s*ada$/i,
  /^tidak$/i,
  /^tdk\s*ada$/i,
  /^ga\s*ada$/i,
  /^gak\s*ada$/i,
  /^ngga\s*ada$/i,
  /^belum\s*ada$/i,
  /^none$/i,
  /^null$/i,
  /^undefined$/i,
  /^tidak\s*ada\s*kritik/i,
  /^tidak\s*ada\s*saran/i,
  /^cukup$/i,
  /^oke$/i,
  /^ok$/i,
  /^baik$/i,
  /^bagus$/i,
  /^aman$/i,
  /^mantap$/i,
  /^good$/i,
  /^terbaik$/i,
  /^terimakasih/i,
  /^terima\s*kasih/i,
  /^makasih/i,
  /^so\s*far\s*so\s*good$/i,
  /^sangat\s*(?:baik|bagus|puas)$/i,
  /^sudah\s*sangat\s*baik/i,
  /^semoga\s*lebih\s*baik/i,
  /^lainnya$/i,
  /^kesan\s*dan\s*pesan/i,
  /^open\s*question$/i,
  /^kritik\s*&\s*saran$/i,
  /^[a-z0-9]$/i,
  /^[a-z]\s+lainnya$/i,
];

/**
 * Membersihkan teks komentar dan mendecode URL encoding (%20, %3A, dll) jika ada.
 * Jika teks normal tanpa %, fungsi langsung kembali cepat tanpa overhead decode.
 */
function cleanCommentText(raw: string): string {
  let text = stripHtml(raw);
  if (text.includes("%") && /%[0-9a-fA-F]{2}/.test(text)) {
    try {
      text = decodeURIComponent(text);
    } catch {
      // Jika terjadi format yang tidak valid, tetap gunakan teks aslinya
    }
  }
  // Bersihkan prefiks label jika ada di awal teks
  text = text.replace(/^kritik\s*:\s*/i, "").replace(/^saran\s*:\s*/i, "");
  return text.replace(/\s+/g, " ").trim();
}

function isMeaningfulComment(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  // Jangan masukkan label mata kuliah / kelas sebagai komentar
  if (/^[A-Za-z0-9\s\:\-—]+\([A-Za-z0-9\-\_\/\s]+\)$/.test(trimmed)) return false;
  // Jangan masukkan judul pertanyaan
  if (/^(\d+\s+)?kesan\s*dan\s*pesan/i.test(trimmed)) return false;
  for (const pattern of JUNK_COMMENT_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  return true;
}

/**
 * Parsing file rekap kuesioner SIAKAD (baik string HTML maupun Buffer).
 */
export function parseSiakadAngket(fileContent: string | Buffer): SiakadAngketParsedData {
  let htmlString = "";
  if (Buffer.isBuffer(fileContent)) {
    htmlString = fileContent.toString("utf8");
  } else {
    htmlString = fileContent;
  }

  const isHtml = /<html|<table|<body/i.test(htmlString);

  if (isHtml) {
    return parseSiakadHtmlAngket(htmlString);
  } else {
    return parseSiakadExcelWorkbook(fileContent as Buffer);
  }
}

export const parseSiakadAngketXls = parseSiakadAngket;

/**
 * Helper untuk membersihkan tag HTML & entitas
 */
function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parser utama untuk format HTML Table dari SIAKAD Nusa Putra
 */
function parseSiakadHtmlAngket(html: string): SiakadAngketParsedData {
  // 1. Ekstrak Header Profil (Periode, NIP Dosen, Homebase, Nama Dosen)
  let periode = "";
  let nip = "";
  let homebase = "";
  let namaDosen = "";

  // Fleksibel mencocokkan td dengan atau tanpa td tanda titik dua (:)
  const periodeMatch = html.match(/<td[^>]*>\s*Periode\s*(?::)?\s*<\/td>(?:[\s\S]*?<td[^>]*>:<\/td>)?[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (periodeMatch) periode = stripHtml(periodeMatch[1]);

  const nipMatch = html.match(/<td[^>]*>\s*NIP(?:\s*Dosen)?\s*(?::)?\s*<\/td>(?:[\s\S]*?<td[^>]*>:<\/td>)?[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (nipMatch) {
    const rawNip = stripHtml(nipMatch[1]);
    nip = rawNip === "-" ? "" : rawNip;
  }

  const homebaseMatch = html.match(/<td[^>]*>\s*Homebase\s*(?::)?\s*<\/td>(?:[\s\S]*?<td[^>]*>:<\/td>)?[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (homebaseMatch) homebase = stripHtml(homebaseMatch[1]);

  const namaMatch = html.match(/<td[^>]*>\s*Nama(?:\s*Dosen)?\s*(?::)?\s*<\/td>(?:[\s\S]*?<td[^>]*>:<\/td>)?[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (namaMatch) namaDosen = stripHtml(namaMatch[1]);

  // 2. Ekstrak Tabel 10: Nilai Total & Rata-Rata Total
  let nilaiTotal = 0;
  let nilaiRataRata = 0;
  let predikatSiakad = "";

  const totalMatch = html.match(/Nilai Total<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (totalMatch) {
    nilaiTotal = parseFloat(stripHtml(totalMatch[1]).replace(",", ".")) || 0;
  }

  const avgMatch = html.match(/Rata-Rata Total<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (avgMatch) {
    nilaiRataRata = parseFloat(stripHtml(avgMatch[1]).replace(",", ".")) || 0;
  }

  const predMatch = html.match(/Predikat<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (predMatch) {
    predikatSiakad = stripHtml(predMatch[1]);
  }

  // 3. Bedah seluruh kelas & pertanyaan kuesioner
  const questionMap = new Map<string, {
    no: number;
    pertanyaan: string;
    totalRespon: number;
    totalSkor: number;
    dist: [number, number, number, number, number];
  }>();

  const kelasList: ClassSurveyItem[] = [];

  // Cari setiap blok kelas: <strong>Nama Mata Kuliah (KodeKelas)</strong> dengan wrapper opsional div/td/p
  const classBlocks = html.split(/(?:<div[^>]*>|<td[^>]*>|<p[^>]*>)?\s*<strong>\s*(.*?\([A-Za-z0-9\-\_\/\s]+\))\s*<\/strong>\s*(?:<\/div>|<\/td>|<\/p>)?/gi);

  for (let b = 1; b < classBlocks.length; b += 2) {
    const rawLabel = stripHtml(classBlocks[b]);
    const blockContent = classBlocks[b + 1] || "";

    const parseCode = rawLabel.match(/^(.*?)\s*\((.*?)\)$/);
    const namaMataKuliah = parseCode ? parseCode[1].trim() : rawLabel;
    const kodeKelas = parseCode ? parseCode[2].trim() : "";

    // Ambil tabel pertama setelah label kelas
    const tableMatch = blockContent.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) continue;

    const tableHtml = tableMatch[1];

    // Nilai & Rata-Rata per kelas
    let classNilai = 0;
    let classRata = 0;
    const cNilaiMatch = tableHtml.match(/Nilai<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (cNilaiMatch) classNilai = parseFloat(stripHtml(cNilaiMatch[1]).replace(",", ".")) || 0;

    const cRataMatch = tableHtml.match(/Rata-Rata<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (cRataMatch) classRata = parseFloat(stripHtml(cRataMatch[1]).replace(",", ".")) || 0;

    kelasList.push({
      namaMataKuliah,
      kodeKelas,
      labelLengkap: rawLabel,
      nilaiTotal: classNilai,
      rataRata: classRata,
    });

    // Parsing baris pertanyaan: <tr><td>no</td><td>pertanyaan</td><td>c1</td><td>c2</td><td>c3</td><td>c4</td><td>c5</td></tr>
    const trMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trMatches) {
      const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map((td) => stripHtml(td));

      if (tds.length >= 7 && /^\d+$/.test(tds[0])) {
        const no = parseInt(tds[0], 10);
        const pertanyaan = tds[1];
        const c1 = parseInt(tds[2], 10) || 0;
        const c2 = parseInt(tds[3], 10) || 0;
        const c3 = parseInt(tds[4], 10) || 0;
        const c4 = parseInt(tds[5], 10) || 0;
        const c5 = parseInt(tds[6], 10) || 0;

        const responCount = c1 + c2 + c3 + c4 + c5;
        const skor = c1 * 1 + c2 * 2 + c3 * 3 + c4 * 4 + c5 * 5;

        if (!questionMap.has(pertanyaan)) {
          questionMap.set(pertanyaan, {
            no,
            pertanyaan,
            totalRespon: 0,
            totalSkor: 0,
            dist: [0, 0, 0, 0, 0],
          });
        }

        const q = questionMap.get(pertanyaan)!;
        q.totalRespon += responCount;
        q.totalSkor += skor;
        q.dist[0] += c1;
        q.dist[1] += c2;
        q.dist[2] += c3;
        q.dist[3] += c4;
        q.dist[4] += c5;
      }
    }
  }

  // 4. Hitung skor rata-rata setiap pertanyaan & urutkan dari terendah
  const allQuestions: QuestionScoreItem[] = [];
  questionMap.forEach((q) => {
    const rataRata = q.totalRespon > 0 ? Math.round((q.totalSkor / q.totalRespon) * 100) / 100 : 0;
    allQuestions.push({
      no: q.no,
      pertanyaan: q.pertanyaan,
      totalRespon: q.totalRespon,
      totalSkor: q.totalSkor,
      rataRata,
      distribusi: {
        sangatTidakBaik: q.dist[0],
        tidakBaik: q.dist[1],
        biasa: q.dist[2],
        baik: q.dist[3],
        sangatBaik: q.dist[4],
      },
    });
  });

  // 4. Hitung skor rata-rata & tentukan Rekomendasi Perbaikan (P1 - P5)
  // Aturan pemilahan perbaikan (standar QAU):
  // Diambil dari butir pertanyaan dengan 'Sangat tidak baik (1)' terbanyak,
  // lalu 'Tidak baik (2)' terbanyak, dan skor rerata terendah.
  const questionsSortedForImprovement = [...allQuestions].sort((a, b) => {
    if (b.distribusi.sangatTidakBaik !== a.distribusi.sangatTidakBaik) {
      return b.distribusi.sangatTidakBaik - a.distribusi.sangatTidakBaik;
    }
    if (b.distribusi.tidakBaik !== a.distribusi.tidakBaik) {
      return b.distribusi.tidakBaik - a.distribusi.tidakBaik;
    }
    return a.rataRata - b.rataRata;
  });

  const rekomendasiPerbaikanQuestions = questionsSortedForImprovement.slice(0, 5);
  const rekomendasiPerbaikanTexts = rekomendasiPerbaikanQuestions.map((q) => q.pertanyaan);

  allQuestions.sort((a, b) => a.rataRata - b.rataRata);
  const lowestQuestions = allQuestions.slice(0, 5);

  // 5. Ekstrak Komentar Mahasiswa (Prioritas Utama: Tabel 12 Kritik & Saran, baru Tabel 11 Kesan & Pesan)
  const kritikSaranList: StudentCommentItem[] = [];
  const kesanPesanList: StudentCommentItem[] = [];
  const tableSplits = html.split("<table");

  for (let i = 1; i < tableSplits.length; i++) {
    const tableHtml = "<table" + tableSplits[i].split("</table>")[0] + "</table>";

    const isOpenQuestion = /Open Question/i.test(tableHtml);
    const isKritikSaran = /Kritik & Saran/i.test(tableHtml);

    if (isOpenQuestion || isKritikSaran) {
      const tipe: "KRITIK_SARAN" | "KESAN_PESAN" = isKritikSaran ? "KRITIK_SARAN" : "KESAN_PESAN";
      const targetList = isKritikSaran ? kritikSaranList : kesanPesanList;

      const trMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
      let currentKelas = "";

      for (const tr of trMatches) {
        // Cek baris header pemisah kelas (contoh: colspan="7" Matematika Diskrit (TI25A))
        const classCellMatch = tr.match(/colspan=[\"']\d+[\"'][^>]*>([\s\S]*?)<\/td>/i);
        if (classCellMatch) {
          const rawCell = stripHtml(classCellMatch[1]);
          if (/\([A-Za-z0-9\-\_]+\)/.test(rawCell)) {
            currentKelas = rawCell;
            continue;
          }
        }

        const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map((td) => cleanCommentText(td));

        for (const tdText of tds) {
          // Jika teks adalah header mata kuliah, perbarui currentKelas dan lewati
          if (/^[A-Za-z0-9\s\:\-—]+\([A-Za-z0-9\-\_\/\s]+\)$/.test(tdText)) {
            currentKelas = tdText;
            continue;
          }

          if (isMeaningfulComment(tdText)) {
            const exists = targetList.some((k) => k.teks.toLowerCase() === tdText.toLowerCase());
            if (!exists) {
              targetList.push({
                tipe,
                kelas: currentKelas || undefined,
                teks: tdText,
              });
            }
          }
        }
      }
    }
  }

  // Prioritaskan Kritik & Saran (Tabel 12) di urutan awal agar K1 - K5 menjadi masukan konstruktif nyata
  const komentarList: StudentCommentItem[] = [...kritikSaranList, ...kesanPesanList];

  const maxRespon = allQuestions.length > 0 ? Math.max(...allQuestions.map((q) => q.totalRespon)) : 0;

  return {
    nip,
    namaDosen,
    homebase,
    periode,
    nilaiRataRata,
    nilaiTotal,
    predikatSiakad,
    totalResponden: maxRespon,
    kelasList,
    lowestQuestions,
    rekomendasiPerbaikanQuestions,
    rekomendasiPerbaikanTexts,
    allQuestions,
    komentarList,
  };
}

/**
 * Fallback parser bila file SIAKAD adalah workbook XLSX murni
 */
function parseSiakadExcelWorkbook(buffer: Buffer): SiakadAngketParsedData {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const combinedHtml = wb.SheetNames.map((name) =>
    XLSX.utils.sheet_to_html(wb.Sheets[name])
  ).join("\n");
  return parseSiakadHtmlAngket(combinedHtml);
}
