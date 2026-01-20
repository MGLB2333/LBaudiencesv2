-- Create audience_selected_segments table for Extension mode
-- Stores which segments are selected for an audience (anchor + suggested additions)
CREATE TABLE IF NOT EXISTS audience_selected_segments (
  audience_id UUID NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
  segment_key TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (audience_id, segment_key)
);

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_audience_selected_segments_audience ON audience_selected_segments(audience_id);
CREATE INDEX IF NOT EXISTS idx_audience_selected_segments_segment ON audience_selected_segments(segment_key);

-- RLS policies
ALTER TABLE audience_selected_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own audience selected segments"
  ON audience_selected_segments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audiences
      WHERE audiences.id = audience_selected_segments.audience_id
      AND audiences.user_id = auth.uid()
    )
  );
