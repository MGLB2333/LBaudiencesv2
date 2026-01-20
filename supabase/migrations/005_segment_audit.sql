-- Add audit metadata to audience_segments
ALTER TABLE audience_segments 
ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_by_mode TEXT CHECK (created_by_mode IN ('validation', 'extension', 'manual')) DEFAULT 'manual';

-- Update existing segments to have added_at = created_at
UPDATE audience_segments 
SET added_at = created_at 
WHERE added_at IS NULL;

-- Set default for created_by_mode based on existing data
UPDATE audience_segments 
SET created_by_mode = construction_mode 
WHERE created_by_mode IS NULL OR created_by_mode = 'manual';

-- Add index for created_by_mode
CREATE INDEX IF NOT EXISTS idx_audience_segments_created_by_mode ON audience_segments(created_by_mode);
