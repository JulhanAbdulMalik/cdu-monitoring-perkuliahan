// src/app/(dashboard)/laporan/prodi/page.tsx
// Halaman Laporan Performa Program Studi per Periode Tanggal (Senin - Minggu)

import { Metadata } from "next";
import { getLaporanProdi } from "@/actions/laporan";
import { getWeekDates } from "@/lib/utils";
import LaporanProdiClient from "./LaporanProdiClient";

export const metadata: Metadata = {
  title: "Laporan Performa Program Studi — CDU Monitoring",
};

interface LaporanProdiPageProps {
  searchParams: Promise<{
    semesterId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function LaporanProdiPage({
  searchParams,
}: LaporanProdiPageProps) {
  const resolvedSearchParams = await searchParams;

  const targetStartDate = resolvedSearchParams.startDate || "";
  const targetEndDate = resolvedSearchParams.endDate || "";

  const res = await getLaporanProdi(
    resolvedSearchParams.semesterId,
    targetStartDate,
    targetEndDate
  );

  const data = res.success && res.data
    ? res.data
    : {
        prodiReportList: [],
        semesters: [],
        activeSemesterId: "",
        startDate: targetStartDate,
        endDate: targetEndDate,
        globalSummary: {
          totalProdi: 0,
          totalKelasSemua: 0,
          totalDosenSemua: 0,
          totalSesiRentangSemua: 0,
          avgKehadiranRentangSemua: 0,
          avgKontenRentangSemua: 0,
          totalConfRentangSemua: 0,
        },
      };

  return (
    <LaporanProdiClient
      prodiReports={data.prodiReportList}
      semesters={data.semesters}
      defaultSemesterId={resolvedSearchParams.semesterId || data.activeSemesterId || ""}
      initialStartDate={data.startDate}
      initialEndDate={data.endDate}
      globalSummary={data.globalSummary}
    />
  );
}
