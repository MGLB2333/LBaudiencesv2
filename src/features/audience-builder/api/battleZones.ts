import { createClient } from '@/lib/supabase/client';

export interface BattleZoneDistrict {
  district: string;
  category: 'owned' | 'contested' | 'competitor_only';
  base_store_count: number;
  competitor_store_count: number;
  competitor_brands_present: string[];
}

export interface BattleZoneSummary {
  totalCatchmentDistricts: number;
  ownedDistricts: number;
  contestedDistricts: number;
  competitorOnlyDistricts: number;
  baseStoreCountInCatchment: number;
  competitorStoreCountInCatchment: number;
  topContestedDistricts: Array<{
    district: string;
    baseStoreCount: number;
    competitorStoreCount: number;
    competitorBrands: string[];
  }>;
}

export interface BattleZonesOptions {
  baseBrand: string;
  competitorBrands?: string[];
  rings?: number;
  tvRegions?: string[];
}

/**
 * Get battle zone districts with category classification
 */
export async function getBattleZoneDistricts(
  options: BattleZonesOptions
): Promise<BattleZoneDistrict[]> {
  const { baseBrand, competitorBrands = [], rings = 0, tvRegions } = options;
  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_battle_zones_districts', {
    base_brand: baseBrand,
    competitor_brands: competitorBrands.length > 0 ? competitorBrands : null,
    rings: rings || 0,
    tv_regions: tvRegions && tvRegions.length > 0 ? tvRegions : null,
  } as any);

  if (error) {
    console.error('Error fetching battle zone districts:', error);
    throw error;
  }

  return (data || []) as BattleZoneDistrict[];
}

/**
 * Get battle zone summary statistics
 */
export async function getBattleZoneSummary(
  options: BattleZonesOptions
): Promise<BattleZoneSummary> {
  const { baseBrand, competitorBrands = [], rings = 0, tvRegions } = options;
  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_battle_zones_summary', {
    base_brand: baseBrand,
    competitor_brands: competitorBrands.length > 0 ? competitorBrands : null,
    rings: rings || 0,
    tv_regions: tvRegions && tvRegions.length > 0 ? tvRegions : null,
  } as any);

  if (error) {
    console.error('Error fetching battle zone summary:', error);
    throw error;
  }

  return (data || {}) as BattleZoneSummary;
}
