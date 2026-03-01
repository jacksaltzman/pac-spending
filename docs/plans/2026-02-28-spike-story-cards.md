# Legislative Spike Story Cards — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the cryptic spike ratio table on the Timing & Events tab with rich, expandable story cards that explain what each bill does, who had financial interests, and how PAC contributions spiked around legislative action.

**Architecture:** Enrich `legislative_events.json` with hand-written editorial fields (`editorial_summary`, `industry_interest`, `congress_url`). Merge these into `contribution_timing.json` at import time via `import-data.ts`. Build a new `SpikeCards` client component that renders each event as an expandable card with bill context, sector dots, spike metrics, and source links. Replace the table section in `TimingChart.tsx` with the new component.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4

---

## Task 1: Enrich `legislative_events.json` with editorial content

**Files:**
- Modify: `config/legislative_events.json`

**Step 1: Add editorial fields to each event**

Add three new fields to every entry in `legislative_events.json`:
- `editorial_summary`: 1-2 sentences explaining what the bill does in plain English, written for a general audience
- `industry_interest`: 1-2 sentences explaining why the affected sectors care and what they stand to gain or lose
- `congress_url`: Direct link to the bill on Congress.gov (null for N/A bills)

Here are the exact values to add (only showing events that appear in the spike table — i.e., have a real bill number, are sector_specific, and have spike_ratio):

**S. 2973** (committee_hearing, 2023-03-30):
```json
"editorial_summary": "A bipartisan bill to regulate pharmacy benefit managers — the middlemen who negotiate drug prices between insurers and pharmacies. Would ban spread pricing in Medicaid, require PBM pricing transparency, and eliminate rebate-tied compensation.",
"industry_interest": "The three largest PBMs (CVS Caremark, Express Scripts, OptumRx) control ~80% of the market. This bill directly threatens their profit model — they and their parent companies all operate PACs contributing to Finance Committee members.",
"congress_url": "https://www.congress.gov/bill/118th-congress/senate-bill/2973"
```

**S. 2973** (committee_markup, 2023-07-26):
```json
"editorial_summary": "A bipartisan bill to regulate pharmacy benefit managers — the middlemen who negotiate drug prices between insurers and pharmacies. Would ban spread pricing in Medicaid, require PBM pricing transparency, and eliminate rebate-tied compensation.",
"industry_interest": "The three largest PBMs (CVS Caremark, Express Scripts, OptumRx) control ~80% of the market. This bill directly threatens their profit model — they and their parent companies all operate PACs contributing to Finance Committee members.",
"congress_url": "https://www.congress.gov/bill/118th-congress/senate-bill/2973"
```

**S. 2973** (committee_markup, 2023-11-08):
```json
"editorial_summary": "An expanded package combining PBM reform with mental health access and tax extenders. Passed Senate Finance 26-0, imposing drug pricing standards on pharmacy benefit managers and expanding mental health coverage.",
"industry_interest": "Healthcare & Pharma PACs faced regulation of their core pricing practices. Professional services firms also had stakes in the tax extender provisions bundled into the package.",
"congress_url": "https://www.congress.gov/bill/118th-congress/senate-bill/2973"
```

**H.R. 8816** (committee_markup, 2024-06-27):
```json
"editorial_summary": "A healthcare innovation bill expanding Medicare coverage for breakthrough medical devices, multi-cancer screening tests, digital therapeutics, and AI-powered healthcare. Marked up by Ways & Means alongside other health bills.",
"industry_interest": "Pharma and medical device companies sought new Medicare reimbursement pathways for their products. Coverage decisions directly determine whether devices and treatments have a viable market.",
"congress_url": "https://www.congress.gov/bill/118th-congress/house-bill/8816"
```

**H.R. 7024** (floor_vote, 2024-08-01):
```json
"editorial_summary": "The largest bipartisan tax package of the 118th Congress — a $79B deal restoring R&D expensing, expanding the Child Tax Credit, extending bonus depreciation, and increasing low-income housing credits. Passed the House 357-70 but died in the Senate 48-44.",
"industry_interest": "Tech companies wanted R&D expensing restored (worth billions annually). Real estate needed bonus depreciation and LIHTC expansion. Finance and retail benefited broadly from business tax relief. Business groups lobbied intensely for years.",
"congress_url": "https://www.congress.gov/bill/118th-congress/house-bill/7024"
```

**H.R. 3936** (bill_introduction, 2023-06-09):
```json
"editorial_summary": "Part of the three-bill American Families and Jobs Act package. Would increase the standard deduction by $2,000–$4,000 for working families. Introduced alongside small business and R&D expensing bills (H.R. 3937, H.R. 3938).",
"industry_interest": "The spike reflects all three bills introduced the same day. Real estate and retail benefited from family tax cuts, while tech and energy had massive stakes in the companion Build It in America Act (R&D expensing, repeal of green energy credits).",
"congress_url": "https://www.congress.gov/bill/118th-congress/house-bill/3936"
```

Also add these fields to ALL other entries in the file (the ones with `bill: "N/A"` and other events not in the spike table). For events not in the spike table, the editorial fields still add value for tooltip context. Use the existing `description` field as a basis for `editorial_summary`, and infer `industry_interest` from `sectors_affected`. Set `congress_url` to `null` for N/A bills.

**Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('config/legislative_events.json'))"`
Expected: No output (valid JSON)

**Step 3: Commit**

```bash
git add config/legislative_events.json
git commit -m "feat: add editorial summaries and industry interest to legislative events"
```

---

## Task 2: Update `import-data.ts` to merge editorial fields into timing data

**Files:**
- Modify: `webapp/scripts/import-data.ts` (lines 400-468, the `importContributionTiming` function)

**Step 1: Expand the events type and merge editorial fields into event_analysis**

In `importContributionTiming()`, the `eventsRaw` type (line 434) already reads `legislative_events.json`. Expand it to include the new fields and pass them through to both `events` and `event_analysis`.

Change the `eventsRaw` type cast (around line 434) to include:
```typescript
const eventsRaw = JSON.parse(readFileSync(eventsConfigPath, "utf-8")) as Array<{
  bill: string;
  bill_title: string;
  event_type: string;
  date: string;
  description: string;
  committee: string;
  chamber: string;
  sectors_affected: string[];
  significance: string;
  editorial_summary: string;
  industry_interest: string;
  congress_url: string | null;
}>;
```

Update the `events` mapping (around line 441) to include new fields:
```typescript
const events = eventsRaw.map((e) => ({
  date: e.date,
  label: `${e.bill} ${e.event_type.replace(/_/g, " ")}`,
  bill: e.bill,
  bill_title: e.bill_title,
  event_type: e.event_type,
  significance: e.significance,
  description: e.description,
  committee: e.committee,
  chamber: e.chamber,
  sectors_affected: e.sectors_affected,
  editorial_summary: e.editorial_summary,
  industry_interest: e.industry_interest,
  congress_url: e.congress_url,
}));
```

Build a lookup map from eventsRaw keyed by `bill + event_type + date` to enrich `event_analysis` entries. After the `eventAnalysis` array is built (line 453), enrich each entry:

```typescript
// Build lookup for enriching event_analysis
const eventLookup = new Map<string, typeof eventsRaw[0]>();
for (const e of eventsRaw) {
  const key = `${e.bill}|${e.event_type}|${e.date}`;
  eventLookup.set(key, e);
}

const eventAnalysis = eventAnalysisRaw.map((row) => {
  const key = `${row.bill}|${row.event_type}|${row.date}`;
  const meta = eventLookup.get(key);
  return {
    bill: row.bill,
    bill_title: meta?.bill_title ?? "",
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
    sectors_affected: meta?.sectors_affected ?? [],
    editorial_summary: meta?.editorial_summary ?? "",
    industry_interest: meta?.industry_interest ?? "",
    congress_url: meta?.congress_url ?? null,
  };
});
```

**Step 2: Run import-data to regenerate JSON**

Run: `cd webapp && npm run import-data`
Expected: `contribution_timing.json` now contains the new fields

**Step 3: Verify the new fields appear in the JSON**

Run: `python3 -c "import json; d=json.load(open('webapp/data/contribution_timing.json')); e=d['event_analysis'][0]; print(e.get('bill_title','MISSING'), e.get('editorial_summary','MISSING')[:40])"`
Expected: Should print a bill title and first 40 chars of editorial summary

**Step 4: Commit**

```bash
git add webapp/scripts/import-data.ts webapp/data/contribution_timing.json
git commit -m "feat: merge editorial fields from legislative_events into contribution_timing"
```

---

## Task 3: Update TypeScript types in `data.ts`

**Files:**
- Modify: `webapp/lib/data.ts` (lines 181-207)

**Step 1: Add new fields to TimingEvent interface**

Change the `TimingEvent` interface (line 181) to:

```typescript
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
}
```

**Step 2: Add new fields to EventAnalysisEntry interface**

Change the `EventAnalysisEntry` interface (line 189) to:

```typescript
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
}
```

**Step 3: Verify build compiles**

Run: `cd webapp && npx next build 2>&1 | head -30`
Expected: Should not error on type mismatches (existing code accesses a subset of these fields, so adding fields is non-breaking)

**Step 4: Commit**

```bash
git add webapp/lib/data.ts
git commit -m "feat: add editorial fields to TimingEvent and EventAnalysisEntry types"
```

---

## Task 4: Build the SpikeCards component

**Files:**
- Create: `webapp/components/SpikeCards.tsx`

**Step 1: Create the SpikeCards component**

This is a `"use client"` component that receives the top spike entries (enriched `EventAnalysisEntry[]`) and `sectorColors`. It renders expandable cards.

Key design decisions:
- Each card shows collapsed state by default: bill number + title, event type tag, spike ratio badge, event week $, sector dots
- Click expands to reveal: editorial summary, industry interest paragraph, baseline vs event week comparison, Congress.gov source link
- Only one card expanded at a time (accordion behavior)
- Cards sorted by spike_ratio descending (already sorted by caller)
- Style: matches the project's card pattern (`bg-white rounded-lg border border-[#C8C1B6]/50 p-5`)
- Spike ratio >= 2.0× gets a coral accent; lower gets stone/neutral
- Sector dots use `sectorColors` mapping with labels

The component should accept these props:

```typescript
interface SpikeCardsProps {
  spikes: EventAnalysisEntry[];
  sectorColors: Record<string, string>;
}
```

Visual structure per card:

**Collapsed:**
```
┌──────────────────────────────────────────────────────────┐
│  S. 2973 — Modernizing and Ensuring PBM Accountability   │
│  Committee Hearing · Mar 30, 2023                        │
│                                                          │
│  ●Healthcare & Pharma                   5.24×    $67K    │
│                                                 ▼ expand │
└──────────────────────────────────────────────────────────┘
```

**Expanded (adds below the collapsed content):**
```
│  ─────────────────────────────────────────────────────── │
│  WHAT THIS BILL DOES                                     │
│  A bipartisan bill to regulate pharmacy benefit           │
│  managers — the middlemen who negotiate drug prices...    │
│                                                          │
│  WHO HAD SKIN IN THE GAME                                │
│  The three largest PBMs (CVS Caremark, Express Scripts,   │
│  OptumRx) control ~80% of the market...                  │
│                                                          │
│  THE MONEY                                               │
│  Baseline: $13K/wk → Event week: $67K  (5.24× spike)    │
│  ████████████████████████████████████░░░░░░ visual bar   │
│                                                          │
│  Source: Congress.gov · FEC bulk data, 2024 cycle        │
└──────────────────────────────────────────────────────────┘
```

Use `useState` for expanded card index. Format dates with `toLocaleDateString`. Format money with `formatMoney` from `@/lib/utils`. The baseline comparison bar should be a simple proportional div.

**Step 2: Verify component renders without errors**

After wiring it up in Task 5, verify via dev server.

**Step 3: Commit**

```bash
git add webapp/components/SpikeCards.tsx
git commit -m "feat: add SpikeCards component for legislative spike story cards"
```

---

## Task 5: Replace the spike table in TimingChart with SpikeCards

**Files:**
- Modify: `webapp/components/TimingChart.tsx` (lines 280-345)

**Step 1: Import SpikeCards**

Add import at top of `TimingChart.tsx`:
```typescript
import SpikeCards from "./SpikeCards";
```

**Step 2: Replace the spike table section**

Replace everything from `{/* Spike Ratio Table */}` (line 280) through the closing `</section>` and `)}` (around line 345) with:

```tsx
{/* Spike Story Cards */}
{topSpikes.length > 0 && (
  <section>
    <h3
      className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2"
      style={{ fontFamily: "var(--font-display)" }}
    >
      Largest Contribution Spikes Around Legislation
    </h3>
    <p className="text-xs text-stone-500 mb-4 max-w-2xl leading-relaxed">
      When legislation affecting specific industries moves through committee, PAC
      contributions from those industries often spike. These are the largest
      sector-specific increases — click any card to see what the bill does and
      who had financial interests.
    </p>
    <SpikeCards spikes={topSpikes} sectorColors={sectorColors} />
    <p className="text-[10px] text-stone-400 mt-4">
      Spike ratio = event-week total ÷ baseline weekly average for affected
      sectors. Only sector-specific events shown. Source: FEC bulk contribution
      data; legislative dates from Congress.gov.
    </p>
  </section>
)}
```

**Step 3: Verify dev server renders correctly**

Run: `cd webapp && npm run dev`
Navigate to `/pacs/timing` and verify:
- Area chart still renders
- Spike cards appear below the chart
- Cards expand/collapse on click
- All 5 spike events show bill titles, editorial summaries, sector dots

**Step 4: Verify production build**

Run: `cd webapp && npm run build`
Expected: Builds without errors

**Step 5: Commit**

```bash
git add webapp/components/TimingChart.tsx
git commit -m "feat: replace spike table with expandable story cards in TimingChart"
```

---

## Task 6: Visual polish and verification

**Files:**
- Possibly modify: `webapp/components/SpikeCards.tsx` (tweaks)

**Step 1: Screenshot all spike cards expanded and collapsed**

Check each card for:
- Bill title is readable and prominent
- Event type + date are clearly visible
- Sector dots render with correct colors
- Spike ratio is visually prominent (coral for ≥ 2×)
- Expanded state shows editorial summary, industry interest, money comparison
- Congress.gov link works
- Mobile responsive: cards stack properly on narrow screens

**Step 2: Test accordion behavior**

- Click card 1 → expands
- Click card 2 → card 1 collapses, card 2 expands
- Click card 2 again → collapses (all collapsed)

**Step 3: Verify production build**

Run: `cd webapp && npm run build`
Expected: Clean build, no type errors, no warnings (except the pre-existing Recharts width/height SSG warning)

**Step 4: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "polish: refine spike story cards styling and layout"
```
