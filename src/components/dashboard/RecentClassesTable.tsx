// src/components/dashboard/RecentClassesTable.tsx
// Compact & Clean Monitored Classes Table (Plus Jakarta Sans)

import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

interface ClassItem {
  id: string;
  kodeKelas: string;
  mataKuliah: string;
  sks: number;
  dosen: string;
  prodi: string;
  progress: number;
  status: "LENGKAP" | "SEBAGIAN" | "BELUM";
}

interface RecentClassesTableProps {
  classes: ClassItem[];
}

export default function RecentClassesTable({ classes }: RecentClassesTableProps) {
  return (
    <div className="duralux-card bg-white p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Status Monitoring Kelas Terkini
          </h3>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            Daftar kelas aktif semester ini yang sedang dimonitor oleh CDU
          </p>
        </div>
        <Link
          href="/monitoring"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a80063] hover:text-[#8c0052] transition-colors"
        >
          <span>Lihat Semua</span>
          <ChevronRight size={13} />
        </Link>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th className="pb-2.5 font-bold">Kode / Kelas</th>
              <th className="pb-2.5 font-bold">Mata Kuliah</th>
              <th className="pb-2.5 font-bold">Dosen Pengampu</th>
              <th className="pb-2.5 font-bold">Progress Sesi</th>
              <th className="pb-2.5 font-bold">Status</th>
              <th className="pb-2.5 text-right font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {classes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-slate-400">
                  Belum ada kelas yang terdaftar. Silakan tambahkan data di menu Master Kelas.
                </td>
              </tr>
            ) : (
              classes.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                  {/* Kode Kelas */}
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex px-2 py-0.5 rounded-md bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-[11px] font-bold">
                      {item.kodeKelas}
                    </span>
                  </td>

                  {/* Mata Kuliah */}
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold text-xs text-slate-900 leading-tight">
                      {item.mataKuliah}
                    </p>
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                      {item.sks} SKS • {item.prodi}
                    </p>
                  </td>

                  {/* Dosen */}
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px] shrink-0">
                        {item.dosen[0]}
                      </div>
                      <span className="font-medium text-xs text-slate-700 truncate max-w-[150px]">
                        {item.dosen}
                      </span>
                    </div>
                  </td>

                  {/* Progress Sesi */}
                  <td className="py-2.5 pr-3 min-w-[120px]">
                    <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 mb-0.5">
                      <span>{item.progress}/16 Sesi</span>
                      <span>{Math.round((item.progress / 16) * 100)}%</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#a80063] to-[#c026d3] rounded-full transition-all duration-300"
                        style={{ width: `${(item.progress / 16) * 100}%` }}
                      />
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-2.5 pr-3">
                    {item.status === "LENGKAP" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        Lengkap
                      </span>
                    )}
                    {item.status === "SEBAGIAN" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                        <span className="w-1 h-1 rounded-full bg-amber-500" />
                        Sebagian
                      </span>
                    )}
                    {item.status === "BELUM" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                        <span className="w-1 h-1 rounded-full bg-rose-500" />
                        Perlu Input
                      </span>
                    )}
                  </td>

                  {/* Action Button */}
                  <td className="py-2.5 text-right">
                    <Link
                      href={`/monitoring/${item.id}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 transition-all shadow-xs"
                      title="Buka Monitoring Kelas"
                    >
                      <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
