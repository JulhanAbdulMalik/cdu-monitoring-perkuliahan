"use server";
// src/actions/master-import.ts
// Server Actions for Bulk Importing Master Data (Dosen, Mata Kuliah, Kelas, Prodi, Semester)

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

export interface ImportPreviewRow {
  rowIndex: number;
  data: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  previewList: ImportPreviewRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. IMPORT DOSEN
// ─────────────────────────────────────────────────────────────────────────────

export async function parseDosenExcel(formData: FormData): Promise<{ success: boolean; data?: ImportPreviewResult; error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "File tidak ditemukan" };

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const allProdi = await prisma.prodi.findMany();
    const existingDosen = await prisma.dosen.findMany();

    const previewList: ImportPreviewRow[] = [];

    rawRows.forEach((row, idx) => {
      const nama = String(row["Nama Lengkap & Gelar"] || row["Nama"] || row["nama"] || "").trim();
      const nidn = String(row["NIDN"] || row["nidn"] || "").trim();
      const email = String(row["Email"] || row["email"] || "").trim();
      const kodeProdi = String(row["Kode Prodi"] || row["Prodi"] || row["prodi"] || "").trim().toUpperCase();

      const errors: string[] = [];

      if (!nama) errors.push("Nama dosen wajib diisi");
      if (!kodeProdi) errors.push("Kode prodi wajib diisi");

      const matchedProdi = allProdi.find(
        (p) => p.kode.toUpperCase() === kodeProdi || p.nama.toLowerCase() === kodeProdi.toLowerCase()
      );

      if (kodeProdi && !matchedProdi) {
        errors.push(`Prodi "${kodeProdi}" tidak ditemukan di database`);
      }

      previewList.push({
        rowIndex: idx + 2,
        data: {
          nama,
          nidn: nidn || null,
          email: email || null,
          kodeProdi,
          prodiId: matchedProdi?.id || null,
          prodiNama: matchedProdi?.nama || "-",
        },
        isValid: errors.length === 0,
        errors,
      });
    });

    return {
      success: true,
      data: {
        totalRows: previewList.length,
        validRows: previewList.filter((r) => r.isValid).length,
        invalidRows: previewList.filter((r) => !r.isValid).length,
        previewList,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membaca file Excel Dosen" };
  }
}

export async function commitDosenImport(rows: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    let count = 0;
    for (const r of rows) {
      if (!r.nama || !r.prodiId) continue;

      const cleanNama = String(r.nama).trim();
      const cleanNidn = r.nidn ? String(r.nidn).trim() : null;
      const cleanEmail = r.email ? String(r.email).trim() : null;

      // 1. Cari dosen yang sudah ada (Anti-Duplikasi):
      //    a. Berdasarkan NIDN (jika NIDN diisi)
      //    b. ATAU berdasarkan Nama Dosen (case-insensitive) pada Prodi tersebut atau secara universal
      let existingDosen = cleanNidn
        ? await prisma.dosen.findUnique({ where: { nidn: cleanNidn } })
        : null;

      if (!existingDosen) {
        existingDosen = await prisma.dosen.findFirst({
          where: {
            nama: { equals: cleanNama, mode: "insensitive" },
            prodiId: r.prodiId,
          },
        });
      }

      if (!existingDosen) {
        existingDosen = await prisma.dosen.findFirst({
          where: {
            nama: { equals: cleanNama, mode: "insensitive" },
          },
        });
      }

      if (existingDosen) {
        // UPDATE Dosen yang sudah ada (jangan buat duplikat!)
        await prisma.dosen.update({
          where: { id: existingDosen.id },
          data: {
            nama: cleanNama,
            nidn: cleanNidn || existingDosen.nidn,
            email: cleanEmail || existingDosen.email,
            prodiId: r.prodiId || existingDosen.prodiId,
          },
        });
      } else {
        // Buat baru hanya jika benar-benar belum terdaftar
        await prisma.dosen.create({
          data: {
            nama: cleanNama,
            nidn: cleanNidn,
            email: cleanEmail,
            prodiId: r.prodiId,
          },
        });
      }
      count++;
    }

    revalidatePath("/master/dosen");
    revalidatePath("/");
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengimport data dosen" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. IMPORT MATA KULIAH
// ─────────────────────────────────────────────────────────────────────────────

export async function parseMataKuliahExcel(formData: FormData): Promise<{ success: boolean; data?: ImportPreviewResult; error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "File tidak ditemukan" };

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const allProdi = await prisma.prodi.findMany();
    const previewList: ImportPreviewRow[] = [];

    rawRows.forEach((row, idx) => {
      const kode = String(row["Kode MK"] || row["Kode"] || row["kode"] || "").trim().toUpperCase();
      const nama = String(row["Nama Mata Kuliah"] || row["Nama MK"] || row["nama"] || "").trim();
      const sksRaw = row["SKS"] || row["sks"] || 3;
      const sks = parseInt(String(sksRaw)) || 3;
      const kodeProdi = String(row["Kode Prodi"] || row["Prodi"] || row["prodi"] || "").trim().toUpperCase();

      const errors: string[] = [];

      if (!kode) errors.push("Kode MK wajib diisi");
      if (!nama) errors.push("Nama MK wajib diisi");
      if (isNaN(sks) || sks < 1 || sks > 6) errors.push("SKS harus antara 1–6");

      const matchedProdi = allProdi.find(
        (p) => p.kode.toUpperCase() === kodeProdi || p.nama.toLowerCase() === kodeProdi.toLowerCase()
      );

      if (kodeProdi && !matchedProdi) {
        errors.push(`Prodi "${kodeProdi}" tidak ditemukan di database`);
      } else if (!kodeProdi) {
        errors.push("Kode prodi wajib diisi");
      }

      previewList.push({
        rowIndex: idx + 2,
        data: {
          kode,
          nama,
          sks,
          kodeProdi,
          prodiId: matchedProdi?.id || null,
          prodiNama: matchedProdi?.nama || "-",
        },
        isValid: errors.length === 0,
        errors,
      });
    });

    return {
      success: true,
      data: {
        totalRows: previewList.length,
        validRows: previewList.filter((r) => r.isValid).length,
        invalidRows: previewList.filter((r) => !r.isValid).length,
        previewList,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membaca file Excel Mata Kuliah" };
  }
}

export async function commitMataKuliahImport(rows: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    let count = 0;
    for (const r of rows) {
      if (!r.kode || !r.nama || !r.prodiId) continue;

      await prisma.mataKuliah.upsert({
        where: {
          kode_prodiId: {
            kode: r.kode,
            prodiId: r.prodiId,
          },
        },
        update: {
          nama: r.nama,
          sks: r.sks,
        },
        create: {
          kode: r.kode,
          nama: r.nama,
          sks: r.sks,
          prodiId: r.prodiId,
        },
      });
      count++;
    }

    revalidatePath("/master/mata-kuliah");
    revalidatePath("/");
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengimport data mata kuliah" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. IMPORT KELAS / PERKULIAHAN (DENGAN AUTO GENERATE 16 SESI MONITORING)
// ─────────────────────────────────────────────────────────────────────────────

export async function parseKelasExcel(formData: FormData): Promise<{ success: boolean; data?: ImportPreviewResult; error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "File tidak ditemukan" };

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const allSemesters = await prisma.semester.findMany();
    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];
    const allMk = await prisma.mataKuliah.findMany();
    const allDosen = await prisma.dosen.findMany();
    const allProdi = await prisma.prodi.findMany();

    const previewList: ImportPreviewRow[] = [];

    rawRows.forEach((row, idx) => {
      // 1. Kode Kelas
      const kodeKelas = String(
        row["Nama Kelas"] || row["Kode Kelas"] || row["Kelas"] || row["kodeKelas"] || ""
      ).trim().toUpperCase();

      // 2. Kode MK, Nama MK, SKS (Smart Parser untuk format gabungan SIAKAD seperti "26GZ11001 - Biologi Dasar (2.00 SKS)")
      const rawMk = String(
        row["Mata Kuliah"] || row["Nama Mata Kuliah"] || row["Nama MK"] || row["namaMk"] || ""
      ).trim();

      const explicitKodeMk = String(
        row["Kode Mata Kuliah"] || row["Kode MK"] || row["Kode"] || row["kodeMk"] || ""
      ).trim().toUpperCase();

      let extractedKodeMk = "";
      let extractedNamaMk = rawMk;
      let extractedSks = 0;

      // Regex format SIAKAD: "26GZ11001 - Biologi Dasar (2.00 SKS)" atau "26GZ11001-Biologi Dasar (2 SKS)"
      const mkCombinedMatch = rawMk.match(/^([A-Za-z0-9]+)\s*[-–—]\s*(.+?)(?:\s*\(\s*([\d.]+)\s*SKS\s*\))?$/i);
      if (mkCombinedMatch) {
        extractedKodeMk = mkCombinedMatch[1].trim().toUpperCase();
        extractedNamaMk = mkCombinedMatch[2].trim();
        if (mkCombinedMatch[3]) {
          extractedSks = Math.round(parseFloat(mkCombinedMatch[3])) || 3;
        }
      }

      const kodeMk = explicitKodeMk || extractedKodeMk;
      const namaMk = explicitKodeMk ? rawMk : extractedNamaMk;
      const sksRaw = row["SKS"] || row["sks"] || extractedSks || 3;
      const sks = parseInt(String(sksRaw)) || 3;

      // 3. Program Studi (Smart Parser untuk "S1 - Gizi", "Prodi Pengampu", dll)
      const prodiQuery = String(
        row["Prodi Pengampu"] ||
        row["Program Studi Pengampu"] ||
        row["Kode Program Studi"] ||
        row["Program Studi"] ||
        row["Prodi"] ||
        row["prodi"] ||
        row["Kode Prodi"] ||
        ""
      ).trim();

      // Bersihkan prefix jenjang: "S1 - Gizi" -> "Gizi", "S2 - Teknik" -> "Teknik"
      const cleanProdiQuery = prodiQuery.replace(/^(S[1-3]|D[3-4])\s*[-–—]?\s*/i, "").trim();

      // 4. Pengajar / Dosen
      const rawDosen = String(
        row["Pengajar"] || row["Dosen"] || row["Nama Dosen"] || row["NIDN Dosen"] || row["dosen"] || ""
      ).trim();
      // Bersihkan enter / newline pada team teaching: "LAZUARDI...\nDr. CHRIS..." -> "LAZUARDI... / Dr. CHRIS..."
      let cleanDosen = rawDosen.replace(/[\r\n]+/g, " / ").replace(/\s{2,}/g, " ").trim();

      // Deteksi Otomatis Kelas Jenis 'BIMBINGAN' (Magang, Skripsi, Riset, PKL, SCP, dll)
      const BIMBINGAN_CODES = [
        "IN4005", "IN4006", "IN4007", "MS40062", "RS4005", "RS4006", "RS4007", "WU30004", "RS4008"
      ];
      const BIMBINGAN_KEYWORDS = [
        "magang", "skripsi", "riset", "pkl", "praktek kerja lapangan", "review literatur",
        "publikasi ilmiah", "scp", "bimbingan", "tugas akhir"
      ];

      const isBimbinganCourse =
        BIMBINGAN_CODES.some((code) => kodeMk.toUpperCase().includes(code)) ||
        BIMBINGAN_KEYWORDS.some((kw) => namaMk.toLowerCase().includes(kw)) ||
        kodeKelas.toUpperCase().includes("SKRIP") ||
        kodeKelas.toUpperCase().startsWith("IN-") ||
        kodeKelas.toUpperCase().startsWith("RS-");

      // 5. Semester (opsional dari excel, fallback ke activeSemester)
      const tahunAkademik = String(row["Tahun Akademik"] || row["tahunAkademik"] || row["Kur."] || row["Kurikulum"] || "").trim();
      const periode = String(row["Periode"] || row["periode"] || "").trim().toUpperCase();

      // 6. Jadwal Mingguan (Smart Parser untuk "Selasa, 08:00 s.d 09:40 @ B2A" atau format kolom terpisah)
      const rawJadwalMingguan = String(row["Jadwal Mingguan"] || row["Jadwal"] || row["jadwal"] || "").trim();

      let hari = String(row["Hari Perkuliahan"] || row["Hari"] || row["hari"] || "").trim();
      let jam = String(row["Jam Perkuliahan"] || row["Jam"] || row["jam"] || "").trim();
      let rawRuang = String(
        row["Ruang Kelas"] || row["Ruang"] || row["Ruangan"] || row["ruangKelas"] || row["ruangan"] || ""
      ).trim();

      if (rawJadwalMingguan) {
        // Ekstraksi ruangan jika ada @
        const atParts = rawJadwalMingguan.split("@");
        if (atParts.length > 1 && !rawRuang) {
          const roomCand = atParts[1].trim();
          if (roomCand && roomCand !== "-" && !roomCand.toLowerCase().includes("online")) {
            rawRuang = roomCand;
          }
        }

        const schedulePart = atParts[0].trim();

        // Ekstraksi Hari
        if (!hari) {
          const dayMatch = schedulePart.match(/(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)/i);
          if (dayMatch) {
            hari = dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1).toLowerCase();
          }
        }

        // Ekstraksi Jam (misal "08:00 s.d 09:40" atau "07:30 - 10:00")
        if (!jam) {
          const timeMatch = schedulePart.match(/(\d{1,2}[:.]\d{2})\s*(?:s\.d|-|s\/d|sampai)\s*(\d{1,2}[:.]\d{2})/i);
          if (timeMatch) {
            const start = timeMatch[1].replace(".", ":");
            const end = timeMatch[2].replace(".", ":");
            jam = `${start} - ${end}`;
          }
        }
      }

      // Cek apakah jadwal terisi
      const hasJadwal = Boolean(hari && jam);

      // 7. Mode Pembelajaran
      const rawMode = String(row["Mode Pembelajaran"] || row["Mode (Online / Offline)"] || row["Mode"] || row["mode"] || "").trim().toUpperCase();
      let mode: "DARING" | "LURING" | "BIMBINGAN" = "DARING";

      if (isBimbinganCourse || rawMode.includes("BIMBINGAN")) {
        mode = "BIMBINGAN";
        rawRuang = ""; // Bimbingan tidak memerlukan ruangan fisik di jadwal mingguan
      } else if (rawMode.includes("OFFLINE") || rawMode.includes("LURING") || (rawRuang && rawRuang !== "-")) {
        mode = "LURING";
      }

      // 8. Ruang Kelas
      const ruangan = mode === "LURING" ? (rawRuang || null) : null;
      const dosenQuery = cleanDosen;

      const errors: string[] = [];

      if (!kodeKelas) errors.push("Nama / Kode Kelas wajib diisi");
      if (!kodeMk && !namaMk) errors.push("Kode atau Nama Mata Kuliah wajib diisi");
      if (!cleanDosen) errors.push("Pengajar / Dosen belum diisi");
      if (!hasJadwal) errors.push("Jadwal mingguan belum diisi");

      // Match semester
      let matchedSem = activeSemester;
      if (tahunAkademik && periode) {
        matchedSem = allSemesters.find(
          (s) => s.tahunAkademik.includes(tahunAkademik) && s.periode === periode
        ) || activeSemester;
      } else if (tahunAkademik) {
        matchedSem = allSemesters.find(
          (s) => s.tahunAkademik.includes(tahunAkademik)
        ) || activeSemester;
      }

      // Match Prodi (case-insensitive to kode or nama or cleanProdiQuery)
      const matchedProdi = allProdi.find(
        (p) =>
          (p.kode && p.kode.toUpperCase() === prodiQuery.toUpperCase()) ||
          (p.nama && p.nama.toLowerCase() === prodiQuery.toLowerCase()) ||
          (cleanProdiQuery && p.nama.toLowerCase() === cleanProdiQuery.toLowerCase()) ||
          (cleanProdiQuery && cleanProdiQuery.length >= 3 && p.nama.toLowerCase().includes(cleanProdiQuery.toLowerCase())) ||
          (cleanProdiQuery && cleanProdiQuery.length >= 3 && cleanProdiQuery.toLowerCase().includes(p.nama.toLowerCase())) ||
          (prodiQuery && p.nama.toLowerCase().includes(prodiQuery.toLowerCase()))
      );

      // Match Mata Kuliah jika sudah ada
      const matchedMk = allMk.find(
        (m) =>
          (kodeMk && m.kode.toUpperCase() === kodeMk) ||
          (namaMk && m.nama.toLowerCase() === namaMk.toLowerCase())
      );

      // Match Dosen jika sudah ada
      const matchedDosen = allDosen.find(
        (d) =>
          (d.nidn && d.nidn === dosenQuery) ||
          d.nama.toLowerCase() === dosenQuery.toLowerCase() ||
          d.nama.toLowerCase().includes(dosenQuery.toLowerCase()) ||
          dosenQuery.toLowerCase().includes(d.nama.toLowerCase())
      );

      previewList.push({
        rowIndex: idx + 2,
        data: {
          kodeKelas,
          semesterId: matchedSem?.id || null,
          semesterTahun: matchedSem ? `${matchedSem.tahunAkademik} (${matchedSem.periode})` : "-",
          // MK data
          kodeMk: kodeMk || matchedMk?.kode || kodeKelas,
          namaMk: namaMk || matchedMk?.nama || "Mata Kuliah",
          sks,
          mataKuliahId: matchedMk?.id || null,
          mataKuliahNama: matchedMk ? `${matchedMk.kode} - ${matchedMk.nama}` : (kodeMk ? `${kodeMk} - ${namaMk}` : namaMk),
          // Prodi data
          prodiQuery: prodiQuery || matchedProdi?.nama || "Umum",
          prodiId: matchedProdi?.id || null,
          prodiNama: matchedProdi?.nama || prodiQuery || "-",
          // Dosen data
          dosenQuery,
          dosenId: matchedDosen?.id || null,
          dosenNama: matchedDosen?.nama || dosenQuery,
          // Jadwal, Ruangan & Mode
          jadwalHari: hari,
          jadwalJam: jam,
          ruangan: ruangan,
          modePembelajaran: mode,
        },
        isValid: errors.length === 0,
        errors,
      });
    });

    return {
      success: true,
      data: {
        totalRows: previewList.length,
        validRows: previewList.filter((r) => r.isValid).length,
        invalidRows: previewList.filter((r) => !r.isValid).length,
        previewList,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membaca file Excel Perkuliahan" };
  }
}

export async function commitKelasImport(rows: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    let count = 0;

    const allSemesters = await prisma.semester.findMany();
    const activeSemester = allSemesters.find((s) => s.aktif) || allSemesters[0];

    // Dapatkan fakultas default jika perlu membuat prodi baru
    let defaultFakultas = await prisma.fakultas.findFirst();
    if (!defaultFakultas) {
      defaultFakultas = await prisma.fakultas.create({
        data: { nama: "Fakultas Bisnis dan Humaniora" },
      });
    }

    for (const r of rows) {
      if (!r.kodeKelas) continue;

      const semesterId = r.semesterId || activeSemester?.id;
      if (!semesterId) continue;

      // 1. Dapatkan atau Buat Prodi
      let prodiId = r.prodiId;
      if (!prodiId) {
        const query = (r.prodiQuery || "Umum").trim();
        let existingProdi = await prisma.prodi.findFirst({
          where: {
            OR: [
              { nama: { equals: query, mode: "insensitive" } },
              { kode: { equals: query, mode: "insensitive" } },
            ],
          },
        });

        if (!existingProdi) {
          // Generate kode prodi aman
          const safeKode = query.replace(/[^A-Za-z0-9]/g, "").substring(0, 6).toUpperCase() || "PRODI";
          let kodeToUse = safeKode;
          let counter = 1;
          while (await prisma.prodi.findUnique({ where: { kode: kodeToUse } })) {
            kodeToUse = `${safeKode}${counter++}`;
          }

          existingProdi = await prisma.prodi.create({
            data: {
              nama: query,
              kode: kodeToUse,
              fakultasId: defaultFakultas.id,
            },
          });
        }
        prodiId = existingProdi.id;
      }

      // 2. Dapatkan atau Buat Mata Kuliah
      let mataKuliahId = r.mataKuliahId;
      const mkKode = (r.kodeMk || "MK").trim().toUpperCase();
      const mkNama = (r.namaMk || mkKode).trim();
      const mkSks = Number(r.sks) || 3;

      let existingMk = mataKuliahId
        ? await prisma.mataKuliah.findUnique({ where: { id: mataKuliahId } })
        : await prisma.mataKuliah.findFirst({
            where: {
              kode: mkKode,
              prodiId: prodiId,
            },
          });

      if (!existingMk) {
        existingMk = await prisma.mataKuliah.create({
          data: {
            kode: mkKode,
            nama: mkNama,
            sks: mkSks,
            prodiId: prodiId,
          },
        });
      } else {
        existingMk = await prisma.mataKuliah.update({
          where: { id: existingMk.id },
          data: {
            nama: mkNama,
            sks: mkSks,
          },
        });
      }
      mataKuliahId = existingMk.id;

      // 3. Dapatkan atau Buat Dosen
      let dosenId = r.dosenId;
      const dosenNama = (r.dosenQuery || r.dosenNama || "Dosen Pengampu").trim();
      let existingDosen = dosenId
        ? await prisma.dosen.findUnique({ where: { id: dosenId } })
        : await prisma.dosen.findFirst({
            where: {
              nama: { equals: dosenNama, mode: "insensitive" },
            },
          });

      if (!existingDosen) {
        existingDosen = await prisma.dosen.create({
          data: {
            nama: dosenNama,
            prodiId: prodiId,
          },
        });
      }
      dosenId = existingDosen.id;

      // 4. Upsert Kelas
      const existing = await prisma.kelas.findFirst({
        where: {
          kodeKelas: r.kodeKelas.trim().toUpperCase(),
          semesterId: semesterId,
          mataKuliahId: mataKuliahId,
        },
        include: { monitoringSesi: true },
      });

      if (existing) {
        // Update kelas data
        await prisma.kelas.update({
          where: { id: existing.id },
          data: {
            dosenId: dosenId,
            jadwalHari: r.jadwalHari,
            jadwalJam: r.jadwalJam,
            ruangan: r.modePembelajaran !== "DARING" ? (r.ruangan?.trim() || null) : null,
            modePembelajaran: r.modePembelajaran,
          },
        });
      } else {
        // Buat kelas baru dan 16 sesi monitoring sekaligus
        await prisma.$transaction(async (tx) => {
          const created = await tx.kelas.create({
            data: {
              kodeKelas: r.kodeKelas.trim().toUpperCase(),
              semesterId: semesterId,
              mataKuliahId: mataKuliahId,
              dosenId: dosenId,
              jadwalHari: r.jadwalHari,
              jadwalJam: r.jadwalJam,
              ruangan: r.modePembelajaran !== "DARING" ? (r.ruangan?.trim() || null) : null,
              modePembelajaran: r.modePembelajaran,
            },
          });

          const sessionsData = [];
          for (let i = 1; i <= 16; i++) {
            const isUTS = i === 8;
            const isUAS = i === 16;
            const isExam = isUTS || isUAS;

            sessionsData.push({
              kelasId: created.id,
              nomorSesi: i,
              jenisSesi: isUTS ? ("UTS" as const) : isUAS ? ("UAS" as const) : ("REGULER" as const),
              kehadiran: "BELUM_DIISI" as const,
              lectureNote: isExam ? null : false,
              slide: isExam ? null : false,
              video: isExam ? null : false,
              conference: isExam ? null : false,
              tugas: isExam ? null : false,
              kuis: isExam ? null : false,
            });
          }

          await tx.monitoringSesi.createMany({
            data: sessionsData,
          });
        });
      }

      count++;
    }

    revalidatePath("/master/kelas");
    revalidatePath("/monitoring");
    revalidatePath("/");
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengimport data perkuliahan" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. IMPORT FAKULTAS & PRODI
// ─────────────────────────────────────────────────────────────────────────────

export async function parseProdiExcel(formData: FormData): Promise<{ success: boolean; data?: ImportPreviewResult; error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "File tidak ditemukan" };

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const previewList: ImportPreviewRow[] = [];

    rawRows.forEach((row, idx) => {
      const namaFakultas = String(row["Nama Fakultas"] || row["Fakultas"] || row["fakultas"] || "").trim();
      const kodeProdi = String(row["Kode Prodi"] || row["Kode"] || row["kode"] || "").trim().toUpperCase();
      const namaProdi = String(row["Nama Program Studi"] || row["Nama Prodi"] || row["nama"] || "").trim();

      const errors: string[] = [];

      if (!namaFakultas) errors.push("Nama fakultas wajib diisi");
      if (!kodeProdi) errors.push("Kode prodi wajib diisi");
      if (!namaProdi) errors.push("Nama prodi wajib diisi");

      previewList.push({
        rowIndex: idx + 2,
        data: {
          namaFakultas,
          kodeProdi,
          namaProdi,
        },
        isValid: errors.length === 0,
        errors,
      });
    });

    return {
      success: true,
      data: {
        totalRows: previewList.length,
        validRows: previewList.filter((r) => r.isValid).length,
        invalidRows: previewList.filter((r) => !r.isValid).length,
        previewList,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membaca file Excel Prodi" };
  }
}

export async function commitProdiImport(rows: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    let count = 0;

    for (const r of rows) {
      if (!r.namaFakultas || !r.kodeProdi || !r.namaProdi) continue;

      // Upsert fakultas
      let fakultas = await prisma.fakultas.findUnique({
        where: { nama: r.namaFakultas },
      });

      if (!fakultas) {
        fakultas = await prisma.fakultas.create({
          data: { nama: r.namaFakultas },
        });
      }

      // Upsert prodi
      await prisma.prodi.upsert({
        where: { kode: r.kodeProdi },
        update: {
          nama: r.namaProdi,
          fakultasId: fakultas.id,
        },
        create: {
          nama: r.namaProdi,
          kode: r.kodeProdi,
          fakultasId: fakultas.id,
        },
      });

      count++;
    }

    revalidatePath("/master/prodi");
    revalidatePath("/");
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengimport data prodi" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. IMPORT SEMESTER
// ─────────────────────────────────────────────────────────────────────────────

export async function parseSemesterExcel(formData: FormData): Promise<{ success: boolean; data?: ImportPreviewResult; error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "File tidak ditemukan" };

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const previewList: ImportPreviewRow[] = [];

    rawRows.forEach((row, idx) => {
      const tahunAkademik = String(row["Tahun Akademik"] || row["Tahun"] || row["tahunAkademik"] || "").trim();
      const periode = String(row["Periode"] || row["periode"] || "GANJIL").trim().toUpperCase();
      const aktifRaw = String(row["Aktif"] || row["aktif"] || "TIDAK").trim().toUpperCase();
      const aktif = aktifRaw === "YA" || aktifRaw === "TRUE" || aktifRaw === "1";

      const errors: string[] = [];

      if (!tahunAkademik || !/^\d{4}\/\d{4}$/.test(tahunAkademik)) {
        errors.push("Format tahun akademik harus YYYY/YYYY (contoh: 2025/2026)");
      }
      if (!["GANJIL", "GENAP"].includes(periode)) {
        errors.push("Periode harus GANJIL atau GENAP");
      }

      previewList.push({
        rowIndex: idx + 2,
        data: {
          tahunAkademik,
          periode,
          aktif,
        },
        isValid: errors.length === 0,
        errors,
      });
    });

    return {
      success: true,
      data: {
        totalRows: previewList.length,
        validRows: previewList.filter((r) => r.isValid).length,
        invalidRows: previewList.filter((r) => !r.isValid).length,
        previewList,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membaca file Excel Semester" };
  }
}

export async function commitSemesterImport(rows: any[]): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    let count = 0;

    for (const r of rows) {
      if (!r.tahunAkademik || !r.periode) continue;

      const existing = await prisma.semester.findFirst({
        where: { tahunAkademik: r.tahunAkademik, periode: r.periode },
      });

      if (!existing) {
        if (r.aktif) {
          await prisma.semester.updateMany({ data: { aktif: false } });
        }

        await prisma.semester.create({
          data: {
            tahunAkademik: r.tahunAkademik,
            periode: r.periode,
            aktif: r.aktif,
          },
        });
        count++;
      }
    }

    revalidatePath("/master/semester");
    revalidatePath("/");
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengimport data semester" };
  }
}
