"use server";
// src/actions/notification.ts
// Server Actions untuk Fitur Notifikasi Resmi CDU (Pengumuman & Peringatan Pelanggaran)

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { formatExternalUrl } from "@/lib/utils";

export type NotificationType = "PENGUMUMAN" | "PERINGATAN";
export type NotificationTarget = "SEMUA" | "ROLE_DOSEN" | "PRODI" | "USER_SPESIFIK";
export type NotificationUrgency = "PENTING" | "PERINGATAN" | "BAHAYA";

export interface CreateNotificationInput {
  tipe: NotificationType;
  targetTipe: NotificationTarget;
  targetUserId?: string | null;
  targetProdiId?: string | null;
  targetKelasKode?: string | null;
  isPopupLogin?: boolean;
  judul: string;
  pesan: string;
  urgensi: NotificationUrgency;
  tautanUrl?: string | null;
  isSelesai?: boolean;
  kadaluarsaPada?: string | Date | null;
}

export interface UserNotificationItem {
  id: string;
  tipe: NotificationType;
  targetTipe: NotificationTarget;
  targetKelasKode?: string | null;
  isPopupLogin?: boolean;
  judul: string;
  pesan: string;
  urgensi: NotificationUrgency;
  tautanUrl?: string | null;
  isRead: boolean;
  createdAt: Date | string;
  isSelesai?: boolean;
  kadaluarsaPada?: Date | string | null;
  dibuatOleh: {
    id: string;
    name: string;
    role: string;
  };
}

export interface ManagementNotificationItem {
  id: string;
  tipe: NotificationType;
  targetTipe: NotificationTarget;
  targetUserId?: string | null;
  targetProdiId?: string | null;
  targetKelasKode?: string | null;
  isPopupLogin?: boolean;
  judul: string;
  pesan: string;
  urgensi: NotificationUrgency;
  tautanUrl?: string | null;
  isSelesai: boolean;
  kadaluarsaPada?: Date | string | null;
  createdAt: Date | string;
  readCount: number;
  dibuatOleh: {
    id: string;
    name: string;
    role: string;
  };
  targetUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

/**
 * Mengambil notifikasi aktif yang relevan untuk user yang sedang login
 * (Digunakan oleh ikon Bell di Topbar Header)
 */
export async function getUserNotifications(): Promise<{
  success: boolean;
  data?: {
    items: UserNotificationItem[];
    unreadCount: number;
  };
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const currentUserId = session.user.id;
    const userRole = (session.user as any)?.role;
    const userProdiIds: string[] = ((session.user as any)?.prodiIds as string[]) || [];

    // Filter kondisi target notifikasi
    const targetConditions: any[] = [
      { targetTipe: "SEMUA" },
      { targetTipe: "USER_SPESIFIK", targetUserId: currentUserId },
    ];

    if (userRole === "DOSEN") {
      targetConditions.push({ targetTipe: "ROLE_DOSEN" });
    }

    if (userProdiIds.length > 0) {
      targetConditions.push({
        targetTipe: "PRODI",
        targetProdiId: { in: userProdiIds },
      });
    }

    const db = prisma as any;
    if (!db.notification) {
      console.warn("prisma.notification belum siap di runtime. Silakan restart next dev.");
      return { success: true, data: { items: [], unreadCount: 0 } };
    }

    const now = new Date();
    const rawNotifications = await db.notification.findMany({
      where: {
        isSelesai: false,
        OR: [
          { kadaluarsaPada: null },
          { kadaluarsaPada: { gt: now } },
        ],
        AND: [
          { OR: targetConditions },
        ],
      },
      include: {
        dibuatOleh: {
          select: { id: true, name: true, role: true },
        },
        pembaca: {
          where: { userId: currentUserId },
          select: { id: true, readAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    let unreadCount = 0;
    const items: UserNotificationItem[] = rawNotifications.map((n: any) => {
      const isRead = n.pembaca && n.pembaca.length > 0;
      if (!isRead) unreadCount++;

      return {
        id: n.id,
        tipe: n.tipe,
        targetTipe: n.targetTipe,
        targetKelasKode: n.targetKelasKode,
        isPopupLogin: n.targetKelasKode === "POPUP_LOGIN",
        judul: n.judul,
        pesan: n.pesan,
        urgensi: n.urgensi,
        tautanUrl: n.tautanUrl,
        isRead,
        createdAt: n.createdAt,
        dibuatOleh: n.dibuatOleh,
      };
    });

    return {
      success: true,
      data: {
        items,
        unreadCount,
      },
    };
  } catch (error: any) {
    console.error("Error getUserNotifications:", error);
    return { success: false, error: error.message || "Gagal memuat notifikasi" };
  }
}

/**
 * Menandai notifikasi spesifik sebagai sudah dibaca oleh user
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await (prisma as any).notificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId,
          userId: session.user.id,
        },
      },
      create: {
        notificationId,
        userId: session.user.id,
      },
      update: {},
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error markNotificationAsRead:", error);
    return { success: false, error: error.message || "Gagal menandai notifikasi" };
  }
}

/**
 * Menandai semua notifikasi user sebagai sudah dibaca sekaligus
 */
export async function markAllNotificationsAsRead() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const currentUserId = session.user.id;
    const userRole = (session.user as any)?.role;
    const userProdiIds: string[] = ((session.user as any)?.prodiIds as string[]) || [];

    const targetConditions: any[] = [
      { targetTipe: "SEMUA" },
      { targetTipe: "USER_SPESIFIK", targetUserId: currentUserId },
    ];

    if (userRole === "DOSEN") {
      targetConditions.push({ targetTipe: "ROLE_DOSEN" });
    }

    if (userProdiIds.length > 0) {
      targetConditions.push({
        targetTipe: "PRODI",
        targetProdiId: { in: userProdiIds },
      });
    }

    const db = prisma as any;
    if (!db.notification || !db.notificationRead) {
      return { success: true };
    }

    // Ambil semua notifikasi aktif yang belum dibaca oleh user
    const now = new Date();
    const unreadNotifications = await db.notification.findMany({
      where: {
        isSelesai: false,
        OR: [
          { kadaluarsaPada: null },
          { kadaluarsaPada: { gt: now } },
        ],
        AND: [
          { OR: targetConditions },
        ],
        pembaca: {
          none: { userId: currentUserId },
        },
      },
      select: { id: true },
    });

    if (unreadNotifications.length > 0) {
      await (prisma as any).notificationRead.createMany({
        data: unreadNotifications.map((n: any) => ({
          notificationId: n.id,
          userId: currentUserId,
        })),
        skipDuplicates: true,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error markAllNotificationsAsRead:", error);
    return { success: false, error: error.message || "Gagal menandai semua notifikasi" };
  }
}

/**
 * Khusus Admin & Super Admin: Membuat Pengumuman Resmi atau Peringatan Pelanggaran
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return { success: false, error: "Akses ditolak: Hanya Admin dan Super Admin yang dapat membuat notifikasi" };
    }

    if (!input.judul || input.judul.trim().length < 3) {
      return { success: false, error: "Judul notifikasi minimal 3 karakter" };
    }

    if (!input.pesan || input.pesan.trim().length < 5) {
      return { success: false, error: "Isi pesan notifikasi minimal 5 karakter" };
    }

    if (input.targetTipe === "USER_SPESIFIK" && !input.targetUserId) {
      return { success: false, error: "Harap pilih pengguna/dosen penerima peringatan" };
    }

    if (input.targetTipe === "PRODI" && !input.targetProdiId) {
      return { success: false, error: "Harap pilih Program Studi target pengumuman" };
    }

    const db = prisma as any;
    if (!db.notification) {
      return { success: false, error: "Database notifikasi sedang sinkronisasi. Silakan refresh halaman atau restart npm run dev." };
    }

    const targetKelas = input.isPopupLogin
      ? "POPUP_LOGIN"
      : input.targetKelasKode
      ? input.targetKelasKode.trim()
      : null;

    let kadaluarsaDate: Date | null = null;
    if (input.kadaluarsaPada) {
      if (typeof input.kadaluarsaPada === "string" && input.kadaluarsaPada.length === 10) {
        kadaluarsaDate = new Date(`${input.kadaluarsaPada}T23:59:59.999+07:00`);
      } else {
        const parsed = new Date(input.kadaluarsaPada);
        if (!isNaN(parsed.getTime())) {
          kadaluarsaDate = parsed;
        }
      }
    }

    const createData: any = {
      tipe: input.tipe,
      targetTipe: input.targetTipe,
      targetProdiId: input.targetTipe === "PRODI" ? (input.targetProdiId || null) : null,
      targetKelasKode: targetKelas,
      judul: input.judul.trim(),
      pesan: input.pesan.trim(),
      urgensi: input.urgensi || "PENTING",
      tautanUrl: input.tautanUrl && input.tautanUrl.trim() ? formatExternalUrl(input.tautanUrl.trim()) : null,
      isSelesai: Boolean(input.isSelesai),
      kadaluarsaPada: kadaluarsaDate,
      dibuatOlehId: session?.user?.id!,
    };

    if (input.targetUserId) {
      createData.targetUser = { connect: { id: input.targetUserId } };
    }

    const newNotif = await db.notification.create({
      data: createData,
    });

    revalidatePath("/kelola-notifikasi");
    return { success: true, data: newNotif };
  } catch (error: any) {
    console.error("Error createNotification:", error);
    return { success: false, error: error.message || "Gagal membuat notifikasi" };
  }
}

/**
 * Khusus Admin & Super Admin: Memperbarui Notifikasi yang sudah ada
 */
export async function updateNotification(
  id: string,
  input: CreateNotificationInput
) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;

    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return {
        success: false,
        error: "Akses ditolak: Hanya Admin dan Super Admin yang dapat mengubah notifikasi",
      };
    }

    if (!input.judul || input.judul.trim().length < 3) {
      return { success: false, error: "Judul notifikasi minimal 3 karakter" };
    }

    if (!input.pesan || input.pesan.trim().length < 5) {
      return { success: false, error: "Isi pesan notifikasi minimal 5 karakter" };
    }

    if (input.targetTipe === "USER_SPESIFIK" && !input.targetUserId) {
      return { success: false, error: "Harap pilih pengguna/dosen penerima peringatan" };
    }

    if (input.targetTipe === "PRODI" && !input.targetProdiId) {
      return { success: false, error: "Harap pilih Program Studi target pengumuman" };
    }

    const db = prisma as any;
    if (!db.notification) {
      return {
        success: false,
        error: "Database notifikasi sedang sinkronisasi. Silakan refresh halaman.",
      };
    }

    const targetKelas = input.isPopupLogin
      ? "POPUP_LOGIN"
      : input.targetKelasKode
      ? input.targetKelasKode.trim()
      : null;

    let kadaluarsaDate: Date | null = null;
    if (input.kadaluarsaPada) {
      if (typeof input.kadaluarsaPada === "string" && input.kadaluarsaPada.length === 10) {
        kadaluarsaDate = new Date(`${input.kadaluarsaPada}T23:59:59.999+07:00`);
      } else {
        const parsed = new Date(input.kadaluarsaPada);
        if (!isNaN(parsed.getTime())) {
          kadaluarsaDate = parsed;
        }
      }
    }

    const updateData: any = {
      tipe: input.tipe,
      targetTipe: input.targetTipe,
      targetProdiId: input.targetTipe === "PRODI" ? (input.targetProdiId || null) : null,
      targetKelasKode: targetKelas,
      judul: input.judul.trim(),
      pesan: input.pesan.trim(),
      urgensi: input.urgensi || "PENTING",
      tautanUrl: input.tautanUrl && input.tautanUrl.trim() ? formatExternalUrl(input.tautanUrl.trim()) : null,
      isSelesai: typeof input.isSelesai === "boolean" ? input.isSelesai : false,
      kadaluarsaPada: kadaluarsaDate,
    };

    if (input.targetUserId) {
      updateData.targetUser = { connect: { id: input.targetUserId } };
    } else {
      updateData.targetUser = { disconnect: true };
    }

    const updated = await db.notification.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/kelola-notifikasi");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error updateNotification:", error);
    return { success: false, error: error.message || "Gagal memperbarui notifikasi" };
  }
}

/**
 * Khusus Admin & Super Admin: Mengambil riwayat seluruh notifikasi yang telah terbit
 */
export async function getNotificationManagementList(): Promise<{
  success: boolean;
  data?: ManagementNotificationItem[];
  error?: string;
}> {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return { success: false, error: "Akses ditolak" };
    }

    const db = prisma as any;
    if (!db.notification) {
      console.warn("prisma.notification belum siap di runtime. Silakan restart next dev.");
      return { success: true, data: [] };
    }

    const notifications = await db.notification.findMany({
      include: {
        dibuatOleh: {
          select: { id: true, name: true, role: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { pembaca: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data: ManagementNotificationItem[] = notifications.map((n: any) => {
      const isExpired = n.kadaluarsaPada && new Date(n.kadaluarsaPada).getTime() <= Date.now();
      const isSelesai = Boolean(n.isSelesai || isExpired);

      return {
        id: n.id,
        tipe: n.tipe,
        targetTipe: n.targetTipe,
        targetUserId: n.targetUserId,
        targetProdiId: n.targetProdiId,
        targetKelasKode: n.targetKelasKode,
        isPopupLogin: n.targetKelasKode === "POPUP_LOGIN",
        judul: n.judul,
        pesan: n.pesan,
        urgensi: n.urgensi,
        tautanUrl: n.tautanUrl,
        isSelesai,
        kadaluarsaPada: n.kadaluarsaPada ? n.kadaluarsaPada.toISOString() : null,
        createdAt: n.createdAt,
        readCount: n._count?.pembaca ?? 0,
        dibuatOleh: n.dibuatOleh,
        targetUser: n.targetUser,
      };
    });

    return { success: true, data };
  } catch (error: any) {
    console.error("Error getNotificationManagementList:", error);
    return { success: false, error: error.message || "Gagal memuat riwayat notifikasi" };
  }
}

/**
 * Khusus Admin & Super Admin: Menghapus notifikasi
 */
export async function deleteNotification(notificationId: string) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return { success: false, error: "Akses ditolak" };
    }

    const db = prisma as any;
    if (!db.notification) {
      return { success: false, error: "Model notifikasi belum siap" };
    }

    await db.notification.delete({
      where: { id: notificationId },
    });

    revalidatePath("/kelola-notifikasi");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleteNotification:", error);
    return { success: false, error: error.message || "Gagal menghapus notifikasi" };
  }
}

/**
 * Khusus Admin & Super Admin: Mengubah status Selesai / Aktif notifikasi
 */
export async function toggleNotificationStatus(notificationId: string, isSelesai: boolean) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return { success: false, error: "Akses ditolak" };
    }

    const db = prisma as any;
    if (!db.notification) {
      return { success: false, error: "Model notifikasi belum siap" };
    }

    const updated = await db.notification.update({
      where: { id: notificationId },
      data: { isSelesai },
    });

    revalidatePath("/kelola-notifikasi");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error toggleNotificationStatus:", error);
    return { success: false, error: error.message || "Gagal memperbarui status notifikasi" };
  }
}

/**
 * Khusus Admin & Super Admin: Mengambil opsi target (daftar Dosen/User, Prodi, dan Kelas) untuk form
 */
export async function getNotificationTargetOptions() {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return { success: false, error: "Akses ditolak" };
    }

    const [dosenUsers, prodis, activeClasses] = await Promise.all([
      prisma.user.findMany({
        where: { role: "DOSEN" },
        select: {
          id: true,
          name: true,
          email: true,
          prodis: { select: { id: true, nama: true, kode: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.prodi.findMany({
        select: { id: true, nama: true, kode: true },
        orderBy: { nama: "asc" },
      }),
      prisma.kelas.findMany({
        where: { semester: { aktif: true } },
        select: {
          id: true,
          kodeKelas: true,
          mataKuliah: { select: { nama: true } },
          dosen: { select: { nama: true } },
        },
        orderBy: { kodeKelas: "asc" },
        take: 100,
      }),
    ]);

    return {
      success: true,
      data: {
        dosenUsers,
        prodis,
        activeClasses,
      },
    };
  } catch (error: any) {
    console.error("Error getNotificationTargetOptions:", error);
    return { success: false, error: error.message || "Gagal memuat opsi target" };
  }
}
