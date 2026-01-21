import { useQuery } from '@tanstack/react-query';
import { getDataPartnersByKeys } from '@/features/admin/api/dataPartners';
import { DataPartner } from '@/features/admin/api/dataPartners';

/**
 * Hook to fetch provider metadata for a list of provider keys
 * Returns a Map for quick lookups
 */
export function useProviderMetadata(providerKeys: string[]) {
  const uniqueKeys = Array.from(new Set(providerKeys)).filter(Boolean);
  
  return useQuery({
    queryKey: ['providerMetadata', uniqueKeys.sort().join(',')],
    queryFn: async () => {
      if (uniqueKeys.length === 0) return new Map<string, DataPartner>();
      
      const partners = await getDataPartnersByKeys(uniqueKeys);
      const map = new Map<string, DataPartner>();
      partners.forEach(partner => {
        map.set(partner.provider_key, partner);
      });
      return map;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: uniqueKeys.length > 0,
  });
}
