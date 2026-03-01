"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ContributionTiming } from "@/lib/data";
import { formatMoney } from "@/lib/utils";
import SpikeCards from "./SpikeCards";

interface TimingChartProps {
  timing: ContributionTiming;
  sectorColors: Record<string, string>;
}

function formatDollarsShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}

function formatWeekTick(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const yr = String(d.getUTCFullYear()).slice(2);
  return `${months[d.getUTCMonth()]} '${yr}`;
}

export default function TimingChart({ timing, sectorColors }: TimingChartProps) {
  const { sectorPanels, tickWeeks, events } = useMemo(() => {
    const weeks = timing.weekly_pac_totals;

    const sectorTotals = new Map<string, number>();
    for (const w of weeks) {
      for (const key of Object.keys(w)) {
        if (key === "week" || key === "total") continue;
        const val = Number(w[key]) || 0;
        sectorTotals.set(key, (sectorTotals.get(key) || 0) + val);
      }
    }

    const sorted = Array.from(sectorTotals.entries())
      .sort((a, b) => b[1] - a[1]);
    const top8 = sorted.slice(0, 8).map(([k]) => k);
    const sectorKeys = [...top8, "Other"];

    const panels = sectorKeys.map((sector) => {
      const data = weeks.map((w) => {
        if (sector === "Other") {
          let otherSum = 0;
          for (const key of Object.keys(w)) {
            if (key === "week" || key === "total") continue;
            if (!top8.includes(key)) {
              otherSum += Number(w[key]) || 0;
            }
          }
          return { week: w.week, value: Math.max(0, otherSum) };
        }
        return { week: w.week, value: Math.max(0, Number(w[sector]) || 0) };
      });

      return { sector, data };
    });

    const allWeeks = weeks.map((d) => d.week as string);
    const ticks: string[] = [];
    let lastMonth = -1;
    let count = 0;
    for (const w of allWeeks) {
      const d = new Date(w + "T00:00:00Z");
      const m = d.getUTCMonth();
      if (m !== lastMonth) {
        count++;
        lastMonth = m;
        if (count % 3 === 1) {
          ticks.push(w);
        }
      }
    }

    const evts = timing.events
      .filter((evt) => evt.bill && evt.bill !== "N/A")
      .map((evt) => ({
        ...evt,
        weekStart: getWeekStart(evt.date),
      }));

    return { sectorPanels: panels, tickWeeks: new Set(ticks), events: evts };
  }, [timing]);

  const topSpikes = useMemo(() => {
    return timing.event_analysis
      .filter((e) => e.sector_specific && e.spike_ratio != null && e.bill && e.bill !== "N/A")
      .sort((a, b) => (b.spike_ratio ?? 0) - (a.spike_ratio ?? 0))
      .slice(0, 5);
  }, [timing]);

  const PANEL_HEIGHT = 72;

  return (
    <div className="space-y-8">
      <section>
        <h2
          className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PAC Contributions Over Time
        </h2>
        <p className="text-xs text-stone-500 mb-4 max-w-2xl leading-relaxed">
          Weekly PAC contributions to tax-writing committee members, broken down by industry sector.
          Each row shows one sector independently — revealing patterns hidden by stacking.
          Vertical lines mark key legislative events.
        </p>

        <div className="space-y-0">
          {sectorPanels.map((panel, idx) => {
            const isLast = idx === sectorPanels.length - 1;
            const color = panel.sector === "Other"
              ? "#9CA3AF"
              : sectorColors[panel.sector] || "#9CA3AF";

            return (
              <div key={panel.sector} className="flex items-start">
                <div className="w-36 flex-shrink-0 pt-2 pr-3 text-right">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-stone-600">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{panel.sector}</span>
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <ResponsiveContainer width="100%" height={PANEL_HEIGHT}>
                    <AreaChart
                      data={panel.data}
                      margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                    >
                      <XAxis
                        dataKey="week"
                        hide={!isLast}
                        tick={isLast ? { fontSize: 10, fill: "#78716C" } : false}
                        tickFormatter={(val: string) =>
                          tickWeeks.has(val) ? formatWeekTick(val) : ""
                        }
                        interval={0}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide domain={[0, "auto"]} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const val = Number(payload[0]?.value) || 0;
                          if (val === 0) return null;
                          return (
                            <div className="bg-white border border-[#C8C1B6] rounded p-2 text-xs">
                              <p className="text-stone-500">{label}</p>
                              <p className="font-semibold" style={{ color }}>
                                {panel.sector}: {formatMoney(val)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                      {events.map((evt, i) => (
                        <ReferenceLine
                          key={i}
                          x={evt.weekStart}
                          stroke={evt.significance === "high" ? "#FE4F40" : "#D6D3D1"}
                          strokeWidth={evt.significance === "high" ? 1 : 0.5}
                          strokeDasharray={evt.significance === "high" ? undefined : "2 2"}
                          label={
                            idx === 0 && evt.significance === "high"
                              ? {
                                  value: evt.bill,
                                  position: "top",
                                  fill: "#FE4F40",
                                  fontSize: 9,
                                  angle: -30,
                                  offset: 4,
                                }
                              : undefined
                          }
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-stone-400 mt-2 pl-36">
          Weekly PAC contributions. Each row = one sector. Vertical lines = legislative events.
        </p>
      </section>

      {topSpikes.length > 0 && (
        <section>
          <h3
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Largest Contribution Spikes Around Legislation
          </h3>
          <p className="text-xs text-stone-500 mb-4 max-w-2xl leading-relaxed">
            When legislation affecting specific industries moves through committee, PAC
            contributions from those industries often spike. These are the largest
            sector-specific increases — click any card to see what the bill does and
            who had financial interests.
          </p>
          <SpikeCards spikes={topSpikes} sectorColors={sectorColors} />
          <p className="text-[10px] text-stone-400 mt-4">
            Spike ratio = event-week total ÷ baseline weekly average for affected
            sectors. Only sector-specific events shown. Source: FEC bulk contribution
            data; legislative dates from Congress.gov.
          </p>
        </section>
      )}
    </div>
  );
}
