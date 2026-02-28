# Industry-Aggregate Individual Contributions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Classify individual (non-PAC) contributions by employer/industry sector, aggregate by sector with PAC comparison, and display a "Full Picture" section on the PACs page showing that individual employee money dwarfs PAC contributions.

**Architecture:** A Python script classifies 877K individual contributions using a 3-tier system (curated employer map → keyword fallbacks → occupation fallback), aggregates by sector alongside existing PAC totals, and a new Recharts client component renders paired bar charts on the PACs page.

**Tech Stack:** Python 3.11+, pandas, pyarrow; Next.js 16, TypeScript, Tailwind v4, Recharts

---

## Task 1: Build Curated Employer-to-Sector Mapping

**Files:**
- Create: `config/employer_sectors.json`

**Step 1: Analyze top employers and build the mapping**

Run this analysis to see top employers, then build the curated JSON. The top 50 employers by $ are already known from exploration:

```
BLACKSTONE ($490K) → Finance & Insurance
APOLLO GLOBAL ($332K) → Finance & Insurance
APOLLO ($233K) → Finance & Insurance (alias — should merge with APOLLO GLOBAL)
CAPITOL COUNSEL ($213K) → Lobbying & Gov Relations
GOOGLE ($202K) → Tech & Telecom
MICROSOFT ($183K) → Tech & Telecom
CAPITOL TAX ($171K) → Lobbying & Gov Relations
GOLDMAN SACHS ($156K) → Finance & Insurance
BGR ($151K) → Lobbying & Gov Relations
INVARIANT ($134K) → Lobbying & Gov Relations
ANDREESSEN HOROWITZ ($134K) → Finance & Insurance
WCAS ($122K) → Finance & Insurance (Welsh Carson Anderson & Stowe — PE)
BROWNSTEIN HYATT FARBER SCHRECK ($116K) → Lobbying & Gov Relations
AMAZON ($110K) → Tech & Telecom
PAUL WEISS RIFKIND WHARTON & GARRISON ($107K) → Professional Services (law firm)
T-MOBILE ($100K) → Tech & Telecom
COINBASE ($88K) → Finance & Insurance (crypto)
KIRKLAND & ELLIS ($85K) → Professional Services
TODD STRATEGY ($84K) → Lobbying & Gov Relations
FISHER INVESTMENTS ($81K) → Finance & Insurance
UNITED AIRLINES ($81K) → Transportation
AKIN GUMP ($81K) → Lobbying & Gov Relations
KKR ($80K) → Finance & Insurance
FIERCE GOVERNMENT RELATIONS ($80K) → Lobbying & Gov Relations
OGILVY GOVERNMENT RELATIONS ($79K) → Lobbying & Gov Relations
MAYER BROWN ($78K) → Professional Services (law firm)
DAVITA ($78K) → Healthcare & Pharma
CORNERSTONE GOVERNMENT AFFAIRS ($77K) → Lobbying & Gov Relations
ELLIOTT INVESTMENT ($71K) → Finance & Insurance
BRIGHTHOUSE FINANCIAL ($70K) → Finance & Insurance
NORTHWESTERN MUTUAL ($67K) → Finance & Insurance
AKIN GUMP STRAUSS HAUER & FELD ($67K) → Lobbying & Gov Relations (alias of AKIN GUMP)
AT&T ($61K) → Tech & Telecom
ROCKET COMPANIES ($61K) → Real Estate & Housing (mortgage)
ROCKET MORTGAGE ($59K) → Real Estate & Housing (alias of ROCKET COMPANIES)
SOROBAN CAPITAL ($59K) → Finance & Insurance
MORGAN STANLEY ($59K) → Finance & Insurance
FORBES TATE ($58K) → Lobbying & Gov Relations
```

Create `config/employer_sectors.json`:

```json
{
  "_description": "Curated employer-to-sector mapping for top individual contributors to tax-writing committee members",
  "employers": {
    "BLACKSTONE": "Finance & Insurance",
    "APOLLO GLOBAL": "Finance & Insurance",
    "APOLLO": "Finance & Insurance",
    "CAPITOL COUNSEL": "Lobbying & Gov Relations",
    "GOOGLE": "Tech & Telecom",
    "MICROSOFT": "Tech & Telecom",
    "CAPITOL TAX": "Lobbying & Gov Relations",
    "CAPITOL TAX PARTNERS": "Lobbying & Gov Relations",
    "GOLDMAN SACHS": "Finance & Insurance",
    "BGR": "Lobbying & Gov Relations",
    "BGR GROUP": "Lobbying & Gov Relations",
    "INVARIANT": "Lobbying & Gov Relations",
    "INVARIANT LLC": "Lobbying & Gov Relations",
    "ANDREESSEN HOROWITZ": "Finance & Insurance",
    "WCAS": "Finance & Insurance",
    "WELSH CARSON ANDERSON & STOWE": "Finance & Insurance",
    "BROWNSTEIN HYATT FARBER SCHRECK": "Lobbying & Gov Relations",
    "BROWNSTEIN HYATT": "Lobbying & Gov Relations",
    "AMAZON": "Tech & Telecom",
    "PAUL WEISS RIFKIND WHARTON & GARRISON": "Professional Services",
    "PAUL WEISS": "Professional Services",
    "T-MOBILE": "Tech & Telecom",
    "SEAN N PARKER FOUNDATION": "Tech & Telecom",
    "CAROLYN ROWAN COLLECTION": "Other Industry",
    "COINBASE": "Finance & Insurance",
    "KIRKLAND & ELLIS": "Professional Services",
    "TODD STRATEGY": "Lobbying & Gov Relations",
    "FISHER INVESTMENTS": "Finance & Insurance",
    "UNITED AIRLINES": "Transportation",
    "AKIN GUMP": "Lobbying & Gov Relations",
    "AKIN GUMP STRAUSS HAUER & FELD": "Lobbying & Gov Relations",
    "KKR": "Finance & Insurance",
    "FIERCE GOVERNMENT RELATIONS": "Lobbying & Gov Relations",
    "OGILVY GOVERNMENT RELATIONS": "Lobbying & Gov Relations",
    "OGILVY": "Lobbying & Gov Relations",
    "MAYER BROWN": "Professional Services",
    "DAVITA": "Healthcare & Pharma",
    "CORNERSTONE GOVERNMENT AFFAIRS": "Lobbying & Gov Relations",
    "ARNOLD VENTURES": "Ideological",
    "ELLIOTT INVESTMENT": "Finance & Insurance",
    "ELLIOTT MANAGEMENT": "Finance & Insurance",
    "BRIGHTHOUSE FINANCIAL": "Finance & Insurance",
    "NORTHWESTERN MUTUAL": "Finance & Insurance",
    "AT&T": "Tech & Telecom",
    "ROCKET COMPANIES": "Real Estate & Housing",
    "ROCKET MORTGAGE": "Real Estate & Housing",
    "SOROBAN CAPITAL": "Finance & Insurance",
    "MORGAN STANLEY": "Finance & Insurance",
    "FORBES TATE": "Lobbying & Gov Relations",
    "JPMORGAN CHASE": "Finance & Insurance",
    "BANK OF AMERICA": "Finance & Insurance",
    "CITIGROUP": "Finance & Insurance",
    "WELLS FARGO": "Finance & Insurance",
    "BLACKROCK": "Finance & Insurance",
    "DELOITTE": "Professional Services",
    "ERNST & YOUNG": "Professional Services",
    "PRICEWATERHOUSECOOPERS": "Professional Services",
    "KPMG": "Professional Services",
    "META": "Tech & Telecom",
    "APPLE": "Tech & Telecom",
    "WALMART": "Retail & Consumer",
    "UNITEDHEALTH GROUP": "Healthcare & Pharma",
    "COMCAST": "Tech & Telecom",
    "VERIZON": "Tech & Telecom",
    "PFIZER": "Healthcare & Pharma",
    "JOHNSON & JOHNSON": "Healthcare & Pharma",
    "CHEVRON": "Energy & Utilities",
    "EXXONMOBIL": "Energy & Utilities",
    "KOCH INDUSTRIES": "Energy & Utilities",
    "BLUE CROSS BLUE SHIELD": "Healthcare & Pharma",
    "GRAIL": "Healthcare & Pharma",
    "WINGED KEEL": "Finance & Insurance",
    "MARQUIS": "Other Industry",
    "PLANO 6500": "Other Industry",
    "PISCES": "Other Industry",
    "HERZOG": "Construction & Engineering",
    "UNIVERSITY OF WASHINGTON": "Other Industry",
    "CENTENE": "Healthcare & Pharma",
    "HUMANA": "Healthcare & Pharma",
    "CIGNA": "Healthcare & Pharma",
    "ABBVIE": "Healthcare & Pharma",
    "AMGEN": "Healthcare & Pharma",
    "LOCKHEED MARTIN": "Defense & Aerospace",
    "BOEING": "Defense & Aerospace",
    "RAYTHEON": "Defense & Aerospace",
    "NORTHROP GRUMMAN": "Defense & Aerospace",
    "GENERAL DYNAMICS": "Defense & Aerospace",
    "DELTA AIR LINES": "Transportation",
    "AMERICAN AIRLINES": "Transportation",
    "SOUTHWEST AIRLINES": "Transportation",
    "FEDEX": "Transportation",
    "UPS": "Transportation",
    "BAKER MCKENZIE": "Professional Services",
    "SKADDEN ARPS": "Professional Services",
    "SULLIVAN & CROMWELL": "Professional Services",
    "DAVIS POLK": "Professional Services",
    "WACHTELL LIPTON": "Professional Services",
    "LATHAM & WATKINS": "Professional Services",
    "SQUIRE PATTON BOGGS": "Lobbying & Gov Relations",
    "HOGAN LOVELLS": "Lobbying & Gov Relations",
    "HOLLAND & KNIGHT": "Lobbying & Gov Relations",
    "K&L GATES": "Lobbying & Gov Relations",
    "WILLIAMS & JENSEN": "Lobbying & Gov Relations",
    "TARPLIN DOWNS & YOUNG": "Lobbying & Gov Relations",
    "EY": "Professional Services",
    "PWC": "Professional Services"
  }
}
```

The implementer should also extend this to ~200 entries by running a quick analysis of the top employers in the parquet and classifying any remaining large-dollar employers. Use web search if an employer's sector is unclear.

**Step 2: Update pac_sectors.json to add the new sector**

Add `"Lobbying & Gov Relations"` to the `sectors` array and add a color to `sector_colors`:

```json
"Lobbying & Gov Relations": "#8B5CF6"
```

(Purple — distinct from the existing Professional Services indigo `#4F46E5`.)

**Step 3: Commit**

```bash
git add config/employer_sectors.json config/pac_sectors.json
git commit -m "data: add curated employer-to-sector mapping (100+ employers)"
```

---

## Task 2: Write Classification + Aggregation Script

**Files:**
- Create: `scripts/11_classify_employers.py`
- Output: `data/processed/contributions_2024_with_sectors.parquet`
- Output: `output/industry_individual_totals.csv`
- Output: `output/industry_per_member.csv`
- Output: `output/industry_top_employers.csv`

**Step 1: Write the script**

```python
#!/usr/bin/env python3
"""Step 11: Classify individual contributions by employer industry sector.

Uses a 3-tier classification strategy:
1. Curated employer-to-sector mapping (config/employer_sectors.json)
2. Keyword matching from PAC sector fallbacks (config/pac_sectors.json)
3. Occupation-based fallback for remaining contributions

Outputs:
  - data/processed/contributions_2024_with_sectors.parquet (enriched)
  - output/industry_individual_totals.csv (sector aggregates with PAC comparison)
  - output/industry_per_member.csv (per-member industry breakdown)
  - output/industry_top_employers.csv (top employers by sector)
"""

import json
import sys
from pathlib import Path

import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import (
    CONFIG_DIR, PROCESSED_DIR, OUTPUT_DIR, PRIMARY_CYCLE,
)
from utils.checkpoint import is_step_complete, save_checkpoint

STEP_NAME = "11_classify_employers"

# Non-industry employer strings (retired, self-employed, etc.)
NON_INDUSTRY_EMPLOYERS = {
    "RETIRED", "NOT EMPLOYED", "SELF-EMPLOYED", "SELF EMPLOYED",
    "NONE", "N/A", "", "HOMEMAKER", "STUDENT", "UNEMPLOYED",
    "INFORMATION REQUESTED", "INFORMATION REQUESTED PER BEST EFFORTS",
    "UNKNOWN", "NOT APPLICABLE", "REFUSE", "REQUESTED",
}

# Occupation → sector fallback mapping
OCCUPATION_SECTORS = {
    "Finance & Insurance": [
        "BANKER", "FINANCIAL ADVISOR", "INVESTMENT BANKER", "BROKER",
        "HEDGE FUND", "PRIVATE EQUITY", "VENTURE CAPITAL", "INVESTOR",
        "TRADER", "ACTUARY", "UNDERWRITER", "FUND MANAGER",
        "PORTFOLIO MANAGER", "WEALTH MANAGER", "FINANCIAL ANALYST",
        "BANKING", "SECURITIES",
    ],
    "Healthcare & Pharma": [
        "PHYSICIAN", "DOCTOR", "NURSE", "SURGEON", "DENTIST",
        "PHARMACIST", "THERAPIST", "PSYCHOLOGIST", "RADIOLOGIST",
        "OPTOMETRIST", "VETERINARIAN", "PSYCHIATRIST", "ANESTHESIOLOGIST",
        "CARDIOLOGIST", "DERMATOLOGIST", "ONCOLOGIST", "PEDIATRICIAN",
        "REGISTERED NURSE", "MEDICAL",
    ],
    "Real Estate & Housing": [
        "REAL ESTATE BROKER", "REAL ESTATE AGENT", "REALTOR",
        "PROPERTY MANAGER", "APPRAISER", "MORTGAGE BROKER",
        "LAND DEVELOPER", "REAL ESTATE DEVELOPER", "REAL ESTATE",
    ],
    "Professional Services": [
        "ATTORNEY", "LAWYER", "ACCOUNTANT", "CPA",
        "CERTIFIED PUBLIC ACCOUNTANT",
    ],
    "Lobbying & Gov Relations": [
        "LOBBYIST", "GOVERNMENT RELATIONS", "GOVERNMENT AFFAIRS",
        "PUBLIC AFFAIRS",
    ],
    "Tech & Telecom": [
        "SOFTWARE ENGINEER", "PROGRAMMER", "DATA SCIENTIST",
        "SOFTWARE DEVELOPER", "COMPUTER SCIENTIST",
    ],
    "Energy & Utilities": [
        "GEOLOGIST", "PETROLEUM ENGINEER", "DRILLER", "OILFIELD",
    ],
    "Construction & Engineering": [
        "ARCHITECT", "CONTRACTOR", "BUILDER",
    ],
    "Food & Beverage": [
        "CHEF", "RESTAURATEUR", "WINEMAKER", "BREWER",
    ],
    "Labor": [
        "UNION",
    ],
    "Retail & Consumer": [
        "RETAIL",
    ],
}


def load_employer_sectors():
    """Load curated employer → sector mapping."""
    path = CONFIG_DIR / "employer_sectors.json"
    if not path.exists():
        print(f"  WARNING: {path} not found")
        return {}
    with open(path) as f:
        data = json.load(f)
    return {k.upper(): v for k, v in data.get("employers", {}).items()}


def load_keyword_fallbacks():
    """Load keyword fallbacks from pac_sectors.json."""
    path = CONFIG_DIR / "pac_sectors.json"
    if not path.exists():
        return {}
    with open(path) as f:
        data = json.load(f)
    return data.get("keyword_fallbacks", {})


def classify_employer(employer, employer_sectors, keyword_fallbacks):
    """Classify an employer string by sector using curated map then keywords."""
    if not employer or employer in NON_INDUSTRY_EMPLOYERS:
        return "Non-Industry"

    emp_upper = employer.upper().strip()

    # Tier 1: Curated mapping (exact match)
    if emp_upper in employer_sectors:
        return employer_sectors[emp_upper]

    # Tier 2: Keyword fallback on employer name
    for sector, keywords in keyword_fallbacks.items():
        for kw in keywords:
            if kw in emp_upper:
                return sector

    return None  # Unclassified


def classify_occupation(occupation):
    """Tier 3: Classify by occupation string."""
    if not occupation:
        return None

    occ_upper = occupation.upper().strip()

    for sector, keywords in OCCUPATION_SECTORS.items():
        for kw in keywords:
            if kw in occ_upper:
                return sector

    return None


def classify_contributions(df, employer_sectors, keyword_fallbacks):
    """Apply 3-tier classification to all contributions."""
    print("  Classifying contributions...")

    # Get employer field (prefer normalized)
    emp = df["employer_normalized"].fillna(df["EMPLOYER"]).fillna("").str.upper().str.strip()
    occ = df["OCCUPATION"].fillna("").str.upper().str.strip()

    sectors = []
    tier_counts = {"curated": 0, "keyword": 0, "occupation": 0, "non_industry": 0, "unclassified": 0}

    for e, o in zip(emp, occ):
        # Check non-industry first
        if not e or e in NON_INDUSTRY_EMPLOYERS:
            sectors.append("Non-Industry")
            tier_counts["non_industry"] += 1
            continue

        # Tier 1: Curated
        if e in employer_sectors:
            sectors.append(employer_sectors[e])
            tier_counts["curated"] += 1
            continue

        # Tier 2: Keyword on employer
        classified = False
        for sector, keywords in keyword_fallbacks.items():
            for kw in keywords:
                if kw in e:
                    sectors.append(sector)
                    tier_counts["keyword"] += 1
                    classified = True
                    break
            if classified:
                break

        if classified:
            continue

        # Tier 3: Occupation fallback
        occ_sector = classify_occupation(o)
        if occ_sector:
            sectors.append(occ_sector)
            tier_counts["occupation"] += 1
            continue

        sectors.append("Unclassified")
        tier_counts["unclassified"] += 1

    df = df.copy()
    df["sector"] = sectors

    print(f"  Classification tiers:")
    for tier, count in tier_counts.items():
        pct = count / len(df) * 100
        print(f"    {tier}: {count:,} ({pct:.1f}%)")

    return df


def aggregate_sector_totals(df, pac_spread_path):
    """Aggregate individual $ by sector, merge with PAC totals."""
    # Individual totals by sector
    industry = df[~df["sector"].isin(["Non-Industry", "Unclassified"])].copy()
    indiv = industry.groupby("sector").agg(
        individual_total=("TRANSACTION_AMT", "sum"),
        individual_count=("TRANSACTION_AMT", "count"),
        individual_donors=("NAME", "nunique"),
    ).reset_index()

    # Load PAC totals from pac_spread.json
    pac_totals = {}
    if pac_spread_path.exists():
        with open(pac_spread_path) as f:
            pac_data = json.load(f)
        for p in pac_data:
            sector = p.get("sector", "")
            if sector:
                pac_totals[sector] = pac_totals.get(sector, 0) + p.get("total_given", 0)

    indiv["pac_total"] = indiv["sector"].map(pac_totals).fillna(0).astype(int)
    indiv["combined_total"] = indiv["individual_total"] + indiv["pac_total"]
    indiv["individual_share_pct"] = (
        indiv["individual_total"] / indiv["combined_total"].replace(0, np.nan) * 100
    ).round(1)

    indiv = indiv.sort_values("combined_total", ascending=False)
    return indiv


def aggregate_per_member(df):
    """Per-member industry breakdown."""
    industry = df[~df["sector"].isin(["Non-Industry", "Unclassified"])].copy()
    return industry.groupby(["member_name", "sector"]).agg(
        individual_total=("TRANSACTION_AMT", "sum"),
        individual_count=("TRANSACTION_AMT", "count"),
    ).reset_index().sort_values(
        ["member_name", "individual_total"], ascending=[True, False]
    )


def aggregate_top_employers(df):
    """Top employers by sector with member reach."""
    industry = df[~df["sector"].isin(["Non-Industry", "Unclassified"])].copy()
    emp_col = industry["employer_normalized"].fillna(industry["EMPLOYER"]).fillna("")

    result = industry.assign(emp_clean=emp_col).groupby(["sector", "emp_clean"]).agg(
        total=("TRANSACTION_AMT", "sum"),
        count=("TRANSACTION_AMT", "count"),
        distinct_members_funded=("member_name", "nunique"),
    ).reset_index().rename(columns={"emp_clean": "employer"})

    result = result.sort_values(
        ["sector", "total"], ascending=[True, False]
    )

    # Keep top 10 per sector
    return result.groupby("sector").head(10).reset_index(drop=True)


def print_headline_stats(sector_totals_df, classified_df):
    """Print key findings."""
    total_indiv = sector_totals_df["individual_total"].sum()
    total_pac = sector_totals_df["pac_total"].sum()
    ratio = total_indiv / total_pac if total_pac > 0 else 0

    print("\n" + "=" * 60)
    print("HEADLINE FINDINGS")
    print("=" * 60)
    print(f"  Total classified individual $: ${total_indiv:,.0f}")
    print(f"  Total PAC $: ${total_pac:,.0f}")
    print(f"  Individual-to-PAC ratio: {ratio:.1f}×")

    print(f"\n  Top sectors by combined (individual + PAC):")
    for _, row in sector_totals_df.head(5).iterrows():
        print(f"    {row['sector']}: ${row['combined_total']:,.0f} "
              f"(individual: ${row['individual_total']:,.0f}, "
              f"PAC: ${row['pac_total']:,.0f}, "
              f"indiv share: {row['individual_share_pct']:.0f}%)")

    # Coverage stats
    total_all = classified_df["TRANSACTION_AMT"].sum()
    non_industry = classified_df[classified_df["sector"] == "Non-Industry"]["TRANSACTION_AMT"].sum()
    unclassified = classified_df[classified_df["sector"] == "Unclassified"]["TRANSACTION_AMT"].sum()
    classified = total_all - non_industry - unclassified
    print(f"\n  Classification coverage:")
    print(f"    Total contributions: ${total_all:,.0f}")
    print(f"    Classified (industry): ${classified:,.0f} ({classified/total_all*100:.1f}%)")
    print(f"    Non-industry: ${non_industry:,.0f} ({non_industry/total_all*100:.1f}%)")
    print(f"    Unclassified: ${unclassified:,.0f} ({unclassified/total_all*100:.1f}%)")
    print("=" * 60)


def main():
    if is_step_complete(STEP_NAME) and "--force" not in sys.argv:
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    print(f"\n{'='*60}")
    print("Step 11: Classify Individual Contributions by Industry")
    print(f"{'='*60}\n")

    # Load data
    parquet_path = PROCESSED_DIR / f"contributions_{PRIMARY_CYCLE}_classified.parquet"
    print(f"  Loading {parquet_path.name}...")
    df = pd.read_parquet(parquet_path)
    print(f"  Loaded {len(df):,} contributions (${df['TRANSACTION_AMT'].sum():,.0f})")

    # Load classification resources
    employer_sectors = load_employer_sectors()
    print(f"  Loaded {len(employer_sectors)} curated employer mappings")
    keyword_fallbacks = load_keyword_fallbacks()
    print(f"  Loaded {len(keyword_fallbacks)} sector keyword lists")

    # Classify
    df = classify_contributions(df, employer_sectors, keyword_fallbacks)

    # Save enriched parquet
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    enriched_path = PROCESSED_DIR / f"contributions_{PRIMARY_CYCLE}_with_sectors.parquet"
    df.to_parquet(enriched_path, index=False)
    print(f"\n  Saved enriched parquet: {enriched_path.name}")

    # Aggregate
    print("\n  Aggregating...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    pac_spread_path = Path(__file__).resolve().parent.parent / "webapp" / "data" / "pac_spread.json"
    sector_totals = aggregate_sector_totals(df, pac_spread_path)
    sector_totals.to_csv(OUTPUT_DIR / "industry_individual_totals.csv", index=False)
    print(f"  industry_individual_totals.csv: {len(sector_totals)} sectors")

    per_member = aggregate_per_member(df)
    per_member.to_csv(OUTPUT_DIR / "industry_per_member.csv", index=False)
    print(f"  industry_per_member.csv: {len(per_member)} rows")

    top_employers = aggregate_top_employers(df)
    top_employers.to_csv(OUTPUT_DIR / "industry_top_employers.csv", index=False)
    print(f"  industry_top_employers.csv: {len(top_employers)} rows")

    print_headline_stats(sector_totals, df)

    save_checkpoint(STEP_NAME, {
        "contributions_classified": len(df),
        "sectors_found": len(sector_totals),
    })
    print(f"\nStep {STEP_NAME} complete.")


if __name__ == "__main__":
    main()
```

**Step 2: Run the script**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
python3 scripts/11_classify_employers.py
```

Expected: Classification tier breakdown, 3 CSV outputs, headline stats showing individual-to-PAC ratio.

**Step 3: Verify outputs**

```bash
head -5 output/industry_individual_totals.csv
head -5 output/industry_per_member.csv
head -5 output/industry_top_employers.csv
```

**Step 4: Commit**

```bash
git add scripts/11_classify_employers.py output/industry_individual_totals.csv output/industry_per_member.csv output/industry_top_employers.csv
git commit -m "feat: classify individual contributions by industry sector (step 11)"
```

---

## Task 3: Extend Import Script for Industry Data

**Files:**
- Modify: `webapp/scripts/import-data.ts`
- Output: `webapp/data/industry_influence.json`

**Step 1: Add the import function**

After the existing `importBeforeAfter()` function in `webapp/scripts/import-data.ts`, add:

```typescript
function importIndustryInfluence() {
  const sectorRows = readCSV("industry_individual_totals.csv");
  const employerRows = readCSV("industry_top_employers.csv");
  if (!sectorRows) return null;

  const sectorTotals = sectorRows.map((r) => ({
    sector: r.sector,
    individual_total: toNumber(r.individual_total) ?? 0,
    individual_count: toNumber(r.individual_count) ?? 0,
    individual_donors: toNumber(r.individual_donors) ?? 0,
    pac_total: toNumber(r.pac_total) ?? 0,
    combined_total: toNumber(r.combined_total) ?? 0,
    individual_share_pct: toNumber(r.individual_share_pct) ?? 0,
  }));

  // Group top employers by sector
  const topEmployersBySector: Record<
    string,
    { employer: string; total: number; count: number; members_funded: number }[]
  > = {};
  if (employerRows) {
    for (const r of employerRows) {
      const sector = r.sector;
      if (!topEmployersBySector[sector]) topEmployersBySector[sector] = [];
      topEmployersBySector[sector].push({
        employer: r.employer,
        total: toNumber(r.total) ?? 0,
        count: toNumber(r.count) ?? 0,
        members_funded: toNumber(r.distinct_members_funded) ?? 0,
      });
    }
  }

  // Classification coverage
  const classifiedTotal = sectorTotals.reduce((s, r) => s + r.individual_total, 0);
  const pacTotal = sectorTotals.reduce((s, r) => s + r.pac_total, 0);

  return {
    sector_totals: sectorTotals,
    top_employers_by_sector: topEmployersBySector,
    summary: {
      classified_individual_total: classifiedTotal,
      pac_total: pacTotal,
      combined_total: classifiedTotal + pacTotal,
      individual_to_pac_ratio:
        pacTotal > 0 ? Math.round((classifiedTotal / pacTotal) * 10) / 10 : 0,
    },
  };
}
```

**Step 2: Add it to the main section**

In the main execution block, add before the `datasets` array:

```typescript
// Import industry influence data
const industryInfluence = importIndustryInfluence();
if (industryInfluence) {
  writeFileSync(
    join(DATA_DIR, "industry_influence.json"),
    JSON.stringify(industryInfluence, null, 2)
  );
  console.log(`  industry_influence.json: ${industryInfluence.sector_totals.length} sectors, ratio: ${industryInfluence.summary.individual_to_pac_ratio}×`);
}
```

**Step 3: Run import**

```bash
cd webapp && npx tsx scripts/import-data.ts
```

**Step 4: Commit**

```bash
git add webapp/scripts/import-data.ts webapp/data/industry_influence.json
git commit -m "feat: import industry influence data into webapp"
```

---

## Task 4: Add IndustryInfluence Types and Data Loader

**Files:**
- Modify: `webapp/lib/data.ts`

**Step 1: Add interfaces and loader**

After the `BeforeAfterData` interface in `webapp/lib/data.ts`, add:

```typescript
export interface IndustrySectorTotal {
  sector: string;
  individual_total: number;
  individual_count: number;
  individual_donors: number;
  pac_total: number;
  combined_total: number;
  individual_share_pct: number;
}

export interface IndustryEmployer {
  employer: string;
  total: number;
  count: number;
  members_funded: number;
}

export interface IndustryInfluenceData {
  sector_totals: IndustrySectorTotal[];
  top_employers_by_sector: Record<string, IndustryEmployer[]>;
  summary: {
    classified_individual_total: number;
    pac_total: number;
    combined_total: number;
    individual_to_pac_ratio: number;
  };
}
```

Add loader function at the end of the file:

```typescript
export function getIndustryInfluence(): IndustryInfluenceData | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "industry_influence.json"), "utf-8");
    return JSON.parse(raw) as IndustryInfluenceData;
  } catch {
    return null;
  }
}
```

**Step 2: Commit**

```bash
git add webapp/lib/data.ts
git commit -m "feat: add IndustryInfluence types and data loader"
```

---

## Task 5: Build IndustryChart Client Component

**Files:**
- Create: `webapp/components/IndustryChart.tsx`

**Step 1: Create the paired bar chart component**

This is a `"use client"` component using Recharts, following the pattern in `PacCharts.tsx`.

```tsx
"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import type { IndustrySectorTotal } from "@/lib/data";

interface IndustryChartProps {
  sectors: IndustrySectorTotal[];
  sectorColors: Record<string, string>;
}

function formatDollarsShort(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default function IndustryChart({
  sectors,
  sectorColors,
}: IndustryChartProps) {
  const data = useMemo(() => {
    return sectors
      .filter((s) => s.combined_total > 0)
      .sort((a, b) => b.combined_total - a.combined_total)
      .slice(0, 12)
      .map((s) => ({
        sector:
          s.sector.length > 20 ? s.sector.slice(0, 18) + "…" : s.sector,
        sectorFull: s.sector,
        individual: s.individual_total,
        pac: s.pac_total,
        color: sectorColors[s.sector] || "#9CA3AF",
      }));
  }, [sectors, sectorColors]);

  if (data.length === 0) return null;

  return (
    <div>
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
            barCategoryGap="20%"
          >
            <XAxis
              type="number"
              tickFormatter={formatDollarsShort}
              tick={{ fontSize: 11, fill: "#78716c" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="sector"
              width={160}
              tick={{ fontSize: 11, fill: "#44403c" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatDollarsShort(value),
                name === "individual"
                  ? "Individual Employee $"
                  : "Direct PAC $",
              ]}
              contentStyle={{
                backgroundColor: "#111",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#e7e5e4",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value: string) =>
                value === "individual"
                  ? "Individual Employee Contributions"
                  : "Direct PAC Contributions"
              }
            />
            <Bar dataKey="individual" stackId="a" radius={[0, 0, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
            <Bar dataKey="pac" stackId="a" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.4} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-stone-400 mt-2 text-center">
        Solid bars = individual employee contributions. Faded bars = direct PAC contributions. Same industry, two channels.
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add webapp/components/IndustryChart.tsx
git commit -m "feat: add IndustryChart stacked bar component"
```

---

## Task 6: Add "The Full Picture" Section to PACs Page

**Files:**
- Modify: `webapp/app/pacs/page.tsx`

**Step 1: Add imports**

Add `getIndustryInfluence` to the data imports, and import the new component:

```typescript
import {
  getPacSpread,
  getSectorColors,
  getNews,
  getMembers,
  getBenchmarks,
  getBeforeAfter,
  getIndustryInfluence,
  PacSpreadEntry,
} from "@/lib/data";
import { formatMoney, memberSlug } from "@/lib/utils";
// ... existing imports ...
import IndustryChart from "@/components/IndustryChart";
```

**Step 2: Load the data**

After `const beforeAfter = getBeforeAfter();`, add:

```typescript
const industryInfluence = getIndustryInfluence();
```

**Step 3: Add the section**

Insert this new section AFTER the Charts section (`<PacCharts ... />`) and BEFORE the Sector Spotlights section. This placement shows: benchmarks → before/after → charts → **full picture** → sector spotlights.

```tsx
      {/* ── The Full Picture: Individual + PAC ─────────── */}
      {industryInfluence && industryInfluence.sector_totals.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            The Full Picture: PAC Money Is Just the Tip
          </h2>
          <p className="text-xs text-stone-500 mb-5 max-w-4xl leading-relaxed">
            PAC contributions are the most visible channel of industry influence,
            but individual donations from employees of the same companies and
            industries dwarf direct PAC giving. For every dollar a PAC contributes,
            employees of the same industry give{" "}
            <strong className="text-[#111111]">
              {industryInfluence.summary.individual_to_pac_ratio}×
            </strong>{" "}
            more individually.
          </p>

          {/* Stacked bar chart */}
          <div className="bg-white border border-[#C8C1B6]/50 rounded-lg p-5 mb-6">
            <IndustryChart
              sectors={industryInfluence.sector_totals}
              sectorColors={sectorColors}
            />
          </div>

          {/* Top employers table */}
          {(() => {
            const allEmployers = Object.values(
              industryInfluence.top_employers_by_sector
            )
              .flat()
              .sort((a, b) => b.total - a.total)
              .slice(0, 15);

            if (allEmployers.length === 0) return null;

            // Build employer → sector lookup
            const empSectorMap = new Map<string, string>();
            for (const [sector, emps] of Object.entries(
              industryInfluence.top_employers_by_sector
            )) {
              for (const e of emps) empSectorMap.set(e.employer, sector);
            }

            return (
              <div className="mb-6">
                <h3
                  className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-3"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Industry Employees Funding the Committee
                </h3>
                <div className="bg-white border border-[#C8C1B6]/50 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#C8C1B6]/50 bg-[#F5F0EB]">
                          <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Employer
                          </th>
                          <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Sector
                          </th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Employee $
                          </th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Donations
                          </th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-stone-500" style={{ fontFamily: "var(--font-display)" }}>
                            Members
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {allEmployers.map((e, i) => {
                          const sector = empSectorMap.get(e.employer) || "";
                          return (
                            <tr
                              key={e.employer}
                              className={`border-b border-[#C8C1B6]/30 last:border-b-0 hover:bg-[#F5F0EB] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FDFBF9]"}`}
                            >
                              <td className="px-4 py-2.5 font-medium text-[#111111]">
                                {e.employer}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor:
                                        sectorColors[sector] || "#9CA3AF",
                                    }}
                                  />
                                  {sector}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-[#FE4F40] tabular-nums">
                                {formatMoney(e.total)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-stone-500 tabular-nums">
                                {e.count.toLocaleString()}
                              </td>
                              <td className="px-4 py-2.5 text-right text-[#4C6971] font-medium tabular-nums">
                                {e.members_funded}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          <p className="text-[10px] text-stone-400 max-w-4xl leading-relaxed">
            Individual contributions classified by employer industry using curated
            mappings and keyword matching. Contributions from retirees,
            self-employed, and unemployed donors are excluded from industry
            totals. Classification covers{" "}
            {formatMoney(industryInfluence.summary.classified_individual_total)} of
            itemized individual contributions. Source: FEC bulk individual
            contributions, 2024 cycle.
          </p>
        </section>
      )}
```

**Step 4: Verify compilation**

```bash
cd webapp && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add webapp/app/pacs/page.tsx
git commit -m "feat: add 'The Full Picture' industry influence section to PACs page"
```

---

## Task 7: Update CLAUDE.md and pac_sectors.json sector_colors

**Files:**
- Modify: `CLAUDE.md`
- Modify: `config/pac_sectors.json` (add Lobbying sector color)

**Step 1: Add Lobbying & Gov Relations to pac_sectors.json**

Add to the `sectors` array and `sector_colors`:
- Add `"Lobbying & Gov Relations"` to the sectors array (after "Professional Services")
- Add `"Lobbying & Gov Relations": "#8B5CF6"` to sector_colors

Also add keyword fallbacks for the new sector:
```json
"Lobbying & Gov Relations": ["LOBBY", "GOVERNMENT RELATIONS", "GOVERNMENT AFFAIRS", "PUBLIC AFFAIRS", "PUBLIC POLICY", "ADVOCACY"]
```

**Step 2: Update CLAUDE.md**

Add to the project structure:
- `config/employer_sectors.json` in config section
- `scripts/11_classify_employers.py` in scripts section
- `output/industry_*.csv` files in output section
- `webapp/data/industry_influence.json` in webapp data section
- `webapp/components/IndustryChart.tsx` in components section
- Step 11 to pipeline steps list
- New entries to Key Files table
- Update data.ts export count
- Update PACs page architecture description

**Step 3: Also update `webapp/lib/utils.ts`**

Add Lobbying color to the `SECTOR_COLORS` constant:
```typescript
"Lobbying & Gov Relations": "#8B5CF6",
```

**Step 4: Commit**

```bash
git add CLAUDE.md config/pac_sectors.json webapp/lib/utils.ts
git commit -m "docs: update CLAUDE.md and configs for industry influence feature"
```

---

## Execution Order & Dependencies

```
Task 1 (employer_sectors.json + pac_sectors update) ← no dependencies
Task 2 (11_classify_employers.py) ← depends on Task 1
Task 3 (import-data.ts) ← depends on Task 2 output
Task 4 (data.ts types + loader) ← no code dependency, can parallel with Task 3
Task 5 (IndustryChart.tsx) ← no code dependency, can parallel with Tasks 3-4
Task 6 (pacs page section) ← depends on Tasks 3, 4, 5
Task 7 (CLAUDE.md + configs) ← depends on all above
```

```
Task 1 → Task 2 → Task 3 ─┐
                   Task 4 ─┤→ Task 6 → Task 7
                   Task 5 ─┘
```
