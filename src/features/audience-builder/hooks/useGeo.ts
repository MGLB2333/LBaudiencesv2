import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as geoApi from '../api/geo';

export function useGeoUnits(audienceId: string) {
  return useQuery({
    queryKey: ['geo_units', audienceId],
    queryFn: () => geoApi.getGeoUnits(audienceId),
    enabled: !!audienceId,
  });
}

export function useGenerateGeoUnits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, scaleAccuracy }: { audienceId: string; scaleAccuracy?: number }) =>
      geoApi.generateGeoUnitsFromSignals(audienceId, scaleAccuracy || 50),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['geo_units', variables.audienceId] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.audienceId] });
    },
  });
}

export function useRescoreGeoUnits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, scaleAccuracy }: { audienceId: string; scaleAccuracy: number }) =>
      geoApi.rescoreGeoUnits(audienceId, scaleAccuracy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['geo_units', variables.audienceId] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.audienceId] });
    },
  });
}
