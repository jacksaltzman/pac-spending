import Link from "next/link";
import {
  getMembers,
  getAlignmentScores,
  getSectorPositions,
} from "@/lib/data";
import { formatPct, sectorColor } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import ExpandableSection from "@/components/ExpandableSection";

/* ------------------------------------------------------------------ */
/*  Helper: alignment color                                           */
/* ------------------------------------------------------------------ */
function alignmentColor(pct: number): string {
  if (pct > 75) return "#FE4F40";
  if (pct >= 50) return "#F59E0B";
  return "#4C6971";
}

/* ------------------------------------------------------------------ */
/*  Vote card (used in THE VOTES THAT MATTERED section)               */
/* ------------------------------------------------------------------ */
function VoteCard({
  bill,
  billTitle,
  date,
  description,
  chamber,
  sectorPositions,
}: {
  bill: string;
  billTitle: string;
  date: string;
  description: string;
  chamber: string;
  sectorPositions: Record<string, { position: string; reason: string }>;
}) {
  const sectors = Object.entries(sectorPositions);
  const formatted = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-xs text-stone-400 mb-1">
            {formatted} &middot; {chamber === "house" ? "House" : "Senate"}
          </p>
          <p
            className="text-sm font-bold text-[#111111] uppercase tracking-wide"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {bill}
          </p>
          <p className="text-sm text-[#111111] font-medium mt-0.5">
            {billTitle}
          </p>
        </div>
        <span
          className="shrink-0 text-xs text-stone-500 tabular-nums"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {sectors.length} sector{sectors.length !== 1 ? "s" : ""}
        </span>
      </div>

      <p className="text-sm text-stone-600 leading-relaxed mb-3">
        {description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {sectors.map(([sector, info]) => (
          <span
            key={sector}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs"
            style={{ backgroundColor: sectorColor(sector) + "18" }}
            title={`${info.position.toUpperCase()}: ${info.reason}`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: sectorColor(sector) }}
            />
            <span className="text-stone-700">{sector}</span>
            <span
              className="font-semibold uppercase text-[10px]"
              style={{
                color:
                  info.position === "nay"
                    ? "#DC2626"
                    : "#16A34A",
              }}
            >
              {info.position}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function VotesPage() {
  const members = getMembers();
  const alignmentScores = getAlignmentScores();
  const sectorPositions = getSectorPositions();

  /* ── Build member lookup by name ─────────────────────────────── */
  const memberMap = new Map(
    members.map((m) => [
      m.member_name,
      {
        slug: m.slug,
        party: m.party,
        state: m.state,
        chamber: m.chamber,
        district: m.district,
      },
    ])
  );

  /* ── Compute alignment stats ─────────────────────────────────── */
  const qualifiedEntries = alignmentScores
    ? Object.entries(alignmentScores).filter(
        ([, s]) => s.alignment_pct != null && s.votes_total >= 3
      )
    : [];

  const qualifiedScores = qualifiedEntries.map(([name, s]) => ({
    name,
    alignmentPct: s.alignment_pct as number,
    votesTotal: s.votes_total,
    topFundingSector: s.top_funding_sector,
    ...memberMap.get(name),
  }));

  const avgAlignment =
    qualifiedScores.length > 0
      ? Math.round(
          (qualifiedScores.reduce((s, m) => s + m.alignmentPct, 0) /
            qualifiedScores.length) *
            10
        ) / 10
      : null;

  const highAlignmentCount = qualifiedScores.filter(
    (m) => m.alignmentPct > 75
  ).length;

  const independentCount = qualifiedScores.filter(
    (m) => m.alignmentPct < 50
  ).length;

  /* ── Most / least aligned ────────────────────────────────────── */
  const sorted = [...qualifiedScores].sort(
    (a, b) => b.alignmentPct - a.alignmentPct
  );
  const mostAligned = sorted.slice(0, 5);
  const leastAligned = sorted.slice(-5).reverse();

  /* ── Vote cards: sort by number of sector positions ──────────── */
  const sortedVotes = [...sectorPositions].sort(
    (a, b) =>
      Object.keys(b.sector_positions).length -
      Object.keys(a.sector_positions).length
  );
  const topVotes = sortedVotes.slice(0, 5);
  const remainingVotes = sortedVotes.slice(5);

  return (
    <div>
      {/* ── Chapter Heading ──────────────────────────────────── */}
      <header className="mb-10">
        <p
          className="text-xs uppercase tracking-[0.25em] text-stone-400 mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Chapter 4
        </p>
        <h1
          className="text-3xl sm:text-5xl text-[#111111] uppercase tracking-tight font-bold mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Votes
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed max-w-3xl">
          Industries pour millions into tax-writing committee members. But does
          it translate into votes? We tracked 15 curated tax-policy votes and
          compared each member&apos;s voting record against their top funding
          sectors&apos; stated positions.
        </p>
      </header>

      {/* ── Section: THE ALIGNMENT ───────────────────────────── */}
      <section className="mb-12">
        <h2
          className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Alignment
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed mb-5 max-w-3xl">
          For each member, we identified their top funding sectors by PAC
          dollars, then checked whether they voted in line with those
          sectors&apos; stated positions on {sectorPositions.length} curated tax votes.
          A higher percentage means a member voted the way their biggest
          funders wanted more often.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Average alignment"
            value={avgAlignment != null ? formatPct(avgAlignment) : "---"}
            detail={`with top funding sectors across ${qualifiedScores.length} members`}
          />
          <StatCard
            label="High alignment"
            value={String(highAlignmentCount)}
            detail="members vote with funders >75% of the time"
            accent="#FE4F40"
          />
          <StatCard
            label="Independent voters"
            value={String(independentCount)}
            detail="members vote against funders >50% of the time"
            accent="#4C6971"
          />
        </div>
      </section>

      {/* ── Section: MOST & LEAST ALIGNED ────────────────────── */}
      {qualifiedScores.length > 0 && (
        <section className="mb-12">
          <h2
            className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Most &amp; Least Aligned
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed mb-5 max-w-3xl">
            Members ranked by how often their votes matched their top funding
            sectors&apos; preferred positions. Only members with 3+ scored votes
            are included.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Most Aligned */}
            <div>
              <h3
                className="text-sm text-stone-600 uppercase tracking-[0.2em] mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="text-[#FE4F40]">&#9679;</span> Most Aligned
              </h3>
              <p className="text-sm text-stone-600 mb-4">
                Vote with their top funders most often
              </p>
              <div className="flex flex-col gap-2">
                {mostAligned.map((m) => {
                  const info = memberMap.get(m.name);
                  const prefix =
                    info?.chamber === "senate" ? "Sen." : "Rep.";
                  const partyBg =
                    m.party === "R"
                      ? "#FEE2E2"
                      : m.party === "D"
                        ? "#DBEAFE"
                        : "#F5F5F4";
                  const partyText =
                    m.party === "R"
                      ? "#991B1B"
                      : m.party === "D"
                        ? "#1E40AF"
                        : "#44403C";
                  const distStr =
                    info?.chamber === "house" && info?.district != null
                      ? `-${String(info.district).padStart(2, "0")}`
                      : "";
                  const location = `${m.party}-${m.state}${distStr}`;

                  return (
                    <Link
                      key={m.name}
                      href={`/committee/${m.slug}`}
                      className="bg-white border border-[#C8C1B6]/50 rounded-lg p-4 hover:border-[#FE4F40] transition-colors group flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[#111111] group-hover:text-[#FE4F40] transition-colors">
                          {prefix} {m.name}
                        </span>
                        <span
                          className="ml-2 rounded-sm px-1.5 py-px text-[10px] uppercase tracking-wide font-bold"
                          style={{
                            fontFamily: "var(--font-display)",
                            backgroundColor: partyBg,
                            color: partyText,
                          }}
                        >
                          {location}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs text-stone-500"
                          title={m.topFundingSector}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: sectorColor(
                                m.topFundingSector
                              ),
                            }}
                          />
                          <span className="hidden sm:inline truncate max-w-[120px]">
                            {m.topFundingSector}
                          </span>
                        </span>
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{
                            fontFamily: "var(--font-display)",
                            color: alignmentColor(m.alignmentPct),
                          }}
                        >
                          {m.alignmentPct.toFixed(1)}%
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Least Aligned */}
            <div>
              <h3
                className="text-sm text-stone-600 uppercase tracking-[0.2em] mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="text-[#4C6971]">&#9679;</span> Least Aligned
              </h3>
              <p className="text-sm text-stone-600 mb-4">
                Vote against their top funders most often
              </p>
              <div className="flex flex-col gap-2">
                {leastAligned.map((m) => {
                  const info = memberMap.get(m.name);
                  const prefix =
                    info?.chamber === "senate" ? "Sen." : "Rep.";
                  const partyBg =
                    m.party === "R"
                      ? "#FEE2E2"
                      : m.party === "D"
                        ? "#DBEAFE"
                        : "#F5F5F4";
                  const partyText =
                    m.party === "R"
                      ? "#991B1B"
                      : m.party === "D"
                        ? "#1E40AF"
                        : "#44403C";
                  const distStr =
                    info?.chamber === "house" && info?.district != null
                      ? `-${String(info.district).padStart(2, "0")}`
                      : "";
                  const location = `${m.party}-${m.state}${distStr}`;

                  return (
                    <Link
                      key={m.name}
                      href={`/committee/${m.slug}`}
                      className="bg-white border border-[#C8C1B6]/50 rounded-lg p-4 hover:border-[#4C6971] transition-colors group flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[#111111] group-hover:text-[#4C6971] transition-colors">
                          {prefix} {m.name}
                        </span>
                        <span
                          className="ml-2 rounded-sm px-1.5 py-px text-[10px] uppercase tracking-wide font-bold"
                          style={{
                            fontFamily: "var(--font-display)",
                            backgroundColor: partyBg,
                            color: partyText,
                          }}
                        >
                          {location}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs text-stone-500"
                          title={m.topFundingSector}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: sectorColor(
                                m.topFundingSector
                              ),
                            }}
                          />
                          <span className="hidden sm:inline truncate max-w-[120px]">
                            {m.topFundingSector}
                          </span>
                        </span>
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{
                            fontFamily: "var(--font-display)",
                            color: alignmentColor(m.alignmentPct),
                          }}
                        >
                          {m.alignmentPct.toFixed(1)}%
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Section: THE VOTES THAT MATTERED ─────────────────── */}
      {sectorPositions.length > 0 && (
        <section className="mb-12">
          <h2
            className="text-sm uppercase tracking-[0.2em] text-stone-600 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            The Votes That Mattered
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed mb-5 max-w-3xl">
            These {sectorPositions.length} curated tax-policy votes form the
            basis of our alignment analysis. Each vote is tagged with the
            industry sectors that had a stated position &mdash; and whether they
            favored <span className="text-[#16A34A] font-medium">yea</span> or <span className="text-[#DC2626] font-medium">nay</span>.
          </p>

          <div className="flex flex-col gap-3">
            {topVotes.map((v) => (
              <VoteCard
                key={v.roll_call_id}
                bill={v.bill}
                billTitle={v.bill_title}
                date={v.date}
                description={v.description}
                chamber={v.chamber}
                sectorPositions={v.sector_positions}
              />
            ))}
          </div>

          {remainingVotes.length > 0 && (
            <div className="mt-4">
              <ExpandableSection
                label={`Show all ${sectorPositions.length} votes \u2192`}
              >
                <div className="flex flex-col gap-3">
                  {remainingVotes.map((v) => (
                    <VoteCard
                      key={v.roll_call_id}
                      bill={v.bill}
                      billTitle={v.bill_title}
                      date={v.date}
                      description={v.description}
                      chamber={v.chamber}
                      sectorPositions={v.sector_positions}
                    />
                  ))}
                </div>
              </ExpandableSection>
            </div>
          )}
        </section>
      )}

      {/* ── Section: LOOK UP YOUR REPRESENTATIVE ─────────────── */}
      <section className="mb-12">
        <div className="bg-[#111111] text-white rounded-lg p-6">
          <h2
            className="text-sm uppercase tracking-[0.2em] text-stone-400 mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Look Up Your Representative
          </h2>
          <p className="text-sm text-stone-300 leading-relaxed mb-4">
            See how your representative&apos;s funding compares to their voting
            record. Every member page shows a full alignment breakdown by sector.
          </p>
          <Link
            href="/committee"
            className="inline-block bg-[#FE4F40] text-white text-sm font-bold uppercase tracking-wide rounded-sm px-5 py-2.5 hover:bg-[#e5453a] transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Find a member &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
