"use client";
// src/components/dashboard/MonitoringTrendChart.tsx
// Compact Spline Area Chart (Plus Jakarta Sans)

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

const defaultTrendData = [
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

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-md text-xs z-50">
        <p className="font-semibold text-slate-800 mb-1.5">{data.full}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#a80063]" />
              Kehadiran Dosen:
            </span>
            <span className="font-semibold text-slate-900">{payload[0]?.value}%</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              Kelengkapan Konten:
            </span>
            <span className="font-semibold text-slate-900">{payload[1]?.value}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export interface TrendItem {
  sesi: string;
  full: string;
  kehadiran: number;
  konten: number;
}

interface MonitoringTrendChartProps {
  data?: TrendItem[];
}

export default function MonitoringTrendChart({ data }: MonitoringTrendChartProps) {
  const [filterRange, setFilterRange] = useState<"all" | "half1" | "half2">("all");

  const trendData = data && data.length > 0 ? data : defaultTrendData;

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
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Tren Monitoring Perkuliahan
          </h3>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            Perbandingan kehadiran dosen & kelengkapan konten sesi 1–16
          </p>
        </div>

        {/* Legend & Filter Tabs */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="hidden md:flex items-center gap-3 text-[11px] font-medium mr-1">
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#a80063]" />
              <span>Kehadiran</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
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
              Sesi 1–8
            </button>
            <button
              onClick={() => setFilterRange("half2")}
              className={`px-2 py-0.5 rounded transition-all ${
                filterRange === "half2"
                  ? "bg-white text-[#a80063] font-semibold shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Sesi 9–16
            </button>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayedData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="colorKehadiran" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a80063" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#a80063" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorKonten" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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
            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="kehadiran"
              name="Kehadiran Dosen"
              stroke="#a80063"
              strokeWidth={2}
              fill="url(#colorKehadiran)"
              activeDot={{ r: 5, fill: "#a80063", stroke: "#ffffff", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="konten"
              name="Kelengkapan Konten"
              stroke="#10b981"
              strokeWidth={1.8}
              fill="url(#colorKonten)"
              activeDot={{ r: 4, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
