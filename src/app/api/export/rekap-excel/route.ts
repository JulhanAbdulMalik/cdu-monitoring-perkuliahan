// src/app/api/export/rekap-excel/route.ts
// ExcelJS Export API Route for CDU Monitoring Rekapitulasi (3-Pillar & Conference Quota)

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getRekapLaporan } from "@/actions/laporan";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get("semesterId") || undefined;
    const prodiId = searchParams.get("prodiId") || undefined;

    const res = await getRekapLaporan(semesterId, prodiId);
    if (!res.success || !res.data) {
      return NextResponse.json({ error: "Gagal memuat data rekap" }, { status: 500 });
    }

    const { rekapList, semesters, activeSemesterId } = res.data;
    const currentSem =
      semesters.find((s) => s.id === (semesterId || activeSemesterId)) || semesters[0];

    // Buat Workbook ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CDU Nusa Putra University";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Rekapitulasi 3 Pilar", {
      views: [{ showGridLines: true }],
    });

    // ── 1. Title Header ──────────────────────────────────────────────────────
    worksheet.mergeCells("A1:Y1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "UNIVERSITAS NUSA PUTRA — CURRICULUM DEVELOPMENT UNIT (CDU)";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFA80063" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 26;

    worksheet.mergeCells("A2:Y2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value = `LAPORAN REKAPITULASI MONITORING PERKULIAHAN (3 PILAR) — SEMESTER ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : ""
    }`;
    subtitleCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 20;

    worksheet.mergeCells("A3:Y3");
    const dateCell = worksheet.getCell("A3");
    dateCell.value = `Tanggal Cetak: ${new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
    dateCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(3).height = 18;

    worksheet.addRow([]); // Blank row 4

    // ── 2. Table Column Headers (Row 5) ──────────────────────────────────────
    const headers = [
      "No",
      "Kode Kelas",
      "Mode",
      "Program Studi",
      "Mata Kuliah",
      "SKS",
      "Dosen Pengampu",
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8 (UTS)",
      "S9",
      "S10",
      "S11",
      "S12",
      "S13",
      "S14",
      "S15",
      "S16 (UAS)",
      "Total Hadir",
      "% Hadir",
      "Skor 3 Pilar",
      "% Konten",
      "Live Conf (UTS/UAS)",
      "Status Evaluasi",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFA80063" }, // Brand Magenta
      };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "medium", color: { argb: "FF555555" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    // ── 3. Data Rows ─────────────────────────────────────────────────────────
    rekapList.forEach((cls, idx) => {
      const sesiValues = cls.sesi.map((s) => {
        if (s.kehadiran === "HADIR") {
          return s.contentScore !== null ? `H (${s.contentScore})` : "H (UTS/UAS)";
        }
        if (s.kehadiran === "HADIR_TIDAK_LENGKAP" || s.kehadiran === "HADIR_TDK_LENGKAP") {
          return s.contentScore !== null ? `HTL (${s.contentScore})` : "HTL";
        }
        if (s.kehadiran === "TIDAK_HADIR" || s.kehadiran === "ALPHA") return "A (0)";
        return "—";
      });

      const rowValues = [
        idx + 1,
        cls.kodeKelas,
        cls.modePembelajaran === "LURING" ? "Offline" : "Online",
        cls.mataKuliah.prodi.nama,
        cls.mataKuliah.nama,
        cls.mataKuliah.sks,
        cls.dosen.nama,
        ...sesiValues,
        `${cls.totalHadir}/16`,
        `${cls.persenKehadiran}%`,
        `${cls.totalSkor3Pilar}/42`,
        `${cls.persenKonten}%`,
        `UTS: ${cls.confPraUTS}/3 | UAS: ${cls.confPraUAS}/3`,
        cls.statusEvaluasi === "MEMENUHI"
          ? "Memenuhi Syarat"
          : cls.statusEvaluasi === "CUKUP"
          ? "Cukup"
          : "Perlu Perhatian",
      ];

      const row = worksheet.addRow(rowValues);
      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Arial", size: 9 };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        // Alignments
        if (colNumber === 1 || colNumber === 3 || colNumber === 6 || (colNumber >= 8 && colNumber <= 28)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }

        // Color coding for session cells (Col 8 to 23)
        if (colNumber >= 8 && colNumber <= 23) {
          const val = String(cell.value || "");
          if (val.startsWith("H")) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFECFDF5" }, // Light Emerald
            };
            cell.font = { name: "Arial", size: 8.5, color: { argb: "FF047857" }, bold: true };
          } else if (val.startsWith("HTL")) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFFBEB" }, // Light Amber
            };
            cell.font = { name: "Arial", size: 8.5, color: { argb: "FFB45309" }, bold: true };
          } else if (val.startsWith("A")) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFEF2F2" }, // Light Rose
            };
            cell.font = { name: "Arial", size: 8.5, color: { argb: "FFB91C1C" }, bold: true };
          }
        }

        // Color coding for Status Evaluasi (Column 29)
        if (colNumber === 29) {
          if (cls.statusEvaluasi === "MEMENUHI") {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF047857" } };
          } else if (cls.statusEvaluasi === "CUKUP") {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB45309" } };
          } else {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB91C1C" } };
          }
        }
      });
    });

    // Adjust column widths
    worksheet.getColumn(1).width = 5; // No
    worksheet.getColumn(2).width = 12; // Kode Kelas
    worksheet.getColumn(3).width = 10; // Mode
    worksheet.getColumn(4).width = 22; // Prodi
    worksheet.getColumn(5).width = 28; // Mata Kuliah
    worksheet.getColumn(6).width = 6; // SKS
    worksheet.getColumn(7).width = 26; // Dosen
    for (let c = 8; c <= 23; c++) {
      worksheet.getColumn(c).width = 9; // Sesi 1-16
    }
    worksheet.getColumn(24).width = 12; // Total Hadir
    worksheet.getColumn(25).width = 10; // % Hadir
    worksheet.getColumn(26).width = 13; // Skor 3 Pilar (Max 42)
    worksheet.getColumn(27).width = 10; // % Konten
    worksheet.getColumn(28).width = 20; // Live Conf
    worksheet.getColumn(29).width = 16; // Status

    // Return as downloadable Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Rekap_Monitoring_3Pilar_CDU_${
          currentSem ? currentSem.tahunAkademik.replace("/", "-") : "2025-2026"
        }.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Excel export error:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat file Excel" }, { status: 500 });
  }
}
