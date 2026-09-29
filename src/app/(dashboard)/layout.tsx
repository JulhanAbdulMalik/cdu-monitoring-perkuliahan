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
  let activeSemester: {
    id: string;
    tahunAkademik: string;
    periode: string;
  } | null = null;

  try {
    const [dbUser, sem] = await Promise.all([
      session?.user?.id && (session.user as any).role === "DOSEN"
        ? prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
              prodis: {
                select: { id: true, nama: true, kode: true },
              },
            },
          })
        : null,
      prisma.semester.findFirst({
        where: { aktif: true },
        select: { id: true, tahunAkademik: true, periode: true },
      }),
    ]);

    if (dbUser?.prodis) {
      userProdis = dbUser.prodis;
    }

    if (sem) {
      activeSemester = sem;
    } else {
      activeSemester = await prisma.semester.findFirst({
        orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
        select: { id: true, tahunAkademik: true, periode: true },
      });
    }
  } catch (err) {
    console.error("Error fetching layout data (user prodis & active semester):", err);
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#f8fafc]">
        <Sidebar activeSemester={activeSemester} />
        <div className="flex-1 flex flex-col min-w-0 w-full transition-all duration-300">
          <Header initialProdis={userProdis} activeSemester={activeSemester} />
          <main className="flex-1 p-3 sm:p-4 md:p-5 w-full">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
