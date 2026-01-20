-- ============================================================================
-- Migration 002: Hardening & Security Improvements
-- ============================================================================
-- This migration adds:
-- 1. Uniqueness constraints
-- 2. Additional indexes for performance
-- 3. WITH CHECK policy for geo_units UPDATE
-- 4. Storage policies for audience-exports bucket
-- 5. Missing foreign key constraints validation

-- ============================================================================
-- 1. Add uniqueness constraints
-- ============================================================================

-- Prevent duplicate segments for same audience/provider/key combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_audience_segments_unique 
ON audience_segments(audience_id, segment_type, provider, segment_key);

-- ============================================================================
-- 2. Add additional performance indexes
-- ============================================================================

-- Composite index for common segment queries
CREATE INDEX IF NOT EXISTS idx_audience_segments_composite 
ON audience_segments(audience_id, segment_type, construction_mode);

-- Composite index for geo_units queries
CREATE INDEX IF NOT EXISTS idx_geo_units_composite 
ON geo_units(audience_id, geo_type);

-- Index for exports ordered by creation time
CREATE INDEX IF NOT EXISTS idx_exports_audience_created 
ON exports(audience_id, created_at DESC);

-- ============================================================================
-- 3. Fix missing WITH CHECK for geo_units UPDATE
-- ============================================================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update geo_units of their audiences" ON geo_units;

-- Recreate with WITH CHECK
CREATE POLICY "Users can update geo_units of their audiences"
    ON geo_units FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = geo_units.audience_id
            AND audiences.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.id = geo_units.audience_id
            AND audiences.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 4. Add WITH CHECK for exports UPDATE (if needed in future)
-- ============================================================================

-- Currently exports are insert-only, but add UPDATE policy for completeness
-- Drop if exists first, then create
DROP POLICY IF EXISTS "Users can update their own exports" ON exports;
CREATE POLICY "Users can update their own exports"
    ON exports FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 5. Storage Policies for audience-exports bucket
-- ============================================================================
-- Note: These policies assume the bucket 'audience-exports' exists and is private.
-- Run these in Supabase SQL Editor after creating the bucket.

-- Policy: Authenticated users can upload exports only for their own audiences
-- Drop if exists first, then create
DROP POLICY IF EXISTS "Users can upload exports for their audiences" ON storage.objects;
CREATE POLICY "Users can upload exports for their audiences"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'audience-exports'
    AND (
        -- Extract audience_id from path: audience-{audience_id}-{timestamp}.{ext}
        EXISTS (
            SELECT 1 FROM audiences
            WHERE audiences.user_id = auth.uid()
            AND storage.objects.name LIKE '%' || audiences.id::text || '%'
        )
    )
);

-- Policy: Users can read/download their own exports
DROP POLICY IF EXISTS "Users can read their own exports" ON storage.objects;
CREATE POLICY "Users can read their own exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'audience-exports'
    AND (
        -- Check via exports table
        EXISTS (
            SELECT 1 FROM exports
            WHERE exports.user_id = auth.uid()
            AND exports.storage_path = storage.objects.name
        )
    )
);

-- Policy: Users can delete their own exports
DROP POLICY IF EXISTS "Users can delete their own exports" ON storage.objects;
CREATE POLICY "Users can delete their own exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'audience-exports'
    AND (
        EXISTS (
            SELECT 1 FROM exports
            WHERE exports.user_id = auth.uid()
            AND exports.storage_path = storage.objects.name
        )
    )
);

-- ============================================================================
-- 6. Add check constraints for data validation
-- ============================================================================

-- Ensure target_reach is positive if provided
ALTER TABLE audiences 
ADD CONSTRAINT check_target_reach_positive 
CHECK (target_reach IS NULL OR target_reach > 0);

-- Ensure budget_total is positive if provided
ALTER TABLE audiences 
ADD CONSTRAINT check_budget_positive 
CHECK (budget_total IS NULL OR budget_total > 0);

-- Ensure end_date is after start_date if both provided
ALTER TABLE audiences 
ADD CONSTRAINT check_date_range 
CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);

-- Ensure weight is positive
ALTER TABLE audience_segments 
ADD CONSTRAINT check_weight_positive 
CHECK (weight > 0);

-- Ensure score is between 0 and 100
ALTER TABLE geo_units 
ADD CONSTRAINT check_score_range 
CHECK (score >= 0 AND score <= 100);

-- ============================================================================
-- 7. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE audiences IS 'Main audience records owned by users';
COMMENT ON TABLE audience_segments IS 'Segments associated with audiences, can be primary or secondary';
COMMENT ON TABLE audience_profile_settings IS 'Profile settings and derived statistics for audiences';
COMMENT ON TABLE geo_units IS 'Geographic units (H3 tiles or postcode sectors) for audience mapping';
COMMENT ON TABLE poi_layers IS 'Points of interest layers for map visualization';
COMMENT ON TABLE exports IS 'Export history with references to storage paths';

COMMENT ON COLUMN audience_segments.segment_type IS 'primary or secondary audience segment';
COMMENT ON COLUMN audience_segments.construction_mode IS 'validation (Option 1) or extension (Option 2)';
COMMENT ON COLUMN audience_profile_settings.scale_accuracy IS 'Slider position 0-100: 0=max scale, 100=max accuracy';
