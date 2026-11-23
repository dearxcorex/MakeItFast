-- Cameras that are a source of interference on cell sites. Additive only, so it
-- is safe to apply to the shared Neon DB before the code that reads it deploys.
-- It MUST be applied first: FieldOpsFetcher reads this table on every page load.
CREATE TABLE "camera_source" (
  "id"                  SERIAL PRIMARY KEY,
  "code"                TEXT NOT NULL,
  "lat"                 DOUBLE PRECISION NOT NULL,
  "long"                DOUBLE PRECISION NOT NULL,
  "found_on"            DATE NOT NULL,
  "district"            TEXT NOT NULL,
  "province"            TEXT NOT NULL,
  "landmark"            TEXT,
  "cell_site_code"      TEXT,
  "cell_site_name"      TEXT,
  "cell_site_lat"       DOUBLE PRECISION,
  "cell_site_long"      DOUBLE PRECISION,
  "cell_site_operators" TEXT,
  "status"              TEXT NOT NULL DEFAULT 'ยังไม่ตรวจ',
  "inspected_at"        TIMESTAMP(3),
  "inspected_by"        INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "camera_source_code_key" ON "camera_source"("code");
CREATE INDEX "camera_source_province_idx" ON "camera_source"("province");
CREATE INDEX "camera_source_status_idx" ON "camera_source"("status");
