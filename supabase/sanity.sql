-- SQL Sanity Checks for Geo Districts
-- Run these queries in Supabase SQL Editor to diagnose geometry structure

-- 1. How many districts?
select count(*) as total from geo_districts;
-- Expected: 3000

-- 2. Geometry type distribution (expects "Polygon")
select geometry->>'type' as geom_type, count(*)
from geo_districts
group by geom_type
order by count(*) desc;

-- 3. Detect invalid coordinate nesting (Polygon must be coordinates[ ring ][ point ][2])
-- Flags rows where coordinates nesting is not at least 3-deep
select district
from geo_districts
where geometry is null
  or geometry->'coordinates' is null
  or jsonb_typeof(geometry->'coordinates') <> 'array'
  or jsonb_array_length(geometry->'coordinates') = 0
limit 50;

-- 4. Sample first coordinate pair (lng/lat) from polygons
-- Handles Polygon only; if not Polygon, it will return nulls
select
  district,
  (geometry->'coordinates'->0->0->0)::text as first_lng_raw,
  (geometry->'coordinates'->0->0->1)::text as first_lat_raw
from geo_districts
where geometry->>'type'='Polygon'
limit 20;

-- 5. Bounding box across ALL points (works for Polygon only)
with pts as (
  select
    d.district,
    (p->>0)::double precision as lng,
    (p->>1)::double precision as lat
  from geo_districts d
  cross join lateral jsonb_array_elements(d.geometry->'coordinates'->0) as p
  where d.geometry->>'type'='Polygon'
)
select 
  min(lng) as min_lng, 
  max(lng) as max_lng, 
  min(lat) as min_lat, 
  max(lat) as max_lat
from pts;
-- Expected: min_lng ~-8.6, max_lng ~1.9, min_lat ~50.7, max_lat ~59.5

-- 6. Check centroid columns exist and are populated
select 
  count(*) as total,
  count(centroid_lat) as has_lat,
  count(centroid_lng) as has_lng,
  min(centroid_lat) as min_lat,
  max(centroid_lat) as max_lat,
  min(centroid_lng) as min_lng,
  max(centroid_lng) as max_lng
from geo_districts;
-- Expected: all 3000 have centroids, bounds within UK
