import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/pagination';

export interface GeoDistrict {
  district: string;
  centroid_lat: number;
  centroid_lng: number;
  geometry: any;
}

export interface GeoAudienceSignal {
  district: string;
  audience_key: string;
  provider: string;
  confidence: number;
  evidence: any;
}

/**
 * Get all UK postcode districts (with pagination to fetch all rows)
 */
export async function getGeoDistricts(): Promise<GeoDistrict[]> {
  const supabase = createClient();
  const query = supabase
    .from('geo_districts')
    .select('*')
    .order('district');

  return await fetchAll(query);
}

/**
 * Get audience signals for a specific audience key (with pagination to fetch all rows)
 */
export async function getAudienceSignals(audienceKey: string): Promise<GeoAudienceSignal[]> {
  const supabase = createClient();
  const query = supabase
    .from('geo_audience_signals')
    .select('*')
    .eq('audience_key', audienceKey);

  return await fetchAll(query);
}

/**
 * Get districts with provider agreement counts for validation mode
 * Returns districts where at least one provider has confidence >= threshold
 */
export async function getDistrictsWithAgreement(
  audienceKey: string,
  minAgreement: number,
  providers: string[] = ['CCS', 'ONS', 'Experian', 'TwentyCI', 'Outra']
): Promise<Array<{
  district: string;
  centroid_lat: number;
  centroid_lng: number;
  geometry: any;
  agreeing_providers: string[];
  agreement_count: number;
  avg_confidence: number;
}>> {
  const supabase = createClient();
  
  // Get all signals for this audience (with pagination)
  const signalsQuery = supabase
    .from('geo_audience_signals')
    .select('*')
    .eq('audience_key', audienceKey)
    .in('provider', providers);

  const signals = await fetchAll(signalsQuery);
  if (signals.length === 0) return [];

  // Get all districts (with pagination)
  const districtsQuery = supabase
    .from('geo_districts')
    .select('*');

  const districts = await fetchAll(districtsQuery);
  if (districts.length === 0) return [];

  // Group signals by district
  const signalsByDistrict = new Map<string, GeoAudienceSignal[]>();
  for (const signal of signals) {
    if (!signalsByDistrict.has(signal.district)) {
      signalsByDistrict.set(signal.district, []);
    }
    signalsByDistrict.get(signal.district)!.push(signal);
  }

  // Calculate agreement for each district
  const results: Array<{
    district: string;
    centroid_lat: number;
    centroid_lng: number;
    geometry: any;
    agreeing_providers: string[];
    agreement_count: number;
    avg_confidence: number;
  }> = [];

  // Use a threshold of 0.5 for "agreeing" (can be made configurable)
  const confidenceThreshold = 0.5;

  for (const district of districts) {
    const districtSignals = signalsByDistrict.get(district.district) || [];
    
    // Count providers with confidence >= threshold
    const agreeingProviders = districtSignals
      .filter(s => s.confidence >= confidenceThreshold)
      .map(s => s.provider);
    
    const agreementCount = agreeingProviders.length;

    // Only include if agreement count meets minimum
    if (agreementCount >= minAgreement) {
      const avgConfidence = districtSignals.length > 0
        ? districtSignals.reduce((sum, s) => sum + s.confidence, 0) / districtSignals.length
        : 0;

      results.push({
        district: district.district,
        centroid_lat: district.centroid_lat,
        centroid_lng: district.centroid_lng,
        geometry: district.geometry,
        agreeing_providers: agreeingProviders,
        agreement_count: agreementCount,
        avg_confidence: avgConfidence,
      });
    }
  }

  return results;
}
