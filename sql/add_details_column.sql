-- Add details column to fm_station table for storing hashtags
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE fm_station
ADD COLUMN details TEXT;

-- Add a comment to describe the column
COMMENT ON COLUMN fm_station.details IS 'Stores hashtags like #deviation, #intermod for station details';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fm_station' AND column_name = 'details';