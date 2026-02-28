import {
  getPacSpread,
  getSectorColors,
  getNews,
  getMembers,
  getBenchmarks,
  getBeforeAfter,
  PacSpreadEntry,
} from "@/lib/data";
import { formatMoney, memberSlug } from "@/lib/utils";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import PacCharts from "@/components/PacCharts";
import NewsCards from "@/components/NewsCard";
import PacsTable from "./PacsTable";

/* ── Sector agenda narratives ─────────────────────────────── */

const SECTOR_AGENDAS: Record<string, string> = {
  "Finance & Insurance":
    "Lower capital gains rates, preserve the carried interest loophole, expand pass-through deductions, and weaken the corporate alternative minimum tax.",
  "Healthcare & Pharma":
    "Block drug price negotiation in tax legislation, preserve R&D tax credits, and maintain tax-exempt status for nonprofit hospital systems.",
  "Real Estate & Housing":
    "Protect the mortgage interest deduction, defend 1031 like-kind exchanges, preserve capital gains exclusion on home sales, and expand LIHTC.",
  "Energy & Natural Resources":
    "Preserve intangible drilling cost deductions, percentage depletion allowances, and favorable treatment of master limited partnerships.",
  "Tech & Telecom":
    "Expand R&D expensing, defend offshore intellectual property structures, and shape digital services taxation.",
  "Defense & Aerospace":
    "Restore full expensing for capital equipment and preserve accelerated depreciation on defense manufacturing assets.",
  Transportation:
    "Maintain fuel tax exemptions, expand infrastructure tax credits, and preserve depreciation schedules for rolling stock.",
  "Retail & Consumer":
    "Expand the pass-through business deduction (199A), reduce inventory accounting burdens, and preserve LIFO tax treatment.",
  Labor:
    "Protect union dues deductibility, expand earned income tax credit, and defend pension contribution tax treatment.",
  "Professional Services":
    "Preserve pass-through deductions for partnerships, expand Sec. 179 expensing, and resist limitations on business interest deductions.",
};

/* ── Auto-generate key findings ───────────────────────────── */

function buildFindings(pacs: PacSpreadEntry[]) {
  const findings: string[] = [];

  const broadReach = pacs.filter((p) => p.num_recipients >= 20);
  if (broadReach.length > 0) {
    findings.push(
      `${broadReach.length} PACs each fund 20 or more committee members, giving them outsized influence across both chambers.`
    );
  }

  const sectorTotals = new Map<string, number>();
  for (const p of pacs) {
    if (!p.sector) continue;
    sectorTotals.set(
      p.sector,
      (sectorTotals.get(p.sector) || 0) + p.total_given
    );
  }
  const topSectors = Array.from(sectorTotals.entries())
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topSectors.length >= 3) {
    const totalClassified = Array.from(sectorTotals.values())
      .filter((v) => v > 0)
      .reduce((a, b) => a + b, 0);
    const topThreeTotal = topSectors.reduce((sum, [, t]) => sum + t, 0);
    const pct =
      totalClassified > 0
        ? Math.round((topThreeTotal / totalClassified) * 100)
        : 0;
    findings.push(
      `The top 3 sectors\u2014${topSectors.map(([s]) => s).join(", ")}\u2014account for ${pct}% of all classified PAC dollars.`
    );
  }

  const bipartisan = pacs.filter((p) => {
    const total = p.r_total + p.d_total;
    if (total <= 0 || p.num_recipients < 10) return false;
    const rPct = p.r_total / total;
    return rPct >= 0.3 && rPct <= 0.7;
  });
  if (bipartisan.length > 5) {
    findings.push(
      `${bipartisan.length} PACs with 10+ recipients split their giving roughly evenly between parties, hedging their bets on tax policy outcomes.`
    );
  }

  return findings;
}

/* ── Build sector spotlights ──────────────────────────────── */

interface SectorSpotlight {
  sector: string;
  color: string;
  total: number;
  pacCount: number;
  avgReach: number;
  agenda: string;
  topPacs: { name: string; recipients: number; total: number }[];
}

function buildSectorSpotlights(
  pacs: PacSpreadEntry[],
  sectorColors: Record<string, string>
): SectorSpotlight[] {
  const map = new Map<
    string,
    {
      total: number;
      count: number;
      totalReach: number;
      pacs: { name: string; recipients: number; total: number }[];
    }
  >();

  for (const p of pacs) {
    if (!p.sector) continue;
    const entry = map.get(p.sector) || {
      total: 0,
      count: 0,
      totalReach: 0,
      pacs: [],
    };
    entry.total += p.total_given;
    entry.count += 1;
    entry.totalReach += p.num_recipients;
    entry.pacs.push({
      name: p.connected_org || p.pac_name,
      recipients: p.num_recipients,
      total: p.total_given,
    });
    map.set(p.sector, entry);
  }

  return Array.from(map.entries())
    .filter(([, d]) => d.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([sector, data]) => ({
      sector,
      color: sectorColors[sector] || "#9CA3AF",
      total: data.total,
      pacCount: data.count,
      avgReach: Math.round(data.totalReach / data.count),
      agenda: SECTOR_AGENDAS[sector] || "",
      topPacs: data.pacs
        .sort((a, b) => b.recipients - a.recipients)
        .slice(0, 3),
    }));
}

/* ── Build top PAC recipients (member view) ───────────────── */

interface MemberPacRecipient {
  name: string;
  slug: string;
  party: string;
  state: string;
  chamber: string;
  pacDollars: number;
  pacCount: number;
}

function buildTopRecipients(
  pacs: PacSpreadEntry[]
): MemberPacRecipient[] {
  // Parse out individual member contributions from PAC spread data
  const memberTotals = new Map<
    string,
    { total: number; pacIds: Set<string> }
  >();

  for (const p of pacs) {
    if (!p.recipients) continue;
    const perMember = p.total_given / Math.max(p.num_recipients, 1);
    for (const name of p.recipients.split(",").map((r) => r.trim())) {
      if (!name) continue;
      const entry = memberTotals.get(name) || {
        total: 0,
        pacIds: new Set<string>(),
      };
      entry.total += perMember;
      entry.pacIds.add(p.pac_cmte_id);
      memberTotals.set(name, entry);
    }
  }

  return Array.from(memberTotals.entries())
    .sort((a, b) => b[1].pacIds.size - a[1].pacIds.size)
    .slice(0, 10)
    .map(([name, data]) => ({
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      party: "",
      state: "",
      chamber: "",
      pacDollars: data.total,
      pacCount: data.pacIds.size,
    }));
}

/* ── Page component ───────────────────────────────────────── */

export default function PacsPage() {
  const pacs: PacSpreadEntry[] = getPacSpread();
  const sectorColors = getSectorColors();
  const news = getNews();
  const members = getMembers();
  const benchmarks = getBenchmarks();
  const beforeAfter = getBeforeAfter();

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
  const sectorSpotlights = buildSectorSpotlights(pacs, sectorColors);

  // Count PACs funding 30+ members
  const ultraBroadPacs = pacs.filter((p) => p.num_recipients >= 30).length;

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

  const topPacs = sorted.slice(0, 200);
  const mostConnectedName =
    mostConnected.connected_org ||
    mostConnected.pac_name.split(" PAC")[0].split(" POLITICAL")[0];

  return (
    <div className="max-w-7xl">
      <header className="mb-8">
        <h1
          className="text-3xl sm:text-5xl text-[#111111] mb-2 uppercase tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PAC Influence
        </h1>
        <p className="text-sm text-stone-600 max-w-4xl leading-relaxed">
          Political Action Committees funnel industry money directly to
          tax-writing committee members. This analysis shows which PACs have
          the broadest reach, which industries spend the most, and how they
          split their contributions across party lines.
        </p>
      </header>

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
          value={
            mostConnectedName.length > 22
              ? mostConnectedName.slice(0, 22) + "…"
              : mostConnectedName
          }
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

      {/* ── Committee vs. Congress PAC Benchmark ─────────── */}
      {benchmarks && (
        <section className="mb-10">
          <h2
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Do Tax-Writers Get More PAC Money?
          </h2>
          <p className="text-xs text-stone-500 mb-5 max-w-4xl leading-relaxed">
            Comparing median PAC contributions received by Ways &amp; Means and
            Finance Committee members vs. all other House and Senate incumbents.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* House comparison */}
            <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
              <p
                className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                House of Representatives
              </p>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-[#111111]">
                      Ways &amp; Means Members
                    </span>
                    <span className="text-sm font-bold text-[#FE4F40]">
                      {formatMoney(benchmarks.house.committee.median_pac)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#FE4F40]"
                      style={{
                        width: `${Math.min(100, (benchmarks.house.committee.median_pac / benchmarks.house.committee.median_pac) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs text-stone-500">
                      All Other House Incumbents
                    </span>
                    <span className="text-sm font-medium text-stone-500">
                      {formatMoney(benchmarks.house.all_incumbents.median_pac)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-stone-300"
                      style={{
                        width: `${Math.min(100, (benchmarks.house.all_incumbents.median_pac / benchmarks.house.committee.median_pac) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#FE4F40] font-semibold mt-3">
                +{Math.round(((benchmarks.house.committee.median_pac / benchmarks.house.all_incumbents.median_pac) - 1) * 100)}% more PAC money
              </p>
              <p className="text-[10px] text-stone-400 mt-1">
                Based on {benchmarks.house.committee.count} W&amp;M members vs.{" "}
                {benchmarks.house.all_incumbents.count} House incumbents
              </p>
            </div>

            {/* Senate comparison */}
            <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
              <p
                className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Total Fundraising
              </p>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-[#111111]">
                      Ways &amp; Means Members
                    </span>
                    <span className="text-sm font-bold text-[#4C6971]">
                      {formatMoney(benchmarks.house.committee.median_receipts)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#4C6971]"
                      style={{
                        width: `${Math.min(100, (benchmarks.house.committee.median_receipts / benchmarks.house.committee.median_receipts) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs text-stone-500">
                      All Other House Incumbents
                    </span>
                    <span className="text-sm font-medium text-stone-500">
                      {formatMoney(benchmarks.house.all_incumbents.median_receipts)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-stone-300"
                      style={{
                        width: `${Math.min(100, (benchmarks.house.all_incumbents.median_receipts / benchmarks.house.committee.median_receipts) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#4C6971] font-semibold mt-3">
                +{Math.round(((benchmarks.house.committee.median_receipts / benchmarks.house.all_incumbents.median_receipts) - 1) * 100)}% more total fundraising
              </p>
              <p className="text-[10px] text-stone-400 mt-1">
                Median total receipts, 2024 cycle. Source: FEC bulk data.
              </p>
            </div>
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
              className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              The Committee Seat Premium
            </h2>
            <p className="text-xs text-stone-500 mb-5 max-w-4xl leading-relaxed">
              Do PAC contributions increase after a member joins the tax-writing
              committee? We compared each member&apos;s median PAC receipts in
              election cycles <em>before</em> their appointment vs.{" "}
              <em>after</em>.
            </p>

            {/* Headline stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 text-center">
                <p className="text-3xl font-bold text-[#FE4F40]" style={{ fontFamily: "var(--font-display)" }}>
                  {headline.median_pct_change != null
                    ? `${headline.median_pct_change > 0 ? "+" : ""}${headline.median_pct_change.toFixed(0)}%`
                    : "N/A"}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Median change in PAC receipts
                </p>
              </div>
              <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 text-center">
                <p className="text-3xl font-bold text-[#111111]" style={{ fontFamily: "var(--font-display)" }}>
                  {headline.increased_count}/{headline.valid_members}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Members saw PAC money increase
                </p>
              </div>
              <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 text-center">
                <p className="text-3xl font-bold text-[#4C6971]" style={{ fontFamily: "var(--font-display)" }}>
                  {headline.mean_pct_change != null
                    ? `${headline.mean_pct_change > 0 ? "+" : ""}${headline.mean_pct_change.toFixed(0)}%`
                    : "N/A"}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Mean change in PAC receipts
                </p>
              </div>
            </div>

            {/* Before/after table — top gainers */}
            {topGainers.length > 0 && (
              <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
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

            <p className="text-[10px] text-stone-400 mt-2 max-w-4xl leading-relaxed">
              Based on {headline.valid_members} members with at least one election
              cycle before and after their committee appointment. Median PAC
              receipts compared across cycles 2014&ndash;2024. The cycle of appointment
              is excluded from both groups. Members appointed before 2014 are
              excluded due to insufficient pre-appointment data.
            </p>
          </section>
        );
      })()}

      {/* Charts */}
      <PacCharts pacs={topPacs} sectorColors={sectorColors} />

      {/* ── Sector Spotlights ─────────────────────────────── */}
      {sectorSpotlights.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            What Each Industry Wants
          </h2>
          <p className="text-xs text-stone-500 mb-5 max-w-4xl leading-relaxed">
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
                {/* Sector header */}
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

                {/* Stats row */}
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

                {/* Policy agenda */}
                {s.agenda && (
                  <p className="text-xs text-stone-600 leading-relaxed mb-3 border-l-2 pl-3" style={{ borderColor: s.color }}>
                    {s.agenda}
                  </p>
                )}

                {/* Top PACs */}
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
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Who Receives the Most PAC Attention?
          </h2>
          <p className="text-xs text-stone-500 mb-5 max-w-4xl leading-relaxed">
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
          <p className="text-[10px] text-stone-400 mt-2">
            &ldquo;Distinct PACs&rdquo; counts unique PACs (from the top 200 by
            reach) that contribute to each member. Est. PAC $ is an
            approximation based on equal per-member distribution of each
            PAC&apos;s total giving.
          </p>
        </section>
      )}

      {/* In the News */}
      {news.length > 0 && (
        <div className="mt-12">
          <NewsCards articles={news} sectorColors={sectorColors} />
        </div>
      )}

      {/* Spacer */}
      <div className="my-10 border-t border-[#C8C1B6]/30" />

      {/* Interactive Table */}
      <PacsTable pacs={topPacs} sectorColors={sectorColors} />

      <p className="text-xs text-stone-400 mt-4">
        Showing top {topPacs.length} PACs (those funding 2+ committee
        members), sorted by number of recipients. Data from FEC bulk files,
        2024 cycle.
      </p>
    </div>
  );
}
