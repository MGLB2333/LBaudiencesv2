import { createClient } from '@/lib/supabase/client';
import { PoiLayer } from '@/lib/types';

export async function getPoiLayers(audienceId: string): Promise<PoiLayer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('poi_layers')
    .select('*')
    .eq('audience_id', audienceId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPoiLayer(
  audienceId: string,
  layer: {
    layer_name: string;
    layer_type: 'stores' | 'custom';
    metadata?: any;
  }
): Promise<PoiLayer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('poi_layers')
    .insert({
      audience_id: audienceId,
      ...layer,
      is_enabled: true,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePoiLayer(
  layerId: string,
  updates: Partial<PoiLayer>
): Promise<PoiLayer> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('poi_layers') as any)
    .update(updates)
    .eq('id', layerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePoiLayer(layerId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('poi_layers')
    .delete()
    .eq('id', layerId);

  if (error) throw error;
}
