# Funder Agenda Clarity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface PAC sector and agenda data on both the members table and member detail pages so voters immediately understand who funds each politician and what those funders want.

**Architecture:** The PAC sector/agenda data already flows through the pipeline into `webapp/data/pacs.json`. We add a `top_funder_agendas` field to each member at import time (synthesized from their top PACs' agenda strings), replace the "Top Outside Employer" column in the table with this new field, and enhance the member detail page with a sector breakdown bar and agenda text in the PAC table. No Python pipeline changes needed.

**Tech Stack:** TypeScript (import script + Next.js), Tailwind CSS v4, server components

**Design doc:** `docs/plans/2026-02-27-funder-agenda-clarity-design.md`

---

### Task 1: Compute `top_funder_agendas` in import-data.ts

**Files:**
- Modify: `webapp/scripts/import-data.ts:249-310` (main section)

**Step 1: Add the agenda synthesis function**

Add this function after the `importOneLiners` function (after line 247):

```typescript
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
    // Top 3 PACs by dollar amount that have agenda text
    const topWithAgenda = memberPacs
      .filter((p) => p.agenda)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    if (topWithAgenda.length === 0) {
      m.top_funder_agendas = "";
      continue;
    }

    // Strip common prefixes like "Lobbies for ", "Seeks ", "Advocates for ", etc.
    const goals = topWithAgenda.flatMap((p) => {
      const stripped = p.agenda
        .replace(/^(Lobbies for|Seeks|Advocates for|Supports|Pushes for|Opposes)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();
      // Split on " and " or "; " to get individual goals
      return stripped.split(/(?:,?\s+and\s+|;\s+)/).map((g) => g.trim());
    });

    // Deduplicate (case-insensitive) and take first ~15 words worth
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const g of goals) {
      const key = g.toLowerCase();
      if (!seen.has(key) && g.length > 0) {
        seen.add(key);
        unique.push(g);
      }
    }

    // Join and truncate to ~15 words
    let result = unique.join(", ");
    const words = result.split(/\s+/);
    if (words.length > 15) {
      result = words.slice(0, 15).join(" ");
      // Clean trailing comma or partial phrase
      result = result.replace(/,?\s*$/, "");
    }

    m.top_funder_agendas = result;
  }
}
```

**Step 2: Call it in the main section**

In the main section, after the one-liners merge block (after line 273) and before the sector_colors write (line 276), add:

```typescript
// Build top funder agendas from PAC data
const pacs = importPacs(pacSectorConfig);
buildTopFunderAgendas(members, pacs);
```

Then update the datasets array (line 292-300) to use the already-imported `pacs` variable instead of calling `importPacs` again:

```typescript
const datasets: [string, unknown][] = [
  ["members.json", members],
  ["employers.json", importEmployers()],
  ["pacs.json", pacs],
  ["pac_spread.json", importPacSpread(pacSectorConfig)],
  ["committee_agg.json", importCommitteeAgg()],
  ["dc_breakdown.json", importDcBreakdown()],
  ["one_liners.json", oneLiners],
];
```

**Step 3: Run import-data to verify**

```bash
cd webapp
npm run import-data
```

Expected: Same output as before, no errors. Check that `members.json` now has a `top_funder_agendas` field:

```bash
head -30 data/members.json | grep top_funder_agendas
```

**Step 4: Commit**

```bash
git add webapp/scripts/import-data.ts webapp/data/members.json
git commit -m "feat: compute top_funder_agendas per member in import-data"
```

---

### Task 2: Add `top_funder_agendas` to the Member TypeScript interface

**Files:**
- Modify: `webapp/lib/data.ts:6-46` (Member interface)

**Step 1: Add the field to the Member interface**

After `one_liner: string;` (line 46), add:

```typescript
  top_funder_agendas: string;
```

**Step 2: Verify the build still works**

```bash
cd webapp
npx next build 2>&1 | head -20
```

Expected: Build succeeds (or only pre-existing warnings). No type errors related to `top_funder_agendas`.

**Step 3: Commit**

```bash
git add webapp/lib/data.ts
git commit -m "feat: add top_funder_agendas to Member interface"
```

---

### Task 3: Replace "Top Outside Employer" column in MembersTable

**Files:**
- Modify: `webapp/app/members/MembersTable.tsx`

**Step 1: Replace the column header**

Change line 259 from:

```tsx
<th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>Top Outside Employer</th>
```

to:

```tsx
<th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>Top Funders Lobby For</th>
```

**Step 2: Replace the cell content**

Change line 278 from:

```tsx
<td className="px-3 py-2.5 text-stone-500 text-xs max-w-48 truncate">{m.top_outside_employer_1 || "\u2014"}</td>
```

to:

```tsx
<td className="px-3 py-2.5 text-stone-500 text-xs max-w-64">
  <span className="line-clamp-2">{m.top_funder_agendas || "\u2014"}</span>
</td>
```

**Step 3: Update the search filter to include the new field**

In the filter function (lines 112-119), change the search condition. Replace:

```tsx
      if (
        q &&
        !m.member_name.toLowerCase().includes(q) &&
        !m.state.toLowerCase().includes(q) &&
        !(m.top_outside_employer_1 ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
```

with:

```tsx
      if (
        q &&
        !m.member_name.toLowerCase().includes(q) &&
        !m.state.toLowerCase().includes(q) &&
        !(m.top_funder_agendas ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
```

**Step 4: Verify in the browser**

```bash
cd webapp
npm run dev
```

Open http://localhost:3000/members. Verify:
- Column header says "Top Funders Lobby For"
- Each row shows agenda text instead of an employer name
- Searching "estate tax" or "corporate" filters to relevant members

**Step 5: Commit**

```bash
git add webapp/app/members/MembersTable.tsx
git commit -m "feat: replace Top Outside Employer with Top Funders Lobby For column"
```

---

### Task 4: Add `sectorColor` helper to utils.ts

**Files:**
- Modify: `webapp/lib/utils.ts`
- Modify: `webapp/lib/data.ts` (to export `getSectorColors`)

**Step 1: Add the helper**

At the end of `webapp/lib/utils.ts`, add:

```typescript
const SECTOR_COLORS: Record<string, string> = {
  "Finance & Insurance": "#2563EB",
  "Healthcare & Pharma": "#DC2626",
  "Real Estate & Housing": "#16A34A",
  "Tech & Telecom": "#7C3AED",
  "Energy & Utilities": "#F59E0B",
  "Defense & Aerospace": "#6B7280",
  "Transportation": "#0891B2",
  "Retail & Consumer": "#EC4899",
  "Labor": "#EA580C",
  "Professional Services": "#4F46E5",
  "Food & Beverage": "#65A30D",
  "Construction & Engineering": "#A16207",
  "Ideological": "#BE185D",
  "Other Industry": "#9CA3AF",
};

export function sectorColor(sector: string): string {
  return SECTOR_COLORS[sector] || "#9CA3AF";
}
```

**Step 2: Commit**

```bash
git add webapp/lib/utils.ts
git commit -m "feat: add sectorColor helper"
```

---

### Task 5: Add sector breakdown bar to member detail page

**Files:**
- Modify: `webapp/app/members/[slug]/page.tsx`

**Step 1: Import sectorColor**

At line 9, add `sectorColor` to the utils import:

```typescript
import { formatMoney, formatPct, memberLabel, sectorColor } from "@/lib/utils";
```

**Step 2: Compute sector aggregates from PAC data**

After the `topStates` block (after line 154), add:

```typescript
  /* ---------- PAC sector breakdown ---------- */

  type SectorSegment = {
    sector: string;
    total: number;
    pct: number;
    color: string;
  };

  const sectorTotals = new Map<string, number>();
  let pacGrandTotal = 0;
  for (const p of pacs) {
    const s = p.sector || "Other Industry";
    sectorTotals.set(s, (sectorTotals.get(s) || 0) + p.total);
    pacGrandTotal += p.total;
  }

  const sectorSegments: SectorSegment[] = [...sectorTotals.entries()]
    .map(([sector, total]) => ({
      sector,
      total,
      pct: pacGrandTotal > 0 ? (total / pacGrandTotal) * 100 : 0,
      color: sectorColor(sector),
    }))
    .sort((a, b) => b.total - a.total);
```

**Step 3: Add the sector breakdown section in the JSX**

Insert this new section BEFORE the existing "Top PACs" section (before line 296 `{/* ---- Top PACs ---- */}`):

```tsx
      {/* ---- PAC Sector Breakdown ---- */}
      {pacs.length > 0 && sectorSegments.length > 0 && (
        <section className="space-y-4">
          <h2
            className="text-xs text-stone-500 uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Where the PAC Money Comes From
          </h2>

          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 space-y-5">
            <div className="flex h-8 rounded-sm overflow-hidden">
              {sectorSegments.map(
                (seg) =>
                  seg.pct > 0 && (
                    <div
                      key={seg.sector}
                      style={{
                        width: `${seg.pct}%`,
                        backgroundColor: seg.color,
                      }}
                      className="relative group transition-opacity hover:opacity-90"
                      title={`${seg.sector}: ${seg.pct.toFixed(1)}%`}
                    >
                      {seg.pct >= 10 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white">
                          {seg.pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ),
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {sectorSegments.map((seg) => (
                <div key={seg.sector} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-stone-500">{seg.sector}</span>
                  <span className="text-[#111111] font-medium">{formatPct(seg.pct)}</span>
                  <span className="text-stone-400">({formatMoney(seg.total)})</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
```

**Step 4: Verify in the browser**

Open http://localhost:3000/members/jason-smith (or any member slug). Verify:
- New "Where the PAC Money Comes From" section appears above "Top PACs"
- Stacked bar shows colored segments by sector
- Legend below shows sector, percentage, and dollar amount

**Step 5: Commit**

```bash
git add webapp/app/members/[slug]/page.tsx webapp/lib/utils.ts
git commit -m "feat: add PAC sector breakdown bar to member detail page"
```

---

### Task 6: Enhance PAC table with sector chips and agenda text

**Files:**
- Modify: `webapp/app/members/[slug]/page.tsx`

**Step 1: Update the PAC table body**

Replace the PAC table row content (lines 314-326) — specifically the `<td>` for PAC name — from:

```tsx
                    <td className="px-5 py-3 text-[#111111]">{p.pac_name}</td>
```

to:

```tsx
                    <td className="px-5 py-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[#111111]">{p.pac_name}</span>
                            {p.sector && (
                              <span
                                className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-medium text-white whitespace-nowrap"
                                style={{ backgroundColor: sectorColor(p.sector) }}
                              >
                                {p.sector}
                              </span>
                            )}
                          </div>
                          {p.agenda && (
                            <p className="text-xs text-stone-400 mt-1 leading-relaxed">{p.agenda}</p>
                          )}
                        </div>
                      </div>
                    </td>
```

**Step 2: Verify in the browser**

Open a member detail page. Verify:
- PAC names now have colored sector chips next to them
- Agenda text appears as a muted subtitle below each PAC name
- PACs without sector/agenda look the same as before (just the name)

**Step 3: Commit**

```bash
git add webapp/app/members/[slug]/page.tsx
git commit -m "feat: add sector chips and agenda text to PAC table"
```

---

### Task 7: Final verification and cleanup

**Step 1: Run import-data**

```bash
cd webapp
npm run import-data
```

**Step 2: Run the dev server and verify all pages**

```bash
npm run dev
```

Check:
- `/members` — "Top Funders Lobby For" column shows agenda text, search works
- `/members/jason-smith` — sector breakdown bar + enhanced PAC table
- `/members/ron-wyden` — same checks, different member
- `/` — dashboard unchanged (no regressions)
- `/pacs` — unchanged

**Step 3: Run a production build**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

**Step 4: Commit any remaining changes**

```bash
git add -A
git status
# Only commit if there are unstaged changes from the verification
git commit -m "chore: final verification of funder agenda clarity feature"
```
