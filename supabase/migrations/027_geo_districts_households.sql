-- Migration: Add household counts to geo_districts
-- Additive only: adds households column and backfills from district mapping CSV data
-- Does not modify existing columns or logic

-- ============================================
-- 1. Add households column to geo_districts
-- ============================================

ALTER TABLE geo_districts 
ADD COLUMN IF NOT EXISTS households INTEGER;

COMMENT ON COLUMN geo_districts.households IS 
'Number of households in this postcode district. Populated from district_mapping.csv. NULL for districts without household data.';

-- Create index for efficient aggregation queries
CREATE INDEX IF NOT EXISTS idx_geo_districts_households ON geo_districts(households) WHERE households IS NOT NULL;

-- ============================================
-- 2. Create temporary staging table for household data
-- ============================================
-- This table will be populated by the import script, then used to backfill geo_districts

CREATE TABLE IF NOT EXISTS district_households_staging (
  district_code TEXT PRIMARY KEY,
  households INTEGER NOT NULL,
  source TEXT DEFAULT 'district_mapping_csv',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE district_households_staging IS 
'Temporary staging table for household data from district_mapping.csv. Populated by import script, then used to backfill geo_districts.households.';

-- ============================================
-- 3. Backfill function (idempotent)
-- ============================================
-- This function updates geo_districts.households from the staging table
-- Uses district_norm for reliable matching

CREATE OR REPLACE FUNCTION backfill_geo_districts_households()
RETURNS TABLE(
  districts_updated INTEGER,
  districts_with_households INTEGER,
  districts_missing_households INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INTEGER;
  with_households INTEGER;
  missing_households INTEGER;
BEGIN
  -- Update geo_districts.households from staging table using district_norm
  UPDATE geo_districts gd
  SET households = staging.households
  FROM district_households_staging staging
  WHERE gd.district_norm = normalize_district(staging.district_code)
    AND gd.households IS NULL; -- Only update NULL values (idempotent)

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Count districts with households
  SELECT COUNT(*) INTO with_households
  FROM geo_districts
  WHERE households IS NOT NULL;

  -- Count districts missing households
  SELECT COUNT(*) INTO missing_households
  FROM geo_districts
  WHERE households IS NULL;

  RETURN QUERY SELECT updated_count, with_households, missing_households;
END;
$$;

COMMENT ON FUNCTION backfill_geo_districts_households() IS 
'Backfills geo_districts.households from district_households_staging. Idempotent: only updates NULL values. Returns counts of updated, with households, and missing households.';

-- ============================================
-- 4. RLS for staging table (optional, but safe)
-- ============================================

ALTER TABLE district_households_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role to manage district_households_staging"
  ON district_households_staging FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: The actual backfill is done by running the import script:
-- npm run db:import:district-households
-- This script will:
-- 1. Read district_mapping.csv
-- 2. Populate district_households_staging
-- 3. Call backfill_geo_districts_households() to update geo_districts
