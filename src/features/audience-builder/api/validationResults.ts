import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/pagination';

export interface ProviderStats {
  agreeingDistricts: number;
  providerSegmentLabel?: string;
}

export interface IncludedDistrict {
  district: string;
  centroid_lat: number;
  centroid_lng: number;
  agreementCount: number;
  avgConfidence: number;
  agreeingProviders: string[];
}

export interface ValidationResults {
  includedDistricts: IncludedDistrict[]; // Districts with centroids that meet minAgreement threshold
  includedDistrictIds: string[]; // Just the district codes (for backward compatibility)
  eligibleDistrictIds: string[]; // All districts eligible (CCS base universe)
  agreementByDistrict: Record<string, number>; // District -> agreement count (0-N)
  providerStats: Record<string, ProviderStats>;
  maxAgreement: number; // Maximum agreement count (number of validating providers)
  totals: {
    districtsIncluded: number;
    eligibleDistricts: number;
    contributingProvidersCount: number;
    confidenceBand: 'Low' | 'Med' | 'High';
    avgAgreement: number; // For backward compatibility
  };
  debug?: {
    joinMissingCount: number; // Districts in signals not found in geo_districts
    missingCentroidCount: number; // Districts without centroids
  };
}

interface DistrictSignalRow {
  segment_key: string;
  provider: string;
  provider_segment_label: string | null;
  district: string;
  sectors_count: number;
  district_score_avg: number | null;
  district_score_norm: number | null;
  has_score: boolean;
}

/**
 * Get validation results for a segment based on geo_district_signals (CSV-based)
 * 
 * Rules:
 * - CCS is the base universe provider
 * - Eligible districts = districts where CCS has presence (sectors_count > 0) AND (if has_score) district_score_norm >= 0.5
 * - For each other provider, "agrees" for a district if provider has presence AND (if has_score) district_score_norm >= 0.5
 * - Include district if agreeingProvidersCount >= minAgreement
 */
export async function getValidationResults({
  segmentKey,
  minAgreement,
  baseProvider = 'CCS',
  providers,
}: {
  segmentKey: string;
  minAgreement: number;
  baseProvider?: string;
  providers?: string[]; // Optional filter: only include these providers (excluding baseProvider)
}): Promise<ValidationResults> {
  const supabase = createClient();
  
  // Fetch all district signals for this segment (with pagination)
  const districtSignalsQuery = supabase
    .from('geo_district_signals')
    .select('*')
    .eq('segment_key', segmentKey);

  const allDistrictSignals = await fetchAll<DistrictSignalRow>(districtSignalsQuery);
  
  if (allDistrictSignals.length === 0) {
    return {
      includedDistricts: [],
      includedDistrictIds: [],
      eligibleDistrictIds: [],
      agreementByDistrict: {},
      providerStats: {},
      maxAgreement: 1,
      totals: {
        districtsIncluded: 0,
        eligibleDistricts: 0,
        contributingProvidersCount: 0,
        confidenceBand: 'Low',
        avgAgreement: 0,
      },
    };
  }

  // Normalize district codes (trim, upper, remove spaces) - define early
  const normalizeDistrict = (d: string): string => {
    return d.trim().toUpperCase().replace(/\s+/g, '');
  };

  // Group by provider
  const signalsByProvider = new Map<string, DistrictSignalRow[]>();
  for (const signal of allDistrictSignals) {
    if (!signalsByProvider.has(signal.provider)) {
      signalsByProvider.set(signal.provider, []);
    }
    signalsByProvider.get(signal.provider)!.push(signal);
  }

  // Get base provider signals
  const baseProviderSignals = signalsByProvider.get(baseProvider) || [];
  
  // DEV: Log base provider signals
  if (process.env.NODE_ENV !== 'production') {
    console.log('[validationResults] Base provider signals:', {
      provider: baseProvider,
      count: baseProviderSignals.length,
      sample: baseProviderSignals.slice(0, 3).map(s => ({
        district: s.district,
        sectors_count: s.sectors_count,
        has_score: s.has_score,
        district_score_norm: s.district_score_norm,
      })),
    });
  }
  
  // Determine eligible districts (CCS base universe) - normalize district codes
  const eligibleDistricts = new Set<string>();
  for (const baseSignal of baseProviderSignals) {
    // Normalize district code
    const normalizedDistrict = normalizeDistrict(baseSignal.district);
    
    // Eligible if: has presence (sectors_count > 0) AND (if has_score) score_norm >= 0.5
    const hasPresence = baseSignal.sectors_count > 0;
    const meetsThreshold = baseSignal.has_score 
      ? (baseSignal.district_score_norm ?? 0) >= 0.5
      : true; // If no score, presence alone makes it eligible
    
    if (hasPresence && meetsThreshold) {
      eligibleDistricts.add(normalizedDistrict);
    }
  }

  const eligibleDistrictIds = Array.from(eligibleDistricts);
  
  // DEV: Log eligible districts with sample raw data
  if (process.env.NODE_ENV !== 'production') {
    console.log('[validationResults] Eligible districts:', {
      count: eligibleDistrictIds.length,
      sample: eligibleDistrictIds.slice(0, 5),
      sampleRaw: baseProviderSignals.slice(0, 3).map(s => ({
        raw: s.district,
        normalized: normalizeDistrict(s.district),
        sectors_count: s.sectors_count,
        has_score: s.has_score,
        district_score_norm: s.district_score_norm,
      })),
    });
  }

  // Get all providers excluding base provider
  let validatingProviders = Array.from(signalsByProvider.keys()).filter(p => p !== baseProvider);
  
  // Filter by providers if provided
  if (providers && providers.length > 0) {
    const providerSet = new Set(providers);
    validatingProviders = validatingProviders.filter(p => providerSet.has(p));
  }
  
  const contributingProvidersCount = validatingProviders.length;
  
  // DEV: Log validating providers
  if (process.env.NODE_ENV !== 'production') {
    console.log('[validationResults] Validating providers:', {
      providers: validatingProviders,
      counts: validatingProviders.map(p => ({
        provider: p,
        signalCount: signalsByProvider.get(p)?.length || 0,
        sampleDistricts: Array.from(new Set(signalsByProvider.get(p)?.map(s => s.district) || [])).slice(0, 3),
        sampleNormalized: Array.from(new Set(signalsByProvider.get(p)?.map(s => normalizeDistrict(s.district)) || [])).slice(0, 3),
      })),
    });
  }
  
  // Build district lookup maps for each provider (with normalized district codes)
  const districtMapsByProvider = new Map<string, Map<string, DistrictSignalRow>>();
  for (const provider of validatingProviders) {
    const providerSignals = signalsByProvider.get(provider) || [];
    const districtMap = new Map<string, DistrictSignalRow>();
    for (const signal of providerSignals) {
      const normalizedDistrict = normalizeDistrict(signal.district);
      districtMap.set(normalizedDistrict, signal);
    }
    districtMapsByProvider.set(provider, districtMap);
  }
  
  // DEV: Log district map stats with overlap check (after eligibleDistrictIds is computed)
  if (process.env.NODE_ENV !== 'production') {
    for (const provider of validatingProviders) {
      const districtMap = districtMapsByProvider.get(provider)!;
      const mapKeys = Array.from(districtMap.keys());
      const overlap = eligibleDistrictIds.filter(d => mapKeys.includes(d)).length;
      console.log(`[validationResults] ${provider} district map:`, {
        totalSignals: signalsByProvider.get(provider)?.length || 0,
        uniqueDistricts: districtMap.size,
        sampleDistricts: mapKeys.slice(0, 3),
        overlapWithEligible: overlap,
        overlapPercentage: eligibleDistrictIds.length > 0 ? ((overlap / eligibleDistrictIds.length) * 100).toFixed(1) + '%' : '0%',
      });
    }
  }

  // Process each eligible district to compute agreement
  const agreementByDistrict: Record<string, number> = {};
  const providerStats: Record<string, ProviderStats> = {};
  
  // Initialize provider stats
  for (const provider of validatingProviders) {
    const providerSignals = signalsByProvider.get(provider) || [];
    const firstSignal = providerSignals[0];
    providerStats[provider] = {
      agreeingDistricts: 0,
      providerSegmentLabel: firstSignal?.provider_segment_label || undefined,
    };
  }

  let maxAgreement = 0;

  for (const district of eligibleDistrictIds) {
    let agreeingCount = 0;

    // Check each validating provider
    for (const provider of validatingProviders) {
      const districtMap = districtMapsByProvider.get(provider);
      const providerSignal = districtMap?.get(district);
      
      if (providerSignal) {
        // Provider agrees if: has presence AND (if has_score) score_norm >= 0.5
        const hasPresence = providerSignal.sectors_count > 0;
        const meetsThreshold = providerSignal.has_score
          ? (providerSignal.district_score_norm ?? 0) >= 0.5
          : true; // If no score, presence alone means agreement
        
        if (hasPresence && meetsThreshold) {
          agreeingCount++;
          // Update provider stats
          if (providerStats[provider]) {
            providerStats[provider].agreeingDistricts++;
          }
        }
      } else {
        // DEV: Log missing matches for first few districts
        if (process.env.NODE_ENV !== 'production' && eligibleDistrictIds.indexOf(district) < 3) {
          console.log(`[validationResults] District ${district} not found in ${provider} map`, {
            district,
            provider,
            mapSize: districtMap?.size || 0,
            mapHasDistrict: districtMap?.has(district) || false,
            sampleMapKeys: districtMap ? Array.from(districtMap.keys()).slice(0, 3) : [],
          });
        }
      }
    }

    agreementByDistrict[district] = agreeingCount;
    maxAgreement = Math.max(maxAgreement, agreeingCount);
  }
  
  // DEV: Log agreement distribution
  if (process.env.NODE_ENV !== 'production') {
    const agreementCounts: Record<number, number> = {};
    for (const count of Object.values(agreementByDistrict)) {
      agreementCounts[count] = (agreementCounts[count] || 0) + 1;
    }
    console.log('[validationResults] Agreement distribution:', {
      totalEligible: eligibleDistrictIds.length,
      maxAgreement,
      distribution: agreementCounts,
      districtsWithAgreement1Plus: Object.values(agreementByDistrict).filter(c => c >= 1).length,
    });
    
    // Log sample district agreement computation
    if (eligibleDistrictIds.length > 0) {
      const sampleDistrict = eligibleDistrictIds[0];
      console.log(`[validationResults] Sample district agreement:`, {
        district: sampleDistrict,
        agreementCount: agreementByDistrict[sampleDistrict] || 0,
        validatingProviders,
        providerSignals: validatingProviders.map(p => {
          const map = districtMapsByProvider.get(p);
          const signal = map?.get(sampleDistrict);
          return {
            provider: p,
            found: !!signal,
            sectors_count: signal?.sectors_count || 0,
            has_score: signal?.has_score || false,
            district_score_norm: signal?.district_score_norm || null,
            wouldAgree: signal ? (
              signal.sectors_count > 0 && (
                signal.has_score ? (signal.district_score_norm ?? 0) >= 0.5 : true
              )
            ) : false,
          };
        }),
      });
    }
  }
  
  // DEV: Log agreement computation results
  if (process.env.NODE_ENV !== 'production') {
    const agreementDistribution = Object.values(agreementByDistrict).reduce((acc, count) => {
      acc[count] = (acc[count] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    console.log('[validationResults] Agreement computation:', {
      eligibleCount: eligibleDistrictIds.length,
      agreementDistribution,
      maxAgreement,
      districtsWithAgreement1Plus: Object.values(agreementByDistrict).filter(c => c >= 1).length,
    });
  }

  // Filter included districts based on minAgreement (districts already normalized)
  const includedDistrictIds = eligibleDistrictIds.filter(
    district => (agreementByDistrict[district] || 0) >= minAgreement
  );
  
  // DEV: Log agreement and included counts
  if (process.env.NODE_ENV !== 'production') {
    console.log('[validationResults] Agreement summary:', {
      eligibleCount: eligibleDistrictIds.length,
      agreementCounts: Object.values(agreementByDistrict).reduce((acc, count) => {
        acc[count] = (acc[count] || 0) + 1;
        return acc;
      }, {} as Record<number, number>),
      includedCount: includedDistrictIds.length,
      minAgreement,
      maxAgreement,
    });
  }

  // Build set of ALL districts in signals (for join missing count)
  const allSignalDistricts = new Set<string>();
  for (const signal of allDistrictSignals) {
    allSignalDistricts.add(normalizeDistrict(signal.district));
  }

  // Fetch centroids for ALL signal districts (not just included) to calculate accurate joinMissingCount
  // Supabase .in() has a limit, so fetch in batches if needed
  const allSignalDistrictIds = Array.from(allSignalDistricts);
  
  let allDistrictCentroids: Array<{ district: string; centroid_lat: number; centroid_lng: number }> = [];
  const batchSize = 1000; // Supabase limit is typically 1000 for .in()
  
  for (let i = 0; i < allSignalDistrictIds.length; i += batchSize) {
    const batch = allSignalDistrictIds.slice(i, i + batchSize);
    const { data: batchCentroids = [], error: batchError } = await supabase
      .from('geo_districts')
      .select('district, centroid_lat, centroid_lng')
      .in('district', batch);
    
    if (batchError) {
      console.warn(`[validationResults] Error fetching centroids batch ${i / batchSize + 1}:`, batchError);
    } else {
      allDistrictCentroids = allDistrictCentroids.concat(batchCentroids);
    }
  }

  // Build full centroid map for all signal districts
  const fullCentroidMap = new Map<string, { lat: number; lng: number }>();
  for (const row of allDistrictCentroids) {
    fullCentroidMap.set(row.district, {
      lat: Number(row.centroid_lat),
      lng: Number(row.centroid_lng),
    });
  }

  // Count districts in signals that don't have geo_districts entries
  let joinMissingCount = 0;
  const missingDistricts: string[] = [];
  for (const district of allSignalDistricts) {
    if (!fullCentroidMap.has(district)) {
      joinMissingCount++;
      if (missingDistricts.length < 10) {
        missingDistricts.push(district);
      }
    }
  }
  
  // DEV: Log missing districts for debugging
  if (process.env.NODE_ENV !== 'production' && joinMissingCount > 0) {
    console.log('[validationResults] Missing centroids:', {
      totalMissing: joinMissingCount,
      totalSignalDistricts: allSignalDistricts.size,
      totalCentroidsFetched: fullCentroidMap.size,
      sampleMissing: missingDistricts,
    });
  }

  // Fetch centroids for included districts only (for map rendering)
  const { data: districtCentroids = [] } = await supabase
    .from('geo_districts')
    .select('district, centroid_lat, centroid_lng')
    .in('district', includedDistrictIds);

  const centroidMap = new Map<string, { lat: number; lng: number }>();
  for (const row of districtCentroids) {
    centroidMap.set(row.district, {
      lat: Number(row.centroid_lat),
      lng: Number(row.centroid_lng),
    });
  }

  // Track debug metrics
  let missingCentroidCount = 0;

  // Build includedDistricts with centroids
  const includedDistricts: IncludedDistrict[] = [];
  for (const district of includedDistrictIds) {
    const agreementCount = agreementByDistrict[district] || 0;
    const avgConfidence = contributingProvidersCount > 0
      ? agreementCount / contributingProvidersCount
      : 0;
    
    // Get agreeing providers for this district
    const agreeingProviders: string[] = [];
    for (const provider of validatingProviders) {
      const districtMap = districtMapsByProvider.get(provider);
      const providerSignal = districtMap?.get(district);
      if (providerSignal) {
        const hasPresence = providerSignal.sectors_count > 0;
        const meetsThreshold = providerSignal.has_score
          ? (providerSignal.district_score_norm ?? 0) >= 0.5
          : true;
        if (hasPresence && meetsThreshold) {
          agreeingProviders.push(provider);
        }
      }
    }

    const centroid = centroidMap.get(district);
    
    // Track missing centroids (for included districts only)
    if (!centroid) {
      missingCentroidCount++;
      // Skip districts without centroids from map output
      continue;
    }

    includedDistricts.push({
      district,
      centroid_lat: centroid.lat,
      centroid_lng: centroid.lng,
      agreementCount,
      avgConfidence,
      agreeingProviders,
    });
  }

  // Calculate totals
  const districtsIncluded = includedDistricts.length;
  
  // Calculate avgAgreement for backward compatibility
  const avgAgreement = districtsIncluded > 0
    ? includedDistricts.reduce((sum, d) => sum + d.agreementCount, 0) / districtsIncluded
    : 0;
  
  // Confidence band logic
  let confidenceBand: 'Low' | 'Med' | 'High' = 'Low';
  if (contributingProvidersCount > 0) {
    const agreementRatio = minAgreement / Math.max(1, contributingProvidersCount);
    if (agreementRatio >= 0.7) {
      confidenceBand = 'High';
    } else if (agreementRatio >= 0.4) {
      confidenceBand = 'Med';
    }
  }

  return {
    includedDistricts,
    includedDistrictIds, // For backward compatibility
    eligibleDistrictIds,
    agreementByDistrict,
    providerStats,
    maxAgreement: Math.max(1, maxAgreement),
    totals: {
      districtsIncluded,
      eligibleDistricts: eligibleDistrictIds.length,
      contributingProvidersCount,
      confidenceBand,
      avgAgreement,
    },
    debug: process.env.NODE_ENV !== 'production' ? {
      joinMissingCount,
      missingCentroidCount,
    } : undefined,
  };
}
