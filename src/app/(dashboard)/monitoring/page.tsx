// src/app/(dashboard)/monitoring/page.tsx
// Main List View for All Monitored Classes (Daftar Kelas Monitoring)

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMonitoringKelasList } from "@/actions/monitoring";
import MonitoringListClient from "./MonitoringListClient";

export const metadata: Metadata = {
  title: "Daftar Kelas Monitoring Perkuliahan",
};

interface MonitoringPageProps {
  searchParams: Promise<{ prodiId?: string }>;
}

export default async function MonitoringPage({ searchParams }: MonitoringPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as any)?.role === "DOSEN") redirect("/");

  const resolvedSearchParams = await searchParams;
  // Selalu gunakan Semester Aktif yang diset di Master Semester
  const listRes = await getMonitoringKelasList(
    undefined,
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
      defaultSemesterId={activeSemesterId}
    />
  );
}
