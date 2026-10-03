"use client";
// src/components/dashboard/MonitoringTrendChart.tsx
// Compact & Unified Spline Area Chart dengan Pemisah Jenis Kelas (Semua, Offline, Online, Bimbingan)
// Designed for CDU Monitoring Dashboard (Plus Jakarta Sans)

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useState } from "react";
import { formatPct } from "@/lib/utils";

export type TrendClassMode = "ALL" | "OFFLINE" | "ONLINE" | "BIMBINGAN";

export interface TrendItem {
  sesi: string;
  full: string;
  kehadiran: number;
  konten: number;
  totalTerisi?: number;
  totalRegular?: number;
  totalSkorPilar?: number;
}

export type TrendDataByMode = Record<TrendClassMode, TrendItem[]>;

// Backwards compatibility if needed
export type WeeklyTrendItem = TrendItem;

const defaultSessionData: TrendItem[] = [
  { sesi: "S1", full: "Sesi 1", kehadiran: 95, konten: 88 },
  { sesi: "S2", full: "Sesi 2", kehadiran: 92, konten: 85 },
  { sesi: "S3", full: "Sesi 3", kehadiran: 96, konten: 90 },
  { sesi: "S4", full: "Sesi 4", kehadiran: 89, konten: 82 },
  { sesi: "S5", full: "Sesi 5", kehadiran: 94, konten: 87 },
  { sesi: "S6", full: "Sesi 6", kehadiran: 91, konten: 86 },
  { sesi: "S7", full: "Sesi 7", kehadiran: 88, konten: 84 },
  { sesi: "UTS", full: "Sesi 8 (UTS)", kehadiran: 98, konten: 98 },
  { sesi: "S9", full: "Sesi 9", kehadiran: 93, konten: 89 },
  { sesi: "S10", full: "Sesi 10", kehadiran: 90, konten: 85 },
  { sesi: "S11", full: "Sesi 11", kehadiran: 87, konten: 81 },
  { sesi: "S12", full: "Sesi 12", kehadiran: 92, konten: 88 },
  { sesi: "S13", full: "Sesi 13", kehadiran: 95, konten: 91 },
  { sesi: "S14", full: "Sesi 14", kehadiran: 89, konten: 83 },
  { sesi: "S15", full: "Sesi 15", kehadiran: 94, konten: 89 },
  { sesi: "UAS", full: "Sesi 16 (UAS)", kehadiran: 99, konten: 99 },
];

const MODE_OPTIONS: { key: TrendClassMode; label: string; desc: string }[] = [
  { key: "ALL", label: "Semua", desc: "Seluruh jenis kelas semester ini" },
  { key: "OFFLINE", label: "Offline", desc: "Khusus kelas Tatap Muka (Luring)" },
  { key: "ONLINE", label: "Online", desc: "Khusus kelas Daring (LMS)" },
  { key: "BIMBINGAN", label: "Bimbingan", desc: "Khusus kelas Bimbingan (Skripsi/SCP)" },
];

function CustomTooltip({ active, payload, isBimbingan }: any) {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-lg text-xs z-50 min-w-[170px]">
        <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-100">
          <p className="font-bold text-slate-800">{data.full}</p>
          {isBimbingan && (
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-100">
              Bimbingan
            </span>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              Kehadiran Dosen:
            </span>
            <span className="font-bold text-slate-900">{formatPct(payload[0]?.value)}</span>
          </div>
          {!isBimbingan && payload[1] && (
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-[#a80063]" />
                Kelengkapan Konten:
              </span>
              <span className="font-bold text-slate-900">{formatPct(payload[1]?.value)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

interface MonitoringTrendChartProps {
  trendDataByMode?: TrendDataByMode;
  sessionData?: TrendItem[];
  weeklyData?: any[]; // Deprecated, kept for backward compatibility
  data?: TrendItem[];
}

export default function MonitoringTrendChart({
  trendDataByMode,
  sessionData,
  data,
}: MonitoringTrendChartProps) {
  const [selectedMode, setSelectedMode] = useState<TrendClassMode>("ALL");
  const [filterRange, setFilterRange] = useState<"all" | "half1" | "half2">("all");

  const isBimbingan = selectedMode === "BIMBINGAN";
  const currentModeInfo = MODE_OPTIONS.find((m) => m.key === selectedMode) || MODE_OPTIONS[0];

  const currentDataset = (trendDataByMode && trendDataByMode[selectedMode])
    ? trendDataByMode[selectedMode]
    : (sessionData && sessionData.length > 0)
    ? sessionData
    : (data && data.length > 0)
    ? data
    : defaultSessionData;

  const displayedData =
    filterRange === "half1"
      ? currentDataset.slice(0, 8)
      : filterRange === "half2"
      ? currentDataset.slice(8, 16)
      : currentDataset;

  return (
    <div className="duralux-card p-4 sm:p-5 bg-white flex flex-col justify-between h-full">
      {/* ── Chart Header with Mode Toggle & Range Filter ──────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
              Tren Monitoring Perkuliahan
            </h3>
            {/* Mode Switcher Pill (Semua, Offline, Online, Bimbingan) */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/60 text-[10.5px] font-medium">
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMode(m.key)}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    selectedMode === m.key
                      ? "bg-white text-[#a80063] font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            {isBimbingan
              ? "Tren kehadiran dosen sesi perkuliahan (bebas evaluasi 3 pilar konten)"
              : `Perbandingan kehadiran dosen & kelengkapan konten sesi perkuliahan (${currentModeInfo.desc})`}
          </p>
        </div>

        {/* Legend & Filter Tabs */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <div className="hidden md:flex items-center gap-2.5 text-[11px] font-medium mr-1">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>Kehadiran</span>
            </div>
            {!isBimbingan && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-[#a80063]" />
                <span>Konten</span>
              </div>
            )}
          </div>

          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/60 text-[10.5px] font-medium text-slate-500">
            <button
              type="button"
              onClick={() => setFilterRange("all")}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterRange === "all"
                  ? "bg-white text-[#a80063] font-bold shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterRange("half1")}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterRange === "half1"
                  ? "bg-white text-[#a80063] font-bold shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              S1–8
            </button>
            <button
              type="button"
              onClick={() => setFilterRange("half2")}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterRange === "half2"
                  ? "bg-white text-[#a80063] font-bold shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              S9–16
            </button>
          </div>
        </div>
      </div>

      {/* ── Compact Chart Area ────────────────────────────────────────────── */}
      <div className="h-44 sm:h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayedData as any[]} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="colorKehadiran" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorKonten" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a80063" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#a80063" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="sesi"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 500 }}
              dy={6}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip isBimbingan={isBimbingan} />} />

            <Area
              type="monotone"
              dataKey="kehadiran"
              name="Kehadiran Dosen"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#colorKehadiran)"
              activeDot={{ r: 4, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
            />
            {!isBimbingan && (
              <Area
                type="monotone"
                dataKey="konten"
                name="Kelengkapan Konten"
                stroke="#a80063"
                strokeWidth={1.8}
                fill="url(#colorKonten)"
                activeDot={{ r: 4, fill: "#a80063", stroke: "#ffffff", strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
