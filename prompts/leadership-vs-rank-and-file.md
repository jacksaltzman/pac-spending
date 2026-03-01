# Agent Prompt: Chair/Leadership vs. Rank-and-File Comparison

## Objective

Determine whether committee chairs, subcommittee chairs, and ranking members receive disproportionately more PAC money and outside funding than rank-and-file committee members. If PACs concentrate their spending on members who hold the most procedural power — the ones who set hearing agendas, decide which bills get a markup, and control amendments — that's evidence of strategic access-buying, not just blanket committee-targeting.

## Why This Matters

The project currently treats all 72 committee members equally. But a subcommittee chair who controls which bills get heard has vastly more leverage than a freshman back-bencher. If the data shows PACs disproportionately fund leadership positions, it sharpens the story from "PACs fund the committee" to "PACs fund the people who actually control the committee."

**Early signal (already confirmed):** A quick analysis of House W&M leadership (chair + 6 subcommittee chairs + ranking member) vs. rank-and-file shows leadership receives **66% more PAC money** at the median ($1.85M vs. $1.12M). This analysis needs to be formalized, expanded to the Senate, and visualized.

## What Already Exists

### Data we have:

1. **72 members with PAC contribution totals** — `webapp/data/members.json`
   - `fec_pac_contributions`: total PAC money (from FEC candidate summary; available for 64/72 members)
   - `fec_total_receipts`: total fundraising
   - `total_itemized_amount`: itemized individual contributions analyzed by the pipeline
   - `pct_outside`, `pct_dc_kstreet`: geographic breakdown percentages
   - `role`: currently only "Chair", "Ranking Member", or "Member" (no subcommittee info)

2. **Basic role field** — `config/members.json` has `role` for each member, but only captures full committee Chair (2) and Ranking Member (2). The other 68 are just "Member" — even subcommittee chairs.

3. **PAC spread data** — `webapp/data/pac_spread.json` has per-PAC contribution data including which members each PAC funds (`recipients` field), enabling analysis of whether PACs give *more* to leadership than to rank-and-file.

### What's missing:

- **Subcommittee chair/ranking assignments** for all members
- **Seniority data** (years on committee) — needed as a control, since senior members are both more likely to hold leadership positions AND to have accumulated more PAC relationships over time
- **Formalized analysis** comparing leadership tiers

## What You're Building

### 1. Enriched Leadership Data (`config/committee_leadership.json`)

Create a comprehensive leadership mapping for the 118th Congress (2023–2024).

**House Ways & Means — already confirmed:**

| Role | Member | Party-State |
|------|--------|-------------|
| Full Committee Chair | Jason Smith | R-MO |
| Full Committee Ranking Member | Richard Neal | D-MA |
| Subcommittee Chair: Health | Vern Buchanan | R-FL |
| Subcommittee Chair: Tax | Mike Kelly | R-PA |
| Subcommittee Chair: Trade | Adrian Smith | R-NE |
| Subcommittee Chair: Work and Welfare | Darin LaHood | R-IL |
| Subcommittee Chair: Oversight | David Schweikert | R-AZ |
| Subcommittee Chair: Social Security | Drew Ferguson | R-GA |

Source: [Ways and Means announcement](https://waysandmeans.house.gov/2023/01/27/smith-announces-118th-congress-ways-and-means-subcommittee-chairs/)

**Also need:** Subcommittee Ranking Members (Democratic side). Look these up from the [Ways and Means membership page](https://waysandmeans.house.gov/members/) or congress.gov.

**Senate Finance — already confirmed:**

| Role | Member | Party-State |
|------|--------|-------------|
| Full Committee Chair | Mike Crapo | R-ID |
| Full Committee Ranking Member | Ron Wyden | D-OR |
| Subcommittee Chair: Social Security, Pensions, and Family Policy | Chuck Grassley | R-IA |
| Subcommittee Chair: International Trade | John Cornyn | R-TX |
| Subcommittee Chair: Energy, Natural Resources, and Infrastructure | James Lankford | R-OK |
| Subcommittee Chair: Health Care | Todd Young | R-IN |
| Subcommittee Chair: Taxation and IRS Oversight | John Barrasso | R-WY |
| Subcommittee Chair: Fiscal Responsibility | Ron Johnson | R-WI |

Source: [Senate Finance subcommittees page](https://www.finance.senate.gov/about/subcommittees)

**Also need:** Subcommittee Ranking Members (Democratic side). Confirmed from the same source: Sanders, Warnock, Cantwell, Hassan, Bennet, Tina Smith.

**Leadership tiers** (assign each member to one):
- **Tier 1: Full Committee Leadership** — Chair + Ranking Member (4 total)
- **Tier 2: Subcommittee Leadership** — Subcommittee Chairs + Subcommittee Ranking Members (~24 total)
- **Tier 3: Rank-and-File** — all other members (~44 total)

**Output format** (`config/committee_leadership.json`):
```json
{
  "house_ways_and_means": {
    "full_committee": {
      "chair": "Jason Smith",
      "ranking_member": "Richard Neal"
    },
    "subcommittees": [
      {
        "name": "Health",
        "chair": "Vern Buchanan",
        "ranking_member": "TBD"
      }
    ]
  },
  "senate_finance": {
    "full_committee": {
      "chair": "Mike Crapo",
      "ranking_member": "Ron Wyden"
    },
    "subcommittees": [
      {
        "name": "Taxation and IRS Oversight",
        "chair": "John Barrasso",
        "ranking_member": "Michael Bennet"
      }
    ]
  },
  "member_tiers": {
    "Jason Smith": { "tier": 1, "title": "Committee Chair", "subcommittee": null },
    "Vern Buchanan": { "tier": 2, "title": "Subcommittee Chair", "subcommittee": "Health" },
    "Brendan Boyle": { "tier": 3, "title": "Rank-and-File", "subcommittee": null }
  }
}
```

### 2. Seniority Estimation

If the before/after committee analysis (`config/committee_history.json`) has already been completed, use `first_year` to compute seniority (years on committee). If not, estimate seniority from the member's first election year (available from congress.gov or Ballotpedia).

Seniority matters because it's a confounder: senior members are more likely to be subcommittee chairs AND to have more PAC relationships simply from being in office longer. The analysis should present results both raw and seniority-adjusted.

**Simple seniority proxy:** If `committee_history.json` exists, use `2024 - first_year`. If not, use the member's first election year from the FEC candidate data or manually curate.

### 3. Analysis Script (`scripts/12_leadership_analysis.py`)

Load `webapp/data/members.json` + `config/committee_leadership.json`. Compute:

**a) Tier comparison (the headline numbers):**

For each chamber separately AND combined:
```
tier,count,median_pac,mean_pac,median_receipts,mean_receipts,median_pct_outside,median_pct_dc
Full Committee Leadership,4,X,X,X,X,X,X
Subcommittee Leadership,~24,X,X,X,X,X,X
Rank-and-File,~44,X,X,X,X,X,X
```

Compute:
- **PAC premium:** How much more PAC money does each tier receive vs. rank-and-file?
- **Outside funding premium:** Do leaders get a higher % of out-of-state money?
- **DC/K-Street premium:** Do leaders get a higher % from the Beltway corridor?
- **Statistical significance:** With small samples (especially Tier 1 = 4 members), use appropriate measures. Report medians, not just means. Note sample sizes.

**b) Per-PAC analysis — do individual PACs give MORE to leaders?**

Using `webapp/data/pac_spread.json`, which has per-PAC recipient lists: for the top 20 PACs by reach, compute whether their per-member giving is higher for leadership than rank-and-file. This requires parsing the `recipients` field in pac_spread.json.

If pac_spread.json doesn't have per-member amounts (just total and count), use `webapp/data/pacs.json` which has per-member PAC contributions. Cross-reference: for a given PAC, how much did it give to leadership members vs. rank-and-file members?

**c) Subcommittee relevance — do sector PACs target the *right* subcommittee chairs?**

This is the most interesting cut. Does the finance industry concentrate money on the chair of the Tax subcommittee (Mike Kelly) and the Taxation and IRS Oversight subcommittee (John Barrasso)? Do healthcare PACs concentrate on the Health subcommittee chairs (Buchanan, Todd Young)?

Cross-reference PAC sectors (from `config/pac_sectors.json`) with subcommittee jurisdiction:
- Tax/Taxation → Finance & Insurance, Professional Services
- Health/Health Care → Healthcare & Pharma
- Trade/International Trade → Retail & Consumer, Transportation, Tech & Telecom
- Energy/Natural Resources → Energy & Utilities
- Social Security/Pensions → Finance & Insurance, Labor
- Work and Welfare → Labor
- Oversight/Fiscal → Finance & Insurance, Professional Services

Compute: For each subcommittee chair, what share of their PAC money comes from the sector most relevant to their subcommittee jurisdiction? Compare to the committee-wide average for that sector.

**Output files:**
- `output/leadership_tier_comparison.csv`
- `output/leadership_pac_targeting.csv` (per-PAC amounts to leaders vs. rank-and-file)
- `output/leadership_subcommittee_sector_match.csv` (sector money alignment)

### 4. Webapp Integration

**Data file:** `webapp/data/leadership_analysis.json`
```json
{
  "tier_comparison": {
    "house": [
      { "tier": "Full Committee Leadership", "count": 2, "median_pac": X, "median_receipts": X, "premium_vs_rank_file": X },
      { "tier": "Subcommittee Leadership", "count": N, "median_pac": X, ... },
      { "tier": "Rank-and-File", "count": N, "median_pac": X, ... }
    ],
    "senate": [ ... ],
    "combined": [ ... ]
  },
  "subcommittee_sector_alignment": [
    { "subcommittee": "Tax", "chair": "Mike Kelly", "relevant_sector": "Finance & Insurance", "chair_sector_pac_pct": 42, "committee_avg_sector_pac_pct": 28 }
  ],
  "headline": {
    "leadership_premium_pct": 66,
    "full_chair_premium_pct": X,
    "most_targeted_chair": "Jason Smith",
    "most_sector_aligned_subcommittee": "Tax"
  }
}
```

**Add to PACs page** (`webapp/app/pacs/page.tsx`):

**a) "Where Power Sits, Money Follows" — tier comparison visualization**

A grouped bar chart or stat cards showing the three tiers side by side:
- Tier 1 (Committee Leadership): median PAC $X
- Tier 2 (Subcommittee Leadership): median PAC $Y
- Tier 3 (Rank-and-File): median PAC $Z

Visual emphasis on the step-up at each tier. Use a simple horizontal bar or stacked column.

**b) "PACs Know Who Sets the Agenda" — subcommittee sector alignment**

A small table showing each subcommittee chair, their jurisdiction, the most relevant industry sector, and what % of their PAC money comes from that sector vs. the committee average. Example row:

> Mike Kelly (R-PA), Chair of Tax Subcommittee — 42% of PAC money from Finance & Insurance (vs. 28% committee avg)

This is the most compelling finding if it holds: PACs aren't just funding the committee broadly — they're *targeting the specific chairs who control their issue area*.

**c) Interpretive caption:**

> "Not all committee seats are equal. The members who set hearing agendas and decide which bills get a markup receive [X]% more PAC money than rank-and-file members — and the industries funding them match the jurisdictions they control."

**New files:**
- `webapp/components/LeadershipChart.tsx` — `"use client"` component for tier comparison visualization
- `webapp/lib/data.ts` — add `LeadershipAnalysis` interface and `getLeadershipAnalysis()` loader
- `webapp/scripts/import-data.ts` — convert analysis CSVs to `leadership_analysis.json`

### 5. Update Member Detail Pages

On `webapp/app/members/[slug]/page.tsx`, add a small badge or line showing the member's leadership role if they hold one:
- "Chair, Ways & Means Committee" (Tier 1)
- "Chair, Health Subcommittee" (Tier 2)

Also update `webapp/data/members.json` to include the enriched `tier` and `leadership_title` fields so they're available throughout the app.

## Data Requirements Summary

| What | Source | API Key? | Already Have? |
|------|--------|----------|---------------|
| 72 members with PAC totals | `webapp/data/members.json` | No | ✅ Yes (64/72 have PAC data) |
| Full committee chairs/ranking | `config/members.json` → `role` field | No | ✅ Yes (4 members) |
| Subcommittee chairs (House W&M) | [W&M press release](https://waysandmeans.house.gov/2023/01/27/smith-announces-118th-congress-ways-and-means-subcommittee-chairs/) | No | ✅ Confirmed above (6 chairs) |
| Subcommittee chairs (Senate Finance) | [Senate Finance website](https://www.finance.senate.gov/about/subcommittees) | No | ✅ Confirmed above (6 chairs + 6 ranking) |
| Subcommittee ranking members (House W&M) | W&M website or congress.gov | No | ❌ Need to look up (~6 members) |
| PAC sector classifications | `config/pac_sectors.json` | No | ✅ Yes (75 PACs, 14 sectors) |
| Per-member PAC details | `webapp/data/pacs.json` | No | ✅ Yes |
| Seniority/committee tenure | `config/committee_history.json` (if built) or manual | No | ⚠️ Depends on before/after analysis |

**No API keys needed. No new downloads. The only manual work is looking up ~6 House W&M subcommittee ranking members and building the leadership JSON file (~30 minutes of curation).**

## File Placement

```
config/committee_leadership.json                  # Curated leadership assignments
scripts/12_leadership_analysis.py                 # Analysis script
output/leadership_tier_comparison.csv             # Tier-level aggregates
output/leadership_pac_targeting.csv               # Per-PAC leader vs rank-and-file amounts
output/leadership_subcommittee_sector_match.csv   # Sector alignment analysis
webapp/data/leadership_analysis.json              # Webapp-ready JSON
webapp/components/LeadershipChart.tsx              # Tier comparison visualization
```

## Important Notes

- Read `CLAUDE.md` for full project conventions, tech stack, and common issues.
- **Senate PAC data caveat:** `fec_pac_contributions` is null for some Senate members (especially those not up for reelection in 2024). The Senate comparison will have smaller sample sizes. Always report N.
- **Seniority is a confounder.** If you find that leadership gets more PAC money, a skeptic will say "that's just because senior members have more PAC relationships." Address this by: (a) showing the premium holds within-party, (b) if seniority data is available, showing the premium holds after controlling for tenure, (c) at minimum, acknowledging the limitation in the webapp text.
- **Small sample warning for Tier 1.** Only 4 full committee leaders — too few for statistical claims. Present the data but frame it as "notable" rather than "statistically significant." Tier 2 (~24 members) is a more defensible comparison group.
- The subcommittee-sector alignment analysis (section 3c) is the most novel and compelling part. Prioritize it.
- Node.js 24 is currently installed but **incompatible** with Next.js 16. Dev mode may work after `npm install --legacy-peer-deps`. Don't debug build failures.
- Follow existing design patterns: server components load data, pass to client chart components. Use the project's color palette and typography conventions from CLAUDE.md.

## Success Criteria

The analysis is complete when you can state:

**Headline:** "Subcommittee chairs on the tax-writing committees receive [X]% more PAC money than rank-and-file members — and [Y]% of that money comes from the industries their subcommittee oversees."

**If the subcommittee-sector alignment holds:** This is the strongest finding. PACs don't just fund the committee — they fund the *specific gatekeeper* who controls their issue. That's strategic targeting, not generalized influence.

**If it doesn't hold:** Report honestly. Maybe PACs spread evenly across all leadership regardless of jurisdiction, which suggests "access to any power" rather than "access to specific policy control."
