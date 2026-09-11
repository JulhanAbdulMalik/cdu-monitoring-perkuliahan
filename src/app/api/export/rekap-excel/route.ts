// src/app/api/export/rekap-excel/route.ts
// ExcelJS Export API Route for CDU Monitoring Rekapitulasi (3-Pillar & Conference Quota)
// Enhanced with Comprehensive Lecturer Substitution Tracking (Multi-line, Cell Notes & Dedicated Log Sheet)

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

    // ═════════════════════════════════════════════════════════════════════════
    // SHEET 1: REKAPITULASI 3 PILAR & PERGANTIAN PENGAJAR
    // ═════════════════════════════════════════════════════════════════════════
    const worksheet = workbook.addWorksheet("Rekapitulasi 3 Pilar", {
      views: [{ showGridLines: true }],
    });

    // ── 1. Title Header ──────────────────────────────────────────────────────
    worksheet.mergeCells("A1:AD1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "UNIVERSITAS NUSA PUTRA — CURRICULUM DEVELOPMENT UNIT (CDU)";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFA80063" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 26;

    worksheet.mergeCells("A2:AD2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value = `LAPORAN REKAPITULASI MONITORING PERKULIAHAN (3 PILAR) — SEMESTER ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : ""
    }`;
    subtitleCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 20;

    worksheet.mergeCells("A3:AD3");
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
      "Status Pengajar & Pergantian",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;

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
      // 1. Nilai Teks Tiap Sesi
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

      // 2. Format Teks Dosen Pengampu (Mendukung Split Multi-line)
      let dosenDisplayText = cls.dosen.nama;
      if (cls.isSplitPengajar && cls.dosenPengajarList && cls.dosenPengajarList.length > 1) {
        const dosenUtamaPeran = cls.dosenPengajarList.find((p) => p.id === cls.dosen.id);
        const subPeranList = cls.dosenPengajarList.filter((p) => p.id !== cls.dosen.id);

        const lines: string[] = [];
        if (dosenUtamaPeran && dosenUtamaPeran.sesiList.length > 0) {
          const minU = Math.min(...dosenUtamaPeran.sesiList);
          const maxU = Math.max(...dosenUtamaPeran.sesiList);
          lines.push(`${cls.dosen.nama} (Utama: S${minU}–${maxU})`);
        } else {
          lines.push(`${cls.dosen.nama} (Utama)`);
        }

        subPeranList.forEach((sub) => {
          const label = sub.statusPengajar === "PERGANTIAN_TETAP" ? "Baru" : "Ganti";
          const minS = Math.min(...sub.sesiList);
          const maxS = Math.max(...sub.sesiList);
          const sesiStr = minS === maxS ? `S${minS}` : `S${minS}–${maxS}`;
          lines.push(`${sub.nama} (${label}: ${sesiStr})`);
        });

        dosenDisplayText = lines.join("\n");
      }

      // 3. Format Ringkasan Pergantian Dosen (Kolom 30)
      let statusPengajarText = "Normal (1 Dosen Penuh)";
      if (cls.isSplitPengajar && cls.dosenPengajarList && cls.dosenPengajarList.length > 1) {
        const lines: string[] = [];
        cls.dosenPengajarList.forEach((p) => {
          const minS = Math.min(...p.sesiList);
          const maxS = Math.max(...p.sesiList);
          const sesiStr = minS === maxS ? `S${minS}` : `S${minS}–${maxS}`;
          const roleStr =
            p.statusPengajar === "PERGANTIAN_TETAP"
              ? "Dosen Baru"
              : p.statusPengajar === "PENGGANTI_INSIDENTAL"
              ? "Pengganti"
              : "Utama";
          lines.push(`${sesiStr}: ${p.nama} [${roleStr}${p.catatan ? ` • ${p.catatan}` : ""}]`);
        });
        statusPengajarText = lines.join("\n");
      }

      const rowValues = [
        idx + 1,
        cls.kodeKelas,
        cls.modePembelajaran === "BIMBINGAN" ? "Bimbingan" : cls.modePembelajaran === "LURING" ? "Offline" : "Online",
        cls.mataKuliah.prodi.nama,
        cls.mataKuliah.nama,
        cls.mataKuliah.sks,
        dosenDisplayText,
        ...sesiValues,
        `${cls.totalHadir}/16`,
        `${cls.persenKehadiran}%`,
        cls.modePembelajaran === "BIMBINGAN" ? "Bebas Konten" : `${cls.totalSkor3Pilar}/42`,
        cls.modePembelajaran === "BIMBINGAN" ? "—" : `${cls.persenKonten}%`,
        cls.modePembelajaran === "LURING"
          ? "Bebas Conf"
          : cls.modePembelajaran === "BIMBINGAN"
          ? `UTS: ${cls.confPraUTS}/8 | UAS: ${cls.confPraUAS}/8`
          : `UTS: ${cls.confPraUTS}/3 | UAS: ${cls.confPraUAS}/3`,
        cls.statusEvaluasi === "MEMENUHI"
          ? "Memenuhi Syarat"
          : cls.statusEvaluasi === "CUKUP"
          ? "Cukup"
          : "Perlu Perhatian",
        statusPengajarText,
      ];

      const row = worksheet.addRow(rowValues);
      row.height = cls.isSplitPengajar ? 36 : 20;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Arial", size: 9 };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        // Alignments
        if (
          colNumber === 1 ||
          colNumber === 3 ||
          colNumber === 6 ||
          (colNumber >= 8 && colNumber <= 28)
        ) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (colNumber === 7 || colNumber === 30) {
          cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }

        // Color coding & Cell Notes untuk kolom Sesi (Col 8 s/d 23)
        if (colNumber >= 8 && colNumber <= 23) {
          const sesiIndex = colNumber - 8;
          const s = cls.sesi[sesiIndex];
          const val = String(cell.value || "");

          const isSub = s && s.dosenPengajar && s.statusPengajar && s.statusPengajar !== "UTAMA";

          if (isSub) {
            // Pasang Cell Note di Excel
            const statusLabel =
              s.statusPengajar === "PERGANTIAN_TETAP"
                ? "Dosen Baru (Pergantian Tetap)"
                : "Dosen Pengganti (Sementara)";
            cell.note = `Pengajar Sesi ${s.nomorSesi}:\nNama: ${s.dosenPengajar!.nama}${
              s.dosenPengajar!.nidn ? ` (NIDN: ${s.dosenPengajar!.nidn})` : ""
            }\nStatus: ${statusLabel}\nAlasan: ${s.catatanGantiDosen || "—"}`;

            // Warna pembeda sesi yang digantikan
            if (s.statusPengajar === "PERGANTIAN_TETAP") {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF3E8FF" }, // Soft Purple
              };
              cell.font = { name: "Arial", size: 8.5, color: { argb: "FF6B21A8" }, bold: true };
            } else {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFEF3C7" }, // Soft Amber
              };
              cell.font = { name: "Arial", size: 8.5, color: { argb: "FF92400E" }, bold: true };
            }
          } else {
            // Default styling kehadiran normal
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

        // Styling kolom 30 (Status Pengajar & Pergantian)
        if (colNumber === 30) {
          if (cls.isSplitPengajar) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFAF5FF" }, // Light Purple tinted background
            };
            cell.font = { name: "Arial", size: 8.5, color: { argb: "FF6B21A8" }, bold: true };
          } else {
            cell.font = { name: "Arial", size: 8.5, color: { argb: "FF64748B" } };
          }
        }
      });
    });

    // Adjust column widths Sheet 1
    worksheet.getColumn(1).width = 5; // No
    worksheet.getColumn(2).width = 12; // Kode Kelas
    worksheet.getColumn(3).width = 10; // Mode
    worksheet.getColumn(4).width = 22; // Prodi
    worksheet.getColumn(5).width = 28; // Mata Kuliah
    worksheet.getColumn(6).width = 6; // SKS
    worksheet.getColumn(7).width = 32; // Dosen Pengampu (Lebar cukup untuk multi-line)
    for (let c = 8; c <= 23; c++) {
      worksheet.getColumn(c).width = 9; // Sesi 1-16
    }
    worksheet.getColumn(24).width = 12; // Total Hadir
    worksheet.getColumn(25).width = 10; // % Hadir
    worksheet.getColumn(26).width = 13; // Skor 3 Pilar (Max 42)
    worksheet.getColumn(27).width = 10; // % Konten
    worksheet.getColumn(28).width = 20; // Live Conf
    worksheet.getColumn(29).width = 16; // Status Evaluasi
    worksheet.getColumn(30).width = 38; // Status Pengajar & Pergantian

    // ═════════════════════════════════════════════════════════════════════════
    // SHEET 2: LOG DAFTAR PERGANTIAN DOSEN
    // ═════════════════════════════════════════════════════════════════════════
    const logWorksheet = workbook.addWorksheet("Log Pergantian Dosen", {
      views: [{ showGridLines: true }],
    });

    logWorksheet.mergeCells("A1:K1");
    const logTitle = logWorksheet.getCell("A1");
    logTitle.value = "UNIVERSITAS NUSA PUTRA — CURRICULUM DEVELOPMENT UNIT (CDU)";
    logTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFA80063" } };
    logTitle.alignment = { horizontal: "center", vertical: "middle" };
    logWorksheet.getRow(1).height = 26;

    logWorksheet.mergeCells("A2:K2");
    const logSubtitle = logWorksheet.getCell("A2");
    logSubtitle.value = `LOG RINCIAN PERGANTIAN & DOSEN PENGGANTI — SEMESTER ${
      currentSem ? `${currentSem.tahunAkademik} (${currentSem.periode})` : ""
    }`;
    logSubtitle.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
    logSubtitle.alignment = { horizontal: "center", vertical: "middle" };
    logWorksheet.getRow(2).height = 20;

    logWorksheet.mergeCells("A3:K3");
    const logDate = logWorksheet.getCell("A3");
    logDate.value = `Tanggal Cetak: ${new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
    logDate.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    logDate.alignment = { horizontal: "center", vertical: "middle" };
    logWorksheet.getRow(3).height = 18;

    logWorksheet.addRow([]); // Blank row 4

    const logHeaders = [
      "No",
      "Kode Kelas",
      "Program Studi",
      "Mata Kuliah",
      "Sesi Ke-",
      "Dosen Utama",
      "Dosen Pengajar Riil",
      "NIDN Pengajar",
      "Jenis Pergantian",
      "Alasan / Catatan CDU",
      "Status Kehadiran Sesi",
    ];

    const logHeaderRow = logWorksheet.addRow(logHeaders);
    logHeaderRow.height = 26;
    logHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFA80063" },
      };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "medium", color: { argb: "FF555555" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });

    // Kumpulkan seluruh sesi yang digantikan di semester ini
    let logCounter = 1;
    rekapList.forEach((cls) => {
      cls.sesi.forEach((s) => {
        const isSub = s.dosenPengajar && s.statusPengajar && s.statusPengajar !== "UTAMA";
        if (isSub) {
          const jenisStr =
            s.statusPengajar === "PERGANTIAN_TETAP"
              ? "Dosen Baru (Pergantian Tetap)"
              : "Dosen Pengganti (Sementara)";

          const kehadiranStr =
            s.kehadiran === "HADIR"
              ? "Hadir"
              : s.kehadiran === "HADIR_TIDAK_LENGKAP" || s.kehadiran === "HADIR_TDK_LENGKAP"
              ? "Hadir Tidak Lengkap"
              : s.kehadiran === "TIDAK_HADIR" || s.kehadiran === "ALPHA"
              ? "Alpha / Tidak Hadir"
              : "Belum Diisi";

          const logRow = logWorksheet.addRow([
            logCounter++,
            cls.kodeKelas,
            cls.mataKuliah.prodi.nama,
            cls.mataKuliah.nama,
            `Sesi ${s.nomorSesi}${s.nomorSesi === 8 ? " (UTS)" : s.nomorSesi === 16 ? " (UAS)" : ""}`,
            cls.dosen.nama,
            s.dosenPengajar!.nama,
            s.dosenPengajar!.nidn || "—",
            jenisStr,
            s.catatanGantiDosen || "—",
            kehadiranStr,
          ]);

          logRow.height = 20;
          logRow.eachCell((cell, colNumber) => {
            cell.font = { name: "Arial", size: 9 };
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };

            if (colNumber === 1 || colNumber === 5 || colNumber === 8 || colNumber === 11) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else {
              cell.alignment = { horizontal: "left", vertical: "middle" };
            }

            if (colNumber === 9) {
              if (s.statusPengajar === "PERGANTIAN_TETAP") {
                cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF6B21A8" } };
              } else {
                cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB45309" } };
              }
            }
          });
        }
      });
    });

    // Jika tidak ada sesi yang digantikan sama sekali
    if (logCounter === 1) {
      const emptyRow = logWorksheet.addRow([
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
        "Tidak ada catatan pergantian dosen pada semester ini.",
        "—",
        "—",
        "—",
        "—",
      ]);
      emptyRow.height = 24;
      emptyRow.eachCell((cell) => {
        cell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF94A3B8" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    }

    // Set Column Widths Sheet 2
    logWorksheet.getColumn(1).width = 5; // No
    logWorksheet.getColumn(2).width = 12; // Kode Kelas
    logWorksheet.getColumn(3).width = 22; // Prodi
    logWorksheet.getColumn(4).width = 28; // Mata Kuliah
    logWorksheet.getColumn(5).width = 12; // Sesi
    logWorksheet.getColumn(6).width = 26; // Dosen Utama
    logWorksheet.getColumn(7).width = 26; // Dosen Pengajar Riil
    logWorksheet.getColumn(8).width = 14; // NIDN
    logWorksheet.getColumn(9).width = 26; // Jenis Pergantian
    logWorksheet.getColumn(10).width = 30; // Alasan / Catatan CDU
    logWorksheet.getColumn(11).width = 20; // Status Kehadiran Sesi

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

