-- Migration: TV regions and district neighbors
-- Additive only: creates new tables for TV region mapping and district adjacency
-- Does not modify existing tables

-- Ensure pgcrypto extension is available for gen_random_uuid()
-- (gen_random_uuid() is built-in in PostgreSQL 13+, but this ensures compatibility)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop policies if they exist (for idempotent re-runs)
DROP POLICY IF EXISTS "Allow authenticated users to read tv_regions" ON tv_regions;
DROP POLICY IF EXISTS "Allow service role to manage tv_regions" ON tv_regions;
DROP POLICY IF EXISTS "Allow authenticated users to read district_tv_regions" ON district_tv_regions;
DROP POLICY IF EXISTS "Allow service role to manage district_tv_regions" ON district_tv_regions;
DROP POLICY IF EXISTS "Allow authenticated users to read district_neighbors" ON district_neighbors;
DROP POLICY IF EXISTS "Allow service role to manage district_neighbors" ON district_neighbors;

-- Create tv_regions table
CREATE TABLE IF NOT EXISTS tv_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create district_tv_regions table (maps districts to TV regions)
CREATE TABLE IF NOT EXISTS district_tv_regions (
  district TEXT PRIMARY KEY,
  region_key TEXT NOT NULL REFERENCES tv_regions(region_key) ON UPDATE CASCADE ON DELETE RESTRICT,
  source TEXT NOT NULL DEFAULT 'district_mapping_csv',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT district_tv_regions_district_check CHECK (district = UPPER(TRIM(district)) AND LENGTH(district) > 0)
);

-- Create district_neighbors table (adjacency/nearby relationships)
CREATE TABLE IF NOT EXISTS district_neighbors (
  district TEXT NOT NULL,
  neighbor_district TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'adjacent',
  distance_km NUMERIC,
  source TEXT NOT NULL DEFAULT 'district_mapping_csv',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (district, neighbor_district, relationship),
  CONSTRAINT district_neighbors_no_self_link CHECK (district <> neighbor_district),
  CONSTRAINT district_neighbors_district_check CHECK (district = UPPER(TRIM(district)) AND LENGTH(district) > 0),
  CONSTRAINT district_neighbors_neighbor_check CHECK (neighbor_district = UPPER(TRIM(neighbor_district)) AND LENGTH(neighbor_district) > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_district_tv_regions_region_key ON district_tv_regions(region_key);
CREATE INDEX IF NOT EXISTS idx_district_neighbors_district ON district_neighbors(district);
CREATE INDEX IF NOT EXISTS idx_district_neighbors_neighbor ON district_neighbors(neighbor_district);

-- Enable RLS
ALTER TABLE tv_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_tv_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_neighbors ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow read for authenticated users, restrict writes
-- Following pattern from existing tables (e.g., data_partners)

-- tv_regions policies
-- Read-only for authenticated users (safe for UI)
CREATE POLICY "Allow authenticated users to read tv_regions"
  ON tv_regions FOR SELECT
  TO authenticated
  USING (true);

-- Full access for service role (for import scripts)
CREATE POLICY "Allow service role to manage tv_regions"
  ON tv_regions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- district_tv_regions policies
-- Read-only for authenticated users (safe for UI)
CREATE POLICY "Allow authenticated users to read district_tv_regions"
  ON district_tv_regions FOR SELECT
  TO authenticated
  USING (true);

-- Full access for service role (for import scripts)
CREATE POLICY "Allow service role to manage district_tv_regions"
  ON district_tv_regions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- district_neighbors policies
-- Read-only for authenticated users (safe for UI)
CREATE POLICY "Allow authenticated users to read district_neighbors"
  ON district_neighbors FOR SELECT
  TO authenticated
  USING (true);

-- Full access for service role (for import scripts)
CREATE POLICY "Allow service role to manage district_neighbors"
  ON district_neighbors FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
