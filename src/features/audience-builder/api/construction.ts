import { createClient } from '@/lib/supabase/client';
import { ConstructionSettings, SignalConfig } from '../types/signals';

export interface ConstructionSettingsRow {
  audience_id: string;
  audience_intent: string | null;
  construction_mode: 'validation' | 'extension';
  active_signals: Record<string, SignalConfig>;
  last_run_at?: string | null;
  validation_min_agreement?: number | null;
  validation_agreement_mode?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getConstructionSettings(
  audienceId: string
): Promise<ConstructionSettings | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audience_construction_settings')
    .select('*')
    .eq('audience_id', audienceId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  return {
    audience_intent: data.audience_intent as any,
    construction_mode: data.construction_mode,
    active_signals: (data.active_signals as any) || {},
    last_run_at: data.last_run_at || null,
    validation_min_agreement: data.validation_min_agreement || 1,
    validation_agreement_mode: (data.validation_agreement_mode as any) || 'threshold',
  };
}

export async function updateConstructionSettings(
  audienceId: string,
  updates: Partial<ConstructionSettings>
): Promise<ConstructionSettings> {
  const supabase = createClient();
  
  const existing = await getConstructionSettings(audienceId);
  
  const payload: any = {
    audience_id: audienceId,
    ...updates,
    active_signals: updates.active_signals || existing?.active_signals || {},
  };

  if (existing) {
    const { data, error } = await supabase
      .from('audience_construction_settings')
      .update(payload)
      .eq('audience_id', audienceId)
      .select()
      .single();

    if (error) throw error;
    return {
      audience_intent: data.audience_intent as any,
      construction_mode: data.construction_mode,
      active_signals: (data.active_signals as any) || {},
      last_run_at: data.last_run_at || null,
    };
  } else {
    const { data, error } = await supabase
      .from('audience_construction_settings')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return {
      audience_intent: data.audience_intent as any,
      construction_mode: data.construction_mode,
      active_signals: (data.active_signals as any) || {},
      last_run_at: data.last_run_at || null,
    };
  }
}
