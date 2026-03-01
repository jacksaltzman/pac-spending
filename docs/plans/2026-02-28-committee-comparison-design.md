# Cross-Committee PAC Comparison — Design

## Problem

The site shows that Ways & Means members receive +66% more PAC money than typical House incumbents, but the viewer can't answer: is that special to tax-writing committees, or is it just how powerful committees work? Comparing against other high-stakes committees (Armed Services, Appropriations, Energy & Commerce, Financial Services) answers that question.

## Approach

Curate FEC candidate IDs for members of 4 comparison House committees. Cross-reference against the existing webl24.txt all-candidates summary file to compute median PAC receipts per committee. No API calls needed — all PAC receipt data is already local.

## Committees

1. **House Ways & Means** (existing, ~41 members) — tax policy
2. **House Armed Services** (~60 members) — defense budget
3. **House Appropriations** (~60 members) — federal spending
4. **House Energy & Commerce** (~55 members) — healthcare, energy, telecom regulation
5. **House Financial Services** (~60 members) — banking, insurance, securities regulation

Senate excluded — off-cycle fundraising makes PAC comparisons unreliable (already noted in existing benchmarks).

## Data Flow

```
config/comparison_committees.json (curated rosters with FEC candidate IDs)
  + data/raw/webl_2024/webl24.txt (already exists)
  → scripts/12_committee_comparison.py
  → output/committee_comparison.csv
  → import-data.ts → webapp/data/committee_comparison.json
  → CommitteeComparisonChart.tsx + pacs/page.tsx (or dashboard)
```

## Files

- Create: `config/comparison_committees.json`
- Create: `scripts/12_committee_comparison.py`
- Output: `output/committee_comparison.csv`
- Modify: `webapp/scripts/import-data.ts`
- Modify: `webapp/lib/data.ts`
- Create: `webapp/components/CommitteeComparisonChart.tsx`
- Modify: `webapp/app/pacs/page.tsx` (enhance existing benchmarks section)

## Success Criteria

Can state: "Ways & Means members receive $X median PAC money — Y% more than Armed Services ($Z), and N% more than the typical House incumbent ($W). Tax-writing committees attract disproportionate PAC attention even compared to other powerful committees."
