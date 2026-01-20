import { latLngToCell } from 'h3-js';
import { IncludedDistrict } from '@/features/audience-builder/api/validationResults';

export type HexAgg = {
  h3: string;
  count: number;
  avgAgreement: number;
  maxAgreement: number;
};

export interface AggregateDistrictsToHexesFromCentroidsParams {
  includedDistricts: IncludedDistrict[];
  resolution?: number;
}

export interface AggregateDistrictsToHexesFromCentroidsResult {
  hexes: HexAgg[];
  hexIdSet: Set<string>;
}

/**
 * Aggregate included districts into H3 hexes using centroids
 * Returns hexes sorted by avgAgreement desc, then count desc
 */
export function aggregateDistrictsToHexesFromCentroids({
  includedDistricts,
  resolution = 6,
}: AggregateDistrictsToHexesFromCentroidsParams): AggregateDistrictsToHexesFromCentroidsResult {
  const hexMap = new Map<string, { districts: string[]; agreements: number[] }>();

  // Process each district using its centroid
  for (const district of includedDistricts) {
    const { centroid_lat, centroid_lng, agreementCount } = district;

    // Validate centroid coordinates
    if (
      typeof centroid_lat !== 'number' ||
      typeof centroid_lng !== 'number' ||
      isNaN(centroid_lat) ||
      isNaN(centroid_lng) ||
      centroid_lat < -90 ||
      centroid_lat > 90 ||
      centroid_lng < -180 ||
      centroid_lng > 180
    ) {
      console.warn(`Invalid centroid for district ${district.district}:`, { centroid_lat, centroid_lng });
      continue;
    }

    // Convert to H3 hex (latLngToCell expects [lat, lng])
    let hexId: string;
    try {
      hexId = latLngToCell(centroid_lat, centroid_lng, resolution);
    } catch (error) {
      console.warn(`Failed to convert district ${district.district} to H3:`, error);
      continue;
    }

    // Aggregate into hex
    const agreement = agreementCount;
    const existing = hexMap.get(hexId);
    if (existing) {
      existing.districts.push(district.district);
      existing.agreements.push(agreement);
    } else {
      hexMap.set(hexId, {
        districts: [district.district],
        agreements: [agreement],
      });
    }
  }

  // Convert to HexAgg array
  const hexes: HexAgg[] = Array.from(hexMap.entries()).map(([hexId, data]) => {
    const count = data.districts.length;
    const sumAgreement = data.agreements.reduce((sum, a) => sum + a, 0);
    const avgAgreement = count > 0 ? sumAgreement / count : 0;
    const maxAgreement = Math.max(...data.agreements, 0);

    return {
      h3: hexId,
      count,
      avgAgreement,
      maxAgreement,
    };
  });

  // Sort: avgAgreement desc, then count desc
  hexes.sort((a, b) => {
    if (Math.abs(a.avgAgreement - b.avgAgreement) > 0.001) {
      return b.avgAgreement - a.avgAgreement;
    }
    return b.count - a.count;
  });

  const hexIdSet = new Set(hexes.map(h => h.h3));

  // DEV: Log centroid bounds for sanity check
  if (process.env.NODE_ENV !== 'production' && includedDistricts.length > 0) {
    const lats = includedDistricts.map(d => d.centroid_lat);
    const lngs = includedDistricts.map(d => d.centroid_lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    console.log('[hexAggregation] Centroid bounds:', {
      minLat: minLat.toFixed(4),
      maxLat: maxLat.toFixed(4),
      minLng: minLng.toFixed(4),
      maxLng: maxLng.toFixed(4),
      districtCount: includedDistricts.length,
      hexCount: hexes.length,
    });
    
    // Sanity check: UK should be lat ~50-60, lng ~-8 to 2
    if (minLat < 45 || maxLat > 65 || minLng < -10 || maxLng > 5) {
      console.warn('[hexAggregation] ⚠️  Centroid bounds outside expected UK range!');
    }
  }

  return { hexes, hexIdSet };
}

// Legacy function for backward compatibility (if needed)
export function aggregateDistrictsToHexes(params: any): any {
  console.warn('aggregateDistrictsToHexes is deprecated, use aggregateDistrictsToHexesFromCentroids');
  return { hexes: [], hexIdSet: new Set<string>() };
}
