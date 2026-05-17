ALTER TABLE "user"
  ADD COLUMN "default_helper_user_ids" INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN "crew_decided" BOOLEAN NOT NULL DEFAULT false;
