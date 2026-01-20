import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as exportsApi from '../api/exports';

export function useExports(audienceId: string) {
  return useQuery({
    queryKey: ['exports', audienceId],
    queryFn: () => exportsApi.getExports(audienceId),
    enabled: !!audienceId,
  });
}

export function useCreateExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, exportType, storagePath }: { audienceId: string; exportType: 'csv' | 'geojson'; storagePath: string }) =>
      exportsApi.createExport(audienceId, exportType, storagePath),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exports', variables.audienceId] });
    },
  });
}
