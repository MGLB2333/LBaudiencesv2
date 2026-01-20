-- Migration: data_partners table (canonical source of truth for providers)
-- This table stores provider metadata and is backfilled from geo_district_signals

-- Create data_partners table
CREATE TABLE IF NOT EXISTS data_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  website_url TEXT,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on provider_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_data_partners_provider_key ON data_partners(provider_key);

-- Enable RLS
ALTER TABLE data_partners ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read/write
DROP POLICY IF EXISTS "Authenticated users can manage data partners" ON data_partners;
CREATE POLICY "Authenticated users can manage data partners"
  ON data_partners FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Backfill from geo_district_signals
-- Insert one row per distinct provider, using provider as both provider_key and display_name
INSERT INTO data_partners (provider_key, display_name)
SELECT DISTINCT
  provider AS provider_key,
  provider AS display_name
FROM geo_district_signals
WHERE provider IS NOT NULL
  AND provider != ''
ON CONFLICT (provider_key) DO NOTHING;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_data_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER data_partners_updated_at
  BEFORE UPDATE ON data_partners
  FOR EACH ROW
  EXECUTE FUNCTION update_data_partners_updated_at();

-- Function to extract domain from URL and generate favicon URL
CREATE OR REPLACE FUNCTION extract_domain_from_url(url_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF url_text IS NULL OR url_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove protocol (http://, https://)
  url_text := REGEXP_REPLACE(url_text, '^https?://', '', 'i');
  
  -- Remove www. prefix
  url_text := REGEXP_REPLACE(url_text, '^www\.', '', 'i');
  
  -- Extract domain (everything up to first / or ?)
  url_text := SPLIT_PART(url_text, '/', 1);
  url_text := SPLIT_PART(url_text, '?', 1);
  
  RETURN url_text;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-populate logo_url from website_url
CREATE OR REPLACE FUNCTION auto_populate_logo_url()
RETURNS TRIGGER AS $$
DECLARE
  domain TEXT;
BEGIN
  -- Only set logo_url if it's NULL and website_url is provided
  IF NEW.logo_url IS NULL AND NEW.website_url IS NOT NULL AND NEW.website_url != '' THEN
    domain := extract_domain_from_url(NEW.website_url);
    IF domain IS NOT NULL THEN
      -- Use Google's favicon service
      NEW.logo_url := 'https://www.google.com/s2/favicons?domain=' || domain || '&sz=32';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist (to allow re-running migration)
DROP TRIGGER IF EXISTS data_partners_auto_logo_url_insert ON data_partners;
DROP TRIGGER IF EXISTS data_partners_auto_logo_url_update ON data_partners;

-- Trigger to auto-populate logo_url on insert
CREATE TRIGGER data_partners_auto_logo_url_insert
  BEFORE INSERT ON data_partners
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_logo_url();

-- Trigger to auto-populate logo_url on update (if logo_url is being cleared or website_url is being set)
CREATE TRIGGER data_partners_auto_logo_url_update
  BEFORE UPDATE ON data_partners
  FOR EACH ROW
  WHEN (NEW.logo_url IS NULL AND NEW.website_url IS NOT NULL AND NEW.website_url != '' AND (OLD.logo_url IS NULL OR OLD.website_url IS DISTINCT FROM NEW.website_url))
  EXECUTE FUNCTION auto_populate_logo_url();

-- Backfill logo_url for existing rows that have website_url but no logo_url
UPDATE data_partners
SET logo_url = 'https://www.google.com/s2/favicons?domain=' || extract_domain_from_url(website_url) || '&sz=32'
WHERE logo_url IS NULL 
  AND website_url IS NOT NULL 
  AND website_url != '';
