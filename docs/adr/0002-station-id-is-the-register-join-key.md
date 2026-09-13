---
status: accepted
---

# StationID is the register's join key, and the harvest goes through detail pages to get it

The NBTC register shows two codes for a station and only one of them identifies it here. The
`RFXL680018`-style รหัสสถานี in the search results belongs to a code system we do not use and is
blank on some rows; the inspection detail page's `StationID` (`05520331`) **is** `id_fm` 5520331
— verified against a live row, matching on name, frequency and byte-identical coordinates. So
the harvest pays one page fetch per inspection to read the detail page, and `buildDiff` joins on
that id first; the composite frequency/name/coordinate passes remain, but only as the fallback
for rows harvested without it.

## Considered options

- **Composite join only** (`freq + district`, then name, then proximity) — what we did before,
  because the results table looked like the only affordable source. It is inference: a station
  that changed frequency *and* moved district is reported as a new station plus a vanished one,
  and no pass can prove otherwise. Measured as collision-free across 61 ชัยภูมิ stations, which
  made it safe enough to ship but never exact.
- **Harvest the Excel export** — one request per district instead of one per row, 44 columns of
  inspection detail. Rejected: it carries neither coordinates nor `StationID`, so it can only
  ever feed the composite join.
- **Harvest the generated PDFs** — they do carry coordinates (242/242 checked). Rejected: 13–18s
  of server-side generation per station and a Thai text layout to parse, for data the detail
  page hands over in a hidden input.

## Consequences

- Everything keyed by `ChkID` is keyed by an **inspection**, not a station. A licensed station
  that has never been inspected has no detail page and is invisible to this harvest. Compare the
  harvest count against the register's own per-province count before trusting it as complete;
  the station picker on `FF11Chk.aspx?fno=add` remains the only complete enumeration of licensed
  stations, and `probe_station_modal.py` is the unfinished attempt at reaching it.
- Cost scales per inspection row rather than per district — hence the resumable
  `harvest_cache/<จังหวัด>.jsonl`, so an interrupted run is never re-fetched.
- `DiffRecord.matchedOn` now records which pass claimed each pair, so the CSV shows at a glance
  what was **known** (`station-id`) versus **inferred** (`freq-district` / `name` / `coords`).
- **Deferred, deliberately**: inserting a NEW station under the register's own `StationID` as its
  `id_fm`, instead of letting the sequence assign one. It would keep the two systems aligned
  forever, but an explicit id does not advance the Postgres sequence, so a later
  sequence-assigned insert could collide — and an `id_fm` is permanent once handed out. Until
  that is settled, a station inserted from a harvest joins on the composite passes next time, not
  on its id.
