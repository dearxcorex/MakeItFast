-- The Discord webhook message that announced an inspection, so undoing the
-- inspection can delete it. Nullable: rows from before the notifier, and rows
-- whose post failed, have no message.
ALTER TABLE "station_inspection" ADD COLUMN "discord_message_id" TEXT;
ALTER TABLE "interference_inspection" ADD COLUMN "discord_message_id" TEXT;
