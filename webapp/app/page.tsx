import {
  getMembers,
  getCommitteeAggregates,
  getPacSpread,
  getBenchmarks,
} from "@/lib/data";
import { formatMoney, formatPct } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import MemberCard from "@/components/MemberCard";
import EmptyState from "@/components/EmptyState";

export default function DashboardPage() {
  const members = getMembers();
  const committeeAggs = getCommitteeAggregates();
  const pacSpread = getPacSpread();
  const benchmarks = getBenchmarks();

  /* ── Empty guard ────────────────────────────────────────── */
  if (members.length === 0) {
    return (
      <EmptyState
        title="No Data Yet"
        message="The data pipeline hasn't run. Import member contribution data to populate the dashboard."
      />
    );
  }

  /* ── Derived data ───────────────────────────────────────── */
  const activeMembersWithData = members.filter(
    (m) => !m.is_territorial && m.total_itemized_amount > 0
  );
  const memberCount = activeMembersWithData.length;

  const totalAnalyzed = activeMembersWithData.reduce(
    (sum, m) => sum + m.total_itemized_amount,
    0
  );

  const allMembersAgg = committeeAggs.find((a) => a.group === "All Members");
  const houseAgg = committeeAggs.find(
    (a) => a.group === "House Ways & Means"
  );
  const senateAgg = committeeAggs.find((a) => a.group === "Senate Finance");

  const medianOutside = allMembersAgg?.median_pct_outside ?? 0;
  const meanDc = allMembersAgg?.mean_pct_dc ?? 0;

  /* PAC benchmark: how much more PAC money do committee members receive? */
  const pacPremiumPct =
    benchmarks?.house.all_incumbents.median_pac &&
    benchmarks?.house.committee.median_pac
      ? Math.round(
          ((benchmarks.house.committee.median_pac -
            benchmarks.house.all_incumbents.median_pac) /
            benchmarks.house.all_incumbents.median_pac) *
            100
        )
      : null;

  /* Top 5 most outside-funded */
  const mostOutside = [...activeMembersWithData]
    .sort((a, b) => b.pct_outside - a.pct_outside)
    .slice(0, 5);

  /* Bottom 5 = most locally-funded */
  const mostLocal = [...activeMembersWithData]
    .sort((a, b) => a.pct_outside - b.pct_outside)
    .slice(0, 5);

  /* Top 10 PACs by number of recipients */
  const topPacs = [...pacSpread]
    .sort((a, b) => b.num_recipients - a.num_recipients)
    .slice(0, 10);

  /* Committee comparison rows */
  const comparisonRows = [houseAgg, senateAgg].filter(Boolean);

  return (
    <div>
      {/* ── Header ──────────────────────────────────────── */}
      <header className="mb-6">
        <h1
          className="text-3xl sm:text-5xl lg:text-6xl text-[#111111] leading-tight mb-3 uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Who Really Writes
          <br />
          American Tax Policy?
        </h1>
        <p className="text-sm text-stone-600 max-w-4xl leading-relaxed">
          A geographic analysis of individual contributions to every member of
          the House Ways &amp; Means Committee and Senate Finance Committee.
          Tracking where the money originates &mdash; in-district, in-state,
          DC/K-Street, or out of state entirely.
        </p>
      </header>

      {/* ── Introduction / Why This Matters ───────────── */}
      <section className="mb-10 max-w-5xl">
        <div className="border-l-4 border-[#FE4F40] pl-5 py-1">
          <h2
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Why This Matters
          </h2>
          <p className="text-[15px] text-[#111111] leading-relaxed mb-3">
            The House Ways &amp; Means Committee and the Senate Finance Committee
            write the tax code. Every deduction, credit, and loophole in federal
            tax law passes through these two committees before it reaches the
            floor. The members who sit on them decide who pays and who
            doesn&rsquo;t &mdash; making them the most lobbied legislators in
            Congress.
          </p>
          <p className="text-[15px] text-[#111111] leading-relaxed mb-3">
            That attention translates directly into money.{" "}
            {pacPremiumPct != null && (
              <>
                According to FEC filings, the median House Ways &amp; Means
                member received{" "}
                <strong className="text-[#FE4F40]">
                  {pacPremiumPct}% more PAC money
                </strong>{" "}
                than the median House incumbent in the 2024 cycle ({formatMoney(
                  benchmarks!.house.committee.median_pac
                )}{" "}
                vs.{" "}
                {formatMoney(benchmarks!.house.all_incumbents.median_pac)}).{" "}
              </>
            )}
            PACs representing finance, healthcare, energy, and real estate
            &mdash; the industries with the most at stake in tax policy &mdash;
            concentrate their spending on these committees, funding members on
            both sides of the aisle to ensure access no matter who holds the
            gavel.
          </p>
          <p className="text-[15px] text-[#111111] leading-relaxed mb-4">
            This project traces that money to its source. Where do the dollars
            come from? How much originates in a member&rsquo;s own district
            versus from corporate PACs and out-of-state donors? The answers
            reveal whose interests these committees are built to serve.
          </p>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Source: FEC all-candidates summary file (webl24.txt) and FEC
            bulk contribution records for the 2024 election cycle.
            Analysis by Accountable. All dollar figures reflect reported
            itemized contributions and PAC disbursements.
          </p>
        </div>
      </section>

      {/* ── Top-line stats ──────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Members Analyzed"
          value={String(memberCount)}
          detail="Non-territorial members with itemized data"
        />
        <StatCard
          label="Median Outside Funding"
          value={formatPct(medianOutside)}
          detail="Across all committee members"
          accent="#FE4F40"
        />
        <StatCard
          label="Total $ Analyzed"
          value={formatMoney(totalAnalyzed)}
          detail="Itemized individual contributions"
        />
        <StatCard
          label="Mean DC / K-Street"
          value={formatPct(meanDc)}
          detail="Average share from the Beltway corridor"
          accent="#F59E0B"
        />
      </section>

      {/* ── Committee Comparison ────────────────────────── */}
      {comparisonRows.length > 0 && (
        <section className="mb-10">
          <h2
            className="text-xs text-stone-500 uppercase tracking-[0.2em] mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Committee Comparison
          </h2>
          <div className="bg-white rounded-lg border border-[#C8C1B6]/50 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#C8C1B6]/50">
                  <th
                    className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Committee
                  </th>
                  <th
                    className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Members
                  </th>
                  <th
                    className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Mean Outside %
                  </th>
                  <th
                    className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Median Outside %
                  </th>
                  <th
                    className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Mean DC %
                  </th>
                  <th
                    className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Total Contributions
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((agg) => (
                  <tr
                    key={agg!.group}
                    className="border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors"
                  >
                    <td className="py-3 px-4 text-[#111111] font-medium">
                      {agg!.group}
                    </td>
                    <td className="py-3 px-4 text-right text-[#111111]">
                      {agg!.member_count}
                    </td>
                    <td className="py-3 px-4 text-right text-[#FE4F40] font-medium">
                      {formatPct(agg!.mean_pct_outside)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#FE4F40] font-medium">
                      {formatPct(agg!.median_pct_outside)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#F59E0B] font-medium">
                      {formatPct(agg!.mean_pct_dc)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#111111]">
                      {formatMoney(agg!.total_contributions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Member Rankings ─────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Most Outside-Funded */}
        <div>
          <h2
            className="text-xs text-stone-500 uppercase tracking-[0.2em] mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="text-[#FE4F40]">&#9679;</span> Most Outside-Funded
          </h2>
          <p className="text-xs text-stone-500 mb-4">
            Highest percentage of contributions from outside their home
            state/district
          </p>
          <div className="flex flex-col gap-3">
            {mostOutside.map((m, i) => (
              <MemberCard
                key={m.slug}
                name={m.member_name}
                slug={m.slug}
                party={m.party}
                state={m.state}
                district={m.district}
                chamber={m.chamber}
                pctOutside={m.pct_outside}
                totalAmount={m.total_itemized_amount}
                topEmployer={m.top_outside_employer_1}
                rank={i + 1}
              />
            ))}
          </div>
        </div>

        {/* Most Locally-Funded */}
        <div>
          <h2
            className="text-xs text-stone-500 uppercase tracking-[0.2em] mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="text-[#4C6971]">&#9679;</span> Most Locally-Funded
          </h2>
          <p className="text-xs text-stone-500 mb-4">
            Lowest percentage of outside funding &mdash; strongest local donor
            base
          </p>
          <div className="flex flex-col gap-3">
            {mostLocal.map((m, i) => (
              <MemberCard
                key={m.slug}
                name={m.member_name}
                slug={m.slug}
                party={m.party}
                state={m.state}
                district={m.district}
                chamber={m.chamber}
                pctOutside={m.pct_outside}
                totalAmount={m.total_itemized_amount}
                topEmployer={m.top_outside_employer_1}
                rank={i + 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Top PACs ────────────────────────────────────── */}
      {topPacs.length > 0 && (
        <section className="mb-10">
          <h2
            className="text-xs text-stone-500 uppercase tracking-[0.2em] mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Top PACs by Reach
          </h2>
          <p className="text-xs text-stone-500 mb-4">
            Political action committees funding the most committee members
          </p>
          <div className="bg-white rounded-lg border border-[#C8C1B6]/50 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#C8C1B6]/50">
                  <th
                    className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium w-8"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    #
                  </th>
                  <th
                    className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    PAC Name
                  </th>
                  <th
                    className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Total Given
                  </th>
                  <th
                    className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    # Members Funded
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPacs.map((pac, i) => (
                  <tr
                    key={`${pac.pac_cmte_id}-${i}`}
                    className="border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors"
                  >
                    <td className="py-3 px-4 text-stone-400 text-xs">
                      {i + 1}
                    </td>
                    <td className="py-3 px-4 text-[#111111]">
                      {pac.pac_name}
                    </td>
                    <td className="py-3 px-4 text-right text-[#111111]">
                      {formatMoney(pac.total_given)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#FE4F40] font-semibold">
                      {pac.num_recipients}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
