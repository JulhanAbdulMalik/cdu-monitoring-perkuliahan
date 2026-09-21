// src/app/(dashboard)/laporan/rekap/page.tsx
// Master Rekapitulasi Sesi Page

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getRekapLaporan } from "@/actions/laporan";
import RekapClient from "./RekapClient";

export const metadata: Metadata = {
  title: "Rekapitulasi Monitoring Sesi",
};

interface RekapPageProps {
  searchParams: Promise<{ semesterId?: string; prodiId?: string }>;
}

export default async function RekapPage({ searchParams }: RekapPageProps) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
  const isDosen = userRole === "DOSEN";

  const resolvedSearchParams = await searchParams;
  const targetProdiId = isDosen
    ? (resolvedSearchParams.prodiId && userProdiIds.includes(resolvedSearchParams.prodiId)
        ? resolvedSearchParams.prodiId
        : userProdiIds[0])
    : resolvedSearchParams.prodiId;

  const res = await getRekapLaporan(
    resolvedSearchParams.semesterId,
    targetProdiId,
    isDosen ? userProdiIds : undefined
  );

  const data = res.success
    ? res.data!
    : {
        rekapList: [],
        semesters: [],
        prodiList: [],
        activeSemesterId: "",
      };

  const filteredProdiList = isDosen
    ? data.prodiList.filter((p: any) => userProdiIds.includes(p.id))
    : data.prodiList;

  const filteredRekapList = isDosen
    ? data.rekapList.filter((r: any) => userProdiIds.includes(r.mataKuliah?.prodi?.id))
    : data.rekapList;

  return (
    <RekapClient
      initialRekap={filteredRekapList as any}
      semesters={data.semesters as any}
      prodiList={filteredProdiList as any}
      defaultSemesterId={resolvedSearchParams.semesterId || data.activeSemesterId || ""}
      initialFilterProdi={targetProdiId || (isDosen && userProdiIds.length > 0 ? userProdiIds[0] : "ALL")}
      isDosen={isDosen}
    />
  );
}
