// src/app/(dashboard)/layout.tsx
// Dashboard layout - Layout responsif sempurna dengan Collapsible Mini Sidebar + Header

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  let userProdis: { id: string; nama: string; kode: string }[] = [];

  if (session?.user?.id && (session.user as any).role === "DOSEN") {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          prodis: {
            select: { id: true, nama: true, kode: true },
          },
        },
      });
      if (dbUser?.prodis) {
        userProdis = dbUser.prodis;
      }
    } catch (err) {
      console.error("Error fetching user prodis for header:", err);
    }
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#f8fafc]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full transition-all duration-300">
          <Header initialProdis={userProdis} />
          <main className="flex-1 p-3 sm:p-4 md:p-5 w-full">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
