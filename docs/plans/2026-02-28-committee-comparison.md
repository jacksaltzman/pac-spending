# Cross-Committee PAC Comparison — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compare PAC receipts across 5 House committees (Ways & Means + 4 others) to show whether tax-writing committees are uniquely PAC-funded or if all powerful committees attract similar money.

**Architecture:** Curate committee rosters via web research, cross-reference against the existing FEC all-candidates summary file (webl24.txt) to compute median PAC receipts per committee, display as a horizontal bar chart on the PACs page.

**Tech Stack:** Python 3.11+, pandas; Next.js 16, TypeScript, Tailwind v4, Recharts

---

## Task 1: Curate Committee Rosters

**Files:**
- Create: `config/comparison_committees.json`

**Step 1: Build the roster JSON**

Use web search to find the current (119th Congress, 2025-2026) membership of these 4 House committees:
- House Armed Services Committee (~55-60 members)
- House Appropriations Committee (~55-60 members)
- House Energy & Commerce Committee (~50-55 members)
- House Financial Services Committee (~55-60 members)

Good sources: house.gov committee pages, Wikipedia "119th Congress committee" articles.

Create `config/comparison_committees.json`:

```json
{
  "_description": "House committee rosters for cross-committee PAC comparison (119th Congress)",
  "committees": {
    "Armed Services": {
      "code": "HSAS",
      "members": [
        "ROGERS, MIKE D",
        "WITTMAN, ROBERT J",
        ...
      ]
    },
    "Appropriations": {
      "code": "HSAP",
      "members": [
        "COLE, TOM",
        ...
      ]
    },
    "Energy & Commerce": {
      "code": "HSIF",
      "members": [
        "MCMORRIS RODGERS, CATHY",
        ...
      ]
    },
    "Financial Services": {
      "code": "HSBA",
      "members": [
        "HILL, J FRENCH",
        ...
      ]
    }
  }
}
```

**IMPORTANT:** Member names MUST match the format in `data/raw/webl_2024/webl24.txt` which uses `LASTNAME, FIRSTNAME` (uppercase). After building the roster, verify matches:

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
python3 -c "
import json
with open('config/comparison_committees.json') as f:
    rosters = json.load(f)
with open('data/raw/webl_2024/webl24.txt') as f:
    lines = f.readlines()
# Build name lookup from webl24
webl_names = {}
for line in lines:
    fields = line.strip().split('|')
    if len(fields) >= 26 and fields[0].startswith('H') and fields[2] == 'I':
        webl_names[fields[1].upper()] = fields
for committee, info in rosters['committees'].items():
    matched = 0
    unmatched = []
    for name in info['members']:
        # Try exact match first, then last-name-starts-with
        if name in webl_names:
            matched += 1
        else:
            # Fuzzy: match by last name
            last = name.split(',')[0]
            found = [n for n in webl_names if n.startswith(last + ',')]
            if found:
                matched += 1
                # Update the name in the roster to match
            else:
                unmatched.append(name)
    print(f'{committee}: {matched}/{len(info[\"members\"])} matched, unmatched: {unmatched[:5]}')
"
```

Fix any unmatched names by checking alternate name formats in webl24.txt. Target: 90%+ match rate per committee.

**Step 2: Commit**

```bash
git add config/comparison_committees.json
git commit -m "data: add committee rosters for cross-committee PAC comparison

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Write Comparison Script

**Files:**
- Create: `scripts/12_committee_comparison.py`
- Output: `output/committee_comparison.csv`

**Step 1: Write the script**

```python
#!/usr/bin/env python3
"""Step 12: Cross-committee PAC comparison.

Compares median PAC receipts across House committees using
FEC all-candidates summary data (webl24.txt).

webl24.txt column layout (pipe-delimited, 30 fields):
  [0]  CAN_ID
  [1]  CAN_NAME (LASTNAME, FIRSTNAME format)
  [2]  ICO (I=incumbent, C=challenger, O=open)
  [5]  TOT_RECEIPTS
  [17] TOT_INDIV_CONTRIB
  [18] CAN_OFF_ST (state)
  [25] OTH_POL_CMTE_CONTRIB (= PAC money)

Outputs:
  - output/committee_comparison.csv
"""

import json
import sys
import statistics
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import CONFIG_DIR, OUTPUT_DIR

WEBL_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "webl_2024" / "webl24.txt"
MEMBERS_PATH = CONFIG_DIR / "members.json"


def parse_webl24():
    """Parse webl24.txt into dict keyed by candidate name."""
    candidates = {}
    with open(WEBL_PATH) as f:
        for line in f:
            fields = line.strip().split("|")
            if len(fields) < 26:
                continue
            # House incumbents only
            if not fields[0].startswith("H") or fields[2] != "I":
                continue
            name = fields[1].upper().strip()
            try:
                pac = float(fields[25]) if fields[25] else 0
                receipts = float(fields[5]) if fields[5] else 0
            except ValueError:
                continue
            candidates[name] = {
                "can_id": fields[0],
                "name": name,
                "party": fields[4],
                "state": fields[18],
                "pac": pac,
                "receipts": receipts,
            }
    return candidates


def match_roster(roster_names, candidates):
    """Match roster names against webl24 candidates. Returns matched entries."""
    matched = []
    unmatched = []
    for name in roster_names:
        name_upper = name.upper().strip()
        if name_upper in candidates:
            matched.append(candidates[name_upper])
            continue
        # Fuzzy: match by last name prefix
        last = name_upper.split(",")[0]
        found = [c for n, c in candidates.items() if n.startswith(last + ",")]
        if len(found) == 1:
            matched.append(found[0])
        else:
            unmatched.append(name)
    return matched, unmatched


def get_ways_and_means_ids():
    """Get FEC candidate IDs for Ways & Means members from config/members.json."""
    with open(MEMBERS_PATH) as f:
        members = json.load(f)
    return {
        m["fec_candidate_id"]
        for m in members
        if m.get("committee") in ("ways_and_means", "House Ways and Means")
        and m.get("chamber") == "house"
        and m.get("fec_candidate_id")
    }


def compute_stats(entries):
    """Compute median/mean PAC and receipts."""
    pacs = [e["pac"] for e in entries]
    receipts = [e["receipts"] for e in entries]
    if not pacs:
        return {}
    return {
        "count": len(pacs),
        "median_pac": round(statistics.median(pacs)),
        "mean_pac": round(statistics.mean(pacs)),
        "median_receipts": round(statistics.median(receipts)),
        "mean_receipts": round(statistics.mean(receipts)),
    }


def main():
    print(f"\n{'='*60}")
    print("Step 12: Cross-Committee PAC Comparison")
    print(f"{'='*60}\n")

    candidates = parse_webl24()
    print(f"  Parsed {len(candidates)} House incumbents from webl24.txt")

    # Ways & Means (from our existing members.json)
    wm_ids = get_ways_and_means_ids()
    wm_entries = [c for c in candidates.values() if c["can_id"] in wm_ids]
    print(f"  Ways & Means: {len(wm_entries)} matched from members.json")

    # All House incumbents baseline
    all_entries = list(candidates.values())

    # Comparison committees from roster
    roster_path = CONFIG_DIR / "comparison_committees.json"
    if not roster_path.exists():
        print(f"  ERROR: {roster_path} not found")
        return

    with open(roster_path) as f:
        rosters = json.load(f)

    results = []

    # Ways & Means first
    wm_stats = compute_stats(wm_entries)
    wm_stats["committee"] = "Ways & Means"
    results.append(wm_stats)
    print(f"  Ways & Means: median PAC = ${wm_stats['median_pac']:,}")

    # Comparison committees
    for committee, info in rosters["committees"].items():
        matched, unmatched = match_roster(info["members"], candidates)
        stats = compute_stats(matched)
        stats["committee"] = committee
        match_rate = len(matched) / len(info["members"]) * 100 if info["members"] else 0
        results.append(stats)
        print(f"  {committee}: {len(matched)}/{len(info['members'])} matched ({match_rate:.0f}%), "
              f"median PAC = ${stats.get('median_pac', 0):,}")
        if unmatched:
            print(f"    Unmatched: {', '.join(unmatched[:5])}")

    # All incumbents baseline
    all_stats = compute_stats(all_entries)
    all_stats["committee"] = "All House Incumbents"
    results.append(all_stats)
    print(f"  All House Incumbents: median PAC = ${all_stats['median_pac']:,}")

    # Output
    import pandas as pd
    df = pd.DataFrame(results)
    cols = ["committee", "count", "median_pac", "mean_pac", "median_receipts", "mean_receipts"]
    df = df[cols]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_DIR / "committee_comparison.csv", index=False)
    print(f"\n  Saved: output/committee_comparison.csv")

    # Headline
    wm_med = wm_stats["median_pac"]
    all_med = all_stats["median_pac"]
    print(f"\n  HEADLINE: Ways & Means median PAC (${wm_med:,}) vs All Incumbents (${all_med:,})")
    print(f"  Premium: +{((wm_med - all_med) / all_med * 100):.0f}%")
    for r in results:
        if r["committee"] not in ("Ways & Means", "All House Incumbents"):
            other_med = r["median_pac"]
            diff = ((wm_med - other_med) / other_med * 100) if other_med else 0
            print(f"  vs {r['committee']}: ${other_med:,} (W&M is +{diff:.0f}% more)")


if __name__ == "__main__":
    main()
```

**Step 2: Run the script**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
python3 scripts/12_committee_comparison.py
```

**Step 3: Commit**

```bash
git add scripts/12_committee_comparison.py output/committee_comparison.csv
git commit -m "feat: cross-committee PAC comparison (step 12)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Import Data + Types + Loader

**Files:**
- Modify: `webapp/scripts/import-data.ts`
- Modify: `webapp/lib/data.ts`
- Output: `webapp/data/committee_comparison.json`

**Step 1: Add import function to import-data.ts**

After the existing `importIndustryInfluence()` function, add:

```typescript
function importCommitteeComparison() {
  const rows = readCSV("committee_comparison.csv");
  if (!rows) return null;

  return rows.map((r) => ({
    committee: r.committee,
    count: toNumber(r.count) ?? 0,
    median_pac: toNumber(r.median_pac) ?? 0,
    mean_pac: toNumber(r.mean_pac) ?? 0,
    median_receipts: toNumber(r.median_receipts) ?? 0,
    mean_receipts: toNumber(r.mean_receipts) ?? 0,
  }));
}
```

Add invocation in the main block:

```typescript
const committeeComparison = importCommitteeComparison();
if (committeeComparison) {
  writeFileSync(
    join(DATA_DIR, "committee_comparison.json"),
    JSON.stringify(committeeComparison, null, 2)
  );
  console.log(`  committee_comparison.json: ${committeeComparison.length} committees`);
}
```

**Step 2: Add types and loader to data.ts**

After the `IndustryInfluenceData` interface, add:

```typescript
export interface CommitteeComparisonEntry {
  committee: string;
  count: number;
  median_pac: number;
  mean_pac: number;
  median_receipts: number;
  mean_receipts: number;
}
```

Add loader at end of file:

```typescript
export function getCommitteeComparison(): CommitteeComparisonEntry[] {
  try {
    const raw = readFileSync(join(DATA_DIR, "committee_comparison.json"), "utf-8");
    return JSON.parse(raw) as CommitteeComparisonEntry[];
  } catch {
    return [];
  }
}
```

**Step 3: Run import**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution/webapp"
npx tsx scripts/import-data.ts
```

**Step 4: Commit**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
git add webapp/scripts/import-data.ts webapp/lib/data.ts webapp/data/committee_comparison.json
git commit -m "feat: import committee comparison data + types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Build CommitteeComparisonChart Component

**Files:**
- Create: `webapp/components/CommitteeComparisonChart.tsx`

**Step 1: Create the component**

A horizontal bar chart showing median PAC receipts by committee. Ways & Means highlighted in coral, others in neutral tones, "All Incumbents" baseline in light gray.

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { CommitteeComparisonEntry } from "@/lib/data";

interface CommitteeComparisonChartProps {
  committees: CommitteeComparisonEntry[];
}

function formatDollarsShort(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default function CommitteeComparisonChart({
  committees,
}: CommitteeComparisonChartProps) {
  // Sort: Ways & Means first, then by median_pac desc, All Incumbents last
  const sorted = [...committees].sort((a, b) => {
    if (a.committee === "Ways & Means") return -1;
    if (b.committee === "Ways & Means") return 1;
    if (a.committee === "All House Incumbents") return 1;
    if (b.committee === "All House Incumbents") return -1;
    return b.median_pac - a.median_pac;
  });

  const data = sorted.map((c) => ({
    name: c.committee,
    medianPac: c.median_pac,
    count: c.count,
  }));

  if (data.length === 0) return null;

  return (
    <div>
      <div style={{ height: Math.max(200, data.length * 52) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 5, bottom: 5 }}
            barCategoryGap="25%"
          >
            <XAxis
              type="number"
              tickFormatter={formatDollarsShort}
              tick={{ fontSize: 11, fill: "#78716c" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={170}
              tick={{ fontSize: 12, fill: "#44403c" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [formatDollarsShort(value), "Median PAC $"]}
              contentStyle={{
                backgroundColor: "#111",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e7e5e4",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({} as any)}
            />
            <Bar dataKey="medianPac" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.name === "Ways & Means"
                      ? "#FE4F40"
                      : entry.name === "All House Incumbents"
                        ? "#D6D3D1"
                        : "#4C6971"
                  }
                  fillOpacity={entry.name === "All House Incumbents" ? 0.6 : 0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-stone-400 mt-2">
        Median PAC contributions per committee member. House incumbents only, 2024 cycle.
        Source: FEC all-candidates summary.
      </p>
    </div>
  );
}
```

Note: The Tooltip may need an `as never` cast on the formatter like other charts in this project. Fix any TypeScript issues.

**Step 2: Commit**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
git add webapp/components/CommitteeComparisonChart.tsx
git commit -m "feat: add CommitteeComparisonChart component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Integrate into PACs Page

**Files:**
- Modify: `webapp/app/pacs/page.tsx`

**Step 1: Add imports**

Add `getCommitteeComparison` to the data import from `@/lib/data`.
Add `import CommitteeComparisonChart from "@/components/CommitteeComparisonChart";`

**Step 2: Load data**

In the function body, add:
```typescript
const committeeComparison = getCommitteeComparison();
```

**Step 3: Replace or enhance the existing benchmarks section**

Find the existing "Do Tax-Writers Get More PAC Money?" section on the PACs page. Replace its content with the new chart. The new section should be:

```tsx
      {/* ── Cross-Committee Comparison ─────────────────── */}
      {committeeComparison.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Do Tax-Writers Get More PAC Money?
          </h2>
          {(() => {
            const wm = committeeComparison.find((c) => c.committee === "Ways & Means");
            const allInc = committeeComparison.find((c) => c.committee === "All House Incumbents");
            const others = committeeComparison.filter(
              (c) => c.committee !== "Ways & Means" && c.committee !== "All House Incumbents"
            );
            const topOther = others.sort((a, b) => b.median_pac - a.median_pac)[0];
            return (
              <p className="text-xs text-stone-500 mb-5 max-w-4xl leading-relaxed">
                {wm && allInc && (
                  <>
                    The median Ways &amp; Means member received{" "}
                    <strong className="text-[#111111]">
                      {formatMoney(wm.median_pac)}
                    </strong>{" "}
                    in PAC contributions &mdash;{" "}
                    <strong className="text-[#FE4F40]">
                      {Math.round(((wm.median_pac - allInc.median_pac) / allInc.median_pac) * 100)}%
                      more
                    </strong>{" "}
                    than the typical House incumbent ({formatMoney(allInc.median_pac)})
                    {topOther && (
                      <>
                        {" "}and {Math.round(((wm.median_pac - topOther.median_pac) / topOther.median_pac) * 100)}%
                        more than {topOther.committee} ({formatMoney(topOther.median_pac)})
                      </>
                    )}
                    . Tax-writing committees don&apos;t just attract more money than average
                    &mdash; they attract more than other powerful committees too.
                  </>
                )}
              </p>
            );
          })()}
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
            <CommitteeComparisonChart committees={committeeComparison} />
          </div>
        </section>
      )}
```

Remove the old benchmarks section that this replaces (the existing "Do Tax-Writers Get More PAC Money?" section with the simple House vs All Incumbents bar comparison).

**Step 4: Verify compilation**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution/webapp" && npx tsc --noEmit
```

**Step 5: Commit**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
git add webapp/app/pacs/page.tsx
git commit -m "feat: replace benchmarks with cross-committee PAC comparison on PACs page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add new file references**

- Add `config/comparison_committees.json` to the config section in the tree
- Add `scripts/12_committee_comparison.py` to the scripts section
- Add step 12 to pipeline steps: "Compare PAC receipts across House committees (Ways & Means vs Armed Services, Appropriations, Energy & Commerce, Financial Services)"
- Add `webapp/data/committee_comparison.json` to webapp data section
- Add `webapp/components/CommitteeComparisonChart.tsx` to components section
- Add entries to Key Files table
- Update data.ts export count
- Update PACs page architecture to mention the cross-committee comparison chart

**Step 2: Commit**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for cross-committee comparison feature

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Execution Order

```
Task 1 (rosters) ← no dependencies
Task 2 (comparison script) ← depends on Task 1
Task 3 (import + types) ← depends on Task 2
Task 4 (chart component) ← no dependencies, can parallel with Tasks 1-3
Task 5 (PACs page) ← depends on Tasks 3, 4
Task 6 (CLAUDE.md) ← depends on Task 5
```

```
Task 1 → Task 2 → Task 3 ─┐
                   Task 4 ─┤→ Task 5 → Task 6
```
