import {
  getPacSpread,
  getSectorColors,
  getIndustryInfluence,
  getMembers,
  getBenchmarks,
  getBeforeAfter,
  getLeadershipAnalysis,
  getCommitteeComparison,
  getNews,
  type PacSpreadEntry,
} from "@/lib/data";
import { formatMoney, memberSlug } from "@/lib/utils";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import CommitteeComparisonChart from "@/components/CommitteeComparisonChart";
import PacCharts from "@/components/PacCharts";
import IndustryChart from "@/components/IndustryChart";
import LeadershipChart from "@/components/LeadershipChart";
import ExpandableSection from "@/components/ExpandableSection";
import { buildSectorSpotlights, SECTOR_AGENDAS } from "@/lib/pac-helpers";

export default function IndustriesPage() {
  const pacs: PacSpreadEntry[] = getPacSpread();
  const sectorColors = getSectorColors();
  const industryInfluence = getIndustryInfluence();
  const members = getMembers();
  const benchmarks = getBenchmarks();
  const beforeAfter = getBeforeAfter();
  const leadershipAnalysis = getLeadershipAnalysis();
  const committeeComparison = getCommitteeComparison();
  const news = getNews();

  if (!pacs || pacs.length === 0) {
    return (
      <EmptyState
        title="No Industry Data"
        message="Industry data is not yet available. Run the pipeline to generate the required data files."
      />
    );
  }

  /* ── Derived data ─────────────────────────────────────────── */

  // Benchmarks stats
  const wm = committeeComparison.find((c) => c.committee === "Ways & Means");
  const allInc = committeeComparison.find(
    (c) => c.committee === "All House Incumbents"
  );
  const pacPremiumPct =
    wm && allInc && allInc.median_pac > 0
      ? Math.round(
          ((wm.median_pac - allInc.median_pac) / allInc.median_pac) * 100
        )
      : 66;

  // Before/after stat
  const medianPctChange = beforeAfter?.headline.median_pct_change ?? 51;

  // Leadership stat
  const fullCommitteePremium =
    leadershipAnalysis?.headline.full_committee_premium_pct ?? 158;

  // Before/after top gainers
  const beforeAfterGainers = beforeAfter
    ? beforeAfter.members
        .filter((m) => m.flag === "" && m.pct_change_pac != null)
        .sort((a, b) => (b.pct_change_pac ?? 0) - (a.pct_change_pac ?? 0))
        .slice(0, 8)
    : [];

  // Sector spotlights — all of them
  const allSpotlights = buildSectorSpotlights(pacs, sectorColors);
  const topSpotlights = allSpotlights.slice(0, 5);
  const remainingSpotlights = allSpotlights.slice(5);

  // News articles indexed by sector for inline links
  const newsBySector = new Map<string, typeof news>();
  for (const article of news) {
    if (!article.sector) continue;
    const existing = newsBySector.get(article.sector) || [];
    existing.push(article);
    newsBySector.set(article.sector, existing);
  }

  // Industry influence ratio
  const indivToPacRatio =
    industryInfluence?.summary.individual_to_pac_ratio ?? null;

  // Top employers (flattened across sectors)
  const topEmployers = industryInfluence
    ? Object.values(industryInfluence.top_employers_by_sector)
        .flat()
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
    : [];

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Page Title ────────────────────────────────────── */}
      <header className="mb-12">
        <p
          className="text-xs uppercase tracking-[0.25em] text-stone-400 mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Chapter 3
        </p>
        <h1
          className="text-3xl sm:text-5xl text-[#111111] uppercase tracking-tight font-bold leading-[1.1]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Industries
        </h1>
        <p className="text-lg text-stone-500 mt-3 max-w-2xl leading-relaxed">
          Which industries are paying, and what do they want?
        </p>
      </header>

      {/* ================================================================ */}
      {/* ACT 1: THE CASE                                                  */}
      {/* ================================================================ */}

      <section className="mb-16">
        <h2
          className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          They Pay More for Tax-Writers
        </h2>

        {/* One-paragraph case */}
        <p className="text-base text-[#111111] leading-relaxed mb-8 max-w-3xl">
          The median Ways &amp; Means member receives{" "}
          <strong className="text-[#FE4F40]">
            {wm ? formatMoney(wm.median_pac) : "$1.2M"}
          </strong>{" "}
          in PAC money &mdash;{" "}
          <strong className="text-[#FE4F40]">{pacPremiumPct}% more</strong> than
          the typical House member. When members join the committee, their PAC
          receipts jump{" "}
          <strong className="text-[#FE4F40]">
            +{Math.round(medianPctChange)}%
          </strong>
          . Committee leaders receive{" "}
          <strong className="text-[#FE4F40]">{fullCommitteePremium}% more</strong>{" "}
          than rank-and-file. This isn&apos;t random &mdash; it&apos;s strategic.
        </p>

        {/* Committee Comparison Chart */}
        {committeeComparison.length > 0 && (
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 mb-6">
            <CommitteeComparisonChart committees={committeeComparison} />
          </div>
        )}

        {/* Leadership tier bars */}
        {leadershipAnalysis &&
          leadershipAnalysis.tier_comparison.house.length > 0 && (
            <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 mb-6">
              <LeadershipChart
                houseTiers={leadershipAnalysis.tier_comparison.house}
                sectorAlignment={
                  leadershipAnalysis.subcommittee_sector_alignment
                }
              />
            </div>
          )}

        {/* Before/after expandable */}
        {beforeAfterGainers.length > 0 && (
          <div className="mt-6">
            <ExpandableSection label="See which members gained most after joining &rarr;">
              <div className="border border-[#C8C1B6]/40 rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB]">
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
                          Joined
                        </th>
                        <th
                          className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          PAC $ Before
                        </th>
                        <th
                          className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          PAC $ After
                        </th>
                        <th
                          className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {beforeAfterGainers.map((m, i) => {
                        const slug = memberSlug(m.name);
                        const change = m.pct_change_pac ?? 0;
                        return (
                          <tr
                            key={m.fec_candidate_id}
                            className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors ${
                              i % 2 === 0 ? "bg-white" : "bg-[#FDFBF9]"
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/committee/${slug}`}
                                className="text-[#111111] font-medium hover:text-[#4C6971] transition-colors"
                              >
                                {m.name}
                              </Link>
                              <span className="text-xs text-stone-400 ml-2">
                                ({m.party})
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-stone-500 tabular-nums">
                              {m.first_year}
                            </td>
                            <td className="px-4 py-2.5 text-right text-stone-500 tabular-nums">
                              {m.median_pac_before != null
                                ? formatMoney(m.median_pac_before)
                                : "\u2014"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-[#111111] tabular-nums">
                              {m.median_pac_after != null
                                ? formatMoney(m.median_pac_after)
                                : "\u2014"}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                                change > 0
                                  ? "text-[#FE4F40]"
                                  : change < 0
                                    ? "text-[#4C6971]"
                                    : "text-stone-400"
                              }`}
                            >
                              {change > 0 ? "+" : ""}
                              {change.toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                Based on members with at least one election cycle before and
                after their committee appointment. Median PAC receipts compared
                across cycles 2014&ndash;2024.
              </p>
            </ExpandableSection>
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* ACT 2: WHO'S PAYING & WHAT THEY WANT                            */}
      {/* ================================================================ */}

      <section className="mb-16">
        <h2
          className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Who&apos;s Paying &amp; What They Want
        </h2>

        <p className="text-sm text-stone-600 mb-8 leading-relaxed max-w-3xl">
          Finance &amp; Insurance dominates, but every major industry with a tax
          agenda has PACs at the table. Here&apos;s what they&apos;re paying to
          protect.
        </p>

        {/* Full PacCharts — sector breakdown, scatter, party split */}
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 mb-10">
          <PacCharts pacs={pacs} sectorColors={sectorColors} />
        </div>

        {/* Sector spotlight cards */}
        <div className="mb-6">
          <h3
            className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            What Each Industry Wants
          </h3>

          {/* Top 5 spotlights — always visible */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {topSpotlights.map((s) => {
              const sectorNews = newsBySector.get(s.sector);
              const inlineArticle = sectorNews?.[0] ?? null;
              return (
                <SpotlightCard
                  key={s.sector}
                  spotlight={s}
                  article={inlineArticle}
                />
              );
            })}
          </div>

          {/* Remaining spotlights — expandable */}
          {remainingSpotlights.length > 0 && (
            <ExpandableSection
              label={`Show ${remainingSpotlights.length} more sector${remainingSpotlights.length !== 1 ? "s" : ""} \u2192`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {remainingSpotlights.map((s) => {
                  const sectorNews = newsBySector.get(s.sector);
                  const inlineArticle = sectorNews?.[0] ?? null;
                  return (
                    <SpotlightCard
                      key={s.sector}
                      spotlight={s}
                      article={inlineArticle}
                    />
                  );
                })}
              </div>
            </ExpandableSection>
          )}
        </div>
      </section>

      {/* ================================================================ */}
      {/* ACT 3: THE FULL PICTURE                                          */}
      {/* ================================================================ */}

      <section className="mb-16">
        <h2
          className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PAC Money Is Just the Tip
        </h2>

        <p className="text-sm text-stone-600 mb-8 leading-relaxed max-w-3xl">
          {indivToPacRatio != null ? (
            <>
              For every dollar a PAC contributes, employees of the same industry
              give{" "}
              <strong className="text-[#111111]">
                {indivToPacRatio.toFixed(1)}&times;
              </strong>{" "}
              more individually. PAC spending is just the visible tip of a much
              larger influence operation.
            </>
          ) : (
            <>
              PAC spending is just the visible tip of a much larger influence
              operation. Individual employee contributions from the same
              industries dwarf direct PAC dollars.
            </>
          )}
        </p>

        {/* Industry Chart — individual vs PAC */}
        {industryInfluence && (
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 mb-8">
            <IndustryChart
              sectors={industryInfluence.sector_totals}
              sectorColors={sectorColors}
            />
          </div>
        )}

        {/* Top 5 employers — compact inline */}
        {topEmployers.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-stone-600 leading-relaxed">
              <span className="font-semibold text-[#111111]">
                Top employers:{" "}
              </span>
              {topEmployers.map((emp, i) => (
                <span key={emp.employer}>
                  {emp.employer} ({formatMoney(emp.total)},{" "}
                  {emp.members_funded} members)
                  {i < topEmployers.length - 1 ? " \u00b7 " : ""}
                </span>
              ))}{" "}
              <Link
                href="/industries/explore"
                className="text-[#FE4F40] hover:underline text-sm"
              >
                See all PACs &rarr;
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* CHAPTER TRANSITION CTA                                           */}
      {/* ================================================================ */}

      <div className="bg-[#111111] text-white rounded-lg p-6 mb-12">
        <p className="text-base leading-relaxed mb-3">
          The industries are paying. But does it work? Do members vote the way
          their funders want?
        </p>
        <Link
          href="/votes"
          className="text-[#FE4F40] font-semibold hover:underline"
        >
          The Votes &rarr;
        </Link>
      </div>
    </div>
  );
}

/* ── Spotlight Card (local component) ──────────────────────── */

import type { SectorSpotlight } from "@/lib/pac-helpers";
import type { NewsEntry } from "@/lib/data";

function SpotlightCard({
  spotlight,
  article,
}: {
  spotlight: SectorSpotlight;
  article: NewsEntry | null;
}) {
  return (
    <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: spotlight.color }}
        />
        <h4 className="text-sm font-semibold text-[#111111]">
          {spotlight.sector}
        </h4>
      </div>

      <p className="text-xs text-stone-500 mb-3 leading-relaxed">
        {spotlight.agenda}
      </p>

      <div className="flex items-center gap-4 text-xs text-stone-600 mb-3">
        <span>
          <strong className="text-[#111111]">
            {formatMoney(spotlight.total)}
          </strong>{" "}
          total
        </span>
        <span>
          <strong className="text-[#111111]">{spotlight.pacCount}</strong> PACs
        </span>
        <span>
          avg <strong className="text-[#111111]">{spotlight.avgReach}</strong>{" "}
          members
        </span>
      </div>

      {/* Top 3 PACs */}
      <div className="space-y-1 mb-3">
        {spotlight.topPacs.map((pac) => (
          <div
            key={pac.name}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-stone-600 truncate mr-2">{pac.name}</span>
            <span className="text-stone-400 tabular-nums flex-shrink-0">
              {pac.recipients} members
            </span>
          </div>
        ))}
      </div>

      {/* Inline news link */}
      {article && (
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-stone-500 hover:text-[#4C6971] transition-colors leading-snug"
        >
          <span className="mr-1 text-stone-400">&bull;</span>
          {article.source}: {article.title}
        </a>
      )}
    </div>
  );
}
