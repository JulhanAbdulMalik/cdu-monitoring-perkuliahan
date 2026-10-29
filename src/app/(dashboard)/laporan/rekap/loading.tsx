// src/app/(dashboard)/laporan/rekap/loading.tsx
// Skeleton halaman rekap — tabel dengan filter
import { TableSkeleton } from "@/components/ui/PageSkeleton";

export default function RekapLoading() {
  return <TableSkeleton rows={8} cols={6} />;
}

