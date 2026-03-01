"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import type { CommitteeComparisonEntry } from "@/lib/data";

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, medianPac, count } = payload[0].payload;
  return (
    <div className="bg-white border border-[#C8C1B6]/60 rounded-md shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-[#111111] mb-0.5">{name}</p>
      <p className="text-sm font-bold text-[#FE4F40] tabular-nums">
        {formatDollarsShort(medianPac)}
      </p>
      <p className="text-[10px] text-stone-400">{count} members</p>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface CommitteeComparisonChartProps {
  committees: CommitteeComparisonEntry[];
}

function formatDollarsShort(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default function CommitteeComparisonChart({
  committees,
}: CommitteeComparisonChartProps) {
  // Sort: Ways & Means first, then by median_pac desc, All Incumbents last
  const sorted = [...committees].sort((a, b) => {
    if (a.committee === "Ways & Means") return -1;
    if (b.committee === "Ways & Means") return 1;
    if (a.committee === "All House Incumbents") return 1;
    if (b.committee === "All House Incumbents") return -1;
    return b.median_pac - a.median_pac;
  });

  const data = sorted.map((c) => ({
    name: c.committee,
    medianPac: c.median_pac,
    count: c.count,
  }));

  if (data.length === 0) return null;

  return (
    <div>
      <div style={{ height: Math.max(200, data.length * 52) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 5, bottom: 5 }}
            barCategoryGap="25%"
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
              dataKey="name"
              width={170}
              tick={{ fontSize: 12, fill: "#44403c" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="medianPac" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.name === "Ways & Means"
                      ? "#FE4F40"
                      : entry.name === "All House Incumbents"
                        ? "#D6D3D1"
                        : "#4C6971"
                  }
                  fillOpacity={entry.name === "All House Incumbents" ? 0.6 : 0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-stone-400 mt-2">
        Median PAC contributions per committee member. House incumbents only, 2024 cycle.
        Source: FEC all-candidates summary.
      </p>
    </div>
  );
}
