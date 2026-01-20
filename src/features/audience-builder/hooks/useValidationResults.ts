import { useQuery } from '@tanstack/react-query';
import { getValidationResults, ValidationResults } from '../api/validationResults';

/**
 * Fetch validation results for a segment with specific filters.
 * Query key includes minAgreement so results refetch when slider changes.
 */
export function useValidationResults({
  segmentKey,
  minAgreement,
  providers,
  tvRegions,
  enabled = true,
}: {
  segmentKey: string;
  minAgreement: number;
  providers?: string[];
  tvRegions?: string[];
  enabled?: boolean;
}) {
  // Stable providers key for query key
  const providersKey = providers ? providers.sort().join('|') : '';
  // Stable tvRegions key (sorted for consistency)
  const tvRegionsKey = tvRegions && tvRegions.length > 0 ? tvRegions.sort().join('|') : '';
  
  return useQuery<ValidationResults>({
    queryKey: ['validationResults', segmentKey, minAgreement, providersKey, tvRegionsKey], // Include minAgreement in key
    queryFn: async () => {
      // Fetch with actual minAgreement so estimatedHouseholds reflects the filtered district set
      return await getValidationResults({ segmentKey, minAgreement, providers, tvRegions });
    },
    enabled: enabled && !!segmentKey && minAgreement > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter since slider changes trigger refetches
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
    refetchInterval: false, // No polling
    retry: process.env.NODE_ENV === 'development' ? 0 : (failureCount) => failureCount < 2,
  });
}
