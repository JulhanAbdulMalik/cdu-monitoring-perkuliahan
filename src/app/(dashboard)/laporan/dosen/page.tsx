// src/app/(dashboard)/laporan/dosen/page.tsx
// Laporan Evaluasi Dosen Page

import { Metadata } from "next";
import { auth } from "@/lib/auth";
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
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
  const isDosen = userRole === "DOSEN";

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

  const filteredDosenReports = isDosen
    ? data.dosenReportList.filter((d: any) => userProdiIds.includes(d.prodi?.id))
    : data.dosenReportList;

  return (
    <LaporanDosenClient
      dosenReports={filteredDosenReports as any}
      semesters={data.semesters as any}
      defaultSemesterId={resolvedSearchParams.semesterId || data.activeSemesterId || ""}
    />
  );
}
