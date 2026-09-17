// src/app/(dashboard)/layout.tsx
// Dashboard layout - Layout responsif sempurna dengan Collapsible Mini Sidebar + Header

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { SidebarProvider } from "@/components/layout/SidebarContext";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#f8fafc]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full transition-all duration-300">
          <Header />
          <main className="flex-1 p-3 sm:p-4 md:p-5 w-full">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
