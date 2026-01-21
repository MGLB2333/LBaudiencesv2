import { createClient } from '@/lib/supabase/client';

/**
 * Get normalized district codes for given TV region keys
 * @param regionKeys Array of TV region keys (e.g., ['london', 'stv_north'])
 * @returns Array of normalized district codes
 */
export async function getDistrictsByTvRegion(
  regionKeys: string[]
): Promise<string[]> {
  if (!regionKeys || regionKeys.length === 0) {
    return [];
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('district_tv_regions')
    .select('district_norm')
    .in('region_key', regionKeys)
    .not('district_norm', 'is', null);

  if (error) {
    console.error('Error fetching districts by TV region:', error);
    return [];
  }

  // Return distinct normalized district codes
  const districts = new Set<string>();
  for (const row of (data as any[]) || []) {
    if (row.district_norm) {
      districts.add(row.district_norm);
    }
  }

  return Array.from(districts);
}

/**
 * Get all TV regions with their keys and names
 * @returns Array of TV regions
 */
export async function getAllTvRegions(): Promise<
  Array<{ region_key: string; name: string }>
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('tv_regions')
    .select('region_key, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching TV regions:', error);
    return [];
  }

  return ((data as any[]) || []).map((r: any) => ({
    region_key: r.region_key,
    name: r.name,
  }));
}
