import { useQuery } from '@tanstack/react-query';
import {
  getBattleZoneDistricts,
  getBattleZoneSummary,
  BattleZoneDistrict,
  BattleZoneSummary,
  BattleZonesOptions,
} from '@/features/audience-builder/api/battleZones';

/**
 * Hook to fetch battle zone districts
 */
export function useBattleZoneDistricts(
  options: BattleZonesOptions | null,
  enabled: boolean = true
) {
  return useQuery<BattleZoneDistrict[]>({
    queryKey: [
      'battleZones',
      'districts',
      options?.baseBrand,
      options?.competitorBrands?.sort().join(','),
      options?.rings,
      options?.tvRegions?.sort().join(','),
    ],
    queryFn: () => {
      if (!options) throw new Error('Battle zones options required');
      return getBattleZoneDistricts(options);
    },
    enabled: enabled && !!options?.baseBrand,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook to fetch battle zone summary
 */
export function useBattleZoneSummary(
  options: BattleZonesOptions | null,
  enabled: boolean = true
) {
  return useQuery<BattleZoneSummary>({
    queryKey: [
      'battleZones',
      'summary',
      options?.baseBrand,
      options?.competitorBrands?.sort().join(','),
      options?.rings,
      options?.tvRegions?.sort().join(','),
    ],
    queryFn: () => {
      if (!options) throw new Error('Battle zones options required');
      return getBattleZoneSummary(options);
    },
    enabled: enabled && !!options?.baseBrand,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
