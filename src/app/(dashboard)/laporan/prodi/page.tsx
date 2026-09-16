// src/app/(dashboard)/laporan/prodi/page.tsx
// Halaman Laporan Performa Program Studi per Periode Tanggal (Senin - Minggu)

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getLaporanProdi } from "@/actions/laporan";
import { getWeekDates } from "@/lib/utils";
import LaporanProdiClient from "./LaporanProdiClient";

export const metadata: Metadata = {
  title: "Laporan Performa Program Studi - CDU Monitoring",
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
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
  const isDosen = userRole === "DOSEN";

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

  const filteredProdiReports = isDosen
    ? data.prodiReportList.filter((p) => userProdiIds.includes(p.id))
    : data.prodiReportList;

  let summary = data.globalSummary;
  if (isDosen) {
    const totalProdi = filteredProdiReports.length;
    const totalKelasSemua = filteredProdiReports.reduce((s, p) => s + p.totalKelas, 0);
    const totalDosenSemua = filteredProdiReports.reduce((s, p) => s + p.totalDosen, 0);
    const totalSesiRentangSemua = filteredProdiReports.reduce((s, p) => s + p.totalSesiRentang, 0);
    const avgKehadiranRentangSemua =
      totalProdi > 0
        ? Math.round(filteredProdiReports.reduce((s, p) => s + p.avgKehadiranRentang, 0) / totalProdi)
        : 0;
    const avgKontenRentangSemua =
      totalProdi > 0
        ? Math.round(filteredProdiReports.reduce((s, p) => s + p.avgKontenRentang, 0) / totalProdi)
        : 0;
    const totalConfRentangSemua = filteredProdiReports.reduce((s, p) => s + p.totalConfRentang, 0);

    summary = {
      totalProdi,
      totalKelasSemua,
      totalDosenSemua,
      totalSesiRentangSemua,
      avgKehadiranRentangSemua,
      avgKontenRentangSemua,
      totalConfRentangSemua,
    };
  }

  return (
    <LaporanProdiClient
      prodiReports={filteredProdiReports}
      semesters={data.semesters}
      defaultSemesterId={resolvedSearchParams.semesterId || data.activeSemesterId || ""}
      initialStartDate={data.startDate}
      initialEndDate={data.endDate}
      globalSummary={summary}
    />
  );
}
