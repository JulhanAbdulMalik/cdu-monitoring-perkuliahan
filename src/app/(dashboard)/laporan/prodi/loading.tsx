// src/app/(dashboard)/laporan/prodi/loading.tsx
// Skeleton halaman laporan per prodi
import { DashboardPageSkeleton } from "@/components/ui/PageSkeleton";

export default function LaporanProdiLoading() {
  return <DashboardPageSkeleton statCards={4} rows={8} cols={6} />;
}

