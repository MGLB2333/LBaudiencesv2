import { useQuery } from '@tanstack/react-query';
import { getValidationResults, ValidationResults } from '../api/validationResults';

/**
 * Fetch validation results once per segment build.
 * Query key does NOT include minAgreement - data is fetched once and filtered client-side.
 */
export function useValidationResults({
  segmentKey,
  providers,
  enabled = true,
}: {
  segmentKey: string;
  providers?: string[];
  enabled?: boolean;
}) {
  // Stable providers key for query key
  const providersKey = providers ? providers.sort().join('|') : '';
  
  return useQuery<ValidationResults>({
    queryKey: ['validationResults', segmentKey, providersKey], // Include providers in key
    queryFn: async () => {
      // Fetch with minAgreement=1 to get all eligible districts
      // Client-side filtering will apply the actual minAgreement threshold
      return await getValidationResults({ segmentKey, minAgreement: 1, providers });
    },
    enabled: enabled && !!segmentKey,
    staleTime: 5 * 60 * 1000, // 5 minutes - data is stable per segment build
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
    refetchInterval: false, // No polling
    retry: process.env.NODE_ENV === 'development' ? 0 : (failureCount) => failureCount < 2,
  });
}
