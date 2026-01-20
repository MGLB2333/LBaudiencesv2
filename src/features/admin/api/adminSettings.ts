import { createClient } from '@/lib/supabase/client';

export interface AppSetting {
  id: string;
  key: string;
  value: any;
  updated_at: string;
}

export interface LogoSetting {
  file: string;
}

/**
 * Get app setting by key
 */
export async function getAppSetting(key: string): Promise<AppSetting | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Upsert app setting
 */
export async function upsertAppSetting(key: string, value: any): Promise<AppSetting> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'key',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get selected logo setting
 */
export async function getSelectedLogo(): Promise<string | null> {
  const setting = await getAppSetting('selected_logo');
  if (!setting) return null;

  const logoSetting = setting.value as LogoSetting;
  return logoSetting?.file || null;
}

/**
 * Set selected logo
 */
export async function setSelectedLogo(filename: string): Promise<void> {
  await upsertAppSetting('selected_logo', { file: filename });
}
