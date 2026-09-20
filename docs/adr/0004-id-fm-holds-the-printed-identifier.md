---
status: accepted
supersedes: 0003 (in part — one rejected option, now taken), 0002 (the column name, not the join)
---

# id_fm holds the identifier printed on the licence; the StationID moves to register_station_id

The UI has one `ID` field and the station has two codes for it. Until now
`utils/stationLabel.ts` picked between them at render time: `nbtc_code` if the row had one,
else `FM-<id_fm>`. That made the displayed ID a property of the view, not of the row — a
search, a CSV export or a Discord message each had to repeat the same choice, and the column
called `id_fm` held a number nobody on the team reads off a licence.

So the choice moves into the data. `fm_station.id_fm` is now `String?` and holds **the NBTC
code where the station has one, its old register StationID as digits where it does not**. The
StationID itself is preserved, unchanged and still an integer, in the new
`register_station_id` column. Migration: `2026-09-20-3-id-fm-holds-nbtc-code`.

ADR 0003 listed this as a rejected option — "Overwrite `id_fm`'s values with `nbtc_code`:
it is a type change on the primary key, it rewrites 111 inspection rows, and it destroys the
StationID that ADR 0002 depends on." The first two objections died with
`2026-09-20-1-fm-station-surrogate-id`, which made `id` the primary key and re-pointed
`station_inspection.station_id` at it; `id_fm` is now an ordinary column and no inspection row
is touched. The third is answered by keeping the number rather than overwriting it.

On the data (221 rows): 132 have both, 81 have only a StationID, 6 have only a code, 2 have
neither. All 138 codes are distinct, and no code is equal to any StationID's digits, so the
unique index survives the merge.

## Considered options

- **Leave the choice in `stationLabel`.** What we had. Rejected because every new consumer —
  search, export, the Discord notice — has to re-derive the same rule, and the row itself
  cannot answer "what is this station's ID?".
- **Overwrite `id_fm` and let the StationID go.** What the request literally asks for, and the
  cheapest migration. Rejected: pass 0 of `buildDiff` joins the NBTC register on the StationID
  exactly (ADR 0002), and 132 of 213 rows would lose it with no way back. `register_station_id`
  costs one column and keeps the join exact.
- **Add a third column (`display_id`) and leave `id_fm` alone.** Honest, and it avoids a type
  change on a column the deployed client reads. Rejected: three identifier columns on one table
  is how this confusion started, and the name `id_fm` should mean the id people actually use.

## Consequences

- **`FMStation.idFm` is a `string`.** `stationLabel` prints it as-is when it is a code and as
  `FM-<n>` when it is all digits, so nothing changes on screen for a station without a code.
  `nbtcCode` stayed on the interface at first as the fallback for a row written before the code
  reached `id_fm`; it was removed with the `nbtc_code` column on 2026-09-20
  (`2026-09-20-4-drop-nbtc-code-and-source`) once every code was verified to be in `id_fm`.
- **Register scripts join on `register_station_id`.** `sync-register`, `import-nbtc-stations`,
  `compare-register-by-type`, `audit-offair`, `import-inspections-xlsx`,
  `backfill-permit-from-xlsx` and `import-revoked-missing` all moved. The decoupled
  `DbStationRow` shapes in `utils/nbtcRegisterDiff.ts` and `utils/offairAudit.ts` renamed their
  field to match the column.
- **Every writer keeps the invariant.** A station inserted with an NBTC code gets it in `id_fm`
  too (`sync-register`, `import-nbtc-stations`, `add-station`); one inserted with only a
  StationID gets its digits. `add-station`'s flag is now `--station-id` (`--id-fm` still
  accepted). It wrote both `id_fm` and `nbtc_code` until the latter was dropped.
- **The migration is backward-incompatible in both directions.** It is a type change on a column
  the deployed Prisma client selects on every page load: an `Int` client reading text throws,
  and so does a `String` client reading an integer. Unlike a widening or a narrowing migration
  there is no safe ordering — the DB change and the deploy have to happen back to back.
