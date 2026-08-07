-- Removes the "default crew" feature (MY CREW / SOLO header control).
-- Per-inspection teammate tagging is unaffected: it stores helpers in
-- station_inspection_member / interference_inspection_member, not here.
ALTER TABLE "user"
  DROP COLUMN "default_helper_user_ids",
  DROP COLUMN "crew_decided";
