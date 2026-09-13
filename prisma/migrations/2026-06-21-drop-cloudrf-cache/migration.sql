-- Drop the CloudRF propagation cache. The CloudRF feature has been removed
-- from the application; no foreign keys reference this table.
DROP TABLE IF EXISTS "cloudrf_cache";
