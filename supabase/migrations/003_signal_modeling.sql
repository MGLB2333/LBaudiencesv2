-- Add audience_construction_settings table for signal configuration
CREATE TABLE IF NOT EXISTS audience_construction_settings (
    audience_id UUID PRIMARY KEY REFERENCES audiences(id) ON DELETE CASCADE,
    audience_intent TEXT, -- 'home_movers', 'home_renovators', 'home_owners_general'
    construction_mode construction_mode_enum NOT NULL DEFAULT 'extension',
    active_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- active_signals structure:
    -- {
    --   "planning_approval": { "enabled": true, "base_weight": 0.8, "confidence": 0.7, "spatial_bias": "suburban" },
    --   "property_age_0_5": { "enabled": false, ... },
    --   ...
    -- }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at trigger
CREATE TRIGGER update_audience_construction_settings_updated_at
    BEFORE UPDATE ON audience_construction_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE audience_construction_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own construction settings"
    ON audience_construction_settings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_construction_settings.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own construction settings"
    ON audience_construction_settings FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_construction_settings.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own construction settings"
    ON audience_construction_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_construction_settings.audience_id
            AND audiences.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_construction_settings.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

-- Add metadata column to audience_segments for signal details
ALTER TABLE audience_segments 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
-- metadata can store: { "signal_type": "planning_approval", "inferred": false, "spatial_bias": "suburban", ... }

-- Add signal_contributions to geo_units.drivers (already JSONB, just documenting structure)
-- drivers structure:
-- {
--   "signals": [
--     { "signal_type": "planning_approval", "weight": 0.8, "contribution": 12.5, "inferred": false },
--     ...
--   ],
--   "total_score": 75.3,
--   "spatial_bias_applied": "suburban"
-- }
