import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as profileApi from '../api/profile';
import { AudienceProfileSettings } from '@/lib/types';

export function useProfileSettings(audienceId: string) {
  return useQuery({
    queryKey: ['profile', audienceId],
    queryFn: () => profileApi.getProfileSettings(audienceId),
    enabled: !!audienceId,
  });
}

export function useUpdateProfileSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, updates }: { audienceId: string; updates: Partial<AudienceProfileSettings> }) =>
      profileApi.updateProfileSettings(audienceId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.audienceId] });
    },
  });
}
