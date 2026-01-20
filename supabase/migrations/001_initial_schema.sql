-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE segment_type_enum AS ENUM ('primary', 'secondary');
CREATE TYPE construction_mode_enum AS ENUM ('validation', 'extension');
CREATE TYPE reach_mode_enum AS ENUM ('accuracy', 'balanced', 'reach');
CREATE TYPE geo_type_enum AS ENUM ('h3', 'postcode_sector');
CREATE TYPE confidence_tier_enum AS ENUM ('high', 'medium', 'low', 'discarded');
CREATE TYPE poi_layer_type_enum AS ENUM ('stores', 'custom');
CREATE TYPE export_type_enum AS ENUM ('csv', 'geojson');

-- audiences table
CREATE TABLE audiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    target_reach BIGINT,
    start_date DATE,
    end_date DATE,
    budget_total NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- audience_segments table
CREATE TABLE audience_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audience_id UUID NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
    segment_type segment_type_enum NOT NULL,
    construction_mode construction_mode_enum NOT NULL,
    provider TEXT NOT NULL,
    segment_key TEXT NOT NULL,
    segment_label TEXT NOT NULL,
    description TEXT,
    is_selected BOOLEAN DEFAULT true,
    weight NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- audience_profile_settings table
CREATE TABLE audience_profile_settings (
    audience_id UUID PRIMARY KEY REFERENCES audiences(id) ON DELETE CASCADE,
    scale_accuracy INTEGER DEFAULT 50 CHECK (scale_accuracy >= 0 AND scale_accuracy <= 100),
    reach_mode reach_mode_enum,
    derived_audience_size BIGINT,
    confidence_high NUMERIC,
    confidence_medium NUMERIC,
    confidence_low NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- geo_units table
CREATE TABLE geo_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audience_id UUID NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
    geo_type geo_type_enum NOT NULL,
    geo_id TEXT NOT NULL,
    score NUMERIC NOT NULL,
    confidence_tier confidence_tier_enum NOT NULL,
    drivers JSONB,
    geometry JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- poi_layers table
CREATE TABLE poi_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audience_id UUID NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
    layer_name TEXT NOT NULL,
    layer_type poi_layer_type_enum NOT NULL,
    metadata JSONB,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- exports table
CREATE TABLE exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audience_id UUID NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    export_type export_type_enum NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_audiences_user_id ON audiences(user_id);
CREATE INDEX idx_audience_segments_audience_id ON audience_segments(audience_id);
CREATE INDEX idx_audience_segments_segment_type ON audience_segments(segment_type);
CREATE INDEX idx_geo_units_audience_id ON geo_units(audience_id);
CREATE INDEX idx_geo_units_geo_type ON geo_units(geo_type);
CREATE INDEX idx_poi_layers_audience_id ON poi_layers(audience_id);
CREATE INDEX idx_exports_audience_id ON exports(audience_id);
CREATE INDEX idx_exports_user_id ON exports(user_id);

-- Enable Row Level Security
ALTER TABLE audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_profile_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE poi_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audiences
CREATE POLICY "Users can view their own audiences"
    ON audiences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audiences"
    ON audiences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audiences"
    ON audiences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audiences"
    ON audiences FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for audience_segments
CREATE POLICY "Users can view segments of their audiences"
    ON audience_segments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_segments.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert segments for their audiences"
    ON audience_segments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_segments.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update segments of their audiences"
    ON audience_segments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_segments.audience_id
            AND audiences.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_segments.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete segments of their audiences"
    ON audience_segments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_segments.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

-- RLS Policies for audience_profile_settings
CREATE POLICY "Users can view profile settings of their audiences"
    ON audience_profile_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_profile_settings.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert profile settings for their audiences"
    ON audience_profile_settings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_profile_settings.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update profile settings of their audiences"
    ON audience_profile_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_profile_settings.audience_id
            AND audiences.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = audience_profile_settings.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

-- RLS Policies for geo_units
CREATE POLICY "Users can view geo_units of their audiences"
    ON geo_units FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = geo_units.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert geo_units for their audiences"
    ON geo_units FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = geo_units.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update geo_units of their audiences"
    ON geo_units FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = geo_units.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete geo_units of their audiences"
    ON geo_units FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = geo_units.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

-- RLS Policies for poi_layers
CREATE POLICY "Users can view poi_layers of their audiences"
    ON poi_layers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = poi_layers.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert poi_layers for their audiences"
    ON poi_layers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = poi_layers.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update poi_layers of their audiences"
    ON poi_layers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = poi_layers.audience_id
            AND audiences.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = poi_layers.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete poi_layers of their audiences"
    ON poi_layers FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = poi_layers.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

-- RLS Policies for exports
CREATE POLICY "Users can view their own exports"
    ON exports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exports"
    ON exports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_audiences_updated_at BEFORE UPDATE ON audiences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audience_profile_settings_updated_at BEFORE UPDATE ON audience_profile_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
