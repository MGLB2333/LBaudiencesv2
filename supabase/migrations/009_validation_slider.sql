-- Add validation slider settings to audience_construction_settings
ALTER TABLE audience_construction_settings
ADD COLUMN IF NOT EXISTS validation_min_agreement INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS validation_agreement_mode TEXT DEFAULT 'threshold' CHECK (validation_agreement_mode IN ('threshold', 'majority', 'unanimous'));

-- Add comment
COMMENT ON COLUMN audience_construction_settings.validation_min_agreement IS 'Minimum number of agreeing providers required for a geo unit to be included (1 to N)';
COMMENT ON COLUMN audience_construction_settings.validation_agreement_mode IS 'Mode for validation agreement calculation (threshold, majority, unanimous)';
