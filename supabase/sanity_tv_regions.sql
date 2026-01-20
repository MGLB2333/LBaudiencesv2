-- Sanity checks for TV regions and district mapping import
-- Run this after importing district_mapping.csv to verify data integrity

-- ============================================
-- 1. Count Records
-- ============================================

SELECT 'TV Regions' as table_name, COUNT(*) as row_count FROM tv_regions
UNION ALL
SELECT 'District TV Region Mappings', COUNT(*) FROM district_tv_regions
UNION ALL
SELECT 'District Neighbors', COUNT(*) FROM district_neighbors;

-- ============================================
-- 2. Top 15 Regions by District Count
-- ============================================

SELECT 
  tr.name,
  tr.region_key,
  COUNT(dtr.district) as district_count
FROM tv_regions tr
LEFT JOIN district_tv_regions dtr ON tr.region_key = dtr.region_key
GROUP BY tr.id, tr.name, tr.region_key
ORDER BY district_count DESC
LIMIT 15;

-- ============================================
-- 3. Missing Districts Check (vs geo_districts)
-- ============================================

-- Count districts in mapping that don't exist in geo_districts
SELECT 
  COUNT(*) as missing_district_count
FROM district_tv_regions dtr
LEFT JOIN geo_districts gd ON dtr.district = gd.district
WHERE gd.district IS NULL;

-- Sample missing districts (first 20)
SELECT 
  dtr.district,
  dtr.region_key,
  tr.name as region_name
FROM district_tv_regions dtr
LEFT JOIN geo_districts gd ON dtr.district = gd.district
LEFT JOIN tv_regions tr ON dtr.region_key = tr.region_key
WHERE gd.district IS NULL
ORDER BY dtr.district
LIMIT 20;

-- ============================================
-- 4. Neighbor Self-Link Check (should be 0)
-- ============================================

SELECT COUNT(*) as self_link_count
FROM district_neighbors
WHERE district = neighbor_district;

-- ============================================
-- 5. Sample Neighbor Relationships
-- ============================================

-- Sample neighbor relationships
SELECT 
  dn.district,
  dn.neighbor_district,
  dn.relationship,
  dn.distance_km
FROM district_neighbors dn
ORDER BY dn.district
LIMIT 20;

-- ============================================
-- 6. Districts with Most Neighbors
-- ============================================

SELECT 
  district,
  COUNT(*) as neighbor_count
FROM district_neighbors
GROUP BY district
ORDER BY neighbor_count DESC
LIMIT 10;

-- ============================================
-- 7. Symmetry Check (symmetric graph analysis)
-- ============================================

-- Check how many edges have reverse edges (symmetric graph)
WITH edge_pairs AS (
  SELECT 
    dn1.district as a,
    dn1.neighbor_district as b,
    dn1.relationship,
    CASE WHEN dn2.district IS NOT NULL THEN 1 ELSE 0 END as has_reverse
  FROM district_neighbors dn1
  LEFT JOIN district_neighbors dn2 
    ON dn1.district = dn2.neighbor_district 
    AND dn1.neighbor_district = dn2.district
    AND dn1.relationship = dn2.relationship
)
SELECT 
  COUNT(*) as total_edges,
  SUM(has_reverse) as symmetric_edges,
  ROUND(100.0 * SUM(has_reverse) / COUNT(*), 2) as symmetry_percentage
FROM edge_pairs;

-- ============================================
-- 8. Sample Query: Get Neighbors for a District
-- ============================================

-- Example: Get neighbors for district 'AL1'
SELECT 
  dn.neighbor_district,
  dn.relationship,
  dn.distance_km,
  dtr.region_key,
  tr.name as region_name
FROM district_neighbors dn
LEFT JOIN district_tv_regions dtr ON dn.neighbor_district = dtr.district
LEFT JOIN tv_regions tr ON dtr.region_key = tr.region_key
WHERE dn.district = 'AL1'
ORDER BY dn.neighbor_district;

-- ============================================
-- 9. Districts with No Neighbors
-- ============================================

SELECT 
  dtr.district,
  dtr.region_key,
  tr.name as region_name
FROM district_tv_regions dtr
LEFT JOIN tv_regions tr ON dtr.region_key = tr.region_key
LEFT JOIN district_neighbors dn ON dtr.district = dn.district
WHERE dn.district IS NULL
ORDER BY dtr.district
LIMIT 20;

-- ============================================
-- 10. Region Coverage (districts per region)
-- ============================================

SELECT 
  tr.name,
  tr.region_key,
  COUNT(dtr.district) as district_count,
  COUNT(dn.district) as districts_with_neighbors
FROM tv_regions tr
LEFT JOIN district_tv_regions dtr ON tr.region_key = dtr.region_key
LEFT JOIN district_neighbors dn ON dtr.district = dn.district
GROUP BY tr.id, tr.name, tr.region_key
ORDER BY district_count DESC;
