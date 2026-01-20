import { useQuery } from '@tanstack/react-query';
import { getSegmentProviders, SegmentProvider } from '../api/segmentProviders';

export function useSegmentProviders({
  segmentKey,
  enabled = true,
}: {
  segmentKey: string;
  enabled?: boolean;
}) {
  return useQuery<SegmentProvider[]>({
    queryKey: ['segmentProviders', segmentKey],
    queryFn: () => getSegmentProviders({ segmentKey }),
    enabled: enabled && !!segmentKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
  });
}
