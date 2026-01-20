-- Migration: Battle Zones RPC functions
-- Additive only: creates RPC functions for computing battle zone districts
-- Battle zones identify districts as Owned, Contested, or Competitor-only based on store presence

-- Function: Get battle zone districts with category classification
-- Ring scale: each user ring expands by 5 neighbor steps for more aggressive growth
CREATE OR REPLACE FUNCTION get_battle_zones_districts(
  base_brand TEXT,
  competitor_brands TEXT[] DEFAULT NULL,
  rings INTEGER DEFAULT 0,
  tv_regions TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  district TEXT,
  category TEXT,
  base_store_count INTEGER,
  competitor_store_count INTEGER,
  competitor_brands_present TEXT[]
) AS $$
WITH base_districts AS (
  -- Districts containing base brand stores
  SELECT DISTINCT spd.district
  FROM store_poi_district spd
  JOIN store_pois sp ON sp.id = spd.poi_id
  WHERE sp.brand = base_brand
),
catchment_expansion AS (
  -- Recursive CTE to expand catchment by neighbor rings
  -- Scale: rings * 5 = effective_steps (rings=0 => 0, rings=1 => 5, rings=2 => 10, etc.)
  WITH RECURSIVE expand AS (
    -- Base case: start with base brand districts at depth 0
    SELECT district, 0 AS depth
    FROM base_districts
    
    UNION
    
    -- Recursive case: add neighbors up to effective_steps depth
    -- effective_steps = rings * 5 (DEFAULT_RING_SCALE)
    SELECT dn.neighbor_district, e.depth + 1
    FROM expand e
    JOIN district_neighbors dn ON dn.district = e.district
    WHERE e.depth < (rings * 5)
  )
  SELECT DISTINCT district
  FROM expand
),
tv_filtered_catchment AS (
  -- Apply TV region filter if provided
  SELECT ce.district
  FROM catchment_expansion ce
  WHERE tv_regions IS NULL 
     OR array_length(tv_regions, 1) IS NULL
     OR EXISTS (
       SELECT 1
       FROM district_tv_regions dtr
       WHERE dtr.district = ce.district
         AND dtr.region_key = ANY(tv_regions)
     )
),
district_base_counts AS (
  -- Count base brand stores per district in catchment
  SELECT 
    tfc.district,
    COUNT(DISTINCT sp.id) AS base_count
  FROM tv_filtered_catchment tfc
  LEFT JOIN store_poi_district spd ON spd.district = tfc.district
  LEFT JOIN store_pois sp ON sp.id = spd.poi_id AND sp.brand = base_brand
  GROUP BY tfc.district
),
district_competitor_counts AS (
  -- Count competitor stores per district in catchment
  SELECT 
    tfc.district,
    COUNT(DISTINCT sp.id) AS competitor_count,
    array_agg(DISTINCT sp.brand) FILTER (WHERE sp.brand IS NOT NULL) AS competitor_brands
  FROM tv_filtered_catchment tfc
  LEFT JOIN store_poi_district spd ON spd.district = tfc.district
  LEFT JOIN store_pois sp ON sp.id = spd.poi_id 
    AND sp.brand = ANY(COALESCE(competitor_brands, ARRAY[]::TEXT[]))
  GROUP BY tfc.district
)
SELECT 
  dbc.district,
  CASE
    WHEN dbc.base_count > 0 AND COALESCE(dcc.competitor_count, 0) = 0 THEN 'owned'
    WHEN dbc.base_count > 0 AND COALESCE(dcc.competitor_count, 0) > 0 THEN 'contested'
    WHEN dbc.base_count = 0 AND COALESCE(dcc.competitor_count, 0) > 0 THEN 'competitor_only'
    ELSE NULL -- Exclude districts with neither
  END AS category,
  dbc.base_count::INTEGER AS base_store_count,
  COALESCE(dcc.competitor_count, 0)::INTEGER AS competitor_store_count,
  COALESCE(dcc.competitor_brands, ARRAY[]::TEXT[]) AS competitor_brands_present
FROM district_base_counts dbc
LEFT JOIN district_competitor_counts dcc ON dcc.district = dbc.district
WHERE 
  -- Only return districts that have at least one store (base or competitor)
  (dbc.base_count > 0 OR COALESCE(dcc.competitor_count, 0) > 0)
ORDER BY dbc.district;
$$ LANGUAGE SQL STABLE;

-- Function: Get battle zones summary statistics
CREATE OR REPLACE FUNCTION get_battle_zones_summary(
  base_brand TEXT,
  competitor_brands TEXT[] DEFAULT NULL,
  rings INTEGER DEFAULT 0,
  tv_regions TEXT[] DEFAULT NULL
)
RETURNS JSONB AS $$
WITH districts AS (
  SELECT * FROM get_battle_zones_districts(base_brand, competitor_brands, rings, tv_regions)
),
category_counts AS (
  SELECT 
    category,
    COUNT(*) AS district_count
  FROM districts
  WHERE category IS NOT NULL
  GROUP BY category
),
store_counts AS (
  SELECT 
    SUM(base_store_count) AS total_base_stores,
    SUM(competitor_store_count) AS total_competitor_stores
  FROM districts
),
top_contested AS (
  SELECT 
    district,
    base_store_count,
    competitor_store_count,
    competitor_brands_present
  FROM districts
  WHERE category = 'contested'
  ORDER BY competitor_store_count DESC, base_store_count ASC
  LIMIT 10
)
SELECT jsonb_build_object(
  'totalCatchmentDistricts', (SELECT COUNT(*) FROM districts),
  'ownedDistricts', COALESCE((SELECT district_count FROM category_counts WHERE category = 'owned'), 0),
  'contestedDistricts', COALESCE((SELECT district_count FROM category_counts WHERE category = 'contested'), 0),
  'competitorOnlyDistricts', COALESCE((SELECT district_count FROM category_counts WHERE category = 'competitor_only'), 0),
  'baseStoreCountInCatchment', COALESCE((SELECT total_base_stores FROM store_counts), 0),
  'competitorStoreCountInCatchment', COALESCE((SELECT total_competitor_stores FROM store_counts), 0),
  'topContestedDistricts', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'district', district,
        'baseStoreCount', base_store_count,
        'competitorStoreCount', competitor_store_count,
        'competitorBrands', competitor_brands_present
      )
    )
    FROM top_contested
  )
);
$$ LANGUAGE SQL STABLE;

-- Add comments
COMMENT ON FUNCTION get_battle_zones_districts IS 'Returns districts classified as owned, contested, or competitor-only based on store presence and neighbor rings';
COMMENT ON FUNCTION get_battle_zones_summary IS 'Returns summary statistics for battle zones including counts and top contested districts';
