import { createClient } from '@/lib/supabase/client';

export interface AvailableSegment {
  segment_key: string;
  districts: number;
  providers: number;
}

/**
 * Get list of segment keys that have actual data in geo_district_signals.
 * Only segments with at least MIN_DISTRICTS distinct districts are considered "available".
 */
export async function getAvailableSegmentKeys(params?: {
  minDistricts?: number;
}): Promise<string[]> {
  const supabase = createClient();
  const minDistricts = params?.minDistricts || 200;
  
  // Query to get segments with sufficient district coverage
  const { data, error } = await supabase
    .from('geo_district_signals')
    .select('segment_key, district')
    .not('segment_key', 'is', null);
  
  if (error) throw error;
  
  // Group by segment_key and count distinct districts
  const segmentMap = new Map<string, Set<string>>();
  data?.forEach(row => {
    if (!row.segment_key || !row.district) return;
    if (!segmentMap.has(row.segment_key)) {
      segmentMap.set(row.segment_key, new Set());
    }
    segmentMap.get(row.segment_key)!.add(row.district);
  });
  
  // Filter by minimum district count
  const available: string[] = [];
  segmentMap.forEach((districts, segment_key) => {
    if (districts.size >= minDistricts) {
      available.push(segment_key);
    }
  });
  
  return available.sort();
}

/**
 * Get detailed availability info for segments
 */
export async function getAvailableSegments(params?: {
  minDistricts?: number;
}): Promise<AvailableSegment[]> {
  const supabase = createClient();
  const minDistricts = params?.minDistricts || 200;
  
  const { data, error } = await supabase
    .from('geo_district_signals')
    .select('segment_key, district, provider')
    .not('segment_key', 'is', null);
  
  if (error) throw error;
  
  // Group by segment_key
  const segmentMap = new Map<string, { districts: Set<string>; providers: Set<string> }>();
  data?.forEach(row => {
    if (!row.segment_key) return;
    if (!segmentMap.has(row.segment_key)) {
      segmentMap.set(row.segment_key, { districts: new Set(), providers: new Set() });
    }
    const entry = segmentMap.get(row.segment_key)!;
    if (row.district) entry.districts.add(row.district);
    if (row.provider) entry.providers.add(row.provider);
  });
  
  // Filter and format
  const available: AvailableSegment[] = [];
  segmentMap.forEach((counts, segment_key) => {
    if (counts.districts.size >= minDistricts) {
      available.push({
        segment_key,
        districts: counts.districts.size,
        providers: counts.providers.size,
      });
    }
  });
  
  return available.sort((a, b) => b.districts - a.districts);
}
