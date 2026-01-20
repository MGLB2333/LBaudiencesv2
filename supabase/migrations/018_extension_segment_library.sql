-- Update segment_library with canonical segments for Extension mode
-- Add missing canonical segments and update adjacency relationships

-- First, ensure we have canonical segments (using CCS as provider for canonical)
INSERT INTO segment_library (provider, segment_key, label, description, tags, adjacency, example_signals, is_active)
VALUES
-- Anchor segment (home_movers) - update adjacency
('CCS', 'home_movers', 'Home Movers', 'Households that have recently moved or are planning to move', 
 ARRAY['movers', 'property', 'relocation'], 
 '{"related_segments": ["home_renovators", "new_build_buyers", "affluent_homeowners", "diy_enthusiasts", "large_households"], "adjacency_score": 1.0, "why_suggested": "People who move often renovate, buy new builds, or are affluent homeowners"}'::jsonb,
 '{"signals": ["property_age_0_5", "ownership_confidence_high"], "evidence": "Property transaction and address change signals indicate mover activity"}'::jsonb,
 true),

-- Extension segments
('CCS', 'home_renovators', 'Home Renovators', 'Households showing renovation intent and activity',
 ARRAY['renovation', 'home_improvement', 'diy'],
 '{"related_segments": ["home_movers", "new_build_buyers", "diy_enthusiasts"], "adjacency_score": 0.90, "why_suggested": "People who move often renovate their new home, and renovators may move to a fixer-upper"}'::jsonb,
 '{"signals": ["planning_approval", "property_age_10_20"], "evidence": "Planning permission and property age signals indicate renovation lifecycle"}'::jsonb,
 true),

('CCS', 'new_build_buyers', 'New Build Buyers', 'Households purchasing or interested in new build properties',
 ARRAY['new_build', 'property', 'movers'],
 '{"related_segments": ["home_movers", "affluent_homeowners"], "adjacency_score": 0.88, "why_suggested": "New build buyers are movers, often with higher affluence"}'::jsonb,
 '{"signals": ["property_age_0_5", "affluence_proxy"], "evidence": "Property age and affluence signals indicate new build purchase intent"}'::jsonb,
 true),

('CCS', 'affluent_homeowners', 'Affluent Homeowners', 'Affluent owner-occupier households',
 ARRAY['affluence', 'ownership', 'property'],
 '{"related_segments": ["new_build_buyers", "home_renovators", "home_movers"], "adjacency_score": 0.87, "why_suggested": "Affluent homeowners often move to upgrade, buy new builds, or renovate"}'::jsonb,
 '{"signals": ["affluence_proxy", "ownership_confidence_high"], "evidence": "Financial and ownership signals indicate high affluence homeowner segment"}'::jsonb,
 true),

('CCS', 'diy_enthusiasts', 'DIY Enthusiasts', 'Households with demonstrated interest in DIY projects',
 ARRAY['diy', 'home_improvement', 'renovation'],
 '{"related_segments": ["home_renovators", "home_movers"], "adjacency_score": 0.85, "why_suggested": "DIY enthusiasts often renovate and may move to properties needing work"}'::jsonb,
 '{"signals": ["planning_approval", "ownership_confidence_high"], "evidence": "Lifestyle indicators show DIY and home improvement interest"}'::jsonb,
 true),

('CCS', 'large_households', 'Large Households', 'Households with 4+ members',
 ARRAY['family', 'household_size', 'property'],
 '{"related_segments": ["home_movers", "affluent_homeowners"], "adjacency_score": 0.80, "why_suggested": "Large households often move to accommodate growing families"}'::jsonb,
 '{"signals": ["household_size_large", "ownership_confidence_high"], "evidence": "Household composition indicates large family unit"}'::jsonb,
 true)

ON CONFLICT (provider, segment_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  adjacency = EXCLUDED.adjacency,
  example_signals = EXCLUDED.example_signals,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
