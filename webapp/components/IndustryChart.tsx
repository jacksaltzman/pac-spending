"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import type { IndustrySectorTotal } from "@/lib/data";

interface IndustryChartProps {
  sectors: IndustrySectorTotal[];
  sectorColors: Record<string, string>;
}

function formatDollarsShort(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default function IndustryChart({
  sectors,
  sectorColors,
}: IndustryChartProps) {
  const data = useMemo(() => {
    return sectors
      .filter((s) => s.combined_total > 0)
      .sort((a, b) => b.combined_total - a.combined_total)
      .slice(0, 12)
      .map((s) => ({
        sector:
          s.sector.length > 20 ? s.sector.slice(0, 18) + "…" : s.sector,
        sectorFull: s.sector,
        individual: s.individual_total,
        pac: s.pac_total,
        color: sectorColors[s.sector] || "#9CA3AF",
      }));
  }, [sectors, sectorColors]);

  if (data.length === 0) return null;

  return (
    <div>
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
            barCategoryGap="20%"
          >
            <XAxis
              type="number"
              tickFormatter={formatDollarsShort}
              tick={{ fontSize: 11, fill: "#78716c" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="sector"
              width={160}
              tick={{ fontSize: 11, fill: "#44403c" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={((value: number | undefined, name: string | undefined) => [
                formatDollarsShort(value ?? 0),
                name === "individual"
                  ? "Individual Employee $"
                  : "Direct PAC $",
              ]) as never}
              contentStyle={{
                backgroundColor: "#111",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e7e5e4",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value: string) =>
                value === "individual"
                  ? "Individual Employee Contributions"
                  : "Direct PAC Contributions"
              }
            />
            <Bar dataKey="individual" stackId="a" radius={[0, 0, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
            <Bar dataKey="pac" stackId="a" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.4} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-stone-400 mt-2 text-center">
        Solid bars = individual employee contributions. Faded bars = direct PAC contributions. Same industry, two channels.
      </p>
    </div>
  );
}
