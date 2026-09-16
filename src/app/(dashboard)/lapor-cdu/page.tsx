// src/app/(dashboard)/lapor-cdu/page.tsx
// Halaman Pusat Lapor CDU — Sanggahan & Pelaporan Ketidaksesuaian Monitoring

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLaporCduList } from "@/actions/lapor-cdu";
import LaporCduClient from "./LaporCduClient";

export const metadata: Metadata = {
  title: "Lapor CDU",
};

interface LaporCduPageProps {
  searchParams: Promise<{
    semesterId?: string;
    prodiId?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function LaporCduPage({ searchParams }: LaporCduPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = (session.user as any)?.role as "SUPER_ADMIN" | "ADMIN" | "DOSEN";
  const userProdiIds = ((session.user as any)?.prodiIds as string[]) || [];

  const resolvedSearchParams = await searchParams;

  // Ambil semester aktif
  const activeSemester =
    (await prisma.semester.findFirst({ where: { aktif: true } })) ||
    (await prisma.semester.findFirst({
      orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
    }));

  const allSemesters = await prisma.semester.findMany({
    orderBy: [{ tahunAkademik: "desc" }, { periode: "asc" }],
  });

  // Ambil daftar prodi sesuai hak akses
  let accessibleProdis: { id: string; nama: string; kode: string }[] = [];
  if (userRole === "DOSEN") {
    accessibleProdis = await prisma.prodi.findMany({
      where: { id: { in: userProdiIds } },
      select: { id: true, nama: true, kode: true },
      orderBy: { nama: "asc" },
    });
  } else {
    accessibleProdis = await prisma.prodi.findMany({
      select: { id: true, nama: true, kode: true },
      orderBy: { nama: "asc" },
    });
  }

  const defaultSemesterId = resolvedSearchParams.semesterId || activeSemester?.id || "";

  // Ambil data laporan awal
  const res = await getLaporCduList({
    semesterId: defaultSemesterId,
    prodiId: resolvedSearchParams.prodiId,
    status: resolvedSearchParams.status,
    search: resolvedSearchParams.search,
  });

  const initialItems = res.success && res.data ? res.data.items : [];
  const initialStats = res.success && res.data ? res.data.stats : {
    totalAll: 0,
    totalPending: 0,
    totalDisetujui: 0,
    totalDitolak: 0,
  };

  return (
    <LaporCduClient
      initialItems={initialItems}
      initialStats={initialStats}
      semesters={allSemesters.map((s) => ({
        id: s.id,
        label: `${s.tahunAkademik} (${s.periode})`,
        isAktif: s.aktif,
      }))}
      accessibleProdis={accessibleProdis}
      currentUser={{
        id: session.user.id || "",
        name: session.user.name || "",
        email: session.user.email || "",
        role: userRole,
        prodiIds: userProdiIds,
      }}
      defaultSemesterId={defaultSemesterId}
    />
  );
}
