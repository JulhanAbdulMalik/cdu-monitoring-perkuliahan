"use server";
// src/actions/semester.ts
// Server Actions untuk CRUD Semester

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const semesterSchema = z.object({
  tahunAkademik: z
    .string()
    .min(1, "Tahun akademik wajib diisi")
    .regex(/^\d{4}\/\d{4}$/, "Format harus YYYY/YYYY (contoh: 2025/2026)"),
  periode: z.enum(["GANJIL", "GENAP"]),
  aktif: z.boolean().default(false),
  tanggalMulai: z.string().optional().nullable(),
});

export async function getSemesters() {
  try {
    const semesters = await prisma.semester.findMany({
      include: {
        hariLibur: {
          orderBy: { tanggalMulai: "asc" },
        },
        _count: {
          select: { kelas: true },
        },
      },
      orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
    });
    return { success: true, data: semesters };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat data semester" };
  }
}

export async function createSemester(formData: {
  tahunAkademik: string;
  periode: "GANJIL" | "GENAP";
  aktif?: boolean;
  tanggalMulai?: string | Date | null;
}) {
  try {
    const parsed = semesterSchema.parse(formData);

    // Cek apakah semester dengan tahun dan periode yang sama sudah ada
    const existing = await prisma.semester.findFirst({
      where: {
        tahunAkademik: parsed.tahunAkademik,
        periode: parsed.periode,
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Semester ${parsed.tahunAkademik} (${parsed.periode}) sudah terdaftar`,
      };
    }

    // Jika diset aktif, nonaktifkan semester lain terlebih dahulu
    if (parsed.aktif) {
      await prisma.semester.updateMany({
        where: { aktif: true },
        data: { aktif: false },
      });
    }

    const tanggalMulaiDate = parsed.tanggalMulai ? new Date(parsed.tanggalMulai) : null;

    const semester = await prisma.semester.create({
      data: {
        tahunAkademik: parsed.tahunAkademik,
        periode: parsed.periode,
        aktif: parsed.aktif ?? false,
        tanggalMulai: tanggalMulaiDate,
      },
    });

    revalidatePath("/master/semester");
    revalidatePath("/laporan/prodi");
    revalidatePath("/monitoring");
    revalidatePath("/");
    return { success: true, data: semester };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal membuat semester baru" };
  }
}

export async function updateSemester(
  id: string,
  formData: {
    tahunAkademik: string;
    periode: "GANJIL" | "GENAP";
    aktif?: boolean;
    tanggalMulai?: string | Date | null;
  }
) {
  try {
    const parsed = semesterSchema.parse(formData);

    // Cek duplikasi (kecuali dirinya sendiri)
    const existing = await prisma.semester.findFirst({
      where: {
        tahunAkademik: parsed.tahunAkademik,
        periode: parsed.periode,
        NOT: { id },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Semester ${parsed.tahunAkademik} (${parsed.periode}) sudah digunakan`,
      };
    }

    if (parsed.aktif) {
      await prisma.semester.updateMany({
        where: { aktif: true, NOT: { id } },
        data: { aktif: false },
      });
    }

    const tanggalMulaiDate = parsed.tanggalMulai ? new Date(parsed.tanggalMulai) : null;

    const semester = await prisma.semester.update({
      where: { id },
      data: {
        tahunAkademik: parsed.tahunAkademik,
        periode: parsed.periode,
        aktif: parsed.aktif ?? false,
        tanggalMulai: tanggalMulaiDate,
      },
    });

    revalidatePath("/master/semester");
    revalidatePath("/laporan/prodi");
    revalidatePath("/monitoring");
    revalidatePath("/");
    return { success: true, data: semester };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal memperbarui semester" };
  }
}

export async function toggleSemesterAktif(id: string) {
  try {
    // Nonaktifkan semua semester lain
    await prisma.semester.updateMany({
      data: { aktif: false },
    });

    // Aktifkan semester target
    const semester = await prisma.semester.update({
      where: { id },
      data: { aktif: true },
    });

    revalidatePath("/master/semester");
    revalidatePath("/");
    return { success: true, data: semester };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengaktifkan semester" };
  }
}

export async function deleteSemester(id: string) {
  try {
    // Cek apakah ada kelas terhubung
    const semester = await prisma.semester.findUnique({
      where: { id },
      include: {
        _count: {
          select: { kelas: true },
        },
      },
    });

    if (!semester) {
      return { success: false, error: "Semester tidak ditemukan" };
    }

    if (semester._count.kelas > 0) {
      return {
        success: false,
        error: `Tidak dapat menghapus semester karena memiliki ${semester._count.kelas} kelas terdaftar. Hapus data kelas terlebih dahulu.`,
      };
    }

    if (semester.aktif) {
      return {
        success: false,
        error: "Tidak dapat menghapus semester yang sedang aktif. Aktifkan semester lain terlebih dahulu.",
      };
    }

    await prisma.semester.delete({
      where: { id },
    });

    revalidatePath("/master/semester");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus semester" };
  }
}

// ─────────────────────────────────────────
// CRUD LIBUR SEMESTER
// ─────────────────────────────────────────

const liburSemesterSchema = z.object({
  semesterId: z.string().min(1, "Semester wajib dipilih"),
  nama: z.string().min(1, "Nama libur wajib diisi"),
  tanggalMulai: z.string().min(1, "Tanggal mulai libur wajib diisi"),
  tanggalSelesai: z.string().min(1, "Tanggal selesai libur wajib diisi"),
  keterangan: z.string().optional().nullable(),
});

export async function createLiburSemester(data: {
  semesterId: string;
  nama: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  keterangan?: string | null;
}) {
  try {
    const parsed = liburSemesterSchema.parse(data);

    const tglMulai = new Date(`${parsed.tanggalMulai}T00:00:00.000Z`);
    const tglSelesai = new Date(`${parsed.tanggalSelesai}T23:59:59.999Z`);

    if (tglSelesai < tglMulai) {
      return { success: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai" };
    }

    const libur = await prisma.liburSemester.create({
      data: {
        semesterId: parsed.semesterId,
        nama: parsed.nama,
        tanggalMulai: tglMulai,
        tanggalSelesai: tglSelesai,
        keterangan: parsed.keterangan || null,
      },
    });

    revalidatePath("/master/semester");
    revalidatePath("/monitoring");
    revalidatePath("/laporan/prodi");
    revalidatePath("/");
    return { success: true, data: libur };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal menambahkan hari libur" };
  }
}

export async function updateLiburSemester(
  id: string,
  data: {
    nama: string;
    tanggalMulai: string;
    tanggalSelesai: string;
    keterangan?: string | null;
  }
) {
  try {
    const tglMulai = new Date(`${data.tanggalMulai}T00:00:00.000Z`);
    const tglSelesai = new Date(`${data.tanggalSelesai}T23:59:59.999Z`);

    if (tglSelesai < tglMulai) {
      return { success: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai" };
    }

    const updated = await prisma.liburSemester.update({
      where: { id },
      data: {
        nama: data.nama,
        tanggalMulai: tglMulai,
        tanggalSelesai: tglSelesai,
        keterangan: data.keterangan || null,
      },
    });

    revalidatePath("/master/semester");
    revalidatePath("/monitoring");
    revalidatePath("/laporan/prodi");
    revalidatePath("/");
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memperbarui data libur" };
  }
}

export async function deleteLiburSemester(id: string) {
  try {
    await prisma.liburSemester.delete({
      where: { id },
    });

    revalidatePath("/master/semester");
    revalidatePath("/monitoring");
    revalidatePath("/laporan/prodi");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus hari libur" };
  }
}
