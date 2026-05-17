CREATE TABLE "interference_inspection" (
  "id"              SERIAL PRIMARY KEY,
  "interference_id" INTEGER NOT NULL REFERENCES "interference_site"("id"),
  "inspected_on"    DATE NOT NULL,
  "lead_user_id"    INTEGER NOT NULL REFERENCES "user"("id"),
  "notes"           TEXT,
  "source"          TEXT NOT NULL DEFAULT 'app',
  "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMP NOT NULL,
  CONSTRAINT "interference_inspection_unique"
    UNIQUE ("interference_id", "inspected_on", "lead_user_id")
);
CREATE INDEX "interference_inspection_target_date_idx"
  ON "interference_inspection" ("interference_id", "inspected_on" DESC);
CREATE INDEX "interference_inspection_lead_idx"
  ON "interference_inspection" ("lead_user_id");

CREATE TABLE "interference_inspection_member" (
  "inspection_id" INTEGER NOT NULL REFERENCES "interference_inspection"("id") ON DELETE CASCADE,
  "user_id"       INTEGER NOT NULL REFERENCES "user"("id"),
  "role"          TEXT NOT NULL DEFAULT 'helper',
  PRIMARY KEY ("inspection_id", "user_id")
);
CREATE INDEX "interference_inspection_member_user_idx"
  ON "interference_inspection_member" ("user_id");
