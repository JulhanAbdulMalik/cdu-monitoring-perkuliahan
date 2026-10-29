// src/app/(dashboard)/lapor-cdu/loading.tsx
// Skeleton halaman lapor ke CDU
import { TableSkeleton } from "@/components/ui/PageSkeleton";

export default function LaporCduLoading() {
  return <TableSkeleton rows={6} cols={5} />;
}

