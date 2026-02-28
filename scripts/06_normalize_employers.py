#!/usr/bin/env python3
"""Step 06: Normalize employer names in the classified contribution data.

Applies the normalization pipeline from utils/employer_normalizer.py
to the EMPLOYER column, adding an employer_normalized column.

On first run, also prints the top 200 employer names by frequency
so the user can build/refine the alias table in config/employer_aliases.json.

Requires: Step 04 (classified contributions).
Outputs: Updated parquet files with employer_normalized column.
"""

import sys
from pathlib import Path

import pandas as pd
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import PROCESSED_DIR, CYCLES
from utils.employer_normalizer import normalize_employer, reload_aliases
from utils.checkpoint import is_step_complete, save_checkpoint

STEP_NAME = "06_normalize_employers"


def normalize_cycle(cycle):
    """Normalize employer names for a cycle's classified contributions."""
    input_path = PROCESSED_DIR / f"contributions_{cycle}_classified.parquet"
    if not input_path.exists():
        print(f"  No classified contributions for cycle {cycle}")
        return None

    df = pd.read_parquet(input_path)
    print(f"  Loaded {len(df):,} contributions for cycle {cycle}")

    # Apply normalization
    tqdm.pandas(desc=f"    Normalizing {cycle}")
    df["employer_normalized"] = df["EMPLOYER"].progress_apply(normalize_employer)

    # Save back
    df.to_parquet(input_path, index=False)
    print(f"  Saved normalized data back to: {input_path}")

    # Print top employers for alias table curation
    top_n = 200
    emp_counts = df["employer_normalized"].value_counts().head(top_n)
    emp_amounts = df.groupby("employer_normalized")["TRANSACTION_AMT"].sum().sort_values(ascending=False).head(top_n)

    print(f"\n  Top {top_n} employers by frequency:")
    print(f"  {'Rank':<5} {'Count':>8} {'Total $':>14} {'Employer'}")
    print(f"  {'-'*5} {'-'*8} {'-'*14} {'-'*40}")
    for rank, (employer, count) in enumerate(emp_counts.items(), 1):
        amount = emp_amounts.get(employer, 0)
        print(f"  {rank:<5} {count:>8,} ${amount:>13,.0f} {employer}")

    # Stats
    unique_raw = df["EMPLOYER"].nunique()
    unique_normalized = df["employer_normalized"].nunique()
    reduction = (1 - unique_normalized / unique_raw) * 100 if unique_raw > 0 else 0

    print(f"\n  Employer normalization stats:")
    print(f"    Unique raw employers:        {unique_raw:>8,}")
    print(f"    Unique after normalization:  {unique_normalized:>8,}")
    print(f"    Reduction:                   {reduction:>7.1f}%")

    # Flag potential aliases to add
    print(f"\n  Potential alias candidates (similar top employers):")
    top_50 = list(emp_counts.head(50).index)
    for i, emp1 in enumerate(top_50):
        for emp2 in top_50[i+1:]:
            # Simple check: one is a substring of the other
            if len(emp1) > 3 and len(emp2) > 3:
                if emp1 in emp2 or emp2 in emp1:
                    c1 = emp_counts[emp1]
                    c2 = emp_counts[emp2]
                    print(f"    '{emp1}' ({c1:,}) <-> '{emp2}' ({c2:,})")

    return {
        "unique_raw": unique_raw,
        "unique_normalized": unique_normalized,
        "reduction_pct": round(reduction, 1),
    }


def run():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    # Reload aliases in case the file was edited
    reload_aliases()

    stats = {}
    for cycle in CYCLES:
        print(f"\n{'='*60}")
        print(f"Cycle {cycle}")
        print(f"{'='*60}")
        result = normalize_cycle(cycle)
        if result:
            stats[str(cycle)] = result

    save_checkpoint(STEP_NAME, stats)

    print("\n" + "="*60)
    print("NEXT STEP: Review the top employers printed above.")
    print("If you see duplicates or variants that should merge,")
    print("add them to config/employer_aliases.json and re-run with --force.")
    print("="*60)


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
    run()
