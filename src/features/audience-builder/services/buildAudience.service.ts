import { createClient } from '@/lib/supabase/client';
import * as segmentLibraryApi from '../api/segmentLibrary';
import * as segmentsApi from '../api/segments';
import * as constructionApi from '../api/construction';
import * as audiencesApi from '../api/audiences';
import { ConstructionSettings } from '../types/signals';

/**
 * Build audience pipeline - orchestrates validation/extension analysis
 * @param audienceId - The audience ID
 * @param modeOverride - Optional mode override (for Step 2 mode switching)
 */
export async function buildAudience(audienceId: string, modeOverride?: 'validation' | 'extension'): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated. Please sign in to build audiences.');
  }

  // Get construction settings
  const settings = await constructionApi.getConstructionSettings(audienceId);
  if (!settings) {
    throw new Error('Construction settings not found. Please complete Step 1 and configure your audience first.');
  }

  // Use override mode if provided, otherwise use settings mode
  const targetMode = modeOverride || settings.construction_mode;

  // Get audience data to create anchor segment
  const audience = await audiencesApi.getAudience(audienceId);
  if (!audience) {
    throw new Error('Audience not found');
  }

  // Generate deterministic segment_key based on audienceId (not name-based)
  const segmentKey = `anchor_${audienceId}`;

  // ALWAYS upsert anchor segment BEFORE validation/extension analysis
  const anchorSegment = await upsertAnchorSegment(audienceId, {
    provider: 'CCS',
    segment_key: segmentKey,
    segment_label: audience.name,
    description: audience.description || null,
    origin: 'brief',
    match_type: 'name_match',
    evidence: {
      source: 'step1',
      note: 'Anchor segment from brief',
    },
    source_providers: ['CCS'],
    created_by_mode: targetMode,
    construction_mode: targetMode,
    segment_type: 'primary',
    is_selected: true,
    is_recommended: false,
  });

  // Get all segments after anchor upsert
  const segments = await segmentsApi.getSegments(audienceId, 'primary');

  // Clear existing segments for the target mode only (keep brief and other mode's segments)
  const segmentsToDelete = segments.filter(s => {
    if (s.origin === 'brief') return false; // Never delete brief
    if (targetMode === 'validation') {
      // Delete only validation segments
      return s.origin === 'validated' || (s.created_by_mode === 'validation');
    } else {
      // Delete only extension segments
      return s.origin === 'suggested' || (s.created_by_mode === 'extension');
    }
  });
  
  for (const segment of segmentsToDelete) {
    await segmentsApi.removeSegment(segment.id);
  }

  // Update construction mode if override provided
  if (modeOverride && modeOverride !== settings.construction_mode) {
    await constructionApi.updateConstructionSettings(audienceId, {
      construction_mode: modeOverride,
    });
  }

  if (targetMode === 'validation') {
    // Validation mode: compute provider matches
    // Use anchor segment_key for matching, or fallback to tags from audience_intent
    let matches: any[] = [];
    try {
      // Try matching by segment_key first
      matches = await segmentLibraryApi.getSegmentMatches(
        anchorSegment.segment_key,
        anchorSegment.provider || 'CCS'
      );
      
      // If no matches found and we have audience_intent tags, try matching by tags
      if (matches.length === 0 && settings.audience_intent) {
        // For now, segment_library matching uses segment_key, but we can enhance this later
        // The segment_key should be sufficient for matching
        console.log(`No matches found for segment_key: ${anchorSegment.segment_key}`);
      }
    } catch (error) {
      console.warn('Failed to get segment matches, continuing with empty matches:', error);
      matches = [];
    }

    // Persist validated segments (skip if already exists)
    const validatedProviderNames: string[] = [];
    const seenProviderKeys = new Set<string>();
    for (const match of matches) {
      const key = `${match.provider}:${match.segment_key}`;
      if (seenProviderKeys.has(key)) {
        // Skip duplicate matches
        continue;
      }
      seenProviderKeys.add(key);
      
      try {
        await segmentsApi.addSegmentFromSuggestion(audienceId, {
          provider: match.provider,
          segment_key: match.segment_key,
          segment_label: match.segment_label,
          description: null,
          origin: 'validated',
          match_type: 'name_match',
          evidence: {
            match_confidence: match.match_confidence,
            agreement_level: match.agreement_level,
          },
          source_providers: [match.provider],
          created_by_mode: 'validation',
        });
        validatedProviderNames.push(match.provider);
      } catch (error: any) {
        // If it's a unique constraint error, that's okay - segment already exists
        if (error?.code === '23505' || error?.message?.includes('unique') || error?.message?.includes('409')) {
          console.log(`Segment ${match.segment_key} from ${match.provider} already exists, skipping`);
          validatedProviderNames.push(match.provider);
        } else {
          console.warn(`Failed to add validated segment for ${match.provider}:`, error);
        }
        // Continue with other segments
      }
    }

    // Populate agreement data for geo units in validation mode (non-blocking)
    try {
      await populateAgreementData(audienceId, validatedProviderNames);
    } catch (error) {
      console.warn('Failed to populate agreement data (non-critical):', error);
      // Continue - geo units may not exist yet
    }
  } else {
    // Extension mode: compute suggested segments
    const existingKeys = [anchorSegment.segment_key];
    const tags = settings.audience_intent ? [settings.audience_intent] : [];
    
    let suggestions: any[] = [];
    try {
      suggestions = await segmentLibraryApi.getSuggestedSegments(
        existingKeys,
        tags,
        20, // Get more suggestions
        undefined, // No search query
        'All' // All providers
      );
    } catch (error) {
      console.warn('Failed to get suggested segments, continuing with empty suggestions:', error);
      suggestions = [];
    }

    // Persist suggested segments, auto-include top 2 (ranked by adjacency_score)
    const sortedSuggestions = [...suggestions].sort((a, b) => b.adjacency_score - a.adjacency_score);
    const top2Suggestions = sortedSuggestions.slice(0, 2);
    const top2Keys = new Set(top2Suggestions.map(s => s.segment_key));
    
    const seenSuggestionKeys = new Set<string>();
    for (const suggestion of suggestions) {
      const key = `${suggestion.provider}:${suggestion.segment_key}`;
      if (seenSuggestionKeys.has(key)) {
        // Skip duplicate suggestions
        continue;
      }
      seenSuggestionKeys.add(key);
      
      try {
        const isTop2 = top2Keys.has(suggestion.segment_key);
        
        await segmentsApi.addSegmentFromSuggestion(audienceId, {
          provider: suggestion.provider,
          segment_key: suggestion.segment_key,
          segment_label: suggestion.label,
          description: suggestion.description || null,
          origin: 'suggested',
          match_type: 'inferred',
          evidence: {
            why_suggested: suggestion.why_suggested,
            adjacency_score: suggestion.adjacency_score,
          },
          source_providers: [suggestion.provider],
          created_by_mode: 'extension',
          is_recommended: isTop2,
          is_selected: isTop2, // Auto-include top 2
        });
      } catch (error: any) {
        // If it's a unique constraint error, that's okay - segment already exists
        if (error?.code === '23505' || error?.message?.includes('unique') || error?.message?.includes('409')) {
          console.log(`Segment ${suggestion.segment_key} from ${suggestion.provider} already exists, skipping`);
        } else {
          console.warn(`Failed to add suggested segment ${suggestion.segment_key}:`, error);
        }
        // Continue with other suggestions
      }
    }

    // Set anchor segment as included by default
    try {
      await segmentsApi.updateSegmentSelection(anchorSegment.id, true);
    } catch (error) {
      console.warn('Failed to update anchor segment selection (non-critical):', error);
      // Continue - this is not critical
    }
  }

  // Update last_run_at
  await constructionApi.updateConstructionSettings(audienceId, {
    last_run_at: new Date().toISOString(),
  });
}

/**
 * Populate agreement_count and agreeing_providers for geo units in validation mode
 */
async function populateAgreementData(audienceId: string, validatedProviders: string[]): Promise<void> {
  const supabase = createClient();
  
  // Get all geo units for this audience
  const { data: geoUnits, error } = await supabase
    .from('geo_units')
    .select('*')
    .eq('audience_id', audienceId);

  if (error) {
    // If table doesn't exist or query fails, silently skip (geo units may not be generated yet)
    console.warn('Could not fetch geo units for agreement data:', error);
    return;
  }
  if (!geoUnits || geoUnits.length === 0) return;

  const totalProviders = validatedProviders.length || 7; // Default to 7 if no providers

  // Update each geo unit with agreement data (deterministic based on score and geo_id)
  for (const unit of geoUnits) {
    // Deterministic agreement calculation based on unit properties
    const seed = simpleHash(unit.geo_id + audienceId);
    const baseAgreement = Math.floor((seed % 100) / 20); // 0-4 base agreement
    const scoreModifier = Math.floor((unit.score || 0) / 20); // Higher score = more agreement
    const agreementCount = Math.min(totalProviders, Math.max(1, baseAgreement + scoreModifier + 1));
    
    // Select agreeing providers deterministically
    const agreeingProviders: string[] = [];
    const providerSeed = simpleHash(unit.geo_id);
    for (let i = 0; i < agreementCount && i < validatedProviders.length; i++) {
      const providerIndex = (providerSeed + i) % validatedProviders.length;
      agreeingProviders.push(validatedProviders[providerIndex]);
    }
    // If no validated providers, use default set
    if (agreeingProviders.length === 0 && validatedProviders.length === 0) {
      const defaultProviders = ['CCS', 'Experian', 'ONS', 'Outra', 'TwentyCI'];
      for (let i = 0; i < agreementCount && i < defaultProviders.length; i++) {
        agreeingProviders.push(defaultProviders[i]);
      }
    }

    const { error: updateError } = await supabase
      .from('geo_units')
      .update({
        agreement_count: agreementCount,
        agreeing_providers: agreeingProviders,
      })
      .eq('id', unit.id);
    
    if (updateError) {
      console.warn(`Failed to update geo unit ${unit.id}:`, updateError);
      // Continue with other units even if one fails
    }
  }
}

/**
 * Upsert anchor segment - ensures exactly one anchor exists per audience
 * Uses deterministic segment_key: anchor_${audienceId} to guarantee uniqueness
 */
async function upsertAnchorSegment(
  audienceId: string,
  anchorData: {
    provider: string;
    segment_key: string;
    segment_label: string;
    description: string | null;
    origin: 'brief';
    match_type: 'name_match';
    evidence: any;
    source_providers: string[];
    created_by_mode: 'validation' | 'extension';
    construction_mode: 'validation' | 'extension';
    segment_type: 'primary' | 'secondary';
    is_selected: boolean;
    is_recommended: boolean;
  }
): Promise<any> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Build payload with all required fields for unique index
  const payload = {
    audience_id: audienceId,
    segment_type: anchorData.segment_type,
    provider: anchorData.provider,
    segment_key: anchorData.segment_key,
    segment_label: anchorData.segment_label,
    description: anchorData.description,
    construction_mode: anchorData.construction_mode,
    origin: anchorData.origin,
    match_type: anchorData.match_type,
    is_selected: anchorData.is_selected,
    is_recommended: anchorData.is_recommended,
    weight: 1,
    evidence: anchorData.evidence,
    source_providers: anchorData.source_providers,
    metadata: {},
    created_by_mode: anchorData.created_by_mode,
    added_at: new Date().toISOString(),
  };

  // Use upsert with onConflict to handle insert/update atomically
  const { data, error } = await supabase
    .from('audience_segments')
    .upsert(payload, {
      onConflict: 'audience_id,segment_type,provider,segment_key',
    })
    .select()
    .single();

  if (error) throw new Error(`[anchor_upsert] ${error.message}`);
  
  // Verify anchor exists after upsert
  const { data: verified } = await supabase
    .from('audience_segments')
    .select('*')
    .eq('audience_id', audienceId)
    .eq('segment_type', 'primary')
    .eq('provider', 'CCS')
    .eq('segment_key', anchorData.segment_key)
    .maybeSingle();
  
  if (!verified) {
    throw new Error('[anchor_upsert] anchor not found after upsert');
  }
  
  console.log('[anchor_upsert] Upserted anchor segment:', verified);
  return verified;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
