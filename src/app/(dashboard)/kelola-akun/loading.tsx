// src/app/(dashboard)/kelola-akun/loading.tsx
// Skeleton halaman kelola akun pengguna
import { TableSkeleton } from "@/components/ui/PageSkeleton";

export default function KelolaAkunLoading() {
  return <TableSkeleton rows={8} cols={5} showFilter={false} />;
}

