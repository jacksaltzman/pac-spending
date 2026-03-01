# Contribution Timing Analysis — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Determine whether PAC contributions to tax-writing committee members spike around key legislative events (markups, floor votes) during the 118th Congress, and visualize the results in the webapp.

**Architecture:** A new pipeline step (`scripts/10_contribution_timing.py`) reads the existing PAC and individual contribution parquet files, aggregates by ISO week, then computes spike ratios around curated legislative events. The webapp gains a `TimingChart.tsx` Recharts component integrated into the PACs page, with data flowing through the existing `import-data.ts` → static JSON → server component → client component pipeline.

**Tech Stack:** Python 3.11+ (pandas, pyarrow), TypeScript, Next.js 16 (App Router), Recharts (AreaChart + ReferenceLine), Tailwind CSS v4

---

## Task 1: Curate Legislative Events Timeline

**Files:**
- Create: `config/legislative_events.json`

**Context:** This is a curated data file, not generated code. We need 15–25 discrete legislative events from the 118th Congress (2023–2024) involving tax-writing committees. The prompt provides starting points for key bills. We'll use Congress.gov API and web research to get exact dates.

**Step 1: Research exact dates for known bills via Congress.gov API**

Query the Congress.gov API for bill actions on the key bills listed in the prompt. The API is free with a key from `https://api.congress.gov/sign-up/`, but also works with basic access.

Key bills to research:
- H.R. 7024 (Tax Relief for American Families and Workers Act)
- H.R. 3936, H.R. 3937, H.R. 3938 (American Families and Jobs Act package)
- September 2024 W&M markup bills
- S. 2872 (TCJA extension-related)
- Any Senate Finance markups in the 118th Congress

For each, we need: bill number, event type (committee_markup, floor_vote, committee_hearing, bill_introduction), exact date, committee, chamber, description, affected sectors, significance (high/medium/low).

**Step 2: Build the JSON file**

Write `config/legislative_events.json` with the researched events. Target 15–25 events.

Schema per entry:
```json
{
  "bill": "H.R. 7024",
  "bill_title": "Tax Relief for American Families and Workers Act of 2024",
  "event_type": "committee_markup",
  "date": "2024-01-19",
  "committee": "ways_and_means",
  "chamber": "house",
  "description": "Ways & Means Committee marks up and advances the bill",
  "sectors_affected": ["Finance & Insurance", "Tech & Telecom", "Real Estate & Housing"],
  "significance": "high"
}
```

**Important:** `sectors_affected` values MUST match the 14 sector names in `config/pac_sectors.json` exactly (e.g., "Finance & Insurance" not "Finance").

**Step 3: Verify the file**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
python3 -c "import json; events = json.load(open('config/legislative_events.json')); print(f'{len(events)} events'); print([e['date'] for e in events])"
```

Expected: 15–25 events, all dates in 2023–2024 range, valid JSON.

**Step 4: Commit**

```bash
git add config/legislative_events.json
git commit -m "feat: add curated legislative events timeline for 118th Congress"
```

---

## Task 2: Build Contribution Timing Pipeline Script

**Files:**
- Create: `scripts/10_contribution_timing.py`

**Context:** This script reads existing parquet files, aggregates contributions by ISO week, links PAC contributions to sectors via `pac_sectors.json`, links to members via `members.json`, and produces three CSV outputs. Follow the conventions from `scripts/07_analyze.py`: module docstring, STEP_NAME constant, checkpoint pattern, print-based logging, pandas/pyarrow.

**Step 1: Write the script skeleton with imports and checkpoint pattern**

```python
"""
Step 10: Contribution Timing Analysis

Aggregates PAC and individual contributions by ISO week and analyzes
contribution patterns around legislative events.

Dependencies:
  - data/processed/pac_contributions_2024.parquet (from step 02)
  - data/processed/contributions_2024_classified.parquet (from step 04)
  - config/pac_sectors.json (curated PAC sector mappings)
  - config/members.json (member roster with FEC IDs)
  - config/legislative_events.json (curated legislative event timeline)

Outputs:
  - output/pac_weekly_totals.csv
  - output/individual_weekly_totals.csv
  - output/event_timing_analysis.csv
"""

import json
import sys
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Add parent dir to path for local imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import DATA_DIR, OUTPUT_DIR, PROJECT_ROOT
from utils.checkpoint import is_step_complete, save_checkpoint, clear_checkpoint

STEP_NAME = "10_contribution_timing"
CYCLE = 2024
```

**Step 2: Write helper functions for loading and date parsing**

```python
def load_pac_sectors():
    """Load curated PAC sector mappings from config."""
    path = PROJECT_ROOT / "config" / "pac_sectors.json"
    with open(path) as f:
        config = json.load(f)
    # Build CMTE_ID -> sector lookup
    return {cmte_id: info["sector"] for cmte_id, info in config["pacs"].items()}


def load_members_lookup():
    """Load members.json and build CAND_ID -> member name lookup."""
    path = PROJECT_ROOT / "config" / "members.json"
    with open(path) as f:
        data = json.load(f)
    lookup = {}
    for committee_key in ["house_ways_and_means", "senate_finance"]:
        for m in data[committee_key]["members"]:
            if m.get("fec_candidate_id"):
                lookup[m["fec_candidate_id"]] = m["name"]
    return lookup


def load_legislative_events():
    """Load curated legislative event timeline."""
    path = PROJECT_ROOT / "config" / "legislative_events.json"
    with open(path) as f:
        return json.load(f)


def parse_transaction_date(series):
    """Parse MMDDYYYY string dates to datetime, coercing errors to NaT."""
    return pd.to_datetime(series, format="%m%d%Y", errors="coerce")
```

**Step 3: Write PAC weekly aggregation function**

This reads `pac_contributions_2024.parquet`, parses dates, joins sectors, aggregates by ISO week and sector.

```python
def aggregate_pac_weekly(cycle):
    """Aggregate PAC contributions by ISO week and sector."""
    path = DATA_DIR / "processed" / f"pac_contributions_{cycle}.parquet"
    if not path.exists():
        print(f"  WARNING: {path} not found, skipping PAC weekly aggregation")
        return None

    print(f"  Loading PAC contributions from {path.name}...")
    df = pd.read_parquet(path)
    print(f"  {len(df):,} PAC transactions loaded")

    # Parse dates
    df["date"] = parse_transaction_date(df["TRANSACTION_DT"])
    before = len(df)
    df = df.dropna(subset=["date"])
    print(f"  {before - len(df):,} rows dropped due to unparseable dates")

    # Filter to cycle date range
    df = df[(df["date"] >= "2023-01-01") & (df["date"] <= "2024-12-31")]
    print(f"  {len(df):,} transactions in 2023-2024 range")

    # Join sector from pac_sectors.json
    sector_lookup = load_pac_sectors()
    df["sector"] = df["CMTE_ID"].map(sector_lookup).fillna("Other/Unclassified")

    # ISO week start (Monday)
    df["week_start"] = df["date"].dt.to_period("W-SUN").apply(lambda p: p.start_time)

    # Aggregate by week and sector
    weekly = df.groupby(["week_start", "sector"]).agg(
        total_amount=("TRANSACTION_AMT", "sum"),
        transaction_count=("TRANSACTION_AMT", "count"),
        distinct_pacs=("CMTE_ID", "nunique"),
        distinct_recipients=("CAND_ID", "nunique"),
    ).reset_index()

    weekly["week_start"] = weekly["week_start"].dt.strftime("%Y-%m-%d")
    weekly = weekly.sort_values(["week_start", "sector"])

    return weekly
```

**Step 4: Write individual contribution weekly aggregation function**

```python
def aggregate_individual_weekly(cycle):
    """Aggregate individual contributions by ISO week and geo_class."""
    path = DATA_DIR / "processed" / f"contributions_{cycle}_classified.parquet"
    if not path.exists():
        print(f"  WARNING: {path} not found, skipping individual weekly aggregation")
        return None

    print(f"  Loading individual contributions from {path.name}...")
    df = pd.read_parquet(path)
    print(f"  {len(df):,} individual transactions loaded")

    # Parse dates
    df["date"] = parse_transaction_date(df["TRANSACTION_DT"])
    before = len(df)
    df = df.dropna(subset=["date"])
    print(f"  {before - len(df):,} rows dropped due to unparseable dates")

    # Filter to cycle date range
    df = df[(df["date"] >= "2023-01-01") & (df["date"] <= "2024-12-31")]
    print(f"  {len(df):,} transactions in 2023-2024 range")

    # ISO week start (Monday)
    df["week_start"] = df["date"].dt.to_period("W-SUN").apply(lambda p: p.start_time)

    # Aggregate by week and geo_class
    weekly = df.groupby(["week_start", "geo_class"]).agg(
        total_amount=("TRANSACTION_AMT", "sum"),
        transaction_count=("TRANSACTION_AMT", "count"),
        distinct_donors=("NAME", "nunique"),
    ).reset_index()

    weekly["week_start"] = weekly["week_start"].dt.strftime("%Y-%m-%d")
    weekly = weekly.sort_values(["week_start", "geo_class"])

    return weekly
```

**Step 5: Write event window analysis function**

For each legislative event, compute baseline/pre-event/event-week/post-event metrics and spike ratios.

```python
def analyze_event_windows(cycle):
    """Compute contribution metrics in windows around each legislative event."""
    # Load PAC contributions with dates and sectors
    pac_path = DATA_DIR / "processed" / f"pac_contributions_{cycle}.parquet"
    if not pac_path.exists():
        print(f"  WARNING: {pac_path} not found, skipping event analysis")
        return None

    df = pd.read_parquet(pac_path)
    df["date"] = parse_transaction_date(df["TRANSACTION_DT"])
    df = df.dropna(subset=["date"])
    df = df[(df["date"] >= "2023-01-01") & (df["date"] <= "2024-12-31")]

    sector_lookup = load_pac_sectors()
    df["sector"] = df["CMTE_ID"].map(sector_lookup).fillna("Other/Unclassified")

    events = load_legislative_events()
    results = []

    for event in events:
        event_date = pd.Timestamp(event["date"])
        affected_sectors = set(event.get("sectors_affected", []))

        # Define windows
        baseline_start = event_date - timedelta(days=90)
        baseline_end = event_date - timedelta(days=30)
        pre_start = event_date - timedelta(days=30)
        pre_end = event_date - timedelta(days=1)
        event_week_start = event_date - timedelta(days=event_date.weekday())  # Monday
        event_week_end = event_week_start + timedelta(days=6)
        post_start = event_date + timedelta(days=1)
        post_end = event_date + timedelta(days=30)

        # Compute baseline weekly average (total in baseline window / number of weeks)
        baseline_weeks = max((baseline_end - baseline_start).days / 7, 1)

        for sector_filter, sector_label, is_sector_specific in [
            (None, "All Sectors", False),
            (affected_sectors, "Affected Sectors", True),
        ]:
            if is_sector_specific and not affected_sectors:
                continue

            if sector_filter is None:
                subset = df
            else:
                subset = df[df["sector"].isin(sector_filter)]

            baseline_total = subset[
                (subset["date"] >= baseline_start) & (subset["date"] <= baseline_end)
            ]["TRANSACTION_AMT"].sum()
            baseline_weekly_avg = baseline_total / baseline_weeks if baseline_weeks > 0 else 0

            pre_event_total = subset[
                (subset["date"] >= pre_start) & (subset["date"] <= pre_end)
            ]["TRANSACTION_AMT"].sum()

            event_week_total = subset[
                (subset["date"] >= event_week_start) & (subset["date"] <= event_week_end)
            ]["TRANSACTION_AMT"].sum()

            post_event_total = subset[
                (subset["date"] >= post_start) & (subset["date"] <= post_end)
            ]["TRANSACTION_AMT"].sum()

            spike_ratio = round(event_week_total / baseline_weekly_avg, 2) if baseline_weekly_avg > 0 else None

            results.append({
                "bill": event["bill"],
                "event_type": event["event_type"],
                "date": event["date"],
                "sector": sector_label,
                "baseline_weekly_avg": round(baseline_weekly_avg),
                "pre_event_total": round(pre_event_total),
                "event_week_total": round(event_week_total),
                "post_event_total": round(post_event_total),
                "spike_ratio": spike_ratio,
                "sector_specific": is_sector_specific,
                "significance": event.get("significance", "medium"),
            })

    return pd.DataFrame(results)
```

**Step 6: Write the `run()` orchestrator and `__main__` block**

```python
def run():
    """Main entry point."""
    if "--force" in sys.argv:
        clear_checkpoint(STEP_NAME)

    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    print(f"\n{'='*60}")
    print(f"Step 10: Contribution Timing Analysis")
    print(f"{'='*60}\n")

    # 1. PAC weekly aggregation
    print("Aggregating PAC contributions by week...")
    pac_weekly = aggregate_pac_weekly(CYCLE)
    if pac_weekly is not None:
        out_path = OUTPUT_DIR / "pac_weekly_totals.csv"
        pac_weekly.to_csv(out_path, index=False)
        print(f"  Saved {len(pac_weekly):,} rows to {out_path.name}")

    # 2. Individual weekly aggregation
    print("\nAggregating individual contributions by week...")
    indiv_weekly = aggregate_individual_weekly(CYCLE)
    if indiv_weekly is not None:
        out_path = OUTPUT_DIR / "individual_weekly_totals.csv"
        indiv_weekly.to_csv(out_path, index=False)
        print(f"  Saved {len(indiv_weekly):,} rows to {out_path.name}")

    # 3. Event window analysis
    print("\nAnalyzing contribution windows around legislative events...")
    event_analysis = analyze_event_windows(CYCLE)
    if event_analysis is not None:
        out_path = OUTPUT_DIR / "event_timing_analysis.csv"
        event_analysis.to_csv(out_path, index=False)
        print(f"  Saved {len(event_analysis):,} rows to {out_path.name}")

        # Print top spikes
        top = event_analysis[event_analysis["spike_ratio"].notna()].nlargest(5, "spike_ratio")
        if not top.empty:
            print("\n  Top 5 spike ratios:")
            for _, row in top.iterrows():
                print(f"    {row['bill']} ({row['event_type']}) — {row['sector']}: {row['spike_ratio']}×")

    save_checkpoint(STEP_NAME, {"completed": True})
    print(f"\nStep {STEP_NAME} complete.")


if __name__ == "__main__":
    run()
```

**Step 7: Run the script and verify outputs**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
python3 scripts/10_contribution_timing.py
```

Expected output: Three CSV files in `output/`:
- `pac_weekly_totals.csv` — ~1,000+ rows (104 weeks × ~14 sectors)
- `individual_weekly_totals.csv` — ~500+ rows (104 weeks × ~6 geo classes)
- `event_timing_analysis.csv` — ~30-50 rows (15-25 events × 2 sector filters each)

Verify with:
```bash
head -5 output/pac_weekly_totals.csv
head -5 output/individual_weekly_totals.csv
head -5 output/event_timing_analysis.csv
wc -l output/pac_weekly_totals.csv output/individual_weekly_totals.csv output/event_timing_analysis.csv
```

**Step 8: Commit**

```bash
git add scripts/10_contribution_timing.py output/pac_weekly_totals.csv output/individual_weekly_totals.csv output/event_timing_analysis.csv
git commit -m "feat: add contribution timing analysis pipeline (step 10)"
```

---

## Task 3: Extend Import Script for Timing Data

**Files:**
- Modify: `webapp/scripts/import-data.ts`

**Context:** Add an `importContributionTiming()` function that reads the three output CSVs and produces `webapp/data/contribution_timing.json`. Follow the exact patterns from existing import functions (e.g., `importPacSpread`).

**Step 1: Add the import function**

Add after the existing `buildTopFunderAgendas` function, before the `main()` function:

```typescript
interface WeeklyPacTotal {
  week: string;
  total: number;
  [sector: string]: number | string; // dynamic sector keys
}

interface TimingEvent {
  date: string;
  label: string;
  bill: string;
  event_type: string;
  significance: string;
}

interface EventAnalysisEntry {
  bill: string;
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
}

function importContributionTiming(): {
  weekly_pac_totals: WeeklyPacTotal[];
  events: TimingEvent[];
  event_analysis: EventAnalysisEntry[];
} | null {
  // Check if timing CSVs exist
  const pacWeeklyPath = join(PIPELINE_OUTPUT, "pac_weekly_totals.csv");
  const eventAnalysisPath = join(PIPELINE_OUTPUT, "event_timing_analysis.csv");
  const eventsConfigPath = join(PROJECT_ROOT, "config", "legislative_events.json");

  if (!existsSync(pacWeeklyPath) || !existsSync(eventAnalysisPath) || !existsSync(eventsConfigPath)) {
    console.log("  Skipping contribution timing (files not found)");
    return null;
  }

  // 1. Read and pivot PAC weekly totals: one row per week with sector columns
  const pacWeeklyRaw = readCSV("pac_weekly_totals.csv");
  const weekMap = new Map<string, WeeklyPacTotal>();
  for (const row of pacWeeklyRaw) {
    const week = row.week_start as string;
    if (!weekMap.has(week)) {
      weekMap.set(week, { week, total: 0 });
    }
    const entry = weekMap.get(week)!;
    const amt = toNumber(row.total_amount);
    entry[row.sector as string] = amt;
    entry.total = (entry.total as number) + amt;
  }
  const weeklyPacTotals = Array.from(weekMap.values()).sort((a, b) => a.week.localeCompare(b.week));

  // 2. Load legislative events for chart markers
  const eventsRaw = JSON.parse(readFileSync(eventsConfigPath, "utf-8")) as Array<{
    bill: string;
    bill_title: string;
    event_type: string;
    date: string;
    significance: string;
  }>;
  const events: TimingEvent[] = eventsRaw.map((e) => ({
    date: e.date,
    label: `${e.bill} ${e.event_type.replace(/_/g, " ")}`,
    bill: e.bill,
    event_type: e.event_type,
    significance: e.significance,
  }));

  // 3. Read event analysis
  const eventAnalysisRaw = readCSV("event_timing_analysis.csv");
  const eventAnalysis: EventAnalysisEntry[] = eventAnalysisRaw.map((row) => ({
    bill: row.bill as string,
    event_type: row.event_type as string,
    date: row.date as string,
    sector: row.sector as string,
    baseline_weekly_avg: toNumber(row.baseline_weekly_avg),
    pre_event_total: toNumber(row.pre_event_total),
    event_week_total: toNumber(row.event_week_total),
    post_event_total: toNumber(row.post_event_total),
    spike_ratio: row.spike_ratio === "" || row.spike_ratio === undefined ? null : toNumber(row.spike_ratio),
    sector_specific: toBool(row.sector_specific),
    significance: row.significance as string,
  }));

  return { weekly_pac_totals: weeklyPacTotals, events, event_analysis: eventAnalysis };
}
```

**Step 2: Call it from `main()` and write the JSON**

Add to the `main()` function, after the existing imports and before the final console.log:

```typescript
// Import contribution timing
console.log("Importing contribution timing...");
const timing = importContributionTiming();
if (timing) {
  writeFileSync(join(WEBAPP_DATA, "contribution_timing.json"), JSON.stringify(timing, null, 2));
  console.log(`  → contribution_timing.json (${timing.weekly_pac_totals.length} weeks, ${timing.events.length} events, ${timing.event_analysis.length} analysis rows)`);
}
```

**Step 3: Add necessary imports if missing**

Ensure `existsSync` and `readFileSync` are imported from `node:fs` at the top of the file (check — they may already be there).

**Step 4: Run import and verify**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution/webapp"
npx tsx scripts/import-data.ts
```

Verify:
```bash
python3 -c "import json; d = json.load(open('webapp/data/contribution_timing.json')); print(f\"weeks: {len(d['weekly_pac_totals'])}, events: {len(d['events'])}, analysis: {len(d['event_analysis'])}\")"
```

**Step 5: Commit**

```bash
git add webapp/scripts/import-data.ts webapp/data/contribution_timing.json
git commit -m "feat: add contribution timing to import-data pipeline"
```

---

## Task 4: Add Data Loader to Webapp

**Files:**
- Modify: `webapp/lib/data.ts`

**Context:** Add TypeScript interfaces and a `getContributionTiming()` loader function following the exact pattern of existing loaders (module-level cache, `loadJSON` or direct file read).

**Step 1: Add interfaces**

Add after the existing `Benchmarks` interface:

```typescript
export interface WeeklyPacTotal {
  week: string;
  total: number;
  [sector: string]: number | string;
}

export interface TimingEvent {
  date: string;
  label: string;
  bill: string;
  event_type: string;
  significance: string;
}

export interface EventAnalysisEntry {
  bill: string;
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
}

export interface ContributionTiming {
  weekly_pac_totals: WeeklyPacTotal[];
  events: TimingEvent[];
  event_analysis: EventAnalysisEntry[];
}
```

**Step 2: Add the loader function**

Add after the existing `getSectorColors()` function:

```typescript
export function getContributionTiming(): ContributionTiming | null {
  const filePath = join(DATA_DIR, "contribution_timing.json");
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ContributionTiming;
}
```

Check that `existsSync` is imported at the top. The file already imports `readFileSync` from `node:fs` and `join` from `node:path`.

**Step 3: Commit**

```bash
git add webapp/lib/data.ts
git commit -m "feat: add ContributionTiming interfaces and data loader"
```

---

## Task 5: Build TimingChart Component

**Files:**
- Create: `webapp/components/TimingChart.tsx`

**Context:** A `"use client"` component using Recharts `AreaChart` with stacked sector areas and `ReferenceLine` for legislative events. Follow the exact styling and patterns from `PacCharts.tsx`: card container, section headers, interpretive captions, tooltip styling, `useMemo` for data transforms.

**Step 1: Create the component**

The component receives `ContributionTiming` data and `sectorColors` as props. It renders:

1. **Stacked area chart** — X-axis: weeks, Y-axis: total PAC $, stacked areas by sector (top ~8 sectors by total, rest grouped as "Other")
2. **Vertical reference lines** at each legislative event date (high significance = solid coral, medium = dashed gray)
3. **Hover tooltip** showing week, total, sector breakdown, and any event that week
4. **Spike ratio table** below the chart — top 5 events by spike ratio

Key Recharts imports: `AreaChart`, `Area`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `ReferenceLine`, `ResponsiveContainer`

The component should use `useMemo` to:
- Identify top 8 sectors by total contribution across all weeks
- Collapse remaining sectors into "Other"
- Build tooltip lookup for events by week

Follow formatting from `PacCharts.tsx`:
- `formatDollarsShort()` for Y-axis and tooltips
- Card wrapper: `bg-white border border-[#C8C1B6]/50 rounded-lg p-5`
- Section label: `text-xs uppercase tracking-[0.2em] text-stone-500 mb-1` with `fontFamily: "var(--font-display)"`
- Interpretive caption: `text-xs text-stone-500 mb-4 max-w-2xl leading-relaxed`
- Chart height: ~400px in a `ResponsiveContainer`
- Tooltip: `borderRadius: 6, border: "1px solid #C8C1B6", fontSize: 13`

For reference lines, use Recharts `<ReferenceLine x={eventDate} stroke="#FE4F40" strokeDasharray="3 3" />` with a custom label component showing the bill name rotated -45°.

**Spike ratio table:** A simple HTML table below the chart:
- Columns: Event, Date, Relevant Sectors, Spike Ratio, $ in Event Week
- Top 5 events by spike_ratio where sector_specific = true
- Coral background highlight for spike ratios ≥ 2.0

**Step 2: Verify it compiles**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution/webapp"
npx tsc --noEmit components/TimingChart.tsx
```

(May not work standalone; verify via dev server in Task 6.)

**Step 3: Commit**

```bash
git add webapp/components/TimingChart.tsx
git commit -m "feat: add TimingChart component with stacked areas and event markers"
```

---

## Task 6: Integrate into PACs Page

**Files:**
- Modify: `webapp/app/pacs/page.tsx`

**Context:** Add a "Contribution Timing" section to the PACs page. The best placement is **after the PacCharts component** and **before the Sector Spotlights section** (around the existing chart section). This keeps the analytical visualizations together.

**Step 1: Import the data loader and component**

Add to the imports at the top of `page.tsx`:

```typescript
import { getContributionTiming } from "@/lib/data";
import TimingChart from "@/components/TimingChart";
```

**Step 2: Load timing data in the server component**

Add to the data loading section at the top of the component:

```typescript
const timing = getContributionTiming();
```

**Step 3: Add the timing section to the JSX**

Add after the PacCharts section and before Sector Spotlights. Include:

1. Section header: "When Does the Money Move?"
2. Narrative framing paragraph (data-driven, computed from `timing.event_analysis`)
3. The `<TimingChart>` client component
4. Source note

```tsx
{/* Contribution Timing */}
{timing && (
  <section className="space-y-4">
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
         style={{ fontFamily: "var(--font-display)" }}>
        Contribution Timing
      </p>
      <h2 className="text-2xl font-bold text-stone-900"
          style={{ fontFamily: "var(--font-display)" }}>
        When Does the Money Move?
      </h2>
    </div>
    <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
      {buildTimingNarrative(timing.event_analysis)}
    </p>
    <TimingChart timing={timing} sectorColors={sectorColors} />
    <p className="text-[10px] text-stone-400">
      Source: FEC bulk contribution data, 2024 election cycle. Legislative event dates from Congress.gov.
    </p>
  </section>
)}
```

**Step 4: Add the `buildTimingNarrative` helper function**

Add to the helper functions section of the page file:

```typescript
function buildTimingNarrative(
  analysis: { bill: string; event_type: string; spike_ratio: number | null; sector: string; sector_specific: boolean; event_week_total: number }[]
): string {
  // Find the highest spike ratio among sector-specific entries
  const sectorSpikes = analysis
    .filter((a) => a.sector_specific && a.spike_ratio !== null)
    .sort((a, b) => (b.spike_ratio ?? 0) - (a.spike_ratio ?? 0));

  if (sectorSpikes.length === 0) {
    return "PAC contributions to committee members show no statistically meaningful correlation with the legislative calendar. Money flows at a relatively steady rate regardless of when markups or votes occur.";
  }

  const top = sectorSpikes[0];
  const eventLabel = top.event_type.replace(/_/g, " ");

  if ((top.spike_ratio ?? 0) >= 1.5) {
    return `PAC contributions don't arrive at random. They cluster around the moments that matter most. When Congress acted on ${top.bill}, affected-sector PAC contributions spiked to ${top.spike_ratio}× their weekly baseline — suggesting strategically timed giving, not routine relationship maintenance.`;
  }

  return `PAC contribution patterns show modest fluctuations around legislative events. The highest spike observed was ${top.spike_ratio}× baseline during the ${top.bill} ${eventLabel}, a moderate increase that may reflect seasonal patterns rather than targeted timing.`;
}
```

**Step 5: Run the dev server and verify**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution/webapp"
npm run dev
```

Open `http://localhost:3000/pacs` and verify:
- The timing section appears between charts and sector spotlights
- The stacked area chart renders with colored sectors
- Event reference lines appear at correct dates
- Tooltip works on hover
- Spike ratio table displays below the chart
- Narrative text is data-driven (not hardcoded)

**Step 6: Commit**

```bash
git add webapp/app/pacs/page.tsx
git commit -m "feat: integrate contribution timing analysis into PACs page"
```

---

## Task 7: Final Verification and Polish

**Files:**
- Potentially modify: any of the above files for bug fixes

**Step 1: Run the full pipeline end-to-end**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"

# Clear timing checkpoint and re-run
python3 scripts/10_contribution_timing.py --force

# Re-import data
cd webapp && npx tsx scripts/import-data.ts

# Start dev server
npm run dev
```

**Step 2: Verify data integrity**

```bash
# Check CSV row counts
wc -l output/pac_weekly_totals.csv output/individual_weekly_totals.csv output/event_timing_analysis.csv

# Check JSON structure
python3 -c "
import json
d = json.load(open('webapp/data/contribution_timing.json'))
print(f\"Weeks: {len(d['weekly_pac_totals'])}\")
print(f\"Events: {len(d['events'])}\")
print(f\"Analysis rows: {len(d['event_analysis'])}\")
# Check for any spike ratios above 1.5
spikes = [r for r in d['event_analysis'] if r.get('spike_ratio') and r['spike_ratio'] >= 1.5]
print(f\"Events with spike >= 1.5x: {len(spikes)}\")
for s in spikes[:5]:
    print(f\"  {s['bill']} ({s['event_type']}) - {s['sector']}: {s['spike_ratio']}x\")
"
```

**Step 3: Visual check in browser**

Open `http://localhost:3000/pacs` and confirm:
- [ ] Timing section renders without errors
- [ ] Chart has data spanning 2023–2024
- [ ] Sector colors match existing charts
- [ ] Event markers are visible and labeled
- [ ] Tooltip shows sector breakdown
- [ ] Spike table shows top events
- [ ] Narrative text updates based on actual data
- [ ] Page loads without console errors
- [ ] No layout breakage on existing sections

**Step 4: Fix any issues found**

Address rendering bugs, missing data, or styling inconsistencies.

**Step 5: Final commit**

```bash
git add -A
git commit -m "polish: fix timing chart issues and finalize integration"
```

---

## File Summary

| File | Action | Task |
|------|--------|------|
| `config/legislative_events.json` | Create | 1 |
| `scripts/10_contribution_timing.py` | Create | 2 |
| `output/pac_weekly_totals.csv` | Generated | 2 |
| `output/individual_weekly_totals.csv` | Generated | 2 |
| `output/event_timing_analysis.csv` | Generated | 2 |
| `webapp/scripts/import-data.ts` | Modify | 3 |
| `webapp/data/contribution_timing.json` | Generated | 3 |
| `webapp/lib/data.ts` | Modify | 4 |
| `webapp/components/TimingChart.tsx` | Create | 5 |
| `webapp/app/pacs/page.tsx` | Modify | 6 |

## Dependency Order

```
Task 1 (legislative events JSON)
  └→ Task 2 (Python pipeline script) — needs events file
       └→ Task 3 (import-data.ts extension) — needs CSV outputs
            └→ Task 4 (data.ts loader) — needs JSON schema
                 └→ Task 5 (TimingChart component) — needs interfaces
                      └→ Task 6 (PACs page integration) — needs component + loader
                           └→ Task 7 (verification) — needs everything running
```

Tasks 4 and 5 can be parallelized since they're independent (interfaces vs component), but both must complete before Task 6.
