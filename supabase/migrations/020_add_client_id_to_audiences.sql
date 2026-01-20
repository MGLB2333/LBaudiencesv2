-- Add client_id to audiences table
ALTER TABLE audiences
ADD COLUMN client_id UUID REFERENCES admin_clients(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_audiences_client_id ON audiences(client_id);

-- Add comment
COMMENT ON COLUMN audiences.client_id IS 'Reference to the client this audience belongs to';
