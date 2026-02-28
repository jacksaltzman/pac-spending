#!/usr/bin/env python3
"""Step 02: Filter bulk FEC data to contributions for our target committees.

Reads the multi-gigabyte FEC bulk individual contributions file in chunks,
filtering to only contributions received by our 72 members' campaign committees.

Handles ActBlue/WinRed conduit contributions:
- Earmarked contributions (MEMO_CD='X') carry the original contributor's
  geographic info and are attributed to the recipient committee.
- Aggregate conduit transfers are excluded to avoid double-counting.

Also filters PAC-to-candidate contributions from the pas2 bulk file.

Requires: Steps 00 (bulk data downloaded) and 01 (FEC IDs resolved).
Outputs: data/processed/contributions_{cycle}.parquet
         data/processed/pac_contributions_{cycle}.parquet
"""

import sys
from pathlib import Path

import pandas as pd
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import (
    RAW_DIR, PROCESSED_DIR, MEMBERS_FILE, CYCLES,
    INDIV_COLUMNS, INDIV_USECOLS, PAS2_COLUMNS, PAS2_USECOLS,
    ACTBLUE_CMTE_ID, WINRED_CMTE_ID, BULK_CHUNK_SIZE,
)
from utils.checkpoint import (
    is_step_complete, save_checkpoint, save_progress, load_progress,
)
import json


STEP_NAME = "02_filter_contributions"


def load_target_ids():
    """Load target committee IDs and candidate IDs from members.json.

    Returns:
        cmte_ids: set of principal campaign committee IDs
        cand_ids: set of candidate IDs
        cmte_to_member: dict mapping committee_id -> member name
    """
    with open(MEMBERS_FILE) as f:
        data = json.load(f)

    cmte_ids = set()
    cand_ids = set()
    cmte_to_member = {}

    for committee_key, committee_info in data.items():
        for member in committee_info["members"]:
            cmte_id = member.get("principal_committee_id")
            cand_id = member.get("fec_candidate_id")
            if cmte_id:
                cmte_ids.add(cmte_id)
                cmte_to_member[cmte_id] = member["name"]
            if cand_id:
                cand_ids.add(cand_id)

    return cmte_ids, cand_ids, cmte_to_member


def find_bulk_file(file_type, cycle):
    """Find the extracted .txt file for a given bulk data type and cycle."""
    extract_dir = RAW_DIR / f"{file_type}_{cycle}"
    if not extract_dir.exists():
        return None

    # FEC names vary: itcont.txt, itpas2.txt, etc.
    txt_files = list(extract_dir.glob("*.txt"))
    if not txt_files:
        return None

    # Return the largest .txt file (the main data file)
    return max(txt_files, key=lambda p: p.stat().st_size)


def count_lines(filepath):
    """Quick line count for progress bar estimation."""
    count = 0
    with open(filepath, "rb") as f:
        for _ in f:
            count += 1
    return count


def filter_individual_contributions(cycle, cmte_ids, cmte_to_member):
    """Filter the bulk individual contributions file for a cycle.

    Strategy for conduit handling:
    1. Keep direct contributions where CMTE_ID is in our target set
       AND MEMO_CD is NOT 'X' (these are direct, non-memo contributions)
    2. Keep earmarked contributions where MEMO_CD='X' AND CMTE_ID is in
       our target set (these are the memo entries that carry original
       contributor info for conduit contributions)
    3. Exclude aggregate conduit transfers from ActBlue/WinRed to our
       target committees (these would double-count the earmarked money)
    """
    bulk_file = find_bulk_file("indiv", cycle)
    if not bulk_file:
        print(f"  No individual contributions file found for cycle {cycle}")
        return None

    print(f"\n  Processing {bulk_file.name} ({bulk_file.stat().st_size / 1e9:.1f} GB)...")

    # Determine which columns to load by index
    usecol_indices = [INDIV_COLUMNS.index(c) for c in INDIV_USECOLS]

    chunks_matched = []
    total_rows = 0
    matched_rows = 0
    conduit_memo_rows = 0
    excluded_conduit_transfers = 0

    reader = pd.read_csv(
        bulk_file,
        sep="|",
        header=None,
        names=INDIV_COLUMNS,
        usecols=usecol_indices,
        dtype=str,
        chunksize=BULK_CHUNK_SIZE,
        on_bad_lines="skip",
        encoding="utf-8",
        encoding_errors="replace",
    )

    for chunk_idx, chunk in enumerate(tqdm(reader, desc=f"    Filtering {cycle}")):
        total_rows += len(chunk)

        # Direct contributions to our target committees (non-memo entries)
        direct = chunk[
            (chunk["CMTE_ID"].isin(cmte_ids)) &
            (chunk["MEMO_CD"] != "X")
        ].copy()

        # Earmarked/conduit contributions: memo entries filed under our target committees
        # These have MEMO_CD='X' and carry the original contributor's info
        conduit_memo = chunk[
            (chunk["CMTE_ID"].isin(cmte_ids)) &
            (chunk["MEMO_CD"] == "X")
        ].copy()

        # Exclude aggregate conduit transfers FROM ActBlue/WinRed TO our committees
        # These are the non-memo rows from conduit committees — they represent
        # the lump-sum transfer, not individual contributions
        excluded = chunk[
            (chunk["CMTE_ID"].isin({ACTBLUE_CMTE_ID, WINRED_CMTE_ID})) &
            (chunk["MEMO_CD"] != "X")
        ]
        excluded_conduit_transfers += len(excluded)

        # Combine direct + conduit memo entries
        matched = pd.concat([direct, conduit_memo], ignore_index=True)

        if len(matched) > 0:
            # Add a flag for conduit contributions
            matched["is_conduit"] = False
            matched.loc[matched["MEMO_CD"] == "X", "is_conduit"] = True

            # Map committee ID to member name
            matched["member_name"] = matched["CMTE_ID"].map(cmte_to_member)

            chunks_matched.append(matched)
            matched_rows += len(direct)
            conduit_memo_rows += len(conduit_memo)

        # Progress checkpoint every 20 chunks
        if (chunk_idx + 1) % 20 == 0:
            save_progress(STEP_NAME, f"indiv_{cycle}_chunks", chunk_idx + 1)

    if not chunks_matched:
        print(f"  No matching contributions found for cycle {cycle}")
        return None

    df = pd.concat(chunks_matched, ignore_index=True)

    # Convert amount to numeric
    df["TRANSACTION_AMT"] = pd.to_numeric(df["TRANSACTION_AMT"], errors="coerce")

    # Save
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PROCESSED_DIR / f"contributions_{cycle}.parquet"
    df.to_parquet(out_path, index=False)

    print(f"\n  Individual contributions {cycle}:")
    print(f"    Total rows scanned:       {total_rows:>12,}")
    print(f"    Direct contributions:      {matched_rows:>12,}")
    print(f"    Conduit/earmarked (memo):  {conduit_memo_rows:>12,}")
    print(f"    Excluded conduit xfers:    {excluded_conduit_transfers:>12,}")
    print(f"    Final row count:           {len(df):>12,}")
    print(f"    Total amount:              ${df['TRANSACTION_AMT'].sum():>14,.2f}")
    print(f"    Saved to: {out_path}")

    return {
        "total_scanned": total_rows,
        "direct": matched_rows,
        "conduit_memo": conduit_memo_rows,
        "excluded_transfers": excluded_conduit_transfers,
        "final_rows": len(df),
        "total_amount": float(df["TRANSACTION_AMT"].sum()),
    }


def filter_pac_contributions(cycle, cand_ids):
    """Filter PAC-to-candidate contributions for our target candidates."""
    bulk_file = find_bulk_file("pas2", cycle)
    if not bulk_file:
        print(f"  No PAC contributions file found for cycle {cycle}")
        return None

    print(f"\n  Processing PAC file {bulk_file.name} ({bulk_file.stat().st_size / 1e6:.1f} MB)...")

    usecol_indices = [PAS2_COLUMNS.index(c) for c in PAS2_USECOLS]

    chunks_matched = []
    total_rows = 0

    reader = pd.read_csv(
        bulk_file,
        sep="|",
        header=None,
        names=PAS2_COLUMNS,
        usecols=usecol_indices,
        dtype=str,
        chunksize=BULK_CHUNK_SIZE,
        on_bad_lines="skip",
        encoding="utf-8",
        encoding_errors="replace",
    )

    for chunk in tqdm(reader, desc=f"    Filtering PAC {cycle}"):
        total_rows += len(chunk)
        matched = chunk[chunk["CAND_ID"].isin(cand_ids)].copy()
        if len(matched) > 0:
            chunks_matched.append(matched)

    if not chunks_matched:
        print(f"  No PAC contributions found for cycle {cycle}")
        return None

    df = pd.concat(chunks_matched, ignore_index=True)
    df["TRANSACTION_AMT"] = pd.to_numeric(df["TRANSACTION_AMT"], errors="coerce")

    out_path = PROCESSED_DIR / f"pac_contributions_{cycle}.parquet"
    df.to_parquet(out_path, index=False)

    print(f"\n  PAC contributions {cycle}:")
    print(f"    Total rows scanned:  {total_rows:>10,}")
    print(f"    Matched rows:        {len(df):>10,}")
    print(f"    Total amount:        ${df['TRANSACTION_AMT'].sum():>12,.2f}")
    print(f"    Unique PACs:         {df['CMTE_ID'].nunique():>10,}")
    print(f"    Saved to: {out_path}")

    return {
        "total_scanned": total_rows,
        "matched_rows": len(df),
        "total_amount": float(df["TRANSACTION_AMT"].sum()),
        "unique_pacs": int(df["CMTE_ID"].nunique()),
    }


def run():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    cmte_ids, cand_ids, cmte_to_member = load_target_ids()
    print(f"Target committee IDs: {len(cmte_ids)}")
    print(f"Target candidate IDs: {len(cand_ids)}")

    if not cmte_ids:
        print("ERROR: No committee IDs found. Run 01_lookup_fec_ids.py first.")
        sys.exit(1)

    stats = {}
    for cycle in CYCLES:
        print(f"\n{'='*60}")
        print(f"Cycle {cycle}")
        print(f"{'='*60}")

        indiv_stats = filter_individual_contributions(cycle, cmte_ids, cmte_to_member)
        pac_stats = filter_pac_contributions(cycle, cand_ids)

        stats[cycle] = {
            "individual": indiv_stats,
            "pac": pac_stats,
        }

    save_checkpoint(STEP_NAME, stats)
    print("\nDone.")


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
    run()
