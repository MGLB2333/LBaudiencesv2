import { createClient } from '@/lib/supabase/client';

export interface StorePoi {
  id: string;
  brand: string;
  name: string;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  lat: number;
  lng: number;
  website_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface PoiDistrictMapping {
  poi_id: string;
  district: string;
  distance_km: number;
}

export interface SearchPoisOptions {
  brandQuery?: string;
  limit?: number;
}

/**
 * Search POIs by brand or name
 */
export async function searchPoisByBrand(options: SearchPoisOptions = {}): Promise<StorePoi[]> {
  const { brandQuery = '', limit = 20 } = options;
  const supabase = createClient();

  let query = supabase
    .from('store_pois')
    .select('*')
    .order('brand', { ascending: true })
    .order('name', { ascending: true })
    .limit(limit);

  if (brandQuery.trim()) {
    const searchTerm = brandQuery.trim().toLowerCase();
    query = query.or(`brand.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as StorePoi[];
}

/**
 * Get district mappings for multiple POIs
 */
export async function getPoiDistrictMap(poiIds: string[]): Promise<Record<string, PoiDistrictMapping>> {
  if (poiIds.length === 0) return {};

  const supabase = createClient();
  const { data, error } = await supabase
    .from('store_poi_district')
    .select('poi_id, district, distance_km')
    .in('poi_id', poiIds);

  if (error) throw error;

  const mapping: Record<string, PoiDistrictMapping> = {};
  ((data as any[]) || []).forEach((row: any) => {
    mapping[row.poi_id] = {
      poi_id: row.poi_id,
      district: row.district,
      distance_km: row.distance_km,
    };
  });

  return mapping;
}

/**
 * Create a new POI (for admin/manual entry)
 */
export async function createPoi(payload: {
  brand: string;
  name: string;
  address?: string;
  city?: string;
  postcode?: string;
  lat: number;
  lng: number;
  website_url?: string;
  notes?: string;
}): Promise<StorePoi> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('store_pois')
    .insert(payload as any)
    .select()
    .single();

  if (error) throw error;
  return data as StorePoi;
}

/**
 * Update an existing POI
 */
export async function updatePoi(
  id: string,
  updates: Partial<{
    brand: string;
    name: string;
    address: string;
    city: string;
    postcode: string;
    lat: number;
    lng: number;
    website_url: string;
    notes: string;
  }>
): Promise<StorePoi> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('store_pois') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as StorePoi;
}

/**
 * Get POIs by IDs (for fetching details of selected POIs)
 */
export async function getPoisByIds(poiIds: string[]): Promise<StorePoi[]> {
  if (poiIds.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from('store_pois')
    .select('*')
    .in('id', poiIds)
    .order('brand', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as StorePoi[];
}

export interface PoiBrand {
  brand: string;
  count: number;
}

/**
 * Get distinct brands with counts, sorted by count desc then name asc
 */
export async function getPoiBrands(): Promise<PoiBrand[]> {
  const supabase = createClient();
  
  // Fetch all POIs and group in JS (Supabase doesn't support GROUP BY in client)
  const { data, error } = await supabase
    .from('store_pois')
    .select('brand');

  if (error) throw error;

  // Group by brand and count
  const brandMap = new Map<string, number>();
  ((data as any[]) || []).forEach((poi: any) => {
    const brand = poi.brand;
    brandMap.set(brand, (brandMap.get(brand) || 0) + 1);
  });

  // Convert to array and sort
  const brands: PoiBrand[] = Array.from(brandMap.entries()).map(([brand, count]) => ({
    brand,
    count,
  }));

  // Sort by count desc, then brand name asc
  brands.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.brand.localeCompare(b.brand);
  });

  return brands;
}

/**
 * Get all POIs for given brands
 */
export async function getPoisByBrands(brands: string[]): Promise<StorePoi[]> {
  if (brands.length === 0) return [];

  const supabase = createClient();
  
  // Use case-insensitive matching by fetching all and filtering
  // (Supabase client doesn't support case-insensitive .in())
  const { data, error } = await supabase
    .from('store_pois')
    .select('*')
    .order('brand', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  // Filter by brands (case-insensitive)
  const brandsLower = brands.map(b => b.toLowerCase());
  const filtered = ((data as any[]) || []).filter((poi: any) =>
    brandsLower.includes(poi.brand.toLowerCase())
  );

  return filtered as StorePoi[];
}
