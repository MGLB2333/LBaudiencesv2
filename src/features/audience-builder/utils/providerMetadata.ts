import { getDataPartnerByKey, getDataPartnersByKeys, DataPartner } from '@/features/admin/api/dataPartners';

/**
 * Get provider favicon URL from data_partners, with fallback
 */
export async function getProviderFavicon(providerKey: string): Promise<string> {
  try {
    const partner = await getDataPartnerByKey(providerKey);
    if (partner?.logo_url) {
      return partner.logo_url;
    }
  } catch (error) {
    console.warn(`Failed to fetch logo for ${providerKey}:`, error);
  }

  // Fallback: try to construct from provider name
  const domainMap: Record<string, string> = {
    CCS: 'dentsu.com',
    Experian: 'experian.co.uk',
    ONS: 'ons.gov.uk',
    Outra: 'outra.com',
    YouGov: 'yougov.co.uk',
    TwentyCI: 'twentyci.co.uk',
    Captify: 'captify.co.uk',
    Kogenta: 'kogenta.com',
    Starcount: 'starcount.com',
  };

  const domain = domainMap[providerKey];
  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  }

  // Ultimate fallback
  return `https://www.google.com/s2/favicons?domain=${providerKey.toLowerCase()}.com&sz=32`;
}

/**
 * Get provider display name from data_partners, with fallback
 */
export async function getProviderDisplayName(providerKey: string): Promise<string> {
  try {
    const partner = await getDataPartnerByKey(providerKey);
    if (partner?.display_name) {
      return partner.display_name;
    }
  } catch (error) {
    console.warn(`Failed to fetch display name for ${providerKey}:`, error);
  }

  return providerKey;
}

/**
 * Get provider metadata for multiple providers at once
 */
export async function getProvidersMetadata(providerKeys: string[]): Promise<Map<string, DataPartner>> {
  if (providerKeys.length === 0) return new Map();

  try {
    const partners = await getDataPartnersByKeys(providerKeys);
    const map = new Map<string, DataPartner>();
    partners.forEach(partner => {
      map.set(partner.provider_key, partner);
    });
    return map;
  } catch (error) {
    console.warn('Failed to fetch provider metadata:', error);
    return new Map();
  }
}
