/**
 * Get favicon URL for a provider, with fallback to Google favicon service
 * This is a synchronous function that uses fallback logic.
 * For data_partners logo_url, use useProviderMetadata hook instead.
 */
export function getProviderFavicon(provider: string, logoUrl?: string | null): string {
  // If logo_url is provided from data_partners, use it
  if (logoUrl) {
    return logoUrl;
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

  const domain = domainMap[provider];
  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  }

  // Ultimate fallback
  return `https://www.google.com/s2/favicons?domain=${provider.toLowerCase()}.com&sz=32`;
}
