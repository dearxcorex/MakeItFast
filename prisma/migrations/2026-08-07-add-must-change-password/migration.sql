-- Admin-issued passwords are one-time: the recipient must replace the password
-- an admin set for them before they can use the app. Existing users are
-- unaffected (default false) since their current password is self-chosen.
ALTER TABLE "user"
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
