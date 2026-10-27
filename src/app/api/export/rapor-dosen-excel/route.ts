// src/app/api/export/rapor-dosen-excel/route.ts
// ExcelJS Export API Route for CDU Portal Rapor Tridharma Dosen (QAU / SPMI)
// Dilengkapi Kop Resmi, Legenda Standar Mutu, Badge Status Validasi, Filter Dinamis & Baris Ringkasan

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getRaporDosenList } from "@/actions/rapor";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userProdiIds = ((session.user as any).prodiIds as string[]) || [];
    const isDosen = userRole === "DOSEN";

    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get("semesterId") || undefined;
    const prodiId = searchParams.get("prodiId") || undefined;
    const status = searchParams.get("status") || "ALL";
    const searchQuery = (searchParams.get("q") || searchParams.get("search") || "").trim();
    const sortField = searchParams.get("sortField") || "nama";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    let targetProdiId = prodiId;
    if (isDosen) {
      if (prodiId && prodiId !== "ALL" && userProdiIds.includes(prodiId)) {
        targetProdiId = prodiId;
      } else {
        targetProdiId = userProdiIds[0];
      }
    }

    // Ambil data rapor dosen dari Server Action
    const res = await getRaporDosenList({
      semesterId,
      prodiId: targetProdiId,
      status,
      search: searchQuery,
    });

    if (!res.success || !res.data) {
      return NextResponse.json(
        { error: res.error || "Gagal memuat data rapor dosen" },
        { status: 500 }
      );
    }

    const { items, summary, currentSemester, prodiList } = res.data;

    // Filter Prodi Label
    const selectedProdiObj =
      targetProdiId && targetProdiId !== "ALL"
        ? prodiList.find((p) => p.id === targetProdiId)
        : undefined;

    // Filter status tambahan jika ada (memastikan 100% konsisten)
    let filteredItems = items.filter((item) => {
      if (status !== "ALL" && item.statusRapor !== status) return false;
      return true;
    });

    // Sorting data sesuai pilihan di UI
    filteredItems.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortField) {
        case "nama":
          valA = a.dosenNama.toLowerCase();
          valB = b.dosenNama.toLowerCase();
          break;
        case "prodi":
          valA = a.prodiNama.toLowerCase();
          valB = b.prodiNama.toLowerCase();
          break;
        case "matakuliah":
          valA = a.mataKuliahList?.length || 0;
          valB = b.mataKuliahList?.length || 0;
          break;
        case "kelas":
          valA = a.totalKelas;
          valB = b.totalKelas;
          break;
        case "kuesioner":
          valA = a.nilaiKuesioner ?? -1;
          valB = b.nilaiKuesioner ?? -1;
          break;
        case "kehadiran":
          valA = a.rerataSesiHadir ?? -1;
          valB = b.rerataSesiHadir ?? -1;
          break;
        case "konten":
          valA = a.persenKonten ?? -1;
          valB = b.persenKonten ?? -1;
          break;
        case "tridharma":
          valA = (a.jumlahPenelitian || 0) + (a.jumlahPengabdian || 0);
          valB = (b.jumlahPenelitian || 0) + (b.jumlahPengabdian || 0);
          break;
        case "nilaiAkhir":
          valA = a.nilaiAkhir ?? -1;
          valB = b.nilaiAkhir ?? -1;
          break;
        case "status":
          valA = a.statusRapor;
          valB = b.statusRapor;
          break;
        default:
          valA = a.dosenNama.toLowerCase();
          valB = b.dosenNama.toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    // Susun ringkasan teks filter aktif
    const filterInfoParts: string[] = [];
    if (selectedProdiObj) {
      filterInfoParts.push(`Prodi: ${selectedProdiObj.nama}`);
    } else {
      filterInfoParts.push("Prodi: Semua Program Studi");
    }

    if (status !== "ALL") {
      const statusLabels: Record<string, string> = {
        FINAL: "Status: Final (Terverifikasi)",
        DRAFT: "Status: Draft (Peninjauan)",
        BELUM_DIBUAT: "Status: Belum Dibuat",
      };
      filterInfoParts.push(statusLabels[status] || `Status: ${status}`);
    }

    if (searchQuery) {
      filterInfoParts.push(`Pencarian: "${searchQuery}"`);
    }

    // Inisialisasi Workbook ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CDU Nusa Putra University - QAU";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Rapor Tridharma Dosen", {
      views: [{ showGridLines: true }],
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. KOP RESMI DOKUMEN (Row 1 - 4)
    // ─────────────────────────────────────────────────────────────────────────
    // Row 1: Header Institusi
    worksheet.mergeCells("A1:O1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "UNIVERSITAS NUSA PUTRA - QUALITY ASSURANCE UNIT (QAU) & CDU";
    titleCell.font = { name: "Rockwell", size: 12.5, bold: true, color: { argb: "FFA80063" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 25;

    // Row 2: Judul Laporan
    worksheet.mergeCells("A2:O2");
    const subtitleCell = worksheet.getCell("A2");
    const prodiTitle = selectedProdiObj ? ` - PROGRAM STUDI ${selectedProdiObj.nama.toUpperCase()}` : "";
    subtitleCell.value = `LAPORAN EVALUASI & REKAPITULASI RAPOR MUTU TRIDHARMA DOSEN${prodiTitle} - SEMESTER ${
      currentSemester ? `${currentSemester.tahunAkademik} (${currentSemester.periode})` : "AKTIF"
    }`;
    subtitleCell.font = { name: "Rockwell", size: 10.5, bold: true, color: { argb: "FF334155" } };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 20;

    // Row 3: Meta Info (Tanggal Cetak, Total Dosen, Filter)
    worksheet.mergeCells("A3:O3");
    const dateCell = worksheet.getCell("A3");
    const avgScoreLabel =
      summary?.avgNilaiAkhir != null ? ` | Rata-rata Nilai: ${summary.avgNilaiAkhir.toFixed(2)}` : "";
    dateCell.value = `Tanggal Unduh: ${new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })} | Total: ${filteredItems.length} Dosen (Final: ${summary.totalFinal}, Draft: ${summary.totalDraft}, Belum: ${summary.totalBelumDibuat})${avgScoreLabel} | ${filterInfoParts.join(" • ")}`;
    dateCell.font = { name: "Rockwell", size: 8.5, italic: true, color: { argb: "FF64748B" } };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(3).height = 18;

    // Row 4: Legenda Standar Penilaian Mutu Tridharma
    worksheet.mergeCells("A4:O4");
    const legendCell = worksheet.getCell("A4");
    legendCell.value =
      "STANDAR PREDIKAT MUTU: Sangat Baik (≥4.50, Penelitian & PkM ≥2 Keg) • Baik (4.12–4.57, P&P 2 Keg) • Cukup (3.66–4.11, P&P 1 Keg) • Kurang Baik (3.20–3.65, P&P 0 Keg) • Belum Lengkap";
    legendCell.font = { name: "Rockwell", size: 8, color: { argb: "FF475569" } };
    legendCell.alignment = { horizontal: "center", vertical: "middle" };
    legendCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFC" },
    };
    legendCell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    worksheet.getRow(4).height = 19;

    // Row 5: Spacer Kosong
    worksheet.addRow([]);
    worksheet.getRow(5).height = 8;

    // ─────────────────────────────────────────────────────────────────────────
    // 2. HEADER TABEL (Row 6)
    // ─────────────────────────────────────────────────────────────────────────
    const headers = [
      "No",
      "Nama Dosen",
      "NIP / NIDN",
      "Program Studi",
      "Jml Matkul",
      "Jml Kelas",
      "Total SKS",
      "Kuesioner Mhs",
      "Kehadiran Mengajar",
      "Konten (3P)",
      "Penelitian",
      "Pengabdian (PkM)",
      "Nilai Akhir",
      "Predikat Mutu",
      "Status Validasi",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFA80063" }, // Merah Khas CDU Portal
      };
      cell.font = { name: "Rockwell", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "medium", color: { argb: "FF555555" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. DATA ROWS (Row 7 dst)
    // ─────────────────────────────────────────────────────────────────────────

    filteredItems.forEach((item, idx) => {
      const isOdd = idx % 2 === 1;

      // NIP / NIDN
      const nipNidn = item.nip
        ? `${item.nip}`
        : item.nidn
        ? `${item.nidn}`
        : "-";

      // Kuesioner
      const kuesionerStr =
        item.nilaiKuesioner != null
          ? `${item.nilaiKuesioner.toFixed(2)}${
              item.totalResponden != null ? ` (${item.totalResponden} Mhs)` : ""
            }`
          : "-";

      // Kehadiran
      const kehadiranStr =
        item.totalSesiHadir != null && item.totalSesiBeban != null
          ? `${item.totalSesiHadir}/${item.totalSesiBeban} Sesi${
              item.persenKehadiran != null ? ` (${item.persenKehadiran.toFixed(1)}%)` : ""
            }`
          : "-";

      // Konten LMS
      const kontenStr =
        item.totalSkorKonten != null && item.maxSkorKonten != null
          ? `${item.totalSkorKonten}/${item.maxSkorKonten} Poin${
              item.persenKonten != null ? ` (${item.persenKonten.toFixed(1)}%)` : ""
            }`
          : "-";

      // Penelitian & PkM
      const penelitianStr = `${item.jumlahPenelitian || 0} Kegiatan`;
      const pengabdianStr = `${item.jumlahPengabdian || 0} Kegiatan`;

      // Nilai Akhir
      const nilaiAkhirStr = item.nilaiAkhir != null ? item.nilaiAkhir.toFixed(2) : "-";

      // Predikat Mutu
      const predikatStr = item.predikatLabel || "Belum Lengkap";

      // Status Validasi
      const statusLabel =
        item.statusRapor === "FINAL"
          ? "FINAL"
          : item.statusRapor === "DRAFT"
          ? "DRAFT"
          : "BELUM DIBUAT";


      const rowValues = [
        idx + 1,
        item.dosenNama,
        nipNidn,
        item.prodiNama,
        item.mataKuliahList?.length || 0,
        item.totalKelas || 0,
        item.totalSks || 0,
        kuesionerStr,
        kehadiranStr,
        kontenStr,
        penelitianStr,
        pengabdianStr,
        nilaiAkhirStr,
        predikatStr,
        statusLabel,
      ];

      const row = worksheet.addRow(rowValues);
      row.height = 22;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Rockwell", size: 8.5 };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        // Zebra stripe rows
        if (isOdd) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }

        // Alignments
        if (colNumber === 1 || colNumber === 3 || (colNumber >= 5 && colNumber <= 15)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }

        // Col 2: Nama Dosen (Diperbesar & Semibold, bukan bold pekat)
        if (colNumber === 2) {
          cell.font = { name: "Rockwell", size: 9.5, bold: false, color: { argb: "FF0F172A" } };
        }

        // Col 8: Kuesioner
        if (colNumber === 8 && item.nilaiKuesioner != null) {
          cell.font = { name: "Rockwell", size: 8.5, bold: true, color: { argb: "FF0F172A" } };
        }

        // Col 9: Kehadiran Mengajar
        if (colNumber === 9 && item.persenKehadiran != null) {
          cell.font = { name: "Rockwell", size: 8.5, bold: true, color: { argb: "FF047857" } };
        }

        // Col 10: Konten (3P)
        if (colNumber === 10 && item.persenKonten != null) {
          cell.font = { name: "Rockwell", size: 8.5, bold: true, color: { argb: "FFA80063" } };
        }

        // Col 13: Nilai Akhir
        if (colNumber === 13 && item.nilaiAkhir != null) {
          cell.font = { name: "Rockwell", size: 9, bold: true, color: { argb: "FFA80063" } };
        }

        // Col 14: Predikat Mutu
        if (colNumber === 14) {
          if (item.predikat === "SANGAT_BAIK") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
            cell.font = { name: "Rockwell", size: 8.5, bold: true, color: { argb: "FF047857" } };
          } else if (item.predikat === "BAIK") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
            cell.font = { name: "Rockwell", size: 8.5, bold: true, color: { argb: "FF1D4ED8" } };
          } else if (item.predikat === "CUKUP") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
            cell.font = { name: "Rockwell", size: 8.5, bold: true, color: { argb: "FFB45309" } };
          } else if (item.predikat === "KURANG_BAIK") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
            cell.font = { name: "Rockwell", size: 8.5, bold: true, color: { argb: "FFB91C1C" } };
          } else {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
            cell.font = { name: "Rockwell", size: 8.5, italic: true, color: { argb: "FF64748B" } };
          }
        }

        // Col 15: Status Validasi
        if (colNumber === 15) {
          if (item.statusRapor === "FINAL") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
            cell.font = { name: "Rockwell", size: 8.5, bold: true, color: { argb: "FF047857" } };
          } else if (item.statusRapor === "DRAFT") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
            cell.font = { name: "Rockwell", size: 8.5, bold: true, color: { argb: "FFB45309" } };
          } else {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
            cell.font = { name: "Rockwell", size: 8, bold: true, color: { argb: "FFE11D48" } };
          }
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. LEBAR KOLOM (COLUMN WIDTHS)
    // ─────────────────────────────────────────────────────────────────────────
    worksheet.getColumn(1).width = 5; // No
    worksheet.getColumn(2).width = 36; // Nama Dosen (Diperbesar)
    worksheet.getColumn(3).width = 18; // NIP / NIDN
    worksheet.getColumn(4).width = 24; // Program Studi
    worksheet.getColumn(5).width = 11; // Jml Matkul
    worksheet.getColumn(6).width = 11; // Jml Kelas
    worksheet.getColumn(7).width = 11; // Total SKS
    worksheet.getColumn(8).width = 18; // Kuesioner Mhs
    worksheet.getColumn(9).width = 22; // Kehadiran Mengajar
    worksheet.getColumn(10).width = 22; // Konten (3P)
    worksheet.getColumn(11).width = 14; // Penelitian
    worksheet.getColumn(12).width = 17; // Pengabdian (PkM)
    worksheet.getColumn(13).width = 13; // Nilai Akhir
    worksheet.getColumn(14).width = 17; // Predikat Mutu
    worksheet.getColumn(15).width = 16; // Status Validasi

    // ─────────────────────────────────────────────────────────────────────────
    // 5. GENERATE BUFFER & RETURN RESPONSE
    // ─────────────────────────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();

    // Penamaan file yang bersih dan representatif
    const cleanProdi = selectedProdiObj
      ? `_${selectedProdiObj.nama.replace(/[^a-zA-Z0-9]/g, "_")}`
      : "_Semua_Prodi";
    const cleanTahun = (currentSemester?.tahunAkademik || "2026-2027").replace(/\//g, "-");
    const cleanPeriode = (currentSemester?.periode || "Ganjil").replace(/[^a-zA-Z0-9]/g, "");
    const filename = `Rapor_Tridharma_Dosen_CDU${cleanProdi}_${cleanTahun}_${cleanPeriode}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Excel export error (rapor-dosen):", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat file Excel Rapor Dosen" },
      { status: 500 }
    );
  }
}
