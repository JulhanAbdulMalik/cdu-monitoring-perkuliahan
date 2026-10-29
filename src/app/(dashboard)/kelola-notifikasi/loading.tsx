// src/app/(dashboard)/kelola-notifikasi/loading.tsx
// Skeleton halaman kelola notifikasi
import { TableSkeleton } from "@/components/ui/PageSkeleton";

export default function KelolaNotifikasiLoading() {
  return <TableSkeleton rows={6} cols={4} showFilter={false} />;
}

