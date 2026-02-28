# Industry-Aggregate Individual Contributions — Design

## Problem

PAC contributions are the smallest and most regulated channel of industry influence. Individual contributions from industry employees dwarf PAC money but are invisible because they require employer-level classification. 50 Goldman Sachs executives each giving $3,300 individually is $165K — 16x more than a $10K PAC contribution — and currently untracked.

## Architecture

4 deliverables:

### 1. Employer-to-Sector Mapping (`config/employer_sectors.json`)

Curated mapping of top ~200 employers to 15 sectors (existing 14 + "Lobbying & Gov Relations"). Built by analyzing the top employers from the parquet data.

### 2. Classification + Aggregation Script (`scripts/11_classify_employers.py`)

Python script that:
- Loads 877K contributions from `contributions_2024_classified.parquet`
- Classifies each by sector using 3-tier priority: curated employer map → keyword fallbacks → occupation fallback
- Buckets non-industry (retired/self-employed) separately
- Aggregates: sector totals with PAC comparison, per-member breakdowns, top employers by sector
- Outputs enriched parquet + 3 CSVs

Classification priority:
1. Non-industry filter (RETIRED, SELF-EMPLOYED, NOT EMPLOYED, etc.) → skip
2. Curated employer map → exact sector
3. Keyword matching from pac_sectors.json keyword_fallbacks on employer name
4. Occupation fallback (ATTORNEY → Professional Services, PHYSICIAN → Healthcare, etc.)
5. Unclassified bucket (reported honestly)

### 3. Import Script + Webapp Data

Extend `import-data.ts` to convert CSVs to `webapp/data/industry_influence.json` with sector totals, top employers by sector, and classification coverage stats.

### 4. Webapp: "The Full Picture" Section

New section on the PACs page with:
- Paired horizontal bar chart (individual vs PAC $ by sector) via new `IndustryChart.tsx` client component
- "Industry Employees Funding the Committee" top employers table
- Classification coverage disclaimer
- Interpretive caption about the individual-to-PAC ratio

New 15th sector: "Lobbying & Gov Relations" — broken out from Professional Services because DC lobbying firms (Capitol Counsel, BGR, Invariant, Brownstein Hyatt) are among the top individual-dollar employers and the editorial story is distinct.

## Data Flow

```
contributions_2024_classified.parquet
  + config/employer_sectors.json (curated ~200 employers)
  + config/pac_sectors.json (keyword fallbacks)
  → scripts/11_classify_employers.py
  → data/processed/contributions_2024_with_sectors.parquet
  → output/industry_individual_totals.csv
  → output/industry_per_member.csv
  → output/industry_top_employers.csv
  → import-data.ts → webapp/data/industry_influence.json
  → IndustryChart.tsx + pacs/page.tsx
```

## Key Numbers

- 877K contributions, $103M total
- ~68% non-industry (retired/self-emp), ~32% with employers (~$35M)
- Curated mapping of top ~200 employers should cover 60-70% of classifiable dollars
- PAC comparison data already in pac_spread.json

## Success Criteria

Can state: "Individual contributions from [sector] employees totaled $X — Y× more than direct PAC contributions from the same industry. PAC money is just the tip of a much larger flow of industry money."
