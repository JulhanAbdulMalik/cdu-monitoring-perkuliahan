// src/app/(dashboard)/master/layout.tsx
// Server-side layout guard: Data Master hanya dapat diakses oleh SUPER_ADMIN

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = (session.user as any)?.role;
  if (userRole !== "SUPER_ADMIN") {
    redirect("/");
  }

  return <>{children}</>;
}
