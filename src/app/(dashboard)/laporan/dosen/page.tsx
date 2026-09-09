// src/app/(dashboard)/laporan/dosen/page.tsx
// Laporan Evaluasi Dosen Page

import { Metadata } from "next";
import { getLaporanDosen } from "@/actions/laporan";
import LaporanDosenClient from "./LaporanDosenClient";

export const metadata: Metadata = {
  title: "Laporan Kinerja Dosen",
};

interface LaporanDosenPageProps {
  searchParams: Promise<{ semesterId?: string }>;
}

export default async function LaporanDosenPage({
  searchParams,
}: LaporanDosenPageProps) {
  const resolvedSearchParams = await searchParams;
  const res = await getLaporanDosen(resolvedSearchParams.semesterId);

  const data = res.success
    ? res.data!
    : {
        dosenReportList: [],
        semesters: [],
        prodiList: [],
        activeSemesterId: "",
      };

  return (
    <LaporanDosenClient
      dosenReports={data.dosenReportList as any}
      semesters={data.semesters as any}
      defaultSemesterId={resolvedSearchParams.semesterId || data.activeSemesterId || ""}
    />
  );
}
