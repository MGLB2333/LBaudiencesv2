import { createClient } from '@/lib/supabase/client';
import { AudienceSegment, ConstructionMode, SegmentType } from '@/lib/types';

export async function getSegments(
  audienceId: string,
  segmentType?: SegmentType,
  constructionMode?: ConstructionMode
): Promise<AudienceSegment[]> {
  const supabase = createClient();
  let query = supabase
    .from('audience_segments')
    .select('id, audience_id, segment_type, construction_mode, provider, segment_key, segment_label, description, is_selected, weight, created_at, origin, match_type, evidence, source_providers, metadata, added_at, created_by_mode, is_recommended')
    .eq('audience_id', audienceId);

  if (segmentType) {
    query = query.eq('segment_type', segmentType);
  }
  if (constructionMode) {
    query = query.eq('construction_mode', constructionMode);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as AudienceSegment[];
}

export async function updateSegmentSelection(
  segmentId: string,
  isSelected: boolean
): Promise<AudienceSegment> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('audience_segments') as any)
    .update({ is_selected: isSelected })
    .eq('id', segmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeSegment(segmentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('audience_segments')
    .delete()
    .eq('id', segmentId);

  if (error) throw error;
}

export async function updateConstructionMode(
  audienceId: string,
  mode: ConstructionMode
): Promise<void> {
  const supabase = createClient();
  const { error } = await (supabase
    .from('audience_segments') as any)
    .update({ construction_mode: mode })
    .eq('audience_id', audienceId);

  if (error) throw error;
}

export async function addSegmentFromSuggestion(
  audienceId: string,
  suggestion: {
    provider: string;
    segment_key: string;
    segment_label: string;
    description?: string;
    origin: 'brief' | 'validated' | 'suggested';
    match_type: 'name_match' | 'inferred';
    evidence?: any;
    source_providers?: string[];
    created_by_mode?: 'validation' | 'extension' | 'manual';
    is_recommended?: boolean;
    is_selected?: boolean;
  }
): Promise<AudienceSegment> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get construction mode from existing segments
  const { data: existing } = await supabase
    .from('audience_segments')
    .select('construction_mode, segment_type')
    .eq('audience_id', audienceId)
    .limit(1)
    .single();

  // Check if segment already exists (to avoid unique constraint violation)
  const segmentType = (existing as any)?.segment_type || 'primary';
  const { data: existingSegment } = await supabase
    .from('audience_segments')
    .select('*')
    .eq('audience_id', audienceId)
    .eq('segment_type', segmentType)
    .eq('provider', suggestion.provider)
    .eq('segment_key', suggestion.segment_key)
    .maybeSingle();

  if (existingSegment) {
    // Update existing segment instead of inserting
    const existing = existingSegment as any;
    const { data, error } = await (supabase
      .from('audience_segments') as any)
      .update({
        segment_label: suggestion.segment_label,
        description: suggestion.description || null,
        is_selected: suggestion.is_selected !== undefined ? suggestion.is_selected : existing.is_selected,
        origin: suggestion.origin,
        match_type: suggestion.match_type,
        evidence: suggestion.evidence || {},
        source_providers: suggestion.source_providers || [],
        created_by_mode: suggestion.created_by_mode || existing.created_by_mode || 'extension',
        added_at: new Date().toISOString(),
        is_recommended: suggestion.is_recommended !== undefined ? suggestion.is_recommended : existing.is_recommended || false,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Insert new segment
  const existingMode = (existing as any)?.construction_mode || 'extension';
  const { data, error } = await supabase
    .from('audience_segments')
    .insert({
      audience_id: audienceId,
      segment_type: segmentType,
      construction_mode: existingMode,
      provider: suggestion.provider,
      segment_key: suggestion.segment_key,
      segment_label: suggestion.segment_label,
      description: suggestion.description || null,
      is_selected: suggestion.is_selected !== undefined ? suggestion.is_selected : (suggestion.origin === 'brief' ? true : false),
      weight: 1,
      origin: suggestion.origin,
      match_type: suggestion.match_type,
      evidence: suggestion.evidence || {},
      source_providers: suggestion.source_providers || [],
      metadata: {},
      created_by_mode: suggestion.created_by_mode || 'extension',
      added_at: new Date().toISOString(),
      is_recommended: suggestion.is_recommended || false,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}
