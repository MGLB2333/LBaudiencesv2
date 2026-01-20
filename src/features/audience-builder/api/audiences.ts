import { createClient } from '@/lib/supabase/client';
import { Audience } from '@/lib/types';

export async function getAudiences(): Promise<Audience[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audiences')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAudience(id: string): Promise<Audience | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audiences')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createAudience(audience: {
  name: string;
  client_id?: string | null;
  description?: string;
  target_reach?: number;
  start_date?: string;
  end_date?: string;
  budget_total?: number;
}): Promise<Audience> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('audiences')
    .insert({
      ...audience,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Create default profile settings
  await supabase.from('audience_profile_settings').insert({
    audience_id: data.id,
    scale_accuracy: 50,
    derived_audience_size: 5000000,
    confidence_high: 0.6,
    confidence_medium: 0.3,
    confidence_low: 0.1,
  });

  return data;
}

export async function updateAudience(
  id: string,
  updates: Partial<Audience>
): Promise<Audience> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audiences')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAudience(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('audiences')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
