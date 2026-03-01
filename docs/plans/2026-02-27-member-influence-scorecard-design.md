# Member Influence Scorecard — Design Document

**Goal:** Redesign the member pages to tell the influence story: who funds each politician, what those funders want, and whether the member voted accordingly. Centered on an "alignment score" — what % of the time a member voted with their top funding sectors' positions on tax-relevant bills.

**Architecture:** New pipeline step pulls voting records from ProPublica API, tags tax-relevant votes, matches against curated sector positions, and computes alignment scores. Member detail page restructured around three acts: money → agenda → votes. Members list table updated to lead with alignment score.

**Tech Stack:** ProPublica Congress API (free), Python pipeline step, existing Next.js/TypeScript webapp.

---

## Section 1: Voting Data Pipeline

New pipeline step (`scripts/13_voting_records.py`):

1. **Pull all roll call votes** for 72 members via ProPublica Congress API for the 118th and 119th Congresses (2023-2026). Store raw vote data as JSON: bill ID, bill title, vote position (Yes/No/Not Voting), date, result, question.

2. **Tag tax-relevant votes** by filtering to bills that:
   - Were referred to Ways & Means or Senate Finance committees (from bill metadata)
   - OR match tax/revenue keywords in bill title ("tax", "revenue", "tariff", "IRS", "deduction", "credit", etc.)
   - Expected: ~30-50 tax-relevant votes per Congress

3. **Curated sector positions** (`config/vote_sector_positions.json`): Manually curated mapping defining what each sector wanted on each tax-relevant vote. Example:
   ```json
   {
     "roll_call_id": "H-2024-123",
     "bill": "HR 7024 - Tax Relief for American Families Act",
     "date": "2024-01-31",
     "description": "Expanded child tax credit + R&D expensing",
     "sector_positions": {
       "Finance & Insurance": { "position": "yes", "reason": "Restores R&D expensing and business interest deductions" },
       "Healthcare & Pharma": { "position": "yes", "reason": "Preserves tax-exempt bond financing" }
     }
   }
   ```
   Curated for ~20-30 most significant tax votes where industry had a clear stake.

4. **Compute alignment score** per member: For each member's top 3 funding sectors, how often did they vote the way that sector wanted? Output: `member_name, top_sector, alignment_pct, votes_with, votes_against, votes_total`.

5. **Output files:**
   - `output/member_votes.json` — full vote records for all members
   - `output/tax_votes_tagged.json` — filtered tax-relevant votes with sector positions
   - `output/member_alignment_scores.csv` — the scorecard data

---

## Section 2: Member Detail Page Redesign

Current flow: Header → One-liner → Stats → Geographic Breakdown → Employers → PAC Sectors → PACs → Outside States → Data Quality.

Redesigned flow tells a story in three acts — **Who funds them → What those funders want → Did they deliver?**

### New page structure:

1. **Header** (largely unchanged) — Name, party, title, leadership badge, one-liner.

2. **Influence Scorecard** (NEW — centerpiece)
   - Big number: alignment score (e.g., "87% aligned with top funders")
   - Subtitle: "On 24 tax-relevant votes, Rep. X voted with their top funding sectors' positions 87% of the time"
   - 3 mini-cards below: top 3 funding sectors, each with alignment % and dollar amount
   - Color-coded: high alignment in coral, low in teal

3. **The Money** (restructured)
   - Stat row: Total Raised, PAC Money, Outside %, DC/K-Street %
   - If before/after data exists: callout card — "PAC funding increased +51% after joining Ways & Means in 2019"
   - If leadership role: callout — "As Subcommittee Chair, receives X% more PAC money than rank-and-file members"
   - Geographic breakdown bar (same as current)

4. **Who Funds Them & What They Want** (restructured)
   - PAC sector breakdown bar (same as current)
   - Enhanced PAC table: sector chip, agenda text, AND PAC reach ("funds 42 of 72 committee members")
   - Top employers table (same as current)

5. **How They Voted** (NEW)
   - Table of tax-relevant votes: Date, Bill, Member's Vote (Yes/No badge), Top Sector Position (what funders wanted), Match (checkmark or X)
   - Filterable by sector
   - Summary line: "Voted with Finance & Insurance 91% of the time (10/11 votes)"

6. **Context** (NEW)
   - Committee comparison: "Receives X% more PAC money than the median House incumbent"
   - Relevant news articles from pac_news.json filtered to member's top sectors

7. **Data Quality** (same as current, bottom)

---

## Section 3: Members List Page Changes

Table keeps sortable structure but swaps columns to lead with the influence story:

| # | Member | Party | State | Alignment Score | Top Funder Sector | PAC $ | Outside % | Top Funders Lobby For |

Key changes:
- **Add "Alignment Score" column** — color-coded (high = coral, low = teal), default sort (highest first)
- **Add "Top Funder Sector" column** — sector name with color dot
- **Remove DC % and In-Home %** — detail-page material; Outside % stays
- **Search** updated to also match sector names

---

## Section 4: Data Flow & Files Changed

### New files:
- `scripts/13_voting_records.py` — Pipeline step: ProPublica API → tag → score
- `config/vote_sector_positions.json` — Curated sector positions on tax votes

### Import-data changes:
- `webapp/scripts/import-data.ts` — New `importVotingRecords()` and `importAlignmentScores()`
- New webapp data: `webapp/data/voting_records.json`, `webapp/data/alignment_scores.json`

### Data loader changes:
- `webapp/lib/data.ts` — New exports: `getVotingRecords()`, `getAlignmentForMember()`, `getTaxVotesForMember()`
- New interfaces: `VoteRecord`, `AlignmentScore`, `TaxVote`
- `Member` interface updated with `alignment_score`, `alignment_votes_total`, `top_funding_sector`

### Page changes:
- `webapp/app/members/[slug]/page.tsx` — Major restructure per Section 2
- `webapp/app/members/MembersTable.tsx` — Column changes per Section 3

### Existing data newly surfaced on member pages:
- `before_after.json` — Per-member committee seat premium
- `leadership_analysis.json` — Premium comparison (beyond just badge)
- `benchmarks.json` — Committee vs. all incumbents comparison
- `pac_spread.json` — PAC reach count ("funds X of 72 members")

No changes to PACs page, dashboard, or stories page.
