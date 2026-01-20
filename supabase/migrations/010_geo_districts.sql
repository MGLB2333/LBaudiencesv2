-- Create geo_districts table for UK postcode districts
CREATE TABLE IF NOT EXISTS geo_districts (
  district TEXT PRIMARY KEY,
  centroid_lat NUMERIC NOT NULL,
  centroid_lng NUMERIC NOT NULL,
  geometry JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for spatial queries
CREATE INDEX IF NOT EXISTS idx_geo_districts_centroid ON geo_districts(centroid_lat, centroid_lng);

-- RLS policies
ALTER TABLE geo_districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read geo districts"
    ON geo_districts FOR SELECT
    TO authenticated
    USING (true);
