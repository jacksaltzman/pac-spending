# Before/After Committee Appointment Analysis — Design

## Problem

The project shows W&M members receive 66% more PAC money than the median House incumbent. But that doesn't prove causation — maybe strong fundraisers get appointed to powerful committees. The before/after analysis controls for this: if the same person's PAC receipts jump after appointment, the committee seat itself is attracting the money.

## Architecture

Four deliverables:

### 1. Committee History Data (`config/committee_history.json`)

Committee appointment dates for all 72 members. Sourced from Congress.gov API first, web research as fallback.

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

### 2. Pipeline Script (`scripts/09_before_after.py`)

Standalone Python script that:
- Fetches historical PAC receipts from FEC API `/candidates/totals/` for cycles 2014–2024 (6 cycles x 72 members = ~432 calls)
- Saves raw results to `data/processed/historical_pac_receipts.csv`
- Joins with `config/committee_history.json`
- Classifies each cycle as before/after (transition cycle excluded)
- Computes per-member and aggregate stats
- Outputs `output/before_after_summary.csv`

Edge cases:
- Members appointed before 2014: flagged, excluded from before/after comparison, included in "after" aggregates
- Members with only 1 "after" cycle: flagged, included with caveat
- Members not found in FEC API: skipped gracefully
- Transition cycle (cycle of appointment): excluded from both groups

### 3. Import Script Update (`webapp/scripts/import-data.ts`)

Extended to convert `output/before_after_summary.csv` → `webapp/data/before_after.json`.

### 4. Webapp Integration (`webapp/app/pacs/page.tsx`)

New section "The Committee Seat Premium" placed after the benchmark comparison:
- Headline stat (median % increase in PAC receipts)
- Table/chart showing members with most dramatic before/after changes
- Caveat noting sample sizes and limitations
- Data loaded via new `getBeforeAfter()` in `webapp/lib/data.ts`

## Data Flow

```
Congress.gov API → config/committee_history.json
FEC API /candidates/totals/ → data/processed/historical_pac_receipts.csv
Both → scripts/09_before_after.py → output/before_after_summary.csv
→ import-data.ts → webapp/data/before_after.json
→ pacs/page.tsx renders new section
```

## Success Criteria

Can answer: "On average, members saw their PAC receipts change by X% in the election cycle after joining the tax-writing committee, based on N members with before-and-after data."
