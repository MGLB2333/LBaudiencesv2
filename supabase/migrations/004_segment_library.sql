-- Create segment_library table for Option 2 (Extension) suggestions
CREATE TABLE IF NOT EXISTS segment_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL,
    segment_key TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    adjacency JSONB DEFAULT '{}', -- { "related_segments": [...], "adjacency_score": 0.0-1.0 }
    example_signals JSONB DEFAULT '{}', -- { "signals": [...], "evidence": "..." }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, segment_key)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_segment_library_provider ON segment_library(provider);
CREATE INDEX IF NOT EXISTS idx_segment_library_tags ON segment_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_segment_library_active ON segment_library(is_active) WHERE is_active = true;

-- Add updated_at trigger
CREATE TRIGGER update_segment_library_updated_at
    BEFORE UPDATE ON segment_library
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE segment_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active segments"
    ON segment_library FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Add new columns to audience_segments for tracking origin and matches
ALTER TABLE audience_segments 
ADD COLUMN IF NOT EXISTS origin TEXT CHECK (origin IN ('brief', 'validated', 'suggested')),
ADD COLUMN IF NOT EXISTS match_type TEXT CHECK (match_type IN ('name_match', 'inferred')),
ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS source_providers TEXT[] DEFAULT '{}'::text[];

-- Add index for origin
CREATE INDEX IF NOT EXISTS idx_audience_segments_origin ON audience_segments(origin);

-- Seed segment library with property/home/kitchens relevant segments
INSERT INTO segment_library (provider, segment_key, label, description, tags, adjacency, example_signals, is_active)
VALUES
-- CCS segments (base)
('CCS', 'families_with_kids_over_11', 'Families with kids over 11', 'Households with children aged 11-17', ARRAY['family', 'suburban', 'education'], '{"related_segments": ["tech_savvy_family_units", "weekend_activity_seekers"], "adjacency_score": 0.8}'::jsonb, '{"signals": ["household_size_medium", "affluence_proxy"], "evidence": "Media consumption patterns indicate family-oriented lifestyle"}'::jsonb, true),

-- ONS segments
('ONS', 'older_school_age_families', 'Older School-Age Families', 'Households with children aged 11-17, based on census-reported household composition', ARRAY['family', 'census', 'suburban'], '{"related_segments": ["families_with_kids_over_11", "suburban_families"], "adjacency_score": 0.9}'::jsonb, '{"signals": ["household_size_medium", "ownership_confidence_high"], "evidence": "Census data shows household composition matches"}'::jsonb, true),
('ONS', 'suburban_families', 'Suburban Families', 'Families living in suburban areas with higher home ownership rates', ARRAY['family', 'suburban', 'ownership'], '{"related_segments": ["older_school_age_families", "affluent_homeowners"], "adjacency_score": 0.85}'::jsonb, '{"signals": ["ownership_confidence_high", "affluence_proxy"], "evidence": "Geographic and demographic indicators align"}'::jsonb, true),
('ONS', 'affluent_homeowners', 'Affluent Homeowners', 'Owner-occupied households in areas with above-average income levels', ARRAY['ownership', 'affluence', 'property'], '{"related_segments": ["suburban_families", "long_term_residents"], "adjacency_score": 0.75}'::jsonb, '{"signals": ["ownership_confidence_high", "affluence_proxy"], "evidence": "Property ownership and income data correlate"}'::jsonb, true),
('ONS', 'long_term_residents', 'Long-Term Residents', 'Households that have lived in their property for 8+ years', ARRAY['stability', 'ownership', 'renovation'], '{"related_segments": ["affluent_homeowners", "property_age_10_20"], "adjacency_score": 0.7}'::jsonb, '{"signals": ["ownership_confidence_high", "property_age_10_20"], "evidence": "Residential stability indicates renovation potential"}'::jsonb, true),

-- Experian segments
('Experian', 'growing_independence', 'Growing Independence', 'Families with older children starting secondary or further education', ARRAY['family', 'education', 'lifestyle'], '{"related_segments": ["families_with_kids_over_11", "tech_savvy_family_units"], "adjacency_score": 0.85}'::jsonb, '{"signals": ["household_size_medium", "affluence_proxy"], "evidence": "Credit and lifestyle indicators show family life stage"}'::jsonb, true),
('Experian', 'high_consideration_purchasers', 'High Consideration Purchasers', 'Households showing research behavior and extended consideration periods', ARRAY['purchase_intent', 'research', 'consideration'], '{"related_segments": ["affluent_homeowners", "long_term_residents"], "adjacency_score": 0.8}'::jsonb, '{"signals": ["affluence_proxy", "ownership_confidence_high"], "evidence": "Purchase behavior patterns indicate major purchase consideration"}'::jsonb, true),
('Experian', 'mid_high_household_income', 'Mid–High Household Income', 'Households with above-average income levels', ARRAY['income', 'affluence', 'purchase_capacity'], '{"related_segments": ["affluent_homeowners", "high_consideration_purchasers"], "adjacency_score": 0.9}'::jsonb, '{"signals": ["affluence_proxy", "ownership_confidence_high"], "evidence": "Financial capacity indicators align"}'::jsonb, true),

-- Property/Kitchen specific segments
('CCS', 'tech_savvy_family_units', 'Tech-Savvy Family Units', 'Households with teenagers where media consumption is shared across connected devices', ARRAY['family', 'technology', 'media'], '{"related_segments": ["families_with_kids_over_11", "growing_independence"], "adjacency_score": 0.8}'::jsonb, '{"signals": ["household_size_medium", "affluence_proxy"], "evidence": "Device usage and media patterns indicate family tech adoption"}'::jsonb, true),
('CCS', 'weekend_activity_seekers', 'Weekend Activity Seekers', 'Families that engage in weekend activities and outings', ARRAY['family', 'lifestyle', 'activities'], '{"related_segments": ["families_with_kids_over_11", "suburban_families"], "adjacency_score": 0.75}'::jsonb, '{"signals": ["household_size_medium", "ownership_confidence_high"], "evidence": "Activity patterns indicate family-oriented lifestyle"}'::jsonb, true),

-- Home mover segments
('Outra', 'recent_property_transaction', 'Recent Property Transaction Signals', 'Households showing signals of recent property purchase or sale activity', ARRAY['property', 'movers', 'transaction'], '{"related_segments": ["property_age_0_5", "ownership_confidence_high"], "adjacency_score": 0.85}'::jsonb, '{"signals": ["property_age_0_5", "ownership_confidence_high"], "evidence": "Property transaction data indicates recent move"}'::jsonb, true),
('Outra', 'planning_permission_approved', 'Planning Permission Approved', 'Households in postcodes with recent planning permission approvals', ARRAY['property', 'renovation', 'planning'], '{"related_segments": ["property_age_10_20", "long_term_residents"], "adjacency_score": 0.9}'::jsonb, '{"signals": ["planning_approval", "property_age_10_20"], "evidence": "Planning permission data directly indicates renovation intent"}'::jsonb, true),

-- Property age segments
('TwentyCI', 'property_age_0_5', 'Property Age 0–5 Years', 'New build properties, likely first-time buyers or recent movers', ARRAY['property', 'age', 'movers'], '{"related_segments": ["recent_property_transaction", "ownership_confidence_high"], "adjacency_score": 0.8}'::jsonb, '{"signals": ["property_age_0_5", "ownership_confidence_high"], "evidence": "Property age data indicates new build or recent purchase"}'::jsonb, true),
('TwentyCI', 'property_age_5_10', 'Property Age 5–10 Years', 'Established properties, potential for first major renovation', ARRAY['property', 'age', 'renovation'], '{"related_segments": ["planning_permission_approved", "long_term_residents"], "adjacency_score": 0.85}'::jsonb, '{"signals": ["property_age_5_10", "ownership_confidence_medium"], "evidence": "Property age indicates renovation lifecycle point"}'::jsonb, true),
('TwentyCI', 'property_age_10_20', 'Property Age 10–20 Years', 'Properties at typical renovation lifecycle point', ARRAY['property', 'age', 'renovation'], '{"related_segments": ["planning_permission_approved", "long_term_residents"], "adjacency_score": 0.9}'::jsonb, '{"signals": ["property_age_10_20", "ownership_confidence_high"], "evidence": "Property age aligns with typical kitchen replacement cycle"}'::jsonb, true),

-- Additional kitchen/home segments
('CCS', 'home_improvement_researchers', 'Home Improvement Researchers', 'Households actively researching home improvement products and services', ARRAY['renovation', 'research', 'home_improvement'], '{"related_segments": ["planning_permission_approved", "high_consideration_purchasers"], "adjacency_score": 0.85}'::jsonb, '{"signals": ["planning_approval", "affluence_proxy"], "evidence": "Digital engagement patterns show home improvement research"}'::jsonb, true),
('CCS', 'diy_interiors_enthusiasts', 'DIY / Interiors Enthusiasts', 'Households with demonstrated interest in DIY projects and interior design', ARRAY['diy', 'interiors', 'renovation'], '{"related_segments": ["home_improvement_researchers", "long_term_residents"], "adjacency_score": 0.8}'::jsonb, '{"signals": ["planning_approval", "ownership_confidence_high"], "evidence": "Lifestyle indicators show DIY and interior design interest"}'::jsonb, true),

-- Adjacent audience segments (for Extension mode suggestions)
('CCS', 'home_movers', 'Home Movers', 'Households that have recently moved or are planning to move', ARRAY['movers', 'property', 'relocation'], '{"related_segments": ["new_build_buyers", "high_affluence_homeowners"], "adjacency_score": 0.85}'::jsonb, '{"signals": ["property_age_0_5", "ownership_confidence_high"], "evidence": "Property transaction and address change signals indicate mover activity"}'::jsonb, true),
('CCS', 'home_renovators', 'Home Renovators', 'Households showing renovation intent and activity', ARRAY['renovation', 'home_improvement', 'diy'], '{"related_segments": ["home_movers", "new_build_buyers"], "adjacency_score": 0.90}'::jsonb, '{"signals": ["planning_approval", "property_age_10_20"], "evidence": "Planning permission and property age signals indicate renovation lifecycle"}'::jsonb, true),
('CCS', 'new_build_buyers', 'New Build Buyers', 'Households purchasing or interested in new build properties', ARRAY['new_build', 'property', 'movers'], '{"related_segments": ["home_movers", "high_affluence_homeowners"], "adjacency_score": 0.88}'::jsonb, '{"signals": ["property_age_0_5", "affluence_proxy"], "evidence": "Property age and affluence signals indicate new build purchase intent"}'::jsonb, true),
('CCS', 'high_affluence_homeowners', 'High Affluence Homeowners', 'Affluent owner-occupier households', ARRAY['affluence', 'ownership', 'property'], '{"related_segments": ["new_build_buyers", "home_renovators"], "adjacency_score": 0.87}'::jsonb, '{"signals": ["affluence_proxy", "ownership_confidence_high"], "evidence": "Financial and ownership signals indicate high affluence homeowner segment"}'::jsonb, true)
ON CONFLICT (provider, segment_key) DO NOTHING;
