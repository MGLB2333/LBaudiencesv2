import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as audiencesApi from '../api/audiences';
import { Audience } from '@/lib/types';

export function useAudiences() {
  return useQuery({
    queryKey: ['audiences'],
    queryFn: audiencesApi.getAudiences,
  });
}

export function useAudience(id: string) {
  return useQuery({
    queryKey: ['audiences', id],
    queryFn: () => audiencesApi.getAudience(id),
    enabled: !!id,
  });
}

export function useCreateAudience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: audiencesApi.createAudience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiences'] });
    },
  });
}

export function useUpdateAudience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Audience> }) =>
      audiencesApi.updateAudience(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['audiences'] });
      queryClient.invalidateQueries({ queryKey: ['audiences', variables.id] });
    },
  });
}

export function useDeleteAudience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: audiencesApi.deleteAudience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiences'] });
    },
  });
}
