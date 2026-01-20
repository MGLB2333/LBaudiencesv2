import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as segmentsApi from '../api/segments';
import { SegmentType, ConstructionMode } from '@/lib/types';

export function useSegments(
  audienceId: string,
  segmentType?: SegmentType,
  constructionMode?: ConstructionMode
) {
  return useQuery({
    queryKey: ['segments', audienceId, segmentType, constructionMode],
    queryFn: () => segmentsApi.getSegments(audienceId, segmentType, constructionMode),
    enabled: !!audienceId,
  });
}

export function useUpdateSegmentSelection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ segmentId, isSelected }: { segmentId: string; isSelected: boolean }) =>
      segmentsApi.updateSegmentSelection(segmentId, isSelected),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

export function useRemoveSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: segmentsApi.removeSegment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

export function useUpdateConstructionMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, mode }: { audienceId: string; mode: ConstructionMode }) =>
      segmentsApi.updateConstructionMode(audienceId, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}
