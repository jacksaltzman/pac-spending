"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { ContributionTiming, EventAnalysisEntry } from "@/lib/data";
import { formatMoney } from "@/lib/utils";

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

function formatEventType(eventType: string): string {
  return eventType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function TimingChart({ timing, sectorColors }: TimingChartProps) {
  const { chartData, sectorKeys, eventLookup } = useMemo(() => {
    const weeks = timing.weekly_pac_totals;

    // Sum each sector across all weeks to find top 8
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

    // Rebuild weekly data with only top 8 + Other
    const rebuilt = weeks.map((w) => {
      const row: Record<string, number | string> = {
        week: w.week,
        total: w.total,
      };
      let otherSum = 0;
      for (const key of Object.keys(w)) {
        if (key === "week" || key === "total") continue;
        const val = Number(w[key]) || 0;
        if (top8.includes(key)) {
          row[key] = val;
        } else {
          otherSum += val;
        }
      }
      row["Other"] = otherSum;
      return row;
    });

    const keys = [...top8, "Other"];

    // Build event lookup: week string -> events in that week
    const lookup = new Map<string, typeof timing.events>();
    for (const evt of timing.events) {
      const ws = getWeekStart(evt.date);
      const existing = lookup.get(ws) || [];
      existing.push(evt);
      lookup.set(ws, existing);
    }

    return { chartData: rebuilt, sectorKeys: keys, eventLookup: lookup };
  }, [timing]);

  const topSpikes = useMemo(() => {
    return timing.event_analysis
      .filter((e) => e.sector_specific && e.spike_ratio != null)
      .sort((a, b) => (b.spike_ratio ?? 0) - (a.spike_ratio ?? 0))
      .slice(0, 5);
  }, [timing]);

  // Determine which weeks should show a tick label (roughly every 3 months)
  const tickWeeks = useMemo(() => {
    const weeks = chartData.map((d) => d.week as string);
    const result: string[] = [];
    let lastMonth = -1;
    let count = 0;
    for (const w of weeks) {
      const d = new Date(w + "T00:00:00Z");
      const m = d.getUTCMonth();
      if (m !== lastMonth) {
        count++;
        lastMonth = m;
        // Show every 3rd month
        if (count % 3 === 1) {
          result.push(w);
        }
      }
    }
    return new Set(result);
  }, [chartData]);

  return (
    <div className="space-y-8">
      {/* Area Chart */}
      <section>
        <h2
          className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PAC Contributions Over Time
        </h2>
        <p className="text-xs text-stone-500 mb-4 max-w-2xl leading-relaxed">
          Weekly PAC contributions to tax-writing committee members, broken down by industry sector.
          Vertical lines mark key legislative events — watch how contribution patterns shift around
          committee markups and floor votes.
        </p>
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 30, right: 30, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "#78716C" }}
                tickFormatter={(val: string) =>
                  tickWeeks.has(val) ? formatWeekTick(val) : ""
                }
                interval={0}
              />
              <YAxis
                tickFormatter={formatDollarsShort}
                tick={{ fontSize: 11, fill: "#78716C" }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const weekStr = label as string;
                  const eventsThisWeek = eventLookup.get(weekStr);
                  // Get the total from the first payload item's payload
                  const dataRow = payload[0]?.payload;
                  const total = dataRow?.total ?? 0;

                  return (
                    <div
                      className="bg-white shadow-lg p-3 max-w-xs"
                      style={{
                        borderRadius: 6,
                        border: "1px solid #C8C1B6",
                        fontSize: 13,
                      }}
                    >
                      <p className="font-semibold text-[#111111] mb-1">
                        Week of {weekStr}
                      </p>
                      <p className="text-xs text-stone-600 mb-2">
                        Total: <strong>{formatMoney(Number(total))}</strong>
                      </p>
                      <div className="space-y-0.5">
                        {payload
                          .filter((p) => Number(p.value) > 0)
                          .sort((a, b) => Number(b.value) - Number(a.value))
                          .map((p) => (
                            <div
                              key={p.dataKey as string}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-sm"
                                  style={{ backgroundColor: p.color }}
                                />
                                {p.dataKey as string}
                              </span>
                              <span className="font-medium">
                                {formatMoney(Number(p.value))}
                              </span>
                            </div>
                          ))}
                      </div>
                      {eventsThisWeek && eventsThisWeek.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-stone-200">
                          <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">
                            Legislative Events
                          </p>
                          {eventsThisWeek.map((evt, i) => (
                            <p key={i} className="text-xs text-[#FE4F40] font-medium">
                              {evt.label}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {sectorKeys.map((sector) => (
                <Area
                  key={sector}
                  type="monotone"
                  dataKey={sector}
                  stackId="1"
                  stroke={
                    sector === "Other"
                      ? "#9CA3AF"
                      : sectorColors[sector] || "#9CA3AF"
                  }
                  fill={
                    sector === "Other"
                      ? "#9CA3AF"
                      : sectorColors[sector] || "#9CA3AF"
                  }
                  fillOpacity={0.7}
                />
              ))}
              {timing.events.map((evt, i) => {
                const weekStart = getWeekStart(evt.date);
                const isHigh = evt.significance === "high";
                return (
                  <ReferenceLine
                    key={i}
                    x={weekStart}
                    stroke={isHigh ? "#FE4F40" : "#A8A29E"}
                    strokeWidth={isHigh ? 1.5 : 1}
                    strokeDasharray={isHigh ? undefined : "4 4"}
                    label={
                      isHigh
                        ? {
                            value: evt.bill,
                            position: "top",
                            fill: "#FE4F40",
                            fontSize: 10,
                            angle: -30,
                            offset: 10,
                          }
                        : undefined
                    }
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-stone-400 mt-2">
            Weekly PAC contributions to tax-writing committee members. Vertical lines mark legislative events.
          </p>
        </div>
      </section>

      {/* Spike Ratio Table */}
      {topSpikes.length > 0 && (
        <section>
          <h3
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Largest Contribution Spikes Around Legislation
          </h3>
          <p className="text-xs text-stone-500 mb-4 max-w-2xl leading-relaxed">
            When legislation affecting specific industries moves through committee, PAC contributions
            from those industries often spike. The table below shows the largest sector-specific
            increases relative to each event&apos;s baseline weekly average.
          </p>
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-stone-500">
                    Event
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-stone-500">
                    Date
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-stone-500">
                    Spike Ratio
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-stone-500">
                    Event Week $
                  </th>
                </tr>
              </thead>
              <tbody>
                {topSpikes.map((entry, i) => (
                  <tr
                    key={i}
                    className={`border-b border-stone-100 ${
                      (entry.spike_ratio ?? 0) >= 2.0 ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-stone-800">
                      <span className="font-medium">{entry.bill}</span>{" "}
                      <span className="text-stone-500">
                        {formatEventType(entry.event_type)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">{entry.date}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-stone-800">
                      {entry.spike_ratio != null
                        ? `${entry.spike_ratio.toFixed(2)}x`
                        : "N/A"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-700">
                      {formatMoney(entry.event_week_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-stone-400 mt-2">
            Spike ratio = event-week total / baseline weekly average for affected sectors.
            Only sector-specific events shown.
          </p>
        </section>
      )}
    </div>
  );
}
