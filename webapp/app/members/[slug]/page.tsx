import Link from "next/link";
import {
  getMembers,
  getMemberBySlug,
  getEmployersForMember,
  getPacsForMember,
  getOneLinerForMember,
  getLeadershipAnalysis,
  getAlignmentForMember,
  getTaxVotesForMember,
  getSectorPositions,
  getBeforeAfterForMember,
  getBenchmarks,
  getNews,
  getPacSpread,
  getSectorColors,
} from "@/lib/data";
import { formatMoney, formatPct, memberLabel, sectorColor, toTitleCase } from "@/lib/utils";
import CopyButton from "./CopyButton";
import ExpandableTable from "@/components/ExpandableTable";

/* ------------------------------------------------------------------ */
/*  Static params                                                     */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  return getMembers().map((m) => ({ slug: m.slug }));
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const member = getMemberBySlug(slug);

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h1
          className="text-3xl sm:text-5xl text-[#111111] uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Member not found
        </h1>
        <p className="text-sm text-stone-600">
          No member matches the slug &ldquo;{slug}&rdquo;.
        </p>
        <Link
          href="/members"
          className="text-sm text-[#FE4F40] hover:text-[#E5453A] transition-colors"
        >
          &larr; Back to all members
        </Link>
      </div>
    );
  }

  /* ---------- data loading ---------- */

  const employers = getEmployersForMember(member.member_name).slice(0, 20);
  const pacs = getPacsForMember(member.member_name).slice(0, 20);
  const oneLiner = getOneLinerForMember(member.member_name);
  const leadershipData = getLeadershipAnalysis();
  const leadershipRole = leadershipData?.member_leadership_roles?.[member.member_name];
  const alignment = getAlignmentForMember(member.member_name);
  const taxVotes = getTaxVotesForMember(member.member_name);
  const sectorPositions = getSectorPositions();
  const beforeAfterMember = getBeforeAfterForMember(member.member_name);
  const benchmarks = getBenchmarks();
  const news = getNews();
  const pacSpread = getPacSpread();
  const sectorColorsMap = getSectorColors();

  /* ---------- party styling ---------- */

  const partyBadgeBg =
    member.party === "R"
      ? "#FEE2E2"
      : member.party === "D"
        ? "#DBEAFE"
        : "#F5F5F4";
  const partyBadgeText =
    member.party === "R"
      ? "#991B1B"
      : member.party === "D"
        ? "#1E40AF"
        : "#44403C";
  const partyAccent =
    member.party === "R"
      ? "#EF4444"
      : member.party === "D"
        ? "#3B82F6"
        : "#78716C";

  const title = memberLabel(
    member.member_name,
    member.party,
    member.state,
    member.district,
    member.chamber,
  );

  /* ---------- PAC reach lookup ---------- */

  const pacReach = new Map<string, number>();
  for (const p of pacSpread) {
    pacReach.set(p.pac_cmte_id, p.num_recipients);
  }

  /* ---------- geographic bar segments ---------- */

  const isSenate = member.chamber === "senate";

  type BarSegment = {
    key: string;
    label: string;
    pct: number;
    amt: number;
    color: string;
  };

  const segments: BarSegment[] = [];

  if (isSenate) {
    segments.push({
      key: "in_state",
      label: "In-State",
      pct: member.pct_in_state,
      amt: member.amt_in_state,
      color: "#4C6971",
    });
  } else {
    segments.push({
      key: "in_district",
      label: "In-District",
      pct: member.pct_in_district,
      amt: member.amt_in_district,
      color: "#4C6971",
    });
    segments.push({
      key: "in_state_out_district",
      label: "In-State, Out of District",
      pct: member.pct_in_state_out_district,
      amt: member.amt_in_state_out_district,
      color: "#E8F0F2",
    });
  }

  segments.push(
    {
      key: "dc_kstreet",
      label: "DC / K-Street",
      pct: member.pct_dc_kstreet,
      amt: member.amt_dc_kstreet,
      color: "#F59E0B",
    },
    {
      key: "out_of_state",
      label: "Out of State",
      pct: member.pct_out_of_state,
      amt: member.amt_out_of_state,
      color: "#FE4F40",
    },
    {
      key: "unknown",
      label: "Unknown",
      pct: member.pct_unknown,
      amt: member.amt_unknown,
      color: "#C8C1B6",
    },
  );

  /* ---------- top outside states ---------- */

  const topStates = [
    member.top_outside_state_1,
    member.top_outside_state_2,
    member.top_outside_state_3,
  ].filter(Boolean);

  /* ---------- PAC sector breakdown ---------- */

  type SectorSegment = {
    sector: string;
    total: number;
    pct: number;
    color: string;
  };

  const sectorTotals = new Map<string, number>();
  let pacGrandTotal = 0;
  for (const p of pacs) {
    const s = p.sector || "Other Industry";
    sectorTotals.set(s, (sectorTotals.get(s) || 0) + p.total);
    pacGrandTotal += p.total;
  }

  const sectorSegments: SectorSegment[] = [...sectorTotals.entries()]
    .map(([sector, total]) => ({
      sector,
      total,
      pct: pacGrandTotal > 0 ? (total / pacGrandTotal) * 100 : 0,
      color: sectorColor(sector),
    }))
    .sort((a, b) => b.total - a.total);

  /* ---------- alignment scorecard data ---------- */

  const topSector = alignment?.top_funding_sector ?? null;
  const topSectors = alignment?.top_sectors ?? [];
  const alignmentPct = alignment?.alignment_pct ?? null;

  // Build mini-cards for top 3 sectors from alignment data
  const sectorMiniCards: { sector: string; pct: number | null; amount: number }[] = [];
  if (alignment && alignment.per_sector) {
    const sortedSectors = topSectors.length > 0
      ? topSectors
      : Object.keys(alignment.per_sector);

    for (const sector of sortedSectors.slice(0, 3)) {
      const sectorData = alignment.per_sector[sector];
      const sectorAmt = sectorTotals.get(sector) ?? 0;
      const sectorPct = sectorData && sectorData.total > 0
        ? (sectorData.with / sectorData.total) * 100
        : null;
      sectorMiniCards.push({ sector, pct: sectorPct, amount: sectorAmt });
    }
  }

  /* ---------- voting table data ---------- */

  // Build sector position lookup: roll_call_id -> Record<sector, {position, reason}>
  const sectorPositionMap = new Map<string, Record<string, { position: string; reason: string }>>();
  for (const sp of sectorPositions) {
    sectorPositionMap.set(sp.roll_call_id, sp.sector_positions);
  }

  // Build vote matching data for the table
  type VoteRow = {
    date: string;
    bill: string;
    billTitle: string;
    memberPosition: string;
    sectorPosition: string | null;
    sectorReason: string | null;
    matched: boolean | null;
    rollCallId: string;
  };

  const voteRows: VoteRow[] = [];
  if (taxVotes.length > 0 && topSector) {
    for (const vote of taxVotes) {
      const positions = sectorPositionMap.get(vote.roll_call_id);
      const sectorPos = positions?.[topSector];
      const memberPos = vote.position?.toLowerCase();
      const sectorWanted = sectorPos?.position?.toLowerCase() ?? null;

      let matched: boolean | null = null;
      if (memberPos && sectorWanted && memberPos !== "not voting") {
        matched = memberPos === sectorWanted;
      }

      voteRows.push({
        date: vote.date,
        bill: vote.bill,
        billTitle: vote.bill_title,
        memberPosition: vote.position,
        sectorPosition: sectorPos?.position ?? null,
        sectorReason: sectorPos?.reason ?? null,
        matched,
        rollCallId: vote.roll_call_id,
      });
    }
    // Sort by date descending
    voteRows.sort((a, b) => b.date.localeCompare(a.date));
  }

  const votesMatched = voteRows.filter((v) => v.matched === true).length;
  const votesWithPosition = voteRows.filter((v) => v.matched !== null).length;

  /* ---------- benchmark comparison ---------- */

  const chamberBenchmarks = member.chamber === "senate" ? benchmarks?.senate : benchmarks?.house;
  const committeePacMedian = chamberBenchmarks?.committee?.median_pac ?? null;
  const allIncumbentPacMedian = chamberBenchmarks?.all_incumbents?.median_pac ?? null;
  const memberPac = member.fec_pac_contributions ?? null;

  let pacVsMedianPct: number | null = null;
  if (memberPac != null && allIncumbentPacMedian != null && allIncumbentPacMedian > 0) {
    pacVsMedianPct = ((memberPac - allIncumbentPacMedian) / allIncumbentPacMedian) * 100;
  }

  /* ---------- relevant news articles ---------- */

  const memberTopSectors = new Set<string>();
  if (topSector) memberTopSectors.add(topSector);
  for (const s of topSectors.slice(0, 3)) memberTopSectors.add(s);
  // Also add from PAC sector data
  for (const seg of sectorSegments.slice(0, 3)) memberTopSectors.add(seg.sector);

  const relevantNews = news
    .filter((n) => {
      for (const s of memberTopSectors) {
        if (n.sector.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(n.sector.toLowerCase())) {
          return true;
        }
      }
      return false;
    })
    .slice(0, 3);

  /* ---------- leadership premium for callout ---------- */

  const leadershipTiers = member.chamber === "house"
    ? leadershipData?.tier_comparison?.house
    : leadershipData?.tier_comparison?.senate;
  const rankAndFileTier = leadershipTiers?.find((t) => t.tier === "Rank-and-File");
  const rankAndFileMedianPac = rankAndFileTier?.median_pac ?? null;
  const leadershipPremium = leadershipRole && leadershipRole.tier <= 2 && rankAndFileMedianPac != null && memberPac != null && rankAndFileMedianPac > 0
    ? ((memberPac - rankAndFileMedianPac) / rankAndFileMedianPac) * 100
    : null;

  /* ---------- committee name display ---------- */

  const committeeName = member.committee === "house_ways_and_means"
    ? "Ways & Means"
    : member.committee === "senate_finance"
      ? "Senate Finance"
      : member.committee;

  return (
    <div className="space-y-10">
      {/* ---- Back link ---- */}
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-[#111111] transition-colors uppercase tracking-wider"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span>&larr;</span>
        <span>All Members</span>
      </Link>

      {/* ==================================================================
          ACT 0: HEADER
          ================================================================== */}
      <header>
        <div
          className="h-1 w-16 rounded-sm mb-6"
          style={{ backgroundColor: partyAccent }}
        />
        <h1
          className="text-3xl md:text-5xl text-[#111111] leading-tight uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>
        {(member.role || member.committee) && (
          <p className="mt-2 text-sm text-stone-600">
            {member.role}
            {member.role && member.committee ? " — " : ""}
            {committeeName}
          </p>
        )}
        {leadershipRole && leadershipRole.tier <= 2 && (
          <div className="mt-2 inline-flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: leadershipRole.tier === 1 ? "#FEE2E2" : "#FEF3C7",
                color: leadershipRole.tier === 1 ? "#991B1B" : "#92400E",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: leadershipRole.tier === 1 ? "#FE4F40" : "#F59E0B",
                }}
              />
              {leadershipRole.title}
              {leadershipRole.subcommittee && (
                <span className="font-normal">
                  , {leadershipRole.subcommittee}
                </span>
              )}
            </span>
          </div>
        )}
      </header>

      {/* ---- One-liner ---- */}
      {oneLiner && (
        <div className="flex items-start gap-3 bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
          <p className="text-sm text-stone-600 italic flex-1 leading-relaxed">
            &ldquo;{oneLiner}&rdquo;
          </p>
          <CopyButton text={oneLiner} />
        </div>
      )}

      {/* ==================================================================
          ACT 1: INFLUENCE SCORECARD (centerpiece)
          ================================================================== */}
      {alignment && alignmentPct != null && (
        <section className="space-y-4">
          <h2
            className="text-sm text-stone-600 uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Influence Scorecard
          </h2>

          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-6 space-y-6">
            {/* Big alignment number */}
            <div className="text-center">
              <p
                className="text-5xl md:text-6xl font-bold tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  color: alignmentPct > 75 ? "#FE4F40" : alignmentPct > 50 ? "#F59E0B" : "#4C6971",
                }}
              >
                {alignmentPct.toFixed(0)}%
              </p>
              <p
                className="text-sm text-stone-500 mt-2 uppercase tracking-wider"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Aligned with top funders
              </p>
              <p className="text-sm text-stone-500 mt-2 max-w-lg mx-auto leading-relaxed">
                On {alignment.votes_total} tax-relevant vote{alignment.votes_total !== 1 ? "s" : ""},{" "}
                {member.member_name.split(" ").pop()} voted with their top funding
                sectors&apos; positions {alignmentPct.toFixed(0)}% of the time
              </p>
            </div>

            {/* Top 3 sector mini-cards */}
            {sectorMiniCards.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {sectorMiniCards.map((mc) => {
                  const cardColor = mc.pct != null
                    ? mc.pct > 75 ? "#FE4F40" : mc.pct > 50 ? "#F59E0B" : "#4C6971"
                    : "#C8C1B6";
                  return (
                    <div
                      key={mc.sector}
                      className="rounded-lg border p-4 text-center"
                      style={{ borderColor: `${cardColor}40` }}
                    >
                      <span
                        className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-medium text-white mb-2"
                        style={{ backgroundColor: sectorColor(mc.sector) }}
                      >
                        {mc.sector}
                      </span>
                      <p
                        className="text-2xl font-bold tracking-tight"
                        style={{ fontFamily: "var(--font-display)", color: cardColor }}
                      >
                        {mc.pct != null ? `${mc.pct.toFixed(0)}%` : "N/A"}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-1">
                        {formatMoney(mc.amount)} in PAC funding
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================================================================
          ACT 2: THE MONEY
          ================================================================== */}
      <section className="space-y-4">
        <h2
          className="text-sm text-stone-600 uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Money
        </h2>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox
            label="Total Raised"
            value={formatMoney(member.fec_total_receipts ?? member.total_itemized_amount)}
            accent="#111111"
          />
          <StatBox
            label="PAC Money"
            value={formatMoney(member.fec_pac_contributions)}
            accent="#FE4F40"
          />
          <StatBox
            label="Outside Money"
            value={formatPct(member.pct_outside)}
            accent="#FE4F40"
          />
          <StatBox
            label="DC / K-Street"
            value={formatPct(member.pct_dc_kstreet)}
            accent="#F59E0B"
          />
        </div>

        {/* Before/After callout */}
        {beforeAfterMember && beforeAfterMember.pct_change_pac != null && beforeAfterMember.first_year != null && (
          <div className="bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <span className="text-lg">&#9888;</span>
              <div>
                <p className="text-sm font-medium text-[#92400E]">
                  PAC funding {beforeAfterMember.pct_change_pac > 0 ? "increased" : "decreased"}{" "}
                  <span className="font-bold">
                    {beforeAfterMember.pct_change_pac > 0 ? "+" : ""}
                    {beforeAfterMember.pct_change_pac.toFixed(0)}%
                  </span>{" "}
                  after joining {committeeName} in {beforeAfterMember.first_year}
                </p>
                <p className="text-xs text-[#92400E]/70 mt-1">
                  Median PAC receipts: {formatMoney(beforeAfterMember.median_pac_before)} (before) → {formatMoney(beforeAfterMember.median_pac_after)} (after)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leadership premium callout */}
        {leadershipRole && leadershipRole.tier <= 2 && leadershipPremium != null && leadershipPremium > 0 && (
          <div className="bg-[#FEE2E2] border border-[#FE4F40]/30 rounded-lg p-5">
            <div className="flex items-start gap-3">
              <span className="text-lg">&#9733;</span>
              <div>
                <p className="text-sm font-medium text-[#991B1B]">
                  As {leadershipRole.title}, receives{" "}
                  <span className="font-bold">
                    {leadershipPremium.toFixed(0)}% more
                  </span>{" "}
                  PAC money than rank-and-file members
                </p>
                <p className="text-xs text-[#991B1B]/70 mt-1">
                  {formatMoney(memberPac)} vs. {formatMoney(rankAndFileMedianPac)} median for rank-and-file
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Geographic Breakdown */}
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 space-y-5">
          <p
            className="text-[10px] uppercase tracking-[0.2em] text-stone-400"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Geographic Breakdown
          </p>

          <div className="flex h-8 rounded-sm overflow-hidden">
            {segments.map(
              (seg) =>
                seg.pct > 0 && (
                  <div
                    key={seg.key}
                    style={{
                      width: `${seg.pct}%`,
                      backgroundColor: seg.color,
                    }}
                    className="relative group transition-opacity hover:opacity-90"
                    title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
                  >
                    {seg.pct >= 8 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white">
                        {seg.pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                ),
            )}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {segments.map((seg) => (
              <div key={seg.key} className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-stone-500">{seg.label}</span>
                <span className="text-[#111111] font-medium">{formatPct(seg.pct)}</span>
                <span className="text-stone-400">({formatMoney(seg.amt)})</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================
          ACT 3: WHO FUNDS THEM & WHAT THEY WANT
          ================================================================== */}
      <section className="space-y-6">
        <h2
          className="text-sm text-stone-600 uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Who Funds Them &amp; What They Want
        </h2>

        {/* PAC Sector Breakdown */}
        {pacs.length > 0 && sectorSegments.length > 0 && (
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 space-y-5">
            <p
              className="text-[10px] uppercase tracking-[0.2em] text-stone-400"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Where the PAC Money Comes From
            </p>

            <div className="flex h-8 rounded-sm overflow-hidden">
              {sectorSegments.map(
                (seg) =>
                  seg.pct > 0 && (
                    <div
                      key={seg.sector}
                      style={{
                        width: `${seg.pct}%`,
                        backgroundColor: seg.color,
                      }}
                      className="relative group transition-opacity hover:opacity-90"
                      title={`${seg.sector}: ${seg.pct.toFixed(1)}%`}
                    >
                      {seg.pct >= 10 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white">
                          {seg.pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ),
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {sectorSegments.map((seg) => (
                <div key={seg.sector} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-stone-500">{seg.sector}</span>
                  <span className="text-[#111111] font-medium">{formatPct(seg.pct)}</span>
                  <span className="text-stone-400">({formatMoney(seg.total)})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced PAC Table with Reach column */}
        {pacs.length > 0 && (
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB] text-stone-500 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <th className="text-left px-5 py-3 w-12">#</th>
                  <th className="text-left px-5 py-3">PAC Name</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-right px-5 py-3">Count</th>
                  <th className="text-right px-5 py-3">Reach</th>
                </tr>
              </thead>
              <tbody>
                <ExpandableTable
                  totalLabel="PACs"
                  rows={pacs.map((p, i) => {
                    const reach = pacReach.get(p.pac_cmte_id);
                    return (
                      <tr
                        key={`${p.pac_cmte_id}-${p.rank}`}
                        className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors ${
                          i % 2 === 0 ? "" : "bg-[#FDFBF9]"
                        }`}
                      >
                        <td className="px-5 py-3 text-stone-400 text-xs">{p.rank}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[#111111] max-w-xs truncate">{toTitleCase(p.pac_name)}</span>
                                {p.sector && (
                                  <span
                                    className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-medium text-white whitespace-nowrap"
                                    style={{ backgroundColor: sectorColor(p.sector) }}
                                  >
                                    {p.sector}
                                  </span>
                                )}
                              </div>
                              {p.agenda && (
                                <p className="text-xs text-stone-400 mt-1 leading-relaxed">{p.agenda}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-[#111111] font-medium">{formatMoney(p.total)}</td>
                        <td className="px-5 py-3 text-right text-stone-500">{p.count}</td>
                        <td className="px-5 py-3 text-right text-stone-500">
                          {reach != null ? (
                            <span className="text-xs" title={`Funds ${reach} of 72 committee members`}>
                              {reach}/72
                            </span>
                          ) : (
                            <span className="text-stone-300">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                />
              </tbody>
            </table>
          </div>
        )}

        {/* Top Outside Employers */}
        {employers.length > 0 && (
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#C8C1B6]/50 bg-[#F5F0EB]">
              <p
                className="text-[10px] uppercase tracking-[0.2em] text-stone-400"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Top Outside Employers
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB] text-stone-500 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <th className="text-left px-5 py-3 w-12">#</th>
                  <th className="text-left px-5 py-3">Employer</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-right px-5 py-3">Count</th>
                </tr>
              </thead>
              <tbody>
                <ExpandableTable
                  totalLabel="employers"
                  rows={employers.map((e, i) => (
                    <tr
                      key={`${e.employer}-${e.rank}`}
                      className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors ${
                        i % 2 === 0 ? "" : "bg-[#FDFBF9]"
                      }`}
                    >
                      <td className="px-5 py-3 text-stone-400 text-xs">{e.rank}</td>
                      <td className="px-5 py-3 text-[#111111]">{e.employer}</td>
                      <td className="px-5 py-3 text-right text-[#111111] font-medium">{formatMoney(e.total)}</td>
                      <td className="px-5 py-3 text-right text-stone-500">{e.count}</td>
                    </tr>
                  ))}
                />
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ==================================================================
          ACT 4: HOW THEY VOTED
          ================================================================== */}
      {voteRows.length > 0 && topSector && (
        <section className="space-y-4">
          <h2
            className="text-sm text-stone-600 uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            How They Voted
          </h2>

          {/* Summary line */}
          {votesWithPosition > 0 && (
            <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
              <p className="text-sm text-stone-600">
                Voted with{" "}
                <span
                  className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-medium text-white"
                  style={{ backgroundColor: sectorColor(topSector) }}
                >
                  {topSector}
                </span>{" "}
                <span className="font-bold text-[#111111]">
                  {votesMatched}/{votesWithPosition} times
                </span>{" "}
                ({votesWithPosition > 0 ? ((votesMatched / votesWithPosition) * 100).toFixed(0) : 0}%)
              </p>
            </div>
          )}

          {/* Voting table */}
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB] text-stone-500 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Bill</th>
                    <th className="text-center px-4 py-3">Vote</th>
                    <th className="text-center px-4 py-3">{topSector} Wanted</th>
                    <th className="text-center px-4 py-3">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {voteRows.map((row) => (
                    <tr
                      key={row.rollCallId}
                      className="border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors"
                    >
                      <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#111111] text-xs font-medium">{row.bill}</p>
                        <p className="text-[10px] text-stone-400 mt-0.5 leading-relaxed line-clamp-2">
                          {row.billTitle}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <VoteBadge position={row.memberPosition} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.sectorPosition ? (
                          <VoteBadge position={row.sectorPosition} />
                        ) : (
                          <span className="text-stone-300 text-xs">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.matched === true ? (
                          <span className="text-green-600 font-bold text-base" title="Voted with sector position">&#10003;</span>
                        ) : row.matched === false ? (
                          <span className="text-[#FE4F40] font-bold text-base" title="Voted against sector position">&#10007;</span>
                        ) : (
                          <span className="text-stone-300 text-xs">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================================
          ACT 5: CONTEXT
          ================================================================== */}
      {(pacVsMedianPct != null || relevantNews.length > 0) && (
        <section className="space-y-4">
          <h2
            className="text-sm text-stone-600 uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Context
          </h2>

          {/* Committee comparison */}
          {pacVsMedianPct != null && memberPac != null && allIncumbentPacMedian != null && (
            <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 space-y-4">
              <p
                className="text-[10px] uppercase tracking-[0.2em] text-stone-400"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Committee Comparison
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1" style={{ fontFamily: "var(--font-display)" }}>
                    {member.member_name.split(" ").pop()}&apos;s PAC $
                  </p>
                  <p className="text-lg font-bold text-[#111111]" style={{ fontFamily: "var(--font-display)" }}>
                    {formatMoney(memberPac)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1" style={{ fontFamily: "var(--font-display)" }}>
                    Median {member.chamber === "house" ? "House" : "Senate"} Incumbent
                  </p>
                  <p className="text-lg font-bold text-stone-400" style={{ fontFamily: "var(--font-display)" }}>
                    {formatMoney(allIncumbentPacMedian)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1" style={{ fontFamily: "var(--font-display)" }}>
                    vs. Median
                  </p>
                  <p
                    className="text-lg font-bold"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: pacVsMedianPct > 0 ? "#FE4F40" : "#4C6971",
                    }}
                  >
                    {pacVsMedianPct > 0 ? "+" : ""}{pacVsMedianPct.toFixed(0)}%
                  </p>
                </div>
              </div>
              {committeePacMedian != null && (
                <p className="text-sm text-stone-500">
                  {committeeName} committee median: {formatMoney(committeePacMedian)} PAC receipts ({benchmarks?.cycle} cycle)
                </p>
              )}
            </div>
          )}

          {/* Relevant news */}
          {relevantNews.length > 0 && (
            <div className="space-y-3">
              <p
                className="text-[10px] uppercase tracking-[0.2em] text-stone-400"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Related News
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {relevantNews.map((article, i) => (
                  <a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white border border-[#C8C1B6]/50 rounded-lg p-4 hover:border-[#C8C1B6] transition-colors block"
                  >
                    <p className="text-xs text-stone-400 mb-1">
                      {article.source} &middot; {article.date}
                    </p>
                    <p className="text-sm font-medium text-[#111111] leading-snug">
                      {article.title}
                    </p>
                    <p className="text-xs text-stone-500 mt-2 line-clamp-2 leading-relaxed">
                      {article.excerpt}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ==================================================================
          TOP OUTSIDE STATES
          ================================================================== */}
      {topStates.length > 0 && (
        <section className="space-y-4">
          <h2
            className="text-sm text-stone-600 uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Top Outside States
          </h2>
          <div className="flex gap-3">
            {topStates.map((st, i) => (
              <div
                key={st}
                className="bg-white border border-[#C8C1B6]/50 rounded-lg px-5 py-4 flex items-center gap-3"
              >
                <span
                  className="w-8 h-8 rounded-sm bg-[#111111] text-white text-sm font-bold flex items-center justify-center"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {i + 1}
                </span>
                <span className="text-lg text-[#111111] font-medium">
                  {st}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ==================================================================
          DATA QUALITY
          ================================================================== */}
      <section className="space-y-4">
        <h2
          className="text-sm text-stone-600 uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Data Quality
        </h2>
        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Unitemized Gap
              </p>
              <p className="text-[#111111] font-medium">
                {member.unitemized_pct != null ? formatPct(member.unitemized_pct) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Capture Rate
              </p>
              <p className="text-[#111111] font-medium">
                {member.capture_rate_pct != null ? formatPct(member.capture_rate_pct) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1" style={{ fontFamily: "var(--font-display)" }}>
                JFC Flag
              </p>
              <p className="text-[#111111] font-medium">
                {member.jfc_flag ? <span className="text-[#F59E0B]">Yes</span> : "No"}
              </p>
            </div>
            {member.fec_total_receipts != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1" style={{ fontFamily: "var(--font-display)" }}>
                  FEC Total Receipts
                </p>
                <p className="text-[#111111] font-medium">
                  {formatMoney(member.fec_total_receipts)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---- Territorial footnote ---- */}
      {member.is_territorial && (
        <footer className="border-t border-[#C8C1B6]/50 pt-6">
          <p className="text-xs text-stone-500 italic">
            Note: This member represents a U.S. territory. Geographic
            contribution breakdowns may differ from standard state/district
            analyses due to territorial boundaries and unique filing patterns.
          </p>
        </footer>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small inline stat box                                              */
/* ------------------------------------------------------------------ */

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
      <p
        className="text-xs uppercase tracking-widest text-stone-600 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-display)", color: accent }}
      >
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vote badge (Yes/No/Not Voting)                                     */
/* ------------------------------------------------------------------ */

function VoteBadge({ position }: { position: string }) {
  const pos = position?.toLowerCase() ?? "";
  let bg = "#E5E7EB";
  let text = "#6B7280";
  let label = position;

  if (pos === "yea" || pos === "yes") {
    bg = "#D1FAE5";
    text = "#065F46";
    label = "Yea";
  } else if (pos === "nay" || pos === "no") {
    bg = "#FEE2E2";
    text = "#991B1B";
    label = "Nay";
  } else if (pos.includes("not voting")) {
    bg = "#F5F5F4";
    text = "#78716C";
    label = "N/V";
  }

  return (
    <span
      className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}
