// src/app/api/export/master-dosen-excel/route.ts
// Export Data Master Dosen ke format Excel (.xlsx) dengan ExcelJS
// Styling seiras dengan Laporan Rekapitulasi Sesi (Font Rockwell, Banner CDU, Brand Maroon)
// Terurut A-Z berdasarkan Nama Lengkap & Gelar tanpa kolom 'Kelas Diampu'

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const prodiId = searchParams.get("prodiId") || "ALL";
    const search = searchParams.get("search") || "";

    // Filter query
    const whereClause: any = {};

    if (prodiId && prodiId !== "ALL") {
      whereClause.prodiId = prodiId;
    }

    if (search.trim()) {
      whereClause.OR = [
        { nama: { contains: search.trim(), mode: "insensitive" } },
        { nidn: { contains: search.trim() } },
        { nuptk: { contains: search.trim() } },
      ];
    }

    // Ambil info prodi terpilih jika ada filter spesifik
    let selectedProdiNama = "Semua Program Studi";
    let selectedProdiKode = "SEMUA";
    if (prodiId && prodiId !== "ALL") {
      const p = await prisma.prodi.findUnique({ where: { id: prodiId } });
      if (p) {
        selectedProdiNama = `${p.kode} - ${p.nama}`;
        selectedProdiKode = p.kode;
      }
    }

    // Ambil data dosen langsung diurutkan A-Z berdasarkan Nama Lengkap
    const rawDosenList = await prisma.dosen.findMany({
      where: whereClause,
      include: {
        prodi: true,
      },
      orderBy: {
        nama: "asc",
      },
    });

    // Pastikan pengurutan A-Z akurat dengan localeCompare Indonesia
    const dosenList = [...rawDosenList].sort((a, b) =>
      a.nama.localeCompare(b.nama, "id", { sensitivity: "base" })
    );

    // Inisialisasi Workbook ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CDU Nusa Putra University";
    workbook.lastModifiedBy = session.user.name || "CDU Portal";
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheetName =
      selectedProdiKode === "SEMUA"
        ? "Master Dosen"
        : `Dosen ${selectedProdiKode}`.substring(0, 31);

    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
      pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 },
    });

    // ── STYLES STANDAR CDU (IDENTIK DENGAN REKAPITULASI 3 PILAR) ────────────
    const BRAND_MAGENTA = "FFA80063";
    const SLATE_DARK = "FF334155";
    const SLATE_MUTED = "FF64748B";
    const SLATE_LIGHT = "FFF8FAFC";
    const BORDER_COLOR = "FFE2E8F0";

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: BORDER_COLOR } },
      left: { style: "thin", color: { argb: BORDER_COLOR } },
      bottom: { style: "thin", color: { argb: BORDER_COLOR } },
      right: { style: "thin", color: { argb: BORDER_COLOR } },
    };

    // ── 1. TITLE HEADER (Row 1) ─────────────────────────────────────────────
    worksheet.mergeCells("A1:F1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    titleCell.font = { name: "Rockwell", size: 14, bold: true, color: { argb: BRAND_MAGENTA } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 26;

    // ── 2. SUBTITLE (Row 2) ─────────────────────────────────────────────────
    worksheet.mergeCells("A2:F2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value =
      selectedProdiKode === "SEMUA"
        ? "DATA MASTER DOSEN & HOMEBASE PROGRAM STUDI"
        : `DATA MASTER DOSEN - PRODI ${selectedProdiNama.toUpperCase()}`;
    subtitleCell.font = { name: "Rockwell", size: 11, bold: true, color: { argb: SLATE_DARK } };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 20;

    // ── 3. DATE & FILTER INFO (Row 3) ───────────────────────────────────────
    worksheet.mergeCells("A3:F3");
    const todayStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const dateCell = worksheet.getCell("A3");
    dateCell.value = `Tanggal Cetak: ${todayStr}   |   Filter Homebase: ${selectedProdiNama}   |   Total Data: ${dosenList.length} Dosen (Urut A-Z)`;
    dateCell.font = { name: "Rockwell", size: 9, italic: true, color: { argb: SLATE_MUTED } };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(3).height = 18;

    // ── 4. PETUNJUK BAR (Row 4) ─────────────────────────────────────────────
    worksheet.mergeCells("A4:F4");
    const legendCell = worksheet.getCell("A4");
    legendCell.value =
      "PETUNJUK: Kolom 'Nama Lengkap & Gelar', 'NIDN', 'NUPTK', dan 'Kode Prodi' dapat diedit dan diunggah kembali melalui fitur Import Excel Dosen.";
    legendCell.font = { name: "Rockwell", size: 8.5, color: { argb: "FF475569" } };
    legendCell.alignment = { horizontal: "center", vertical: "middle" };
    legendCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: SLATE_LIGHT },
    };
    legendCell.border = thinBorder;
    worksheet.getRow(4).height = 20;

    // Row 5: Blank Row
    worksheet.addRow([]);
    worksheet.getRow(5).height = 10;

    // ── 5. TABLE COLUMN HEADERS (Row 6) ─────────────────────────────────────
    const headers = [
      "No",
      "Nama Lengkap & Gelar",
      "NIDN",
      "NUPTK",
      "Kode Prodi",
      "Homebase Program Studi",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_MAGENTA },
      };
      cell.font = { name: "Rockwell", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "medium", color: { argb: "FF555555" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    // ── 6. DATA ROWS (Row 7+) ───────────────────────────────────────────────
    dosenList.forEach((d, idx) => {
      const rowValues = [
        idx + 1,
        d.nama,
        d.nidn || "",
        d.nuptk || "",
        d.prodi.kode,
        d.prodi.nama,
      ];

      const row = worksheet.addRow(rowValues);
      row.height = 22;

      const isEven = idx % 2 === 1;
      const bgArgb = isEven ? SLATE_LIGHT : "FFFFFFFF";

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Rockwell", size: 9 };
        cell.border = thinBorder;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgArgb },
        };

        // Alignments & Styles per Kolom
        if (colNumber === 1) {
          // No
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.font = { name: "Rockwell", size: 9, color: { argb: SLATE_MUTED } };
        } else if (colNumber === 2) {
          // Nama Lengkap & Gelar (Regular, Dark)
          cell.alignment = { horizontal: "left", vertical: "middle" };
          cell.font = { name: "Rockwell", size: 9, color: { argb: "FF0F172A" } };
        } else if (colNumber === 3) {
          // NIDN (Text format "@" agar leading zero tidak hilang)
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.numFmt = "@";
          cell.font = { name: "Rockwell", size: 9, color: { argb: SLATE_DARK } };
        } else if (colNumber === 4) {
          // NUPTK (Text format "@" agar leading zero tidak hilang)
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.numFmt = "@";
          cell.font = { name: "Rockwell", size: 9, color: { argb: SLATE_DARK } };
        } else if (colNumber === 5) {
          // Kode Prodi (Bold Magenta Brand)
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.numFmt = "@";
          cell.font = { name: "Rockwell", size: 9, bold: true, color: { argb: BRAND_MAGENTA } };
        } else if (colNumber === 6) {
          // Homebase Program Studi
          cell.alignment = { horizontal: "left", vertical: "middle" };
          cell.font = { name: "Rockwell", size: 9, color: { argb: SLATE_DARK } };
        }
      });
    });

    // ── 7. COLUMN WIDTHS ────────────────────────────────────────────────────
    worksheet.columns = [
      { width: 6 },  // A: No
      { width: 46 }, // B: Nama Lengkap & Gelar
      { width: 18 }, // C: NIDN
      { width: 20 }, // D: NUPTK
      { width: 14 }, // E: Kode Prodi
      { width: 36 }, // F: Homebase Program Studi
    ];

    // Buat Buffer & Kirim Response
    const buffer = await workbook.xlsx.writeBuffer();
    const cleanKode = selectedProdiKode.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Master_Dosen_${cleanKode}_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Export master dosen error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengexport data master dosen" },
      { status: 500 }
    );
  }
}
