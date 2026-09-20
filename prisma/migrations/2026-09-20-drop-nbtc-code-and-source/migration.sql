-- Drop fm_station.nbtc_code and fm_station.source.
--
-- nbtc_code is dead weight since 2026-09-20-id-fm-holds-nbtc-code: that
-- migration copied every non-blank code into id_fm, and all 138 rows that had
-- one still read id_fm = nbtc_code. Two columns holding the same string is one
-- more than the number of places a code can be edited without drifting.
--
-- source was an import-provenance tag (33 rows carry 'nbtc_oper_2569_09', 188
-- are NULL). It is written by the import scripts and read by nothing -- its
-- only real use was the "undo: DELETE FROM fm_station WHERE source = '<tag>'"
-- line those scripts print. They now print the inserted ids instead, which is
-- an exact undo rather than a tag that goes stale on the next import.
--
-- ORDERING: narrowing. The deployed Prisma client selects every scalar, so it
-- asks for both columns by name and breaks the moment they are gone. Deploy the
-- code that no longer knows about them FIRST, then apply this. See the
-- shared-Neon-DB note: local and prod are the same database.

BEGIN;

-- Guard: never drop a code that is not already in id_fm.
DO $$
DECLARE orphaned INT;
BEGIN
  SELECT count(*) INTO orphaned
    FROM "fm_station"
   WHERE btrim(coalesce("nbtc_code", '')) <> ''
     AND "id_fm" IS DISTINCT FROM btrim("nbtc_code");
  IF orphaned > 0 THEN
    RAISE EXCEPTION '% row(s) hold an nbtc_code that is not in id_fm -- dropping it would lose the code', orphaned;
  END IF;
END $$;

DROP INDEX IF EXISTS "fm_station_nbtc_code_idx";
DROP INDEX IF EXISTS "fm_station_source_idx";

ALTER TABLE "fm_station" DROP COLUMN "nbtc_code";
ALTER TABLE "fm_station" DROP COLUMN "source";

COMMIT;
