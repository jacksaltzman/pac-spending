import {
  getPacSpread,
  getSectorColors,
  getIndustryInfluence,
  getMembers,
  PacSpreadEntry,
} from "@/lib/data";
import { formatMoney } from "@/lib/utils";
import Link from "next/link";
import PacCharts from "@/components/PacCharts";
import IndustryChart from "@/components/IndustryChart";
import { buildSectorSpotlights, buildTopRecipients } from "../helpers";

export default function IndustryPage() {
  const pacs: PacSpreadEntry[] = getPacSpread();
  const sectorColors = getSectorColors();
  const industryInfluence = getIndustryInfluence();
  const members = getMembers();

  if (!pacs || pacs.length === 0) return null;

  const sorted = [...pacs].sort(
    (a, b) => b.num_recipients - a.num_recipients
  );
  const topPacs = sorted.slice(0, 200);
  const sectorSpotlights = buildSectorSpotlights(pacs, sectorColors);

  // Build top recipients and enrich with member data
  const topRecipients = buildTopRecipients(pacs);
  const memberLookup = new Map(
    members.map((m) => [
      m.member_name,
      { party: m.party, state: m.state, chamber: m.chamber, slug: m.slug },
    ])
  );
  for (const r of topRecipients) {
    const info = memberLookup.get(r.name);
    if (info) {
      r.party = info.party;
      r.state = info.state;
      r.chamber = info.chamber;
      r.slug = info.slug;
    }
  }

  return (
    <div>
      {/* Charts */}
      <PacCharts pacs={topPacs} sectorColors={sectorColors} />

      {/* ── The Full Picture: Individual + PAC ─────────── */}
      {industryInfluence && industryInfluence.sector_totals.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            The Full Picture: PAC Money Is Just the Tip
          </h2>
          <p className="text-sm text-stone-600 mb-5 max-w-3xl leading-relaxed">
            PAC contributions are the most visible channel of industry influence,
            but individual donations from employees of the same companies and
            industries dwarf direct PAC giving. For every dollar a PAC contributes,
            employees of the same industry give{" "}
            <strong className="text-[#111111]">
              {industryInfluence.summary.individual_to_pac_ratio}×
            </strong>{" "}
            more individually.
          </p>

          {/* Stacked bar chart */}
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 mb-6">
            <IndustryChart
              sectors={industryInfluence.sector_totals}
              sectorColors={sectorColors}
            />
          </div>

          {/* Top employers table */}
          {(() => {
            const allEmployers = Object.values(
              industryInfluence.top_employers_by_sector
            )
              .flat()
              .sort((a, b) => b.total - a.total)
              .slice(0, 15);

            if (allEmployers.length === 0) return null;

            const empSectorMap = new Map<string, string>();
            for (const [sector, emps] of Object.entries(
              industryInfluence.top_employers_by_sector
            )) {
              for (const e of emps) empSectorMap.set(e.employer, sector);
            }

            return (
              <div className="mb-6">
                <h3
                  className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-3"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Industry Employees Funding the Committee
                </h3>
                <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB]">
                          <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Employer
                          </th>
                          <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Sector
                          </th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Employee $
                          </th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Donations
                          </th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Members
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {allEmployers.map((e, i) => {
                          const sector = empSectorMap.get(e.employer) || "";
                          return (
                            <tr
                              key={e.employer}
                              className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FDFBF9]"}`}
                            >
                              <td className="px-4 py-2.5 font-medium text-[#111111]">
                                {e.employer}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor:
                                        sectorColors[sector] || "#9CA3AF",
                                    }}
                                  />
                                  {sector}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-[#FE4F40] tabular-nums">
                                {formatMoney(e.total)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-stone-500 tabular-nums">
                                {e.count.toLocaleString()}
                              </td>
                              <td className="px-4 py-2.5 text-right text-[#4C6971] font-medium tabular-nums">
                                {e.members_funded}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          <p className="text-xs text-stone-500 max-w-3xl leading-relaxed">
            Individual contributions classified by employer industry using curated
            mappings and keyword matching. Contributions from retirees,
            self-employed, and unemployed donors are excluded from industry
            totals. Classification covers{" "}
            {formatMoney(industryInfluence.summary.classified_individual_total)} of
            itemized individual contributions. Source: FEC bulk individual
            contributions, 2024 cycle.
          </p>
        </section>
      )}

      {/* ── Sector Spotlights ─────────────────────────────── */}
      {sectorSpotlights.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            What Each Industry Wants
          </h2>
          <p className="text-sm text-stone-600 mb-5 max-w-3xl leading-relaxed">
            The money isn&apos;t abstract — each sector has a specific tax
            policy wishlist. Here&apos;s what the top industries are paying to
            protect.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectorSpotlights.map((s) => (
              <div
                key={s.sector}
                className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <h3
                    className="text-sm font-bold text-[#111111] uppercase tracking-wide"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {s.sector}
                  </h3>
                </div>

                <div className="flex gap-4 mb-3 text-xs">
                  <span className="text-stone-500">
                    <strong className="text-[#111111]">
                      {formatMoney(s.total)}
                    </strong>{" "}
                    total
                  </span>
                  <span className="text-stone-500">
                    <strong className="text-[#111111]">{s.pacCount}</strong>{" "}
                    PACs
                  </span>
                </div>

                {s.agenda && (
                  <p className="text-xs text-stone-600 leading-relaxed mb-3 border-l-2 pl-3" style={{ borderColor: s.color }}>
                    {s.agenda}
                  </p>
                )}

                <div className="space-y-1">
                  {s.topPacs.map((pac, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="text-stone-600 truncate mr-2">
                        {pac.name}
                      </span>
                      <span className="text-stone-400 whitespace-nowrap tabular-nums">
                        {pac.recipients} members
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Top PAC Recipients (member view) ──────────────── */}
      {topRecipients.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Who Receives the Most PAC Attention?
          </h2>
          <p className="text-sm text-stone-600 mb-5 max-w-3xl leading-relaxed">
            These committee members are funded by the largest number of
            distinct PACs — making them the most courted lawmakers on tax
            policy.
          </p>
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB]">
                    <th
                      className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500 w-10"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      #
                    </th>
                    <th
                      className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Member
                    </th>
                    <th
                      className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Distinct PACs
                    </th>
                    <th
                      className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Est. PAC $
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topRecipients.map((r, i) => (
                    <tr
                      key={r.name}
                      className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FDFBF9]"}`}
                    >
                      <td className="px-4 py-2.5 text-xs text-stone-400">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/members/${r.slug}`}
                          className="text-[#111111] font-medium hover:text-[#4C6971] transition-colors"
                        >
                          {r.name}
                        </Link>
                        {r.party && (
                          <span className="text-xs text-stone-400 ml-2">
                            ({r.party}-{r.state})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#FE4F40] tabular-nums">
                        {r.pacCount}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#4C6971] font-medium tabular-nums">
                        {formatMoney(r.pacDollars)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-stone-500 mt-2 max-w-3xl">
            &ldquo;Distinct PACs&rdquo; counts unique PACs (from the top 200 by
            reach) that contribute to each member. Est. PAC $ is an
            approximation based on equal per-member distribution of each
            PAC&apos;s total giving.
          </p>
        </section>
      )}
    </div>
  );
}
