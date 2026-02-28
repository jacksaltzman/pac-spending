#!/usr/bin/env python3
"""Step 07: Generate summary statistics for all members and committees.

Computes per-member geographic breakdown, top employers, top outside
sources, PAC analysis, and committee-level aggregates.

Requires: Steps 04 (classified contributions), 05 (validation), 06 (employers).
Outputs: Multiple CSVs in output/ directory.
"""

import json
import sys
from pathlib import Path

import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import (
    MEMBERS_FILE, PROCESSED_DIR, OUTPUT_DIR, CYCLES, PRIMARY_CYCLE,
    RAW_DIR, CM_COLUMNS, CM_USECOLS,
)
from utils.checkpoint import is_step_complete, save_checkpoint

STEP_NAME = "07_analyze"


def load_committee_master(cycle):
    """Load the FEC committee master file to resolve PAC names by CMTE_ID."""
    extract_dir = RAW_DIR / f"cm_{cycle}"
    if not extract_dir.exists():
        print(f"  Committee master directory not found: {extract_dir}")
        return None

    txt_files = list(extract_dir.glob("*.txt"))
    if not txt_files:
        print(f"  No .txt files in {extract_dir}")
        return None

    cm_file = max(txt_files, key=lambda p: p.stat().st_size)
    print(f"  Loading committee master: {cm_file.name}")

    usecol_indices = [CM_COLUMNS.index(c) for c in CM_USECOLS]
    cm = pd.read_csv(
        cm_file,
        sep="|",
        header=None,
        names=CM_COLUMNS,
        usecols=usecol_indices,
        dtype=str,
        on_bad_lines="skip",
        encoding="utf-8",
        encoding_errors="replace",
    )
    # Deduplicate — keep first occurrence per CMTE_ID
    cm = cm.drop_duplicates(subset="CMTE_ID", keep="first")
    print(f"  Loaded {len(cm):,} committees")
    return cm


def load_members_flat():
    """Load members.json into a flat list with committee info."""
    with open(MEMBERS_FILE) as f:
        data = json.load(f)

    members = []
    for committee_key, committee_info in data.items():
        for member in committee_info["members"]:
            members.append({
                "member_name": member["name"],
                "party": member["party"],
                "state": member["state"],
                "district": member.get("district"),
                "chamber": committee_info["chamber"],
                "committee": committee_key,
                "role": member.get("role", "Member"),
                "is_territorial": member["state"] in ("VI", "GU", "AS", "MP", "PR"),
                "fec_candidate_id": member.get("fec_candidate_id"),
            })
    return pd.DataFrame(members)


def analyze_member_geography(df, chamber):
    """Compute geographic breakdown for a single member's contributions."""
    total_amount = df["TRANSACTION_AMT"].sum()
    total_count = len(df)

    if total_amount == 0:
        return {}

    geo_amounts = df.groupby("geo_class")["TRANSACTION_AMT"].sum()
    geo_counts = df.groupby("geo_class")["TRANSACTION_AMT"].count()

    result = {
        "total_itemized_amount": round(total_amount, 2),
        "total_contribution_count": total_count,
    }

    # Percentage by dollar amount for each classification
    for cls in ["in_district", "in_state_out_district", "in_state",
                "dc_kstreet", "out_of_state", "unknown"]:
        amt = geo_amounts.get(cls, 0)
        cnt = geo_counts.get(cls, 0)
        result[f"amt_{cls}"] = round(amt, 2)
        result[f"pct_{cls}"] = round(amt / total_amount * 100, 2) if total_amount else 0
        result[f"count_{cls}"] = int(cnt)

    # Headline metric
    if chamber == "house":
        outside = total_amount - geo_amounts.get("in_district", 0) - geo_amounts.get("unknown", 0)
        result["pct_outside"] = round(outside / total_amount * 100, 2) if total_amount else 0
        result["pct_in_home"] = result["pct_in_district"]
    else:
        outside = total_amount - geo_amounts.get("in_state", 0) - geo_amounts.get("unknown", 0)
        result["pct_outside"] = round(outside / total_amount * 100, 2) if total_amount else 0
        result["pct_in_home"] = result["pct_in_state"]

    # Average contribution size
    result["avg_contribution"] = round(total_amount / total_count, 2) if total_count else 0

    # Unique donor estimate (by contributor name)
    if "NAME" in df.columns:
        result["unique_donors_approx"] = df["NAME"].nunique()

    return result


def top_outside_employers(df, chamber, n=10):
    """Get top employers from outside the member's district/state."""
    if chamber == "house":
        outside = df[~df["geo_class"].isin(["in_district", "unknown"])]
    else:
        outside = df[~df["geo_class"].isin(["in_state", "unknown"])]

    if outside.empty or "employer_normalized" not in outside.columns:
        return []

    emp = outside.groupby("employer_normalized").agg(
        total=("TRANSACTION_AMT", "sum"),
        count=("TRANSACTION_AMT", "count"),
    ).sort_values("total", ascending=False).head(n)

    return [
        {"employer": idx, "total": round(row["total"], 2), "count": int(row["count"])}
        for idx, row in emp.iterrows()
        if idx not in ("SELF-EMPLOYED", "RETIRED", "NOT EMPLOYED", "UNKNOWN")
    ][:n]


def top_outside_states(df, member_state, n=10):
    """Get top contributing states from outside the member's state."""
    outside = df[df["STATE"] != member_state]
    if outside.empty:
        return []

    states = outside.groupby("STATE").agg(
        total=("TRANSACTION_AMT", "sum"),
        count=("TRANSACTION_AMT", "count"),
    ).sort_values("total", ascending=False).head(n)

    return [
        {"state": idx, "total": round(row["total"], 2), "count": int(row["count"])}
        for idx, row in states.iterrows()
    ]


def analyze_individual_contributions(cycle):
    """Run full individual contribution analysis for a cycle."""
    path = PROCESSED_DIR / f"contributions_{cycle}_classified.parquet"
    if not path.exists():
        print(f"  No classified data for cycle {cycle}")
        return None, None

    df = pd.read_parquet(path)
    members_df = load_members_flat()
    print(f"  Loaded {len(df):,} contributions, {len(members_df)} members")

    # Merge validation data if available
    validation_path = OUTPUT_DIR / "validation_reconciliation.csv"
    validation = None
    if validation_path.exists():
        validation = pd.read_csv(validation_path)

    member_rows = []
    employer_rows = []

    for _, member in members_df.iterrows():
        name = member["member_name"]
        chamber = member["chamber"]
        state = member["state"]

        member_df = df[df["member_name"] == name]
        if member_df.empty:
            print(f"    {name}: no contributions found")
            member_rows.append({"member_name": name, "total_itemized_amount": 0})
            continue

        # Geographic breakdown
        geo = analyze_member_geography(member_df, chamber)

        # Top outside employers
        top_emp = top_outside_employers(member_df, chamber, n=20)
        for rank, emp in enumerate(top_emp, 1):
            employer_rows.append({
                "member_name": name,
                "rank": rank,
                "employer": emp["employer"],
                "total": emp["total"],
                "count": emp["count"],
            })

        # Top outside states
        top_states = top_outside_states(member_df, state, n=5)

        # Build member summary row
        row = {
            "member_name": name,
            "party": member["party"],
            "state": state,
            "district": member.get("district"),
            "chamber": chamber,
            "committee": member["committee"],
            "role": member["role"],
            "is_territorial": member["is_territorial"],
            **geo,
            "top_outside_employer_1": top_emp[0]["employer"] if len(top_emp) > 0 else "",
            "top_outside_employer_2": top_emp[1]["employer"] if len(top_emp) > 1 else "",
            "top_outside_employer_3": top_emp[2]["employer"] if len(top_emp) > 2 else "",
            "top_outside_state_1": top_states[0]["state"] if len(top_states) > 0 else "",
            "top_outside_state_2": top_states[1]["state"] if len(top_states) > 1 else "",
            "top_outside_state_3": top_states[2]["state"] if len(top_states) > 2 else "",
        }

        # Merge validation data
        if validation is not None:
            val_row = validation[validation["member_name"] == name]
            if not val_row.empty:
                val = val_row.iloc[0]
                row["unitemized_pct"] = val.get("unitemized_pct", None)
                row["capture_rate_pct"] = val.get("capture_rate_pct", None)
                row["jfc_flag"] = val.get("jfc_flag", False)
                row["fec_total_receipts"] = val.get("fec_total_receipts", None)
                row["fec_pac_contributions"] = val.get("fec_pac_contributions", None)

        member_rows.append(row)

    member_summary = pd.DataFrame(member_rows)
    employer_detail = pd.DataFrame(employer_rows)

    return member_summary, employer_detail


def analyze_pac_contributions(cycle, members_df):
    """Analyze PAC-to-candidate contributions."""
    path = PROCESSED_DIR / f"pac_contributions_{cycle}.parquet"
    if not path.exists():
        print(f"  No PAC data for cycle {cycle}")
        return None, None

    df = pd.read_parquet(path)
    print(f"  Loaded {len(df):,} PAC contributions")

    # Load committee master for real PAC names
    cm = load_committee_master(cycle)
    cmte_names = {}
    cmte_connected_org = {}
    cmte_type = {}
    cmte_designation = {}
    if cm is not None:
        cmte_names = dict(zip(cm["CMTE_ID"], cm["CMTE_NM"].fillna("")))
        cmte_connected_org = dict(zip(cm["CMTE_ID"], cm["CONNECTED_ORG_NM"].fillna("")))
        cmte_type = dict(zip(cm["CMTE_ID"], cm["CMTE_TP"].fillna("")))
        cmte_designation = dict(zip(cm["CMTE_ID"], cm["CMTE_DSGN"].fillna("")))

    # Build candidate_id -> member_name and member_name -> party mappings
    cand_to_member = dict(zip(
        members_df["fec_candidate_id"].dropna(),
        members_df["member_name"]
    ))
    member_to_party = dict(zip(members_df["member_name"], members_df["party"]))

    df["member_name"] = df["CAND_ID"].map(cand_to_member)
    df = df[df["member_name"].notna()]

    # Resolve real PAC name from committee master
    df["pac_name_resolved"] = df["CMTE_ID"].map(cmte_names).fillna(df["NAME"])

    # Per-member PAC summary — group by CMTE_ID only (not NAME)
    pac_by_member = []
    for name, group in df.groupby("member_name"):
        top_pacs = group.groupby("CMTE_ID").agg(
            total=("TRANSACTION_AMT", "sum"),
            count=("TRANSACTION_AMT", "count"),
            pac_name=("pac_name_resolved", "first"),
        ).sort_values("total", ascending=False).head(20)

        for rank, (cmte_id, row) in enumerate(top_pacs.iterrows(), 1):
            pac_by_member.append({
                "member_name": name,
                "rank": rank,
                "pac_cmte_id": cmte_id,
                "pac_name": row["pac_name"],
                "connected_org": cmte_connected_org.get(cmte_id, ""),
                "total": round(row["total"], 2),
                "count": int(row["count"]),
            })

    pac_member_df = pd.DataFrame(pac_by_member)

    # Committee-wide PAC analysis — group by CMTE_ID only
    df["party"] = df["member_name"].map(member_to_party)

    pac_spread = df.groupby("CMTE_ID").agg(
        pac_name=("pac_name_resolved", "first"),
        total_given=("TRANSACTION_AMT", "sum"),
        num_recipients=("member_name", "nunique"),
        recipients=("member_name", lambda x: ", ".join(sorted(x.unique()))),
        r_total=("TRANSACTION_AMT", lambda x: x[df.loc[x.index, "party"] == "R"].sum()),
        d_total=("TRANSACTION_AMT", lambda x: x[df.loc[x.index, "party"].isin(["D", "I"])].sum()),
    ).sort_values("num_recipients", ascending=False).reset_index()

    pac_spread.columns = ["pac_cmte_id", "pac_name", "total_given",
                          "num_recipients", "recipients", "r_total", "d_total"]

    # Add connected org and committee type
    pac_spread["connected_org"] = pac_spread["pac_cmte_id"].map(cmte_connected_org).fillna("")
    pac_spread["cmte_type"] = pac_spread["pac_cmte_id"].map(cmte_type).fillna("")
    pac_spread["cmte_designation"] = pac_spread["pac_cmte_id"].map(cmte_designation).fillna("")

    return pac_member_df, pac_spread


def compute_committee_aggregates(member_summary):
    """Compute committee-level aggregate statistics."""
    # Exclude territorial delegates and members with no data
    valid = member_summary[
        (~member_summary["is_territorial"].fillna(False).astype(bool)) &
        (member_summary["total_itemized_amount"] > 0)
    ].copy()

    rows = []

    for group_name, group_filter in [
        ("All Members", valid),
        ("House Ways & Means", valid[valid["committee"] == "house_ways_and_means"]),
        ("Senate Finance", valid[valid["committee"] == "senate_finance"]),
        ("House W&M Republicans", valid[(valid["committee"] == "house_ways_and_means") & (valid["party"] == "R")]),
        ("House W&M Democrats", valid[(valid["committee"] == "house_ways_and_means") & (valid["party"] == "D")]),
        ("Senate Finance Republicans", valid[(valid["committee"] == "senate_finance") & (valid["party"] == "R")]),
        ("Senate Finance Democrats", valid[(valid["committee"] == "senate_finance") & (valid["party"].isin(["D", "I"]))]),
    ]:
        if group_filter.empty:
            continue

        row = {
            "group": group_name,
            "member_count": len(group_filter),
            "mean_pct_outside": round(group_filter["pct_outside"].mean(), 1),
            "median_pct_outside": round(group_filter["pct_outside"].median(), 1),
            "mean_pct_dc": round(group_filter["pct_dc_kstreet"].mean(), 1),
            "median_pct_dc": round(group_filter["pct_dc_kstreet"].median(), 1),
            "total_contributions": round(group_filter["total_itemized_amount"].sum(), 2),
            "avg_contributions_per_member": round(group_filter["total_itemized_amount"].mean(), 2),
        }

        # Member with highest/lowest outside %
        highest = group_filter.loc[group_filter["pct_outside"].idxmax()]
        lowest = group_filter.loc[group_filter["pct_outside"].idxmin()]
        row["highest_outside_member"] = highest["member_name"]
        row["highest_outside_pct"] = highest["pct_outside"]
        row["lowest_outside_member"] = lowest["member_name"]
        row["lowest_outside_pct"] = lowest["pct_outside"]

        if "unitemized_pct" in group_filter.columns:
            row["mean_unitemized_pct"] = round(group_filter["unitemized_pct"].mean(), 1)

        rows.append(row)

    return pd.DataFrame(rows)


def compute_dc_breakdown(member_summary):
    """DC/K-Street specific breakdown."""
    valid = member_summary[member_summary["total_itemized_amount"] > 0].copy()
    dc_cols = ["member_name", "party", "state", "district", "chamber", "committee",
               "pct_dc_kstreet", "amt_dc_kstreet", "total_itemized_amount"]
    available = [c for c in dc_cols if c in valid.columns]
    dc = valid[available].sort_values("pct_dc_kstreet", ascending=False)
    return dc


def run():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    members_df = load_members_flat()

    for cycle in CYCLES:
        print(f"\n{'='*60}")
        print(f"ANALYSIS — Cycle {cycle}")
        print(f"{'='*60}")

        # Individual contributions
        member_summary, employer_detail = analyze_individual_contributions(cycle)

        if member_summary is None:
            continue

        # PAC contributions
        pac_member_df, pac_spread = analyze_pac_contributions(cycle, members_df)

        # Committee aggregates
        committee_agg = compute_committee_aggregates(member_summary)

        # DC breakdown
        dc_breakdown = compute_dc_breakdown(member_summary)

        # Save outputs
        suffix = f"_{cycle}" if cycle != PRIMARY_CYCLE else f"_{cycle}"

        member_path = OUTPUT_DIR / f"member_summary{suffix}.csv"
        member_summary.sort_values("pct_outside", ascending=False).to_csv(member_path, index=False)
        print(f"\n  Saved member summary: {member_path}")

        if employer_detail is not None and not employer_detail.empty:
            emp_path = OUTPUT_DIR / f"employer_top50_by_member{suffix}.csv"
            employer_detail.to_csv(emp_path, index=False)
            print(f"  Saved employer detail: {emp_path}")

        if committee_agg is not None and not committee_agg.empty:
            agg_path = OUTPUT_DIR / f"committee_aggregate{suffix}.csv"
            committee_agg.to_csv(agg_path, index=False)
            print(f"  Saved committee aggregates: {agg_path}")

        dc_path = OUTPUT_DIR / f"dc_kstreet_breakdown{suffix}.csv"
        dc_breakdown.to_csv(dc_path, index=False)
        print(f"  Saved DC breakdown: {dc_path}")

        if pac_member_df is not None and not pac_member_df.empty:
            pac_path = OUTPUT_DIR / f"pac_breakdown_by_member{suffix}.csv"
            pac_member_df.to_csv(pac_path, index=False)
            print(f"  Saved PAC breakdown: {pac_path}")

        if pac_spread is not None and not pac_spread.empty:
            spread_path = OUTPUT_DIR / f"top_pacs_by_committee{suffix}.csv"
            # Save PACs with 2+ recipients (enough for meaningful spread analysis)
            spread_to_save = pac_spread[pac_spread["num_recipients"] >= 2]
            spread_to_save.to_csv(spread_path, index=False)
            print(f"  Saved top PACs: {spread_path} ({len(spread_to_save)} PACs with 2+ recipients)")

        # Print highlights
        valid = member_summary[
            (~member_summary["is_territorial"].fillna(False).astype(bool)) &
            (member_summary["total_itemized_amount"] > 0)
        ]
        if not valid.empty:
            print(f"\n  Highlights ({cycle}):")
            ranked = valid.sort_values("pct_outside", ascending=False)
            print(f"  Top 5 most outside-funded:")
            for _, row in ranked.head(5).iterrows():
                dist = f"-{int(row['district']):02d}" if pd.notna(row.get("district")) else ""
                print(f"    {row['member_name']} ({row['party']}-{row['state']}{dist}): "
                      f"{row['pct_outside']:.1f}% outside")
            print(f"  Top 5 most locally-funded:")
            for _, row in ranked.tail(5).iterrows():
                dist = f"-{int(row['district']):02d}" if pd.notna(row.get("district")) else ""
                print(f"    {row['member_name']} ({row['party']}-{row['state']}{dist}): "
                      f"{row['pct_outside']:.1f}% outside")

    save_checkpoint(STEP_NAME, {"completed": True})
    print("\nDone.")


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
    run()
