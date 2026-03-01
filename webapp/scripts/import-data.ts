#!/usr/bin/env npx tsx
/**
 * import-data.ts — Converts pipeline output CSVs to static JSON for the web app.
 *
 * Usage:  npm run import-data
 *         npx tsx scripts/import-data.ts
 *
 * Reads from: ../output/*.csv  (pipeline outputs)
 * Writes to:  data/*.json      (web app static data)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const PIPELINE_OUTPUT = resolve(ROOT, "..", "output");
const CONFIG_DIR = resolve(ROOT, "..", "config");
const DATA_DIR = join(ROOT, "data");
const CYCLE = 2024;

// Load PAC sector classifications
interface PacSectorConfig {
  sectors: string[];
  sector_colors: Record<string, string>;
  pacs: Record<string, { sector: string; agenda: string }>;
  keyword_fallbacks: Record<string, string[]>;
}

function loadPacSectors(): PacSectorConfig | null {
  const path = join(CONFIG_DIR, "pac_sectors.json");
  if (!existsSync(path)) {
    console.warn("  SKIP: pac_sectors.json not found");
    return null;
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function classifyPacSector(
  cmteId: string,
  pacName: string,
  connectedOrg: string,
  config: PacSectorConfig | null
): { sector: string; agenda: string } {
  if (!config) return { sector: "", agenda: "" };

  // Check explicit mapping first
  const explicit = config.pacs[cmteId];
  if (explicit) return explicit;

  // Fall back to keyword matching on PAC name and connected org
  const searchText = `${pacName} ${connectedOrg}`.toUpperCase();
  for (const [sector, keywords] of Object.entries(config.keyword_fallbacks)) {
    for (const kw of keywords) {
      if (searchText.includes(kw)) {
        return { sector, agenda: "" };
      }
    }
  }

  return { sector: "", agenda: "" };
}

function readCSV(filename: string): Record<string, string>[] | null {
  const path = join(PIPELINE_OUTPUT, filename);
  if (!existsSync(path)) {
    console.warn(`  SKIP: ${filename} not found`);
    return null;
  }
  const raw = readFileSync(path, "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true });
}

function toNumber(val: string | undefined | null): number | null {
  if (val == null || val === "" || val === "nan" || val === "NaN") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toBool(val: string | undefined | null): boolean {
  if (val == null) return false;
  return val === "True" || val === "true" || val === "1";
}

function memberSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function importMembers() {
  const rows = readCSV(`member_summary_${CYCLE}.csv`);
  if (!rows) return [];

  return rows.map((r) => ({
    member_name: r.member_name,
    party: r.party,
    state: r.state,
    district: toNumber(r.district),
    chamber: r.chamber,
    committee: r.committee,
    role: r.role || "Member",
    is_territorial: toBool(r.is_territorial),
    slug: memberSlug(r.member_name),
    total_itemized_amount: toNumber(r.total_itemized_amount) ?? 0,
    total_contribution_count: toNumber(r.total_contribution_count) ?? 0,
    avg_contribution: toNumber(r.avg_contribution) ?? 0,
    unique_donors_approx: toNumber(r.unique_donors_approx) ?? 0,
    pct_outside: toNumber(r.pct_outside) ?? 0,
    pct_in_home: toNumber(r.pct_in_home) ?? 0,
    pct_in_district: toNumber(r.pct_in_district) ?? 0,
    pct_in_state: toNumber(r.pct_in_state) ?? 0,
    pct_in_state_out_district: toNumber(r.pct_in_state_out_district) ?? 0,
    pct_dc_kstreet: toNumber(r.pct_dc_kstreet) ?? 0,
    pct_out_of_state: toNumber(r.pct_out_of_state) ?? 0,
    pct_unknown: toNumber(r.pct_unknown) ?? 0,
    amt_in_district: toNumber(r.amt_in_district) ?? 0,
    amt_in_state: toNumber(r.amt_in_state) ?? 0,
    amt_in_state_out_district: toNumber(r.amt_in_state_out_district) ?? 0,
    amt_dc_kstreet: toNumber(r.amt_dc_kstreet) ?? 0,
    amt_out_of_state: toNumber(r.amt_out_of_state) ?? 0,
    amt_unknown: toNumber(r.amt_unknown) ?? 0,
    top_outside_employer_1: r.top_outside_employer_1 || "",
    top_outside_employer_2: r.top_outside_employer_2 || "",
    top_outside_employer_3: r.top_outside_employer_3 || "",
    top_outside_state_1: r.top_outside_state_1 || "",
    top_outside_state_2: r.top_outside_state_2 || "",
    top_outside_state_3: r.top_outside_state_3 || "",
    unitemized_pct: toNumber(r.unitemized_pct),
    capture_rate_pct: toNumber(r.capture_rate_pct),
    fec_total_receipts: toNumber(r.fec_total_receipts),
    fec_pac_contributions: toNumber(r.fec_pac_contributions),
    jfc_flag: toBool(r.jfc_flag),
    one_liner: "",
  }));
}

function importEmployers() {
  const rows = readCSV(`employer_top50_by_member_${CYCLE}.csv`);
  if (!rows) return [];

  return rows.map((r) => ({
    member_name: r.member_name,
    rank: toNumber(r.rank) ?? 0,
    employer: r.employer,
    total: toNumber(r.total) ?? 0,
    count: toNumber(r.count) ?? 0,
  }));
}

function importPacs(sectorConfig: PacSectorConfig | null) {
  const rows = readCSV(`pac_breakdown_by_member_${CYCLE}.csv`);
  if (!rows) return [];

  return rows.map((r) => {
    const { sector, agenda } = classifyPacSector(
      r.pac_cmte_id, r.pac_name, r.connected_org || "", sectorConfig
    );
    return {
      member_name: r.member_name,
      rank: toNumber(r.rank) ?? 0,
      pac_cmte_id: r.pac_cmte_id,
      pac_name: r.pac_name,
      connected_org: r.connected_org || "",
      sector,
      agenda,
      total: toNumber(r.total) ?? 0,
      count: toNumber(r.count) ?? 0,
    };
  });
}

function importPacSpread(sectorConfig: PacSectorConfig | null) {
  const rows = readCSV(`top_pacs_by_committee_${CYCLE}.csv`);
  if (!rows) return [];

  return rows.map((r) => {
    const { sector, agenda } = classifyPacSector(
      r.pac_cmte_id, r.pac_name, r.connected_org || "", sectorConfig
    );
    return {
      pac_cmte_id: r.pac_cmte_id,
      pac_name: r.pac_name,
      connected_org: r.connected_org || "",
      cmte_type: r.cmte_type || "",
      cmte_designation: r.cmte_designation || "",
      sector,
      agenda,
      total_given: toNumber(r.total_given) ?? 0,
      num_recipients: toNumber(r.num_recipients) ?? 0,
      recipients: r.recipients || "",
      r_total: toNumber(r.r_total) ?? 0,
      d_total: toNumber(r.d_total) ?? 0,
    };
  });
}

function importCommitteeAgg() {
  const rows = readCSV(`committee_aggregate_${CYCLE}.csv`);
  if (!rows) return [];

  return rows.map((r) => ({
    group: r.group,
    member_count: toNumber(r.member_count) ?? 0,
    mean_pct_outside: toNumber(r.mean_pct_outside) ?? 0,
    median_pct_outside: toNumber(r.median_pct_outside) ?? 0,
    mean_pct_dc: toNumber(r.mean_pct_dc) ?? 0,
    median_pct_dc: toNumber(r.median_pct_dc) ?? 0,
    total_contributions: toNumber(r.total_contributions) ?? 0,
    avg_contributions_per_member: toNumber(r.avg_contributions_per_member) ?? 0,
    highest_outside_member: r.highest_outside_member || "",
    highest_outside_pct: toNumber(r.highest_outside_pct) ?? 0,
    lowest_outside_member: r.lowest_outside_member || "",
    lowest_outside_pct: toNumber(r.lowest_outside_pct) ?? 0,
    mean_unitemized_pct: toNumber(r.mean_unitemized_pct),
  }));
}

function importDcBreakdown() {
  const rows = readCSV(`dc_kstreet_breakdown_${CYCLE}.csv`);
  if (!rows) return [];

  return rows.map((r) => ({
    member_name: r.member_name,
    party: r.party,
    state: r.state,
    district: toNumber(r.district),
    chamber: r.chamber,
    pct_dc_kstreet: toNumber(r.pct_dc_kstreet) ?? 0,
    amt_dc_kstreet: toNumber(r.amt_dc_kstreet) ?? 0,
    total_itemized_amount: toNumber(r.total_itemized_amount) ?? 0,
  }));
}

function importOneLiners() {
  const rows = readCSV("one_liners.csv");
  if (!rows) return [];

  return rows.map((r) => ({
    member_name: r.member_name,
    one_liner: r.one_liner || "",
  }));
}

function importBeforeAfter() {
  const rows = readCSV("before_after_summary.csv");
  if (!rows) return null;

  const members = rows.map((r) => ({
    name: r.name,
    fec_candidate_id: r.fec_candidate_id,
    party: r.party || "",
    chamber: r.chamber || "",
    committee: r.committee || "",
    first_year: toNumber(r.first_year),
    cycles_before: toNumber(r.cycles_before) ?? 0,
    cycles_after: toNumber(r.cycles_after) ?? 0,
    median_pac_before: toNumber(r.median_pac_before),
    median_pac_after: toNumber(r.median_pac_after),
    pct_change_pac: toNumber(r.pct_change_pac),
    median_total_before: toNumber(r.median_total_before),
    median_total_after: toNumber(r.median_total_after),
    pct_change_total: toNumber(r.pct_change_total),
    flag: r.flag || "",
  }));

  // Compute aggregates
  const valid = members.filter(
    (m) => m.flag === "" && m.pct_change_pac != null
  );
  const increased = valid.filter((m) => (m.pct_change_pac ?? 0) > 0).length;
  const changes = valid
    .map((m) => m.pct_change_pac!)
    .sort((a, b) => a - b);
  const medianChange =
    changes.length > 0
      ? changes[Math.floor(changes.length / 2)]
      : null;
  const meanChange =
    changes.length > 0
      ? changes.reduce((a, b) => a + b, 0) / changes.length
      : null;

  return {
    headline: {
      valid_members: valid.length,
      increased_count: increased,
      median_pct_change: medianChange,
      mean_pct_change: meanChange,
    },
    members,
  };
}

function importIndustryInfluence() {
  const sectorRows = readCSV("industry_individual_totals.csv");
  const employerRows = readCSV("industry_top_employers.csv");
  if (!sectorRows) return null;

  const sectorTotals = sectorRows.map((r) => ({
    sector: r.sector,
    individual_total: toNumber(r.individual_total) ?? 0,
    individual_count: toNumber(r.individual_count) ?? 0,
    individual_donors: toNumber(r.individual_donors) ?? 0,
    pac_total: toNumber(r.pac_total) ?? 0,
    combined_total: toNumber(r.combined_total) ?? 0,
    individual_share_pct: toNumber(r.individual_share_pct) ?? 0,
  }));

  // Group top employers by sector
  const topEmployersBySector: Record<
    string,
    { employer: string; total: number; count: number; members_funded: number }[]
  > = {};
  if (employerRows) {
    for (const r of employerRows) {
      const sector = r.sector;
      if (!topEmployersBySector[sector]) topEmployersBySector[sector] = [];
      topEmployersBySector[sector].push({
        employer: r.employer,
        total: toNumber(r.total) ?? 0,
        count: toNumber(r.count) ?? 0,
        members_funded: toNumber(r.distinct_members_funded) ?? 0,
      });
    }
  }

  // Classification coverage
  const classifiedTotal = sectorTotals.reduce((s, r) => s + r.individual_total, 0);
  const pacTotal = sectorTotals.reduce((s, r) => s + r.pac_total, 0);

  return {
    sector_totals: sectorTotals,
    top_employers_by_sector: topEmployersBySector,
    summary: {
      classified_individual_total: classifiedTotal,
      pac_total: pacTotal,
      combined_total: classifiedTotal + pacTotal,
      individual_to_pac_ratio:
        pacTotal > 0 ? Math.round((classifiedTotal / pacTotal) * 10) / 10 : 0,
    },
  };
}

function buildTopFunderAgendas(
  members: { member_name: string; top_funder_agendas?: string }[],
  pacs: { member_name: string; total: number; agenda: string }[]
): void {
  const pacsByMember = new Map<string, { total: number; agenda: string }[]>();
  for (const p of pacs) {
    if (!pacsByMember.has(p.member_name)) pacsByMember.set(p.member_name, []);
    pacsByMember.get(p.member_name)!.push(p);
  }

  for (const m of members) {
    const memberPacs = pacsByMember.get(m.member_name) || [];
    const topWithAgenda = memberPacs
      .filter((p) => p.agenda)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    if (topWithAgenda.length === 0) {
      m.top_funder_agendas = "";
      continue;
    }

    const goals = topWithAgenda.flatMap((p) => {
      const stripped = p.agenda
        .replace(/^(Lobbies for|Seeks|Advocates for|Supports|Pushes for|Opposes)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();
      return stripped.split(/(?:,?\s+and\s+|;\s+)/).map((g) => g.trim());
    });

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const g of goals) {
      const key = g.toLowerCase();
      if (!seen.has(key) && g.length > 0) {
        seen.add(key);
        unique.push(g);
      }
    }

    let result = unique.join(", ");
    const words = result.split(/\s+/);
    if (words.length > 15) {
      result = words.slice(0, 15).join(" ");
      result = result.replace(/,?\s*$/, "");
    }

    m.top_funder_agendas = result;
  }
}

function importContributionTiming(): {
  weekly_pac_totals: Record<string, unknown>[];
  events: { date: string; label: string; bill: string; event_type: string; significance: string }[];
  event_analysis: Record<string, unknown>[];
} | null {
  const pacWeeklyPath = join(PIPELINE_OUTPUT, "pac_weekly_totals.csv");
  const eventAnalysisPath = join(PIPELINE_OUTPUT, "event_timing_analysis.csv");
  const eventsConfigPath = join(CONFIG_DIR, "legislative_events.json");

  if (!existsSync(pacWeeklyPath) || !existsSync(eventAnalysisPath) || !existsSync(eventsConfigPath)) {
    console.log("  Skipping contribution timing (source files not found)");
    return null;
  }

  // 1. Read and pivot PAC weekly totals
  const pacWeeklyRaw = readCSV("pac_weekly_totals.csv");
  if (!pacWeeklyRaw) return null;

  const weekMap = new Map<string, Record<string, unknown>>();
  for (const row of pacWeeklyRaw) {
    const week = row.week_start;
    if (!weekMap.has(week)) {
      weekMap.set(week, { week, total: 0 });
    }
    const entry = weekMap.get(week)!;
    const amt = toNumber(row.total_amount) ?? 0;
    entry[row.sector] = amt;
    entry.total = (entry.total as number) + amt;
  }
  const weeklyPacTotals = Array.from(weekMap.values()).sort((a, b) =>
    (a.week as string).localeCompare(b.week as string)
  );

  // 2. Load legislative events for chart markers
  const eventsRaw = JSON.parse(readFileSync(eventsConfigPath, "utf-8")) as Array<{
    bill: string;
    bill_title: string;
    event_type: string;
    date: string;
    significance: string;
  }>;
  const events = eventsRaw.map((e) => ({
    date: e.date,
    label: `${e.bill} ${e.event_type.replace(/_/g, " ")}`,
    bill: e.bill,
    event_type: e.event_type,
    significance: e.significance,
  }));

  // 3. Read event analysis
  const eventAnalysisRaw = readCSV("event_timing_analysis.csv");
  if (!eventAnalysisRaw) return null;

  const eventAnalysis = eventAnalysisRaw.map((row) => ({
    bill: row.bill,
    event_type: row.event_type,
    date: row.date,
    sector: row.sector,
    baseline_weekly_avg: toNumber(row.baseline_weekly_avg) ?? 0,
    pre_event_total: toNumber(row.pre_event_total) ?? 0,
    event_week_total: toNumber(row.event_week_total) ?? 0,
    post_event_total: toNumber(row.post_event_total) ?? 0,
    spike_ratio: row.spike_ratio === "" || row.spike_ratio === "None" ? null : toNumber(row.spike_ratio),
    sector_specific: toBool(row.sector_specific),
    significance: row.significance,
  }));

  return { weekly_pac_totals: weeklyPacTotals, events, event_analysis: eventAnalysis };
}

// --- Main ---

console.log("Importing pipeline data...");
console.log(`  Source: ${PIPELINE_OUTPUT}`);
console.log(`  Target: ${DATA_DIR}`);
console.log(`  Cycle:  ${CYCLE}`);
console.log();

mkdirSync(DATA_DIR, { recursive: true });

const pacSectorConfig = loadPacSectors();
if (pacSectorConfig) {
  console.log(`  Loaded PAC sector config: ${Object.keys(pacSectorConfig.pacs).length} explicit mappings`);
}

const members = importMembers();
const oneLiners = importOneLiners();

// Merge one-liners into members
if (oneLiners.length > 0) {
  const linerMap = new Map(oneLiners.map((o) => [o.member_name, o.one_liner]));
  for (const m of members) {
    m.one_liner = linerMap.get(m.member_name) || "";
  }
}

// Build top funder agendas from PAC data
const pacs = importPacs(pacSectorConfig);
buildTopFunderAgendas(members, pacs);

// Write sector colors for the webapp
if (pacSectorConfig) {
  writeFileSync(
    join(DATA_DIR, "sector_colors.json"),
    JSON.stringify(pacSectorConfig.sector_colors, null, 2)
  );
  console.log(`  sector_colors.json: ${Object.keys(pacSectorConfig.sector_colors).length} sectors`);
}

// Copy pac_news.json from config
const newsPath = join(CONFIG_DIR, "pac_news.json");
if (existsSync(newsPath)) {
  const newsData = JSON.parse(readFileSync(newsPath, "utf-8"));
  writeFileSync(join(DATA_DIR, "pac_news.json"), JSON.stringify(newsData, null, 2));
  console.log(`  pac_news.json: ${newsData.length} articles`);
}

// Import before/after analysis
const beforeAfter = importBeforeAfter();
if (beforeAfter) {
  writeFileSync(
    join(DATA_DIR, "before_after.json"),
    JSON.stringify(beforeAfter, null, 2)
  );
  console.log(`  before_after.json: ${beforeAfter.members.length} members, headline: ${beforeAfter.headline.median_pct_change?.toFixed(1)}% median change`);
}

// Import contribution timing
const timing = importContributionTiming();
if (timing) {
  writeFileSync(
    join(DATA_DIR, "contribution_timing.json"),
    JSON.stringify(timing, null, 2)
  );
  console.log(`  contribution_timing.json: ${timing.weekly_pac_totals.length} weeks, ${timing.events.length} events, ${timing.event_analysis.length} analysis rows`);
}

// Import industry influence data
const industryInfluence = importIndustryInfluence();
if (industryInfluence) {
  writeFileSync(
    join(DATA_DIR, "industry_influence.json"),
    JSON.stringify(industryInfluence, null, 2)
  );
  console.log(`  industry_influence.json: ${industryInfluence.sector_totals.length} sectors, ratio: ${industryInfluence.summary.individual_to_pac_ratio}×`);
}

// Note: leadership_analysis.json is generated directly by scripts/12_leadership_analysis.py
// (writes to webapp/data/ just like benchmarks.json is generated outside this import flow)
if (existsSync(join(DATA_DIR, "leadership_analysis.json"))) {
  console.log("  leadership_analysis.json: present (generated by scripts/12_leadership_analysis.py)");
}

const datasets: [string, unknown][] = [
  ["members.json", members],
  ["employers.json", importEmployers()],
  ["pacs.json", pacs],
  ["pac_spread.json", importPacSpread(pacSectorConfig)],
  ["committee_agg.json", importCommitteeAgg()],
  ["dc_breakdown.json", importDcBreakdown()],
  ["one_liners.json", oneLiners],
];

let totalRecords = 0;
for (const [filename, data] of datasets) {
  const arr = data as unknown[];
  const path = join(DATA_DIR, filename);
  writeFileSync(path, JSON.stringify(arr, null, 2));
  console.log(`  ${filename}: ${arr.length} records`);
  totalRecords += arr.length;
}

console.log(`\nDone. ${totalRecords} total records across ${datasets.length} files.`);

if (members.length === 0) {
  console.warn(
    "\nWARNING: No member data found. Run the pipeline first:\n" +
      "  cd .. && python scripts/run_all.py\n" +
      "Then re-run: npm run import-data"
  );
}
