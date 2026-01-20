import { useQuery } from '@tanstack/react-query';
import { getAvailableSegments, AvailableSegment } from '../api/availableSegments';

export function useAvailableSegments() {
  return useQuery<AvailableSegment[]>({
    queryKey: ['availableSegments'],
    queryFn: getAvailableSegments,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 0,
  });
}
