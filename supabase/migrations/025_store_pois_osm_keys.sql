-- Migration: Add OSM metadata columns to store_pois for idempotent imports
-- Additive only: adds new columns for tracking OSM source data

-- Add OSM tracking columns
ALTER TABLE store_pois
  ADD COLUMN IF NOT EXISTS osm_type TEXT,
  ADD COLUMN IF NOT EXISTS osm_id BIGINT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS raw_name TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB;

-- Create unique index for OSM-based deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_pois_osm_unique
  ON store_pois(source, osm_type, osm_id)
  WHERE osm_type IS NOT NULL AND osm_id IS NOT NULL;

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_store_pois_source ON store_pois(source);

-- Add comment explaining the columns
COMMENT ON COLUMN store_pois.osm_type IS 'OSM element type: node, way, or relation';
COMMENT ON COLUMN store_pois.osm_id IS 'OSM element ID';
COMMENT ON COLUMN store_pois.source IS 'Source of the POI data: manual, osm, or other';
COMMENT ON COLUMN store_pois.raw_name IS 'Original name from OSM (before normalization)';
COMMENT ON COLUMN store_pois.tags IS 'Full OSM tags as JSONB for reference';
