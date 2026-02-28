# Funder Agenda Clarity — Design

## Goal

Make it immediately clear to general-public voters who funds each politician on the tax-writing committees and what those funders want. The existing PAC sector and agenda data is already in the pipeline but isn't surfaced in the webapp.

## Members Table (`/members`)

Replace the "Top Outside Employer" column with **"Top Funders Lobby For"**.

Content is a pre-computed string (~10-15 words) synthesized from the agenda fields of the member's top 3 PAC donors by dollar amount. Example:

> Lower corporate tax rates, estate tax repeal, insurance tax breaks

### How it's generated

In `import-data.ts`, for each member:

1. Look up their PACs from PAC data (already loaded)
2. Take top 3 by dollar amount with non-empty `agenda` fields
3. Extract policy goals (strip "Lobbies for..." / "Seeks..." / "Advocates for..." prefixes)
4. Deduplicate, join, truncate to ~15 words
5. Store as `top_funder_agendas: string` on each member object

### Styling

`text-xs`, `text-stone-500`, `max-w-64`, line-clamp-2. Search bar also searches this field.

## Member Detail Page (`/members/[slug]`)

### Sector Breakdown Summary (new section)

Add a **"Where the PAC Money Comes From"** section above the existing PAC table.

- Horizontal stacked bar colored by sector (same pattern as the geographic breakdown bar)
- Legend below: sector name, color swatch, dollar amount, percentage
- Computed at render time from existing PAC data (has `sector` and `total` per PAC)
- Sector colors from `pac_sectors.json`

### Enhanced PAC Table

The existing PAC table (rank, PAC name, total, count) gets two additions inside the PAC name cell:

- **Colored sector chip** next to the PAC name (small pill, e.g. "Finance & Insurance")
- **Agenda subtitle** beneath PAC name in smaller muted text

PACs with empty sector/agenda show name only (unchanged appearance).

## Files Changed

| File | Change |
|------|--------|
| `webapp/scripts/import-data.ts` | Compute `top_funder_agendas` per member |
| `webapp/lib/data.ts` | Add `top_funder_agendas: string` to `Member` interface |
| `webapp/app/members/MembersTable.tsx` | Replace "Top Outside Employer" with "Top Funders Lobby For"; update search |
| `webapp/app/members/[slug]/page.tsx` | Add sector bar section; enhance PAC table with chips + agenda |
| `webapp/lib/utils.ts` | Add `sectorColor()` helper if useful |

## Files NOT Changed

- No Python pipeline scripts
- No new components (sector bar reuses geographic bar pattern)
- No new data files

## After Implementation

```bash
cd webapp
npm run import-data   # regenerate members.json with new field
npm run dev           # verify
```
