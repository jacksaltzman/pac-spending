import Link from "next/link";
import {
  getMembers,
  getMemberBySlug,
  getEmployersForMember,
  getPacsForMember,
  getOneLinerForMember,
  getLeadershipAnalysis,
} from "@/lib/data";
import { formatMoney, formatPct, memberLabel, sectorColor } from "@/lib/utils";
import CopyButton from "./CopyButton";

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

  const employers = getEmployersForMember(member.member_name).slice(0, 20);
  const pacs = getPacsForMember(member.member_name).slice(0, 20);
  const oneLiner = getOneLinerForMember(member.member_name);
  const leadershipData = getLeadershipAnalysis();
  const leadershipRole = leadershipData?.member_leadership_roles?.[member.member_name];

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

      {/* ---- Header ---- */}
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
            {member.committee === "house_ways_and_means"
              ? "House Ways & Means"
              : member.committee === "senate_finance"
                ? "Senate Finance"
                : member.committee}
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

      {/* ---- Stats row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Outside Money" value={formatPct(member.pct_outside)} accent="#FE4F40" />
        <StatBox label="DC / K-Street" value={formatPct(member.pct_dc_kstreet)} accent="#F59E0B" />
        <StatBox label="In-Home" value={formatPct(member.pct_in_home)} accent="#4C6971" />
        <StatBox label="Total Itemized" value={formatMoney(member.total_itemized_amount)} accent="#111111" />
      </div>

      {/* ---- Geographic Breakdown ---- */}
      <section className="space-y-4">
        <h2
          className="text-xs text-stone-500 uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Geographic Breakdown
        </h2>

        <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 space-y-5">
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

      {/* ---- Top Outside Employers ---- */}
      {employers.length > 0 && (
        <section className="space-y-4">
          <h2
            className="text-xs text-stone-500 uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Top Outside Employers
          </h2>
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
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
                {employers.map((e, i) => (
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
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- PAC Sector Breakdown ---- */}
      {pacs.length > 0 && sectorSegments.length > 0 && (
        <section className="space-y-4">
          <h2
            className="text-xs text-stone-500 uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Where the PAC Money Comes From
          </h2>

          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 space-y-5">
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
        </section>
      )}

      {/* ---- Top PACs ---- */}
      {pacs.length > 0 && (
        <section className="space-y-4">
          <h2
            className="text-xs text-stone-500 uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Top PACs
          </h2>
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB] text-stone-500 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <th className="text-left px-5 py-3 w-12">#</th>
                  <th className="text-left px-5 py-3">PAC Name</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-right px-5 py-3">Count</th>
                </tr>
              </thead>
              <tbody>
                {pacs.map((p, i) => (
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
                            <span className="text-[#111111]">{p.pac_name}</span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- Top Outside States ---- */}
      {topStates.length > 0 && (
        <section className="space-y-4">
          <h2
            className="text-xs text-stone-500 uppercase tracking-[0.2em]"
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

      {/* ---- Data Quality ---- */}
      <section className="space-y-4">
        <h2
          className="text-xs text-stone-500 uppercase tracking-[0.2em]"
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
          <p className="text-xs text-stone-400 italic">
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
