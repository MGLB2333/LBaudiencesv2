import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/pagination';

export interface DataPartner {
  id: string;
  provider_key: string;
  display_name: string;
  website_url: string | null;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * List all data partners (canonical source of truth for providers)
 */
export async function listDataPartners(): Promise<DataPartner[]> {
  const supabase = createClient();
  const query = supabase
    .from('data_partners')
    .select('*')
    .order('display_name', { ascending: true });

  return await fetchAll<DataPartner>(query);
}

/**
 * Get a data partner by provider_key
 */
export async function getDataPartnerByKey(providerKey: string): Promise<DataPartner | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('data_partners')
    .select('*')
    .eq('provider_key', providerKey)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Get multiple data partners by provider_keys
 */
export async function getDataPartnersByKeys(providerKeys: string[]): Promise<DataPartner[]> {
  if (providerKeys.length === 0) return [];
  
  const supabase = createClient();
  const query = supabase
    .from('data_partners')
    .select('*')
    .in('provider_key', providerKeys);

  return await fetchAll<DataPartner>(query);
}

/**
 * Update a data partner
 * Automatically generates logo_url from website_url if logo_url is not provided
 */
export async function updateDataPartner(
  providerKey: string,
  updates: Partial<Pick<DataPartner, 'display_name' | 'website_url' | 'description' | 'logo_url'>>
): Promise<DataPartner> {
  const supabase = createClient();
  
  // If website_url is being updated and logo_url is not explicitly set, auto-generate it
  const finalUpdates = { ...updates };
  if (updates.website_url && !updates.logo_url) {
    const faviconUrl = generateFaviconUrl(updates.website_url);
    if (faviconUrl) {
      finalUpdates.logo_url = faviconUrl;
    }
  }
  
  const { data, error } = await supabase
    .from('data_partners')
    .update({
      ...finalUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('provider_key', providerKey)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Extract domain from URL for favicon generation
 */
function extractDomainFromUrl(url: string): string | null {
  if (!url || !url.trim()) return null;
  
  try {
    // Remove protocol
    let domain = url.replace(/^https?:\/\//i, '');
    // Remove www. prefix
    domain = domain.replace(/^www\./i, '');
    // Extract domain (everything up to first / or ?)
    domain = domain.split('/')[0].split('?')[0];
    return domain.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Generate favicon URL from domain using Google's favicon service
 */
export function generateFaviconUrl(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null;
  const domain = extractDomainFromUrl(websiteUrl);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

/**
 * Sync data partners from geo_district_signals (backfill missing providers)
 * This ensures all providers in signals exist in data_partners
 */
export async function syncDataPartnersFromSignals(): Promise<number> {
  const supabase = createClient();
  
  // Get distinct providers from geo_district_signals
  const { data: signals, error: signalsError } = await supabase
    .from('geo_district_signals')
    .select('provider')
    .not('provider', 'is', null);

  if (signalsError) throw signalsError;
  
  const uniqueProviders = new Set<string>();
  signals?.forEach(s => {
    if (s.provider && s.provider.trim()) {
      uniqueProviders.add(s.provider.trim());
    }
  });

  // Insert missing providers
  let inserted = 0;
  for (const provider of uniqueProviders) {
    const { error } = await supabase
      .from('data_partners')
      .insert({
        provider_key: provider,
        display_name: provider,
      })
      .select()
      .maybeSingle();
    
    // Ignore duplicate key errors (provider already exists)
    if (error && error.code !== '23505') {
      console.warn(`Failed to insert provider ${provider}:`, error);
    } else if (!error) {
      inserted++;
    }
  }

  return inserted;
}
