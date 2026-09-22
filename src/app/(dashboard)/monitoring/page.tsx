// src/app/(dashboard)/monitoring/page.tsx
// Main List View for All Monitored Classes (Daftar Kelas Monitoring) with URL Search Params Persistence

import { Metadata } from "next";
import { Suspense } from "react";
import { getMonitoringFilterOptions, getMonitoringKelasPaginated, MonitoringSortKey } from "@/actions/monitoring";
import MonitoringListClient from "./MonitoringListClient";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Daftar Kelas Monitoring Perkuliahan",
};

interface MonitoringPageProps {
  searchParams: Promise<{
    prodiId?: string;
    semesterId?: string;
    tab?: "ALL" | "BELUM" | "SUDAH";
    sesi?: string;
    mode?: string;
    hari?: string;
    status?: string;
    q?: string;
    page?: string;
    pageSize?: string;
    sortBy?: string;
  }>;
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

  const pageNum = parseInt(resolvedSearchParams.page || "1", 10) || 1;
  const pageSizeNum = parseInt(resolvedSearchParams.pageSize || "20", 10) || 20;
  const sesiNum = resolvedSearchParams.sesi ? parseInt(resolvedSearchParams.sesi, 10) : undefined;
  const monitoringTab = resolvedSearchParams.tab || "ALL";
  const filterMode = resolvedSearchParams.mode || "ALL";
  const filterHari = resolvedSearchParams.hari || "ALL";
  const filterStatus = resolvedSearchParams.status || "ALL";
  const searchQuery = resolvedSearchParams.q || "";
  const sortBy = (resolvedSearchParams.sortBy as MonitoringSortKey) || "TERBARU";

  // Fetch filter options dan data halaman sesuai filter URL secara paralel
  const [filterRes, initialDataRes] = await Promise.all([
    getMonitoringFilterOptions(allowedProdiIds),
    getMonitoringKelasPaginated({
      semesterId: resolvedSearchParams.semesterId,
      prodiId: effectiveProdiId,
      filterMode,
      filterHari,
      filterStatus,
      monitoringTab,
      selectedSesi: sesiNum,
      searchQuery,
      sortBy,
      page: pageNum,
      pageSize: pageSizeNum,
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
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: 1,
        defaultActiveSesi: sesiNum || 1,
      };

  return (
    <Suspense fallback={null}>
      <MonitoringListClient
        initialData={initialData}
        semesters={semesters}
        prodiList={prodiList}
        defaultSemesterId={resolvedSearchParams.semesterId || activeSemesterId}
        initialProdiId={effectiveProdiId}
        initialUrlParams={{
          prodiId: effectiveProdiId,
          semesterId: resolvedSearchParams.semesterId,
          tab: monitoringTab,
          sesi: sesiNum,
          mode: filterMode,
          hari: filterHari,
          status: filterStatus,
          q: searchQuery,
          page: pageNum,
          pageSize: pageSizeNum,
          sortBy,
        }}
      />
    </Suspense>
  );
}
