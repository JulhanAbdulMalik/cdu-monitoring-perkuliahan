// src/app/api/export/dosen-excel/route.ts
// ExcelJS Export API Route for CDU Laporan Evaluasi Kinerja Dosen
// Includes Summary Sheet (Agregasi Kinerja) & Detailed Sheet (Rincian Kelas per Dosen)

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getLaporanDosen } from "@/actions/laporan";
import { formatPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get("semesterId") || undefined;

    const res = await getLaporanDosen(semesterId);
    if (!res.success || !res.data) {
      return NextResponse.json({ error: "Gagal memuat data laporan dosen" }, { status: 500 });
    }

    const { dosenReportList, semesters, activeSemesterId } = res.data;
    const currentSem =
      semesters.find((s) => s.id === (semesterId || activeSemesterId)) || semesters[0];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CDU Nusa Putra University";
    workbook.created = new Date();

    // ═════════════════════════════════════════════════════════════════════════
    // SHEET 1: RINGKASAN EVALUASI KINERJA DOSEN
    // ═════════════════════════════════════════════════════════════════════════
    const worksheet = workbook.addWorksheet("Kinerja Dosen", {
      views: [{ showGridLines: true }],
    });

    // Title Header
    worksheet.mergeCells("A1:K1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFA80063" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 25;

    worksheet.mergeCells("A2:K2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value = `LAPORAN EVALUASI KINERJA DOSEN - SEMESTER ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : "AKTIF"
    }`;
    subtitleCell.font = { name: "Arial", size: 10.5, bold: true, color: { argb: "FF334155" } };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 20;

    worksheet.mergeCells("A3:K3");
    const dateCell = worksheet.getCell("A3");
    dateCell.value = `Tanggal Cetak: ${new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })} | Total Dosen: ${dosenReportList.length}`;
    dateCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(3).height = 18;

    // Legenda Bar (Row 4)
    worksheet.mergeCells("A4:K4");
    const legendCell = worksheet.getCell("A4");
    legendCell.value =
      "STANDAR KINERJA CDU: Sangat Baik (≥90% Kehadiran & Konten)  •  Baik (75%–89%)  •  Perlu Pembinaan (<75% Kehadiran atau <60% Konten atau ≥4 Alpha)  |  *Kelas Bimbingan Bebas Kewajiban Konten 3 Pilar";
    legendCell.font = { name: "Arial", size: 8.5, color: { argb: "FF475569" } };
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
    worksheet.getRow(4).height = 20;

    worksheet.addRow([]); // Blank row 5

    // Table Column Headers (Row 6)
    const headers = [
      "No",
      "NIDN",
      "Nama Dosen",
      "Program Studi",
      "Total Kelas",
      "Beban Sesi",
      "Total Hadir",
      "Total Alpha",
      "Rata-rata Kehadiran",
      "Rata-rata Konten",
      "Status Evaluasi",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFA80063" },
      };
      cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "medium", color: { argb: "FF555555" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    // Data Rows
    dosenReportList.forEach((d, idx) => {
      const isBebas = d.avgKonten === null;
      const statusLabel =
        d.status === "SANGAT_BAIK"
          ? "Sangat Baik"
          : d.status === "BAIK"
          ? "Baik"
          : "Perlu Pembinaan";

      const rowValues = [
        idx + 1,
        d.nidn || "-",
        d.nama,
        `${d.prodi.kode} - ${d.prodi.nama}`,
        d.totalKelas,
        d.totalSesiBebanSemua,
        d.totalHadirSemua,
        d.totalAlphaSemua,
        formatPct(d.avgKehadiran),
        isBebas ? "Bebas" : formatPct(d.avgKonten),
        statusLabel,
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
        if (colNumber === 1 || colNumber === 2 || (colNumber >= 5 && colNumber <= 11)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }

        // Rata-rata Kehadiran (Col 9)
        if (colNumber === 9) {
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF047857" } };
        }

        // Rata-rata Konten (Col 10)
        if (colNumber === 10) {
          if (isBebas) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF3E8FF" },
            };
            cell.font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FF6B21A8" } };
          } else {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFA80063" } };
          }
        }

        // Status Evaluasi (Col 11)
        if (colNumber === 11) {
          if (d.status === "SANGAT_BAIK") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFECFDF5" },
            };
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF047857" } };
          } else if (d.status === "BAIK") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFEFF6FF" },
            };
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF1D4ED8" } };
          } else {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFEF2F2" },
            };
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB91C1C" } };
          }
        }
      });
    });

    // Column widths Sheet 1
    worksheet.getColumn(1).width = 5; // No
    worksheet.getColumn(2).width = 14; // NIDN
    worksheet.getColumn(3).width = 30; // Nama Dosen
    worksheet.getColumn(4).width = 24; // Program Studi
    worksheet.getColumn(5).width = 12; // Total Kelas
    worksheet.getColumn(6).width = 12; // Beban Sesi
    worksheet.getColumn(7).width = 12; // Hadir
    worksheet.getColumn(8).width = 12; // Alpha
    worksheet.getColumn(9).width = 20; // Rata Kehadiran
    worksheet.getColumn(10).width = 18; // Rata Konten
    worksheet.getColumn(11).width = 18; // Status Evaluasi

    // ═════════════════════════════════════════════════════════════════════════
    // SHEET 2: RINCIAN KELAS PER DOSEN
    // ═════════════════════════════════════════════════════════════════════════
    const detailSheet = workbook.addWorksheet("Rincian Kelas per Dosen", {
      views: [{ showGridLines: true }],
    });

    detailSheet.mergeCells("A1:N1");
    const detailTitle = detailSheet.getCell("A1");
    detailTitle.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    detailTitle.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFA80063" } };
    detailTitle.alignment = { horizontal: "center", vertical: "middle" };
    detailSheet.getRow(1).height = 25;

    detailSheet.mergeCells("A2:N2");
    const detailSubtitle = detailSheet.getCell("A2");
    detailSubtitle.value = `RINCIAN PERFORMA KELAS PER DOSEN PENGAMPU - SEMESTER ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : "AKTIF"
    }`;
    detailSubtitle.font = { name: "Arial", size: 10.5, bold: true, color: { argb: "FF334155" } };
    detailSubtitle.alignment = { horizontal: "center", vertical: "middle" };
    detailSheet.getRow(2).height = 20;

    detailSheet.mergeCells("A3:N3");
    const detailDate = detailSheet.getCell("A3");
    detailDate.value = `Tanggal Cetak: ${new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
    detailDate.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    detailDate.alignment = { horizontal: "center", vertical: "middle" };
    detailSheet.getRow(3).height = 18;

    detailSheet.addRow([]); // Blank row 4

    const detailHeaders = [
      "No",
      "NIDN",
      "Nama Dosen",
      "Program Studi",
      "Kode Kelas",
      "Mata Kuliah",
      "SKS",
      "Mode",
      "Status Penugasan",
      "Sesi Hadir",
      "% Kehadiran",
      "Skor Konten",
      "% Konten",
      "Status Evaluasi",
    ];

    const detailHeaderRow = detailSheet.addRow(detailHeaders);
    detailHeaderRow.height = 26;
    detailHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFA80063" },
      };
      cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "medium", color: { argb: "FF555555" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    let detailCounter = 1;
    dosenReportList.forEach((d) => {
      d.kelasList.forEach((cls) => {
        const isBimbingan = cls.modePembelajaran === "BIMBINGAN";
        const modeLabel = isBimbingan ? "Bimbingan" : cls.modePembelajaran === "LURING" ? "Offline" : "Online";
        const evalLabel =
          cls.statusEvaluasi === "MEMENUHI"
            ? "Memenuhi"
            : cls.statusEvaluasi === "CUKUP"
            ? "Cukup"
            : "Perhatian";

        const rowValues = [
          detailCounter++,
          d.nidn || "-",
          d.nama,
          `${d.prodi.kode} - ${d.prodi.nama}`,
          cls.kodeKelas,
          cls.mataKuliah.nama,
          cls.mataKuliah.sks,
          modeLabel,
          cls.statusPenugasan || "Penuh",
          `${cls.totalHadir}/${cls.totalSesiBeban ?? 16}`,
          formatPct(cls.persenKehadiran),
          isBimbingan ? "Bebas" : `${cls.totalSkorKonten}/${cls.maxSkorKonten ?? 42}`,
          isBimbingan ? "-" : formatPct(cls.persenKonten),
          evalLabel,
        ];

        const row = detailSheet.addRow(rowValues);
        row.height = 20;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Arial", size: 9 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (
            colNumber === 1 ||
            colNumber === 2 ||
            colNumber === 5 ||
            colNumber === 7 ||
            colNumber === 8 ||
            (colNumber >= 10 && colNumber <= 14)
          ) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }

          // % Kehadiran (Col 11)
          if (colNumber === 11) {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF047857" } };
          }

          // Skor & % Konten (Col 12 & 13)
          if (colNumber === 12 || colNumber === 13) {
            if (isBimbingan) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF3E8FF" },
              };
              cell.font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FF6B21A8" } };
            } else {
              cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFA80063" } };
            }
          }

          // Status Evaluasi (Col 14)
          if (colNumber === 14) {
            if (cls.statusEvaluasi === "MEMENUHI") {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFECFDF5" },
              };
              cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF047857" } };
            } else if (cls.statusEvaluasi === "CUKUP") {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFFBEB" },
              };
              cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB45309" } };
            } else {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFEF2F2" },
              };
              cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB91C1C" } };
            }
          }
        });
      });
    });

    // Column widths Sheet 2
    detailSheet.getColumn(1).width = 5; // No
    detailSheet.getColumn(2).width = 14; // NIDN
    detailSheet.getColumn(3).width = 28; // Nama Dosen
    detailSheet.getColumn(4).width = 22; // Program Studi
    detailSheet.getColumn(5).width = 12; // Kode Kelas
    detailSheet.getColumn(6).width = 28; // Mata Kuliah
    detailSheet.getColumn(7).width = 6; // SKS
    detailSheet.getColumn(8).width = 11; // Mode
    detailSheet.getColumn(9).width = 22; // Penugasan
    detailSheet.getColumn(10).width = 12; // Sesi Hadir
    detailSheet.getColumn(11).width = 12; // % Kehadiran
    detailSheet.getColumn(12).width = 14; // Skor Konten
    detailSheet.getColumn(13).width = 12; // % Konten
    detailSheet.getColumn(14).width = 14; // Status

    // Return as downloadable Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Laporan_Evaluasi_Kinerja_Dosen_CDU_${
          currentSem ? currentSem.tahunAkademik.replace("/", "-") : "2025-2026"
        }.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Excel export error (dosen):", error);
    return NextResponse.json({ error: error.message || "Gagal membuat file Excel" }, { status: 500 });
  }
}
