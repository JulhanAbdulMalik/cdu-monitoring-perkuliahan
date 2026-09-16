"use server";
// src/actions/mata-kuliah.ts
// Server Actions untuk CRUD Mata Kuliah

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const mataKuliahSchema = z.object({
  kode: z.string().min(1, "Kode mata kuliah wajib diisi").toUpperCase(),
  nama: z.string().min(1, "Nama mata kuliah wajib diisi"),
  sks: z.coerce.number().min(1, "SKS minimal 1").max(6, "SKS maksimal 6"),
  prodiId: z.string().min(1, "Program studi wajib dipilih"),
});

export async function getMataKuliahList() {
  try {
    const [mataKuliah, prodiList] = await Promise.all([
      prisma.mataKuliah.findMany({
        include: {
          prodi: {
            include: { fakultas: true },
          },
          _count: {
            select: { kelas: true },
          },
        },
        orderBy: [{ prodi: { nama: "asc" } }, { kode: "asc" }],
      }),
      prisma.prodi.findMany({
        orderBy: { nama: "asc" },
      }),
    ]);

    return { success: true, data: { mataKuliah, prodiList } };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat mata kuliah" };
  }
}

export async function createMataKuliah(formData: {
  kode: string;
  nama: string;
  sks: number;
  prodiId: string;
}) {
  try {
    const parsed = mataKuliahSchema.parse(formData);

    const existing = await prisma.mataKuliah.findUnique({
      where: {
        kode_prodiId: {
          kode: parsed.kode.trim(),
          prodiId: parsed.prodiId,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Mata kuliah dengan kode "${parsed.kode}" sudah terdaftar di prodi ini`,
      };
    }

    const data = await prisma.mataKuliah.create({
      data: {
        kode: parsed.kode.trim(),
        nama: parsed.nama.trim(),
        sks: parsed.sks,
        prodiId: parsed.prodiId,
      },
      include: {
        prodi: true,
      },
    });

    revalidatePath("/master/mata-kuliah");
    revalidatePath("/");
    return { success: true, data };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal membuat mata kuliah" };
  }
}

export async function updateMataKuliah(
  id: string,
  formData: {
    kode: string;
    nama: string;
    sks: number;
    prodiId: string;
  }
) {
  try {
    const parsed = mataKuliahSchema.parse(formData);

    const existing = await prisma.mataKuliah.findFirst({
      where: {
        kode: parsed.kode.trim(),
        prodiId: parsed.prodiId,
        NOT: { id },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Mata kuliah dengan kode "${parsed.kode}" sudah terdaftar di prodi ini`,
      };
    }

    const data = await prisma.mataKuliah.update({
      where: { id },
      data: {
        kode: parsed.kode.trim(),
        nama: parsed.nama.trim(),
        sks: parsed.sks,
        prodiId: parsed.prodiId,
      },
      include: {
        prodi: true,
      },
    });

    revalidatePath("/master/mata-kuliah");
    revalidatePath("/");
    return { success: true, data };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal memperbarui mata kuliah" };
  }
}

export async function deleteMataKuliah(id: string) {
  try {
    const mk = await prisma.mataKuliah.findUnique({
      where: { id },
      include: {
        _count: { select: { kelas: true } },
      },
    });

    if (!mk) return { success: false, error: "Mata kuliah tidak ditemukan" };

    if (mk._count.kelas > 0) {
      return {
        success: false,
        error: `Tidak dapat menghapus mata kuliah karena digunakan pada ${mk._count.kelas} kelas aktif.`,
      };
    }

    await prisma.mataKuliah.delete({ where: { id } });
    revalidatePath("/master/mata-kuliah");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus mata kuliah" };
  }
}
