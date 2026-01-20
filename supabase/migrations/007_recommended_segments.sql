-- Add is_recommended flag to audience_segments
ALTER TABLE audience_segments 
ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false;

-- Backfill existing rows
UPDATE audience_segments 
SET is_recommended = false 
WHERE is_recommended IS NULL;
