# Agent Prompt: Before/After Committee Appointment Analysis

## Objective

Determine whether members of the House Ways & Means Committee and Senate Finance Committee receive more PAC money *after* joining the committee than they did *before*. This is the strongest test of whether PACs strategically target committee members for access — not just that committee members happen to be well-funded.

## Why This Matters

The project already shows that W&M members receive 66% more PAC money than the median House incumbent. But that stat doesn't prove causation — maybe strong fundraisers get appointed to powerful committees. The before/after analysis controls for this: if the *same person's* PAC receipts jump after appointment, the committee seat itself is attracting the money.

## What You're Building

### 1. Committee Appointment History (`config/committee_history.json`)

For each of the 72 members in `config/members.json`, determine the **Congress number (and year) they first joined** their current committee (Ways & Means or Finance).

**Data sources (try in this order):**

- **Congress.gov API** — free, no key required for basic access. Endpoint pattern:
  `https://api.congress.gov/v3/member/{bioguideId}` returns member info.
  `https://api.congress.gov/v3/committee/house/HSWM/members` (or `senate/SSFI`) for current membership.
  However, the API may not have *historical* committee assignment dates. Test it first.

- **@unitedstates/congress-legislators GitHub repo** — `committee-membership-current.yaml` has current assignments only, but `legislators-current.yaml` and `legislators-historical.yaml` have full bioguide IDs you can cross-reference. The repo does NOT have historical committee membership as YAML.

- **Charles Stewart's committee assignment data (MIT)** — Excel files at `http://web.mit.edu/17.251/www/data_page.html` covering House and Senate committee assignments from 1947–2017. This is the gold standard for historical data but only goes to the 115th Congress.

- **Manual curation as fallback** — For only 72 members, it's feasible to look up committee assignment dates from congress.gov member profile pages. Each member's page (e.g., `congress.gov/member/jason-smith/S001195`) lists their committee assignments. You may need to check Ballotpedia or house.gov/senate.gov as supplementary sources.

**Output format** (`config/committee_history.json`):
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

### 2. Historical PAC Receipts via FEC API

For each member, fetch PAC contribution totals across multiple election cycles using the FEC API.

**Endpoint:** `GET https://api.open.fec.gov/v1/candidates/totals/`
- `candidate_id`: from `config/members.json` → `fec_candidate_id` field
- `cycle`: 2024, 2022, 2020, 2018, 2016, 2014 (go back ~5 cycles)
- `api_key`: Use the environment variable `FEC_API_KEY`

**Key field:** `other_political_committee_contributions` — this is PAC money.
**Also capture:** `receipts` (total), `individual_itemized_contributions`, `coverage_start_date`, `coverage_end_date`

**Rate limiting:** The FEC API throttles aggressively. Add 1-second delays between requests. The existing utility at `utils/fec_api.py` has a rate-limited client you can reference, but this script should be standalone.

**Output:** `data/processed/historical_pac_receipts.csv`
```
name,fec_candidate_id,cycle,pac_receipts,total_receipts,individual_itemized
Jason Smith,H4MO08162,2024,3480068,5200000,1756920
Jason Smith,H4MO08162,2022,2100000,3800000,1200000
...
```

### 3. Before/After Analysis (`scripts/09_before_after.py`)

Join committee history with historical receipts. For each member:
- Classify each cycle as "before committee" or "after committee" based on `first_year`
- The cycle *of* appointment is "transition" — you can classify it either way or exclude it
- Compute:
  - **Median PAC receipts before** vs **median PAC receipts after**
  - **Mean PAC receipts before** vs **mean PAC receipts after**
  - **Percent change** on appointment
  - Same for total receipts and individual itemized (as controls)

**Important edge cases:**
- Members who were appointed before 2014 will have no "before" cycles in the data. Flag these — they're still useful for the "after" aggregate but not for the before/after comparison.
- Members who were appointed very recently (e.g., 2023) have only one "after" cycle. Flag these too.
- Some members may have served, left, and returned to the committee. Use the *most recent* appointment.

**Aggregated output:** `output/before_after_summary.csv`
```
name,fec_candidate_id,committee,first_year,cycles_before,cycles_after,median_pac_before,median_pac_after,pct_change,median_total_before,median_total_after
```

**Headline stats to compute:**
- "Members who joined W&M saw their PAC receipts increase by X% on average"
- "Y out of Z members with before/after data saw PAC receipts increase"
- Median increase across all members with ≥1 cycle before and ≥1 cycle after

### 4. Webapp Integration

**Data file:** `webapp/data/before_after.json` — summary stats + per-member detail

**Add to the PACs page** (`webapp/app/pacs/page.tsx`):
- A new section titled something like "The Committee Seat Premium" or "What Happens When You Join the Committee?"
- Show the headline stat (median % increase in PAC receipts)
- A small table or chart showing before/after for members with the most dramatic changes
- Include a caveat noting sample sizes and limitations

**Add to `webapp/lib/data.ts`:**
- `BeforeAfterSummary` interface and `getBeforeAfter()` loader

**Add to `webapp/scripts/import-data.ts`:**
- Copy `output/before_after_summary.csv` → `webapp/data/before_after.json`

## Data Requirements Summary

| What | Source | API Key Needed? | Already Have? |
|------|--------|-----------------|---------------|
| 72 current members + FEC candidate IDs | `config/members.json` | No | ✅ Yes |
| Committee appointment years | Congress.gov / manual curation | No (congress.gov API is free) | ❌ No — must build |
| PAC receipts by cycle (2014–2024) | FEC API `/candidates/totals/` | Yes — `FEC_API_KEY` env var (user has one) | ❌ No — must fetch |
| FEC bulk summary files (optional backup) | `fec.gov/files/bulk-downloads/{year}/webl{yy}.zip` | No | Only 2024 cycle |

**Total new data to collect:** ~72 members × 6 cycles = ~432 API calls to FEC (takes ~8 minutes with 1s rate limiting). Plus ~72 lookups for committee appointment dates.

## File Placement

```
config/committee_history.json          # Committee appointment dates (curated)
scripts/09_before_after.py             # Analysis script
data/processed/historical_pac_receipts.csv  # Raw FEC API results
output/before_after_summary.csv        # Analyzed results
webapp/data/before_after.json          # Webapp-ready JSON
```

## Important Notes

- Read `CLAUDE.md` for full project conventions, tech stack, and common issues.
- The project uses Python 3.11+ for pipeline scripts and Next.js 16 for the webapp.
- Node.js 24 is currently installed but is **incompatible** with Next.js 16. The dev server may work after `npm install --legacy-peer-deps` but `npm run build` will fail. Don't spend time debugging this — it's a known environment issue.
- The FEC API `DEMO_KEY` has very low rate limits (~30 requests/hour). The user has a real API key — make sure to use `os.environ.get("FEC_API_KEY")`.
- Some members in `config/members.json` may not return FEC API results (e.g., Mike Kelly, Beth Van Duyne). Skip them gracefully.
- For the webapp integration, follow existing patterns in `webapp/app/pacs/page.tsx` — server components, data loaded via `lib/data.ts`, styling with Tailwind using the project's design system (see CLAUDE.md for conventions).
- If you can't determine a member's committee appointment year from automated sources, leave the `first_year` field as `null` and note it. Don't guess.

## Success Criteria

The analysis is complete when you can answer: **"On average, members saw their PAC receipts change by X% in the election cycle after joining the tax-writing committee, based on N members with before-and-after data."**

If the answer is a large positive number (>20%), that's strong evidence of access-buying. If it's flat or negative, that challenges the narrative and is equally important to report honestly.
