-- Sanity checks for geo_districts.households
-- Run these queries in Supabase SQL Editor to verify household data integrity

-- ============================================
-- 1. Count districts with households populated
-- ============================================
SELECT 
  COUNT(*) as total_districts,
  COUNT(households) as districts_with_households,
  COUNT(*) - COUNT(households) as districts_missing_households,
  ROUND(100.0 * COUNT(households) / COUNT(*), 2) as pct_with_households
FROM geo_districts;
-- Expected: Most districts should have households populated after import

-- ============================================
-- 2. Min/Max/Avg household counts
-- ============================================
SELECT 
  MIN(households) as min_households,
  MAX(households) as max_households,
  ROUND(AVG(households), 0) as avg_households,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY households), 0) as median_households,
  COUNT(*) as districts_with_households
FROM geo_districts
WHERE households IS NOT NULL;
-- Expected: Reasonable UK postcode district household counts (typically 1,000-50,000)
-- Typical UK postcode districts: 1,000-50,000 households
-- Large urban areas (London): 10,000-50,000
-- Small rural areas: 1,000-5,000

-- ============================================
-- 3. Sample districts with household data
-- ============================================
SELECT 
  district,
  households,
  centroid_lat,
  centroid_lng
FROM geo_districts
WHERE households IS NOT NULL
ORDER BY households DESC
LIMIT 20;
-- Expected: Real postcode districts with varying household counts
-- Top districts should be major urban areas (London, Manchester, Birmingham, etc.)

-- ============================================
-- 3b. Spot check: Verify specific districts match CSV
-- ============================================
-- Check a few known districts to verify import correctness
SELECT 
  district,
  households,
  CASE 
    WHEN households BETWEEN 1000 AND 50000 THEN 'OK'
    WHEN households > 100000 THEN '⚠️  TOO HIGH'
    WHEN households < 100 THEN '⚠️  TOO LOW'
    ELSE 'CHECK'
  END as validation_status
FROM geo_districts
WHERE district IN ('E1', 'E2', 'SW1', 'SW2', 'M1', 'M2', 'B1', 'B2', 'AL1', 'AL2')
ORDER BY district;
-- Expected: All should show 'OK' status (1,000-50,000 range)

-- ============================================
-- 4. Sample districts missing household data
-- ============================================
SELECT 
  district,
  centroid_lat,
  centroid_lng
FROM geo_districts
WHERE households IS NULL
ORDER BY district
LIMIT 20;
-- Expected: Districts not in district_mapping.csv (will use fallback constant)

-- ============================================
-- 5. Quick check: Sum households for known districts
-- ============================================
-- Test with a sample set of districts (e.g., London area)
SELECT 
  COUNT(*) as district_count,
  SUM(households) as total_households,
  SUM(COALESCE(households, 2500)) as total_with_fallback,
  ROUND(AVG(households), 0) as avg_households_per_district
FROM geo_districts
WHERE district IN ('E1', 'E2', 'E3', 'E4', 'E5', 'SW1', 'SW2', 'SW3', 'SW4', 'SW5', 'W1', 'W2', 'W3', 'W4', 'W5');
-- Expected: Sum should be reasonable for these London districts
-- London districts typically have 10,000-30,000 households each

-- ============================================
-- 6. Validation: Ensure no negative or zero households
-- ============================================
SELECT 
  COUNT(*) as invalid_households,
  string_agg(district, ', ' ORDER BY district) as invalid_districts
FROM geo_districts
WHERE households IS NOT NULL AND (households <= 0);
-- Expected: 0 (all household values should be positive)

-- ============================================
-- 6b. Check for suspiciously high values (possible parsing errors)
-- ============================================
SELECT 
  COUNT(*) as suspiciously_high_count,
  string_agg(district || ' (' || households || ')', ', ' ORDER BY households DESC) as high_value_districts
FROM geo_districts
WHERE households IS NOT NULL AND households > 200000;
-- Expected: 0 or very few (only major cities like London central districts might exceed 200k)
-- If many districts exceed 200k, check for comma parsing issues or wrong column import

-- ============================================
-- 7. Check staging table (if import was run)
-- ============================================
SELECT 
  COUNT(*) as staging_records
FROM district_households_staging;
-- Expected: Should match number of districts in district_mapping.csv with household data

-- ============================================
-- 8. Join check: Districts in signals vs households
-- ============================================
-- Check how many signal districts have household data
SELECT
  COUNT(DISTINCT s.district) as signal_districts,
  COUNT(DISTINCT CASE WHEN gd.households IS NOT NULL THEN s.district END) as signal_districts_with_households,
  COUNT(DISTINCT CASE WHEN gd.households IS NULL THEN s.district END) as signal_districts_missing_households,
  SUM(COALESCE(gd.households, 2500)) as estimated_total_households_with_fallback
FROM geo_district_signals s
LEFT JOIN geo_districts gd ON gd.district_norm = normalize_district(s.district)
WHERE s.segment_key = 'home_movers' -- Replace with your test segment
GROUP BY s.segment_key;
-- Expected: Most signal districts should have household data, fallback used for missing ones
