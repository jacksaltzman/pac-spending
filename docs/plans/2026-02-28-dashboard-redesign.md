# Dashboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the dashboard to lead with findings instead of methodology, add a geographic breakdown chart, and cut the weak committee comparison table.

**Architecture:** Replace 4 stat cards with finding-based cards using existing data loaders (benchmarks, before_after, pacSpread). Add a new `GeoBreakdownChart.tsx` client component using Recharts. Enhance the Top PACs table with sector color dots. Remove committee comparison table.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Recharts

---

## Task 1: Create GeoBreakdownChart Component

**Files:**
- Create: `webapp/components/GeoBreakdownChart.tsx`

**Step 1: Create the component**

A `"use client"` Recharts horizontal stacked bar chart showing where the money comes from. Single bar, 4 segments. Follow PacCharts.tsx patterns.

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

interface GeoBreakdownChartProps {
  inDistrict: number;
  inStateOutDistrict: number;
  dcKStreet: number;
  outOfState: number;
}

const GEO_COLORS = {
  inDistrict: "#4C6971",
  inState: "#7C9FA8",
  dcKStreet: "#F59E0B",
  outOfState: "#FE4F40",
};

export default function GeoBreakdownChart({
  inDistrict,
  inStateOutDistrict,
  dcKStreet,
  outOfState,
}: GeoBreakdownChartProps) {
  const data = [
    {
      label: "Average Member",
      inDistrict,
      inState: inStateOutDistrict,
      dcKStreet,
      outOfState,
    },
  ];

  return (
    <div>
      <div className="h-[80px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            barSize={40}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: "#78716c" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis type="category" dataKey="label" hide />
            <Tooltip
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  inDistrict: "In-District",
                  inState: "In-State (Outside District)",
                  dcKStreet: "DC / K-Street",
                  outOfState: "Out of State",
                };
                return [`${Number(value).toFixed(1)}%`, labels[name] || name];
              }}
              contentStyle={{
                backgroundColor: "#111",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e7e5e4",
              }}
            />
            <Bar dataKey="inDistrict" stackId="geo" fill={GEO_COLORS.inDistrict} radius={[4, 0, 0, 4]} />
            <Bar dataKey="inState" stackId="geo" fill={GEO_COLORS.inState} />
            <Bar dataKey="dcKStreet" stackId="geo" fill={GEO_COLORS.dcKStreet} />
            <Bar dataKey="outOfState" stackId="geo" fill={GEO_COLORS.outOfState} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
        {[
          { label: "In-District", color: GEO_COLORS.inDistrict, pct: inDistrict },
          { label: "In-State", color: GEO_COLORS.inState, pct: inStateOutDistrict },
          { label: "DC / K-Street", color: GEO_COLORS.dcKStreet, pct: dcKStreet },
          { label: "Out of State", color: GEO_COLORS.outOfState, pct: outOfState },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs text-stone-600">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            {item.label}: <strong className="text-[#111111]">{item.pct.toFixed(0)}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add webapp/components/GeoBreakdownChart.tsx
git commit -m "feat: add GeoBreakdownChart component for dashboard

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Redesign Dashboard Page

**Files:**
- Modify: `webapp/app/page.tsx`

This is the main task. All changes happen in this one file.

**Step 1: Update imports**

Replace the current imports with:

```typescript
import {
  getMembers,
  getCommitteeAggregates,
  getPacSpread,
  getBenchmarks,
  getBeforeAfter,
  getSectorColors,
} from "@/lib/data";
import { formatMoney, formatPct } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import MemberCard from "@/components/MemberCard";
import EmptyState from "@/components/EmptyState";
import GeoBreakdownChart from "@/components/GeoBreakdownChart";
```

**Step 2: Update derived data**

Keep the existing `activeMembersWithData`, `pacPremiumPct`, `mostOutside`, `mostLocal`, `topPacs` computations.

Add these new computations after the existing ones:

```typescript
  const beforeAfter = getBeforeAfter();
  const sectorColors = getSectorColors();

  /* Before/after stat: median PAC increase after joining committee */
  const medianPacIncrease = beforeAfter?.headline.median_pct_change ?? null;

  /* Broadest-reach PAC */
  const broadestPac = topPacs[0]; // already sorted by num_recipients desc

  /* Geographic averages for chart */
  const avgInDistrict =
    activeMembersWithData.reduce((s, m) => s + m.pct_in_district, 0) / memberCount;
  const avgInStateOutDistrict =
    activeMembersWithData.reduce((s, m) => s + m.pct_in_state_out_district, 0) / memberCount;
  const avgDcKStreet =
    activeMembersWithData.reduce((s, m) => s + m.pct_dc_kstreet, 0) / memberCount;
  const avgOutOfState =
    activeMembersWithData.reduce((s, m) => s + m.pct_out_of_state, 0) / memberCount;
```

Remove the `comparisonRows` computation (the committee comparison table is being cut).

**Step 3: Tighten the "Why This Matters" section**

Replace the existing "Why This Matters" section (the `<section className="mb-10 max-w-5xl">` block) with:

```tsx
      {/* ── Introduction / Why This Matters ───────────── */}
      <section className="mb-10 max-w-5xl">
        <div className="border-l-4 border-[#FE4F40] pl-5 py-1">
          <h2
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Why This Matters
          </h2>
          <p className="text-[15px] text-[#111111] leading-relaxed mb-3">
            The House Ways &amp; Means Committee and the Senate Finance Committee
            write the tax code &mdash; every deduction, credit, and loophole passes
            through them. That power attracts money.{" "}
            {pacPremiumPct != null && (
              <>
                The median Ways &amp; Means member received{" "}
                <strong className="text-[#FE4F40]">
                  {pacPremiumPct}% more PAC money
                </strong>{" "}
                than the median House incumbent in the 2024 cycle.{" "}
              </>
            )}
            PACs representing finance, healthcare, energy, and real estate
            concentrate their spending on these committees, funding members on
            both sides of the aisle to guarantee access no matter who holds the
            gavel.
          </p>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Source: FEC all-candidates summary and bulk contribution records,
            2024 election cycle. Analysis by Accountable.
          </p>
        </div>
      </section>
```

**Step 4: Replace stat cards**

Replace the existing stat cards section with:

```tsx
      {/* ── Top-line stats ──────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="PAC Premium"
          value={pacPremiumPct != null ? `+${pacPremiumPct}%` : "—"}
          detail="More PAC $ than typical House incumbents"
          accent="#FE4F40"
        />
        <StatCard
          label="Committee Seat Effect"
          value={medianPacIncrease != null ? `+${Math.round(medianPacIncrease)}%` : "—"}
          detail="Median PAC increase after joining"
          accent="#FE4F40"
        />
        <StatCard
          label="Median Outside Funding"
          value={formatPct(medianOutside)}
          detail="From outside their home state or district"
          accent="#F59E0B"
        />
        <StatCard
          label="Broadest-Reach PAC"
          value={broadestPac ? `${broadestPac.num_recipients} members` : "—"}
          detail={broadestPac ? broadestPac.connected_org || broadestPac.pac_name.split(" PAC")[0] : ""}
          smallValue
        />
      </section>
```

**Step 5: Add geographic breakdown chart**

Insert this section between the stat cards and the member rankings:

```tsx
      {/* ── Where the Money Comes From ────────────────── */}
      <section className="mb-10">
        <h2
          className="text-xs text-stone-500 uppercase tracking-[0.2em] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Where the Money Comes From
        </h2>
        <p className="text-xs text-stone-500 mb-4 max-w-4xl leading-relaxed">
          On average, only{" "}
          <strong className="text-[#111111]">
            {Math.round(avgInDistrict + avgInStateOutDistrict)}%
          </strong>{" "}
          of a tax-writing committee member&apos;s itemized contributions come
          from their own state. The majority arrives from out of state entirely.
        </p>
        <div className="bg-white rounded-lg border border-[#C8C1B6]/50 p-5">
          <GeoBreakdownChart
            inDistrict={avgInDistrict}
            inStateOutDistrict={avgInStateOutDistrict}
            dcKStreet={avgDcKStreet}
            outOfState={avgOutOfState}
          />
        </div>
      </section>
```

**Step 6: Remove the committee comparison table**

Delete the entire `{/* ── Committee Comparison ──── */}` section (the `{comparisonRows.length > 0 && (...)}` block). This includes the `comparisonRows` variable — make sure to also remove `houseAgg`, `senateAgg`, and `comparisonRows` from the derived data section.

Keep `allMembersAgg` since it's used for `medianOutside` and `meanDc`.

**Step 7: Enhance Top PACs table with sector dots**

In the Top PACs table, add a sector column. Replace the table's `<thead>` and `<tbody>` with:

```tsx
              <thead>
                <tr className="border-b border-[#C8C1B6]/50">
                  <th
                    className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium w-8"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    #
                  </th>
                  <th
                    className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    PAC Name
                  </th>
                  <th
                    className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Sector
                  </th>
                  <th
                    className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Total Given
                  </th>
                  <th
                    className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-stone-500 font-medium"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Members Funded
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPacs.map((pac, i) => (
                  <tr
                    key={`${pac.pac_cmte_id}-${i}`}
                    className="border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors"
                  >
                    <td className="py-3 px-4 text-stone-400 text-xs">
                      {i + 1}
                    </td>
                    <td className="py-3 px-4 text-[#111111]">
                      {pac.connected_org || pac.pac_name}
                    </td>
                    <td className="py-3 px-4">
                      {pac.sector && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: sectorColors[pac.sector] || "#9CA3AF",
                            }}
                          />
                          {pac.sector}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-[#111111]">
                      {formatMoney(pac.total_given)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#FE4F40] font-semibold">
                      {pac.num_recipients}
                    </td>
                  </tr>
                ))}
              </tbody>
```

**Step 8: Verify compilation**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution/webapp" && npx tsc --noEmit
```

**Step 9: Commit**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
git add webapp/app/page.tsx
git commit -m "feat: redesign dashboard with findings-first stat cards and geo chart

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the Dashboard page architecture section**

Find the `### Dashboard (/)` section and replace its description with:

```
Server component. Title: "Who Really Writes American Tax Policy?"
- **Introduction section** ("Why This Matters") with coral left-border accent, leads with +66% PAC premium stat
- Finding-based stat cards: PAC premium (+66%), committee seat effect (+51%), median outside funding, broadest-reach PAC
- Geographic breakdown chart (GeoBreakdownChart) — stacked bar showing avg in-district / in-state / DC / out-of-state split
- Member rankings: most outside-funded and most locally-funded (top 5 each, MemberCard components)
- Top PACs by reach table (top 10, with sector color dots)
```

**Step 2: Add GeoBreakdownChart to components in the project tree**

Add `│   │   ├── GeoBreakdownChart.tsx  # Geographic funding stacked bar chart`

**Step 3: Commit**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for dashboard redesign

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Execution Order

```
Task 1 (GeoBreakdownChart.tsx) ← no dependencies
Task 2 (page.tsx redesign) ← depends on Task 1
Task 3 (CLAUDE.md) ← depends on Task 2
```
