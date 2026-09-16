"use server";
// src/actions/user.ts
// Server Actions untuk Kelola Akun Pengguna (Khusus Role SUPER_ADMIN)

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";

// Skema validasi pengguna baru
const createUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "DOSEN"]),
  prodiIds: z.array(z.string()).optional(),
});

// Skema validasi pembaruan pengguna
const updateUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "DOSEN"]),
  password: z.string().optional(),
  prodiIds: z.array(z.string()).optional(),
});

// Helper untuk memeriksa otorisasi Super Admin
async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Sesi login tidak valid. Silakan masuk terlebih dahulu.");
  }
  const role = (session.user as any)?.role;
  if (role !== "SUPER_ADMIN") {
    throw new Error("Akses ditolak. Fitur ini hanya dapat diakses oleh Super Admin.");
  }
  return session;
}

export async function getUserList() {
  try {
    await requireSuperAdmin();

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        prodis: {
          select: {
            id: true,
            nama: true,
            kode: true,
          },
          orderBy: { nama: "asc" },
        },
        _count: {
          select: {
            monitoringUpdates: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return { success: true, data: users };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memuat daftar pengguna" };
  }
}

export async function createUser(formData: {
  name: string;
  email: string;
  password: string;
  role: "SUPER_ADMIN" | "ADMIN" | "DOSEN";
  prodiIds?: string[];
}) {
  try {
    await requireSuperAdmin();

    const parsed = createUserSchema.parse(formData);
    const email = parsed.email.trim().toLowerCase();

    // Cek duplikasi email
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return { success: false, error: `Email "${email}" sudah terdaftar di sistem` };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(parsed.password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: parsed.name.trim(),
        email,
        password: hashedPassword,
        role: parsed.role as Role,
        prodis:
          parsed.prodiIds && parsed.prodiIds.length > 0
            ? { connect: parsed.prodiIds.map((id) => ({ id })) }
            : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        prodis: {
          select: { id: true, nama: true, kode: true },
        },
      },
    });

    revalidatePath("/kelola-akun");
    return { success: true, data: newUser };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Validasi data akun gagal",
      };
    }
    return { success: false, error: error.message || "Gagal membuat akun baru" };
  }
}

export async function updateUser(
  id: string,
  formData: {
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "ADMIN" | "DOSEN";
    password?: string;
    prodiIds?: string[];
  }
) {
  try {
    await requireSuperAdmin();

    const parsed = updateUserSchema.parse(formData);
    const email = parsed.email.trim().toLowerCase();

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return { success: false, error: "Akun pengguna tidak ditemukan" };
    }

    // Cek apakah email baru sudah dipakai user lain
    if (email !== targetUser.email) {
      const emailConflict = await prisma.user.findUnique({ where: { email } });
      if (emailConflict) {
        return { success: false, error: `Email "${email}" sudah digunakan akun lain` };
      }
    }

    const updateData: any = {
      name: parsed.name.trim(),
      email,
      role: parsed.role as Role,
      prodis: {
        set: (parsed.prodiIds || []).map((id) => ({ id })),
      },
    };

    // Jika password baru diberikan dan tidak kosong
    if (parsed.password && parsed.password.trim().length > 0) {
      if (parsed.password.trim().length < 6) {
        return { success: false, error: "Password baru minimal 6 karakter" };
      }
      updateData.password = await bcrypt.hash(parsed.password.trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
        prodis: {
          select: { id: true, nama: true, kode: true },
        },
      },
    });

    revalidatePath("/kelola-akun");
    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Validasi pembaruan akun gagal",
      };
    }
    return { success: false, error: error.message || "Gagal memperbarui akun pengguna" };
  }
}

export async function deleteUser(id: string) {
  try {
    const session = await requireSuperAdmin();

    // Cegah Super Admin menghapus akunnya sendiri
    if (session.user.id === id) {
      return {
        success: false,
        error: "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan",
      };
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return { success: false, error: "Akun pengguna tidak ditemukan" };
    }

    await prisma.user.delete({
      where: { id },
    });

    revalidatePath("/kelola-akun");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus akun pengguna" };
  }
}
