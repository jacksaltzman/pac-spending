#!/usr/bin/env python3
"""Step 12: Cross-committee PAC comparison.

Compares median PAC receipts across House committees using
FEC all-candidates summary data (webl24.txt).
"""

import json
import sys
import statistics
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import CONFIG_DIR, OUTPUT_DIR

WEBL_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "webl_2024" / "webl24.txt"
MEMBERS_PATH = CONFIG_DIR / "members.json"


def parse_webl24(incumbents_only=False):
    """Parse webl24.txt into dict keyed by candidate name."""
    candidates = {}
    with open(WEBL_PATH) as f:
        for line in f:
            fields = line.strip().split("|")
            if len(fields) < 26:
                continue
            if not fields[0].startswith("H"):
                continue
            if incumbents_only and fields[2] != "I":
                continue
            name = fields[1].upper().strip()
            try:
                pac = float(fields[25]) if fields[25] else 0
                receipts = float(fields[5]) if fields[5] else 0
            except ValueError:
                continue
            candidates[name] = {
                "can_id": fields[0],
                "name": name,
                "party": fields[4],
                "state": fields[18],
                "pac": pac,
                "receipts": receipts,
            }
    return candidates


def match_roster(roster_names, candidates):
    """Match roster names against webl24 candidates."""
    matched = []
    unmatched = []
    for name in roster_names:
        name_upper = name.upper().strip()
        if name_upper in candidates:
            matched.append(candidates[name_upper])
            continue
        # Fuzzy: match by last name prefix
        last = name_upper.split(",")[0]
        found = [c for n, c in candidates.items() if n.startswith(last + ",")]
        if len(found) == 1:
            matched.append(found[0])
        else:
            unmatched.append(name)
    return matched, unmatched


def get_ways_and_means_entries(candidates_all):
    """Get entries for Ways & Means members from members.json (nested structure)."""
    with open(MEMBERS_PATH) as f:
        members_data = json.load(f)
    # members.json has nested structure: {"house_ways_and_means": {"members": [...]}}
    wm_members = members_data.get("house_ways_and_means", {}).get("members", [])
    wm_ids = {
        m["fec_candidate_id"]
        for m in wm_members
        if m.get("fec_candidate_id")
    }
    return [c for c in candidates_all.values() if c["can_id"] in wm_ids]


def compute_stats(entries):
    """Compute median/mean PAC and receipts."""
    pacs = [e["pac"] for e in entries]
    receipts = [e["receipts"] for e in entries]
    if not pacs:
        return {"count": 0, "median_pac": 0, "mean_pac": 0, "median_receipts": 0, "mean_receipts": 0}
    return {
        "count": len(pacs),
        "median_pac": round(statistics.median(pacs)),
        "mean_pac": round(statistics.mean(pacs)),
        "median_receipts": round(statistics.median(receipts)),
        "mean_receipts": round(statistics.mean(receipts)),
    }


def main():
    print(f"\n{'='*60}")
    print("Step 12: Cross-Committee PAC Comparison")
    print(f"{'='*60}\n")

    # Parse all House candidates (for matching committee members including freshmen)
    candidates_all = parse_webl24(incumbents_only=False)
    print(f"  Parsed {len(candidates_all)} House candidates from webl24.txt")

    # Also parse incumbents only (for baseline)
    candidates_inc = parse_webl24(incumbents_only=True)
    print(f"  Of which {len(candidates_inc)} are incumbents")

    results = []

    # Ways & Means
    wm_entries = get_ways_and_means_entries(candidates_all)
    wm_stats = compute_stats(wm_entries)
    wm_stats["committee"] = "Ways & Means"
    results.append(wm_stats)
    print(f"\n  Ways & Means: {wm_stats['count']} members, median PAC = ${wm_stats['median_pac']:,}")

    # Comparison committees
    roster_path = CONFIG_DIR / "comparison_committees.json"
    with open(roster_path) as f:
        rosters = json.load(f)

    for committee, info in rosters["committees"].items():
        matched, unmatched = match_roster(info["members"], candidates_all)
        stats = compute_stats(matched)
        stats["committee"] = committee
        results.append(stats)
        match_rate = len(matched) / len(info["members"]) * 100 if info["members"] else 0
        print(f"  {committee}: {len(matched)}/{len(info['members'])} matched ({match_rate:.0f}%), "
              f"median PAC = ${stats['median_pac']:,}")
        if unmatched:
            print(f"    Unmatched: {', '.join(unmatched[:5])}")

    # All incumbents baseline
    all_stats = compute_stats(list(candidates_inc.values()))
    all_stats["committee"] = "All House Incumbents"
    results.append(all_stats)
    print(f"  All House Incumbents: {all_stats['count']} members, median PAC = ${all_stats['median_pac']:,}")

    # Output CSV
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(results)
    cols = ["committee", "count", "median_pac", "mean_pac", "median_receipts", "mean_receipts"]
    df = df[cols]
    df.to_csv(OUTPUT_DIR / "committee_comparison.csv", index=False)
    print(f"\n  Saved: output/committee_comparison.csv")

    # Headlines
    wm_med = wm_stats["median_pac"]
    all_med = all_stats["median_pac"]
    print(f"\n{'='*60}")
    print("HEADLINES")
    print(f"{'='*60}")
    print(f"  Ways & Means median PAC: ${wm_med:,}")
    print(f"  All Incumbents median PAC: ${all_med:,}")
    print(f"  Premium vs all incumbents: +{((wm_med - all_med) / all_med * 100):.0f}%")
    for r in results:
        if r["committee"] not in ("Ways & Means", "All House Incumbents"):
            other_med = r["median_pac"]
            diff = ((wm_med - other_med) / other_med * 100) if other_med else 0
            print(f"  vs {r['committee']}: ${other_med:,} (W&M is +{diff:.0f}% more)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
