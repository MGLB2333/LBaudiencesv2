import { createClient } from '@/lib/supabase/client';
import { Export } from '@/lib/types';

export async function getExports(audienceId: string): Promise<Export[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exports')
    .select('*')
    .eq('audience_id', audienceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createExport(
  audienceId: string,
  exportType: 'csv' | 'geojson',
  storagePath: string
): Promise<Export> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('exports')
    .insert({
      audience_id: audienceId,
      user_id: user.id,
      export_type: exportType,
      storage_path: storagePath,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getExportDownloadUrl(storagePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('audience-exports')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}
