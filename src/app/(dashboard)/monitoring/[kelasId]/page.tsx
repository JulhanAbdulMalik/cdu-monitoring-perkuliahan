// src/app/(dashboard)/monitoring/[kelasId]/page.tsx
// Focused 16-Session 3-Pillar Monitoring Grid Page for a Specific Class

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSimpleKelasList, getMonitoringKelasDetail } from "@/actions/monitoring";
import MonitoringGridClient from "../MonitoringGridClient";

interface MonitoringDetailPageProps {
  params: Promise<{ kelasId: string }>;
  searchParams?: Promise<{ prodiId?: string; tab?: string; sesi?: string }>;
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
    searchParams ? searchParams : Promise.resolve({} as { prodiId?: string; tab?: string; sesi?: string }),
  ]);
  const detailRes = await getMonitoringKelasDetail(resolvedParams.kelasId);

  if (!detailRes.success || !detailRes.data) {
    notFound();
  }

  const effectiveProdiId = resolvedSearchParams?.prodiId;
  let listRes = await getSimpleKelasList(detailRes.data.semesterId, effectiveProdiId);
  let simpleKelasList = listRes.success && listRes.data ? listRes.data : [];

  // Jika filter prodi tidak memuat kelas yang sedang dibuka, fallback ke seluruh kelas di semester aktif
  if (simpleKelasList.length > 0 && !simpleKelasList.some((k) => k.id === resolvedParams.kelasId)) {
    listRes = await getSimpleKelasList(detailRes.data.semesterId);
    simpleKelasList = listRes.success && listRes.data ? listRes.data : [];
  }

  return (
    <MonitoringGridClient
      currentKelas={detailRes.data as any}
      kelasList={simpleKelasList}
      selectedKelasId={resolvedParams.kelasId}
      filterProdiId={effectiveProdiId}
    />
  );
}
