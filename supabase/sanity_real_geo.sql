-- Sanity checks for real UK postcode district centroids
-- Run these queries in Supabase SQL Editor to verify data integrity

-- 1. Count districts
SELECT count(*) as total_districts 
FROM geo_districts;
-- Expected: ~3114 after import from district_latLong.csv

-- 2. Bounds check (should be UK: lat ~49-61, lng ~-9 to 3)
SELECT 
  min(centroid_lat) as min_lat, 
  max(centroid_lat) as max_lat,
  min(centroid_lng) as min_lng, 
  max(centroid_lng) as max_lng
FROM geo_districts;
-- Expected: min_lat ~49-50, max_lat ~60-61, min_lng ~-9 to -8, max_lng ~1-3

-- 3. Source distribution
SELECT source, count(*) as count 
FROM geo_districts 
GROUP BY source 
ORDER BY count DESC;
-- Expected: Most rows should have source='district_latLong.csv'

-- 4. Sample districts
SELECT district, centroid_lat, centroid_lng, source 
FROM geo_districts 
ORDER BY district 
LIMIT 20;
-- Expected: Real postcode districts (AB1, AL10, B1, etc.), not D0001-style synthetic codes

-- 5. Join success for one audience key (home_movers)
-- This checks how many signal districts have matching centroids
SELECT
  count(DISTINCT s.district) as signal_districts,
  count(DISTINCT d.district) as centroid_districts,
  count(DISTINCT CASE WHEN d.district IS NOT NULL THEN s.district END) as joined,
  count(DISTINCT CASE WHEN d.district IS NULL THEN s.district END) as missing_centroids
FROM geo_district_signals s
LEFT JOIN geo_districts d ON d.district = s.district
WHERE s.segment_key = 'home_movers';
-- Expected: joined should be close to signal_districts (missing_centroids should be near 0)

-- 6. Missing centroid sample (districts in signals but not in geo_districts)
SELECT s.district, s.provider, s.segment_key
FROM geo_district_signals s
LEFT JOIN geo_districts d ON d.district = s.district
WHERE s.segment_key = 'home_movers' 
  AND d.district IS NULL
ORDER BY s.district
LIMIT 50;
-- Expected: Should be empty or very few rows (all districts should have centroids)

-- 7. District code normalization check
-- Check if any districts have spaces or lowercase (should be normalized)
SELECT district 
FROM geo_districts 
WHERE district != UPPER(REGEXP_REPLACE(TRIM(district), '\s+', '', 'g'))
LIMIT 20;
-- Expected: Should return 0 rows (all districts should be normalized)

-- 8. Duplicate districts check (should be 0 due to PRIMARY KEY)
SELECT district, count(*) as count
FROM geo_districts
GROUP BY district
HAVING count(*) > 1;
-- Expected: Should return 0 rows (no duplicates)

-- 9. Districts with invalid coordinates
SELECT district, centroid_lat, centroid_lng
FROM geo_districts
WHERE centroid_lat < 49 OR centroid_lat > 61
   OR centroid_lng < -9 OR centroid_lng > 3;
-- Expected: Should return 0 rows (all coordinates should be within UK bounds)

-- 10. Districts by source (to verify import)
SELECT 
  source,
  count(*) as count,
  min(centroid_lat) as min_lat,
  max(centroid_lat) as max_lat,
  min(centroid_lng) as min_lng,
  max(centroid_lng) as max_lng
FROM geo_districts
GROUP BY source
ORDER BY count DESC;
