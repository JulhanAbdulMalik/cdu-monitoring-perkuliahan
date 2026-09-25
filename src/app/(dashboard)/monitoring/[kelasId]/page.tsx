// src/app/(dashboard)/monitoring/[kelasId]/page.tsx
// Focused 16-Session 3-Pillar Monitoring Grid Page for a Specific Class

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMonitoringKelasDetail, getFilteredSequentialKelasList } from "@/actions/monitoring";
import MonitoringGridClient from "../MonitoringGridClient";

interface MonitoringDetailPageProps {
  params: Promise<{ kelasId: string }>;
  searchParams?: Promise<{
    prodiId?: string;
    semesterId?: string;
    tab?: "ALL" | "BELUM" | "SUDAH";
    sesi?: string;
    mode?: string;
    hari?: string;
    status?: string;
    q?: string;
    sortBy?: string;
  }>;
}

export async function generateMetadata({
  params,
}: MonitoringDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const detailRes = await getMonitoringKelasDetail(resolvedParams.kelasId);
  const kelas = detailRes.data;

  return {
    title: kelas
      ? `Monitoring Sesi - ${kelas.mataKuliah.nama} (${kelas.kodeKelas})`
      : "Grid Monitoring 16 Sesi",
  };
}

export default async function MonitoringDetailPage({
  params,
  searchParams,
}: MonitoringDetailPageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve({} as any),
  ]);
  const detailRes = await getMonitoringKelasDetail(resolvedParams.kelasId);

  if (!detailRes.success || !detailRes.data) {
    notFound();
  }

  const effectiveProdiId = resolvedSearchParams?.prodiId;
  const sesiNum = resolvedSearchParams?.sesi ? parseInt(resolvedSearchParams.sesi, 10) : undefined;

  const listRes = await getFilteredSequentialKelasList({
    semesterId: resolvedSearchParams?.semesterId || detailRes.data.semesterId,
    prodiId: effectiveProdiId,
    filterMode: resolvedSearchParams?.mode,
    filterHari: resolvedSearchParams?.hari,
    filterStatus: resolvedSearchParams?.status,
    monitoringTab: resolvedSearchParams?.tab,
    selectedSesi: sesiNum,
    searchQuery: resolvedSearchParams?.q,
    sortBy: resolvedSearchParams?.sortBy as any,
    currentKelasId: resolvedParams.kelasId,
  });

  const simpleKelasList = listRes.success && listRes.data ? listRes.data : [];

  return (
    <MonitoringGridClient
      currentKelas={detailRes.data as any}
      kelasList={simpleKelasList}
      selectedKelasId={resolvedParams.kelasId}
      filterProdiId={effectiveProdiId}
    />
  );
}
