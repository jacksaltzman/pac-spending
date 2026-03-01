#!/usr/bin/env python3
"""
Script 12: Leadership vs. Rank-and-File Analysis

Determines whether committee chairs, subcommittee chairs, and ranking members
receive disproportionately more PAC money and outside funding than rank-and-file
committee members. Produces tier comparisons, per-PAC targeting analysis, and
subcommittee-sector alignment data.

Usage:
    python scripts/12_leadership_analysis.py
"""

import json
import csv
import statistics
from pathlib import Path
from collections import defaultdict

# ── Paths ──────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
WEBAPP_DATA = PROJECT_ROOT / "webapp" / "data"
OUTPUT_DIR = PROJECT_ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def load_json(path):
    with open(path) as f:
        return json.load(f)


def safe_median(values):
    """Return median of non-None, non-NaN values, or None if empty."""
    clean = [v for v in values if v is not None]
    return statistics.median(clean) if clean else None


def safe_mean(values):
    """Return mean of non-None values, or None if empty."""
    clean = [v for v in values if v is not None]
    return statistics.mean(clean) if clean else None


def pct_diff(a, b):
    """Percent difference of a relative to b. Returns None if b is 0 or None."""
    if b is None or b == 0 or a is None:
        return None
    return round(((a - b) / b) * 100, 1)


# ── Main ───────────────────────────────────────────────────────────────

def main():
    print("Loading data...")

    members = load_json(WEBAPP_DATA / "members.json")
    leadership = load_json(CONFIG_DIR / "committee_leadership.json")
    pac_spread = load_json(WEBAPP_DATA / "pac_spread.json")
    pacs_per_member = load_json(WEBAPP_DATA / "pacs.json")
    pac_sectors = load_json(CONFIG_DIR / "pac_sectors.json")

    member_tiers = leadership["member_tiers"]
    sector_mapping = leadership["subcommittee_sector_mapping"]

    # ── Enrich members with tier data ──────────────────────────────────

    for m in members:
        name = m["member_name"]
        if name in member_tiers:
            m["tier"] = member_tiers[name]["tier"]
            m["leadership_title"] = member_tiers[name]["title"]
            m["subcommittee"] = member_tiers[name].get("subcommittee")
        else:
            m["tier"] = 3
            m["leadership_title"] = "Rank-and-File"
            m["subcommittee"] = None

    # Filter to non-territorial members with PAC data
    active = [m for m in members if not m.get("is_territorial", False)]
    active_with_pac = [m for m in active if m.get("fec_pac_contributions") is not None]

    print(f"  {len(active)} active members, {len(active_with_pac)} with PAC data")

    # ── 1. Tier Comparison ─────────────────────────────────────────────

    print("\n=== TIER COMPARISON ===")

    tier_labels = {1: "Full Committee Leadership", 2: "Subcommittee Leadership", 3: "Rank-and-File"}

    def compute_tier_stats(member_list, label_prefix=""):
        """Compute tier-level statistics for a list of members."""
        results = []
        for tier_num in [1, 2, 3]:
            tier_members = [m for m in member_list if m["tier"] == tier_num and m.get("fec_pac_contributions") is not None]
            if not tier_members:
                continue

            pac_values = [m["fec_pac_contributions"] for m in tier_members]
            receipt_values = [m.get("fec_total_receipts") for m in tier_members if m.get("fec_total_receipts") is not None]
            outside_values = [m["pct_outside"] for m in tier_members]
            dc_values = [m["pct_dc_kstreet"] for m in tier_members]

            row = {
                "tier": tier_labels[tier_num],
                "count": len(tier_members),
                "median_pac": round(safe_median(pac_values) or 0),
                "mean_pac": round(safe_mean(pac_values) or 0),
                "median_receipts": round(safe_median(receipt_values) or 0),
                "mean_receipts": round(safe_mean(receipt_values) or 0),
                "median_pct_outside": round(safe_median(outside_values) or 0, 1),
                "median_pct_dc": round(safe_median(dc_values) or 0, 1),
            }
            results.append(row)
            print(f"  {label_prefix}{tier_labels[tier_num]} (n={row['count']}): "
                  f"median PAC ${row['median_pac']:,}, "
                  f"median outside {row['median_pct_outside']}%")

        # Compute premiums vs rank-and-file
        rf = next((r for r in results if r["tier"] == "Rank-and-File"), None)
        if rf and rf["median_pac"] > 0:
            for r in results:
                r["premium_vs_rank_file_pct"] = pct_diff(r["median_pac"], rf["median_pac"])
        else:
            for r in results:
                r["premium_vs_rank_file_pct"] = None

        return results

    # Combined
    print("\n  Combined (both chambers):")
    combined_stats = compute_tier_stats(active, "  ")

    # House only
    house_members = [m for m in active if m.get("chamber") == "house"]
    print("\n  House Ways & Means:")
    house_stats = compute_tier_stats(house_members, "  House ")

    # Senate only
    senate_members = [m for m in active if m.get("chamber") == "senate"]
    print("\n  Senate Finance:")
    senate_stats = compute_tier_stats(senate_members, "  Senate ")

    # Write tier comparison CSV
    tier_csv_path = OUTPUT_DIR / "leadership_tier_comparison.csv"
    all_tier_rows = []
    for chamber_label, stats in [("Combined", combined_stats), ("House", house_stats), ("Senate", senate_stats)]:
        for row in stats:
            all_tier_rows.append({"chamber": chamber_label, **row})

    with open(tier_csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["chamber", "tier", "count", "median_pac", "mean_pac",
                                                "median_receipts", "mean_receipts", "median_pct_outside",
                                                "median_pct_dc", "premium_vs_rank_file_pct"])
        writer.writeheader()
        writer.writerows(all_tier_rows)
    print(f"\n  Wrote {tier_csv_path}")

    # ── 2. Per-PAC Targeting Analysis ──────────────────────────────────

    print("\n=== PER-PAC TARGETING ===")

    # Build name → tier lookup
    name_tier = {}
    for m in active:
        name_tier[m["member_name"]] = m["tier"]

    # Build name → PAC total from per-member pacs data
    member_pac_by_pac = defaultdict(lambda: defaultdict(float))
    for entry in pacs_per_member:
        member_pac_by_pac[entry["pac_cmte_id"]][entry["member_name"]] += entry["total"]

    # For top 20 PACs by reach, compute avg giving to leadership vs rank-and-file
    top_pacs_by_reach = sorted(pac_spread, key=lambda p: p["num_recipients"], reverse=True)[:20]

    pac_targeting_rows = []
    for pac in top_pacs_by_reach:
        cmte_id = pac["pac_cmte_id"]
        pac_member_amounts = member_pac_by_pac.get(cmte_id, {})

        leadership_amounts = []  # Tier 1 + 2
        rankfile_amounts = []    # Tier 3

        for member_name, amount in pac_member_amounts.items():
            tier = name_tier.get(member_name)
            if tier is None:
                continue
            if tier in (1, 2):
                leadership_amounts.append(amount)
            else:
                rankfile_amounts.append(amount)

        avg_leadership = safe_mean(leadership_amounts) if leadership_amounts else None
        avg_rankfile = safe_mean(rankfile_amounts) if rankfile_amounts else None
        premium = pct_diff(avg_leadership, avg_rankfile)

        row = {
            "pac_cmte_id": cmte_id,
            "pac_name": pac["pac_name"],
            "sector": pac.get("sector", ""),
            "total_given": pac["total_given"],
            "num_recipients": pac["num_recipients"],
            "leadership_recipients": len(leadership_amounts),
            "rankfile_recipients": len(rankfile_amounts),
            "avg_to_leadership": round(avg_leadership) if avg_leadership else None,
            "avg_to_rankfile": round(avg_rankfile) if avg_rankfile else None,
            "leadership_premium_pct": premium,
        }
        pac_targeting_rows.append(row)

        if avg_leadership and avg_rankfile:
            print(f"  {pac['pac_name'][:50]}: "
                  f"avg ${round(avg_leadership):,} to leaders vs ${round(avg_rankfile):,} to rank-and-file "
                  f"({'+' if premium and premium > 0 else ''}{premium}%)")

    # Write PAC targeting CSV
    pac_targeting_csv = OUTPUT_DIR / "leadership_pac_targeting.csv"
    with open(pac_targeting_csv, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["pac_cmte_id", "pac_name", "sector", "total_given",
                                                "num_recipients", "leadership_recipients", "rankfile_recipients",
                                                "avg_to_leadership", "avg_to_rankfile", "leadership_premium_pct"])
        writer.writeheader()
        writer.writerows(pac_targeting_rows)
    print(f"\n  Wrote {pac_targeting_csv}")

    # ── 3. Subcommittee-Sector Alignment ───────────────────────────────

    print("\n=== SUBCOMMITTEE-SECTOR ALIGNMENT ===")

    # Build per-member sector totals from pacs data
    member_sector_totals = defaultdict(lambda: defaultdict(float))
    member_pac_total = defaultdict(float)
    for entry in pacs_per_member:
        sector = entry.get("sector", "")
        if sector:
            member_sector_totals[entry["member_name"]][sector] += entry["total"]
        member_pac_total[entry["member_name"]] += entry["total"]

    # Compute committee-wide average sector shares
    all_sector_totals = defaultdict(float)
    total_pac_across_all = 0
    for m in active:
        name = m["member_name"]
        for sector, amt in member_sector_totals[name].items():
            all_sector_totals[sector] += amt
        total_pac_across_all += member_pac_total.get(name, 0)

    committee_sector_pcts = {}
    for sector, total in all_sector_totals.items():
        committee_sector_pcts[sector] = round((total / total_pac_across_all * 100), 1) if total_pac_across_all > 0 else 0

    # For each subcommittee chair/ranking with a subcommittee, compute sector alignment
    alignment_rows = []
    for m in active:
        if m["tier"] != 2 or not m.get("subcommittee"):
            continue

        subcommittee = m["subcommittee"]
        relevant_sectors = sector_mapping.get(subcommittee, [])
        if not relevant_sectors:
            continue

        name = m["member_name"]
        member_total = member_pac_total.get(name, 0)
        if member_total == 0:
            continue

        # Sum the relevant sector amounts for this member
        relevant_amount = sum(member_sector_totals[name].get(s, 0) for s in relevant_sectors)
        member_sector_pct = round((relevant_amount / member_total * 100), 1)

        # Committee average for same sectors
        committee_relevant_total = sum(all_sector_totals.get(s, 0) for s in relevant_sectors)
        committee_avg_pct = round((committee_relevant_total / total_pac_across_all * 100), 1) if total_pac_across_all > 0 else 0

        row = {
            "subcommittee": subcommittee,
            "member": name,
            "title": m["leadership_title"],
            "party": m.get("party", ""),
            "state": m.get("state", ""),
            "chamber": m.get("chamber", ""),
            "relevant_sectors": ", ".join(relevant_sectors),
            "member_sector_pac_pct": member_sector_pct,
            "committee_avg_sector_pac_pct": committee_avg_pct,
            "premium_pct": round(member_sector_pct - committee_avg_pct, 1),
            "relevant_pac_amount": round(relevant_amount),
            "total_pac_amount": round(member_total),
        }
        alignment_rows.append(row)

        print(f"  {name} ({subcommittee}): "
              f"{member_sector_pct}% from {', '.join(relevant_sectors)} "
              f"(vs {committee_avg_pct}% committee avg, "
              f"{'+'if row['premium_pct'] > 0 else ''}{row['premium_pct']}pp)")

    # Sort by premium descending
    alignment_rows.sort(key=lambda r: r["premium_pct"], reverse=True)

    # Write alignment CSV
    alignment_csv = OUTPUT_DIR / "leadership_subcommittee_sector_match.csv"
    with open(alignment_csv, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["subcommittee", "member", "title", "party", "state", "chamber",
                                                "relevant_sectors", "member_sector_pac_pct",
                                                "committee_avg_sector_pac_pct", "premium_pct",
                                                "relevant_pac_amount", "total_pac_amount"])
        writer.writeheader()
        writer.writerows(alignment_rows)
    print(f"\n  Wrote {alignment_csv}")

    # ── 4. Generate webapp JSON ────────────────────────────────────────

    print("\n=== GENERATING WEBAPP JSON ===")

    # Compute headline stats
    combined_rf = next((r for r in combined_stats if r["tier"] == "Rank-and-File"), None)
    combined_sub = next((r for r in combined_stats if r["tier"] == "Subcommittee Leadership"), None)
    combined_full = next((r for r in combined_stats if r["tier"] == "Full Committee Leadership"), None)

    # Find most targeted chair (highest PAC total among Tier 1+2)
    leadership_members = [m for m in active_with_pac if m["tier"] in (1, 2)]
    most_targeted = max(leadership_members, key=lambda m: m["fec_pac_contributions"]) if leadership_members else None

    # Find most sector-aligned subcommittee
    most_aligned = alignment_rows[0] if alignment_rows else None

    # Average leadership premium across top PACs that have data
    pac_premiums = [r["leadership_premium_pct"] for r in pac_targeting_rows if r["leadership_premium_pct"] is not None]
    avg_pac_premium = round(safe_mean(pac_premiums), 1) if pac_premiums else None

    webapp_data = {
        "tier_comparison": {
            "house": house_stats,
            "senate": senate_stats,
            "combined": combined_stats,
        },
        "pac_targeting": pac_targeting_rows,
        "subcommittee_sector_alignment": [
            {
                "subcommittee": r["subcommittee"],
                "member": r["member"],
                "title": r["title"],
                "party": r["party"],
                "state": r["state"],
                "chamber": r["chamber"],
                "relevant_sectors": r["relevant_sectors"],
                "member_sector_pac_pct": r["member_sector_pac_pct"],
                "committee_avg_sector_pac_pct": r["committee_avg_sector_pac_pct"],
                "premium_pct": r["premium_pct"],
            }
            for r in alignment_rows
        ],
        "headline": {
            "subcommittee_leadership_premium_pct": combined_sub["premium_vs_rank_file_pct"] if combined_sub else None,
            "full_committee_premium_pct": combined_full["premium_vs_rank_file_pct"] if combined_full else None,
            "most_targeted_leader": most_targeted["member_name"] if most_targeted else None,
            "most_targeted_leader_pac": round(most_targeted["fec_pac_contributions"]) if most_targeted else None,
            "most_sector_aligned_subcommittee": most_aligned["subcommittee"] if most_aligned else None,
            "most_sector_aligned_member": most_aligned["member"] if most_aligned else None,
            "most_sector_aligned_premium": most_aligned["premium_pct"] if most_aligned else None,
            "avg_pac_leadership_premium_pct": avg_pac_premium,
        },
        "member_leadership_roles": {
            name: {
                "tier": info["tier"],
                "title": info["title"],
                "subcommittee": info.get("subcommittee"),
            }
            for name, info in member_tiers.items()
        },
    }

    webapp_json_path = WEBAPP_DATA / "leadership_analysis.json"
    with open(webapp_json_path, "w") as f:
        json.dump(webapp_data, f, indent=2)
    print(f"  Wrote {webapp_json_path}")

    # ── Summary ────────────────────────────────────────────────────────

    print("\n" + "=" * 60)
    print("HEADLINE FINDINGS")
    print("=" * 60)

    if combined_sub and combined_rf:
        print(f"\n  Subcommittee chairs/ranking members receive "
              f"{combined_sub['premium_vs_rank_file_pct']}% more PAC money "
              f"than rank-and-file members")
        print(f"  (median ${combined_sub['median_pac']:,} vs ${combined_rf['median_pac']:,})")

    if combined_full and combined_rf:
        print(f"\n  Full committee leaders receive "
              f"{combined_full['premium_vs_rank_file_pct']}% more PAC money "
              f"than rank-and-file members")
        print(f"  (median ${combined_full['median_pac']:,} vs ${combined_rf['median_pac']:,})")

    if most_aligned:
        print(f"\n  Most sector-aligned: {most_aligned['member']} "
              f"({most_aligned['subcommittee']}) — "
              f"{most_aligned['member_sector_pac_pct']}% of PAC money from relevant sectors "
              f"(vs {most_aligned['committee_avg_sector_pac_pct']}% committee avg)")

    if avg_pac_premium:
        print(f"\n  On average, the top 20 PACs by reach give {avg_pac_premium}% more "
              f"per member to leadership than to rank-and-file")

    print(f"\n  Tier 1: {len([m for m in active if m['tier'] == 1])} members")
    print(f"  Tier 2: {len([m for m in active if m['tier'] == 2])} members")
    print(f"  Tier 3: {len([m for m in active if m['tier'] == 3])} members")
    print(f"  Total:  {len(active)} active members")

    print("\nDone!")


if __name__ == "__main__":
    main()
