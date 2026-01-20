import { useQuery } from '@tanstack/react-query';
import { getExtensionSuggestions, ExtensionSuggestion } from '../api/extensionResults';

export function useExtensionSuggestions({
  anchorKey,
  q,
  tags,
  provider,
  enabled = true,
}: {
  anchorKey: string;
  q?: string;
  tags?: string[];
  provider?: string;
  enabled?: boolean;
}) {
  return useQuery<ExtensionSuggestion[]>({
    queryKey: ['extensionSuggestions', anchorKey, q || '', tags?.join(',') || '', provider || ''],
    queryFn: () => getExtensionSuggestions({ anchorKey, q, tags, provider }),
    enabled: enabled && !!anchorKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
  });
}
