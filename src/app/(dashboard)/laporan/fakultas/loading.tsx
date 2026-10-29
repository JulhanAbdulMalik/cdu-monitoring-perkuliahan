// src/app/(dashboard)/laporan/fakultas/loading.tsx
// Skeleton halaman laporan per fakultas
import { DashboardPageSkeleton } from "@/components/ui/PageSkeleton";

export default function LaporanFakultasLoading() {
  return <DashboardPageSkeleton statCards={4} rows={8} cols={5} />;
}

