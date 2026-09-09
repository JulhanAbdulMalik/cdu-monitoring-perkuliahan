// src/app/(dashboard)/monitoring/page.tsx
// Main List View for All Monitored Classes (Daftar Kelas Monitoring)

import { Metadata } from "next";
import { getMonitoringKelasList } from "@/actions/monitoring";
import MonitoringListClient from "./MonitoringListClient";

export const metadata: Metadata = {
  title: "Daftar Kelas Monitoring Perkuliahan",
};

interface MonitoringPageProps {
  searchParams: Promise<{ semesterId?: string; prodiId?: string }>;
}

export default async function MonitoringPage({ searchParams }: MonitoringPageProps) {
  const resolvedSearchParams = await searchParams;
  const listRes = await getMonitoringKelasList(
    resolvedSearchParams.semesterId,
    resolvedSearchParams.prodiId
  );

  const kelasList = listRes.success ? listRes.data?.kelasList || [] : [];
  const semesters = listRes.success ? listRes.data?.semesters || [] : [];
  const prodiList = listRes.success ? listRes.data?.prodiList || [] : [];
  const activeSemesterId = listRes.success ? listRes.data?.activeSemesterId || "" : "";

  return (
    <MonitoringListClient
      kelasList={kelasList as any}
      semesters={semesters}
      prodiList={prodiList}
      defaultSemesterId={resolvedSearchParams.semesterId || activeSemesterId}
    />
  );
}
