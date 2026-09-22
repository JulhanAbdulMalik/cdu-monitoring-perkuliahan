// src/app/(dashboard)/monitoring/page.tsx
// Main List View for All Monitored Classes (Daftar Kelas Monitoring)

import { Metadata } from "next";
import { getMonitoringFilterOptions, getMonitoringKelasPaginated } from "@/actions/monitoring";
import MonitoringListClient from "./MonitoringListClient";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Daftar Kelas Monitoring Perkuliahan",
};

interface MonitoringPageProps {
  searchParams: Promise<{ prodiId?: string; page?: string; pageSize?: string }>;
}

export default async function MonitoringPage({ searchParams }: MonitoringPageProps) {
  const resolvedSearchParams = await searchParams;

  // Cek otentikasi untuk isolasi data Program Studi (Role DOSEN / Kaprodi)
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
  const isDosen = userRole === "DOSEN";
  const allowedProdiIds = isDosen ? userProdiIds : undefined;

  // Jika role DOSEN dan prodiId di searchParams tidak diizinkan, gunakan default prodi pertama miliknya
  let effectiveProdiId = resolvedSearchParams.prodiId;
  if (isDosen && allowedProdiIds && allowedProdiIds.length > 0) {
    if (!effectiveProdiId || !allowedProdiIds.includes(effectiveProdiId)) {
      effectiveProdiId = allowedProdiIds[0];
    }
  }

  // Fetch filter options dan halaman pertama (20 data) secara paralel
  const [filterRes, initialDataRes] = await Promise.all([
    getMonitoringFilterOptions(allowedProdiIds),
    getMonitoringKelasPaginated({
      prodiId: effectiveProdiId,
      page: 1,
      pageSize: 20,
      allowedProdiIds,
    }),
  ]);

  const semesters = filterRes.success ? filterRes.data?.semesters || [] : [];
  const prodiList = filterRes.success ? filterRes.data?.prodiList || [] : [];
  const activeSemesterId = filterRes.success ? filterRes.data?.activeSemesterId || "" : "";

  const initialData = initialDataRes.success && initialDataRes.data
    ? initialDataRes.data
    : {
        items: [],
        totalCount: 0,
        tabCounts: { total: 0, belum: 0, sudah: 0 },
        page: 1,
        pageSize: 20,
        totalPages: 1,
        defaultActiveSesi: 1,
      };

  return (
    <MonitoringListClient
      initialData={initialData}
      semesters={semesters}
      prodiList={prodiList}
      defaultSemesterId={activeSemesterId}
      initialProdiId={effectiveProdiId}
    />
  );
}
