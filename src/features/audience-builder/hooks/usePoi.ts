import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as poiApi from '../api/poi';
import { PoiLayer } from '@/lib/types';

export function usePoiLayers(audienceId: string) {
  return useQuery({
    queryKey: ['poi', audienceId],
    queryFn: () => poiApi.getPoiLayers(audienceId),
    enabled: !!audienceId,
  });
}

export function useCreatePoiLayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ audienceId, layer }: { audienceId: string; layer: Parameters<typeof poiApi.createPoiLayer>[1] }) =>
      poiApi.createPoiLayer(audienceId, layer),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['poi', variables.audienceId] });
    },
  });
}

export function useUpdatePoiLayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ layerId, updates }: { layerId: string; updates: Partial<PoiLayer> }) =>
      poiApi.updatePoiLayer(layerId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poi'] });
    },
  });
}

export function useDeletePoiLayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: poiApi.deletePoiLayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poi'] });
    },
  });
}
