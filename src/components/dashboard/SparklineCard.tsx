"use client";
// src/components/dashboard/SparklineCard.tsx
// Compact Metric Card (Plus Jakarta Sans)

import { TrendingUp, TrendingDown } from "lucide-react";

interface DetailItem {
  label: string;
  value: string | number;
  color?: "blue" | "emerald" | "violet" | "rose" | "amber" | "slate" | "pink" | "maroon";
}

export interface SegmentItem {
  label?: string;
  value: number;
  color?: "blue" | "emerald" | "violet" | "rose" | "amber" | "slate" | "pink" | "maroon" | string;
}

interface SparklineCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trendText?: string;
  isPositive?: boolean;
  details?: DetailItem[];
  progress?: number;
  progressColor?: "emerald" | "green" | "maroon" | "rose" | "blue" | string;
  valueColor?: "emerald" | "green" | "maroon" | "rose" | "blue" | "slate" | string;
  segments?: SegmentItem[];
}

const colorMap: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200/60",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  violet: "bg-violet-50 text-violet-700 border-violet-200/60",
  rose: "bg-rose-50 text-rose-700 border-rose-200/60",
  amber: "bg-amber-50 text-amber-700 border-amber-200/60",
  slate: "bg-slate-50 text-slate-600 border-slate-200/60",
  pink: "bg-pink-50 text-pink-700 border-pink-200/60",
  maroon: "bg-[#a80063]/10 text-[#a80063] border-[#a80063]/25",
};

const valueColorMap: Record<string, string> = {
  emerald: "text-[#10b981]",
  green: "text-[#10b981]",
  maroon: "text-[#a80063]",
  rose: "text-rose-600",
  blue: "text-blue-600",
  slate: "text-slate-900",
};

const progressColorMap: Record<string, string> = {
  emerald: "bg-[#10b981]",
  green: "bg-[#10b981]",
  maroon: "bg-[#a80063]",
  rose: "bg-[#ef4444]",
  blue: "bg-blue-500",
};

const segmentColorMap: Record<string, string> = {
  emerald: "bg-[#10b981]",
  green: "bg-[#10b981]",
  blue: "bg-[#3b82f6]",
  violet: "bg-[#8b5cf6]",
  purple: "bg-[#8b5cf6]",
  rose: "bg-[#ef4444]",
  amber: "bg-[#f59e0b]",
  maroon: "bg-[#a80063]",
  slate: "bg-slate-400",
};

export default function SparklineCard({
  title,
  value,
  subtitle,
  trendText,
  isPositive = true,
  details,
  progress,
  progressColor,
  valueColor,
  segments,
}: SparklineCardProps) {
  const valueColorClass = valueColor
    ? (valueColorMap[valueColor] || valueColor)
    : "text-slate-900";

  const progressColorClass = progressColor
    ? (progressColorMap[progressColor] || progressColor)
    : "bg-emerald-500";

  return (
    <div className="duralux-card p-3.5 flex flex-col justify-between bg-white relative overflow-hidden group">
      {/* Top Details */}
      <div>
        <div className="flex items-center justify-between gap-1.5 mb-1">
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          {trendText && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold ${
                isPositive
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50"
                  : "bg-rose-50 text-rose-600 border border-rose-200/50"
              }`}
            >
              {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {trendText}
            </span>
          )}
        </div>

        {/* Number */}
        <div className="flex items-baseline gap-2">
          <h3 className={`text-2xl font-bold tracking-tight leading-none ${valueColorClass}`}>
            {value}
          </h3>
        </div>

        {/* Subtitle */}
        <p className="text-[10.5px] text-slate-400 font-normal mt-1">
          {subtitle}
        </p>

        {/* Single Progress Bar (if provided) */}
        {progress !== undefined && (
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2">
            <div
              className={`h-full ${progressColorClass} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}

        {/* Multi-segment Indicator Bar (if provided) */}
        {segments && segments.length > 0 && (
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2 flex">
            {(() => {
              const totalSeg = segments.reduce((acc, s) => acc + (s.value || 0), 0);
              if (totalSeg === 0) {
                return <div className="h-full w-full bg-slate-200/70 rounded-full" />;
              }
              return segments.map((seg, idx) => {
                if (seg.value <= 0) return null;
                const pct = (seg.value / totalSeg) * 100;
                const bgClass = seg.color && seg.color.startsWith("bg-")
                  ? seg.color
                  : segmentColorMap[seg.color || "slate"] || "bg-slate-400";
                return (
                  <div
                    key={idx}
                    className={`h-full ${bgClass} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                    title={`${seg.label || ""}: ${seg.value} (${Math.round(pct)}%)`}
                  />
                );
              });
            })()}
          </div>
        )}

        {/* Details Breakdown Pills */}
        {details && details.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {details.map((d, i) => {
              const cls = colorMap[d.color || "slate"] || colorMap["slate"];
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-semibold ${cls}`}
                >
                  {d.label}: {d.value}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
