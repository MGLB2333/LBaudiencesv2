-- Migration: Rebuild geo_districts from real postcode districts in geo_district_signals
-- This ensures geo_districts contains actual district codes (AB12, AL1, B1) not synthetic ones (D0001)

-- A) Normalize district codes in geo_sector_signals (the base table, not the view)
UPDATE geo_sector_signals
SET district = UPPER(REGEXP_REPLACE(TRIM(district), '\s+', '', 'g'))
WHERE district IS NOT NULL;

-- B) Normalize district codes in geo_districts (before rebuild)
UPDATE geo_districts
SET district = UPPER(REGEXP_REPLACE(TRIM(district), '\s+', '', 'g'))
WHERE district IS NOT NULL;

-- C) Ensure centroid columns exist and make geometry nullable
ALTER TABLE geo_districts
ADD COLUMN IF NOT EXISTS centroid_lng double precision,
ADD COLUMN IF NOT EXISTS centroid_lat double precision;

-- Make geometry nullable (we're not storing geometry for now, just centroids)
ALTER TABLE geo_districts
ALTER COLUMN geometry DROP NOT NULL;

-- D) Rebuild geo_districts from geo_sector_signals (use base table, not view)
-- Use DELETE instead of TRUNCATE to avoid foreign key constraint issues
DELETE FROM geo_districts;

-- Insert one row per distinct district with deterministic centroids
-- Use geo_sector_signals (base table) to get distinct districts
-- Improved distribution: cluster around major UK cities to avoid sea coverage
INSERT INTO geo_districts (district, centroid_lat, centroid_lng, geometry, created_at)
SELECT DISTINCT
  district,
  -- Generate deterministic centroid using MD5 hash with weighted distribution
  -- Cluster around major UK cities to avoid sea coverage
  -- Major UK city centers (lat, lng):
  -- London: 51.5074, -0.1278
  -- Birmingham: 52.4862, -1.8904
  -- Manchester: 53.4808, -2.2426
  -- Leeds: 53.8008, -1.5491
  -- Glasgow: 55.8642, -4.2518
  -- Edinburgh: 55.9533, -3.1883
  -- Liverpool: 53.4084, -2.9916
  -- Bristol: 51.4545, -2.5879
  -- Newcastle: 54.9783, -1.6178
  -- Sheffield: 53.3811, -1.4701
  -- Use hash to select city cluster, then add small random offset
  CASE 
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 0 THEN 51.5074 -- London
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 1 THEN 52.4862 -- Birmingham
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 2 THEN 53.4808 -- Manchester
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 3 THEN 53.8008 -- Leeds
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 4 THEN 55.8642 -- Glasgow
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 5 THEN 55.9533 -- Edinburgh
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 6 THEN 53.4084 -- Liverpool
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 7 THEN 51.4545 -- Bristol
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 8 THEN 54.9783 -- Newcastle
    ELSE 53.3811 -- Sheffield
  END + (
    -- Add small random offset within ~50km radius (roughly 0.45 degrees)
    (('x' || SUBSTRING(MD5(district || ':lat'), 1, 8))::bit(32)::bigint::double precision / 4294967296.0 - 0.5) * 0.9
  ) as centroid_lat,
  CASE 
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 0 THEN -0.1278 -- London
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 1 THEN -1.8904 -- Birmingham
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 2 THEN -2.2426 -- Manchester
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 3 THEN -1.5491 -- Leeds
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 4 THEN -4.2518 -- Glasgow
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 5 THEN -3.1883 -- Edinburgh
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 6 THEN -2.9916 -- Liverpool
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 7 THEN -2.5879 -- Bristol
    WHEN (('x' || SUBSTRING(MD5(district || ':city'), 1, 8))::bit(32)::bigint % 10) = 8 THEN -1.6178 -- Newcastle
    ELSE -1.4701 -- Sheffield
  END + (
    -- Add small random offset within ~50km radius
    (('x' || SUBSTRING(MD5(district || ':lng'), 1, 8))::bit(32)::bigint::double precision / 4294967296.0 - 0.5) * 0.9
  ) as centroid_lng,
  NULL::jsonb as geometry, -- No geometry for now
  NOW() as created_at
FROM geo_sector_signals
WHERE district IS NOT NULL AND district != '';

-- Ensure PRIMARY KEY constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'geo_districts_pkey'
  ) THEN
    ALTER TABLE geo_districts ADD PRIMARY KEY (district);
  END IF;
END $$;

-- Make centroids NOT NULL after population
ALTER TABLE geo_districts
ALTER COLUMN centroid_lng SET NOT NULL,
ALTER COLUMN centroid_lat SET NOT NULL;

-- Post-check queries (run these in Supabase SQL Editor to verify):

-- 1. Count geo_districts
-- SELECT count(*) as total_districts FROM geo_districts;
-- Expected: Should match distinct districts in geo_district_signals

-- 2. Count distinct districts in geo_district_signals for home_movers
-- SELECT count(DISTINCT district) as distinct_districts
-- FROM geo_district_signals
-- WHERE segment_key='home_movers';
-- Expected: Should match or be close to geo_districts count

-- 3. Missing join count for home_movers (should be 0 or very close)
-- SELECT count(*) as missing_join_count
-- FROM (
--   SELECT DISTINCT s.district
--   FROM geo_district_signals s
--   LEFT JOIN geo_districts d ON d.district = s.district
--   WHERE s.segment_key='home_movers' AND d.district IS NULL
-- ) x;
-- Expected: 0 (or very close to 0)

-- 4. Sample districts to verify they're real postcodes
-- SELECT district, centroid_lat, centroid_lng
-- FROM geo_districts
-- ORDER BY district
-- LIMIT 20;
-- Expected: Should see real postcode patterns like AB12, AL1, B1, etc. (not D0001)

-- 5. Verify centroid bounds are within UK
-- SELECT 
--   min(centroid_lat) as min_lat,
--   max(centroid_lat) as max_lat,
--   min(centroid_lng) as min_lng,
--   max(centroid_lng) as max_lng
-- FROM geo_districts;
-- Expected: min_lat ~50.7, max_lat ~59.5, min_lng ~-8.6, max_lng ~1.9
