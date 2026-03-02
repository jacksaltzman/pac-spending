import { PacSpreadEntry, type EventAnalysisEntry } from "@/lib/data";

/* ── Sector agenda narratives ─────────────────────────────── */

export const SECTOR_AGENDAS: Record<string, string> = {
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

export function buildFindings(pacs: PacSpreadEntry[]) {
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

export interface SectorSpotlight {
  sector: string;
  color: string;
  total: number;
  pacCount: number;
  avgReach: number;
  agenda: string;
  topPacs: { name: string; recipients: number; total: number }[];
}

export function buildSectorSpotlights(
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

export interface MemberPacRecipient {
  name: string;
  slug: string;
  party: string;
  state: string;
  chamber: string;
  pacDollars: number;
  pacCount: number;
}

export function buildTopRecipients(
  pacs: PacSpreadEntry[]
): MemberPacRecipient[] {
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

/* ── Timing narrative builder ─────────────────────────────── */

export function buildTimingNarrative(
  analysis: EventAnalysisEntry[]
): string {
  const sectorSpikes = analysis
    .filter((a) => a.sector_specific && a.spike_ratio != null)
    .sort((a, b) => (b.spike_ratio ?? 0) - (a.spike_ratio ?? 0));

  if (sectorSpikes.length === 0) {
    return "PAC contributions to committee members show no statistically meaningful correlation with the legislative calendar. Money flows at a relatively steady rate regardless of when markups or votes occur.";
  }

  // Prefer entries with a real bill name (not "N/A" or empty)
  const hasBill = (e: EventAnalysisEntry) =>
    e.bill && e.bill !== "N/A" && e.bill.trim() !== "";

  const topNamed = sectorSpikes.find(hasBill);
  const top = topNamed ?? sectorSpikes[0];
  const eventLabel = top.event_type.replace(/_/g, " ");
  const billRef = hasBill(top)
    ? top.bill
    : `a ${eventLabel}`;

  if ((top.spike_ratio ?? 0) >= 1.5) {
    return `PAC contributions don\u2019t arrive at random. They cluster around the moments that matter most. Around ${billRef}, affected-sector PAC contributions spiked to ${top.spike_ratio}\u00d7 their weekly baseline \u2014 suggesting strategically timed giving, not routine relationship maintenance.`;
  }

  return `PAC contribution patterns show modest fluctuations around legislative events. The highest spike observed was ${top.spike_ratio}\u00d7 baseline during the ${billRef} ${eventLabel}, a moderate increase that may reflect seasonal patterns rather than targeted timing.`;
}
