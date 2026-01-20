-- Migration: District normalization for reliable matching
-- Additive only: adds normalization function and canonical district_norm columns
-- Does not modify existing columns or logic
-- Purpose: Fix matching issues caused by Unicode/whitespace differences between data sources

-- ============================================
-- 1. Create normalization function
-- ============================================

CREATE OR REPLACE FUNCTION normalize_district(input_district TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF input_district IS NULL THEN
    RETURN NULL;
  END IF;

  -- Step 1: Trim leading/trailing whitespace
  normalized := TRIM(input_district);

  -- Step 2: Convert to uppercase
  normalized := UPPER(normalized);

  -- Step 3: Remove all whitespace characters (spaces, tabs, newlines, Unicode spaces)
  -- This includes: regular space, tab (\t), newline (\n), carriage return (\r)
  -- PostgreSQL's \s character class includes most Unicode whitespace
  normalized := REGEXP_REPLACE(normalized, '\s+', '', 'g');
  
  -- Step 4: Explicitly remove common Unicode space variants that might not be caught by \s
  -- Non-breaking space (U+00A0 = \xC2\xA0 in UTF-8), zero-width space, etc.
  -- Use TRANSLATE for specific character removal (more reliable than regex for Unicode)
  normalized := TRANSLATE(
    normalized,
    -- Source characters: non-breaking space, zero-width space, and other Unicode spaces
    CHR(160) || CHR(8201) || CHR(8202) || CHR(8203) || CHR(8239) || CHR(8287) || CHR(12288),
    -- Target: empty (remove them)
    ''
  );

  RETURN normalized;
END;
$$;

COMMENT ON FUNCTION normalize_district(TEXT) IS 
'Normalizes district codes for reliable matching. Trims, uppercases, and removes all whitespace/Unicode space variants. Use district_norm columns for joins.';

-- ============================================
-- 2. Add district_norm columns (additive only, nullable)
-- ============================================

-- geo_districts
ALTER TABLE geo_districts 
ADD COLUMN IF NOT EXISTS district_norm TEXT;

COMMENT ON COLUMN geo_districts.district_norm IS 
'Canonical normalized district code. Use this for reliable joins with other tables. Populated by normalize_district(district).';

-- geo_sector_signals (base table for geo_district_signals view)
ALTER TABLE geo_sector_signals 
ADD COLUMN IF NOT EXISTS district_norm TEXT;

COMMENT ON COLUMN geo_sector_signals.district_norm IS 
'Canonical normalized district code. Use this for reliable joins with other tables. Populated by normalize_district(district).';

-- district_tv_regions
ALTER TABLE district_tv_regions 
ADD COLUMN IF NOT EXISTS district_norm TEXT;

COMMENT ON COLUMN district_tv_regions.district_norm IS 
'Canonical normalized district code. Use this for reliable joins with other tables. Populated by normalize_district(district).';

-- district_neighbors (for district column)
ALTER TABLE district_neighbors 
ADD COLUMN IF NOT EXISTS district_norm TEXT;

COMMENT ON COLUMN district_neighbors.district_norm IS 
'Canonical normalized district code (for district column). Use this for reliable joins with other tables. Populated by normalize_district(district).';

-- district_neighbors (for neighbor_district column)
ALTER TABLE district_neighbors 
ADD COLUMN IF NOT EXISTS neighbor_district_norm TEXT;

COMMENT ON COLUMN district_neighbors.neighbor_district_norm IS 
'Canonical normalized district code (for neighbor_district column). Use this for reliable joins with other tables. Populated by normalize_district(neighbor_district).';

-- ============================================
-- 3. Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_geo_districts_district_norm ON geo_districts(district_norm);
CREATE INDEX IF NOT EXISTS idx_geo_sector_signals_district_norm ON geo_sector_signals(district_norm);
CREATE INDEX IF NOT EXISTS idx_district_tv_regions_district_norm ON district_tv_regions(district_norm);
CREATE INDEX IF NOT EXISTS idx_district_neighbors_district_norm ON district_neighbors(district_norm);
CREATE INDEX IF NOT EXISTS idx_district_neighbors_neighbor_district_norm ON district_neighbors(neighbor_district_norm);

-- ============================================
-- 4. Backfill district_norm columns (idempotent)
-- ============================================

-- Backfill geo_districts
UPDATE geo_districts
SET district_norm = normalize_district(district)
WHERE district_norm IS NULL
  AND district IS NOT NULL;

-- Backfill geo_sector_signals (base table for geo_district_signals view)
UPDATE geo_sector_signals
SET district_norm = normalize_district(district)
WHERE district_norm IS NULL
  AND district IS NOT NULL;

-- Update geo_district_signals view to include district_norm
-- Must preserve exact original column order, so add district_norm at the end
DROP VIEW IF EXISTS geo_district_signals;
CREATE VIEW geo_district_signals AS
SELECT 
  segment_key,
  provider,
  provider_segment_label,
  district,
  COUNT(*) as sectors_count,
  AVG(score) FILTER (WHERE score IS NOT NULL) as district_score_avg,
  AVG(score_norm) FILTER (WHERE score_norm IS NOT NULL) as district_score_norm,
  BOOL_OR(score IS NOT NULL) as has_score,
  MAX(district_norm) as district_norm  -- Add normalized district column at the end (use MAX since all rows in group have same value)
FROM geo_sector_signals
GROUP BY segment_key, provider, provider_segment_label, district;

-- Backfill district_tv_regions
UPDATE district_tv_regions
SET district_norm = normalize_district(district)
WHERE district_norm IS NULL
  AND district IS NOT NULL;

-- Backfill district_neighbors (district column)
UPDATE district_neighbors
SET district_norm = normalize_district(district)
WHERE district_norm IS NULL
  AND district IS NOT NULL;

-- Backfill district_neighbors (neighbor_district column)
UPDATE district_neighbors
SET neighbor_district_norm = normalize_district(neighbor_district)
WHERE neighbor_district_norm IS NULL
  AND neighbor_district IS NOT NULL;

-- ============================================
-- 5. Add constraint to prevent self-links in normalized columns
-- ============================================

-- Ensure no self-links in normalized neighbor relationships
-- (This is a safety check, the original constraint already prevents this, but this ensures normalized columns match)
ALTER TABLE district_neighbors
DROP CONSTRAINT IF EXISTS district_neighbors_no_self_link_norm;

ALTER TABLE district_neighbors
ADD CONSTRAINT district_neighbors_no_self_link_norm 
CHECK (district_norm IS NULL OR neighbor_district_norm IS NULL OR district_norm <> neighbor_district_norm);

-- ============================================
-- 6. Create trigger function to auto-populate district_norm on INSERT/UPDATE
-- ============================================

-- Function to auto-populate district_norm for geo_districts
CREATE OR REPLACE FUNCTION auto_normalize_geo_districts_district()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.district IS NOT NULL THEN
    NEW.district_norm := normalize_district(NEW.district);
  END IF;
  RETURN NEW;
END;
$$;

-- Function to auto-populate district_norm for geo_sector_signals (base table)
CREATE OR REPLACE FUNCTION auto_normalize_geo_sector_signals_district()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.district IS NOT NULL THEN
    NEW.district_norm := normalize_district(NEW.district);
  END IF;
  RETURN NEW;
END;
$$;

-- Function to auto-populate district_norm for district_tv_regions
CREATE OR REPLACE FUNCTION auto_normalize_district_tv_regions_district()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.district IS NOT NULL THEN
    NEW.district_norm := normalize_district(NEW.district);
  END IF;
  RETURN NEW;
END;
$$;

-- Function to auto-populate district_norm for district_neighbors
CREATE OR REPLACE FUNCTION auto_normalize_district_neighbors_districts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.district IS NOT NULL THEN
    NEW.district_norm := normalize_district(NEW.district);
  END IF;
  IF NEW.neighbor_district IS NOT NULL THEN
    NEW.neighbor_district_norm := normalize_district(NEW.neighbor_district);
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers (drop first for idempotency)
DROP TRIGGER IF EXISTS trigger_auto_normalize_geo_districts_district ON geo_districts;
CREATE TRIGGER trigger_auto_normalize_geo_districts_district
  BEFORE INSERT OR UPDATE OF district ON geo_districts
  FOR EACH ROW
  EXECUTE FUNCTION auto_normalize_geo_districts_district();

DROP TRIGGER IF EXISTS trigger_auto_normalize_geo_sector_signals_district ON geo_sector_signals;
CREATE TRIGGER trigger_auto_normalize_geo_sector_signals_district
  BEFORE INSERT OR UPDATE OF district ON geo_sector_signals
  FOR EACH ROW
  EXECUTE FUNCTION auto_normalize_geo_sector_signals_district();

DROP TRIGGER IF EXISTS trigger_auto_normalize_district_tv_regions_district ON district_tv_regions;
CREATE TRIGGER trigger_auto_normalize_district_tv_regions_district
  BEFORE INSERT OR UPDATE OF district ON district_tv_regions
  FOR EACH ROW
  EXECUTE FUNCTION auto_normalize_district_tv_regions_district();

DROP TRIGGER IF EXISTS trigger_auto_normalize_district_neighbors_districts ON district_neighbors;
CREATE TRIGGER trigger_auto_normalize_district_neighbors_districts
  BEFORE INSERT OR UPDATE OF district, neighbor_district ON district_neighbors
  FOR EACH ROW
  EXECUTE FUNCTION auto_normalize_district_neighbors_districts();

-- ============================================
-- Notes for future development:
-- ============================================
-- 
-- IMPORTANT: All future joins between district-related tables should use district_norm
-- instead of the raw district column to ensure reliable matching.
--
-- Example:
--   OLD: JOIN geo_districts gd ON dtr.district = gd.district
--   NEW: JOIN geo_districts gd ON dtr.district_norm = gd.district_norm
--
-- The normalization function handles:
--   - Trimming whitespace
--   - Uppercasing
--   - Removing all whitespace (spaces, tabs, newlines)
--   - Removing Unicode space variants (non-breaking spaces, etc.)
--
-- This ensures districts like "AB1", "AB 1", "AB\t1", "AB\u00A01" all normalize to "AB1"
