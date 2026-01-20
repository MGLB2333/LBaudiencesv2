import { useQuery } from '@tanstack/react-query';
import { getSegmentProviderCoverage, ProviderCoverage } from '../api/segmentCoverage';

export function useSegmentProviderCoverage({
  segmentKey,
  enabled = true,
}: {
  segmentKey: string;
  enabled?: boolean;
}) {
  return useQuery<ProviderCoverage[]>({
    queryKey: ['segmentProviderCoverage', segmentKey],
    queryFn: () => getSegmentProviderCoverage(segmentKey),
    enabled: enabled && !!segmentKey,
    refetchOnWindowFocus: false,
    retry: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
