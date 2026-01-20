import { createClient } from '@/lib/supabase/client';

export interface DistrictCentroid {
  district: string;
  centroid_lat: number;
  centroid_lng: number;
}

/**
 * Normalize district code (trim, uppercase, remove spaces)
 */
function normalizeDistrict(district: string): string {
  return district.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Get centroids for a list of districts
 * Chunks districts into batches of 500 to avoid Supabase .in() limits
 */
export async function getDistrictCentroids(
  districts: string[]
): Promise<DistrictCentroid[]> {
  if (districts.length === 0) {
    return [];
  }

  const supabase = createClient();

  // Normalize districts and dedupe
  const normalizedDistricts = Array.from(
    new Set(districts.map(normalizeDistrict))
  ).filter(d => d.length > 0);

  if (normalizedDistricts.length === 0) {
    return [];
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[getDistrictCentroids] Fetching centroids for ${normalizedDistricts.length} normalized districts (from ${districts.length} input)`);
  }

  // Chunk into batches of 500 (Supabase .in() limit)
  const BATCH_SIZE = 500;
  const batches: string[][] = [];
  for (let i = 0; i < normalizedDistricts.length; i += BATCH_SIZE) {
    batches.push(normalizedDistricts.slice(i, i + BATCH_SIZE));
  }

  // Fetch all batches and merge results
  const allResults: DistrictCentroid[] = [];

  for (const batch of batches) {
    // Query using district_norm for matching (normalized column)
    const { data, error } = await supabase
      .from('geo_districts')
      .select('district, district_norm, centroid_lat, centroid_lng')
      .in('district_norm', batch)
      .not('centroid_lat', 'is', null)
      .not('centroid_lng', 'is', null);

    if (error) {
      console.error('Error fetching district centroids:', error);
      throw error;
    }

    if (data) {
      // Map results back to normalized district codes for lookup
      const batchResults = data.map(row => ({
        district: row.district_norm || row.district, // Prefer district_norm, fallback to district
        centroid_lat: row.centroid_lat,
        centroid_lng: row.centroid_lng,
      })) as DistrictCentroid[];
      
      allResults.push(...batchResults);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[getDistrictCentroids] Batch ${batches.indexOf(batch) + 1}/${batches.length}: Found ${batchResults.length} centroids (queried ${batch.length} districts)`);
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[getDistrictCentroids] Total centroids found: ${allResults.length}/${normalizedDistricts.length}`);
    if (allResults.length < normalizedDistricts.length) {
      const foundDistricts = new Set(allResults.map(r => r.district));
      const missingDistricts = normalizedDistricts.filter(d => !foundDistricts.has(d));
      console.warn(`[getDistrictCentroids] Missing centroids for ${missingDistricts.length} districts. Sample:`, missingDistricts.slice(0, 5));
    }
  }

  return allResults;
}
