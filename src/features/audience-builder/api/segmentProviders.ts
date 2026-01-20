import { createClient } from '@/lib/supabase/client';

export interface SegmentProvider {
  provider: string;
  providerLabel: string;
  districtCount: number;
  hasData: boolean;
}

/**
 * Get list of providers that have data for a given segment key.
 * Returns providers with district counts for validation mode display.
 */
export async function getSegmentProviders(params: {
  segmentKey: string;
}): Promise<SegmentProvider[]> {
  const supabase = createClient();
  
  // Get all signals for this segment
  const { data: signals } = await supabase
    .from('geo_district_signals')
    .select('provider, district')
    .eq('segment_key', params.segmentKey);
  
  if (!signals || signals.length === 0) {
    return [];
  }
  
  // Group by provider and count distinct districts
  const providerMap = new Map<string, Set<string>>();
  signals.forEach(signal => {
    if (!signal.provider || !signal.district) return;
    if (!providerMap.has(signal.provider)) {
      providerMap.set(signal.provider, new Set());
    }
    providerMap.get(signal.provider)!.add(signal.district);
  });
  
  // Get provider metadata from data_partners
  const providerKeys = Array.from(providerMap.keys());
  let providerMetadataMap = new Map<string, { display_name: string }>();
  try {
    const partners = await getDataPartnersByKeys(providerKeys);
    partners.forEach(partner => {
      providerMetadataMap.set(partner.provider_key, { display_name: partner.display_name });
    });
  } catch (error) {
    console.warn('Failed to fetch provider metadata:', error);
  }
  
  // Build result with district counts
  const result: SegmentProvider[] = Array.from(providerMap.entries()).map(([provider, districts]) => {
    const metadata = providerMetadataMap.get(provider);
    return {
      provider,
      providerLabel: metadata?.display_name || provider,
      districtCount: districts.size,
      hasData: true,
    };
  });
  
  // Sort: CCS first, then by district count desc, then alphabetically
  return result.sort((a, b) => {
    if (a.provider === 'CCS') return -1;
    if (b.provider === 'CCS') return 1;
    if (a.districtCount !== b.districtCount) {
      return b.districtCount - a.districtCount;
    }
    return a.provider.localeCompare(b.provider);
  });
}
