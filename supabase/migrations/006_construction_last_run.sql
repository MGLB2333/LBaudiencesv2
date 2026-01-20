-- Add last_run_at to audience_construction_settings
ALTER TABLE audience_construction_settings 
ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
