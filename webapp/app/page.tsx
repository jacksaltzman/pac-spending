import Link from "next/link";
import {
  getMembers,
  getCommitteeAggregates,
  getBenchmarks,
  getBeforeAfter,
  getAlignmentScores,
} from "@/lib/data";
import { formatPct } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";

export default function DashboardPage() {
  const members = getMembers();
  const committeeAggs = getCommitteeAggregates();
  const benchmarks = getBenchmarks();
  const beforeAfter = getBeforeAfter();
  const alignmentScores = getAlignmentScores();

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

  /* Before/after stat: median PAC increase after joining committee */
  const medianPacIncrease = beforeAfter?.headline.median_pct_change ?? null;

  /* Average outside funding % for the Money CTA */
  const avgOutsidePct =
    activeMembersWithData.length > 0
      ? activeMembersWithData.reduce((s, m) => s + m.pct_outside, 0) /
        activeMembersWithData.length
      : 0;

  /* Average alignment % for the Votes CTA */
  let avgAlignmentPct: number | null = null;
  if (alignmentScores) {
    const scores = Object.values(alignmentScores)
      .map((s) => s.alignment_pct)
      .filter((v): v is number => v != null);
    if (scores.length > 0) {
      avgAlignmentPct =
        Math.round(
          (scores.reduce((sum, v) => sum + v, 0) / scores.length) * 10
        ) / 10;
    }
  }

  /* ── CTA card data ──────────────────────────────────────── */
  const chapters = [
    {
      title: "The Committee",
      href: "/committee",
      teaser: `72 members control every tax deduction in America. Who are they?`,
    },
    {
      title: "The Money",
      href: "/money",
      teaser: `${Math.round(avgOutsidePct)}% of their funding comes from outside their home state. Where is it coming from?`,
    },
    {
      title: "The Industries",
      href: "/industries",
      teaser:
        "Finance, healthcare, and real estate PACs dominate. What do they want?",
    },
    {
      title: "The Votes",
      href: "/votes",
      teaser:
        avgAlignmentPct != null
          ? `Members vote with their top funders ${avgAlignmentPct}% of the time. See the receipts.`
          : "Do members vote the way their top funders want? See the receipts.",
    },
  ];

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
        <p className="text-base text-[#111111] leading-relaxed mb-3">
          Two congressional committees write every line of the federal tax
          code. This project follows the money behind their 72
          members &mdash; where it comes from, which industries are paying,
          and whether it shapes how they vote.
        </p>
        <p className="text-sm text-stone-500">
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
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
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
          label="Median outside funding"
          value={formatPct(medianOutside)}
          detail="of contributions come from outside a member's home state"
          accent="#FE4F40"
        />
      </section>

      {/* ── Follow the Money ────────────────────────────── */}
      <section>
        <h2
          className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-5"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Follow the Money
        </h2>
        <div className="flex flex-col gap-4">
          {chapters.map((ch) => (
            <Link
              key={ch.href}
              href={ch.href}
              className="bg-white border border-[#C8C1B6]/50 rounded-lg p-6 hover:border-[#FE4F40] transition-colors group"
            >
              <h3
                className="text-sm uppercase tracking-[0.15em] text-[#111111] mb-2 font-bold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {ch.title}
                <span className="inline-block ml-2 text-stone-400 group-hover:text-[#FE4F40] transition-colors">
                  &rarr;
                </span>
              </h3>
              <p className="text-stone-600 text-sm leading-relaxed">
                {ch.teaser}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
