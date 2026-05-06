-- Add license-permit text (e.g. new license holder for revoked stations).
ALTER TABLE "fm_station" ADD COLUMN "permit" TEXT;
