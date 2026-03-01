# Dashboard Redesign — Design

## Problem

The dashboard's stat cards show methodology metrics ("Members Analyzed: 65", "Total $ Analyzed: $103M") instead of findings. The most powerful stats (+66% PAC premium, +51% after joining committee) are buried in prose or only on the PACs page. There's no chart. The committee comparison table is editorially flat.

## Changes

### 1. Tighten "Why This Matters"

Cut from 3 paragraphs to 2. Lead with the +66% PAC premium in the first sentence. Remove the third paragraph ("This project traces that money...") — the data speaks for itself.

### 2. Replace stat cards with findings

Remove: "Members Analyzed", "Total $ Analyzed"

New 4 cards:
1. **+66% more PAC money** — W&M members vs typical House incumbents (from benchmarks.json, already computed in page)
2. **+51% PAC increase after joining** — median change after committee appointment (from before_after.json)
3. **Median outside funding %** — from outside home state/district (keep existing)
4. **Broadest-reach PAC stat** — "1 PAC funds X of 72 members" (from pacSpread, max num_recipients)

### 3. Add one chart: Geographic funding breakdown

A simple horizontal stacked bar showing average geographic split across all members: in-district, in-state, DC/K-Street, out-of-state. New `"use client"` component `GeoBreakdownChart.tsx` using Recharts, following PacCharts.tsx patterns.

Data source: committeeAggs "All Members" row already has mean percentages. Or compute from member-level data for more control.

### 4. Cut committee comparison table

Remove entirely. The House vs Senate comparison doesn't drive the editorial story.

### 5. Enhance Top PACs table

Add sector color dot + sector name column. Data already available — pacSpread entries have `sector` field, sectorColors are loaded.

### 6. Keep member rankings as-is

Most/least outside-funded top 5 rankings stay unchanged.

## New Section Order

1. Header + tightened "Why This Matters"
2. 4 finding-based stat cards
3. Geographic breakdown chart (new)
4. Member rankings (unchanged)
5. Top PACs by reach (enhanced with sector dots)

## Files

- Modify: `webapp/app/page.tsx` (all changes)
- Create: `webapp/components/GeoBreakdownChart.tsx` (new client component)
- No new data files needed — all data already available
