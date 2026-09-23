"use client";
// src/components/dashboard/StatusDonutChart.tsx
// Compact Donut Chart with Class Mode Slider (Semua, Offline, Online, Bimbingan)
// Designed for CDU Monitoring Dashboard (Plus Jakarta Sans)

import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatPct } from "@/lib/utils";

export type DonutClassMode = "ALL" | "OFFLINE" | "ONLINE" | "BIMBINGAN";

export interface DonutStatusItem {
  name: string;
  value: number;
  count?: number;
  color: string;
}

export interface ModeDistributionData {
  data: DonutStatusItem[];
  totalSesi: number;
  totalKelas: number;
}

const defaultStatusData: DonutStatusItem[] = [
  { name: "Hadir Lengkap", value: 78, count: 0, color: "#10b981" },
  { name: "Hadir Tidak Lengkap", value: 14, count: 0, color: "#f59e0b" },
  { name: "Alpha / Tidak Hadir", value: 8, count: 0, color: "#ef4444" },
];

interface StatusDonutChartProps {
  distributionByMode?: Record<DonutClassMode, ModeDistributionData>;
  data?: DonutStatusItem[];
  totalSesi?: number;
}

const MODE_OPTIONS: { key: DonutClassMode; label: string; desc: string }[] = [
  { key: "ALL", label: "Semua", desc: "Seluruh jenis kelas semester ini" },
  { key: "OFFLINE", label: "Offline", desc: "Khusus kelas Tatap Muka (Luring)" },
  { key: "ONLINE", label: "Online", desc: "Khusus kelas Daring (LMS)" },
  { key: "BIMBINGAN", label: "Bimbingan", desc: "Khusus kelas Bimbingan (Skripsi/SCP)" },
];

function DonutCustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const data = item.payload;
  return (
    <div className="bg-white px-3 py-2 rounded-xl border border-slate-200/90 shadow-xl text-xs z-50 pointer-events-none min-w-[150px]">
      <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-slate-100">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: item.fill || data.color }}
        />
        <span className="font-bold text-slate-800 text-[11px] truncate">
          {item.name}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-slate-500 font-medium">
          {data.count !== undefined ? `${data.count} Sesi` : "Jumlah"}
        </span>
        <span className="font-extrabold text-slate-900">
          {formatPct(Number(item.value))}
        </span>
      </div>
    </div>
  );
}

export default function StatusDonutChart({
  distributionByMode,
  data,
  totalSesi,
}: StatusDonutChartProps) {
  const [selectedMode, setSelectedMode] = useState<DonutClassMode>("ALL");
  const [isHovered, setIsHovered] = useState(false);

  const currentModeInfo = MODE_OPTIONS.find((m) => m.key === selectedMode) || MODE_OPTIONS[0];

  const currentModeData = distributionByMode ? distributionByMode[selectedMode] : undefined;
  const chartData = currentModeData?.data || data || defaultStatusData;
  const currentTotalSesi =
    currentModeData !== undefined
      ? currentModeData.totalSesi
      : totalSesi !== undefined
      ? totalSesi
      : 0;
  const currentTotalKelas = currentModeData?.totalKelas;

  return (
    <div className="duralux-card p-4 sm:p-5 bg-white flex flex-col justify-between h-full">
      {/* ── Header with Title & Slider Tabs ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Distribusi Kehadiran
          </h3>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            {currentModeInfo.desc}
          </p>
        </div>

        {/* Mode Slider Tabs (Semua | Offline | Online | Bimbingan) */}
        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/60 text-[10.5px] font-medium text-slate-500 self-start sm:self-auto shrink-0">
          {MODE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedMode(key)}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                selectedMode === key
                  ? "bg-white text-[#a80063] font-bold shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Donut Chart Visual ───────────────────────────────────────────── */}
      <div className="relative h-44 w-full my-auto flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart onMouseLeave={() => setIsHovered(false)}>
            <Tooltip
              content={<DonutCustomTooltip />}
              wrapperStyle={{ zIndex: 50, pointerEvents: "none" }}
            />
            {currentTotalSesi > 0 ? (
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                  />
                ))}
              </Pie>
            ) : (
              <Pie
                data={[{ value: 1, color: "#f1f5f9" }]}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="#f1f5f9" />
              </Pie>
            )}
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label: Jumlah Sesi yang Terisi (Sembunyi saat hover agar tidak menimpa tooltip) */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2 z-10 transition-opacity duration-200 ${
            isHovered ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Terisi
          </span>
          <span className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
            {currentTotalSesi} Sesi
          </span>
          {currentTotalKelas !== undefined && currentTotalKelas > 0 && (
            <span className="text-[9.5px] text-slate-400 font-medium mt-0.5">
              dari {currentTotalKelas} kelas
            </span>
          )}
        </div>
      </div>

      {/* ── Legend Rows (Anti-Overlap Layout) ─────────────────────────────── */}
      <div className="space-y-0.5 pt-1.5 border-t border-slate-100">
        {chartData.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between text-[10.5px] py-0"
          >
            {/* Kiri: Dot Warna & Nama Status */}
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-medium text-slate-600 truncate text-[10.5px]" title={item.name}>
                {item.name}
              </span>
            </div>

            {/* Kanan: Badge Jumlah Sesi Terisi + Persentase Terpisah Bersih */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-[1px] rounded border border-slate-200/50">
                {item.count ?? 0} Sesi
              </span>
              <span className="font-bold text-slate-800 min-w-[38px] text-right text-[10.5px]">
                {formatPct(item.value)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
