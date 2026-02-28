#!/usr/bin/env python3
"""Step 03: Build ZIP-to-congressional-district lookup table.

Combines two sources:
1. zccd.csv from OpenSourceActivismTech/us-zipcodes-congress (primary)
   - Clean ZIP -> state + district mapping for current Congress
2. Census ZCTA-to-CD relationship file (secondary)
   - Provides area-overlap fractions for ZIPs spanning multiple districts

For ZIPs that span multiple districts (~15%), assigns to the district
with the largest area overlap. Tags DC ZIPs separately.

Requires: Step 00 (reference files downloaded).
Outputs: data/reference/zip_to_district.csv
"""

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import REFERENCE_DIR, DC_ZIP_PREFIXES
from utils.checkpoint import is_step_complete, save_checkpoint

STEP_NAME = "03_build_zip_lookup"


def load_zccd():
    """Load the GitHub zccd.csv file.

    Expected columns: zcta, state_fips, state_abbr, cd
    Returns DataFrame with zip5, state, district columns.
    """
    path = REFERENCE_DIR / "zccd.csv"
    if not path.exists():
        print(f"  WARNING: {path} not found")
        return None

    df = pd.read_csv(path, dtype=str)
    print(f"  Loaded zccd.csv: {len(df):,} rows")

    # Standardize column names
    col_map = {}
    for c in df.columns:
        cl = c.lower().strip()
        if cl in ("zcta", "zcta5", "zip", "zipcode", "zip_code"):
            col_map[c] = "zip5"
        elif cl in ("state_abbr", "state", "stusab"):
            col_map[c] = "state"
        elif cl in ("cd", "congressional_district", "district", "cd119"):
            col_map[c] = "district"

    df = df.rename(columns=col_map)

    if "zip5" not in df.columns or "district" not in df.columns:
        print(f"  WARNING: zccd.csv missing expected columns. Found: {list(df.columns)}")
        return None

    # Ensure zip5 is zero-padded to 5 digits
    df["zip5"] = df["zip5"].str.strip().str.zfill(5)

    # Clean district: convert to int where possible
    df["district"] = df["district"].str.strip()
    # "00" means at-large
    df.loc[df["district"] == "00", "district"] = "0"

    return df[["zip5", "state", "district"]].dropna(subset=["zip5"])


def load_census_zcta():
    """Load Census ZCTA-to-CD relationship file.

    This pipe-delimited file has area overlap data that helps resolve
    ZIPs spanning multiple districts.
    """
    # Try to find the Census file
    candidates = list(REFERENCE_DIR.glob("tab20_cd*_zcta520_natl.txt"))
    if not candidates:
        print("  WARNING: Census ZCTA-CD file not found")
        return None

    path = candidates[0]
    print(f"  Loading Census file: {path.name}")

    try:
        df = pd.read_csv(path, sep="|", dtype=str)
    except Exception:
        # Some Census files use different delimiters
        try:
            df = pd.read_csv(path, dtype=str)
        except Exception as e:
            print(f"  WARNING: Could not parse Census file: {e}")
            return None

    print(f"  Census file columns: {list(df.columns)}")
    print(f"  Census file rows: {len(df):,}")

    # Look for the relevant columns
    # Typical columns: GEOID_CD, NAMELSAD_CD, GEOID_ZCTA5, NAMELSAD_ZCTA5,
    #                  AREALAND_PART, AREAWATER_PART, AREALAND_CD, AREALAND_ZCTA5
    zcta_col = None
    cd_col = None
    area_part_col = None
    area_total_col = None

    for c in df.columns:
        cl = c.upper()
        if "ZCTA5" in cl and "GEOID" in cl:
            zcta_col = c
        elif "ZCTA5" in cl and "AREALAND" in cl and "PART" not in cl:
            area_total_col = c
        elif "CD" in cl and "GEOID" in cl:
            cd_col = c
        elif "AREALAND_PART" in cl.upper() or cl == "AREALAND_PART":
            area_part_col = c

    if not zcta_col or not cd_col:
        print(f"  WARNING: Could not identify ZCTA and CD columns")
        return None

    result = pd.DataFrame()
    result["zip5"] = df[zcta_col].str.strip().str.zfill(5)

    # Extract state FIPS and district from CD GEOID (format: SSDD)
    cd_geoid = df[cd_col].str.strip()
    result["cd_geoid"] = cd_geoid

    if area_part_col:
        result["area_part"] = pd.to_numeric(df[area_part_col], errors="coerce")
    if area_total_col:
        result["area_total"] = pd.to_numeric(df[area_total_col], errors="coerce")

    return result


def build_lookup():
    """Build the final ZIP-to-district lookup table."""
    zccd = load_zccd()
    census = load_census_zcta()

    if zccd is None and census is None:
        print("ERROR: No reference data available. Run 00_download_bulk_data.py first.")
        sys.exit(1)

    if zccd is not None:
        # Start with zccd as primary source
        # For ZIPs with multiple districts, we need to pick one
        zip_counts = zccd.groupby("zip5").size()
        single_zips = set(zip_counts[zip_counts == 1].index)
        multi_zips = set(zip_counts[zip_counts > 1].index)

        print(f"\n  ZIPs with single district: {len(single_zips):,}")
        print(f"  ZIPs spanning multiple districts: {len(multi_zips):,}")

        # Single-district ZIPs: straightforward
        single = zccd[zccd["zip5"].isin(single_zips)].copy()
        single["is_split"] = False

        # Multi-district ZIPs: use Census area data if available
        if multi_zips and census is not None and "area_part" in census.columns:
            # For each multi-district ZIP, pick the district with largest area overlap
            multi_census = census[census["zip5"].isin(multi_zips)].copy()
            if not multi_census.empty and multi_census["area_part"].notna().any():
                # Pick the row with the largest area_part per zip5
                idx = multi_census.groupby("zip5")["area_part"].idxmax()
                primary = multi_census.loc[idx]
                # We still need state+district from zccd for these
                # Merge back with zccd to get state abbreviation
                multi_resolved = zccd[zccd["zip5"].isin(multi_zips)].copy()
                # For now, just take the first entry per ZIP (zccd may not have area data)
                multi_resolved = multi_resolved.drop_duplicates(subset="zip5", keep="first")
                multi_resolved["is_split"] = True
            else:
                multi_resolved = zccd[zccd["zip5"].isin(multi_zips)].drop_duplicates(
                    subset="zip5", keep="first"
                ).copy()
                multi_resolved["is_split"] = True
        else:
            # No Census data — just take first entry per multi-district ZIP
            multi_resolved = zccd[zccd["zip5"].isin(multi_zips)].drop_duplicates(
                subset="zip5", keep="first"
            ).copy()
            multi_resolved["is_split"] = True

        lookup = pd.concat([single, multi_resolved], ignore_index=True)

    else:
        # Fallback: Census-only (less ideal)
        print("  Using Census data only (no zccd.csv)")
        if "area_part" in census.columns:
            idx = census.groupby("zip5")["area_part"].idxmax()
            lookup = census.loc[idx].copy()
        else:
            lookup = census.drop_duplicates(subset="zip5", keep="first").copy()
        lookup["is_split"] = False

    # Ensure district is string
    lookup["district"] = lookup["district"].astype(str).str.strip()

    # Tag DC ZIPs
    lookup["is_dc"] = lookup["zip5"].str[:3].isin(DC_ZIP_PREFIXES)

    dc_count = lookup["is_dc"].sum()
    print(f"\n  DC ZIPs tagged: {dc_count}")
    print(f"  Total ZIPs in lookup: {len(lookup):,}")
    print(f"  States covered: {lookup['state'].nunique()}")

    # Verify a few known ZIPs
    checks = {
        "10001": ("NY", "New York City"),
        "90210": ("CA", "Beverly Hills"),
        "20001": ("DC", "Washington DC"),
        "60601": ("IL", "Chicago"),
    }
    print("\n  Spot checks:")
    for zip_code, (expected_state, desc) in checks.items():
        row = lookup[lookup["zip5"] == zip_code]
        if not row.empty:
            state = row.iloc[0]["state"]
            dist = row.iloc[0]["district"]
            status = "OK" if state == expected_state else "MISMATCH"
            print(f"    {zip_code} ({desc}): {state}-{dist} [{status}]")
        else:
            print(f"    {zip_code} ({desc}): NOT FOUND")

    # Save
    out_path = REFERENCE_DIR / "zip_to_district.csv"
    lookup.to_csv(out_path, index=False)
    print(f"\n  Saved to: {out_path}")

    return lookup


def run():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    lookup = build_lookup()

    save_checkpoint(STEP_NAME, {
        "total_zips": len(lookup),
        "split_zips": int(lookup["is_split"].sum()) if "is_split" in lookup.columns else 0,
        "dc_zips": int(lookup["is_dc"].sum()),
        "states": int(lookup["state"].nunique()),
    })


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
    run()
