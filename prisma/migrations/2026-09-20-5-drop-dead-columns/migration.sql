-- Drop three columns that are written but never read back.
--
-- ORDERING: narrowing, so DEPLOY FIRST, APPLY SECOND. The deployed Prisma
-- client selects every scalar by name, so each of these breaks the running app
-- the moment it disappears. Same rule as 2026-09-20-2-drop-unused-columns:
-- adding a column is database-first, dropping one is code-first. Local dev and
-- Vercel prod share this Neon database.
--
-- fm_station.created_at
--   Never mapped. convertToFMStation() hardcoded `createdAt: undefined`, so the
--   value could not reach a component even in principle. 33 of 221 rows carry
--   one and all 33 land inside a 12-minute window on 2026-09-13 -- the trace of
--   a single import run, not a row-creation audit trail. The three scripts that
--   wrote it (import-nbtc-stations, sync-register, add-station) no longer do.
--
-- station_inspection_member.role / interference_inspection_member.role
--   Declared as if the join carried a crew hierarchy, but every writer passes
--   the literal 'helper' and there is no second value anywhere: 18 of 18 and
--   3 of 3 rows read 'helper'. Nothing selects the column back -- the lead is
--   already modelled separately as station_inspection.lead_user_id, so the
--   member table means "helper" by construction and the column restated it.

BEGIN;

ALTER TABLE "fm_station" DROP COLUMN "created_at";

ALTER TABLE "station_inspection_member" DROP COLUMN "role";
ALTER TABLE "interference_inspection_member" DROP COLUMN "role";

COMMIT;
