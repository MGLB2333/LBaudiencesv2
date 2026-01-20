import { useQuery } from '@tanstack/react-query';
import { getProviderImpact, ExtensionResults } from '../api/extensionResults';

export function useProviderImpact({
  anchorKey,
  includedSegmentKeys,
  confidenceThreshold = 0.5,
  includeAnchorOnly = true,
  providers,
  enabled = true,
}: {
  anchorKey: string;
  includedSegmentKeys: string[];
  confidenceThreshold?: number;
  includeAnchorOnly?: boolean;
  providers?: string[];
  enabled?: boolean;
}) {
  // Sort keys for stable query key
  const sortedKeys = [...includedSegmentKeys].sort().join(',');
  const providersKey = providers ? providers.sort().join('|') : '';

  return useQuery<ExtensionResults>({
    queryKey: [
      'providerImpact',
      anchorKey,
      sortedKeys,
      confidenceThreshold,
      includeAnchorOnly,
      providersKey,
    ],
    queryFn: () =>
      getProviderImpact({
        anchorKey,
        includedSegmentKeys,
        confidenceThreshold,
        includeAnchorOnly,
        providers,
      }),
    enabled: enabled && !!anchorKey && includedSegmentKeys.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
  });
}
