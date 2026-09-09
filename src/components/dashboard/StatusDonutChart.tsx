"use client";
// src/components/dashboard/StatusDonutChart.tsx
// Compact Donut Chart (Plus Jakarta Sans)

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

export interface DonutStatusItem {
  name: string;
  value: number;
  count?: number;
  color: string;
}

const defaultStatusData: DonutStatusItem[] = [
  { name: "Hadir Lengkap", value: 78, count: 0, color: "#10b981" },
  { name: "Hadir Tidak Lengkap", value: 14, count: 0, color: "#f59e0b" },
  { name: "Alpha / Tidak Hadir", value: 8, count: 0, color: "#ef4444" },
];

interface StatusDonutChartProps {
  data?: DonutStatusItem[];
  totalSesi?: number;
}

export default function StatusDonutChart({ data, totalSesi }: StatusDonutChartProps) {
  const chartData = data && data.length > 0 ? data : defaultStatusData;
  const displayTotal = totalSesi !== undefined ? `${totalSesi} Sesi` : "100%";

  return (
    <div className="duralux-card p-5 bg-white flex flex-col justify-between">
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
          Distribusi Kehadiran
        </h3>
        <p className="text-[11px] text-slate-400 font-normal mt-0.5">
          Proporsi status perkuliahan semester ini
        </p>
      </div>

      {/* Donut Chart */}
      <div className="relative h-44 w-full my-auto flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(value: any, name: any, entry: any) => {
                const countText = entry?.payload?.count !== undefined ? ` (${entry.payload.count} sesi)` : "";
                return [`${value}%${countText}`, name];
              }}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                fontSize: "11px",
                fontWeight: 600,
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
            />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={74}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {totalSesi !== undefined ? "Terisi" : "Total Sesi"}
          </span>
          <span className="text-lg font-bold text-slate-900 leading-tight">
            {displayTotal}
          </span>
        </div>
      </div>

      {/* Legend Rows */}
      <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-medium text-slate-600 truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.count !== undefined && (
                <span className="text-[10px] text-slate-400">({item.count})</span>
              )}
              <span className="font-semibold text-slate-900">{item.value}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
