"use server";
// src/actions/prodi.ts
// Server Actions untuk CRUD Fakultas & Program Studi

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const fakultasSchema = z.object({
  nama: z.string().min(1, "Nama fakultas wajib diisi"),
});

const prodiSchema = z.object({
  nama: z.string().min(1, "Nama program studi wajib diisi"),
  kode: z.string().min(1, "Kode prodi wajib diisi").toUpperCase(),
  fakultasId: z.string().min(1, "Fakultas wajib dipilih"),
});

export async function getFakultasAndProdi() {
  try {
    const fakultas = await prisma.fakultas.findMany({
      include: {
        prodi: {
          include: {
            _count: {
              select: { dosen: true, mataKuliah: true },
            },
          },
          orderBy: { nama: "asc" },
        },
        _count: {
          select: { prodi: true },
        },
      },
      orderBy: { nama: "asc" },
    });

    const allProdi = await prisma.prodi.findMany({
      include: {
        fakultas: true,
        _count: {
          select: { dosen: true, mataKuliah: true },
        },
      },
      orderBy: { nama: "asc" },
    });

    return { success: true, data: { fakultas, prodi: allProdi } };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat data prodi" };
  }
}

// ── Fakultas Actions ──────────────────────────────────────────────────────────

export async function createFakultas(nama: string) {
  try {
    const parsed = fakultasSchema.parse({ nama });

    const existing = await prisma.fakultas.findUnique({
      where: { nama: parsed.nama },
    });

    if (existing) {
      return { success: false, error: `Fakultas "${parsed.nama}" sudah ada` };
    }

    const data = await prisma.fakultas.create({
      data: { nama: parsed.nama },
    });

    revalidatePath("/master/prodi");
    return { success: true, data };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal membuat fakultas" };
  }
}

export async function updateFakultas(id: string, nama: string) {
  try {
    const parsed = fakultasSchema.parse({ nama });

    const existing = await prisma.fakultas.findFirst({
      where: { nama: parsed.nama, NOT: { id } },
    });

    if (existing) {
      return { success: false, error: `Nama fakultas "${parsed.nama}" sudah digunakan` };
    }

    const data = await prisma.fakultas.update({
      where: { id },
      data: { nama: parsed.nama },
    });

    revalidatePath("/master/prodi");
    return { success: true, data };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal memperbarui fakultas" };
  }
}

export async function deleteFakultas(id: string) {
  try {
    const fakultas = await prisma.fakultas.findUnique({
      where: { id },
      include: {
        _count: { select: { prodi: true } },
      },
    });

    if (!fakultas) return { success: false, error: "Fakultas tidak ditemukan" };

    if (fakultas._count.prodi > 0) {
      return {
        success: false,
        error: `Fakultas memiliki ${fakultas._count.prodi} Program Studi terhubung. Hapus atau pindahkan prodi terlebih dahulu.`,
      };
    }

    await prisma.fakultas.delete({ where: { id } });
    revalidatePath("/master/prodi");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus fakultas" };
  }
}

// ── Prodi Actions ─────────────────────────────────────────────────────────────

export async function createProdi(formData: {
  nama: string;
  kode: string;
  fakultasId: string;
}) {
  try {
    const parsed = prodiSchema.parse(formData);

    const existingKode = await prisma.prodi.findUnique({
      where: { kode: parsed.kode },
    });

    if (existingKode) {
      return { success: false, error: `Kode Prodi "${parsed.kode}" sudah digunakan` };
    }

    const data = await prisma.prodi.create({
      data: {
        nama: parsed.nama,
        kode: parsed.kode,
        fakultasId: parsed.fakultasId,
      },
    });

    revalidatePath("/master/prodi");
    return { success: true, data };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal membuat program studi" };
  }
}

export async function updateProdi(
  id: string,
  formData: {
    nama: string;
    kode: string;
    fakultasId: string;
  }
) {
  try {
    const parsed = prodiSchema.parse(formData);

    const existingKode = await prisma.prodi.findFirst({
      where: { kode: parsed.kode, NOT: { id } },
    });

    if (existingKode) {
      return { success: false, error: `Kode Prodi "${parsed.kode}" sudah digunakan` };
    }

    const data = await prisma.prodi.update({
      where: { id },
      data: {
        nama: parsed.nama,
        kode: parsed.kode,
        fakultasId: parsed.fakultasId,
      },
    });

    revalidatePath("/master/prodi");
    return { success: true, data };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).issues?.[0]?.message || (error as any).errors?.[0]?.message || "Validasi gagal" };
    }
    return { success: false, error: error.message || "Gagal memperbarui program studi" };
  }
}

export async function deleteProdi(id: string) {
  try {
    const prodi = await prisma.prodi.findUnique({
      where: { id },
      include: {
        _count: {
          select: { dosen: true, mataKuliah: true },
        },
      },
    });

    if (!prodi) return { success: false, error: "Program studi tidak ditemukan" };

    if (prodi._count.dosen > 0 || prodi._count.mataKuliah > 0) {
      return {
        success: false,
        error: `Program Studi memiliki ${prodi._count.dosen} dosen dan ${prodi._count.mataKuliah} mata kuliah terdaftar.`,
      };
    }

    await prisma.prodi.delete({ where: { id } });
    revalidatePath("/master/prodi");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus program studi" };
  }
}
