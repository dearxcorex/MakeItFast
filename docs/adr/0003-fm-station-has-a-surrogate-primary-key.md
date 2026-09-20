---
status: accepted
supersedes: 0002 (in part — the key's role, not its identity)
---

# fm_station gets a surrogate primary key, and id_fm becomes an ordinary column

`id_fm` was the primary key and the NBTC register's `StationID` at the same time. ADR 0002
established the second of those and it still holds: `StationID` **is** `id_fm`, and pass 0 of
`buildDiff` still joins on it exactly. What changes here is only that it stops being the
primary key. `fm_station` now carries `id Int @id @default(autoincrement())`, and `id_fm`
becomes nullable and unique-when-present, meaning "the register's StationID, if this station is
in the register yet". `station_inspection.station_id` re-points to the new `id`.

The forcing issue was not tidiness. It was that a real-world identifier cannot represent
absence, and we had two symptoms of that:

- **Eight สถานีหลัก rows were hand-numbered `1`–`11`.** They are not StationIDs. They exist
  because the primary key had to hold *something* at the time those rows were entered. Pass 0 of
  the register diff treats `id_fm` as exact, so a register row arriving with `StationID` 7 would
  match a station by pure coincidence. Those eight are now `NULL`.
- **`id_fm` was declared `@default(autoincrement())` and its sequence had reached 5,550,055** —
  inside live StationID space (`5550002` and `5550055` are real register rows). The next insert
  through the app would have minted `5550056`: a number indistinguishable from a genuine
  StationID, silently poisoning every future diff. The sequence is dropped; `id_fm` has no
  default and must be stated explicitly or left NULL.

This also settles what ADR 0002 deferred. That ADR declined to insert a new station under its
register `StationID` because "an explicit id does not advance the Postgres sequence, so a later
sequence-assigned insert could collide." With no sequence on `id_fm` at all, the objection is
gone: an explicit StationID is now the only way that column is ever filled.

## Considered options

- **Leave `id_fm` as the primary key, and only drop the `autoincrement()` default.** The
  cheapest fix, and it does address the collision. Rejected because it leaves a station that is
  not yet in the register with no way to say so — it would still need an invented `id_fm`, which
  is exactly how the eight fake rows came about.
- **Promote `nbtc_code` to the primary key.** The original proposal. Rejected on the data:
  `nbtc_code` is null or blank on **83 of 221** stations (48 บริการธุรกิจ, 28 บริการสาธารณะ,
  5 บริการชุมชน, 2 สถานีหลัก), and 45 of those already carry inspection history. Filling the gap
  would mean inventing codes in the one column that is supposed to be authoritative.
- **Overwrite `id_fm`'s values with `nbtc_code`.** Rejected: it is a type change on the primary
  key, it rewrites 111 inspection rows, and it destroys the StationID that ADR 0002 depends on.

## Consequences

- **`id` is internal; `id_fm` and `nbtc_code` are what humans see.** `/api/stations/[id]` now
  takes the surrogate. `FMStation` gained an `idFm` field, and `utils/stationLabel.ts` is the one
  place that decides what identifier to print: `nbtc_code`, else `FM-<id_fm>`, else `—`. Showing
  `id` to a user would be showing them a row number.
- **Search matches on `id_fm`, not `id`.** Typing a StationID into the filter box still works;
  typing a surrogate id finds nothing, by design.
- **Scripts that join the register filter out `id_fm IS NULL`** (`sync-register`,
  `import-nbtc-stations`, `compare-register-by-type`). A station with no StationID cannot be
  matched to a register row by StationID, so it is excluded rather than allowed to reach the diff
  as a null.
- **Scripts that touch inspections now translate `id_fm` → `id`.** `import-inspections-xlsx`
  reads `รหัสสถานี` (a StationID) from the spreadsheet and maps it through `pkByIdFm` before
  writing `station_inspection.station_id`; `delete-buriram` collects surrogate ids. Getting this
  wrong writes inspections against the wrong station, and it type-checks silently, because
  `id_fm` is still a valid unique filter.
- **Creating a station is now an explicit act.** With no default on `id_fm`, there is no way to
  insert one by accident. `scripts/add-station.ts` is the supported path; it enforces the
  province scope and refuses a duplicate StationID or NBTC code.
- **ADR 0002 is unchanged in substance.** `id_fm` keeps every value it had, remains unique, and
  remains the register join key. Only its constraint changed.
