# Before/After Committee Appointment Analysis — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Determine whether PAC money increases after members join the House Ways & Means or Senate Finance Committee, by comparing historical PAC receipts before vs. after appointment for all 72 members.

**Architecture:** A standalone Python script (`scripts/09_before_after.py`) fetches historical PAC receipts from the FEC API across 6 cycles, joins them with a curated `config/committee_history.json` file of appointment dates, and produces before/after analysis. The webapp gets a new section on the PACs page showing the headline finding.

**Tech Stack:** Python 3.11+, pandas, requests (FEC API), Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Recharts

---

## Task 1: Research Committee Appointment Dates via Congress.gov API

**Files:**
- Create: `config/committee_history.json`

**Step 1: Test the Congress.gov API**

First, check whether the Congress.gov API provides historical committee assignment data. Try two endpoints:

```bash
# Test: get member info by bioguide (congress.gov is free, no API key needed)
curl -s "https://api.congress.gov/v3/member?api_key=DEMO_KEY&limit=1" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" | head -40

# Test: get committee membership
curl -s "https://api.congress.gov/v3/committee/house/HSWM?api_key=DEMO_KEY" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" | head -40
```

If the API returns historical committee assignment dates → write a script to automate collection.
If not → move to Step 2 (manual research).

**Step 2: Build committee_history.json via web research**

For each of the 72 members in `config/members.json`, look up when they first joined their current committee. Sources (in order of preference):
- Congress.gov member profiles (e.g., `congress.gov/member/jason-smith/S001195`)
- Ballotpedia articles
- News articles about committee assignments
- House.gov / Senate.gov committee pages

Use this format:

```json
{
  "members": [
    {
      "name": "Jason Smith",
      "fec_candidate_id": "H4MO08162",
      "committee": "ways_and_means",
      "chamber": "house",
      "first_congress": 114,
      "first_year": 2015,
      "role_current": "Chair",
      "notes": "Became chair in 118th Congress (2023)"
    }
  ]
}
```

Rules:
- `first_year` = the **January** of the Congress they joined (e.g., Congress 114 → 2015)
- If you can't determine the year, set `first_year` to `null` and add a `notes` explaining why
- Use most recent appointment if a member left and returned
- Map Congress number to year: Congress N starts in year `(N * 2) + 1787` (e.g., 118 → 2023, 114 → 2015)

**Step 3: Commit**

```bash
git add config/committee_history.json
git commit -m "data: add committee appointment history for 72 members"
```

---

## Task 2: Fetch Historical PAC Receipts from FEC API

**Files:**
- Create: `scripts/09_before_after.py`
- Output: `data/processed/historical_pac_receipts.csv`

**Step 1: Write the FEC API fetching portion of the script**

Create `scripts/09_before_after.py`. This step writes ONLY the data-fetching portion, not the analysis.

```python
#!/usr/bin/env python3
"""Step 09: Before/after committee appointment analysis.

Fetches historical PAC receipts from FEC API for all tracked members
across multiple election cycles, then analyzes whether PAC money increases
after members join the tax-writing committee.

Requires: config/members.json, config/committee_history.json
Outputs:
  - data/processed/historical_pac_receipts.csv (raw FEC API results)
  - output/before_after_summary.csv (analyzed results)
"""

import json
import sys
import time
import csv
from pathlib import Path

import requests
import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import (
    MEMBERS_FILE, CONFIG_DIR, PROCESSED_DIR, OUTPUT_DIR,
    FEC_API_BASE, FEC_API_KEY, FEC_API_RATE_DELAY,
)
from utils.checkpoint import is_step_complete, save_checkpoint, save_progress, load_progress

STEP_NAME = "09_before_after"
CYCLES = [2024, 2022, 2020, 2018, 2016, 2014]
HISTORY_FILE = CONFIG_DIR / "committee_history.json"


def load_members():
    """Load all tracked members from config/members.json."""
    with open(MEMBERS_FILE) as f:
        data = json.load(f)

    members = []
    for committee_key, committee_data in data.items():
        for m in committee_data["members"]:
            members.append({
                "name": m["name"],
                "fec_candidate_id": m.get("fec_candidate_id"),
                "party": m.get("party", ""),
                "state": m.get("state", ""),
                "chamber": committee_data["chamber"],
                "committee": committee_key,
            })
    return members


def load_committee_history():
    """Load committee appointment history."""
    if not HISTORY_FILE.exists():
        print(f"ERROR: {HISTORY_FILE} not found. Run Task 1 first.")
        sys.exit(1)

    with open(HISTORY_FILE) as f:
        data = json.load(f)
    return {m["fec_candidate_id"]: m for m in data["members"]}


def fetch_candidate_totals(candidate_id, cycle, api_key):
    """Fetch financial totals for a candidate in a given cycle from FEC API."""
    url = f"{FEC_API_BASE}/candidate/{candidate_id}/totals/"
    params = {"cycle": cycle, "api_key": api_key}

    backoff = 1
    for attempt in range(5):
        time.sleep(FEC_API_RATE_DELAY)
        try:
            resp = requests.get(url, params=params, timeout=30)
            if resp.status_code == 429:
                wait = min(backoff * 2 ** attempt, 60)
                print(f"    Rate limited. Waiting {wait}s...")
                time.sleep(wait)
                continue
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            results = resp.json().get("results", [])
            return results[0] if results else None
        except requests.exceptions.Timeout:
            print(f"    Timeout on attempt {attempt + 1}/5")
            time.sleep(backoff * 2 ** attempt)
        except requests.exceptions.HTTPError as e:
            if attempt == 4:
                print(f"    Failed after 5 retries: {e}")
                return None
            time.sleep(backoff * 2 ** attempt)

    return None


def fetch_all_historical_receipts(members):
    """Fetch PAC receipts for all members across all cycles.

    Uses checkpoint/progress system to resume if interrupted.
    """
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_DIR / "historical_pac_receipts.csv"

    # Load progress if resuming
    progress = load_progress(STEP_NAME)
    completed_keys = set(progress.get("completed_keys", []))

    # Load existing results if any
    rows = []
    if output_path.exists() and len(completed_keys) > 0:
        existing = pd.read_csv(output_path)
        rows = existing.to_dict("records")
        print(f"  Resuming: {len(completed_keys)} member-cycles already fetched")

    total_calls = len(members) * len(CYCLES)
    done = len(completed_keys)

    for member in members:
        cand_id = member["fec_candidate_id"]
        if not cand_id:
            print(f"  SKIP: {member['name']} — no FEC candidate ID")
            continue

        for cycle in CYCLES:
            key = f"{cand_id}_{cycle}"
            if key in completed_keys:
                continue

            done += 1
            print(f"  [{done}/{total_calls}] {member['name']} — {cycle}...", end=" ")

            totals = fetch_candidate_totals(cand_id, cycle, FEC_API_KEY)

            if totals:
                pac_receipts = totals.get("other_political_committee_contributions", 0) or 0
                total_receipts = totals.get("receipts", 0) or 0
                individual_itemized = totals.get("individual_itemized_contributions", 0) or 0
                print(f"PAC=${pac_receipts:,.0f}")
                rows.append({
                    "name": member["name"],
                    "fec_candidate_id": cand_id,
                    "party": member["party"],
                    "state": member["state"],
                    "chamber": member["chamber"],
                    "committee": member["committee"],
                    "cycle": cycle,
                    "pac_receipts": pac_receipts,
                    "total_receipts": total_receipts,
                    "individual_itemized": individual_itemized,
                })
            else:
                print("no data")

            completed_keys.add(key)

            # Save progress every 10 calls
            if len(completed_keys) % 10 == 0:
                df = pd.DataFrame(rows)
                df.to_csv(output_path, index=False)
                save_progress(STEP_NAME, "completed_keys", list(completed_keys))

    # Final save
    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    save_progress(STEP_NAME, "completed_keys", list(completed_keys))
    print(f"\n  Saved {len(rows)} records to {output_path}")
    return df


def analyze_before_after(receipts_df, history):
    """Join receipts with committee history and compute before/after stats."""
    results = []

    for cand_id, hist in history.items():
        first_year = hist.get("first_year")
        if first_year is None:
            continue

        member_data = receipts_df[receipts_df["fec_candidate_id"] == cand_id].copy()
        if member_data.empty:
            continue

        # Classify cycles: before, after, transition
        # A cycle covers the 2 years ending in that year.
        # If first_year=2015, the 2016 cycle is the transition cycle
        # (it covers 2015-2016, the year they joined).
        # "before" = cycles ending before first_year
        # "transition" = the cycle that contains first_year
        # "after" = cycles starting after first_year
        transition_cycle = first_year + (1 if first_year % 2 == 1 else 0)

        before = member_data[member_data["cycle"] < transition_cycle]
        after = member_data[member_data["cycle"] > transition_cycle]

        cycles_before = len(before)
        cycles_after = len(after)

        median_pac_before = before["pac_receipts"].median() if cycles_before > 0 else None
        median_pac_after = after["pac_receipts"].median() if cycles_after > 0 else None
        mean_pac_before = before["pac_receipts"].mean() if cycles_before > 0 else None
        mean_pac_after = after["pac_receipts"].mean() if cycles_after > 0 else None

        median_total_before = before["total_receipts"].median() if cycles_before > 0 else None
        median_total_after = after["total_receipts"].median() if cycles_after > 0 else None

        median_indiv_before = before["individual_itemized"].median() if cycles_before > 0 else None
        median_indiv_after = after["individual_itemized"].median() if cycles_after > 0 else None

        pct_change_pac = None
        if median_pac_before and median_pac_before > 0 and median_pac_after is not None:
            pct_change_pac = ((median_pac_after - median_pac_before) / median_pac_before) * 100

        pct_change_total = None
        if median_total_before and median_total_before > 0 and median_total_after is not None:
            pct_change_total = ((median_total_after - median_total_before) / median_total_before) * 100

        flag = ""
        if cycles_before == 0:
            flag = "no_before_data"
        elif cycles_after <= 1:
            flag = "limited_after_data"

        results.append({
            "name": hist["name"],
            "fec_candidate_id": cand_id,
            "party": hist.get("party", ""),
            "chamber": hist.get("chamber", ""),
            "committee": hist.get("committee", ""),
            "first_year": first_year,
            "transition_cycle": transition_cycle,
            "cycles_before": cycles_before,
            "cycles_after": cycles_after,
            "median_pac_before": median_pac_before,
            "median_pac_after": median_pac_after,
            "mean_pac_before": mean_pac_before,
            "mean_pac_after": mean_pac_after,
            "pct_change_pac": pct_change_pac,
            "median_total_before": median_total_before,
            "median_total_after": median_total_after,
            "pct_change_total": pct_change_total,
            "median_indiv_before": median_indiv_before,
            "median_indiv_after": median_indiv_after,
            "flag": flag,
        })

    return pd.DataFrame(results)


def print_headline_stats(summary_df):
    """Print the headline findings to console."""
    # Members with valid before/after comparison
    valid = summary_df[
        (summary_df["flag"] == "") &
        summary_df["pct_change_pac"].notna()
    ]

    if valid.empty:
        print("\n  No members with valid before/after comparison.")
        return

    n = len(valid)
    increased = (valid["pct_change_pac"] > 0).sum()
    median_change = valid["pct_change_pac"].median()
    mean_change = valid["pct_change_pac"].mean()

    print("\n" + "=" * 60)
    print("HEADLINE FINDINGS")
    print("=" * 60)
    print(f"  Members with before & after data: {n}")
    print(f"  Members whose PAC receipts INCREASED: {increased} of {n} ({increased/n*100:.0f}%)")
    print(f"  Median change in PAC receipts: {median_change:+.1f}%")
    print(f"  Mean change in PAC receipts: {mean_change:+.1f}%")

    # Control: total receipts change
    valid_total = valid[valid["pct_change_total"].notna()]
    if not valid_total.empty:
        median_total = valid_total["pct_change_total"].median()
        print(f"  Median change in TOTAL receipts (control): {median_total:+.1f}%")

    # Top 5 biggest increases
    top5 = valid.nlargest(5, "pct_change_pac")
    print(f"\n  Top 5 biggest PAC increases:")
    for _, row in top5.iterrows():
        print(f"    {row['name']}: {row['pct_change_pac']:+.0f}% "
              f"(before: ${row['median_pac_before']:,.0f}, after: ${row['median_pac_after']:,.0f})")

    print("=" * 60)


def main():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        if "--force" not in sys.argv:
            return

    print(f"\n{'='*60}")
    print("Step 09: Before/After Committee Appointment Analysis")
    print(f"{'='*60}\n")

    # Phase 1: Fetch historical data
    print("Phase 1: Fetching historical PAC receipts from FEC API...")
    members = load_members()
    print(f"  Loaded {len(members)} members")

    receipts_df = fetch_all_historical_receipts(members)

    # Phase 2: Analyze before/after
    print("\nPhase 2: Analyzing before/after committee appointment...")
    history = load_committee_history()
    print(f"  Loaded committee history for {len(history)} members")

    summary_df = analyze_before_after(receipts_df, history)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "before_after_summary.csv"
    summary_df.to_csv(output_path, index=False)
    print(f"  Saved {len(summary_df)} member summaries to {output_path}")

    print_headline_stats(summary_df)

    save_checkpoint(STEP_NAME, {
        "members_analyzed": len(summary_df),
        "receipts_fetched": len(receipts_df),
    })
    print(f"\nStep {STEP_NAME} complete.")


if __name__ == "__main__":
    main()
```

**Step 2: Run the script**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
export FEC_API_KEY=<key>
python scripts/09_before_after.py
```

Expected: ~432 API calls over ~8 minutes. Progress saved every 10 calls. If interrupted, re-running will resume from where it left off.

Expected output files:
- `data/processed/historical_pac_receipts.csv` — raw per-member, per-cycle data
- `output/before_after_summary.csv` — analyzed before/after comparison

**Step 3: Verify outputs**

```bash
head -5 data/processed/historical_pac_receipts.csv
head -5 output/before_after_summary.csv
wc -l output/before_after_summary.csv  # should be ~72 lines + header
```

**Step 4: Commit**

```bash
git add scripts/09_before_after.py data/processed/historical_pac_receipts.csv output/before_after_summary.csv
git commit -m "feat: add before/after committee PAC analysis (step 09)

Fetches historical PAC receipts for 72 members across 6 election
cycles via FEC API, then computes per-member before/after stats
relative to their committee appointment date."
```

---

## Task 3: Extend Import Script for Before/After Data

**Files:**
- Modify: `webapp/scripts/import-data.ts`
- Output: `webapp/data/before_after.json`

**Step 1: Add the import function to import-data.ts**

Add this function after the existing `importOneLiners()` function (around line 247):

```typescript
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
```

**Step 2: Add it to the main section**

In the main execution section (around line 347), add before the `datasets` array:

```typescript
// Import before/after analysis
const beforeAfter = importBeforeAfter();
if (beforeAfter) {
  writeFileSync(
    join(DATA_DIR, "before_after.json"),
    JSON.stringify(beforeAfter, null, 2)
  );
  console.log(`  before_after.json: ${beforeAfter.members.length} members, headline: ${beforeAfter.headline.median_pct_change?.toFixed(1)}% median change`);
}
```

**Step 3: Run import-data to verify**

```bash
cd webapp
npx tsx scripts/import-data.ts
```

Expected: `before_after.json: NN members, headline: X.X% median change` in output.

**Step 4: Commit**

```bash
git add webapp/scripts/import-data.ts webapp/data/before_after.json
git commit -m "feat: import before/after analysis data into webapp"
```

---

## Task 4: Add BeforeAfter Types and Data Loader

**Files:**
- Modify: `webapp/lib/data.ts`

**Step 1: Add the interface and loader**

Add after the existing `OneLiner` interface (around line 145):

```typescript
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
```

Add a loader function after the existing `getOneLinerForMember` function (around line 228):

```typescript
export function getBeforeAfter(): BeforeAfterData | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "before_after.json"), "utf-8");
    return JSON.parse(raw) as BeforeAfterData;
  } catch {
    return null;
  }
}
```

**Step 2: Commit**

```bash
git add webapp/lib/data.ts
git commit -m "feat: add BeforeAfter types and data loader"
```

---

## Task 5: Add "Committee Seat Premium" Section to PACs Page

**Files:**
- Modify: `webapp/app/pacs/page.tsx`

**Step 1: Add the import**

At the top of `webapp/app/pacs/page.tsx`, add `getBeforeAfter` and `BeforeAfterMember` to the imports from `@/lib/data`:

```typescript
import {
  getPacSpread,
  getSectorColors,
  getNews,
  getMembers,
  getBenchmarks,
  getBeforeAfter,
  PacSpreadEntry,
  BeforeAfterMember,
} from "@/lib/data";
import { formatMoney, formatPct, memberSlug } from "@/lib/utils";
```

**Step 2: Load the data in the component**

Inside the `PacsPage` component function, after `const benchmarks = getBenchmarks();` (line 217), add:

```typescript
const beforeAfter = getBeforeAfter();
```

**Step 3: Add the "Committee Seat Premium" section**

Insert this new section AFTER the benchmark section (after line 457, the closing `{benchmarks && (` section) and BEFORE the `{/* Charts */}` comment:

```tsx
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
            <p className="text-xs text-stone-500 mb-5 max-w-2xl leading-relaxed">
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
                                ({m.party}-{m.chamber === "senate" ? m.committee.includes("finance") ? "Sen" : "Sen" : "House"})
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-stone-500 tabular-nums">
                              {m.first_year}
                            </td>
                            <td className="px-4 py-2.5 text-right text-stone-500 tabular-nums">
                              {m.median_pac_before != null ? formatMoney(m.median_pac_before) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-[#111111] tabular-nums">
                              {m.median_pac_after != null ? formatMoney(m.median_pac_after) : "—"}
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

            <p className="text-[10px] text-stone-400 mt-2 max-w-2xl leading-relaxed">
              Based on {headline.valid_members} members with at least one election
              cycle before and after their committee appointment. Median PAC
              receipts compared across cycles 2014–2024. The cycle of appointment
              is excluded from both groups. Members appointed before 2014 are
              excluded due to insufficient pre-appointment data.
            </p>
          </section>
        );
      })()}
```

**Step 4: Verify the dev server renders correctly**

```bash
cd webapp
npm run dev
```

Open `http://localhost:3000/pacs` and check that the new "Committee Seat Premium" section appears between the benchmark section and the charts.

**Step 5: Commit**

```bash
git add webapp/app/pacs/page.tsx
git commit -m "feat: add 'Committee Seat Premium' before/after section to PACs page"
```

---

## Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the project structure section**

Add `committee_history.json` to the config section in the file tree:

```
│   ├── committee_history.json # Member committee appointment dates (first_congress, first_year)
```

Add step 09 to the scripts section:

```
│   ├── 09_before_after.py     # Before/after committee appointment PAC analysis
```

Add to the output section:

```
│   ├── before_after_summary.csv  # Per-member before/after PAC comparison
```

Add to the webapp data section:

```
│       ├── before_after.json  # Before/after committee analysis (headline + per-member)
```

**Step 2: Update the pipeline steps list**

Add step 9 to the pipeline steps documentation:

```
9. Fetch historical PAC receipts via FEC API and analyze before/after committee appointment
```

**Step 3: Update the Key Files table**

Add:

```
| `config/committee_history.json` | Committee appointment dates for all 72 members (first_congress, first_year) |
| `scripts/09_before_after.py` | Fetches historical PAC receipts, computes before/after analysis |
```

**Step 4: Update the webapp data loaders reference**

Update the data.ts description to mention the new export:

```
| `webapp/lib/data.ts` | Server-side data loaders: getMembers, getMemberBySlug, getPacSpread, getBenchmarks, getNews, getSectorColors, getBeforeAfter, etc. (14 exports) |
```

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with before/after analysis references"
```

---

## Execution Order & Dependencies

```
Task 1 (committee_history.json) ← no dependencies, can start immediately
Task 2 (09_before_after.py + API calls) ← depends on Task 1
Task 3 (import-data.ts) ← depends on Task 2 output
Task 4 (data.ts types + loader) ← no code dependency, can parallel with Task 3
Task 5 (pacs page section) ← depends on Tasks 3 and 4
Task 6 (CLAUDE.md) ← depends on all above being done
```

```
Task 1 → Task 2 → Task 3 ─┐
                   Task 4 ─┤→ Task 5 → Task 6
```
