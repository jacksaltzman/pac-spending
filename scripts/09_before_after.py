#!/usr/bin/env python3
"""Step 09: Before/after committee appointment PAC receipt analysis.

Fetches historical candidate totals from the FEC API across 6 election cycles
(2014-2024) and compares PAC receipts before vs. after each member's committee
appointment date.

Requires: config/members.json, config/committee_history.json, FEC_API_KEY env var.
Outputs:
  - data/processed/historical_pac_receipts.csv  (raw per-member, per-cycle data)
  - output/before_after_summary.csv             (analyzed before/after comparison)
"""

import json
import os
import sys
import time
from pathlib import Path
from statistics import mean, median

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import (
    MEMBERS_FILE, PROCESSED_DIR, OUTPUT_DIR, FEC_API_KEY, FEC_API_BASE,
    FEC_API_RATE_DELAY,
)
from utils.checkpoint import is_step_complete, save_checkpoint, save_progress, load_progress

STEP_NAME = "09_before_after"
HISTORICAL_CYCLES = [2014, 2016, 2018, 2020, 2022, 2024]
COMMITTEE_HISTORY_FILE = Path(__file__).resolve().parent.parent / "config" / "committee_history.json"

# API settings
REQUEST_TIMEOUT = 30
MAX_RETRIES = 5
PROGRESS_SAVE_INTERVAL = 10  # save checkpoint every N API calls


def load_members():
    """Load members.json into a flat list with committee info."""
    with open(MEMBERS_FILE) as f:
        data = json.load(f)

    members = []
    for committee_key, committee_info in data.items():
        for member in committee_info["members"]:
            fec_id = member.get("fec_candidate_id")
            if not fec_id:
                continue
            members.append({
                "name": member["name"],
                "fec_candidate_id": fec_id,
                "party": member["party"],
                "state": member["state"],
                "chamber": committee_info["chamber"],
                "committee": committee_key,
            })
    return members


def load_committee_history():
    """Load committee_history.json into a dict keyed by fec_candidate_id."""
    with open(COMMITTEE_HISTORY_FILE) as f:
        data = json.load(f)

    history = {}
    for entry in data["members"]:
        fec_id = entry.get("fec_candidate_id")
        if fec_id:
            history[fec_id] = entry
    return history


def fetch_candidate_totals(candidate_id, cycle, api_key):
    """Fetch candidate totals from FEC API for a specific cycle.

    Returns dict with pac_receipts, total_receipts, individual_itemized or None.
    """
    url = f"{FEC_API_BASE}/candidate/{candidate_id}/totals/"
    params = {
        "cycle": cycle,
        "api_key": api_key,
    }

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)

            if resp.status_code == 429:
                wait = (2 ** attempt) * 2
                print(f"      Rate limited (429). Waiting {wait}s...")
                time.sleep(wait)
                continue

            if resp.status_code == 404:
                return None

            resp.raise_for_status()
            data = resp.json()

            results = data.get("results", [])
            if not results:
                return None

            # Take the first result for this cycle
            r = results[0]
            return {
                "pac_receipts": r.get("other_political_committee_contributions", 0) or 0,
                "total_receipts": r.get("receipts", 0) or 0,
                "individual_itemized": r.get("individual_itemized_contributions", 0) or 0,
            }

        except requests.exceptions.Timeout:
            wait = (2 ** attempt) * 2
            print(f"      Timeout. Retrying in {wait}s... (attempt {attempt + 1}/{MAX_RETRIES})")
            time.sleep(wait)
            continue
        except requests.exceptions.RequestException as e:
            if attempt < MAX_RETRIES - 1:
                wait = (2 ** attempt) * 2
                print(f"      Error: {e}. Retrying in {wait}s... (attempt {attempt + 1}/{MAX_RETRIES})")
                time.sleep(wait)
                continue
            else:
                print(f"      Failed after {MAX_RETRIES} attempts: {e}")
                return None

    return None


def compute_transition_cycle(first_year):
    """Compute the election cycle that contains first_year.

    If first_year is odd (e.g., 2015), transition cycle = first_year + 1 (2016).
    If first_year is even, transition cycle = first_year itself.
    """
    if first_year % 2 == 1:
        return first_year + 1
    return first_year


def analyze_before_after(member_data, first_year):
    """Analyze before/after committee appointment for a single member.

    Args:
        member_data: list of dicts with keys: cycle, pac_receipts, total_receipts, individual_itemized
        first_year: year of committee appointment

    Returns:
        dict with summary stats, or None if no data at all.
    """
    transition_cycle = compute_transition_cycle(first_year)

    before = [d for d in member_data if d["cycle"] < transition_cycle]
    after = [d for d in member_data if d["cycle"] > transition_cycle]

    # Filter out zero-data cycles (member may not have been in office)
    before_pac = [d["pac_receipts"] for d in before if d["pac_receipts"] > 0 or d["total_receipts"] > 0]
    after_pac = [d["pac_receipts"] for d in after if d["pac_receipts"] > 0 or d["total_receipts"] > 0]

    before_total = [d["total_receipts"] for d in before if d["pac_receipts"] > 0 or d["total_receipts"] > 0]
    after_total = [d["total_receipts"] for d in after if d["pac_receipts"] > 0 or d["total_receipts"] > 0]

    before_indiv = [d["individual_itemized"] for d in before if d["pac_receipts"] > 0 or d["total_receipts"] > 0]
    after_indiv = [d["individual_itemized"] for d in after if d["pac_receipts"] > 0 or d["total_receipts"] > 0]

    cycles_before = len(before_pac)
    cycles_after = len(after_pac)

    result = {
        "transition_cycle": transition_cycle,
        "cycles_before": cycles_before,
        "cycles_after": cycles_after,
    }

    # Flag edge cases
    if cycles_before == 0:
        result["flag"] = "no_before_data"
    elif cycles_after <= 1:
        result["flag"] = "limited_after_data"
    else:
        result["flag"] = ""

    # PAC stats
    if cycles_before > 0:
        result["median_pac_before"] = round(median(before_pac), 2)
        result["mean_pac_before"] = round(mean(before_pac), 2)
    else:
        result["median_pac_before"] = 0
        result["mean_pac_before"] = 0

    if cycles_after > 0:
        result["median_pac_after"] = round(median(after_pac), 2)
        result["mean_pac_after"] = round(mean(after_pac), 2)
    else:
        result["median_pac_after"] = 0
        result["mean_pac_after"] = 0

    # PAC pct change
    if cycles_before > 0 and result["median_pac_before"] > 0 and cycles_after > 0:
        result["pct_change_pac"] = round(
            ((result["median_pac_after"] - result["median_pac_before"]) / result["median_pac_before"]) * 100, 1
        )
    else:
        result["pct_change_pac"] = ""

    # Total receipts stats (control)
    if cycles_before > 0:
        result["median_total_before"] = round(median(before_total), 2)
    else:
        result["median_total_before"] = 0

    if cycles_after > 0:
        result["median_total_after"] = round(median(after_total), 2)
    else:
        result["median_total_after"] = 0

    if cycles_before > 0 and result["median_total_before"] > 0 and cycles_after > 0:
        result["pct_change_total"] = round(
            ((result["median_total_after"] - result["median_total_before"]) / result["median_total_before"]) * 100, 1
        )
    else:
        result["pct_change_total"] = ""

    # Individual itemized stats (control)
    if cycles_before > 0:
        result["median_indiv_before"] = round(median(before_indiv), 2)
    else:
        result["median_indiv_before"] = 0

    if cycles_after > 0:
        result["median_indiv_after"] = round(median(after_indiv), 2)
    else:
        result["median_indiv_after"] = 0

    return result


def main():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    api_key = os.environ.get("FEC_API_KEY", FEC_API_KEY)
    if api_key == "DEMO_KEY":
        print("WARNING: Using DEMO_KEY. Set FEC_API_KEY for better rate limits.")

    print(f"\n{'='*60}")
    print(f"STEP 09: Before/After Committee PAC Analysis")
    print(f"{'='*60}")

    # Load data
    members = load_members()
    committee_history = load_committee_history()
    print(f"\n  Loaded {len(members)} members from members.json")
    print(f"  Loaded {len(committee_history)} entries from committee_history.json")
    print(f"  Cycles to fetch: {HISTORICAL_CYCLES}")

    # Load progress (for resume)
    progress = load_progress(STEP_NAME)
    completed_pairs = set()
    if "completed_pairs" in progress:
        completed_pairs = set(tuple(p) for p in progress["completed_pairs"])
        print(f"  Resuming: {len(completed_pairs)} member-cycle pairs already fetched")

    # Calculate total API calls needed
    total_pairs = len(members) * len(HISTORICAL_CYCLES)
    remaining = total_pairs - len(completed_pairs)
    print(f"  Total member-cycle pairs: {total_pairs}")
    print(f"  Remaining API calls: {remaining}")

    # Fetch historical data
    print(f"\n  Fetching historical candidate totals from FEC API...")
    all_rows = []
    api_call_count = 0
    errors = 0

    # Reconstruct already-fetched rows from progress
    if "fetched_rows" in progress:
        all_rows = progress["fetched_rows"]
        print(f"  Restored {len(all_rows)} previously fetched rows")

    for i, member in enumerate(members):
        name = member["name"]
        fec_id = member["fec_candidate_id"]

        for cycle in HISTORICAL_CYCLES:
            pair_key = (fec_id, cycle)
            if pair_key in completed_pairs:
                continue

            # Rate limiting
            if api_call_count > 0:
                time.sleep(FEC_API_RATE_DELAY)

            api_call_count += 1
            if api_call_count % 50 == 0 or api_call_count == 1:
                print(f"    [{api_call_count}/{remaining}] Fetching {name} — {cycle}...")
            elif api_call_count % 10 == 0:
                print(f"    [{api_call_count}/{remaining}] ...")

            result = fetch_candidate_totals(fec_id, cycle, api_key)

            if result is not None:
                all_rows.append({
                    "name": name,
                    "fec_candidate_id": fec_id,
                    "party": member["party"],
                    "state": member["state"],
                    "chamber": member["chamber"],
                    "committee": member["committee"],
                    "cycle": cycle,
                    "pac_receipts": result["pac_receipts"],
                    "total_receipts": result["total_receipts"],
                    "individual_itemized": result["individual_itemized"],
                })
            else:
                # Store zero row so we know we tried
                all_rows.append({
                    "name": name,
                    "fec_candidate_id": fec_id,
                    "party": member["party"],
                    "state": member["state"],
                    "chamber": member["chamber"],
                    "committee": member["committee"],
                    "cycle": cycle,
                    "pac_receipts": 0,
                    "total_receipts": 0,
                    "individual_itemized": 0,
                })
                errors += 1

            completed_pairs.add(pair_key)

            # Save progress periodically
            if api_call_count % PROGRESS_SAVE_INTERVAL == 0:
                save_progress(STEP_NAME, "completed_pairs", [list(p) for p in completed_pairs])
                save_progress(STEP_NAME, "fetched_rows", all_rows)

    # Final progress save
    save_progress(STEP_NAME, "completed_pairs", [list(p) for p in completed_pairs])
    save_progress(STEP_NAME, "fetched_rows", all_rows)

    print(f"\n  API fetching complete.")
    print(f"  Total API calls made this run: {api_call_count}")
    print(f"  Total rows collected: {len(all_rows)}")
    print(f"  Errors/empty responses: {errors}")

    # Write historical_pac_receipts.csv
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    hist_path = PROCESSED_DIR / "historical_pac_receipts.csv"
    header = "name,fec_candidate_id,party,state,chamber,committee,cycle,pac_receipts,total_receipts,individual_itemized"
    with open(hist_path, "w") as f:
        f.write(header + "\n")
        for row in all_rows:
            # Escape commas in names
            name_escaped = f'"{row["name"]}"' if "," in row["name"] else row["name"]
            f.write(f'{name_escaped},{row["fec_candidate_id"]},{row["party"]},'
                    f'{row["state"]},{row["chamber"]},{row["committee"]},'
                    f'{row["cycle"]},{row["pac_receipts"]},{row["total_receipts"]},'
                    f'{row["individual_itemized"]}\n')

    print(f"\n  Saved: {hist_path}")
    print(f"  Rows: {len(all_rows)}")

    # ---- Before/After Analysis ----
    print(f"\n{'='*60}")
    print(f"BEFORE/AFTER ANALYSIS")
    print(f"{'='*60}")

    # Group rows by fec_candidate_id
    member_cycles = {}
    for row in all_rows:
        fec_id = row["fec_candidate_id"]
        if fec_id not in member_cycles:
            member_cycles[fec_id] = []
        member_cycles[fec_id].append(row)

    summary_rows = []
    for member in members:
        fec_id = member["fec_candidate_id"]
        name = member["name"]

        # Look up committee history
        hist = committee_history.get(fec_id)
        if not hist:
            print(f"  {name}: no committee history found, skipping")
            continue

        first_year = hist["first_year"]
        cycle_data = member_cycles.get(fec_id, [])

        if not cycle_data:
            print(f"  {name}: no FEC data found, skipping")
            continue

        analysis = analyze_before_after(cycle_data, first_year)
        if analysis is None:
            continue

        summary_rows.append({
            "name": name,
            "fec_candidate_id": fec_id,
            "party": member["party"],
            "chamber": member["chamber"],
            "committee": member["committee"],
            "first_year": first_year,
            **analysis,
        })

    # Write before_after_summary.csv
    summary_path = OUTPUT_DIR / "before_after_summary.csv"
    summary_header = ("name,fec_candidate_id,party,chamber,committee,first_year,"
                      "transition_cycle,cycles_before,cycles_after,"
                      "median_pac_before,median_pac_after,mean_pac_before,mean_pac_after,pct_change_pac,"
                      "median_total_before,median_total_after,pct_change_total,"
                      "median_indiv_before,median_indiv_after,flag")

    with open(summary_path, "w") as f:
        f.write(summary_header + "\n")
        for row in summary_rows:
            name_escaped = f'"{row["name"]}"' if "," in row["name"] else row["name"]
            f.write(f'{name_escaped},{row["fec_candidate_id"]},{row["party"]},'
                    f'{row["chamber"]},{row["committee"]},{row["first_year"]},'
                    f'{row["transition_cycle"]},{row["cycles_before"]},{row["cycles_after"]},'
                    f'{row["median_pac_before"]},{row["median_pac_after"]},'
                    f'{row["mean_pac_before"]},{row["mean_pac_after"]},{row["pct_change_pac"]},'
                    f'{row["median_total_before"]},{row["median_total_after"]},{row["pct_change_total"]},'
                    f'{row["median_indiv_before"]},{row["median_indiv_after"]},{row["flag"]}\n')

    print(f"\n  Saved: {summary_path}")
    print(f"  Members analyzed: {len(summary_rows)}")

    # ---- Headline Stats ----
    print(f"\n{'='*60}")
    print(f"HEADLINE STATS")
    print(f"{'='*60}")

    # Members with before AND after data (usable for comparison)
    usable = [r for r in summary_rows if r["cycles_before"] > 0 and r["cycles_after"] > 0]
    print(f"\n  Members with before & after data: {len(usable)}")

    if usable:
        # Members whose PAC receipts increased
        with_pct = [r for r in usable if r["pct_change_pac"] != ""]
        increased = [r for r in with_pct if r["pct_change_pac"] > 0]
        total_with_data = len(with_pct)
        pct_increased = round(len(increased) / total_with_data * 100, 1) if total_with_data > 0 else 0
        print(f"  Members whose PAC receipts INCREASED: {len(increased)} of {total_with_data} ({pct_increased}%)")

        # Median/mean change
        pct_changes_pac = [r["pct_change_pac"] for r in with_pct]
        if pct_changes_pac:
            med_change = median(pct_changes_pac)
            mean_change = mean(pct_changes_pac)
            print(f"  Median change in PAC receipts: {'+' if med_change > 0 else ''}{med_change:.1f}%")
            print(f"  Mean change in PAC receipts: {'+' if mean_change > 0 else ''}{mean_change:.1f}%")

        # Control: total receipts
        pct_changes_total = [r["pct_change_total"] for r in usable if r["pct_change_total"] != ""]
        if pct_changes_total:
            med_total = median(pct_changes_total)
            print(f"  Median change in TOTAL receipts (control): {'+' if med_total > 0 else ''}{med_total:.1f}%")

        # Top 5 biggest PAC increases
        ranked = sorted(with_pct, key=lambda r: r["pct_change_pac"], reverse=True)
        print(f"\n  Top 5 biggest PAC increases:")
        for r in ranked[:5]:
            print(f"    {r['name']} ({r['party']}-{r['chamber']}): "
                  f"{'+' if r['pct_change_pac'] > 0 else ''}{r['pct_change_pac']:.1f}% "
                  f"(before: ${r['median_pac_before']:,.0f}, after: ${r['median_pac_after']:,.0f})")

    # No-data summaries
    no_before = [r for r in summary_rows if r["flag"] == "no_before_data"]
    limited_after = [r for r in summary_rows if r["flag"] == "limited_after_data"]
    if no_before:
        print(f"\n  Members with no before data (appointed before 2014): {len(no_before)}")
    if limited_after:
        print(f"  Members with limited after data (<=1 cycle): {len(limited_after)}")

    save_checkpoint(STEP_NAME, {
        "completed": True,
        "members_analyzed": len(summary_rows),
        "members_with_comparison": len(usable),
        "api_calls": api_call_count,
    })

    print(f"\n  Done. Step {STEP_NAME} complete.")


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
        # Also clear progress
        progress_path = Path(__file__).resolve().parent.parent / "data" / "checkpoints" / f"{STEP_NAME}_progress.json"
        if progress_path.exists():
            progress_path.unlink()
            print(f"  Cleared progress file: {progress_path}")
    main()
