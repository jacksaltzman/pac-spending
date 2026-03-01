"use client";

import { formatMoney } from "@/lib/utils";
import type {
  LeadershipTierRow,
  LeadershipSectorAlignment,
} from "@/lib/data";

interface LeadershipChartProps {
  houseTiers: LeadershipTierRow[];
  sectorAlignment: LeadershipSectorAlignment[];
}

const TIER_COLORS: Record<string, string> = {
  "Full Committee Leadership": "#FE4F40",
  "Subcommittee Leadership": "#F59E0B",
  "Rank-and-File": "#C8C1B6",
};

export default function LeadershipChart({
  houseTiers,
  sectorAlignment,
}: LeadershipChartProps) {
  const maxPac = Math.max(...houseTiers.map((t) => t.median_pac));

  // Filter alignment to positive premiums, sort by premium descending
  const topAligned = sectorAlignment
    .filter((a) => a.premium_pct > 2)
    .sort((a, b) => b.premium_pct - a.premium_pct)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      {/* ── Tier Comparison Bars ──────────────────────────── */}
      <div>
        <p
          className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          House Ways &amp; Means — Median PAC Contributions by Leadership Tier
        </p>
        <div className="space-y-3">
          {houseTiers.map((tier) => {
            const pct = maxPac > 0 ? (tier.median_pac / maxPac) * 100 : 0;
            const color = TIER_COLORS[tier.tier] || "#C8C1B6";
            const premium = tier.premium_vs_rank_file_pct;
            return (
              <div key={tier.tier}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium text-[#111111]">
                      {tier.tier}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      n={tier.count}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold tabular-nums" style={{ color }}>
                      {formatMoney(tier.median_pac)}
                    </span>
                    {premium != null && premium !== 0 && (
                      <span
                        className="text-[10px] font-semibold tabular-nums"
                        style={{ color: premium > 0 ? "#FE4F40" : "#4C6971" }}
                      >
                        {premium > 0 ? "+" : ""}
                        {premium}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-4 rounded bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{
                      width: `${Math.max(pct, 3)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-stone-400 mt-2">
          Source: FEC candidate summary data, 2024 cycle. Senate omitted due to
          off-cycle reporting distortion.
        </p>
      </div>

      {/* ── Sector Alignment Table ────────────────────────── */}
      {topAligned.length > 0 && (
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Subcommittee Leaders vs. Committee Average — Relevant Sector PAC Share
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB]">
                  <th
                    className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-stone-500"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Member
                  </th>
                  <th
                    className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-stone-500"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Subcommittee
                  </th>
                  <th
                    className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-stone-500"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Relevant Sectors
                  </th>
                  <th
                    className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-stone-500"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Their %
                  </th>
                  <th
                    className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-stone-500"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Cmte Avg
                  </th>
                  <th
                    className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-stone-500"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody>
                {topAligned.map((a, i) => (
                  <tr
                    key={`${a.member}-${a.subcommittee}`}
                    className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors ${
                      i % 2 === 0 ? "bg-white" : "bg-[#FDFBF9]"
                    }`}
                  >
                    <td className="px-3 py-2 text-[#111111] font-medium whitespace-nowrap">
                      {a.member}
                      <span className="text-xs text-stone-400 ml-1">
                        ({a.party}-{a.state})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-stone-600 text-xs">
                      {a.subcommittee}
                    </td>
                    <td className="px-3 py-2 text-stone-500 text-xs">
                      {a.relevant_sectors}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-[#FE4F40] tabular-nums">
                      {a.member_sector_pac_pct}%
                    </td>
                    <td className="px-3 py-2 text-right text-stone-400 tabular-nums">
                      {a.committee_avg_sector_pac_pct}%
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-[#FE4F40]">
                      +{a.premium_pct}pp
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-stone-400 mt-2">
            &ldquo;Their %&rdquo; = share of PAC money from the sectors most
            relevant to their subcommittee jurisdiction.
            &ldquo;Cmte Avg&rdquo; = same sectors&apos; share across all
            committee members. Premium = percentage point difference.
          </p>
        </div>
      )}
    </div>
  );
}
