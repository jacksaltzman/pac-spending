#!/usr/bin/env python3
"""Step 08: Generate the final markdown report and one-liners.

Reads all CSVs from output/ and produces:
- output/REPORT.md — Full analysis report
- output/one_liners.csv — Template-generated summary sentences per member

Requires: Step 07 (analysis outputs).
"""

import sys
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import OUTPUT_DIR, PRIMARY_CYCLE, SECONDARY_CYCLE
from utils.checkpoint import is_step_complete, save_checkpoint

STEP_NAME = "08_generate_report"


def load_csv(name):
    path = OUTPUT_DIR / name
    if path.exists():
        return pd.read_csv(path)
    return None


def fmt_pct(val):
    if pd.isna(val):
        return "N/A"
    return f"{val:.1f}%"


def fmt_money(val):
    if pd.isna(val) or val == 0:
        return "$0"
    if val >= 1_000_000:
        return f"${val/1_000_000:.1f}M"
    if val >= 1_000:
        return f"${val/1_000:.0f}K"
    return f"${val:,.0f}"


def member_label(row):
    """Generate 'Rep. Smith (R-MO-08)' or 'Sen. Smith (R-ID)' label."""
    chamber = row.get("chamber", "")
    prefix = "Rep." if chamber == "house" else "Sen."
    party = row.get("party", "")
    state = row.get("state", "")
    district = row.get("district")

    if chamber == "house" and pd.notna(district):
        return f"{prefix} {row['member_name']} ({party}-{state}-{int(district):02d})"
    return f"{prefix} {row['member_name']} ({party}-{state})"


def generate_one_liner(row):
    """Generate a one-line summary for a member."""
    label = member_label(row)
    pct = row.get("pct_outside", 0)
    chamber = row.get("chamber", "")

    geo_word = "district" if chamber == "house" else "state"

    top_emps = []
    for i in range(1, 4):
        emp = row.get(f"top_outside_employer_{i}", "")
        if emp and isinstance(emp, str) and emp.strip():
            top_emps.append(emp)

    top_states = []
    for i in range(1, 4):
        st = row.get(f"top_outside_state_{i}", "")
        if st and isinstance(st, str) and st.strip():
            top_states.append(st)

    line = f"{pct:.0f}% of {label}'s itemized campaign funding comes from outside their {geo_word}."

    if top_emps:
        line += f" Top outside employers: {', '.join(top_emps)}."
    elif top_states:
        line += f" Top outside states: {', '.join(top_states)}."

    return line


def generate_report():
    """Generate the full markdown report."""
    ms = load_csv(f"member_summary_{PRIMARY_CYCLE}.csv")
    ca = load_csv(f"committee_aggregate_{PRIMARY_CYCLE}.csv")
    dc = load_csv(f"dc_kstreet_breakdown_{PRIMARY_CYCLE}.csv")
    val = load_csv("validation_reconciliation.csv")
    gap = load_csv("unitemized_gap.csv")
    pac_member = load_csv(f"pac_breakdown_by_member_{PRIMARY_CYCLE}.csv")
    pac_spread = load_csv(f"top_pacs_by_committee_{PRIMARY_CYCLE}.csv")
    ms_2026 = load_csv(f"member_summary_{SECONDARY_CYCLE}.csv")

    if ms is None:
        print("ERROR: No member summary data. Run 07_analyze.py first.")
        return

    # Filter out territorial delegates for main rankings
    valid = ms[~ms["is_territorial"].fillna(False).astype(bool)].copy()
    valid = valid[valid["total_itemized_amount"] > 0].copy()
    valid = valid.sort_values("pct_outside", ascending=False)

    house = valid[valid["chamber"] == "house"].copy()
    senate = valid[valid["chamber"] == "senate"].copy()

    lines = []

    # --- Section 1: Executive Summary ---
    lines.append("# Geographic Mismatch Analysis")
    lines.append(f"# Who Really Funds America's Tax-Writing Committees?")
    lines.append("")
    lines.append(f"*Analysis generated {datetime.now().strftime('%B %d, %Y')} "
                 f"| Data: FEC {PRIMARY_CYCLE} cycle (Jan {PRIMARY_CYCLE-1} – Dec {PRIMARY_CYCLE})*")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Executive Summary")
    lines.append("")

    if not valid.empty:
        median_outside = valid["pct_outside"].median()
        mean_outside = valid["pct_outside"].mean()
        total_money = valid["total_itemized_amount"].sum()

        lines.append(f"The {len(valid)} members of the House Ways and Means Committee and "
                     f"Senate Finance Committee — the legislators who write America's tax code — "
                     f"received a **median of {median_outside:.0f}%** of their itemized individual "
                     f"campaign contributions from outside their home district or state in the "
                     f"{PRIMARY_CYCLE} election cycle.")
        lines.append("")
        lines.append(f"- **Total itemized contributions analyzed:** {fmt_money(total_money)}")
        lines.append(f"- **Mean outside funding:** {mean_outside:.1f}%")
        lines.append(f"- **Median outside funding:** {median_outside:.1f}%")

        if "pct_dc_kstreet" in valid.columns:
            dc_mean = valid["pct_dc_kstreet"].mean()
            lines.append(f"- **Mean DC/K-Street funding:** {dc_mean:.1f}%")

        if "unitemized_pct" in valid.columns and valid["unitemized_pct"].notna().any():
            gap_median = valid["unitemized_pct"].median()
            lines.append(f"- **Median unitemized gap:** {gap_median:.1f}% "
                         f"(share of total fundraising not geographically analyzable)")

    lines.append("")
    lines.append("---")
    lines.append("")

    # --- Section 2: Methodology ---
    lines.append("## Methodology")
    lines.append("")
    lines.append("**Data source:** FEC bulk individual contribution data (Schedule A), "
                 f"{PRIMARY_CYCLE} election cycle.")
    lines.append("")
    lines.append("**What's included:**")
    lines.append("- Itemized individual contributions (>$200 aggregate per cycle)")
    lines.append("- Earmarked contributions via ActBlue/WinRed (attributed to original contributor)")
    lines.append("")
    lines.append("**What's NOT included:**")
    lines.append("- Unitemized contributions (<$200) — no geographic data available")
    lines.append("- PAC contributions (analyzed separately)")
    lines.append("- Joint fundraising committee transfers")
    lines.append("- Party committee contributions")
    lines.append("- Independent expenditures / dark money")
    lines.append("")
    lines.append("**Geographic matching:** ZIP codes mapped to congressional districts "
                 "using Census Bureau ZCTA-to-CD crosswalk. ~15% of ZIPs span multiple "
                 "districts; these are assigned to the majority-population district.")
    lines.append("")
    lines.append("**DC/K-Street:** Contributions from DC-area ZIP codes (200xx–205xx) "
                 "are classified separately as a proxy for political/lobbying class donors.")
    lines.append("")
    lines.append("---")
    lines.append("")

    # --- Section 3: House Ways & Means ---
    lines.append("## House Ways and Means Committee")
    lines.append("")

    if not house.empty:
        lines.append(f"| Rank | Member | Party | District | Outside % | DC % | In-District % | Itemized Total |")
        lines.append(f"|------|--------|-------|----------|-----------|------|---------------|----------------|")

        for rank, (_, row) in enumerate(house.iterrows(), 1):
            dist = f"{row['state']}-{int(row['district']):02d}" if pd.notna(row.get("district")) else row["state"]
            lines.append(
                f"| {rank} | {row['member_name']} | {row['party']} | {dist} | "
                f"{fmt_pct(row.get('pct_outside'))} | {fmt_pct(row.get('pct_dc_kstreet'))} | "
                f"{fmt_pct(row.get('pct_in_district'))} | {fmt_money(row['total_itemized_amount'])} |"
            )

        # Plaskett footnote
        plaskett = ms[ms["member_name"].str.contains("Plaskett", na=False)]
        if not plaskett.empty:
            lines.append("")
            lines.append("*Note: Delegate Stacey Plaskett (D-VI) is excluded from rankings. "
                         "As a non-voting delegate from the U.S. Virgin Islands, virtually all "
                         "of her fundraising originates outside her jurisdiction.*")

    lines.append("")
    lines.append("---")
    lines.append("")

    # --- Section 4: Senate Finance ---
    lines.append("## Senate Finance Committee")
    lines.append("")

    if not senate.empty:
        lines.append(f"| Rank | Member | Party | State | Outside % | DC % | In-State % | Itemized Total |")
        lines.append(f"|------|--------|-------|-------|-----------|------|------------|----------------|")

        for rank, (_, row) in enumerate(senate.iterrows(), 1):
            lines.append(
                f"| {rank} | {row['member_name']} | {row['party']} | {row['state']} | "
                f"{fmt_pct(row.get('pct_outside'))} | {fmt_pct(row.get('pct_dc_kstreet'))} | "
                f"{fmt_pct(row.get('pct_in_state'))} | {fmt_money(row['total_itemized_amount'])} |"
            )

    lines.append("")
    lines.append("---")
    lines.append("")

    # --- Section 5: DC/K-Street ---
    lines.append("## DC/K-Street Analysis")
    lines.append("")

    if dc is not None and not dc.empty:
        dc_sorted = dc.sort_values("pct_dc_kstreet", ascending=False).head(20)
        lines.append("Top 20 members by DC-area contribution percentage:")
        lines.append("")
        lines.append("| Rank | Member | Party | DC % | DC Amount |")
        lines.append("|------|--------|-------|------|-----------|")

        for rank, (_, row) in enumerate(dc_sorted.iterrows(), 1):
            lines.append(
                f"| {rank} | {row['member_name']} | {row.get('party', '')} | "
                f"{fmt_pct(row['pct_dc_kstreet'])} | {fmt_money(row.get('amt_dc_kstreet', 0))} |"
            )

    lines.append("")
    lines.append("---")
    lines.append("")

    # --- Section 6: Top Employers ---
    lines.append("## Top Outside Employers")
    lines.append("")
    lines.append("Most frequently appearing employers among out-of-district/state contributions:")
    lines.append("")

    emp = load_csv(f"employer_top50_by_member_{PRIMARY_CYCLE}.csv")
    if emp is not None and not emp.empty:
        # Aggregate across all members
        emp_agg = emp.groupby("employer").agg(
            total=("total", "sum"),
            num_members=("member_name", "nunique"),
        ).sort_values("total", ascending=False).head(20)

        lines.append("| Employer | Total Outside $ | # Members Funded |")
        lines.append("|----------|----------------|-----------------|")
        for employer, row in emp_agg.iterrows():
            lines.append(f"| {employer} | {fmt_money(row['total'])} | {row['num_members']} |")

    lines.append("")
    lines.append("---")
    lines.append("")

    # --- Section 7: PAC Analysis ---
    lines.append("## PAC Analysis")
    lines.append("")

    if pac_spread is not None and not pac_spread.empty:
        lines.append("PACs contributing to the most tax-writing committee members:")
        lines.append("")
        lines.append("| PAC Name | Total Given | # Recipients |")
        lines.append("|----------|------------|-------------|")

        for _, row in pac_spread.head(20).iterrows():
            lines.append(
                f"| {row['pac_name']} | {fmt_money(row['total_given'])} | "
                f"{row['num_recipients']} |"
            )

    lines.append("")
    lines.append("---")
    lines.append("")

    # --- Section 8: Data Quality ---
    lines.append("## Data Quality & Caveats")
    lines.append("")

    if val is not None:
        validated = val[val["validation_status"].isin(["ok", "discrepancy"])]
        if not validated.empty and "capture_rate_pct" in validated.columns:
            lines.append(f"- **Members validated:** {len(validated)}")
            lines.append(f"- **Mean capture rate:** {validated['capture_rate_pct'].mean():.1f}% "
                         f"of FEC itemized totals")
            disc = validated[validated["validation_status"] == "discrepancy"]
            lines.append(f"- **Members with >5% discrepancy:** {len(disc)}")

    lines.append("")
    lines.append("**Key limitations:**")
    lines.append("1. Only itemized contributions (>$200) are geographically analyzable")
    lines.append("2. ~15% of ZIP codes span multiple congressional districts (assigned to majority-area district)")
    lines.append("3. Employer names are normalized but not perfectly standardized")
    lines.append("4. PAC contributions cannot be geographically classified")
    lines.append("5. Joint fundraising committee transfers are not captured")
    lines.append("")
    lines.append("---")
    lines.append("")

    # --- Section 9: 2026 Comparison ---
    if ms_2026 is not None and not ms_2026.empty:
        valid_2026 = ms_2026[
            (~ms_2026["is_territorial"].fillna(False).astype(bool)) &
            (ms_2026["total_itemized_amount"] > 0)
        ]

        if not valid_2026.empty:
            lines.append(f"## {SECONDARY_CYCLE} Cycle Comparison (Partial)")
            lines.append("")
            lines.append(f"*The {SECONDARY_CYCLE} cycle is still in progress. "
                         f"Data shown is partial.*")
            lines.append("")
            lines.append(f"| Member | {PRIMARY_CYCLE} Outside % | {SECONDARY_CYCLE} Outside % | Change |")
            lines.append(f"|--------|---------------------|---------------------|--------|")

            merged = valid.merge(
                valid_2026[["member_name", "pct_outside"]],
                on="member_name", suffixes=("_primary", "_secondary"),
                how="inner",
            )
            for _, row in merged.iterrows():
                p = row.get("pct_outside_primary", row.get("pct_outside", 0))
                s = row["pct_outside_secondary"]
                change = s - p
                sign = "+" if change > 0 else ""
                lines.append(
                    f"| {row['member_name']} | {fmt_pct(p)} | {fmt_pct(s)} | {sign}{change:.1f}pp |"
                )

            lines.append("")
            lines.append("---")
            lines.append("")

    # --- Section 10: One-Liners ---
    lines.append("## Member One-Liners")
    lines.append("")

    one_liner_rows = []
    for _, row in valid.iterrows():
        liner = generate_one_liner(row)
        lines.append(f"- {liner}")
        one_liner_rows.append({
            "member_name": row["member_name"],
            "one_liner": liner,
        })

    # Save one-liners CSV
    one_liner_df = pd.DataFrame(one_liner_rows)
    one_liner_path = OUTPUT_DIR / "one_liners.csv"
    one_liner_df.to_csv(one_liner_path, index=False)

    # Write report
    report_text = "\n".join(lines)
    report_path = OUTPUT_DIR / "REPORT.md"
    report_path.write_text(report_text)

    print(f"Saved report: {report_path}")
    print(f"Saved one-liners: {one_liner_path}")
    print(f"Report length: {len(lines)} lines")

    return report_path


def run():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    report_path = generate_report()

    save_checkpoint(STEP_NAME, {
        "report_generated": report_path is not None,
    })


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
    run()
