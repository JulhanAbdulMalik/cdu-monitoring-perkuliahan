// src/lib/action-auth.ts
// Helper otentikasi & otorisasi untuk Server Actions
import { auth } from "@/lib/auth";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) {
    throw new Error("Sesi login tidak valid. Silakan masuk terlebih dahulu.");
  }
  return session;
}

export async function requireAdminOrSuper() {
  const session = await requireAuth();
  const role = (session.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Akses ditolak. Fitur ini hanya dapat diakses oleh Administrator atau Super Admin.");
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  const role = (session.user as any)?.role;
  if (role !== "SUPER_ADMIN") {
    throw new Error("Akses ditolak. Fitur ini hanya dapat diakses oleh Super Admin.");
  }
  return session;
}

