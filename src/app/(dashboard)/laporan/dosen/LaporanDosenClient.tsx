"use client";
// src/app/(dashboard)/laporan/dosen/LaporanDosenClient.tsx
// Laporan Kinerja & Evaluasi Dosen (Plus Jakarta Sans & #a80063 Theme)

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  School,
  IdCard,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  Printer,
  Sparkles,
} from "lucide-react";

interface DosenReportItem {
  id: string;
  nama: string;
  nidn: string | null;
  prodi: {
    id: string;
    nama: string;
    kode: string;
  };
  kelasList: Array<{
    id: string;
    kodeKelas: string;
    mataKuliah: { nama: string; kode: string; sks: number };
    modePembelajaran?: "DARING" | "LURING" | "BIMBINGAN";
    totalSesiBeban?: number;
    sesiDiajar?: number[];
    statusPenugasan?: string;
    totalHadir: number;
    persenKehadiran: number;
    totalSkorKonten: number;
    maxSkorKonten?: number;
    persenKonten: number;
    statusEvaluasi: string;
  }>;
  totalKelas: number;
  avgKehadiran: number;
  avgKonten: number;
  status: "SANGAT_BAIK" | "BAIK" | "PERLU_PEMBINAAN";
}

interface SemesterOption {
  id: string;
  tahunAkademik: string;
  periode: string;
  aktif: boolean;
}

interface LaporanDosenClientProps {
  dosenReports: DosenReportItem[];
  semesters: SemesterOption[];
  defaultSemesterId: string;
}

export default function LaporanDosenClient({
  dosenReports,
  semesters,
  defaultSemesterId,
}: LaporanDosenClientProps) {
  const [selectedSemester, setSelectedSemester] = useState(defaultSemesterId);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expandedDosenId, setExpandedDosenId] = useState<string | null>(null);

  const filtered = dosenReports.filter((d) => {
    const matchSearch =
      d.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.nidn && d.nidn.includes(searchQuery));
    const matchStatus = filterStatus === "ALL" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)] print:hidden">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <Users size={18} className="text-[#a80063]" />
            <span>Laporan Evaluasi Kinerja Dosen</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Agregasi performa kehadiran mengajar dan kelengkapan materi per dosen pengampu
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
          >
            <Printer size={14} />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* ── Search & Filter Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/70 print:hidden">
        <div className="relative w-full max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari dosen / NIDN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-slate-50 text-xs rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Semester */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Semester:</span>
            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                window.location.href = `/laporan/dosen?semesterId=${e.target.value}`;
              }}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[150px] truncate"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tahunAkademik} ({s.periode})
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Kinerja:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
            >
              <option value="ALL">Semua</option>
              <option value="SANGAT_BAIK">Sangat Baik (≥90%)</option>
              <option value="BAIK">Baik (75%–89%)</option>
              <option value="PERLU_PEMBINAAN">Perlu Pembinaan (&lt;75%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div className="duralux-card bg-white p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-2.5 font-bold">Nama Dosen</th>
                <th className="pb-2.5 font-bold">Homebase Prodi</th>
                <th className="pb-2.5 font-bold text-center">Kelas Diampu</th>
                <th className="pb-2.5 font-bold text-center">Rata Kehadiran</th>
                <th className="pb-2.5 font-bold text-center">Rata Konten</th>
                <th className="pb-2.5 font-bold text-center">Status Evaluasi</th>
                <th className="pb-2.5 text-right font-bold print:hidden">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                    Tidak ada data dosen yang sesuai.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const isExpanded = expandedDosenId === d.id;

                  return (
                    <React.Fragment key={d.id}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        {/* Nama Dosen */}
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#a80063]/15 to-[#d946ef]/20 border border-[#fbcfe8] text-[#a80063] font-bold text-xs flex items-center justify-center shrink-0">
                              {d.nama[0]}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-slate-900 leading-tight">
                                {d.nama}
                              </p>
                              {d.nidn && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  NIDN: {d.nidn}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Homebase Prodi */}
                        <td className="py-3 pr-3 font-medium text-slate-600">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                            {d.prodi.kode} - {d.prodi.nama}
                          </span>
                        </td>

                        {/* Kelas Diampu */}
                        <td className="py-3 pr-3 text-center">
                          <span className="font-bold text-slate-800 text-xs">
                            {d.totalKelas} Kelas
                          </span>
                        </td>

                        {/* Rata Kehadiran */}
                        <td className="py-3 pr-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-bold text-emerald-600 text-xs">
                              {d.avgKehadiran}%
                            </span>
                            <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${d.avgKehadiran}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Rata Konten */}
                        <td className="py-3 pr-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-bold text-[#a80063] text-xs">
                              {d.avgKonten}%
                            </span>
                            <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-[#a80063] rounded-full"
                                style={{ width: `${d.avgKonten}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status Evaluasi */}
                        <td className="py-3 pr-3 text-center">
                          {d.status === "SANGAT_BAIK" && (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Sangat Baik
                            </span>
                          )}
                          {d.status === "BAIK" && (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Baik
                            </span>
                          )}
                          {d.status === "PERLU_PEMBINAAN" && (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Perlu Pembinaan
                            </span>
                          )}
                        </td>

                        {/* Detail Accordion Toggle */}
                        <td className="py-3 text-right print:hidden">
                          <button
                            onClick={() =>
                              setExpandedDosenId(isExpanded ? null : d.id)
                            }
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 inline-flex items-center justify-center transition-all cursor-pointer"
                            title="Rincian Kelas"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-table for Classes of this Lecturer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 animate-fade-in">
                          <td colSpan={7} className="p-4">
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Rincian Kelas yang Diampu ({d.kelasList.length} Kelas):
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold">
                                      <th className="pb-1">Kode Kelas</th>
                                      <th className="pb-1">Mata Kuliah</th>
                                      <th className="pb-1 text-center">Kehadiran</th>
                                      <th className="pb-1 text-center">Skor Konten</th>
                                      <th className="pb-1 text-center">Status</th>
                                      <th className="pb-1 text-right">Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {d.kelasList.map((cls) => (
                                      <tr key={cls.id}>
                                        <td className="py-2 font-bold text-[#a80063]">
                                          <div className="flex items-center gap-1.5">
                                            <span>{cls.kodeKelas}</span>
                                            {cls.modePembelajaran && (
                                              <span
                                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                                                  cls.modePembelajaran === "BIMBINGAN"
                                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                                    : cls.modePembelajaran === "LURING"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                                }`}
                                              >
                                                {cls.modePembelajaran === "BIMBINGAN"
                                                  ? "Bimbingan"
                                                  : cls.modePembelajaran === "LURING"
                                                  ? "Offline"
                                                  : "Online"}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-2">
                                          <p className="font-semibold text-slate-800">
                                            {cls.mataKuliah.nama} ({cls.mataKuliah.sks} SKS)
                                          </p>
                                          {cls.statusPenugasan && cls.statusPenugasan !== "Penuh (Sesi 1–16)" && (
                                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]">
                                              {cls.statusPenugasan}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 text-center font-semibold text-emerald-600">
                                          {cls.totalHadir}/{cls.totalSesiBeban ?? 16} ({cls.persenKehadiran}%)
                                        </td>
                                        <td className="py-2 text-center font-semibold text-slate-700">
                                          {cls.modePembelajaran === "BIMBINGAN" ? (
                                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                              Bebas Konten
                                            </span>
                                          ) : (
                                            <span>
                                              {cls.totalSkorKonten}/{cls.maxSkorKonten ?? 42} ({cls.persenKonten}%)
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 text-center">
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                                            {cls.statusEvaluasi}
                                          </span>
                                        </td>
                                        <td className="py-2 text-right">
                                          <Link
                                            href={`/monitoring/${cls.id}`}
                                            className="text-xs font-semibold text-[#a80063] hover:underline"
                                          >
                                            Monitoring →
                                          </Link>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React from "react";
