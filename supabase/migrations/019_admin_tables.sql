-- Admin tables for logo settings, data partners, and clients

-- app_settings table for storing app-wide settings (e.g., selected logo)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- admin_data_partners table
CREATE TABLE IF NOT EXISTS admin_data_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- admin_clients table
CREATE TABLE IF NOT EXISTS admin_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_data_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to read/write (demo-friendly)
CREATE POLICY "Authenticated users can manage app settings"
  ON app_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage data partners"
  ON admin_data_partners FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage clients"
  ON admin_clients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed initial data
INSERT INTO app_settings (key, value)
VALUES ('selected_logo', '{"file": "Total TV_Primary logo.png"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_data_partners (name, url, description)
VALUES
  ('CCS', 'https://www.dentsu.com', 'Consumer Classification System - primary data provider'),
  ('Experian', 'https://www.experian.co.uk', 'Credit and consumer data insights'),
  ('ONS', 'https://www.ons.gov.uk', 'Office for National Statistics - official UK data'),
  ('TwentyCI', 'https://www.twentyci.co.uk', 'Property and moving data intelligence'),
  ('Outra', 'https://www.outra.com', 'Location and movement data analytics'),
  ('Captify', 'https://www.captify.com', 'Search intelligence and audience insights')
ON CONFLICT DO NOTHING;

INSERT INTO admin_clients (name, url)
VALUES
  ('Nike', 'https://www.nike.com'),
  ('Coca-Cola', 'https://www.coca-cola.com'),
  ('Apple', 'https://www.apple.com'),
  ('Amazon', 'https://www.amazon.com'),
  ('Microsoft', 'https://www.microsoft.com'),
  ('Google', 'https://www.google.com')
ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
CREATE INDEX IF NOT EXISTS idx_admin_data_partners_name ON admin_data_partners(name);
CREATE INDEX IF NOT EXISTS idx_admin_clients_name ON admin_clients(name);
