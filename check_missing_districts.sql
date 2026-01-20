-- Diagnostic query to find districts in signals that don't have centroids
-- Run this in Supabase SQL Editor to see which districts are missing

-- 1. Count missing districts by segment
SELECT 
  s.segment_key,
  count(DISTINCT s.district) as signal_districts,
  count(DISTINCT CASE WHEN d.district IS NOT NULL THEN s.district END) as has_centroid,
  count(DISTINCT CASE WHEN d.district IS NULL THEN s.district END) as missing_centroid
FROM geo_district_signals s
LEFT JOIN geo_districts d ON d.district = s.district
GROUP BY s.segment_key
ORDER BY s.segment_key;

-- 2. Sample missing districts for home_movers
SELECT DISTINCT s.district
FROM geo_district_signals s
LEFT JOIN geo_districts d ON d.district = s.district
WHERE s.segment_key = 'home_movers' 
  AND d.district IS NULL
ORDER BY s.district
LIMIT 50;

-- 3. Check if normalization is the issue
-- Compare raw district codes vs normalized
SELECT 
  s.district as signal_district_raw,
  UPPER(REGEXP_REPLACE(TRIM(s.district), '\s+', '', 'g')) as signal_district_normalized,
  d.district as geo_district,
  CASE WHEN d.district IS NULL THEN 'MISSING' ELSE 'FOUND' END as status
FROM geo_district_signals s
LEFT JOIN geo_districts d ON d.district = UPPER(REGEXP_REPLACE(TRIM(s.district), '\s+', '', 'g'))
WHERE s.segment_key = 'home_movers'
  AND d.district IS NULL
LIMIT 20;

-- 4. Check district code patterns in signals vs geo_districts
SELECT 
  'Signals' as source,
  count(*) as total,
  count(DISTINCT district) as unique_districts,
  string_agg(DISTINCT LEFT(district, 2), ', ' ORDER BY LEFT(district, 2)) as sample_prefixes
FROM geo_district_signals
WHERE segment_key = 'home_movers'
UNION ALL
SELECT 
  'Geo Districts' as source,
  count(*) as total,
  count(DISTINCT district) as unique_districts,
  string_agg(DISTINCT LEFT(district, 2), ', ' ORDER BY LEFT(district, 2)) as sample_prefixes
FROM geo_districts;
