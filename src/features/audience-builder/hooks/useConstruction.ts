import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as constructionApi from '../api/construction';
import { ConstructionSettings } from '../types/signals';

export function useConstructionSettings(audienceId: string) {
  return useQuery({
    queryKey: ['construction_settings', audienceId],
    queryFn: () => constructionApi.getConstructionSettings(audienceId),
    enabled: !!audienceId,
  });
}

export function useUpdateConstructionSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, updates }: { audienceId: string; updates: Partial<ConstructionSettings> }) =>
      constructionApi.updateConstructionSettings(audienceId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['construction_settings', variables.audienceId] });
      queryClient.invalidateQueries({ queryKey: ['geo_units', variables.audienceId] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.audienceId] });
    },
  });
}
