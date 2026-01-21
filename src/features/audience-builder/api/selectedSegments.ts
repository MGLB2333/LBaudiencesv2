import { createClient } from '@/lib/supabase/client';

/**
 * Get selected segment keys for an audience (Extension mode)
 */
export async function getSelectedSegmentKeys(audienceId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audience_selected_segments')
    .select('segment_key')
    .eq('audience_id', audienceId)
    .order('added_at', { ascending: true });

  if (error) throw error;
  return ((data as any[]) || []).map((row: any) => row.segment_key);
}

/**
 * Set selected segment keys for an audience (Extension mode)
 * Replaces all existing selections
 */
export async function setSelectedSegmentKeys(
  audienceId: string,
  segmentKeys: string[]
): Promise<void> {
  const supabase = createClient();

  // Delete all existing selections
  const { error: deleteError } = await supabase
    .from('audience_selected_segments')
    .delete()
    .eq('audience_id', audienceId);

  if (deleteError) throw deleteError;

  // Insert new selections
  if (segmentKeys.length > 0) {
    const rows = segmentKeys.map((segment_key) => ({
      audience_id: audienceId,
      segment_key,
    }));

    const { error: insertError } = await supabase
      .from('audience_selected_segments')
      .insert(rows as any);

    if (insertError) throw insertError;
  }
}

/**
 * Toggle a single segment selection (Extension mode)
 */
export async function toggleSelectedSegment(
  audienceId: string,
  segmentKey: string,
  isSelected: boolean
): Promise<void> {
  const supabase = createClient();

  if (isSelected) {
    // Insert if not exists
    const { error } = await supabase
      .from('audience_selected_segments')
      .upsert(
        {
          audience_id: audienceId,
          segment_key: segmentKey,
        } as any,
        {
          onConflict: 'audience_id,segment_key',
        }
      );

    if (error) throw error;
  } else {
    // Delete
    const { error } = await supabase
      .from('audience_selected_segments')
      .delete()
      .eq('audience_id', audienceId)
      .eq('segment_key', segmentKey);

    if (error) throw error;
  }
}
