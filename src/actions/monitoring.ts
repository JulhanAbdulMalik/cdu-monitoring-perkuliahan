"use server";
// src/actions/monitoring.ts
// Server Actions untuk Grid Monitoring 16 Sesi & Import Excel Edlink

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseEdlinkExcel, ParsedSesiData } from "@/lib/excel-parser";

export async function getMonitoringKelasList(semesterId?: string, prodiId?: string) {
  try {
    const activeSemester = await prisma.semester.findFirst({
      where: { aktif: true },
    });

    const targetSemesterId = semesterId || activeSemester?.id;

    const kelasList = await prisma.kelas.findMany({
      where: {
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
        ...(prodiId && prodiId !== "ALL" ? { mataKuliah: { prodiId } } : {}),
      },
      include: {
        semester: {
          include: {
            hariLibur: {
              orderBy: { tanggalMulai: "asc" },
            },
          },
        },
        mataKuliah: { include: { prodi: true } },
        dosen: true,
        monitoringSesi: {
          orderBy: { nomorSesi: "asc" },
        },
      },
      orderBy: [{ mataKuliah: { prodi: { nama: "asc" } } }, { kodeKelas: "asc" }],
    });

    const allSemesters = await prisma.semester.findMany({
      include: {
        hariLibur: {
          orderBy: { tanggalMulai: "asc" },
        },
      },
      orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
    });

    const allProdi = await prisma.prodi.findMany({
      orderBy: { nama: "asc" },
    });

    return {
      success: true,
      data: {
        kelasList,
        semesters: allSemesters,
        prodiList: allProdi,
        activeSemesterId: activeSemester?.id || allSemesters[0]?.id,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat data monitoring kelas" };
  }
}

export async function getMonitoringKelasDetail(kelasId: string) {
  try {
    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      include: {
        semester: {
          include: {
            hariLibur: {
              orderBy: { tanggalMulai: "asc" },
            },
          },
        },
        mataKuliah: { include: { prodi: true } },
        dosen: true,
        monitoringSesi: {
          orderBy: { nomorSesi: "asc" },
        },
      },
    });

    if (!kelas) {
      return { success: false, error: "Kelas tidak ditemukan" };
    }

    return { success: true, data: kelas };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat detail monitoring kelas" };
  }
}

function normalizeKehadiran(val?: string | null): "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | undefined {
  if (!val) return undefined;
  if (val === "ALPHA" || val === "TIDAK_HADIR") return "TIDAK_HADIR";
  if (val === "HADIR_TDK_LENGKAP" || val === "HADIR_TIDAK_LENGKAP") return "HADIR_TIDAK_LENGKAP";
  if (val === "HADIR") return "HADIR";
  return "BELUM_DIISI";
}

export async function updateSingleMonitoringSesi(
  sesiId: string,
  data: {
    kehadiran?: "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | "ALPHA" | "HADIR_TDK_LENGKAP";
    lectureNote?: boolean | null;
    slide?: boolean | null;
    video?: boolean | null;
    conference?: boolean | null;
    tugas?: boolean | null;
    kuis?: boolean | null;
    catatanCdu?: string | null;
    catatan?: string | null;
    tanggal?: string | Date | null;
  }
) {
  try {
    const updatePayload: any = {};
    if (data.kehadiran !== undefined) {
      updatePayload.kehadiran = normalizeKehadiran(data.kehadiran);
    }
    if (data.lectureNote !== undefined) updatePayload.lectureNote = data.lectureNote;
    if (data.slide !== undefined) updatePayload.slide = data.slide;
    if (data.video !== undefined) updatePayload.video = data.video;
    if (data.conference !== undefined) updatePayload.conference = data.conference;
    if (data.tugas !== undefined) updatePayload.tugas = data.tugas;
    if (data.kuis !== undefined) updatePayload.kuis = data.kuis;
    if (data.catatanCdu !== undefined || data.catatan !== undefined) {
      updatePayload.catatanCdu = data.catatanCdu ?? data.catatan ?? null;
    }
    if (data.tanggal !== undefined) {
      updatePayload.tanggal = data.tanggal ? new Date(data.tanggal) : null;
    }

    const updated = await prisma.monitoringSesi.update({
      where: { id: sesiId },
      data: updatePayload,
      select: { id: true, kelasId: true },
    });

    revalidatePath(`/monitoring/${updated.kelasId}`);
    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    revalidatePath("/");
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyimpan perubahan sesi" };
  }
}

export async function updateBatchMonitoringSesi(
  kelasId: string,
  sesiList: Array<{
    id: string;
    kehadiran: "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | "ALPHA" | "HADIR_TDK_LENGKAP";
    lectureNote: boolean | null;
    slide: boolean | null;
    video: boolean | null;
    conference: boolean | null;
    tugas: boolean | null;
    kuis: boolean | null;
    catatanCdu?: string | null;
    catatan?: string | null;
    tanggal?: string | Date | null;
  }>
) {
  try {
    await prisma.$transaction(
      sesiList.map((sesi) => {
        const updateData: any = {
          kehadiran: normalizeKehadiran(sesi.kehadiran) || "BELUM_DIISI",
          lectureNote: sesi.lectureNote,
          slide: sesi.slide,
          video: sesi.video,
          conference: sesi.conference,
          tugas: sesi.tugas,
          kuis: sesi.kuis,
          catatanCdu: sesi.catatanCdu ?? sesi.catatan ?? null,
        };
        if (sesi.tanggal !== undefined) {
          updateData.tanggal = sesi.tanggal ? new Date(sesi.tanggal) : null;
        }
        return prisma.monitoringSesi.update({
          where: { id: sesi.id },
          data: updateData,
        });
      })
    );

    revalidatePath(`/monitoring/${kelasId}`);
    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyimpan perubahan batch sesi" };
  }
}

export async function parseExcelAction(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "File Excel tidak ditemukan" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parseResult = parseEdlinkExcel(buffer);
    if (parseResult.error) {
      return { success: false, error: parseResult.error };
    }

    return {
      success: true,
      data: parseResult,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memproses file Excel" };
  }
}

export async function applyExcelImportToKelas(
  kelasId: string,
  parsedSesiData: ParsedSesiData[]
) {
  try {
    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      include: {
        monitoringSesi: { orderBy: { nomorSesi: "asc" } },
      },
    });

    if (!kelas) {
      return { success: false, error: "Kelas target tidak ditemukan" };
    }

    // Update setiap sesi yang sesuai dengan nomor sesi parsed
    await prisma.$transaction(async (tx) => {
      for (const parsed of parsedSesiData) {
        const targetSesi = kelas.monitoringSesi.find(
          (s) => s.nomorSesi === parsed.nomorSesi
        );

        if (targetSesi) {
          const isExam = parsed.nomorSesi === 8 || parsed.nomorSesi === 16;

          await tx.monitoringSesi.update({
            where: { id: targetSesi.id },
            data: {
              // Kehadiran TIDAK ditimpa jika sudah ada atau tetap dipertahankan
              lectureNote: isExam ? null : parsed.lectureNote,
              slide: isExam ? null : parsed.slide,
              video: isExam ? null : parsed.video,
              conference: isExam ? null : parsed.conference,
              tugas: isExam ? null : parsed.tugas,
              kuis: isExam ? null : parsed.kuis,
            },
          });
        }
      }
    });

    revalidatePath(`/monitoring/${kelasId}`);
    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    revalidatePath("/master/kelas");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menerapkan data Excel ke kelas" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK BATCH ACTIONS (Efisiensi Input Staf CDU)
// ─────────────────────────────────────────────────────────────────────────────

export async function quickSetAllAttendance(
  kelasId: string,
  kehadiran: "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | "ALPHA" | "HADIR_TDK_LENGKAP"
) {
  try {
    const norm = normalizeKehadiran(kehadiran) || "BELUM_DIISI";
    await prisma.monitoringSesi.updateMany({
      where: { kelasId },
      data: { kehadiran: norm },
    });

    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengubah kehadiran massal" };
  }
}

export async function quickSetAllPillars(kelasId: string, setComplete: boolean = true) {
  try {
    // Sesi reguler saja (1-7 & 9-15)
    await prisma.monitoringSesi.updateMany({
      where: {
        kelasId,
        nomorSesi: { notIn: [8, 16] },
      },
      data: {
        slide: setComplete,
        tugas: setComplete,
        video: setComplete,
      },
    });

    revalidatePath("/monitoring");
    revalidatePath("/laporan/rekap");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengatur 3 pilar massal" };
  }
}

