#!/usr/bin/env python3
"""Step 05: Validate contribution totals against FEC summary data.

For each member, pulls authoritative totals from the FEC API and compares
to what we captured from the bulk data. Also computes the unitemized
gap (what % of fundraising we can't geographically analyze).

Flags:
- Members where our captured total differs from FEC by >5%
- Members with high unitemized rates (>50%)
- Members with significant JFC transfers (>10% of receipts)

Requires: Steps 01 (FEC IDs) and 04 (classified contributions), FEC API key.
Outputs: output/validation_reconciliation.csv, output/unitemized_gap.csv
"""

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import MEMBERS_FILE, PROCESSED_DIR, OUTPUT_DIR, PRIMARY_CYCLE
from utils.fec_api import FECClient
from utils.checkpoint import is_step_complete, save_checkpoint, save_progress

STEP_NAME = "05_validate_totals"

DISCREPANCY_THRESHOLD = 0.05  # 5%
HIGH_UNITEMIZED_THRESHOLD = 0.50  # 50%
JFC_THRESHOLD = 0.10  # 10%


def load_our_totals(cycle):
    """Load our contribution totals from the classified data."""
    path = PROCESSED_DIR / f"contributions_{cycle}_classified.parquet"
    if not path.exists():
        return {}

    df = pd.read_parquet(path)
    totals = df.groupby("member_name").agg(
        our_itemized_total=("TRANSACTION_AMT", "sum"),
        our_contribution_count=("TRANSACTION_AMT", "count"),
    ).to_dict("index")
    return totals


def run():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    client = FECClient()

    with open(MEMBERS_FILE) as f:
        members_data = json.load(f)

    our_totals = load_our_totals(PRIMARY_CYCLE)

    rows = []
    issues = []

    for committee_key, committee_info in members_data.items():
        chamber = committee_info["chamber"]
        print(f"\n{'='*60}")
        print(f"{committee_info['committee_name']}")
        print(f"{'='*60}")

        for member in committee_info["members"]:
            name = member["name"]
            cand_id = member.get("fec_candidate_id")

            if not cand_id:
                print(f"  [skip] {name} — no FEC candidate ID")
                rows.append({
                    "member_name": name,
                    "chamber": chamber,
                    "state": member["state"],
                    "validation_status": "no_fec_id",
                })
                continue

            print(f"  {name}...", end=" ")

            # Pull FEC summary totals
            totals = client.get_candidate_totals(cand_id, cycle=PRIMARY_CYCLE)

            if not totals:
                print("no FEC totals available")
                rows.append({
                    "member_name": name,
                    "chamber": chamber,
                    "state": member["state"],
                    "fec_candidate_id": cand_id,
                    "validation_status": "no_totals",
                })
                continue

            # Extract key financial fields
            fec_receipts = totals.get("receipts", 0) or 0
            fec_itemized = totals.get("individual_itemized_contributions", 0) or 0
            fec_unitemized = totals.get("individual_unitemized_contributions", 0) or 0
            fec_pac = totals.get("other_political_committee_contributions", 0) or 0
            fec_transfers = totals.get("transfers_from_other_authorized_committees", 0) or 0

            # Our captured total
            our_data = our_totals.get(name, {})
            our_total = our_data.get("our_itemized_total", 0)
            our_count = our_data.get("our_contribution_count", 0)

            # Compute discrepancy
            if fec_itemized > 0:
                discrepancy = abs(our_total - fec_itemized) / fec_itemized
            else:
                discrepancy = 1.0 if our_total > 0 else 0.0

            # Compute unitemized gap
            if fec_receipts > 0:
                unitemized_pct = fec_unitemized / fec_receipts
                itemized_pct = fec_itemized / fec_receipts
                pac_pct = fec_pac / fec_receipts
                jfc_pct = fec_transfers / fec_receipts
            else:
                unitemized_pct = 0
                itemized_pct = 0
                pac_pct = 0
                jfc_pct = 0

            # Capture rate: what % of FEC's itemized total did we capture
            capture_rate = our_total / fec_itemized if fec_itemized > 0 else 0

            # Determine validation status
            status = "ok"
            flags = []
            if discrepancy > DISCREPANCY_THRESHOLD:
                status = "discrepancy"
                flags.append(f"discrepancy={discrepancy:.1%}")
            if unitemized_pct > HIGH_UNITEMIZED_THRESHOLD:
                flags.append(f"high_unitemized={unitemized_pct:.1%}")
            if jfc_pct > JFC_THRESHOLD:
                flags.append(f"jfc_exposure={jfc_pct:.1%}")

            flag_str = "; ".join(flags) if flags else ""

            print(f"capture={capture_rate:.1%}, unitemized={unitemized_pct:.1%}" +
                  (f" [{flag_str}]" if flag_str else ""))

            if discrepancy > DISCREPANCY_THRESHOLD:
                issues.append((name, discrepancy, our_total, fec_itemized))

            rows.append({
                "member_name": name,
                "chamber": chamber,
                "state": member["state"],
                "party": member["party"],
                "fec_candidate_id": cand_id,
                "fec_total_receipts": round(fec_receipts, 2),
                "fec_itemized_individual": round(fec_itemized, 2),
                "fec_unitemized_individual": round(fec_unitemized, 2),
                "fec_pac_contributions": round(fec_pac, 2),
                "fec_transfers": round(fec_transfers, 2),
                "our_itemized_total": round(our_total, 2),
                "our_contribution_count": our_count,
                "discrepancy_pct": round(discrepancy * 100, 2),
                "capture_rate_pct": round(capture_rate * 100, 2),
                "unitemized_pct": round(unitemized_pct * 100, 2),
                "itemized_pct": round(itemized_pct * 100, 2),
                "pac_pct": round(pac_pct * 100, 2),
                "jfc_pct": round(jfc_pct * 100, 2),
                "jfc_flag": jfc_pct > JFC_THRESHOLD,
                "validation_status": status,
                "flags": flag_str,
            })

            save_progress(STEP_NAME, "last_member", name)

    # Save results
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)

    # Validation reconciliation
    recon_path = OUTPUT_DIR / "validation_reconciliation.csv"
    df.to_csv(recon_path, index=False)
    print(f"\nSaved validation reconciliation to: {recon_path}")

    # Unitemized gap (subset of columns, sorted by unitemized_pct)
    gap_cols = [
        "member_name", "chamber", "state", "party",
        "fec_total_receipts", "fec_itemized_individual", "fec_unitemized_individual",
        "unitemized_pct", "itemized_pct", "pac_pct",
        "our_itemized_total", "capture_rate_pct", "jfc_flag",
    ]
    available_cols = [c for c in gap_cols if c in df.columns]
    gap_df = df[df["validation_status"] != "no_fec_id"][available_cols].copy()
    if "unitemized_pct" in gap_df.columns:
        gap_df = gap_df.sort_values("unitemized_pct", ascending=False)
    gap_path = OUTPUT_DIR / "unitemized_gap.csv"
    gap_df.to_csv(gap_path, index=False)
    print(f"Saved unitemized gap analysis to: {gap_path}")

    # Summary
    valid = df[df["validation_status"].isin(["ok", "discrepancy"])]
    print(f"\n{'='*60}")
    print("Validation Summary")
    print(f"{'='*60}")
    if not valid.empty and "capture_rate_pct" in valid.columns:
        print(f"  Members validated:        {len(valid)}")
        print(f"  Mean capture rate:        {valid['capture_rate_pct'].mean():.1f}%")
        print(f"  Median unitemized gap:    {valid['unitemized_pct'].median():.1f}%")
        print(f"  Members with >5% discrepancy: {len(issues)}")
        print(f"  Members with JFC flag:    {valid['jfc_flag'].sum()}")

    if issues:
        print(f"\n  DISCREPANCIES (>{DISCREPANCY_THRESHOLD:.0%}):")
        for name, disc, ours, fec in issues:
            print(f"    {name}: ours=${ours:,.0f} vs FEC=${fec:,.0f} ({disc:.1%} off)")

    save_checkpoint(STEP_NAME, {
        "members_validated": len(valid),
        "discrepancies": len(issues),
    })


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
    run()
