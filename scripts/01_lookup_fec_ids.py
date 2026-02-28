#!/usr/bin/env python3
"""Step 01: Look up FEC candidate and committee IDs for all members.

For each member in members.json, queries the FEC API to find their
candidate ID and principal campaign committee ID. These committee IDs
are what appear in the bulk contribution data files.

Requires: FEC_API_KEY environment variable set.
Outputs: Updated members.json + data/processed/member_fec_ids.csv
"""

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.config import (
    MEMBERS_FILE, PROCESSED_DIR, PRIMARY_CYCLE, SECONDARY_CYCLE,
)
from utils.fec_api import FECClient
from utils.checkpoint import (
    is_step_complete, save_checkpoint, load_progress, save_progress,
)

STEP_NAME = "01_lookup_fec_ids"


def load_members():
    with open(MEMBERS_FILE) as f:
        return json.load(f)


def save_members(data):
    with open(MEMBERS_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def match_candidate(client, member, chamber):
    """Search FEC API for a member and return best candidate match."""
    office = "H" if chamber == "house" else "S"
    name = member["name"]
    state = member["state"]

    # Search the primary cycle first
    results = client.search_candidates(name, state, office, cycle=PRIMARY_CYCLE)

    if not results:
        # Try secondary cycle
        results = client.search_candidates(name, state, office, cycle=SECONDARY_CYCLE)

    if not results:
        return None, None, []

    # For House members, also filter on district
    if chamber == "house" and member.get("district") is not None:
        district_str = str(member["district"]).zfill(2)
        district_matches = [
            r for r in results
            if r.get("district") == district_str
        ]
        if district_matches:
            results = district_matches

    # Pick the first result (most relevant by FEC ranking)
    best = results[0]
    candidate_id = best.get("candidate_id")

    # Get principal campaign committee
    principal_cmte_id = None
    principal_committees = best.get("principal_committees", [])
    if principal_committees:
        # Prefer the committee with the most recent cycle
        principal_cmte_id = principal_committees[0].get("committee_id")

    return candidate_id, principal_cmte_id, results


def run():
    if is_step_complete(STEP_NAME):
        print(f"Step {STEP_NAME} already complete. Use --force to re-run.")
        return

    client = FECClient()
    members_data = load_members()
    progress = load_progress(STEP_NAME)
    completed_names = set(progress.get("completed", []))

    all_rows = []
    ambiguous = []
    not_found = []

    for committee_key, committee_info in members_data.items():
        chamber = committee_info["chamber"]
        print(f"\n{'='*60}")
        print(f"Processing {committee_info['committee_name']} ({chamber})")
        print(f"{'='*60}")

        for member in committee_info["members"]:
            name = member["name"]

            # Skip if already has IDs (from a previous partial run)
            if member.get("fec_candidate_id") and member.get("principal_committee_id"):
                print(f"  [skip] {name} — already has IDs")
                all_rows.append({
                    "name": name,
                    "party": member["party"],
                    "state": member["state"],
                    "district": member.get("district"),
                    "chamber": chamber,
                    "committee": committee_key,
                    "fec_candidate_id": member["fec_candidate_id"],
                    "principal_committee_id": member["principal_committee_id"],
                    "match_status": "previously_set",
                })
                continue

            if name in completed_names:
                print(f"  [skip] {name} — completed in previous run")
                continue

            print(f"  Looking up: {name} ({member['state']})...", end=" ")

            candidate_id, principal_cmte_id, results = match_candidate(
                client, member, chamber
            )

            if candidate_id is None:
                print("NOT FOUND")
                not_found.append(name)
                member["fec_candidate_id"] = None
                member["principal_committee_id"] = None
                all_rows.append({
                    "name": name,
                    "party": member["party"],
                    "state": member["state"],
                    "district": member.get("district"),
                    "chamber": chamber,
                    "committee": committee_key,
                    "fec_candidate_id": None,
                    "principal_committee_id": None,
                    "match_status": "not_found",
                })
            else:
                member["fec_candidate_id"] = candidate_id
                member["principal_committee_id"] = principal_cmte_id

                status = "matched"
                if len(results) > 1:
                    status = "ambiguous"
                    ambiguous.append((name, [(r["candidate_id"], r.get("name")) for r in results[:5]]))

                print(f"{candidate_id} / {principal_cmte_id}" +
                      (f" (AMBIGUOUS: {len(results)} results)" if status == "ambiguous" else ""))

                all_rows.append({
                    "name": name,
                    "party": member["party"],
                    "state": member["state"],
                    "district": member.get("district"),
                    "chamber": chamber,
                    "committee": committee_key,
                    "fec_candidate_id": candidate_id,
                    "principal_committee_id": principal_cmte_id,
                    "match_status": status,
                })

            # Save progress incrementally
            completed_names.add(name)
            if len(completed_names) % 10 == 0:
                save_members(members_data)
                save_progress(STEP_NAME, "completed", list(completed_names))

    # Final save
    save_members(members_data)

    # Save CSV
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(all_rows)
    csv_path = PROCESSED_DIR / "member_fec_ids.csv"
    df.to_csv(csv_path, index=False)
    print(f"\nSaved {len(df)} members to {csv_path}")

    # Report issues
    if not_found:
        print(f"\n⚠ NOT FOUND ({len(not_found)}):")
        for name in not_found:
            print(f"    - {name}")
        print("  → Look up manually at https://www.fec.gov/data/candidates/")

    if ambiguous:
        print(f"\n⚠ AMBIGUOUS MATCHES ({len(ambiguous)}):")
        for name, candidates in ambiguous:
            print(f"    - {name}:")
            for cid, cname in candidates:
                print(f"        {cid}: {cname}")
        print("  → Please verify the first match is correct in members.json")

    matched = sum(1 for r in all_rows if r["match_status"] in ("matched", "previously_set"))
    print(f"\nSummary: {matched} matched, {len(ambiguous)} ambiguous, {len(not_found)} not found")

    save_checkpoint(STEP_NAME, {
        "total_members": len(all_rows),
        "matched": matched,
        "ambiguous": len(ambiguous),
        "not_found": len(not_found),
    })


if __name__ == "__main__":
    if "--force" in sys.argv:
        from utils.checkpoint import clear_checkpoint
        clear_checkpoint(STEP_NAME)
    run()
