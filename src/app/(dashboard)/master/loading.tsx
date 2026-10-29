// src/app/(dashboard)/master/loading.tsx
// Skeleton fallback umum untuk semua sub-halaman master
import { MasterPageSkeleton } from "@/components/ui/PageSkeleton";

export default function MasterLoading() {
  return <MasterPageSkeleton rows={10} />;
}

