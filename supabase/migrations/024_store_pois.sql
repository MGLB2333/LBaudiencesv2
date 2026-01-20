-- Migration: Store POIs for manual store dataset
-- Additive only: creates new tables for store POI management
-- Does not modify existing tables

-- Ensure pgcrypto extension is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. Create store_pois table
-- ============================================

CREATE TABLE IF NOT EXISTS store_pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postcode TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  website_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Create store_poi_district mapping table
-- ============================================

CREATE TABLE IF NOT EXISTS store_poi_district (
  poi_id UUID PRIMARY KEY REFERENCES store_pois(id) ON DELETE CASCADE,
  district TEXT NOT NULL,
  distance_km DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. Create indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_store_pois_brand ON store_pois(brand);
CREATE INDEX IF NOT EXISTS idx_store_pois_brand_lower ON store_pois(LOWER(brand));
CREATE INDEX IF NOT EXISTS idx_store_pois_name_lower ON store_pois(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_store_poi_district_district ON store_poi_district(district);
CREATE INDEX IF NOT EXISTS idx_store_poi_district_poi_id ON store_poi_district(poi_id);

-- ============================================
-- 4. Haversine distance function
-- ============================================

CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius_km DOUBLE PRECISION := 6371.0;
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  -- Convert degrees to radians
  dlat := RADIANS(lat2 - lat1);
  dlng := RADIANS(lng2 - lng1);
  
  -- Haversine formula
  a := SIN(dlat / 2) * SIN(dlat / 2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlng / 2) * SIN(dlng / 2);
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  
  RETURN earth_radius_km * c;
END;
$$;

COMMENT ON FUNCTION haversine_distance IS 'Calculate distance between two lat/lng points using Haversine formula. Returns distance in kilometers.';

-- ============================================
-- 5. Find nearest district function
-- ============================================

CREATE OR REPLACE FUNCTION find_nearest_district(
  poi_lat DOUBLE PRECISION,
  poi_lng DOUBLE PRECISION
) RETURNS TABLE(district TEXT, distance_km DOUBLE PRECISION)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gd.district,
    haversine_distance(poi_lat, poi_lng, gd.centroid_lat, gd.centroid_lng) AS distance_km
  FROM geo_districts gd
  WHERE gd.centroid_lat IS NOT NULL
    AND gd.centroid_lng IS NOT NULL
  ORDER BY distance_km ASC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION find_nearest_district IS 'Find the nearest postcode district to a given lat/lng point using district centroids. Returns district code and distance in km.';

-- ============================================
-- 6. Upsert POI district mapping function
-- ============================================

CREATE OR REPLACE FUNCTION upsert_poi_district(poi_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  poi_lat DOUBLE PRECISION;
  poi_lng DOUBLE PRECISION;
  nearest_district TEXT;
  nearest_distance DOUBLE PRECISION;
BEGIN
  -- Get POI coordinates
  SELECT lat, lng INTO poi_lat, poi_lng
  FROM store_pois
  WHERE id = poi_id_param;
  
  IF poi_lat IS NULL OR poi_lng IS NULL THEN
    RAISE EXCEPTION 'POI % has null coordinates', poi_id_param;
  END IF;
  
  -- Find nearest district
  SELECT district, distance_km INTO nearest_district, nearest_distance
  FROM find_nearest_district(poi_lat, poi_lng);
  
  IF nearest_district IS NULL THEN
    RAISE EXCEPTION 'No district found for POI %', poi_id_param;
  END IF;
  
  -- Upsert mapping
  INSERT INTO store_poi_district (poi_id, district, distance_km)
  VALUES (poi_id_param, nearest_district, nearest_distance)
  ON CONFLICT (poi_id) DO UPDATE
  SET
    district = EXCLUDED.district,
    distance_km = EXCLUDED.distance_km;
END;
$$;

COMMENT ON FUNCTION upsert_poi_district IS 'Automatically compute and store the nearest district mapping for a POI. Called by trigger after POI insert/update.';

-- ============================================
-- 7. Trigger function to auto-update district mapping
-- ============================================

CREATE OR REPLACE FUNCTION trigger_upsert_poi_district()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update if lat/lng changed or this is a new row
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.lat IS DISTINCT FROM NEW.lat OR OLD.lng IS DISTINCT FROM NEW.lng)) THEN
    PERFORM upsert_poi_district(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- 8. Create trigger
-- ============================================

DROP TRIGGER IF EXISTS trigger_store_pois_upsert_district ON store_pois;
CREATE TRIGGER trigger_store_pois_upsert_district
  AFTER INSERT OR UPDATE OF lat, lng ON store_pois
  FOR EACH ROW
  EXECUTE FUNCTION trigger_upsert_poi_district();

-- ============================================
-- 9. Enable RLS
-- ============================================

ALTER TABLE store_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_poi_district ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. RLS Policies
-- ============================================

-- Drop existing policies if they exist (for idempotent re-runs)
DROP POLICY IF EXISTS "Allow authenticated users to read store_pois" ON store_pois;
DROP POLICY IF EXISTS "Allow authenticated users to manage store_pois" ON store_pois;
DROP POLICY IF EXISTS "Allow service role to manage store_pois" ON store_pois;
DROP POLICY IF EXISTS "Allow authenticated users to read store_poi_district" ON store_poi_district;
DROP POLICY IF EXISTS "Allow service role to manage store_poi_district" ON store_poi_district;

-- store_pois policies
CREATE POLICY "Allow authenticated users to read store_pois"
  ON store_pois FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage store_pois"
  ON store_pois FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role to manage store_pois"
  ON store_pois FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- store_poi_district policies
CREATE POLICY "Allow authenticated users to read store_poi_district"
  ON store_poi_district FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role to manage store_poi_district"
  ON store_poi_district FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
