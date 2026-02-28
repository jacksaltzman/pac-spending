"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type { PacSpreadEntry } from "@/lib/data";
import { formatMoney } from "@/lib/utils";

interface PacChartsProps {
  pacs: PacSpreadEntry[];
  sectorColors: Record<string, string>;
}

function formatDollarsShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default function PacCharts({ pacs, sectorColors }: PacChartsProps) {
  const sectorData = useMemo(() => {
    const map = new Map<string, { total: number; count: number; rTotal: number; dTotal: number }>();
    for (const p of pacs) {
      if (!p.sector) continue;
      const entry = map.get(p.sector) || { total: 0, count: 0, rTotal: 0, dTotal: 0 };
      entry.total += p.total_given;
      entry.count += 1;
      entry.rTotal += p.r_total;
      entry.dTotal += p.d_total;
      map.set(p.sector, entry);
    }
    return Array.from(map.entries())
      .map(([sector, data]) => ({
        sector,
        total: data.total,
        count: data.count,
        rTotal: data.rTotal,
        dTotal: data.dTotal,
        color: sectorColors[sector] || "#9CA3AF",
      }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [pacs, sectorColors]);

  const scatterData = useMemo(() => {
    return pacs
      .filter((p) => p.num_recipients >= 10 && p.total_given > 0)
      .map((p) => ({
        name: p.connected_org || p.pac_name.split(" ").slice(0, 3).join(" "),
        x: p.num_recipients,
        y: p.total_given,
        sector: p.sector || "Other Industry",
        color: sectorColors[p.sector] || "#9CA3AF",
        fullName: p.pac_name,
      }));
  }, [pacs, sectorColors]);

  const partyData = useMemo(() => {
    return pacs
      .filter((p) => p.num_recipients >= 20 && (p.r_total > 0 || p.d_total > 0))
      .sort((a, b) => b.num_recipients - a.num_recipients)
      .slice(0, 15)
      .map((p) => {
        const total = p.r_total + p.d_total;
        return {
          name: p.connected_org || p.pac_name.split(" PAC")[0].split(" POLITICAL")[0].slice(0, 25),
          rTotal: p.r_total,
          dTotal: p.d_total,
          rPct: total > 0 ? Math.round((p.r_total / total) * 100) : 0,
          dPct: total > 0 ? Math.round((p.d_total / total) * 100) : 0,
          recipients: p.num_recipients,
        };
      });
  }, [pacs]);

  return (
    <div className="space-y-10">
      {/* Sector Breakdown */}
      <section>
        <h2
          className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PAC Dollars by Industry Sector
        </h2>
        <p className="text-xs text-stone-500 mb-4 max-w-4xl leading-relaxed">
          Industries that spend the most on PAC contributions to tax-writing committees are the same ones with the most at stake in tax legislation.
          Finance, healthcare, and real estate together account for the majority of classified PAC dollars — and each has a distinct tax policy wishlist.
        </p>
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
          <ResponsiveContainer width="100%" height={Math.max(300, sectorData.length * 36)}>
            <BarChart data={sectorData} layout="vertical" margin={{ left: 160, right: 40, top: 5, bottom: 5 }}>
              <XAxis type="number" tickFormatter={formatDollarsShort} tick={{ fontSize: 11, fill: "#78716C" }} />
              <YAxis
                type="category"
                dataKey="sector"
                width={150}
                tick={{ fontSize: 12, fill: "#111111" }}
              />
              <Tooltip
                formatter={(value) => [formatMoney(Number(value)), "Total"]}
                labelStyle={{ fontWeight: 600 }}
                contentStyle={{ borderRadius: 6, border: "1px solid #C8C1B6", fontSize: 13 }}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {sectorData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-stone-400 mt-2">
            Based on {pacs.filter((p) => p.sector).length} classified PACs. Unclassified PACs not shown.
          </p>
        </div>
      </section>

      {/* Reach vs Dollars Scatter */}
      <section>
        <h2
          className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PAC Reach vs. Total Dollars (10+ Recipients)
        </h2>
        <p className="text-xs text-stone-500 mb-4 max-w-4xl leading-relaxed">
          The upper-right corner is where the power lives: PACs that spend big <em>and</em> spread wide.
          A PAC funding 40+ members across both committees doesn&apos;t just have access — it has leverage over every stage of the tax-writing process.
        </p>
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis
                type="number"
                dataKey="x"
                name="Recipients"
                label={{ value: "Committee Members Funded", position: "bottom", offset: 10, fontSize: 12, fill: "#78716C" }}
                tick={{ fontSize: 11, fill: "#78716C" }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Total Given"
                tickFormatter={formatDollarsShort}
                tick={{ fontSize: 11, fill: "#78716C" }}
              />
              <ZAxis range={[40, 40]} />
              <Tooltip
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-[#C8C1B6] rounded-md p-3 shadow-lg max-w-xs">
                      <p className="text-sm font-semibold text-[#111111] mb-1">{d.fullName}</p>
                      <p className="text-xs text-stone-500">{d.sector}</p>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span><strong>{d.x}</strong> members</span>
                        <span><strong>{formatMoney(d.y)}</strong></span>
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.7} stroke={entry.color} strokeWidth={1} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-stone-400 mt-2">
            Each dot is a PAC. Color = industry sector. Hover for details.
          </p>
        </div>
      </section>

      {/* Party Split */}
      <section>
        <h2
          className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Party Split — Top PACs by Reach (20+ Recipients)
        </h2>
        <p className="text-xs text-stone-500 mb-4 max-w-4xl leading-relaxed">
          The most powerful PACs give to both parties — not out of bipartisanship, but to guarantee a seat at the table regardless of who controls the committee.
          This &ldquo;hedge your bets&rdquo; strategy ensures their tax priorities survive any shift in power.
        </p>
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
          <ResponsiveContainer width="100%" height={Math.max(300, partyData.length * 36)}>
            <BarChart data={partyData} layout="vertical" margin={{ left: 180, right: 40, top: 5, bottom: 5 }}>
              <XAxis type="number" tickFormatter={formatDollarsShort} tick={{ fontSize: 11, fill: "#78716C" }} />
              <YAxis
                type="category"
                dataKey="name"
                width={170}
                tick={{ fontSize: 11, fill: "#111111" }}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatMoney(Number(value)),
                  name === "rTotal" ? "Republican" : "Democrat",
                ]}
                contentStyle={{ borderRadius: 6, border: "1px solid #C8C1B6", fontSize: 13 }}
              />
              <Legend
                formatter={(value: string) =>
                  value === "rTotal" ? "Republican" : "Democrat"
                }
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="rTotal" stackId="party" fill="#EF4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="dTotal" stackId="party" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-stone-400 mt-2">
            Shows how each PAC splits its contributions between party members on the tax-writing committees.
          </p>
        </div>
      </section>
    </div>
  );
}
