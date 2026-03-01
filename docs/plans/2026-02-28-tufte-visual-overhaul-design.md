# Tufte-Informed Visual Overhaul

**Date:** 2026-02-28
**Status:** Approved

## Motivation

An audit of every visualization component through Edward Tufte's principles revealed systematic issues: low data-ink ratio from card chrome, a stacked area chart that buries its data, stat card overuse, gridlines, rounded bar ends, legends instead of direct labels, and missed opportunities for small multiples and sparklines. This design addresses all eight priority areas.

## Changes

### Tier 1 — Global Chrome Reduction

**A. Remove card borders, use whitespace for grouping**
- Replace `bg-white rounded-lg border border-[#C8C1B6]/50 p-5` pattern with spacing-only separation (`mb-12` / `mb-16`)
- Exception: interactive elements (tables, expandable cards) keep subtle `border-stone-200` for click-target affordance
- Affects: StatCard, MemberCard, PacCharts card wrappers, section containers on dashboard and PACs page

**B. Remove gridlines from all Recharts charts**
- Delete `<CartesianGrid>` from scatter plot (PacCharts), TimingChart (being replaced), and any others
- Ensure `axisLine={false}` and `tickLine={false}` are set consistently on all axes

**C. Replace rounded bar ends with sharp rectangles**
- Change `radius={[0, 4, 4, 0]}` to `radius={0}` on all Recharts `<Bar>` elements
- Affects: PacCharts sector bars, party split bars, IndustryChart bars

**D. Replace legends with direct labels**
- Party split chart (PacCharts): remove `<Legend>`, red/blue is self-explanatory
- Industry chart: remove `<Legend>`, add inline text labels on first bar's segments
- New faceted chart: sector name is the row label — no legend needed

**E. Scroll-hiding navigation**
- Nav hides on scroll-down, reveals on scroll-up (CSS transform + JS scroll listener)
- Remove redundant "FEC 2024" badge from nav (already shown in page body)
- Recovers 56px of vertical data space while scrolling

### Tier 2 — Chart Replacements

**F. TimingChart → Faceted small multiples**
- Replace stacked area with faceted panel: 9 mini line charts, one per sector
- Each panel: ~80px tall, area fill under the line with sector color at low opacity
- All panels share a single x-axis at the bottom (month labels)
- Legislative event reference lines repeat as thin vertical markers on each panel
- Sector name + color dot as left-aligned label per row
- No gridlines. Optional light horizontal reference at median value
- Total height: ~720px (comparable to current chart + its illegibility overhead)

**G. Benchmark bars → Typographic comparison**
- Replace pill-shaped progress bars with typographic treatment:
  - Large bold number for committee median, smaller for all-incumbent median
  - Delta in coral: `(+66%)`
  - Minimal paired-dot graphic on a number line if pure text feels too sparse
- Saves ~100px vertical per comparison pair

**H. Stat cards → Prose integration**
- Dashboard: reduce from 4 stat cards to 1-2 max; weave others into narrative paragraph
- PACs before/after: replace 3 stat cards with single sentence incorporating all three numbers
- Keep stat cards only for the single most important finding per section

### Tier 3 — New Visualizations

**I. Small-multiple geographic strip chart**
- New component: `GeoStripChart.tsx`
- One thin row per member (~16px), sorted by outside-funding %
- Each row: stacked horizontal bar showing in-district / in-state / DC / out-of-state proportions
- Member name left-aligned, outside % right-aligned
- Committee average as a highlighted reference row
- Replaces or supplements single-average GeoBreakdownChart on dashboard
- Shows full distribution of all 72 members instead of hiding behind a mean

**J. Inline sparkline bars in MembersTable**
- Add `PartyBar`-style inline bar to "Outside %" column
- Thin horizontal bar using teal→coral color gradient based on percentage
- Model on existing `PartyBar` from PacsTable (proven pattern)
- Pure CSS, no chart library needed

## Files Affected

| File | Changes |
|------|---------|
| `webapp/components/Nav.tsx` | Scroll-hide behavior, remove FEC badge |
| `webapp/components/StatCard.tsx` | Remove border/bg, spacing-only |
| `webapp/components/MemberCard.tsx` | Lighten chrome |
| `webapp/components/PacCharts.tsx` | Remove gridlines, legends, rounded bars |
| `webapp/components/IndustryChart.tsx` | Remove gridlines, legend, rounded bars; add direct labels |
| `webapp/components/TimingChart.tsx` | Full rewrite → faceted small multiples |
| `webapp/components/GeoBreakdownChart.tsx` | May keep as "average" row reference |
| `webapp/components/GeoStripChart.tsx` | **New** — small-multiple strip chart |
| `webapp/components/LeadershipChart.tsx` | Remove card chrome, minor cleanup |
| `webapp/components/SpikeCards.tsx` | Lighten card chrome |
| `webapp/components/NewsCard.tsx` | Lighten card chrome |
| `webapp/app/page.tsx` | Reduce stat cards, integrate prose, add GeoStripChart |
| `webapp/app/pacs/page.tsx` | Replace benchmark bars, reduce stat cards, prose integration |
| `webapp/app/pacs/PacsTable.tsx` | Lighten card chrome |
| `webapp/app/members/MembersTable.tsx` | Add inline sparkline bars, lighten chrome |

## Non-Goals

- No changes to data pipeline or JSON data files
- No new data requirements — all visualizations use existing data
- No changes to member detail pages (those are already relatively clean)
- No font changes (Oswald + DM Sans hierarchy works well)
- No color palette changes (coral/teal/lime/paper system is Tufte-aligned)
