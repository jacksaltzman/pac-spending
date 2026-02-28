#!/usr/bin/env python3
"""Pipeline orchestrator: runs all steps in sequence with checkpoint support.

Usage:
    python scripts/run_all.py              # Run full pipeline, skip completed steps
    python scripts/run_all.py --from-step 4  # Start from step 4 (04_classify)
    python scripts/run_all.py --force      # Re-run everything from scratch

Steps:
    0: 00_download_bulk_data.py   — Download FEC bulk files + Census data
    1: 01_lookup_fec_ids.py       — Look up FEC candidate/committee IDs
    2: 02_filter_contributions.py — Filter bulk data to target committees
    3: 03_build_zip_lookup.py     — Build ZIP-to-district mapping
    4: 04_classify_geography.py   — Tag each contribution in/out district
    5: 05_validate_totals.py      — Validate against FEC summary totals
    6: 06_normalize_employers.py  — Normalize employer names
    7: 07_analyze.py              — Generate summary statistics
    8: 08_generate_report.py      — Create output report
"""

import argparse
import importlib
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import FEC_API_KEY
from utils.checkpoint import is_step_complete, clear_all_checkpoints

STEPS = [
    ("00_download_bulk_data", "Download FEC bulk data files"),
    ("01_lookup_fec_ids", "Look up FEC candidate/committee IDs"),
    ("02_filter_contributions", "Filter bulk data to target committees"),
    ("03_build_zip_lookup", "Build ZIP-to-district mapping"),
    ("04_classify_geography", "Classify contribution geography"),
    ("05_validate_totals", "Validate totals against FEC API"),
    ("06_normalize_employers", "Normalize employer names"),
    ("07_analyze", "Generate summary statistics"),
    ("08_generate_report", "Generate report"),
]


def run_step(module_name):
    """Import and run a step module."""
    module = importlib.import_module(f"scripts.{module_name}")
    module.run()


def main():
    parser = argparse.ArgumentParser(description="Geographic Mismatch Analysis Pipeline")
    parser.add_argument("--from-step", type=int, default=0,
                        help="Start from this step number (0-8)")
    parser.add_argument("--force", action="store_true",
                        help="Clear all checkpoints and re-run everything")
    parser.add_argument("--only", type=int,
                        help="Run only this step number")
    args = parser.parse_args()

    # Pre-flight checks
    if FEC_API_KEY == "DEMO_KEY":
        print("WARNING: Using DEMO_KEY for FEC API. Rate limits will be very low.")
        print("Set FEC_API_KEY environment variable for production use.")
        print("  export FEC_API_KEY=your_key_here")
        print()

    if args.force:
        print("Clearing all checkpoints...")
        clear_all_checkpoints()

    if args.only is not None:
        if args.only < 0 or args.only >= len(STEPS):
            print(f"Invalid step number: {args.only}. Valid range: 0-{len(STEPS)-1}")
            sys.exit(1)
        module_name, desc = STEPS[args.only]
        print(f"\n{'='*60}")
        print(f"Step {args.only}: {desc}")
        print(f"{'='*60}")
        run_step(module_name)
        return

    # Run pipeline
    start_time = time.time()
    print(f"Starting pipeline from step {args.from_step}")
    print(f"{'='*60}")

    for i, (module_name, desc) in enumerate(STEPS):
        if i < args.from_step:
            print(f"\n[{i}] {desc} — SKIPPED (--from-step {args.from_step})")
            continue

        step_name = module_name  # checkpoint names match module names
        if is_step_complete(step_name) and not args.force:
            print(f"\n[{i}] {desc} — ALREADY COMPLETE (checkpoint exists)")
            continue

        print(f"\n{'='*60}")
        print(f"[{i}] {desc}")
        print(f"{'='*60}")

        step_start = time.time()
        try:
            run_step(module_name)
        except Exception as e:
            elapsed = time.time() - step_start
            print(f"\nERROR in step {i} ({module_name}) after {elapsed:.0f}s: {e}")
            print(f"Fix the issue and re-run. The pipeline will resume from step {i}.")
            sys.exit(1)

        elapsed = time.time() - step_start
        print(f"\n[{i}] Completed in {elapsed:.1f}s")

    total_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Pipeline complete in {total_time:.1f}s ({total_time/60:.1f} min)")
    print(f"{'='*60}")
    print(f"\nOutputs in: {Path(__file__).resolve().parent.parent / 'output'}")


if __name__ == "__main__":
    main()
