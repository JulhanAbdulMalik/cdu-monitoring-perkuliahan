import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getLaporanProdi } from "@/actions/laporan";
import { getWeekDates, formatTanggalRange, formatPct } from "@/lib/utils";
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
    const allowedProdiIds = isDosen ? userProdiIds : undefined;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const semesterId = searchParams.get("semesterId") || undefined;
    const isAllTime = !startDate && !endDate;

    const res = await getLaporanProdi(semesterId, startDate, endDate, allowedProdiIds);
    if (!res.success || !res.data) {
      return NextResponse.json({ error: "Gagal memuat data laporan prodi" }, { status: 500 });
    }

    const { prodiReportList, semesters, activeSemesterId, globalSummary } = res.data;
    const currentSem =
      semesters.find((s) => s.id === (semesterId || activeSemesterId)) || semesters[0];

    const periodeText = isAllTime ? "SEMUA WAKTU (1 SEMESTER)" : formatTanggalRange(startDate, endDate);

    // Create ExcelJS Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CDU Nusa Putra University";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Laporan Prodi", {
      views: [{ showGridLines: true }],
    });

    // ── 1. Title Header ──────────────────────────────────────────────────────
    worksheet.mergeCells("A1:R1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFA80063" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 25;

    const singleProdi = isDosen && prodiReportList.length === 1 ? prodiReportList[0] : undefined;
    const subtitleProdi = singleProdi ? ` - PRODI ${singleProdi.nama.toUpperCase()}` : "";

    worksheet.mergeCells("A2:R2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value = `LAPORAN PERFORMA PROGRAM STUDI${subtitleProdi} PER PERIODE (${periodeText.toUpperCase()})`;
    subtitleCell.font = { name: "Arial", size: 10.5, bold: true, color: { argb: "FF334155" } };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 20;

    worksheet.mergeCells("A3:R3");
    const semCell = worksheet.getCell("A3");
    const rataLabel = isDosen ? "Rata Kehadiran Prodi" : "Rata Kehadiran Univ";
    semCell.value = `Semester: ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : "Aktif"
    } | Total Sesi: ${globalSummary.totalSesiRentangSemua} | ${rataLabel}: ${formatPct(
      globalSummary.avgKehadiranRentangSemua
    )} | Rata Konten 3P: ${formatPct(globalSummary.avgKontenRentangSemua)} | Live Conf: ${globalSummary.totalConfRentangSemua}`;
    semCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    semCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(3).height = 18;

    worksheet.addRow([]); // Blank row 4

    // ── 2. Table Column Headers (Row 5) ──────────────────────────────────────
    const headers = [
      "No",
      "Kode",
      "Program Studi",
      "Fakultas",
      "Dosen Aktif",
      "Kelas Aktif",
      "Sesi di Periode",
      "Hadir",
      "HTL",
      "Alpha",
      "Belum Diisi",
      "% Hadir (Periode)",
      "Skor 3P",
      "% Konten (Periode)",
      "Live Conf",
      "Status Kinerja",
      "% Hadir (Semester)",
      "% Konten (Semester)",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 25;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFA80063" }, // Brand Magenta
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

    // ── 3. Data Rows ─────────────────────────────────────────────────────────
    prodiReportList.forEach((p, idx) => {
      const rowValues = [
        idx + 1,
        p.kode,
        p.nama,
        p.fakultasNama || "-",
        p.totalDosenAktifRentang,
        p.totalKelasAktifRentang,
        p.totalSesiRentang,
        p.totalHadirRentang,
        p.totalHadirTdkLengkapRentang,
        p.totalAlphaRentang,
        p.totalBelumDiisiRentang,
        formatPct(p.avgKehadiranRentang),
        `${p.totalSkor3PilarRentang}/${p.totalRegularSesiRentang * 3}`,
        formatPct(p.avgKontenRentang),
        p.totalConfRentang,
        p.statusKinerjaRentang === "SANGAT_BAIK"
          ? "Sangat Baik"
          : p.statusKinerjaRentang === "BAIK"
          ? "Baik"
          : "Perlu Pembinaan",
        formatPct(p.avgKehadiranSemester),
        formatPct(p.avgKontenSemester),
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
        if (colNumber === 1 || colNumber === 2 || colNumber >= 5) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }

        // Status highlight
        if (colNumber === 16) {
          if (p.statusKinerjaRentang === "SANGAT_BAIK") {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF047857" } };
          } else if (p.statusKinerjaRentang === "BAIK") {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF1D4ED8" } };
          } else {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB91C1C" } };
          }
        }
      });
    });

    // Column widths
    worksheet.getColumn(1).width = 5; // No
    worksheet.getColumn(2).width = 10; // Kode
    worksheet.getColumn(3).width = 24; // Prodi
    worksheet.getColumn(4).width = 24; // Fakultas
    worksheet.getColumn(5).width = 12; // Dosen Aktif
    worksheet.getColumn(6).width = 12; // Kelas Aktif
    worksheet.getColumn(7).width = 14; // Sesi
    worksheet.getColumn(8).width = 9; // Hadir
    worksheet.getColumn(9).width = 9; // HTL
    worksheet.getColumn(10).width = 9; // Alpha
    worksheet.getColumn(11).width = 11; // Belum Diisi
    worksheet.getColumn(12).width = 14; // % Hadir Periode
    worksheet.getColumn(13).width = 12; // Skor 3P
    worksheet.getColumn(14).width = 15; // % Konten Periode
    worksheet.getColumn(15).width = 11; // Live Conf
    worksheet.getColumn(16).width = 16; // Status
    worksheet.getColumn(17).width = 15; // % Hadir Semester
    worksheet.getColumn(18).width = 15; // % Konten Semester

    // ── 4. Sheet 2: Detail Kendala Kehadiran Dosen (Alpha & Belum Diisi) ──────
    const sheetKendala = workbook.addWorksheet("Kendala Kehadiran Dosen", {
      views: [{ showGridLines: true }],
    });

    sheetKendala.mergeCells("A1:I1");
    const kTitle = sheetKendala.getCell("A1");
    kTitle.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    kTitle.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFA80063" } };
    kTitle.alignment = { horizontal: "center", vertical: "middle" };
    sheetKendala.getRow(1).height = 25;

    sheetKendala.mergeCells("A2:I2");
    const kSub = sheetKendala.getCell("A2");
    kSub.value = `RINCIAN SESI KENDALA KEHADIRAN DOSEN (ALPHA & BELUM DIISI) - PERIODE (${periodeText.toUpperCase()})`;
    kSub.font = { name: "Arial", size: 10.5, bold: true, color: { argb: "FF334155" } };
    kSub.alignment = { horizontal: "center", vertical: "middle" };
    sheetKendala.getRow(2).height = 20;

    const allKendalaList = prodiReportList.flatMap((p) =>
      (p.kendalaList || []).map((k) => ({ ...k, prodiKode: p.kode, prodiNama: p.nama }))
    );

    sheetKendala.mergeCells("A3:I3");
    const kSem = sheetKendala.getCell("A3");
    const totalAlphaCount = allKendalaList.filter((k) => k.status === "ALPHA").length;
    const totalBelumDiisiCount = allKendalaList.filter((k) => k.status === "BELUM_DIISI").length;
    kSem.value = `Semester: ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : "Aktif"
    } | Total Sesi Berkendala: ${allKendalaList.length} Sesi (${totalAlphaCount} Alpha, ${totalBelumDiisiCount} Belum Diisi)`;
    kSem.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    kSem.alignment = { horizontal: "center", vertical: "middle" };
    sheetKendala.getRow(3).height = 18;

    sheetKendala.addRow([]); // Blank row 4

    const kendalaHeaders = [
      "No",
      "Program Studi",
      "Nama Dosen",
      "NIDN",
      "Mata Kuliah",
      "Kelas",
      "Sesi Ke-",
      "Status Kehadiran",
      "Catatan CDU / Alasan",
    ];

    const kHeaderRow = sheetKendala.addRow(kendalaHeaders);
    kHeaderRow.height = 25;
    kHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFA80063" },
      };
      cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "medium", color: { argb: "FF555555" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    if (allKendalaList.length === 0) {
      const emptyRow = sheetKendala.addRow([
        "",
        "Tidak ada sesi yang berkendala (Semua sesi terisi Hadir / Hadir Tidak Lengkap).",
      ]);
      sheetKendala.mergeCells(`B${emptyRow.number}:I${emptyRow.number}`);
      emptyRow.getCell(2).font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FF047857" } };
      emptyRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      emptyRow.height = 24;
    } else {
      allKendalaList.forEach((k, idx) => {
        const kRow = sheetKendala.addRow([
          idx + 1,
          `[${k.prodiKode}] ${k.prodiNama}`,
          k.dosenNama,
          k.dosenNidn || "-",
          k.mataKuliahNama,
          k.kelasKode,
          `Sesi ${k.nomorSesi}`,
          k.status === "ALPHA" ? "ALPHA / TIDAK HADIR" : "BELUM DIISI",
          k.catatan || "- (Belum ada catatan)",
        ]);
        kRow.height = 20;

        kRow.eachCell((cell, colNumber) => {
          cell.font = { name: "Arial", size: 9 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (colNumber === 1 || colNumber === 4 || colNumber === 6 || colNumber === 7 || colNumber === 8) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }

          // Highlight status
          if (colNumber === 8) {
            if (k.status === "ALPHA") {
              cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB91C1C" } };
            } else {
              cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF64748B" } };
            }
          }

          // Highlight catatan
          if (colNumber === 9 && k.catatan) {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFA80063" } };
          }
        });
      });
    }

    sheetKendala.getColumn(1).width = 6;  // No
    sheetKendala.getColumn(2).width = 24; // Prodi
    sheetKendala.getColumn(3).width = 26; // Dosen
    sheetKendala.getColumn(4).width = 14; // NIDN
    sheetKendala.getColumn(5).width = 26; // Mata Kuliah
    sheetKendala.getColumn(6).width = 12; // Kelas
    sheetKendala.getColumn(7).width = 12; // Sesi
    sheetKendala.getColumn(8).width = 22; // Status
    sheetKendala.getColumn(9).width = 28; // Catatan

    const buffer = await workbook.xlsx.writeBuffer();
    const prodiSuffix = singleProdi ? `_${singleProdi.kode}` : "";
    const filename = isAllTime
      ? `Laporan_Prodi${prodiSuffix}_All_Time.xlsx`
      : `Laporan_Prodi${prodiSuffix}_${startDate}_sd_${endDate}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Excel export error:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat file Excel" }, { status: 500 });
  }
}
