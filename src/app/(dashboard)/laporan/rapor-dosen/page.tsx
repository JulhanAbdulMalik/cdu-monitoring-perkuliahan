// src/app/(dashboard)/laporan/rapor-dosen/page.tsx
// Halaman Utama Laporan & Rapor Tridharma Dosen (QAU / SPMI)

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getRaporDosenList } from "@/actions/rapor";
import RaporDosenClient from "./RaporDosenClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Rapor Tridharma Dosen - QAU & SPMI",
  description: "Laporan Evaluasi Tridharma Dosen Berdasarkan Kuesioner Mahasiswa, Kehadiran, Konten LMS, Penelitian & Pengabdian",
};

interface RaporDosenPageProps {
  searchParams: Promise<{
    semesterId?: string;
    prodiId?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function RaporDosenPage({ searchParams }: RaporDosenPageProps) {
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

  const res = await getRaporDosenList({
    semesterId: resolvedSearchParams.semesterId,
    prodiId: targetProdiId,
    search: resolvedSearchParams.search,
  });

  if (!res.success || !res.data) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">Gagal Memuat Rapor Dosen</h2>
        <p className="text-xs text-slate-500 mt-1">{res.error || "Terjadi kesalahan sistem saat memuat data."}</p>
      </div>
    );
  }

  const { items, summary, config, semesters, currentSemester, prodiList } = res.data;

  const filteredProdiList = isDosen
    ? prodiList.filter((p: any) => userProdiIds.includes(p.id))
    : prodiList;

  return (
    <RaporDosenClient
      items={items}
      summary={summary}
      config={config}
      semesters={semesters}
      currentSemester={currentSemester}
      prodiList={filteredProdiList}
      userRole={userRole}
      isDosen={isDosen}
      initialFilters={{
        semesterId: currentSemester.id,
        prodiId: targetProdiId || "ALL",
        status: resolvedSearchParams.status || "ALL",
        search: resolvedSearchParams.search || "",
      }}
    />
  );
}
