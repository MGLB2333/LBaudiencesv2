import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/pagination';
import { getAvailableSegmentKeys } from './segmentAvailability';
import { getDistrictsByTvRegion } from './tvRegions';
import { getDataPartnersByKeys } from '@/features/admin/api/dataPartners';

export interface ExtensionSuggestion {
  segment_key: string;
  label: string;
  description: string | null;
  tags: string[];
  adjacency_score: number;
  why_suggested: string;
  providers: string[]; // Providers that have this segment
  matchPercent: number; // 0-100 match percentage
  rationale: string; // Explanation text for why this segment is suggested
  districtsAvailableCount: number; // How many districts have data for this segment
  providersAvailableCount: number; // How many providers have data for this segment
}

export interface ProviderImpactStats {
  provider: string;
  providerLabel?: string; // Display name from data_partners
  providerLabelForSegments: Record<string, string>; // segment_key -> provider_label
  districtsSupporting: number;
  incrementalDistricts: number;
  overlapDistricts: number;
  overlapPct: number;
  avgProviderConfidence: number;
}

export interface IncludedDistrict {
  district: string;
  centroid_lat: number;
  centroid_lng: number;
  agreementCount: number; // Support count (how many providers support any included segment)
  supportingProviders: string[];
  avgConfidence: number;
}

export interface ExtensionResults {
  totals: {
    baseDistricts: number; // Anchor only (CCS universe)
    includedDistricts: number; // Union of included segments
    estimatedHouseholds: number;
    avgConfidence: number;
  };
  providerStats: ProviderImpactStats[];
  includedDistricts: IncludedDistrict[];
  debug?: {
    eligibleDistrictsCount: number;
    missingCentroidsCount: number;
    signalsMissingGeoCount: number;
  };
}

interface DistrictSignalRow {
  segment_key: string;
  provider: string;
  district: string;
  sectors_count: number;
  district_score_avg: number | null;
  district_score_norm: number | null;
  has_score: boolean;
}

/**
 * Get extension suggestions from segment_library based on adjacency
 */
export async function getExtensionSuggestions({
  anchorKey,
  q,
  tags,
  provider,
}: {
  anchorKey: string;
  q?: string;
  tags?: string[];
  provider?: string;
}): Promise<ExtensionSuggestion[]> {
  const supabase = createClient();

  // First, get the anchor segment to find its adjacency
  const { data: anchorSegment } = await supabase
    .from('segment_library')
    .select('adjacency')
    .eq('segment_key', anchorKey)
    .eq('is_active', true)
    .single();

  const anchor = anchorSegment as any;
  if (!anchor || !anchor.adjacency) {
    return [];
  }

  const adjacency = anchor.adjacency as {
    related_segments?: string[];
    adjacency_score?: number;
  };

  const relatedSegmentKeys = adjacency.related_segments || [];

  if (relatedSegmentKeys.length === 0) {
    return [];
  }

  // Build query for related segments
  let query = supabase
    .from('segment_library')
    .select('segment_key, label, description, tags, adjacency, provider')
    .in('segment_key', relatedSegmentKeys)
    .eq('is_active', true);

  // Apply filters
  if (q) {
    query = query.or(`label.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (tags && tags.length > 0) {
    query = query.contains('tags', tags);
  }

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data: segments } = await query;

  if (!segments || segments.length === 0) {
    return [];
  }

  const segmentsArray = segments as any[];

  // Get provider segment aliases for labels
  const segmentKeys = segmentsArray.map((s: any) => s.segment_key);
  const { data: aliases } = await supabase
    .from('provider_segment_aliases')
    .select('canonical_key, provider, provider_segment_label')
    .in('canonical_key', segmentKeys);

  // Build provider map
  const providersBySegment = new Map<string, Set<string>>();
  const labelsBySegment = new Map<string, Map<string, string>>();

  for (const segment of segmentsArray) {
    if (!providersBySegment.has(segment.segment_key)) {
      providersBySegment.set(segment.segment_key, new Set());
    }
    providersBySegment.get(segment.segment_key)!.add(segment.provider);

    if (!labelsBySegment.has(segment.segment_key)) {
      labelsBySegment.set(segment.segment_key, new Map());
    }
    labelsBySegment.get(segment.segment_key)!.set(segment.provider, segment.label);
  }

  // Add aliases
  if (aliases) {
    for (const alias of (aliases as any[])) {
      if (providersBySegment.has(alias.canonical_key)) {
        providersBySegment.get(alias.canonical_key)!.add(alias.provider);
        labelsBySegment.get(alias.canonical_key)!.set(alias.provider, alias.provider_segment_label);
      }
    }
  }

  // Get available segment keys (data-backed filtering)
  const availableSegmentKeys = await getAvailableSegmentKeys({ minDistricts: 200 });
  const availableSet = new Set(availableSegmentKeys);
  
  // Get district/provider counts for each segment (reuse segmentKeys from above)
  const { data: signalData } = await supabase
    .from('geo_district_signals')
    .select('segment_key, district, provider')
    .in('segment_key', segmentKeys);
  
  // Count districts and providers per segment
  const segmentStats = new Map<string, { districts: Set<string>; providers: Set<string> }>();
  (signalData as any[])?.forEach((row: any) => {
    if (!row.segment_key) return;
    if (!segmentStats.has(row.segment_key)) {
      segmentStats.set(row.segment_key, { districts: new Set(), providers: new Set() });
    }
    const stats = segmentStats.get(row.segment_key)!;
    if (row.district) stats.districts.add(row.district);
    if (row.provider) stats.providers.add(row.provider);
  });

  // Build suggestions with adjacency scores, filtering by availability
  const suggestions: ExtensionSuggestion[] = segmentsArray
    .filter((segment: any) => availableSet.has(segment.segment_key)) // Only data-backed segments
    .map((segment, index) => {
      const segmentAdjacency = (segment.adjacency as any) || {};
      const adjacencyScore = segmentAdjacency.adjacency_score || 0.5;
      
      // Calculate matchPercent: use adjacencyScore if available, else rank-based fallback
      let matchPercent: number;
      if (adjacencyScore > 0 && adjacencyScore <= 1) {
        matchPercent = Math.round(adjacencyScore * 100);
      } else {
        // Deterministic fallback based on rank
        const rankPercentages = [92, 86, 79, 73, 67, 61, 55, 49];
        matchPercent = rankPercentages[index] || Math.max(40, 92 - (index * 6));
      }
      
      // Get rationale text
      const rationale = segmentAdjacency.evidence || 
        segmentAdjacency.why_suggested || 
        segmentAdjacency.rationale ||
        `This segment is behaviorally adjacent to "${anchorKey}" with a ${matchPercent}% match score. It shares similar consumer characteristics and can extend your audience reach.`;

      const stats = segmentStats.get(segment.segment_key) || { districts: new Set(), providers: new Set() };

      return {
        segment_key: segment.segment_key,
        label: segment.label,
        description: segment.description,
        tags: segment.tags || [],
        adjacency_score: adjacencyScore,
        why_suggested: rationale,
        providers: Array.from(providersBySegment.get(segment.segment_key) || []),
        matchPercent,
        rationale,
        districtsAvailableCount: stats.districts.size,
        providersAvailableCount: stats.providers.size,
      };
    });

  // Sort by adjacency_score desc, then label asc
  suggestions.sort((a, b) => {
    if (Math.abs(a.adjacency_score - b.adjacency_score) > 0.001) {
      return b.adjacency_score - a.adjacency_score;
    }
    return a.label.localeCompare(b.label);
  });

  return suggestions;
}

/**
 * Get provider impact for Extension mode
 * Computes districts, provider stats, and incremental coverage
 */
export async function getProviderImpact({
  anchorKey,
  includedSegmentKeys,
  confidenceThreshold = 0.5,
  includeAnchorOnly = true,
  providers,
  tvRegions,
}: {
  anchorKey: string;
  includedSegmentKeys: string[];
  confidenceThreshold?: number;
  includeAnchorOnly?: boolean;
  providers?: string[]; // Optional filter: only include these providers (CCS is always included)
  tvRegions?: string[]; // Optional filter: only include districts in these TV regions
}): Promise<ExtensionResults> {
  const supabase = createClient();

  // Normalize district codes
  const normalizeDistrict = (d: string): string => {
    return d.trim().toUpperCase().replace(/\s+/g, '');
  };

  // Ensure anchor is included
  const allSegmentKeys = includedSegmentKeys.includes(anchorKey)
    ? includedSegmentKeys
    : [anchorKey, ...includedSegmentKeys];

  // Fetch signals for all included segments
  const signalsQuery = supabase
    .from('geo_district_signals')
    .select('*')
    .in('segment_key', allSegmentKeys);

  const allSignals = await fetchAll<DistrictSignalRow>(signalsQuery);

  if (allSignals.length === 0) {
    return {
      totals: {
        baseDistricts: 0,
        includedDistricts: 0,
        estimatedHouseholds: 0,
        avgConfidence: 0,
      },
      providerStats: [],
      includedDistricts: [],
      debug: {
        eligibleDistrictsCount: 0,
        missingCentroidsCount: 0,
        signalsMissingGeoCount: 0,
      },
    };
  }

  // Get CCS base universe (eligible districts)
  const ccsSignals = allSignals.filter(
    (s) => s.provider === 'CCS' && s.segment_key === anchorKey
  );

  const eligibleDistricts = new Set<string>();
  for (const signal of ccsSignals) {
    const normalized = normalizeDistrict(signal.district);
    const hasPresence = signal.sectors_count > 0;
    const meetsThreshold = signal.has_score
      ? (signal.district_score_norm ?? 0) >= confidenceThreshold
      : true;

    if (hasPresence && meetsThreshold) {
      eligibleDistricts.add(normalized);
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
    
    // Update eligibleDistricts set to match filtered list for consistency
    eligibleDistricts.clear();
    for (const district of eligibleDistrictIds) {
      eligibleDistricts.add(district);
    }
  }

  // Compute base districts (anchor only)
  const baseDistricts = new Set<string>();
  if (includeAnchorOnly) {
    // Base = eligible districts where CCS supports anchor with confidence >= threshold
    for (const signal of ccsSignals) {
      const normalized = normalizeDistrict(signal.district);
      if (eligibleDistricts.has(normalized)) {
        const meetsThreshold = signal.has_score
          ? (signal.district_score_norm ?? 0) >= confidenceThreshold
          : signal.sectors_count > 0;
        if (meetsThreshold) {
          baseDistricts.add(normalized);
        }
      }
    }
  }

  // Compute included districts (union of all included segments)
  // A district is included if:
  // 1. Eligible (CCS anchor >= threshold)
  // 2. At least one non-CCS provider supports any included segment with confidence >= threshold
  //    OR (if includeAnchorOnly) CCS supports anchor
  const includedDistrictSet = new Set<string>();
  const districtProviderMap = new Map<string, Set<string>>(); // district -> providers supporting
  const districtConfidenceMap = new Map<string, number[]>(); // district -> confidence values

  // Process all signals
  for (const signal of allSignals) {
    const normalized = normalizeDistrict(signal.district);

    // Only consider eligible districts
    if (!eligibleDistricts.has(normalized)) {
      continue;
    }

    // Check if this signal meets threshold
    const hasPresence = signal.sectors_count > 0;
    const meetsThreshold = signal.has_score
      ? (signal.district_score_norm ?? 0) >= confidenceThreshold
      : hasPresence;

    if (!meetsThreshold) {
      continue;
    }

    // Check if signal is for an included segment
    if (!allSegmentKeys.includes(signal.segment_key)) {
      continue;
    }

    // Track provider support
    if (!districtProviderMap.has(normalized)) {
      districtProviderMap.set(normalized, new Set());
      districtConfidenceMap.set(normalized, []);
    }

    districtProviderMap.get(normalized)!.add(signal.provider);
    const confidence = signal.has_score ? (signal.district_score_norm ?? 0) : 0.5;
    districtConfidenceMap.get(normalized)!.push(confidence);

    // Include if:
    // - CCS supports anchor (and includeAnchorOnly is true), OR
    // - Non-CCS provider supports any included segment
    if (signal.provider === 'CCS' && signal.segment_key === anchorKey && includeAnchorOnly) {
      includedDistrictSet.add(normalized);
    } else if (signal.provider !== 'CCS') {
      includedDistrictSet.add(normalized);
    }
  }

  const includedDistrictIds = Array.from(includedDistrictSet);

  // Fetch centroids for included districts (batch to avoid Supabase limits)
  const includedDistrictsWithCentroids: IncludedDistrict[] = [];
  const missingCentroids: string[] = [];

  // Batch districts for .in() queries (Supabase limit is ~1000)
  const batchSize = 500;
  for (let i = 0; i < includedDistrictIds.length; i += batchSize) {
    const batch = includedDistrictIds.slice(i, i + batchSize);
    const { data: geoDistricts } = await supabase
      .from('geo_districts')
      .select('district, centroid_lat, centroid_lng')
      .in('district', batch);

    if (geoDistricts) {
      for (const districtId of batch) {
        const geo = (geoDistricts as any[]).find((g: any) => normalizeDistrict(g.district) === districtId);
        if (geo && geo.centroid_lat && geo.centroid_lng) {
          const providers = Array.from(districtProviderMap.get(districtId) || []);
          const confidences = districtConfidenceMap.get(districtId) || [];
          const avgConf = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0;

          includedDistrictsWithCentroids.push({
            district: districtId,
            centroid_lat: geo.centroid_lat,
            centroid_lng: geo.centroid_lng,
            agreementCount: providers.length,
            supportingProviders: providers,
            avgConfidence: avgConf,
          });
        } else {
          missingCentroids.push(districtId);
        }
      }
    }
  }

  // Get provider segment aliases for labels
  const { data: aliases } = await supabase
    .from('provider_segment_aliases')
    .select('canonical_key, provider, provider_segment_label')
    .in('canonical_key', allSegmentKeys);

  const aliasMap = new Map<string, Map<string, string>>(); // segment_key -> provider -> label
  if (aliases) {
    for (const alias of (aliases as any[])) {
      if (!aliasMap.has(alias.canonical_key)) {
        aliasMap.set(alias.canonical_key, new Map());
      }
      aliasMap.get(alias.canonical_key)!.set(alias.provider, alias.provider_segment_label);
    }
  }

  // Compute provider stats
  const providerStatsMap = new Map<string, ProviderImpactStats>();
  const allProviders = new Set<string>();

  // Collect all providers (filter by providers param if provided)
  const providerFilter = providers ? new Set(providers) : null;
  for (const signal of allSignals) {
    if (signal.provider !== 'CCS' || includeAnchorOnly) {
      // If providers filter is set, only include providers in the filter (CCS is always included)
      if (!providerFilter || providerFilter.has(signal.provider) || signal.provider === 'CCS') {
        allProviders.add(signal.provider);
      }
    }
  }

  // Get provider metadata from data_partners for display names
  let providerMetadataMap = new Map<string, { display_name: string }>();
  try {
    const partners = await getDataPartnersByKeys(Array.from(allProviders));
    partners.forEach(partner => {
      providerMetadataMap.set(partner.provider_key, { display_name: partner.display_name });
    });
  } catch (error) {
    console.warn('Failed to fetch provider metadata:', error);
  }

  // Initialize provider stats
  for (const provider of allProviders) {
    const metadata = providerMetadataMap.get(provider);
    providerStatsMap.set(provider, {
      provider,
      providerLabel: metadata?.display_name || provider,
      providerLabelForSegments: {},
      districtsSupporting: 0,
      incrementalDistricts: 0,
      overlapDistricts: 0,
      overlapPct: 0,
      avgProviderConfidence: 0,
    });
  }

  // Compute stats per provider
  for (const provider of allProviders) {
    const stats = providerStatsMap.get(provider)!;
    const providerSignals = allSignals.filter((s) => s.provider === provider);
    const providerDistricts = new Set<string>();
    const providerConfidences: number[] = [];

    // Get labels for this provider's segments
    for (const segmentKey of allSegmentKeys) {
      const alias = aliasMap.get(segmentKey)?.get(provider);
      if (alias) {
        stats.providerLabelForSegments[segmentKey] = alias;
      }
    }

    // Count districts this provider supports
    for (const signal of providerSignals) {
      const normalized = normalizeDistrict(signal.district);
      if (!eligibleDistricts.has(normalized)) {
        continue;
      }

      const hasPresence = signal.sectors_count > 0;
      const meetsThreshold = signal.has_score
        ? (signal.district_score_norm ?? 0) >= confidenceThreshold
        : hasPresence;

      if (meetsThreshold && allSegmentKeys.includes(signal.segment_key)) {
        providerDistricts.add(normalized);
        const confidence = signal.has_score ? (signal.district_score_norm ?? 0) : 0.5;
        providerConfidences.push(confidence);
      }
    }

    stats.districtsSupporting = providerDistricts.size;
    stats.avgProviderConfidence =
      providerConfidences.length > 0
        ? providerConfidences.reduce((a, b) => a + b, 0) / providerConfidences.length
        : 0;

    // Compute incremental vs overlap
    // Incremental = districts provider adds beyond base set
    // Overlap = districts already in included set that provider also supports
    let incremental = 0;
    let overlap = 0;

    for (const district of providerDistricts) {
      if (includedDistrictSet.has(district)) {
        // Check if this district would be included without this provider
        const otherProviders = Array.from(districtProviderMap.get(district) || []).filter(
          (p) => p !== provider
        );
        if (otherProviders.length === 0 || (includeAnchorOnly && otherProviders.length === 1 && otherProviders[0] === 'CCS')) {
          incremental++;
        } else {
          overlap++;
        }
      }
    }

    stats.incrementalDistricts = incremental;
    stats.overlapDistricts = overlap;
    stats.overlapPct = stats.districtsSupporting > 0 ? (overlap / stats.districtsSupporting) * 100 : 0;
  }

  // Sort provider stats: CCS first (if includeAnchorOnly), then by incrementalDistricts desc
  const providerStats = Array.from(providerStatsMap.values()).sort((a, b) => {
    if (a.provider === 'CCS' && includeAnchorOnly) return -1;
    if (b.provider === 'CCS' && includeAnchorOnly) return 1;
    return b.incrementalDistricts - a.incrementalDistricts;
  });

  // Compute totals
  const totalConfidences = includedDistrictsWithCentroids.map((d) => d.avgConfidence);
  const avgConfidence =
    totalConfidences.length > 0
      ? totalConfidences.reduce((a, b) => a + b, 0) / totalConfidences.length
      : 0;

  // Calculate estimated households: sum real household counts, fallback to 2500 per district if NULL
  let estimatedHouseholds = 0;
  const FALLBACK_HOUSEHOLDS_PER_DISTRICT = 2500;
  const districtsIncluded = includedDistrictsWithCentroids.length;
  
  if (districtsIncluded > 0) {
    // Fetch household counts for included districts
    const includedDistrictIds = includedDistrictsWithCentroids.map(d => d.district);
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
        console.warn('[extensionResults] Error fetching households batch:', householdError);
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
      console.log(`[extensionResults] Households: ${districtsWithHouseholds} with real data, ${districtsWithoutHouseholds} using fallback`);
      console.log(`[extensionResults] Total: ${estimatedHouseholds.toLocaleString()} households across ${districtsIncluded} districts (avg: ${avgHouseholdsPerDistrict.toFixed(0)} per district)`);
      
      // Sanity check: UK postcode districts typically have 1,000-50,000 households
      if (avgHouseholdsPerDistrict > 100000) {
        console.warn(`[extensionResults] ⚠️  Average households per district (${avgHouseholdsPerDistrict.toFixed(0)}) seems unusually high. Expected range: 1,000-50,000`);
      } else if (avgHouseholdsPerDistrict < 500 && districtsWithHouseholds > 0) {
        console.warn(`[extensionResults] ⚠️  Average households per district (${avgHouseholdsPerDistrict.toFixed(0)}) seems unusually low. Expected range: 1,000-50,000`);
      }
    }
  }

  return {
    totals: {
      baseDistricts: baseDistricts.size,
      includedDistricts: districtsIncluded,
      estimatedHouseholds,
      avgConfidence,
    },
    providerStats,
    includedDistricts: includedDistrictsWithCentroids,
    debug: {
      eligibleDistrictsCount: eligibleDistrictIds.length,
      missingCentroidsCount: missingCentroids.length,
      signalsMissingGeoCount: 0, // TODO: compute if needed
    },
  };
}
