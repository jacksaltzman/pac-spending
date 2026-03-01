import {
  getPacSpread,
  getSectorColors,
  getMembers,
  getBenchmarks,
  getBeforeAfter,
  getLeadershipAnalysis,
  getCommitteeComparison,
  PacSpreadEntry,
} from "@/lib/data";
import { formatMoney, memberSlug, toTitleCase } from "@/lib/utils";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import LeadershipChart from "@/components/LeadershipChart";
import CommitteeComparisonChart from "@/components/CommitteeComparisonChart";
import { buildFindings } from "./helpers";

export default function PacsOverviewPage() {
  const pacs: PacSpreadEntry[] = getPacSpread();
  const sectorColors = getSectorColors();
  const members = getMembers();
  const benchmarks = getBenchmarks();
  const beforeAfter = getBeforeAfter();
  const leadershipAnalysis = getLeadershipAnalysis();
  const committeeComparison = getCommitteeComparison();

  if (!pacs || pacs.length === 0) {
    return (
      <EmptyState
        title="No PAC Data"
        message="PAC spread data is not yet available. Run the pipeline to generate pac_spread.json."
      />
    );
  }

  const sorted = [...pacs].sort(
    (a, b) => b.num_recipients - a.num_recipients
  );

  const totalPacs = new Set(pacs.map((p) => p.pac_cmte_id)).size;
  const mostConnected = sorted[0];
  const totalDollars = pacs.reduce(
    (sum, p) => sum + (p.total_given > 0 ? p.total_given : 0),
    0
  );
  const findings = buildFindings(pacs);
  const ultraBroadPacs = pacs.filter((p) => p.num_recipients >= 30).length;

  const mostConnectedName = toTitleCase(
    mostConnected.connected_org ||
    mostConnected.pac_name.split(" PAC")[0].split(" POLITICAL")[0]
  );

  return (
    <div>
      {/* Date range badge */}
      <p className="text-sm text-stone-500 mb-6">
        <span
          className="inline-block bg-[#111111] text-[#D4F72A] rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mr-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          2024 Election Cycle
        </span>
        FEC data covering January 2023 – December 2024
      </p>

      {/* Key Findings */}
      {findings.length > 0 && (
        <div className="bg-[#111111] rounded-lg p-6 mb-8">
          <p
            className="text-[10px] uppercase tracking-[0.2em] text-[#D4F72A] mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Key Findings
          </p>
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <li
                key={i}
                className="text-sm text-stone-300 leading-relaxed pl-4 relative"
              >
                <span className="absolute left-0 top-[0.45rem] w-1.5 h-1.5 bg-[#FE4F40] rounded-full" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="PACs Tracked" value={totalPacs.toLocaleString()} />
        <StatCard
          label="Most Connected PAC"
          value={mostConnectedName}
          smallValue
          detail={`${mostConnected.num_recipients} members funded`}
          accent="#FE4F40"
        />
        <StatCard
          label="Total PAC Dollars"
          value={formatMoney(totalDollars)}
          accent="#4C6971"
        />
        <StatCard
          label="Ultra-Broad PACs"
          value={String(ultraBroadPacs)}
          detail="Fund 30+ committee members each"
        />
      </div>

      {/* ── Cross-Committee Comparison ─────────────────── */}
      {committeeComparison.length > 0 && (
        <section className="mb-10">
          <h2
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Do Tax-Writers Get More PAC Money?
          </h2>
          {(() => {
            const wm = committeeComparison.find((c) => c.committee === "Ways & Means");
            const allInc = committeeComparison.find((c) => c.committee === "All House Incumbents");
            const others = committeeComparison.filter(
              (c) => c.committee !== "Ways & Means" && c.committee !== "All House Incumbents"
            );
            const topOther = [...others].sort((a, b) => b.median_pac - a.median_pac)[0];
            return (
              <p className="text-xs text-stone-500 mb-5 max-w-4xl leading-relaxed">
                {wm && allInc && (
                  <>
                    The median Ways &amp; Means member received{" "}
                    <strong className="text-[#111111]">
                      {formatMoney(wm.median_pac)}
                    </strong>{" "}
                    in PAC contributions &mdash;{" "}
                    <strong className="text-[#FE4F40]">
                      {Math.round(((wm.median_pac - allInc.median_pac) / allInc.median_pac) * 100)}%
                      more
                    </strong>{" "}
                    than the typical House incumbent ({formatMoney(allInc.median_pac)})
                    {topOther && (
                      <>
                        {" "}and {Math.round(((wm.median_pac - topOther.median_pac) / topOther.median_pac) * 100)}%
                        more than {topOther.committee} ({formatMoney(topOther.median_pac)})
                      </>
                    )}
                    . Tax-writing committees don&apos;t just attract more money than average
                    &mdash; they attract more than other powerful committees too.
                  </>
                )}
              </p>
            );
          })()}
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
            <CommitteeComparisonChart committees={committeeComparison} />
          </div>
        </section>
      )}

      {/* ── Before/After Committee Appointment ────────── */}
      {beforeAfter && beforeAfter.headline.valid_members > 0 && (() => {
        const { headline, members: baMembers } = beforeAfter;
        const validMembers = baMembers
          .filter((m) => m.flag === "" && m.pct_change_pac != null)
          .sort((a, b) => (b.pct_change_pac ?? 0) - (a.pct_change_pac ?? 0));
        const topGainers = validMembers.slice(0, 8);

        return (
          <section className="mb-10">
            <h2
              className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              The Committee Seat Premium
            </h2>
            <p className="text-sm text-stone-600 mb-5 max-w-3xl leading-relaxed">
              Do PAC contributions increase after a member joins the tax-writing
              committee? We compared each member&apos;s median PAC receipts in
              election cycles <em>before</em> their appointment vs.{" "}
              <em>after</em>.
            </p>

            {/* Headline prose */}
            <p className="text-base text-[#111111] leading-relaxed mb-6 max-w-3xl">
              Of{" "}
              <strong>{headline.valid_members}</strong> members with sufficient data,{" "}
              <strong className="text-[#FE4F40]">{headline.increased_count}</strong>{" "}
              saw PAC money increase after joining the committee — a median change of{" "}
              <strong className="text-[#FE4F40]">
                {headline.median_pct_change != null
                  ? `${headline.median_pct_change > 0 ? "+" : ""}${headline.median_pct_change.toFixed(0)}%`
                  : "N/A"}
              </strong>{" "}
              (mean{" "}
              <strong className="text-[#4C6971]">
                {headline.mean_pct_change != null
                  ? `${headline.mean_pct_change > 0 ? "+" : ""}${headline.mean_pct_change.toFixed(0)}%`
                  : "N/A"}
              </strong>).
            </p>

            {/* Before/after table — top gainers */}
            {topGainers.length > 0 && (
              <div className="border border-[#C8C1B6]/40 rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB]">
                        <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                          Member
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                          Joined
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                          PAC $ Before
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                          PAC $ After
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {topGainers.map((m, i) => {
                        const slug = memberSlug(m.name);
                        const change = m.pct_change_pac ?? 0;
                        return (
                          <tr
                            key={m.fec_candidate_id}
                            className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FDFBF9]"}`}
                          >
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/members/${slug}`}
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
                              {m.median_pac_before != null ? formatMoney(m.median_pac_before) : "\u2014"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-[#111111] tabular-nums">
                              {m.median_pac_after != null ? formatMoney(m.median_pac_after) : "\u2014"}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${change > 0 ? "text-[#FE4F40]" : change < 0 ? "text-[#4C6971]" : "text-stone-400"}`}>
                              {change > 0 ? "+" : ""}{change.toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-xs text-stone-500 mt-2 max-w-3xl leading-relaxed">
              Based on {headline.valid_members} members with at least one election
              cycle before and after their committee appointment. Median PAC
              receipts compared across cycles 2014&ndash;2024. The cycle of appointment
              is excluded from both groups. Members appointed before 2014 are
              excluded due to insufficient pre-appointment data.
            </p>
          </section>
        );
      })()}

      {/* ── Leadership vs. Rank-and-File ──────────────── */}
      {leadershipAnalysis && leadershipAnalysis.tier_comparison.house.length > 0 && (() => {
        const { headline, tier_comparison, subcommittee_sector_alignment } = leadershipAnalysis;
        const houseTiers = tier_comparison.house;
        const houseSubPremium = houseTiers.find(t => t.tier === "Subcommittee Leadership")?.premium_vs_rank_file_pct;

        return (
          <section className="mb-10">
            <h2
              className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Where Power Sits, Money Follows
            </h2>
            <p className="text-sm text-stone-600 mb-5 max-w-3xl leading-relaxed">
              Not all committee seats are equal. Members who chair subcommittees
              &mdash; the ones who set hearing agendas and decide which bills get a markup
              &mdash; receive{" "}
              {houseSubPremium != null && houseSubPremium > 0 ? (
                <strong className="text-[#111111]">{houseSubPremium}% more PAC money</strong>
              ) : (
                "different levels of PAC money"
              )}{" "}
              than rank-and-file members. And the industries funding them match the
              jurisdictions they control.
            </p>

            <div className="mb-6">
              <LeadershipChart
                houseTiers={houseTiers}
                sectorAlignment={subcommittee_sector_alignment}
              />
            </div>

            <div className="border-l-4 border-[#F59E0B] pl-4 py-1">
              <p className="text-xs text-stone-600 leading-relaxed">
                <strong className="text-[#111111]">The pattern is clearest at the top:</strong>{" "}
                {headline.most_sector_aligned_member && headline.most_sector_aligned_subcommittee ? (
                  <>
                    {headline.most_sector_aligned_member}, who chairs the{" "}
                    {headline.most_sector_aligned_subcommittee} subcommittee, receives{" "}
                    <strong className="text-[#FE4F40]">
                      +{headline.most_sector_aligned_premium}pp
                    </strong>{" "}
                    more of their PAC money from the sectors their subcommittee oversees
                    compared to the committee average.
                  </>
                ) : (
                  "Subcommittee leaders tend to receive more PAC money from sectors relevant to their jurisdiction."
                )}{" "}
                PACs aren&apos;t just funding the committee &mdash; they&apos;re targeting the
                specific gatekeepers who control their issue area.
              </p>
            </div>

            <p className="text-xs text-stone-500 mt-3 max-w-3xl leading-relaxed">
              Leadership tiers: Full Committee Leadership = Chair + Ranking Member (n=2
              for House). Subcommittee Leadership = Subcommittee Chairs + Ranking
              Members (n=8 for House, n=10 for Senate). Rank-and-File = all other
              members. Senate tier comparison omitted because PAC data for off-cycle
              senators underreports actual fundraising.
            </p>
          </section>
        );
      })()}
    </div>
  );
}
