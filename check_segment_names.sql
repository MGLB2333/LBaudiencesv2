-- Check for audiences with "Families with kids over 11" segment label
-- This query shows all segments with that exact label

SELECT 
  a.id as audience_id,
  a.name as audience_name,
  asg.id as segment_id,
  asg.segment_key,
  asg.segment_label,
  asg.origin,
  asg.is_selected,
  asg.provider,
  asg.created_at
FROM audience_segments asg
JOIN audiences a ON a.id = asg.audience_id
WHERE asg.segment_label ILIKE '%families%kids%11%'
   OR asg.segment_label = 'Families with kids over 11'
ORDER BY asg.created_at DESC;

-- Check all segments for a specific audience (replace with actual audience ID)
-- SELECT 
--   id,
--   segment_key,
--   segment_label,
--   origin,
--   is_selected,
--   provider,
--   created_at
-- FROM audience_segments
-- WHERE audience_id = 'YOUR_AUDIENCE_ID_HERE'
-- ORDER BY created_at DESC;

-- Check which segments are being used as "anchor" segments (origin='brief' or is_selected=true)
-- This is what AudiencesList.tsx uses to display the segment name
SELECT 
  a.id as audience_id,
  a.name as audience_name,
  asg.segment_label,
  asg.origin,
  asg.is_selected,
  asg.segment_key,
  asg.provider
FROM audiences a
LEFT JOIN audience_segments asg ON asg.audience_id = a.id
  AND (asg.origin = 'brief' OR asg.is_selected = true)
  AND asg.segment_type = 'primary'
ORDER BY a.created_at DESC;

-- Count segments by label to see if there are multiple with the same hardcoded value
SELECT 
  segment_label,
  COUNT(*) as count,
  array_agg(DISTINCT audience_id) as audience_ids
FROM audience_segments
WHERE segment_type = 'primary'
GROUP BY segment_label
HAVING segment_label ILIKE '%families%kids%11%'
   OR segment_label = 'Families with kids over 11'
ORDER BY count DESC;
