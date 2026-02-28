#!/usr/bin/env python3
"""Step 04: Classify each contribution's geographic relationship to its member.

For each contribution, determines whether it came from:
- in_district (House) / in_state (Senate)
- in_state_out_district (House only)
- dc_kstreet (contributor in DC area)
- out_of_state
- unknown (missing/invalid ZIP)

Requires: Steps 02 (filtered contributions) and 03 (ZIP lookup).
Outputs: data/processed/contributions_{cycle}_classified.parquet
"""

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import (
    PROCESSED_DIR, REFERENCE_DIR, MEMBERS_FILE, CYCLES, DC_ZIP_PREFIXES,
)
from utils.checkpoint import is_step_complete, save_checkpoint

STEP_NAME = "04_classify_geography"


def load_member_lookup():
    """Build a lookup from committee_id -> member info."""
    with open(MEMBERS_FILE) as f:
        data = json.load(f)

    lookup = {}
    for committee_key, committee_info in data.items():
        chamber = committee_info["chamber"]
        for member in committee_info["members"]:
            cmte_id = member.get("principal_committee_id")
            if cmte_id:
                lookup[cmte_id] = {
                    "member_name": member["name"],
                    "member_state": member["state"],
                    "member_district": member.get("district"),
                    "member_chamber": chamber,
                    "member_party": member["party"],
                    "member_committee": committee_key,
                    "is_territorial": member["state"] in ("VI", "GU", "AS", "MP", "PR", "DC"),
                }
    return lookup


def load_zip_lookup():
    """Load the ZIP-to-district mapping."""
    path = REFERENCE_DIR / "zip_to_district.csv"
    if not path.exists():
        print(f"ERROR: {path} not found. Run 03_build_zip_lookup.py first.")
        sys.exit(1)

    df = pd.read_csv(path, dtype=str)
    df["zip5"] = df["zip5"].str.zfill(5)

    # Build dict for fast lookup: zip5 -> {state, district}
    zip_dict = {}
    for _, row in df.iterrows():
        zip_dict[row["zip5"]] = {
            "state": row.get("state", ""),
            "district": str(row.get("district", "")),
        }
    return zip_dict


def clean_zip(zip_code):
    """Extract clean 5-digit ZIP from FEC zip field."""
    if not zip_code or not isinstance(zip_code, str):
        return None
    # Strip non-numeric characters and take first 5 digits
    digits = "".join(c for c in zip_code if c.isdigit())
    if len(digits) >= 5:
        return digits[:5]
    return None


def classify_contribution(row, zip_dict, member_info):
    """Classify a single contribution's geographic relationship.

    Returns one of: in_district, in_state_out_district, dc_kstreet,
                    out_of_state, in_state, unknown
    """
    zip5 = clean_zip(row.get("ZIP_CODE"))
    contributor_state = row.get("STATE", "")

    if isinstance(contributor_state, str):
        contributor_state = contributor_state.strip().upper()

    member_state = member_info["member_state"]
    member_district = member_info.get("member_district")
    chamber = member_info["member_chamber"]

    # Check for DC ZIPs first (applies to both chambers)
    if zip5 and zip5[:3] in DC_ZIP_PREFIXES:
        return "dc_kstreet"

    if chamber == "senate":
        # Senate: simple state comparison
        if contributor_state == member_state:
            return "in_state"
        elif contributor_state:
            return "out_of_state"
        else:
            return "unknown"

    else:
        # House: need ZIP-to-district lookup
        if zip5 and zip5 in zip_dict:
            zip_info = zip_dict[zip5]
            zip_state = zip_info["state"]
            zip_district = zip_info["district"]

            if zip_state == member_state:
                # Same state — check district
                if member_district is not None and str(member_district) == zip_district:
                    return "in_district"
                else:
                    return "in_state_out_district"
            else:
                return "out_of_state"
        elif contributor_state:
            # No ZIP match but have state — use state-level classification
            if contributor_state == member_state:
                return "in_state_out_district"  # Can't confirm district
            else:
                return "out_of_state"
        else:
            return "unknown"


def classify_cycle(cycle, member_lookup, zip_dict):
    """Classify all contributions for a cycle."""
    input_path = PROCESSED_DIR / f"contributions_{cycle}.parquet"
    if not input_path.exists():
        print(f"  No contributions file for cycle {cycle}")
        return None

    df = pd.read_parquet(input_path)
    print(f"  Loaded {len(df):,} contributions for cycle {cycle}")

    # Add member info columns
    for col in ["member_state", "member_district", "member_chamber", "member_party",
                "member_committee", "is_territorial"]:
        df[col] = df["CMTE_ID"].map(lambda x, c=col: member_lookup.get(x, {}).get(c))

    # Classify each contribution
    geo_classes = []
    for _, row in df.iterrows():
        cmte_id = row.get("CMTE_ID")
        info = member_lookup.get(cmte_id, {})
        if info:
            geo_classes.append(classify_contribution(row, zip_dict, info))
        else:
            geo_classes.append("unknown")

    df["geo_class"] = geo_classes

    # Clean ZIP for output
    df["zip5"] = df["ZIP_CODE"].apply(clean_zip)

    # Summary stats
    print(f"\n  Geographic classification for {cycle}:")
    counts = df["geo_class"].value_counts()
    total = len(df)
    for cls, count in counts.items():
        pct = count / total * 100
        print(f"    {cls:<25s} {count:>10,}  ({pct:5.1f}%)")

    # Unknown rate
    unknown_pct = counts.get("unknown", 0) / total * 100
    if unknown_pct > 10:
        print(f"\n  WARNING: {unknown_pct:.1f}% of contributions have unknown geography")

    # Per-member summary
    member_summary = df.groupby("member_name").agg(
        total_contributions=("TRANSACTION_AMT", "count"),
        total_amount=("TRANSACTION_AMT", "sum"),
        unknown_count=("geo_class", lambda x: (x == "unknown").sum()),
    ).reset_index()
    member_summary["unknown_pct"] = (
        member_summary["unknown_count"] / member_summary["total_contributions"] * 100
    )
    high_unknown = member_summary[member_summary["unknown_pct"] > 20]
    if not high_unknown.empty:
        print(f"\n  Members with >20% unknown geography:")
        for _, row in high_unknown.iterrows():
            print(f"    {row['member_name']}: {row['unknown_pct']:.1f}%")

    # Save
    output_path = PROCESSED_DIR / f"contributions_{cycle}_classified.parquet"
    df.to_parquet(output_path, index=False)
    print(f"\n  Saved to: {output_path}")

    return {
        "total": total,
        "classification_counts": counts.to_dict(),
        "unknown_pct": round(unknown_pct, 2),
    }


def run():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    member_lookup = load_member_lookup()
    zip_dict = load_zip_lookup()
    print(f"Loaded {len(member_lookup)} member committee mappings")
    print(f"Loaded {len(zip_dict):,} ZIP code mappings")

    stats = {}
    for cycle in CYCLES:
        print(f"\n{'='*60}")
        print(f"Cycle {cycle}")
        print(f"{'='*60}")
        result = classify_cycle(cycle, member_lookup, zip_dict)
        if result:
            stats[str(cycle)] = result

    save_checkpoint(STEP_NAME, stats)
    print("\nDone.")


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
    run()
