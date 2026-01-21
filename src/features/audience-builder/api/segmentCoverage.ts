import { createClient } from '@/lib/supabase/client';

export interface ProviderCoverage {
  provider: string;
  districtCount: number;
}

/**
 * Get provider coverage for a segment key.
 * Returns all providers that have uploaded district signals for the given segment.
 */
export async function getSegmentProviderCoverage(
  segmentKey: string
): Promise<ProviderCoverage[]> {
  const supabase = createClient();

  // Normalize segment key (trim, ensure exact match)
  const normalizedSegmentKey = segmentKey.trim();

  const { data, error } = await supabase
    .from('geo_district_signals')
    .select('provider, district')
    .eq('segment_key', normalizedSegmentKey);

  if (error) throw error;
  
  // Group by provider and count distinct districts
  const providerMap = new Map<string, Set<string>>();
  (data as any[])?.forEach((row: any) => {
    if (!row.provider || !row.district) return;
    // Normalize provider name (trim, exact case match)
    const normalizedProvider = row.provider.trim();
    // Normalize district (trim, uppercase, remove spaces)
    const normalizedDistrict = row.district.trim().toUpperCase().replace(/\s+/g, '');
    
    if (!providerMap.has(normalizedProvider)) {
      providerMap.set(normalizedProvider, new Set());
    }
    providerMap.get(normalizedProvider)!.add(normalizedDistrict);
  });

  // Convert to array and sort
  const coverage: ProviderCoverage[] = Array.from(providerMap.entries()).map(
    ([provider, districts]) => ({
      provider,
      districtCount: districts.size,
    })
  );

  // Sort by districtCount desc, then provider asc
  coverage.sort((a, b) => {
    if (a.districtCount !== b.districtCount) {
      return b.districtCount - a.districtCount;
    }
    return a.provider.localeCompare(b.provider);
  });

  return coverage;
}
