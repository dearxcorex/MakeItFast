-- id_fm becomes the identifier printed on the licence: the NBTC code where the
-- station has one, its old register StationID where it does not.
--
-- This is the change ADR 0003 rejected ("Overwrite id_fm's values with
-- nbtc_code"). Two of the three objections died with
-- 2026-09-20-1-fm-station-surrogate-id: id_fm is no longer the primary key, and
-- station_inspection points at the surrogate id, so nothing is rewritten by
-- this. The third one --
-- that overwriting destroys the StationID ADR 0002 joins the register on -- is
-- answered here by moving that number to register_station_id first, so the
-- register scripts keep an exact integer key to join on.
--
-- ORDERING: this is a TYPE change on a column the deployed Prisma client
-- selects on every page load, so it is backward-incompatible in both
-- directions -- an Int client reading text throws, and so does a String client
-- reading an integer. Apply it and deploy the matching code back to back; there
-- is no window in which both shapes work. See the shared-Neon-DB note.

BEGIN;

-- 1. Preserve the register StationID before id_fm stops being a number.
--    Unique-when-present, exactly the constraint id_fm carried: it is still one
--    row per StationID, and NULL still means "not in the register yet".
ALTER TABLE "fm_station" ADD COLUMN "register_station_id" INTEGER;

UPDATE "fm_station" SET "register_station_id" = "id_fm";

CREATE UNIQUE INDEX "fm_station_register_station_id_key"
  ON "fm_station" ("register_station_id");

-- 2. id_fm becomes text. The USING cast keeps every existing StationID as its
--    own digits ('5520003'), which is what a station with no NBTC code shows.
--    The unique index is rebuilt by the type change; it does not need dropping.
ALTER TABLE "fm_station" ALTER COLUMN "id_fm" TYPE TEXT USING "id_fm"::text;

-- 3. Wherever there is an NBTC code, it wins. Blank and NULL codes are left
--    alone, so those rows keep the StationID they already had -- "if not have
--    id on nbtc_code stay same id".
UPDATE "fm_station"
   SET "id_fm" = btrim("nbtc_code")
 WHERE btrim(coalesce("nbtc_code", '')) <> '';

-- Guard: every non-blank code must now be in id_fm, and the StationID must have
-- survived on every row that had one. Either failure aborts the whole thing.
DO $$
DECLARE missing INT; lost INT;
BEGIN
  SELECT count(*) INTO missing
    FROM "fm_station"
   WHERE btrim(coalesce("nbtc_code", '')) <> ''
     AND "id_fm" IS DISTINCT FROM btrim("nbtc_code");
  IF missing > 0 THEN
    RAISE EXCEPTION '% row(s) with an nbtc_code did not take it into id_fm', missing;
  END IF;

  SELECT count(*) INTO lost
    FROM "fm_station"
   WHERE "register_station_id" IS NULL
     AND "id_fm" ~ '^[0-9]+$';
  IF lost > 0 THEN
    RAISE EXCEPTION '% row(s) kept a numeric id_fm but lost register_station_id', lost;
  END IF;
END $$;

COMMIT;
