-- Give fm_station a surrogate primary key and demote id_fm to an ordinary column.
--
-- id_fm is the NBTC register's StationID (ADR 0002). It stays the register join
-- key and keeps every value it has -- it simply stops being the primary key, so
-- that a station we add before it appears in the register can carry no StationID
-- at all instead of being given an invented one. See ADR 0003.
--
-- Note the existing FK is ON UPDATE CASCADE: it must be dropped before id_fm is
-- touched, or NULLing a StationID would cascade a NULL into the NOT NULL column
-- station_inspection.station_id and abort the migration.

BEGIN;

-- 1. The surrogate key. SERIAL backfills every existing row.
ALTER TABLE "fm_station" ADD COLUMN "id" SERIAL;

-- 2. Re-point the inspection FK from id_fm values onto the new id values.
ALTER TABLE "station_inspection" DROP CONSTRAINT "station_inspection_station_id_fkey";

UPDATE "station_inspection" si
   SET "station_id" = f."id"
  FROM "fm_station" f
 WHERE f."id_fm" = si."station_id";

-- Every inspection must have landed on a station. Abort if one did not.
DO $$
DECLARE orphans INT;
BEGIN
  SELECT count(*) INTO orphans
    FROM "station_inspection" si
    LEFT JOIN "fm_station" f ON f."id" = si."station_id"
   WHERE f."id" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'station_inspection has % row(s) with no matching fm_station.id', orphans;
  END IF;
END $$;

-- 3. Swap the primary key over.
ALTER TABLE "fm_station" DROP CONSTRAINT "fm_station_pkey";
ALTER TABLE "fm_station" ADD CONSTRAINT "fm_station_pkey" PRIMARY KEY ("id");

ALTER TABLE "station_inspection"
  ADD CONSTRAINT "station_inspection_station_id_fkey"
  FOREIGN KEY ("station_id") REFERENCES "fm_station"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- 4. id_fm becomes optional and unique-when-present. Dropping the default kills
--    the autoincrement that sat at 5,550,055 -- inside live StationID space, so
--    the next app insert would have minted a convincing fake. New rows must now
--    state their StationID explicitly or leave it NULL.
ALTER TABLE "fm_station" ALTER COLUMN "id_fm" DROP DEFAULT;
ALTER TABLE "fm_station" ALTER COLUMN "id_fm" DROP NOT NULL;
DROP SEQUENCE IF EXISTS "fm_station_id_fm_seq";

-- Plain UNIQUE, not partial: Postgres already treats NULLs as distinct, so this
-- permits many NULL StationIDs while forbidding a duplicate real one -- and it
-- matches what Prisma's @unique emits, so the schema does not read as drifted.
CREATE UNIQUE INDEX "fm_station_id_fm_key" ON "fm_station" ("id_fm");

-- 5. Eight สถานีหลัก rows were hand-numbered 1-11 back when the primary key had
--    to hold something. Those are not register StationIDs, and leaving them in
--    place lets pass 0 of the register diff match on a number that means nothing.
UPDATE "fm_station" SET "id_fm" = NULL WHERE "id_fm" < 1000000;

COMMIT;
