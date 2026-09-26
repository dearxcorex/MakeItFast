-- Change log for the admin Data tab: one row per add / edit / delete on
-- fm_station, carrying the row before and after. Additive only, so it is safe
-- to apply to the shared Neon DB before the code that writes it is deployed.
CREATE TABLE "data_change" (
  "id"         SERIAL PRIMARY KEY,
  "table_name" TEXT NOT NULL,
  "row_id"     INTEGER NOT NULL,
  "action"     TEXT NOT NULL,
  "user_id"    INTEGER NOT NULL REFERENCES "user"("id"),
  "before"     JSONB,
  "after"      JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "data_change_table_name_row_id_idx" ON "data_change"("table_name", "row_id");
CREATE INDEX "data_change_created_at_idx" ON "data_change"("created_at");
