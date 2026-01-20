import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as segmentLibraryApi from '../api/segmentLibrary';
import * as segmentsApi from '../api/segments';

export function useSegmentMatches(briefSegmentKey: string, briefProvider: string = 'CCS') {
  return useQuery({
    queryKey: ['segment_matches', briefSegmentKey, briefProvider],
    queryFn: () => segmentLibraryApi.getSegmentMatches(briefSegmentKey, briefProvider),
    enabled: !!briefSegmentKey,
  });
}

export function useSuggestedSegments(
  existingSegmentKeys: string[], 
  tags: string[] = [],
  searchQuery?: string,
  providerFilter?: string
) {
  return useQuery({
    queryKey: ['suggested_segments', existingSegmentKeys, tags, searchQuery, providerFilter],
    queryFn: () => segmentLibraryApi.getSuggestedSegments(existingSegmentKeys, tags, 10, searchQuery, providerFilter),
    enabled: existingSegmentKeys.length > 0 || true, // Allow suggestions even without existing segments
  });
}

export function useAddSegmentFromSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, suggestion }: { 
      audienceId: string; 
      suggestion: {
        provider: string;
        segment_key: string;
        segment_label: string;
        description?: string;
        origin: 'brief' | 'validated' | 'suggested';
        match_type: 'name_match' | 'inferred';
        evidence?: any;
        source_providers?: string[];
      };
    }) => segmentsApi.addSegmentFromSuggestion(audienceId, suggestion),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['segments', variables.audienceId] });
      queryClient.invalidateQueries({ queryKey: ['suggested_segments'] });
    },
  });
}
