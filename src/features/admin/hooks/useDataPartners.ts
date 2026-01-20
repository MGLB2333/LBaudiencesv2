import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listDataPartners,
  getDataPartnerByKey,
  getDataPartnersByKeys,
  updateDataPartner,
  syncDataPartnersFromSignals,
  DataPartner,
} from '../api/dataPartners';

/**
 * React Query hook to fetch all data partners
 */
export function useDataPartners() {
  return useQuery({
    queryKey: ['dataPartners'],
    queryFn: listDataPartners,
  });
}

/**
 * React Query hook to fetch a single data partner by provider_key
 */
export function useDataPartner(providerKey: string | null) {
  return useQuery({
    queryKey: ['dataPartner', providerKey],
    queryFn: () => providerKey ? getDataPartnerByKey(providerKey) : null,
    enabled: !!providerKey,
  });
}

/**
 * React Query hook to fetch multiple data partners by provider_keys
 */
export function useDataPartnersByKeys(providerKeys: string[]) {
  return useQuery({
    queryKey: ['dataPartners', 'byKeys', providerKeys.sort().join(',')],
    queryFn: () => getDataPartnersByKeys(providerKeys),
    enabled: providerKeys.length > 0,
  });
}

/**
 * React Query hook to update a data partner
 */
export function useUpdateDataPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ providerKey, updates }: { providerKey: string; updates: Partial<Pick<DataPartner, 'display_name' | 'website_url' | 'description' | 'logo_url'>> }) =>
      updateDataPartner(providerKey, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataPartners'] });
    },
  });
}

/**
 * React Query hook to sync data partners from signals
 */
export function useSyncDataPartners() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncDataPartnersFromSignals,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataPartners'] });
    },
  });
}
