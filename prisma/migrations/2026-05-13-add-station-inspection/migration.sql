-- Adds per-inspection history with lead + helper tagging.
-- fm_station.date_inspected and inspection_69 stay (derived from this table by the app).

CREATE TABLE "station_inspection" (
  "id"            SERIAL PRIMARY KEY,
  "station_id"    INTEGER NOT NULL REFERENCES "fm_station"("id_fm"),
  "inspected_on"  DATE    NOT NULL,
  "lead_user_id"  INTEGER NOT NULL REFERENCES "user"("id"),
  "notes"         TEXT,
  "source"        TEXT    NOT NULL DEFAULT 'app',
  "created_at"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "station_inspection_unique"
    UNIQUE ("station_id", "inspected_on", "lead_user_id")
);
CREATE INDEX "station_inspection_station_inspected_on_idx"
  ON "station_inspection" ("station_id", "inspected_on" DESC);
CREATE INDEX "station_inspection_lead_user_id_idx"
  ON "station_inspection" ("lead_user_id");

CREATE TABLE "station_inspection_member" (
  "inspection_id" INTEGER NOT NULL
    REFERENCES "station_inspection"("id") ON DELETE CASCADE,
  "user_id"       INTEGER NOT NULL REFERENCES "user"("id"),
  "role"          TEXT    NOT NULL DEFAULT 'helper',
  PRIMARY KEY ("inspection_id", "user_id")
);
CREATE INDEX "station_inspection_member_user_id_idx"
  ON "station_inspection_member" ("user_id");

-- Deactivate the `aom` placeholder user (no xlsx mapping, never used).
UPDATE "user" SET active = false WHERE username = 'aom';
