import { createClient } from '@/lib/supabase/client';
import { AudienceProfileSettings } from '@/lib/types';

export async function getProfileSettings(
  audienceId: string
): Promise<AudienceProfileSettings | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audience_profile_settings')
    .select('*')
    .eq('audience_id', audienceId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateProfileSettings(
  audienceId: string,
  updates: Partial<AudienceProfileSettings>
): Promise<AudienceProfileSettings> {
  const supabase = createClient();
  
  // Check if exists
  const existing = await getProfileSettings(audienceId);
  
  if (existing) {
    const { data, error } = await (supabase
      .from('audience_profile_settings') as any)
      .update(updates)
      .eq('audience_id', audienceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('audience_profile_settings')
      .insert({
        audience_id: audienceId,
        ...updates,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Calculate derived stats based on slider position
// Moved to service layer but kept here for backward compatibility
export function calculateDerivedStats(scaleAccuracy: number, baseSize: number = 5000000) {
  // Scale accuracy: 0 = max scale (reach), 100 = max accuracy (precision)
  const scaleFactor = (100 - scaleAccuracy) / 100; // 0 to 1
  const accuracyFactor = scaleAccuracy / 100; // 0 to 1

  // Audience size: more scale = larger, more accuracy = smaller
  const sizeMultiplier = 0.5 + (scaleFactor * 1.0); // 0.5x to 1.5x
  const derivedSize = Math.round(baseSize * sizeMultiplier);

  // Confidence mix: more accuracy = higher confidence share
  const confidenceHigh = 0.3 + (accuracyFactor * 0.5); // 0.3 to 0.8
  const confidenceMedium = 0.4 - (accuracyFactor * 0.2); // 0.4 to 0.2
  const confidenceLow = 0.3 - (accuracyFactor * 0.3); // 0.3 to 0.0

  return {
    derived_audience_size: derivedSize,
    confidence_high: Math.round(confidenceHigh * 100) / 100,
    confidence_medium: Math.round(confidenceMedium * 100) / 100,
    confidence_low: Math.round(confidenceLow * 100) / 100,
  };
}
