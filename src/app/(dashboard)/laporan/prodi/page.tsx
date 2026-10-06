// src/app/(dashboard)/laporan/prodi/page.tsx
// Halaman Laporan Performa Program Studi per Periode Tanggal (Senin - Minggu)

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getLaporanProdi } from "@/actions/laporan";
import { getWeekDates } from "@/lib/utils";
import LaporanProdiClient from "./LaporanProdiClient";

export const metadata: Metadata = {
  title: "Laporan Performa Program Studi",
};

interface LaporanProdiPageProps {
  searchParams: Promise<{
    semesterId?: string;
    startDate?: string;
    endDate?: string;
    sesi?: string;
    jenisKelas?: string;
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
  const parsedSesi = resolvedSearchParams.sesi ? parseInt(resolvedSearchParams.sesi, 10) : undefined;
  const targetJenisKelas = resolvedSearchParams.jenisKelas || "ALL";

  const res = await getLaporanProdi(
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
        prodiReportList: [],
        semesters: [],
        activeSemesterId: "",
        startDate: targetStartDate,
        endDate: targetEndDate,
        targetSesi: parsedSesi,
        targetJenisKelas: targetJenisKelas,
        globalSummary: {
          totalProdi: 0,
          totalKelasSemua: 0,
          totalDosenSemua: 0,
          totalSesiRentangSemua: 0,
          avgKehadiranRentangSemua: 0,
          avgKontenRentangSemua: 0,
          totalConfRentangSemua: 0,
          totalGantiHariRentangSemua: 0,
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
    const activeProdiReports = filteredProdiReports.filter((p) => p.totalKelas > 0);
    const totalSesiAktif = activeProdiReports.reduce((s, p) => s + p.totalSesiRentang, 0);
    const totalHadirAktif = activeProdiReports.reduce((s, p) => s + (p.totalHadirRentang + p.totalHadirTdkLengkapRentang), 0);
    const totalSkorKontenAktif = activeProdiReports.reduce((s, p) => s + p.totalSkor3PilarRentang, 0);
    const totalMaxSkorKontenAktif = activeProdiReports.reduce((s, p) => s + p.maxSkor3PilarRentang, 0);

    const avgKehadiranRentangSemua =
      totalSesiAktif > 0
        ? Math.round((totalHadirAktif / totalSesiAktif) * 1000) / 10
        : 0;
    const avgKontenRentangSemua =
      totalMaxSkorKontenAktif > 0
        ? Math.round((totalSkorKontenAktif / totalMaxSkorKontenAktif) * 1000) / 10
        : 0;
    const totalConfRentangSemua = filteredProdiReports.reduce((s, p) => s + p.totalConfRentang, 0);
    const totalGantiHariRentangSemua = filteredProdiReports.reduce((s, p) => s + (p.totalGantiHariRentang || 0), 0);

    summary = {
      totalProdi,
      totalKelasSemua,
      totalDosenSemua,
      totalSesiRentangSemua,
      avgKehadiranRentangSemua,
      avgKontenRentangSemua,
      totalConfRentangSemua,
      totalGantiHariRentangSemua,
    };
  }

  return (
    <LaporanProdiClient
      prodiReports={filteredProdiReports}
      semesters={data.semesters}
      defaultSemesterId={resolvedSearchParams.semesterId || data.activeSemesterId || ""}
      initialStartDate={data.startDate}
      initialEndDate={data.endDate}
      initialSesi={data.targetSesi ?? parsedSesi}
      initialJenisKelas={data.targetJenisKelas || targetJenisKelas}
      globalSummary={summary}
    />
  );
}
