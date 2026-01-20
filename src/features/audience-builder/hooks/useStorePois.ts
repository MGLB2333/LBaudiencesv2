import { useQuery } from '@tanstack/react-query';
import * as storePoisApi from '../api/storePois';
import { SearchPoisOptions } from '../api/storePois';

/**
 * Search POIs by brand/name with debouncing handled in UI
 */
export function usePoiSearch(brandQuery: string, options: { limit?: number; enabled?: boolean } = {}) {
  const { limit = 20, enabled = true } = options;
  
  return useQuery({
    queryKey: ['poiSearch', brandQuery, limit],
    queryFn: () => storePoisApi.searchPoisByBrand({ brandQuery, limit }),
    enabled: enabled && brandQuery.trim().length > 0,
    staleTime: 30 * 1000, // 30 seconds - POI data doesn't change often
  });
}

/**
 * Get district mappings for selected POIs
 */
export function usePoiDistrictMap(poiIds: string[]) {
  return useQuery({
    queryKey: ['poiDistrictMap', poiIds.sort().join(',')],
    queryFn: () => storePoisApi.getPoiDistrictMap(poiIds),
    enabled: poiIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - district mappings are stable
  });
}

/**
 * Get POI details by IDs
 */
export function usePoisByIds(poiIds: string[]) {
  return useQuery({
    queryKey: ['poisByIds', poiIds.sort().join(',')],
    queryFn: () => storePoisApi.getPoisByIds(poiIds),
    enabled: poiIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get distinct brands with counts
 */
export function usePoiBrands() {
  return useQuery({
    queryKey: ['poiBrands'],
    queryFn: () => storePoisApi.getPoiBrands(),
    staleTime: 5 * 60 * 1000, // 5 minutes - brands don't change often
  });
}

/**
 * Get all POIs for selected brands
 */
export function usePoisByBrands(brands: string[]) {
  const brandsKey = brands.sort().join(',');
  
  return useQuery({
    queryKey: ['poisByBrands', brandsKey],
    queryFn: () => storePoisApi.getPoisByBrands(brands),
    enabled: brands.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
