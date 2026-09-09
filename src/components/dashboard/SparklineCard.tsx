"use client";
// src/components/dashboard/SparklineCard.tsx
// Compact Metric Card with Mini Sparkline Wave Chart (Plus Jakarta Sans)

import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface SparklineCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trendText?: string;
  isPositive?: boolean;
  colorHex: string;
  chartData: { val: number }[];
}

export default function SparklineCard({
  title,
  value,
  subtitle,
  trendText,
  isPositive = true,
  colorHex,
  chartData,
}: SparklineCardProps) {
  const gradientId = `gradient-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="duralux-card p-4 flex flex-col justify-between bg-white relative overflow-hidden group">
      {/* Top Details */}
      <div>
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          {trendText && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isPositive
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50"
                  : "bg-rose-50 text-rose-600 border border-rose-200/50"
              }`}
            >
              {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {trendText}
            </span>
          )}
        </div>

        {/* Number */}
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
            {value}
          </h3>
        </div>

        {/* Subtitle */}
        <p className="text-[11px] text-slate-400 font-normal mt-1 truncate">
          {subtitle}
        </p>
      </div>

      {/* Mini Sparkline Chart Area */}
      <div className="h-10 w-full mt-2 -mb-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorHex} stopOpacity={0.2} />
                <stop offset="100%" stopColor={colorHex} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="val"
              stroke={colorHex}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
