// src/app/(dashboard)/monitoring/[kelasId]/page.tsx
// Focused 16-Session 3-Pillar Monitoring Grid Page for a Specific Class

import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMonitoringKelasList, getMonitoringKelasDetail } from "@/actions/monitoring";
import MonitoringGridClient from "../MonitoringGridClient";

interface MonitoringDetailPageProps {
  params: Promise<{ kelasId: string }>;
}

export async function generateMetadata({
  params,
}: MonitoringDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const res = await getMonitoringKelasDetail(resolvedParams.kelasId);
  if (res.success && res.data) {
    return {
      title: `Monitoring [${res.data.kodeKelas}] ${res.data.mataKuliah.nama}`,
    };
  }
  return {
    title: "Grid Monitoring 16 Sesi",
  };
}

export default async function MonitoringDetailPage({
  params,
}: MonitoringDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as any)?.role === "DOSEN") redirect("/");

  const resolvedParams = await params;
  const detailRes = await getMonitoringKelasDetail(resolvedParams.kelasId);

  if (!detailRes.success || !detailRes.data) {
    notFound();
  }

  const listRes = await getMonitoringKelasList();
  const kelasList = listRes.success ? listRes.data?.kelasList || [] : [];

  const simpleKelasList = kelasList.map((k) => ({
    id: k.id,
    kodeKelas: k.kodeKelas,
    mataKuliah: { nama: k.mataKuliah.nama, kode: k.mataKuliah.kode },
    dosen: { nama: k.dosen.nama },
  }));

  return (
    <MonitoringGridClient
      currentKelas={detailRes.data as any}
      kelasList={simpleKelasList}
      selectedKelasId={resolvedParams.kelasId}
    />
  );
}
