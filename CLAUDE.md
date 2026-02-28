# Geographic Distribution — Project Guide

## Purpose

This project exists to answer a simple question: **who really funds the legislators that write America's tax code?**

The House Ways & Means Committee and the Senate Finance Committee control federal tax policy. Every deduction, credit, and loophole passes through these two committees. That makes their members the most lobbied in Congress — and the most heavily funded by industry PACs. Yet most voters have no idea where their representative's money actually comes from.

This project makes that visible. Using publicly available FEC data, it classifies every itemized contribution by geography (did it come from the member's own district? their state? DC/K-Street? out of state entirely?) and analyzes PAC spending patterns by industry sector. The goal is accountability through transparency: showing voters and journalists which interests are funding the people who decide who pays taxes and who doesn't.

**The editorial stance is investigative, not partisan.** The analysis covers both parties equally and lets the data speak. The webapp is designed to tell a clear story — not just display tables — with narrative framing, interpretive chart captions, and curated news links that connect the data to real-world policy outcomes.

## What This Is (Technical)

A Python data pipeline fetches FEC bulk data, classifies each contribution by geography (in-district, in-state, DC/K-Street, out-of-state), and a Next.js webapp displays the results with interactive charts, PAC industry analysis, and narrative context.

**Key finding:** House Ways & Means members receive **66% more PAC money** than the median House incumbent ($1.2M vs. $724K median, 2024 cycle). This stat is computed from FEC all-candidates summary data and displayed on both the dashboard and PACs pages.

## Project Structure

```
├── config/                    # Python config + curated data files
│   ├── config.py              # Central configuration (cycles, URLs, column defs)
│   ├── members.json           # All 72 tracked members with FEC IDs
│   ├── employer_aliases.json  # Employer name normalization rules
│   ├── pac_sectors.json       # Curated PAC → industry sector mappings (75 PACs, 14 sectors)
│   └── pac_news.json          # Curated news articles about PAC influence on tax policy (12 articles)
├── scripts/                   # 9-step Python pipeline (00–08)
│   └── run_all.py             # Orchestrator with checkpoint resume
├── utils/                     # Shared: FEC API client, checkpoints, employer normalizer
├── data/                      # raw/, processed/ (parquet), reference/, checkpoints/
│   └── raw/webl_2024/         # FEC all-candidates summary file (for benchmarks)
├── output/                    # Pipeline CSV outputs + REPORT.md
├── webapp/                    # Next.js 16 frontend (App Router)
│   ├── app/                   # Pages: /, /members, /members/[slug], /pacs, /stories
│   │   ├── page.tsx           # Dashboard — headline title, intro, stat cards, rankings
│   │   ├── members/           # Members list (MembersTable.tsx) + [slug] detail pages
│   │   ├── pacs/              # PACs analysis — charts, sector spotlights, benchmarks, news, table (PacsTable.tsx)
│   │   └── stories/           # Auto-generated narrative stories
│   ├── components/            # Shared UI components
│   │   ├── Nav.tsx            # Top navigation bar
│   │   ├── MemberCard.tsx     # Member summary card (used in rankings)
│   │   ├── StatCard.tsx       # Stat display card (label + value + detail)
│   │   ├── PacCharts.tsx      # Recharts visualizations: sector bars, scatter plot, party split
│   │   ├── NewsCard.tsx       # News article card grid
│   │   ├── Filters.tsx        # Filter controls
│   │   ├── EmptyState.tsx     # Empty data fallback
│   │   ├── CopyButton.tsx     # Copy-to-clipboard button
│   │   └── OneLinerCopy.tsx   # One-liner copy component
│   ├── lib/
│   │   ├── data.ts            # Server-side data loaders (13 exports)
│   │   └── utils.ts           # formatMoney, formatPct, memberSlug, partyColor, geoClassColor, cn
│   ├── scripts/
│   │   └── import-data.ts     # Pipeline CSV → static JSON converter (also copies pac_news, pac_sectors)
│   └── data/                  # Static JSON consumed by webapp (10 files)
│       ├── members.json       # Member data with geographic breakdowns
│       ├── pac_spread.json    # PAC spread analysis (enriched with sectors/agendas)
│       ├── pacs.json          # Per-member PAC contributions
│       ├── employers.json     # Per-member employer data
│       ├── committee_agg.json # Committee-level aggregates
│       ├── dc_breakdown.json  # DC/K-Street breakdown details
│       ├── benchmarks.json    # FEC benchmark comparison data (committee vs all incumbents)
│       ├── pac_news.json      # Curated news articles
│       ├── sector_colors.json # Industry sector → color mapping
│       └── one_liners.json    # Auto-generated member one-liners
└── requirements.txt           # Python deps: pandas, pyarrow, requests, tqdm
```

## Tech Stack

**Pipeline:** Python 3.11+, pandas, pyarrow (parquet), requests, tqdm
**Webapp:** Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS v4, Recharts, react-simple-maps
**Build:** Turbopack (Next.js bundler)
**Node.js:** Requires Node 22 LTS or lower. Node 24 has breaking compatibility issues with Next.js 16 (`p-limit` module resolution failure). If `npm run build` fails with `MODULE_NOT_FOUND` errors, downgrade Node.

## Running the Pipeline

```bash
export FEC_API_KEY=<your_key>
cd "/path/to/Geographic Distribution"
python scripts/run_all.py              # Full run (skips completed steps)
python scripts/run_all.py --from-step 4  # Resume from specific step
python scripts/run_all.py --force      # Clear checkpoints, re-run all
python scripts/run_all.py --only 7     # Run single step
```

Pipeline steps:
0. Download FEC bulk files (contributions, committee master `cm.txt`, candidates) + Census geographic data
1. Look up FEC candidate/committee IDs via API
2. Filter bulk contributions to target committees
3. Build ZIP-to-congressional-district mapping
4. Classify each contribution by geography
5. Validate totals against FEC API
6. Normalize employer names
7. Generate summary statistics — **resolves PAC names from committee master** (not payee names), groups by CMTE_ID, enriches with connected org names
8. Generate markdown report

Checkpoints live in `data/checkpoints/`. Delete a checkpoint file to force re-run of that step.

## Running the Webapp

```bash
cd webapp
npm run import-data   # Convert pipeline CSVs → static JSON + copy curated files
npm run dev           # Dev server on port 3000
npm run build         # Production build
```

The `import-data` script:
- Converts pipeline output CSVs to JSON
- Copies `config/pac_news.json` → `webapp/data/pac_news.json`
- Merges `config/pac_sectors.json` into `pac_spread.json` (sector, agenda, connected_org fields)
- Generates `sector_colors.json` with consistent color assignments per sector

## Data Flow

```
FEC bulk ZIPs → data/raw/
  → filter → data/processed/*.parquet
  → classify → contributions_{cycle}_classified.parquet
  → analyze → output/*.csv (step 07 resolves PAC names via cm.txt committee master)
  → import-data.ts → webapp/data/*.json (enriches PAC data with sector/agenda from pac_sectors.json)
  → Next.js server components → rendered HTML

Additional data:
  config/pac_sectors.json → merged into pac_spread.json during import
  config/pac_news.json → copied to webapp/data/pac_news.json during import
  data/raw/webl_2024/webl24.txt → benchmarks.json (generated manually, not by pipeline)
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `config/config.py` | All paths, API config, column definitions, cycle years, CM_COLUMNS for committee master |
| `config/members.json` | Member roster with FEC IDs (updated by step 01) |
| `config/pac_sectors.json` | Curated mapping: CMTE_ID → sector, agenda, opensecrets_url (75 PACs across 14 sectors) |
| `config/pac_news.json` | Curated news articles about PAC/tax policy influence (12 articles with title, source, url, date, sector, excerpt) |
| `scripts/07_analyze.py` | Summary stats generator — resolves PAC names from committee master, computes PAC spread |
| `utils/fec_api.py` | Rate-limited FEC API client (1s delay, 5 retries) |
| `utils/checkpoint.py` | Pipeline checkpoint/resume system |
| `webapp/lib/data.ts` | Server-side data loaders: getMembers, getMemberBySlug, getPacSpread, getBenchmarks, getNews, getSectorColors, etc. (13 exports) |
| `webapp/lib/utils.ts` | formatMoney, formatPct, memberSlug, partyColor, geoClassColor, geoClassLabel, cn |
| `webapp/app/globals.css` | Tailwind theme: coral (#FE4F40), teal (#4C6971), lime (#D4F72A), paper (#FDFBF9) |
| `webapp/components/PacCharts.tsx` | Three Recharts visualizations: sector breakdown bar chart, reach-vs-dollars scatter, party split stacked bars |
| `webapp/components/NewsCard.tsx` | News article card grid with sector dots and hover effects |
| `webapp/app/pacs/PacsTable.tsx` | Interactive PAC table with search, sector filter, sort controls |
| `webapp/app/pacs/page.tsx` | PACs page: key findings, benchmarks, charts, sector spotlights, top recipients, news, table |
| `webapp/data/benchmarks.json` | FEC all-incumbents vs committee member comparison (median PAC $, total receipts) |

## Webapp Page Architecture

### Dashboard (`/`) — `app/page.tsx`
Server component. Title: "Who Really Writes American Tax Policy?"
- **Introduction section** ("Why This Matters") with coral left-border accent, includes the +66% PAC money stat dynamically computed from `benchmarks.json`, with FEC source citation
- Stat cards (members analyzed, median outside funding, total $ analyzed, mean DC/K-Street)
- Committee comparison table (House W&M vs Senate Finance)
- Member rankings: most outside-funded and most locally-funded (top 5 each, MemberCard components)
- Top PACs by reach table (top 10)

### Members List (`/members`) — `app/members/page.tsx` + `MembersTable.tsx`
Server component passes data; `MembersTable.tsx` is a client component with search, filters, and sorting.

### Member Detail (`/members/[slug]`) — `app/members/[slug]/page.tsx`
Server component. Geographic breakdown charts, employer analysis, PAC contributions for individual member.

### PACs (`/pacs`) — `app/pacs/page.tsx` + `PacsTable.tsx`
The most feature-rich page. Server component with extensive data processing:
- **Key findings** — auto-generated narrative bullets (top sector %, bipartisan reach, total PAC $)
- **Stat cards** — total PACs, broadest-reach PAC, total PAC $, ultra-broad PACs count
- **"Do Tax-Writers Get More PAC Money?"** — visual benchmark comparison with bar charts (House W&M median vs all incumbents), computed from `benchmarks.json`
- **PacCharts** (client component via `PacCharts.tsx`):
  - Sector breakdown horizontal bar chart (color-coded by industry)
  - Reach vs. dollars scatter plot (10+ recipients, colored by sector)
  - Party split stacked bars (top 15 PACs by reach, R vs D funding)
  - Each chart has interpretive captions explaining the "so what"
- **"What Each Industry Wants"** — sector spotlight cards with policy agenda descriptions, $ totals, top PACs per sector (uses `SECTOR_AGENDAS` constant)
- **"Who Receives the Most PAC Attention?"** — top 10 members by distinct PAC count, linked to member profiles
- **"In the News"** — curated news article cards (NewsCard component)
- **Interactive table** (client component via `PacsTable.tsx`) — search, sector dropdown filter, sortable columns

### Stories (`/stories`) — `app/stories/page.tsx`
Auto-generated narrative stories about contribution patterns.

## PAC Data Pipeline Details

### PAC Name Resolution (Critical)
The `NAME` field in FEC pas2 bulk data is **not the PAC's own name** — it's a payee/vendor/conduit name. Step 07 resolves real PAC names by joining `CMTE_ID` against the FEC committee master file (`cm.txt`), which provides `CMTE_NM` (committee name), `CMTE_TP` (type), `CMTE_DSGN` (designation), and `CONNECTED_ORG_NM` (connected organization).

### PAC Sector Classification
`config/pac_sectors.json` maps ~75 PACs to 14 sectors: Finance, Healthcare, Energy, Real Estate, Technology, Defense, Labor, Insurance, Pharma, Agriculture, Telecom, Transportation, Ideological, Professional Services. Each entry includes:
- `sector`: industry category
- `agenda`: 1-sentence policy interest description (displayed in sector spotlight cards)
- `opensecrets_url`: link to OpenSecrets profile

The `import-data.ts` script merges these into `pac_spread.json`. PACs not in the curated file get classified via keyword matching on connected org names as a fallback.

### Benchmarks Data
`webapp/data/benchmarks.json` was generated manually (not by the pipeline) from `data/raw/webl_2024/webl24.txt` (FEC all-candidates summary file). It compares:
- **House:** 41 W&M members vs 440 House incumbents — median PAC receipts, median total receipts
- **Senate:** 22 Finance members vs 34 Senate incumbents — less reliable due to off-cycle fundraising

To regenerate: download fresh `webl24.zip` from FEC, extract, and recompute. The Senate comparison is noted as unreliable in the UI.

## Conventions

- **Python files** use snake_case, type hints where helpful, print-based logging
- **TypeScript** uses strict mode, server components by default, `"use client"` only when needed
- **Webapp data loading** is all server-side via `lib/data.ts` reading static JSON — no client-side fetching
- **Styling** uses Tailwind utility classes. Color palette: coral `#FE4F40` (accents, alerts), teal `#4C6971` (local/positive), lime `#D4F72A`, paper `#FDFBF9` (background), stone shades for text
- **Fonts:** Oswald for headings/display (`var(--font-display)`), DM Sans for body text
- **Section headers:** `text-xs uppercase tracking-[0.2em] text-stone-500` with `fontFamily: "var(--font-display)"`
- **Card pattern:** `bg-white rounded-lg border border-[#C8C1B6]/50 p-5`
- **Geographic classifications:** `in_district`, `in_state_out_district`, `in_state`, `dc_kstreet`, `out_of_state`, `unknown`
- **Party colors:** Republican `#EF4444`, Democrat `#3B82F6` (via `partyColor()` in utils.ts which returns CSS variables)
- **Parquet** for intermediate data (faster I/O), **CSV** for human-readable outputs, **JSON** for webapp

## Common Issues

- **Node.js 24 incompatibility:** Next.js 16 does not work with Node 24. `npm run build` and `npm run dev` will crash with `MODULE_NOT_FOUND` or `LRUCache is not a constructor` errors. Use Node 22 LTS. If stuck on Node 24, `rm -rf node_modules && npm install --legacy-peer-deps` may get dev mode working but builds may still fail.
- **react-simple-maps peer dep conflict:** This package requires React 18 but the project uses React 19. Use `--legacy-peer-deps` flag when running `npm install`.
- **FEC API rate limits:** The API throttles aggressively. If lookups fail, increase `FEC_API_RATE_DELAY` in `config/config.py` or retry — checkpoints let you resume.
- **`is_territorial` NaN bug:** When filtering members, always use `.fillna(False).astype(bool)` before applying `~` (bitwise NOT). Raw boolean columns from merged DataFrames can contain NaN.
- **`__dirname` in ESM:** Webapp scripts use ES modules. Use `fileURLToPath(import.meta.url)` pattern instead of bare `__dirname`.
- **Members not found:** Some members (e.g., Mike Kelly, Beth Van Duyne) don't match in FEC API lookups and are skipped throughout the pipeline. This is expected.
- **Dev server caching:** After running `npm run import-data` to update JSON files, you may need to restart the dev server for changes to appear (server components cache file reads).

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `FEC_API_KEY` | Yes (for production) | `DEMO_KEY` | Get from https://api.open.fec.gov |

## Election Cycles

- **2024**: Complete data (primary cycle)
- **2026**: Partial/in-progress data (secondary cycle)

Both cycles are processed. Webapp currently displays 2024 by default.

## No Tests

There is no test suite. Data integrity is validated by step 05 (cross-checking against FEC API totals). Discrepancies >5% are flagged in `output/validation_reconciliation.csv`.
