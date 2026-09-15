"use client";
// src/components/dashboard/WeeklyMonitoringTrendChart.tsx
// Compact Spline Area Chart for Weekly Lecture Trends (Minggu 1 - 16)
// Designed for CDU Monitoring (Plus Jakarta Sans)

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatPct } from "@/lib/utils";
import { useState } from "react";
import { CalendarDays } from "lucide-react";

export interface WeeklyTrendItem {
  minggu: string; // "M1", "M2", ..., "M16"
  full: string; // "Minggu 1", "Minggu 8 (UTS)", dsb.
  periodeLabel?: string;
  kehadiran: number;
  konten: number;
  totalSesi?: number;
  totalHadir?: number;
}

const defaultWeeklyTrendData: WeeklyTrendItem[] = [
  { minggu: "M1", full: "Minggu 1", periodeLabel: "Awal Perkuliahan", kehadiran: 94, konten: 88, totalSesi: 3, totalHadir: 3 },
  { minggu: "M2", full: "Minggu 2", periodeLabel: "Perkuliahan Rutin", kehadiran: 92, konten: 85, totalSesi: 3, totalHadir: 3 },
  { minggu: "M3", full: "Minggu 3", periodeLabel: "Perkuliahan Rutin", kehadiran: 96, konten: 90, totalSesi: 3, totalHadir: 3 },
  { minggu: "M4", full: "Minggu 4", periodeLabel: "Perkuliahan Rutin", kehadiran: 89, konten: 82, totalSesi: 3, totalHadir: 3 },
  { minggu: "M5", full: "Minggu 5", periodeLabel: "Perkuliahan Rutin", kehadiran: 94, konten: 87, totalSesi: 3, totalHadir: 3 },
  { minggu: "M6", full: "Minggu 6", periodeLabel: "Perkuliahan Rutin", kehadiran: 91, konten: 86, totalSesi: 3, totalHadir: 3 },
  { minggu: "M7", full: "Minggu 7", periodeLabel: "Review Pra-UTS", kehadiran: 88, konten: 84, totalSesi: 3, totalHadir: 3 },
  { minggu: "M8", full: "Minggu 8 (UTS)", periodeLabel: "Pekan Ujian Tengah Semester", kehadiran: 98, konten: 98, totalSesi: 3, totalHadir: 3 },
  { minggu: "M9", full: "Minggu 9", periodeLabel: "Pasca UTS", kehadiran: 93, konten: 89, totalSesi: 3, totalHadir: 3 },
  { minggu: "M10", full: "Minggu 10", periodeLabel: "Perkuliahan Rutin", kehadiran: 90, konten: 85, totalSesi: 3, totalHadir: 3 },
  { minggu: "M11", full: "Minggu 11", periodeLabel: "Perkuliahan Rutin", kehadiran: 87, konten: 81, totalSesi: 3, totalHadir: 3 },
  { minggu: "M12", full: "Minggu 12", periodeLabel: "Perkuliahan Rutin", kehadiran: 92, konten: 88, totalSesi: 3, totalHadir: 3 },
  { minggu: "M13", full: "Minggu 13", periodeLabel: "Perkuliahan Rutin", kehadiran: 95, konten: 91, totalSesi: 3, totalHadir: 3 },
  { minggu: "M14", full: "Minggu 14", periodeLabel: "Perkuliahan Rutin", kehadiran: 89, konten: 83, totalSesi: 3, totalHadir: 3 },
  { minggu: "M15", full: "Minggu 15", periodeLabel: "Review Pra-UAS", kehadiran: 94, konten: 89, totalSesi: 3, totalHadir: 3 },
  { minggu: "M16", full: "Minggu 16 (UAS)", periodeLabel: "Pekan Ujian Akhir Semester", kehadiran: 99, konten: 99, totalSesi: 3, totalHadir: 3 },
];

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data: WeeklyTrendItem = payload[0]?.payload;
    return (
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-lg text-xs z-50 min-w-[190px]">
        <div className="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-900 font-bold">
            <CalendarDays size={13} className="text-[#a80063]" />
            <span>{data.full}</span>
          </div>
          {data.periodeLabel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
              {data.periodeLabel}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              Kehadiran Dosen:
            </span>
            <span className="font-bold text-slate-900">{formatPct(payload[0]?.value)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#a80063]" />
              Kelengkapan Konten:
            </span>
            <span className="font-bold text-slate-900">{formatPct(payload[1]?.value)}</span>
          </div>
          {data.totalSesi !== undefined && data.totalSesi > 0 && (
            <div className="pt-1 mt-1 border-t border-slate-50 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Sesi Terlaksana:</span>
              <span className="font-semibold text-slate-600">{data.totalSesi} Kelas Terisi</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

interface WeeklyMonitoringTrendChartProps {
  data?: WeeklyTrendItem[];
}

export default function WeeklyMonitoringTrendChart({ data }: WeeklyMonitoringTrendChartProps) {
  const [filterRange, setFilterRange] = useState<"all" | "half1" | "half2">("all");

  const trendData = data && data.length > 0 ? data : defaultWeeklyTrendData;

  const displayedData =
    filterRange === "half1"
      ? trendData.slice(0, 8)
      : filterRange === "half2"
      ? trendData.slice(8, 16)
      : trendData;

  return (
    <div className="duralux-card p-5 bg-white flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#fdf2f8] text-[#a80063]">
              <CalendarDays size={12} />
            </span>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Tren Monitoring Mingguan
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            Perbandingan kehadiran dosen & kelengkapan konten periode Minggu 1–16
          </p>
        </div>

        {/* Legend & Filter Tabs */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="hidden md:flex items-center gap-3 text-[11px] font-medium mr-1">
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>Kehadiran</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#a80063]" />
              <span>Konten</span>
            </div>
          </div>

          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/60 text-[11px] font-medium text-slate-500">
            <button
              onClick={() => setFilterRange("all")}
              className={`px-2 py-0.5 rounded transition-all ${
                filterRange === "all"
                  ? "bg-white text-[#a80063] font-semibold shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterRange("half1")}
              className={`px-2 py-0.5 rounded transition-all ${
                filterRange === "half1"
                  ? "bg-white text-[#a80063] font-semibold shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Mgg 1–8
            </button>
            <button
              onClick={() => setFilterRange("half2")}
              className={`px-2 py-0.5 rounded transition-all ${
                filterRange === "half2"
                  ? "bg-white text-[#a80063] font-semibold shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Mgg 9–16
            </button>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayedData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="colorKehadiranWeekly" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorKontenWeekly" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a80063" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#a80063" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="minggu"
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
            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="kehadiran"
              name="Kehadiran Dosen"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#colorKehadiranWeekly)"
              activeDot={{ r: 5, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="konten"
              name="Kelengkapan Konten"
              stroke="#a80063"
              strokeWidth={1.8}
              fill="url(#colorKontenWeekly)"
              activeDot={{ r: 4, fill: "#a80063", stroke: "#ffffff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
