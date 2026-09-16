"use client";
// src/components/layout/Sidebar.tsx
// Compact & Collapsible Mini / Full Sidebar with Plus Jakarta Sans & #a80063 Brand
// Completely free from horizontal scrollbars (overflow-x-hidden)

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ClipboardCheck,
  FileSpreadsheet,
  BarChart3,
  Users,
  Building2,
  Calendar,
  Layers,
  GraduationCap,
  BookOpen,
  School,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";

interface NavGroup {
  category: string;
  allowedRoles?: ("SUPER_ADMIN" | "ADMIN" | "DOSEN")[];
  items: {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
    allowedRoles?: ("SUPER_ADMIN" | "ADMIN" | "DOSEN")[];
    children?: { label: string; href: string }[];
  }[];
}

const navGroups: NavGroup[] = [
  {
    category: "MAIN",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "DOSEN"],
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    category: "MONITORING",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
    items: [
      {
        label: "Monitoring Kelas",
        href: "/monitoring",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    category: "LAPORAN",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "DOSEN"],
    items: [
      {
        label: "Rekapitulasi Sesi",
        href: "/laporan/rekap",
        icon: BarChart3,
      },
      {
        label: "Laporan per Dosen",
        href: "/laporan/dosen",
        icon: Users,
      },
      {
        label: "Laporan per Prodi",
        href: "/laporan/prodi",
        icon: Building2,
      },
    ],
  },
  {
    category: "DATA MASTER",
    allowedRoles: ["SUPER_ADMIN"],
    items: [
      {
        label: "Semester",
        href: "/master/semester",
        icon: Calendar,
      },
      {
        label: "Fakultas & Prodi",
        href: "/master/prodi",
        icon: Layers,
      },
      {
        label: "Data Dosen",
        href: "/master/dosen",
        icon: GraduationCap,
      },
      {
        label: "Data Perkuliahan",
        href: "/master/kelas",
        icon: School,
      },
    ],
  },
  {
    category: "PENGATURAN",
    allowedRoles: ["SUPER_ADMIN"],
    items: [
      {
        label: "Kelola Akun",
        href: "/kelola-akun",
        icon: ShieldCheck,
        badge: "Super",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const userRole = (session?.user as any)?.role as "SUPER_ADMIN" | "ADMIN" | "DOSEN" | undefined;

  const filteredNavGroups = navGroups
    .filter((group) => !group.allowedRoles || (userRole && group.allowedRoles.includes(userRole)))
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.allowedRoles || (userRole && item.allowedRoles.includes(userRole))
      ),
    }))
    .filter((group) => group.items.length > 0);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "shrink-0 bg-white sticky top-0 h-screen flex flex-col z-40 border-r border-slate-200/70 shadow-[1px_0_8px_rgba(0,0,0,0.015)] transition-all duration-300 ease-in-out select-none overflow-x-hidden overflow-y-hidden",
        isCollapsed ? "w-[68px]" : "w-[230px]"
      )}
    >
      {/* ── Brand Header & Toggle ────────────────────────────────────────────── */}
      <div
        className={cn(
          "h-14 flex items-center border-b border-slate-100/90 transition-all shrink-0 overflow-hidden",
          isCollapsed ? "px-3 justify-center" : "px-4 justify-between"
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 min-w-0"
          title="CDU PORTAL - Nusa Putra University"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#a80063] to-[#d946ef] flex items-center justify-center shadow-sm shadow-[#a80063]/20 shrink-0">
            <GraduationCap size={17} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 animate-fade-in">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                CDU <span className="text-[#a80063]">PORTAL</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                Nusa Putra University
              </p>
            </div>
          )}
        </Link>

        {/* Toggle Collapse Button in Full Mode */}
        {!isCollapsed && (
          <button
            onClick={toggleSidebar}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-[#a80063] hover:bg-[#fdf2f8] flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Ciutkan Sidebar (Mode Mini)"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* ── Navigation Groups ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-3.5 scrollbar-thin">
        {filteredNavGroups.map((group) => (
          <div key={group.category} className="space-y-1 overflow-hidden">
            {!isCollapsed ? (
              <p className="px-2.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-1 truncate">
                {group.category}
              </p>
            ) : (
              <div className="h-px bg-slate-100 my-1.5 mx-1" />
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const hasChildren = item.children && item.children.length > 0;

                return (
                  <div key={item.href} className="relative">
                    <Link
                      href={hasChildren ? item.children![0].href : item.href}
                      title={item.label}
                      className={cn(
                        "flex items-center rounded-lg text-xs transition-all duration-150 relative cursor-pointer overflow-hidden",
                        isCollapsed
                          ? "w-10 h-10 mx-auto justify-center p-0 my-0.5"
                          : "gap-2.5 px-2.5 py-2",
                        active
                          ? "bg-[#fdf2f8] text-[#a80063] font-semibold shadow-xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                      )}
                    >
                      {/* Left active vertical bar */}
                      {active && !isCollapsed && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#a80063] rounded-r-full" />
                      )}

                      <Icon
                        size={17}
                        className={cn(
                          "shrink-0 transition-colors",
                          active
                            ? "text-[#a80063]"
                            : "text-slate-400 group-hover:text-slate-600"
                        )}
                      />

                      {!isCollapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>

                          {item.badge && (
                            <span className="px-1.5 py-0.2 text-[9px] font-semibold rounded bg-[#fce7f3] text-[#a80063] border border-[#fbcfe8]">
                              {item.badge}
                            </span>
                          )}

                          {hasChildren && (
                            <ChevronRight
                              size={13}
                              className={cn(
                                "text-slate-400 transition-transform",
                                active && "rotate-90 text-[#a80063]"
                              )}
                            />
                          )}
                        </>
                      )}
                    </Link>

                    {/* Sub-menu if any (Full Mode only) */}
                    {hasChildren && active && !isCollapsed && (
                      <div className="mt-0.5 ml-5 pl-2.5 border-l border-slate-200/80 space-y-0.5">
                        {item.children!.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "block px-2.5 py-1 rounded text-[11px] transition-colors truncate",
                              pathname === child.href
                                ? "text-[#a80063] font-semibold bg-[#fdf2f8]"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium"
                            )}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Bottom Banner Card in Full Mode */}
        {!isCollapsed && (
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#fdf2f8] to-[#fce7f3] border border-[#fbcfe8]/50 mt-3 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a80063]" />
              <span className="text-[10px] font-bold text-[#a80063] uppercase tracking-wider">
                Semester Aktif
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-800">
              2025/2026 Ganjil
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
              Sesi 1–16 siap dimonitor
            </p>
            <Link
              href="/monitoring"
              className="mt-2 inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 bg-[#a80063] hover:bg-[#8c0052] text-white text-[11px] font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Sparkles size={11} />
              Buka Monitoring
            </Link>
          </div>
        )}
      </div>

      {/* ── Footer / Logout & Expand Button in Mini Mode ─────────────────────── */}
      <div className="p-2.5 border-t border-slate-100 space-y-1 shrink-0 overflow-hidden">
        {isCollapsed && (
          <button
            onClick={toggleSidebar}
            className="w-10 h-10 mx-auto rounded-lg text-slate-400 hover:text-[#a80063] hover:bg-[#fdf2f8] flex items-center justify-center transition-all cursor-pointer mb-0.5"
            title="Perluas Sidebar (Mode Penuh)"
          >
            <PanelLeft size={16} />
          </button>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex items-center rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer overflow-hidden",
            isCollapsed
              ? "w-10 h-10 mx-auto justify-center"
              : "gap-2.5 w-full px-2.5 py-1.5"
          )}
          title="Keluar Akun"
        >
          <LogOut size={16} />
          {!isCollapsed && <span>Keluar Akun</span>}
        </button>
      </div>
    </aside>
  );
}
