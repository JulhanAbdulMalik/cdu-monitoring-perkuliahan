// src/app/(dashboard)/laporan/fakultas/page.tsx
// Halaman Laporan Performa Fakultas per Periode Tanggal / Sesi

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getLaporanFakultas } from "@/actions/laporan";
import { getWeekDates } from "@/lib/utils";
import LaporanFakultasClient from "./LaporanFakultasClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Laporan Performa per Fakultas",
};

interface LaporanFakultasPageProps {
  searchParams: Promise<{
    semesterId?: string;
    startDate?: string;
    endDate?: string;
    sesi?: string;
    jenisKelas?: string;
    allTime?: string;
  }>;
}

export default async function LaporanFakultasPage({
  searchParams,
}: LaporanFakultasPageProps) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
  const isDosen = userRole === "DOSEN";

  const resolvedSearchParams = await searchParams;

  const parsedSesi = resolvedSearchParams.sesi ? parseInt(resolvedSearchParams.sesi, 10) : undefined;
  const isSesiMode = Boolean(parsedSesi && parsedSesi >= 1 && parsedSesi <= 16);

  const isExplicitAllTime =
    resolvedSearchParams.allTime === "true" ||
    resolvedSearchParams.startDate === "ALL" ||
    resolvedSearchParams.startDate === "all";

  // Hitung tanggal Minggu Lalu sebagai default awal
  const today = new Date();
  const lastWeekBase = new Date(today);
  lastWeekBase.setDate(today.getDate() - 7);
  const defaultLastWeek = getWeekDates(lastWeekBase);

  let targetStartDate = "";
  let targetEndDate = "";

  if (isSesiMode || isExplicitAllTime) {
    targetStartDate = "";
    targetEndDate = "";
  } else if (resolvedSearchParams.startDate && resolvedSearchParams.endDate) {
    targetStartDate = resolvedSearchParams.startDate;
    targetEndDate = resolvedSearchParams.endDate;
  } else {
    // Default ke Minggu Lalu
    targetStartDate = defaultLastWeek.mondayStr;
    targetEndDate = defaultLastWeek.sundayStr;
  }

  const targetJenisKelas = resolvedSearchParams.jenisKelas || "ALL";

  const res = await getLaporanFakultas(
    resolvedSearchParams.semesterId,
    targetStartDate,
    targetEndDate,
    isDosen ? userProdiIds : undefined,
    parsedSesi,
    targetJenisKelas
  );

  const data = res.success && res.data
    ? res.data
    : {
        fakultasReportList: [],
        semesters: [],
        activeSemesterId: "",
        startDate: targetStartDate,
        endDate: targetEndDate,
        targetSesi: parsedSesi,
        targetJenisKelas: targetJenisKelas,
        globalSummary: {
          totalFakultas: 0,
          totalProdiSemua: 0,
          totalKelasSemua: 0,
          totalDosenSemua: 0,
          totalSesiRentangSemua: 0,
          avgKehadiranRentangSemua: 0,
          avgKontenRentangSemua: 0,
          totalConfRentangSemua: 0,
          totalGantiHariRentangSemua: 0,
        },
      };

  return (
    <LaporanFakultasClient
      fakultasReports={data.fakultasReportList}
      semesters={data.semesters}
      defaultSemesterId={resolvedSearchParams.semesterId || data.activeSemesterId || ""}
      initialStartDate={data.startDate}
      initialEndDate={data.endDate}
      initialSesi={data.targetSesi ?? parsedSesi}
      initialJenisKelas={data.targetJenisKelas || targetJenisKelas}
      globalSummary={data.globalSummary}
    />
  );
}
