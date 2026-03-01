import {
  getMembers,
  getCommitteeAggregates,
  getPacSpread,
  getBenchmarks,
  getBeforeAfter,
  getSectorColors,
} from "@/lib/data";
import { formatMoney, formatPct } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import MemberCard from "@/components/MemberCard";
import EmptyState from "@/components/EmptyState";
import GeoBreakdownChart from "@/components/GeoBreakdownChart";

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

  const allMembersAgg = committeeAggs.find((a) => a.group === "All Members");

  const medianOutside = allMembersAgg?.median_pct_outside ?? 0;

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

  const beforeAfter = getBeforeAfter();
  const sectorColors = getSectorColors();

  /* Before/after stat: median PAC increase after joining committee */
  const medianPacIncrease = beforeAfter?.headline.median_pct_change ?? null;

  /* Broadest-reach PAC */
  const broadestPac = topPacs[0]; // already sorted by num_recipients desc

  /* Members where majority of funding is from outside their state */
  const majorityOutside = activeMembersWithData.filter((m) => m.pct_outside > 50).length;

  /* Geographic averages for chart */
  const avgInDistrict =
    activeMembersWithData.reduce((s, m) => s + m.pct_in_district, 0) / memberCount;
  const avgInStateOutDistrict =
    activeMembersWithData.reduce((s, m) => s + m.pct_in_state_out_district, 0) / memberCount;
  const avgDcKStreet =
    activeMembersWithData.reduce((s, m) => s + m.pct_dc_kstreet, 0) / memberCount;
  const avgOutOfState =
    activeMembersWithData.reduce((s, m) => s + m.pct_out_of_state, 0) / memberCount;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────── */}
      <header className="mb-10">
        <h1
          className="text-3xl sm:text-5xl lg:text-6xl text-[#111111] leading-tight mb-4 uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Who Really Writes American Tax Policy?
        </h1>
        <p className="text-[15px] text-[#111111] leading-relaxed mb-3">
          The House Ways &amp; Means Committee and the Senate Finance Committee
          write the tax code &mdash; every deduction, credit, and loophole passes
          through them. That power attracts money from every corner of the country.{" "}
          This project tracks where it originates &mdash; in-district, in-state,
          DC/K-Street, or out of state entirely &mdash; for every member of both committees.
          {pacPremiumPct != null && (
            <>
              {" "}The median Ways &amp; Means member received{" "}
              <strong className="text-[#FE4F40]">
                {pacPremiumPct}% more PAC money
              </strong>{" "}
              than the median House incumbent in the 2024 cycle.
            </>
          )}
        </p>
        <p className="text-xs text-stone-400">
          <span
            className="inline-block bg-[#111111] text-[#D4F72A] rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mr-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            2024 Election Cycle
          </span>
          FEC individual &amp; PAC contribution data, January 2023 – December 2024
        </p>
      </header>

      {/* ── Top-line stats ──────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Committee members receive"
          value={pacPremiumPct != null ? `${pacPremiumPct}% more` : "—"}
          detail="PAC money than the typical House member"
          accent="#FE4F40"
        />
        <StatCard
          label="PAC money jumps"
          value={medianPacIncrease != null ? `${Math.round(medianPacIncrease)}%` : "—"}
          detail="after a member joins the committee"
          accent="#FE4F40"
        />
        <StatCard
          label=""
          value={formatPct(medianOutside)}
          detail="of contributions come from outside a member's home state"
          accent="#F59E0B"
        />
        <StatCard
          label={`${majorityOutside} of ${memberCount} members`}
          value="majority outside"
          detail="get more money from out of state than from their own constituents"
          smallValue
        />
      </section>

      {/* ── Where the Money Comes From ────────────────── */}
      <section className="mb-10">
        <h2
          className="text-xs text-stone-500 uppercase tracking-[0.2em] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Where the Money Comes From
        </h2>
        <p className="text-xs text-stone-500 mb-4 max-w-4xl leading-relaxed">
          On average, only{" "}
          <strong className="text-[#111111]">
            {Math.round(avgInDistrict + avgInStateOutDistrict)}%
          </strong>{" "}
          of a tax-writing committee member&apos;s itemized contributions come
          from their own state. The majority arrives from out of state entirely.
        </p>
        <div>
          <GeoBreakdownChart
            inDistrict={avgInDistrict}
            inStateOutDistrict={avgInStateOutDistrict}
            dcKStreet={avgDcKStreet}
            outOfState={avgOutOfState}
          />
        </div>
      </section>

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
          <div className="overflow-x-auto">
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
                    className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Sector
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
                      {pac.connected_org || pac.pac_name}
                    </td>
                    <td className="py-3 px-4">
                      {pac.sector && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: sectorColors[pac.sector] || "#9CA3AF",
                            }}
                          />
                          {pac.sector}
                        </span>
                      )}
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
