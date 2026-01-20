-- Verification queries for migration 015
-- Run these in Supabase SQL Editor to confirm everything worked

-- 1. Count geo_districts
SELECT count(*) as total_districts FROM geo_districts;
-- Expected: Should match distinct districts in geo_sector_signals

-- 2. Sample districts to verify they're real postcodes (not D0001)
SELECT district, centroid_lat, centroid_lng
FROM geo_districts
ORDER BY district
LIMIT 20;
-- Expected: Should see real postcode patterns like AB12, AL1, B1, RG1, etc. (NOT D0001)

-- 3. Count distinct districts in geo_district_signals for home_movers
SELECT count(DISTINCT district) as distinct_districts
FROM geo_district_signals
WHERE segment_key='home_movers';
-- Expected: Should match or be close to geo_districts count

-- 4. Missing join count for home_movers (should be 0 or very close)
SELECT count(*) as missing_join_count
FROM (
  SELECT DISTINCT s.district
  FROM geo_district_signals s
  LEFT JOIN geo_districts d ON d.district = s.district
  WHERE s.segment_key='home_movers' AND d.district IS NULL
) x;
-- Expected: 0 (or very close to 0)

-- 5. Verify centroid bounds are within UK
SELECT 
  min(centroid_lat) as min_lat,
  max(centroid_lat) as max_lat,
  min(centroid_lng) as min_lng,
  max(centroid_lng) as max_lng
FROM geo_districts;
-- Expected: min_lat ~50.7, max_lat ~59.5, min_lng ~-8.6, max_lng ~1.9

-- 6. Check district code normalization (should all be uppercase, no spaces)
SELECT district
FROM geo_districts
WHERE district != UPPER(REGEXP_REPLACE(TRIM(district), '\s+', '', 'g'))
LIMIT 10;
-- Expected: 0 rows (all districts should be normalized)
