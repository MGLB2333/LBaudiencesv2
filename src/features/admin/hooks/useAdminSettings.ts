import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as adminSettingsApi from '../api/adminSettings';

export function useSelectedLogo() {
  return useQuery({
    queryKey: ['adminSettings', 'selected_logo'],
    queryFn: () => adminSettingsApi.getSelectedLogo(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useSetSelectedLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filename: string) => adminSettingsApi.setSelectedLogo(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings', 'selected_logo'] });
    },
  });
}
