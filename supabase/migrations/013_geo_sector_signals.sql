-- Migration: geo_sector_signals table for CSV-based validation
-- Stores sector-level signals from provider CSV files

-- Create geo_sector_signals table
CREATE TABLE IF NOT EXISTS geo_sector_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key text NOT NULL,
  provider text NOT NULL,
  provider_segment_label text,
  sector text NOT NULL,
  district text NOT NULL,
  score integer,
  score_norm numeric,
  source_file text,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique sector per provider+segment
  CONSTRAINT geo_sector_signals_unique UNIQUE (segment_key, provider, sector)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_geo_sector_signals_segment_provider_district 
  ON geo_sector_signals(segment_key, provider, district);
CREATE INDEX IF NOT EXISTS idx_geo_sector_signals_district 
  ON geo_sector_signals(district);
CREATE INDEX IF NOT EXISTS idx_geo_sector_signals_segment_provider 
  ON geo_sector_signals(segment_key, provider);

-- View: Aggregate sector signals to district level
CREATE OR REPLACE VIEW geo_district_signals AS
SELECT 
  segment_key,
  provider,
  provider_segment_label,
  district,
  COUNT(*) as sectors_count,
  AVG(score) FILTER (WHERE score IS NOT NULL) as district_score_avg,
  AVG(score_norm) FILTER (WHERE score_norm IS NOT NULL) as district_score_norm,
  BOOL_OR(score IS NOT NULL) as has_score
FROM geo_sector_signals
GROUP BY segment_key, provider, provider_segment_label, district;

-- Ensure score_norm is computed on insert/update (trigger or computed column)
-- For now, we compute it in the import script, but add a trigger for safety
CREATE OR REPLACE FUNCTION compute_score_norm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.score IS NOT NULL AND NEW.score_norm IS NULL THEN
    NEW.score_norm := NEW.score / 100.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER geo_sector_signals_compute_score_norm
  BEFORE INSERT OR UPDATE ON geo_sector_signals
  FOR EACH ROW
  EXECUTE FUNCTION compute_score_norm();

-- Index on the view's underlying table for district lookups
-- (Already covered by idx_geo_sector_signals_segment_provider_district)

-- RLS policies (if RLS is enabled, mirror existing patterns)
-- Check if RLS is enabled on geo_districts to determine pattern
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'geo_districts'
    AND rowsecurity = true
  ) THEN
    -- Enable RLS
    ALTER TABLE geo_sector_signals ENABLE ROW LEVEL SECURITY;
    
    -- Drop policies if they exist (idempotent)
    DROP POLICY IF EXISTS "geo_sector_signals_read_all" ON geo_sector_signals;
    DROP POLICY IF EXISTS "geo_sector_signals_service_role_all" ON geo_sector_signals;
    
    -- Permissive read policy (mirror existing demo patterns)
    CREATE POLICY "geo_sector_signals_read_all"
      ON geo_sector_signals
      FOR SELECT
      USING (true);
      
    -- Service role can do everything (for import scripts)
    CREATE POLICY "geo_sector_signals_service_role_all"
      ON geo_sector_signals
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE geo_sector_signals IS 'Sector-level signals from provider CSV files. Aggregated to district level via geo_district_signals view.';
COMMENT ON COLUMN geo_sector_signals.segment_key IS 'Canonical segment key (e.g. home_movers)';
COMMENT ON COLUMN geo_sector_signals.provider IS 'Provider name (e.g. CCS, Experian)';
COMMENT ON COLUMN geo_sector_signals.sector IS 'Postcode sector (e.g. AL1 1)';
COMMENT ON COLUMN geo_sector_signals.district IS 'Postcode district (e.g. AL1)';
COMMENT ON COLUMN geo_sector_signals.score IS 'Raw score (0-100) if provided in CSV';
COMMENT ON COLUMN geo_sector_signals.score_norm IS 'Normalized score (0.0-1.0), computed as score/100.0';
COMMENT ON VIEW geo_district_signals IS 'District-level aggregation of sector signals. Use district_score_norm for eligibility thresholds.';
