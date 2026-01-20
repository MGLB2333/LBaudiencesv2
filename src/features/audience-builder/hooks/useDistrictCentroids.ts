import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDistrictCentroids, DistrictCentroid } from '@/features/audience-builder/api/districtCentroids';

/**
 * Hook to fetch district centroids
 */
export function useDistrictCentroids(
  districts: string[],
  enabled: boolean = true
) {
  // Create stable key from sorted districts
  const districtsKey = useMemo(() => {
    return [...districts].sort().join('|');
  }, [districts]);

  return useQuery<DistrictCentroid[]>({
    queryKey: ['districtCentroids', districtsKey],
    queryFn: () => getDistrictCentroids(districts),
    enabled: enabled && districts.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
