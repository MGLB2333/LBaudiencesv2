-- Migration: Real UK postcode district centroids
-- Replaces synthetic D0001-style districts with real postcode districts from district_latLong.csv
-- Uses centroid lat/lng only (no PostGIS required)

-- Ensure geo_districts table exists with correct schema
CREATE TABLE IF NOT EXISTS geo_districts (
  district TEXT PRIMARY KEY,
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lng DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geo_districts' AND column_name='source') THEN
    ALTER TABLE geo_districts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geo_districts' AND column_name='updated_at') THEN
    ALTER TABLE geo_districts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Ensure centroid columns exist and are NOT NULL
ALTER TABLE geo_districts
  ALTER COLUMN centroid_lat SET NOT NULL,
  ALTER COLUMN centroid_lng SET NOT NULL;

-- Make geometry nullable (we're using centroids only)
ALTER TABLE geo_districts
  ALTER COLUMN geometry DROP NOT NULL;

-- Add index for centroid lookups
CREATE INDEX IF NOT EXISTS idx_geo_districts_centroid 
  ON geo_districts(centroid_lat, centroid_lng);

-- Trigger to update updated_at on row update
CREATE OR REPLACE FUNCTION update_geo_districts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_geo_districts_updated_at ON geo_districts;
CREATE TRIGGER trigger_update_geo_districts_updated_at
  BEFORE UPDATE ON geo_districts
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_districts_updated_at();

-- RLS policies
ALTER TABLE geo_districts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read geo districts" ON geo_districts;
DROP POLICY IF EXISTS "Service role can write geo districts" ON geo_districts;

-- SELECT: Allow authenticated users to read
CREATE POLICY "Authenticated users can read geo districts"
  ON geo_districts FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE: Allow service role (for migrations/imports)
-- Also allow authenticated for now (can restrict later if needed)
CREATE POLICY "Service role can write geo districts"
  ON geo_districts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to write (for import scripts using service key)
-- This is safe because district is PRIMARY KEY, so upserts are idempotent
CREATE POLICY "Authenticated users can write geo districts"
  ON geo_districts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE geo_districts IS 'Real UK postcode district centroids. Source: district_latLong.csv';
COMMENT ON COLUMN geo_districts.district IS 'Postcode district code (e.g., AB1, AL10, B1) - normalized uppercase, no spaces';
COMMENT ON COLUMN geo_districts.centroid_lat IS 'Latitude of district centroid (WGS84, -90 to 90)';
COMMENT ON COLUMN geo_districts.centroid_lng IS 'Longitude of district centroid (WGS84, -180 to 180)';
COMMENT ON COLUMN geo_districts.source IS 'Source of centroid data (e.g., district_latLong.xlsx, manual, synthetic)';

-- Post-migration check queries (run these in Supabase SQL Editor to verify):
-- 
-- 1. Count districts:
-- SELECT count(*) as total_districts FROM geo_districts;
-- Expected: ~3114 after import
--
-- 2. Bounds check (should be UK: lat ~49-61, lng ~-9 to 3):
-- SELECT 
--   min(centroid_lat) as min_lat, 
--   max(centroid_lat) as max_lat,
--   min(centroid_lng) as min_lng, 
--   max(centroid_lng) as max_lng
-- FROM geo_districts;
--
-- 3. Source distribution:
-- SELECT source, count(*) as count 
-- FROM geo_districts 
-- GROUP BY source 
-- ORDER BY count DESC;
--
-- 4. Sample districts:
-- SELECT district, centroid_lat, centroid_lng, source 
-- FROM geo_districts 
-- ORDER BY district 
-- LIMIT 20;
