// src/app/(dashboard)/loading.tsx
// Fallback skeleton umum untuk semua halaman dashboard
import { TableSkeleton } from "@/components/ui/PageSkeleton";

export default function DashboardLoading() {
  return <TableSkeleton rows={8} cols={5} />;
}

