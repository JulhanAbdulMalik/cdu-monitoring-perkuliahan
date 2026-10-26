// src/app/(dashboard)/laporan/rapor-dosen/[dosenId]/page.tsx
// Halaman Cetak Lembar Rapor Evaluasi Tridharma Dosen format A4

import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { getRaporDosenDetail } from "@/actions/rapor";
import RaporDosenDetailClient from "./RaporDosenDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ dosenId: string }>;
  searchParams: Promise<{ semesterId?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { dosenId } = await params;
  const { semesterId } = await searchParams;
  const res = await getRaporDosenDetail(dosenId, semesterId);

  if (res.success && res.data) {
    return {
      title: `Rapor Dosen - ${res.data.dosen.nama} (${res.data.semester.tahunAkademik})`,
      description: `Lembar Evaluasi Tridharma Dosen ${res.data.dosen.nama}`,
    };
  }

  return {
    title: "Lembar Rapor Evaluasi Dosen - QAU",
  };
}

export default async function RaporDosenDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { dosenId } = await params;
  const { semesterId } = await searchParams;

  const res = await getRaporDosenDetail(dosenId, semesterId);

  if (!res.success || !res.data) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Data Rapor Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          {res.error || "Data dosen atau semester yang dipilih tidak ditemukan dalam sistem."}
        </p>
        <Link
          href="/laporan/rapor-dosen"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Rapor Dosen
        </Link>
      </div>
    );
  }

  return (
    <RaporDosenDetailClient
      data={res.data}
      semesterId={res.data.semester.id}
    />
  );
}
