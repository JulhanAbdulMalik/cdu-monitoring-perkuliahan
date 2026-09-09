"use server";
// src/actions/dosen.ts
// Server Actions untuk CRUD Data Dosen

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const dosenSchema = z.object({
  nama: z.string().min(1, "Nama dosen wajib diisi"),
  nidn: z.string().optional().nullable(),
  email: z.string().email("Format email tidak valid").optional().nullable().or(z.literal("")),
  prodiId: z.string().min(1, "Program studi wajib dipilih"),
});

export async function getDosenList() {
  try {
    const dosen = await prisma.dosen.findMany({
      include: {
        prodi: {
          include: { fakultas: true },
        },
        _count: {
          select: { kelas: true },
        },
      },
      orderBy: { nama: "asc" },
    });

    const prodiList = await prisma.prodi.findMany({
      orderBy: { nama: "asc" },
    });

    return { success: true, data: { dosen, prodiList } };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat data dosen" };
  }
}

export async function createDosen(formData: {
  nama: string;
  nidn?: string;
  email?: string;
  prodiId: string;
}) {
  try {
    const parsed = dosenSchema.parse(formData);

    if (parsed.nidn && parsed.nidn.trim() !== "") {
      const existingNidn = await prisma.dosen.findUnique({
        where: { nidn: parsed.nidn.trim() },
      });
      if (existingNidn) {
        return { success: false, error: `NIDN "${parsed.nidn}" sudah terdaftar pada dosen lain` };
      }
    }

    const cleanEmail = parsed.email && parsed.email.trim() !== "" ? parsed.email.trim() : null;
    if (cleanEmail) {
      const existingEmail = await prisma.dosen.findFirst({
        where: { email: cleanEmail },
      });
      if (existingEmail) {
        return { success: false, error: `Email "${cleanEmail}" sudah digunakan` };
      }
    }

    const data = await prisma.dosen.create({
      data: {
        nama: parsed.nama.trim(),
        nidn: parsed.nidn && parsed.nidn.trim() !== "" ? parsed.nidn.trim() : null,
        email: cleanEmail,
        prodiId: parsed.prodiId,
      },
      include: {
        prodi: true,
      },
    });

    revalidatePath("/master/dosen");
    revalidatePath("/");
    return { success: true, data };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal menambah data dosen" };
  }
}

export async function updateDosen(
  id: string,
  formData: {
    nama: string;
    nidn?: string;
    email?: string;
    prodiId: string;
  }
) {
  try {
    const parsed = dosenSchema.parse(formData);

    if (parsed.nidn && parsed.nidn.trim() !== "") {
      const existingNidn = await prisma.dosen.findFirst({
        where: { nidn: parsed.nidn.trim(), NOT: { id } },
      });
      if (existingNidn) {
        return { success: false, error: `NIDN "${parsed.nidn}" sudah terdaftar pada dosen lain` };
      }
    }

    const cleanEmail = parsed.email && parsed.email.trim() !== "" ? parsed.email.trim() : null;
    if (cleanEmail) {
      const existingEmail = await prisma.dosen.findFirst({
        where: { email: cleanEmail, NOT: { id } },
      });
      if (existingEmail) {
        return { success: false, error: `Email "${cleanEmail}" sudah digunakan` };
      }
    }

    const data = await prisma.dosen.update({
      where: { id },
      data: {
        nama: parsed.nama.trim(),
        nidn: parsed.nidn && parsed.nidn.trim() !== "" ? parsed.nidn.trim() : null,
        email: cleanEmail,
        prodiId: parsed.prodiId,
      },
      include: {
        prodi: true,
      },
    });

    revalidatePath("/master/dosen");
    revalidatePath("/");
    return { success: true, data };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal memperbarui data dosen" };
  }
}

export async function deleteDosen(id: string) {
  try {
    const dosen = await prisma.dosen.findUnique({
      where: { id },
      include: {
        _count: { select: { kelas: true } },
      },
    });

    if (!dosen) return { success: false, error: "Dosen tidak ditemukan" };

    if (dosen._count.kelas > 0) {
      return {
        success: false,
        error: `Tidak dapat menghapus dosen karena mengampu ${dosen._count.kelas} kelas aktif. Hapus kelas terlebih dahulu.`,
      };
    }

    await prisma.dosen.delete({ where: { id } });
    revalidatePath("/master/dosen");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus dosen" };
  }
}
