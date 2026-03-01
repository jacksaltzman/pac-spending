# Member Influence Scorecard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a voting-record pipeline and redesign member pages around an "alignment score" showing how often each member votes with their top funding sectors' positions on tax-relevant bills.

**Architecture:** New Python pipeline step (13) pulls voting records from Congress.gov API (House) and senate.gov XML (Senate), maps FEC IDs to Bioguide IDs via the congress-legislators crosswalk, tags tax-relevant votes, matches against curated sector positions, and computes alignment scores. Import-data merges scores into member JSON. Member detail page restructured into three acts (money → agenda → votes). Members list table updated with alignment score column.

**Tech Stack:** Python 3.11+ (requests, xml.etree), Congress.gov API (free key), senate.gov XML, Next.js 16 / React 19 / TypeScript 5.9 / Tailwind CSS v4

---

## Task 1: Build FEC-to-Bioguide ID Crosswalk

**Files:**
- Create: `scripts/13_voting_records.py`
- Read: `config/members.json`

This task creates the pipeline script skeleton and the ID crosswalk. The `congress-legislators` dataset at `https://theunitedstates.io/congress-legislators/legislators-current.json` contains a mapping from FEC candidate IDs to Bioguide IDs. We download it, build a reverse lookup, and map all 72 members.

**Step 1: Create `scripts/13_voting_records.py` with crosswalk logic**

```python
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
```

**Step 2: Run and verify**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
export CONGRESS_API_KEY=<your_key>  # Get from https://api.congress.gov/sign-up/
python scripts/13_voting_records.py
```

Expected output:
- `output/member_votes.json` — per-member tax vote positions
- `output/tax_votes_tagged.json` — all tax-relevant votes
- `output/member_alignment_scores.csv` — scorecard CSV
- `output/member_alignment_detail.json` — detailed per-sector alignment

**Step 3: Commit**

```bash
git add scripts/13_voting_records.py
git commit -m "feat: add voting records pipeline (step 13)"
```

---

## Task 2: Create Curated Sector Positions Config

**Files:**
- Create: `config/vote_sector_positions.json`

This file maps tax-relevant roll call votes to what each industry sector wanted. It's curated manually — we start with well-known tax votes from the 118th Congress and add more over time.

**Step 1: Create `config/vote_sector_positions.json`**

This is a starter set. After running the pipeline in Task 1 and seeing which votes were tagged as tax-relevant, we'll expand it. For now, include the major known tax votes:

```json
[
  {
    "roll_call_id": "H-118-2-19",
    "bill": "H.R.7024",
    "bill_title": "Tax Relief for American Families and Workers Act of 2024",
    "date": "2024-01-31",
    "chamber": "house",
    "description": "Expanded child tax credit, restored R&D expensing, extended business interest deductions, increased low-income housing tax credit",
    "sector_positions": {
      "Finance & Insurance": {"position": "yea", "reason": "Restores business interest deduction and R&D amortization rules favorable to financial firms"},
      "Real Estate & Housing": {"position": "yea", "reason": "Increases Low-Income Housing Tax Credit allocation by 12.5%"},
      "Tech & Telecom": {"position": "yea", "reason": "Restores immediate R&D expensing instead of 5-year amortization"},
      "Construction & Engineering": {"position": "yea", "reason": "Extends 100% bonus depreciation for capital equipment"}
    }
  },
  {
    "roll_call_id": "H-118-1-192",
    "bill": "H.R.1",
    "bill_title": "Lower Energy Costs Act",
    "date": "2023-03-30",
    "chamber": "house",
    "description": "Repealed IRA clean energy tax credits, expanded fossil fuel leasing, blocked methane fee",
    "sector_positions": {
      "Energy & Utilities": {"position": "yea", "reason": "Expands fossil fuel production tax benefits and blocks methane emissions fee"},
      "Healthcare & Pharma": {"position": "nay", "reason": "No direct stake but opposition aligned with preserving IRA provisions"},
      "Finance & Insurance": {"position": "yea", "reason": "Reduces regulatory costs and energy transition compliance burden"}
    }
  },
  {
    "roll_call_id": "H-118-1-72",
    "bill": "H.R.25",
    "bill_title": "FairTax Act of 2023",
    "date": "2023-01-27",
    "chamber": "house",
    "description": "Referred to Ways and Means — would replace income tax with national sales tax and abolish the IRS",
    "sector_positions": {
      "Finance & Insurance": {"position": "nay", "reason": "Would eliminate tax-advantaged products (401k, IRA, life insurance) that drive revenue"},
      "Professional Services": {"position": "nay", "reason": "Would eliminate demand for tax advisory and compliance services"},
      "Retail & Consumer": {"position": "nay", "reason": "23% national sales tax would suppress consumer spending"}
    }
  }
]
```

**Note:** The `roll_call_id` format must match what the pipeline produces: `H-{congress}-{session}-{roll_call}` for House, `S-{congress}-{session}-{roll_call}` for Senate. After running the pipeline, inspect `output/tax_votes_tagged.json` to find the correct roll call numbers and add more entries. This starter file demonstrates the format — the real editorial work is populating 20-30 key votes.

**Step 2: Commit**

```bash
git add config/vote_sector_positions.json
git commit -m "feat: add curated sector positions for tax votes (starter set)"
```

---

## Task 3: Add Voting Data to Import Pipeline

**Files:**
- Modify: `webapp/scripts/import-data.ts`
- Outputs: `webapp/data/voting_records.json`, `webapp/data/alignment_scores.json`

**Step 1: Add import functions to `import-data.ts`**

Add these functions after the existing `importIndustryInfluence()` function (around line 347) and before the `buildTopFunderAgendas` function:

```typescript
function importAlignmentScores(): Record<string, {
  alignment_pct: number | null;
  votes_with: number;
  votes_against: number;
  votes_total: number;
  top_funding_sector: string;
  top_sectors: string[];
  per_sector: Record<string, { with: number; against: number; total: number }>;
}> | null {
  const path = join(PIPELINE_OUTPUT, "member_alignment_detail.json");
  if (!existsSync(path)) {
    console.log("  Skipping alignment scores (member_alignment_detail.json not found)");
    return null;
  }
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

function importMemberVotes(): Record<string, {
  roll_call_id: string;
  congress: number;
  chamber: string;
  date: string;
  bill: string;
  bill_title: string;
  question: string;
  result: string;
  position: string;
}[]> | null {
  const path = join(PIPELINE_OUTPUT, "member_votes.json");
  if (!existsSync(path)) {
    console.log("  Skipping member votes (member_votes.json not found)");
    return null;
  }
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

function importTaxVotes(): unknown[] | null {
  const path = join(PIPELINE_OUTPUT, "tax_votes_tagged.json");
  if (!existsSync(path)) {
    console.log("  Skipping tax votes (tax_votes_tagged.json not found)");
    return null;
  }
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}
```

Then in the main section (after the `buildTopFunderAgendas` call, around line 498), add:

```typescript
// Import voting records and alignment scores
const alignmentScores = importAlignmentScores();
if (alignmentScores) {
  writeFileSync(
    join(DATA_DIR, "alignment_scores.json"),
    JSON.stringify(alignmentScores, null, 2)
  );
  console.log(`  alignment_scores.json: ${Object.keys(alignmentScores).length} members`);

  // Merge alignment data into members
  for (const m of members) {
    const score = alignmentScores[m.member_name];
    if (score) {
      (m as Record<string, unknown>).alignment_pct = score.alignment_pct;
      (m as Record<string, unknown>).alignment_votes_total = score.votes_total;
      (m as Record<string, unknown>).top_funding_sector = score.top_funding_sector;
    }
  }
}

const memberVotes = importMemberVotes();
if (memberVotes) {
  writeFileSync(
    join(DATA_DIR, "voting_records.json"),
    JSON.stringify(memberVotes, null, 2)
  );
  const totalVotes = Object.values(memberVotes).reduce((s, v) => s + v.length, 0);
  console.log(`  voting_records.json: ${Object.keys(memberVotes).length} members, ${totalVotes} vote records`);
}

const taxVotes = importTaxVotes();
if (taxVotes) {
  writeFileSync(
    join(DATA_DIR, "tax_votes.json"),
    JSON.stringify(taxVotes, null, 2)
  );
  console.log(`  tax_votes.json: ${taxVotes.length} votes`);
}

// Copy vote_sector_positions.json from config
const sectorPositionsPath = join(CONFIG_DIR, "vote_sector_positions.json");
if (existsSync(sectorPositionsPath)) {
  const spData = JSON.parse(readFileSync(sectorPositionsPath, "utf-8"));
  writeFileSync(join(DATA_DIR, "vote_sector_positions.json"), JSON.stringify(spData, null, 2));
  console.log(`  vote_sector_positions.json: ${spData.length} curated votes`);
}
```

**Step 2: Run and verify**

```bash
cd webapp && npm run import-data
```

Expected: New JSON files in `webapp/data/`, members.json now has `alignment_pct`, `alignment_votes_total`, `top_funding_sector` fields.

**Step 3: Commit**

```bash
git add webapp/scripts/import-data.ts
git commit -m "feat: import voting records and alignment scores into webapp"
```

---

## Task 4: Add Data Loaders and Types to lib/data.ts

**Files:**
- Modify: `webapp/lib/data.ts`

**Step 1: Add new interfaces** after the existing `LeadershipAnalysis` interface (around line 299):

```typescript
export interface AlignmentScore {
  alignment_pct: number | null;
  votes_with: number;
  votes_against: number;
  votes_total: number;
  top_funding_sector: string;
  top_sectors: string[];
  per_sector: Record<string, { with: number; against: number; total: number }>;
}

export interface VoteRecord {
  roll_call_id: string;
  congress: number;
  chamber: string;
  date: string;
  bill: string;
  bill_title: string;
  question: string;
  result: string;
  position: string;
}

export interface SectorPosition {
  position: string;
  reason: string;
}

export interface TaxVoteSectorPositions {
  roll_call_id: string;
  bill: string;
  bill_title: string;
  date: string;
  chamber: string;
  description: string;
  sector_positions: Record<string, SectorPosition>;
}
```

**Step 2: Add fields to the `Member` interface** (after `top_funder_agendas: string;`):

```typescript
  alignment_pct?: number | null;
  alignment_votes_total?: number;
  top_funding_sector?: string;
```

**Step 3: Add data loader functions** at the end of the file (after `getLeadershipAnalysis`):

```typescript
export function getAlignmentScores(): Record<string, AlignmentScore> | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "alignment_scores.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAlignmentForMember(name: string): AlignmentScore | null {
  const scores = getAlignmentScores();
  return scores?.[name] ?? null;
}

export function getVotingRecords(): Record<string, VoteRecord[]> | null {
  try {
    const raw = readFileSync(join(DATA_DIR, "voting_records.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getTaxVotesForMember(name: string): VoteRecord[] {
  const records = getVotingRecords();
  return records?.[name] ?? [];
}

export function getSectorPositions(): TaxVoteSectorPositions[] {
  try {
    const raw = readFileSync(join(DATA_DIR, "vote_sector_positions.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getBeforeAfterForMember(name: string): BeforeAfterMember | null {
  const data = getBeforeAfter();
  if (!data) return null;
  return data.members.find((m) => m.name === name) ?? null;
}
```

**Step 4: Verify build**

```bash
cd webapp && npm run build
```

**Step 5: Commit**

```bash
git add webapp/lib/data.ts
git commit -m "feat: add voting record types and data loaders"
```

---

## Task 5: Redesign Member Detail Page

**Files:**
- Modify: `webapp/app/members/[slug]/page.tsx`

This is the largest task. The page is restructured into the three-act flow described in the design. The full replacement of the page component follows. Key changes:

1. **Influence Scorecard** — new section after header with big alignment number + per-sector mini-cards
2. **The Money** — restructured stats with before/after callout and leadership premium callout
3. **Who Funds Them** — existing PAC section enhanced with PAC reach from pac_spread data
4. **How They Voted** — new voting record table with match indicators
5. **Context** — benchmark comparison + filtered news
6. Removed: separate "Top Outside States" section (absorbed into geo breakdown)

**Step 1: Rewrite `webapp/app/members/[slug]/page.tsx`**

The complete replacement is too large to include inline here. The implementer should:

1. Add these new imports at the top:
```typescript
import {
  getMembers,
  getMemberBySlug,
  getEmployersForMember,
  getPacsForMember,
  getOneLinerForMember,
  getLeadershipAnalysis,
  getAlignmentForMember,
  getTaxVotesForMember,
  getSectorPositions,
  getBeforeAfterForMember,
  getBenchmarks,
  getNews,
  getPacSpread,
  getSectorColors,
} from "@/lib/data";
```

2. Load the new data in the page component:
```typescript
const alignment = getAlignmentForMember(member.member_name);
const taxVotes = getTaxVotesForMember(member.member_name);
const sectorPositions = getSectorPositions();
const beforeAfterMember = getBeforeAfterForMember(member.member_name);
const benchmarks = getBenchmarks();
const news = getNews();
const pacSpread = getPacSpread();
const sectorColors = getSectorColors();
```

3. Build a PAC reach lookup from pac_spread:
```typescript
const pacReach = new Map<string, number>();
for (const p of pacSpread) {
  pacReach.set(p.pac_cmte_id, p.num_recipients);
}
```

4. Add these sections in order after the header:

**Section: Influence Scorecard**
- If `alignment` exists and `alignment.alignment_pct !== null`:
  - Big coral number showing `alignment.alignment_pct`%
  - Subtitle: "On {votes_total} tax-relevant votes, {name} voted with their top funding sectors' positions {alignment_pct}% of the time"
  - 3 mini-cards for `alignment.top_sectors`, each showing per-sector alignment % and dollar amount from PAC data
  - Use coral (#FE4F40) for high alignment (>75%), amber (#F59E0B) for moderate (50-75%), teal (#4C6971) for low (<50%)

**Section: The Money**
- Stat row: Total Raised, PAC $ (from `fec_pac_contributions`), Outside %, DC/K-Street %
- If `beforeAfterMember` exists and has valid data (`flag === ""` and `pct_change_pac != null`):
  - Callout card with coral left border: "PAC funding increased +{pct_change_pac}% after joining {committee} in {first_year}"
  - Show before/after amounts
- If `leadershipRole` exists and tier <= 2:
  - Callout: "As {title}, receives more PAC money than rank-and-file members"
- Geographic breakdown bar (keep existing)

**Section: Who Funds Them & What They Want**
- PAC sector breakdown bar (keep existing)
- Enhanced PAC table — each row adds a "Reach" column showing `pacReach.get(p.pac_cmte_id)` with text like "funds {N} of 72 members"
- Top employers table (keep existing)

**Section: How They Voted**
- If `taxVotes.length > 0`:
  - Build a lookup from sector positions: `Map<roll_call_id, sector_positions>`
  - For each vote, determine if member's position matched their top sector's desired position
  - Show table: Date | Bill | Vote (Yes/No badge) | Sector Wanted | Match (checkmark/X)
  - Summary line: "Voted with {top_sector} {N}/{total} times ({pct}%)"

**Section: Context**
- If `benchmarks` exists:
  - Show comparison: member's PAC $ vs median for their chamber
  - e.g., "Receives {formatMoney(member.fec_pac_contributions)} in PAC money — {pct}% {above/below} the median House incumbent ({formatMoney(benchmarks.house.all_incumbents.median_pac)})"
- If `news.length > 0`:
  - Filter to articles matching member's top sectors
  - Show up to 3 as linked cards

**Section: Data Quality** (keep existing, at bottom)

**Step 2: Verify build**

```bash
cd webapp && npm run build
```

**Step 3: Commit**

```bash
git add webapp/app/members/\[slug\]/page.tsx
git commit -m "feat: redesign member detail page with influence scorecard"
```

---

## Task 6: Update Members List Table

**Files:**
- Modify: `webapp/app/members/MembersTable.tsx`

**Step 1: Update columns**

1. Add `sectorColor` import from `@/lib/utils`

2. Add `"alignment_pct"` and `"top_funding_sector"` to the `SortKey` type:
```typescript
type SortKey =
  | "alignment_pct"
  | "pct_outside"
  | "total_itemized_amount"
  | "member_name";
```

3. Change default sort to `alignment_pct` descending:
```typescript
const [sortKey, setSortKey] = useState<SortKey>("alignment_pct");
```

4. Add sort cases in the `useMemo` for `alignment_pct`:
```typescript
case "alignment_pct":
  av = a.alignment_pct ?? -1;
  bv = b.alignment_pct ?? -1;
  break;
```

5. Update the table header — remove DC % and In-Home % columns, add Alignment and Top Sector:

```
# | Member | Party | State | Alignment | Top Sector | Outside % | PAC $ | Top Funders Lobby For
```

6. Update table body — remove DC/In-Home cells, add:

Alignment cell (color-coded):
```tsx
<td className="px-3 py-2.5 text-right font-semibold tabular-nums"
    style={{ color: (m.alignment_pct ?? 0) > 75 ? "#FE4F40" : (m.alignment_pct ?? 0) > 50 ? "#F59E0B" : "#4C6971" }}>
  {m.alignment_pct != null ? `${m.alignment_pct.toFixed(0)}%` : "—"}
</td>
```

Top Sector cell (with color dot):
```tsx
<td className="px-3 py-2.5 text-xs text-stone-500 whitespace-nowrap">
  {m.top_funding_sector ? (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: sectorColor(m.top_funding_sector) }} />
      {m.top_funding_sector}
    </span>
  ) : "—"}
</td>
```

7. Update search filter to include `top_funding_sector`:
```typescript
!(m.top_funding_sector ?? "").toLowerCase().includes(q)
```

**Step 2: Verify build**

```bash
cd webapp && npm run build
```

**Step 3: Commit**

```bash
git add webapp/app/members/MembersTable.tsx
git commit -m "feat: add alignment score and top sector columns to members table"
```

---

## Task 7: End-to-End Verification

**Step 1: Run the full pipeline**

```bash
cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Geographic Distribution"
export CONGRESS_API_KEY=<your_key>
python scripts/13_voting_records.py
```

**Step 2: Re-import data**

```bash
cd webapp && npm run import-data
```

**Step 3: Build and verify**

```bash
npm run build
```

Expected: All 78 pages generate successfully including member detail pages with alignment data.

**Step 4: Dev server spot-check**

```bash
npm run dev
```

Visit:
- `/members` — verify alignment column appears and sorts
- `/members/jason-smith` — verify scorecard, voting table, before/after callout
- `/members/ron-wyden` — verify Senate member works too

**Step 5: Commit and push**

```bash
git add -A
git commit -m "feat: complete member influence scorecard feature"
git push origin main
```
