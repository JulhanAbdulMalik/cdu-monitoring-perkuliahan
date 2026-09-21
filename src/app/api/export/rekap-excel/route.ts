// src/app/api/export/rekap-excel/route.ts
// ExcelJS Export API Route for CDU Monitoring Rekapitulasi (3-Pillar & Conference Quota)
// Enhanced with Comprehensive Lecturer Substitution Tracking (Multi-line, Cell Notes & Dedicated Log Sheet)

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getRekapLaporan } from "@/actions/laporan";
import { formatPct } from "@/lib/utils";
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

    let targetProdiId = prodiId;
    let allowedProdiIds: string[] | undefined = undefined;

    if (isDosen) {
      allowedProdiIds = userProdiIds;
      if (prodiId && prodiId !== "ALL" && userProdiIds.includes(prodiId)) {
        targetProdiId = prodiId;
      } else {
        targetProdiId = userProdiIds[0];
      }
    }

    const res = await getRekapLaporan(semesterId, targetProdiId, allowedProdiIds);
    if (!res.success || !res.data) {
      return NextResponse.json({ error: "Gagal memuat data rekap" }, { status: 500 });
    }

    const { rekapList, semesters, prodiList, activeSemesterId } = res.data;
    const currentSem =
      semesters.find((s) => s.id === (semesterId || activeSemesterId)) || semesters[0];

    const selectedProdiObj =
      targetProdiId && targetProdiId !== "ALL"
        ? prodiList.find((p) => p.id === targetProdiId)
        : undefined;

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
    titleCell.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFA80063" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 26;

    worksheet.mergeCells("A2:AD2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value = `LAPORAN REKAPITULASI MONITORING PERKULIAHAN (3 PILAR)${
      selectedProdiObj ? ` - PRODI ${selectedProdiObj.nama.toUpperCase()}` : ""
    } - SEMESTER ${
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

    // ── 1.5 Legend Bar (Row 4) ──────────────────────────────────────────────
    worksheet.mergeCells("A4:AD4");
    const legendCell = worksheet.getCell("A4");
    legendCell.value =
      "KETERANGAN KEHADIRAN (WARNA): [H] Hadir (Hijau)  •  [T] HTL (Kuning)  •  [A] Alpa (Merah)   |   SKOR 3 PILAR (ANGKA): [3] Lengkap (3/3)  •  [2] Baik (2/3)  •  [1] Sebagian (1/3)  •  [0] Kosong   |   PENGAJAR: Dosen Baru (Border Ungu)  •  Dosen Pengganti (Border Amber)";
    legendCell.font = { name: "Arial", size: 8.5, bold: false, color: { argb: "FF475569" } };
    legendCell.alignment = { horizontal: "center", vertical: "middle" };
    legendCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFC" }, // Light Slate
    };
    legendCell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    worksheet.getRow(4).height = 20;

    worksheet.addRow([]); // Blank row 5

    // ── 2. Table Column Headers (Row 6) ──────────────────────────────────────
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
      // 1. Nilai Teks Tiap Sesi (Sama persis dengan matriks Web)
      const sesiValues = cls.sesi.map((s) => {
        const isExam = s.nomorSesi === 8 || s.nomorSesi === 16;
        const isHadir = s.kehadiran === "HADIR";
        const isHTL = s.kehadiran === "HADIR_TIDAK_LENGKAP" || s.kehadiran === "HADIR_TDK_LENGKAP";
        const isAlpha = s.kehadiran === "TIDAK_HADIR" || s.kehadiran === "ALPHA";
        const isFilled = isHadir || isHTL || isAlpha;

        if (!isFilled) return "-";

        if (isExam) {
          return isHadir ? "H" : isHTL ? "T" : "A";
        }

        const scoreValue = cls.modePembelajaran === "BIMBINGAN"
          ? 3
          : s.contentScore !== null
          ? s.contentScore
          : 0;

        return scoreValue;
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
        formatPct(cls.persenKehadiran),
        cls.modePembelajaran === "BIMBINGAN" ? "Bebas" : `${cls.totalSkor3Pilar}/42`,
        cls.modePembelajaran === "BIMBINGAN" ? "-" : formatPct(cls.persenKonten),
        cls.modePembelajaran === "LURING"
          ? "Bebas Conf"
          : cls.modePembelajaran === "BIMBINGAN"
          ? `UTS: ${cls.confPraUTS}/8 | UAS: ${cls.confPraUAS}/8`
          : `UTS: ${cls.confPraUTS}/3 | UAS: ${cls.confPraUAS}/3`,
        cls.statusEvaluasi === "TERLAKSANA"
          ? "Terlaksana"
          : "Perhatian",
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

        // Color coding untuk kolom Sesi (Col 8 s/d 23)
        if (colNumber >= 8 && colNumber <= 23) {
          const sesiIndex = colNumber - 8;
          const s = cls.sesi[sesiIndex];
          const isHadir = s.kehadiran === "HADIR";
          const isHTL = s.kehadiran === "HADIR_TIDAK_LENGKAP" || s.kehadiran === "HADIR_TDK_LENGKAP";
          const isAlpha = s.kehadiran === "TIDAK_HADIR" || s.kehadiran === "ALPHA";
          const isSub = s && s.dosenPengajar && s.statusPengajar && s.statusPengajar !== "UTAMA";

          // Pewarnaan Sel Presensi (Murni Berdasarkan Status Kehadiran - Tanpa Warna Biru)
          if (isHadir) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFECFDF5" }, // Light Emerald (Hijau)
            };
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF047857" } };
          } else if (isHTL) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFFBEB" }, // Light Amber (Kuning)
            };
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB45309" } };
          } else if (isAlpha) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFEF2F2" }, // Light Rose (Merah)
            };
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB91C1C" } };
          } else {
            cell.font = { name: "Arial", size: 9, bold: false, color: { argb: "FF94A3B8" } };
          }

          // Indikator Border Pengganti jika diajar Dosen Baru atau Pengganti (Persis ring/dot di Web)
          if (isSub) {
            const borderColor =
              s.statusPengajar === "PERGANTIAN_TETAP"
                ? "FF9333EA" // Purple (Dosen Baru)
                : "FFD97706"; // Amber (Dosen Pengganti)
            cell.border = {
              top: { style: "medium", color: { argb: borderColor } },
              left: { style: "medium", color: { argb: borderColor } },
              bottom: { style: "medium", color: { argb: borderColor } },
              right: { style: "medium", color: { argb: borderColor } },
            };
          }
        }

        // Styling kolom 26 (Skor 3 Pilar)
        if (colNumber === 26) {
          if (cls.modePembelajaran === "BIMBINGAN") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF3E8FF" }, // Soft Purple
            };
            cell.font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FF6B21A8" } };
          } else {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFA80063" } };
          }
        }

        // Color coding for Status Evaluasi (Column 29)
        if (colNumber === 29) {
          if (cls.statusEvaluasi === "TERLAKSANA") {
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF047857" } };
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
    logTitle.value = "UNIVERSITAS NUSA PUTRA - CURRICULUM DEVELOPMENT UNIT (CDU)";
    logTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFA80063" } };
    logTitle.alignment = { horizontal: "center", vertical: "middle" };
    logWorksheet.getRow(1).height = 26;

    logWorksheet.mergeCells("A2:K2");
    const logSubtitle = logWorksheet.getCell("A2");
    logSubtitle.value = `LOG RINCIAN PERGANTIAN & DOSEN PENGGANTI - SEMESTER ${
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
            s.dosenPengajar!.nidn || "-",
            jenisStr,
            s.catatanGantiDosen || "-",
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
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "Tidak ada catatan pergantian dosen pada semester ini.",
        "-",
        "-",
        "-",
        "-",
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
    const prodiSuffix = selectedProdiObj ? `_${selectedProdiObj.kode}` : "";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Rekap_Monitoring_3Pilar_CDU${prodiSuffix}_${
          currentSem ? currentSem.tahunAkademik.replace("/", "-") : "2025-2026"
        }.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Excel export error:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat file Excel" }, { status: 500 });
  }
}

