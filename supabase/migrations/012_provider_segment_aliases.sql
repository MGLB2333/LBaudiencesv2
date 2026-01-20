-- Create provider_segment_aliases table for mapping canonical keys to provider-specific labels
CREATE TABLE IF NOT EXISTS provider_segment_aliases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_segment_key TEXT NOT NULL,
  provider_segment_label TEXT NOT NULL,
  similarity_score NUMERIC NOT NULL DEFAULT 0.9,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (canonical_key, provider)
);

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_provider_segment_aliases_canonical ON provider_segment_aliases(canonical_key);
CREATE INDEX IF NOT EXISTS idx_provider_segment_aliases_provider ON provider_segment_aliases(provider);

-- RLS policies
ALTER TABLE provider_segment_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read provider segment aliases"
    ON provider_segment_aliases FOR SELECT
    TO authenticated
    USING (true);

-- Seed provider segment aliases
INSERT INTO provider_segment_aliases (canonical_key, provider, provider_segment_key, provider_segment_label, similarity_score) VALUES
-- home_movers
('home_movers', 'CCS', 'ccs_home_movers', 'Home Movers', 1.0),
('home_movers', 'Experian', 'exp_recent_movers', 'Recently Moved Household', 0.95),
('home_movers', 'ONS', 'ons_address_change', 'Recent Address Change', 0.92),
('home_movers', 'TwentyCI', 'tci_mover_intent', 'Mover Intent Index', 0.90),
('home_movers', 'Outra', 'outra_in_market_movers', 'In-Market Movers', 0.93),

-- home_renovators
('home_renovators', 'CCS', 'ccs_home_renovators', 'Home Renovators', 1.0),
('home_renovators', 'Experian', 'exp_renovation_intent', 'Renovation Intent Signals', 0.94),
('home_renovators', 'ONS', 'ons_property_improvement', 'Property Improvement Activity', 0.91),
('home_renovators', 'TwentyCI', 'tci_renovation_index', 'Home Improvement Index', 0.89),
('home_renovators', 'Outra', 'outra_diy_enthusiasts', 'DIY & Renovation Enthusiasts', 0.92),

-- new_build_buyers
('new_build_buyers', 'CCS', 'ccs_new_build_buyers', 'New Build Buyers', 1.0),
('new_build_buyers', 'Experian', 'exp_new_construction', 'New Construction Buyers', 0.96),
('new_build_buyers', 'ONS', 'ons_new_build_purchases', 'New Build Purchase Activity', 0.93),
('new_build_buyers', 'TwentyCI', 'tci_new_home_index', 'New Home Purchase Index', 0.91),
('new_build_buyers', 'Outra', 'outra_new_build_intent', 'New Build Intent Signals', 0.94),

-- high_affluence_homeowners
('high_affluence_homeowners', 'CCS', 'ccs_high_affluence', 'High Affluence Homeowners', 1.0),
('high_affluence_homeowners', 'Experian', 'exp_premium_households', 'Premium Household Segment', 0.95),
('high_affluence_homeowners', 'ONS', 'ons_affluent_owners', 'Affluent Owner Occupiers', 0.92),
('high_affluence_homeowners', 'TwentyCI', 'tci_high_value_index', 'High Value Property Index', 0.90),
('high_affluence_homeowners', 'Outra', 'outra_affluent_signals', 'Affluence Proxy Signals', 0.93)
ON CONFLICT (canonical_key, provider) DO UPDATE SET
  provider_segment_key = EXCLUDED.provider_segment_key,
  provider_segment_label = EXCLUDED.provider_segment_label,
  similarity_score = EXCLUDED.similarity_score;
