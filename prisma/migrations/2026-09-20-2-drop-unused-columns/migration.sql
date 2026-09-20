-- Drop columns that nothing in the app, the scripts, or the Discord runtime reads.
--
-- RUN THIS AFTER the code that no longer names these columns is deployed.
-- Prisma selects every scalar by default, so the moment a column disappears the
-- still-running FieldOpsFetcher.findMany() throws on every page load. Adding a
-- column is database-first; dropping one is code-first.
--
-- All 15 interference_site columns below were mapped by convertToInterferenceSite
-- and consumed by nothing -- they were serialized into the RSC payload sent to
-- every browser on every page load and then dropped on the floor.

BEGIN;

-- fm_station -----------------------------------------------------------------
-- note: 1 non-null row, and its value is the empty string. Never rendered; no
--   writer in scripts/; reachable only by a hand-crafted PATCH.
-- inspection_68: last season's flag. Mapped, never displayed, never sent by any
--   client. Inspection history lives in station_inspection.
ALTER TABLE "fm_station" DROP COLUMN "note";
ALTER TABLE "fm_station" DROP COLUMN "inspection_68";

-- interference_site ----------------------------------------------------------
-- This index backs no query in the codebase; it goes with its column.
DROP INDEX IF EXISTS "interference_site_nbtc_area_idx";

ALTER TABLE "interference_site"
  DROP COLUMN "mc_zone",
  DROP COLUMN "day_time",
  DROP COLUMN "night_time",
  DROP COLUMN "nbtc_area",
  DROP COLUMN "awn_contact",
  DROP COLUMN "lot",
  DROP COLUMN "on_site_scan_by",
  DROP COLUMN "on_site_scan_date",
  DROP COLUMN "check_realtime",
  DROP COLUMN "source_location_1",
  DROP COLUMN "source_location_2",
  DROP COLUMN "camera_model_1",
  DROP COLUMN "camera_model_2",
  DROP COLUMN "notes",
  DROP COLUMN "created_at";

-- updated_at stays: dedupeInterference.ts sorts siblings newest-first on it to
-- decide which duplicate row becomes the visible map pin.

COMMIT;
