import { createClient } from '@/lib/supabase/client';

export interface AvailableSegment {
  segmentKey: string;
  ccsDistricts: number;
  providers: string[];
}

/**
 * Get segments that exist in geo_district_signals (data-driven).
 * Only returns segments where CCS has data (CCS is our anchor universe).
 */
export async function getAvailableSegments(): Promise<AvailableSegment[]> {
  const supabase = createClient();

  // Get all signals to compute coverage
  const { data: allSignals, error } = await supabase
    .from('geo_district_signals')
    .select('segment_key, provider, district')
    .not('segment_key', 'is', null);

  if (error) throw error;

  // Group by segment_key
  const segmentMap = new Map<string, { ccsDistricts: Set<string>; providers: Set<string> }>();

  for (const signal of allSignals || []) {
    if (!signal.segment_key || !signal.district || !signal.provider) continue;

    const normalizedProvider = signal.provider.trim();
    const normalizedDistrict = signal.district.trim().toUpperCase().replace(/\s+/g, '');

    if (!segmentMap.has(signal.segment_key)) {
      segmentMap.set(signal.segment_key, {
        ccsDistricts: new Set(),
        providers: new Set(),
      });
    }

    const entry = segmentMap.get(signal.segment_key)!;
    entry.providers.add(normalizedProvider);

    // Only count CCS districts for ccsDistricts
    if (normalizedProvider === 'CCS') {
      entry.ccsDistricts.add(normalizedDistrict);
    }
  }

  // Filter to only segments where CCS has data, and format
  const available: AvailableSegment[] = [];

  segmentMap.forEach((counts, segmentKey) => {
    // Only include segments where CCS has coverage
    if (counts.ccsDistricts.size > 0) {
      available.push({
        segmentKey,
        ccsDistricts: counts.ccsDistricts.size,
        providers: Array.from(counts.providers).sort(),
      });
    }
  });

  // Sort by CCS districts desc, then segmentKey asc
  available.sort((a, b) => {
    if (a.ccsDistricts !== b.ccsDistricts) {
      return b.ccsDistricts - a.ccsDistricts;
    }
    return a.segmentKey.localeCompare(b.segmentKey);
  });

  return available;
}
