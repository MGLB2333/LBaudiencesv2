-- Add agreement tracking to geo_units for validation mode
ALTER TABLE geo_units
ADD COLUMN IF NOT EXISTS agreement_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS agreeing_providers TEXT[] DEFAULT '{}'::text[];

-- Add index for filtering by agreement
CREATE INDEX IF NOT EXISTS idx_geo_units_agreement_count ON geo_units(agreement_count);

-- Add comment
COMMENT ON COLUMN geo_units.agreement_count IS 'Number of providers that agree on this geo unit for validation mode';
COMMENT ON COLUMN geo_units.agreeing_providers IS 'Array of provider names that agree on this geo unit';
