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
    const [dosen, prodiList] = await Promise.all([
      prisma.dosen.findMany({
        include: {
          prodi: {
            include: { fakultas: true },
          },
          _count: {
            select: { kelas: true },
          },
        },
        orderBy: { nama: "asc" },
      }),
      prisma.prodi.findMany({
        orderBy: { nama: "asc" },
      }),
    ]);

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

export interface ResetDosenStats {
  totalCount: number;
  zeroClassCount: number;
  hasClassCount: number;
  prodiNama: string;
}

export async function getResetDosenStats(options: { prodiId?: string }) {
  try {
    const whereBase: any = {};
    if (options.prodiId && options.prodiId !== "ALL") {
      whereBase.prodiId = options.prodiId;
    }

    const [totalCount, zeroClassCount, hasClassCount] = await Promise.all([
      prisma.dosen.count({ where: whereBase }),
      prisma.dosen.count({
        where: {
          ...whereBase,
          kelas: { none: {} },
        },
      }),
      prisma.dosen.count({
        where: {
          ...whereBase,
          kelas: { some: {} },
        },
      }),
    ]);

    let prodiNama = "Semua Program Studi";
    if (options.prodiId && options.prodiId !== "ALL") {
      const p = await prisma.prodi.findUnique({ where: { id: options.prodiId } });
      if (p) prodiNama = p.nama;
    }

    return {
      success: true,
      data: {
        totalCount,
        zeroClassCount,
        hasClassCount,
        prodiNama,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengambil statistik dosen" };
  }
}

export async function resetDosenData(options: {
  prodiId?: string;
  onlyZeroClasses?: boolean;
}) {
  try {
    const whereFilter: any = {};
    if (options.prodiId && options.prodiId !== "ALL") {
      whereFilter.prodiId = options.prodiId;
    }

    if (options.onlyZeroClasses) {
      whereFilter.kelas = { none: {} };
    }

    // Ambil list dosen yang sesuai kriteria
    const targetDosen = await prisma.dosen.findMany({
      where: whereFilter,
      select: {
        id: true,
        nama: true,
        _count: { select: { kelas: true } },
      },
    });

    if (targetDosen.length === 0) {
      return {
        success: true,
        countDosen: 0,
        message: "Tidak ada data dosen yang sesuai dengan kriteria yang dipilih.",
      };
    }

    // Periksa apakah ada dosen yang masih mengampu kelas (jika onlyZeroClasses = false)
    const dosenWithClasses = targetDosen.filter((d) => d._count.kelas > 0);
    if (dosenWithClasses.length > 0 && !options.onlyZeroClasses) {
      return {
        success: false,
        error: `Terdapat ${dosenWithClasses.length} dosen yang masih terhubung ke kelas aktif. Bersihkan data di menu Data Perkuliahan terlebih dahulu, atau pilih opsi 'Hanya hapus dosen tanpa kelas aktif'.`,
      };
    }

    const targetIds = targetDosen.map((d) => d.id);

    // Nullify monitoringSesi dosenPengajarId jika ada yang merujuk ke dosen-dosen ini
    await prisma.monitoringSesi.updateMany({
      where: { dosenPengajarId: { in: targetIds } },
      data: { dosenPengajarId: null },
    });

    // Hapus dosen secara batch
    const deleteResult = await prisma.dosen.deleteMany({
      where: { id: { in: targetIds } },
    });

    revalidatePath("/master/dosen");
    revalidatePath("/master/kelas");
    revalidatePath("/");

    return {
      success: true,
      countDosen: deleteResult.count,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membersihkan data dosen" };
  }
}

