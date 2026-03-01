import { readFileSync, existsSync } from "fs";
import { join } from "path";

// --- Types ---

export interface Member {
  member_name: string;
  party: string;
  state: string;
  district: number | null;
  chamber: string;
  committee: string;
  role: string;
  is_territorial: boolean;
  slug: string;
  total_itemized_amount: number;
  total_contribution_count: number;
  avg_contribution: number;
  unique_donors_approx: number;
  pct_outside: number;
  pct_in_home: number;
  pct_in_district: number;
  pct_in_state: number;
  pct_in_state_out_district: number;
  pct_dc_kstreet: number;
  pct_out_of_state: number;
  pct_unknown: number;
  amt_in_district: number;
  amt_in_state: number;
  amt_in_state_out_district: number;
  amt_dc_kstreet: number;
  amt_out_of_state: number;
  amt_unknown: number;
  top_outside_employer_1: string;
  top_outside_employer_2: string;
  top_outside_employer_3: string;
  top_outside_state_1: string;
  top_outside_state_2: string;
  top_outside_state_3: string;
  unitemized_pct: number | null;
  capture_rate_pct: number | null;
  fec_total_receipts: number | null;
  fec_pac_contributions: number | null;
  jfc_flag: boolean;
  one_liner: string;
  top_funder_agendas: string;
  alignment_pct?: number | null;
  alignment_votes_total?: number;
  top_funding_sector?: string;
}

export interface EmployerEntry {
  member_name: string;
  rank: number;
  employer: string;
  total: number;
  count: number;
}

export interface PacEntry {
  member_name: string;
  rank: number;
  pac_cmte_id: string;
  pac_name: string;
  connected_org: string;
  sector: string;
  agenda: string;
  total: number;
  count: number;
}

export interface PacSpreadEntry {
  pac_cmte_id: string;
  pac_name: string;
  connected_org: string;
  cmte_type: string;
  cmte_designation: string;
  sector: string;
  agenda: string;
  total_given: number;
  num_recipients: number;
  recipients: string;
  r_total: number;
  d_total: number;
}

export function getSectorColors(): Record<string, string> {
  try {
    const raw = readFileSync(join(DATA_DIR, "sector_colors.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export interface CommitteeAggregate {
  group: string;
  member_count: number;
  mean_pct_outside: number;
  median_pct_outside: number;
  mean_pct_dc: number;
  median_pct_dc: number;
  total_contributions: number;
  avg_contributions_per_member: number;
  highest_outside_member: string;
  highest_outside_pct: number;
  lowest_outside_member: string;
  lowest_outside_pct: number;
  mean_unitemized_pct: number | null;
}

export interface DcBreakdown {
  member_name: string;
  party: string;
  state: string;
  district: number | null;
  chamber: string;
  pct_dc_kstreet: number;
  amt_dc_kstreet: number;
  total_itemized_amount: number;
}

export interface NewsEntry {
  title: string;
  source: string;
  url: string;
  date: string;
  sector: string;
  excerpt: string;
}

export interface Benchmarks {
  house: {
    all_incumbents: { count: number; median_receipts: number; mean_receipts: number; median_pac: number; mean_pac: number };
    committee: { name: string; count: number; median_receipts: number; mean_receipts: number; median_pac: number; mean_pac: number };
  };
  senate: {
    all_incumbents: { count: number; median_receipts: number; mean_receipts: number; median_pac: number; mean_pac: number };
    committee: { name: string; count: number; median_pac: number; mean_pac: number };
  };
  cycle: number;
  source: string;
}

export interface OneLiner {
  member_name: string;
  one_liner: string;
}

export interface BeforeAfterMember {
  name: string;
  fec_candidate_id: string;
  party: string;
  chamber: string;
  committee: string;
  first_year: number | null;
  cycles_before: number;
  cycles_after: number;
  median_pac_before: number | null;
  median_pac_after: number | null;
  pct_change_pac: number | null;
  median_total_before: number | null;
  median_total_after: number | null;
  pct_change_total: number | null;
  flag: string;
}

export interface BeforeAfterData {
  headline: {
    valid_members: number;
    increased_count: number;
    median_pct_change: number | null;
    mean_pct_change: number | null;
  };
  members: BeforeAfterMember[];
}

export interface WeeklyPacTotal {
  week: string;
  total: number;
  [sector: string]: number | string;
}

export interface TimingEvent {
  date: string;
  label: string;
  bill: string;
  bill_title: string;
  event_type: string;
  significance: string;
  description: string;
  committee: string;
  chamber: string;
  sectors_affected: string[];
  editorial_summary: string;
  industry_interest: string;
  congress_url: string | null;
  outcome: string | null;
}

export interface EventAnalysisEntry {
  bill: string;
  bill_title: string;
  event_type: string;
  date: string;
  sector: string;
  baseline_weekly_avg: number;
  pre_event_total: number;
  event_week_total: number;
  post_event_total: number;
  spike_ratio: number | null;
  sector_specific: boolean;
  significance: string;
  sectors_affected: string[];
  editorial_summary: string;
  industry_interest: string;
  congress_url: string | null;
  outcome: string | null;
}

export interface ContributionTiming {
  weekly_pac_totals: WeeklyPacTotal[];
  events: TimingEvent[];
  event_analysis: EventAnalysisEntry[];
}

export interface IndustrySectorTotal {
  sector: string;
  individual_total: number;
  individual_count: number;
  individual_donors: number;
  pac_total: number;
  combined_total: number;
  individual_share_pct: number;
}

export interface IndustryEmployer {
  employer: string;
  total: number;
  count: number;
  members_funded: number;
}

export interface IndustryInfluenceData {
  sector_totals: IndustrySectorTotal[];
  top_employers_by_sector: Record<string, IndustryEmployer[]>;
  summary: {
    classified_individual_total: number;
    pac_total: number;
    combined_total: number;
    individual_to_pac_ratio: number;
  };
}

export interface LeadershipTierRow {
  tier: string;
  count: number;
  median_pac: number;
  mean_pac: number;
  median_receipts: number;
  mean_receipts: number;
  median_pct_outside: number;
  median_pct_dc: number;
  premium_vs_rank_file_pct: number | null;
}

export interface LeadershipSectorAlignment {
  subcommittee: string;
  member: string;
  title: string;
  party: string;
  state: string;
  chamber: string;
  relevant_sectors: string;
  member_sector_pac_pct: number;
  committee_avg_sector_pac_pct: number;
  premium_pct: number;
}

export interface LeadershipMemberRole {
  tier: number;
  title: string;
  subcommittee: string | null;
}

export interface LeadershipAnalysis {
  tier_comparison: {
    house: LeadershipTierRow[];
    senate: LeadershipTierRow[];
    combined: LeadershipTierRow[];
  };
  subcommittee_sector_alignment: LeadershipSectorAlignment[];
  headline: {
    subcommittee_leadership_premium_pct: number | null;
    full_committee_premium_pct: number | null;
    most_targeted_leader: string | null;
    most_targeted_leader_pac: number | null;
    most_sector_aligned_subcommittee: string | null;
    most_sector_aligned_member: string | null;
    most_sector_aligned_premium: number | null;
    avg_pac_leadership_premium_pct: number | null;
  };
  member_leadership_roles: Record<string, LeadershipMemberRole>;
}

export interface AlignmentScore {
  alignment_pct: number | null;
  votes_with: number;
  votes_against: number;
  votes_total: number;
  top_funding_sector: string;
  top_sectors: string[];
  per_sector: Record<string, { with: number; against: number; total: number }>;
}

export interface VoteRecord {
  roll_call_id: string;
  congress: number;
  chamber: string;
  date: string;
  bill: string;
  bill_title: string;
  question: string;
  result: string;
  position: string;
}

export interface SectorPosition {
  position: string;
  reason: string;
}

export interface TaxVoteSectorPositions {
  roll_call_id: string;
  bill: string;
  bill_title: string;
  date: string;
  chamber: string;
  description: string;
  sector_positions: Record<string, SectorPosition>;
}

// --- Data loading via fs (server components only) ---

const DATA_DIR = join(process.cwd(), "data");

function loadJSON<T>(filename: string): T[] {
  try {
    const raw = readFileSync(join(DATA_DIR, filename), "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

// Cache data in module scope so it's only read once per server lifecycle
let _members: Member[] | null = null;
let _employers: EmployerEntry[] | null = null;
let _pacs: PacEntry[] | null = null;
let _pacSpread: PacSpreadEntry[] | null = null;
let _committeeAgg: CommitteeAggregate[] | null = null;
let _dcBreakdown: DcBreakdown[] | null = null;
let _news: NewsEntry[] | null = null;
let _oneLiners: OneLiner[] | null = null;

export function getMembers(): Member[] {
  if (!_members) _members = loadJSON<Member>("members.json");
  return _members;
}

export function getMemberBySlug(slug: string): Member | undefined {
  return getMembers().find((m) => m.slug === slug);
}

export function getEmployersForMember(name: string): EmployerEntry[] {
  if (!_employers) _employers = loadJSON<EmployerEntry>("employers.json");
  return _employers.filter((e) => e.member_name === name);
}

export function getPacsForMember(name: string): PacEntry[] {
  if (!_pacs) _pacs = loadJSON<PacEntry>("pacs.json");
  return _pacs.filter((p) => p.member_name === name);
}

export function getPacSpread(): PacSpreadEntry[] {
  if (!_pacSpread) _pacSpread = loadJSON<PacSpreadEntry>("pac_spread.json");
  return _pacSpread;
}

export function getCommitteeAggregates(): CommitteeAggregate[] {
  if (!_committeeAgg)
    _committeeAgg = loadJSON<CommitteeAggregate>("committee_agg.json");
  return _committeeAgg;
}

export function getDcBreakdown(): DcBreakdown[] {
  if (!_dcBreakdown)
    _dcBreakdown = loadJSON<DcBreakdown>("dc_breakdown.json");
  return _dcBreakdown;
}

export function getBenchmarks(): Benchmarks | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "benchmarks.json"), "utf-8");
    return JSON.parse(raw) as Benchmarks;
  } catch {
    return null;
  }
}

export function getNews(): NewsEntry[] {
  if (!_news) _news = loadJSON<NewsEntry>("pac_news.json");
  return _news;
}

export function getOneLiners(): OneLiner[] {
  if (!_oneLiners) _oneLiners = loadJSON<OneLiner>("one_liners.json");
  return _oneLiners;
}

export function getOneLinerForMember(name: string): string {
  const entry = getOneLiners().find((o) => o.member_name === name);
  return entry?.one_liner ?? "";
}

export function getBeforeAfter(): BeforeAfterData | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "before_after.json"), "utf-8");
    return JSON.parse(raw) as BeforeAfterData;
  } catch {
    return null;
  }
}

export function getContributionTiming(): ContributionTiming | null {
  const filePath = join(DATA_DIR, "contribution_timing.json");
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ContributionTiming;
}

export function getIndustryInfluence(): IndustryInfluenceData | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "industry_influence.json"), "utf-8");
    return JSON.parse(raw) as IndustryInfluenceData;
  } catch {
    return null;
  }
}

export function getLeadershipAnalysis(): LeadershipAnalysis | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "leadership_analysis.json"), "utf-8");
    return JSON.parse(raw) as LeadershipAnalysis;
  } catch {
    return null;
  }
}

export function getAlignmentScores(): Record<string, AlignmentScore> | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "alignment_scores.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAlignmentForMember(name: string): AlignmentScore | null {
  const scores = getAlignmentScores();
  return scores?.[name] ?? null;
}

export function getVotingRecords(): Record<string, VoteRecord[]> | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "voting_records.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getTaxVotesForMember(name: string): VoteRecord[] {
  const records = getVotingRecords();
  return records?.[name] ?? [];
}

export function getSectorPositions(): TaxVoteSectorPositions[] {
  try {
    const raw = readFileSync(join(DATA_DIR, "vote_sector_positions.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getBeforeAfterForMember(name: string): BeforeAfterMember | null {
  const data = getBeforeAfter();
  if (!data) return null;
  return data.members.find((m) => m.name === name) ?? null;
}
