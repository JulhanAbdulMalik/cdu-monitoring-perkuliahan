// src/app/(dashboard)/laporan/rapor-dosen/print-batch/page.tsx
// Halaman Cetak Massal (Batch Print) Lembar Rapor Dosen A4
// Memungkinkan cetak massal (semua halaman disatukan) atau cetak per dosen (terpisah) dengan kualitas vektor asli 100%

import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { getBatchRaporDosenDetails } from "@/actions/rapor";
import PrintBatchClient from "./PrintBatchClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Cetak Massal Rapor Tridharma Dosen - QAU",
  description: "Cetak massal lembar evaluasi Tridharma dosen format A4",
};

interface PrintBatchPageProps {
  searchParams: Promise<{
    ids?: string;
    semesterId?: string;
  }>;
}

export default async function PrintBatchPage({ searchParams }: PrintBatchPageProps) {
  const { ids, semesterId } = await searchParams;

  if (!ids) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Tidak Ada Dosen yang Dipilih</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Silakan pilih satu atau beberapa dosen dari tabel rapor dosen sebelum mencetak.
        </p>
        <Link
          href={`/laporan/rapor-dosen${semesterId ? `?semesterId=${semesterId}` : ""}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Rapor Dosen
        </Link>
      </div>
    );
  }

  const dosenIds = ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
  const isDosen = userRole === "DOSEN";

  const res = await getBatchRaporDosenDetails(dosenIds, semesterId);

  let validItems = res.data || [];
  if (isDosen) {
    validItems = validItems.filter((item) => item.dosen.prodi?.id && userProdiIds.includes(item.dosen.prodi.id));
  }

  if (!res.success || validItems.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Gagal Memuat Data Dosen</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          {res.error || (isDosen ? "Dosen yang dipilih berada di luar Program Studi Anda." : "Tidak ada data rapor yang dapat dimuat untuk dosen-dosen yang dipilih.")}
        </p>
        <Link
          href={`/laporan/rapor-dosen${semesterId ? `?semesterId=${semesterId}` : ""}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Rapor Dosen
        </Link>
      </div>
    );
  }

  const activeSemesterId = semesterId || validItems[0].semester.id;

  return <PrintBatchClient items={validItems} semesterId={activeSemesterId} />;
}
