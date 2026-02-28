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
