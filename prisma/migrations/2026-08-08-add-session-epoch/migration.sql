-- Session revocation counter. Bumped on every password write; sessions carry
-- the value they were issued under, so anything minted before a reset stops
-- authenticating. Existing rows start at 0, which matches the default sealed
-- into sessions issued before this column existed.
ALTER TABLE "user"
  ADD COLUMN "session_epoch" INTEGER NOT NULL DEFAULT 0;
