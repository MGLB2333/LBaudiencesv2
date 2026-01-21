import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/pagination';
import { getDistrictsByTvRegion } from './tvRegions';
import { getDataPartnersByKeys } from '@/features/admin/api/dataPartners';

export interface ProviderStats {
  agreeingDistricts: number;
  providerSegmentLabel?: string;
  providerLabel?: string; // Display name from data_partners
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
    estimatedHouseholds: number; // Sum of real household counts with fallback
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
  tvRegions,
}: {
  segmentKey: string;
  minAgreement: number;
  baseProvider?: string;
  providers?: string[]; // Optional filter: only include these providers (excluding baseProvider)
  tvRegions?: string[]; // Optional filter: only include districts in these TV regions
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
        estimatedHouseholds: 0,
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

  let eligibleDistrictIds = Array.from(eligibleDistricts);
  
  // Apply TV region filter if provided (AND logic: segmentEligible AND tvRegionAllowed)
  if (tvRegions && tvRegions.length > 0) {
    const tvRegionDistricts = await getDistrictsByTvRegion(tvRegions);
    
    // Intersection: only keep districts that are BOTH segment-eligible AND in TV regions
    // Normalize TV region districts using the same function for consistent comparison
    // (tvRegionDistricts come from DB as district_norm, but normalize to be safe)
    const normalizedTvRegionSet = new Set(
      tvRegionDistricts.map(d => normalizeDistrict(d))
    );
    
    // Filter: keep only districts that exist in BOTH sets (AND logic - intersection)
    // eligibleDistrictIds are already normalized from the Set above
    eligibleDistrictIds = eligibleDistrictIds.filter((district) => {
      // District is already normalized, but normalize again to be absolutely sure
      const normalized = normalizeDistrict(district);
      return normalizedTvRegionSet.has(normalized);
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

  // Get provider metadata from data_partners for display names
  let providerMetadataMap = new Map<string, { display_name: string }>();
  try {
    const partners = await getDataPartnersByKeys(Array.from(validatingProviders));
    partners.forEach(partner => {
      providerMetadataMap.set(partner.provider_key, { display_name: partner.display_name });
    });
  } catch (error) {
    console.warn('Failed to fetch provider metadata:', error);
  }

  // Process each eligible district to compute agreement
  const agreementByDistrict: Record<string, number> = {};
  const providerStats: Record<string, ProviderStats> = {};
  
  // Initialize provider stats
  for (const provider of validatingProviders) {
    const providerSignals = signalsByProvider.get(provider) || [];
    const firstSignal = providerSignals[0];
    const metadata = providerMetadataMap.get(provider);
    providerStats[provider] = {
      agreeingDistricts: 0,
      providerSegmentLabel: firstSignal?.provider_segment_label || undefined,
      providerLabel: metadata?.display_name || provider,
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
      }
    }

    agreementByDistrict[district] = agreeingCount;
    maxAgreement = Math.max(maxAgreement, agreeingCount);
  }

  // Filter included districts based on minAgreement (districts already normalized)
  const includedDistrictIds = eligibleDistrictIds.filter(
    district => (agreementByDistrict[district] || 0) >= minAgreement
  );

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
      allDistrictCentroids = allDistrictCentroids.concat(batchCentroids || []);
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

  // Fetch centroids for included districts only (for map rendering)
  const { data: districtCentroids = [] } = await supabase
    .from('geo_districts')
    .select('district, centroid_lat, centroid_lng')
    .in('district', includedDistrictIds);

  const centroidMap = new Map<string, { lat: number; lng: number }>();
  for (const row of ((districtCentroids as any[]) || [])) {
    const r = row as any;
    centroidMap.set(r.district, {
      lat: Number(r.centroid_lat),
      lng: Number(r.centroid_lng),
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
  
  // Calculate estimated households: sum real household counts, fallback to 2500 per district if NULL
  let estimatedHouseholds = 0;
  const FALLBACK_HOUSEHOLDS_PER_DISTRICT = 2500;
  
  if (districtsIncluded > 0) {
    // Fetch household counts for included districts
    const includedDistrictIds = includedDistricts.map(d => d.district);
    const batchSize = 1000;
    let totalHouseholds = 0;
    let districtsWithHouseholds = 0;
    let districtsWithoutHouseholds = 0;
    
    for (let i = 0; i < includedDistrictIds.length; i += batchSize) {
      const batch = includedDistrictIds.slice(i, i + batchSize);
      const { data: householdData = [], error: householdError } = await supabase
        .from('geo_districts')
        .select('district, households')
        .in('district', batch);
      
      if (householdError) {
        console.warn('[validationResults] Error fetching households batch:', householdError);
        // Fallback: use constant for this batch
        totalHouseholds += batch.length * FALLBACK_HOUSEHOLDS_PER_DISTRICT;
        districtsWithoutHouseholds += batch.length;
      } else {
        for (const row of (householdData as any[]) || []) {
          if (row.households !== null && row.households > 0) {
            totalHouseholds += row.households;
            districtsWithHouseholds++;
          } else {
            totalHouseholds += FALLBACK_HOUSEHOLDS_PER_DISTRICT;
            districtsWithoutHouseholds++;
          }
        }
      }
    }
    
    estimatedHouseholds = totalHouseholds;
    
    if (process.env.NODE_ENV === 'development') {
      const avgHouseholdsPerDistrict = districtsIncluded > 0 ? estimatedHouseholds / districtsIncluded : 0;
      console.log(`[validationResults] Households: ${districtsWithHouseholds} with real data, ${districtsWithoutHouseholds} using fallback`);
      console.log(`[validationResults] Total: ${estimatedHouseholds.toLocaleString()} households across ${districtsIncluded} districts (avg: ${avgHouseholdsPerDistrict.toFixed(0)} per district)`);
      
      // Sanity check: UK postcode districts typically have 1,000-50,000 households
      if (avgHouseholdsPerDistrict > 100000) {
        console.warn(`[validationResults] ⚠️  Average households per district (${avgHouseholdsPerDistrict.toFixed(0)}) seems unusually high. Expected range: 1,000-50,000`);
      } else if (avgHouseholdsPerDistrict < 500 && districtsWithHouseholds > 0) {
        console.warn(`[validationResults] ⚠️  Average households per district (${avgHouseholdsPerDistrict.toFixed(0)}) seems unusually low. Expected range: 1,000-50,000`);
      }
    }
  }
  
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
      estimatedHouseholds, // Add to totals
    },
    debug: process.env.NODE_ENV !== 'production' ? {
      joinMissingCount,
      missingCentroidCount,
    } : undefined,
  };
}
