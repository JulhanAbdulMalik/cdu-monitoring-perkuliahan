import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getLaporanFakultas, FakultasReportItem } from "@/actions/laporan";
import { formatTanggalRange, formatPct } from "@/lib/utils";
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
    const sesiParam = searchParams.get("sesi");
    const parsedSesi = sesiParam ? parseInt(sesiParam, 10) : undefined;
    const jenisKelasParam = searchParams.get("jenisKelas") || undefined;
    const searchParam = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "ALL";
    const sortByParam = searchParams.get("sortBy") || "nama_asc";

    const isSesiMode = Boolean(parsedSesi && parsedSesi >= 1 && parsedSesi <= 16);
    const isAllTime =
      searchParams.get("allTime") === "true" ||
      (!isSesiMode && !startDate && !endDate) ||
      startDate === "ALL";

    const targetStartDate = isSesiMode || isAllTime ? "" : startDate;
    const targetEndDate = isSesiMode || isAllTime ? "" : endDate;

    const res = await getLaporanFakultas(
      semesterId,
      targetStartDate,
      targetEndDate,
      allowedProdiIds,
      parsedSesi,
      jenisKelasParam
    );

    if (!res.success || !res.data) {
      return NextResponse.json(
        { error: "Gagal memuat data laporan fakultas" },
        { status: 500 }
      );
    }

    const {
      fakultasReportList,
      semesters,
      activeSemesterId,
      globalSummary,
      targetJenisKelas,
    } = res.data;

    const currentSem =
      semesters.find((s) => s.id === (semesterId || activeSemesterId)) ||
      semesters[0];

    // ── Apply Client Active Filters (Search & Status) ──────────────────────────
    let filteredFakultas = fakultasReportList.filter((f) => {
      const matchSearch =
        !searchParam ||
        f.nama.toLowerCase().includes(searchParam.toLowerCase()) ||
        f.singkatan.toLowerCase().includes(searchParam.toLowerCase());
      const matchStatus =
        statusParam === "ALL" || f.statusKinerjaRentang === statusParam;
      return matchSearch && matchStatus;
    });

    // ── Apply Sorting ────────────────────────────────────────────────────────
    filteredFakultas.sort((a, b) => {
      switch (sortByParam) {
        case "singkatan_asc":
          return a.singkatan.localeCompare(b.singkatan, "id", { sensitivity: "base" });
        case "singkatan_desc":
          return b.singkatan.localeCompare(a.singkatan, "id", { sensitivity: "base" });
        case "nama_desc":
          return b.nama.localeCompare(a.nama, "id", { sensitivity: "base" });
        case "dosen_desc":
          return b.totalDosenAktifRentang - a.totalDosenAktifRentang;
        case "dosen_asc":
          return a.totalDosenAktifRentang - b.totalDosenAktifRentang;
        case "kelas_desc":
          return b.totalKelasAktifRentang - a.totalKelasAktifRentang;
        case "kelas_asc":
          return a.totalKelasAktifRentang - b.totalKelasAktifRentang;
        case "sesi_desc":
          return b.totalSesiRentang - a.totalSesiRentang;
        case "sesi_asc":
          return a.totalSesiRentang - b.totalSesiRentang;
        case "kehadiran_desc":
          return (b.avgKehadiranRentang ?? -1) - (a.avgKehadiranRentang ?? -1);
        case "kehadiran_asc":
          return (a.avgKehadiranRentang ?? 999) - (b.avgKehadiranRentang ?? 999);
        case "konten_desc":
          return (b.avgKontenRentang ?? -1) - (a.avgKontenRentang ?? -1);
        case "konten_asc":
          return (a.avgKontenRentang ?? 999) - (b.avgKontenRentang ?? 999);
        case "status_asc": {
          const rank: Record<string, number> = {
            BELUM_ADA_KELAS: 0,
            PERLU_PEMBINAAN: 1,
            BAIK: 2,
            SANGAT_BAIK: 3,
          };
          return (rank[a.statusKinerjaRentang] || 0) - (rank[b.statusKinerjaRentang] || 0);
        }
        case "status_desc": {
          const rank: Record<string, number> = {
            BELUM_ADA_KELAS: 0,
            PERLU_PEMBINAAN: 1,
            BAIK: 2,
            SANGAT_BAIK: 3,
          };
          return (rank[b.statusKinerjaRentang] || 0) - (rank[a.statusKinerjaRentang] || 0);
        }
        case "nama_asc":
        default:
          return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
      }
    });

    const activeJenis =
      targetJenisKelas && targetJenisKelas !== "ALL" ? targetJenisKelas : null;
    const jenisLabel =
      activeJenis === "LURING"
        ? "OFFLINE"
        : activeJenis === "DARING"
        ? "ONLINE"
        : activeJenis === "BIMBINGAN"
        ? "BIMBINGAN"
        : "";
    const jenisTextFormatted =
      activeJenis === "LURING"
        ? "Offline"
        : activeJenis === "DARING"
        ? "Online"
        : activeJenis === "BIMBINGAN"
        ? "Bimbingan"
        : "";

    const periodeText = isSesiMode
      ? `SESI ${parsedSesi}${parsedSesi === 8 ? " (UTS)" : parsedSesi === 16 ? " (UAS)" : ""}`
      : isAllTime
      ? "SEMUA WAKTU (1 SEMESTER)"
      : formatTanggalRange(startDate, endDate);

    // Keterangan filter aktif untuk header
    const filterNotes: string[] = [];
    if (activeJenis) filterNotes.push(`Kelas ${jenisTextFormatted}`);
    if (statusParam && statusParam !== "ALL") {
      const statusText =
        statusParam === "SANGAT_BAIK"
          ? "Sangat Baik"
          : statusParam === "BAIK"
          ? "Baik"
          : statusParam === "PERLU_PEMBINAAN"
          ? "Perlu Perhatian"
          : "Belum Ada Kelas";
      filterNotes.push(`Status: ${statusText}`);
    }
    if (searchParam) filterNotes.push(`Pencarian: "${searchParam}"`);

    const filterSubtitle = filterNotes.length > 0 ? ` [${filterNotes.join(" | ")}]` : "";

    // Agregasi filtered data
    const totalFilteredProdi = filteredFakultas.reduce((acc, f) => acc + f.totalProdi, 0);
    const totalFilteredSesi = filteredFakultas.reduce((acc, f) => acc + f.totalSesiRentang, 0);
    const totalFilteredHadir = filteredFakultas.reduce((acc, f) => acc + f.totalHadirRentang, 0);
    const totalFilteredAlpha = filteredFakultas.reduce((acc, f) => acc + f.totalAlphaRentang, 0);

    // Create ExcelJS Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CDU Nusa Putra University";
    workbook.created = new Date();

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 1: LAPORAN FAKULTAS (KOMPARASI 7 FAKULTAS)
    // ─────────────────────────────────────────────────────────────────────────
    const worksheet = workbook.addWorksheet("Laporan Fakultas", {
      views: [{ showGridLines: true }],
    });

    // ── 1. Official Header Row 1, 2, 3
    worksheet.mergeCells("A1:Q1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    titleCell.font = {
      name: "Rockwell",
      size: 13,
      bold: true,
      color: { argb: "FFA80063" },
    };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 25;

    worksheet.mergeCells("A2:Q2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value = `LAPORAN PERFORMA EKSEKUTIF PER FAKULTAS (${periodeText.toUpperCase()})${filterSubtitle}`;
    subtitleCell.font = {
      name: "Rockwell",
      size: 10.5,
      bold: true,
      color: { argb: "FF334155" },
    };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 20;

    worksheet.mergeCells("A3:Q3");
    const semCell = worksheet.getCell("A3");
    const jenisInfo = activeJenis ? ` | Jenis: ${jenisTextFormatted}` : "";
    semCell.value = `Semester: ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : "Aktif"
    }${jenisInfo} | Total Fakultas: ${filteredFakultas.length} | Total Prodi: ${totalFilteredProdi} | Total Sesi: ${totalFilteredSesi} | Rata Kehadiran Univ: ${formatPct(
      globalSummary.avgKehadiranRentangSemua
    )} | Rata Konten 3P: ${formatPct(
      globalSummary.avgKontenRentangSemua
    )} | Live Conf: ${globalSummary.totalConfRentangSemua}`;
    semCell.font = {
      name: "Rockwell",
      size: 9,
      italic: true,
      color: { argb: "FF64748B" },
    };
    semCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(3).height = 18;

    worksheet.addRow([]); // Row 4 Blank

    // ── 2. Table Column Headers (Row 5)
    const headers = [
      "No",
      "Singkatan",
      "Fakultas",
      "Total Prodi",
      "Dosen Aktif",
      "Kelas Aktif",
      "Sesi di Periode",
      "Hadir",
      "HTL",
      "Alpha",
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
      cell.font = {
        name: "Rockwell",
        size: 9.5,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "medium", color: { argb: "FF555555" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    // ── 3. Data Rows
    if (filteredFakultas.length === 0) {
      const emptyRow = worksheet.addRow([
        "",
        "Tidak ada data fakultas yang sesuai dengan kriteria filter aktif.",
      ]);
      worksheet.mergeCells(`B${emptyRow.number}:Q${emptyRow.number}`);
      emptyRow.getCell(2).font = {
        name: "Rockwell",
        size: 9.5,
        italic: true,
        color: { argb: "FF64748B" },
      };
      emptyRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      emptyRow.height = 24;
    } else {
      filteredFakultas.forEach((f, idx) => {
        const rowValues = [
          idx + 1,
          f.singkatan,
          f.nama,
          f.totalProdi,
          f.totalDosenAktifRentang,
          f.totalKelasAktifRentang,
          f.totalSesiRentang,
          f.totalHadirRentang,
          f.totalHadirTdkLengkapRentang,
          f.totalAlphaRentang,
          f.avgKehadiranRentang === null ? "N/A" : formatPct(f.avgKehadiranRentang),
          f.totalRegularSesiRentang === 0
            ? "0/0"
            : `${f.totalSkor3PilarRentang}/${f.maxSkor3PilarRentang}`,
          f.avgKontenRentang === null ? "N/A" : formatPct(f.avgKontenRentang),
          f.totalConfRentang,
          f.statusKinerjaRentang === "SANGAT_BAIK"
            ? "Sangat Baik"
            : f.statusKinerjaRentang === "BAIK"
            ? "Baik"
            : f.statusKinerjaRentang === "PERLU_PEMBINAAN"
            ? "Perlu Perhatian"
            : "Belum Ada Kelas",
          f.avgKehadiranSemester === null
            ? "N/A"
            : formatPct(f.avgKehadiranSemester),
          f.avgKontenSemester === null
            ? "N/A"
            : formatPct(f.avgKontenSemester),
        ];

        const row = worksheet.addRow(rowValues);
        row.height = 20;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Rockwell", size: 9 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          // Alignments
          if (colNumber === 1 || colNumber === 2 || colNumber >= 4) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }

          // Singkatan badge font
          if (colNumber === 2) {
            cell.font = {
              name: "Rockwell",
              size: 9.5,
              bold: true,
              color: { argb: "FFA80063" },
            };
          }

          // Status highlight
          if (colNumber === 15) {
            if (f.statusKinerjaRentang === "SANGAT_BAIK") {
              cell.font = {
                name: "Rockwell",
                size: 9,
                bold: true,
                color: { argb: "FF047857" },
              };
            } else if (f.statusKinerjaRentang === "BAIK") {
              cell.font = {
                name: "Rockwell",
                size: 9,
                bold: true,
                color: { argb: "FF1D4ED8" },
              };
            } else if (f.statusKinerjaRentang === "PERLU_PEMBINAAN") {
              cell.font = {
                name: "Rockwell",
                size: 9,
                bold: true,
                color: { argb: "FFB91C1C" },
              };
            } else {
              cell.font = { name: "Rockwell", size: 9, color: { argb: "FF64748B" } };
            }
          }
        });
      });
    }

    // Column widths
    worksheet.getColumn(1).width = 5;  // No
    worksheet.getColumn(2).width = 12; // Singkatan
    worksheet.getColumn(3).width = 34; // Fakultas
    worksheet.getColumn(4).width = 12; // Total Prodi
    worksheet.getColumn(5).width = 12; // Dosen Aktif
    worksheet.getColumn(6).width = 12; // Kelas Aktif
    worksheet.getColumn(7).width = 14; // Sesi
    worksheet.getColumn(8).width = 9;  // Hadir
    worksheet.getColumn(9).width = 9;  // HTL
    worksheet.getColumn(10).width = 9; // Alpha
    worksheet.getColumn(11).width = 16; // % Hadir
    worksheet.getColumn(12).width = 13; // Skor 3P
    worksheet.getColumn(13).width = 17; // % Konten
    worksheet.getColumn(14).width = 11; // Live Conf
    worksheet.getColumn(15).width = 16; // Status
    worksheet.getColumn(16).width = 16; // % Hadir Semester
    worksheet.getColumn(17).width = 16; // % Konten Semester

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 2: RINCIAN PROGRAM STUDI (DRILL-DOWN PER PRODI DI SELURUH FAKULTAS)
    // ─────────────────────────────────────────────────────────────────────────
    const sheetProdi = workbook.addWorksheet("Rincian Program Studi", {
      views: [{ showGridLines: true }],
    });

    // ── Official Header Row 1, 2, 3
    sheetProdi.mergeCells("A1:L1");
    const spTitle = sheetProdi.getCell("A1");
    spTitle.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    spTitle.font = {
      name: "Rockwell",
      size: 13,
      bold: true,
      color: { argb: "FFA80063" },
    };
    spTitle.alignment = { horizontal: "center", vertical: "middle" };
    sheetProdi.getRow(1).height = 25;

    sheetProdi.mergeCells("A2:L2");
    const spSub = sheetProdi.getCell("A2");
    spSub.value = `RINCIAN PERFORMA PROGRAM STUDI PER FAKULTAS - PERIODE (${periodeText.toUpperCase()})${filterSubtitle}`;
    spSub.font = {
      name: "Rockwell",
      size: 10.5,
      bold: true,
      color: { argb: "FF334155" },
    };
    spSub.alignment = { horizontal: "center", vertical: "middle" };
    sheetProdi.getRow(2).height = 20;

    sheetProdi.mergeCells("A3:L3");
    const spSem = sheetProdi.getCell("A3");
    spSem.value = `Semester: ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : "Aktif"
    }${jenisInfo} | Total Program Studi: ${totalFilteredProdi} | Sesi di Periode: ${totalFilteredSesi} | Total Hadir: ${totalFilteredHadir} | Total Alpha: ${totalFilteredAlpha}`;
    spSem.font = {
      name: "Rockwell",
      size: 9,
      italic: true,
      color: { argb: "FF64748B" },
    };
    spSem.alignment = { horizontal: "center", vertical: "middle" };
    sheetProdi.getRow(3).height = 18;

    sheetProdi.addRow([]); // Blank Row 4

    const prodiHeaders = [
      "No",
      "Fakultas",
      "Kode",
      "Program Studi",
      "Dosen Aktif",
      "Kelas Aktif",
      "Sesi di Periode",
      "Hadir",
      "Alpha",
      "% Hadir",
      "% Konten",
      "Status Kinerja",
    ];

    const spHeaderRow = sheetProdi.addRow(prodiHeaders);
    spHeaderRow.height = 25;

    spHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFA80063" }, // Brand Magenta
      };
      cell.font = {
        name: "Rockwell",
        size: 9.5,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "medium", color: { argb: "FF555555" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    let prodiRowIdx = 1;
    filteredFakultas.forEach((f) => {
      f.prodiBreakdownList.forEach((p) => {
        const rowValues = [
          prodiRowIdx++,
          `${f.nama} (${f.singkatan})`,
          p.kode,
          p.nama,
          `${p.totalDosenAktifRentang} / ${p.totalDosen}`,
          `${p.totalKelasAktifRentang} / ${p.totalKelas}`,
          p.totalSesiRentang,
          p.totalHadirRentang,
          p.totalAlphaRentang,
          p.avgKehadiranRentang === null ? "N/A" : formatPct(p.avgKehadiranRentang),
          p.avgKontenRentang === null ? "N/A" : formatPct(p.avgKontenRentang),
          p.statusKinerjaRentang === "SANGAT_BAIK"
            ? "Sangat Baik"
            : p.statusKinerjaRentang === "BAIK"
            ? "Baik"
            : p.statusKinerjaRentang === "PERLU_PEMBINAAN"
            ? "Perlu Perhatian"
            : "Belum Ada Kelas",
        ];

        const row = sheetProdi.addRow(rowValues);
        row.height = 19;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Rockwell", size: 8.5 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (colNumber === 1 || colNumber === 3 || colNumber >= 5) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }

          // Status color
          if (colNumber === 12) {
            if (p.statusKinerjaRentang === "SANGAT_BAIK") {
              cell.font = {
                name: "Rockwell",
                size: 8.5,
                bold: true,
                color: { argb: "FF047857" },
              };
            } else if (p.statusKinerjaRentang === "BAIK") {
              cell.font = {
                name: "Rockwell",
                size: 8.5,
                bold: true,
                color: { argb: "FF1D4ED8" },
              };
            } else if (p.statusKinerjaRentang === "PERLU_PEMBINAAN") {
              cell.font = {
                name: "Rockwell",
                size: 8.5,
                bold: true,
                color: { argb: "FFB91C1C" },
              };
            }
          }
        });
      });
    });

    sheetProdi.getColumn(1).width = 5;  // No
    sheetProdi.getColumn(2).width = 32; // Fakultas
    sheetProdi.getColumn(3).width = 10; // Kode
    sheetProdi.getColumn(4).width = 28; // Program Studi
    sheetProdi.getColumn(5).width = 14; // Dosen
    sheetProdi.getColumn(6).width = 14; // Kelas
    sheetProdi.getColumn(7).width = 14; // Sesi
    sheetProdi.getColumn(8).width = 9;  // Hadir
    sheetProdi.getColumn(9).width = 9;  // Alpha
    sheetProdi.getColumn(10).width = 14; // % Hadir
    sheetProdi.getColumn(11).width = 14; // % Konten
    sheetProdi.getColumn(12).width = 16; // Status

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 3: KENDALA KEHADIRAN DOSEN
    // ─────────────────────────────────────────────────────────────────────────
    const sheetKendala = workbook.addWorksheet("Kendala Kehadiran Dosen", {
      views: [{ showGridLines: true }],
    });

    const allKendalaList = filteredFakultas.flatMap((f) =>
      (f.kendalaList || []).map((k) => ({
        ...k,
        fakultasSingkatan: f.singkatan,
        fakultasNama: f.nama,
      }))
    );

    const totalAlphaCount = allKendalaList.filter((k) => k.status === "ALPHA").length;
    const totalHtlCount = allKendalaList.filter((k) => k.status === "HTL").length;
    const totalBelumDiisiCount = allKendalaList.filter((k) => k.status === "BELUM_DIISI").length;

    // ── Official Header Row 1, 2, 3
    sheetKendala.mergeCells("A1:J1");
    const skTitle = sheetKendala.getCell("A1");
    skTitle.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    skTitle.font = {
      name: "Rockwell",
      size: 13,
      bold: true,
      color: { argb: "FFA80063" },
    };
    skTitle.alignment = { horizontal: "center", vertical: "middle" };
    sheetKendala.getRow(1).height = 25;

    sheetKendala.mergeCells("A2:J2");
    const skSub = sheetKendala.getCell("A2");
    skSub.value = `DAFTAR SESI KENDALA KEHADIRAN DOSEN PER FAKULTAS (ALPHA, HTL & BELUM DIISI) - PERIODE (${periodeText.toUpperCase()})${filterSubtitle}`;
    skSub.font = {
      name: "Rockwell",
      size: 10.5,
      bold: true,
      color: { argb: "FF334155" },
    };
    skSub.alignment = { horizontal: "center", vertical: "middle" };
    sheetKendala.getRow(2).height = 20;

    sheetKendala.mergeCells("A3:J3");
    const skSem = sheetKendala.getCell("A3");
    skSem.value = `Semester: ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : "Aktif"
    }${jenisInfo} | Total Sesi Berkendala: ${allKendalaList.length} Sesi (${totalAlphaCount} Alpha, ${totalHtlCount} HTL, ${totalBelumDiisiCount} Belum Diisi)`;
    skSem.font = {
      name: "Rockwell",
      size: 9,
      italic: true,
      color: { argb: "FF64748B" },
    };
    skSem.alignment = { horizontal: "center", vertical: "middle" };
    sheetKendala.getRow(3).height = 18;

    sheetKendala.addRow([]); // Blank Row 4

    const kendalaHeaders = [
      "No",
      "Fakultas",
      "Program Studi",
      "Nama Dosen",
      "NIDN",
      "Mata Kuliah",
      "Kelas",
      "Sesi",
      "Status Kehadiran",
      "Catatan CDU / Alasan",
    ];

    const skHeaderRow = sheetKendala.addRow(kendalaHeaders);
    skHeaderRow.height = 25;

    skHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFA80063" }, // Brand Magenta
      };
      cell.font = {
        name: "Rockwell",
        size: 9.5,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
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
        "Tidak ada sesi yang berkendala (Semua sesi Hadir Lengkap).",
      ]);
      sheetKendala.mergeCells(`B${emptyRow.number}:J${emptyRow.number}`);
      emptyRow.getCell(2).font = {
        name: "Rockwell",
        size: 9.5,
        italic: true,
        color: { argb: "FF047857" },
      };
      emptyRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      emptyRow.height = 24;
    } else {
      allKendalaList.forEach((k, idx) => {
        const rowValues = [
          idx + 1,
          k.fakultasSingkatan,
          k.prodiNama || "-",
          k.dosenNama,
          k.dosenNidn || "-",
          k.mataKuliahNama,
          k.kelasKode,
          `Sesi ${k.nomorSesi}`,
          k.status === "ALPHA"
            ? "ALPHA / TIDAK HADIR"
            : k.status === "HTL"
            ? "Hadir Tidak Lengkap"
            : "BELUM DIISI",
          k.catatan || "- (Belum ada catatan)",
        ];

        const row = sheetKendala.addRow(rowValues);
        row.height = 20;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Rockwell", size: 9 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (colNumber === 1 || colNumber === 2 || colNumber === 5 || colNumber === 7 || colNumber === 8 || colNumber === 9) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }

          if (colNumber === 9) {
            if (k.status === "ALPHA") {
              cell.font = {
                name: "Rockwell",
                size: 9,
                bold: true,
                color: { argb: "FFB91C1C" },
              };
            } else if (k.status === "HTL") {
              cell.font = {
                name: "Rockwell",
                size: 9,
                bold: true,
                color: { argb: "FFB45309" },
              };
            } else {
              cell.font = {
                name: "Rockwell",
                size: 9,
                bold: true,
                color: { argb: "FF64748B" },
              };
            }
          }

          if (colNumber === 10 && k.catatan) {
            cell.font = {
              name: "Rockwell",
              size: 9,
              bold: true,
              color: { argb: "FFA80063" },
            };
          }
        });
      });
    }

    sheetKendala.getColumn(1).width = 5;  // No
    sheetKendala.getColumn(2).width = 12; // Fakultas
    sheetKendala.getColumn(3).width = 24; // Program Studi
    sheetKendala.getColumn(4).width = 26; // Nama Dosen
    sheetKendala.getColumn(5).width = 14; // NIDN
    sheetKendala.getColumn(6).width = 26; // Mata Kuliah
    sheetKendala.getColumn(7).width = 12; // Kelas
    sheetKendala.getColumn(8).width = 12; // Sesi
    sheetKendala.getColumn(9).width = 22; // Status
    sheetKendala.getColumn(10).width = 28; // Catatan

    const buffer = await workbook.xlsx.writeBuffer();
    const jenisSuffix = activeJenis ? `_${jenisLabel}` : "";
    const statusSuffix = statusParam && statusParam !== "ALL" ? `_${statusParam}` : "";
    const searchSuffix = searchParam ? `_${searchParam.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
    const filename = isSesiMode
      ? `Laporan_Fakultas${jenisSuffix}${statusSuffix}${searchSuffix}_Sesi_${parsedSesi}.xlsx`
      : isAllTime
      ? `Laporan_Fakultas${jenisSuffix}${statusSuffix}${searchSuffix}_All_Time.xlsx`
      : `Laporan_Fakultas${jenisSuffix}${statusSuffix}${searchSuffix}_${startDate}_sd_${endDate}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Fakultas Excel export error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat file Excel laporan fakultas" },
      { status: 500 }
    );
  }
}
