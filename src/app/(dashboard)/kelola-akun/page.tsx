// src/app/(dashboard)/kelola-akun/page.tsx
// Halaman Kelola Akun Pengguna — Khusus Role SUPER_ADMIN

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserList } from "@/actions/user";
import { prisma } from "@/lib/prisma";
import UserManagementClient from "./UserManagementClient";

export const metadata: Metadata = {
  title: "Kelola Akun Pengguna",
};

export default async function KelolaAkunPage() {
  const session = await auth();

  // Proteksi: Jika belum login arahkan ke login
  if (!session?.user) {
    redirect("/login");
  }

  // Proteksi Khusus: Hanya SUPER_ADMIN yang diizinkan mengakses halaman ini
  const userRole = (session.user as any)?.role;
  if (userRole !== "SUPER_ADMIN") {
    redirect("/");
  }

  const res = await getUserList();
  const users = res.success && res.data ? res.data : [];

  const allProdis = await prisma.prodi.findMany({
    select: { id: true, nama: true, kode: true },
    orderBy: { nama: "asc" },
  });

  return (
    <UserManagementClient
      initialUsers={users as any}
      currentUserId={session.user.id || ""}
      currentUserEmail={session.user.email || ""}
      allProdis={allProdis}
    />
  );
}
