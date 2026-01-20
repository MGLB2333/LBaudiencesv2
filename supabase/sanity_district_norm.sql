-- Sanity checks for district normalization
-- Run this after applying migration 023_district_normalization.sql
-- Verifies that district_norm columns are populated and matching works correctly

-- ============================================
-- 1. Check district_norm Population Status
-- ============================================

-- Count rows with NULL district_norm (should be 0 or very few after backfill)
SELECT 
  'geo_districts' as table_name,
  COUNT(*) as total_rows,
  COUNT(district_norm) as rows_with_norm,
  COUNT(*) - COUNT(district_norm) as rows_without_norm
FROM geo_districts
UNION ALL
SELECT 
  'geo_sector_signals',
  COUNT(*),
  COUNT(district_norm),
  COUNT(*) - COUNT(district_norm)
FROM geo_sector_signals
UNION ALL
SELECT 
  'district_tv_regions',
  COUNT(*),
  COUNT(district_norm),
  COUNT(*) - COUNT(district_norm)
FROM district_tv_regions
UNION ALL
SELECT 
  'district_neighbors (district)',
  COUNT(*),
  COUNT(district_norm),
  COUNT(*) - COUNT(district_norm)
FROM district_neighbors
UNION ALL
SELECT 
  'district_neighbors (neighbor_district)',
  COUNT(*),
  COUNT(neighbor_district_norm),
  COUNT(*) - COUNT(neighbor_district_norm)
FROM district_neighbors;

-- ============================================
-- 2. Matching Districts Using district_norm
-- ============================================

-- Count matching districts between geo_districts and district_tv_regions using district_norm
SELECT 
  COUNT(*) as matching_districts_using_norm
FROM district_tv_regions dtr
INNER JOIN geo_districts gd ON dtr.district_norm = gd.district_norm
WHERE dtr.district_norm IS NOT NULL AND gd.district_norm IS NOT NULL;

-- Count matching districts using raw district column (for comparison)
SELECT 
  COUNT(*) as matching_districts_using_raw
FROM district_tv_regions dtr
INNER JOIN geo_districts gd ON dtr.district = gd.district;

-- ============================================
-- 3. Mismatched Districts (using district_norm)
-- ============================================

-- Districts in district_tv_regions that don't match geo_districts using district_norm
SELECT 
  COUNT(*) as mismatched_districts_using_norm
FROM district_tv_regions dtr
LEFT JOIN geo_districts gd ON dtr.district_norm = gd.district_norm
WHERE dtr.district_norm IS NOT NULL 
  AND gd.district_norm IS NULL;

-- Sample mismatches (first 20)
SELECT 
  dtr.district as dtr_district_raw,
  dtr.district_norm as dtr_district_norm,
  dtr.region_key,
  tr.name as region_name
FROM district_tv_regions dtr
LEFT JOIN geo_districts gd ON dtr.district_norm = gd.district_norm
LEFT JOIN tv_regions tr ON dtr.region_key = tr.region_key
WHERE dtr.district_norm IS NOT NULL 
  AND gd.district_norm IS NULL
ORDER BY dtr.district
LIMIT 20;

-- ============================================
-- 4. Districts That Match Using Norm But Not Raw
-- ============================================

-- Districts that only match when using district_norm (shows normalization is working)
SELECT 
  dtr.district as dtr_district_raw,
  dtr.district_norm as dtr_district_norm,
  gd.district as gd_district_raw,
  gd.district_norm as gd_district_norm,
  dtr.district != gd.district as raw_mismatch
FROM district_tv_regions dtr
INNER JOIN geo_districts gd ON dtr.district_norm = gd.district_norm
WHERE dtr.district != gd.district  -- Raw columns don't match
ORDER BY dtr.district
LIMIT 20;

-- ============================================
-- 5. Normalization Examples (showing normalization in action)
-- ============================================

-- Show examples where normalization changed the value
SELECT 
  district as original,
  district_norm as normalized,
  district != district_norm as was_changed
FROM geo_districts
WHERE district_norm IS NOT NULL
  AND district != district_norm
ORDER BY district
LIMIT 20;

-- ============================================
-- 6. Check for Duplicate district_norm Values
-- ============================================

-- In geo_districts (should be 0 - district is PK, so district_norm should be unique too)
SELECT 
  district_norm,
  COUNT(*) as count,
  array_agg(district) as raw_districts
FROM geo_districts
WHERE district_norm IS NOT NULL
GROUP BY district_norm
HAVING COUNT(*) > 1
LIMIT 20;

-- ============================================
-- 7. Neighbor Relationships Using district_norm
-- ============================================

-- Count neighbor relationships where both districts have district_norm populated
SELECT 
  COUNT(*) as relationships_with_norm,
  COUNT(*) FILTER (WHERE district_norm IS NOT NULL AND neighbor_district_norm IS NOT NULL) as both_have_norm
FROM district_neighbors;

-- Sample neighbor relationships using district_norm
SELECT 
  dn.district as district_raw,
  dn.district_norm,
  dn.neighbor_district as neighbor_raw,
  dn.neighbor_district_norm,
  dn.relationship
FROM district_neighbors dn
WHERE dn.district_norm IS NOT NULL 
  AND dn.neighbor_district_norm IS NOT NULL
ORDER BY dn.district_norm
LIMIT 20;

-- ============================================
-- 8. Self-Link Check Using district_norm
-- ============================================

-- Should be 0 (same as raw check, but using normalized columns)
SELECT COUNT(*) as self_link_count_using_norm
FROM district_neighbors
WHERE district_norm IS NOT NULL 
  AND neighbor_district_norm IS NOT NULL
  AND district_norm = neighbor_district_norm;

-- ============================================
-- 9. Normalization Function Test
-- ============================================

-- Test the normalize_district function with various inputs
SELECT 
  'AB1' as input,
  normalize_district('AB1') as normalized
UNION ALL
SELECT 'AB 1', normalize_district('AB 1')
UNION ALL
SELECT 'ab1', normalize_district('ab1')
UNION ALL
SELECT '  AB1  ', normalize_district('  AB1  ')
UNION ALL
SELECT 'AB' || CHR(160) || '1', normalize_district('AB' || CHR(160) || '1')  -- Non-breaking space
UNION ALL
SELECT 'AB' || CHR(9) || '1', normalize_district('AB' || CHR(9) || '1')  -- Tab
UNION ALL
SELECT NULL, normalize_district(NULL);

-- ============================================
-- 10. Coverage: Districts in geo_districts vs district_tv_regions
-- ============================================

-- How many geo_districts have TV region mappings (using district_norm)
SELECT 
  COUNT(DISTINCT gd.district_norm) as geo_districts_with_tv_region,
  COUNT(DISTINCT gd.district_norm) FILTER (WHERE dtr.district_norm IS NOT NULL) as mapped_districts,
  COUNT(DISTINCT gd.district_norm) FILTER (WHERE dtr.district_norm IS NULL) as unmapped_districts
FROM geo_districts gd
LEFT JOIN district_tv_regions dtr ON gd.district_norm = dtr.district_norm;
