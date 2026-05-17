-- Add revoked-station tracking for NBTC license-revoke notices.
-- Both columns are nullable and default to safe values so existing rows
-- don't need a backfill before this migration is applied.
ALTER TABLE "fm_station"
  ADD COLUMN "revoked"      BOOLEAN DEFAULT FALSE,
  ADD COLUMN "revoked_note" TEXT;

CREATE INDEX "fm_station_revoked_idx" ON "fm_station" ("revoked");
