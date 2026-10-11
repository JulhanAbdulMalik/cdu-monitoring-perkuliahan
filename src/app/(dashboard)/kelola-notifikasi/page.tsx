// src/app/(dashboard)/kelola-notifikasi/page.tsx
// Halaman Pusat Kelola Notifikasi & Pengumuman CDU - Khusus Role ADMIN & SUPER_ADMIN

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getNotificationManagementList,
  getNotificationTargetOptions,
} from "@/actions/notification";
import NotificationManagerClient from "./NotificationManagerClient";

export const metadata: Metadata = {
  title: "Pusat Kelola Notifikasi & Pengumuman CDU",
};

export default async function KelolaNotifikasiPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = (session.user as any)?.role;
  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    redirect("/");
  }

  const [listRes, optionsRes] = await Promise.all([
    getNotificationManagementList(),
    getNotificationTargetOptions(),
  ]);

  const notifications = listRes.success && listRes.data ? listRes.data : [];
  const targetOptions = optionsRes.success && optionsRes.data ? optionsRes.data : {
    dosenUsers: [],
    prodis: [],
    activeClasses: [],
  };

  return (
    <NotificationManagerClient
      initialNotifications={notifications}
      targetOptions={targetOptions}
      currentUserRole={userRole}
    />
  );
}
