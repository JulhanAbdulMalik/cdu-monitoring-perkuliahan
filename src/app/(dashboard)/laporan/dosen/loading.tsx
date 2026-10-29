// src/app/(dashboard)/laporan/dosen/loading.tsx
// Skeleton halaman laporan per dosen
import { DashboardPageSkeleton } from "@/components/ui/PageSkeleton";

export default function LaporanDosenLoading() {
  return <DashboardPageSkeleton statCards={3} rows={10} cols={6} />;
}

