// src/app/(dashboard)/layout.tsx
// Dashboard layout — Layout responsif sempurna dengan Collapsible Mini Sidebar + Header

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#f8fafc]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full transition-all duration-300">
          <Header />
          <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-[1700px] mx-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
