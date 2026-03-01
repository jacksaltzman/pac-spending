#!/usr/bin/env python3
"""
Step 13: Voting Records & Alignment Scores

Pulls roll-call votes for all tracked members, tags tax-relevant votes,
and computes alignment scores against top funding sectors.

Data sources:
  - Congress.gov API (House roll call votes, 118th+ Congress)
  - senate.gov XML (Senate roll call votes)
  - unitedstates/congress-legislators (FEC → Bioguide ID crosswalk)

Requires:
  - CONGRESS_API_KEY env var (free: https://api.congress.gov/sign-up/)

Outputs:
  - output/member_votes.json        — full vote records per member
  - output/tax_votes_tagged.json    — tax-relevant votes with sector positions
  - output/member_alignment_scores.csv — alignment scorecard
"""

import json
import os
import sys
import time
import csv
from pathlib import Path
from xml.etree import ElementTree

import requests

# --- Paths ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
OUTPUT_DIR = PROJECT_ROOT / "output"
DATA_DIR = PROJECT_ROOT / "data"
CHECKPOINT_DIR = DATA_DIR / "checkpoints"

MEMBERS_FILE = CONFIG_DIR / "members.json"
SECTOR_POSITIONS_FILE = CONFIG_DIR / "vote_sector_positions.json"

CONGRESS_API_KEY = os.environ.get("CONGRESS_API_KEY", "")
CONGRESS_API_BASE = "https://api.congress.gov/v3"
CONGRESS_API_DELAY = 0.8  # seconds between requests (5000/hr limit)

LEGISLATORS_URL = "https://theunitedstates.io/congress-legislators/legislators-current.json"
LEGISLATORS_HISTORICAL_URL = "https://theunitedstates.io/congress-legislators/legislators-historical.json"

# 118th Congress = 2023-2024, 119th = 2025-2026
TARGET_CONGRESSES = [118, 119]

TAX_KEYWORDS = [
    "tax", "revenue", "tariff", "irs", "deduction", "credit",
    "deficit", "budget", "appropriation", "fiscal", "excise",
    "estate tax", "capital gains", "corporate tax", "income tax",
    "ways and means", "finance committee",
]


# ── Step 1: FEC → Bioguide crosswalk ──────────────────────────


def build_fec_to_bioguide() -> dict[str, str]:
    """Download congress-legislators and build FEC ID → Bioguide ID map."""
    print("  Downloading congress-legislators crosswalk...")
    fec_to_bio: dict[str, str] = {}

    for url in [LEGISLATORS_URL, LEGISLATORS_HISTORICAL_URL]:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        legislators = resp.json()
        for leg in legislators:
            bioguide = leg.get("id", {}).get("bioguide", "")
            fec_ids = leg.get("id", {}).get("fec", [])
            for fec_id in fec_ids:
                fec_to_bio[fec_id] = bioguide

    print(f"  Crosswalk: {len(fec_to_bio)} FEC IDs mapped")
    return fec_to_bio


def load_members() -> list[dict]:
    """Load tracked members from config."""
    with open(MEMBERS_FILE) as f:
        config = json.load(f)

    members = []
    for committee_key, committee in config.items():
        chamber = committee.get("chamber", "")
        for m in committee.get("members", []):
            members.append({
                "name": m["name"],
                "party": m["party"],
                "state": m["state"],
                "district": m.get("district"),
                "chamber": chamber,
                "committee": committee_key,
                "fec_candidate_id": m.get("fec_candidate_id", ""),
                "bioguide_id": "",  # filled in by crosswalk
            })
    return members


def map_bioguide_ids(members: list[dict], crosswalk: dict[str, str]) -> int:
    """Assign bioguide_id to each member using FEC→Bioguide crosswalk."""
    mapped = 0
    for m in members:
        fec_id = m["fec_candidate_id"]
        if fec_id in crosswalk:
            m["bioguide_id"] = crosswalk[fec_id]
            mapped += 1
        else:
            print(f"  WARNING: No bioguide for {m['name']} (FEC: {fec_id})")
    return mapped


# ── Step 2: Fetch House votes via Congress.gov API ────────────


def congress_api_get(endpoint: str, params: dict | None = None) -> dict:
    """Make a Congress.gov API request with rate limiting."""
    if not CONGRESS_API_KEY:
        raise RuntimeError("CONGRESS_API_KEY env var not set. Get one at https://api.congress.gov/sign-up/")

    url = f"{CONGRESS_API_BASE}/{endpoint}"
    p = {"api_key": CONGRESS_API_KEY, "format": "json", **(params or {})}
    time.sleep(CONGRESS_API_DELAY)
    resp = requests.get(url, params=p, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_house_votes(congress: int) -> list[dict]:
    """Fetch all House roll call votes for a Congress via Congress.gov API."""
    print(f"  Fetching House votes for {congress}th Congress...")
    all_votes = []

    for session in [1, 2]:
        offset = 0
        while True:
            try:
                data = congress_api_get(
                    f"house-vote/{congress}/{session}",
                    {"limit": 250, "offset": offset},
                )
            except requests.HTTPError as e:
                if e.response is not None and e.response.status_code == 404:
                    break  # session doesn't exist yet
                raise

            votes = data.get("votes", [])
            if not votes:
                break

            for v in votes:
                all_votes.append({
                    "congress": congress,
                    "chamber": "house",
                    "session": session,
                    "roll_call": v.get("rollCallNumber") or v.get("number"),
                    "date": v.get("date", ""),
                    "question": v.get("question", ""),
                    "result": v.get("result", ""),
                    "title": v.get("description") or v.get("title", ""),
                    "bill": v.get("bill", {}),
                    "vote_url": v.get("url", ""),
                })
            offset += 250
            if len(votes) < 250:
                break

    print(f"    Found {len(all_votes)} House roll calls")
    return all_votes


def fetch_house_vote_positions(congress: int, session: int, roll_call: int) -> dict[str, str]:
    """Fetch member positions for a specific House roll call vote.
    Returns {bioguide_id: position} map."""
    try:
        data = congress_api_get(
            f"house-vote/{congress}/{session}/{roll_call}/members",
            {"limit": 250},
        )
    except requests.HTTPError:
        return {}

    positions = {}
    for member in data.get("members", []):
        bio_id = member.get("bioguideId", "")
        position = member.get("voteResponse", "")
        if bio_id and position:
            positions[bio_id] = position
    return positions


# ── Step 3: Fetch Senate votes via senate.gov XML ─────────────


def fetch_senate_votes(congress: int) -> list[dict]:
    """Fetch all Senate roll call votes for a Congress from senate.gov XML."""
    print(f"  Fetching Senate votes for {congress}th Congress...")
    all_votes = []

    for session in [1, 2]:
        vote_num = 1
        consecutive_404s = 0
        while consecutive_404s < 5:
            url = (
                f"https://www.senate.gov/legislative/LIS/roll_call_votes/"
                f"vote{congress}{session}/"
                f"vote_{congress}_{session}_{vote_num:05d}.xml"
            )
            try:
                resp = requests.get(url, timeout=15)
                if resp.status_code == 404:
                    consecutive_404s += 1
                    vote_num += 1
                    continue
                resp.raise_for_status()
                consecutive_404s = 0
            except requests.HTTPError:
                consecutive_404s += 1
                vote_num += 1
                continue

            root = ElementTree.fromstring(resp.text)

            # Parse vote metadata
            question = root.findtext("vote_question_text", "")
            result = root.findtext("vote_result_text", "")
            date_str = root.findtext("vote_date", "")
            title = root.findtext("vote_title", "") or root.findtext("vote_document_text", "")
            issue = root.findtext("issue", "")

            # Parse member positions
            positions = {}
            for member_el in root.findall(".//member"):
                lis_id = member_el.findtext("lis_member_id", "")
                last_name = member_el.findtext("last_name", "")
                first_name = member_el.findtext("first_name", "")
                party = member_el.findtext("party", "")
                state = member_el.findtext("state", "")
                position = member_el.findtext("vote_cast", "")
                positions[f"{first_name} {last_name}|{state}"] = {
                    "position": position,
                    "party": party,
                    "state": state,
                    "lis_id": lis_id,
                }

            all_votes.append({
                "congress": congress,
                "chamber": "senate",
                "session": session,
                "roll_call": vote_num,
                "date": date_str,
                "question": question,
                "result": result,
                "title": title,
                "issue": issue,
                "positions": positions,
            })

            vote_num += 1
            time.sleep(0.3)  # be polite to senate.gov

    print(f"    Found {len(all_votes)} Senate roll calls")
    return all_votes


# ── Step 4: Tag tax-relevant votes ────────────────────────────


def is_tax_relevant(vote: dict) -> bool:
    """Check if a vote is tax/revenue-related based on keywords."""
    text = f"{vote.get('title', '')} {vote.get('question', '')} {vote.get('issue', '')}".lower()

    bill_info = vote.get("bill", {})
    if isinstance(bill_info, dict):
        text += f" {bill_info.get('title', '')} {bill_info.get('number', '')}".lower()

    return any(kw in text for kw in TAX_KEYWORDS)


def tag_tax_votes(all_votes: list[dict]) -> list[dict]:
    """Filter to tax-relevant votes."""
    tagged = [v for v in all_votes if is_tax_relevant(v)]
    print(f"  Tagged {len(tagged)} tax-relevant votes out of {len(all_votes)} total")
    return tagged


# ── Step 5: Compute alignment scores ─────────────────────────


def load_sector_positions() -> list[dict]:
    """Load curated sector positions on tax votes."""
    if not SECTOR_POSITIONS_FILE.exists():
        print("  WARNING: vote_sector_positions.json not found, skipping alignment")
        return []
    with open(SECTOR_POSITIONS_FILE) as f:
        return json.load(f)


def load_member_top_sectors(members: list[dict]) -> dict[str, list[str]]:
    """Load each member's top 3 funding sectors from PAC data."""
    pacs_file = PROJECT_ROOT / "webapp" / "data" / "pacs.json"
    if not pacs_file.exists():
        return {}

    with open(pacs_file) as f:
        pacs = json.load(f)

    # Aggregate PAC $ by sector per member
    member_sectors: dict[str, dict[str, float]] = {}
    for p in pacs:
        name = p.get("member_name", "")
        sector = p.get("sector", "")
        total = p.get("total", 0)
        if not sector:
            continue
        if name not in member_sectors:
            member_sectors[name] = {}
        member_sectors[name][sector] = member_sectors[name].get(sector, 0) + total

    # Get top 3 sectors per member
    result: dict[str, list[str]] = {}
    for name, sectors in member_sectors.items():
        sorted_sectors = sorted(sectors.items(), key=lambda x: x[1], reverse=True)
        result[name] = [s[0] for s in sorted_sectors[:3]]

    return result


def compute_alignment_scores(
    members: list[dict],
    member_votes: dict[str, list[dict]],
    sector_positions: list[dict],
    member_top_sectors: dict[str, list[str]],
) -> list[dict]:
    """Compute alignment scores: how often did each member vote
    with their top funding sectors' positions?"""

    # Index sector positions by roll_call_id
    sp_index: dict[str, dict] = {}
    for sp in sector_positions:
        sp_index[sp["roll_call_id"]] = sp

    scores = []
    for m in members:
        name = m["name"]
        top_sectors = member_top_sectors.get(name, [])
        if not top_sectors:
            continue

        votes = member_votes.get(name, [])
        if not votes:
            continue

        votes_with = 0
        votes_against = 0
        votes_total = 0
        per_sector: dict[str, dict] = {}

        for v in votes:
            roll_id = v.get("roll_call_id", "")
            member_position = v.get("position", "").lower()
            if not member_position or member_position in ("not voting", "present"):
                continue

            sp = sp_index.get(roll_id)
            if not sp:
                continue

            sector_pos = sp.get("sector_positions", {})
            for sector in top_sectors:
                if sector not in sector_pos:
                    continue

                wanted = sector_pos[sector]["position"].lower()
                matched = (member_position == wanted)

                votes_total += 1
                if matched:
                    votes_with += 1
                else:
                    votes_against += 1

                if sector not in per_sector:
                    per_sector[sector] = {"with": 0, "against": 0, "total": 0}
                per_sector[sector]["total"] += 1
                if matched:
                    per_sector[sector]["with"] += 1
                else:
                    per_sector[sector]["against"] += 1

        alignment_pct = round((votes_with / votes_total) * 100, 1) if votes_total > 0 else None

        scores.append({
            "member_name": name,
            "party": m["party"],
            "state": m["state"],
            "chamber": m["chamber"],
            "alignment_pct": alignment_pct,
            "votes_with": votes_with,
            "votes_against": votes_against,
            "votes_total": votes_total,
            "top_sectors": top_sectors,
            "top_funding_sector": top_sectors[0] if top_sectors else "",
            "per_sector": per_sector,
        })

    return scores


# ── Step 6: Build per-member vote records ─────────────────────


def build_member_votes(
    members: list[dict],
    house_votes: list[dict],
    senate_votes: list[dict],
) -> dict[str, list[dict]]:
    """Build per-member vote records from chamber-level vote data.
    For House: fetches individual member positions via API.
    For Senate: matches by name+state from XML data."""

    member_votes: dict[str, list[dict]] = {}

    # House members — need to fetch positions per tax-relevant vote
    house_members = {m["bioguide_id"]: m for m in members if m["chamber"] == "house" and m["bioguide_id"]}
    house_tax = [v for v in house_votes if is_tax_relevant(v)]

    print(f"  Fetching positions for {len(house_tax)} tax-relevant House votes...")
    for i, v in enumerate(house_tax):
        if i % 10 == 0 and i > 0:
            print(f"    ...{i}/{len(house_tax)}")

        positions = fetch_house_vote_positions(
            v["congress"], v["session"], v["roll_call"]
        )

        roll_id = f"H-{v['congress']}-{v['session']}-{v['roll_call']}"
        bill_info = v.get("bill", {})
        bill_number = bill_info.get("number", "") if isinstance(bill_info, dict) else ""
        bill_title = bill_info.get("title", "") if isinstance(bill_info, dict) else ""

        for bio_id, position in positions.items():
            if bio_id not in house_members:
                continue
            m = house_members[bio_id]
            name = m["name"]
            if name not in member_votes:
                member_votes[name] = []
            member_votes[name].append({
                "roll_call_id": roll_id,
                "congress": v["congress"],
                "chamber": "house",
                "date": v["date"],
                "bill": bill_number,
                "bill_title": bill_title,
                "question": v["question"],
                "result": v["result"],
                "position": position,
            })

    # Senate members — match from XML positions by name+state
    senate_members = {m["name"]: m for m in members if m["chamber"] == "senate"}
    senate_tax = [v for v in senate_votes if is_tax_relevant(v)]

    print(f"  Matching positions for {len(senate_tax)} tax-relevant Senate votes...")
    for v in senate_tax:
        roll_id = f"S-{v['congress']}-{v['session']}-{v['roll_call']}"
        xml_positions = v.get("positions", {})

        for name, m in senate_members.items():
            # Try to find in XML positions (keyed by "FirstName LastName|State")
            matched_position = None
            for key, pos_data in xml_positions.items():
                if pos_data.get("state", "") == m["state"]:
                    # Check if name matches (last name match is sufficient)
                    last_name = name.split()[-1].upper()
                    xml_last = key.split("|")[0].split()[-1].upper()
                    if last_name == xml_last:
                        matched_position = pos_data["position"]
                        break

            if matched_position:
                if name not in member_votes:
                    member_votes[name] = []
                member_votes[name].append({
                    "roll_call_id": roll_id,
                    "congress": v["congress"],
                    "chamber": "senate",
                    "date": v["date"],
                    "bill": v.get("issue", ""),
                    "bill_title": v.get("title", ""),
                    "question": v["question"],
                    "result": v["result"],
                    "position": matched_position,
                })

    return member_votes


# ── Main ──────────────────────────────────────────────────────


def main():
    print("=" * 60)
    print("Step 13: Voting Records & Alignment Scores")
    print("=" * 60)

    # Load members and build crosswalk
    members = load_members()
    print(f"  Loaded {len(members)} members")

    crosswalk = build_fec_to_bioguide()
    mapped = map_bioguide_ids(members, crosswalk)
    print(f"  Mapped {mapped}/{len(members)} members to Bioguide IDs")

    # Fetch votes from both chambers
    all_house_votes: list[dict] = []
    all_senate_votes: list[dict] = []

    for congress in TARGET_CONGRESSES:
        all_house_votes.extend(fetch_house_votes(congress))
        all_senate_votes.extend(fetch_senate_votes(congress))

    print(f"\n  Total: {len(all_house_votes)} House + {len(all_senate_votes)} Senate votes")

    # Build per-member vote records (only tax-relevant)
    member_votes = build_member_votes(members, all_house_votes, all_senate_votes)
    total_member_votes = sum(len(v) for v in member_votes.values())
    print(f"  Built vote records for {len(member_votes)} members ({total_member_votes} total vote positions)")

    # Tag all tax-relevant votes for output
    all_votes = all_house_votes + all_senate_votes
    tax_votes = tag_tax_votes(all_votes)

    # Load sector positions and compute alignment
    sector_positions = load_sector_positions()
    member_top_sectors = load_member_top_sectors(members)
    alignment_scores = compute_alignment_scores(
        members, member_votes, sector_positions, member_top_sectors
    )

    scored = [s for s in alignment_scores if s["alignment_pct"] is not None]
    print(f"  Computed alignment scores for {len(scored)} members")

    # Write outputs
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_DIR / "member_votes.json", "w") as f:
        json.dump(member_votes, f, indent=2)
    print(f"  Wrote member_votes.json ({total_member_votes} vote records)")

    with open(OUTPUT_DIR / "tax_votes_tagged.json", "w") as f:
        # Strip positions from senate votes before writing (too large)
        clean_tax = []
        for v in tax_votes:
            clean = {k: v2 for k, v2 in v.items() if k != "positions"}
            clean_tax.append(clean)
        json.dump(clean_tax, f, indent=2)
    print(f"  Wrote tax_votes_tagged.json ({len(tax_votes)} votes)")

    with open(OUTPUT_DIR / "member_alignment_scores.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "member_name", "party", "state", "chamber",
            "alignment_pct", "votes_with", "votes_against", "votes_total",
            "top_funding_sector",
        ])
        writer.writeheader()
        for s in alignment_scores:
            writer.writerow({k: v for k, v in s.items() if k in writer.fieldnames})
    print(f"  Wrote member_alignment_scores.csv ({len(alignment_scores)} rows)")

    # Also write per-sector alignment as JSON for the webapp
    alignment_detail = {}
    for s in alignment_scores:
        alignment_detail[s["member_name"]] = {
            "alignment_pct": s["alignment_pct"],
            "votes_with": s["votes_with"],
            "votes_against": s["votes_against"],
            "votes_total": s["votes_total"],
            "top_funding_sector": s["top_funding_sector"],
            "top_sectors": s["top_sectors"],
            "per_sector": s["per_sector"],
        }
    with open(OUTPUT_DIR / "member_alignment_detail.json", "w") as f:
        json.dump(alignment_detail, f, indent=2)
    print(f"  Wrote member_alignment_detail.json")

    print("\nDone.")


if __name__ == "__main__":
    main()
