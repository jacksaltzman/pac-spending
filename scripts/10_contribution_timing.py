"""
Step 10: Contribution Timing Analysis

Aggregates PAC and individual contributions by ISO week and analyzes
contribution patterns around legislative events.

Dependencies:
  - data/processed/pac_contributions_2024.parquet (from step 02)
  - data/processed/contributions_2024_classified.parquet (from step 04)
  - config/pac_sectors.json (curated PAC sector mappings)
  - config/members.json (member roster with FEC IDs)
  - config/legislative_events.json (curated legislative event timeline)

Outputs:
  - output/pac_weekly_totals.csv
  - output/individual_weekly_totals.csv
  - output/event_timing_analysis.csv
"""

import json
import sys
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Add parent dir to path for local imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import DATA_DIR, OUTPUT_DIR, PROJECT_ROOT
from utils.checkpoint import is_step_complete, save_checkpoint, clear_checkpoint

STEP_NAME = "10_contribution_timing"
CYCLE = 2024


def load_pac_sectors():
    """Load curated PAC sector mappings from config."""
    path = PROJECT_ROOT / "config" / "pac_sectors.json"
    with open(path) as f:
        config = json.load(f)
    # Build CMTE_ID -> sector lookup
    return {cmte_id: info["sector"] for cmte_id, info in config["pacs"].items()}


def load_members_lookup():
    """Load members.json and build CAND_ID -> member name lookup."""
    path = PROJECT_ROOT / "config" / "members.json"
    with open(path) as f:
        data = json.load(f)
    lookup = {}
    for committee_key in ["house_ways_and_means", "senate_finance"]:
        for m in data[committee_key]["members"]:
            if m.get("fec_candidate_id"):
                lookup[m["fec_candidate_id"]] = m["name"]
    return lookup


def load_legislative_events():
    """Load curated legislative event timeline."""
    path = PROJECT_ROOT / "config" / "legislative_events.json"
    with open(path) as f:
        return json.load(f)


def parse_transaction_date(series):
    """Parse MMDDYYYY string dates to datetime, coercing errors to NaT."""
    return pd.to_datetime(series, format="%m%d%Y", errors="coerce")


def aggregate_pac_weekly(cycle):
    """Aggregate PAC contributions by ISO week and sector."""
    path = DATA_DIR / "processed" / f"pac_contributions_{cycle}.parquet"
    if not path.exists():
        print(f"  WARNING: {path} not found, skipping PAC weekly aggregation")
        return None

    print(f"  Loading PAC contributions from {path.name}...")
    df = pd.read_parquet(path)
    print(f"  {len(df):,} PAC transactions loaded")

    # Parse dates
    df["date"] = parse_transaction_date(df["TRANSACTION_DT"])
    before = len(df)
    df = df.dropna(subset=["date"])
    print(f"  {before - len(df):,} rows dropped due to unparseable dates")

    # Filter to cycle date range
    df = df[(df["date"] >= "2023-01-01") & (df["date"] <= "2024-12-31")]
    print(f"  {len(df):,} transactions in 2023-2024 range")

    # Join sector from pac_sectors.json
    sector_lookup = load_pac_sectors()
    df["sector"] = df["CMTE_ID"].map(sector_lookup).fillna("Other/Unclassified")

    # ISO week start (Monday) — W-SUN means weeks end on Sunday, start on Monday
    df["week_start"] = df["date"].dt.to_period("W-SUN").apply(lambda p: p.start_time)

    # Aggregate by week and sector
    weekly = df.groupby(["week_start", "sector"]).agg(
        total_amount=("TRANSACTION_AMT", "sum"),
        transaction_count=("TRANSACTION_AMT", "count"),
        distinct_pacs=("CMTE_ID", "nunique"),
        distinct_recipients=("CAND_ID", "nunique"),
    ).reset_index()

    weekly["week_start"] = weekly["week_start"].dt.strftime("%Y-%m-%d")
    weekly = weekly.sort_values(["week_start", "sector"])

    return weekly


def aggregate_individual_weekly(cycle):
    """Aggregate individual contributions by ISO week and geo_class."""
    path = DATA_DIR / "processed" / f"contributions_{cycle}_classified.parquet"
    if not path.exists():
        print(f"  WARNING: {path} not found, skipping individual weekly aggregation")
        return None

    print(f"  Loading individual contributions from {path.name}...")
    df = pd.read_parquet(path)
    print(f"  {len(df):,} individual transactions loaded")

    # Parse dates
    df["date"] = parse_transaction_date(df["TRANSACTION_DT"])
    before = len(df)
    df = df.dropna(subset=["date"])
    print(f"  {before - len(df):,} rows dropped due to unparseable dates")

    # Filter to cycle date range
    df = df[(df["date"] >= "2023-01-01") & (df["date"] <= "2024-12-31")]
    print(f"  {len(df):,} transactions in 2023-2024 range")

    # ISO week start (Monday)
    df["week_start"] = df["date"].dt.to_period("W-SUN").apply(lambda p: p.start_time)

    # Aggregate by week and geo_class
    weekly = df.groupby(["week_start", "geo_class"]).agg(
        total_amount=("TRANSACTION_AMT", "sum"),
        transaction_count=("TRANSACTION_AMT", "count"),
        distinct_donors=("NAME", "nunique"),
    ).reset_index()

    weekly["week_start"] = weekly["week_start"].dt.strftime("%Y-%m-%d")
    weekly = weekly.sort_values(["week_start", "geo_class"])

    return weekly


def analyze_event_windows(cycle):
    """Compute contribution metrics in windows around each legislative event."""
    # Load PAC contributions with dates and sectors
    pac_path = DATA_DIR / "processed" / f"pac_contributions_{cycle}.parquet"
    if not pac_path.exists():
        print(f"  WARNING: {pac_path} not found, skipping event analysis")
        return None

    df = pd.read_parquet(pac_path)
    df["date"] = parse_transaction_date(df["TRANSACTION_DT"])
    df = df.dropna(subset=["date"])
    df = df[(df["date"] >= "2023-01-01") & (df["date"] <= "2024-12-31")]

    sector_lookup = load_pac_sectors()
    df["sector"] = df["CMTE_ID"].map(sector_lookup).fillna("Other/Unclassified")

    events = load_legislative_events()
    results = []

    for event in events:
        event_date = pd.Timestamp(event["date"])
        affected_sectors = set(event.get("sectors_affected", []))

        # Define windows
        baseline_start = event_date - timedelta(days=90)
        baseline_end = event_date - timedelta(days=30)
        pre_start = event_date - timedelta(days=30)
        pre_end = event_date - timedelta(days=1)
        event_week_start = event_date - timedelta(days=event_date.weekday())  # Monday
        event_week_end = event_week_start + timedelta(days=6)
        post_start = event_date + timedelta(days=1)
        post_end = event_date + timedelta(days=30)

        # Compute baseline weekly average (total in baseline window / number of weeks)
        baseline_weeks = max((baseline_end - baseline_start).days / 7, 1)

        for sector_filter, sector_label, is_sector_specific in [
            (None, "All Sectors", False),
            (affected_sectors, "Affected Sectors", True),
        ]:
            if is_sector_specific and not affected_sectors:
                continue

            if sector_filter is None:
                subset = df
            else:
                subset = df[df["sector"].isin(sector_filter)]

            baseline_total = subset[
                (subset["date"] >= baseline_start) & (subset["date"] <= baseline_end)
            ]["TRANSACTION_AMT"].sum()
            baseline_weekly_avg = baseline_total / baseline_weeks if baseline_weeks > 0 else 0

            pre_event_total = subset[
                (subset["date"] >= pre_start) & (subset["date"] <= pre_end)
            ]["TRANSACTION_AMT"].sum()

            event_week_total = subset[
                (subset["date"] >= event_week_start) & (subset["date"] <= event_week_end)
            ]["TRANSACTION_AMT"].sum()

            post_event_total = subset[
                (subset["date"] >= post_start) & (subset["date"] <= post_end)
            ]["TRANSACTION_AMT"].sum()

            spike_ratio = round(event_week_total / baseline_weekly_avg, 2) if baseline_weekly_avg > 0 else None

            results.append({
                "bill": event["bill"],
                "event_type": event["event_type"],
                "date": event["date"],
                "sector": sector_label,
                "baseline_weekly_avg": round(baseline_weekly_avg),
                "pre_event_total": round(pre_event_total),
                "event_week_total": round(event_week_total),
                "post_event_total": round(post_event_total),
                "spike_ratio": spike_ratio,
                "sector_specific": is_sector_specific,
                "significance": event.get("significance", "medium"),
            })

    return pd.DataFrame(results)


def run():
    """Main entry point."""
    if "--force" in sys.argv:
        clear_checkpoint(STEP_NAME)

    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    print(f"\n{'='*60}")
    print(f"Step 10: Contribution Timing Analysis")
    print(f"{'='*60}\n")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. PAC weekly aggregation
    print("Aggregating PAC contributions by week...")
    pac_weekly = aggregate_pac_weekly(CYCLE)
    if pac_weekly is not None:
        out_path = OUTPUT_DIR / "pac_weekly_totals.csv"
        pac_weekly.to_csv(out_path, index=False)
        print(f"  Saved {len(pac_weekly):,} rows to {out_path.name}")

    # 2. Individual weekly aggregation
    print("\nAggregating individual contributions by week...")
    indiv_weekly = aggregate_individual_weekly(CYCLE)
    if indiv_weekly is not None:
        out_path = OUTPUT_DIR / "individual_weekly_totals.csv"
        indiv_weekly.to_csv(out_path, index=False)
        print(f"  Saved {len(indiv_weekly):,} rows to {out_path.name}")

    # 3. Event window analysis
    print("\nAnalyzing contribution windows around legislative events...")
    event_analysis = analyze_event_windows(CYCLE)
    if event_analysis is not None:
        out_path = OUTPUT_DIR / "event_timing_analysis.csv"
        event_analysis.to_csv(out_path, index=False)
        print(f"  Saved {len(event_analysis):,} rows to {out_path.name}")

        # Print top spikes
        top = event_analysis[event_analysis["spike_ratio"].notna()].nlargest(5, "spike_ratio")
        if not top.empty:
            print("\n  Top 5 spike ratios:")
            for _, row in top.iterrows():
                print(f"    {row['bill']} ({row['event_type']}) — {row['sector']}: {row['spike_ratio']}×")

    save_checkpoint(STEP_NAME, {"completed": True})
    print(f"\nStep {STEP_NAME} complete.")


if __name__ == "__main__":
    run()
