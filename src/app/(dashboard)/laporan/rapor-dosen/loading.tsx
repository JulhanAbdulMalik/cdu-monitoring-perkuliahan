// src/app/(dashboard)/laporan/rapor-dosen/loading.tsx
// Skeleton halaman rapor dosen — stat cards + tabel
import { DashboardPageSkeleton } from "@/components/ui/PageSkeleton";

export default function RaporDosenLoading() {
  return <DashboardPageSkeleton statCards={4} rows={8} cols={7} />;
}

