"use client";
// src/components/ui/PageSkeleton.tsx
// Komponen Skeleton Standar CDU Portal
// Dipakai di semua loading.tsx pada setiap route halaman dashboard

import { cn } from "@/lib/utils";

// ─── Primitive: Kotak animasi shimmer ───────────────────────────────────────
function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-slate-200/80 rounded-lg animate-pulse",
        className
      )}
    />
  );
}

// ─── Komponen Publik ─────────────────────────────────────────────────────────

/** Skeleton baris tabel — 1 baris abu-abu shimmer */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <Bone className={cn("h-3.5", i === 0 ? "w-8" : i === cols - 1 ? "w-20" : "w-full")} />
        </td>
      ))}
    </tr>
  );
}

/** Skeleton tabel penuh dengan header + beberapa baris */
export function TableSkeleton({
  rows = 8,
  cols = 5,
  title,
  showFilter = true,
}: {
  rows?: number;
  cols?: number;
  title?: string;
  showFilter?: boolean;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-5 w-48" />
          <Bone className="h-3 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Bone className="h-8 w-24 rounded-lg" />
          <Bone className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      {/* Filter / Search Bar */}
      {showFilter && (
        <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200/70">
          <Bone className="h-8 w-52 rounded-lg" />
          <Bone className="h-8 w-36 rounded-lg" />
          <Bone className="h-8 w-36 rounded-lg" />
          <div className="ml-auto flex items-center gap-2">
            <Bone className="h-8 w-8 rounded-lg" />
            <Bone className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          {Array.from({ length: cols }).map((_, i) => (
            <Bone
              key={i}
              className={cn("h-3", i === 0 ? "w-10" : i === cols - 1 ? "w-20" : "w-full")}
            />
          ))}
        </div>

        {/* Table Rows */}
        <table className="w-full">
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        <Bone className="h-3 w-40" />
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} className="h-7 w-7 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton untuk halaman dengan kartu-kartu statistik di atas */
export function DashboardPageSkeleton({
  statCards = 4,
  rows = 8,
  cols = 6,
}: {
  statCards?: number;
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-5 w-56" />
          <Bone className="h-3 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Bone className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className={cn("grid gap-3", `grid-cols-2 sm:grid-cols-${Math.min(statCards, 4)}`)}>
        {Array.from({ length: statCards }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200/70 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Bone className="h-3 w-24" />
              <Bone className="h-7 w-7 rounded-lg" />
            </div>
            <Bone className="h-7 w-16" />
            <Bone className="h-2.5 w-32" />
          </div>
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={rows} cols={cols} showFilter={true} />
    </div>
  );
}

/** Skeleton untuk halaman detail / rapor dosen */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back button + Title */}
      <div className="flex items-center gap-3">
        <Bone className="h-8 w-8 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Bone className="h-5 w-64" />
          <Bone className="h-3 w-48" />
        </div>
        <Bone className="h-8 w-24 rounded-lg" />
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200/70 p-5">
        <div className="flex items-start gap-4">
          <Bone className="h-14 w-14 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-5 w-72" />
            <Bone className="h-3 w-48" />
            <Bone className="h-3 w-56" />
          </div>
          <div className="flex items-center gap-2">
            <Bone className="h-8 w-20 rounded-lg" />
            <Bone className="h-8 w-28 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200/70 p-4 space-y-2">
            <Bone className="h-3 w-20" />
            <Bone className="h-8 w-12" />
            <Bone className="h-2 w-16" />
          </div>
        ))}
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200/70 p-5 space-y-3">
            <Bone className="h-4 w-40" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2">
                <Bone className="h-6 w-8 rounded shrink-0" />
                <Bone className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton monitoring grid — kartu-kartu kelas */
export function MonitoringGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Title + Filter */}
      <div className="flex items-center justify-between">
        <Bone className="h-5 w-52" />
        <div className="flex items-center gap-2">
          <Bone className="h-8 w-20 rounded-lg" />
          <Bone className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className={cn("h-7 rounded-lg", i === 0 ? "w-20" : "w-16")} />
        ))}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-8 w-32 rounded-lg" />
        ))}
        <div className="ml-auto">
          <Bone className="h-8 w-48 rounded-lg" />
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200/70 p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <Bone className="h-4 w-16" />
              <Bone className="h-5 w-16 rounded-full" />
            </div>
            <Bone className="h-3.5 w-full" />
            <Bone className="h-3 w-3/4" />
            <div className="pt-1 flex items-center gap-2">
              <Bone className="h-2 flex-1 rounded-full" />
              <Bone className="h-3 w-8" />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {Array.from({ length: 3 }).map((_, j) => (
                <Bone key={j} className="h-5 w-16 rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton simpel untuk master data (dosen, MK, kelas, prodi, semester) */
export function MasterPageSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Title Row */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Bone className="h-5 w-44" />
          <Bone className="h-3 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Bone className="h-8 w-28 rounded-lg" />
          <Bone className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-2">
        <Bone className="h-9 flex-1 max-w-xs rounded-xl" />
        <Bone className="h-9 w-36 rounded-xl" />
        <Bone className="h-9 w-36 rounded-xl" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden">
        <div className="grid grid-cols-6 gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} className="h-3" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-3 px-4 py-3 border-b border-slate-100 last:border-0"
          >
            {Array.from({ length: 6 }).map((_, j) => (
              <Bone
                key={j}
                className={cn("h-3", j === 0 ? "w-8" : j === 5 ? "w-16" : "w-full")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
