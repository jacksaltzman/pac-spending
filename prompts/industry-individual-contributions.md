# Agent Prompt: Industry-Aggregate Individual Contributions

## Objective

Classify individual (non-PAC) contributions by industry sector to reveal the **full picture of industry influence** — not just PAC money but the much larger stream of individual donations from employees of the same companies and industries whose PACs are already funding committee members. A Goldman Sachs PAC contributing $10K is visible and tracked. 50 Goldman Sachs executives each giving $3,300 individually is $165K — 16× more money — and currently invisible in our analysis.

## Why This Matters

PAC contributions are the smallest and most regulated channel of industry influence. Individual contributions from industry employees dwarf PAC money but are harder to see because they require employer-level classification. By mapping employers to the same industry sectors we already use for PACs, we can answer:

- **Which industries are funding committee members through individual donors, not just PACs?**
- **Does the individual money follow the same patterns as PAC money?** (If finance PACs *and* finance employees both concentrate on the same members, that's a stronger signal.)
- **How much larger is the individual contribution channel vs. PACs?** (This is likely 5–10×.)
- **Are there industries that give heavily through individuals but NOT through PACs?** (e.g., Big Tech employees donate individually but tech PACs are smaller.)

## What Already Exists

### Data we have:

1. **877K classified individual contributions** — `data/processed/contributions_2024_classified.parquet`
   - Columns include: `EMPLOYER`, `employer_normalized`, `OCCUPATION`, `TRANSACTION_AMT`, `member_name`, `member_party`, `member_chamber`, `member_committee`, `geo_class`
   - `employer_normalized` is already cleaned via `config/employer_aliases.json` (35 major employer aliases)
   - ~30% of contributions have a "working" employer (the rest are RETIRED, NOT EMPLOYED, SELF-EMPLOYED, UNKNOWN)

2. **Employer alias mapping** — `config/employer_aliases.json`
   - 35 entries mapping employer name variants to canonical names
   - Covers major banks (Goldman Sachs, JPMorgan, etc.), Big Tech (Google, Microsoft, Amazon), Big Four accounting, etc.
   - Does NOT cover most mid-tier employers

3. **14 industry sectors with keyword fallbacks** — `config/pac_sectors.json`
   - `sectors`: 14 categories (Finance & Insurance, Healthcare & Pharma, Real Estate & Housing, Tech & Telecom, Energy & Utilities, Defense & Aerospace, Transportation, Retail & Consumer, Labor, Professional Services, Food & Beverage, Construction & Engineering, Ideological, Other Industry)
   - `keyword_fallbacks`: word lists for classifying entities by sector. Example: Finance keywords include BANK, INSURANCE, FINANCIAL, CREDIT UNION, SECURITIES, MORTGAGE, etc.
   - `sector_colors`: consistent color hex codes per sector (already used in webapp charts)

4. **Per-member employer rankings** — `webapp/data/employers.json`
   - 1,194 entries: `{ member_name, rank, employer, total, count }`
   - Top employers per member, but no sector classification

5. **OCCUPATION field** — raw string, top values: ATTORNEY (14K), TEACHER (10K), PHYSICIAN (10K), ENGINEER (7K), CONSULTANT (6K), CEO (5K), REAL ESTATE BROKER (3.5K), etc.

### What's missing:

- **Employer → sector mapping** for individual contributions. The PAC keyword fallbacks exist but haven't been applied to employer names.
- **Occupation → sector mapping** as a fallback for when employer is uninformative but occupation reveals the industry.
- **Aggregated industry-level view** of individual contributions (totals by sector, by member, compared to PAC totals).

## What You're Building

### 1. Employer-to-Sector Classification (`scripts/11_classify_employers.py`)

Apply the existing keyword fallback system from `config/pac_sectors.json` to the `employer_normalized` field in individual contributions. Then add occupation-based classification as a second pass.

**Classification strategy (in priority order):**

1. **Curated employer mapping** — Build `config/employer_sectors.json`, a mapping of the top ~100-200 employers (by total $ contributed) to sectors. Many of these are already recognizable from the employer aliases:
   - BLACKSTONE → Finance & Insurance
   - GOOGLE → Tech & Telecom
   - KIRKLAND & ELLIS → Professional Services
   - CAPITOL COUNSEL → Professional Services (lobbying)
   - GOLDMAN SACHS → Finance & Insurance
   - T-MOBILE → Tech & Telecom
   - UNITED AIRLINES → Transportation
   - etc.

   Start by pulling the top 200 employers by total contribution amount from the parquet file, then manually classify them. This covers the vast majority of dollars.

2. **Keyword matching on employer name** — For employers not in the curated list, apply `keyword_fallbacks` from `pac_sectors.json`. Match the employer_normalized string against keyword lists:
   ```python
   for sector, keywords in keyword_fallbacks.items():
       for kw in keywords:
           if kw in employer_normalized:
               return sector
   ```

3. **Occupation-based fallback** — For remaining unclassified contributions, use the `OCCUPATION` field:
   ```json
   {
     "Finance & Insurance": ["BANKER", "FINANCIAL ADVISOR", "INVESTMENT BANKER", "BROKER", "HEDGE FUND", "PRIVATE EQUITY", "VENTURE CAPITAL", "INVESTOR", "TRADER", "ACTUARY", "UNDERWRITER"],
     "Healthcare & Pharma": ["PHYSICIAN", "DOCTOR", "NURSE", "SURGEON", "DENTIST", "PHARMACIST", "THERAPIST", "PSYCHOLOGIST", "RADIOLOGIST", "OPTOMETRIST", "VETERINARIAN"],
     "Real Estate & Housing": ["REAL ESTATE", "REALTOR", "PROPERTY MANAGER", "APPRAISER", "MORTGAGE BROKER", "REAL ESTATE BROKER", "REAL ESTATE AGENT", "LAND DEVELOPER"],
     "Professional Services": ["ATTORNEY", "LAWYER", "ACCOUNTANT", "CPA", "CONSULTANT", "LOBBYIST"],
     "Tech & Telecom": ["SOFTWARE ENGINEER", "PROGRAMMER", "DATA SCIENTIST", "IT ", "COMPUTER", "DEVELOPER"],
     "Energy & Utilities": ["GEOLOGIST", "PETROLEUM ENGINEER", "DRILLER", "OILFIELD"],
     "Construction & Engineering": ["ENGINEER", "ARCHITECT", "CONTRACTOR", "BUILDER"],
     "Food & Beverage": ["CHEF", "RESTAURATEUR", "WINEMAKER", "BREWER"],
     "Labor": ["UNION"],
     "Retail & Consumer": ["RETAIL", "SALES MANAGER"]
   }
   ```
   **Important:** "ENGINEER" is ambiguous — could be software, civil, petroleum, etc. Only use occupation fallback when employer classification fails, and prefer the more specific occupation strings.

4. **Unclassified bucket** — Contributions that can't be classified go in "Unclassified Individual". Do NOT force everything into a sector. Honest "unclassified" counts are important for credibility. Also, RETIRED / NOT EMPLOYED / SELF-EMPLOYED contributions are their own category ("Non-Industry") — they represent grassroots individual giving, not industry influence.

**Output:** Add a `sector` column to the classified contributions. Save as `data/processed/contributions_2024_with_sectors.parquet`.

Also output `config/employer_sectors.json`:
```json
{
  "_description": "Curated employer-to-sector mapping for top individual contributors",
  "employers": {
    "BLACKSTONE": "Finance & Insurance",
    "APOLLO GLOBAL": "Finance & Insurance",
    "GOOGLE": "Tech & Telecom",
    "GOLDMAN SACHS": "Finance & Insurance",
    "KIRKLAND & ELLIS": "Professional Services",
    "CAPITOL COUNSEL": "Professional Services",
    "T-MOBILE": "Tech & Telecom"
  }
}
```

### 2. Industry Aggregation (`scripts/11_classify_employers.py` continued)

After classification, aggregate:

**a) Total individual $ by sector (across all members):**
```
sector,individual_total,individual_count,individual_donors,pac_total,pac_count,combined_total,individual_share_pct
Finance & Insurance,8500000,4200,2800,3200000,450,11700000,72.6
Healthcare & Pharma,4200000,3100,2100,2800000,380,7000000,60.0
...
```

The `pac_total` column comes from the existing PAC sector aggregates in `webapp/data/pac_spread.json`. This side-by-side comparison is the core deliverable.

**b) Per-member industry breakdown:**
```
member_name,sector,individual_total,individual_count,pac_total_estimated
Jason Smith,Finance & Insurance,245000,96,180000
Jason Smith,Professional Services,120000,58,45000
...
```

**c) Top employers by sector (the "who's really giving" table):**
```
sector,employer,total,count,distinct_members_funded
Finance & Insurance,BLACKSTONE,490426,196,12
Finance & Insurance,GOLDMAN SACHS,156126,103,8
Finance & Insurance,APOLLO GLOBAL,332366,181,6
...
```

**Output files:**
- `output/industry_individual_totals.csv`
- `output/industry_per_member.csv`
- `output/industry_top_employers.csv`

### 3. Webapp Integration

**Data file:** `webapp/data/industry_influence.json`
```json
{
  "sector_totals": [
    {
      "sector": "Finance & Insurance",
      "individual_total": 8500000,
      "individual_donors": 2800,
      "pac_total": 3200000,
      "combined_total": 11700000,
      "individual_share_pct": 72.6
    }
  ],
  "top_employers_by_sector": {
    "Finance & Insurance": [
      { "employer": "BLACKSTONE", "total": 490426, "count": 196, "members_funded": 12 }
    ]
  },
  "classification_coverage": {
    "classified_total": 45000000,
    "unclassified_total": 12000000,
    "non_industry_total": 35000000,
    "classified_pct": 48.9
  }
}
```

**Visualization — add to PACs page** (`webapp/app/pacs/page.tsx`):

**a) "The Full Picture: PAC Money Is Just the Tip" — paired bar chart**

A grouped horizontal bar chart (Recharts `BarChart`) with one row per sector. Each row has two bars:
- PAC contributions (solid color)
- Individual employee contributions (same color, lighter/hatched)

This instantly shows that individual money dwarfs PAC money in most sectors. Add an interpretive caption:

> "For every dollar a PAC contributes directly, employees of the same industry give [X] dollars individually. PAC contributions are the visible tip of a much larger flow of industry money into these committees."

**b) "Industry Employees Funding the Committee" — top employers table**

Table showing the top 15-20 employers by total individual contributions, with columns: Employer, Sector, Total, # Donations, # Members Funded. Color-code sector.

**c) Per-member breakdown** (optional, on member detail pages):

On `webapp/app/members/[slug]/page.tsx`, add a small "Individual Contributions by Industry" section showing which sectors' employees are funding that member.

**New files:**
- `webapp/components/IndustryChart.tsx` — `"use client"` component for the paired bar chart
- `webapp/lib/data.ts` — add `IndustryInfluence` interface and `getIndustryInfluence()` loader
- `webapp/scripts/import-data.ts` — convert CSVs to `industry_influence.json`

**Follow existing patterns:** See `PacCharts.tsx` for Recharts bar chart conventions. See `pac_sectors.json` → `sector_colors` for consistent color assignments.

### 4. Employer Alias Expansion

The current `config/employer_aliases.json` only has 35 entries. While building the curated employer-to-sector mapping, also expand the alias file to improve normalization. Common patterns to catch:

- "APOLLO GLOBAL" vs "APOLLO" vs "APOLLO GLOBAL MANAGEMENT" → all APOLLO GLOBAL
- "BGR" vs "BGR GROUP" vs "BGR GOVERNMENT AFFAIRS" → all BGR GROUP (lobbying firm)
- "INVARIANT" vs "INVARIANT LLC" → INVARIANT (lobbying firm)
- "WCAS" vs "WELSH CARSON ANDERSON & STOWE" → WCAS (private equity)
- "CAPITOL TAX" vs "CAPITOL TAX PARTNERS" → CAPITOL TAX PARTNERS (tax lobbying firm)

Look at the top 200 employers and identify obvious variants that should merge. Add them to `employer_aliases.json`.

**After expanding aliases, re-run the normalization** on the parquet file so the sector classification works on cleaner data. The normalization code is in `scripts/06_normalize_employers.py` — or you can apply aliases inline in the new script.

## Data Requirements Summary

| What | Source | API Key? | Already Have? |
|------|--------|----------|---------------|
| 877K individual contributions with employers | `data/processed/contributions_2024_classified.parquet` | No | ✅ Yes |
| Employer aliases | `config/employer_aliases.json` | No | ✅ Yes (35 entries, needs expansion) |
| Sector keyword fallbacks | `config/pac_sectors.json` → `keyword_fallbacks` | No | ✅ Yes (14 sectors) |
| Sector colors | `config/pac_sectors.json` → `sector_colors` | No | ✅ Yes |
| PAC sector totals (for comparison) | `webapp/data/pac_spread.json` | No | ✅ Yes |
| Curated employer → sector mapping | Needs manual curation (~200 employers) | No | ❌ Must build |
| Occupation → sector mapping | Needs curation (~50 occupation keywords) | No | ❌ Must build |

**No API keys needed. No new data downloads. Everything is in the existing parquet files.**

The only manual work is curating the top ~200 employer-to-sector mappings and expanding occupation keyword lists. This is straightforward because the top employers are well-known companies.

## File Placement

```
config/employer_sectors.json                              # Curated employer → sector mapping
scripts/11_classify_employers.py                          # Classification + aggregation
data/processed/contributions_2024_with_sectors.parquet    # Enriched contributions
output/industry_individual_totals.csv                     # Sector-level aggregates (individual vs PAC)
output/industry_per_member.csv                            # Per-member industry breakdown
output/industry_top_employers.csv                         # Top employers by sector
webapp/data/industry_influence.json                       # Webapp-ready JSON
webapp/components/IndustryChart.tsx                       # Paired bar chart component
```

## Important Notes

- Read `CLAUDE.md` for full project conventions, tech stack, and common issues.
- The project uses Python 3.11+ (anaconda3) for pipeline scripts. Parquet files require `pandas` and `pyarrow`.
- **Be honest about classification coverage.** Report what percentage of dollars you can classify. A 50% classification rate covering the top employers is more credible than a 95% rate with sloppy keyword matching. Include "Unclassified" and "Non-Industry (Retired/Not Employed)" as explicit categories in the output.
- **Don't double-count.** PAC contributions (`pac_contributions_2024.parquet`) and individual contributions (`contributions_2024_classified.parquet`) are separate files from separate FEC bulk datasets. They don't overlap. PAC money goes committee → candidate. Individual money goes person → candidate's committee. Make this distinction clear in the webapp.
- **Lobbying firms are their own story.** Employers like CAPITOL COUNSEL, BGR, INVARIANT, BROWNSTEIN HYATT, AKIN GUMP, OGILVY — these are DC lobbying/government relations firms. They could be their own category ("Lobbying & Government Relations") under Professional Services, or flagged separately. Their employees' contributions are among the most strategically interesting in the dataset.
- Node.js 24 is currently installed but **incompatible** with Next.js 16. Dev mode may work after `npm install --legacy-peer-deps`. Don't debug build failures — known environment issue.
- The `OCCUPATION` field is raw and messy — many misspellings, abbreviations, and non-standard entries. Use fuzzy/substring matching, not exact matching.
- When computing "members funded" per employer, count distinct `member_name` values, not transactions.

## Success Criteria

The analysis is complete when you can state:

**"Individual contributions from [sector] employees totaled $[X] — [Y]× more than direct PAC contributions from the same industry ($[Z]). When you add individual and PAC money together, [sector] is the #1 source of industry funding for tax-writing committee members."**

The paired bar chart should make this disparity visually unmistakable. If individual money does NOT dwarf PAC money in a given sector, that's also worth noting — it could mean the industry relies more on PACs than grassroots employee giving.
