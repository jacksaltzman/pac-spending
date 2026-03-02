import Link from "next/link";
import { getMembers, getCommitteeAggregates } from "@/lib/data";
import { formatMoney, formatPct } from "@/lib/utils";
import MemberCard from "@/components/MemberCard";
import GeoBreakdownChart from "@/components/GeoBreakdownChart";
import EmptyState from "@/components/EmptyState";

export default function MoneyPage() {
  const members = getMembers();
  const committeeAggs = getCommitteeAggregates();

  if (members.length === 0) {
    return (
      <EmptyState
        title="No Data Yet"
        message="The data pipeline hasn't run. Import member contribution data to populate this page."
      />
    );
  }

  /* ── Filter: active, non-territorial members with data ── */
  const active = members.filter(
    (m) => !m.is_territorial && m.total_itemized_amount > 0
  );
  const count = active.length;

  /* ── Geographic averages for chart ── */
  const avgInDistrict =
    active.reduce((s, m) => s + m.pct_in_district, 0) / count;
  const avgInStateOutDistrict =
    active.reduce((s, m) => s + m.pct_in_state_out_district, 0) / count;
  const avgDcKStreet =
    active.reduce((s, m) => s + m.pct_dc_kstreet, 0) / count;
  const avgOutOfState =
    active.reduce((s, m) => s + m.pct_out_of_state, 0) / count;

  const pctFromHome = Math.round(avgInDistrict + avgInStateOutDistrict);

  /* ── Rankings ── */
  const mostOutside = [...active]
    .sort((a, b) => b.pct_outside - a.pct_outside)
    .slice(0, 5);

  const mostLocal = [...active]
    .sort((a, b) => a.pct_outside - b.pct_outside)
    .slice(0, 5);

  /* ── Top outside source states ── */
  const stateMap: Record<string, number> = {};
  for (const m of active) {
    if (m.top_outside_state_1 && m.top_outside_state_1_amt) {
      stateMap[m.top_outside_state_1] =
        (stateMap[m.top_outside_state_1] || 0) + m.top_outside_state_1_amt;
    }
    if (m.top_outside_state_2 && m.top_outside_state_2_amt) {
      stateMap[m.top_outside_state_2] =
        (stateMap[m.top_outside_state_2] || 0) + m.top_outside_state_2_amt;
    }
    if (m.top_outside_state_3 && m.top_outside_state_3_amt) {
      stateMap[m.top_outside_state_3] =
        (stateMap[m.top_outside_state_3] || 0) + m.top_outside_state_3_amt;
    }
  }

  const totalOutsideAmt = Object.values(stateMap).reduce((s, v) => s + v, 0);
  const topStates = Object.entries(stateMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([state, amt]) => ({
      state,
      amount: amt,
      pctOfOutside: totalOutsideAmt > 0 ? (amt / totalOutsideAmt) * 100 : 0,
    }));

  return (
    <div>
      {/* ── Chapter Heading ── */}
      <header className="mb-10">
        <p
          className="text-xs uppercase tracking-[0.25em] text-stone-400 mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Chapter 2
        </p>
        <h1
          className="text-3xl sm:text-5xl text-[#111111] uppercase tracking-tight font-bold mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Money
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed max-w-3xl">
          Most voters assume their representative is funded by constituents.
          The data tells a different story. For the members who write federal
          tax law, the majority of trackable dollars come from outside their
          home state &mdash; from PACs, lobbyists, and industry donors with
          direct stakes in tax policy.
        </p>
        <p className="text-xs text-stone-400 mt-2 max-w-3xl">
          Based on itemized contributions (individual donations over $200 that
          must be reported to the FEC with donor name and address).
        </p>
      </header>

      {/* ── Section: The Geographic Split ── */}
      <section className="mb-12">
        <h2
          className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Geographic Split
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed mb-5 max-w-3xl">
          On average, only{" "}
          <strong className="text-[#111111]">{pctFromHome}%</strong> of a
          tax-writing committee member&apos;s trackable contributions come from
          their own state. Over half arrives from out of state entirely.
        </p>
        <GeoBreakdownChart
          inDistrict={avgInDistrict}
          inStateOutDistrict={avgInStateOutDistrict}
          dcKStreet={avgDcKStreet}
          outOfState={avgOutOfState}
        />
      </section>

      {/* ── Section: The Extremes ── */}
      <section className="mb-12">
        <h2
          className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Extremes
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed mb-5 max-w-3xl">
          Some members get almost nothing from home. Others are genuine
          exceptions &mdash; funded primarily by the people they represent.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Most Outside-Funded */}
          <div>
            <h3
              className="text-sm text-stone-600 uppercase tracking-[0.2em] mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <span className="text-[#FE4F40]">&#9679;</span> Most
              Outside-Funded
            </h3>
            <p className="text-sm text-stone-600 mb-4">
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
            <h3
              className="text-sm text-stone-600 uppercase tracking-[0.2em] mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <span className="text-[#4C6971]">&#9679;</span> Most
              Locally-Funded
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              Lowest percentage of outside funding &mdash; strongest local
              donor base
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
        </div>
      </section>

      {/* ── Section: Where the Outside Money Originates ── */}
      {topStates.length > 0 && (
        <section className="mb-12">
          <h2
            className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Where the Outside Money Originates
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed mb-5 max-w-3xl">
            Across the committee, the top outside source states are
            consistently the same &mdash; financial and lobbying centers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {topStates.map((s, i) => (
              <div
                key={s.state}
                className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5"
              >
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-xs text-stone-400" style={{ fontFamily: "var(--font-display)" }}>
                    #{i + 1}
                  </span>
                  <span
                    className="text-2xl font-bold text-[#111111]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {s.state}
                  </span>
                </div>
                <div className="text-sm text-[#111111] font-semibold tabular-nums">
                  {formatMoney(s.amount)}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {s.pctOfOutside.toFixed(1)}% of all out-of-state money
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Chapter Transition CTA ── */}
      <section className="mb-10">
        <div className="bg-[#111111] text-white rounded-lg p-6">
          <p className="text-sm leading-relaxed mb-3">
            The money comes from outside. But WHO is sending it? The same
            industries with the most at stake in tax policy.
          </p>
          <Link
            href="/industries"
            className="text-[#FE4F40] text-sm font-semibold hover:underline"
            style={{ fontFamily: "var(--font-display)" }}
          >
            The Industries &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
