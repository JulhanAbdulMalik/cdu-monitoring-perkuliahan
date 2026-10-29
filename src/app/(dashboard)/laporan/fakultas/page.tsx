// src/app/(dashboard)/laporan/fakultas/page.tsx
// Halaman Laporan Performa Fakultas per Periode Tanggal / Sesi

import { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
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
  const isDosen = userRole === "DOSEN";

  // Proteksi Akses: Halaman Laporan Fakultas dikhususkan untuk SUPER_ADMIN & ADMIN (QAU)
  if (isDosen) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Akses Ditolak</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Halaman Laporan Performa per Fakultas dikhususkan untuk Pimpinan Institusi dan Tim Penjaminan Mutu (QAU). Untuk monitoring evaluasi Program Studi Anda, silakan akses Laporan per Prodi.
        </p>
        <Link
          href="/laporan/prodi"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#a80063] hover:bg-[#8c0052] text-white rounded-xl text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Buka Laporan per Prodi
        </Link>
      </div>
    );
  }

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
    undefined,
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
