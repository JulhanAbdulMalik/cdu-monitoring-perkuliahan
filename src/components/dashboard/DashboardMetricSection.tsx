"use client";
// src/components/dashboard/DashboardMetricSection.tsx
// Interactive Dashboard Header & 4 Stat Cards with "Sesi Berjalan" & "16 Sesi" Modes

import { useState } from "react";
import SparklineCard from "@/components/dashboard/SparklineCard";
import { formatPct } from "@/lib/utils";

export interface DashboardMetricSectionProps {
  userName: string;
  semesterText: string;
  currentActiveSesi: number;

  // Card 1: Total Kelas Aktif
  totalKelas: number;
  totalProdi: number;
  totalDosen: number;
  kelasOffline: number;
  kelasOnline: number;
  kelasBimbingan: number;

  // Card 4: Kelas Perlu Perhatian
  kelasPerluPerhatianCount: number;
  totalAlpha: number;

  // Mode: Sesi Berjalan (Default)
  berjalan: {
    avgKehadiran: number;
    totalHadir: number;
    totalSesiTerlaksana: number;
    targetSesiBerjalan?: number;
    avgKonten: number;
    persenProgresMonitoring?: number;
    belumDimonitorSesiBerjalan?: number;
  };

  // Mode: 16 Sesi (Semester Penuh)
  full: {
    avgKehadiran: number;
    totalHadir: number;
    totalJadwalSesi: number;
    avgKonten: number;
    totalKelasNonBimbingan: number;
    persenProgresMonitoring?: number;
    belumDimonitorSemester?: number;
  };
}

export default function DashboardMetricSection({
  userName,
  semesterText,
  currentActiveSesi,
  totalKelas,
  totalProdi,
  totalDosen,
  kelasOffline,
  kelasOnline,
  kelasBimbingan,
  kelasPerluPerhatianCount,
  totalAlpha,
  berjalan,
  full,
}: DashboardMetricSectionProps) {
  const [mode, setMode] = useState<"BERJALAN" | "FULL">("BERJALAN");

  const isBerjalan = mode === "BERJALAN";

  return (
    <div className="space-y-4">
      {/* ── 1. Top Greeting & Mode Toggle Switcher ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none">
            Selamat Datang, {userName}! 👋
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Berikut ringkasan aktivitas monitoring perkuliahan semester{" "}
            <span className="font-semibold text-[#a80063]">
              {semesterText}
            </span>
          </p>
        </div>

        {/* ── Mode Toggle Controls [ Sesi Berjalan | 16 Sesi ] ────────────────── */}
        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/60 text-[11px] font-medium text-slate-500 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setMode("BERJALAN")}
            className={`px-2.5 sm:px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              isBerjalan
                ? "bg-white text-[#a80063] font-semibold shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
            title="Tampilkan data berdasarkan sesi perkuliahan yang sedang/sudah berjalan"
          >
            <span>Sesi Berjalan</span>
            <span
              className={`text-[9.5px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                isBerjalan
                  ? "bg-[#a80063]/10 text-[#a80063]"
                  : "bg-slate-200/70 text-slate-500"
              }`}
            >
              S1–S{currentActiveSesi}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("FULL")}
            className={`px-2.5 sm:px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              !isBerjalan
                ? "bg-white text-[#a80063] font-semibold shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
            title="Tampilkan data terhadap target 16 sesi semester penuh"
          >
            <span>16 Sesi</span>
            <span
              className={`text-[9.5px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                !isBerjalan
                  ? "bg-[#a80063]/10 text-[#a80063]"
                  : "bg-slate-200/70 text-slate-500"
              }`}
            >
              Semester
            </span>
          </button>
        </div>
      </div>

      {/* ── 2. Top 4 Metric Cards with Dynamic Modes ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Kelas Aktif */}
        <SparklineCard
          title="Total Kelas Aktif"
          value={totalKelas}
          subtitle={`${totalProdi} Prodi • ${totalDosen} Dosen terdaftar`}
          trendText="Sem. Aktif"
          isPositive={true}
          segments={[
            { label: "Offline", value: kelasOffline, color: "blue" },
            { label: "Online", value: kelasOnline, color: "emerald" },
            { label: "Bimbingan", value: kelasBimbingan, color: "violet" },
          ]}
          details={[
            { label: "Offline", value: kelasOffline, color: "blue" },
            { label: "Online", value: kelasOnline, color: "emerald" },
            { label: "Bimbingan", value: kelasBimbingan, color: "violet" },
          ]}
        />

        {/* Card 2: Rata-rata Kehadiran */}
        <SparklineCard
          title={isBerjalan ? "Rata-rata Kehadiran" : "Rata-rata Kehadiran (16 Sesi)"}
          value={formatPct(isBerjalan ? berjalan.avgKehadiran : full.avgKehadiran)}
          valueColor="emerald"
          subtitle={
            isBerjalan
              ? `Seluruh ${totalKelas} kelas • ${berjalan.totalSesiTerlaksana} sesi tercatat`
              : `Seluruh ${totalKelas} kelas • Target ${full.totalJadwalSesi} sesi`
          }
          trendText={
            isBerjalan
              ? berjalan.avgKehadiran >= 90
                ? "Target Tercapai"
                : berjalan.avgKehadiran >= 80
                ? "Mendekati Target"
                : "Perlu Peningkatan"
              : full.avgKehadiran >= 90
              ? "Target Tercapai"
              : "Target 16 Sesi"
          }
          isPositive={isBerjalan ? berjalan.avgKehadiran >= 80 : full.avgKehadiran >= 90}
          progress={isBerjalan ? berjalan.avgKehadiran : full.avgKehadiran}
          progressColor="emerald"
          details={[
            {
              label: "Hadir",
              value: `${isBerjalan ? berjalan.totalHadir : full.totalHadir}`,
              color: "emerald",
            },
            { label: "Alpha", value: `${totalAlpha}`, color: "rose" },
            {
              label: isBerjalan ? "Target CDU" : "Target",
              value: isBerjalan ? "≥90%" : "16 Sesi",
              color: "slate",
            },
          ]}
        />

        {/* Card 3: Rata-rata Konten */}
        <SparklineCard
          title={isBerjalan ? "Rata-rata Konten" : "Rata-rata Konten (16 Sesi)"}
          value={formatPct(isBerjalan ? berjalan.avgKonten : full.avgKonten)}
          valueColor="maroon"
          subtitle={
            isBerjalan
              ? `Rerata skor 3 Pilar dari sesi berjalan (Non-Bimbingan)`
              : `Rerata skor 3 Pilar dari ${full.totalKelasNonBimbingan} kelas reguler`
          }
          trendText={
            (isBerjalan ? berjalan.avgKonten : full.avgKonten) >= 75
              ? "Sesuai Standar"
              : "Perlu Optimasi"
          }
          isPositive={(isBerjalan ? berjalan.avgKonten : full.avgKonten) >= 75}
          progress={isBerjalan ? berjalan.avgKonten : full.avgKonten}
          progressColor="maroon"
          details={[
            { label: "L/S", value: "Pilar 1", color: "maroon" },
            { label: "T/Q", value: "Pilar 2", color: "maroon" },
            { label: "V/C", value: "Pilar 3", color: "maroon" },
          ]}
        />

        {/* Card 4: Kelas Perlu Perhatian */}
        <SparklineCard
          title="Kelas Perlu Perhatian"
          value={`${kelasPerluPerhatianCount} Kelas`}
          subtitle={`${totalAlpha} sesi alpha terdeteksi`}
          trendText={
            kelasPerluPerhatianCount === 0
              ? "Kondisi Baik"
              : `${kelasPerluPerhatianCount} Perlu Dicek`
          }
          isPositive={kelasPerluPerhatianCount === 0}
          segments={[
            { label: "Perhatian", value: kelasPerluPerhatianCount, color: "rose" },
            {
              label: "Terlaksana",
              value: Math.max(0, totalKelas - kelasPerluPerhatianCount),
              color: "emerald",
            },
          ]}
          details={[
            { label: "Perhatian", value: kelasPerluPerhatianCount, color: "rose" },
            {
              label: "Terlaksana",
              value: Math.max(0, totalKelas - kelasPerluPerhatianCount),
              color: "emerald",
            },
          ]}
        />
      </div>
    </div>
  );
}
