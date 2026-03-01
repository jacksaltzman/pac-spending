# Agent Prompt: Contribution Timing Around Legislation

## Objective

Determine whether PAC contributions to tax-writing committee members spike around key legislative events — committee markups, floor votes, and bill introductions for major tax legislation. If money flows in right before or after the committee acts on a bill, that's strong evidence that contributions are strategically timed to influence or reward specific legislative actions, not just generalized access-buying.

## Why This Matters

The project already shows *who* gives and *how much*. This analysis adds *when* — the most incriminating dimension. A steady drip of PAC money could be routine relationship maintenance. But a surge of contributions from the finance industry the week before a markup on financial regulation reform? That tells a different story.

## What You're Building

### 1. Legislative Events Timeline (`config/legislative_events.json`)

Build a curated timeline of major tax-related legislative events during the 2023–2024 cycle (118th Congress). Focus on events involving the House Ways & Means Committee and Senate Finance Committee.

**Events to capture:**

For each event: bill number, event type, date, committee, brief description, and which industries had the most at stake.

**Key bills to start with (118th Congress):**

- **H.R. 7024 — Tax Relief for American Families and Workers Act of 2024**
  - W&M Committee markup/vote: ~January 2024
  - House floor passage: January 31, 2024
  - Major provisions: child tax credit expansion, R&D expensing, business interest deductions
  - Industries with stake: tech, manufacturing, finance, real estate

- **American Families and Jobs Act package (2023)**
  - W&M Committee markup: ~June 2023
  - Three-bill package: Small Business Jobs Act, Tax Cuts for Working Families Act, etc.
  - Industries with stake: small business, retail, real estate

- **Ways & Means September 2024 markups**
  - Five tax bills advanced: ~September 11, 2024
  - Provisions on IRS reporting, tax-exempt organizations, hostage relief
  - Industries with stake: finance, nonprofits, insurance

- **TCJA extension discussions (ongoing 2023–2024)**
  - The 2017 Tax Cuts and Jobs Act provisions set to expire in 2025 drove fundraising throughout

**How to find more events and exact dates:**

Use the **Congress.gov API** to fetch bill actions with dates:
```
GET https://api.congress.gov/v3/bill/118/hr/7024/actions
```
This returns each action (committee referral, markup, floor vote, etc.) with a date and type classification. No API key is required for basic access, but there is a free sign-up at `https://api.congress.gov/sign-up/`.

Also search for committee hearing schedules:
```
GET https://api.congress.gov/v3/committee/house/HSWM/reports?congress=118
```

**Target: 15–25 discrete events** spanning 2023–2024 with exact dates.

**Output format** (`config/legislative_events.json`):
```json
[
  {
    "bill": "H.R. 7024",
    "bill_title": "Tax Relief for American Families and Workers Act of 2024",
    "event_type": "committee_markup",
    "date": "2024-01-19",
    "committee": "ways_and_means",
    "chamber": "house",
    "description": "Ways & Means Committee marks up and advances the bill",
    "sectors_affected": ["Finance", "Technology", "Real Estate", "Healthcare"],
    "significance": "high"
  },
  {
    "bill": "H.R. 7024",
    "bill_title": "Tax Relief for American Families and Workers Act of 2024",
    "event_type": "floor_vote",
    "date": "2024-01-31",
    "committee": "ways_and_means",
    "chamber": "house",
    "description": "House passes the bill 357-70",
    "sectors_affected": ["Finance", "Technology", "Real Estate", "Healthcare"],
    "significance": "high"
  }
]
```

### 2. Contribution Timing Extraction (`scripts/10_contribution_timing.py`)

We already have transaction-level contribution data **with dates** in processed parquet files:

- **PAC contributions:** `data/processed/pac_contributions_2024.parquet` (64,242 transactions)
  - Columns: `CMTE_ID`, `NAME`, `TRANSACTION_DT`, `TRANSACTION_AMT`, `CAND_ID`, `MEMO_CD`, `MEMO_TEXT`
  - `TRANSACTION_DT` is a string in `MMDDYYYY` format (e.g., `"01052023"`)
  - Some values may be null/NaN — filter these out

- **Individual contributions:** `data/processed/contributions_2024_classified.parquet` (877,369 transactions)
  - Has all the above plus `member_name`, `member_party`, `geo_class`, `employer_normalized`
  - `TRANSACTION_DT` same format

**Date parsing:** Convert `MMDDYYYY` strings to proper dates:
```python
pd.to_datetime(df["TRANSACTION_DT"], format="%m%d%Y", errors="coerce")
```

**For PAC contributions**, you need to link `CMTE_ID` to a sector using `config/pac_sectors.json` (75 curated PAC mappings). Also join `CAND_ID` against `config/members.json` → `fec_candidate_id` to get member names.

**Output:** Two aggregated time series CSVs:

`output/pac_weekly_totals.csv`:
```
week_start,sector,total_amount,transaction_count,distinct_pacs,distinct_recipients
2023-01-02,Finance,245000,32,8,15
2023-01-09,Finance,180000,24,6,12
...
```

`output/individual_weekly_totals.csv`:
```
week_start,geo_class,total_amount,transaction_count,distinct_donors
2023-01-02,out_of_state,1200000,450,380
2023-01-09,dc_kstreet,350000,120,95
...
```

Use **ISO week start dates (Monday)** for aggregation. Cover the full 2023-01-01 through 2024-12-31 range.

### 3. Event Window Analysis

For each legislative event, compute contribution metrics in defined windows:

- **Baseline:** Average weekly contributions 90–30 days before the event
- **Pre-event:** 30 days before the event
- **Event week:** The week containing the event
- **Post-event:** 30 days after the event

Compute for each window:
- Total PAC $ to committee members
- Total PAC $ from the *specific sectors affected* by the bill
- Total individual $ from DC/K-Street donors
- Transaction counts

Then calculate:
- **Spike ratio:** event-week / baseline (e.g., 2.3x means contributions were 130% above normal)
- **Pre-event surge:** was there a statistically meaningful increase in the 30 days before?
- **Sector specificity:** did the *relevant* sector spike more than other sectors? (This is the key test — if finance PAC money spikes around a finance-relevant bill but energy PAC money doesn't, that's targeted timing, not coincidence.)

**Output:** `output/event_timing_analysis.csv`
```
bill,event_type,date,sector,baseline_weekly_avg,pre_event_total,event_week_total,post_event_total,spike_ratio,sector_specific
H.R. 7024,committee_markup,2024-01-19,Finance,45000,180000,92000,65000,2.04,true
H.R. 7024,committee_markup,2024-01-19,All Sectors,120000,480000,245000,190000,2.04,false
```

### 4. Webapp Visualization

**Data file:** `webapp/data/contribution_timing.json`

Structure:
```json
{
  "weekly_pac_totals": [
    { "week": "2023-01-02", "total": 245000, "finance": 80000, "healthcare": 45000, ... }
  ],
  "events": [
    { "date": "2024-01-19", "label": "H.R. 7024 Markup", "significance": "high" }
  ],
  "event_analysis": [
    { "bill": "H.R. 7024", "event": "committee_markup", "spike_ratio": 2.04, ... }
  ]
}
```

**Visualization (add to PACs page or a new `/timing` page):**

The most impactful visualization is a **time series area chart** (Recharts `AreaChart`) with:
- X-axis: weeks across 2023–2024
- Y-axis: total PAC contributions that week
- Stacked areas by sector (color-coded using existing `sector_colors.json`)
- **Vertical marker lines** at each legislative event date, labeled with bill name
- Hover tooltip showing: week total, breakdown by sector, and any legislative event that week

This chart should make spikes visually obvious. If PAC money surges around event markers, the story tells itself.

**Additional visualization:** A small **spike ratio table** below the chart showing the top 5 events by spike ratio, with columns: Event, Date, Relevant Sector, Spike Ratio, $ in Event Week.

**Integration points:**
- `webapp/lib/data.ts` — add `ContributionTiming` interface and `getContributionTiming()` loader
- `webapp/components/TimingChart.tsx` — new client component (`"use client"`) using Recharts AreaChart + ReferenceLine for events
- `webapp/app/pacs/page.tsx` — add section, or consider a dedicated `/timing` route if it's too much for one page
- `webapp/scripts/import-data.ts` — convert `output/event_timing_analysis.csv` + weekly totals to JSON

**Follow existing patterns:** Server component loads data, passes to client chart component. See `PacCharts.tsx` for the established pattern.

### 5. Narrative Framing

Add interpretive text above the chart. Example caption:

> "PAC contributions don't arrive at random. They cluster around the moments that matter most — committee markups and floor votes on major tax legislation. When the Ways & Means Committee marked up H.R. 7024 in January 2024, finance-sector PAC contributions spiked to [X]× their weekly average."

The exact numbers should be computed from the data, not hardcoded. Use the spike ratios from the event analysis.

**Important:** If the data shows NO meaningful timing pattern, say so honestly. A null result ("PAC contributions appear evenly distributed regardless of legislative calendar") is valuable and should be reported.

## Data Requirements Summary

| What | Source | API Key Needed? | Already Have? |
|------|--------|-----------------|---------------|
| PAC contributions with dates | `data/processed/pac_contributions_2024.parquet` | No | ✅ Yes (64K transactions) |
| Individual contributions with dates | `data/processed/contributions_2024_classified.parquet` | No | ✅ Yes (877K transactions) |
| PAC sector mappings | `config/pac_sectors.json` | No | ✅ Yes (75 PACs, 14 sectors) |
| Member FEC IDs | `config/members.json` | No | ✅ Yes (72 members) |
| Legislative event dates | Congress.gov API + manual curation | Free API key (optional) | ❌ Must build |
| Sector color assignments | `webapp/data/sector_colors.json` | No | ✅ Yes |

**This analysis requires NO new FEC data downloads and NO paid API keys.** Everything is either already in the processed parquet files or freely available from the Congress.gov API. The only curation needed is identifying 15–25 key legislative events and their dates.

## File Placement

```
config/legislative_events.json               # Curated legislative event timeline
scripts/10_contribution_timing.py            # Extraction + analysis script
output/pac_weekly_totals.csv                 # Weekly PAC aggregates by sector
output/individual_weekly_totals.csv          # Weekly individual aggregates by geo class
output/event_timing_analysis.csv             # Spike analysis per event
webapp/data/contribution_timing.json         # Webapp-ready combined JSON
webapp/components/TimingChart.tsx             # Recharts time series + event markers
```

## Important Notes

- Read `CLAUDE.md` for full project conventions, tech stack, and common issues.
- **Date parsing is critical.** The `TRANSACTION_DT` field is `MMDDYYYY` as a string with some null values. Parse with `errors="coerce"` and drop NaT results. Some dates may be malformed (e.g., `00002023`) — handle gracefully.
- The project uses Python 3.11+ (via anaconda3) for pipeline scripts. Parquet files require `pandas` and `pyarrow` (already installed).
- Node.js 24 is currently installed but **incompatible** with Next.js 16. Dev mode may work after `npm install --legacy-peer-deps`. Don't spend time debugging build failures — it's a known environment issue.
- For the Recharts visualization, use `ReferenceLine` for event markers on the AreaChart. See Recharts docs. The project already uses Recharts extensively in `PacCharts.tsx`.
- The PAC contributions parquet (`pac_contributions_2024.parquet`) covers ALL PAC-to-candidate transactions for 2024-cycle target committees, not just the 75 curated PACs. You'll need to join against `pac_sectors.json` by `CMTE_ID` for sector assignment — unmatched PACs should go in an "Other/Unclassified" bucket.
- Weekly aggregation smooths out noise. Daily would be too granular; monthly would lose the signal. ISO weeks (Monday start) are standard.
- If including 2026-cycle data (`pac_contributions_2026.parquet`), note that it's partial/in-progress.

## Success Criteria

The analysis is complete when you can make one of these statements:

**If signal exists:** "In the 30 days surrounding the [event], PAC contributions from [sector] to committee members were [X]× their weekly baseline — compared to [Y]× for unrelated sectors."

**If no signal:** "PAC contributions to committee members show no statistically meaningful correlation with the legislative calendar. Money flows at a relatively steady rate regardless of when markups or votes occur."

Either finding is valuable. Do not force a narrative that the data doesn't support.
