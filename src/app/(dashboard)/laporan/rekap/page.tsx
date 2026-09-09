// src/app/(dashboard)/laporan/rekap/page.tsx
// Master Rekapitulasi Sesi Page

import { Metadata } from "next";
import { getRekapLaporan } from "@/actions/laporan";
import RekapClient from "./RekapClient";

export const metadata: Metadata = {
  title: "Rekapitulasi Monitoring Sesi",
};

interface RekapPageProps {
  searchParams: Promise<{ semesterId?: string; prodiId?: string }>;
}

export default async function RekapPage({ searchParams }: RekapPageProps) {
  const resolvedSearchParams = await searchParams;
  const res = await getRekapLaporan(
    resolvedSearchParams.semesterId,
    resolvedSearchParams.prodiId
  );

  const data = res.success
    ? res.data!
    : {
        rekapList: [],
        semesters: [],
        prodiList: [],
        activeSemesterId: "",
      };

  return (
    <RekapClient
      initialRekap={data.rekapList as any}
      semesters={data.semesters as any}
      prodiList={data.prodiList as any}
      defaultSemesterId={resolvedSearchParams.semesterId || data.activeSemesterId || ""}
    />
  );
}
