import { useQuery } from '@tanstack/react-query';
import { getDataPartnersByKeys } from '@/features/admin/api/dataPartners';

/**
 * React Query hook to fetch provider metadata for multiple providers
 */
export function useProviderMetadata(providerKeys: string[]) {
  return useQuery({
    queryKey: ['providerMetadata', providerKeys.sort().join(',')],
    queryFn: () => getDataPartnersByKeys(providerKeys),
    enabled: providerKeys.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
