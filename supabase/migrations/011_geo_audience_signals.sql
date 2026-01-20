-- Create geo_audience_signals table for provider-level signals by district
CREATE TABLE IF NOT EXISTS geo_audience_signals (
  district TEXT NOT NULL REFERENCES geo_districts(district) ON DELETE CASCADE,
  audience_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (district, audience_key, provider)
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_geo_audience_signals_audience ON geo_audience_signals(audience_key);
CREATE INDEX IF NOT EXISTS idx_geo_audience_signals_provider ON geo_audience_signals(provider);
CREATE INDEX IF NOT EXISTS idx_geo_audience_signals_confidence ON geo_audience_signals(confidence);
CREATE INDEX IF NOT EXISTS idx_geo_audience_signals_district_audience ON geo_audience_signals(district, audience_key);

-- RLS policies
ALTER TABLE geo_audience_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read geo audience signals"
    ON geo_audience_signals FOR SELECT
    TO authenticated
    USING (true);
