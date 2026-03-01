# Tufte Visual Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply Tufte's data visualization principles across the entire webapp — reducing chartjunk, increasing data-ink ratio, replacing problematic charts, and adding small multiples and sparklines.

**Architecture:** Pure frontend changes across ~15 existing files + 1 new component. No data pipeline or JSON changes needed. All existing data structures are sufficient.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Recharts (kept for scatter/bar charts, removed for timing), custom CSS for new visualizations.

---

### Task 1: Global Chrome Reduction — StatCard

**Files:**
- Modify: `webapp/components/StatCard.tsx`

**Step 1: Remove card border and background**

Replace the card container class from:
```tsx
<div className="bg-white rounded-lg border border-[#C8C1B6]/50 p-5">
```
to:
```tsx
<div className="py-3">
```

The full updated file:
```tsx
interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
  smallValue?: boolean;
}

export default function StatCard({ label, value, detail, accent, smallValue }: StatCardProps) {
  return (
    <div className="py-3">
      <p
        className="text-xs uppercase tracking-widest text-stone-600 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {label}
      </p>
      <p
        className={`${smallValue ? "text-base" : "text-2xl"} font-bold tracking-tight`}
        style={{ fontFamily: "var(--font-display)", color: accent || "#111111" }}
      >
        {value}
      </p>
      {detail && (
        <p className="text-xs text-stone-500 mt-2">{detail}</p>
      )}
    </div>
  );
}
```

**Step 2: Verify dev server shows borderless stat cards**

Run: dev server, check `/` and `/pacs` pages.
Expected: Stat cards no longer have white background/border, flow naturally in the page.

**Step 3: Commit**
```bash
git add webapp/components/StatCard.tsx
git commit -m "style: remove card chrome from StatCard (Tufte data-ink ratio)"
```

---

### Task 2: Global Chrome Reduction — MemberCard

**Files:**
- Modify: `webapp/components/MemberCard.tsx`

**Step 1: Lighten MemberCard chrome**

Change line 47 container from:
```tsx
className="block bg-white rounded-lg border border-[#C8C1B6]/50 p-4 hover:border-[#C8C1B6] transition-all group"
```
to:
```tsx
className="block border-b border-stone-200 py-3 px-1 hover:bg-stone-50 transition-colors group"
```

This replaces the card-per-member pattern with a compact list-item pattern separated by thin bottom borders.

**Step 2: Verify on dashboard**

Check `/` page — the Most Outside-Funded and Most Locally-Funded sections should show members as a compact list rather than stacked cards.

**Step 3: Commit**
```bash
git add webapp/components/MemberCard.tsx
git commit -m "style: lighten MemberCard chrome to list-item style"
```

---

### Task 3: Global Chrome Reduction — PacCharts card wrappers

**Files:**
- Modify: `webapp/components/PacCharts.tsx`

**Step 1: Remove card wrappers from all three chart sections**

For each of the three sections, change the wrapper div from:
```tsx
<div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5">
```
to:
```tsx
<div>
```

There are three instances — lines 102, 142, and 202. Remove all three.

**Step 2: Remove CartesianGrid from scatter plot**

Delete line 145:
```tsx
<CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
```

Also remove `CartesianGrid` from the import statement.

**Step 3: Remove rounded bar ends**

On line 117, change:
```tsx
<Bar dataKey="total" radius={[0, 4, 4, 0]}>
```
to:
```tsx
<Bar dataKey="total" radius={0}>
```

On line 226, change:
```tsx
<Bar dataKey="dTotal" stackId="party" fill="#3B82F6" radius={[0, 4, 4, 0]} />
```
to:
```tsx
<Bar dataKey="dTotal" stackId="party" fill="#3B82F6" radius={0} />
```

**Step 4: Remove Legend from party split chart**

Delete lines 219-224:
```tsx
<Legend
  formatter={(value: string) =>
    value === "rTotal" ? "Republican" : "Democrat"
  }
  wrapperStyle={{ fontSize: 12 }}
/>
```

Remove `Legend` from the import statement (line 16).

**Step 5: Remove tooltip shadow**

On line 166, change:
```tsx
className="bg-white border border-[#C8C1B6] rounded-md p-3 shadow-lg max-w-xs"
```
to:
```tsx
className="bg-white border border-[#C8C1B6] rounded-md p-3 max-w-xs"
```

**Step 6: Verify all three charts render without chrome**

Check `/pacs` page — sector bar chart, scatter plot, and party split should render without card borders, gridlines, or legends.

**Step 7: Commit**
```bash
git add webapp/components/PacCharts.tsx
git commit -m "style: remove chartjunk from PacCharts (gridlines, legends, rounded bars, card wrappers)"
```

---

### Task 4: Global Chrome Reduction — IndustryChart

**Files:**
- Modify: `webapp/components/IndustryChart.tsx`

**Step 1: Remove Legend**

Delete lines 89-96:
```tsx
<Legend
  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
  formatter={(value: string) =>
    value === "individual"
      ? "Individual Employee Contributions"
      : "Direct PAC Contributions"
  }
/>
```

Remove `Legend` from the import statement.

**Step 2: Remove rounded bar ends**

On line 102, change:
```tsx
<Bar dataKey="pac" stackId="a" radius={[0, 4, 4, 0]}>
```
to:
```tsx
<Bar dataKey="pac" stackId="a" radius={0}>
```

**Step 3: Fix dark tooltip to match site style**

Change tooltip contentStyle (lines 81-87) from:
```tsx
contentStyle={{
  backgroundColor: "#111",
  border: "none",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#e7e5e4",
}}
```
to:
```tsx
contentStyle={{
  backgroundColor: "#FDFBF9",
  border: "1px solid #C8C1B6",
  borderRadius: "4px",
  fontSize: "12px",
  color: "#111111",
}}
```

**Step 4: Update source note to serve as direct label replacement**

Change line 110-112 from:
```tsx
<p className="text-[10px] text-stone-400 mt-2 text-center">
  Solid bars = individual employee contributions. Faded bars = direct PAC contributions. Same industry, two channels.
</p>
```
to:
```tsx
<p className="text-[10px] text-stone-500 mt-2">
  <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: "#9CA3AF", opacity: 0.85 }} />Solid = individual employee contributions
  <span className="mx-2 text-stone-300">|</span>
  <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: "#9CA3AF", opacity: 0.4 }} />Faded = direct PAC contributions
</p>
```

**Step 5: Verify**

Check `/pacs` page — industry chart should have no legend, sharp bars, light tooltip.

**Step 6: Commit**
```bash
git add webapp/components/IndustryChart.tsx
git commit -m "style: remove legend, fix tooltip, sharpen bars in IndustryChart"
```

---

### Task 5: Global Chrome Reduction — LeadershipChart, SpikeCards, NewsCards

**Files:**
- Modify: `webapp/components/LeadershipChart.tsx`
- Modify: `webapp/components/SpikeCards.tsx`
- Modify: `webapp/components/NewsCard.tsx`

**Step 1: LeadershipChart — remove bar round and animation**

In LeadershipChart.tsx line 77, change:
```tsx
<div className="h-4 rounded bg-stone-100 overflow-hidden">
```
to:
```tsx
<div className="h-4 bg-stone-100 overflow-hidden">
```

Line 79, change:
```tsx
className="h-full rounded transition-all duration-500"
```
to:
```tsx
className="h-full"
```

**Step 2: SpikeCards — lighten card border**

In SpikeCards.tsx line 57, change:
```tsx
className={`bg-white rounded-lg border p-5 cursor-pointer transition-colors ${
  isExpanded
    ? "border-[#C8C1B6]"
    : "border-[#C8C1B6]/50 hover:border-[#C8C1B6]"
}`}
```
to:
```tsx
className={`border-b border-stone-200 py-4 cursor-pointer transition-colors ${
  isExpanded ? "bg-stone-50" : "hover:bg-stone-50"
}`}
```

**Step 3: NewsCards — lighten card border**

In NewsCard.tsx line 40, change:
```tsx
className="group block bg-white border border-[#C8C1B6]/50 rounded-lg p-5 hover:border-[#C8C1B6] hover:shadow-sm transition-all"
```
to:
```tsx
className="group block py-4 border-b border-stone-200 hover:bg-stone-50 transition-colors"
```

**Step 4: Verify all three components**

Check `/pacs` page for leadership chart, spike cards, and news cards.

**Step 5: Commit**
```bash
git add webapp/components/LeadershipChart.tsx webapp/components/SpikeCards.tsx webapp/components/NewsCard.tsx
git commit -m "style: reduce chrome in LeadershipChart, SpikeCards, NewsCards"
```

---

### Task 6: Scroll-Hiding Navigation

**Files:**
- Modify: `webapp/components/Nav.tsx`

**Step 1: Add scroll-hide behavior and remove FEC badge**

Replace the entire Nav.tsx with:
```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/members", label: "Members" },
  { href: "/pacs", label: "PACs" },
  { href: "/methodology", label: "Methodology" },
];

export default function Nav() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y < 56) {
        setVisible(true);
      } else if (y > lastScrollY.current) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 h-14 bg-[#111111] border-b border-stone-800 flex items-center px-4 sm:px-6 lg:px-8 z-50 transition-transform duration-200"
      style={{ transform: visible ? "translateY(0)" : "translateY(-100%)" }}
    >
      <div className="flex items-center gap-6 w-full max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <img
            src="/accountable_logo.avif"
            alt="Accountable"
            className="h-6 w-auto"
          />
          <span
            className="hidden sm:inline text-xs text-stone-400 uppercase tracking-widest"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Geographic Mismatch
          </span>
        </Link>

        <div className="flex items-center gap-1 ml-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-white text-[#111111] font-bold rounded-sm"
                    : "text-stone-400 hover:text-[#D4F72A]"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="uppercase tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
```

Key changes: scroll-hide via translateY transform, removed FEC 2024 badge.

**Step 2: Verify**

Scroll down on any page — nav should hide. Scroll up — nav should reappear. Top of page — always visible.

**Step 3: Commit**
```bash
git add webapp/components/Nav.tsx
git commit -m "feat: scroll-hiding nav, remove redundant FEC badge"
```

---

### Task 7: Dashboard — Reduce Stat Cards, Remove Chart Chrome

**Files:**
- Modify: `webapp/app/page.tsx`

**Step 1: Replace 4 stat cards with 2 + prose integration**

Replace the stat card section (lines 150-176) with:
```tsx
{/* ── Top-line stats ──────────────────────────────── */}
<section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
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
</section>
```

Then integrate the other two stats into the "Why This Matters" prose. In the `<p>` tag at line 125, after the PAC premium sentence, add:
```tsx
The median committee member receives{" "}
<strong className="text-[#111111]">{formatPct(medianOutside)}</strong>{" "}
of their itemized contributions from outside their home state.{" "}
{broadestPac && (
  <>
    The broadest-reach PAC — {broadestPac.connected_org || broadestPac.pac_name.split(" PAC")[0]} — funds{" "}
    <strong className="text-[#111111]">{broadestPac.num_recipients} committee members</strong>.{" "}
  </>
)}
```

**Step 2: Remove card wrapper from GeoBreakdownChart**

Change lines 194-201 from:
```tsx
<div className="bg-white rounded-lg border border-[#C8C1B6]/50 p-5">
  <GeoBreakdownChart ... />
</div>
```
to:
```tsx
<GeoBreakdownChart ... />
```

**Step 3: Remove card wrapper from Top PACs table**

Change line 281 from:
```tsx
<div className="bg-white rounded-lg border border-[#C8C1B6]/50 overflow-x-auto">
```
to:
```tsx
<div className="overflow-x-auto">
```

**Step 4: Verify dashboard**

Check `/` — should have 2 stat cards + richer prose, no card borders around geo chart and PAC table.

**Step 5: Commit**
```bash
git add webapp/app/page.tsx
git commit -m "style: reduce stat cards, integrate data into prose, remove chart chrome on dashboard"
```

---

### Task 8: PACs Page — Replace Benchmark Bars with Typographic Comparison

**Files:**
- Modify: `webapp/app/pacs/page.tsx`

**Step 1: Replace pill bar benchmark section**

Replace the entire benchmark grid (lines 123-233) with a typographic comparison. Replace the two-column grid of bar cards with:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
  {/* House PAC comparison */}
  <div>
    <p
      className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-3"
      style={{ fontFamily: "var(--font-display)" }}
    >
      House — Median PAC Receipts
    </p>
    <div className="flex items-baseline gap-3">
      <span className="text-3xl font-bold text-[#FE4F40]" style={{ fontFamily: "var(--font-display)" }}>
        {formatMoney(benchmarks.house.committee.median_pac)}
      </span>
      <span className="text-sm text-stone-400">vs.</span>
      <span className="text-lg text-stone-500">
        {formatMoney(benchmarks.house.all_incumbents.median_pac)}
      </span>
    </div>
    <p className="text-xs mt-1">
      <span className="font-semibold text-[#FE4F40]">
        +{benchmarks.house.all_incumbents.median_pac > 0 ? Math.round(((benchmarks.house.committee.median_pac / benchmarks.house.all_incumbents.median_pac) - 1) * 100) : 0}%
      </span>
      <span className="text-stone-400 ml-1">
        — W&amp;M ({benchmarks.house.committee.count}) vs. all incumbents ({benchmarks.house.all_incumbents.count})
      </span>
    </p>
  </div>

  {/* Total fundraising comparison */}
  <div>
    <p
      className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-3"
      style={{ fontFamily: "var(--font-display)" }}
    >
      House — Median Total Receipts
    </p>
    <div className="flex items-baseline gap-3">
      <span className="text-3xl font-bold text-[#4C6971]" style={{ fontFamily: "var(--font-display)" }}>
        {formatMoney(benchmarks.house.committee.median_receipts)}
      </span>
      <span className="text-sm text-stone-400">vs.</span>
      <span className="text-lg text-stone-500">
        {formatMoney(benchmarks.house.all_incumbents.median_receipts)}
      </span>
    </div>
    <p className="text-xs mt-1">
      <span className="font-semibold text-[#4C6971]">
        +{benchmarks.house.all_incumbents.median_receipts > 0 ? Math.round(((benchmarks.house.committee.median_receipts / benchmarks.house.all_incumbents.median_receipts) - 1) * 100) : 0}%
      </span>
      <span className="text-stone-400 ml-1">
        — Source: FEC bulk data, 2024 cycle
      </span>
    </p>
  </div>
</div>
```

**Step 2: Replace before/after 3 stat cards with prose**

Replace the three stat card divs (lines 260-289) with a single sentence:

```tsx
<p className="text-[15px] text-[#111111] leading-relaxed mb-6">
  Of{" "}
  <strong>{headline.valid_members}</strong> members with sufficient data,{" "}
  <strong className="text-[#FE4F40]">{headline.increased_count}</strong>{" "}
  saw PAC money increase after joining the committee — a median change of{" "}
  <strong className="text-[#FE4F40]">
    {headline.median_pct_change != null
      ? `${headline.median_pct_change > 0 ? "+" : ""}${headline.median_pct_change.toFixed(0)}%`
      : "N/A"}
  </strong>{" "}
  (mean{" "}
  <strong className="text-[#4C6971]">
    {headline.mean_pct_change != null
      ? `${headline.mean_pct_change > 0 ? "+" : ""}${headline.mean_pct_change.toFixed(0)}%`
      : "N/A"}
  </strong>).
</p>
```

**Step 3: Remove card wrapper from leadership chart**

Change line 394 from:
```tsx
<div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 mb-6">
```
to:
```tsx
<div className="mb-6">
```

**Step 4: Remove card wrappers from before/after table**

Change line 293 from:
```tsx
<div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
```
to:
```tsx
<div className="overflow-hidden">
```

**Step 5: Verify PACs page**

Check `/pacs` — benchmarks should be typographic, before/after should be prose, no card chrome.

**Step 6: Commit**
```bash
git add webapp/app/pacs/page.tsx
git commit -m "style: replace benchmark bars with typography, prose-ify before/after stats, remove card chrome"
```

---

### Task 9: TimingChart — Replace Stacked Area with Faceted Small Multiples

**Files:**
- Modify: `webapp/components/TimingChart.tsx`

**Step 1: Full rewrite of TimingChart to faceted small multiples**

Replace the entire chart portion of TimingChart.tsx (keeping the SpikeCards section intact). The new component should:
- Use Recharts `AreaChart` for each individual sector panel (simple, consistent)
- Stack 9 panels vertically, each ~80px tall
- Share a single x-axis at the bottom
- Show legislative event markers as thin vertical lines on each panel
- Sector name + color dot as left label

Replace the existing file with:

```tsx
"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ContributionTiming } from "@/lib/data";
import { formatMoney } from "@/lib/utils";
import SpikeCards from "./SpikeCards";

interface TimingChartProps {
  timing: ContributionTiming;
  sectorColors: Record<string, string>;
}

function formatDollarsShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}

function formatWeekTick(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const yr = String(d.getUTCFullYear()).slice(2);
  return `${months[d.getUTCMonth()]} '${yr}`;
}

export default function TimingChart({ timing, sectorColors }: TimingChartProps) {
  const { sectorPanels, tickWeeks, events } = useMemo(() => {
    const weeks = timing.weekly_pac_totals;

    // Sum each sector across all weeks to find top 8
    const sectorTotals = new Map<string, number>();
    for (const w of weeks) {
      for (const key of Object.keys(w)) {
        if (key === "week" || key === "total") continue;
        const val = Number(w[key]) || 0;
        sectorTotals.set(key, (sectorTotals.get(key) || 0) + val);
      }
    }

    const sorted = Array.from(sectorTotals.entries())
      .sort((a, b) => b[1] - a[1]);
    const top8 = sorted.slice(0, 8).map(([k]) => k);
    const sectorKeys = [...top8, "Other"];

    // Build per-sector data arrays
    const panels = sectorKeys.map((sector) => {
      const data = weeks.map((w) => {
        if (sector === "Other") {
          let otherSum = 0;
          for (const key of Object.keys(w)) {
            if (key === "week" || key === "total") continue;
            if (!top8.includes(key)) {
              otherSum += Number(w[key]) || 0;
            }
          }
          return { week: w.week, value: Math.max(0, otherSum) };
        }
        return { week: w.week, value: Math.max(0, Number(w[sector]) || 0) };
      });

      const maxVal = Math.max(...data.map((d) => d.value));
      return { sector, data, maxVal };
    });

    // Tick weeks (every ~3 months)
    const allWeeks = weeks.map((d) => d.week as string);
    const ticks: string[] = [];
    let lastMonth = -1;
    let count = 0;
    for (const w of allWeeks) {
      const d = new Date(w + "T00:00:00Z");
      const m = d.getUTCMonth();
      if (m !== lastMonth) {
        count++;
        lastMonth = m;
        if (count % 3 === 1) {
          ticks.push(w);
        }
      }
    }

    // Events with week start
    const evts = timing.events
      .filter((evt) => evt.bill && evt.bill !== "N/A")
      .map((evt) => ({
        ...evt,
        weekStart: getWeekStart(evt.date),
      }));

    return { sectorPanels: panels, tickWeeks: new Set(ticks), events: evts };
  }, [timing]);

  const topSpikes = useMemo(() => {
    return timing.event_analysis
      .filter((e) => e.sector_specific && e.spike_ratio != null && e.bill && e.bill !== "N/A")
      .sort((a, b) => (b.spike_ratio ?? 0) - (a.spike_ratio ?? 0))
      .slice(0, 5);
  }, [timing]);

  const PANEL_HEIGHT = 72;

  return (
    <div className="space-y-8">
      <section>
        <h2
          className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PAC Contributions Over Time
        </h2>
        <p className="text-xs text-stone-500 mb-4 max-w-2xl leading-relaxed">
          Weekly PAC contributions to tax-writing committee members, broken down by industry sector.
          Each row shows one sector independently — revealing patterns hidden by stacking.
          Vertical lines mark key legislative events.
        </p>

        <div className="space-y-0">
          {sectorPanels.map((panel, idx) => {
            const isLast = idx === sectorPanels.length - 1;
            const color = panel.sector === "Other"
              ? "#9CA3AF"
              : sectorColors[panel.sector] || "#9CA3AF";

            return (
              <div key={panel.sector} className="flex items-start">
                {/* Sector label */}
                <div className="w-36 flex-shrink-0 pt-2 pr-3 text-right">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-stone-600">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{panel.sector}</span>
                  </span>
                </div>

                {/* Chart panel */}
                <div className="flex-1 min-w-0">
                  <ResponsiveContainer width="100%" height={PANEL_HEIGHT}>
                    <AreaChart
                      data={panel.data}
                      margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                    >
                      <XAxis
                        dataKey="week"
                        hide={!isLast}
                        tick={isLast ? { fontSize: 10, fill: "#78716C" } : false}
                        tickFormatter={(val: string) =>
                          tickWeeks.has(val) ? formatWeekTick(val) : ""
                        }
                        interval={0}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide domain={[0, "auto"]} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const val = Number(payload[0]?.value) || 0;
                          if (val === 0) return null;
                          return (
                            <div className="bg-white border border-[#C8C1B6] rounded p-2 text-xs">
                              <p className="text-stone-500">{label}</p>
                              <p className="font-semibold" style={{ color }}>
                                {panel.sector}: {formatMoney(val)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                      {events.map((evt, i) => (
                        <ReferenceLine
                          key={i}
                          x={evt.weekStart}
                          stroke={evt.significance === "high" ? "#FE4F40" : "#D6D3D1"}
                          strokeWidth={evt.significance === "high" ? 1 : 0.5}
                          strokeDasharray={evt.significance === "high" ? undefined : "2 2"}
                          label={
                            idx === 0 && evt.significance === "high"
                              ? {
                                  value: evt.bill,
                                  position: "top",
                                  fill: "#FE4F40",
                                  fontSize: 9,
                                  angle: -30,
                                  offset: 4,
                                }
                              : undefined
                          }
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-stone-400 mt-2 pl-36">
          Weekly PAC contributions. Each row = one sector. Vertical lines = legislative events.
        </p>
      </section>

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
    </div>
  );
}
```

**Step 2: Verify the faceted chart**

Check the PAC timing page — should see 9 stacked line/area panels with sector labels on the left and a shared x-axis at the bottom. Legislative event lines should appear on each panel.

**Step 3: Commit**
```bash
git add webapp/components/TimingChart.tsx
git commit -m "feat: replace stacked area with faceted small multiples (Tufte)"
```

---

### Task 10: New Component — GeoStripChart (Small-Multiple Geographic Strips)

**Files:**
- Create: `webapp/components/GeoStripChart.tsx`

**Step 1: Create the GeoStripChart component**

```tsx
import type { Member } from "@/lib/data";

interface GeoStripChartProps {
  members: Member[];
}

const GEO_COLORS = {
  inDistrict: "#4C6971",
  inState: "#7C9FA8",
  dc: "#F59E0B",
  outOfState: "#FE4F40",
};

export default function GeoStripChart({ members }: GeoStripChartProps) {
  const sorted = [...members]
    .filter((m) => !m.is_territorial && m.total_itemized_amount > 0)
    .sort((a, b) => b.pct_outside - a.pct_outside);

  if (sorted.length === 0) return null;

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-4 mb-3 text-[10px] text-stone-500">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-1.5" style={{ backgroundColor: GEO_COLORS.inDistrict }} />
          In-District
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-1.5" style={{ backgroundColor: GEO_COLORS.inState }} />
          In-State
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-1.5" style={{ backgroundColor: GEO_COLORS.dc }} />
          DC/K-Street
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-1.5" style={{ backgroundColor: GEO_COLORS.outOfState }} />
          Out of State
        </span>
      </div>

      {/* Strip rows */}
      <div className="space-y-px">
        {sorted.map((m) => {
          const prefix = m.chamber === "senate" ? "Sen." : "Rep.";
          const pctColor =
            m.pct_outside > 70 ? "#FE4F40" : m.pct_outside > 50 ? "#F59E0B" : "#4C6971";

          return (
            <div key={m.slug} className="flex items-center gap-2 group">
              {/* Name */}
              <div className="w-36 flex-shrink-0 text-right pr-1">
                <span className="text-[10px] text-stone-500 group-hover:text-stone-800 transition-colors truncate block">
                  {prefix} {m.member_name}
                </span>
              </div>

              {/* Party indicator */}
              <span
                className="w-1.5 h-3 flex-shrink-0"
                style={{
                  backgroundColor: m.party === "R" ? "#EF4444" : m.party === "D" ? "#3B82F6" : "#78716C",
                }}
              />

              {/* Stacked bar */}
              <div className="flex-1 flex h-3 overflow-hidden">
                {m.pct_in_district > 0 && (
                  <div
                    style={{
                      width: `${m.pct_in_district}%`,
                      backgroundColor: GEO_COLORS.inDistrict,
                    }}
                  />
                )}
                {m.pct_in_state_out_district > 0 && (
                  <div
                    style={{
                      width: `${m.pct_in_state_out_district}%`,
                      backgroundColor: GEO_COLORS.inState,
                    }}
                  />
                )}
                {m.pct_dc_kstreet > 0 && (
                  <div
                    style={{
                      width: `${m.pct_dc_kstreet}%`,
                      backgroundColor: GEO_COLORS.dc,
                    }}
                  />
                )}
                {m.pct_out_of_state > 0 && (
                  <div
                    style={{
                      width: `${m.pct_out_of_state}%`,
                      backgroundColor: GEO_COLORS.outOfState,
                    }}
                  />
                )}
              </div>

              {/* Outside % */}
              <span
                className="w-10 text-right text-[10px] font-semibold tabular-nums flex-shrink-0"
                style={{ color: pctColor }}
              >
                {m.pct_outside.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Add GeoStripChart to dashboard**

In `webapp/app/page.tsx`, import the new component:
```tsx
import GeoStripChart from "@/components/GeoStripChart";
```

Then after the existing GeoBreakdownChart section (which shows the committee average), add a new section:
```tsx
{/* ── Every Member's Geographic Profile ────────── */}
<section className="mb-10">
  <h2
    className="text-xs text-stone-500 uppercase tracking-[0.2em] mb-1"
    style={{ fontFamily: "var(--font-display)" }}
  >
    Every Member&apos;s Geographic Profile
  </h2>
  <p className="text-xs text-stone-500 mb-4 max-w-4xl leading-relaxed">
    Each row is one committee member, sorted by outside funding percentage.
    The pattern reveals which members are outliers — and which rely almost
    entirely on money from outside their district.
  </p>
  <GeoStripChart members={members} />
</section>
```

**Step 3: Verify**

Check `/` — should see the new strip chart with all ~65 members as thin horizontal stacked bars, sorted by outside funding.

**Step 4: Commit**
```bash
git add webapp/components/GeoStripChart.tsx webapp/app/page.tsx
git commit -m "feat: add GeoStripChart small-multiple visualization for all members"
```

---

### Task 11: Inline Sparkline Bars in MembersTable

**Files:**
- Modify: `webapp/app/members/MembersTable.tsx`

**Step 1: Add OutsideBar inline component**

Add this component inside MembersTable.tsx, after the `outsidePctColor` function (line 47):

```tsx
function OutsideBar({ pct }: { pct: number }) {
  const color = outsidePctColor(pct);
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className="font-semibold tabular-nums text-right"
        style={{ color, minWidth: "2rem" }}
      >
        {formatPct(pct)}
      </span>
      <div className="w-16 h-2 bg-stone-100 overflow-hidden flex-shrink-0">
        <div
          className="h-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
```

**Step 2: Replace the Outside % cell to use OutsideBar**

Change line 290 from:
```tsx
<td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: outsidePctColor(m.pct_outside) }}>{formatPct(m.pct_outside)}</td>
```
to:
```tsx
<td className="px-3 py-2.5 text-right">
  <OutsideBar pct={m.pct_outside} />
</td>
```

**Step 3: Verify**

Check `/members` — the Outside % column should now show a number + tiny inline bar for each member.

**Step 4: Commit**
```bash
git add webapp/app/members/MembersTable.tsx
git commit -m "feat: add inline sparkline bars to MembersTable Outside % column"
```

---

### Task 12: Final Verification and Build Check

**Step 1: Run the dev server and visually check all pages**

Navigate to:
- `/` — 2 stat cards, prose integration, GeoStripChart, no card chrome
- `/members` — inline sparkline bars in Outside % column
- `/pacs` — typographic benchmarks, prose before/after, faceted timing chart, no card chrome
- `/pacs/timing` (if exists) — faceted small multiples

**Step 2: Run production build**

```bash
cd webapp && npm run build
```

Expected: Clean build with no type errors.

**Step 3: Fix any build errors**

Address TypeScript or rendering issues found during build.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address build issues from Tufte visual overhaul"
```
