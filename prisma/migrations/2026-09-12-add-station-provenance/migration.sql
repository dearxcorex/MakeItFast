-- Provenance for fm_station rows, so script-inserted stations stay identifiable.
--
-- Mirrors what station_inspection.source already does. Deliberately nullable with
-- NO default: existing rows predate provenance tracking and must read NULL rather
-- than be backfilled with a timestamp that would be a lie.
--
-- nbtc_code holds the NBTC OPER station code (e.g. 'RFXL680018'). It is NOT an
-- identifier we can join on -- the register leaves it blank for some stations, and
-- it belongs to a different code system than id_fm (e.g. 5520392). Recorded so a
-- second import run can match rows that do carry one.
ALTER TABLE "fm_station" ADD COLUMN "nbtc_code" TEXT;
ALTER TABLE "fm_station" ADD COLUMN "source" TEXT;
ALTER TABLE "fm_station" ADD COLUMN "created_at" TIMESTAMP(3);

CREATE INDEX "fm_station_nbtc_code_idx" ON "fm_station"("nbtc_code");
CREATE INDEX "fm_station_source_idx" ON "fm_station"("source");
