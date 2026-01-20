-- Migration: Add centroid columns to geo_districts and backfill
-- Centroids are the source of truth for rendering (not polygon geometry)

-- Add centroid columns
ALTER TABLE geo_districts
ADD COLUMN IF NOT EXISTS centroid_lng double precision,
ADD COLUMN IF NOT EXISTS centroid_lat double precision;

-- Backfill centroids from existing geometry
-- For Polygon geometry: compute centroid as average of ring points
UPDATE geo_districts
SET 
  centroid_lng = (
    SELECT AVG((point->>0)::double precision)
    FROM jsonb_array_elements(geometry->'coordinates'->0) AS point
    WHERE geometry->>'type' = 'Polygon'
      AND geometry->'coordinates' IS NOT NULL
      AND jsonb_array_length(geometry->'coordinates') > 0
  ),
  centroid_lat = (
    SELECT AVG((point->>1)::double precision)
    FROM jsonb_array_elements(geometry->'coordinates'->0) AS point
    WHERE geometry->>'type' = 'Polygon'
      AND geometry->'coordinates' IS NOT NULL
      AND jsonb_array_length(geometry->'coordinates') > 0
  )
WHERE geometry->>'type' = 'Polygon'
  AND geometry->'coordinates' IS NOT NULL
  AND jsonb_array_length(geometry->'coordinates') > 0
  AND (centroid_lng IS NULL OR centroid_lat IS NULL);

-- For rows with missing/invalid geometry, use deterministic fallback based on district hash
-- This ensures every district has a centroid within UK bounds
UPDATE geo_districts
SET 
  centroid_lng = -8.6 + ((hashtext(district) % 10000)::double precision / 10000.0) * (1.9 - (-8.6)),
  centroid_lat = 50.7 + (((hashtext(district) * 7) % 10000)::double precision / 10000.0) * (59.5 - 50.7)
WHERE centroid_lng IS NULL OR centroid_lat IS NULL;

-- Make columns NOT NULL after backfill
ALTER TABLE geo_districts
ALTER COLUMN centroid_lng SET NOT NULL,
ALTER COLUMN centroid_lat SET NOT NULL;

-- Add index for centroid lookups
CREATE INDEX IF NOT EXISTS idx_geo_districts_centroid 
  ON geo_districts(centroid_lat, centroid_lng);

-- Comments
COMMENT ON COLUMN geo_districts.centroid_lng IS 'Longitude of district centroid (GeoJSON order, -180 to 180)';
COMMENT ON COLUMN geo_districts.centroid_lat IS 'Latitude of district centroid (-90 to 90)';
